import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RankingMode = 'overall' | 'assessment' | 'subject' | 'improved'
type HouseName = 'Emerald' | 'Sapphire' | 'Crimson' | 'Gold'

interface ServerSubjectRow {
  id: string
  name: string
  teacher: string
  section: string
  progress: number
  latestScore: number
  previousScore: number
  grade: string
  color: string
  nextTopic: string
}

interface ServerStudentRow {
  id: string
  name: string
  initials: string
  className: string
  section: string
  roll: string
  guardianId?: string
  guardianName: string
  guardianPhone: string
  status?: string
  house?: HouseName
  attendanceRate: number
  gpa: string
  averageScore: number
  rank: string
  subjects: ServerSubjectRow[]
  [key: string]: unknown
}

interface ServerTeacherRow {
  id: string
  name: string
  assignedClasses?: string[]
  status?: string
}

interface ServerGuardianRow {
  id: string
  name: string
  linkedStudentIds?: string[]
}

interface ServerMeritRow {
  id: string
  studentId: string
  studentName: string
  house: HouseName
  points: number
  type: 'merit' | 'pastoral'
  tier?: string
  reason: string
  awardedBy: string
  date: string
}

interface ServerQuizAttemptRow {
  id: string
  quizId: string
  studentId: string
  percentage: number
}

export interface ServerRankedEntry {
  studentId: string
  studentName: string
  initials: string
  className: string
  section: string
  classSectionLabel: string
  roll: string
  house: HouseName
  gpa: string
  attendanceRate: number
  rank: number
  assessmentAvg: number
  highestSubjectName: string
  highestSubjectScore: number
  selectedSubjectScore: number | null
  quizAvg: number | null
  quizCount: number
  meritTotal: number
  improvementDelta: number
  leaderboardPoints: number
  canInspectDetails: boolean
  subjects: ServerSubjectRow[]
}

const VALID_HOUSES = new Set<HouseName>(['Emerald', 'Sapphire', 'Crimson', 'Gold'])

function normalizeClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function getStudentClassSectionLabel(s: Pick<ServerStudentRow, 'className' | 'section'>): string {
  return `${s.className} · ${s.section}`
}

function studentMatchesClassFilter(
  student: Pick<ServerStudentRow, 'className' | 'section'>,
  filterValue: string,
): boolean {
  if (!filterValue || filterValue === 'ALL') return true
  const fToken = normalizeClassToken(filterValue)
  const fullToken = normalizeClassToken(`${student.className} ${student.section}`)
  const sectionLetter = student.section.replace(/section/i, '').trim().toLowerCase()
  const compactToken = normalizeClassToken(`${student.className}${sectionLetter}`)
  const gradeOnlyToken = normalizeClassToken(student.className)
  return fToken === fullToken || fToken === compactToken || fToken === gradeOnlyToken
}

function studentMatchesAssignedClasses(
  student: Pick<ServerStudentRow, 'className' | 'section'>,
  assignedClasses: string[],
): boolean {
  if (!assignedClasses || assignedClasses.length === 0) return false
  return assignedClasses.some((cls) => studentMatchesClassFilter(student, cls))
}

