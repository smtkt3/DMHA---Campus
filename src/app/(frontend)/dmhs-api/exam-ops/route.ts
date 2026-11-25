import { NextResponse } from 'next/server'
import { appendSecurityAudit, loadPersistedState, savePersistedState } from '@/lib/dmhs-db'
import { computeExamTabulation, evaluateGrade, initialExamBook } from '@/lib/dmhs-exams'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'
import type {
  AnswerScriptDispatch,
  DeclaredExamItem,
  ExamAttendanceRecord,
  ExamBookState,
  ExamCommitteeMember,
  ExamGradeRule,
  ExamInvigilatorAssignment,
  ExamLifecycleStatus,
  ExamMarkEntryRecord,
  ExamRoomConfig,
  ExamSeatAllocation,
  QuestionPaperDispatch,
  StudentRecord,
  TeacherRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function loadExamBook(currentData: Record<string, unknown>): ExamBookState {
  const raw = currentData.examBook as Partial<ExamBookState> | undefined
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.declaredExams)) {
    return structuredClone(initialExamBook)
  }
  return {
    declaredExams: raw.declaredExams,
    examAttendance: Array.isArray(raw.examAttendance)
      ? raw.examAttendance
      : initialExamBook.examAttendance,
    examMarks: Array.isArray(raw.examMarks) ? raw.examMarks : initialExamBook.examMarks,
    examRooms: Array.isArray(raw.examRooms) ? raw.examRooms : initialExamBook.examRooms,
    seatAllocations: Array.isArray(raw.seatAllocations)
      ? raw.seatAllocations
      : initialExamBook.seatAllocations,
    committee: Array.isArray(raw.committee) ? raw.committee : initialExamBook.committee,
    invigilators: Array.isArray(raw.invigilators) ? raw.invigilators : initialExamBook.invigilators,
    questionPapers: Array.isArray(raw.questionPapers)
      ? raw.questionPapers
      : initialExamBook.questionPapers,
    answerScripts: Array.isArray(raw.answerScripts)
      ? raw.answerScripts
      : initialExamBook.answerScripts,
    settings:
      raw.settings && typeof raw.settings === 'object'
        ? { ...initialExamBook.settings, ...raw.settings }
        : initialExamBook.settings,
  }
}

