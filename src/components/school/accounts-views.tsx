'use client'

import React, { useMemo, useState } from 'react'
import { downloadExcelCsv } from '@/lib/csv-export'
import { computeFinancialStatements, computePettyCashSummary } from '@/lib/dmhs-accounting'
import { computeMonthlyPayrollSheet } from '@/lib/dmhs-payroll'
import { AccountingReportsWorkspace } from './accounting-reports-views'
import { AccountingSetupWorkspace } from './accounting-setup-views'
import { AccountingVouchersWorkspace } from './accounting-vouchers-views'
import { MonthlyBillingGeneratorPanel } from './billing-generator-panel'
import { PayrollSuiteWorkspace } from './payroll-suite-views'
import { GUARDIAN_PROFILE } from './data'
import { DateRangeBar, matchesDateRange } from './date-utils'
import { Icon } from './icons'
import { useSchool } from './store'
import type { ExpenseCategory, FeeCategory, FeeInvoice, OtherIncomeRecord } from './types'
import { FeeReceiptModal, PageShell, SectionTitle } from './ui'

const FEE_CATEGORIES: FeeCategory[] = [
  'Admission Fee',
  'Tuition Fee',
  'Exam Fee',
  'Lab & Library',
  'Transport & Bus',
  'Uniform & Books',
  'Activity & CCA',
  'Other Fee',
]

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Teacher Payroll',
  'Staff Salary',
  'Utilities & Internet',
  'Campus Maintenance',
  'Lab & Books',
  'Transport Fuel',
  'Events & Supplies',
  'Other Cost',
]

const INCOME_CATEGORIES: OtherIncomeRecord['category'][] = [
  'Admission Form Sales',
  'Uniform & Book Store',
  'Canteen Revenue',
  'Grant / Donation',
  'Other Income',
]

export type AccountsSubTab =
  | 'ledger'
  | 'vouchers'
  | 'acctreports'
  | 'setup'
  | 'payroll'
  | 'fees'
  | 'autobill'
  | 'expenses'
  | 'income'