function computeStudentMetrics(
  student: ServerStudentRow,
  quizAttempts: ServerQuizAttemptRow[],
  merits: ServerMeritRow[],
  selectedSubject: string,
) {
  const subjects = Array.isArray(student.subjects) ? student.subjects : []
  const subCount = subjects.length
  const assessmentAvg =
    subCount > 0
      ? Math.round(subjects.reduce((acc, sub) => acc + Number(sub.latestScore || 0), 0) / subCount)
      : Number(student.averageScore || 0)

  const bestSub =
    subCount > 0 ? [...subjects].sort((a, b) => b.latestScore - a.latestScore)[0] : null

  const improvementDelta =
    subCount > 0
      ? Math.round(
          subjects.reduce(
            (acc, sub) => acc + (Number(sub.latestScore || 0) - Number(sub.previousScore || 0)),
            0,
          ) / subCount,
        )
      : 0

  const stuAttempts = quizAttempts.filter((a) => a.studentId === student.id)
  const quizAvg =
    stuAttempts.length > 0
      ? Math.round(stuAttempts.reduce((acc, a) => acc + Number(a.percentage || 0), 0) / stuAttempts.length)
      : null

  const meritTotal = merits
    .filter((m) => m.studentId === student.id && m.type === 'merit')
    .reduce((acc, m) => acc + Number(m.points || 0), 0)

  const subjectMatch = subjects.find(
    (sub) => sub.name.toLowerCase() === selectedSubject.toLowerCase(),
  )

  const leaderboardPoints =
    assessmentAvg * 10 +
    (quizAvg !== null ? Math.round(quizAvg * 1.5) : 0) +
    meritTotal * 3 +
    Math.round(Number(student.attendanceRate || 0) * 0.5)

  return {
    assessmentAvg,
    highestSubjectName: bestSub?.name || 'Overall',
    highestSubjectScore: bestSub?.latestScore ?? assessmentAvg,
    selectedSubjectScore: subjectMatch ? subjectMatch.latestScore : null,
    quizAvg,
    quizCount: stuAttempts.length,
    meritTotal,
    improvementDelta,
    leaderboardPoints,
  }
}

/**
 * Recalculates every student's persisted `rank` string (e.g., "#1 in Class 6A")
 * within their own class+section cohort using the authoritative overall leaderboard score.
 */
