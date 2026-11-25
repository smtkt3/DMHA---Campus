import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { dispatchCampusAlert } from '@/lib/dmhs-messaging'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'
import { initialClassFeeSchedules } from '@/components/school/data'
import type {
  ClassFeeScheduleItem,
  FeeInvoice,
  GuardianRecord,
  StudentRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatNow(): string {
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `Today · ${t}`
}

function resolveFamilyKey(student: StudentRecord, guardians: GuardianRecord[]): string {
  if (student.guardianId) return student.guardianId
  const linked = guardians.find((g) => g.linkedStudentIds?.includes(student.id))
  if (linked) return linked.id
  const phoneNorm = String(student.guardianPhone || '').replace(/[^\d]/g, '')
  if (phoneNorm.length >= 6) return `phone:${phoneNorm}`
  return `stu:${student.id}`
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    if (
      session.role === 'staff' &&
      !staffHasServerPermission(session.linked_entity_id, 'accounts')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Only Admins or Accounts Officers can run Monthly Billing Generation.' },
        { status: 403 },
      )
    }

    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '').trim()

    const persisted = loadPersistedState()
    const currentData = (persisted?.data || {}) as Record<string, unknown>
    const students = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const guardians = Array.isArray(currentData.guardians)
      ? (currentData.guardians as GuardianRecord[])
      : []
    const fees = Array.isArray(currentData.fees) ? (currentData.fees as FeeInvoice[]) : []
    const schedules = Array.isArray(currentData.classFeeSchedules)
      ? (currentData.classFeeSchedules as ClassFeeScheduleItem[])
      : Array.isArray(initialClassFeeSchedules)
        ? initialClassFeeSchedules
        : []
    const existingSiblingPct =
      typeof currentData.siblingDiscountPct === 'number' ? currentData.siblingDiscountPct : 10
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []
    const existingParentAlerts = Array.isArray(currentData.parentAlerts)
      ? (currentData.parentAlerts as Array<Record<string, unknown>>)
      : []

    // ==================== 1. SAVE CLASS FEE SCHEDULE & SIBLING DISCOUNT ====================
    if (action === 'save_schedule') {
      const rawSchedules = Array.isArray(body.schedules)
        ? (body.schedules as Partial<ClassFeeScheduleItem>[])
        : []
      const siblingDiscountPct = Math.min(
        50,
        Math.max(0, Math.round(Number(body.siblingDiscountPct ?? existingSiblingPct) || 0)),
      )

      const nextSchedules: ClassFeeScheduleItem[] =
        rawSchedules.length > 0
          ? rawSchedules.map((s) => ({
              className: String(s.className || 'Class 1').trim(),
              monthlyTuition: Math.max(0, Math.round(Number(s.monthlyTuition) || 0)),
              activityFee: Math.max(0, Math.round(Number(s.activityFee) || 0)),
            }))
          : schedules

      const saved = savePersistedState(
        {
          ...currentData,
          classFeeSchedules: nextSchedules,
          siblingDiscountPct,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'fee_schedule_updated',
        target: `${nextSchedules.length} class tiers · Sibling discount ${siblingDiscountPct}%`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Updated monthly fee schedule (Sibling Discount: ${siblingDiscountPct}%)`,
      })

      return NextResponse.json({
        ok: true,
        classFeeSchedules: nextSchedules,
        siblingDiscountPct,
        version: saved.version,
      })
    }

    // ==================== 2. AUTO-GENERATE MONTHLY INVOICES WITH SIBLING DISCOUNTS ====================
    if (action === 'generate_monthly') {
      const billingMonth = String(body.billingMonth || '').trim().slice(0, 40)
      const dueDate = String(body.dueDate || '').trim().slice(0, 30)
      const targetClass = String(body.targetClass || 'All Classes').trim()
      const siblingDiscountPct = Math.min(
        50,
        Math.max(0, Math.round(Number(body.siblingDiscountPct ?? existingSiblingPct) || 0)),
      )
      const includeActivityFee = body.includeActivityFee !== false

      if (!billingMonth || !dueDate) {
        return NextResponse.json(
          { ok: false, error: 'Billing month (e.g., December 2026) and due date are required.' },
          { status: 400 },
        )
      }

      const activeStudents = students.filter((s) => s.status !== 'suspended')
      const eligibleStudents =
        targetClass === 'All Classes'
          ? activeStudents
          : activeStudents.filter((s) => s.className.toLowerCase() === targetClass.toLowerCase())

      if (eligibleStudents.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'No active students match the selected class filter.' },
          { status: 400 },
        )
      }

      // Group ALL active students by family so 2nd+ children automatically get the sibling discount
      const familyGroups = new Map<string, StudentRecord[]>()
      activeStudents.forEach((stu) => {
        const key = resolveFamilyKey(stu, guardians)
        const list = familyGroups.get(key) || []
        list.push(stu)
        familyGroups.set(key, list)
      })

      const siblingStudentIds = new Set<string>()
      familyGroups.forEach((members) => {
        if (members.length >= 2) {
          // Sort oldest/highest class first so 1st child pays full and 2nd+ siblings receive discount
          const ordered = [...members].sort((a, b) => b.className.localeCompare(a.className))
          ordered.slice(1).forEach((sib) => siblingStudentIds.add(sib.id))
        }
      })

      const createdInvoices: FeeInvoice[] = []
      let skippedDuplicates = 0
      let siblingDiscountsApplied = 0
      let totalDiscountBdt = 0

      eligibleStudents.forEach((stu, idx) => {
        const alreadyExists = fees.some(
          (f) =>
            f.studentId === stu.id &&
            f.title.toLowerCase().includes(billingMonth.toLowerCase()),
        )
        if (alreadyExists) {
          skippedDuplicates += 1
          return
        }

        const sched = schedules.find(
          (sc) => sc.className.toLowerCase() === stu.className.toLowerCase(),
        ) || { className: stu.className, monthlyTuition: 4200, activityFee: 500 }

        const gross = sched.monthlyTuition + (includeActivityFee ? sched.activityFee : 0)
        const isSibling = siblingStudentIds.has(stu.id) && siblingDiscountPct > 0
        const discountAmt = isSibling ? Math.round((sched.monthlyTuition * siblingDiscountPct) / 100) : 0
        const netAmount = Math.max(0, gross - discountAmt)

        if (isSibling && discountAmt > 0) {
          siblingDiscountsApplied += 1
          totalDiscountBdt += discountAmt
        }

        createdInvoices.push({
          id: `fee-gen-${Date.now()}-${idx}`,
          studentId: stu.id,
          studentName: stu.name,
          title: isSibling
            ? `${billingMonth} Tuition${includeActivityFee ? ' & Activity' : ''} (${siblingDiscountPct}% Sibling Discount -৳${discountAmt})`
            : `${billingMonth} Tuition${includeActivityFee ? ' & Activity Fee' : ' Fee'}`,
          category: 'Tuition Fee',
          amount: netAmount,
          dueDate,
          status: 'due',
        })
      })

      if (createdInvoices.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `All ${skippedDuplicates} eligible student(s) already have a ${billingMonth} invoice generated.`,
          },
          { status: 409 },
        )
      }

      const nextFees = [...createdInvoices, ...fees]
      const totalBilled = createdInvoices.reduce((sum, inv) => sum + inv.amount, 0)
      const notif = {
        id: `notif-bill-${Date.now()}`,
        title: `${billingMonth} School Fee Invoices Published`,
        text: `Generated ${createdInvoices.length} monthly invoice(s) totaling ৳${totalBilled.toLocaleString()} (Due: ${dueDate})${siblingDiscountsApplied > 0 ? ` · ${siblingDiscountsApplied} automatic ${siblingDiscountPct}% sibling discount(s) applied.` : '.'}`,
        time: 'Just now',
        type: 'fee',
        forRoles: ['guardian', 'student', 'admin', 'staff'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        {
          ...currentData,
          fees: nextFees,
          siblingDiscountPct,
          notifications: nextNotifs,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'monthly_invoices_generated',
        target: `${billingMonth}: ${createdInvoices.length} invoices (৳${totalBilled.toLocaleString()}), ${siblingDiscountsApplied} sibling discount(s) (-৳${totalDiscountBdt.toLocaleString()}), ${skippedDuplicates} skipped`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: notif.title,
      })

      return NextResponse.json({
        ok: true,
        createdCount: createdInvoices.length,
        skippedDuplicates,
        siblingDiscountsApplied,
        totalDiscountBdt,
        totalBilled,
        fees: nextFees,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 3. BULK FEE DUE REMINDERS (SMS / WHATSAPP GATEWAY) ====================
    if (action === 'send_due_reminders') {
      const dueInvoices = fees.filter((f) => f.status === 'due')
      if (dueInvoices.length === 0) {
        return NextResponse.json({ ok: false, error: 'All invoices are already paid!' }, { status: 400 })
      }
      let gatewayProvider = 'DMHA Sandbox (WhatsApp)'
      let gatewayMode: 'live_provider' | 'sandbox_logged' = 'sandbox_logged'
      const newAlerts = await Promise.all(
        dueInvoices.slice(0, 20).map(async (inv, idx) => {
          const stu = students.find((s) => s.id === inv.studentId)
          const grd = guardians.find(
            (g) => g.id === stu?.guardianId || g.linkedStudentIds?.includes(inv.studentId),
          )
          const phone = grd?.phone || stu?.guardianPhone || ''
          const msg = `DMHA Accounts Reminder: ${inv.title} (৳${inv.amount.toLocaleString()}) for ${inv.studentName} is due on ${inv.dueDate}. Pay conveniently in the DMHA Smart Learning App.`
          let delivered = true
          if (phone) {
            const dispatched = await dispatchCampusAlert({
              channel: 'WhatsApp',
              to: phone,
              message: msg,
              actor: session.display_name,
              actorRole: session.role,
              ipAddress: ip,
            })
            delivered = dispatched.ok
            gatewayProvider = dispatched.provider
            gatewayMode = dispatched.mode
          }
          return {
            id: `pa-fee-${Date.now()}-${idx}`,
            studentId: inv.studentId,
            studentName: inv.studentName,
            recipientName: grd?.name || stu?.guardianName || 'Guardian',
            recipientPhone: phone || 'App Push',
            channel: 'WhatsApp',
            category: 'Fee Reminder',
            message: msg,
            sentAt: formatNow(),
            sentBy: session.display_name,
            status: delivered ? 'delivered' : 'queued',
          }
        }),
      )
      const nextParentAlerts = [...newAlerts, ...existingParentAlerts].slice(0, 120)
      const notif = {
        id: `notif-feerem-${Date.now()}`,
        title: `Fee Payment Reminder (${dueInvoices.length} Unpaid)`,
        text: `DMHA Accounts dispatched payment reminders for ${dueInvoices.length} open fee invoice(s) via ${gatewayProvider}. Check School Fees to pay online or download receipts.`,
        time: 'Just now',
        type: 'fee',
        forRoles: ['guardian', 'admin', 'staff'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        { ...currentData, parentAlerts: nextParentAlerts, notifications: nextNotifs },
        session.display_name,
      )
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Dispatched ${newAlerts.length} fee due reminders (${gatewayProvider})`,
      })
      return NextResponse.json({
        ok: true,
        remindedCount: newAlerts.length,
        gatewayProvider,
        gatewayMode,
        parentAlerts: nextParentAlerts,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Billing generator operation failed.' },
      { status: 500 },
    )
  }
}
