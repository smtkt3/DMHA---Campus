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

interface ServerSubjectRow {
  id: string
  name: string
  teacher: string
  section: string
  progress: number
  latestScore: number
  previousScore: number
  grade: string
  color: 'violet' | 'cyan' | 'lime' | 'orange'
  nextTopic: string
}

interface ServerStudentRow {
  id: string
  name: string
  initials: string
  className: string
  section: string
  roll: string
  guardianName: string
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
  subject: string
  assignedClasses?: string[]
  status?: string
}

interface ServerQuizAttemptRow {
  studentId: string
  percentage: number
}

interface ServerMeritRow {
  studentId: string
  type: 'merit' | 'pastoral'
  points: number
}

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

function pickColorForSubject(name: string): 'violet' | 'cyan' | 'lime' | 'orange' {
  const lower = name.toLowerCase()
  if (lower.includes('phys') || lower.includes('sci')) return 'violet'
  if (lower.includes('math')) return 'cyan'
  if (lower.includes('eng') || lower.includes('bangla')) return 'lime'
  return 'orange'
}

/**
 * Determines which teacher owns a subject for a given student/class section.
 * Returns null only if no teacher currently owns that subject in this student's class.
 */
function findSubjectOwner(
  students: ServerStudentRow[],
  student: ServerStudentRow,
  subjectId?: string,
  subjectName?: string,
): { subjectName: string; teacherName: string } | null {
  const directMatch = (student.subjects || []).find(
    (sub) =>
      (subjectId && sub.id === subjectId) ||
      (subjectName && sub.name.toLowerCase() === subjectName.toLowerCase()),
  )
  if (directMatch && directMatch.teacher?.trim()) {
    return { subjectName: directMatch.name, teacherName: directMatch.teacher.trim() }
  }

  if (subjectName) {
    const cohortKey = normalizeClassToken(`${student.className} ${student.section}`)
    for (const peer of students) {
      if (normalizeClassToken(`${peer.className} ${peer.section}`) !== cohortKey) continue
      const peerSub = (peer.subjects || []).find(
        (sub) => sub.name.toLowerCase() === subjectName.toLowerCase(),
      )
      if (peerSub && peerSub.teacher?.trim()) {
        return { subjectName: peerSub.name, teacherName: peerSub.teacher.trim() }
      }
    }
  }
  return null
}

function recalculateCohortRanks(
  students: ServerStudentRow[],
  quizAttempts: ServerQuizAttemptRow[],
  merits: ServerMeritRow[],
): ServerStudentRow[] {
  const byCohort = new Map<string, Array<{ id: string; points: number; avg: number }>>()

  for (const stu of students) {
    const subs = Array.isArray(stu.subjects) ? stu.subjects : []
    const avg =
      subs.length > 0
        ? Math.round(subs.reduce((acc, s) => acc + Number(s.latestScore || 0), 0) / subs.length)
        : Number(stu.averageScore || 0)

    const stuAttempts = quizAttempts.filter((a) => a.studentId === stu.id)
    const quizAvg =
      stuAttempts.length > 0
        ? Math.round(
            stuAttempts.reduce((acc, a) => acc + Number(a.percentage || 0), 0) / stuAttempts.length,
          )
        : null
    const meritTotal = merits
      .filter((m) => m.studentId === stu.id && m.type === 'merit')
      .reduce((acc, m) => acc + Number(m.points || 0), 0)

    const points =
      avg * 10 +
      (quizAvg !== null ? Math.round(quizAvg * 1.5) : 0) +
      meritTotal * 3 +
      Math.round(Number(stu.attendanceRate || 0) * 0.5)

    const key = normalizeClassToken(`${stu.className} ${stu.section}`)
    const list = byCohort.get(key) || []
    list.push({ id: stu.id, points, avg })
    byCohort.set(key, list)
  }

  const rankById = new Map<string, number>()
  for (const list of byCohort.values()) {
    list.sort((a, b) => b.points - a.points || b.avg - a.avg)
    list.forEach((item, idx) => rankById.set(item.id, idx + 1))
  }

  return students.map((stu) => {
    const rankNum = rankById.get(stu.id) || 1
    const secShort = stu.section.replace(/section\s*/i, '').trim()
    return {
      ...stu,
      rank: `#${rankNum} in ${stu.className}${secShort}`,
    }
  })
}