function recalculatePersistedStudentRanks(
  students: ServerStudentRow[],
  quizAttempts: ServerQuizAttemptRow[],
  merits: ServerMeritRow[],
): ServerStudentRow[] {
  const byCohort = new Map<string, Array<{ id: string; points: number; avg: number }>>()

  for (const stu of students) {
    const cohortKey = normalizeClassToken(`${stu.className} ${stu.section}`)
    const m = computeStudentMetrics(stu, quizAttempts, merits, '')
    const list = byCohort.get(cohortKey) || []
    list.push({ id: stu.id, points: m.leaderboardPoints, avg: m.assessmentAvg })
    byCohort.set(cohortKey, list)
  }

  const rankByStudentId = new Map<string, number>()
  for (const list of byCohort.values()) {
    list.sort((a, b) => b.points - a.points || b.avg - a.avg)
    list.forEach((item, idx) => {
      rankByStudentId.set(item.id, idx + 1)
    })
  }

  return students.map((stu) => {
    const rankNum = rankByStudentId.get(stu.id) || 1
    const secShort = stu.section.replace(/section\s*/i, '').trim()
    return {
      ...stu,
      rank: `#${rankNum} in ${stu.className}${secShort}`,
    }
  })
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuthSession()
    if (!auth.ok) return auth.response
    const { session } = auth

    const url = new URL(request.url)
    const rawClassFilter = (url.searchParams.get('classFilter') || 'ALL').trim()
    const rawMode = (url.searchParams.get('mode') || 'overall').trim() as RankingMode
    const mode: RankingMode = ['overall', 'assessment', 'subject', 'improved'].includes(rawMode)
      ? rawMode
      : 'overall'
    const requestedSubject = (url.searchParams.get('subject') || '').trim()
    const requestedChildId = (url.searchParams.get('childId') || '').trim()

    const persisted = loadPersistedState()
    const data = persisted.exists && persisted.data ? persisted.data : {}
    const students: ServerStudentRow[] = Array.isArray(data.students)
      ? (data.students as ServerStudentRow[])
      : []
    const teachers: ServerTeacherRow[] = Array.isArray(data.teachers)
      ? (data.teachers as ServerTeacherRow[])
      : []
    const guardians: ServerGuardianRow[] = Array.isArray(data.guardians)
      ? (data.guardians as ServerGuardianRow[])
      : []
    const merits: ServerMeritRow[] = Array.isArray(data.merits)
      ? (data.merits as ServerMeritRow[])
      : []
    const quizAttempts: ServerQuizAttemptRow[] = Array.isArray(data.quizAttempts)
      ? (data.quizAttempts as ServerQuizAttemptRow[])
      : []

    let authorizedStudents: ServerStudentRow[] = []
    let allowedClasses: string[] = []
    let effectiveClassFilter = rawClassFilter
    let focusStudentId: string | null = null
    let assignedTeacherClasses: string[] = []

    if (session.role === 'admin') {
      authorizedStudents = students
      allowedClasses = Array.from(
        new Set(students.map((s) => getStudentClassSectionLabel(s))),
      ).sort()
    } else if (session.role === 'teacher') {
      const teacher = teachers.find((t) => t.id === session.linked_entity_id) || null
      assignedTeacherClasses = teacher?.assignedClasses || []
      authorizedStudents = students.filter((s) =>
        studentMatchesAssignedClasses(s, assignedTeacherClasses),
      )
      allowedClasses = Array.from(
        new Set(authorizedStudents.map((s) => getStudentClassSectionLabel(s))),
      ).sort()

      if (
        rawClassFilter !== 'ALL' &&
        !assignedTeacherClasses.some(
          (cls) => normalizeClassToken(cls) === normalizeClassToken(rawClassFilter),
        ) &&
        !allowedClasses.some(
          (cls) => normalizeClassToken(cls) === normalizeClassToken(rawClassFilter),
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: `Access Denied: "${rawClassFilter}" is not in your assigned classes (${assignedTeacherClasses.join(', ') || 'None'}).`,
          },
          { status: 403 },
        )
      }
    } else if (session.role === 'student') {
      const me = students.find((s) => s.id === session.linked_entity_id) || null
      if (!me) {
        return NextResponse.json({
          ok: true,
          role: 'student',
          effectiveClassFilter: '',
          allowedClasses: [],
          availableSubjects: [],
          entries: [],
          classAvg: 0,
        })
      }
      focusStudentId = me.id
      const myCohort = getStudentClassSectionLabel(me)
      effectiveClassFilter = myCohort
      allowedClasses = [myCohort]
      authorizedStudents = students.filter(
        (s) =>
          normalizeClassToken(`${s.className} ${s.section}`) ===
          normalizeClassToken(`${me.className} ${me.section}`),
      )
    } else if (session.role === 'guardian') {
      const activeGuardian = guardians.find((g) => g.id === session.linked_entity_id) || null
      const linkedSet = new Set(activeGuardian?.linkedStudentIds || [])
      const myKids = students.filter(
        (s) => s.guardianId === session.linked_entity_id || linkedSet.has(s.id),
      )
      const activeKid =
        myKids.find((k) => k.id === requestedChildId) || myKids[0] || null
      if (!activeKid) {
        return NextResponse.json({
          ok: true,
          role: 'guardian',
          effectiveClassFilter: '',
          allowedClasses: [],
          availableSubjects: [],
          entries: [],
          classAvg: 0,
        })
      }
      focusStudentId = activeKid.id
      const kidCohort = getStudentClassSectionLabel(activeKid)
      effectiveClassFilter = kidCohort
      allowedClasses = [kidCohort]
      authorizedStudents = students.filter(
        (s) =>
          normalizeClassToken(`${s.className} ${s.section}`) ===
          normalizeClassToken(`${activeKid.className} ${activeKid.section}`),
      )
    } else {
      return NextResponse.json(
        { ok: false, error: 'Staff role does not have access to academic class leaderboards.' },
        { status: 403 },
      )
    }

    const pool = authorizedStudents.filter((s) =>
      studentMatchesClassFilter(s, effectiveClassFilter),
    )

    const subjectSet = new Set<string>()
    pool.forEach((s) => (s.subjects || []).forEach((sub) => subjectSet.add(sub.name)))
    const availableSubjects = Array.from(subjectSet)
    const effectiveSubject =
      requestedSubject && availableSubjects.some((s) => s.toLowerCase() === requestedSubject.toLowerCase())
        ? requestedSubject
        : availableSubjects[0] || 'Physics'

    const isFacultyOrAdmin = session.role === 'admin' || session.role === 'teacher'

    const enriched: ServerRankedEntry[] = pool.map((stu) => {
      const m = computeStudentMetrics(stu, quizAttempts, merits, effectiveSubject)
      const canInspectDetails = isFacultyOrAdmin || stu.id === focusStudentId
      return {
        studentId: stu.id,
        studentName: stu.name,
        initials: stu.initials,
        className: stu.className,
        section: stu.section,
        classSectionLabel: getStudentClassSectionLabel(stu),
        roll: stu.roll,
        house: stu.house || 'Emerald',
        gpa: stu.gpa,
        attendanceRate: stu.attendanceRate,
        rank: 1,
        ...m,
        canInspectDetails,
        // Strictly redact classmates' private subject mark sheets for Students & Guardians!
        subjects: canInspectDetails ? stu.subjects || [] : [],
      }
    })

    enriched.sort((a, b) => {
      if (mode === 'assessment') {
        return b.assessmentAvg - a.assessmentAvg || b.highestSubjectScore - a.highestSubjectScore
      }
      if (mode === 'subject') {
        return (
          (b.selectedSubjectScore ?? -1) - (a.selectedSubjectScore ?? -1) ||
          b.assessmentAvg - a.assessmentAvg
        )
      }
      if (mode === 'improved') {
        return b.improvementDelta - a.improvementDelta || b.assessmentAvg - a.assessmentAvg
      }
      return b.leaderboardPoints - a.leaderboardPoints || b.assessmentAvg - a.assessmentAvg
    })

    const rankedEntries = enriched.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }))

    const classAvg =
      rankedEntries.length > 0
        ? Math.round(
            rankedEntries.reduce((sum, e) => sum + e.assessmentAvg, 0) / rankedEntries.length,
          )
        : 0

    return NextResponse.json({
      ok: true,
      role: session.role,
      effectiveClassFilter,
      allowedClasses,
      assignedTeacherClasses,
      availableSubjects,
      effectiveSubject,
      mode,
      focusStudentId,
      classAvg,
      entries: rankedEntries,
      stateVersion: persisted.version,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to compute class leaderboard.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession()
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || 'award_merit')

    const persisted = loadPersistedState()
    if (!persisted.exists || !persisted.data) {
      return NextResponse.json(
        { ok: false, error: 'School state is not initialized in SQLite.' },
        { status: 400 },
      )
    }

    const currentData = persisted.data
    const students: ServerStudentRow[] = Array.isArray(currentData.students)
      ? (currentData.students as ServerStudentRow[])
      : []
    const teachers: ServerTeacherRow[] = Array.isArray(currentData.teachers)
      ? (currentData.teachers as ServerTeacherRow[])
      : []
    const merits: ServerMeritRow[] = Array.isArray(currentData.merits)
      ? (currentData.merits as ServerMeritRow[])
      : []
    const quizAttempts: ServerQuizAttemptRow[] = Array.isArray(currentData.quizAttempts)
      ? (currentData.quizAttempts as ServerQuizAttemptRow[])
      : []
    const houseStandings: Record<HouseName, number> = {
      Emerald: Number((currentData.houseStandings as Record<string, unknown>)?.Emerald ?? 420),
      Sapphire: Number((currentData.houseStandings as Record<string, unknown>)?.Sapphire ?? 395),
      Crimson: Number((currentData.houseStandings as Record<string, unknown>)?.Crimson ?? 370),
      Gold: Number((currentData.houseStandings as Record<string, unknown>)?.Gold ?? 355),
    }

    // ==================== 1. AWARD MERIT OR PASTORAL (TEACHER / ADMIN ONLY) ====================
    if (action === 'award_merit') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        appendSecurityAudit({
          action: 'leaderboard_unauthorized_merit_blocked',
          target: `${session.display_name} (${session.role}) attempted to award merit points`,
          actor: session.display_name,
          actorRole: session.role,
          ipAddress: ip,
        })
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can award House Merit points or log pastoral notes.' },
          { status: 403 },
        )
      }

      const studentId = String(body.studentId || '').trim()
      const type = body.type === 'pastoral' ? 'pastoral' : 'merit'
      const rawPoints = Math.round(Number(body.points) || 0)
      const reason = String(body.reason || '').trim()
      const tier = typeof body.tier === 'string' && body.tier.trim() ? body.tier.trim() : undefined

      if (!studentId || !reason) {
        return NextResponse.json(
          { ok: false, error: 'Student ID and reason are required.' },
          { status: 400 },
        )
      }
      if (rawPoints < 1 || rawPoints > 50) {
        return NextResponse.json(
          { ok: false, error: 'Points must be between 1 and 50.' },
          { status: 400 },
        )
      }

      const student = students.find((s) => s.id === studentId)
      if (!student) {
        return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
      }

      const houseCandidate = String(body.house || student.house || 'Emerald') as HouseName
      const house: HouseName = VALID_HOUSES.has(houseCandidate) ? houseCandidate : 'Emerald'

      let awardedBy = 'Principal’s Office'
      if (session.role === 'teacher') {
        const activeTeacher = teachers.find((t) => t.id === session.linked_entity_id) || null
        if (!activeTeacher || activeTeacher.status === 'suspended') {
          return NextResponse.json(
            { ok: false, error: 'Active faculty profile not found or account suspended.' },
            { status: 403 },
          )
        }
        const assignedClasses = activeTeacher.assignedClasses || []
        if (!studentMatchesAssignedClasses(student, assignedClasses)) {
          appendSecurityAudit({
            action: 'leaderboard_unauthorized_merit_blocked',
            target: `${activeTeacher.name} attempted to award ${rawPoints} ${type} pts to ${student.name} (${student.className} · ${student.section}) — assigned only to [${assignedClasses.join(', ')}]`,
            actor: activeTeacher.name,
            actorRole: 'teacher',
            ipAddress: ip,
          })
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: You are not assigned to ${student.className} · ${student.section} (${student.name}). Teachers can only award merits to students in their assigned classes (${assignedClasses.join(', ') || 'None'}).`,
            },
            { status: 403 },
          )
        }
        awardedBy = activeTeacher.name
      }

      const signedPoints = type === 'merit' ? Math.abs(rawPoints) : -Math.abs(rawPoints)
      const newMerit: ServerMeritRow = {
        id: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: student.id,
        studentName: student.name,
        house,
        points: signedPoints,
        type,
        ...(tier ? { tier } : {}),
        reason,
        awardedBy,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Today',
      }

      const nextMerits = [newMerit, ...merits]
      const nextHouseStandings: Record<HouseName, number> = {
        ...houseStandings,
        [house]: Math.max(0, houseStandings[house] + signedPoints),
      }
      const nextStudents = recalculatePersistedStudentRanks(students, quizAttempts, nextMerits)

      const saved = savePersistedState(
        {
          ...currentData,
          merits: nextMerits,
          houseStandings: nextHouseStandings,
          students: nextStudents,
        },
        awardedBy,
      )

      appendSecurityAudit({
        action: type === 'merit' ? 'leaderboard_merit_awarded' : 'pastoral_note_logged',
        target: `${student.name} (${student.className} ${student.section}) ${signedPoints > 0 ? '+' : ''}${signedPoints} ${house} pts — ${reason}`,
        actor: awardedBy,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: awardedBy,
      })

      return NextResponse.json({
        ok: true,
        merit: newMerit,
        merits: nextMerits,
        houseStandings: nextHouseStandings,
        students: nextStudents,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    // ==================== 2. STUDY QUEST REWARD (SELF-ONLY, CAPPED <= 5 PTS) ====================
    if (action === 'claim_study_reward') {
      if (session.role !== 'student' && session.role !== 'guardian' && session.role !== 'admin') {
        return NextResponse.json({ ok: false, error: 'Unauthorized reward claim.' }, { status: 403 })
      }

      const studentId = String(body.studentId || '').trim()
      const points = Math.min(5, Math.max(1, Math.round(Number(body.points) || 2)))
      const reason = String(body.reason || '').trim()
      const student = students.find((s) => s.id === studentId)
      if (!student || !reason) {
        return NextResponse.json({ ok: false, error: 'Valid student and quest reason required.' }, { status: 400 })
      }
      if (session.role === 'student' && student.id !== session.linked_entity_id) {
        return NextResponse.json({ ok: false, error: 'Students can only claim their own study rewards.' }, { status: 403 })
      }
      if (session.role === 'guardian') {
        const guardiansList: ServerGuardianRow[] = Array.isArray(currentData.guardians)
          ? (currentData.guardians as ServerGuardianRow[])
          : []
        const activeGuardian = guardiansList.find((g) => g.id === session.linked_entity_id) || null
        const linkedSet = new Set(activeGuardian?.linkedStudentIds || [])
        if (student.guardianId !== session.linked_entity_id && !linkedSet.has(student.id)) {
          return NextResponse.json({ ok: false, error: 'Guardians can only claim rewards for linked children.' }, { status: 403 })
        }
      }

      // Deduplicate identical study quest merit awards
      const alreadyClaimed = merits.some(
        (m) => m.studentId === student.id && m.reason.toLowerCase() === reason.toLowerCase(),
      )
      if (alreadyClaimed) {
        return NextResponse.json({
          ok: true,
          duplicate: true,
          merits,
          houseStandings,
          students,
          version: persisted.version,
        })
      }

      const house: HouseName = student.house && VALID_HOUSES.has(student.house) ? student.house : 'Emerald'
      const newMerit: ServerMeritRow = {
        id: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: student.id,
        studentName: student.name,
        house,
        points,
        type: 'merit',
        reason,
        awardedBy: 'DMHA Smart Study Coach',
        date: 'Today',
      }

      const nextMerits = [newMerit, ...merits]
      const nextHouseStandings: Record<HouseName, number> = {
        ...houseStandings,
        [house]: Math.max(0, houseStandings[house] + points),
      }
      const nextStudents = recalculatePersistedStudentRanks(students, quizAttempts, nextMerits)

      const saved = savePersistedState(
        {
          ...currentData,
          merits: nextMerits,
          houseStandings: nextHouseStandings,
          students: nextStudents,
        },
        session.display_name,
      )

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
      })

      return NextResponse.json({
        ok: true,
        merit: newMerit,
        merits: nextMerits,
        houseStandings: nextHouseStandings,
        students: nextStudents,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    // ==================== 3. RECALCULATE & SYNC OFFICIAL CLASS RANKS ====================
    if (action === 'sync_ranks') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can publish/sync official class ranks.' },
          { status: 403 },
        )
      }

      const nextStudents = recalculatePersistedStudentRanks(students, quizAttempts, merits)
      const saved = savePersistedState(
        {
          ...currentData,
          students: nextStudents,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'leaderboard_ranks_synced',
        target: `Recalculated live class ranks for ${nextStudents.length} students`,
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
        updatedCount: nextStudents.length,
        students: nextStudents,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    return NextResponse.json({ ok: false, error: `Unsupported action "${action}".` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Leaderboard update failed.' },
      { status: 500 },
    )
  }
}