export function AccountsOverviewView({
  initialTab = 'ledger',
  activeSubTab,
  onSelectSubTab,
}: {
  initialTab?: AccountsSubTab
  activeSubTab?: AccountsSubTab
  onSelectSubTab?: (next: AccountsSubTab) => void
} = {}) {
  const {
    students,
    fees,
    expenses,
    otherIncomes,
    accountingBook,
    payrollBook,
    createFeeInvoice,
    payFeeInvoice,
    addExpense,
    toggleExpenseStatus,
    deleteExpense,
    addOtherIncome,
  } = useSchool()

  const [localTab, setLocalTab] = useState<AccountsSubTab>(initialTab)
  const isSidebarControlled = Boolean(activeSubTab && onSelectSubTab)
  const tab: AccountsSubTab = activeSubTab || localTab
  const setTab = (next: AccountsSubTab) => {
    if (onSelectSubTab) onSelectSubTab(next)
    else setLocalTab(next)
  }
  const [feeFilter, setFeeFilter] = useState<'all' | 'due' | 'paid'>('all')

  const fs = useMemo(() => computeFinancialStatements(accountingBook), [accountingBook])
  const pettySummary = useMemo(() => computePettyCashSummary(accountingBook), [accountingBook])
  const payrollSummary = useMemo(
    () => computeMonthlyPayrollSheet(payrollBook, 'November 2026'),
    [payrollBook],
  )
  const pendingReqsCount = accountingBook.pettyCashRequisitions.filter(
    (r) => r.status === 'pending',
  ).length
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [receiptInvoice, setReceiptInvoice] = useState<FeeInvoice | null>(null)

  // Add Fee form state
  const [feeTarget, setFeeTarget] = useState<string>(students[0]?.id || 'ALL')
  const [feeCategory, setFeeCategory] = useState<FeeCategory>('Admission Fee')
  const [feeTitle, setFeeTitle] = useState('')
  const [feeAmount, setFeeAmount] = useState('15000')
  const [feeDueDate, setFeeDueDate] = useState('Due 30 June 2026')
  const [feeStatus, setFeeStatus] = useState<'due' | 'paid'>('due')

  // Add Expense form state
  const [expTitle, setExpTitle] = useState('')
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Campus Maintenance')
  const [expVendor, setExpVendor] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expStatus, setExpStatus] = useState<'paid' | 'pending'>('paid')

  // Add Other Income form state
  const [incTitle, setIncTitle] = useState('')
  const [incCategory, setIncCategory] =
    useState<OtherIncomeRecord['category']>('Admission Form Sales')
  const [incAmount, setIncAmount] = useState('')

  // Overall Accounting Calculations
  const paidFeesTotal = fees
    .filter((f) => f.status === 'paid')
    .reduce((sum, f) => sum + f.amount, 0)
  const dueFeesTotal = fees
    .filter((f) => f.status === 'due')
    .reduce((sum, f) => sum + f.amount, 0)
  const otherIncomeTotal = otherIncomes.reduce((sum, i) => sum + i.amount, 0)
  const totalRevenue = paidFeesTotal + otherIncomeTotal

  const paidExpensesTotal = expenses
    .filter((e) => e.status === 'paid')
    .reduce((sum, e) => sum + e.amount, 0)
  const pendingExpensesTotal = expenses
    .filter((e) => e.status === 'pending')
    .reduce((sum, e) => sum + e.amount, 0)
  const totalExpenses = paidExpensesTotal + pendingExpensesTotal

  const netBalance = totalRevenue - totalExpenses
  const surplusMargin = totalRevenue > 0 ? Math.round((netBalance / totalRevenue) * 100) : 0

  // Group expenses by category for visual breakdown
  const expenseByCategory = EXPENSE_CATEGORIES.map((cat) => ({
    category: cat,
    amount: expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  const filteredFees = fees.filter(
    (f) =>
      (feeFilter === 'all' ? true : f.status === feeFilter) &&
      matchesDateRange(f.paidAt || f.dueDate, fromDate, toDate),
  )
  const filteredExpenses = expenses.filter((e) => matchesDateRange(e.date, fromDate, toDate))
  const filteredOtherIncomes = otherIncomes.filter((i) => matchesDateRange(i.date, fromDate, toDate))

  const handleAddFee = (e: React.FormEvent) => {
    e.preventDefault()
    const num = Number(feeAmount)
    if (!num || num <= 0) return
    createFeeInvoice({
      target: feeTarget,
      title: feeTitle.trim() || `${feeCategory} — 2026`,
      category: feeCategory,
      amount: num,
      dueDate: feeDueDate,
      status: feeStatus,
    })
    setFeeTitle('')
  }

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault()
    const num = Number(expAmount)
    if (!expTitle.trim() || !num || num <= 0) return
    addExpense({
      title: expTitle,
      category: expCategory,
      vendor: expVendor,
      amount: num,
      status: expStatus,
    })
    setExpTitle('')
    setExpVendor('')
    setExpAmount('')
  }

  const handleAddIncome = (e: React.FormEvent) => {
    e.preventDefault()
    const num = Number(incAmount)
    if (!incTitle.trim() || !num || num <= 0) return
    addOtherIncome({
      title: incTitle,
      category: incCategory,
      amount: num,
    })
    setIncTitle('')
    setIncAmount('')
  }

  return (
    <PageShell
      eyebrow="DMHA Finance & Treasury · Overall Accounting System"
      title="School Accounts & Financial Control"
      subtitle="Bill any student fee (admission, tuition, exams, transport, books), track all campus expenses, and monitor real-time Net Balance & P&L."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const rows: Array<Array<unknown>> = [
                ...fees.map((f) => [
                  'Student Fee',
                  f.receiptNo || f.id,
                  f.studentName,
                  f.category || 'Tuition Fee',
                  f.title,
                  f.status.toUpperCase(),
                  f.paidAt || f.dueDate,
                  f.status === 'paid' ? f.amount : 0,
                  0,
                ]),
                ...otherIncomes.map((inc) => [
                  'Other Income',
                  inc.id,
                  'DMHA Campus',
                  inc.category,
                  inc.title,
                  'RECEIVED',
                  inc.date,
                  inc.amount,
                  0,
                ]),
                ...expenses.map((exp) => [
                  'School Expense',
                  exp.id,
                  exp.vendor,
                  exp.category,
                  exp.title,
                  exp.status.toUpperCase(),
                  exp.date,
                  0,
                  exp.amount,
                ]),
                [
                  'SUMMARY',
                  'TOTAL',
                  'DMHA Net Balance',
                  'All Categories',
                  `Surplus Margin ${surplusMargin}%`,
                  netBalance >= 0 ? 'SURPLUS' : 'DEFICIT',
                  new Date().toISOString().slice(0, 10),
                  totalRevenue,
                  totalExpenses,
                ],
              ]
              downloadExcelCsv(
                `DMHA-Accounts-Ledger-${new Date().toISOString().slice(0, 10)}.csv`,
                [
                  'Type',
                  'Reference',
                  'Party / Student',
                  'Category',
                  'Description',
                  'Status',
                  'Date / Due',
                  'Credit (BDT)',
                  'Debit (BDT)',
                ],
                rows,
              )
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-extrabold text-slate-800 shadow-xs transition hover:border-emerald-400 hover:bg-emerald-50/50"
          >
            <Icon name="sheet" size={15} className="text-emerald-600" />
            Export Excel CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-5 py-3 text-xs font-extrabold text-emerald-400 shadow-sm transition hover:bg-slate-800"
          >
            <Icon name="download" size={15} />
            Print Financial Statement PDF
          </button>
        </div>
      }
    >
      {/* Executive Financial Summary KPIs (full cards on Overview; clean compact bar on subpages) */}
      {tab === 'ledger' ? (
        <>
          <div className="mb-4">
            <DateRangeBar
              fromDate={fromDate}
              toDate={toDate}
              onChange={(f, t) => {
                setFromDate(f)
                setToDate(t)
              }}
              label="Accounting Period"
              rightSlot={
                fromDate || toDate ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                    {filteredFees.length} fees · {filteredExpenses.length} costs ·{' '}
                    {filteredOtherIncomes.length} income
                  </span>
                ) : null
              }
            />
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="dmhs-hero rounded-[24px] p-5 text-white">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                  Cash &amp; Bank Treasury
                </p>
                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-black text-emerald-300">
                  {fs.tb.isBalanced ? 'Dr = Cr ✓' : 'Check TB'}
                </span>
              </div>
              <p className="mt-2 text-3xl font-black text-emerald-400">
                ৳{fs.cashAndBankTotal.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-slate-300">
                {accountingBook.banks.length} Banks · Petty Cash ৳{pettySummary.balance.toLocaleString()}
              </p>
            </div>

            <div className="dmhs-card rounded-[24px] p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Double-Entry Net Surplus
              </p>
              <p
                className={`mt-2 text-3xl font-black ${
                  fs.netSurplus >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {fs.netSurplus >= 0 ? '+' : '-'}৳{Math.abs(fs.netSurplus).toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                Income ৳{fs.totalIncome.toLocaleString()} · Exp ৳{fs.totalExpense.toLocaleString()}
              </p>
            </div>

            <div className="dmhs-card rounded-[24px] p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Vouchers &amp; Petty Requisitions
              </p>
              <p className="mt-2 text-3xl font-black text-slate-900">
                {accountingBook.vouchers.length}{' '}
                <span className="text-sm font-bold text-slate-400">Vouchers</span>
              </p>
              <p className="mt-1 text-[11px] font-bold text-amber-700">
                {pendingReqsCount} pending petty cash req · {accountingBook.cheques.filter((c) => c.status === 'Active').length} active cheque(s)
              </p>
            </div>

            <div className="dmhs-card rounded-[24px] p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Pending Student Fee Receivables
              </p>
              <p className="mt-2 text-3xl font-black text-amber-600">
                ৳{dueFeesTotal.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                {fees.filter((f) => f.status === 'due').length} unpaid invoice(s) · Collected ৳{paidFeesTotal.toLocaleString()}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setTab('ledger')}
              className="font-bold text-slate-400 hover:text-slate-800"
            >
              Accounts &amp; Finance
            </button>
            <span className="text-slate-300">/</span>
            <span className="rounded-full bg-[#0f172a] px-3 py-1 text-[11px] font-black text-emerald-300">
              {tab === 'vouchers'
                ? 'Vouchers & Transactions'
                : tab === 'acctreports'
                  ? 'Ledger, Trial Balance & P&L'
                  : tab === 'setup'
                    ? 'Chart of Accounts, Banks, Cheques & Petty Cash'
                    : tab === 'payroll'
                      ? 'Payroll Management'
                      : tab === 'fees'
                        ? 'Student Fees Ledger'
                        : tab === 'autobill'
                          ? 'Monthly Auto-Billing & Sibling Discounts'
                          : tab === 'expenses'
                            ? 'Quick Costs'
                            : 'Other Income'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-500">
            <span>
              Treasury: <strong className="text-emerald-700">৳{fs.cashAndBankTotal.toLocaleString()}</strong>
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
              {fs.tb.isBalanced ? 'Trial Balance Dr = Cr ✓' : 'Check Trial Balance'}
            </span>
          </div>
        </div>
      )}

      {/* Fallback pill switcher ONLY if AccountsOverviewView is rendered standalone outside sidebar */}
      {!isSidebarControlled && (
        <div className="mt-6 mb-6 flex flex-wrap gap-2">
          {(
            [
              ['ledger', 'Executive Overview'],
              ['vouchers', `Vouchers & Transactions (${accountingBook.vouchers.length})`],
              ['acctreports', 'Ledger, Trial Balance & P&L'],
              ['setup', 'Chart of Accounts, Banks, Cheques & Petty Cash'],
              [
                'payroll',
                `Payroll Management${payrollSummary.pendingCount > 0 ? ` (${payrollSummary.pendingCount} pending)` : ''}`,
              ],
              ['fees', `Student Fees (${fees.length})`],
              ['autobill', 'Monthly Auto-Billing & Sibling Discounts'],
              ['expenses', `Quick Costs (${expenses.length})`],
              ['income', `Other Income (${otherIncomes.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
                tab === id
                  ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* DOUBLE-ENTRY ACCOUNTING & PAYROLL WORKSPACES */}
      {tab === 'vouchers' && <AccountingVouchersWorkspace />}
      {tab === 'acctreports' && <AccountingReportsWorkspace />}
      {tab === 'setup' && <AccountingSetupWorkspace />}
      {tab === 'payroll' && <PayrollSuiteWorkspace />}
      {tab === 'autobill' && <MonthlyBillingGeneratorPanel />}

      {/* EXECUTIVE OVERVIEW */}
      {tab === 'ledger' && (
        <div className="space-y-6">
          {/* Quick-Action Accounting & Payroll Launchpad */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                title: 'Post Voucher (Cr / Dr / Jv / Contra)',
                sub: 'Guided double-entry voucher studio with A4 slip PDF',
                cta: 'Open Vouchers →',
                onClick: () => setTab('vouchers'),
                tone: 'border-emerald-200 bg-emerald-50/50 text-emerald-900',
              },
              {
                title: 'Trial Balance & Balance Sheet',
                sub: fs.balanceSheetBalanced
                  ? `Balanced ✓ Assets ৳${fs.totalAssets.toLocaleString()}`
                  : 'Inspect live financial statements',
                cta: 'Open Reports →',
                onClick: () => setTab('acctreports'),
                tone: 'border-sky-200 bg-sky-50/50 text-sky-900',
              },
              {
                title: 'Chart of Accounts & Petty Cash',
                sub: `${accountingBook.ledgers.length} ledgers · ${accountingBook.banks.length} banks · ${pendingReqsCount} pending req`,
                cta: 'Open Setup →',
                onClick: () => setTab('setup'),
                tone: 'border-indigo-200 bg-indigo-50/50 text-indigo-900',
              },
              {
                title: 'Payroll Management',
                sub: `${payrollSummary.activeCount} employees · ${payrollSummary.pendingCount} pending · ৳${payrollSummary.totalNetPayroll.toLocaleString()}`,
                cta: 'Open Payroll →',
                onClick: () => setTab('payroll'),
                tone: 'border-violet-200 bg-violet-50/50 text-violet-900',
              },
              {
                title: 'Monthly Tuition Auto-Billing',
                sub: 'Batch-generate class invoices + automatic Sibling Discounts',
                cta: 'Open Auto-Bill →',
                onClick: () => setTab('autobill'),
                tone: 'border-amber-200 bg-amber-50/50 text-amber-900',
              },
            ].map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={card.onClick}
                className={`rounded-[22px] border p-4 text-left transition hover:shadow-md ${card.tone}`}
              >
                <p className="text-xs font-black">{card.title}</p>
                <p className="mt-1 text-[11px] font-semibold opacity-75">{card.sub}</p>
                <p className="mt-2.5 text-[11px] font-black">{card.cta}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <section className="dmhs-card rounded-[24px] p-6">
            <SectionTitle eyebrow="Revenue vs. Expense" title="DMHA Financial Health Summary" />
            <div className="space-y-4 text-xs">
              <div className="rounded-2xl bg-emerald-50/80 p-4 ring-1 ring-emerald-200/70">
                <div className="flex justify-between font-black text-emerald-900">
                  <span>Total Revenue (Inflow)</span>
                  <span>৳{totalRevenue.toLocaleString()}</span>
                </div>
                <div className="mt-2 space-y-1 text-[11px] font-semibold text-emerald-800/80">
                  <div className="flex justify-between">
                    <span>Student Fees Collected</span>
                    <span>৳{paidFeesTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Admission Forms, Store, Canteen & Other</span>
                    <span>৳{otherIncomeTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-rose-50/80 p-4 ring-1 ring-rose-200/70">
                <div className="flex justify-between font-black text-rose-900">
                  <span>Total Costs (Outflow)</span>
                  <span>৳{totalExpenses.toLocaleString()}</span>
                </div>
                <div className="mt-2 space-y-1 text-[11px] font-semibold text-rose-800/80">
                  <div className="flex justify-between">
                    <span>Paid Operational & Payroll Costs</span>
                    <span>৳{paidExpensesTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending Payables / Bills</span>
                    <span>৳{pendingExpensesTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-[#0f172a] p-4 text-white">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Net Operating Balance
                  </p>
                  <p className="text-xs font-semibold text-slate-300">
                    Projected with receivables: ৳{(netBalance + dueFeesTotal).toLocaleString()}
                  </p>
                </div>
                <p className="text-2xl font-black text-emerald-400">
                  {netBalance >= 0 ? '+' : '-'}৳{Math.abs(netBalance).toLocaleString()}
                </p>
              </div>
            </div>
          </section>

          <section className="dmhs-card rounded-[24px] p-6">
            <SectionTitle eyebrow="Cost allocation" title="Expense Breakdown by Category" />
            <div className="space-y-3.5">
              {expenseByCategory.map((row) => {
                const pct = totalExpenses > 0 ? Math.round((row.amount / totalExpenses) * 100) : 0
                return (
                  <div key={row.category}>
                    <div className="flex items-center justify-between text-xs font-extrabold">
                      <span className="text-slate-800">{row.category}</span>
                      <span className="text-slate-900">
                        ৳{row.amount.toLocaleString()}{' '}
                        <span className="text-[10px] font-bold text-slate-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#0f172a]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
        </div>
      )}

      {/* TAB 2: ADD & MANAGE ALL FEES (ADMISSION TO ANYTHING) */}
      {tab === 'fees' && (
        <div className="grid gap-6 lg:grid-cols-[370px_1fr]">
          <form onSubmit={handleAddFee} className="dmhs-card h-fit rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">+ Add Any Student Fee</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Issue Admission, Tuition, Exam, Lab, Transport, Uniform, or Custom fees for 1 student
              or all students at once.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Bill To
                <select
                  value={feeTarget}
                  onChange={(e) => setFeeTarget(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900 outline-none"
                >
                  <option value="ALL">★ All Active Students ({students.length} students)</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.className} {s.section} · Roll #{s.roll})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Fee Category
                <select
                  value={feeCategory}
                  onChange={(e) => setFeeCategory(e.target.value as FeeCategory)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900 outline-none"
                >
                  {FEE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>

              <input
                value={feeTitle}
                onChange={(e) => setFeeTitle(e.target.value)}
                placeholder="Fee description (e.g., 2026 New Admission Fee)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold outline-none"
              />

              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="number"
                  min={1}
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="Amount (৳) *"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black outline-none"
                />
                <select
                  value={feeStatus}
                  onChange={(e) => setFeeStatus(e.target.value as 'due' | 'paid')}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none"
                >
                  <option value="due">Invoice as Due</option>
                  <option value="paid">Paid (Cash / Bank)</option>
                </select>
              </div>

              <input
                value={feeDueDate}
                onChange={(e) => setFeeDueDate(e.target.value)}
                placeholder="Due date (e.g., Due 30 June 2026)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold outline-none"
              />

              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950 shadow-xs transition hover:bg-emerald-400"
              >
                Create Fee & Update Accounting
              </button>
            </div>
          </form>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black text-slate-800">Complete Fee Ledger</p>
              <div className="flex gap-1.5">
                {(['all', 'due', 'paid'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setFeeFilter(st)}
                    className={`rounded-full px-3 py-1 text-[11px] font-extrabold capitalize ${
                      feeFilter === st
                        ? 'bg-[#0f172a] text-white'
                        : 'bg-white text-slate-500 ring-1 ring-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2.5">
              {filteredFees.map((inv) => (
                <div
                  key={inv.id}
                  className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700">
                        {inv.category || 'Tuition Fee'}
                      </span>
                      <p className="text-xs font-black text-slate-900">{inv.title}</p>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      Student: <strong>{inv.studentName}</strong> ·{' '}
                      {inv.status === 'paid'
                        ? `Paid ${inv.paidAt} · Receipt ${inv.receiptNo}`
                        : inv.dueDate}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-slate-900">
                      ৳{inv.amount.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReceiptInvoice(inv)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-extrabold ring-1 ${
                        inv.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15'
                          : 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      <Icon name="print" size={11} />
                      {inv.status === 'paid' ? 'Receipt PDF' : 'Challan PDF'}
                    </button>
                    {inv.status === 'due' && (
                      <button
                        type="button"
                        onClick={() => payFeeInvoice(inv.id)}
                        className="rounded-xl bg-[#0f172a] px-3 py-1.5 text-[10px] font-extrabold text-emerald-400"
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SCHOOL COSTS & EXPENSES */}
      {tab === 'expenses' && (
        <div className="grid gap-6 lg:grid-cols-[370px_1fr]">
          <form onSubmit={handleAddExpense} className="dmhs-card h-fit rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">+ Log School Cost / Expense</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Record payroll, utilities, lab purchases, bus fuel, maintenance, or any campus cost.
            </p>
            <div className="mt-4 space-y-3">
              <input
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                placeholder="Cost description *"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold outline-none"
              />
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <input
                value={expVendor}
                onChange={(e) => setExpVendor(e.target.value)}
                placeholder="Vendor / Payee name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold outline-none"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="number"
                  min={1}
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="Amount (৳) *"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black outline-none"
                />
                <select
                  value={expStatus}
                  onChange={(e) => setExpStatus(e.target.value as 'paid' | 'pending')}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none"
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending Bill</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#0f172a] py-3 text-xs font-extrabold text-emerald-400 transition hover:bg-slate-800"
              >
                Record School Cost
              </button>
            </div>
          </form>

          <div className="space-y-2.5">
            {filteredExpenses.length === 0 ? (
              <div className="dmhs-card rounded-2xl py-8 text-center text-xs font-semibold text-slate-400">
                No school expenses found in the selected date period.
              </div>
            ) : (
              filteredExpenses.map((exp) => (
              <div
                key={exp.id}
                className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-700">
                      {exp.category}
                    </span>
                    <p className="text-xs font-black text-slate-900">{exp.title}</p>
                    {exp.voucherNo && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-700">
                        ✓ {exp.voucherNo}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    {exp.vendor} · {exp.date} · Approved by {exp.approvedBy}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-rose-600">
                    -৳{exp.amount.toLocaleString()}
                  </span>
                  <button
                    onClick={() => toggleExpenseStatus(exp.id)}
                    className={`rounded-xl px-3 py-1.5 text-[10px] font-extrabold capitalize ${
                      exp.status === 'paid'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {exp.status}
                  </button>
                  <button
                    onClick={() => deleteExpense(exp.id)}
                    className="rounded-xl bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: OTHER SCHOOL INCOME */}
      {tab === 'income' && (
        <div className="grid gap-6 lg:grid-cols-[370px_1fr]">
          <form onSubmit={handleAddIncome} className="dmhs-card h-fit rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">+ Record Other School Income</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Log admission form sales, bookstore/uniform sales, canteen revenue, or grants.
            </p>
            <div className="mt-4 space-y-3">
              <input
                value={incTitle}
                onChange={(e) => setIncTitle(e.target.value)}
                placeholder="Income title *"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold outline-none"
              />
              <select
                value={incCategory}
                onChange={(e) =>
                  setIncCategory(e.target.value as OtherIncomeRecord['category'])
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none"
              >
                {INCOME_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={incAmount}
                onChange={(e) => setIncAmount(e.target.value)}
                placeholder="Amount (৳) *"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black outline-none"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950 transition hover:bg-emerald-400"
              >
                Add to Total Revenue
              </button>
            </div>
          </form>

          <div className="space-y-2.5">
            {filteredOtherIncomes.length === 0 ? (
              <div className="dmhs-card rounded-2xl py-8 text-center text-xs font-semibold text-slate-400">
                No other income entries found in the selected date period.
              </div>
            ) : (
              filteredOtherIncomes.map((inc) => (
                <div
                  key={inc.id}
                  className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                        {inc.category}
                      </span>
                      {inc.voucherNo && (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-300">
                          ✓ Ledger {inc.voucherNo}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs font-black text-slate-900">{inc.title}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-slate-400">{inc.date}</p>
                  </div>
                  <span className="text-sm font-black text-emerald-700">
                    +৳{inc.amount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {receiptInvoice &&
        (() => {
          const invStu = students.find((s) => s.id === receiptInvoice.studentId)
          return (
            <FeeReceiptModal
              invoice={receiptInvoice}
              guardianName={invStu?.guardianName || GUARDIAN_PROFILE.name}
              studentClass={
                invStu ? `${invStu.className} · ${invStu.section} · Roll ${invStu.roll}` : undefined
              }
              onClose={() => setReceiptInvoice(null)}
            />
          )
        })()}
    </PageShell>
  )
}