export async function GET() {
  try {
    const auth = await requireAuthSession(['teacher', 'admin'])
    if (!auth.ok) return auth.response
    const { session } = auth

    const persisted = loadPersistedState()
    const data = persisted.exists && persisted.data ? persisted.data : {}
    const students: ServerStudentRow[] = Array.isArray(data.students)
      ? (data.students as ServerStudentRow[])
      : []
    const teachers: ServerTeacherRow[] = Array.isArray(data.teachers)
      ? (data.teachers as ServerTeacherRow[])
      : []

    if (session.role === 'admin') {
      const allowedClasses = Array.from(
        new Set(students.map((s) => `${s.className} · ${s.section}`)),
      ).sort()
      return NextResponse.json({
        ok: true,
        role: 'admin',
        assignedClasses: ['ALL'],
        allowedClasses,
        students,
        stateVersion: persisted.version,
      })
    }

    const activeTeacher = teachers.find((t) => t.id === session.linked_entity_id) || null
    const assignedClasses = activeTeacher?.assignedClasses || []
    const scopedStudents = students.filter((s) =>
      studentMatchesAssignedClasses(s, assignedClasses),
    )
    const allowedClasses = Array.from(
      new Set(scopedStudents.map((s) => `${s.className} · ${s.section}`)),
    ).sort()

    return NextResponse.json({
      ok: true,
      role: 'teacher',
      assignedClasses,
      allowedClasses,
      students: scopedStudents,
      stateVersion: persisted.version,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to load gradebook.' },
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

    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || 'publish_scores')

    const persisted = loadPersistedState()
    if (!persisted.exists || !persisted.data || !Array.isArray(persisted.data.students)) {
      return NextResponse.json(
        { ok: false, error: 'School roster is not initialized in SQLite.' },
        { status: 400 },
      )
    }

    const currentData = persisted.data
    const students = currentData.students as ServerStudentRow[]
    const teachers: ServerTeacherRow[] = Array.isArray(currentData.teachers)
      ? (currentData.teachers as ServerTeacherRow[])
      : []
    const quizAttempts: ServerQuizAttemptRow[] = Array.isArray(currentData.quizAttempts)
      ? (currentData.quizAttempts as ServerQuizAttemptRow[])
      : []
    const merits: ServerMeritRow[] = Array.isArray(currentData.merits)
      ? (currentData.merits as ServerMeritRow[])
      : []

    const activeTeacher =
      session.role === 'teacher'
        ? teachers.find((t) => t.id === session.linked_entity_id) || null
        : null

    if (session.role === 'teacher' && (!activeTeacher || activeTeacher.status === 'suspended')) {
      return NextResponse.json(
        { ok: false, error: 'Active faculty profile not found or suspended.' },
        { status: 403 },
      )
    }
    const assignedClasses = activeTeacher?.assignedClasses || []
    const actorName = activeTeacher?.name || session.display_name

    // ==================== 1. PUBLISH SINGLE OR BATCH MARKS ====================
    if (action === 'publish_scores') {
      const rawEntries = Array.isArray(body.entries) ? body.entries : []
      const assessmentLabel = String(body.assessmentLabel || 'Term Assessment').trim()

      if (rawEntries.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'At least one score entry is required.' },
          { status: 400 },
        )
      }
      if (rawEntries.length > 200) {
        return NextResponse.json(
          { ok: false, error: 'Maximum 200 mark updates per batch.' },
          { status: 400 },
        )
      }

      type ValidatedUpdate = {
        studentId: string
        subjectId?: string
        subjectName?: string
        score: number
        progress?: number
        nextTopic?: string
      }

      const validated: ValidatedUpdate[] = []

      for (let i = 0; i < rawEntries.length; i++) {
        const entry = rawEntries[i] as Record<string, unknown>
        const studentId = String(entry?.studentId || '').trim()
        const subjectId = typeof entry?.subjectId === 'string' ? entry.subjectId.trim() : undefined
        const subjectName =
          typeof entry?.subjectName === 'string' ? entry.subjectName.trim() : undefined
        const rawScore = Number(entry?.score)

        if (!studentId || (!subjectId && !subjectName)) {
          return NextResponse.json(
            { ok: false, error: `Entry #${i + 1} is missing studentId or subject.` },
            { status: 400 },
          )
        }
        if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > 100) {
          return NextResponse.json(
            { ok: false, error: `Entry #${i + 1} score must be a number between 0 and 100.` },
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
            action: 'gradebook_unauthorized_class_blocked',
            target: `${actorName} attempted to edit marks for ${student.name} (${student.className} · ${student.section}) — assigned only to [${assignedClasses.join(', ')}]`,
            actor: actorName,
            actorRole: 'teacher',
            ipAddress: ip,
          })
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: You are not assigned to ${student.className} · ${student.section} (${student.name}). Teachers can only publish marks for their assigned classes (${assignedClasses.join(', ') || 'None'}).`,
            },
            { status: 403 },
          )
        }

        // Strict Subject-Teacher Ownership Check: one teacher CANNOT edit another teacher's subject grade!
        if (session.role === 'teacher') {
          const owner = findSubjectOwner(students, student, subjectId, subjectName)
          if (owner && owner.teacherName.toLowerCase() !== actorName.trim().toLowerCase()) {
            appendSecurityAudit({
              action: 'gradebook_other_teacher_subject_blocked',
              target: `${actorName} attempted to modify ${student.name}’s "${owner.subjectName}" grade owned by ${owner.teacherName}`,
              actor: actorName,
              actorRole: 'teacher',
              ipAddress: ip,
            })
            return NextResponse.json(
              {
                ok: false,
                error: `Access Denied: "${owner.subjectName}" is taught by ${owner.teacherName}. You (${actorName}) cannot modify another teacher’s subject grades.`,
              },
              { status: 403 },
            )
          }
        }

        const rawProgress =
          entry?.progress !== undefined && entry?.progress !== null && entry?.progress !== ''
            ? Number(entry.progress)
            : undefined
        const progress =
          rawProgress !== undefined && Number.isFinite(rawProgress)
            ? Math.max(0, Math.min(100, Math.round(rawProgress)))
            : undefined
        const nextTopic =
          typeof entry?.nextTopic === 'string' && entry.nextTopic.trim()
            ? entry.nextTopic.trim()
            : undefined

        validated.push({
          studentId,
          subjectId,
          subjectName,
          score: Math.round(rawScore),
          progress,
          nextTopic,
        })
      }

      const updatesByStudent = new Map<string, ValidatedUpdate[]>()
      for (const u of validated) {
        const list = updatesByStudent.get(u.studentId) || []
        list.push(u)
        updatesByStudent.set(u.studentId, list)
      }

      let updatedCount = 0
      const touchedSummaries: string[] = []

      const updatedStudentsBase = students.map((stu) => {
        const stuUpdates = updatesByStudent.get(stu.id)
        if (!stuUpdates || stuUpdates.length === 0) return stu

        let nextSubjects = [...(stu.subjects || [])]

        for (const u of stuUpdates) {
          const matchIdx = nextSubjects.findIndex(
            (sub) =>
              (u.subjectId && sub.id === u.subjectId) ||
              (u.subjectName && sub.name.toLowerCase() === u.subjectName.toLowerCase()),
          )

          if (matchIdx >= 0) {
            const existingSub = nextSubjects[matchIdx]
            const prevScore =
              existingSub.latestScore !== u.score
                ? existingSub.latestScore
                : existingSub.previousScore
            nextSubjects[matchIdx] = {
              ...existingSub,
              previousScore: prevScore,
              latestScore: u.score,
              grade: scoreToGrade(u.score),
              progress: u.progress !== undefined ? u.progress : existingSub.progress,
              nextTopic: u.nextTopic !== undefined ? u.nextTopic : existingSub.nextTopic,
            }
            updatedCount += 1
            touchedSummaries.push(`${stu.name} (${existingSub.name}: ${u.score}%)`)
          } else if (u.subjectName) {
            // Auto-create subject entry if grading a class subject not yet listed on this student
            nextSubjects.push({
              id: `sub-${stu.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              name: u.subjectName,
              teacher: actorName,
              section: stu.section,
              progress: u.progress ?? 75,
              latestScore: u.score,
              previousScore: u.score,
              grade: scoreToGrade(u.score),
              color: pickColorForSubject(u.subjectName),
              nextTopic: u.nextTopic || 'Term Revision',
            })
            updatedCount += 1
            touchedSummaries.push(`${stu.name} (${u.subjectName}: ${u.score}%)`)
          }
        }

        const avg =
          nextSubjects.length > 0
            ? Math.round(
                nextSubjects.reduce((acc, sub) => acc + Number(sub.latestScore || 0), 0) /
                  nextSubjects.length,
              )
            : stu.averageScore

        return {
          ...stu,
          subjects: nextSubjects,
          averageScore: avg,
          gpa: calcGpa(avg),
        }
      })

      const nextStudents = recalculateCohortRanks(updatedStudentsBase, quizAttempts, merits)
      const saved = savePersistedState(
        {
          ...currentData,
          students: nextStudents,
        },
        actorName,
      )

      appendSecurityAudit({
        action: 'gradebook_marks_published',
        target: `${assessmentLabel}: updated ${updatedCount} score(s) — ${touchedSummaries.slice(0, 4).join(', ')}${touchedSummaries.length > 4 ? ` +${touchedSummaries.length - 4} more` : ''}`,
        actor: actorName,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: actorName,
      })

      return NextResponse.json({
        ok: true,
        updatedCount,
        students: nextStudents,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    // ==================== 2. ADD SUBJECT TO STUDENT OR CLASS SECTION ====================
    if (action === 'add_subject') {
      const subjectName = String(body.subjectName || '').trim()
      const teacherName = String(body.teacherName || actorName).trim()
      const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
      const classSection = typeof body.classSection === 'string' ? body.classSection.trim() : ''
      const initialScore = Math.max(0, Math.min(100, Math.round(Number(body.initialScore) || 80)))
      const nextTopic = String(body.nextTopic || 'Chapter 1 Introduction').trim()

      if (!subjectName || (!studentId && !classSection)) {
        return NextResponse.json(
          { ok: false, error: 'Subject name and either studentId or classSection are required.' },
          { status: 400 },
        )
      }

      const targetStudents = students.filter((s) => {
        if (studentId) return s.id === studentId
        return (
          normalizeClassToken(`${s.className} ${s.section}`) === normalizeClassToken(classSection)
        )
      })

      if (targetStudents.length === 0) {
        return NextResponse.json({ ok: false, error: 'No matching students found.' }, { status: 404 })
      }

      if (session.role === 'teacher') {
        const unauthorized = targetStudents.find(
          (s) => !studentMatchesAssignedClasses(s, assignedClasses),
        )
        if (unauthorized) {
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: You are not assigned to ${unauthorized.className} · ${unauthorized.section}.`,
            },
            { status: 403 },
          )
        }
        for (const s of targetStudents) {
          const owner = findSubjectOwner(students, s, undefined, subjectName)
          if (owner && owner.teacherName.toLowerCase() !== actorName.trim().toLowerCase()) {
            appendSecurityAudit({
              action: 'gradebook_other_teacher_subject_blocked',
              target: `${actorName} attempted to add "${subjectName}" owned by ${owner.teacherName}`,
              actor: actorName,
              actorRole: 'teacher',
              ipAddress: ip,
            })
            return NextResponse.json(
              {
                ok: false,
                error: `Access Denied: "${owner.subjectName}" is already taught by ${owner.teacherName} in ${s.className} · ${s.section}.`,
              },
              { status: 403 },
            )
          }
        }
      }

      const targetIdSet = new Set(targetStudents.map((s) => s.id))
      let addedCount = 0

      const updatedBase = students.map((stu) => {
        if (!targetIdSet.has(stu.id)) return stu
        const alreadyHas = (stu.subjects || []).some(
          (sub) => sub.name.toLowerCase() === subjectName.toLowerCase(),
        )
        if (alreadyHas) return stu
        addedCount += 1
        const nextSubjects: ServerSubjectRow[] = [
          ...(stu.subjects || []),
          {
            id: `sub-${stu.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            name: subjectName,
            teacher: teacherName,
            section: stu.section,
            progress: 65,
            latestScore: initialScore,
            previousScore: initialScore,
            grade: scoreToGrade(initialScore),
            color: pickColorForSubject(subjectName),
            nextTopic,
          },
        ]
        const avg = Math.round(
          nextSubjects.reduce((acc, sub) => acc + Number(sub.latestScore || 0), 0) /
            nextSubjects.length,
        )
        return {
          ...stu,
          subjects: nextSubjects,
          averageScore: avg,
          gpa: calcGpa(avg),
        }
      })

      const nextStudents = recalculateCohortRanks(updatedBase, quizAttempts, merits)
      const saved = savePersistedState(
        {
          ...currentData,
          students: nextStudents,
        },
        actorName,
      )

      appendSecurityAudit({
        action: 'gradebook_subject_added',
        target: `Added "${subjectName}" (${teacherName}) to ${addedCount} student(s)`,
        actor: actorName,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: actorName,
      })

      return NextResponse.json({
        ok: true,
        addedCount,
        students: nextStudents,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    // ==================== 3. UPLOAD EXAM SHEET FOR GUARDIAN REVIEW (FROM GRADEBOOK) ====================
    if (action === 'upload_exam_sheet') {
      const studentId = String(body.studentId || '').trim()
      const subject = String(body.subject || '').trim()
      const subjectId = typeof body.subjectId === 'string' ? body.subjectId.trim() : undefined
      const examTitle = String(body.examTitle || '').trim() || `${subject} Graded Exam Script`
      const marksObtained = Math.max(0, Math.round(Number(body.marksObtained) || 0))
      const totalMarks = Math.max(1, Math.round(Number(body.totalMarks) || 100))
      const captureMethodRaw = String(body.captureMethod || 'Upload')
      const captureMethod =
        captureMethodRaw === 'Scan' || captureMethodRaw === 'Camera' ? captureMethodRaw : 'Upload'
      const scanEnhanced = Boolean(body.scanEnhanced)
      const fileType = body.fileType === 'pdf' ? 'pdf' : 'image'
      const fileDataUrl = String(body.fileDataUrl || '').trim()
      const teacherRemarks =
        String(body.teacherRemarks || '').trim() ||
        'Graded exam sheet uploaded from Gradebook for Guardian review.'
      const syncToGradebook = Boolean(body.syncToGradebook)

      if (!studentId || !subject || !fileDataUrl) {
        return NextResponse.json(
          { ok: false, error: 'Student, subject, and uploaded exam sheet file are required.' },
          { status: 400 },
        )
      }
      if (marksObtained > totalMarks) {
        return NextResponse.json(
          { ok: false, error: 'Marks obtained cannot exceed total marks.' },
          { status: 400 },
        )
      }

      const student = students.find((s) => s.id === studentId)
      if (!student) {
        return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
      }

      if (session.role === 'teacher') {
        if (!studentMatchesAssignedClasses(student, assignedClasses)) {
          appendSecurityAudit({
            action: 'gradebook_unauthorized_class_blocked',
            target: `${actorName} attempted to upload exam sheet for ${student.name} (${student.className} · ${student.section})`,
            actor: actorName,
            actorRole: 'teacher',
            ipAddress: ip,
          })
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: You are not assigned to ${student.className} · ${student.section} (${student.name}).`,
            },
            { status: 403 },
          )
        }

        const owner = findSubjectOwner(students, student, subjectId, subject)
        if (owner && owner.teacherName.toLowerCase() !== actorName.trim().toLowerCase()) {
          appendSecurityAudit({
            action: 'gradebook_other_teacher_subject_blocked',
            target: `${actorName} attempted to upload exam sheet for "${owner.subjectName}" owned by ${owner.teacherName}`,
            actor: actorName,
            actorRole: 'teacher',
            ipAddress: ip,
          })
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: "${owner.subjectName}" is taught by ${owner.teacherName}. You can only upload exam sheets for subjects you teach.`,
            },
            { status: 403 },
          )
        }
      }

      const existingSheets: Array<Record<string, unknown>> = Array.isArray(currentData.examSheets)
        ? (currentData.examSheets as Array<Record<string, unknown>>)
        : []

      const newSheet = {
        id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: student.id,
        studentName: student.name,
        className: `${student.className} · ${student.section}`,
        subject,
        examTitle,
        marksObtained,
        totalMarks,
        captureMethod,
        scanEnhanced,
        fileType,
        fileDataUrl,
        teacherName: actorName,
        teacherRemarks,
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Today',
        guardianReviewed: false,
        recheckRequested: false,
        adminVerified: session.role === 'admin',
      }

      const nextExamSheets = [newSheet, ...existingSheets]
      let nextStudents = students

      if (syncToGradebook) {
        const pct = Math.max(0, Math.min(100, Math.round((marksObtained / totalMarks) * 100)))
        const updatedBase = students.map((stu) => {
          if (stu.id !== student.id) return stu
          const subs = [...(stu.subjects || [])]
          const matchIdx = subs.findIndex(
            (sub) =>
              (subjectId && sub.id === subjectId) ||
              sub.name.toLowerCase() === subject.toLowerCase(),
          )
          if (matchIdx >= 0) {
            const cur = subs[matchIdx]
            subs[matchIdx] = {
              ...cur,
              previousScore: cur.latestScore !== pct ? cur.latestScore : cur.previousScore,
              latestScore: pct,
              grade: scoreToGrade(pct),
            }
          } else {
            subs.push({
              id: `sub-${stu.id}-${Date.now()}`,
              name: subject,
              teacher: actorName,
              section: stu.section,
              progress: 85,
              latestScore: pct,
              previousScore: pct,
              grade: scoreToGrade(pct),
              color: pickColorForSubject(subject),
              nextTopic: 'Post-Exam Review',
            })
          }
          const avg = Math.round(
            subs.reduce((sum, item) => sum + Number(item.latestScore || 0), 0) /
              Math.max(1, subs.length),
          )
          return {
            ...stu,
            subjects: subs,
            averageScore: avg,
            gpa: calcGpa(avg),
          }
        })
        nextStudents = recalculateCohortRanks(updatedBase, quizAttempts, merits)
      }

      const saved = savePersistedState(
        {
          ...currentData,
          examSheets: nextExamSheets,
          students: nextStudents,
        },
        actorName,
      )

      appendSecurityAudit({
        action: 'gradebook_exam_sheet_uploaded',
        target: `${actorName} uploaded ${examTitle} for ${student.name} (${subject} · ${marksObtained}/${totalMarks}) for Guardian review`,
        actor: actorName,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: actorName,
      })

      return NextResponse.json({
        ok: true,
        sheet: newSheet,
        examSheets: nextExamSheets,
        students: nextStudents,
        version: saved.version,
        updatedAt: saved.updatedAt,
      })
    }

    return NextResponse.json({ ok: false, error: `Unsupported action "${action}".` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Gradebook update failed.' },
      { status: 500 },
    )
  }
}
