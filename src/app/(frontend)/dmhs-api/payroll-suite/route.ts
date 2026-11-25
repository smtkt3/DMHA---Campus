import { NextResponse } from 'next/server'
import { initialAccountingBook } from '@/lib/dmhs-accounting'
import { appendSecurityAudit, loadPersistedState, savePersistedState } from '@/lib/dmhs-db'
import {
  computeEmployeeMonthlyPayroll,
  initialPayrollBook,
} from '@/lib/dmhs-payroll'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'
import type {
  AccountingBookState,
  AccountingVoucher,
  PayrollAdjustmentItem,
  PayrollAttendanceMonthRecord,
  PayrollBookState,
  PayrollDisbursementRecord,
  PayrollEmployeeProfile,
  TeacherAttendanceLog,
  TeacherSalaryRecord,
  VoucherEntryLine,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function loadPayrollBook(currentData: Record<string, unknown>): PayrollBookState {
  const raw = currentData.payrollBook as Partial<PayrollBookState> | undefined
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.employees)) {
    return structuredClone(initialPayrollBook)
  }
  return {
    employees: raw.employees,
    adjustments: Array.isArray(raw.adjustments) ? raw.adjustments : initialPayrollBook.adjustments,
    attendance: Array.isArray(raw.attendance) ? raw.attendance : initialPayrollBook.attendance,
    disbursements: Array.isArray(raw.disbursements)
      ? raw.disbursements
      : initialPayrollBook.disbursements,
    settings:
      raw.settings && typeof raw.settings === 'object'
        ? { ...initialPayrollBook.settings, ...raw.settings }
        : initialPayrollBook.settings,
  }
}

function loadAccountingBook(currentData: Record<string, unknown>): AccountingBookState {
  const raw = currentData.accountingBook as Partial<AccountingBookState> | undefined
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.ledgers)) {
    return structuredClone(initialAccountingBook)
  }
  return {
    groups: Array.isArray(raw.groups) ? raw.groups : initialAccountingBook.groups,
    subGroups: Array.isArray(raw.subGroups) ? raw.subGroups : initialAccountingBook.subGroups,
    ledgers: raw.ledgers,
    banks: Array.isArray(raw.banks) ? raw.banks : initialAccountingBook.banks,
    parties: Array.isArray(raw.parties) ? raw.parties : initialAccountingBook.parties,
    cheques: Array.isArray(raw.cheques) ? raw.cheques : initialAccountingBook.cheques,
    pettyCashFunds: Array.isArray(raw.pettyCashFunds)
      ? raw.pettyCashFunds
      : initialAccountingBook.pettyCashFunds,
    pettyCashRequisitions: Array.isArray(raw.pettyCashRequisitions)
      ? raw.pettyCashRequisitions
      : initialAccountingBook.pettyCashRequisitions,
    vouchers: Array.isArray(raw.vouchers) ? raw.vouchers : initialAccountingBook.vouchers,
  }
}

