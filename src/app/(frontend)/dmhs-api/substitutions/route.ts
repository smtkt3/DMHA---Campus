import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import type {
  SchoolWeekday,
  TeacherLeaveSubItem,
  TimetableSlot,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PERIOD_TIME_MAP: Record<number, string> = {
  1: '08:15 – 09:00',
  2: '09:05 – 09:50',
  3: '10:10 – 10:55',
  4: '11:00 – 11:45',
  5: '12:05 – 12:50',
  6: '12:55 – 01:40',
}

function getLocalTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoToSchoolWeekday(iso: string): SchoolWeekday {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 'Sun'
  const dt = new Date(parts[0], parts[1] - 1, parts[2])
  const map: Record<number, SchoolWeekday> = {
    0: 'Sun',
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
  }
  return map[dt.getDay()] || 'Sun'
}

function formatPrettyIso(iso: string): string {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return iso
  const dt = new Date(parts[0], parts[1] - 1, parts[2])
  return dt.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function parsePeriodNumber(periodSlot: string, explicitPeriod?: number): number {
  if (explicitPeriod && explicitPeriod >= 1 && explicitPeriod <= 6) return explicitPeriod
  const m = String(periodSlot || '').match(/Period\s+(\d+)/i) || String(periodSlot || '').match(/P(\d+)/i)
  if (m) {
    const n = Number(m[1])
    if (n >= 1 && n <= 6) return n
  }
  return 1
}

function resolveDateIsoFromText(rawDate?: string, explicitIso?: string): string {
  if (explicitIso && /^\d{4}-\d{2}-\d{2}$/.test(explicitIso)) return explicitIso
  const text = String(rawDate || '').trim()
  const direct = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (direct) return direct[1]
  const today = getLocalTodayIso()
  const lower = text.toLowerCase()
  if (lower.startsWith('tomorrow')) {
    const [y, m, d] = today.split('-').map(Number)
    const dt = new Date(y, m - 1, d + 1)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  }
  const dmy = text.match(/\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*(?:\s+(\d{4}))?\b/)
  if (dmy) {
    const mon = months[dmy[2].toLowerCase()]
    const year = dmy[3] ? Number(dmy[3]) : new Date().getFullYear()
    if (mon) {
      return `${year}-${String(mon).padStart(2, '0')}-${String(Number(dmy[1])).padStart(2, '0')}`
    }
  }
  return today
}

interface TeacherRow {
  id: string
  name: string
  subject: string
  status?: string
}

interface StudentRow {
  id: string
  className: string
  section: string
  todayPeriods?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as {
      action?: 'request' | 'assign' | 'decline'
      // request fields
      dateIso?: string
      date?: string
      day?: SchoolWeekday
      period?: number
      periodSlot?: string
      classSection?: string
      subject?: string
      room?: string
      reason?: string
      preferredSubstituteId?: string
      teacherId?: string
      // assign / decline fields
      leaveId?: string
      substituteTeacherId?: string
    }

    const action = body.action
    if (!action) {
      return NextResponse.json({ ok: false, error: 'Action is required.' }, { status: 400 })
    }

    const persisted = loadPersistedState()
    if (!persisted.exists || !persisted.data) {
      return NextResponse.json({ ok: false, error: 'School state not initialized.' }, { status: 400 })
    }

    const currentData = persisted.data
    const teachers: TeacherRow[] = Array.isArray(currentData.teachers)
      ? (currentData.teachers as TeacherRow[])
      : []
    const teacherLeaves: TeacherLeaveSubItem[] = Array.isArray(currentData.teacherLeaves)
      ? (currentData.teacherLeaves as TeacherLeaveSubItem[])
      : []
    const timetableSlots: TimetableSlot[] = Array.isArray(currentData.timetableSlots)
      ? (currentData.timetableSlots as TimetableSlot[])
      : []
    const students: StudentRow[] = Array.isArray(currentData.students)
      ? (currentData.students as StudentRow[])
      : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []

    // ==================== 1. REQUEST LEAVE / SUBSTITUTE COVER ====================
    if (action === 'request') {
      const targetTeacherId =
        session.role === 'teacher'
          ? session.linked_entity_id
          : String(body.teacherId || teachers[0]?.id || 'tch-nadia')
      const reqTeacher = teachers.find((t) => t.id === targetTeacherId) || teachers[0]
      if (!reqTeacher) {
        return NextResponse.json({ ok: false, error: 'Teacher profile not found.' }, { status: 404 })
      }

      const reason = String(body.reason || '').trim()
      if (!reason) {
        return NextResponse.json({ ok: false, error: 'Please provide a leave reason.' }, { status: 400 })
      }

      const dateIso = resolveDateIsoFromText(body.date, body.dateIso)
      const day: SchoolWeekday = body.day || isoToSchoolWeekday(dateIso)
      const period = parsePeriodNumber(body.periodSlot || '', body.period)
      const timeLabel = PERIOD_TIME_MAP[period] || '08:15 – 09:00'
      const periodSlot = body.periodSlot?.trim() || `${timeLabel} (Period ${period})`
      const classSection = String(body.classSection || 'Class 6 · Section A').trim()

      // Find matching slot in timetable to grab exact subject & room if not explicitly sent
      const matchedSlot = timetableSlots.find(
        (s) =>
          !s.isSubstitute &&
          s.teacherId === reqTeacher.id &&
          s.day === day &&
          s.period === period &&
          s.className.toLowerCase() === classSection.toLowerCase(),
      )
      const subject = String(body.subject || matchedSlot?.subject || reqTeacher.subject || 'General').trim()
      const room = String(body.room || matchedSlot?.room || 'Room 201').trim()

      const prefTeacher = body.preferredSubstituteId
        ? teachers.find((t) => t.id === body.preferredSubstituteId && t.id !== reqTeacher.id)
        : null

      const newLeave: TeacherLeaveSubItem = {
        id: `tleave-${Date.now()}`,
        teacherId: reqTeacher.id,
        teacherName: reqTeacher.name,
        subject,
        date: formatPrettyIso(dateIso),
        dateIso,
        day,
        period,
        room,
        periodSlot,
        classSection,
        reason: reason.slice(0, 300),
        status: 'pending',
        ...(prefTeacher
          ? {
              preferredSubstituteId: prefTeacher.id,
              preferredSubstituteName: prefTeacher.name,
            }
          : {}),
        requestedAt: 'Just now',
      }

      const nextLeaves = [newLeave, ...teacherLeaves]
      const notif = {
        id: `notif-subreq-${Date.now()}`,
        title: `Substitute Needed: ${reqTeacher.name} (${day} P${period})`,
        text: `${reqTeacher.name} requested substitute cover for ${subject} · ${classSection} on ${newLeave.date} (${periodSlot})${prefTeacher ? ` · Requested: ${prefTeacher.name}` : ''}.`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['admin', 'teacher'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        {
          ...currentData,
          teacherLeaves: nextLeaves,
          notifications: nextNotifs,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'teacher_leave_sub_requested',
        target: `${reqTeacher.name} · ${subject} (${classSection}) · ${dateIso} (${day} P${period})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Substitute requested for ${classSection} (${day} P${period})`,
      })

      return NextResponse.json({
        ok: true,
        leave: newLeave,
        teacherLeaves: nextLeaves,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 2. ASSIGN OR ACCEPT SUBSTITUTE -> AUTO-ADD TO TIMETABLE ====================
    if (action === 'assign') {
      const leaveId = String(body.leaveId || '').trim()
      const req = teacherLeaves.find((l) => l.id === leaveId)
      if (!req) {
        return NextResponse.json({ ok: false, error: 'Leave request not found.' }, { status: 404 })
      }
      if (req.status === 'substituted') {
        return NextResponse.json(
          { ok: false, error: `Already covered by ${req.substituteTeacherName}.` },
          { status: 400 },
        )
      }

      // RBAC:
      // - Admin can assign any active teacher other than the absent teacher
      // - A colleague Teacher can accept/volunteer ONLY for themselves (and cannot cover their own leave)
      const subId =
        session.role === 'teacher'
          ? session.linked_entity_id
          : String(body.substituteTeacherId || '').trim()

      if (session.role === 'teacher' && body.substituteTeacherId && body.substituteTeacherId !== session.linked_entity_id) {
        return NextResponse.json(
          { ok: false, error: 'Teachers can only accept substitute cover for their own timetable.' },
          { status: 403 },
        )
      }
      if (!subId || subId === req.teacherId) {
        return NextResponse.json(
          { ok: false, error: 'Substitute must be a different active teacher.' },
          { status: 400 },
        )
      }

      const subTeacher = teachers.find((t) => t.id === subId && t.status !== 'suspended')
      if (!subTeacher) {
        return NextResponse.json({ ok: false, error: 'Active substitute teacher not found.' }, { status: 404 })
      }

      const dateIso = resolveDateIsoFromText(req.date, req.dateIso)
      const day: SchoolWeekday = req.day || isoToSchoolWeekday(dateIso)
      const period = parsePeriodNumber(req.periodSlot, req.period)
      const timeLabel = PERIOD_TIME_MAP[period] || '08:15 – 09:00'

      // REAL Clash Check: ensure substitute teacher doesn't already teach another class on (day, period) for that date!
      const teacherClash = timetableSlots.find((s) => {
        if (s.teacherId !== subTeacher.id || s.day !== day || s.period !== period) return false
        // If it's a date-specific substitute slot on a DIFFERENT date, no clash
        if (s.isSubstitute && s.substituteDate && s.substituteDate !== dateIso) return false
        // If the substitute teacher themselves is on approved substitute leave for that same slot/date, no clash
        const subIsCoveredOnDate = teacherLeaves.some(
          (l) =>
            l.status === 'substituted' &&
            l.teacherId === subTeacher.id &&
            resolveDateIsoFromText(l.date, l.dateIso) === dateIso &&
            parsePeriodNumber(l.periodSlot, l.period) === period,
        )
        if (!s.isSubstitute && subIsCoveredOnDate) return false
        return true
      })

      if (teacherClash) {
        return NextResponse.json(
          {
            ok: false,
            error: `Timetable Clash: ${subTeacher.name} is already scheduled for ${teacherClash.subject} (${teacherClash.className}, ${teacherClash.room}) on ${day} Period ${period}.`,
          },
          { status: 409 },
        )
      }

      // Find the absent teacher's original room (if present in timetable)
      const originalSlot = timetableSlots.find(
        (s) =>
          !s.isSubstitute &&
          s.day === day &&
          s.period === period &&
          (s.teacherId === req.teacherId ||
            s.className.toLowerCase() === req.classSection.toLowerCase()),
      )
      const room = req.room || originalSlot?.room || 'Room 201'

      // 1. Update leave status
      const nextLeaves: TeacherLeaveSubItem[] = teacherLeaves.map((l) =>
        l.id === leaveId
          ? {
              ...l,
              dateIso,
              day,
              period,
              room,
              status: 'substituted',
              substituteTeacherId: subTeacher.id,
              substituteTeacherName: subTeacher.name,
            }
          : l,
      )

      // 2. Automatically ADD the Substitute Cover slot to `timetableSlots` for `subTeacher`!
      //    (Keep original teacher's permanent weekly slot intact for other weeks, and mark this slot with
      //     isSubstitute + substituteDate + originalTeacherId/Name + leaveRequestId so Timetable renders BOTH
      //     the new cover class in Substitute Teacher's timetable AND the covered badge on that date!)
      const subSlotId = `tt-sub-${leaveId}`
      const newSubSlot: TimetableSlot = {
        id: subSlotId,
        day,
        period,
        timeLabel,
        className: req.classSection,
        subject: req.subject,
        teacherId: subTeacher.id,
        teacherName: `${subTeacher.name} (Sub)`,
        room,
        isSubstitute: true,
        substituteDate: dateIso,
        originalTeacherId: req.teacherId,
        originalTeacherName: req.teacherName,
        leaveRequestId: leaveId,
      }
      const nextTimetableSlots: TimetableSlot[] = [
        ...timetableSlots.filter((s) => s.id !== subSlotId),
        newSubSlot,
      ]

      // 3. If the substitution is for today, also update students' todayPeriods live!
      const todayIso = getLocalTodayIso()
      const nextStudents: StudentRow[] =
        dateIso === todayIso
          ? students.map((stu) => {
              const fullLabel = `${stu.className} · ${stu.section}`.toLowerCase()
              const classMatch =
                fullLabel === req.classSection.toLowerCase() ||
                req.classSection.toLowerCase().includes(stu.className.toLowerCase())
              if (!classMatch) return stu
              return {
                ...stu,
                todayPeriods: (stu.todayPeriods || []).map((p) =>
                  String(p.subject || '').toLowerCase().includes(req.subject.toLowerCase())
                    ? { ...p, teacher: `${subTeacher.name} (Sub)` }
                    : p,
                ),
              }
            })
          : students

      const notif = {
        id: `notif-subok-${Date.now()}`,
        title: `Substitute Added to Timetable: ${subTeacher.name}`,
        text: `${subTeacher.name} will cover ${req.teacherName}'s ${req.subject} (${req.classSection}) on ${formatPrettyIso(dateIso)} · ${day} Period ${period} (${timeLabel}, ${room}). Added automatically to Teaching Timetable.`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['teacher', 'student', 'guardian', 'admin'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        {
          ...currentData,
          teacherLeaves: nextLeaves,
          timetableSlots: nextTimetableSlots,
          students: nextStudents,
          notifications: nextNotifs,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'substitute_assigned_and_added_to_timetable',
        target: `${subTeacher.name} covering ${req.teacherName} (${req.subject} · ${req.classSection} · ${dateIso} ${day} P${period})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Substitute ${subTeacher.name} added to timetable (${day} P${period})`,
      })

      return NextResponse.json({
        ok: true,
        message: `${subTeacher.name} confirmed as substitute & added automatically to Teaching Timetable (${day} P${period} · ${formatPrettyIso(dateIso)}).`,
        addedSlot: newSubSlot,
        teacherLeaves: nextLeaves,
        timetableSlots: nextTimetableSlots,
        students: nextStudents,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 3. DECLINE / CANCEL LEAVE REQUEST ====================
    if (action === 'decline') {
      const leaveId = String(body.leaveId || '').trim()
      const req = teacherLeaves.find((l) => l.id === leaveId)
      if (!req) {
        return NextResponse.json({ ok: false, error: 'Leave request not found.' }, { status: 404 })
      }
      if (session.role === 'teacher' && req.teacherId !== session.linked_entity_id) {
        return NextResponse.json(
          { ok: false, error: 'Teachers can only cancel their own leave requests.' },
          { status: 403 },
        )
      }

      const nextLeaves: TeacherLeaveSubItem[] = teacherLeaves.map((l) =>
        l.id === leaveId ? { ...l, status: 'declined' } : l,
      )
      // Remove any substitute timetable slot tied to this leaveId if it existed
      const nextTimetableSlots = timetableSlots.filter((s) => s.leaveRequestId !== leaveId)

      const saved = savePersistedState(
        {
          ...currentData,
          teacherLeaves: nextLeaves,
          timetableSlots: nextTimetableSlots,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'teacher_leave_declined',
        target: `${req.teacherName} · ${req.classSection} (${req.date})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
      })

      return NextResponse.json({
        ok: true,
        teacherLeaves: nextLeaves,
        timetableSlots: nextTimetableSlots,
        version: saved.version,
      })
    }

    return NextResponse.json({ ok: false, error: 'Unsupported action.' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Substitution operation failed.' },
      { status: 500 },
    )
  }
}
