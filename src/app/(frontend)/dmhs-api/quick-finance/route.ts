import { NextResponse } from 'next/server'
import { appendSecurityAudit, loadPersistedState, savePersistedState } from '@/lib/dmhs-db'
import { appendAutoCreditVoucher, loadAccountingBookSafe } from '@/lib/dmhs-auto-voucher'
import { appendAutoDebitVoucher } from '@/lib/dmhs-debit-voucher'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'
import type {
  ExpenseCategory,
  ExpenseRecord,
  OtherIncomeRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth

    if (
      session.role === 'staff' &&
      !staffHasServerPermission(session.linked_entity_id, 'accounts')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Access Denied: Accounts & Finance permission required.' },
        { status: 403 },
      )
    }

    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const expenses: ExpenseRecord[] = Array.isArray(currentData.expenses)
      ? (currentData.expenses as ExpenseRecord[])
      : []
    const otherIncomes: OtherIncomeRecord[] = Array.isArray(currentData.otherIncomes)
      ? (currentData.otherIncomes as OtherIncomeRecord[])
      : []
    const accountingBook = loadAccountingBookSafe(currentData)
    const todayLabel = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

    const commit = (
      patch: Record<string, unknown>,
      summary: string,
      auditAction: string,
      auditTarget: string,
      extra?: Record<string, unknown>,
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
      return NextResponse.json({
        ok: true,
        ...patch,
        ...(extra || {}),
        version: saved.version,
      })
    }

    if (action === 'add_expense') {
      const title = String(body.title || '').trim().slice(0, 140)
      const category = (String(body.category || 'Campus Operations') as ExpenseCategory)
      const vendor = String(body.vendor || 'Campus Vendor').trim().slice(0, 100) || 'Campus Vendor'
      const amount = Math.max(0, Math.round(Number(body.amount || 0)))
      const status: 'paid' | 'pending' = body.status === 'pending' ? 'pending' : 'paid'
      if (!title || amount <= 0) {
        return NextResponse.json(
          { ok: false, error: 'Expense title and positive amount are required.' },
          { status: 400 },
        )
      }

      let nextBook = accountingBook
      let voucherNo: string | undefined
      if (status === 'paid') {
        const posted = appendAutoDebitVoucher(accountingBook, {
          amount,
          title,
          category,
          vendor,
          paymentMethod: String(body.paymentMethod || 'Cash'),
          actorName: session.display_name,
        })
        nextBook = posted.nextBook
        voucherNo = posted.voucher.voucherNo
      }

      const next: ExpenseRecord = {
        id: `exp-${Date.now()}`,
        title,
        category,
        vendor,
        amount,
        date: todayLabel,
        status,
        approvedBy: session.display_name,
        voucherNo,
      }

      return commit(
        {
          expenses: [next, ...expenses],
          accountingBook: nextBook,
        },
        `Logged cost: ${title} (৳${amount.toLocaleString()})${voucherNo ? ` · Auto-Voucher ${voucherNo}` : ''}`,
        'quick_expense_added',
        `${title} · ৳${amount}${voucherNo ? ` (${voucherNo})` : ''}`,
        { voucherNo },
      )
    }

    if (action === 'toggle_expense_status') {
      const expenseId = String(body.expenseId || '')
      const target = expenses.find((e) => e.id === expenseId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Expense record not found.' }, { status: 404 })
      }
      const nextStatus: 'paid' | 'pending' = target.status === 'paid' ? 'pending' : 'paid'
      let nextBook = accountingBook
      let voucherNo = target.voucherNo

      // Post balanced Debit Voucher once when transitioning pending -> paid
      if (nextStatus === 'paid' && !voucherNo) {
        const posted = appendAutoDebitVoucher(accountingBook, {
          amount: target.amount,
          title: target.title,
          category: target.category,
          vendor: target.vendor,
          paymentMethod: 'Cash',
          actorName: session.display_name,
        })
        nextBook = posted.nextBook
        voucherNo = posted.voucher.voucherNo
      }

      const nextExpenses = expenses.map((e) =>
        e.id === expenseId ? { ...e, status: nextStatus, voucherNo } : e,
      )
      return commit(
        {
          expenses: nextExpenses,
          accountingBook: nextBook,
        },
        `Marked expense "${target.title}" as ${nextStatus}${voucherNo ? ` (${voucherNo})` : ''}`,
        'quick_expense_toggled',
        `${target.title} -> ${nextStatus}`,
        { voucherNo },
      )
    }

    if (action === 'delete_expense') {
      if (session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Admin can delete recorded expenses.' },
          { status: 403 },
        )
      }
      const expenseId = String(body.expenseId || '')
      const target = expenses.find((e) => e.id === expenseId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Expense not found.' }, { status: 404 })
      }
      const nextExpenses = expenses.filter((e) => e.id !== expenseId)
      return commit(
        { expenses: nextExpenses },
        `Removed expense "${target.title}"`,
        'quick_expense_deleted',
        `${target.title} (৳${target.amount})`,
      )
    }

    if (action === 'add_other_income') {
      const title = String(body.title || '').trim().slice(0, 140)
      const category =
        (body.category as OtherIncomeRecord['category']) || 'Other Income'
      const amount = Math.max(0, Math.round(Number(body.amount || 0)))
      if (!title || amount <= 0) {
        return NextResponse.json(
          { ok: false, error: 'Income title and positive amount are required.' },
          { status: 400 },
        )
      }

      const posted = appendAutoCreditVoucher(accountingBook, {
        amount,
        title,
        category,
        paymentMethod: String(body.paymentMethod || 'Cash'),
        partyName: category,
        actorName: session.display_name,
      })

      const next: OtherIncomeRecord = {
        id: `inc-${Date.now()}`,
        title,
        category,
        amount,
        date: todayLabel,
        voucherNo: posted.voucher.voucherNo,
      }

      return commit(
        {
          otherIncomes: [next, ...otherIncomes],
          accountingBook: posted.nextBook,
        },
        `Logged income: ${title} (৳${amount.toLocaleString()}) · Auto-Voucher ${posted.voucher.voucherNo}`,
        'other_income_added',
        `${title} · ৳${amount} (${posted.voucher.voucherNo})`,
        { voucherNo: posted.voucher.voucherNo },
      )
    }

    return NextResponse.json(
      { ok: false, error: `Unknown quick-finance action: ${action}` },
      { status: 400 },
    )
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Quick finance action failed.' },
      { status: 500 },
    )
  }
}
