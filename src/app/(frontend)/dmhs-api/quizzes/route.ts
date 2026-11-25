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

interface ServerQuizQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
  points: number
  explanation: string
}

interface ServerOnlineQuiz {
  id: string
  title: string
  subject: string
  className: string
  teacherName: string
  durationMins: number
  passPercentage: number
  dueDate: string
  status: 'published' | 'closed'
  createdAt: string
  questions: ServerQuizQuestion[]
}

interface ServerQuizAttempt {
  id: string
  quizId: string
  studentId: string
  studentName: string
  answers: number[]
  score: number
  totalMarks: number
  percentage: number
  passed: boolean
  timeTakenSec: number
  submittedAt: string
  gradebookSynced?: boolean
  syncedSubject?: string
  syncedGrade?: string
  syncedAverageScore?: number
  syncedGpa?: string
  syncedRank?: string
  xpAwarded?: number
}

interface ServerTeacherRow {
  id: string
  name: string
  assignedClasses?: string[]
  status?: string
}

interface ServerSubjectRow {
  id: string
  name: string
  latestScore: number
  previousScore: number
  grade: string
  [key: string]: unknown
}

interface ServerStudentRow {
  id: string
  name: string
  className: string
  section: string
  guardianId?: string
  averageScore: number
  gpa: string
  subjects: ServerSubjectRow[]
  [key: string]: unknown
}

function normalizeClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

/**
 * Strict teacher publish/upload check: target class MUST match one of teacher.assignedClasses.
 */
function teacherAssignedToTargetClass(targetClassName: string, assignedClasses: string[]): boolean {
  if (!assignedClasses || assignedClasses.length === 0) return false
  const targetToken = normalizeClassToken(targetClassName)
  if (!targetToken || targetToken === 'all' || targetToken === 'allclasses') return false

  return assignedClasses.some((cls) => {
    const clsToken = normalizeClassToken(cls)
    return Boolean(clsToken) && clsToken === targetToken
  })
}

/**
 * Check if a teacher can view/toggle/edit/delete an existing quiz:
 * - Either the quiz's class matches one of their assignedClasses, OR
 * - They are the original author of a legacy quiz (e.g. 'Class 6')
 */
function teacherCanAccessQuiz(
  quiz: ServerOnlineQuiz,
  teacher: ServerTeacherRow,
): boolean {
  const assigned = teacher.assignedClasses || []
  if (teacherAssignedToTargetClass(quiz.className, assigned)) return true
  if (quiz.teacherName.trim().toLowerCase() === teacher.name.trim().toLowerCase()) return true
  return false
}

/**
 * Check whether a student belongs to a quiz's target class/section.
 * Supports section-specific ('Class 6A', 'Class 6 · Section A') AND grade-wide ('Class 6', 'All Classes').
 */
function studentMatchesQuizClass(
  student: Pick<ServerStudentRow, 'className' | 'section'>,
  quizClassName: string,
): boolean {
  const quizToken = normalizeClassToken(quizClassName)
  if (!quizToken) return false
  if (quizToken === 'all' || quizToken === 'allclasses') return true

  const fullToken = normalizeClassToken(`${student.className} ${student.section}`)
  const sectionLetter = student.section.replace(/section/i, '').trim().toLowerCase()
  const compactToken = normalizeClassToken(`${student.className}${sectionLetter}`)
  const gradeOnlyToken = normalizeClassToken(student.className)

  return quizToken === fullToken || quizToken === compactToken || quizToken === gradeOnlyToken
}

function scoreToGrade(score: number): string {
  if (score >= 80) return 'A+'
  if (score >= 70) return 'A'
  if (score >= 60) return 'A-'
  if (score >= 50) return 'B'
  if (score >= 40) return 'C'
  return 'F'
}

function calcGpa(avg: number): string {
  const val = Math.min(5, Math.max(1, (avg / 100) * 5.35))
  return val.toFixed(2)
}

