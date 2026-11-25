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

export const CURRENT_SEMESTER_TERM = 'Term Final 2026'

type FeedbackCategory = 'praise' | 'academic' | 'behavior' | 'attention'
type StarRating = 1 | 2 | 3 | 4 | 5

interface ServerFeedbackRow {
  id: string
  studentId: string
  studentName: string
  teacherName: string
  subject: string
  category: FeedbackCategory
  title: string
  message: string
  date: string
  acknowledgedByGuardian: boolean
  guardianReply?: string
  senderRole?: 'teacher' | 'guardian' | 'student' | 'admin'
  senderName?: string
  rating?: StarRating
  studentReply?: string
  teacherReply?: string
}

interface ServerSemesterEvaluationRow {
  id: string
  term: string
  studentId: string
  studentName: string
  classSection: string
  submittedByRole: 'student' | 'guardian'
  submittedByName: string
  teacherId: string
  teacherName: string
  subject: string
  rating: StarRating
  teachingClarity: StarRating
  supportiveness: StarRating
  comment: string
  createdAt: string
}

interface ServerStudentRow {
  id: string
  name: string
  className: string
  section: string
  guardianId?: string
  guardianName: string
  subjects: Array<{
    id: string
    name: string
    teacher: string
  }>
}

interface ServerTeacherRow {
  id: string
  name: string
  subject: string
  assignedClasses?: string[]
  status?: string
}

interface ServerGuardianRow {
  id: string
  name: string
  linkedStudentIds?: string[]
}

const VALID_CATEGORIES = new Set<FeedbackCategory>(['praise', 'academic', 'behavior', 'attention'])

function normalizeClassToken(raw: string): string {
  return String(raw || '')
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
  const sectionLetter = student.section.replace(/section/i, '').trim().toLowerCase()
  const compactToken = normalizeClassToken(`${student.className}${sectionLetter}`)
  const gradeOnlyToken = normalizeClassToken(student.className)
  return assignedClasses.some((cls) => {
    const token = normalizeClassToken(cls)
    return Boolean(token) && (token === fullToken || token === compactToken || token === gradeOnlyToken)
  })
}

function guardianOwnsStudent(
  guardianId: string,
  student: ServerStudentRow,
  guardians: ServerGuardianRow[],
): boolean {
  if (student.guardianId === guardianId) return true
  const g = guardians.find((item) => item.id === guardianId)
  return Boolean(g?.linkedStudentIds?.includes(student.id))
}

function clampStar(raw: unknown): StarRating | null {
  const n = Math.round(Number(raw))
  if (!Number.isInteger(n) || n < 1 || n > 5) return null
  return n as StarRating
}