function nextDebitVoucherNo(vouchers: AccountingVoucher[]): string {
  const prefix = 'DV-2026-'
  const nums = vouchers
    .filter((v) => v.voucherNo.startsWith(prefix))
    .map((v) => Number.parseInt(v.voucherNo.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
  const next = (nums.length > 0 ? Math.max(...nums) : 200) + 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth

    if (
      session.role === 'staff' &&
      !staffHasServerPermission(session.linked_entity_id, 'accounts') &&
      !staffHasServerPermission(session.linked_entity_id, 'payroll')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Access Denied: Accounts or Payroll permission is required.' },
        { status: 403 },
      )
    }

    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const book = loadPayrollBook(currentData)
    const todayIso = new Date().toISOString().slice(0, 10)

    const saveAndReply = (
      nextPayroll: PayrollBookState,
      extraData: Record<string, unknown>,
      summary: string,
      auditAction: string,
      auditTarget: string,
    ) => {
      const saved = savePersistedState(
        { ...currentData, payrollBook: nextPayroll, ...extraData },
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
        payrollBook: nextPayroll,
        ...extraData,
        version: saved.version,
      })
    }

    // ==================== 1. BASE SALARY MANAGEMENT & QUICK ADD ====================
    if (action === 'save_base_salaries') {
      const updates = Array.isArray(body.updates)
        ? (body.updates as Array<{ id: string; baseSalary: number; designation?: string; active?: boolean }>)
        : []
      if (updates.length === 0) {
        return NextResponse.json({ ok: false, error: 'No salary updates provided.' }, { status: 400 })
      }
      const updateMap = new Map(updates.map((u) => [u.id, u]))
      const nextEmployees = book.employees.map((e) => {
        const u = updateMap.get(e.id)
        if (!u) return e
        return {
          ...e,
          baseSalary: Math.max(0, Math.round(Number(u.baseSalary || 0))),
          designation: u.designation ? String(u.designation).trim().slice(0, 80) : e.designation,
          active: typeof u.active === 'boolean' ? u.active : e.active,
        }
      })
      return saveAndReply(
        { ...book, employees: nextEmployees },
        {},
        `Updated base salary for ${updates.length} employee(s)`,
        'payroll_base_salaries_updated',
        `${updates.length} employee record(s)`,
      )
    }

    if (action === 'add_employee') {
      const name = String(body.name || '').trim().slice(0, 100)
      const designation = String(body.designation || '').trim().slice(0, 80)
      const employeeType = body.employeeType === 'staff' ? 'staff' : 'teacher'
      const department = String(body.department || (employeeType === 'teacher' ? 'Academic Faculty' : 'Administration')).trim()
      const baseSalary = Math.max(0, Math.round(Number(body.baseSalary || 0)))
      if (!name || !designation || baseSalary <= 0) {
        return NextResponse.json(
          { ok: false, error: 'Employee name, designation, and positive base salary are required.' },
          { status: 400 },
        )
      }
      const codePrefix = employeeType === 'teacher' ? 'TCH' : 'STF'
      const emp: PayrollEmployeeProfile = {
        id: `emp-${Date.now()}`,
        employeeCode: `${codePrefix}-${String(book.employees.length + 10).padStart(3, '0')}`,
        name,
        employeeType,
        designation,
        department,
        phone: String(body.phone || '').trim() || undefined,
        email: String(body.email || '').trim() || undefined,
        baseSalary,
        bankAccountLabel: String(body.bankAccountLabel || 'EXIM Bank Payroll').trim(),
        active: true,
      }
      return saveAndReply(
        { ...book, employees: [...book.employees, emp] },
        {},
        `Added ${name} to Payroll`,
        'payroll_employee_added',
        `${emp.employeeCode} · ${name} (৳${baseSalary})`,
      )
    }

    if (action === 'toggle_employee_status') {
      const employeeId = String(body.employeeId || '')
      const nextEmployees = book.employees.map((e) =>
        e.id === employeeId ? { ...e, active: !e.active } : e,
      )
      return saveAndReply(
        { ...book, employees: nextEmployees },
        {},
        'Employee payroll status toggled',
        'payroll_employee_toggled',
        employeeId,
      )
    }

    // ==================== 2. ALLOWANCES, BONUSES & DEDUCTIONS ====================
    if (action === 'save_adjustment') {
      const employeeId = String(body.employeeId || '').trim()
      const kind = body.kind as PayrollAdjustmentItem['kind']
      const title = String(body.title || '').trim().slice(0, 120)
      const amount = Math.round(Number(body.amount || 0))
      const month = String(body.month || 'Recurring').trim()
      const notes = String(body.notes || '').trim().slice(0, 240)
      if (
        !book.employees.some((e) => e.id === employeeId) ||
        !['allowance', 'bonus', 'deduction'].includes(kind) ||
        !title ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return NextResponse.json(
          { ok: false, error: 'Valid employee, adjustment kind, title, and positive BDT amount are required.' },
          { status: 400 },
        )
      }
      const item: PayrollAdjustmentItem = {
        id: `adj-${Date.now()}`,
        employeeId,
        kind,
        title,
        amount,
        month,
        notes: notes || undefined,
        active: true,
      }
      return saveAndReply(
        { ...book, adjustments: [item, ...book.adjustments] },
        {},
        `Added ${kind}: ${title} (৳${amount.toLocaleString()})`,
        `payroll_${kind}_added`,
        `${employeeId} · ${title} · ৳${amount}`,
      )
    }

    if (action === 'delete_adjustment') {
      const id = String(body.id || '')
      return saveAndReply(
        { ...book, adjustments: book.adjustments.filter((a) => a.id !== id) },
        {},
        'Payroll adjustment removed',
        'payroll_adjustment_deleted',
        id,
      )
    }

    if (action === 'apply_bulk_bonus') {
      const title = String(body.title || 'Festival Bonus').trim().slice(0, 120)
      const month = String(body.month || 'November 2026').trim()
      const mode = body.mode === 'fixed' ? 'fixed' : 'percent'
      const value = Number(body.value || 0)
      const targetType = String(body.targetType || 'all') // 'all' | 'teacher' | 'staff'
      if (!Number.isFinite(value) || value <= 0) {
        return NextResponse.json({ ok: false, error: 'Enter a positive bonus value or percentage.' }, { status: 400 })
      }
      const targets = book.employees.filter(
        (e) => e.active && (targetType === 'all' || e.employeeType === targetType),
      )
      const created: PayrollAdjustmentItem[] = targets.map((e, idx) => ({
        id: `adj-blk-${Date.now()}-${idx}`,
        employeeId: e.id,
        kind: 'bonus',
        title,
        amount: mode === 'fixed' ? Math.round(value) : Math.round((e.baseSalary * value) / 100),
        month,
        notes: mode === 'percent' ? `${value}% of Base Salary` : 'Flat Festival / Merit Bonus',
        active: true,
      }))
      return saveAndReply(
        { ...book, adjustments: [...created, ...book.adjustments] },
        {},
        `Applied ${title} to ${created.length} active employee(s)`,
        'payroll_bulk_bonus_applied',
        `${title} (${month}) · ${created.length} employees`,
      )
    }

    // ==================== 3. ATTENDANCE INTEGRATION ====================
    if (action === 'save_attendance') {
      const month = String(body.month || 'November 2026').trim()
      const records = Array.isArray(body.records)
        ? (body.records as Array<{
            employeeId: string
            presentDays: number
            lateDays: number
            absentDays: number
            paidLeaveDays?: number
            overtimeHours?: number
          }>)
        : []
      const workingDays = Math.max(1, book.settings.workingDaysPerMonth || 30)
      const remaining = book.attendance.filter(
        (a) => !(a.month === month && records.some((r) => r.employeeId === a.employeeId)),
      )
      const upserted: PayrollAttendanceMonthRecord[] = records.map((r, idx) => ({
        id: `patt-${Date.now()}-${idx}`,
        employeeId: r.employeeId,
        month,
        presentDays: Math.max(0, Math.min(workingDays, Math.round(Number(r.presentDays || 0)))),
        lateDays: Math.max(0, Math.min(workingDays, Math.round(Number(r.lateDays || 0)))),
        absentDays: Math.max(0, Math.min(workingDays, Math.round(Number(r.absentDays || 0)))),
        paidLeaveDays: Math.max(0, Math.min(workingDays, Math.round(Number(r.paidLeaveDays || 0)))),
        overtimeHours: Math.max(0, Math.round(Number(r.overtimeHours || 0))),
      }))
      return saveAndReply(
        { ...book, attendance: [...upserted, ...remaining] },
        {},
        `Saved ${month} payroll attendance for ${upserted.length} employee(s)`,
        'payroll_attendance_saved',
        `${month} · ${upserted.length} records`,
      )
    }

    if (action === 'sync_hr_attendance') {
      const month = String(body.month || 'November 2026').trim()
      const hrLogs = Array.isArray(currentData.teacherAttendance)
        ? (currentData.teacherAttendance as TeacherAttendanceLog[])
        : []
      const workingDays = Math.max(1, book.settings.workingDaysPerMonth || 30)
      const nextAtt = [...book.attendance]
      for (const emp of book.employees.filter((e) => e.active)) {
        const empHr = hrLogs.filter((h) => h.teacherId === emp.id)
        const lateAdd = empHr.filter((h) => h.status === 'late').length
        const absAdd = empHr.filter((h) => h.status === 'absent').length
        const existingIdx = nextAtt.findIndex(
          (a) => a.employeeId === emp.id && a.month === month,
        )
        const record: PayrollAttendanceMonthRecord = {
          id: existingIdx >= 0 ? nextAtt[existingIdx].id : `patt-sync-${Date.now()}-${emp.id}`,
          employeeId: emp.id,
          month,
          presentDays: Math.max(0, workingDays - absAdd),
          lateDays: existingIdx >= 0 ? Math.max(nextAtt[existingIdx].lateDays, lateAdd) : lateAdd,
          absentDays: existingIdx >= 0 ? Math.max(nextAtt[existingIdx].absentDays, absAdd) : absAdd,
          paidLeaveDays: existingIdx >= 0 ? nextAtt[existingIdx].paidLeaveDays : 0,
          overtimeHours: existingIdx >= 0 ? nextAtt[existingIdx].overtimeHours : 0,
        }
        if (existingIdx >= 0) nextAtt[existingIdx] = record
        else nextAtt.push(record)
      }
      return saveAndReply(
        { ...book, attendance: nextAtt },
        {},
        `Synced Campus Wi-Fi / HR attendance into ${month} Payroll!`,
        'payroll_attendance_synced',
        month,
      )
    }

    // ==================== 4. PAYROLL SETTINGS ====================
    if (action === 'save_settings') {
      const nextSettings = {
        workingDaysPerMonth: Math.max(20, Math.min(31, Math.round(Number(body.workingDaysPerMonth || 30)))),
        latesPerAbsentDay: Math.max(1, Math.min(10, Math.round(Number(body.latesPerAbsentDay || 3)))),
        defaultPfPercent: Math.max(0, Math.min(25, Number(body.defaultPfPercent ?? 5))),
        defaultFestivalBonusPercent: Math.max(0, Math.min(200, Number(body.defaultFestivalBonusPercent ?? 50))),
        defaultPaymentLedgerId: String(body.defaultPaymentLedgerId || book.settings.defaultPaymentLedgerId),
        autoPostAccountingVoucher:
          typeof body.autoPostAccountingVoucher === 'boolean'
            ? body.autoPostAccountingVoucher
            : book.settings.autoPostAccountingVoucher,
      }
      return saveAndReply(
        { ...book, settings: nextSettings },
        {},
        'Payroll rules & disbursement settings saved!',
        'payroll_settings_saved',
        `${nextSettings.workingDaysPerMonth} days · ${nextSettings.latesPerAbsentDay} lates=1 day`,
      )
    }

    // ==================== 5. DISBURSE PAYROLL (AUTO DOUBLE-ENTRY ACCOUNTING + TEACHER PAYSLIP SYNC) ====================
    if (action === 'disburse_payroll') {
      const month = String(body.month || 'November 2026').trim()
      const employeeId = String(body.employeeId || '').trim()
      const bulk = Boolean(body.bulk)
      const paymentLedgerId = String(body.paymentLedgerId || book.settings.defaultPaymentLedgerId || 'ldg-10107')

      const accBook = loadAccountingBook(currentData)
      const payLedger =
        accBook.ledgers.find((l) => l.id === paymentLedgerId && (l.isBank || l.isCash)) ||
        accBook.ledgers.find((l) => l.id === 'ldg-10107') ||
        accBook.ledgers.find((l) => l.isBank || l.isCash)

      if (!payLedger) {
        return NextResponse.json({ ok: false, error: 'Valid Bank or Cash payout ledger not found.' }, { status: 400 })
      }

      const targets = bulk
        ? book.employees.filter(
            (e) =>
              e.active &&
              !book.disbursements.some((d) => d.employeeId === e.id && d.month === month),
          )
        : book.employees.filter((e) => e.id === employeeId && e.active)

      if (targets.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: bulk
              ? `All active employees for ${month} are already paid!`
              : 'Employee not found or inactive.',
          },
          { status: 409 },
        )
      }

      if (
        !bulk &&
        book.disbursements.some((d) => d.employeeId === targets[0].id && d.month === month)
      ) {
        return NextResponse.json(
          { ok: false, error: `${targets[0].name} has already been paid for ${month}.` },
          { status: 409 },
        )
      }

      const computedList = targets.map((emp) => computeEmployeeMonthlyPayroll(book, emp, month))
      const teacherTotal = computedList
        .filter((c) => c.employee.employeeType === 'teacher')
        .reduce((s, c) => s + c.netPayable, 0)
      const staffTotal = computedList
        .filter((c) => c.employee.employeeType === 'staff')
        .reduce((s, c) => s + c.netPayable, 0)
      const grandTotal = teacherTotal + staffTotal

      // Auto-Post Balanced Double-Entry Debit Voucher into accountingBook
      let nextAccBook = accBook
      let linkedVoucherNo: string | undefined
      if (book.settings.autoPostAccountingVoucher && grandTotal > 0) {
        const tchSalLedger =
          accBook.ledgers.find((l) => l.id === 'ldg-40004') ||
          accBook.ledgers.find((l) => l.head === 'Expense')
        const stfSalLedger =
          accBook.ledgers.find((l) => l.id === 'ldg-40005') ||
          tchSalLedger

        if (tchSalLedger && stfSalLedger) {
          const lines: VoucherEntryLine[] = []
          if (teacherTotal > 0) {
            lines.push({
              id: `ln-pay-${Date.now()}-t`,
              ledgerId: tchSalLedger.id,
              ledgerCode: tchSalLedger.code,
              ledgerName: tchSalLedger.name,
              debit: teacherTotal,
              credit: 0,
            })
          }
          if (staffTotal > 0) {
            lines.push({
              id: `ln-pay-${Date.now()}-s`,
              ledgerId: stfSalLedger.id,
              ledgerCode: stfSalLedger.code,
              ledgerName: stfSalLedger.name,
              debit: staffTotal,
              credit: 0,
            })
          }
          lines.push({
            id: `ln-pay-${Date.now()}-c`,
            ledgerId: payLedger.id,
            ledgerCode: payLedger.code,
            ledgerName: payLedger.name,
            debit: 0,
            credit: grandTotal,
          })

          linkedVoucherNo = nextDebitVoucherNo(accBook.vouchers)
          const voucher: AccountingVoucher = {
            id: `vch-pay-${Date.now()}`,
            voucherNo: linkedVoucherNo,
            type: 'debit',
            transactionFor: 'Salary',
            dateIso: todayIso,
            accountLabel:
              computedList.length === 1
                ? `${computedList[0].employee.name} Salary (${month})`
                : `Monthly Payroll Run — ${month} (${computedList.length} Employees)`,
            partyOrReceiver:
              computedList.length === 1
                ? computedList[0].employee.name
                : `${computedList.length} DMHA Teachers & Staff`,
            paymentMode: payLedger.isBank ? 'Bank' : 'Cash',
            referenceNo: `PAY-${month.replace(/\s+/g, '-').toUpperCase()}`,
            narration: `Automated Payroll Disbursement for ${month} (${computedList.length} employee(s)) via ${payLedger.name}`,
            totalAmount: grandTotal,
            lines,
            createdBy: session.display_name,
            createdAt: todayIso,
          }
          nextAccBook = {
            ...accBook,
            vouchers: [voucher, ...accBook.vouchers],
          }
        }
      }

      const monthTag = month.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()
      const newDisbursements: PayrollDisbursementRecord[] = computedList.map((c, idx) => ({
        id: `pay-${Date.now()}-${idx}`,
        slipNo: `PAY-${monthTag}-${String(book.disbursements.length + idx + 1).padStart(3, '0')}`,
        month,
        employeeId: c.employee.id,
        employeeName: c.employee.name,
        employeeType: c.employee.employeeType,
        designation: c.employee.designation,
        baseSalary: c.baseSalary,
        totalAllowances: c.allowances,
        totalBonuses: c.bonuses,
        totalDeductions: c.deductions,
        attendancePenalty: c.attendancePenalty,
        netPayable: c.netPayable,
        paymentLedgerId: payLedger.id,
        paymentLedgerName: payLedger.name,
        linkedVoucherNo,
        paidAt: todayIso,
        paidBy: session.display_name,
        status: 'paid',
      }))

      // Sync teacher disbursements into legacy teacherSalaries so Teachers see paid slips in Teacher Finance!
      const existingTchSalaries: TeacherSalaryRecord[] = Array.isArray(currentData.teacherSalaries)
        ? (currentData.teacherSalaries as TeacherSalaryRecord[])
        : []
      let nextTchSalaries = [...existingTchSalaries]
      for (const d of newDisbursements.filter((x) => x.employeeType === 'teacher')) {
        const idx = nextTchSalaries.findIndex(
          (s) => s.teacherId === d.employeeId && s.month === d.month,
        )
        const syncedRec: TeacherSalaryRecord = {
          id: idx >= 0 ? nextTchSalaries[idx].id : `sal-${Date.now()}-${d.employeeId}`,
          teacherId: d.employeeId,
          teacherName: d.employeeName,
          subject: d.designation,
          month: d.month,
          baseSalary: d.baseSalary,
          bonusAllowance: d.totalAllowances + d.totalBonuses,
          lateDeduction: d.totalDeductions + d.attendancePenalty,
          netSalary: d.netPayable,
          status: 'paid',
          paidAt: todayIso,
          bankRef: d.linkedVoucherNo || d.slipNo,
        }
        if (idx >= 0) nextTchSalaries[idx] = syncedRec
        else nextTchSalaries = [syncedRec, ...nextTchSalaries]
      }

      const nextPayroll: PayrollBookState = {
        ...book,
        disbursements: [...newDisbursements, ...book.disbursements],
      }

      return saveAndReply(
        nextPayroll,
        {
          accountingBook: nextAccBook,
          teacherSalaries: nextTchSalaries,
        },
        `Disbursed ${month} payroll for ${newDisbursements.length} employee(s) (৳${grandTotal.toLocaleString()})${
          linkedVoucherNo ? ` · Auto-posted ${linkedVoucherNo}` : ''
        }`,
        'payroll_disbursed',
        `${month} · ${newDisbursements.length} employee(s) · ৳${grandTotal}${
          linkedVoucherNo ? ` · ${linkedVoucherNo}` : ''
        }`,
      )
    }

    if (action === 'void_disbursement') {
      const disbursementId = String(body.disbursementId || '')
      const target = book.disbursements.find((d) => d.id === disbursementId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Disbursement record not found.' }, { status: 404 })
      }
      const remaining = book.disbursements.filter((d) => d.id !== disbursementId)
      // If linked voucher only covered this single employee, void it cleanly too so Trial Balance stays exact
      const accBook = loadAccountingBook(currentData)
      const sharedVoucher =
        target.linkedVoucherNo &&
        remaining.some((d) => d.linkedVoucherNo === target.linkedVoucherNo)
      const nextAccBook =
        target.linkedVoucherNo && !sharedVoucher
          ? {
              ...accBook,
              vouchers: accBook.vouchers.filter((v) => v.voucherNo !== target.linkedVoucherNo),
            }
          : accBook

      return saveAndReply(
        { ...book, disbursements: remaining },
        { accountingBook: nextAccBook },
        `Reversed payslip ${target.slipNo} (${target.employeeName})`,
        'payroll_disbursement_voided',
        `${target.slipNo} · ${target.employeeName}`,
      )
    }

    return NextResponse.json({ ok: false, error: `Unknown payroll action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Payroll operation failed.' },
      { status: 500 },
    )
  }
}
