import { NextResponse } from 'next/server'
import { initialCampusTasks } from '@/components/school/data'
import type {
  CampusTaskComment,
  CampusTaskItem,
  CampusTaskSubtask,
  Role,
  StaffMemberRecord,
  TeacherRecord,
} from '@/components/school/types'
import { appendSecurityAudit, loadPersistedState, savePersistedState } from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import { scopeTasksForActor, taskBelongsToActor } from '@/lib/dmhs-tasks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitizeUploadUrl(raw: unknown): string | undefined {
  const s = String(raw || '').trim()
  if (!s || (!s.startsWith('/uploads/') && !s.startsWith('/dmhs-api/uploads/')) || s.includes('..')) {
    return undefined
  }
  return s.slice(0, 260)
}

function formatShortTime(): string {
  const d = new Date()
  const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  const tm = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${day} · ${tm}`
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const tasks: CampusTaskItem[] = Array.isArray(currentData.campusTasks)
      ? (currentData.campusTasks as CampusTaskItem[])
      : initialCampusTasks
    const teachers: TeacherRecord[] = Array.isArray(currentData.teachers)
      ? (currentData.teachers as TeacherRecord[])
      : []
    const staffMembers: StaffMemberRecord[] = Array.isArray(currentData.staffMembers)
      ? (currentData.staffMembers as StaffMemberRecord[])
      : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []
    const todayIso = new Date().toISOString().slice(0, 10)

    const respond = (
      nextTasks: CampusTaskItem[],
      summary: string,
      auditAction: string,
      auditTarget: string,
      notif?: Record<string, unknown>,
      extra?: Record<string, unknown>,
    ) => {
      const nextNotifs = notif ? [notif, ...existingNotifs].slice(0, 100) : existingNotifs
      const saved = savePersistedState(
        {
          ...currentData,
          campusTasks: nextTasks,
          notifications: nextNotifs,
        },
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
        campusTasks: scopeTasksForActor(
          nextTasks,
          session.role as Role,
          session.linked_entity_id,
          teachers,
          staffMembers,
        ),
        ...(notif ? { notifications: nextNotifs } : {}),
        ...(extra || {}),
        version: saved.version,
      })
    }

    // 1. CREATE TASK (Admin only)
    if (action === 'create_task') {
      if (session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Principal / Admin can assign new campus tasks.' },
          { status: 403 },
        )
      }
      const title = String(body.title || '').trim().slice(0, 160)
      const rawAssigneeId = String(body.assigneeId || '').trim()
      const rawAssigneeName = String(body.assigneeName || '').trim()

      const matchedTeacher = teachers.find(
        (t) =>
          (rawAssigneeId && t.id === rawAssigneeId) ||
          (rawAssigneeName && t.name.toLowerCase() === rawAssigneeName.toLowerCase()),
      )
      const matchedStaff = !matchedTeacher
        ? staffMembers.find(
            (s) =>
              (rawAssigneeId && s.id === rawAssigneeId) ||
              (rawAssigneeName && s.name.toLowerCase() === rawAssigneeName.toLowerCase()),
          )
        : undefined

      const assigneeId = matchedTeacher?.id || matchedStaff?.id || rawAssigneeId || undefined
      const assigneeName = matchedTeacher?.name || matchedStaff?.name || rawAssigneeName
      const assigneeRole: CampusTaskItem['assigneeRole'] = matchedTeacher
        ? 'teacher'
        : matchedStaff
          ? 'staff'
          : (body.assigneeRole as CampusTaskItem['assigneeRole']) || 'teacher'

      if (!title || !assigneeName) {
        return NextResponse.json(
          { ok: false, error: 'Task title and assignee are required.' },
          { status: 400 },
        )
      }

      const rawSubtasks = Array.isArray(body.subtasks) ? (body.subtasks as unknown[]) : []
      const subtasks: CampusTaskSubtask[] = rawSubtasks
        .map((st, idx) => {
          const text = typeof st === 'string' ? st.trim() : String((st as { title?: string })?.title || '').trim()
          return text ? { id: `sub-${Date.now()}-${idx}`, title: text.slice(0, 140), done: false } : null
        })
        .filter((x): x is CampusTaskSubtask => Boolean(x))
        .slice(0, 15)

      const attachmentName = String(body.attachmentName || '').trim().slice(0, 150) || undefined
      const attachmentUrl = sanitizeUploadUrl(body.attachmentUrl)

      const newTask: CampusTaskItem = {
        id: `tsk-${Date.now()}`,
        title,
        department: (body.department as CampusTaskItem['department']) || 'Academics',
        categoryTag: String(body.categoryTag || '').trim().slice(0, 40) || undefined,
        assigneeName,
        assigneeId,
        assigneeRole,
        priority: (body.priority as CampusTaskItem['priority']) || 'High',
        dueDate: String(body.dueDate || todayIso),
        status: 'todo',
        notes: String(body.notes || '').trim().slice(0, 800) || undefined,
        subtasks: subtasks.length > 0 ? subtasks : undefined,
        comments: [],
        attachmentName,
        attachmentUrl,
        createdBy: session.display_name,
        createdAt: todayIso,
        updatedAt: todayIso,
      }

      const targetRoles: Role[] =
        assigneeRole === 'staff' ? ['staff', 'admin'] : ['teacher', 'admin']

      return respond(
        [newTask, ...tasks],
        `Assigned task "${title}" to ${assigneeName}`,
        'campus_task_assigned',
        `${title} -> ${assigneeName} (${newTask.priority}, Due ${newTask.dueDate})`,
        {
          id: `notif-tsk-${Date.now()}`,
          title: `New Task Assigned (${newTask.priority}) · ${assigneeName}`,
          text: `${session.display_name} assigned "${title}" (${newTask.department}) · Due ${newTask.dueDate}.`,
          time: 'Just now',
          type: 'notice',
          forRoles: targetRoles,
          read: false,
        },
        { task: newTask },
      )
    }

    // 2. UPDATE TASK METADATA (Admin only)
    if (action === 'update_task') {
      if (session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Admin can edit task details.' },
          { status: 403 },
        )
      }
      const taskId = String(body.taskId || '')
      const target = tasks.find((t) => t.id === taskId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Task not found.' }, { status: 404 })
      }
      const nextTasks = tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              title: body.title ? String(body.title).trim().slice(0, 160) : t.title,
              priority: (body.priority as CampusTaskItem['priority']) || t.priority,
              department: (body.department as CampusTaskItem['department']) || t.department,
              dueDate: body.dueDate ? String(body.dueDate).trim() : t.dueDate,
              notes: body.notes !== undefined ? String(body.notes).trim().slice(0, 800) : t.notes,
              updatedAt: todayIso,
            }
          : t,
      )
      return respond(
        nextTasks,
        `Updated task "${target.title}"`,
        'campus_task_updated',
        target.title,
      )
    }

    // 3. UPDATE TASK STATUS (Admin OR Owning Teacher/Staff)
    if (action === 'update_status') {
      const taskId = String(body.taskId || '')
      const status = body.status as CampusTaskItem['status']
      if (!['todo', 'in_progress', 'in_review', 'completed'].includes(status)) {
        return NextResponse.json({ ok: false, error: 'Invalid task status.' }, { status: 400 })
      }
      const target = tasks.find((t) => t.id === taskId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Task not found.' }, { status: 404 })
      }
      if (
        !taskBelongsToActor(
          target,
          session.role as Role,
          session.linked_entity_id,
          teachers,
          staffMembers,
        )
      ) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: You can only update tasks assigned to you.' },
          { status: 403 },
        )
      }

      const nextTasks = tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status,
              updatedAt: todayIso,
              completedAt: status === 'completed' ? todayIso : undefined,
            }
          : t,
      )

      const statusLabel =
        status === 'in_review'
          ? 'Submitted for Admin Review'
          : status === 'completed'
            ? 'Completed ✓'
            : status === 'in_progress'
              ? 'In Progress'
              : 'To Do'

      const notif =
        session.role === 'admin'
          ? {
              id: `notif-tsk-st-${Date.now()}`,
              title: `Task ${statusLabel} · ${target.title}`,
              text: `${session.display_name} marked "${target.title}" as ${statusLabel}.`,
              time: 'Just now',
              type: 'notice',
              forRoles: [target.assigneeRole === 'staff' ? 'staff' : 'teacher'] as Role[],
              read: false,
            }
          : {
              id: `notif-tsk-st-${Date.now()}`,
              title: `Task Update (${statusLabel}) · ${session.display_name}`,
              text: `${session.display_name} moved "${target.title}" to ${statusLabel}.`,
              time: 'Just now',
              type: 'notice',
              forRoles: ['admin'] as Role[],
              read: false,
            }

      return respond(
        nextTasks,
        `${target.title} → ${statusLabel}`,
        'campus_task_status_changed',
        `${target.title} -> ${status}`,
        notif,
      )
    }

    // 4. TOGGLE SUBTASK CHECKLIST ITEM (Admin OR Owning Teacher/Staff)
    if (action === 'toggle_subtask') {
      const taskId = String(body.taskId || '')
      const subtaskId = String(body.subtaskId || '')
      const target = tasks.find((t) => t.id === taskId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Task not found.' }, { status: 404 })
      }
      if (
        !taskBelongsToActor(
          target,
          session.role as Role,
          session.linked_entity_id,
          teachers,
          staffMembers,
        )
      ) {
        return NextResponse.json({ ok: false, error: 'Access Denied.' }, { status: 403 })
      }

      const nextSubtasks = (target.subtasks || []).map((st) =>
        st.id === subtaskId ? { ...st, done: !st.done } : st,
      )
      const anyDone = nextSubtasks.some((s) => s.done)
      const nextStatus: CampusTaskItem['status'] =
        target.status === 'todo' && anyDone ? 'in_progress' : target.status

      const nextTasks = tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: nextSubtasks, status: nextStatus, updatedAt: todayIso }
          : t,
      )
      return respond(
        nextTasks,
        `Updated checklist on "${target.title}"`,
        'campus_task_subtask_toggled',
        `${target.title} (${subtaskId})`,
      )
    }

    // 5. ADD SUBTASK CHECKLIST ITEM (Admin OR Owning Teacher/Staff)
    if (action === 'add_subtask') {
      const taskId = String(body.taskId || '')
      const title = String(body.title || '').trim().slice(0, 140)
      const target = tasks.find((t) => t.id === taskId)
      if (!target || !title) {
        return NextResponse.json(
          { ok: false, error: 'Valid taskId and subtask title are required.' },
          { status: 400 },
        )
      }
      if (
        !taskBelongsToActor(
          target,
          session.role as Role,
          session.linked_entity_id,
          teachers,
          staffMembers,
        )
      ) {
        return NextResponse.json({ ok: false, error: 'Access Denied.' }, { status: 403 })
      }
      const nextSub: CampusTaskSubtask = {
        id: `sub-${Date.now()}`,
        title,
        done: false,
      }
      const nextTasks = tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: [...(t.subtasks || []), nextSub], updatedAt: todayIso }
          : t,
      )
      return respond(
        nextTasks,
        `Added checklist item to "${target.title}"`,
        'campus_task_subtask_added',
        `${target.title}: ${title}`,
      )
    }

    // 6. ADD COMMENT / PROOF ATTACHMENT (Admin OR Owning Teacher/Staff)
    if (action === 'add_comment') {
      const taskId = String(body.taskId || '')
      const text = String(body.text || '').trim().slice(0, 800)
      const attachmentName = String(body.attachmentName || '').trim().slice(0, 150) || undefined
      const attachmentUrl = sanitizeUploadUrl(body.attachmentUrl)
      const target = tasks.find((t) => t.id === taskId)
      if (!target || (!text && !attachmentName)) {
        return NextResponse.json(
          { ok: false, error: 'Valid taskId and comment text or attachment required.' },
          { status: 400 },
        )
      }
      if (
        !taskBelongsToActor(
          target,
          session.role as Role,
          session.linked_entity_id,
          teachers,
          staffMembers,
        )
      ) {
        return NextResponse.json({ ok: false, error: 'Access Denied.' }, { status: 403 })
      }
      const comment: CampusTaskComment = {
        id: `tcmt-${Date.now()}`,
        sender: session.display_name,
        senderRole: session.role as Role,
        text: text || `Uploaded proof file: ${attachmentName}`,
        time: formatShortTime(),
        attachmentName,
        attachmentUrl,
      }
      const nextTasks = tasks.map((t) =>
        t.id === taskId
          ? { ...t, comments: [...(t.comments || []), comment], updatedAt: todayIso }
          : t,
      )
      const notif = {
        id: `notif-tcmt-${Date.now()}`,
        title: `Task Update · ${target.title}`,
        text: `${session.display_name}: "${comment.text.slice(0, 90)}"`,
        time: 'Just now',
        type: 'feedback',
        forRoles:
          session.role === 'admin'
            ? ([target.assigneeRole === 'staff' ? 'staff' : 'teacher'] as Role[])
            : (['admin'] as Role[]),
        read: false,
      }
      return respond(
        nextTasks,
        `Commented on "${target.title}"`,
        'campus_task_commented',
        `${target.title} by ${session.display_name}`,
        notif,
      )
    }

    // 7. DELETE TASK (Admin only)
    if (action === 'delete_task') {
      if (session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Admin can delete campus tasks.' },
          { status: 403 },
        )
      }
      const taskId = String(body.taskId || '')
      const target = tasks.find((t) => t.id === taskId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Task not found.' }, { status: 404 })
      }
      const nextTasks = tasks.filter((t) => t.id !== taskId)
      return respond(
        nextTasks,
        `Deleted task "${target.title}"`,
        'campus_task_deleted',
        target.title,
      )
    }

    return NextResponse.json({ ok: false, error: `Unknown task action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Task operation failed.' },
      { status: 500 },
    )
  }
}
