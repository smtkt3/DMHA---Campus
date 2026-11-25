import { NextResponse } from 'next/server'
import { appendAutoCreditVoucher, loadAccountingBookSafe } from '@/lib/dmhs-auto-voucher'
import {
  appendSecurityAudit,
  loadPersistedState,
  recordPaymentTransaction,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'
import type { FeeInvoice, GuardianRecord, StudentRecord } from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'staff', 'guardian', 'student'])
    if (!auth.ok) return auth.response
    const { session } = auth

    if (
      session.role === 'staff' &&
      !staffHasServerPermission(session.linked_entity_id, 'accounts')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Access Denied: Accounts permission required to collect fees.' },
        { status: 403 },
      )
    }

    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as {
      feeId?: string
      paymentMethod?: string
    }
    const feeId = String(body.feeId || '').trim()
    const paymentMethod = String(body.paymentMethod || (session.role === 'admin' || session.role === 'staff' ? 'Cash' : 'bKash'))

    if (!feeId) {
      return NextResponse.json({ ok: false, error: 'feeId is required.' }, { status: 400 })
    }

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const fees: FeeInvoice[] = Array.isArray(currentData.fees)
      ? (currentData.fees as FeeInvoice[])
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

    const target = fees.find((f) => f.id === feeId)
    if (!target) {
      return NextResponse.json({ ok: false, error: 'Fee invoice not found.' }, { status: 404 })
    }

    // Strict family/student ownership check for Guardian and Student sessions
    if (session.role === 'student' && target.studentId !== session.linked_entity_id) {
      return NextResponse.json(
        { ok: false, error: 'Access Denied: You can only pay your own invoices.' },
        { status: 403 },
      )
    }
    if (session.role === 'guardian') {
      const grd = guardians.find((g) => g.id === session.linked_entity_id)
      const linked = new Set<string>(grd?.linkedStudentIds || [])
      students
        .filter((s) => s.guardianId === session.linked_entity_id)
        .forEach((s) => linked.add(s.id))
      if (!linked.has(target.studentId)) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: Invoice does not belong to your linked children.' },
          { status: 403 },
        )
      }
    }

    if (target.status === 'paid') {
      return NextResponse.json({
        ok: true,
        alreadyPaid: true,
        fees:
          session.role === 'admin' || session.role === 'staff'
            ? fees
            : fees.filter((f) => f.studentId === target.studentId),
        receiptNo: target.receiptNo,
      })
    }

    const receiptNo = `SL-2026-${Math.floor(1000 + Math.random() * 8999)}`
    const todayPretty = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

    const nextFees: FeeInvoice[] = fees.map((f) =>
      f.id === feeId
        ? {
            ...f,
            status: 'paid',
            paidAt: todayPretty,
            receiptNo,
          }
        : f,
    )

    // Auto-post balanced Double-Entry Credit Voucher (Dr Cash/Bank, Cr Fee Income)
    const book = loadAccountingBookSafe(currentData)
    const { nextBook, voucher } = appendAutoCreditVoucher(book, {
      amount: target.amount,
      title: target.title,
      category: target.category || 'Tuition Fee',
      paymentMethod,
      receiptNo,
      partyName: target.studentName,
      actorName: session.display_name,
    })

    recordPaymentTransaction({
      transactionId: receiptNo,
      invoiceId: target.id,
      studentName: target.studentName,
      guardianName: session.display_name,
      amount: target.amount,
      method: paymentMethod,
      provider: 'DMHA Ledger',
      status: 'settled',
      verifiedBy: `${session.display_name} (${voucher.voucherNo})`,
    })

    const notif = {
      id: `notif-fee-${Date.now()}`,
      title: `School Fee Paid · ${target.studentName}`,
      text: `${target.title} (৳${target.amount.toLocaleString()}) paid · Receipt ${receiptNo} · Auto-posted ${voucher.voucherNo}.`,
      time: 'Just now',
      type: 'fee',
      forRoles: ['guardian', 'student', 'admin'],
      read: false,
    }
    const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

    const saved = savePersistedState(
      {
        ...currentData,
        fees: nextFees,
        accountingBook: nextBook,
        notifications: nextNotifs,
      },
      session.display_name,
    )

    appendSecurityAudit({
      action: 'fee_paid_double_entry_posted',
      target: `${target.studentName} · ৳${target.amount} · ${receiptNo} -> ${voucher.voucherNo}`,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: ip,
    })

    broadcastDmhsEvent({
      type: 'state_updated',
      version: saved.version,
      updatedAt: saved.updatedAt,
      updatedBy: session.display_name,
      summary: `Fee paid (${receiptNo}) & auto-posted ${voucher.voucherNo}`,
    })

    // Privacy-scope returned payload for non-admin roles
    const isFinanceStaff = session.role === 'admin' || session.role === 'staff'
    const returnedFees = isFinanceStaff
      ? nextFees
      : nextFees.filter((f) => {
          if (session.role === 'student') return f.studentId === session.linked_entity_id
          const grd = guardians.find((g) => g.id === session.linked_entity_id)
          const linked = new Set<string>(grd?.linkedStudentIds || [])
          students
            .filter((s) => s.guardianId === session.linked_entity_id)
            .forEach((s) => linked.add(s.id))
          return linked.has(f.studentId)
        })

    return NextResponse.json({
      ok: true,
      fees: returnedFees,
      ...(isFinanceStaff ? { accountingBook: nextBook } : {}),
      receiptNo,
      voucherNo: voucher.voucherNo,
      version: saved.version,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Fee payment failed.' },
      { status: 500 },
    )
  }
}
