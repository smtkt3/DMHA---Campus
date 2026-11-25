import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  ensureHistoricalAttendanceSeeded,
  listDailyAttendanceRecords,
  listSavedAttendanceDates,
  listStudentAttendanceHistory,
  loadPersistedState,
  savePersistedState,
  upsertDailyAttendanceRecords,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getLocalTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave'

interface ServerStudentRow {
  id: string
  name: string
  className: string
  section: string
  status?: string
  todayStatus: AttendanceStatus
  gateCheckIn: string | null
  attendanceRate: number
  presentDays: number
  totalDays: number
  todayPeriods?: Array<Record<string, unknown>>
  [key: string]: unknown
}

interface ServerTeacherRow {
  id: string
  name: string
  assignedClasses?: string[]
  status?: string
}

const VALID_STATUSES = new Set<AttendanceStatus>(['present', 'late', 'absent', 'leave'])

/**
 * Normalize class/section tags so 'Class 6' + 'Section A' matches 'Class 6A', 'Class 6 · Section A', etc.
 */
function normalizeClassToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function studentMatchesAssignedClasses(
  student: Pick<ServerStudentRow, 'className' | 'section'>,
  assignedClasses: string[],
): boolean {
  if (!assignedClasses || assignedClasses.length === 0) return false
  const fullToken = normalizeClassToken(`${student.className} ${student.section}`)
  const classOnlyToken = normalizeClassToken(student.className)
  const sectionLetter = student.section.replace(/section/i, '').trim().toLowerCase()
  const compactToken = normalizeClassToken(`${student.className}${sectionLetter}`)

  return assignedClasses.some((cls) => {
    const token = normalizeClassToken(cls)
    if (!token) return false
    if (token === fullToken || token === compactToken) return true
    // Allow class-only assignments like 'Pre-Play', 'Nursery', 'KG-1' (which don't carry A/B suffix)
    if (token === classOnlyToken) return true
    return false
  })
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuthSession(['teacher', 'admin', 'guardian', 'student'])
    if (!auth.ok) return auth.response
    const { session } = auth

    const url = new URL(request.url)
    const todayIso = getLocalTodayIso()
    const dateParam = url.searchParams.get('date')
    const studentIdParam = url.searchParams.get('studentId')
    const monthParam = url.searchParams.get('month') || undefined
    const dateIso =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayIso

    const persisted = loadPersistedState()
    const teachers: ServerTeacherRow[] =
      persisted.exists && persisted.data && Array.isArray(persisted.data.teachers)
        ? (persisted.data.teachers as ServerTeacherRow[])
        : []
    const students: ServerStudentRow[] =
      persisted.exists && persisted.data && Array.isArray(persisted.data.students)
        ? (persisted.data.students as ServerStudentRow[])
        : []
    const guardians: Array<{ id: string; linkedStudentIds?: string[] }> =
      persisted.exists && persisted.data && Array.isArray(persisted.data.guardians)
        ? (persisted.data.guardians as Array<{ id: string; linkedStudentIds?: string[] }>)
        : []

    ensureHistoricalAttendanceSeeded(students)

    const activeTeacher =
      session.role === 'teacher'
        ? teachers.find((t) => t.id === session.linked_entity_id) || null
        : null
    const assignedClasses = activeTeacher?.assignedClasses || []

    // Mode 1: Student-specific attendance history (for Guardian, Student, Teacher, Admin)
    if (studentIdParam) {
      const targetStudent = students.find((s) => s.id === studentIdParam)
      if (!targetStudent) {
        return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
      }
      if (session.role === 'student' && session.linked_entity_id !== studentIdParam) {
        return NextResponse.json(
          { ok: false, error: 'Forbidden: students can only view their own attendance history.' },
          { status: 403 },
        )
      }
      if (session.role === 'guardian') {
        const g = guardians.find((x) => x.id === session.linked_entity_id)
        const isLinked =
          Boolean(g?.linkedStudentIds?.includes(studentIdParam)) ||
          String(targetStudent.guardianId || '') === session.linked_entity_id
        if (!isLinked) {
          return NextResponse.json(
            { ok: false, error: 'Forbidden: guardian is not linked to this student.' },
            { status: 403 },
          )
        }
      }
      if (
        session.role === 'teacher' &&
        !studentMatchesAssignedClasses(targetStudent, assignedClasses)
      ) {
        return NextResponse.json(
          { ok: false, error: 'Forbidden: student is outside your assigned classes.' },
          { status: 403 },
        )
      }

      const allStudentHistory = listStudentAttendanceHistory(studentIdParam)
      const availableMonths = Array.from(
        new Set(allStudentHistory.map((r) => r.attendanceDate.slice(0, 7))),
      ).sort((a, b) => (a < b ? 1 : -1))
      const records = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? allStudentHistory.filter((r) => r.attendanceDate === dateParam)
        : monthParam && /^\d{4}-\d{2}$/.test(monthParam)
          ? allStudentHistory.filter((r) => r.attendanceDate.startsWith(`${monthParam}-`))
          : allStudentHistory

      return NextResponse.json({
        ok: true,
        studentId: studentIdParam,
        todayIso,
        records,
        availableMonths,
      })
    }

    // Mode 2: Class/School Daily Roll Call register by date (Teacher & Admin only)
    if (session.role !== 'teacher' && session.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: specify studentId to inspect personal attendance history.' },
        { status: 403 },
      )
    }

    const allRecords = listDailyAttendanceRecords(dateIso)
    const records =
      session.role === 'admin'
        ? allRecords
        : allRecords.filter((rec) => {
            const stu = students.find((s) => s.id === rec.studentId)
            return stu ? studentMatchesAssignedClasses(stu, assignedClasses) : false
          })

    return NextResponse.json({
      ok: true,
      dateIso,
      todayIso,
      assignedClasses: session.role === 'admin' ? ['ALL'] : assignedClasses,
      records,
      savedDates: listSavedAttendanceDates(30),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to load attendance log.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['teacher', 'admin'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as {
      updates?: Record<string, AttendanceStatus>
      dateIso?: string
    }

    if (!body.updates || typeof body.updates !== 'object' || Object.keys(body.updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'At least one student attendance entry is required.' },
        { status: 400 },
      )
    }

    const persisted = loadPersistedState()
    if (!persisted.exists || !persisted.data || !Array.isArray(persisted.data.students)) {
      return NextResponse.json(
        { ok: false, error: 'School roster is not initialized in SQLite.' },
        { status: 400 },
      )
    }

    const students = persisted.data.students as ServerStudentRow[]
    const teachers: ServerTeacherRow[] = Array.isArray(persisted.data.teachers)
      ? (persisted.data.teachers as ServerTeacherRow[])
      : []

    const activeTeacher =
      session.role === 'teacher'
        ? teachers.find((t) => t.id === session.linked_entity_id) || null
        : null

    if (session.role === 'teacher' && (!activeTeacher || activeTeacher.status === 'suspended')) {
      return NextResponse.json(
        { ok: false, error: 'Active faculty profile not found or account suspended.' },
        { status: 403 },
      )
    }

    const assignedClasses = activeTeacher?.assignedClasses || []
    const todayIso = getLocalTodayIso()
    const dateIso =
      body.dateIso && /^\d{4}-\d{2}-\d{2}$/.test(body.dateIso)
        ? body.dateIso
        : todayIso
    const isToday = dateIso === todayIso

    const validatedEntries: Array<{
      student: ServerStudentRow
      status: AttendanceStatus
    }> = []

    // Strict server-side authorization check for every submitted studentId!
    for (const [studentId, rawStatus] of Object.entries(body.updates)) {
      if (!VALID_STATUSES.has(rawStatus)) {
        return NextResponse.json(
          { ok: false, error: `Invalid attendance status "${String(rawStatus)}".` },
          { status: 400 },
        )
      }
      const student = students.find((s) => s.id === studentId)
      if (!student) {
        return NextResponse.json(
          { ok: false, error: `Student "${studentId}" not found.` },
          { status: 404 },
        )
      }
      if (
        session.role === 'teacher' &&
        !studentMatchesAssignedClasses(student, assignedClasses)
      ) {
        appendSecurityAudit({
          action: 'roll_call_unauthorized_class_blocked',
          target: `${session.display_name} attempted roll call for ${student.name} (${student.className} · ${student.section}) — assigned only to [${assignedClasses.join(', ')}]`,
          actor: session.display_name,
          actorRole: session.role,
          ipAddress: ip,
        })
        return NextResponse.json(
          {
            ok: false,
            error: `Access Denied: You are not assigned to ${student.className} · ${student.section} (${student.name}). Teachers can only take roll call for their assigned classes (${assignedClasses.join(', ') || 'None'}).`,
          },
          { status: 403 },
        )
      }
      validatedEntries.push({ student, status: rawStatus })
    }

    const markedByName = activeTeacher?.name || session.display_name
    const markedById = activeTeacher?.id || session.linked_entity_id

    // 1. Write permanent daily attendance records in SQLite dmhs_attendance_records
    const { previousStatusByStudent } = upsertDailyAttendanceRecords(
      validatedEntries.map(({ student, status }) => ({
        attendanceDate: dateIso,
        studentId: student.id,
        studentName: student.name,
        classLabel: `${student.className} · ${student.section}`,
        status,
        markedById,
        markedByName,
      })),
    )

    // 2. Atomically update students inside dmhs_kv_state without double-counting today's totals
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const updatesMap = new Map(validatedEntries.map(({ student, status }) => [student.id, status]))
    const alertedStudents: Array<{
      studentId: string
      studentName: string
      classLabel: string
      status: AttendanceStatus
    }> = []

    const nextStudents: ServerStudentRow[] = students.map((s) => {
      const nextStatus = updatesMap.get(s.id)
      if (!nextStatus) return s

      if (nextStatus === 'absent' || nextStatus === 'late') {
        alertedStudents.push({
          studentId: s.id,
          studentName: s.name,
          classLabel: `${s.className} · ${s.section}`,
          status: nextStatus,
        })
      }

      const prevTodayRecord = previousStatusByStudent[s.id]
      const wasAttended = prevTodayRecord === 'present' || prevTodayRecord === 'late'
      const isNowAttended = nextStatus === 'present' || nextStatus === 'late'

      let nextTotalDays = Number(s.totalDays) || 50
      let nextPresentDays = Number(s.presentDays) || 0

      if (!prevTodayRecord) {
        // First time today's register is saved for this student -> increment totalDays once
        nextTotalDays += 1
        if (isNowAttended) nextPresentDays += 1
      } else if (wasAttended !== isNowAttended) {
        // Re-saved today with changed attendance status -> adjust presentDays accurately
        nextPresentDays = Math.max(0, nextPresentDays + (isNowAttended ? 1 : -1))
      }

      const nextRate =
        nextTotalDays > 0
          ? Math.min(100, Math.max(0, Math.round((nextPresentDays / nextTotalDays) * 100)))
          : s.attendanceRate

      const gateCheckIn = isToday
        ? nextStatus === 'present'
          ? s.gateCheckIn || nowTime
          : nextStatus === 'late'
            ? nowTime
            : null
        : s.gateCheckIn

      return {
        ...s,
        todayStatus: isToday ? nextStatus : s.todayStatus,
        gateCheckIn,
        presentDays: nextPresentDays,
        totalDays: nextTotalDays,
        attendanceRate: nextRate,
        todayPeriods: isToday
          ? Array.isArray(s.todayPeriods)
            ? s.todayPeriods.map((p) => ({ ...p, status: nextStatus }))
            : []
          : s.todayPeriods || [],
      }
    })

    const actorLabel = `${markedByName} (${session.role})`
    const saved = savePersistedState(
      { ...persisted.data, students: nextStudents },
      actorLabel,
    )

    const touchedClasses = Array.from(
      new Set(validatedEntries.map((e) => `${e.student.className} · ${e.student.section}`)),
    ).join(', ')

    appendSecurityAudit({
      action: 'daily_roll_call_saved',
      target: `${dateIso} · ${validatedEntries.length} student(s) in [${touchedClasses}] (${alertedStudents.length} absent/late)`,
      actor: markedByName,
      actorRole: session.role,
      ipAddress: ip,
    })

    broadcastDmhsEvent({
      type: 'state_updated',
      version: saved.version,
      updatedAt: saved.updatedAt,
      updatedBy: actorLabel,
      summary: `Roll Call (${dateIso}) saved for ${touchedClasses}`,
    })

    const savedDayRecords = listDailyAttendanceRecords(dateIso)
    return NextResponse.json({
      ok: true,
      dateIso,
      isToday,
      savedBy: markedByName,
      updatedCount: validatedEntries.length,
      alertedStudents,
      students: nextStudents,
      records: savedDayRecords,
      savedDates: listSavedAttendanceDates(30),
      version: saved.version,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to save daily roll call.' },
      { status: 500 },
    )
  }
}
