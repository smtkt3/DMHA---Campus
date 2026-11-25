'use client'

import React, { useMemo, useState } from 'react'
import { Icon } from './icons'
import { useSchool } from './store'
import type { AccountingVoucher, VoucherType } from './types'

const VOUCHER_META: Record<
  VoucherType,
  { label: string; short: string; pill: string; helper: string }
> = {
  credit: {
    label: 'Credit Voucher (Receive)',
    short: 'Credit · Receive',
    pill: 'bg-emerald-100 text-emerald-800',
    helper: 'Record tuition fees, admission fees, book fees, or other cash/bank receipts.',
  },
  debit: {
    label: 'Debit Voucher (Payment)',
    short: 'Debit · Payment',
    pill: 'bg-rose-100 text-rose-700',
    helper: 'Pay salaries, utilities, vendors, maintenance, or school operational expenses.',
  },
  journal: {
    label: 'Journal Voucher (Non-Cash)',
    short: 'Journal · Non-Cash',
    pill: 'bg-indigo-100 text-indigo-800',
    helper: 'Multi-line non-cash adjustments, receivables recognition, depreciation, or accruals.',
  },
  contra: {
    label: 'Contra Voucher (Cash Transfer)',
    short: 'Contra · Transfer',
    pill: 'bg-sky-100 text-sky-800',
    helper: 'Transfer funds between Cash in Hand, Petty Cash, and School Bank Accounts.',
  },
}

interface JournalDraftLine {
  ledgerId: string
  debit: string
  credit: string
}

