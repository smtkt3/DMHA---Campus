'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { downloadExcelCsv } from '@/lib/csv-export'
import { DateFilterBar, extractIsoDate, formatPrettyDate, getTodayIso, matchesDateFilter } from './date-utils'
import { Icon } from './icons'
import { useSchool } from './store'
import type {
  AllowanceDutyType,
  ReimbursementCategory,
  TeacherAllowanceClaimItem,
  TeacherPayoutProfile,
  TeacherReimbursementItem,
  TeacherSalaryAdvanceItem,
  TeacherSalaryRecord,
} from './types'
import { PageShell } from './ui'

const REIMB_CATEGORIES: ReimbursementCategory[] = [
  'Classroom Supplies',
  'Science Lab Consumables',
  'Exam Printing & Copies',
  'Field Trip & Transport',
  'Training & Workshop',
  'Teaching Aids & Books',
]

const DUTY_TYPES: AllowanceDutyType[] = [
  'Exam Invigilation Duty',
  'Extra / Substitution Class',
  'After-School Coaching / Club',
  'Exam Paper Moderation',
  'Campus Event / Sports Duty',
]

export function FacultyFinanceView() {
  const {
    role,
    teachers,
    activeTeacherId,
    teacherSalaries,
    disburseTeacherSalary,
    disburseAllPendingSalaries,
    generateMonthlyPayroll,
    updateTeacherSalaryPackage,
    hasStaffPermission,
    notify,
    refreshDbFromServer,
  } = useSchool()

  const isPayrollStaff =
    role === 'staff' && (hasStaffPermission('payroll') || hasStaffPermission('accounts'))
  const isFinanceAdmin = role === 'admin' || isPayrollStaff
  const activeTeacher = teachers.find((t) => t.id === activeTeacherId) || teachers[0]

  const [subTab, setSubTab] = useState<
    'salary' | 'reimbursements' | 'advances' | 'allowances' | 'profile'
  >('salary')

  // Server-backed teacher finance collections
  const [loading, setLoading] = useState(true)
  const [reimbursements, setReimbursements] = useState<TeacherReimbursementItem[]>([])
  const [advances, setAdvances] = useState<TeacherSalaryAdvanceItem[]>([])
  const [allowances, setAllowances] = useState<TeacherAllowanceClaimItem[]>([])
  const [payoutProfiles, setPayoutProfiles] = useState<TeacherPayoutProfile[]>([])
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Payroll / Salary Slips state
  const [activePayslip, setActivePayslip] = useState<TeacherSalaryRecord | null>(null)
  const [editingSalary, setEditingSalary] = useState<TeacherSalaryRecord | null>(null)
  const [salBase, setSalBase] = useState('')
  const [salBonus, setSalBonus] = useState('')
  const [salDeduct, setSalDeduct] = useState('')
  const [payrollMonthFilter, setPayrollMonthFilter] = useState<string>('ALL')
  const [newPayrollMonth, setNewPayrollMonth] = useState('December 2026')
  const [payrollGenMsg, setPayrollGenMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [generatingMonth, setGeneratingMonth] = useState(false)

  // Reimbursements form & filter state
  const todayIso = getTodayIso()
  const [reimbCat, setReimbCat] = useState<ReimbursementCategory>('Classroom Supplies')
  const [reimbTitle, setReimbTitle] = useState('')
  const [reimbAmount, setReimbAmount] = useState('')
  const [reimbDate, setReimbDate] = useState(todayIso)
  const [reimbRef, setReimbRef] = useState('')
  const [reimbNotes, setReimbNotes] = useState('')
  const [reimbReceiptUrl, setReimbReceiptUrl] = useState<string>('')
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [reimbDateFilter, setReimbDateFilter] = useState<string>('ALL')
  const [reimbStatusFilter, setReimbStatusFilter] = useState<'all' | 'pending' | 'approved' | 'paid' | 'declined'>('all')

  // Salary Advances form & filter state
  const [advAmount, setAdvAmount] = useState('10000')
  const [advMonths, setAdvMonths] = useState('3')
  const [advReason, setAdvReason] = useState('')
  const [advDateFilter, setAdvDateFilter] = useState<string>('ALL')

  // Extra Duty / Allowances form & filter state
  const [alwType, setAlwType] = useState<AllowanceDutyType>('Exam Invigilation Duty')
  const [alwDate, setAlwDate] = useState(todayIso)
  const [alwHours, setAlwHours] = useState('2 Sessions (3 hrs)')
  const [alwAmount, setAlwAmount] = useState('1200')
  const [alwNotes, setAlwNotes] = useState('')
  const [alwDateFilter, setAlwDateFilter] = useState<string>('ALL')

  // Bank / Tax / Provident Fund Profile state
  const [selectedProfileTeacherId, setSelectedProfileTeacherId] = useState<string>(
    activeTeacher?.id || 'tch-nadia',
  )
  const [bankName, setBankName] = useState('')
  const [accountTitle, setAccountTitle] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [routingNumber, setRoutingNumber] = useState('')
  const [mfsProvider, setMfsProvider] = useState<TeacherPayoutProfile['mfsProvider']>('bKash')
  const [mfsNumber, setMfsNumber] = useState('')
  const [preferredMethod, setPreferredMethod] =
    useState<TeacherPayoutProfile['preferredMethod']>('Bank Transfer')
  const [tinNumber, setTinNumber] = useState('')
  const [taxCertOpen, setTaxCertOpen] = useState(false)

  const loadFinance = async () => {
    setLoading(true)
    try {
      const res = await fetch('/dmhs-api/teacher-finance', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        reimbursements?: TeacherReimbursementItem[]
        advances?: TeacherSalaryAdvanceItem[]
        allowances?: TeacherAllowanceClaimItem[]
        payoutProfiles?: TeacherPayoutProfile[]
      }
      if (json.ok) {
        setReimbursements(json.reimbursements || [])
        setAdvances(json.advances || [])
        setAllowances(json.allowances || [])
        setPayoutProfiles(json.payoutProfiles || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFinance()
  }, [role, activeTeacherId])

  const effectiveProfileTeacherId = isFinanceAdmin
    ? selectedProfileTeacherId
    : activeTeacher?.id || 'tch-nadia'

  const activeProfile = useMemo(
    () =>
      payoutProfiles.find((p) => p.teacherId === effectiveProfileTeacherId) ||
      payoutProfiles[0] ||
      null,
    [payoutProfiles, effectiveProfileTeacherId],
  )

  useEffect(() => {
    if (!activeProfile) return
    setBankName(activeProfile.bankName || '')
    setAccountTitle(activeProfile.accountTitle || '')
    setAccountNumber(activeProfile.accountNumber || '')
    setRoutingNumber(activeProfile.routingNumber || '')
    setMfsProvider(activeProfile.mfsProvider || 'bKash')
    setMfsNumber(activeProfile.mfsNumber || '')
    setPreferredMethod(activeProfile.preferredMethod || 'Bank Transfer')
    setTinNumber(activeProfile.tinNumber || '')
  }, [activeProfile])

  // Scoped salary records
  const roleScopedSalaries = useMemo(
    () =>
      isFinanceAdmin
        ? teacherSalaries
        : teacherSalaries.filter((s) => s.teacherId === activeTeacher?.id),
    [isFinanceAdmin, teacherSalaries, activeTeacher?.id],
  )

  // Summary financial KPIs
  const paidSalariesTotal = roleScopedSalaries
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => sum + s.netSalary, 0)
  const pendingSalariesTotal = roleScopedSalaries
    .filter((s) => s.status === 'pending')
    .reduce((sum, s) => sum + s.netSalary, 0)
  const paidReimbTotal = reimbursements
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + r.amount, 0)
  const pendingReimbTotal = reimbursements
    .filter((r) => r.status === 'pending' || r.status === 'approved')
    .reduce((sum, r) => sum + r.amount, 0)
  const paidAllowanceTotal = allowances
    .filter((a) => a.status === 'paid')
    .reduce((sum, a) => sum + a.amount, 0)
  const pendingAllowanceTotal = allowances
    .filter((a) => a.status === 'pending' || a.status === 'approved')
    .reduce((sum, a) => sum + a.amount, 0)

  const totalCreditedYtd = paidSalariesTotal + paidReimbTotal + paidAllowanceTotal
  const totalPendingAll = pendingSalariesTotal + pendingReimbTotal + pendingAllowanceTotal

  const activeAdvances = advances.filter((a) => a.status === 'disbursed')
  const remainingAdvanceBalance = activeAdvances.reduce(
    (sum, a) => sum + Math.max(0, a.amount - a.paidInstallments * a.monthlyInstallment),
    0,
  )

  const totalPfBalance = isFinanceAdmin
    ? payoutProfiles.reduce((sum, p) => sum + (p.pfAccumulatedBdt || 0), 0)
    : activeProfile?.pfAccumulatedBdt || 96000

  const pendingActionCount =
    roleScopedSalaries.filter((s) => s.status === 'pending').length +
    reimbursements.filter((r) => r.status === 'pending').length +
    advances.filter((a) => a.status === 'pending').length +
    allowances.filter((a) => a.status === 'pending').length

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingReceipt(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/dmhs-api/uploads', { method: 'POST', body: fd })
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string }
      if (res.ok && json.ok && json.url) {
        setReimbReceiptUrl(json.url)
        notify(`Receipt attached: ${file.name}`)
      } else {
        notify(json.error || 'Unable to upload receipt file.')
      }
    } finally {
      setUploadingReceipt(false)
      e.target.value = ''
    }
  }

  const submitFinancePost = async (payload: Record<string, unknown>) => {
    setSubmitting(true)
    setActionMsg(null)
    try {
      const res = await fetch('/dmhs-api/teacher-finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as {
        ok?: boolean
        message?: string
        error?: string
        reimbursements?: TeacherReimbursementItem[]
        advances?: TeacherSalaryAdvanceItem[]
        allowances?: TeacherAllowanceClaimItem[]
        payoutProfiles?: TeacherPayoutProfile[]
      }
      if (!res.ok || !json.ok) {
        setActionMsg({ ok: false, text: json.error || 'Could not submit finance request.' })
        return false
      }
      if (json.reimbursements) setReimbursements(json.reimbursements)
      if (json.advances) setAdvances(json.advances)
      if (json.allowances) setAllowances(json.allowances)
      if (json.payoutProfiles) setPayoutProfiles(json.payoutProfiles)
      setActionMsg({ ok: true, text: json.message || 'Saved to SQLite.' })
      notify(json.message || 'Finance record saved')
      return true
    } finally {
      setSubmitting(false)
    }
  }

  const reviewFinanceItem = async (
    kind: 'reimbursement' | 'advance' | 'allowance',
    id: string,
    action: 'approve' | 'pay' | 'decline' | 'record_installment',
  ) => {
    setSubmitting(true)
    setActionMsg(null)
    try {
      const res = await fetch('/dmhs-api/teacher-finance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, action }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        message?: string
        error?: string
        reimbursements?: TeacherReimbursementItem[]
        advances?: TeacherSalaryAdvanceItem[]
        allowances?: TeacherAllowanceClaimItem[]
      }
      if (!res.ok || !json.ok) {
        setActionMsg({ ok: false, text: json.error || 'Action failed.' })
        return
      }
      if (json.reimbursements) setReimbursements(json.reimbursements)
      if (json.advances) setAdvances(json.advances)
      if (json.allowances) setAllowances(json.allowances)
      setActionMsg({ ok: true, text: json.message || 'Updated.' })
      notify(json.message || 'Finance status updated')
      if (action === 'pay') {
        void refreshDbFromServer()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveSalaryEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSalary) return
    updateTeacherSalaryPackage(editingSalary.id, {
      baseSalary: Math.max(0, Number(salBase) || 0),
      bonusAllowance: Math.max(0, Number(salBonus) || 0),
      lateDeduction: Math.max(0, Number(salDeduct) || 0),
    })
    setEditingSalary(null)
  }

  // Filtered lists
  const filteredReimbursements = reimbursements.filter(
    (r) =>
      (reimbStatusFilter === 'all' ? true : r.status === reimbStatusFilter) &&
      matchesDateFilter(r.expenseDate, reimbDateFilter),
  )
  const filteredAdvances = advances.filter((a) => matchesDateFilter(a.requestDate, advDateFilter))
  const filteredAllowances = allowances.filter((a) => matchesDateFilter(a.dutyDate, alwDateFilter))

  const availableMonths = Array.from(new Set(roleScopedSalaries.map((s) => s.month)))
  const displayedSalaries =
    payrollMonthFilter === 'ALL'
      ? roleScopedSalaries
      : roleScopedSalaries.filter((s) => s.month === payrollMonthFilter)
  const pendingDisplayedSalaries = displayedSalaries.filter((s) => s.status === 'pending').length

  const previewInstallment = Math.ceil(
    (Math.max(0, Number(advAmount) || 0)) / Math.max(1, Number(advMonths) || 1),
  )

  return (
    <PageShell
      eyebrow={
        isFinanceAdmin
          ? 'DMHA Payroll & Treasury · Faculty Finance Hub'
          : `Teacher Finance · ${activeTeacher?.name} (${activeTeacher?.subject})`
      }
      title={isFinanceAdmin ? 'Faculty Finance & Payroll Center' : 'My Finance'}
      subtitle={
        isFinanceAdmin
          ? 'Manage teacher salaries & monthly payslips, review expense reimbursements, salary advances, extra-duty allowances, and bank/PF payouts — synced directly to School Accounts.'
          : 'All your teaching finances in one place: monthly salary slips, expense reimbursements, salary advances, extra-duty & invigilation allowances, bank/MFS details, tax & provident fund.'
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadExcelCsv(
                `DMHA-Faculty-Finance-${todayIso}.csv`,
                ['Type', 'Teacher', 'Date / Month', 'Title / Category', 'Amount (BDT)', 'Status'],
                [
                  ...roleScopedSalaries.map((s) => [
                    'Salary',
                    s.teacherName,
                    s.month,
                    `Net Salary (Base ৳${s.baseSalary} + Bonus ৳${s.bonusAllowance} - Deduct ৳${s.lateDeduction})`,
                    s.netSalary,
                    s.status.toUpperCase(),
                  ]),
                  ...reimbursements.map((r) => [
                    'Reimbursement',
                    r.teacherName,
                    r.expenseDate,
                    `${r.category}: ${r.title}`,
                    r.amount,
                    r.status.toUpperCase(),
                  ]),
                  ...allowances.map((a) => [
                    'Extra Duty Allowance',
                    a.teacherName,
                    a.dutyDate,
                    `${a.dutyType} (${a.hoursOrSessions})`,
                    a.amount,
                    a.status.toUpperCase(),
                  ]),
                  ...advances.map((a) => [
                    'Salary Advance',
                    a.teacherName,
                    a.requestDate,
                    `${a.reason} (${a.paidInstallments}/${a.repaymentMonths} repaid)`,
                    a.amount,
                    a.status.toUpperCase(),
                  ]),
                ],
              )
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50"
          >
            <Icon name="sheet" size={14} className="text-emerald-600" />
            Export Finance CSV
          </button>
          <button
            type="button"
            onClick={() => setTaxCertOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
          >
            <Icon name="print" size={14} />
            Tax &amp; Income Statement
          </button>
        </div>
      }
    >
      {/* Executive Finance KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-hero rounded-[24px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            {isFinanceAdmin ? 'Total Disbursed (YTD)' : 'Total Credited (YTD)'}
          </p>
          <p className="mt-1.5 text-3xl font-black text-white">
            ৳{totalCreditedYtd.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-slate-300">
            Salary ৳{paidSalariesTotal.toLocaleString()} · Extras ৳
            {(paidReimbTotal + paidAllowanceTotal).toLocaleString()}
          </p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Pending Payouts &amp; Claims
          </p>
          <p className="mt-1.5 text-3xl font-black text-amber-600">
            ৳{totalPendingAll.toLocaleString()}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {pendingActionCount} item(s) awaiting approval / transfer
          </p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Active Advance Balance
          </p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">
            ৳{remainingAdvanceBalance.toLocaleString()}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {activeAdvances.length} active advance(s) in repayment
          </p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Provident Fund (5% + 5%)
          </p>
          <p className="mt-1.5 text-3xl font-black text-emerald-700">
            ৳{totalPfBalance.toLocaleString()}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {activeProfile?.tinNumber ? `TIN: ${activeProfile.tinNumber}` : 'DMHA 1:1 Employer Match'}
          </p>
        </div>
      </div>

      {actionMsg && (
        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-xs font-bold ${
            actionMsg.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {actionMsg.text}
        </div>
      )}

      {/* 5 Finance Sub-Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ['salary', `Salary & Payslips (${roleScopedSalaries.length})`],
            ['reimbursements', `Expense Reimbursements (${reimbursements.length})`],
            ['advances', `Salary Advances & Loans (${advances.length})`],
            ['allowances', `Extra Duty & Allowances (${allowances.length})`],
            ['profile', 'Bank, Tax & Provident Fund'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setSubTab(id)
              setActionMsg(null)
            }}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
              subTab === id
                ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ==================== TAB 1: SALARY & PAYSLIPS ==================== */}
      {subTab === 'salary' && (
        <div className="mt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPayrollMonthFilter('ALL')}
                className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold transition ${
                  payrollMonthFilter === 'ALL'
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Months ({roleScopedSalaries.length})
              </button>
              {availableMonths.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayrollMonthFilter(m)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold transition ${
                    payrollMonthFilter === m
                      ? 'bg-[#0f172a] text-emerald-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {isFinanceAdmin && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!newPayrollMonth.trim()) return
                  setPayrollGenMsg(null)
                  setGeneratingMonth(true)
                  const res = await generateMonthlyPayroll(newPayrollMonth.trim())
                  setGeneratingMonth(false)
                  if (res.ok) {
                    setPayrollGenMsg({
                      ok: true,
                      text: `Generated ${res.createdCount} salary slip(s) for ${newPayrollMonth.trim()} in SQLite.`,
                    })
                    setPayrollMonthFilter(newPayrollMonth.trim())
                  } else {
                    setPayrollGenMsg({ ok: false, text: res.error || 'Could not generate payroll.' })
                  }
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  value={newPayrollMonth}
                  onChange={(e) => setNewPayrollMonth(e.target.value)}
                  placeholder="e.g., December 2026"
                  className="w-40 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={generatingMonth}
                  className="rounded-full bg-[#0f172a] px-3.5 py-1.5 text-[11px] font-black text-emerald-300 hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                >
                  {generatingMonth ? 'Generating...' : '+ Generate Month Payroll'}
                </button>
              </form>
            )}
          </div>

          {payrollGenMsg && (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 text-xs font-bold ${
                payrollGenMsg.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {payrollGenMsg.text}
            </div>
          )}

          {isFinanceAdmin && pendingDisplayedSalaries > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-3.5">
              <p className="text-xs font-extrabold text-emerald-900">
                {pendingDisplayedSalaries} faculty salary payout(s) pending
                {payrollMonthFilter !== 'ALL' ? ` for ${payrollMonthFilter}` : ''} — disbursing
                writes directly to the server-immutable SQLite Payment Ledger &amp; Accounts!
              </p>
              <button
                type="button"
                onClick={() =>
                  disburseAllPendingSalaries(
                    payrollMonthFilter === 'ALL' ? undefined : payrollMonthFilter,
                  )
                }
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-700"
              >
                Disburse All Pending ({pendingDisplayedSalaries})
              </button>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {displayedSalaries.map((sal) => (
              <div key={sal.id} className="dmhs-card flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-600">
                      {sal.month} · {sal.subject}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        sal.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {sal.status === 'paid' ? 'Salary Credited' : 'Pending Payout'}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-lg font-black text-slate-900">{sal.teacherName}</h3>

                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Base</p>
                      <p className="font-black text-slate-800">
                        ৳{sal.baseSalary.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600">+ Bonus</p>
                      <p className="font-black text-emerald-700">
                        ৳{sal.bonusAllowance.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-rose-500">- Deduct</p>
                      <p className="font-black text-rose-600">
                        ৳{sal.lateDeduction.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-500">Net Payable</span>
                    <span className="text-2xl font-black text-slate-900">
                      ৳{sal.netSalary.toLocaleString()}
                    </span>
                  </div>
                  {sal.bankRef && (
                    <p className="mt-1 font-mono text-[10px] font-bold text-emerald-700">
                      Ref: {sal.bankRef} · Credited {sal.paidAt}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setActivePayslip(sal)}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    View Salary Slip
                  </button>
                  {isFinanceAdmin && sal.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSalary(sal)
                          setSalBase(String(sal.baseSalary))
                          setSalBonus(String(sal.bonusAllowance))
                          setSalDeduct(String(sal.lateDeduction))
                        }}
                        className="rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-extrabold text-slate-700"
                      >
                        Adjust
                      </button>
                      <button
                        type="button"
                        onClick={() => disburseTeacherSalary(sal.id)}
                        className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-black text-white hover:bg-emerald-700"
                      >
                        Disburse &amp; Notify
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: EXPENSE REIMBURSEMENTS ==================== */}
      {subTab === 'reimbursements' && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const ok = await submitFinancePost({
                kind: 'reimbursement',
                teacherId: activeTeacher?.id,
                category: reimbCat,
                title: reimbTitle,
                amount: Number(reimbAmount),
                expenseDate: reimbDate,
                receiptRef: reimbRef,
                receiptUrl: reimbReceiptUrl || undefined,
                notes: reimbNotes,
              })
              if (ok) {
                setReimbTitle('')
                setReimbAmount('')
                setReimbRef('')
                setReimbNotes('')
                setReimbReceiptUrl('')
              }
            }}
            className="dmhs-card h-fit p-5"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
              Out-of-Pocket Expense Claim
            </p>
            <h3 className="mt-1 text-base font-black text-slate-900">
              + Submit Reimbursement Claim
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Claim classroom supplies, lab materials, printing, transport, or workshop costs.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Category</label>
                <select
                  value={reimbCat}
                  onChange={(e) => setReimbCat(e.target.value as ReimbursementCategory)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                >
                  {REIMB_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Expense Description *
                </label>
                <input
                  required
                  value={reimbTitle}
                  onChange={(e) => setReimbTitle(e.target.value)}
                  placeholder="e.g., Whiteboard markers & lab goggles"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Amount (৳) *
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={reimbAmount}
                    onChange={(e) => setReimbAmount(e.target.value)}
                    placeholder="1250"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Expense Date *
                  </label>
                  <input
                    required
                    type="date"
                    max={todayIso}
                    value={reimbDate}
                    onChange={(e) => setReimbDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Receipt / Invoice Reference
                </label>
                <input
                  value={reimbRef}
                  onChange={(e) => setReimbRef(e.target.value)}
                  placeholder="e.g., INV-2026-441"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Attach Receipt Photo / PDF (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  disabled={uploadingReceipt}
                  onChange={(e) => void handleUploadReceipt(e)}
                  className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600"
                />
                {reimbReceiptUrl && (
                  <p className="mt-1 text-[10px] font-bold text-emerald-700">
                    ✓ Receipt uploaded &amp; ready to attach
                  </p>
                )}
              </div>
              <textarea
                rows={2}
                value={reimbNotes}
                onChange={(e) => setReimbNotes(e.target.value)}
                placeholder="Optional note for Accounts / Principal..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={submitting || uploadingReceipt}
                className="w-full rounded-xl bg-[#0f172a] py-3 text-xs font-black text-emerald-300 shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? 'Saving to SQLite...' : 'Submit Reimbursement Claim'}
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <DateFilterBar
              value={reimbDateFilter}
              onChange={setReimbDateFilter}
              allowAll
              compact
              label="Claim Date"
              savedDates={Array.from(
                new Set(
                  reimbursements
                    .map((r) => extractIsoDate(r.expenseDate))
                    .filter((d): d is string => Boolean(d)),
                ),
              ).sort((a, b) => (a < b ? 1 : -1))}
              rightSlot={
                <div className="flex flex-wrap gap-1">
                  {(['all', 'pending', 'approved', 'paid', 'declined'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setReimbStatusFilter(st)}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold capitalize ${
                        reimbStatusFilter === st
                          ? 'bg-[#0f172a] text-emerald-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              }
            />

            {loading ? (
              <div className="dmhs-card py-10 text-center text-xs font-bold text-slate-400">
                Loading reimbursement records...
              </div>
            ) : filteredReimbursements.length === 0 ? (
              <div className="dmhs-card py-10 text-center text-xs font-semibold text-slate-400">
                No reimbursement claims match the selected date/status filter.
              </div>
            ) : (
              filteredReimbursements.map((item) => (
                <div key={item.id} className="dmhs-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700">
                          {item.category}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                          {formatPrettyDate(item.expenseDate)} · Ref {item.receiptRef}
                        </span>
                        {isFinanceAdmin && (
                          <span className="text-[11px] font-extrabold text-slate-500">
                            · {item.teacherName}
                          </span>
                        )}
                      </div>
                      <h4 className="mt-2 text-sm font-black text-slate-900">{item.title}</h4>
                      {item.notes && (
                        <p className="mt-1 text-xs text-slate-500">{item.notes}</p>
                      )}
                      {item.receiptUrl && (
                        <a
                          href={item.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 hover:underline"
                        >
                          View Uploaded Receipt ↗
                        </a>
                      )}
                      {item.adminNote && (
                        <p className="mt-1.5 text-[11px] font-bold text-emerald-700">
                          Accounts Note: {item.adminNote}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-black text-slate-900">
                        ৳{item.amount.toLocaleString()}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          item.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'approved'
                              ? 'bg-sky-100 text-sky-800'
                              : item.status === 'declined'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>

                  {isFinanceAdmin && item.status !== 'paid' && item.status !== 'declined' && (
                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                      {item.status === 'pending' && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void reviewFinanceItem('reimbursement', item.id, 'approve')}
                          className="rounded-full bg-sky-100 px-3.5 py-1.5 text-xs font-extrabold text-sky-800 hover:bg-sky-200"
                        >
                          Approve Claim
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void reviewFinanceItem('reimbursement', item.id, 'pay')}
                        className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-black text-white hover:bg-emerald-700"
                      >
                        Mark Paid &amp; Log Expense
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void reviewFinanceItem('reimbursement', item.id, 'decline')}
                        className="rounded-full bg-rose-50 px-3.5 py-1.5 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: SALARY ADVANCES & LOANS ==================== */}
      {subTab === 'advances' && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const ok = await submitFinancePost({
                kind: 'advance',
                teacherId: activeTeacher?.id,
                amount: Number(advAmount),
                repaymentMonths: Number(advMonths),
                reason: advReason,
              })
              if (ok) setAdvReason('')
            }}
            className="dmhs-card h-fit p-5"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">
              Zero-Interest Staff Facility
            </p>
            <h3 className="mt-1 text-base font-black text-slate-900">
              + Request Salary Advance / Loan
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Repaid automatically in equal monthly salary installments with 0% interest.
            </p>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Amount (৳) *
                  </label>
                  <input
                    required
                    type="number"
                    min={500}
                    max={200000}
                    value={advAmount}
                    onChange={(e) => setAdvAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Repayment Plan
                  </label>
                  <select
                    value={advMonths}
                    onChange={(e) => setAdvMonths(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                  >
                    <option value="1">1 Month</option>
                    <option value="2">2 Months</option>
                    <option value="3">3 Months</option>
                    <option value="4">4 Months</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 p-3.5 text-white">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Estimated Monthly Salary Deduction
                </p>
                <p className="mt-0.5 text-xl font-black">
                  ৳{previewInstallment.toLocaleString()}{' '}
                  <span className="text-xs font-semibold text-slate-300">
                    / month × {advMonths} mo
                  </span>
                </p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Purpose / Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={advReason}
                  onChange={(e) => setAdvReason(e.target.value)}
                  placeholder="e.g., Medical emergency, family tuition, or laptop upgrade..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#0f172a] py-3 text-xs font-black text-emerald-300 shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Advance Request'}
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <DateFilterBar
              value={advDateFilter}
              onChange={setAdvDateFilter}
              allowAll
              compact
              label="Request Date"
              savedDates={Array.from(
                new Set(
                  advances
                    .map((a) => extractIsoDate(a.requestDate))
                    .filter((d): d is string => Boolean(d)),
                ),
              ).sort((a, b) => (a < b ? 1 : -1))}
            />

            {filteredAdvances.length === 0 ? (
              <div className="dmhs-card py-10 text-center text-xs font-semibold text-slate-400">
                No salary advance or loan requests for this date filter.
              </div>
            ) : (
              filteredAdvances.map((adv) => {
                const repaidAmt = Math.min(adv.amount, adv.paidInstallments * adv.monthlyInstallment)
                const remaining = Math.max(0, adv.amount - repaidAmt)
                const pct = Math.min(100, Math.round((adv.paidInstallments / adv.repaymentMonths) * 100))
                return (
                  <div key={adv.id} className="dmhs-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                            Requested {formatPrettyDate(adv.requestDate)}
                          </span>
                          {isFinanceAdmin && (
                            <span className="text-xs font-black text-slate-800">
                              {adv.teacherName}
                            </span>
                          )}
                        </div>
                        <h4 className="mt-2 text-sm font-black text-slate-900">{adv.reason}</h4>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          ৳{adv.monthlyInstallment.toLocaleString()}/mo × {adv.repaymentMonths}{' '}
                          months · Repaid {adv.paidInstallments}/{adv.repaymentMonths} installments
                          (Remaining: <strong>৳{remaining.toLocaleString()}</strong>)
                        </p>
                        {adv.adminNote && (
                          <p className="mt-1 text-[11px] font-bold text-emerald-700">
                            {adv.adminNote}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-xl font-black text-slate-900">
                          ৳{adv.amount.toLocaleString()}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            adv.status === 'repaid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : adv.status === 'disbursed'
                                ? 'bg-sky-100 text-sky-800'
                                : adv.status === 'declined'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {adv.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {isFinanceAdmin && adv.status !== 'repaid' && adv.status !== 'declined' && (
                      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                        {adv.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => void reviewFinanceItem('advance', adv.id, 'approve')}
                              className="rounded-full bg-sky-100 px-3.5 py-1.5 text-xs font-extrabold text-sky-800"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => void reviewFinanceItem('advance', adv.id, 'pay')}
                              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-black text-white"
                            >
                              Disburse Now
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => void reviewFinanceItem('advance', adv.id, 'decline')}
                              className="rounded-full bg-rose-50 px-3.5 py-1.5 text-xs font-extrabold text-rose-700"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {adv.status === 'approved' && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void reviewFinanceItem('advance', adv.id, 'pay')}
                            className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-black text-white"
                          >
                            Mark Disbursed
                          </button>
                        )}
                        {adv.status === 'disbursed' && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              void reviewFinanceItem('advance', adv.id, 'record_installment')
                            }
                            className="rounded-full bg-[#0f172a] px-4 py-1.5 text-xs font-black text-emerald-300"
                          >
                            + Record 1 Monthly Deduction ({adv.paidInstallments + 1}/
                            {adv.repaymentMonths})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 4: EXTRA DUTY & ALLOWANCES ==================== */}
      {subTab === 'allowances' && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const ok = await submitFinancePost({
                kind: 'allowance',
                teacherId: activeTeacher?.id,
                dutyType: alwType,
                dutyDate: alwDate,
                hoursOrSessions: alwHours,
                amount: Number(alwAmount),
                notes: alwNotes,
              })
              if (ok) setAlwNotes('')
            }}
            className="dmhs-card h-fit p-5"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
              Overtime, Invigilation &amp; Extra Classes
            </p>
            <h3 className="mt-1 text-base font-black text-slate-900">
              + Claim Extra Duty Allowance
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Log exam hall invigilation, substitution cover, paper moderation, or coaching clubs.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Duty Type</label>
                <select
                  value={alwType}
                  onChange={(e) => setAlwType(e.target.value as AllowanceDutyType)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                >
                  {DUTY_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Duty Date *
                  </label>
                  <input
                    required
                    type="date"
                    max={todayIso}
                    value={alwDate}
                    onChange={(e) => setAlwDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Stipend (৳) *
                  </label>
                  <input
                    required
                    type="number"
                    min={100}
                    value={alwAmount}
                    onChange={(e) => setAlwAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Hours / Periods / Sessions
                </label>
                <input
                  value={alwHours}
                  onChange={(e) => setAlwHours(e.target.value)}
                  placeholder="e.g., 2 Extra Periods / 3 hrs"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Details</label>
                <textarea
                  rows={2}
                  value={alwNotes}
                  onChange={(e) => setAlwNotes(e.target.value)}
                  placeholder="Room number, class covered, or exam name..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#0f172a] py-3 text-xs font-black text-emerald-300 shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Log Extra Duty Allowance'}
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <DateFilterBar
              value={alwDateFilter}
              onChange={setAlwDateFilter}
              allowAll
              compact
              label="Duty Date"
              savedDates={Array.from(
                new Set(
                  allowances
                    .map((a) => extractIsoDate(a.dutyDate))
                    .filter((d): d is string => Boolean(d)),
                ),
              ).sort((a, b) => (a < b ? 1 : -1))}
            />

            {filteredAllowances.length === 0 ? (
              <div className="dmhs-card py-10 text-center text-xs font-semibold text-slate-400">
                No extra-duty allowance claims found for this date filter.
              </div>
            ) : (
              filteredAllowances.map((alw) => (
                <div key={alw.id} className="dmhs-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                          {alw.dutyType}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                          {formatPrettyDate(alw.dutyDate)} · {alw.hoursOrSessions}
                        </span>
                        {isFinanceAdmin && (
                          <span className="text-[11px] font-extrabold text-slate-500">
                            · {alw.teacherName}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-700">
                        {alw.notes || 'Extra faculty duty logged for payroll stipend.'}
                      </p>
                      {alw.adminNote && (
                        <p className="mt-1 text-[11px] font-bold text-emerald-700">
                          {alw.adminNote}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-900">
                        ৳{alw.amount.toLocaleString()}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          alw.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : alw.status === 'approved'
                              ? 'bg-sky-100 text-sky-800'
                              : alw.status === 'declined'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {alw.status}
                      </span>
                    </div>
                  </div>

                  {isFinanceAdmin && alw.status !== 'paid' && alw.status !== 'declined' && (
                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                      {alw.status === 'pending' && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void reviewFinanceItem('allowance', alw.id, 'approve')}
                          className="rounded-full bg-sky-100 px-3.5 py-1.5 text-xs font-extrabold text-sky-800"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void reviewFinanceItem('allowance', alw.id, 'pay')}
                        className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-black text-white"
                      >
                        Mark Paid &amp; Log Payroll
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void reviewFinanceItem('allowance', alw.id, 'decline')}
                        className="rounded-full bg-rose-50 px-3.5 py-1.5 text-xs font-extrabold text-rose-700"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 5: BANK, TAX & PROVIDENT FUND ==================== */}
      {subTab === 'profile' && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              await submitFinancePost({
                kind: 'payout_profile',
                teacherId: effectiveProfileTeacherId,
                bankName,
                accountTitle,
                accountNumber,
                routingNumber,
                mfsProvider,
                mfsNumber,
                preferredMethod,
                tinNumber,
              })
            }}
            className="dmhs-card p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                  Direct Deposit &amp; Tax Settings
                </p>
                <h3 className="mt-1 text-base font-black text-slate-900">
                  Salary Payout Bank, MFS &amp; TIN Profile
                </h3>
              </div>
              {isFinanceAdmin && (
                <select
                  value={selectedProfileTeacherId}
                  onChange={(e) => setSelectedProfileTeacherId(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Preferred Payout Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Bank Transfer', 'MFS (bKash/Nagad)'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPreferredMethod(m)}
                      className={`rounded-xl py-2.5 text-xs font-extrabold transition ${
                        preferredMethod === m
                          ? 'bg-[#0f172a] text-emerald-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Bank &amp; Branch Name
                </label>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Account Holder Name
                </label>
                <input
                  value={accountTitle}
                  onChange={(e) => setAccountTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Bank Account Number
                </label>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Bank Routing Number
                </label>
                <input
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  MFS Provider
                </label>
                <select
                  value={mfsProvider}
                  onChange={(e) =>
                    setMfsProvider(e.target.value as TeacherPayoutProfile['mfsProvider'])
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                  <option value="None">None</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  MFS Wallet Number
                </label>
                <input
                  value={mfsNumber}
                  onChange={(e) => setMfsNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Tax Identification Number (e-TIN)
                </label>
                <input
                  value={tinNumber}
                  onChange={(e) => setTinNumber(e.target.value)}
                  placeholder="e.g., TIN-BD-482910340"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full rounded-xl bg-emerald-600 py-3 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Saving to SQLite...' : 'Save Bank, MFS & TIN Details'}
            </button>
          </form>

          {/* Provident Fund & Annual Tax Summary Card */}
          <div className="space-y-4">
            <div className="dmhs-hero rounded-[26px] p-6 text-white">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300">
                DMHA Faculty Provident Fund (PF)
              </p>
              <p className="mt-2 text-4xl font-black text-white">
                ৳{(activeProfile?.pfAccumulatedBdt || 96000).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Employee {activeProfile?.pfEmployeePercent ?? 5}% + DMHA Employer Match{' '}
                {activeProfile?.pfSchoolMatchPercent ?? 5}% (100% Vested)
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl bg-white/10 p-3.5 text-xs">
                <div>
                  <p className="text-[10px] text-slate-300">Your Contribution</p>
                  <p className="mt-0.5 text-base font-black text-emerald-300">
                    ৳{Math.round((activeProfile?.pfAccumulatedBdt || 96000) / 2).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-300">DMHA School Match</p>
                  <p className="mt-0.5 text-base font-black text-white">
                    ৳{Math.round((activeProfile?.pfAccumulatedBdt || 96000) / 2).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="dmhs-card p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Annual Tax &amp; Income Certificate
              </p>
              <h4 className="mt-1 text-sm font-black text-slate-900">
                FY 2026–27 Official Salary &amp; Tax Certificate
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Download or print an official DMHA-verified income &amp; tax withholding summary for
                NBR e-Return filing or bank loan verification.
              </p>
              <button
                type="button"
                onClick={() => setTaxCertOpen(true)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f172a] py-2.5 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
              >
                <Icon name="print" size={14} />
                Open Printable Income &amp; Tax Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Official Salary Slip Modal */}
      {activePayslip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setActivePayslip(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">
                  DMHA · Official Faculty Payslip
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">
                  {activePayslip.teacherName}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  {activePayslip.subject} · {activePayslip.month}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePayslip(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Monthly Base Salary</span>
                <strong className="text-slate-900">
                  ৳{activePayslip.baseSalary.toLocaleString()}
                </strong>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Bonus / Extra Class Allowance</span>
                <strong>+৳{activePayslip.bonusAllowance.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>Late / Attendance Deduction</span>
                <strong>-৳{activePayslip.lateDeduction.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between rounded-2xl bg-[#0f172a] p-4 text-white">
                <span className="font-bold text-emerald-300">Net Salary Credited</span>
                <strong className="text-lg font-black">
                  ৳{activePayslip.netSalary.toLocaleString()}
                </strong>
              </div>
              <p className="pt-1 text-center font-mono text-[10px] text-slate-400">
                Status: {activePayslip.status.toUpperCase()} · Ref:{' '}
                {activePayslip.bankRef || 'PENDING'} · Authorized by Principal Shahid
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300"
              >
                <Icon name="print" size={14} />
                Print Payslip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Salary Package Modal (Admin / Payroll Staff) */}
      {editingSalary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setEditingSalary(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveSalaryEdit}
            className="w-full max-w-sm space-y-3 rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <h3 className="text-lg font-black text-slate-900">
              Adjust Salary · {editingSalary.teacherName}
            </h3>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">
                Base Salary (BDT)
              </label>
              <input
                type="number"
                value={salBase}
                onChange={(e) => setSalBase(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">
                Bonus / Extra Class Allowance (BDT)
              </label>
              <input
                type="number"
                value={salBonus}
                onChange={(e) => setSalBonus(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">
                Late Deduction (BDT)
              </label>
              <input
                type="number"
                value={salDeduct}
                onChange={(e) => setSalDeduct(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSalary(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-black text-white"
              >
                Save Package
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printable Annual Income & Tax Certificate Modal */}
      {taxCertOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setTaxCertOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">
                  DMHA · Official Income &amp; Tax Certificate (FY 2026–27)
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">
                  {activeProfile?.teacherName || activeTeacher?.name}
                </h3>
                <p className="font-mono text-xs font-bold text-slate-500">
                  e-TIN: {activeProfile?.tinNumber || 'TIN-BD-482910340'} · Bank:{' '}
                  {activeProfile?.bankName || 'BRAC Bank PLC'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTaxCertOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Salary Credited (YTD)</span>
                <strong className="text-slate-900">৳{paidSalariesTotal.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Extra Duty &amp; Invigilation Allowances</span>
                <strong className="text-slate-900">৳{paidAllowanceTotal.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reimbursed Official Expenses (Non-Taxable)</span>
                <strong className="text-slate-900">৳{paidReimbTotal.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Accumulated Provident Fund (Vested)</span>
                <strong className="text-emerald-700">৳{totalPfBalance.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between rounded-2xl bg-[#0f172a] p-4 text-white">
                <span className="font-bold text-emerald-300">Total Credited Earnings (YTD)</span>
                <strong className="text-lg font-black">
                  ৳{totalCreditedYtd.toLocaleString()}
                </strong>
              </div>
              <p className="pt-1 text-center font-mono text-[10px] text-slate-400">
                Issued {formatPrettyDate(todayIso)} · Verified by DMHA Accounts &amp; Principal
                Shahid
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300"
              >
                <Icon name="print" size={14} />
                Print Certificate PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
