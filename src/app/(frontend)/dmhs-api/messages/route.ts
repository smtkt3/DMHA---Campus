import { NextResponse } from 'next/server'
import { appendSecurityAudit, loadPersistedState, savePersistedState } from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import type {
  ChatMessage,
  ChatThread,
  GuardianRecord,
  Role,
  StudentRecord,
  TeacherRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function resolveGuardianLinkedIds(
  guardians: GuardianRecord[],
  students: StudentRecord[],
  guardianId: string,
): Set<string> {
  const g = guardians.find((x) => x.id === guardianId)
  const set = new Set<string>(g?.linkedStudentIds || [])
  students.filter((s) => s.guardianId === guardianId).forEach((s) => set.add(s.id))
  return set
}

function threadBelongsToGuardian(
  thread: ChatThread,
  guardianId: string,
  linkedIds: Set<string>,
  students: StudentRecord[],
): boolean {
  if (thread.guardianId && thread.guardianId === guardianId) return true
  if (thread.studentId && linkedIds.has(thread.studentId)) return true
  const ctx = (thread.studentContext || '').toLowerCase()
  if (!ctx) return false
  return students
    .filter((s) => linkedIds.has(s.id))
    .some((s) => ctx.includes(s.name.toLowerCase()))
}

function threadBelongsToTeacher(
  thread: ChatThread,
  teacherId: string,
  teacherName: string,
): boolean {
  if (thread.teacherId && thread.teacherId === teacherId) return true
  return thread.participantName.toLowerCase() === teacherName.toLowerCase()
}

export function scopeChatsForActor(
  chats: ChatThread[],
  role: Role,
  linkedId: string,
  students: StudentRecord[],
  guardians: GuardianRecord[],
  teachers: TeacherRecord[],
): ChatThread[] {
  if (role === 'admin') return chats
  if (role === 'guardian') {
    const linkedIds = resolveGuardianLinkedIds(guardians, students, linkedId)
    return chats.filter((t) => threadBelongsToGuardian(t, linkedId, linkedIds, students))
  }
  if (role === 'teacher') {
    const tch = teachers.find((t) => t.id === linkedId)
    return chats.filter((t) => threadBelongsToTeacher(t, linkedId, tch?.name || ''))
  }
  // Students & Custom Staff do not have access to private Guardian-Teacher threads
  return []
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'guardian'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const chats: ChatThread[] = Array.isArray(currentData.chats)
      ? (currentData.chats as ChatThread[])
      : []
    const students: StudentRecord[] = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const guardians: GuardianRecord[] = Array.isArray(currentData.guardians)
      ? (currentData.guardians as GuardianRecord[])
      : []
    const teachers: TeacherRecord[] = Array.isArray(currentData.teachers)
      ? (currentData.teachers as TeacherRecord[])
      : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []

    const nowTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const sanitizeUploadUrl = (raw: unknown): string | undefined => {
      const s = String(raw || '').trim()
      if (!s || (!s.startsWith('/uploads/') && !s.startsWith('/dmhs-api/uploads/')) || s.includes('..')) {
        return undefined
      }
      return s.slice(0, 260)
    }

    if (action === 'start_thread') {
      const studentId = String(body.studentId || '')
      const teacherId = String(body.teacherId || '')
      const firstMessage = String(body.text || '').trim().slice(0, 1200)
      const attachmentName = String(body.attachmentName || '').trim().slice(0, 140) || undefined
      const attachmentUrl = sanitizeUploadUrl(body.attachmentUrl)

      const stu = students.find((s) => s.id === studentId)
      const tch =
        session.role === 'teacher'
          ? teachers.find((t) => t.id === session.linked_entity_id) || teachers[0]
          : teachers.find((t) => t.id === teacherId) || teachers[0]

      if (!stu || !tch || (!firstMessage && !attachmentName)) {
        return NextResponse.json(
          { ok: false, error: 'Student, Teacher, and message text or attachment are required.' },
          { status: 400 },
        )
      }

      // Guardian ownership guard
      if (session.role === 'guardian') {
        const linkedIds = resolveGuardianLinkedIds(guardians, students, session.linked_entity_id)
        if (!linkedIds.has(stu.id)) {
          return NextResponse.json(
            { ok: false, error: 'Access Denied: You can only message regarding your own children.' },
            { status: 403 },
          )
        }
      }

      const matchedGuardian =
        guardians.find(
          (g) => g.id === stu.guardianId || g.linkedStudentIds.includes(stu.id),
        ) || null

      const msg: ChatMessage = {
        id: `m-${Date.now()}`,
        sender: session.display_name,
        senderRole: session.role as Role,
        text: firstMessage || `Attached file: ${attachmentName}`,
        time: nowTime,
        attachmentName,
        attachmentUrl,
      }

      // Reuse existing thread if same teacher + student already exists
      const existing = chats.find(
        (c) =>
          (c.teacherId === tch.id ||
            c.participantName.toLowerCase() === tch.name.toLowerCase()) &&
          (c.studentId === stu.id ||
            (c.studentContext || '').toLowerCase().includes(stu.name.toLowerCase())),
      )

      let nextChats: ChatThread[]
      let activeThreadId: string
      if (existing) {
        activeThreadId = existing.id
        nextChats = chats.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                studentId: stu.id,
                guardianId: matchedGuardian?.id || c.guardianId,
                teacherId: tch.id,
                unread: c.unread + 1,
                messages: [...c.messages, msg],
              }
            : c,
        )
      } else {
        const newThread: ChatThread = {
          id: `chat-${Date.now()}`,
          participantName: tch.name,
          participantRole: `${tch.subject} Teacher`,
          initials: tch.initials,
          studentContext: `Regarding ${stu.name}`,
          studentId: stu.id,
          guardianId: matchedGuardian?.id,
          teacherId: tch.id,
          unread: 1,
          messages: [msg],
        }
        activeThreadId = newThread.id
        nextChats = [newThread, ...chats]
      }

      const notif = {
        id: `notif-msg-${Date.now()}`,
        title: `New Message · ${session.display_name}`,
        text: `${session.display_name} (${stu.name}): "${msg.text.slice(0, 90)}"`,
        time: 'Just now',
        type: 'feedback',
        forRoles: session.role === 'guardian' ? ['teacher', 'admin'] : ['guardian', 'admin'],
        read: false,
      }

      const saved = savePersistedState(
        {
          ...currentData,
          chats: nextChats,
          notifications: [notif, ...existingNotifs].slice(0, 80),
        },
        session.display_name,
      )
      appendSecurityAudit({
        action: 'private_message_started',
        target: `${tch.name} <-> ${stu.name}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `New private message regarding ${stu.name}`,
      })

      return NextResponse.json({
        ok: true,
        threadId: activeThreadId,
        chats: scopeChatsForActor(
          nextChats,
          session.role as Role,
          session.linked_entity_id,
          students,
          guardians,
          teachers,
        ),
        version: saved.version,
      })
    }

    if (action === 'send_message') {
      const threadId = String(body.threadId || '')
      const text = String(body.text || '').trim().slice(0, 1200)
      const attachmentName = String(body.attachmentName || '').trim().slice(0, 140) || undefined
      const attachmentUrl = sanitizeUploadUrl(body.attachmentUrl)
      const thread = chats.find((c) => c.id === threadId)
      if (!thread || (!text && !attachmentName)) {
        return NextResponse.json(
          { ok: false, error: 'Valid threadId and message text or attachment are required.' },
          { status: 400 },
        )
      }

      // Enforce strict thread ownership
      const allowedThreads = scopeChatsForActor(
        chats,
        session.role as Role,
        session.linked_entity_id,
        students,
        guardians,
        teachers,
      )
      if (!allowedThreads.some((t) => t.id === threadId)) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: You are not a participant in this thread.' },
          { status: 403 },
        )
      }

      const msg: ChatMessage = {
        id: `m-${Date.now()}`,
        sender: session.display_name,
        senderRole: session.role as Role,
        text: text || `Attached file: ${attachmentName}`,
        time: nowTime,
        attachmentName,
        attachmentUrl,
      }

      const nextChats = chats.map((c) =>
        c.id === threadId
          ? {
              ...c,
              unread: c.unread + 1,
              messages: [...c.messages, msg],
            }
          : c,
      )

      const notif = {
        id: `notif-msg-${Date.now()}`,
        title: `Reply from ${session.display_name}`,
        text: `${session.display_name} (${thread.studentContext || 'DMHA'}): "${msg.text.slice(0, 90)}"`,
        time: 'Just now',
        type: 'feedback',
        forRoles: session.role === 'guardian' ? ['teacher', 'admin'] : ['guardian', 'admin'],
        read: false,
      }

      const saved = savePersistedState(
        {
          ...currentData,
          chats: nextChats,
          notifications: [notif, ...existingNotifs].slice(0, 80),
        },
        session.display_name,
      )
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Message sent by ${session.display_name}`,
      })

      return NextResponse.json({
        ok: true,
        chats: scopeChatsForActor(
          nextChats,
          session.role as Role,
          session.linked_entity_id,
          students,
          guardians,
          teachers,
        ),
        version: saved.version,
      })
    }

    if (action === 'mark_read') {
      const threadId = String(body.threadId || '')
      const allowedThreads = scopeChatsForActor(
        chats,
        session.role as Role,
        session.linked_entity_id,
        students,
        guardians,
        teachers,
      )
      if (!allowedThreads.some((t) => t.id === threadId)) {
        return NextResponse.json({ ok: false, error: 'Thread not accessible.' }, { status: 403 })
      }
      const nextChats = chats.map((c) => (c.id === threadId ? { ...c, unread: 0 } : c))
      const saved = savePersistedState({ ...currentData, chats: nextChats }, session.display_name)
      return NextResponse.json({
        ok: true,
        chats: scopeChatsForActor(
          nextChats,
          session.role as Role,
          session.linked_entity_id,
          students,
          guardians,
          teachers,
        ),
        version: saved.version,
      })
    }

    return NextResponse.json({ ok: false, error: `Unknown message action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Messaging action failed.' },
      { status: 500 },
    )
  }
}