export function AccountingVouchersWorkspace({
  initialVoucherType = 'credit',
}: {
  initialVoucherType?: VoucherType | 'all'
}) {
  const { accountingBook, runAccountingAction, notify } = useSchool()
  const [activeType, setActiveType] = useState<VoucherType | 'all'>(initialVoucherType)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerType, setComposerType] = useState<VoucherType>(
    initialVoucherType === 'all' ? 'credit' : initialVoucherType,
  )
  const [inspectVoucher, setInspectVoucher] = useState<AccountingVoucher | null>(null)

  // Filters
  const [filterFor, setFilterFor] = useState<'All' | AccountingVoucher['transactionFor']>('All')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [searchText, setSearchText] = useState('')

  const activeLedgers = useMemo(
    () => accountingBook.ledgers.filter((l) => l.active),
    [accountingBook.ledgers],
  )
  const cashBankLedgers = useMemo(
    () => activeLedgers.filter((l) => l.isBank || l.isCash),
    [activeLedgers],
  )
  const incomeOrAssetLedgers = useMemo(
    () => activeLedgers.filter((l) => !l.isBank && !l.isCash),
    [activeLedgers],
  )

  // Guided Form Fields (Credit / Debit / Contra)
  const [dateIso, setDateIso] = useState(new Date().toISOString().slice(0, 10))
  const [txFor, setTxFor] = useState<AccountingVoucher['transactionFor']>('Fee')
  const [partyOrReceiver, setPartyOrReceiver] = useState('')
  const [referenceNo, setReferenceNo] = useState('')
  const [narration, setNarration] = useState('')
  const [amount, setAmount] = useState('')
  const [cashBankLedgerId, setCashBankLedgerId] = useState(
    cashBankLedgers[0]?.id || 'ldg-10109',
  )
  const [counterLedgerId, setCounterLedgerId] = useState('ldg-30006')
  const [contraToLedgerId, setContraToLedgerId] = useState(
    cashBankLedgers[1]?.id || 'ldg-10107',
  )

  // Multi-Line Journal Form
  const [journalLines, setJournalLines] = useState<JournalDraftLine[]>([
    { ledgerId: 'ldg-10103', debit: '', credit: '' },
    { ledgerId: 'ldg-30006', debit: '', credit: '' },
  ])
  const [submitting, setSubmitting] = useState(false)

  const openNewComposer = (type: VoucherType) => {
    setComposerType(type)
    setComposerOpen(true)
    if (type === 'credit') {
      setTxFor('Fee')
      setCounterLedgerId(
        activeLedgers.find((l) => l.head === 'Income')?.id || incomeOrAssetLedgers[0]?.id || '',
      )
    } else if (type === 'debit') {
      setTxFor('Expense')
      setCounterLedgerId(
        activeLedgers.find((l) => l.head === 'Expense')?.id || incomeOrAssetLedgers[0]?.id || '',
      )
    } else if (type === 'contra') {
      setTxFor('Transfer')
    } else {
      setTxFor('Adjustment')
    }
  }

  const journalDebitTotal = journalLines.reduce((s, l) => s + Math.max(0, Number(l.debit || 0)), 0)
  const journalCreditTotal = journalLines.reduce(
    (s, l) => s + Math.max(0, Number(l.credit || 0)),
    0,
  )
  const journalBalanced =
    journalDebitTotal > 0 && Math.abs(journalDebitTotal - journalCreditTotal) < 0.01

  const handleSubmitVoucher = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let lines: Array<{ ledgerId: string; debit: number; credit: number }> = []
      const numAmt = Math.round(Number(amount || 0) * 100) / 100

      if (composerType === 'credit') {
        lines = [
          { ledgerId: cashBankLedgerId, debit: numAmt, credit: 0 },
          { ledgerId: counterLedgerId, debit: 0, credit: numAmt },
        ]
      } else if (composerType === 'debit') {
        lines = [
          { ledgerId: counterLedgerId, debit: numAmt, credit: 0 },
          { ledgerId: cashBankLedgerId, debit: 0, credit: numAmt },
        ]
      } else if (composerType === 'contra') {
        lines = [
          { ledgerId: contraToLedgerId, debit: numAmt, credit: 0 },
          { ledgerId: cashBankLedgerId, debit: 0, credit: numAmt },
        ]
      } else {
        lines = journalLines
          .filter((jl) => Number(jl.debit || 0) > 0 || Number(jl.credit || 0) > 0)
          .map((jl) => ({
            ledgerId: jl.ledgerId,
            debit: Math.max(0, Number(jl.debit || 0)),
            credit: Math.max(0, Number(jl.credit || 0)),
          }))
      }

      const cashObj = cashBankLedgers.find((l) => l.id === cashBankLedgerId)
      const paymentMode: AccountingVoucher['paymentMode'] =
        composerType === 'journal' ? 'Non-Cash' : cashObj?.isBank ? 'Bank' : 'Cash'

      const res = await runAccountingAction(
        {
          action: 'create_voucher',
          type: composerType,
          dateIso,
          transactionFor: txFor,
          partyOrReceiver: partyOrReceiver.trim() || 'DMHA Accounts Desk',
          paymentMode,
          referenceNo,
          narration,
          lines,
        },
        'Double-entry voucher posted to General Ledger!',
      )
      if (res.ok) {
        setAmount('')
        setPartyOrReceiver('')
        setReferenceNo('')
        setNarration('')
        setComposerOpen(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const filteredVouchers = useMemo(() => {
    return accountingBook.vouchers.filter((v) => {
      if (activeType !== 'all' && v.type !== activeType) return false
      if (filterFor !== 'All' && v.transactionFor !== filterFor) return false
      if (fromDate && v.dateIso < fromDate) return false
      if (toDate && v.dateIso > toDate) return false
      if (searchText.trim()) {
        const q = searchText.toLowerCase()
        return (
          v.voucherNo.toLowerCase().includes(q) ||
          v.accountLabel.toLowerCase().includes(q) ||
          v.partyOrReceiver.toLowerCase().includes(q) ||
          v.narration.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [accountingBook.vouchers, activeType, filterFor, fromDate, toDate, searchText])

  const filteredTotal = filteredVouchers.reduce((s, v) => s + v.totalAmount, 0)

  const exportVouchersCsv = () => {
    const rows = [
      ['Voucher No', 'Type', 'For', 'Date', 'Account', 'Receiver / Payee', 'Mode', 'Amount (BDT)', 'Narration'],
      ...filteredVouchers.map((v) => [
        v.voucherNo,
        v.type.toUpperCase(),
        v.transactionFor,
        v.dateIso,
        v.accountLabel,
        v.partyOrReceiver,
        v.paymentMode || 'Cash',
        v.totalAmount,
        v.narration,
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DMHA-Vouchers-${activeType}.csv`
    a.click()
    URL.revokeObjectURL(url)
    notify(`Exported ${filteredVouchers.length} voucher(s) to CSV!`)
  }

  return (
    <div className="space-y-5">
      {/* Top Voucher Type Selector + Quick Create CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-2xs">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveType('all')}
            className={`rounded-xl px-3.5 py-2 text-xs font-extrabold ${
              activeType === 'all'
                ? 'bg-[#0f172a] text-emerald-300'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Vouchers ({accountingBook.vouchers.length})
          </button>
          {(['credit', 'debit', 'journal', 'contra'] as const).map((vt) => {
            const count = accountingBook.vouchers.filter((v) => v.type === vt).length
            return (
              <button
                key={vt}
                type="button"
                onClick={() => {
                  setActiveType(vt)
                  setComposerType(vt)
                }}
                className={`rounded-xl px-3.5 py-2 text-xs font-extrabold ${
                  activeType === vt
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {VOUCHER_META[vt].short} ({count})
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => openNewComposer(activeType === 'all' ? 'credit' : activeType)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-700"
        >
          + New Voucher
        </button>
      </div>

      {/* Guided Double-Entry Voucher Composer */}
      {composerOpen && (
        <form onSubmit={handleSubmitVoucher} className="dmhs-card space-y-4 rounded-[26px] border-2 border-emerald-200 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className={`rounded-full px-3 py-0.5 text-[10px] font-black uppercase ${VOUCHER_META[composerType].pill}`}>
                {VOUCHER_META[composerType].label}
              </span>
              <p className="mt-1.5 text-xs font-semibold text-slate-500">
                {VOUCHER_META[composerType].helper}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['credit', 'debit', 'journal', 'contra'] as const).map((vt) => (
                <button
                  key={vt}
                  type="button"
                  onClick={() => openNewComposer(vt)}
                  className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                    composerType === vt
                      ? 'bg-[#0f172a] text-emerald-300'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {vt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Voucher Date</label>
              <input
                type="date"
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Transaction For</label>
              <select
                value={txFor}
                onChange={(e) => setTxFor(e.target.value as AccountingVoucher['transactionFor'])}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                <option value="Fee">Fee</option>
                <option value="Salary">Salary</option>
                <option value="Expense">Expense</option>
                <option value="Transfer">Transfer</option>
                <option value="Adjustment">Adjustment</option>
                <option value="Others">Others</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                {composerType === 'credit' ? 'Depositor / Receiver' : 'Payee / Party'}
              </label>
              <input
                list="voucher-parties-list"
                value={partyOrReceiver}
                onChange={(e) => setPartyOrReceiver(e.target.value)}
                placeholder="e.g., Rafiqul Islam / Vendor"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
              />
              <datalist id="voucher-parties-list">
                {accountingBook.parties.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Reference / Slip No
              </label>
              <input
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Receipt / Cheque / Bank Ref"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold"
              />
            </div>
          </div>

          {composerType !== 'journal' ? (
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
              {composerType === 'credit' && (
                <>
                  <div>
                    <label className="text-[10px] font-black uppercase text-emerald-700">
                      Debit · Deposit Into (Cash / Bank)
                    </label>
                    <select
                      value={cashBankLedgerId}
                      onChange={(e) => setCashBankLedgerId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"
                    >
                      {cashBankLedgers.map((l) => (
                        <option key={l.id} value={l.id}>
                          [{l.code}] {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-sky-700">
                      Credit · Income / Source Ledger
                    </label>
                    <select
                      value={counterLedgerId}
                      onChange={(e) => setCounterLedgerId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"
                    >
                      {incomeOrAssetLedgers.map((l) => (
                        <option key={l.id} value={l.id}>
                          [{l.code}] {l.name} ({l.head})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {composerType === 'debit' && (
                <>
                  <div>
                    <label className="text-[10px] font-black uppercase text-rose-700">
                      Debit · Expense / Asset / Liability Account
                    </label>
                    <select
                      value={counterLedgerId}
                      onChange={(e) => setCounterLedgerId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"
                    >
                      {incomeOrAssetLedgers.map((l) => (
                        <option key={l.id} value={l.id}>
                          [{l.code}] {l.name} ({l.head})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-600">
                      Credit · Paid From (Cash / Bank)
                    </label>
                    <select
                      value={cashBankLedgerId}
                      onChange={(e) => setCashBankLedgerId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"
                    >
                      {cashBankLedgers.map((l) => (
                        <option key={l.id} value={l.id}>
                          [{l.code}] {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {composerType === 'contra' && (
                <>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-600">
                      Credit · Transfer FROM (Cash / Bank)
                    </label>
                    <select
                      value={cashBankLedgerId}
                      onChange={(e) => setCashBankLedgerId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"
                    >
                      {cashBankLedgers.map((l) => (
                        <option key={l.id} value={l.id}>
                          [{l.code}] {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-sky-700">
                      Debit · Transfer TO (Cash / Bank)
                    </label>
                    <select
                      value={contraToLedgerId}
                      onChange={(e) => setContraToLedgerId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"
                    >
                      {cashBankLedgers.map((l) => (
                        <option key={l.id} value={l.id}>
                          [{l.code}] {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500">
                  Amount (৳ BDT) *
                </label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g., 25000"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-black text-slate-900"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-800">
                  Multi-Line Double-Entry Journal Lines (Debit MUST Equal Credit)
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setJournalLines((prev) => [
                      ...prev,
                      { ledgerId: activeLedgers[0]?.id || '', debit: '', credit: '' },
                    ])
                  }
                  className="rounded-lg bg-white px-3 py-1 text-[11px] font-extrabold text-indigo-700 ring-1 ring-slate-200"
                >
                  + Add Line
                </button>
              </div>
              {journalLines.map((jl, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_140px_140px_60px]">
                  <select
                    value={jl.ledgerId}
                    onChange={(e) =>
                      setJournalLines((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, ledgerId: e.target.value } : row)),
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
                  >
                    {activeLedgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        [{l.code}] {l.name} ({l.head})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={jl.debit}
                    onChange={(e) =>
                      setJournalLines((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, debit: e.target.value, credit: e.target.value ? '' : row.credit } : row,
                        ),
                      )
                    }
                    placeholder="Debit ৳"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black"
                  />
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={jl.credit}
                    onChange={(e) =>
                      setJournalLines((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, credit: e.target.value, debit: e.target.value ? '' : row.debit } : row,
                        ),
                      )
                    }
                    placeholder="Credit ৳"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black"
                  />
                  <button
                    type="button"
                    disabled={journalLines.length <= 2}
                    onClick={() => setJournalLines((prev) => prev.filter((_, i) => i !== idx))}
                    className="rounded-xl bg-rose-50 text-[10px] font-black text-rose-600 disabled:opacity-30"
                  >
                    Del
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5 text-xs">
                <span className="font-bold text-slate-600">
                  Total Dr: <strong>৳{journalDebitTotal.toLocaleString()}</strong> · Total Cr:{' '}
                  <strong>৳{journalCreditTotal.toLocaleString()}</strong>
                </span>
                <span
                  className={`rounded-full px-3 py-0.5 text-[10px] font-black ${
                    journalBalanced
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {journalBalanced
                    ? 'BALANCED (Dr = Cr) ✓'
                    : `Difference: ৳${Math.abs(journalDebitTotal - journalCreditTotal).toLocaleString()}`}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <input
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Narration / explanation for audit trail..."
              className="min-w-[260px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
            />
            <button
              type="submit"
              disabled={submitting || (composerType === 'journal' && !journalBalanced)}
              className="rounded-xl bg-[#0f172a] px-6 py-2.5 text-xs font-black text-emerald-300 hover:bg-slate-800 disabled:opacity-40"
            >
              {submitting ? 'Posting...' : 'Post Balanced Voucher'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar + Totals */}
      <div className="dmhs-card flex flex-wrap items-center justify-between gap-2.5 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterFor}
            onChange={(e) =>
              setFilterFor(e.target.value as 'All' | AccountingVoucher['transactionFor'])
            }
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
          >
            <option value="All">For: All</option>
            <option value="Fee">Fee</option>
            <option value="Salary">Salary</option>
            <option value="Expense">Expense</option>
            <option value="Transfer">Transfer</option>
            <option value="Adjustment">Adjustment</option>
            <option value="Others">Others</option>
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
          />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search voucher #, account, party..."
            className="w-52 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
          />
          {(filterFor !== 'All' || fromDate || toDate || searchText) && (
            <button
              type="button"
              onClick={() => {
                setFilterFor('All')
                setFromDate('')
                setToDate('')
                setSearchText('')
              }}
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-600"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-900 px-3.5 py-1.5 text-[11px] font-black text-emerald-300">
            {filteredVouchers.length} Vouchers · ৳{filteredTotal.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={exportVouchersCsv}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700"
          >
            <Icon name="download" size={13} />
            CSV
          </button>
        </div>
      </div>

      {/* Voucher Register List */}
      <div className="space-y-2.5">
        {filteredVouchers.map((v) => (
          <div
            key={v.id}
            className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-300">
                  {v.voucherNo}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${VOUCHER_META[v.type].pill}`}>
                  {v.type}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-600">
                  {v.transactionFor}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {v.dateIso} · {v.paymentMode || 'Cash'}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-black text-slate-900">{v.accountLabel}</p>
              <p className="text-xs text-slate-500">
                {v.partyOrReceiver} — {v.narration}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`text-base font-black ${
                  v.type === 'credit'
                    ? 'text-emerald-700'
                    : v.type === 'debit'
                      ? 'text-rose-600'
                      : 'text-slate-900'
                }`}
              >
                {v.type === 'credit' ? '+' : v.type === 'debit' ? '-' : ''}৳
                {v.totalAmount.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => setInspectVoucher(v)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-700 hover:bg-slate-200"
              >
                <Icon name="print" size={12} />
                Slip PDF
              </button>
              <button
                type="button"
                onClick={() =>
                  void runAccountingAction(
                    { action: 'delete_voucher', voucherId: v.id },
                    `Voided voucher ${v.voucherNo}`,
                  )
                }
                className="rounded-full bg-rose-50 px-2.5 py-1.5 text-[10px] font-extrabold text-rose-600 hover:bg-rose-100"
              >
                Void
              </button>
            </div>
          </div>
        ))}
        {filteredVouchers.length === 0 && (
          <div className="dmhs-card rounded-2xl p-8 text-center text-xs font-bold text-slate-400">
            No vouchers match your current filter. Click &ldquo;+ New Voucher&rdquo; to post one.
          </div>
        )}
      </div>

      {/* Official Printable Accounting Voucher Slip Modal */}
      {inspectVoucher && (
        <div
          className="dmhs-print-receipt fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setInspectVoucher(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="dmhs-print-receipt-card w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between border-b-2 border-slate-900/10 pb-4">
              <div>
                <span className={`rounded-full px-3 py-0.5 text-[10px] font-black uppercase ${VOUCHER_META[inspectVoucher.type].pill}`}>
                  Official {VOUCHER_META[inspectVoucher.type].label}
                </span>
                <h3 className="mt-1.5 text-xl font-black text-slate-950">
                  DMHA · Smart Learning App — Accounts Office
                </h3>
                <p className="text-[11px] font-semibold text-slate-500">
                  Voucher No: <strong className="font-mono text-slate-900">{inspectVoucher.voucherNo}</strong> · Date:{' '}
                  <strong>{inspectVoucher.dateIso}</strong> · Mode:{' '}
                  <strong>{inspectVoucher.paymentMode || 'Cash'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectVoucher(null)}
                className="dmhs-no-print flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-3.5 text-xs sm:grid-cols-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Party / Receiver</span>
                <p className="font-black text-slate-900">{inspectVoucher.partyOrReceiver}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Reference / Category</span>
                <p className="font-bold text-slate-800">
                  {inspectVoucher.transactionFor}
                  {inspectVoucher.referenceNo ? ` · Ref: ${inspectVoucher.referenceNo}` : ''}
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-bold uppercase text-slate-400">Narration</span>
                <p className="font-semibold text-slate-700">{inspectVoucher.narration}</p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5">Code</th>
                    <th className="px-3.5 py-2.5">Account Head / Ledger</th>
                    <th className="px-3.5 py-2.5 text-right">Debit (৳)</th>
                    <th className="px-3.5 py-2.5 text-right">Credit (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspectVoucher.lines.map((ln) => (
                    <tr key={ln.id}>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-500">
                        {ln.ledgerCode}
                      </td>
                      <td className="px-3.5 py-2.5 font-black text-slate-900">{ln.ledgerName}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-900">
                        {ln.debit > 0 ? `৳${ln.debit.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-900">
                        {ln.credit > 0 ? `৳${ln.credit.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50 font-black text-slate-950">
                  <tr>
                    <td colSpan={2} className="px-3.5 py-2.5 text-right uppercase text-[11px]">
                      Balanced Total (Dr = Cr)
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono">
                      ৳{inspectVoucher.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono">
                      ৳{inspectVoucher.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 pt-4 text-center text-[11px] font-bold text-slate-500">
              <div className="border-t border-slate-300 pt-2">
                Prepared By
                <p className="text-[10px] font-semibold text-slate-400">{inspectVoucher.createdBy}</p>
              </div>
              <div className="border-t border-slate-300 pt-2">Accounts Officer</div>
              <div className="border-t border-slate-300 pt-2">Principal / Director</div>
            </div>

            <div className="dmhs-no-print mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInspectVoucher(null)}
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
                Print / Save Voucher PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
