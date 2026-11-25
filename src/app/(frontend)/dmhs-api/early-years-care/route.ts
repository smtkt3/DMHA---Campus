import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import { initialEarlyYearsCareLogs } from '@/components/school/data'
import type {
  EarlyYearsCareLog,
  GuardianRecord,
  StudentRecord,
  TeacherRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_MEALS = new Set<EarlyYearsCareLog['mealStatus']>([
  'Finished All',
  'Ate Most',
  'Ate Little',
  'Refused',
])
const VALID_MOODS = new Set<EarlyYearsCareLog['mood']>([
  'Happy & Active',
  'Calm & Focused',
  'Tired / Quiet',
  'Needs Extra Care',
])

function normCls(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function studentInTeacherClasses(student: StudentRecord, assigned?: string[]): boolean {
  if (!assigned || assigned.length === 0) return false
  const full = normCls(`${student.className} ${student.section}`)
  const secL = student.section.replace(/section/i, '').trim().toLowerCase()
  const compact = normCls(`${student.className}${secL}`)
  const grade = normCls(student.className)
  return assigned.some((cls) => {
    const t = normCls(cls)
    return t === full || t === compact || t === grade
  })
}

function guardianOwnsStudent(
  guardianId: string,
  student: StudentRecord,
  guardians: GuardianRecord[],
): boolean {
  if (student.guardianId === guardianId) return true
  const g = guardians.find((x) => x.id === guardianId)
  return Boolean(g?.linkedStudentIds?.includes(student.id))
}

function getTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatNow(): string {
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `Today · ${t}`
}

function scopeCareLogsForSession(
  logs: EarlyYearsCareLog[],
  session: { role: string; linked_entity_id: string },
  students: StudentRecord[],
  teachers: TeacherRecord[],
  guardians: GuardianRecord[],
): EarlyYearsCareLog[] {
  if (session.role === 'admin') return logs
  if (session.role === 'guardian') {
    const g = guardians.find((x) => x.id === session.linked_entity_id)
    const linked = new Set<string>(g?.linkedStudentIds || [])
    students.forEach((s) => {
      if (s.guardianId === session.linked_entity_id) linked.add(s.id)
    })
    return logs.filter((l) => linked.has(l.studentId))
  }
  if (session.role === 'student') {
    return logs.filter((l) => l.studentId === session.linked_entity_id)
  }
  if (session.role === 'teacher') {
    const tch = teachers.find((t) => t.id === session.linked_entity_id)
    return logs.filter((l) => {
      if (l.loggedById === session.linked_entity_id || l.loggedBy === tch?.name) return true
      const stu = students.find((s) => s.id === l.studentId)
      return stu ? studentInTeacherClasses(stu, tch?.assignedClasses) : false
    })
  }
  return []
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'guardian'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '').trim()

    const persisted = loadPersistedState()
    const currentData = (persisted?.data || {}) as Record<string, unknown>
    const students = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const teachers = Array.isArray(currentData.teachers)
      ? (currentData.teachers as TeacherRecord[])
      : []
    const guardians = Array.isArray(currentData.guardians)
      ? (currentData.guardians as GuardianRecord[])
      : []
    const careLogs = Array.isArray(currentData.earlyYearsCareLogs)
      ? (currentData.earlyYearsCareLogs as EarlyYearsCareLog[])
      : Array.isArray(initialEarlyYearsCareLogs)
        ? initialEarlyYearsCareLogs
        : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []

    if (action === 'log_care') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can submit Daily Care Logs.' },
          { status: 403 },
        )
      }

      const studentId = String(body.studentId || '').trim()
      const dateIso = String(body.dateIso || getTodayIso()).trim().slice(0, 12) || getTodayIso()
      const rawMeal = String(body.mealStatus || 'Finished All') as EarlyYearsCareLog['mealStatus']
      const mealStatus = VALID_MEALS.has(rawMeal) ? rawMeal : 'Finished All'
      const rawMood = String(body.mood || 'Happy & Active') as EarlyYearsCareLog['mood']
      const mood = VALID_MOODS.has(rawMood) ? rawMood : 'Happy & Active'
      const napOrActivity = String(body.napOrActivity || '').trim().slice(0, 260)
      const hygieneOrHealth = String(body.hygieneOrHealth || '').trim().slice(0, 260)
      const teacherNote = String(body.teacherNote || '').trim().slice(0, 400)

      const student = students.find((s) => s.id === studentId)
      if (!student) {
        return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
      }
      const activeTeacher =
        session.role === 'teacher'
          ? teachers.find((t) => t.id === session.linked_entity_id)
          : undefined
      if (
        session.role === 'teacher' &&
        !studentInTeacherClasses(student, activeTeacher?.assignedClasses)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: `Access Denied: ${student.name} (${student.className} · ${student.section}) is outside your assigned classes.`,
          },
          { status: 403 },
        )
      }

      const actorName = activeTeacher?.name || session.display_name
      const existingIdx = careLogs.findIndex(
        (l) => l.studentId === student.id && l.dateIso === dateIso,
      )
      const entry: EarlyYearsCareLog = {
        id: existingIdx >= 0 ? careLogs[existingIdx].id : `care-${Date.now()}`,
        studentId: student.id,
        studentName: student.name,
        classLabel: `${student.className} · ${student.section}`,
        dateIso,
        mealStatus,
        mood,
        napOrActivity: napOrActivity || 'Active classroom participation & guided play.',
        hygieneOrHealth: hygieneOrHealth || 'All fine — hydrated and comfortable.',
        teacherNote: teacherNote || `${student.name} had a lovely day in class.`,
        loggedBy: actorName,
        loggedById: session.user_id,
        loggedAt: formatNow(),
        guardianAcknowledged:
          existingIdx >= 0 ? careLogs[existingIdx].guardianAcknowledged : false,
        guardianReply: existingIdx >= 0 ? careLogs[existingIdx].guardianReply : undefined,
      }

      const nextLogs =
        existingIdx >= 0
          ? careLogs.map((l, idx) => (idx === existingIdx ? entry : l))
          : [entry, ...careLogs]

      const notif = {
        id: `notif-care-${Date.now()}`,
        title: `Daily Care Card · ${student.name}`,
        text: `${actorName} logged ${student.name}’s Daily Care (${dateIso}): Tiffin: ${mealStatus} · Mood: ${mood}.`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['guardian', 'admin'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        { ...currentData, earlyYearsCareLogs: nextLogs, notifications: nextNotifs },
        actorName,
      )

      appendSecurityAudit({
        action: 'early_years_care_logged',
        target: `${student.name} (${dateIso}) · Meal: ${mealStatus} · Mood: ${mood}`,
        actor: actorName,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: actorName,
        summary: notif.title,
      })

      return NextResponse.json({
        ok: true,
        log: entry,
        earlyYearsCareLogs: scopeCareLogsForSession(nextLogs, session, students, teachers, guardians),
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    if (action === 'acknowledge_care') {
      if (session.role !== 'guardian') {
        return NextResponse.json(
          { ok: false, error: 'Only a linked Guardian can acknowledge a Daily Care Card.' },
          { status: 403 },
        )
      }
      const logId = String(body.logId || '').trim()
      const guardianReply = String(body.guardianReply || '').trim().slice(0, 300)
      const target = careLogs.find((l) => l.id === logId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Care log not found.' }, { status: 404 })
      }
      const student = students.find((s) => s.id === target.studentId)
      if (!student || !guardianOwnsStudent(session.linked_entity_id, student, guardians)) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: You are not the linked guardian for this student.' },
          { status: 403 },
        )
      }

      const nextLogs = careLogs.map((l) =>
        l.id === logId
          ? {
              ...l,
              guardianAcknowledged: true,
              guardianAcknowledgedAt: formatNow(),
              guardianReply: guardianReply || l.guardianReply,
            }
          : l,
      )

      const saved = savePersistedState(
        { ...currentData, earlyYearsCareLogs: nextLogs },
        session.display_name,
      )
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Guardian acknowledged ${student.name}’s Daily Care Card`,
      })
      return NextResponse.json({
        ok: true,
        earlyYearsCareLogs: scopeCareLogsForSession(nextLogs, session, students, teachers, guardians),
        version: saved.version,
      })
    }

    if (action === 'delete_care') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json({ ok: false, error: 'Permission denied.' }, { status: 403 })
      }
      const logId = String(body.logId || '').trim()
      const target = careLogs.find((l) => l.id === logId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Care log not found.' }, { status: 404 })
      }
      if (session.role === 'teacher' && target.loggedById !== session.user_id) {
        return NextResponse.json(
          { ok: false, error: 'Teachers can only delete care cards they logged.' },
          { status: 403 },
        )
      }
      const nextLogs = careLogs.filter((l) => l.id !== logId)
      const saved = savePersistedState(
        { ...currentData, earlyYearsCareLogs: nextLogs },
        session.display_name,
      )
      return NextResponse.json({
        ok: true,
        earlyYearsCareLogs: scopeCareLogsForSession(nextLogs, session, students, teachers, guardians),
        version: saved.version,
      })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Daily Care operation failed.' },
      { status: 500 },
    )
  }
}
