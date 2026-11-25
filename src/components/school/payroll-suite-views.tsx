'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  computeMonthlyPayrollSheet,
  PAYROLL_MONTH_OPTIONS,
} from '@/lib/dmhs-payroll'
import { Icon } from './icons'
import { useSchool } from './store'
import type {
  PayrollAdjustmentItem,
  PayrollDisbursementRecord,
} from './types'

type PayrollSubTab =
  | 'base'
  | 'allowances'
  | 'bonus'
  | 'deductions'
  | 'attendance'
  | 'payroll'
  | 'settings'

export function PayrollSuiteWorkspace() {
  const { payrollBook, accountingBook, runPayrollAction, notify } = useSchool()
  const [subTab, setSubTab] = useState<PayrollSubTab>('payroll')
  const [selectedMonth, setSelectedMonth] = useState('November 2026')

  // Employee Filters (Base Salary & Payroll Sheet)
  const [empTypeFilter, setEmpTypeFilter] = useState<'all' | 'teacher' | 'staff'>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'inactive'>('active')
  const [searchQuery, setSearchQuery] = useState('')

  // Quick Add Employee Modal
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [qaName, setQaName] = useState('')
  const [qaType, setQaType] = useState<'teacher' | 'staff'>('teacher')
  const [qaDesignation, setQaDesignation] = useState('')
  const [qaDepartment, setQaDepartment] = useState('Academic Faculty')
  const [qaBaseSalary, setQaBaseSalary] = useState('35000')
  const [qaPhone, setQaPhone] = useState('')
  const [qaBank, setQaBank] = useState('EXIM Bank Payroll')

  // Inline Base Salary Drafts
  const [salaryDrafts, setSalaryDrafts] = useState<Record<string, string>>({})
  useEffect(() => {
    const next: Record<string, string> = {}
    payrollBook.employees.forEach((e) => {
      next[e.id] = String(e.baseSalary)
    })
    setSalaryDrafts(next)
  }, [payrollBook.employees])

  // Inline Attendance Drafts for selectedMonth
  const [attDrafts, setAttDrafts] = useState<
    Record<string, { presentDays: string; lateDays: string; absentDays: string; paidLeaveDays: string; overtimeHours: string }>
  >({})
  useEffect(() => {
    const next: Record<string, { presentDays: string; lateDays: string; absentDays: string; paidLeaveDays: string; overtimeHours: string }> = {}
    const wd = payrollBook.settings.workingDaysPerMonth || 30
    payrollBook.employees.forEach((e) => {
      const rec = payrollBook.attendance.find(
        (a) => a.employeeId === e.id && a.month === selectedMonth,
      )
      next[e.id] = {
        presentDays: String(rec ? rec.presentDays : wd),
        lateDays: String(rec ? rec.lateDays : 0),
        absentDays: String(rec ? rec.absentDays : 0),
        paidLeaveDays: String(rec ? rec.paidLeaveDays : 0),
        overtimeHours: String(rec ? rec.overtimeHours : 0),
      }
    })
    setAttDrafts(next)
  }, [payrollBook.employees, payrollBook.attendance, payrollBook.settings.workingDaysPerMonth, selectedMonth])

  // Adjustment Form (Allowances / Bonus / Deductions)
  const [adjEmployeeId, setAdjEmployeeId] = useState(payrollBook.employees[0]?.id || 'tch-nadia')
  const [adjTitle, setAdjTitle] = useState('')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjMonth, setAdjMonth] = useState('Recurring')
  const [adjNotes, setAdjNotes] = useState('')

  // Bulk Festival Bonus Form
  const [bulkBonusTitle, setBulkBonusTitle] = useState('Eid Festival Bonus')
  const [bulkBonusMode, setBulkBonusMode] = useState<'percent' | 'fixed'>('percent')
  const [bulkBonusVal, setBulkBonusVal] = useState(
    String(payrollBook.settings.defaultFestivalBonusPercent || 50),
  )
  const [bulkBonusTarget, setBulkBonusTarget] = useState<'all' | 'teacher' | 'staff'>('all')

  // Disbursement Bank/Cash Selector + Payslip Print Modal
  const cashBankLedgers = useMemo(
    () => accountingBook.ledgers.filter((l) => (l.isBank || l.isCash) && l.active),
    [accountingBook.ledgers],
  )
  const [payoutLedgerId, setPayoutLedgerId] = useState(
    payrollBook.settings.defaultPaymentLedgerId || cashBankLedgers[0]?.id || 'ldg-10107',
  )
  const [inspectSlip, setInspectSlip] = useState<PayrollDisbursementRecord | null>(null)
  const [busy, setBusy] = useState(false)

  // Settings Draft
  const [setWorkingDays, setSetWorkingDays] = useState(String(payrollBook.settings.workingDaysPerMonth))
  const [setLatesRule, setSetLatesRule] = useState(String(payrollBook.settings.latesPerAbsentDay))
  const [setPfPct, setSetPfPct] = useState(String(payrollBook.settings.defaultPfPercent))
  const [setBonusPct, setSetBonusPct] = useState(String(payrollBook.settings.defaultFestivalBonusPercent))
  const [setDefLedger, setSetDefLedger] = useState(payrollBook.settings.defaultPaymentLedgerId)
  const [setAutoPost, setSetAutoPost] = useState(payrollBook.settings.autoPostAccountingVoucher)

  const sheet = useMemo(
    () => computeMonthlyPayrollSheet(payrollBook, selectedMonth),
    [payrollBook, selectedMonth],
  )

  const filteredEmployees = useMemo(() => {
    return payrollBook.employees.filter((e) => {
      if (empTypeFilter !== 'all' && e.employeeType !== empTypeFilter) return false
      if (statusFilter === 'active' && !e.active) return false
      if (statusFilter === 'inactive' && e.active) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          e.name.toLowerCase().includes(q) ||
          e.employeeCode.toLowerCase().includes(q) ||
          e.designation.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [payrollBook.employees, empTypeFilter, statusFilter, searchQuery])

  const filteredSheetRows = useMemo(() => {
    const allowedIds = new Set(filteredEmployees.map((e) => e.id))
    return sheet.rows.filter((r) => allowedIds.has(r.employee.id))
  }, [sheet.rows, filteredEmployees])

  const activeTeachersCount = payrollBook.employees.filter(
    (e) => e.active && e.employeeType === 'teacher',
  ).length
  const activeStaffCount = payrollBook.employees.filter(
    (e) => e.active && e.employeeType === 'staff',
  ).length

  const handleSaveBaseSalaries = async () => {
    setBusy(true)
    const updates = filteredEmployees.map((e) => ({
      id: e.id,
      baseSalary: Number(salaryDrafts[e.id] ?? e.baseSalary),
    }))
    await runPayrollAction(
      { action: 'save_base_salaries', updates },
      `Saved base salaries for ${updates.length} employee(s)!`,
    )
    setBusy(false)
  }

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!qaName.trim() || !qaDesignation.trim()) return
    const res = await runPayrollAction(
      {
        action: 'add_employee',
        name: qaName,
        employeeType: qaType,
        designation: qaDesignation,
        department: qaDepartment,
        baseSalary: Number(qaBaseSalary),
        phone: qaPhone,
        bankAccountLabel: qaBank,
      },
      `${qaName} added to DMHA Payroll!`,
    )
    if (res.ok) {
      setQaName('')
      setQaDesignation('')
      setQaPhone('')
      setQuickAddOpen(false)
    }
  }

  const handleAddAdjustment = async (kind: PayrollAdjustmentItem['kind'], e: React.FormEvent) => {
    e.preventDefault()
    if (!adjTitle.trim() || !adjAmount) return
    const res = await runPayrollAction(
      {
        action: 'save_adjustment',
        employeeId: adjEmployeeId,
        kind,
        title: adjTitle,
        amount: Number(adjAmount),
        month: kind === 'bonus' ? selectedMonth : adjMonth,
        notes: adjNotes,
      },
      `Saved ${kind} (${adjTitle})!`,
    )
    if (res.ok) {
      setAdjTitle('')
      setAdjAmount('')
      setAdjNotes('')
    }
  }

  const handleSaveAttendance = async () => {
    setBusy(true)
    const records = payrollBook.employees
      .filter((e) => e.active)
      .map((e) => {
        const d = attDrafts[e.id]
        return {
          employeeId: e.id,
          presentDays: Number(d?.presentDays ?? sheet.workingDays),
          lateDays: Number(d?.lateDays ?? 0),
          absentDays: Number(d?.absentDays ?? 0),
          paidLeaveDays: Number(d?.paidLeaveDays ?? 0),
          overtimeHours: Number(d?.overtimeHours ?? 0),
        }
      })
    await runPayrollAction(
      { action: 'save_attendance', month: selectedMonth, records },
      `Saved ${selectedMonth} payroll attendance!`,
    )
    setBusy(false)
  }

  const exportPayrollCsv = () => {
    const rows = [
      [
        'Emp Code',
        'Employee Name',
        'Type',
        'Designation',
        'Bank / Payout',
        'Base Salary',
        'Allowances',
        'Bonus',
        'Deductions',
        'Attendance Penalty',
        'Net Payable (BDT)',
        'Status',
        'Voucher Ref',
      ],
      ...sheet.rows.map((r) => [
        r.employee.employeeCode,
        r.employee.name,
        r.employee.employeeType.toUpperCase(),
        r.employee.designation,
        r.employee.bankAccountLabel || 'Bank',
        r.baseSalary,
        r.allowances,
        r.bonuses,
        r.deductions,
        r.attendancePenalty,
        r.netPayable,
        r.disbursement ? 'PAID' : 'PENDING',
        r.disbursement?.linkedVoucherNo || '',
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DMHA-Payroll-${selectedMonth.replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    notify(`Exported ${selectedMonth} Payroll Bank Transfer CSV!`)
  }

  const renderAdjustmentManager = (
    kind: PayrollAdjustmentItem['kind'],
    heading: string,
    accentClass: string,
    defaultSuggestions: string[],
  ) => {
    const list = payrollBook.adjustments.filter((a) => a.kind === kind)
    return (
      <div className="space-y-5">
        {kind === 'bonus' && (
          <div className="dmhs-card rounded-[24px] border border-emerald-200 bg-emerald-50/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  1-Click Festival &amp; Annual Bonus Engine
                </p>
                <h4 className="text-sm font-black text-slate-900">
                  Apply Bulk Bonus for {selectedMonth}
                </h4>
              </div>
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              <input
                value={bulkBonusTitle}
                onChange={(e) => setBulkBonusTitle(e.target.value)}
                placeholder="Bonus title (e.g., Eid Bonus)"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
              />
              <select
                value={bulkBonusTarget}
                onChange={(e) => setBulkBonusTarget(e.target.value as 'all' | 'teacher' | 'staff')}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
              >
                <option value="all">All Active Employees</option>
                <option value="teacher">Teachers Only</option>
                <option value="staff">Staff Only</option>
              </select>
              <select
                value={bulkBonusMode}
                onChange={(e) => setBulkBonusMode(e.target.value as 'percent' | 'fixed')}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
              >
                <option value="percent">% of Base Salary</option>
                <option value="fixed">Fixed Amount (৳)</option>
              </select>
              <input
                type="number"
                min={1}
                value={bulkBonusVal}
                onChange={(e) => setBulkBonusVal(e.target.value)}
                placeholder={bulkBonusMode === 'percent' ? 'e.g., 50 (%)' : 'e.g., 5000 (৳)'}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black"
              />
              <button
                type="button"
                onClick={() =>
                  void runPayrollAction(
                    {
                      action: 'apply_bulk_bonus',
                      title: bulkBonusTitle,
                      month: selectedMonth,
                      mode: bulkBonusMode,
                      value: Number(bulkBonusVal),
                      targetType: bulkBonusTarget,
                    },
                    `Applied ${bulkBonusTitle} for ${selectedMonth}!`,
                  )
                }
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
              >
                Apply Bulk Bonus
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={(e) => void handleAddAdjustment(kind, e)}
            className="dmhs-card h-fit space-y-3 rounded-[24px] p-5"
          >
            <h3 className="text-sm font-black text-slate-900">Add {heading}</h3>
            <select
              value={adjEmployeeId}
              onChange={(e) => setAdjEmployeeId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold"
            >
              {payrollBook.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeCode} · {e.employeeType.toUpperCase()})
                </option>
              ))}
            </select>
            <input
              list={`adj-suggest-${kind}`}
              value={adjTitle}
              onChange={(e) => setAdjTitle(e.target.value)}
              placeholder={`e.g., ${defaultSuggestions[0]}`}
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
            />
            <datalist id={`adj-suggest-${kind}`}>
              {defaultSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="Amount (৳ BDT) *"
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black"
              />
              {kind === 'bonus' ? (
                <input
                  value={selectedMonth}
                  readOnly
                  className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
                />
              ) : (
                <select
                  value={adjMonth}
                  onChange={(e) => setAdjMonth(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
                >
                  <option value="Recurring">Every Month (Recurring)</option>
                  {PAYROLL_MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      Only {m}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <input
              value={adjNotes}
              onChange={(e) => setAdjNotes(e.target.value)}
              placeholder="Note / approval ref (optional)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300"
            >
              + Save {heading}
            </button>
          </form>

          <div className="space-y-2.5">
            {list.map((a) => {
              const emp = payrollBook.employees.find((e) => e.id === a.employeeId)
              return (
                <div
                  key={a.id}
                  className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${accentClass}`}>
                        {a.month}
                      </span>
                      <span className="text-xs font-black text-slate-900">
                        {emp?.name || a.employeeId}{' '}
                        <span className="font-semibold text-slate-400">
                          ({emp?.designation || 'Employee'})
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-700">{a.title}</p>
                    {a.notes && <p className="text-[11px] text-slate-400">{a.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-mono text-sm font-black ${
                        kind === 'deduction' ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {kind === 'deduction' ? '-' : '+'}৳{a.amount.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void runPayrollAction(
                          { action: 'delete_adjustment', id: a.id },
                          `Removed ${a.title}`,
                        )
                      }
                      className="rounded-lg bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold text-rose-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
            {list.length === 0 && (
              <div className="dmhs-card rounded-2xl p-8 text-center text-xs font-bold text-slate-400">
                No {heading.toLowerCase()} entries configured yet.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Top 4 Payroll Executive KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-300">
            Total Payroll ({selectedMonth})
          </p>
          <p className="mt-1 text-3xl font-black">৳{sheet.totalNetPayroll.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-slate-300">
            Paid ৳{sheet.totalPaidAmount.toLocaleString()} · Pending ৳{sheet.totalPendingAmount.toLocaleString()}
          </p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-600">
            Active Employees
          </p>
          <p className="mt-1 text-3xl font-black text-slate-900">{sheet.activeCount}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            {activeTeachersCount} Teachers · {activeStaffCount} Staff
          </p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-amber-600">
            Pending Payroll
          </p>
          <p className="mt-1 text-3xl font-black text-amber-600">{sheet.pendingCount}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            {sheet.paidCount} employee(s) disbursed for {selectedMonth}
          </p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-sky-600">
            Days This Month
          </p>
          <p className="mt-1 text-3xl font-black text-sky-700">{sheet.workingDays}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Rule: {payrollBook.settings.latesPerAbsentDay} Lates = 1 Day Deduction
          </p>
        </div>
      </div>

      {/* Payroll Controls & All 7 Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-2xs">
        <div className="flex flex-wrap gap-1">
          {(
            [
              { id: 'payroll', label: 'Payroll Run & Slips' },
              { id: 'base', label: 'Base Salary' },
              { id: 'allowances', label: 'Allowances' },
              { id: 'bonus', label: 'Bonus' },
              { id: 'deductions', label: 'Deductions' },
              { id: 'attendance', label: 'Attendance' },
              { id: 'settings', label: 'Settings' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                subTab === t.id
                  ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-900"
          >
            {PAYROLL_MONTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setQuickAddOpen((v) => !v)}
            className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700"
          >
            + Quick Add
          </button>
          <button
            type="button"
            onClick={exportPayrollCsv}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            <Icon name="download" size={13} />
            Bank CSV
          </button>
        </div>
      </div>

      {/* Quick Add Employee Form */}
      {quickAddOpen && (
        <form
          onSubmit={handleQuickAdd}
          className="dmhs-card grid gap-3 rounded-[24px] border-2 border-emerald-200 p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900">Quick Add Employee to Payroll</h4>
            <button
              type="button"
              onClick={() => setQuickAddOpen(false)}
              className="text-xs font-bold text-slate-400"
            >
              Close
            </button>
          </div>
          <input
            value={qaName}
            onChange={(e) => setQaName(e.target.value)}
            placeholder="Full Name *"
            required
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
          />
          <select
            value={qaType}
            onChange={(e) => setQaType(e.target.value as 'teacher' | 'staff')}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
          >
            <option value="teacher">Teacher (Faculty)</option>
            <option value="staff">Staff (Admin / Ops)</option>
          </select>
          <input
            value={qaDesignation}
            onChange={(e) => setQaDesignation(e.target.value)}
            placeholder="Designation (e.g., Coordinator) *"
            required
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
          />
          <input
            type="number"
            min={1000}
            value={qaBaseSalary}
            onChange={(e) => setQaBaseSalary(e.target.value)}
            placeholder="Base Salary (৳) *"
            required
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black"
          />
          <input
            value={qaDepartment}
            onChange={(e) => setQaDepartment(e.target.value)}
            placeholder="Department"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
          />
          <input
            value={qaPhone}
            onChange={(e) => setQaPhone(e.target.value)}
            placeholder="Phone (optional)"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
          />
          <input
            value={qaBank}
            onChange={(e) => setQaBank(e.target.value)}
            placeholder="Bank / bKash Account"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#0f172a] py-2 text-xs font-black text-emerald-300"
          >
            Save Employee
          </button>
        </form>
      )}

      {/* Shared Filter Bar for Base Salary & Payroll Run */}
      {(subTab === 'base' || subTab === 'payroll') && (
        <div className="dmhs-card flex flex-wrap items-center justify-between gap-2.5 rounded-2xl p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1">
              {(['all', 'teacher', 'staff'] as const).map((et) => (
                <button
                  key={et}
                  type="button"
                  onClick={() => setEmpTypeFilter(et)}
                  className={`rounded-lg px-3 py-1 text-[11px] font-black capitalize ${
                    empTypeFilter === et
                      ? 'bg-[#0f172a] text-emerald-300'
                      : 'text-slate-600'
                  }`}
                >
                  {et === 'all' ? 'All Employees' : et === 'teacher' ? 'Teacher' : 'Staff'}
                </button>
              ))}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'active' | 'all' | 'inactive')}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold"
            >
              <option value="active">Status: Active</option>
              <option value="all">Status: All</option>
              <option value="inactive">Status: Inactive</option>
            </select>
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID, designation..."
            className="w-60 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold"
          />
        </div>
      )}

      {/* ================= TAB 1: BASE SALARY MANAGEMENT ================= */}
      {subTab === 'base' && (
        <div className="dmhs-card space-y-4 rounded-[24px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Base Salary Management ({filteredEmployees.length} Employees)
              </h3>
              <p className="text-xs text-slate-500">
                Edit monthly base salaries inline and click Save to recalculate net payroll instantly.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSaveBaseSalaries()}
              className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-xs font-black text-emerald-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Save Base Salaries'}
            </button>
          </div>

          <div className="space-y-2">
            {filteredEmployees.map((emp, idx) => (
              <div
                key={emp.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-[#0f172a] text-xs font-black text-emerald-300">
                    {emp.name.charAt(0)}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-slate-400">
                        #{idx + 1} · {emp.employeeCode}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                          emp.employeeType === 'teacher'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-violet-100 text-violet-800'
                        }`}
                      >
                        {emp.employeeType}
                      </span>
                      {!emp.active && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-700">
                          INACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-black text-slate-900">{emp.name}</p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {emp.designation} · {emp.department}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                    <span className="mr-1.5 text-xs font-black text-emerald-700">৳</span>
                    <input
                      type="number"
                      min={0}
                      value={salaryDrafts[emp.id] ?? String(emp.baseSalary)}
                      onChange={(e) =>
                        setSalaryDrafts((prev) => ({ ...prev, [emp.id]: e.target.value }))
                      }
                      className="w-28 bg-transparent font-mono text-sm font-black text-slate-900 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void runPayrollAction(
                        { action: 'toggle_employee_status', employeeId: emp.id },
                        `Toggled ${emp.name} status`,
                      )
                    }
                    className="rounded-xl bg-slate-200/70 px-3 py-1.5 text-[10px] font-extrabold text-slate-700 hover:bg-slate-200"
                  >
                    {emp.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 2: ALLOWANCES ================= */}
      {subTab === 'allowances' &&
        renderAdjustmentManager(
          'allowance',
          'Allowance',
          'bg-sky-50 text-sky-800',
          ['House Rent Allowance', 'Medical Allowance', 'Transport & Conveyance', 'Class Coordinator Allowance'],
        )}

      {/* ================= TAB 3: BONUS ================= */}
      {subTab === 'bonus' &&
        renderAdjustmentManager(
          'bonus',
          'Bonus',
          'bg-emerald-50 text-emerald-800',
          ['Eid Festival Bonus', '100% Attendance Excellence Bonus', 'Annual Performance Bonus', 'Exam Duty Honorarium'],
        )}

      {/* ================= TAB 4: DEDUCTIONS ================= */}
      {subTab === 'deductions' &&
        renderAdjustmentManager(
          'deduction',
          'Deduction',
          'bg-rose-50 text-rose-700',
          ['Provident Fund (PF) Contribution', 'Income Tax (TDS)', 'Salary Advance Recovery', 'Campus Loan Installment'],
        )}

      {/* ================= TAB 5: ATTENDANCE INTEGRATION ================= */}
      {subTab === 'attendance' && (
        <div className="dmhs-card space-y-4 rounded-[24px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Monthly Payroll Attendance &amp; Late Penalty ({selectedMonth})
              </h3>
              <p className="text-xs text-slate-500">
                Every {payrollBook.settings.latesPerAbsentDay} late check-in(s) equals 1 unpaid day deduction automatically.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void runPayrollAction(
                    { action: 'sync_hr_attendance', month: selectedMonth },
                    `Synced Wi-Fi / HR logs into ${selectedMonth} Payroll!`,
                  )
                }
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100"
              >
                Sync from Campus Wi-Fi / HR
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSaveAttendance()}
                className="rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-black text-emerald-300"
              >
                {busy ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-200">
                <tr>
                  <th className="px-3.5 py-3">Employee</th>
                  <th className="px-3 py-3 text-center">Present Days</th>
                  <th className="px-3 py-3 text-center">Late Days</th>
                  <th className="px-3 py-3 text-center">Unpaid Absent</th>
                  <th className="px-3 py-3 text-center">Paid Leave</th>
                  <th className="px-3.5 py-3 text-right">Auto Deduction (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sheet.rows.map((r) => {
                  const d = attDrafts[r.employee.id] || {
                    presentDays: String(r.presentDays),
                    lateDays: String(r.lateDays),
                    absentDays: String(r.absentDays),
                    paidLeaveDays: String(r.paidLeaveDays),
                    overtimeHours: String(r.overtimeHours),
                  }
                  return (
                    <tr key={r.employee.id}>
                      <td className="px-3.5 py-2.5">
                        <p className="font-black text-slate-900">{r.employee.name}</p>
                        <p className="text-[10px] font-semibold text-slate-400">
                          {r.employee.designation} · Base ৳{r.baseSalary.toLocaleString()}
                        </p>
                      </td>
                      {(['presentDays', 'lateDays', 'absentDays', 'paidLeaveDays'] as const).map(
                        (field) => (
                          <td key={field} className="px-2 py-2 text-center">
                            <input
                              type="number"
                              min={0}
                              max={sheet.workingDays}
                              value={d[field]}
                              onChange={(e) =>
                                setAttDrafts((prev) => ({
                                  ...prev,
                                  [r.employee.id]: { ...d, [field]: e.target.value },
                                }))
                              }
                              className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center font-mono text-xs font-black"
                            />
                          </td>
                        ),
                      )}
                      <td className="px-3.5 py-2.5 text-right font-mono font-black text-rose-600">
                        {r.attendancePenalty > 0
                          ? `-৳${r.attendancePenalty.toLocaleString()} (${r.effectivePenaltyDays}d)`
                          : '৳0'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 6: MONTHLY PAYROLL RUN & AUTO DOUBLE-ENTRY DISBURSEMENT ================= */}
      {subTab === 'payroll' && (
        <div className="space-y-4">
          <div className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-[10px] font-black uppercase text-emerald-800">
                  Disbursement Account (Auto-Posts Balanced Debit Voucher)
                </p>
                <select
                  value={payoutLedgerId}
                  onChange={(e) => setPayoutLedgerId(e.target.value)}
                  className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-900"
                >
                  {cashBankLedgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      [{l.code}] {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-xl bg-white/80 px-3.5 py-2 text-[11px] font-semibold text-slate-600 ring-1 ring-emerald-200/70">
                Auto-Voucher:{' '}
                <strong className="text-emerald-700">
                  {payrollBook.settings.autoPostAccountingVoucher ? 'ENABLED (Dr Salary / Cr Bank)' : 'Manual'}
                </strong>
              </div>
            </div>

            <button
              type="button"
              disabled={sheet.pendingCount === 0}
              onClick={() =>
                void runPayrollAction(
                  {
                    action: 'disburse_payroll',
                    month: selectedMonth,
                    bulk: true,
                    paymentLedgerId: payoutLedgerId,
                  },
                  `Disbursed ${selectedMonth} payroll for ${sheet.pendingCount} pending employee(s)!`,
                )
              }
              className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-xs font-black text-emerald-300 hover:bg-slate-800 disabled:opacity-40"
            >
              Pay All Pending ({sheet.pendingCount} · ৳{sheet.totalPendingAmount.toLocaleString()})
            </button>
          </div>

          <div className="dmhs-card overflow-x-auto rounded-[24px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-200">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-3 py-3 text-right">Base</th>
                  <th className="px-3 py-3 text-right">+Allow.</th>
                  <th className="px-3 py-3 text-right">+Bonus</th>
                  <th className="px-3 py-3 text-right">-Deduct</th>
                  <th className="px-3 py-3 text-right">-Attn</th>
                  <th className="px-3 py-3 text-right">Net Payable</th>
                  <th className="px-4 py-3 text-right">Status &amp; Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSheetRows.map((r) => (
                  <tr key={r.employee.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-900">{r.employee.name}</p>
                      <p className="text-[10px] font-semibold text-slate-400">
                        {r.employee.employeeCode} · {r.employee.designation}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-700">
                      ৳{r.baseSalary.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">
                      {r.allowances > 0 ? `+৳${r.allowances.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">
                      {r.bonuses > 0 ? `+৳${r.bonuses.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-rose-600">
                      {r.deductions > 0 ? `-৳${r.deductions.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-rose-600">
                      {r.attendancePenalty > 0 ? `-৳${r.attendancePenalty.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-black text-slate-950">
                      ৳{r.netPayable.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.disbursement ? (
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                            PAID {r.disbursement.linkedVoucherNo ? `· ${r.disbursement.linkedVoucherNo}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => setInspectSlip(r.disbursement)}
                            className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black text-emerald-300"
                          >
                            Payslip PDF
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void runPayrollAction(
                                { action: 'void_disbursement', disbursementId: r.disbursement!.id },
                                `Reversed payslip for ${r.employee.name}`,
                              )
                            }
                            className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600"
                          >
                            Undo
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void runPayrollAction(
                              {
                                action: 'disburse_payroll',
                                month: selectedMonth,
                                employeeId: r.employee.id,
                                paymentLedgerId: payoutLedgerId,
                              },
                              `Paid ${r.employee.name} (৳${r.netPayable.toLocaleString()}) & posted Debit Voucher!`,
                            )
                          }
                          className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-[11px] font-black text-white hover:bg-emerald-700"
                        >
                          Pay Now
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 7: PAYROLL SETTINGS ================= */}
      {subTab === 'settings' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            await runPayrollAction(
              {
                action: 'save_settings',
                workingDaysPerMonth: Number(setWorkingDays),
                latesPerAbsentDay: Number(setLatesRule),
                defaultPfPercent: Number(setPfPct),
                defaultFestivalBonusPercent: Number(setBonusPct),
                defaultPaymentLedgerId: setDefLedger,
                autoPostAccountingVoucher: setAutoPost,
              },
              'Payroll rules & accounting integration settings saved!',
            )
          }}
          className="dmhs-card max-w-2xl space-y-4 rounded-[24px] p-6"
        >
          <h3 className="text-base font-black text-slate-900">
            Payroll Calculation &amp; Double-Entry Settings
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Working Days Per Month
              </label>
              <input
                type="number"
                min={20}
                max={31}
                value={setWorkingDays}
                onChange={(e) => setSetWorkingDays(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Late Check-Ins Equal 1 Absent Day
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={setLatesRule}
                onChange={(e) => setSetLatesRule(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Default Provident Fund (PF %)
              </label>
              <input
                type="number"
                min={0}
                max={25}
                value={setPfPct}
                onChange={(e) => setSetPfPct(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Default Festival Bonus (% of Base)
              </label>
              <input
                type="number"
                min={0}
                max={200}
                value={setBonusPct}
                onChange={(e) => setSetBonusPct(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">
              Default Disbursement Bank / Cash Account
            </label>
            <select
              value={setDefLedger}
              onChange={(e) => setSetDefLedger(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold"
            >
              {cashBankLedgers.map((l) => (
                <option key={l.id} value={l.id}>
                  [{l.code}] {l.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 p-3.5 text-xs font-black text-emerald-900">
            <input
              type="checkbox"
              checked={setAutoPost}
              onChange={(e) => setSetAutoPost(e.target.checked)}
              className="size-4 accent-emerald-600"
            />
            Automatically post balanced Double-Entry Debit Voucher (Dr Salary Expense / Cr Bank) on every Payroll disbursement
          </label>

          <button
            type="submit"
            className="rounded-xl bg-[#0f172a] px-6 py-2.5 text-xs font-black text-emerald-300"
          >
            Save Payroll Settings
          </button>
        </form>
      )}

      {/* Official Printable Employee Payslip Modal (A4 PDF) */}
      {inspectSlip && (
        <div
          className="dmhs-print-receipt fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setInspectSlip(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="dmhs-print-receipt-card w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between border-b-2 border-slate-900/10 pb-4">
              <div>
                <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                  Official Monthly Salary Payslip · PAID
                </span>
                <h3 className="mt-1.5 text-xl font-black text-slate-950">
                  DMHA · Smart Learning App
                </h3>
                <p className="text-[11px] font-semibold text-slate-500">
                  Payslip No: <strong className="font-mono text-slate-900">{inspectSlip.slipNo}</strong> · Period:{' '}
                  <strong>{inspectSlip.month}</strong>
                  {inspectSlip.linkedVoucherNo ? ` · Voucher ${inspectSlip.linkedVoucherNo}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectSlip(null)}
                className="dmhs-no-print flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl bg-slate-50 p-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Employee</span>
                <p className="font-black text-slate-900">{inspectSlip.employeeName}</p>
                <p className="text-[11px] font-semibold text-slate-500">{inspectSlip.designation}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Disbursement Details</span>
                <p className="font-bold text-slate-900">{inspectSlip.paymentLedgerName}</p>
                <p className="text-[11px] font-semibold text-slate-500">Paid on {inspectSlip.paidAt}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3.5 space-y-1.5">
                <p className="text-[10px] font-black uppercase text-emerald-800">Earnings</p>
                <div className="flex justify-between">
                  <span>Base Salary</span>
                  <strong className="font-mono">৳{inspectSlip.baseSalary.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Allowances</span>
                  <strong className="font-mono">৳{inspectSlip.totalAllowances.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Bonuses</span>
                  <strong className="font-mono">৳{inspectSlip.totalBonuses.toLocaleString()}</strong>
                </div>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3.5 space-y-1.5">
                <p className="text-[10px] font-black uppercase text-rose-700">Deductions</p>
                <div className="flex justify-between">
                  <span>PF / Tax / Other</span>
                  <strong className="font-mono">৳{inspectSlip.totalDeductions.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Late / Absent Penalty</span>
                  <strong className="font-mono">৳{inspectSlip.attendancePenalty.toLocaleString()}</strong>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#0f172a] p-4 text-white">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                Net Salary Disbursed
              </span>
              <span className="font-mono text-2xl font-black text-emerald-400">
                ৳{inspectSlip.netPayable.toLocaleString()}
              </span>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-4 pt-3 text-center text-[11px] font-bold text-slate-500">
              <div className="border-t border-slate-300 pt-2">Accounts Officer</div>
              <div className="border-t border-slate-300 pt-2">Principal Approved</div>
              <div className="border-t border-slate-300 pt-2">Employee Signature</div>
            </div>

            <div className="dmhs-no-print mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInspectSlip(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-5 py-2 text-xs font-black text-emerald-300"
              >
                <Icon name="print" size={14} />
                Print / Save Payslip PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
