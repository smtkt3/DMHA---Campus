import { NextResponse } from 'next/server'
import { appendSecurityAudit, loadPersistedState, savePersistedState } from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import type {
  AssignmentItem,
  GuardianRecord,
  HomeworkKind,
  HomeworkSubmissionMode,
  SchoolWeekday,
  StudentRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitizeUploadUrl(raw: unknown): string | undefined {
  const s = String(raw || '').trim()
  if (!s || (!s.startsWith('/uploads/') && !s.startsWith('/dmhs-api/uploads/')) || s.includes('..')) {
    return undefined
  }
  return s.slice(0, 260)
}

function getGuardianStudentIds(
  guardians: GuardianRecord[],
  students: StudentRecord[],
  guardianId: string,
): Set<string> {
  const g = guardians.find((x) => x.id === guardianId)
  const set = new Set<string>(g?.linkedStudentIds || [])
  students.filter((s) => s.guardianId === guardianId).forEach((s) => set.add(s.id))
  return set
}

function sameCohortTask(a: AssignmentItem, b: AssignmentItem): boolean {
  return (
    a.title === b.title &&
    a.subject === b.subject &&
    a.dueDate === b.dueDate &&
    (a.className || '') === (b.className || '')
  )
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'guardian', 'student'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const assignments: AssignmentItem[] = Array.isArray(currentData.assignments)
      ? (currentData.assignments as AssignmentItem[])
      : []
    const students: StudentRecord[] = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const guardians: GuardianRecord[] = Array.isArray(currentData.guardians)
      ? (currentData.guardians as GuardianRecord[])
      : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []

    const scopeAssignments = (list: AssignmentItem[]) => {
      if (session.role === 'student') {
        return list.filter((a) => a.studentId === session.linked_entity_id)
      }
      if (session.role === 'guardian') {
        const linked = getGuardianStudentIds(guardians, students, session.linked_entity_id)
        return list.filter((a) => linked.has(a.studentId))
      }
      return list
    }

    const commit = (
      nextAssignments: AssignmentItem[],
      summary: string,
      auditAction: string,
      auditTarget: string,
      notif?: Record<string, unknown>,
      extra?: Record<string, unknown>,
    ) => {
      const nextNotifs = notif ? [notif, ...existingNotifs].slice(0, 80) : existingNotifs
      const saved = savePersistedState(
        { ...currentData, assignments: nextAssignments, notifications: nextNotifs },
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
        assignments: scopeAssignments(nextAssignments),
        ...(notif ? { notifications: nextNotifs } : {}),
        ...(extra || {}),
        version: saved.version,
      })
    }

    // 1. Create Homework / Assignment (Admin or Teacher only)
    if (action === 'create_assignment') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers or Admin can assign homework.' },
          { status: 403 },
        )
      }
      const title = String(body.title || '').trim().slice(0, 180)
      const subject = String(body.subject || '').trim().slice(0, 80)
      const dueDate = String(body.dueDate || '').trim().slice(0, 60)
      const targetClass = String(body.targetClass || '').trim()
      const kind = (body.kind as HomeworkKind) || 'Daily Homework'
      const submissionMode: HomeworkSubmissionMode =
        body.submissionMode === 'online' || body.submissionMode === 'hybrid'
          ? body.submissionMode
          : 'offline'
      if (!title || !subject || !dueDate) {
        return NextResponse.json(
          { ok: false, error: 'Title, subject, and due date are required.' },
          { status: 400 },
        )
      }

      const matchedStudents = students.filter(
        (s) =>
          s.status !== 'suspended' &&
          (!targetClass ||
            s.className.toLowerCase() === targetClass.toLowerCase() ||
            `${s.className} ${s.section}`.toLowerCase().includes(targetClass.toLowerCase())),
      )
      const recipients = matchedStudents.length > 0 ? matchedStudents : students.slice(0, 1)
      const nowStamp = Date.now()
      const teacherName = String(body.teacher || session.display_name).trim() || session.display_name
      const howToSteps = Array.isArray(body.howToSteps)
        ? (body.howToSteps as unknown[]).map((s) => String(s).trim()).filter(Boolean)
        : undefined
      const whatToStudy = Array.isArray(body.whatToStudy)
        ? (body.whatToStudy as unknown[]).map((s) => String(s).trim()).filter(Boolean)
        : undefined

      const linkedMaterialId =
        typeof body.linkedMaterialId === 'string' && body.linkedMaterialId.trim()
          ? body.linkedMaterialId.trim()
          : undefined
      const courseMaterials = Array.isArray(currentData.courseMaterials)
        ? (currentData.courseMaterials as Array<Record<string, unknown>>)
        : []
      const matchedMaterial = linkedMaterialId
        ? courseMaterials.find((m) => String(m.id) === linkedMaterialId)
        : undefined
      const chapterTitle =
        String(body.chapterTitle || '').trim().slice(0, 140) ||
        (matchedMaterial ? String(matchedMaterial.chapterTitle || '').trim() : '') ||
        undefined

      const created: AssignmentItem[] = recipients.map((stu, idx) => ({
        id: `asg-${nowStamp}-${idx}-${stu.id}`,
        studentId: stu.id,
        className: targetClass || stu.className,
        kind,
        submissionMode,
        offlineDropoffLocation:
          String(body.offlineDropoffLocation || '').trim() ||
          (submissionMode === 'online'
            ? undefined
            : 'Submit physical copy / notebook in class'),
        assignedDay: (body.assignedDay as SchoolWeekday) || undefined,
        assignedDate: String(body.assignedDate || new Date().toISOString().slice(0, 10)),
        title,
        subject,
        teacher: teacherName,
        dueDate,
        submissionIso: String(body.submissionIso || '').trim() || undefined,
        submissionTime: String(body.submissionTime || '').trim() || undefined,
        estimatedMins: Math.max(5, Math.min(240, Number(body.estimatedMins) || 20)),
        status: 'pending',
        progress: 0,
        classSubmittedCount: 0,
        classTotalCount: recipients.length,
        instructions: String(body.instructions || '').trim() || undefined,
        howToSteps: howToSteps && howToSteps.length > 0 ? howToSteps : undefined,
        completedStepIndexes: [],
        whatToStudy: whatToStudy && whatToStudy.length > 0 ? whatToStudy : undefined,
        studyTip: String(body.studyTip || '').trim() || undefined,
        submissionFormat:
          String(body.submissionFormat || '').trim() ||
          (submissionMode === 'offline'
            ? 'Physical Copy / Notebook in Class'
            : submissionMode === 'online'
              ? 'Online Portal Answer / File Upload'
              : 'Physical Copy in Class OR Online Upload'),
        ...(chapterTitle ? { chapterTitle } : {}),
        ...(linkedMaterialId ? { linkedMaterialId } : {}),
      }))

      // Bidirectional sync: if created from a Course Material chapter, link linkedHomeworkId back on the material!
      let nextCourseMaterials: Array<Record<string, unknown>> | undefined
      if (linkedMaterialId && matchedMaterial && created[0]) {
        nextCourseMaterials = courseMaterials.map((m) =>
          String(m.id) === linkedMaterialId ? { ...m, linkedHomeworkId: created[0].id } : m,
        )
        currentData.courseMaterials = nextCourseMaterials
      }

      const modeBadge =
        submissionMode === 'offline'
          ? '📓 Offline Copy'
          : submissionMode === 'online'
            ? '🌐 Online'
            : '🔄 Flexible'

      return commit(
        [...created, ...assignments],
        `Assigned ${subject} homework: ${title} (${recipients.length} students)`,
        'homework_assigned',
        `${subject} · ${title} (${targetClass || 'All'})`,
        {
          id: `notif-hw-${nowStamp}`,
          title: `New ${subject} Homework (${modeBadge})`,
          text: `${teacherName} assigned "${title}"${chapterTitle ? ` (${chapterTitle})` : ''} for ${targetClass || 'your class'} · Due ${dueDate}.`,
          time: 'Just now',
          type: 'notice',
          forRoles: ['student', 'guardian', 'admin'],
          read: false,
        },
        {
          createdCount: created.length,
          createdHomeworkId: created[0]?.id,
          ...(nextCourseMaterials ? { courseMaterials: nextCourseMaterials } : {}),
        },
      )
    }

    // 2. Toggle Checklist Step (Student owning it, their Guardian, Teacher, or Admin)
    if (action === 'toggle_step') {
      const assignmentId = String(body.assignmentId || '')
      const stepIndex = Number(body.stepIndex)
      const target = assignments.find((a) => a.id === assignmentId)
      if (!target || !Number.isInteger(stepIndex) || stepIndex < 0) {
        return NextResponse.json({ ok: false, error: 'Valid assignmentId and stepIndex required.' }, { status: 400 })
      }
      if (session.role === 'student' && target.studentId !== session.linked_entity_id) {
        return NextResponse.json({ ok: false, error: 'Access Denied: Not your assignment.' }, { status: 403 })
      }
      if (session.role === 'guardian') {
        const linked = getGuardianStudentIds(guardians, students, session.linked_entity_id)
        if (!linked.has(target.studentId)) {
          return NextResponse.json({ ok: false, error: 'Access Denied: Not your child’s assignment.' }, { status: 403 })
        }
      }

      const prevSteps = new Set<number>(target.completedStepIndexes || [])
      if (prevSteps.has(stepIndex)) prevSteps.delete(stepIndex)
      else prevSteps.add(stepIndex)
      const completedStepIndexes = Array.from(prevSteps).sort((x, y) => x - y)
      const totalSteps = target.howToSteps?.length || 1
      const nextProgress =
        target.status === 'submitted' || target.status === 'graded'
          ? 100
          : Math.min(90, Math.round((completedStepIndexes.length / totalSteps) * 90))

      const nextAssignments = assignments.map((a) =>
        a.id === assignmentId
          ? { ...a, completedStepIndexes, progress: nextProgress }
          : a,
      )
      return commit(
        nextAssignments,
        `Updated homework step checklist (${target.title})`,
        'homework_step_toggled',
        `${target.title} step #${stepIndex + 1}`,
      )
    }

    // 3. Submit Assignment (Online or Offline Backpack Ready — Student/Guardian/Admin/Teacher)
    if (action === 'submit_assignment') {
      const assignmentId = String(body.assignmentId || '')
      const target = assignments.find((a) => a.id === assignmentId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Assignment not found.' }, { status: 404 })
      }
      if (session.role === 'student' && target.studentId !== session.linked_entity_id) {
        return NextResponse.json({ ok: false, error: 'Access Denied: You can only submit your own homework.' }, { status: 403 })
      }
      if (session.role === 'guardian') {
        const linked = getGuardianStudentIds(guardians, students, session.linked_entity_id)
        if (!linked.has(target.studentId)) {
          return NextResponse.json({ ok: false, error: 'Access Denied: Not your child’s homework.' }, { status: 403 })
        }
      }

      const wasSubmitted = target.status === 'submitted' || target.status === 'graded'
      const submittedVia: 'offline' | 'online' =
        body.submittedVia === 'online'
          ? 'online'
          : body.submittedVia === 'offline'
            ? 'offline'
            : target.submissionMode === 'online'
              ? 'online'
              : 'offline'
      const studentNote = String(body.studentNote || '').trim().slice(0, 600) || undefined
      const onlineResponseText = String(body.onlineResponseText || '').trim().slice(0, 3000) || undefined
      const onlineAttachmentName = String(body.onlineAttachmentName || '').trim().slice(0, 160) || undefined
      const onlineAttachmentUrl = sanitizeUploadUrl(body.onlineAttachmentUrl)

      const stu = students.find((s) => s.id === target.studentId)
      const nextAssignments = assignments.map((a) => {
        if (a.id === assignmentId) {
          return {
            ...a,
            status: 'submitted' as const,
            progress: 100,
            submittedVia,
            studentNote: studentNote ?? a.studentNote,
            onlineResponseText: onlineResponseText ?? a.onlineResponseText,
            onlineAttachmentName: onlineAttachmentName ?? a.onlineAttachmentName,
            onlineAttachmentUrl: onlineAttachmentUrl ?? a.onlineAttachmentUrl,
            classSubmittedCount: wasSubmitted ? a.classSubmittedCount : a.classSubmittedCount + 1,
          }
        }
        if (!wasSubmitted && sameCohortTask(a, target)) {
          return { ...a, classSubmittedCount: a.classSubmittedCount + 1 }
        }
        return a
      })

      return commit(
        nextAssignments,
        `${stu?.name || session.display_name} submitted "${target.title}" (${submittedVia})`,
        'homework_submitted',
        `${stu?.name || target.studentId} · ${target.title} (${submittedVia})`,
        {
          id: `notif-hw-sub-${Date.now()}`,
          title: `Homework Submitted (${submittedVia === 'online' ? 'Online' : 'Offline Ready'})`,
          text: `${stu?.name || session.display_name} turned in "${target.title}" (${target.subject})${onlineAttachmentName ? ` · 📎 ${onlineAttachmentName}` : ''}.`,
          time: 'Just now',
          type: 'notice',
          forRoles: ['teacher', 'admin'],
          read: false,
        },
      )
    }

    // 4. Mark Physical Copy Received in Class (Admin / Teacher only)
    if (action === 'mark_offline_received') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers or Admin can verify physical copies received in class.' },
          { status: 403 },
        )
      }
      const assignmentId = String(body.assignmentId || '')
      const target = assignments.find((a) => a.id === assignmentId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Assignment not found.' }, { status: 404 })
      }
      const wasSubmitted = target.status === 'submitted' || target.status === 'graded'
      const stu = students.find((s) => s.id === target.studentId)
      const nextAssignments = assignments.map((a) => {
        if (a.id === assignmentId) {
          return {
            ...a,
            status: a.status === 'graded' ? ('graded' as const) : ('submitted' as const),
            progress: 100,
            submittedVia: 'offline' as const,
            offlineReceivedInClass: true,
            studentNote:
              a.studentNote || `Physical notebook received in class by ${session.display_name}`,
            classSubmittedCount: wasSubmitted ? a.classSubmittedCount : a.classSubmittedCount + 1,
          }
        }
        if (!wasSubmitted && sameCohortTask(a, target)) {
          return { ...a, classSubmittedCount: a.classSubmittedCount + 1 }
        }
        return a
      })
      return commit(
        nextAssignments,
        `Physical copy received for ${stu?.name || target.studentId} (${target.title})`,
        'homework_offline_received',
        `${stu?.name || target.studentId} · ${target.title}`,
        {
          id: `notif-hw-off-${Date.now()}`,
          title: 'Physical Homework Copy Received ✓',
          text: `${session.display_name} confirmed ${stu?.name || 'student'}’s notebook for "${target.title}" was handed in during class.`,
          time: 'Just now',
          type: 'notice',
          forRoles: ['student', 'guardian'],
          read: false,
        },
      )
    }

    // 5. Grade Homework (Admin / Teacher only)
    if (action === 'grade_assignment') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers or Admin can grade homework.' },
          { status: 403 },
        )
      }
      const assignmentId = String(body.assignmentId || '')
      const score = String(body.score || '').trim().slice(0, 40)
      const teacherRemark = String(body.teacherRemark || '').trim().slice(0, 400) || undefined
      const target = assignments.find((a) => a.id === assignmentId)
      if (!target || !score) {
        return NextResponse.json(
          { ok: false, error: 'Valid assignmentId and score are required.' },
          { status: 400 },
        )
      }
      const stu = students.find((s) => s.id === target.studentId)
      const nextAssignments = assignments.map((a) =>
        a.id === assignmentId
          ? {
              ...a,
              status: 'graded' as const,
              progress: 100,
              score,
              teacherRemark: teacherRemark ?? a.teacherRemark,
            }
          : a,
      )
      return commit(
        nextAssignments,
        `Graded "${target.title}" for ${stu?.name || target.studentId}: ${score}`,
        'homework_graded',
        `${stu?.name || target.studentId} · ${target.title} (${score})`,
        {
          id: `notif-hw-grd-${Date.now()}`,
          title: `Homework Graded · ${score} ⭐`,
          text: `${session.display_name} graded "${target.title}" (${target.subject}) with ${score}${teacherRemark ? ` — "${teacherRemark}"` : ''}.`,
          time: 'Just now',
          type: 'result',
          forRoles: ['student', 'guardian'],
          read: false,
        },
      )
    }

    return NextResponse.json({ ok: false, error: `Unknown homework action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Homework action failed.' },
      { status: 500 },
    )
  }
}