function normClass(v: string): string {
  return String(v || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function syncExamMarksToStudents(
  students: StudentRecord[],
  book: ExamBookState,
  examId: string,
): { nextStudents: StudentRecord[]; syncedCount: number } {
  const examMarks = book.examMarks.filter((m) => m.examId === examId)
  if (examMarks.length === 0) return { nextStudents: students, syncedCount: 0 }

  const tab = computeExamTabulation(book, examId, 'All', 'All')
  const rowByStudent = new Map(tab.rows.map((r) => [r.studentId, r]))
  const marksByStudent = new Map<string, ExamMarkEntryRecord[]>()
  for (const m of examMarks) {
    const arr = marksByStudent.get(m.studentId) || []
    arr.push(m)
    marksByStudent.set(m.studentId, arr)
  }

  let syncedCount = 0
  const nextStudents = students.map((stu) => {
    const stuMarks = marksByStudent.get(stu.id)
    const tabRow = rowByStudent.get(stu.id)
    if (!stuMarks || stuMarks.length === 0) return stu
    syncedCount += 1

    const updatedSubjects = [...stu.subjects]
    for (const mk of stuMarks) {
      const idx = updatedSubjects.findIndex(
        (s) => s.name.toLowerCase() === mk.subject.toLowerCase(),
      )
      if (idx >= 0) {
        const prevSub = updatedSubjects[idx]
        updatedSubjects[idx] = {
          ...prevSub,
          previousScore: prevSub.latestScore,
          latestScore: mk.percentage,
          grade: mk.grade,
        }
      } else {
        updatedSubjects.push({
          id: `sub-exm-${mk.id}`,
          name: mk.subject,
          teacher: mk.submittedBy,
          section: `${stu.className} · ${stu.section}`,
          progress: mk.percentage,
          latestScore: mk.percentage,
          previousScore: mk.percentage,
          grade: mk.grade,
          color: 'cyan',
          nextTopic: 'Next Term Unit',
        })
      }
    }

    const avgFromSubjects =
      updatedSubjects.length > 0
        ? Math.round(
            updatedSubjects.reduce((sum, s) => sum + s.latestScore, 0) / updatedSubjects.length,
          )
        : tabRow?.averagePercent ?? stu.averageScore

    const avgGpa =
      tabRow !== undefined
        ? tabRow.gpa.toFixed(2)
        : updatedSubjects.length > 0
          ? (
              updatedSubjects.reduce(
                (sum, s) =>
                  sum +
                  evaluateGrade(
                    s.latestScore,
                    book.settings.gradingScale,
                    book.settings.passPercent,
                  ).gpa,
                0,
              ) / updatedSubjects.length
            ).toFixed(2)
          : stu.gpa

    return {
      ...stu,
      subjects: updatedSubjects,
      averageScore: tabRow?.averagePercent ?? avgFromSubjects,
      gpa: avgGpa,
      rank: tabRow ? `#${tabRow.meritRank} in ${stu.className}` : stu.rank,
    }
  })

  return { nextStudents, syncedCount }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth

    if (
      session.role === 'staff' &&
      !staffHasServerPermission(session.linked_entity_id, 'timetable')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Access Denied: Timetable & Examination permission required.' },
        { status: 403 },
      )
    }

    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    const teacherAllowedActions = new Set(['save_exam_attendance', 'save_marks'])
    if (session.role === 'teacher' && !teacherAllowedActions.has(action)) {
      return NextResponse.json(
        { ok: false, error: 'Only Examination Admin can perform this action.' },
        { status: 403 },
      )
    }

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const book = loadExamBook(currentData)
    const students: StudentRecord[] = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const teachers: TeacherRecord[] = Array.isArray(currentData.teachers)
      ? (currentData.teachers as TeacherRecord[])
      : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []
    const todayIso = new Date().toISOString().slice(0, 10)

    const saveBook = (
      nextBook: ExamBookState,
      summary: string,
      auditAction: string,
      auditTarget: string,
      extraData: Record<string, unknown> = {},
    ) => {
      const saved = savePersistedState(
        { ...currentData, examBook: nextBook, ...extraData },
        session.display_name,
      )
      appendSecurityAudit({
        action: auditAction,
        target: auditTarget,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary,
      })
      return NextResponse.json({
        ok: true,
        examBook: nextBook,
        ...extraData,
        version: saved.version,
      })
    }

    // ==================== 1. EXAM DECLARE & LIFECYCLE ====================
    if (action === 'declare_exam') {
      const title = String(body.title || '').trim().slice(0, 140)
      const termName = String(body.termName || 'Winter Term 2026').trim()
      const startDateIso = String(body.startDateIso || todayIso)
      const endDateIso = String(body.endDateIso || startDateIso)
      const targetClasses = Array.isArray(body.targetClasses)
        ? (body.targetClasses as string[]).filter(Boolean)
        : ['Class 6 · Section A', 'Class 5 · Section B']
      const maxWritten = Math.max(0, Math.round(Number(body.maxWritten ?? book.settings.defaultMaxWritten)))
      const maxMcq = Math.max(0, Math.round(Number(body.maxMcq ?? book.settings.defaultMaxMcq)))
      const maxPractical = Math.max(0, Math.round(Number(body.maxPractical ?? book.settings.defaultMaxPractical)))
      const passPercent = Math.max(1, Math.min(100, Math.round(Number(body.passPercent ?? book.settings.passPercent))))
      const status = (body.status as ExamLifecycleStatus) || 'declared'
      if (!title || maxWritten + maxMcq + maxPractical <= 0) {
        return NextResponse.json(
          { ok: false, error: 'Exam title and positive total marks are required.' },
          { status: 400 },
        )
      }
      const newExam: DeclaredExamItem = {
        id: `exm-${Date.now()}`,
        code: `EXM-2026-${String(book.declaredExams.length + 10).padStart(2, '0')}`,
        title,
        termName,
        academicYear: String(body.academicYear || '2026'),
        targetClasses,
        startDateIso,
        endDateIso,
        status,
        maxWritten,
        maxMcq,
        maxPractical,
        passPercent,
        instructions: String(body.instructions || book.settings.admitCardInstructions).trim().slice(0, 500),
        declaredBy: session.display_name,
        declaredAt: todayIso,
      }
      const notif = {
        id: `notif-exm-${Date.now()}`,
        title: `Examination Declared · ${title}`,
        text: `${title} (${startDateIso} to ${endDateIso}) declared for ${targetClasses.join(', ')}.`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['admin', 'teacher', 'guardian', 'student'],
        read: false,
      }
      return saveBook(
        { ...book, declaredExams: [newExam, ...book.declaredExams] },
        `Declared exam: ${title}`,
        'exam_declared',
        `${newExam.code} · ${title}`,
        { notifications: [notif, ...existingNotifs].slice(0, 80) },
      )
    }

    if (action === 'update_exam_status') {
      const examId = String(body.examId || '')
      const status = body.status as ExamLifecycleStatus
      if (!['draft', 'declared', 'marks_locked', 'published'].includes(status)) {
        return NextResponse.json({ ok: false, error: 'Invalid exam lifecycle status.' }, { status: 400 })
      }
      const target = book.declaredExams.find((e) => e.id === examId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Declared exam not found.' }, { status: 404 })
      }
      const nextExams = book.declaredExams.map((e) => (e.id === examId ? { ...e, status } : e))
      const extra: Record<string, unknown> = {}
      let syncedCount = 0
      if (status === 'published') {
        const synced = syncExamMarksToStudents(students, book, examId)
        syncedCount = synced.syncedCount
        if (synced.syncedCount > 0) {
          extra.students = synced.nextStudents
        }
        extra.notifications = [
          {
            id: `notif-exm-pub-${Date.now()}`,
            title: `Results Published · ${target.title}`,
            text: `Official results, GPA 5.0 grades, and Report Cards for ${target.title} are now live (${syncedCount} students synced).`,
            time: 'Just now',
            type: 'result',
            forRoles: ['admin', 'teacher', 'guardian', 'student'],
            read: false,
          },
          ...existingNotifs,
        ].slice(0, 80)
      }
      return saveBook(
        { ...book, declaredExams: nextExams },
        `${target.title} status → ${status}${syncedCount > 0 ? ` (${syncedCount} report cards synced)` : ''}`,
        'exam_status_updated',
        `${target.code} -> ${status}`,
        extra,
      )
    }

    if (action === 'sync_results_to_report_cards') {
      const examId = String(body.examId || '')
      const target = book.declaredExams.find((e) => e.id === examId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Declared exam not found.' }, { status: 404 })
      }
      const { nextStudents, syncedCount } = syncExamMarksToStudents(students, book, examId)
      if (syncedCount === 0) {
        return NextResponse.json(
          { ok: false, error: 'No marks entered for this exam yet to sync.' },
          { status: 400 },
        )
      }
      const nextExams = book.declaredExams.map((e) =>
        e.id === examId ? { ...e, status: 'published' as ExamLifecycleStatus } : e,
      )
      return saveBook(
        { ...book, declaredExams: nextExams },
        `Synced ${syncedCount} students’ marks & GPA 5.0 from ${target.title} to Gradebook & Report Cards!`,
        'exam_results_synced_to_report_cards',
        `${target.code} (${syncedCount} students)`,
        {
          students: nextStudents,
          notifications: [
            {
              id: `notif-exm-sync-${Date.now()}`,
              title: `Report Cards Updated · ${target.title}`,
              text: `Exam marks, GPA 5.0 grades, and merit ranks for ${target.title} are now synced to official Report Cards & Gradebook.`,
              time: 'Just now',
              type: 'result',
              forRoles: ['admin', 'teacher', 'guardian', 'student'],
              read: false,
            },
            ...existingNotifs,
          ].slice(0, 80),
        },
      )
    }

    if (action === 'delete_exam') {
      const examId = String(body.examId || '')
      return saveBook(
        {
          ...book,
          declaredExams: book.declaredExams.filter((e) => e.id !== examId),
          examAttendance: book.examAttendance.filter((a) => a.examId !== examId),
          examMarks: book.examMarks.filter((m) => m.examId !== examId),
          seatAllocations: book.seatAllocations.filter((s) => s.examId !== examId),
          committee: book.committee.filter((c) => c.examId !== examId),
          invigilators: book.invigilators.filter((i) => i.examId !== examId),
        },
        'Declared exam deleted',
        'exam_deleted',
        examId,
      )
    }

    // ==================== 2. EXAM ATTENDANCE ====================
    if (action === 'save_exam_attendance') {
      const examId = String(body.examId || '')
      const classLabel = String(body.classLabel || '')
      const subject = String(body.subject || '')
      const dateIso = String(body.dateIso || todayIso)
      const entries = Array.isArray(body.entries)
        ? (body.entries as Array<{ studentId: string; status: ExamAttendanceRecord['status'] }>)
        : []
      if (!examId || !classLabel || !subject || entries.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Exam, class, subject, and attendance entries are required.' },
          { status: 400 },
        )
      }
      if (session.role === 'teacher') {
        const tch = teachers.find((t) => t.id === session.linked_entity_id)
        const allowedTokens = (tch?.assignedClasses || []).map(normClass)
        const targetTok = normClass(classLabel)
        if (!allowedTokens.some((tok) => tok === targetTok || targetTok.startsWith(tok))) {
          return NextResponse.json(
            { ok: false, error: 'Access Denied: You can only mark exam attendance for your assigned classes.' },
            { status: 403 },
          )
        }
      }

      const incomingIds = new Set(entries.map((e) => e.studentId))
      const preserved = book.examAttendance.filter(
        (a) =>
          !(
            a.examId === examId &&
            a.classLabel === classLabel &&
            a.subject === subject &&
            a.dateIso === dateIso &&
            incomingIds.has(a.studentId)
          ),
      )

      const created: ExamAttendanceRecord[] = entries.map((e, idx) => {
        const stu = students.find((s) => s.id === e.studentId)
        const seat = book.seatAllocations.find(
          (sa) => sa.examId === examId && sa.studentId === e.studentId,
        )
        return {
          id: `eatt-${Date.now()}-${idx}`,
          examId,
          classLabel,
          subject,
          dateIso,
          studentId: e.studentId,
          studentName: stu?.name || e.studentId,
          roll: stu?.roll || '—',
          status: e.status,
          seatLabel: seat ? `${seat.roomName} · ${seat.benchLabel}-S${seat.seatNo}` : undefined,
          markedBy: session.display_name,
          markedAt: todayIso,
        }
      })

      return saveBook(
        { ...book, examAttendance: [...created, ...preserved] },
        `Saved Exam Attendance (${classLabel} · ${subject})`,
        'exam_attendance_saved',
        `${examId} · ${classLabel} · ${subject} (${created.length} students)`,
      )
    }

    // ==================== 3. EXAM MARKS ENTRY (ADMIN + TEACHER) ====================
    if (action === 'save_marks') {
      const examId = String(body.examId || '')
      const classLabel = String(body.classLabel || '')
      const subject = String(body.subject || '')
      const exam = book.declaredExams.find((e) => e.id === examId)
      const entries = Array.isArray(body.entries)
        ? (body.entries as Array<{
            studentId: string
            written: number
            mcq: number
            practical: number
            remarks?: string
          }>)
        : []

      if (!exam || !classLabel || !subject || entries.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Valid declared exam, class, subject, and marks rows are required.' },
          { status: 400 },
        )
      }

      if (session.role === 'teacher') {
        if (exam.status === 'marks_locked' || exam.status === 'published') {
          return NextResponse.json(
            { ok: false, error: `Marks are locked for ${exam.title}. Contact Exam Controller (Admin) to unlock.` },
            { status: 409 },
          )
        }
        const tch = teachers.find((t) => t.id === session.linked_entity_id)
        const allowedTokens = (tch?.assignedClasses || []).map(normClass)
        const targetTok = normClass(classLabel)
        if (!allowedTokens.some((tok) => tok === targetTok || targetTok.startsWith(tok))) {
          return NextResponse.json(
            { ok: false, error: 'Access Denied: Teachers can only submit marks for their assigned classes.' },
            { status: 403 },
          )
        }
      }

      const maxTotal = exam.maxWritten + exam.maxMcq + exam.maxPractical
      const built: ExamMarkEntryRecord[] = []
      for (const row of entries) {
        const w = Math.round(Number(row.written || 0))
        const m = Math.round(Number(row.mcq || 0))
        const p = Math.round(Number(row.practical || 0))
        if (w < 0 || w > exam.maxWritten || m < 0 || m > exam.maxMcq || p < 0 || p > exam.maxPractical) {
          return NextResponse.json(
            {
              ok: false,
              error: `Marks out of range! Limits for ${exam.title}: Written ≤ ${exam.maxWritten}, MCQ ≤ ${exam.maxMcq}, Practical ≤ ${exam.maxPractical}.`,
            },
            { status: 400 },
          )
        }
        const total = w + m + p
        const percentage = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0
        const graded = evaluateGrade(percentage, book.settings.gradingScale, exam.passPercent)
        const stu = students.find((s) => s.id === row.studentId)
        built.push({
          id: `emrk-${Date.now()}-${row.studentId}`,
          examId,
          classLabel,
          subject,
          studentId: row.studentId,
          studentName: stu?.name || row.studentId,
          roll: stu?.roll || '—',
          written: w,
          mcq: m,
          practical: p,
          total,
          maxTotal,
          percentage,
          grade: graded.grade,
          gpa: graded.gpa,
          passed: graded.passed,
          remarks: row.remarks ? String(row.remarks).trim().slice(0, 160) : undefined,
          submittedBy: session.display_name,
          submittedRole: session.role,
          verifiedByAdmin: session.role === 'admin',
          updatedAt: todayIso,
        })
      }

      const updatedIds = new Set(built.map((b) => b.studentId))
      const remaining = book.examMarks.filter(
        (m) =>
          !(
            m.examId === examId &&
            m.classLabel === classLabel &&
            m.subject === subject &&
            updatedIds.has(m.studentId)
          ),
      )

      return saveBook(
        { ...book, examMarks: [...built, ...remaining] },
        `Saved ${built.length} marks entries (${classLabel} · ${subject})`,
        'exam_marks_saved',
        `${exam.code} · ${classLabel} · ${subject} (${built.length} students)`,
      )
    }

    if (action === 'verify_marks_batch') {
      const examId = String(body.examId || '')
      const classLabel = String(body.classLabel || '')
      const subject = String(body.subject || '')
      const nextMarks = book.examMarks.map((m) =>
        m.examId === examId &&
        (!classLabel || classLabel === 'All' || m.classLabel === classLabel) &&
        (!subject || subject === 'All' || m.subject === subject)
          ? { ...m, verifiedByAdmin: true }
          : m,
      )
      return saveBook(
        { ...book, examMarks: nextMarks },
        'Teacher-submitted marks verified by Exam Controller!',
        'exam_marks_verified',
        `${examId} · ${classLabel || 'All'} · ${subject || 'All'}`,
      )
    }

    // ==================== 4. EXAM ROOMS & AUTO SEAT PLAN ====================
    if (action === 'save_room') {
      const roomName = String(body.roomName || '').trim().slice(0, 80)
      const campusUnit = String(body.campusUnit || 'Unit - 1')
      const rows = Math.max(1, Math.min(12, Math.round(Number(body.rows || 3))))
      const benchesPerRow = Math.max(1, Math.min(8, Math.round(Number(body.benchesPerRow || 3))))
      const seatsPerBench = Math.max(1, Math.min(3, Math.round(Number(body.seatsPerBench || 2))))
      if (!roomName) {
        return NextResponse.json({ ok: false, error: 'Room / Hall name is required.' }, { status: 400 })
      }
      const newRoom: ExamRoomConfig = {
        id: `rm-${Date.now()}`,
        roomName,
        campusUnit,
        rows,
        benchesPerRow,
        seatsPerBench,
        capacity: rows * benchesPerRow * seatsPerBench,
      }
      return saveBook(
        { ...book, examRooms: [...book.examRooms, newRoom] },
        `Added exam hall: ${roomName} (Capacity ${newRoom.capacity})`,
        'exam_room_added',
        `${roomName} (${newRoom.capacity} seats)`,
      )
    }

    if (action === 'delete_room') {
      const roomId = String(body.roomId || '')
      return saveBook(
        {
          ...book,
          examRooms: book.examRooms.filter((r) => r.id !== roomId),
          seatAllocations: book.seatAllocations.filter((s) => s.roomId !== roomId),
        },
        'Exam hall removed',
        'exam_room_deleted',
        roomId,
      )
    }

    if (action === 'generate_seat_plan') {
      const examId = String(body.examId || '')
      const interleave =
        typeof body.interleave === 'boolean'
          ? body.interleave
          : book.settings.mixedClassSeatInterleaving
      if (!examId || book.examRooms.length === 0) {
        return NextResponse.json({ ok: false, error: 'Select an exam and ensure at least one room exists.' }, { status: 400 })
      }

      const activeStudents = students.filter((s) => s.status !== 'suspended')
      let orderedStudents: StudentRecord[] = []
      if (interleave) {
        // Round-robin interleave across classes so classmates never sit on the same bench!
        const buckets = new Map<string, StudentRecord[]>()
        for (const stu of activeStudents) {
          const key = `${stu.className} · ${stu.section}`
          const arr = buckets.get(key) || []
          arr.push(stu)
          buckets.set(key, arr)
        }
        const queues = Array.from(buckets.values())
        let remaining = true
        while (remaining) {
          remaining = false
          for (const q of queues) {
            const next = q.shift()
            if (next) {
              orderedStudents.push(next)
              remaining = true
            }
          }
        }
      } else {
        orderedStudents = [...activeStudents].sort((a, b) =>
          `${a.className} ${a.section} ${a.roll}`.localeCompare(`${b.className} ${b.section} ${b.roll}`),
        )
      }

      const newAllocations: ExamSeatAllocation[] = []
      let stuIdx = 0
      for (const room of book.examRooms) {
        const totalBenches = room.rows * room.benchesPerRow
        for (let b = 1; b <= totalBenches && stuIdx < orderedStudents.length; b++) {
          for (let s = 1; s <= room.seatsPerBench && stuIdx < orderedStudents.length; s++) {
            const stu = orderedStudents[stuIdx++]
            newAllocations.push({
              id: `st-${Date.now()}-${stuIdx}`,
              examId,
              roomId: room.id,
              roomName: room.roomName,
              campusUnit: room.campusUnit,
              benchLabel: `B${b}`,
              seatNo: s,
              studentId: stu.id,
              studentName: stu.name,
              classLabel: `${stu.className} · ${stu.section}`,
              roll: stu.roll,
            })
          }
        }
      }

      const otherExamsSeats = book.seatAllocations.filter((s) => s.examId !== examId)
      return saveBook(
        { ...book, seatAllocations: [...newAllocations, ...otherExamsSeats] },
        `Auto-generated Seat Plan for ${newAllocations.length} students (${interleave ? 'Anti-Cheating Mixed-Class Interleaving' : 'Roll-Wise'})`,
        'exam_seat_plan_generated',
        `${examId} · ${newAllocations.length} seats`,
      )
    }

    // ==================== 5. EXAM COMMITTEE & INVIGILATORS ====================
    if (action === 'add_committee_member') {
      const examId = String(body.examId || '')
      const memberName = String(body.memberName || '').trim()
      const designation = String(body.designation || 'Faculty').trim()
      const committeeRole = body.committeeRole as ExamCommitteeMember['committeeRole']
      const campusUnit = String(body.campusUnit || 'Unit - 1')
      if (!examId || !memberName || !committeeRole) {
        return NextResponse.json({ ok: false, error: 'Exam, member name, and committee role required.' }, { status: 400 })
      }
      const member: ExamCommitteeMember = {
        id: `com-${Date.now()}`,
        examId,
        memberName,
        memberId: String(body.memberId || '').trim() || undefined,
        designation,
        committeeRole,
        campusUnit,
      }
      return saveBook(
        { ...book, committee: [member, ...book.committee] },
        `Added ${memberName} to Exam Committee (${committeeRole})`,
        'exam_committee_added',
        `${memberName} · ${committeeRole}`,
      )
    }

    if (action === 'delete_committee_member') {
      const id = String(body.id || '')
      return saveBook(
        { ...book, committee: book.committee.filter((c) => c.id !== id) },
        'Removed committee member',
        'exam_committee_removed',
        id,
      )
    }

    if (action === 'assign_invigilator') {
      const examId = String(body.examId || '')
      const dateIso = String(body.dateIso || todayIso)
      const shiftLabel = String(body.shiftLabel || 'Morning (09:00 AM – 11:00 AM)')
      const roomId = String(body.roomId || '')
      const room = book.examRooms.find((r) => r.id === roomId)
      const subject = String(body.subject || 'All Subjects').trim()
      const teacherId = String(body.teacherId || '')
      const teacher = teachers.find((t) => t.id === teacherId)
      const dutyRole = (body.dutyRole as ExamInvigilatorAssignment['dutyRole']) || 'Chief Invigilator'

      if (!examId || !room || !teacher) {
        return NextResponse.json({ ok: false, error: 'Exam, Room, and Teacher are required.' }, { status: 400 })
      }
      // Conflict Check: Prevent double-booking same teacher for same date + shift!
      const conflict = book.invigilators.find(
        (i) => i.teacherId === teacher.id && i.dateIso === dateIso && i.shiftLabel === shiftLabel,
      )
      if (conflict) {
        return NextResponse.json(
          {
            ok: false,
            error: `Invigilator Conflict: ${teacher.name} is already assigned to ${conflict.roomName} on ${dateIso} (${shiftLabel}).`,
          },
          { status: 409 },
        )
      }

      const item: ExamInvigilatorAssignment = {
        id: `inv-${Date.now()}`,
        examId,
        dateIso,
        shiftLabel,
        roomId: room.id,
        roomName: room.roomName,
        subject,
        teacherId: teacher.id,
        teacherName: teacher.name,
        dutyRole,
        status: 'assigned',
      }
      return saveBook(
        { ...book, invigilators: [item, ...book.invigilators] },
        `Assigned ${teacher.name} as ${dutyRole} (${room.roomName})`,
        'exam_invigilator_assigned',
        `${teacher.name} -> ${room.roomName} (${dateIso})`,
      )
    }

    if (action === 'update_invigilator_status') {
      const id = String(body.id || '')
      const status = body.status as ExamInvigilatorAssignment['status']
      return saveBook(
        {
          ...book,
          invigilators: book.invigilators.map((i) => (i.id === id ? { ...i, status } : i)),
        },
        `Invigilator status → ${status}`,
        'exam_invigilator_updated',
        `${id} -> ${status}`,
      )
    }

    if (action === 'delete_invigilator') {
      const id = String(body.id || '')
      return saveBook(
        { ...book, invigilators: book.invigilators.filter((i) => i.id !== id) },
        'Invigilator assignment removed',
        'exam_invigilator_deleted',
        id,
      )
    }

    // ==================== 6. QUESTION PAPER & ANSWER SCRIPT DISTRIBUTION ====================
    if (action === 'create_question_packet') {
      const examId = String(body.examId || '')
      const classLabel = String(body.classLabel || 'Class 6 · Section A')
      const subject = String(body.subject || '').trim()
      const roomName = String(body.roomName || book.examRooms[0]?.roomName || 'Hall 301')
      const copiesPrinted = Math.max(1, Math.round(Number(body.copiesPrinted || 25)))
      const handedTo = String(body.handedTo || 'Chief Invigilator').trim()
      const dateIso = String(body.dateIso || todayIso)
      if (!examId || !subject) {
        return NextResponse.json({ ok: false, error: 'Exam and Subject are required.' }, { status: 400 })
      }
      const pkt: QuestionPaperDispatch = {
        id: `qp-${Date.now()}`,
        packetCode: `QP-${dateIso.slice(5).replace('-', '')}-${subject.slice(0, 3).toUpperCase()}-${String(book.questionPapers.length + 1).padStart(2, '0')}`,
        examId,
        classLabel,
        subject,
        dateIso,
        roomName,
        copiesPrinted,
        sealedBy: session.display_name,
        handedTo,
        dispatchedAt: `${dateIso} 08:30 AM`,
        status: 'sealed',
      }
      return saveBook(
        { ...book, questionPapers: [pkt, ...book.questionPapers] },
        `Sealed Question Packet ${pkt.packetCode} (${copiesPrinted} copies)`,
        'exam_question_packet_created',
        `${pkt.packetCode} · ${subject} (${roomName})`,
      )
    }

    if (action === 'update_question_packet_status') {
      const id = String(body.id || '')
      const status = body.status as QuestionPaperDispatch['status']
      return saveBook(
        {
          ...book,
          questionPapers: book.questionPapers.map((q) => (q.id === id ? { ...q, status } : q)),
        },
        `Question packet marked ${status.replace('_', ' ')}`,
        'exam_question_packet_status',
        `${id} -> ${status}`,
      )
    }

    if (action === 'create_answer_bundle') {
      const examId = String(body.examId || '')
      const classLabel = String(body.classLabel || 'Class 6 · Section A')
      const subject = String(body.subject || '').trim()
      const scriptsCollected = Math.max(1, Math.round(Number(body.scriptsCollected || 1)))
      const examinerId = String(body.examinerId || teachers[0]?.id || '')
      const examiner = teachers.find((t) => t.id === examinerId)
      const deadlineIso = String(body.deadlineIso || todayIso)
      if (!examId || !subject || !examiner) {
        return NextResponse.json({ ok: false, error: 'Exam, Subject, and Examiner are required.' }, { status: 400 })
      }
      const bundle: AnswerScriptDispatch = {
        id: `as-${Date.now()}`,
        bundleCode: `ANS-${subject.slice(0, 3).toUpperCase()}-${String(book.answerScripts.length + 10).padStart(2, '0')}`,
        examId,
        classLabel,
        subject,
        scriptsCollected,
        examinerId: examiner.id,
        examinerName: examiner.name,
        handoverDateIso: todayIso,
        deadlineIso,
        scriptsChecked: 0,
        status: 'assigned_to_examiner',
      }
      return saveBook(
        { ...book, answerScripts: [bundle, ...book.answerScripts] },
        `Assigned ${scriptsCollected} answer scripts (${bundle.bundleCode}) to ${examiner.name}`,
        'exam_answer_bundle_created',
        `${bundle.bundleCode} -> ${examiner.name}`,
      )
    }

    if (action === 'update_answer_bundle') {
      const id = String(body.id || '')
      const status = body.status as AnswerScriptDispatch['status']
      const scriptsChecked = body.scriptsChecked !== undefined ? Math.max(0, Math.round(Number(body.scriptsChecked))) : undefined
      return saveBook(
        {
          ...book,
          answerScripts: book.answerScripts.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: status || a.status,
                  scriptsChecked:
                    scriptsChecked !== undefined
                      ? Math.min(a.scriptsCollected, scriptsChecked)
                      : status === 'returned_verified'
                        ? a.scriptsCollected
                        : a.scriptsChecked,
                }
              : a,
          ),
        },
        'Answer script bundle status updated',
        'exam_answer_bundle_updated',
        `${id} -> ${status}`,
      )
    }

    // ==================== 7. EXAMINATION SETTINGS ====================
    if (action === 'save_exam_settings') {
      const gradingScale = Array.isArray(body.gradingScale)
        ? (body.gradingScale as ExamGradeRule[])
        : book.settings.gradingScale
      const nextSettings = {
        gradingScale,
        defaultMaxWritten: Math.max(0, Math.round(Number(body.defaultMaxWritten ?? book.settings.defaultMaxWritten))),
        defaultMaxMcq: Math.max(0, Math.round(Number(body.defaultMaxMcq ?? book.settings.defaultMaxMcq))),
        defaultMaxPractical: Math.max(0, Math.round(Number(body.defaultMaxPractical ?? book.settings.defaultMaxPractical))),
        passPercent: Math.max(1, Math.min(100, Math.round(Number(body.passPercent ?? book.settings.passPercent)))),
        requireFeeClearanceForAdmit:
          typeof body.requireFeeClearanceForAdmit === 'boolean'
            ? body.requireFeeClearanceForAdmit
            : book.settings.requireFeeClearanceForAdmit,
        mixedClassSeatInterleaving:
          typeof body.mixedClassSeatInterleaving === 'boolean'
            ? body.mixedClassSeatInterleaving
            : book.settings.mixedClassSeatInterleaving,
        admitCardInstructions: String(
          body.admitCardInstructions ?? book.settings.admitCardInstructions,
        ).trim().slice(0, 600),
      }
      return saveBook(
        { ...book, settings: nextSettings },
        'Examination grading scale & settings saved!',
        'exam_settings_saved',
        `Pass ${nextSettings.passPercent}% · Max ${nextSettings.defaultMaxWritten}/${nextSettings.defaultMaxMcq}/${nextSettings.defaultMaxPractical}`,
      )
    }

    return NextResponse.json({ ok: false, error: `Unknown exam-ops action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Exam management operation failed.' },
      { status: 500 },
    )
  }
}