function normalizeSubjectKey(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function findMatchingSubjectIndex(subjects: ServerSubjectRow[], quizSubject: string): number {
  const target = normalizeSubjectKey(quizSubject)
  if (!target) return -1
  // 1. Exact normalized match
  const exact = subjects.findIndex((s) => normalizeSubjectKey(s.name) === target)
  if (exact >= 0) return exact
  // 2. Prefix / substring alias match (e.g. Math <-> Mathematics, Science <-> General Science, ICT <-> Computer & ICT)
  return subjects.findIndex((s) => {
    const k = normalizeSubjectKey(s.name)
    return k.includes(target) || target.includes(k)
  })
}

function recalculateClassRanks(students: ServerStudentRow[]): ServerStudentRow[] {
  const groups = new Map<string, ServerStudentRow[]>()
  students.forEach((s) => {
    const key = `${s.className}||${s.section}`
    const arr = groups.get(key) || []
    arr.push(s)
    groups.set(key, arr)
  })
  const rankById = new Map<string, string>()
  groups.forEach((list) => {
    const sorted = [...list].sort((a, b) => Number(b.averageScore || 0) - Number(a.averageScore || 0))
    sorted.forEach((stu, idx) => {
      rankById.set(stu.id, `#${idx + 1}`)
    })
  })
  return students.map((s) => ({
    ...s,
    rank: rankById.get(s.id) || (s.rank as string) || '#1',
  }))
}

function applyQuizGradeToStudents(
  students: ServerStudentRow[],
  studentId: string,
  quiz: ServerOnlineQuiz,
  percentage: number,
): {
  nextStudents: ServerStudentRow[]
  syncedSubject: string
  syncedGrade: string
  syncedAverageScore: number
  syncedGpa: string
  syncedRank: string
} {
  const grade = scoreToGrade(percentage)
  let syncedSubject = quiz.subject
  let syncedAverageScore = percentage
  let syncedGpa = calcGpa(percentage)

  const updated = students.map((s) => {
    if (s.id !== studentId) return s
    const existingSubjects = Array.isArray(s.subjects) ? s.subjects : []
    const matchIdx = findMatchingSubjectIndex(existingSubjects, quiz.subject)
    let updatedSubjects: ServerSubjectRow[]

    if (matchIdx >= 0) {
      syncedSubject = existingSubjects[matchIdx].name
      updatedSubjects = existingSubjects.map((sub, idx) =>
        idx === matchIdx
          ? {
              ...sub,
              previousScore: Number(sub.latestScore || 0),
              latestScore: percentage,
              grade,
              progress: Math.min(100, Math.max(Number(sub.progress || 70), 82)),
              nextTopic: `Quiz Completed: ${quiz.title}`,
            }
          : sub,
      )
    } else {
      // Auto-add subject into the student's Gradebook so no quiz grade is ever lost!
      const colorPool = ['violet', 'cyan', 'lime', 'orange'] as const
      const newSub: ServerSubjectRow = {
        id: `sub-quiz-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: quiz.subject,
        teacher: quiz.teacherName,
        section: `${s.className} · ${s.section}`,
        progress: 85,
        latestScore: percentage,
        previousScore: percentage,
        grade,
        color: colorPool[existingSubjects.length % colorPool.length],
        nextTopic: `Quiz Completed: ${quiz.title}`,
      }
      updatedSubjects = [...existingSubjects, newSub]
    }

    const avg = Math.round(
      updatedSubjects.reduce((sum, item) => sum + Number(item.latestScore || 0), 0) /
        Math.max(1, updatedSubjects.length),
    )
    const gpa = calcGpa(avg)
    syncedAverageScore = avg
    syncedGpa = gpa

    return {
      ...s,
      subjects: updatedSubjects,
      averageScore: avg,
      gpa,
    }
  })

  const ranked = recalculateClassRanks(updated)
  const targetAfter = ranked.find((s) => s.id === studentId)
  const syncedRank = String(targetAfter?.rank || '#1')

  return {
    nextStudents: ranked,
    syncedSubject,
    syncedGrade: grade,
    syncedAverageScore,
    syncedGpa,
    syncedRank,
  }
}

function sanitizeQuestions(rawQuestions: unknown): {
  ok: true
  questions: ServerQuizQuestion[]
} | { ok: false; error: string } {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return { ok: false, error: 'Quiz must contain at least 1 valid question.' }
  }
  if (rawQuestions.length > 100) {
    return { ok: false, error: 'Maximum 100 questions allowed per quiz.' }
  }

  const sanitized: ServerQuizQuestion[] = []
  const now = Date.now()

  for (let i = 0; i < rawQuestions.length; i++) {
    const item = rawQuestions[i] as Record<string, unknown>
    const prompt = String(item?.prompt || '').trim()
    if (!prompt) {
      return { ok: false, error: `Question #${i + 1} is missing a question prompt.` }
    }

    const rawOptions = Array.isArray(item?.options) ? item.options : []
    const options = rawOptions.map((o) => String(o ?? '').trim()).filter(Boolean)
    if (options.length < 2 || options.length > 4) {
      return {
        ok: false,
        error: `Question #${i + 1} must have between 2 and 4 non-empty answer options.`,
      }
    }

    const correctIndex = Number(item?.correctIndex)
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      return {
        ok: false,
        error: `Question #${i + 1} has an invalid correct answer index.`,
      }
    }

    const rawPoints = Number(item?.points ?? 5)
    const points = Number.isFinite(rawPoints) ? Math.min(100, Math.max(1, Math.round(rawPoints))) : 5
    const explanation =
      String(item?.explanation || '').trim() ||
      `The correct answer is "${options[correctIndex]}".`

    sanitized.push({
      id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : `q-${now}-${i}`,
      prompt,
      options,
      correctIndex,
      points,
      explanation,
    })
  }

  return { ok: true, questions: sanitized }
}

export async function GET() {
  try {
    const auth = await requireAuthSession()
    if (!auth.ok) return auth.response
    const { session } = auth

    const persisted = loadPersistedState()
    const data = persisted.exists && persisted.data ? persisted.data : {}
    const allQuizzes: ServerOnlineQuiz[] = Array.isArray(data.quizzes)
      ? (data.quizzes as ServerOnlineQuiz[])
      : []
    const allAttempts: ServerQuizAttempt[] = Array.isArray(data.quizAttempts)
      ? (data.quizAttempts as ServerQuizAttempt[])
      : []
    const teachers: ServerTeacherRow[] = Array.isArray(data.teachers)
      ? (data.teachers as ServerTeacherRow[])
      : []
    const students: ServerStudentRow[] = Array.isArray(data.students)
      ? (data.students as ServerStudentRow[])
      : []

    if (session.role === 'admin') {
      return NextResponse.json({
        ok: true,
        role: 'admin',
        assignedClasses: ['ALL'],
        quizzes: allQuizzes,
        quizAttempts: allAttempts,
      })
    }

    if (session.role === 'teacher') {
      const teacher = teachers.find((t) => t.id === session.linked_entity_id) || null
      const assignedClasses = teacher?.assignedClasses || []
      const visibleQuizzes = teacher
        ? allQuizzes.filter((q) => teacherCanAccessQuiz(q, teacher))
        : []
      const visibleIds = new Set(visibleQuizzes.map((q) => q.id))
      const visibleAttempts = allAttempts.filter((a) => visibleIds.has(a.quizId))

      return NextResponse.json({
        ok: true,
        role: 'teacher',
        assignedClasses,
        quizzes: visibleQuizzes,
        quizAttempts: visibleAttempts,
      })
    }

    if (session.role === 'student') {
      const stu = students.find((s) => s.id === session.linked_entity_id) || null
      const visibleQuizzes = stu
        ? allQuizzes.filter((q) => q.status === 'published' && studentMatchesQuizClass(stu, q.className))
        : []
      const visibleAttempts = stu ? allAttempts.filter((a) => a.studentId === stu.id) : []
      return NextResponse.json({
        ok: true,
        role: 'student',
        quizzes: visibleQuizzes,
        quizAttempts: visibleAttempts,
      })
    }

    if (session.role === 'guardian') {
      const guardiansList = Array.isArray(data.guardians)
        ? (data.guardians as Array<{ id: string; linkedStudentIds?: string[] }>)
        : []
      const activeGuardian = guardiansList.find((g) => g.id === session.linked_entity_id) || null
      const linkedSet = new Set(activeGuardian?.linkedStudentIds || [])
      const myKids = students.filter(
        (s) => s.guardianId === session.linked_entity_id || linkedSet.has(s.id),
      )
      const kidIds = new Set(myKids.map((k) => k.id))
      const visibleQuizzes = allQuizzes.filter(
        (q) => q.status === 'published' && myKids.some((kid) => studentMatchesQuizClass(kid, q.className)),
      )
      const visibleAttempts = allAttempts.filter((a) => kidIds.has(a.studentId))
      return NextResponse.json({
        ok: true,
        role: 'guardian',
        quizzes: visibleQuizzes,
        quizAttempts: visibleAttempts,
      })
    }

    return NextResponse.json({
      ok: true,
      role: session.role,
      quizzes: [],
      quizAttempts: [],
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to load quizzes.' },
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
    const action = String(body.action || 'create')

    const persisted = loadPersistedState()
    if (!persisted.exists || !persisted.data) {
      return NextResponse.json(
        { ok: false, error: 'School state is not initialized in SQLite.' },
        { status: 400 },
      )
    }

    const currentData = persisted.data
    const quizzes: ServerOnlineQuiz[] = Array.isArray(currentData.quizzes)
      ? (currentData.quizzes as ServerOnlineQuiz[])
      : []
    const quizAttempts: ServerQuizAttempt[] = Array.isArray(currentData.quizAttempts)
      ? (currentData.quizAttempts as ServerQuizAttempt[])
      : []
    const teachers: ServerTeacherRow[] = Array.isArray(currentData.teachers)
      ? (currentData.teachers as ServerTeacherRow[])
      : []
    const students: ServerStudentRow[] = Array.isArray(currentData.students)
      ? (currentData.students as ServerStudentRow[])
      : []

    // ==================== 1. CREATE / UPLOAD QUIZ ====================
    if (action === 'create') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can create or upload online quizzes.' },
          { status: 403 },
        )
      }

      const title = String(body.title || '').trim()
      const subject = String(body.subject || '').trim()
      const className = String(body.className || '').trim()
      const dueDate = String(body.dueDate || '').trim() || 'Next Friday · 8:00 PM'
      const durationMins = Math.min(180, Math.max(2, Math.round(Number(body.durationMins) || 15)))
      const passPercentage = Math.min(100, Math.max(20, Math.round(Number(body.passPercentage) || 60)))
      const uploadMode = String(body.uploadMode || 'manual')

      if (!title) {
        return NextResponse.json({ ok: false, error: 'Quiz title is required.' }, { status: 400 })
      }
      if (!subject) {
        return NextResponse.json({ ok: false, error: 'Subject is required.' }, { status: 400 })
      }
      if (!className) {
        return NextResponse.json({ ok: false, error: 'Target class is required.' }, { status: 400 })
      }

      let authorName = session.display_name
      if (session.role === 'teacher') {
        const activeTeacher = teachers.find((t) => t.id === session.linked_entity_id) || null
        if (!activeTeacher || activeTeacher.status === 'suspended') {
          return NextResponse.json(
            { ok: false, error: 'Active faculty profile not found or account suspended.' },
            { status: 403 },
          )
        }
        authorName = activeTeacher.name
        const assignedClasses = activeTeacher.assignedClasses || []
        if (!teacherAssignedToTargetClass(className, assignedClasses)) {
          appendSecurityAudit({
            action: 'quiz_unauthorized_class_blocked',
            target: `${activeTeacher.name} attempted to upload quiz "${title}" for unassigned class "${className}" — assigned only to [${assignedClasses.join(', ')}]`,
            actor: activeTeacher.name,
            actorRole: 'teacher',
            ipAddress: ip,
          })
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: You are not assigned to "${className}". Teachers can only create or upload quizzes for their assigned classes (${assignedClasses.join(', ') || 'None'}).`,
            },
            { status: 403 },
          )
        }
      }

      const qCheck = sanitizeQuestions(body.questions)
      if (!qCheck.ok) {
        return NextResponse.json({ ok: false, error: qCheck.error }, { status: 400 })
      }

      const nowIso = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })

      const newQuiz: ServerOnlineQuiz = {
        id: `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        subject,
        className,
        teacherName: authorName,
        durationMins,
        passPercentage,
        dueDate,
        status: 'published',
        createdAt: nowIso,
        questions: qCheck.questions,
      }

      const nextQuizzes = [newQuiz, ...quizzes]
      const saved = savePersistedState(
        {
          ...currentData,
          quizzes: nextQuizzes,
        },
        authorName,
      )

      appendSecurityAudit({
        action: uploadMode === 'bulk' ? 'quiz_bulk_uploaded' : 'quiz_published',
        target: `${newQuiz.title} (${newQuiz.className} · ${newQuiz.subject} · ${newQuiz.questions.length} Qs)`,
        actor: authorName,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: authorName,
      })

      return NextResponse.json({
        ok: true,
        quiz: newQuiz,
        quizzes: nextQuizzes,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    // ==================== 2. UPDATE EXISTING QUIZ ====================
    if (action === 'update') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can edit quizzes.' },
          { status: 403 },
        )
      }

      const quizId = String(body.quizId || '').trim()
      const existing = quizzes.find((q) => q.id === quizId)
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'Quiz not found.' }, { status: 404 })
      }

      const title = String(body.title ?? existing.title).trim()
      const subject = String(body.subject ?? existing.subject).trim()
      const className = String(body.className ?? existing.className).trim()
      const dueDate = String(body.dueDate ?? existing.dueDate).trim() || existing.dueDate
      const durationMins = Math.min(
        180,
        Math.max(2, Math.round(Number(body.durationMins ?? existing.durationMins) || 15)),
      )
      const passPercentage = Math.min(
        100,
        Math.max(20, Math.round(Number(body.passPercentage ?? existing.passPercentage) || 60)),
      )

      if (!title || !subject || !className) {
        return NextResponse.json(
          { ok: false, error: 'Title, subject, and target class are required.' },
          { status: 400 },
        )
      }

      if (session.role === 'teacher') {
        const activeTeacher = teachers.find((t) => t.id === session.linked_entity_id) || null
        if (!activeTeacher || activeTeacher.status === 'suspended') {
          return NextResponse.json(
            { ok: false, error: 'Active faculty profile not found or account suspended.' },
            { status: 403 },
          )
        }
        const assignedClasses = activeTeacher.assignedClasses || []
        if (
          !teacherCanAccessQuiz(existing, activeTeacher) ||
          !teacherAssignedToTargetClass(className, assignedClasses)
        ) {
          appendSecurityAudit({
            action: 'quiz_unauthorized_class_blocked',
            target: `${activeTeacher.name} attempted to edit quiz "${existing.title}" for class "${className}"`,
            actor: activeTeacher.name,
            actorRole: 'teacher',
            ipAddress: ip,
          })
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: You can only edit quizzes belonging to your assigned classes (${assignedClasses.join(', ') || 'None'}).`,
            },
            { status: 403 },
          )
        }
      }

      const qCheck = sanitizeQuestions(body.questions ?? existing.questions)
      if (!qCheck.ok) {
        return NextResponse.json({ ok: false, error: qCheck.error }, { status: 400 })
      }

      const updatedQuiz: ServerOnlineQuiz = {
        ...existing,
        title,
        subject,
        className,
        dueDate,
        durationMins,
        passPercentage,
        questions: qCheck.questions,
      }

      const nextQuizzes = quizzes.map((q) => (q.id === quizId ? updatedQuiz : q))
      const saved = savePersistedState(
        {
          ...currentData,
          quizzes: nextQuizzes,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'quiz_updated',
        target: `${updatedQuiz.title} (${updatedQuiz.className} · ${updatedQuiz.questions.length} Qs)`,
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
        quiz: updatedQuiz,
        quizzes: nextQuizzes,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    // ==================== 3. TOGGLE STATUS (PUBLISH / CLOSE) ====================
    if (action === 'toggle_status') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can publish or close quizzes.' },
          { status: 403 },
        )
      }

      const quizId = String(body.quizId || '').trim()
      const existing = quizzes.find((q) => q.id === quizId)
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'Quiz not found.' }, { status: 404 })
      }

      if (session.role === 'teacher') {
        const activeTeacher = teachers.find((t) => t.id === session.linked_entity_id) || null
        if (!activeTeacher || !teacherCanAccessQuiz(existing, activeTeacher)) {
          appendSecurityAudit({
            action: 'quiz_unauthorized_class_blocked',
            target: `${session.display_name} attempted to toggle quiz "${existing.title}" (${existing.className})`,
            actor: session.display_name,
            actorRole: 'teacher',
            ipAddress: ip,
          })
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: "${existing.title}" (${existing.className}) is not in your assigned classes.`,
            },
            { status: 403 },
          )
        }
      }

      const nextStatus: 'published' | 'closed' =
        existing.status === 'published' ? 'closed' : 'published'
      const updatedQuiz: ServerOnlineQuiz = { ...existing, status: nextStatus }
      const nextQuizzes = quizzes.map((q) => (q.id === quizId ? updatedQuiz : q))

      const saved = savePersistedState(
        {
          ...currentData,
          quizzes: nextQuizzes,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'quiz_status_toggled',
        target: `${existing.title} (${existing.className}) → ${nextStatus}`,
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
        quiz: updatedQuiz,
        quizzes: nextQuizzes,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    // ==================== 4. DELETE QUIZ ====================
    if (action === 'delete') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can delete quizzes.' },
          { status: 403 },
        )
      }

      const quizId = String(body.quizId || '').trim()
      const existing = quizzes.find((q) => q.id === quizId)
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'Quiz not found.' }, { status: 404 })
      }

      if (session.role === 'teacher') {
        const activeTeacher = teachers.find((t) => t.id === session.linked_entity_id) || null
        if (!activeTeacher || !teacherCanAccessQuiz(existing, activeTeacher)) {
          appendSecurityAudit({
            action: 'quiz_unauthorized_class_blocked',
            target: `${session.display_name} attempted to delete quiz "${existing.title}" (${existing.className})`,
            actor: session.display_name,
            actorRole: 'teacher',
            ipAddress: ip,
          })
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: You cannot delete "${existing.title}" (${existing.className}) because it is outside your assigned classes.`,
            },
            { status: 403 },
          )
        }
      }

      const nextQuizzes = quizzes.filter((q) => q.id !== quizId)
      const nextAttempts = quizAttempts.filter((a) => a.quizId !== quizId)

      const saved = savePersistedState(
        {
          ...currentData,
          quizzes: nextQuizzes,
          quizAttempts: nextAttempts,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'quiz_deleted',
        target: `${existing.title} (${existing.className} · ${existing.subject})`,
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
        deletedId: quizId,
        quizzes: nextQuizzes,
        quizAttempts: nextAttempts,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    // ==================== 5. SUBMIT & SERVER-GRADE QUIZ ATTEMPT ====================
    if (action === 'submit_attempt') {
      if (
        session.role !== 'student' &&
        session.role !== 'teacher' &&
        session.role !== 'admin' &&
        session.role !== 'guardian'
      ) {
        return NextResponse.json(
          { ok: false, error: 'Unauthorized role for quiz submission.' },
          { status: 403 },
        )
      }

      const quizId = String(body.quizId || '').trim()
      const studentId = String(body.studentId || '').trim()
      const answers = Array.isArray(body.answers) ? body.answers.map((v) => Number(v)) : []
      const timeTakenSec = Math.max(1, Math.round(Number(body.timeTakenSec) || 1))

      const quiz = quizzes.find((q) => q.id === quizId)
      if (!quiz) {
        return NextResponse.json({ ok: false, error: 'Quiz not found.' }, { status: 404 })
      }
      const student = students.find((s) => s.id === studentId)
      if (!student) {
        return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
      }

      if (session.role === 'student') {
        if (student.id !== session.linked_entity_id) {
          return NextResponse.json(
            { ok: false, error: 'Students can only submit attempts for their own account.' },
            { status: 403 },
          )
        }
        if (quiz.status !== 'published') {
          return NextResponse.json(
            { ok: false, error: 'This quiz is closed and no longer accepting submissions.' },
            { status: 400 },
          )
        }
        if (!studentMatchesQuizClass(student, quiz.className)) {
          appendSecurityAudit({
            action: 'quiz_unauthorized_attempt_blocked',
            target: `${student.name} (${student.className} ${student.section}) attempted quiz "${quiz.title}" (${quiz.className})`,
            actor: student.name,
            actorRole: 'student',
            ipAddress: ip,
          })
          return NextResponse.json(
            {
              ok: false,
              error: `This quiz is assigned to ${quiz.className} and is not available for ${student.className} · ${student.section}.`,
            },
            { status: 403 },
          )
        }
      } else if (session.role === 'guardian') {
        // Guardians in Family Shared Child Mode may submit only for their own linked child
        const guardiansList = Array.isArray(currentData.guardians)
          ? (currentData.guardians as Array<{ id: string; linkedStudentIds?: string[] }>)
          : []
        const activeGuardian = guardiansList.find((g) => g.id === session.linked_entity_id) || null
        const linkedSet = new Set(activeGuardian?.linkedStudentIds || [])
        if (student.guardianId !== session.linked_entity_id && !linkedSet.has(student.id)) {
          return NextResponse.json(
            { ok: false, error: 'Guardians can only access quizzes for their own linked children.' },
            { status: 403 },
          )
        }
        if (quiz.status !== 'published' || !studentMatchesQuizClass(student, quiz.className)) {
          return NextResponse.json(
            { ok: false, error: 'Quiz is closed or not assigned to this student’s class.' },
            { status: 403 },
          )
        }
      }

      // Authoritative server-side grading
      let score = 0
      let totalMarks = 0
      const normalizedAnswers: number[] = []
      quiz.questions.forEach((q, idx) => {
        totalMarks += Number(q.points) || 0
        const ans = Number.isInteger(answers[idx]) ? answers[idx] : -1
        normalizedAnswers.push(ans)
        if (ans === q.correctIndex) {
          score += Number(q.points) || 0
        }
      })

      const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0
      const passed = percentage >= quiz.passPercentage
      const xpAwarded = passed ? 50 : 25

      // Auto-sync matching subject (or auto-create subject) in student's Gradebook + recalculate GPA & Class Leaderboard Rank
      const gradeSync = applyQuizGradeToStudents(students, student.id, quiz, percentage)

      const attempt: ServerQuizAttempt = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        quizId,
        studentId: student.id,
        studentName: student.name,
        answers: normalizedAnswers,
        score,
        totalMarks,
        percentage,
        passed,
        timeTakenSec,
        submittedAt:
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Today',
        gradebookSynced: true,
        syncedSubject: gradeSync.syncedSubject,
        syncedGrade: gradeSync.syncedGrade,
        syncedAverageScore: gradeSync.syncedAverageScore,
        syncedGpa: gradeSync.syncedGpa,
        syncedRank: gradeSync.syncedRank,
        xpAwarded,
      }

      const nextAttempts: ServerQuizAttempt[] = [
        attempt,
        ...quizAttempts.filter((a) => !(a.quizId === quizId && a.studentId === student.id)),
      ]

      // Award StudyQuest XP in SQLite (Record<studentId, StudyQuestProfile>)
      const existingQuestMap =
        currentData.studyQuestProfiles && typeof currentData.studyQuestProfiles === 'object'
          ? ({ ...(currentData.studyQuestProfiles as Record<string, Record<string, unknown>>) })
          : {}
      const todayIso = new Date().toISOString().slice(0, 10)
      const prevQuest = existingQuestMap[student.id]
      existingQuestMap[student.id] = prevQuest
        ? {
            ...prevQuest,
            xp: Number(prevQuest.xp || 0) + xpAwarded,
            lastStudyDate: todayIso,
          }
        : {
            studentId: student.id,
            xp: xpAwarded,
            streakDays: 1,
            completedMissionIds: [],
            clearedBossIds: [],
            focusMinutesLogged: Math.max(1, Math.round(timeTakenSec / 60)),
            unlockedBadges: ['Quiz Starter'],
            guardianCheers: 0,
            lastStudyDate: todayIso,
          }

      // Persist live system notification for Guardian, Student, Teacher & Admin
      const existingNotifications = Array.isArray(currentData.notifications)
        ? (currentData.notifications as Array<Record<string, unknown>>)
        : []
      const notif = {
        id: `notif-quiz-${Date.now()}`,
        title: `Quiz Graded & Added to Gradebook: ${student.name} (${gradeSync.syncedGrade})`,
        text: `${student.name} scored ${score}/${totalMarks} (${percentage}% · ${gradeSync.syncedGrade}) in "${quiz.title}". Synced to ${gradeSync.syncedSubject} Gradebook · Avg ${gradeSync.syncedAverageScore}% (GPA ${gradeSync.syncedGpa} · Rank ${gradeSync.syncedRank}) · +${xpAwarded} XP.`,
        time: 'Just now',
        type: 'result',
        forRoles: ['guardian', 'student', 'teacher', 'admin'],
        read: false,
      }
      const nextNotifications = [notif, ...existingNotifications].slice(0, 80)

      const saved = savePersistedState(
        {
          ...currentData,
          quizAttempts: nextAttempts,
          students: gradeSync.nextStudents,
          studyQuestProfiles: existingQuestMap,
          notifications: nextNotifications,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'quiz_attempt_submitted_and_grade_synced',
        target: `${student.name} scored ${score}/${totalMarks} (${percentage}% · ${gradeSync.syncedGrade}) on "${quiz.title}" → Gradebook ${gradeSync.syncedSubject}, GPA ${gradeSync.syncedGpa}, Rank ${gradeSync.syncedRank}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Quiz result synced to Gradebook for ${student.name} (${percentage}% · ${gradeSync.syncedGrade})`,
      })

      return NextResponse.json({
        ok: true,
        attempt,
        gradebookSyncedSubject: gradeSync.syncedSubject,
        syncedGrade: gradeSync.syncedGrade,
        syncedGpa: gradeSync.syncedGpa,
        syncedRank: gradeSync.syncedRank,
        xpAwarded,
        quizAttempts: nextAttempts,
        students: gradeSync.nextStudents,
        studyQuestProfiles: existingQuestMap,
        notifications: nextNotifications,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    // ==================== 6. MANUAL SYNC / RE-SYNC QUIZ RESULTS TO GRADEBOOK & LEADERBOARD ====================
    if (action === 'sync_to_gradebook') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can sync quiz results to the Gradebook.' },
          { status: 403 },
        )
      }

      const quizId = String(body.quizId || '').trim()
      const onlyStudentId = body.studentId ? String(body.studentId).trim() : null
      const quiz = quizzes.find((q) => q.id === quizId)
      if (!quiz) {
        return NextResponse.json({ ok: false, error: 'Quiz not found.' }, { status: 404 })
      }

      if (session.role === 'teacher') {
        const activeTeacher = teachers.find((t) => t.id === session.linked_entity_id) || null
        if (!activeTeacher || !teacherCanAccessQuiz(quiz, activeTeacher)) {
          return NextResponse.json(
            { ok: false, error: 'Access Denied: Quiz is outside your assigned classes.' },
            { status: 403 },
          )
        }
      }

      const matchingAttempts = quizAttempts.filter(
        (a) => a.quizId === quizId && (!onlyStudentId || a.studentId === onlyStudentId),
      )
      if (matchingAttempts.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'No submitted attempts found to sync for this quiz.' },
          { status: 400 },
        )
      }

      let rollingStudents = [...students]
      const syncedMetaByAttemptId = new Map<
        string,
        {
          syncedSubject: string
          syncedGrade: string
          syncedAverageScore: number
          syncedGpa: string
          syncedRank: string
        }
      >()

      for (const att of matchingAttempts) {
        const res = applyQuizGradeToStudents(rollingStudents, att.studentId, quiz, att.percentage)
        rollingStudents = res.nextStudents
        syncedMetaByAttemptId.set(att.id, {
          syncedSubject: res.syncedSubject,
          syncedGrade: res.syncedGrade,
          syncedAverageScore: res.syncedAverageScore,
          syncedGpa: res.syncedGpa,
          syncedRank: res.syncedRank,
        })
      }

      // Refresh final ranks after all batch attempts are applied
      rollingStudents = recalculateClassRanks(rollingStudents)
      const finalStudentById = new Map(rollingStudents.map((s) => [s.id, s]))

      const nextAttempts = quizAttempts.map((a) => {
        const meta = syncedMetaByAttemptId.get(a.id)
        if (!meta) return a
        const finalStu = finalStudentById.get(a.studentId)
        return {
          ...a,
          gradebookSynced: true,
          syncedSubject: meta.syncedSubject,
          syncedGrade: meta.syncedGrade,
          syncedAverageScore: finalStu ? Number(finalStu.averageScore) : meta.syncedAverageScore,
          syncedGpa: finalStu ? String(finalStu.gpa) : meta.syncedGpa,
          syncedRank: finalStu ? String(finalStu.rank || meta.syncedRank) : meta.syncedRank,
        }
      })

      const existingNotifications = Array.isArray(currentData.notifications)
        ? (currentData.notifications as Array<Record<string, unknown>>)
        : []
      const notif = {
        id: `notif-qsync-${Date.now()}`,
        title: `Quiz Results Synced to Gradebook (${quiz.subject})`,
        text: `${session.display_name} synced ${matchingAttempts.length} quiz result(s) from "${quiz.title}" (${quiz.className}) to Student Gradebooks & Class Leaderboard.`,
        time: 'Just now',
        type: 'result',
        forRoles: ['guardian', 'student', 'teacher', 'admin'],
        read: false,
      }
      const nextNotifications = [notif, ...existingNotifications].slice(0, 80)

      const saved = savePersistedState(
        {
          ...currentData,
          students: rollingStudents,
          quizAttempts: nextAttempts,
          notifications: nextNotifications,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'quiz_results_batch_synced_to_gradebook',
        target: `"${quiz.title}" (${quiz.className}) · ${matchingAttempts.length} student result(s) synced`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Synced ${matchingAttempts.length} quiz result(s) to Gradebook`,
      })

      return NextResponse.json({
        ok: true,
        syncedCount: matchingAttempts.length,
        students: rollingStudents,
        quizAttempts: nextAttempts,
        notifications: nextNotifications,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    // ==================== 7. REMIND NOT-ATTEMPTED STUDENTS & GUARDIANS ====================
    if (action === 'remind_not_attempted') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can send quiz reminders.' },
          { status: 403 },
        )
      }

      const quizId = String(body.quizId || '').trim()
      const onlyStudentId = body.studentId ? String(body.studentId).trim() : null
      const quiz = quizzes.find((q) => q.id === quizId)
      if (!quiz) {
        return NextResponse.json({ ok: false, error: 'Quiz not found.' }, { status: 404 })
      }

      if (session.role === 'teacher') {
        const activeTeacher = teachers.find((t) => t.id === session.linked_entity_id) || null
        if (!activeTeacher || !teacherCanAccessQuiz(quiz, activeTeacher)) {
          return NextResponse.json(
            { ok: false, error: 'Access Denied: Quiz is outside your assigned classes.' },
            { status: 403 },
          )
        }
      }

      const attemptedIds = new Set(
        quizAttempts.filter((a) => a.quizId === quizId).map((a) => a.studentId),
      )
      const eligibleUnattempted = students.filter(
        (s) =>
          s.status !== 'suspended' &&
          studentMatchesQuizClass(s, quiz.className) &&
          !attemptedIds.has(s.id) &&
          (!onlyStudentId || s.id === onlyStudentId),
      )

      if (eligibleUnattempted.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'All eligible students have already attempted this quiz!' },
          { status: 400 },
        )
      }

      const existingNotifications = Array.isArray(currentData.notifications)
        ? (currentData.notifications as Array<Record<string, unknown>>)
        : []
      const existingAlerts = Array.isArray(currentData.parentAlerts)
        ? (currentData.parentAlerts as Array<Record<string, unknown>>)
        : []
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      const newNotifs = eligibleUnattempted.map((stu, i) => ({
        id: `notif-qrem-${Date.now()}-${i}`,
        title: `Quiz Reminder: ${quiz.title} (${quiz.subject})`,
        text: `${stu.name} (${stu.className} · ${stu.section}) has not yet attempted "${quiz.title}" (Due: ${quiz.dueDate}). Please complete it in Online Quizzes so your grade syncs on time.`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['student', 'guardian'],
        read: false,
      }))

      const newAlerts = eligibleUnattempted.map((stu, i) => ({
        id: `alert-qrem-${Date.now()}-${i}`,
        channel: 'WhatsApp',
        category: 'Absence Alert',
        recipientName: String(stu.guardianName || 'Guardian'),
        recipientPhone: String(stu.guardianPhone || '+880 1700-000000'),
        studentName: stu.name,
        message: `DMHA Quiz Reminder: ${stu.name} has not attempted "${quiz.title}" (${quiz.subject}, Due ${quiz.dueDate}). Please complete it in the DMHA Smart Learning App.`,
        sentBy: session.display_name,
        sentAt: `Today · ${nowTime}`,
        status: 'delivered',
      }))

      const nextNotifications = [...newNotifs, ...existingNotifications].slice(0, 80)
      const nextParentAlerts = [...newAlerts, ...existingAlerts].slice(0, 100)

      const saved = savePersistedState(
        {
          ...currentData,
          notifications: nextNotifications,
          parentAlerts: nextParentAlerts,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'quiz_not_attempted_reminder_sent',
        target: `"${quiz.title}" (${quiz.className}) · reminded ${eligibleUnattempted.length} student(s): ${eligibleUnattempted.map((s) => s.name).join(', ')}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Sent quiz reminder to ${eligibleUnattempted.length} pending student(s)`,
      })

      return NextResponse.json({
        ok: true,
        remindedCount: eligibleUnattempted.length,
        remindedNames: eligibleUnattempted.map((s) => s.name),
        notifications: nextNotifications,
        parentAlerts: nextParentAlerts,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    return NextResponse.json({ ok: false, error: `Unsupported action "${action}".` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Quiz operation failed.' },
      { status: 500 },
    )
  }
}
