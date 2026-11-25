import { NextResponse } from 'next/server'
import { appendSecurityAudit, loadPersistedState, savePersistedState } from '@/lib/dmhs-db'
import { appendAutoCreditVoucher, loadAccountingBookSafe } from '@/lib/dmhs-auto-voucher'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'
import type {
  CanteenTransaction,
  CanteenWallet,
  GuardianRecord,
  StudentRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'staff', 'guardian'])
    if (!auth.ok) return auth.response
    const { session } = auth

    if (
      session.role === 'staff' &&
      !staffHasServerPermission(session.linked_entity_id, 'canteen') &&
      !staffHasServerPermission(session.linked_entity_id, 'accounts')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Access Denied: Canteen or Accounts permission required.' },
        { status: 403 },
      )
    }

    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')
    const studentId = String(body.studentId || '')

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const students: StudentRecord[] = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const guardians: GuardianRecord[] = Array.isArray(currentData.guardians)
      ? (currentData.guardians as GuardianRecord[])
      : []
    const canteenWallets: CanteenWallet[] = Array.isArray(currentData.canteenWallets)
      ? (currentData.canteenWallets as CanteenWallet[])
      : []
    const canteenTransactions: CanteenTransaction[] = Array.isArray(
      currentData.canteenTransactions,
    )
      ? (currentData.canteenTransactions as CanteenTransaction[])
      : []

    const stu = students.find((s) => s.id === studentId)
    if (!stu) {
      return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
    }

    // Strict Guardian ownership guard
    if (session.role === 'guardian') {
      const g = guardians.find((x) => x.id === session.linked_entity_id)
      const linked = new Set<string>(g?.linkedStudentIds || [])
      students
        .filter((s) => s.guardianId === session.linked_entity_id)
        .forEach((s) => linked.add(s.id))
      if (!linked.has(studentId)) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: You can only manage your own child’s canteen wallet.' },
          { status: 403 },
        )
      }
    }

    if (action === 'top_up_wallet') {
      const amount = Math.max(0, Math.round(Number(body.amount || 0)))
      if (amount <= 0 || amount > 50000) {
        return NextResponse.json(
          { ok: false, error: 'Top-up amount must be between ৳1 and ৳50,000.' },
          { status: 400 },
        )
      }

      const exists = canteenWallets.some((w) => w.studentId === studentId)
      const nextWallets = exists
        ? canteenWallets.map((w) =>
            w.studentId === studentId ? { ...w, balance: w.balance + amount } : w,
          )
        : [
            { studentId, balance: amount, dailyLimit: 250, allergyGuard: 'None reported' },
            ...canteenWallets,
          ]

      const nowTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const tx: CanteenTransaction = {
        id: `ctx-topup-${Date.now()}`,
        studentId,
        item: `Wallet Top-Up (+৳${amount}) by ${session.display_name}`,
        amount,
        time: `Today, ${nowTime}`,
        calories: 'Credit',
      }
      const nextTx = [tx, ...canteenTransactions].slice(0, 150)

      const accountingBook = loadAccountingBookSafe(currentData)
      const posted = appendAutoCreditVoucher(accountingBook, {
        amount,
        title: `Canteen Wallet Top-Up — ${stu.name}`,
        category: 'Canteen Revenue',
        paymentMethod: String(body.paymentMethod || 'bKash / Nagad'),
        partyName: stu.name,
        actorName: session.display_name,
      })

      const saved = savePersistedState(
        {
          ...currentData,
          canteenWallets: nextWallets,
          canteenTransactions: nextTx,
          accountingBook: posted.nextBook,
        },
        session.display_name,
      )
      appendSecurityAudit({
        action: 'canteen_wallet_topped_up',
        target: `${stu.name} +৳${amount} (${posted.voucher.voucherNo})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Canteen wallet top-up for ${stu.name} (+৳${amount})`,
      })

      return NextResponse.json({
        ok: true,
        voucherNo: posted.voucher.voucherNo,
        canteenWallets: nextWallets,
        canteenTransactions: nextTx,
        accountingBook: session.role === 'guardian' ? undefined : posted.nextBook,
        version: saved.version,
      })
    }

    if (action === 'update_limit') {
      const dailyLimit = Math.max(50, Math.min(2000, Math.round(Number(body.dailyLimit || 250))))
      const exists = canteenWallets.some((w) => w.studentId === studentId)
      const nextWallets = exists
        ? canteenWallets.map((w) =>
            w.studentId === studentId ? { ...w, dailyLimit } : w,
          )
        : [
            { studentId, balance: 500, dailyLimit, allergyGuard: 'None reported' },
            ...canteenWallets,
          ]

      const saved = savePersistedState(
        { ...currentData, canteenWallets: nextWallets },
        session.display_name,
      )
      appendSecurityAudit({
        action: 'canteen_limit_updated',
        target: `${stu.name} daily limit -> ৳${dailyLimit}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Updated canteen daily limit for ${stu.name} (৳${dailyLimit})`,
      })

      return NextResponse.json({
        ok: true,
        canteenWallets: nextWallets,
        version: saved.version,
      })
    }

    return NextResponse.json(
      { ok: false, error: `Unknown canteen action: ${action}` },
      { status: 400 },
    )
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Canteen action failed.' },
      { status: 500 },
    )
  }
}