function buildEvaluationStatus(
  student: ServerStudentRow,
  evaluations: ServerSemesterEvaluationRow[],
  teachers: ServerTeacherRow[],
  term = CURRENT_SEMESTER_TERM,
) {
  const requiredItems = (student.subjects || []).map((sub) => {
    const matchedTeacher = teachers.find(
      (t) => t.name.trim().toLowerCase() === sub.teacher.trim().toLowerCase(),
    )
    return {
      subject: sub.name,
      teacherName: sub.teacher,
      teacherId: matchedTeacher?.id || `tch-${sub.name.toLowerCase().replace(/\s+/g, '-')}`,
    }
  })

  const stuEvals = evaluations.filter((e) => e.studentId === student.id && e.term === term)
  const completedSet = new Set(stuEvals.map((e) => e.subject.toLowerCase()))
  const completedSubjects = requiredItems
    .filter((r) => completedSet.has(r.subject.toLowerCase()))
    .map((r) => r.subject)
  const remainingSubjects = requiredItems
    .filter((r) => !completedSet.has(r.subject.toLowerCase()))
    .map((r) => r.subject)

  const avgRating =
    stuEvals.length > 0
      ? Number((stuEvals.reduce((s, e) => s + e.rating, 0) / stuEvals.length).toFixed(1))
      : null

  return {
    term,
    requiredItems,
    completedSubjects,
    remainingSubjects,
    completedCount: completedSubjects.length,
    requiredCount: requiredItems.length,
    isComplete: requiredItems.length > 0 && remainingSubjects.length === 0,
    averageGivenRating: avgRating,
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuthSession()
    if (!auth.ok) return auth.response
    const { session } = auth

    const url = new URL(request.url)
    const requestedStudentId = (url.searchParams.get('studentId') || '').trim()

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
    const allFeedback: ServerFeedbackRow[] = Array.isArray(data.feedback)
      ? (data.feedback as ServerFeedbackRow[])
      : []
    const allEvaluations: ServerSemesterEvaluationRow[] = Array.isArray(data.semesterEvaluations)
      ? (data.semesterEvaluations as ServerSemesterEvaluationRow[])
      : []

    if (session.role === 'admin') {
      const targetStu = students.find((s) => s.id === requestedStudentId) || students[0] || null
      return NextResponse.json({
        ok: true,
        term: CURRENT_SEMESTER_TERM,
        feedback: allFeedback,
        semesterEvaluations: allEvaluations,
        evaluationStatus: targetStu
          ? buildEvaluationStatus(targetStu, allEvaluations, teachers)
          : null,
      })
    }

    if (session.role === 'teacher') {
      const activeTeacher = teachers.find((t) => t.id === session.linked_entity_id) || null
      const assignedClasses = activeTeacher?.assignedClasses || []
      const allowedStudents = students.filter((s) =>
        studentMatchesAssignedClasses(s, assignedClasses),
      )
      const allowedStudentIds = new Set(allowedStudents.map((s) => s.id))
      // Confidentiality: strip 1★-5★ ratings from feedback and NEVER return semesterEvaluations to teachers
      const visibleFeedback = allFeedback
        .filter(
          (f) =>
            allowedStudentIds.has(f.studentId) ||
            (activeTeacher &&
              f.teacherName.trim().toLowerCase() === activeTeacher.name.trim().toLowerCase()),
        )
        .map(({ rating: _hiddenRating, ...rest }) => rest)
      return NextResponse.json({
        ok: true,
        term: CURRENT_SEMESTER_TERM,
        assignedClasses,
        feedback: visibleFeedback,
        semesterEvaluations: [],
      })
    }

    if (session.role === 'student') {
      const me = students.find((s) => s.id === session.linked_entity_id) || null
      if (!me) {
        return NextResponse.json({
          ok: true,
          term: CURRENT_SEMESTER_TERM,
          feedback: [],
          semesterEvaluations: [],
          evaluationStatus: null,
        })
      }
      return NextResponse.json({
        ok: true,
        term: CURRENT_SEMESTER_TERM,
        feedback: allFeedback.filter((f) => f.studentId === me.id),
        semesterEvaluations: allEvaluations.filter((e) => e.studentId === me.id),
        evaluationStatus: buildEvaluationStatus(me, allEvaluations, teachers),
      })
    }

    if (session.role === 'guardian') {
      const myKids = students.filter((s) =>
        guardianOwnsStudent(session.linked_entity_id, s, guardians),
      )
      const kidIds = new Set(myKids.map((k) => k.id))
      const activeKid = myKids.find((k) => k.id === requestedStudentId) || myKids[0] || null
      return NextResponse.json({
        ok: true,
        term: CURRENT_SEMESTER_TERM,
        feedback: allFeedback.filter((f) => kidIds.has(f.studentId)),
        semesterEvaluations: allEvaluations.filter((e) => kidIds.has(e.studentId)),
        evaluationStatus: activeKid
          ? buildEvaluationStatus(activeKid, allEvaluations, teachers)
          : null,
      })
    }

    return NextResponse.json({
      ok: true,
      term: CURRENT_SEMESTER_TERM,
      feedback: [],
      semesterEvaluations: [],
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to load feedback.' },
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
    const action = String(body.action || '')

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
    const guardians: ServerGuardianRow[] = Array.isArray(currentData.guardians)
      ? (currentData.guardians as ServerGuardianRow[])
      : []
    const feedback: ServerFeedbackRow[] = Array.isArray(currentData.feedback)
      ? (currentData.feedback as ServerFeedbackRow[])
      : []
    const semesterEvaluations: ServerSemesterEvaluationRow[] = Array.isArray(
      currentData.semesterEvaluations,
    )
      ? (currentData.semesterEvaluations as ServerSemesterEvaluationRow[])
      : []

    // ==================== 1. TEACHER / ADMIN POST CLASSROOM FEEDBACK ====================
    if (action === 'teacher_post') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can post classroom remarks.' },
          { status: 403 },
        )
      }

      const studentId = String(body.studentId || '').trim()
      const subject = String(body.subject || '').trim() || 'General Conduct'
      const category = (String(body.category || 'academic') as FeedbackCategory)
      const title = String(body.title || '').trim()
      const message = String(body.message || '').trim()

      if (!studentId || !title || !message || !VALID_CATEGORIES.has(category)) {
        return NextResponse.json(
          { ok: false, error: 'Student, valid category, title, and message are required.' },
          { status: 400 },
        )
      }

      const student = students.find((s) => s.id === studentId)
      if (!student) {
        return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
      }

      let authorName = session.display_name
      if (session.role === 'teacher') {
        const activeTeacher = teachers.find((t) => t.id === session.linked_entity_id) || null
        if (!activeTeacher || activeTeacher.status === 'suspended') {
          return NextResponse.json(
            { ok: false, error: 'Active faculty profile not found or suspended.' },
            { status: 403 },
          )
        }
        const assignedClasses = activeTeacher.assignedClasses || []
        if (!studentMatchesAssignedClasses(student, assignedClasses)) {
          appendSecurityAudit({
            action: 'feedback_unauthorized_class_blocked',
            target: `${activeTeacher.name} attempted to post feedback for ${student.name} (${student.className} · ${student.section})`,
            actor: activeTeacher.name,
            actorRole: 'teacher',
            ipAddress: ip,
          })
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: You are not assigned to ${student.className} · ${student.section} (${student.name}). Teachers can only post feedback for their assigned classes (${assignedClasses.join(', ') || 'None'}).`,
            },
            { status: 403 },
          )
        }
        authorName = activeTeacher.name
      }

      const newItem: ServerFeedbackRow = {
        id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: student.id,
        studentName: student.name,
        teacherName: authorName,
        subject,
        category,
        title,
        message,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Today',
        acknowledgedByGuardian: false,
        senderRole: session.role === 'admin' ? 'admin' : 'teacher',
        senderName: authorName,
      }

      const nextFeedback = [newItem, ...feedback]
      const saved = savePersistedState(
        {
          ...currentData,
          feedback: nextFeedback,
        },
        authorName,
      )

      appendSecurityAudit({
        action: 'teacher_feedback_posted',
        target: `${authorName} → ${student.name} (${subject}): "${title}"`,
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
        item: newItem,
        feedback:
          session.role === 'teacher'
            ? nextFeedback.map(({ rating: _hiddenRating, ...rest }) => rest)
            : nextFeedback,
        version: saved.version,
      })
    }

    // ==================== 2. STUDENT OR GUARDIAN DIRECT FEEDBACK TO TEACHER / SCHOOL ====================
    if (action === 'family_submit') {
      if (session.role !== 'student' && session.role !== 'guardian' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Students and Guardians can submit family feedback.' },
          { status: 403 },
        )
      }

      const studentId = String(body.studentId || '').trim()
      const teacherName = String(body.teacherName || '').trim() || 'Principal & Academic Office'
      const subject = String(body.subject || '').trim() || 'General'
      const category = (String(body.category || 'academic') as FeedbackCategory)
      const title = String(body.title || '').trim()
      const message = String(body.message || '').trim()
      const rating = body.rating !== undefined && body.rating !== null ? clampStar(body.rating) : undefined

      if (!studentId || !title || !message || !VALID_CATEGORIES.has(category)) {
        return NextResponse.json(
          { ok: false, error: 'Student, category, title, and message are required.' },
          { status: 400 },
        )
      }
      if (body.rating !== undefined && body.rating !== null && !rating) {
        return NextResponse.json(
          { ok: false, error: 'Star rating must be between 1 and 5.' },
          { status: 400 },
        )
      }

      const student = students.find((s) => s.id === studentId)
      if (!student) {
        return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
      }

      if (session.role === 'student' && student.id !== session.linked_entity_id) {
        return NextResponse.json(
          { ok: false, error: 'Students can only submit feedback from their own profile.' },
          { status: 403 },
        )
      }
      if (
        session.role === 'guardian' &&
        !guardianOwnsStudent(session.linked_entity_id, student, guardians)
      ) {
        return NextResponse.json(
          { ok: false, error: 'Guardians can only submit feedback for their own linked children.' },
          { status: 403 },
        )
      }

      const senderRole: 'student' | 'guardian' =
        session.role === 'student' ? 'student' : 'guardian'
      const senderName =
        senderRole === 'student'
          ? student.name
          : guardians.find((g) => g.id === session.linked_entity_id)?.name || session.display_name

      const newItem: ServerFeedbackRow = {
        id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: student.id,
        studentName: student.name,
        teacherName,
        subject,
        category,
        title,
        message,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Today',
        acknowledgedByGuardian: senderRole === 'guardian',
        senderRole,
        senderName,
        ...(rating ? { rating } : {}),
      }

      const nextFeedback = [newItem, ...feedback]
      const saved = savePersistedState(
        {
          ...currentData,
          feedback: nextFeedback,
        },
        senderName,
      )

      appendSecurityAudit({
        action: senderRole === 'student' ? 'student_feedback_submitted' : 'guardian_feedback_submitted',
        target: `${senderName} (${senderRole}) → ${teacherName} (${subject})${rating ? ` [${rating}★]` : ''}: "${title}"`,
        actor: senderName,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: senderName,
      })

      return NextResponse.json({
        ok: true,
        item: newItem,
        feedback: nextFeedback,
        version: saved.version,
      })
    }

    // ==================== 3. REPLY / ACKNOWLEDGE FEEDBACK ====================
    if (action === 'reply') {
      const feedbackId = String(body.feedbackId || '').trim()
      const replyText = String(body.reply || '').trim()
      const existing = feedback.find((f) => f.id === feedbackId)
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'Feedback entry not found.' }, { status: 404 })
      }
      const student = students.find((s) => s.id === existing.studentId)
      if (!student) {
        return NextResponse.json({ ok: false, error: 'Associated student not found.' }, { status: 404 })
      }

      if (session.role === 'student' && student.id !== session.linked_entity_id) {
        return NextResponse.json(
          { ok: false, error: 'Students can only reply to their own feedback entries.' },
          { status: 403 },
        )
      }
      if (
        session.role === 'guardian' &&
        !guardianOwnsStudent(session.linked_entity_id, student, guardians)
      ) {
        return NextResponse.json(
          { ok: false, error: 'Guardians can only acknowledge/reply to their own child’s feedback.' },
          { status: 403 },
        )
      }
      if (session.role === 'teacher') {
        const activeTeacher = teachers.find((t) => t.id === session.linked_entity_id) || null
        if (
          !activeTeacher ||
          (!studentMatchesAssignedClasses(student, activeTeacher.assignedClasses || []) &&
            existing.teacherName.trim().toLowerCase() !== activeTeacher.name.trim().toLowerCase())
        ) {
          return NextResponse.json(
            { ok: false, error: 'Access Denied: Feedback belongs to a student outside your assigned classes.' },
            { status: 403 },
          )
        }
      }

      const nextFeedback = feedback.map((f) => {
        if (f.id !== feedbackId) return f
        if (session.role === 'student') {
          return {
            ...f,
            studentReply: replyText || f.studentReply || 'Noted, thank you!',
          }
        }
        if (session.role === 'teacher' || session.role === 'admin') {
          return {
            ...f,
            teacherReply: replyText || f.teacherReply || 'Thank you for your feedback!',
          }
        }
        return {
          ...f,
          acknowledgedByGuardian: true,
          guardianReply: replyText || f.guardianReply,
        }
      })

      const saved = savePersistedState(
        {
          ...currentData,
          feedback: nextFeedback,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'feedback_replied',
        target: `${session.display_name} (${session.role}) replied on "${existing.title}"`,
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
        feedback:
          session.role === 'teacher'
            ? nextFeedback.map(({ rating: _hiddenRating, ...rest }) => rest)
            : nextFeedback,
        version: saved.version,
      })
    }

    // ==================== 4. SUBMIT END-OF-SEMESTER 5★ TO 1★ EVALUATION (UNLOCKS ADMIT CARD) ====================
    if (action === 'submit_semester_evaluation') {
      if (session.role !== 'student' && session.role !== 'guardian' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Students and Guardians can submit End-of-Semester evaluations.' },
          { status: 403 },
        )
      }

      const studentId = String(body.studentId || '').trim()
      const term = String(body.term || CURRENT_SEMESTER_TERM).trim() || CURRENT_SEMESTER_TERM
      const rawEntries = Array.isArray(body.evaluations) ? body.evaluations : []

      if (!studentId || rawEntries.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Student ID and at least one subject/teacher rating (1 to 5 stars) are required.' },
          { status: 400 },
        )
      }

      const student = students.find((s) => s.id === studentId)
      if (!student) {
        return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
      }

      if (session.role === 'student' && student.id !== session.linked_entity_id) {
        return NextResponse.json(
          { ok: false, error: 'Students can only submit end-of-semester evaluations for themselves.' },
          { status: 403 },
        )
      }
      if (
        session.role === 'guardian' &&
        !guardianOwnsStudent(session.linked_entity_id, student, guardians)
      ) {
        return NextResponse.json(
          { ok: false, error: 'Guardians can only submit evaluations for their own linked children.' },
          { status: 403 },
        )
      }

      const submittedByRole: 'student' | 'guardian' =
        session.role === 'student' ? 'student' : 'guardian'
      const submittedByName =
        submittedByRole === 'student'
          ? student.name
          : guardians.find((g) => g.id === session.linked_entity_id)?.name || session.display_name

      const nowStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      const classSection = `${student.className} · ${student.section}`

      let nextEvaluations = [...semesterEvaluations]

      for (let i = 0; i < rawEntries.length; i++) {
        const entry = rawEntries[i] as Record<string, unknown>
        const subject = String(entry?.subject || '').trim()
        const teacherName = String(entry?.teacherName || '').trim()
        const rating = clampStar(entry?.rating)
        const teachingClarity = clampStar(entry?.teachingClarity ?? entry?.rating)
        const supportiveness = clampStar(entry?.supportiveness ?? entry?.rating)
        const comment = String(entry?.comment || '').trim()

        if (!subject || !teacherName) {
          return NextResponse.json(
            { ok: false, error: `Evaluation row #${i + 1} is missing subject or teacher name.` },
            { status: 400 },
          )
        }
        if (!rating || !teachingClarity || !supportiveness) {
          return NextResponse.json(
            { ok: false, error: `Evaluation for ${subject} must use a valid 1-to-5 star rating.` },
            { status: 400 },
          )
        }

        const matchedTeacher = teachers.find(
          (t) => t.name.trim().toLowerCase() === teacherName.toLowerCase(),
        )
        const teacherId =
          String(entry?.teacherId || '').trim() ||
          matchedTeacher?.id ||
          `tch-${subject.toLowerCase().replace(/\s+/g, '-')}`

        const record: ServerSemesterEvaluationRow = {
          id: `eval-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
          term,
          studentId: student.id,
          studentName: student.name,
          classSection,
          submittedByRole,
          submittedByName,
          teacherId,
          teacherName: matchedTeacher?.name || teacherName,
          subject,
          rating,
          teachingClarity,
          supportiveness,
          comment: comment || `Rated ${rating}/5 stars for ${subject} (${term}).`,
          createdAt: nowStr,
        }

        // Upsert by (term, studentId, subject)
        nextEvaluations = [
          record,
          ...nextEvaluations.filter(
            (e) =>
              !(
                e.term === term &&
                e.studentId === student.id &&
                e.subject.toLowerCase() === subject.toLowerCase()
              ),
          ),
        ]
      }

      const evaluationStatus = buildEvaluationStatus(student, nextEvaluations, teachers, term)
      const saved = savePersistedState(
        {
          ...currentData,
          semesterEvaluations: nextEvaluations,
        },
        submittedByName,
      )

      appendSecurityAudit({
        action: 'semester_evaluation_submitted',
        target: `${submittedByName} (${submittedByRole}) evaluated ${rawEntries.length} subject(s) for ${student.name} (${term}) — Admit Card ${evaluationStatus.isComplete ? 'UNLOCKED' : `${evaluationStatus.completedCount}/${evaluationStatus.requiredCount}`}`,
        actor: submittedByName,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: submittedByName,
      })

      return NextResponse.json({
        ok: true,
        semesterEvaluations:
          session.role === 'admin'
            ? nextEvaluations
            : nextEvaluations.filter((e) => e.studentId === student.id),
        evaluationStatus,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    return NextResponse.json({ ok: false, error: `Unsupported action "${action}".` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Feedback action failed.' },
      { status: 500 },
    )
  }
}
