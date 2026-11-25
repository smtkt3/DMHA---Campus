'use client'

import React, { useMemo, useState } from 'react'
import {
  computeFinancialStatements,
  computeLedgerStatement,
  computeTrialBalance,
} from '@/lib/dmhs-accounting'
import { Icon } from './icons'
import { useSchool } from './store'

type ReportTab = 'ledger' | 'trial' | 'pnl' | 'balance'

export function AccountingReportsWorkspace() {
  const { accountingBook, notify } = useSchool()
  const [reportTab, setReportTab] = useState<ReportTab>('ledger')
  const [selectedLedgerId, setSelectedLedgerId] = useState(
    accountingBook.ledgers.find((l) => l.id === 'ldg-10107')?.id ||
      accountingBook.ledgers[0]?.id ||
      '',
  )
  const [fromDate, setFromDate] = useState('2026-11-01')
  const [toDate, setToDate] = useState('2026-12-31')

  const ledgerStatement = useMemo(
    () => computeLedgerStatement(accountingBook, selectedLedgerId, fromDate || undefined, toDate || undefined),
    [accountingBook, selectedLedgerId, fromDate, toDate],
  )

  const trialBalance = useMemo(
    () => computeTrialBalance(accountingBook, fromDate || undefined, toDate || undefined),
    [accountingBook, fromDate, toDate],
  )

  const statements = useMemo(
    () => computeFinancialStatements(accountingBook, fromDate || undefined, toDate || undefined),
    [accountingBook, fromDate, toDate],
  )

  const exportCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    notify(`Exported ${filename}!`)
  }

  return (
    <div className="space-y-5">
      {/* Report Selector + Date Range Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'ledger', label: 'General Ledger' },
              { id: 'trial', label: 'Trial Balance' },
              { id: 'pnl', label: 'Income Statement (P&L)' },
              { id: 'balance', label: 'Balance Sheet' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setReportTab(t.id)}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                reportTab === t.id
                  ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold"
          />
          <span className="text-xs font-bold text-slate-400">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold"
          />
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f172a] px-3.5 py-2 text-xs font-black text-emerald-300"
          >
            <Icon name="print" size={13} />
            Print A4
          </button>
        </div>
      </div>

      {/* ================= 1. GENERAL LEDGER STATEMENT ================= */}
      {reportTab === 'ledger' && (
        <div className="dmhs-card space-y-4 rounded-[26px] p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="min-w-[260px] flex-1">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Select Ledger Account
              </label>
              <select
                value={selectedLedgerId}
                onChange={(e) => setSelectedLedgerId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black text-slate-900"
              >
                {accountingBook.ledgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    [{l.code}] {l.name} — {l.head}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-2 text-right">
                <p className="text-[9px] font-black uppercase text-slate-400">Opening Balance</p>
                <p className="text-sm font-black text-slate-900">
                  ৳{ledgerStatement.openingBalance.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-2 text-right">
                <p className="text-[9px] font-black uppercase text-emerald-700">Closing Balance</p>
                <p className="text-sm font-black text-emerald-900">
                  ৳{ledgerStatement.closingBalance.toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  exportCsv(
                    `DMHA-Ledger-${ledgerStatement.ledger?.code || 'account'}.csv`,
                    ['Date', 'Voucher No', 'Type', 'Particular', 'Narration', 'Debit', 'Credit', 'Balance'],
                    ledgerStatement.entries.map((e) => [
                      e.dateIso,
                      e.voucherNo,
                      e.voucherType.toUpperCase(),
                      e.particular,
                      e.narration,
                      e.debit,
                      e.credit,
                      e.runningBalance,
                    ]),
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-200">
                <tr>
                  <th className="px-3.5 py-3">Date</th>
                  <th className="px-3.5 py-3">Voucher No</th>
                  <th className="px-3.5 py-3">Type</th>
                  <th className="px-3.5 py-3">Particular &amp; Narration</th>
                  <th className="px-3.5 py-3 text-right">Debit (৳)</th>
                  <th className="px-3.5 py-3 text-right">Credit (৳)</th>
                  <th className="px-3.5 py-3 text-right">Balance (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50/70 font-bold text-slate-600">
                  <td className="px-3.5 py-2.5">{fromDate || 'Opening'}</td>
                  <td className="px-3.5 py-2.5 font-mono">—</td>
                  <td className="px-3.5 py-2.5">OPEN</td>
                  <td className="px-3.5 py-2.5">Opening Balance Brought Forward</td>
                  <td className="px-3.5 py-2.5 text-right">—</td>
                  <td className="px-3.5 py-2.5 text-right">—</td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-900">
                    ৳{ledgerStatement.openingBalance.toLocaleString()}
                  </td>
                </tr>
                {ledgerStatement.entries.map((row, idx) => (
                  <tr key={`${row.voucherId}-${idx}`} className="hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-3.5 py-2.5 font-semibold text-slate-500">
                      {row.dateIso}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 font-mono font-black text-slate-900">
                      {row.voucherNo}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-700">
                        {row.voucherType}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <p className="font-black text-slate-900">{row.particular}</p>
                      <p className="text-[11px] text-slate-500">{row.narration}</p>
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-black text-emerald-700">
                      {row.debit > 0 ? `৳${row.debit.toLocaleString()}` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-black text-rose-600">
                      {row.credit > 0 ? `৳${row.credit.toLocaleString()}` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-black text-slate-950">
                      ৳{row.runningBalance.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {ledgerStatement.entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs font-bold text-slate-400">
                      No voucher postings for this account in the selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-emerald-50 font-black text-slate-950">
                <tr>
                  <td colSpan={4} className="px-3.5 py-3 text-right uppercase text-[11px]">
                    Period Totals &amp; Closing Balance
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono">
                    ৳{ledgerStatement.totalDebit.toLocaleString()}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono">
                    ৳{ledgerStatement.totalCredit.toLocaleString()}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-emerald-800">
                    ৳{ledgerStatement.closingBalance.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ================= 2. TRIAL BALANCE ================= */}
      {reportTab === 'trial' && (
        <div className="dmhs-card space-y-4 rounded-[26px] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900">
                DMHA Trial Balance ({fromDate || 'Start'} – {toDate || 'Today'})
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Real-time double-entry verification across all {trialBalance.rows.length} ledgers
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3.5 py-1.5 text-xs font-black ${
                  trialBalance.isBalanced
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {trialBalance.isBalanced ? '✓ BALANCED (Total Dr = Total Cr)' : '⚠ UNBALANCED'}
              </span>
              <button
                type="button"
                onClick={() =>
                  exportCsv(
                    'DMHA-Trial-Balance.csv',
                    ['Code', 'Ledger Name', 'Head', 'Period Debit', 'Period Credit', 'Closing Debit', 'Closing Credit'],
                    trialBalance.rows.map((r) => [
                      r.ledger.code,
                      r.ledger.name,
                      r.ledger.head,
                      r.periodDebit,
                      r.periodCredit,
                      r.closingDebit,
                      r.closingCredit,
                    ]),
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-extrabold text-slate-700"
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-200">
                <tr>
                  <th className="px-3.5 py-3">Code</th>
                  <th className="px-3.5 py-3">Account Ledger</th>
                  <th className="px-3.5 py-3">Head</th>
                  <th className="px-3.5 py-3 text-right">Period Dr (৳)</th>
                  <th className="px-3.5 py-3 text-right">Period Cr (৳)</th>
                  <th className="px-3.5 py-3 text-right">Closing Dr (৳)</th>
                  <th className="px-3.5 py-3 text-right">Closing Cr (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trialBalance.rows
                  .filter(
                    (r) =>
                      r.openingDebit > 0 ||
                      r.openingCredit > 0 ||
                      r.periodDebit > 0 ||
                      r.periodCredit > 0,
                  )
                  .map((r) => (
                    <tr key={r.ledger.id} className="hover:bg-slate-50/70">
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-500">
                        {r.ledger.code}
                      </td>
                      <td className="px-3.5 py-2.5 font-black text-slate-900">{r.ledger.name}</td>
                      <td className="px-3.5 py-2.5 text-[11px] font-bold text-slate-500">
                        {r.ledger.head}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-600">
                        {r.periodDebit > 0 ? `৳${r.periodDebit.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-600">
                        {r.periodCredit > 0 ? `৳${r.periodCredit.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-900">
                        {r.closingDebit > 0 ? `৳${r.closingDebit.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-900">
                        {r.closingCredit > 0 ? `৳${r.closingCredit.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="bg-emerald-50 font-black text-slate-950">
                <tr>
                  <td colSpan={3} className="px-3.5 py-3 text-right uppercase text-[11px]">
                    Grand Totals
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono">
                    ৳{trialBalance.totalPeriodDebit.toLocaleString()}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono">
                    ৳{trialBalance.totalPeriodCredit.toLocaleString()}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-emerald-800">
                    ৳{trialBalance.totalClosingDebit.toLocaleString()}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-emerald-800">
                    ৳{trialBalance.totalClosingCredit.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ================= 3. INCOME STATEMENT (P&L) ================= */}
      {reportTab === 'pnl' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="dmhs-card rounded-[22px] p-5">
              <p className="text-[10px] font-black uppercase tracking-wider text-sky-600">
                Total Institutional Income
              </p>
              <p className="mt-1 text-3xl font-black text-slate-900">
                ৳{statements.totalIncome.toLocaleString()}
              </p>
            </div>
            <div className="dmhs-card rounded-[22px] p-5">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                Total Institutional Expenses
              </p>
              <p className="mt-1 text-3xl font-black text-rose-600">
                ৳{statements.totalExpense.toLocaleString()}
              </p>
            </div>
            <div className="dmhs-hero rounded-[22px] p-5 text-white">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                Net Operating Surplus / (Deficit)
              </p>
              <p className="mt-1 text-3xl font-black">
                {statements.netSurplus >= 0 ? '+' : '-'}৳
                {Math.abs(statements.netSurplus).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="dmhs-card rounded-[24px] p-5">
              <h4 className="mb-3 text-xs font-black uppercase tracking-wider text-sky-700">
                Income Accounts (300)
              </h4>
              <div className="space-y-2">
                {statements.incomeRows.map((r) => (
                  <div
                    key={r.ledger.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs"
                  >
                    <span>
                      <strong className="mr-2 font-mono text-slate-400">{r.ledger.code}</strong>
                      <strong className="text-slate-900">{r.ledger.name}</strong>
                    </span>
                    <span className="font-mono font-black text-emerald-700">
                      ৳{r.netBalance.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-sm font-black text-slate-950">
                  <span>Total Income</span>
                  <span className="font-mono">৳{statements.totalIncome.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="dmhs-card rounded-[24px] p-5">
              <h4 className="mb-3 text-xs font-black uppercase tracking-wider text-amber-700">
                Expense Accounts (400)
              </h4>
              <div className="space-y-2">
                {statements.expenseRows.map((r) => (
                  <div
                    key={r.ledger.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs"
                  >
                    <span>
                      <strong className="mr-2 font-mono text-slate-400">{r.ledger.code}</strong>
                      <strong className="text-slate-900">{r.ledger.name}</strong>
                    </span>
                    <span className="font-mono font-black text-rose-600">
                      ৳{r.netBalance.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-sm font-black text-slate-950">
                  <span>Total Expense</span>
                  <span className="font-mono">৳{statements.totalExpense.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. BALANCE SHEET ================= */}
      {reportTab === 'balance' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                Statement of Financial Position (Balance Sheet)
              </p>
              <p className="text-xs font-semibold text-slate-300">
                As of {toDate || new Date().toISOString().slice(0, 10)}
              </p>
            </div>
            <span
              className={`rounded-full px-3.5 py-1 text-xs font-black ${
                statements.balanceSheetBalanced
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {statements.balanceSheetBalanced
                ? '✓ Assets = Liabilities + Equity'
                : '⚠ Check Opening Balances'}
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Assets Side */}
            <div className="dmhs-card space-y-4 rounded-[24px] p-5">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700">
                Assets (Fixed &amp; Current)
              </h4>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase text-slate-400">Fixed Assets</p>
                {statements.fixedAssets.map((r) => (
                  <div key={r.ledger.id} className="flex justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs">
                    <span className="font-bold text-slate-800">{r.ledger.name}</span>
                    <span className="font-mono font-black">৳{r.netBalance.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase text-slate-400">Current Assets (Cash, Banks &amp; Receivables)</p>
                {statements.currentAssets.map((r) => (
                  <div key={r.ledger.id} className="flex justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs">
                    <span className="font-bold text-slate-800">{r.ledger.name}</span>
                    <span className="font-mono font-black">৳{r.netBalance.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t-2 border-slate-900/10 pt-3 text-sm font-black text-slate-950">
                <span>Total Assets</span>
                <span className="font-mono text-emerald-700">
                  ৳{statements.totalAssets.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Liabilities & Equity Side */}
            <div className="dmhs-card space-y-4 rounded-[24px] p-5">
              <h4 className="text-xs font-black uppercase tracking-wider text-violet-700">
                Liabilities &amp; Institutional Equity (Funds)
              </h4>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase text-slate-400">Liabilities</p>
                {[...statements.currentLiabilities, ...statements.longTermLiabilities].map((r) => (
                  <div key={r.ledger.id} className="flex justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs">
                    <span className="font-bold text-slate-800">{r.ledger.name}</span>
                    <span className="font-mono font-black">৳{r.netBalance.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase text-slate-400">Institutional Equity &amp; Surplus</p>
                {statements.equityRows.map((r) => (
                  <div key={r.ledger.id} className="flex justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs">
                    <span className="font-bold text-slate-800">{r.ledger.name}</span>
                    <span className="font-mono font-black">৳{r.netBalance.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between rounded-xl bg-emerald-50 px-3.5 py-2 text-xs">
                  <span className="font-black text-emerald-900">Current Period Net Surplus</span>
                  <span className="font-mono font-black text-emerald-800">
                    ৳{statements.netSurplus.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex justify-between border-t-2 border-slate-900/10 pt-3 text-sm font-black text-slate-950">
                <span>Total Liabilities + Equity</span>
                <span className="font-mono text-violet-800">
                  ৳{(statements.totalLiabilities + statements.totalEquity).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
