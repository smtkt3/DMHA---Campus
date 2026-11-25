import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { loadAccountingBookSafe } from '@/lib/dmhs-auto-voucher'
import { appendAutoDebitVoucher } from '@/lib/dmhs-debit-voucher'
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

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ServerSalaryRow {
  id: string
  teacherId: string
  teacherName: string
  subject: string
  month: string
  baseSalary: number
  bonusAllowance: number
  lateDeduction: number
  netSalary: number
  status: 'paid' | 'pending'
  paidAt?: string
  bankRef?: string
}

interface ServerTeacherRow {
  id: string
  name: string
  subject: string
  status?: string
}

interface ServerExpenseRow {
  id: string
  title: string
  category: string
  vendor: string
  amount: number
  date: string
  status: 'paid' | 'pending'
  approvedBy: string
}

function generateBankRef(): string {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '')
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase()
  return `DMHA-PAY-${ym}-${rand}`
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth

    if (
      session.role === 'staff' &&
      !staffHasServerPermission(session.linked_entity_id, 'payroll')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: Your role does not have Teacher Payroll permission.' },
        { status: 403 },
      )
    }

    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as {
      action?: 'disburse_one' | 'disburse_all' | 'update_package' | 'generate_month'
      salaryId?: string
      month?: string
      baseSalary?: number
      bonusAllowance?: number
      lateDeduction?: number
    }

    const persisted = loadPersistedState()
    if (!persisted.exists || !persisted.data) {
      return NextResponse.json(
        { ok: false, error: 'School state has not been initialized yet.' },
        { status: 400 },
      )
    }

    const salaries: ServerSalaryRow[] = Array.isArray(persisted.data.teacherSalaries)
      ? (persisted.data.teacherSalaries as ServerSalaryRow[])
      : []
    const expenses: ServerExpenseRow[] = Array.isArray(persisted.data.expenses)
      ? (persisted.data.expenses as ServerExpenseRow[])
      : []
    const teachers: ServerTeacherRow[] = Array.isArray(persisted.data.teachers)
      ? (persisted.data.teachers as ServerTeacherRow[])
      : []

    const actorLabel = `${session.display_name} (${session.role})`

    if (body.action === 'update_package') {
      if (!body.salaryId) {
        return NextResponse.json({ ok: false, error: 'salaryId is required.' }, { status: 400 })
      }
      const target = salaries.find((s) => s.id === body.salaryId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Salary record not found.' }, { status: 404 })
      }
      if (target.status === 'paid') {
        return NextResponse.json(
          { ok: false, error: 'Cannot edit a salary slip that has already been disbursed.' },
          { status: 409 },
        )
      }
      const baseSalary = Math.max(0, Math.round(Number(body.baseSalary) || 0))
      const bonusAllowance = Math.max(0, Math.round(Number(body.bonusAllowance) || 0))
      const lateDeduction = Math.max(0, Math.round(Number(body.lateDeduction) || 0))
      const netSalary = Math.max(0, baseSalary + bonusAllowance - lateDeduction)

      const nextSalaries = salaries.map((s) =>
        s.id === body.salaryId
          ? { ...s, baseSalary, bonusAllowance, lateDeduction, netSalary }
          : s,
      )
      const saved = savePersistedState(
        { ...persisted.data, teacherSalaries: nextSalaries },
        actorLabel,
      )
      appendSecurityAudit({
        action: 'payroll_package_updated',
        target: `${target.teacherName} (${target.month}) · Net ৳${netSalary.toLocaleString()}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: actorLabel,
        summary: `Updated salary package · ${target.teacherName}`,
      })
      return NextResponse.json({
        ok: true,
        teacherSalaries: nextSalaries,
        version: saved.version,
      })
    }

    if (body.action === 'generate_month') {
      const targetMonth = (body.month || '').trim()
      if (!targetMonth) {
        return NextResponse.json(
          { ok: false, error: 'Please specify a target month (e.g., December 2026).' },
          { status: 400 },
        )
      }
      const existingForMonth = new Set(
        salaries
          .filter((s) => s.month.toLowerCase() === targetMonth.toLowerCase())
          .map((s) => s.teacherId),
      )
      const activeTeachers = teachers.filter((t) => t.status !== 'suspended')
      const created: ServerSalaryRow[] = []

      for (const tch of activeTeachers) {
        if (existingForMonth.has(tch.id)) continue
        const prevSlip = salaries.find((s) => s.teacherId === tch.id)
        const baseSalary = prevSlip?.baseSalary ?? 42000
        const bonusAllowance = prevSlip?.bonusAllowance ?? 3000
        created.push({
          id: `sal-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
          teacherId: tch.id,
          teacherName: tch.name,
          subject: tch.subject,
          month: targetMonth,
          baseSalary,
          bonusAllowance,
          lateDeduction: 0,
          netSalary: baseSalary + bonusAllowance,
          status: 'pending',
        })
      }

      if (created.length === 0) {
        return NextResponse.json(
          { ok: false, error: `Payroll for ${targetMonth} already exists for all active faculty.` },
          { status: 409 },
        )
      }

      const nextSalaries = [...created, ...salaries]
      const saved = savePersistedState(
        { ...persisted.data, teacherSalaries: nextSalaries },
        actorLabel,
      )
      appendSecurityAudit({
        action: 'payroll_month_generated',
        target: `${targetMonth} · ${created.length} faculty slips generated`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: actorLabel,
        summary: `Generated ${targetMonth} payroll (${created.length} teachers)`,
      })
      return NextResponse.json({
        ok: true,
        createdCount: created.length,
        month: targetMonth,
        teacherSalaries: nextSalaries,
        version: saved.version,
      })
    }

    if (body.action === 'disburse_one' || body.action === 'disburse_all') {
      const targetMonthFilter = body.month?.trim().toLowerCase()
      const targets =
        body.action === 'disburse_one'
          ? salaries.filter((s) => s.id === body.salaryId)
          : salaries.filter(
              (s) =>
                s.status === 'pending' &&
                (!targetMonthFilter || s.month.toLowerCase() === targetMonthFilter),
            )

      if (targets.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              body.action === 'disburse_one'
                ? 'Salary slip not found.'
                : 'No pending faculty salaries found to disburse.',
          },
          { status: 404 },
        )
      }

      if (body.action === 'disburse_one' && targets[0].status === 'paid') {
        return NextResponse.json(
          { ok: false, error: 'This salary slip has already been disbursed.' },
          { status: 409 },
        )
      }

      const now = new Date()
      const paidAt = `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

      const disbursedSummary: {
        salaryId: string
        teacherName: string
        month: string
        netSalary: number
        bankRef: string
      }[] = []
      const newExpenses: Array<ServerExpenseRow & { voucherNo?: string }> = []
      const refBySalaryId = new Map<string, string>()
      let nextAccountingBook = loadAccountingBookSafe(persisted.data as Record<string, unknown>)

      for (const slip of targets) {
        if (slip.status === 'paid') continue
        const bankRef = generateBankRef()
        refBySalaryId.set(slip.id, bankRef)
        disbursedSummary.push({
          salaryId: slip.id,
          teacherName: slip.teacherName,
          month: slip.month,
          netSalary: slip.netSalary,
          bankRef,
        })

        // 1. Write server-immutable record to dmhs_payment_transactions
        recordPaymentTransaction({
          transactionId: bankRef,
          invoiceId: slip.id,
          studentName: `${slip.teacherName} (Faculty Payroll)`,
          guardianName: `${slip.month} Salary · ${slip.subject}`,
          amount: slip.netSalary,
          method: 'Bank Transfer (Payroll)',
          provider: 'DMHA Payroll Office',
          status: 'settled',
          verifiedBy: actorLabel,
        })

        // 1b. Auto-post balanced Double-Entry Debit Voucher (Salary Expense Dr / Bank Cr)
        const posted = appendAutoDebitVoucher(nextAccountingBook, {
          amount: slip.netSalary,
          title: `${slip.month} Salary — ${slip.teacherName} (${bankRef})`,
          category: 'Teacher Payroll',
          vendor: slip.teacherName,
          paymentMethod: 'Bank',
          actorName: session.display_name,
        })
        nextAccountingBook = posted.nextBook

        // 2. Append Teacher Payroll expense to Accounts & Finance ledger
        newExpenses.push({
          id: `exp-pay-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
          title: `${slip.month} Salary — ${slip.teacherName} (${bankRef})`,
          category: 'Teacher Payroll',
          vendor: `Bank Transfer · ${slip.teacherName}`,
          amount: slip.netSalary,
          date: dateStr,
          status: 'paid',
          approvedBy: session.display_name,
          voucherNo: posted.voucher.voucherNo,
        })

        // 3. Immutable Security Audit entry
        appendSecurityAudit({
          action: 'faculty_salary_disbursed',
          target: `${slip.teacherName} · ${slip.month} · ৳${slip.netSalary.toLocaleString()} (${bankRef})`,
          actor: session.display_name,
          actorRole: session.role,
          ipAddress: ip,
        })
      }

      const nextSalaries = salaries.map((s) => {
        const ref = refBySalaryId.get(s.id)
        if (!ref) return s
        return { ...s, status: 'paid' as const, paidAt, bankRef: ref }
      })
      const nextExpenses = [...newExpenses, ...expenses]

      const saved = savePersistedState(
        {
          ...persisted.data,
          teacherSalaries: nextSalaries,
          expenses: nextExpenses,
          accountingBook: nextAccountingBook,
        },
        actorLabel,
      )

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: actorLabel,
        summary: `Disbursed ${disbursedSummary.length} faculty salary slip(s)`,
      })

      return NextResponse.json({
        ok: true,
        disbursed: disbursedSummary,
        teacherSalaries: nextSalaries,
        expenses: nextExpenses,
        accountingBook: nextAccountingBook,
        version: saved.version,
      })
    }

    return NextResponse.json({ ok: false, error: 'Unsupported payroll action.' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Payroll processing failed' },
      { status: 500 },
    )
  }
}
