import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
  upsertDailyAttendanceRecords,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import type {
  ChatThread,
  GuardianRecord,
  LeaveRequest,
  Role,
  StudentRecord,
  TeacherLeaveSubItem,
  TeacherRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    const leaveRequests: LeaveRequest[] = Array.isArray(currentData.leaveRequests)
      ? (currentData.leaveRequests as LeaveRequest[])
      : []
    const teacherLeaves: TeacherLeaveSubItem[] = Array.isArray(currentData.teacherLeaves)
      ? (currentData.teacherLeaves as TeacherLeaveSubItem[])
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

    const todayIso = new Date().toISOString().slice(0, 10)

    const commit = (
      patch: Record<string, unknown>,
      summary: string,
      auditAction: string,
      auditTarget: string,
    ) => {
      const saved = savePersistedState({ ...currentData, ...patch }, session.display_name)
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
      return NextResponse.json({ ok: true, ...patch, version: saved.version })
    }

    const sanitizeUploadUrl = (raw: unknown): string | undefined => {
      const s = String(raw || '').trim()
      if (!s || (!s.startsWith('/uploads/') && !s.startsWith('/dmhs-api/uploads/')) || s.includes('..')) {
        return undefined
      }
      return s.slice(0, 260)
    }

    // 1. Submit Student Leave (Guardian or Admin)
    if (action === 'submit_student_leave') {
      const studentId = String(body.studentId || '')
      const dateRange = String(body.dateRange || '').trim()
      const reason = String(body.reason || '').trim().slice(0, 400)
      const leaveType =
        (body.leaveType as LeaveRequest['leaveType']) || 'Medical / Sick'
      const attachmentName = String(body.attachmentName || '').trim() || undefined
      const attachmentUrl = sanitizeUploadUrl(body.attachmentUrl)
      const stu = students.find((s) => s.id === studentId)
      if (!stu || !dateRange || !reason) {
        return NextResponse.json(
          { ok: false, error: 'Student, date range, and reason are required.' },
          { status: 400 },
        )
      }
      if (session.role === 'guardian') {
        const g = guardians.find((x) => x.id === session.linked_entity_id)
        const linked = new Set<string>(g?.linkedStudentIds || [])
        students
          .filter((s) => s.guardianId === session.linked_entity_id)
          .forEach((s) => linked.add(s.id))
        if (!linked.has(stu.id)) {
          return NextResponse.json(
            { ok: false, error: 'Access Denied: You can only request leave for your own children.' },
            { status: 403 },
          )
        }
      }
      const req: LeaveRequest = {
        id: `lv-${Date.now()}`,
        studentId: stu.id,
        studentName: stu.name,
        guardianName: stu.guardianName || session.display_name,
        dateRange,
        reason,
        leaveType,
        attachmentName,
        attachmentUrl,
        status: 'pending',
        submittedAt: todayIso,
      }
      const notif = {
        id: `notif-lv-${Date.now()}`,
        title: `Student Leave Request · ${stu.name}`,
        text: `${leaveType} leave requested for ${stu.name} (${dateRange})${attachmentName ? ` · Attachment: ${attachmentName}` : ''}.`,
        time: 'Just now',
        type: 'attendance',
        forRoles: ['admin', 'teacher'],
        read: false,
      }
      const nextLeaves = [req, ...leaveRequests]
      const saved = savePersistedState(
        { ...currentData, leaveRequests: nextLeaves, notifications: [notif, ...existingNotifs].slice(0, 80) },
        session.display_name,
      )
      appendSecurityAudit({
        action: 'student_leave_submitted',
        target: `${stu.name} (${dateRange})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Leave requested for ${stu.name}`,
      })
      const scopedLeaves =
        session.role === 'guardian'
          ? nextLeaves.filter((l) => l.studentId === stu.id || l.guardianName === session.display_name)
          : nextLeaves
      return NextResponse.json({ ok: true, leaveRequests: scopedLeaves, version: saved.version })
    }

    // 2. Approve / Decline Student Leave (Admin or Teacher -> auto-updates excused attendance!)
    if (action === 'decide_student_leave') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json({ ok: false, error: 'Only Faculty or Admin can decide student leaves.' }, { status: 403 })
      }
      const leaveId = String(body.leaveId || '')
      const status = body.status as 'approved' | 'declined'
      const decisionNote = String(body.decisionNote || '').trim() || undefined
      if (!['approved', 'declined'].includes(status)) {
        return NextResponse.json({ ok: false, error: 'Status must be approved or declined.' }, { status: 400 })
      }
      const target = leaveRequests.find((l) => l.id === leaveId)
      if (!target) return NextResponse.json({ ok: false, error: 'Leave request not found.' }, { status: 404 })

      const nextLeaves = leaveRequests.map((l) =>
        l.id === leaveId
          ? {
              ...l,
              status,
              decidedBy: session.display_name,
              decidedAt: todayIso,
              decisionNote,
            }
          : l,
      )
      // Automatically update student's todayStatus to 'leave' AND persist into official SQLite dmhs_attendance_records!
      const matchedStu = students.find((s) => s.id === target.studentId)
      if (status === 'approved' && matchedStu) {
        upsertDailyAttendanceRecords([
          {
            attendanceDate: todayIso,
            studentId: matchedStu.id,
            studentName: matchedStu.name,
            classLabel: `${matchedStu.className} · ${matchedStu.section}`,
            status: 'leave',
            markedById: session.linked_entity_id,
            markedByName: `${session.display_name} (Leave Approval)`,
          },
        ])
      }
      const nextStudents =
        status === 'approved'
          ? students.map((s) =>
              s.id === target.studentId ? { ...s, todayStatus: 'leave' as const } : s,
            )
          : students

      const notif = {
        id: `notif-lv-dec-${Date.now()}`,
        title: `Leave ${status === 'approved' ? 'Approved ✓' : 'Declined'} · ${target.studentName}`,
        text: `${target.studentName}’s leave (${target.dateRange}) was ${status} by ${session.display_name}${status === 'approved' ? ' — attendance auto-marked Excused' : ''}.`,
        time: 'Just now',
        type: 'attendance',
        forRoles: ['guardian', 'student', 'admin'],
        read: false,
      }
      return commit(
        {
          leaveRequests: nextLeaves,
          students: nextStudents,
          notifications: [notif, ...existingNotifs].slice(0, 80),
        },
        `Student leave ${status} (${target.studentName})`,
        `student_leave_${status}`,
        `${target.studentName} (${target.dateRange})`,
      )
    }

    // 3. Submit Faculty Leave Request (Teacher or Admin)
    if (action === 'submit_faculty_leave') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json({ ok: false, error: 'Only Faculty or Admin can request staff leave.' }, { status: 403 })
      }
      const tch =
        session.role === 'teacher'
          ? teachers.find((t) => t.id === session.linked_entity_id) || teachers[0]
          : teachers.find((t) => t.id === String(body.teacherId || '')) || teachers[0]
      const dateIso = String(body.dateIso || todayIso)
      const reason = String(body.reason || '').trim().slice(0, 300)
      const leaveType =
        (body.leaveType as TeacherLeaveSubItem['leaveType']) || 'Casual Leave'
      const attachmentName = String(body.attachmentName || '').trim() || undefined
      const attachmentUrl = sanitizeUploadUrl(body.attachmentUrl)
      if (!tch || !reason) {
        return NextResponse.json({ ok: false, error: 'Faculty member and reason are required.' }, { status: 400 })
      }
      const item: TeacherLeaveSubItem = {
        id: `tlv-${Date.now()}`,
        teacherId: tch.id,
        teacherName: tch.name,
        subject: tch.subject,
        date: dateIso,
        dateIso,
        periodSlot: String(body.periodSlot || 'Full Day · All Periods'),
        classSection: tch.assignedClasses[0] || 'All Assigned Classes',
        reason,
        leaveType,
        attachmentName,
        attachmentUrl,
        status: 'pending',
        requestedAt: todayIso,
      }
      const notif = {
        id: `notif-tlv-${Date.now()}`,
        title: `Faculty Leave Request · ${tch.name}`,
        text: `${tch.name} requested ${leaveType} on ${dateIso} (${reason.slice(0, 70)}).`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['admin'],
        read: false,
      }
      return commit(
        {
          teacherLeaves: [item, ...teacherLeaves],
          notifications: [notif, ...existingNotifs].slice(0, 80),
        },
        `Faculty leave requested by ${tch.name}`,
        'faculty_leave_submitted',
        `${tch.name} · ${leaveType} (${dateIso})`,
      )
    }

    // 4. Approve / Decline Faculty Leave (Admin only)
    if (action === 'decide_faculty_leave') {
      if (session.role !== 'admin') {
        return NextResponse.json({ ok: false, error: 'Only Principal/Admin can decide faculty leave.' }, { status: 403 })
      }
      const id = String(body.id || '')
      const status = body.status as 'substituted' | 'declined'
      if (!['substituted', 'declined'].includes(status)) {
        return NextResponse.json({ ok: false, error: 'Invalid faculty leave decision.' }, { status: 400 })
      }
      const target = teacherLeaves.find((l) => l.id === id)
      if (!target) return NextResponse.json({ ok: false, error: 'Faculty leave request not found.' }, { status: 404 })
      const nextTeacherLeaves = teacherLeaves.map((l) =>
        l.id === id ? { ...l, status, decidedBy: session.display_name } : l,
      )
      return commit(
        { teacherLeaves: nextTeacherLeaves },
        `Faculty leave ${status === 'substituted' ? 'approved' : 'declined'} for ${target.teacherName}`,
        'faculty_leave_decided',
        `${target.teacherName} -> ${status}`,
      )
    }

    // 5. Add Leave Discussion Message (syncs atomically to both leaveRequests[i].messages & private chats)
    if (action === 'add_leave_discussion') {
      const leaveId = String(body.leaveId || '')
      const text = String(body.text || '').trim().slice(0, 800)
      const target = leaveRequests.find((l) => l.id === leaveId)
      if (!target || !text) {
        return NextResponse.json(
          { ok: false, error: 'Valid leaveId and message text are required.' },
          { status: 400 },
        )
      }
      if (session.role === 'guardian') {
        const g = guardians.find((x) => x.id === session.linked_entity_id)
        const linked = new Set<string>(g?.linkedStudentIds || [])
        students
          .filter((s) => s.guardianId === session.linked_entity_id)
          .forEach((s) => linked.add(s.id))
        if (!linked.has(target.studentId)) {
          return NextResponse.json({ ok: false, error: 'Access Denied.' }, { status: 403 })
        }
      }

      const nowTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const leaveMsg = {
        id: `lmsg-${Date.now()}`,
        sender: session.display_name,
        senderRole: session.role as Role,
        text,
        time: nowTime,
      }
      const nextLeaves = leaveRequests.map((l) =>
        l.id === leaveId ? { ...l, messages: [...(l.messages || []), leaveMsg] } : l,
      )

      // Mirror reply cleanly into matching private Guardian-Teacher thread
      const chats: ChatThread[] = Array.isArray(currentData.chats)
        ? (currentData.chats as ChatThread[])
        : []
      const chatText = `[Re: Leave ${target.dateRange}] ${text}`
      const stu = students.find((s) => s.id === target.studentId)
      const teacherObj =
        session.role === 'teacher'
          ? teachers.find((t) => t.id === session.linked_entity_id) || teachers[0]
          : teachers[0]
      const existingIdx = chats.findIndex(
        (ch) =>
          ch.studentId === target.studentId ||
          (ch.studentContext || '').toLowerCase().includes(target.studentName.toLowerCase()),
      )
      const chatMsg = {
        id: `cmsg-${Date.now()}`,
        sender: session.display_name,
        senderRole: session.role as Role,
        text: chatText,
        time: nowTime,
      }
      const nextChats: ChatThread[] =
        existingIdx >= 0
          ? chats.map((ch, idx) =>
              idx === existingIdx
                ? { ...ch, unread: ch.unread + 1, messages: [...ch.messages, chatMsg] }
                : ch,
            )
          : [
              {
                id: `chat-lv-${Date.now()}`,
                participantName: teacherObj?.name || 'Class Teacher',
                participantRole: `${teacherObj?.subject || 'Class'} Teacher`,
                initials: teacherObj?.initials || 'CT',
                studentContext: `Regarding ${target.studentName}`,
                studentId: target.studentId,
                guardianId: stu?.guardianId,
                teacherId: teacherObj?.id,
                unread: 1,
                messages: [chatMsg],
              },
              ...chats,
            ]

      return commit(
        { leaveRequests: nextLeaves, chats: nextChats },
        `Leave discussion reply on ${target.studentName}’s request`,
        'leave_discussion_replied',
        `${target.studentName} (${target.dateRange})`,
      )
    }

    return NextResponse.json({ ok: false, error: `Unknown leave action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Leave management action failed.' },
      { status: 500 },
    )
  }
}
