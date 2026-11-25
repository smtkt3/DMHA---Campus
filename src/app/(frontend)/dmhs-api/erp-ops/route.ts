import { NextResponse } from 'next/server'
import { appendAutoCreditVoucher, loadAccountingBookSafe } from '@/lib/dmhs-auto-voucher'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
  upsertDailyAttendanceRecords,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import {
  initialCampusTasks,
  initialEmployeeDuties,
  initialHelpDeskTickets,
  initialRfidDevices,
  initialRfidPunches,
  initialStudentFines,
} from '@/components/school/data'
import type {
  CampusTaskItem,
  EmployeeDutyShift,
  FeeInvoice,
  HelpDeskTicket,
  RfidDeviceRecord,
  RfidPunchLog,
  StudentFineRecord,
  StudentRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatNow() {
  const d = new Date()
  const iso = d.toISOString().slice(0, 10)
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${iso} ${time}`
}

function formatTimeOnly() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>

    const tickets: HelpDeskTicket[] = Array.isArray(currentData.helpDeskTickets)
      ? (currentData.helpDeskTickets as HelpDeskTicket[])
      : initialHelpDeskTickets
    const tasks: CampusTaskItem[] = Array.isArray(currentData.campusTasks)
      ? (currentData.campusTasks as CampusTaskItem[])
      : initialCampusTasks
    const duties: EmployeeDutyShift[] = Array.isArray(currentData.employeeDuties)
      ? (currentData.employeeDuties as EmployeeDutyShift[])
      : initialEmployeeDuties
    const rfidDevices: RfidDeviceRecord[] = Array.isArray(currentData.rfidDevices)
      ? (currentData.rfidDevices as RfidDeviceRecord[])
      : initialRfidDevices
    const rfidPunches: RfidPunchLog[] = Array.isArray(currentData.rfidPunches)
      ? (currentData.rfidPunches as RfidPunchLog[])
      : initialRfidPunches
    const fines: StudentFineRecord[] = Array.isArray(currentData.studentFines)
      ? (currentData.studentFines as StudentFineRecord[])
      : initialStudentFines
    const students: StudentRecord[] = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const fees: FeeInvoice[] = Array.isArray(currentData.fees)
      ? (currentData.fees as FeeInvoice[])
      : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []

    // ==================== 1. HELP DESK ====================
    if (action === 'create_ticket') {
      const subject = String(body.subject || '').trim().slice(0, 140)
      const description = String(body.description || '').trim().slice(0, 600)
      if (!subject || !description) {
        return NextResponse.json({ ok: false, error: 'Ticket subject and description are required.' }, { status: 400 })
      }
      const nextNum = tickets.length + 17
      const newTicket: HelpDeskTicket = {
        id: `tkt-${Date.now()}`,
        ticketNo: `HD-2026-${String(nextNum).padStart(3, '0')}`,
        subject,
        category: (body.category as HelpDeskTicket['category']) || 'Campus Facility',
        priority: (body.priority as HelpDeskTicket['priority']) || 'Normal',
        status: 'open',
        requesterName: String(body.requesterName || session.display_name).trim(),
        requesterRole: (body.requesterRole as HelpDeskTicket['requesterRole']) || session.role,
        description,
        assignedTo: String(body.assignedTo || '').trim() || undefined,
        createdAt: formatNow(),
        updatedAt: formatNow(),
      }
      const nextTickets = [newTicket, ...tickets]
      const saved = savePersistedState({ ...currentData, helpDeskTickets: nextTickets }, session.display_name)
      appendSecurityAudit({
        action: 'helpdesk_ticket_created',
        target: `${newTicket.ticketNo}: ${newTicket.subject}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: `Help Desk ticket ${newTicket.ticketNo} logged` })
      return NextResponse.json({ ok: true, helpDeskTickets: nextTickets, version: saved.version })
    }

    if (action === 'update_ticket') {
      const ticketId = String(body.ticketId || '')
      const status = (body.status as HelpDeskTicket['status']) || 'in_progress'
      const adminReply = String(body.adminReply || '').trim().slice(0, 600)
      const assignedTo = String(body.assignedTo || '').trim().slice(0, 80)
      if (!tickets.some((t) => t.id === ticketId)) {
        return NextResponse.json({ ok: false, error: 'Ticket not found.' }, { status: 404 })
      }
      const nextTickets = tickets.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status,
              adminReply: adminReply || t.adminReply,
              assignedTo: assignedTo || t.assignedTo,
              updatedAt: formatNow(),
            }
          : t,
      )
      const saved = savePersistedState({ ...currentData, helpDeskTickets: nextTickets }, session.display_name)
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: `Help Desk ticket updated (${status})` })
      return NextResponse.json({ ok: true, helpDeskTickets: nextTickets, version: saved.version })
    }

    // ==================== 2. TASK MANAGEMENT ====================
    if (action === 'create_task') {
      const title = String(body.title || '').trim().slice(0, 160)
      const assigneeName = String(body.assigneeName || '').trim()
      if (!title || !assigneeName) {
        return NextResponse.json({ ok: false, error: 'Task title and assignee are required.' }, { status: 400 })
      }
      const newTask: CampusTaskItem = {
        id: `tsk-${Date.now()}`,
        title,
        department: (body.department as CampusTaskItem['department']) || 'Administration',
        assigneeName,
        assigneeId: String(body.assigneeId || '').trim() || undefined,
        priority: (body.priority as CampusTaskItem['priority']) || 'Medium',
        dueDate: String(body.dueDate || new Date().toISOString().slice(0, 10)),
        status: 'todo',
        notes: String(body.notes || '').trim().slice(0, 400) || undefined,
        createdBy: session.display_name,
        createdAt: new Date().toISOString().slice(0, 10),
      }
      const nextTasks = [newTask, ...tasks]
      const saved = savePersistedState({ ...currentData, campusTasks: nextTasks }, session.display_name)
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: `Task assigned: ${title}` })
      return NextResponse.json({ ok: true, campusTasks: nextTasks, version: saved.version })
    }

    if (action === 'update_task_status') {
      const taskId = String(body.taskId || '')
      const status = body.status as CampusTaskItem['status']
      if (!['todo', 'in_progress', 'completed'].includes(status)) {
        return NextResponse.json({ ok: false, error: 'Invalid task status.' }, { status: 400 })
      }
      const nextTasks = tasks.map((t) => (t.id === taskId ? { ...t, status } : t))
      const saved = savePersistedState({ ...currentData, campusTasks: nextTasks }, session.display_name)
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: 'Task status updated' })
      return NextResponse.json({ ok: true, campusTasks: nextTasks, version: saved.version })
    }

    if (action === 'delete_task') {
      const taskId = String(body.taskId || '')
      const nextTasks = tasks.filter((t) => t.id !== taskId)
      const saved = savePersistedState({ ...currentData, campusTasks: nextTasks }, session.display_name)
      return NextResponse.json({ ok: true, campusTasks: nextTasks, version: saved.version })
    }

    // ==================== 3. EMPLOYEE DUTY ROSTER ====================
    if (action === 'create_duty') {
      const employeeName = String(body.employeeName || '').trim()
      const shiftTime = String(body.shiftTime || '').trim()
      if (!employeeName || !shiftTime) {
        return NextResponse.json({ ok: false, error: 'Employee name and shift time are required.' }, { status: 400 })
      }
      const newDuty: EmployeeDutyShift = {
        id: `duty-${Date.now()}`,
        employeeName,
        employeeRole: String(body.employeeRole || 'Faculty / Staff').trim(),
        dutyType: (body.dutyType as EmployeeDutyShift['dutyType']) || 'Morning Gate Duty',
        campusUnit: String(body.campusUnit || 'Unit - 1'),
        dateIso: String(body.dateIso || new Date().toISOString().slice(0, 10)),
        shiftTime,
        status: 'scheduled',
        notes: String(body.notes || '').trim().slice(0, 300) || undefined,
      }
      const nextDuties = [newDuty, ...duties]
      const saved = savePersistedState({ ...currentData, employeeDuties: nextDuties }, session.display_name)
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: `Duty assigned: ${employeeName}` })
      return NextResponse.json({ ok: true, employeeDuties: nextDuties, version: saved.version })
    }

    if (action === 'update_duty_status') {
      const dutyId = String(body.dutyId || '')
      const status = body.status as EmployeeDutyShift['status']
      const nextDuties = duties.map((d) => (d.id === dutyId ? { ...d, status } : d))
      const saved = savePersistedState({ ...currentData, employeeDuties: nextDuties }, session.display_name)
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: `Duty status updated (${status})` })
      return NextResponse.json({ ok: true, employeeDuties: nextDuties, version: saved.version })
    }

    // ==================== 4. FINGERPRINT & RFID ATTENDANCE ====================
    if (action === 'register_rfid_device') {
      const name = String(body.name || '').trim()
      const ipAddress = String(body.ipAddress || '').trim()
      if (!name || !ipAddress) {
        return NextResponse.json({ ok: false, error: 'Device name and IP address are required.' }, { status: 400 })
      }
      const newDev: RfidDeviceRecord = {
        id: `dev-${Date.now()}`,
        name,
        model: String(body.model || 'ZKTeco Biometric Terminal').trim(),
        campusUnit: String(body.campusUnit || 'Unit - 1'),
        location: String(body.location || 'Main Gate').trim(),
        ipAddress,
        mode: (body.mode as RfidDeviceRecord['mode']) || 'Fingerprint + RFID',
        status: 'online',
        lastSyncAt: 'Just now',
        totalPunchesToday: 0,
      }
      const nextDevices = [newDev, ...rfidDevices]
      const saved = savePersistedState({ ...currentData, rfidDevices: nextDevices }, session.display_name)
      appendSecurityAudit({
        action: 'rfid_device_registered',
        target: `${newDev.name} (${newDev.ipAddress})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      return NextResponse.json({ ok: true, rfidDevices: nextDevices, version: saved.version })
    }

    if (action === 'record_rfid_punch') {
      const deviceId = String(body.deviceId || rfidDevices[0]?.id || 'dev-zk-1')
      const device = rfidDevices.find((d) => d.id === deviceId) || rfidDevices[0]
      const personType = (body.personType as RfidPunchLog['personType']) || 'student'
      const personId = String(body.personId || '').trim()
      const personName = String(body.personName || '').trim()
      const cardUid = String(body.cardUid || '').trim() || `RF-${Date.now().toString().slice(-6)}`
      const method = (body.method as RfidPunchLog['method']) || 'RFID Card'
      const direction = (body.direction as RfidPunchLog['direction']) || 'IN'
      if (!personId || !personName) {
        return NextResponse.json({ ok: false, error: 'Select a student or faculty member for the punch.' }, { status: 400 })
      }
      const timeLabel = formatTimeOnly()
      const newPunch: RfidPunchLog = {
        id: `pnch-${Date.now()}`,
        deviceId: device?.id || deviceId,
        deviceName: device?.name || 'DMHA Gate Terminal',
        personType,
        personId,
        personName,
        cardUid,
        method,
        direction,
        punchedAt: timeLabel,
        dateIso: new Date().toISOString().slice(0, 10),
        syncedToAttendance: true,
      }
      const nextPunches = [newPunch, ...rfidPunches].slice(0, 200)
      const nextDevices = rfidDevices.map((d) =>
        d.id === newPunch.deviceId
          ? { ...d, lastSyncAt: 'Just now', totalPunchesToday: d.totalPunchesToday + 1 }
          : d,
      )
      // Automatically mark Student Attendance Present + gateCheckIn AND write to official SQLite dmhs_attendance_records!
      if (personType === 'student' && direction === 'IN') {
        const matchedStu = students.find((s) => s.id === personId)
        upsertDailyAttendanceRecords([
          {
            attendanceDate: newPunch.dateIso,
            studentId: personId,
            studentName: matchedStu?.name || personName,
            classLabel: matchedStu
              ? `${matchedStu.className} · ${matchedStu.section}`
              : 'DMHA Campus',
            status: 'present',
            markedById: session.linked_entity_id,
            markedByName: `${session.display_name} (${method})`,
          },
        ])
      }
      const nextStudents =
        personType === 'student' && direction === 'IN'
          ? students.map((s) =>
              s.id === personId ? { ...s, todayStatus: 'present' as const, gateCheckIn: timeLabel } : s,
            )
          : students

      const saved = savePersistedState(
        {
          ...currentData,
          rfidDevices: nextDevices,
          rfidPunches: nextPunches,
          students: nextStudents,
        },
        session.display_name,
      )
      appendSecurityAudit({
        action: 'rfid_biometric_punch',
        target: `${personName} (${cardUid}) ${direction} via ${method}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: `${method} punch: ${personName} (${direction})` })
      return NextResponse.json({
        ok: true,
        rfidDevices: nextDevices,
        rfidPunches: nextPunches,
        students: nextStudents,
        version: saved.version,
      })
    }

    // ==================== 5. FINE MANAGEMENT ====================
    if (action === 'issue_fine') {
      const studentId = String(body.studentId || '').trim()
      const amount = Number(body.amount || 0)
      const reason = String(body.reason || '').trim().slice(0, 300)
      const stu = students.find((s) => s.id === studentId)
      if (!stu || !Number.isFinite(amount) || amount <= 0 || !reason) {
        return NextResponse.json({ ok: false, error: 'Valid student, positive BDT amount, and reason are required.' }, { status: 400 })
      }
      const postToInvoice = Boolean(body.postToInvoice)
      const invoiceId = postToInvoice ? `inv-fine-${Date.now()}` : undefined
      const category = (body.category as StudentFineRecord['category']) || 'Late Tuition Fee'
      const newFine: StudentFineRecord = {
        id: `fine-${Date.now()}`,
        studentId: stu.id,
        studentName: stu.name,
        classLabel: `${stu.className} · ${stu.section}`,
        category,
        amount: Math.round(amount),
        reason,
        status: postToInvoice ? 'invoiced' : 'unpaid',
        issuedBy: session.display_name,
        issuedAt: new Date().toISOString().slice(0, 10),
        linkedInvoiceId: invoiceId,
      }
      const nextFines = [newFine, ...fines]
      const nextFees = postToInvoice
        ? [
            {
              id: invoiceId!,
              studentId: stu.id,
              studentName: stu.name,
              title: `${category} Fine — ${reason.slice(0, 60)}`,
              category: 'Other Fee' as FeeInvoice['category'],
              amount: Math.round(amount),
              dueDate: 'Due within 7 days',
              status: 'due' as const,
            },
            ...fees,
          ]
        : fees
      const notif = {
        id: `notif-fine-${Date.now()}`,
        title: `Fine Notice · ${stu.name}`,
        text: `${category} (৳${Math.round(amount).toLocaleString()}) issued for ${stu.name}: ${reason}`,
        time: 'Just now',
        type: 'fee',
        forRoles: ['guardian', 'admin'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)
      const saved = savePersistedState(
        { ...currentData, studentFines: nextFines, fees: nextFees, notifications: nextNotifs },
        session.display_name,
      )
      appendSecurityAudit({
        action: 'student_fine_issued',
        target: `${stu.name} · ${category} ৳${Math.round(amount)}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: notif.title })
      return NextResponse.json({
        ok: true,
        studentFines: nextFines,
        fees: nextFees,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    if (action === 'resolve_fine') {
      const fineId = String(body.fineId || '')
      const resolution = String(body.resolution || '') // 'paid' | 'waived' | 'invoiced'
      const waivedReason = String(body.waivedReason || '').trim().slice(0, 240)
      const target = fines.find((f) => f.id === fineId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Fine record not found.' }, { status: 404 })
      }
      let nextFees = fees
      let linkedInvoiceId = target.linkedInvoiceId
      if (resolution === 'invoiced' && !linkedInvoiceId) {
        linkedInvoiceId = `inv-fine-${Date.now()}`
        nextFees = [
          {
            id: linkedInvoiceId,
            studentId: target.studentId,
            studentName: target.studentName,
            title: `${target.category} Fine — ${target.reason.slice(0, 60)}`,
            category: 'Other Fee',
            amount: target.amount,
            dueDate: 'Due within 7 days',
            status: 'due',
          },
          ...fees,
        ]
      }
      const nextFines = fines.map((f) =>
        f.id === fineId
          ? {
              ...f,
              status: resolution as StudentFineRecord['status'],
              waivedReason: resolution === 'waived' ? waivedReason || `Waived by ${session.display_name}` : f.waivedReason,
              linkedInvoiceId,
            }
          : f,
      )
      let nextAccountingBook: unknown = currentData.accountingBook
      let autoVoucherNo: string | undefined
      if (resolution === 'paid' && target.status !== 'paid') {
        const book = loadAccountingBookSafe(currentData)
        const posted = appendAutoCreditVoucher(book, {
          amount: target.amount,
          title: `${target.category} Fine — ${target.reason.slice(0, 60)}`,
          category: 'Other Fee',
          paymentMethod: 'Cash',
          receiptNo: `FINE-${Date.now().toString().slice(-5)}`,
          partyName: target.studentName,
          actorName: session.display_name,
        })
        nextAccountingBook = posted.nextBook
        autoVoucherNo = posted.voucher.voucherNo
      }
      const saved = savePersistedState(
        {
          ...currentData,
          studentFines: nextFines,
          fees: nextFees,
          ...(autoVoucherNo ? { accountingBook: nextAccountingBook } : {}),
        },
        session.display_name,
      )
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Fine ${resolution} for ${target.studentName}${autoVoucherNo ? ` (${autoVoucherNo})` : ''}`,
      })
      return NextResponse.json({
        ok: true,
        studentFines: nextFines,
        fees: nextFees,
        ...(autoVoucherNo ? { accountingBook: nextAccountingBook, voucherNo: autoVoucherNo } : {}),
        version: saved.version,
      })
    }

    return NextResponse.json({ ok: false, error: `Unknown erp-ops action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'ERP operations request failed.' },
      { status: 500 },
    )
  }
}
