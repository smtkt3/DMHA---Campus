'use client'

import React, { useMemo, useState } from 'react'
import {
  ACCOUNTING_HEADS,
  computePettyCashSummary,
  computeTrialBalance,
  getLedgerPath,
} from '@/lib/dmhs-accounting'
import { Icon } from './icons'
import { useSchool } from './store'
import type {
  AccountLedgerItem,
  AccountingHead,
  AccountingPartyRecord,
  ChequeRegisterItem,
  PettyCashRequisition,
  SchoolBankRecord,
} from './types'

type SetupTab = 'coa' | 'banks' | 'parties' | 'cheques' | 'petty'

const HEAD_BADGE: Record<AccountingHead, string> = {
  'Fixed Asset': 'bg-teal-50 text-teal-800 ring-teal-600/15',
  'Current Asset': 'bg-emerald-50 text-emerald-800 ring-emerald-600/15',
  'Current Liability': 'bg-rose-50 text-rose-700 ring-rose-600/15',
  'Long Term Liability': 'bg-pink-50 text-pink-700 ring-pink-600/15',
  Income: 'bg-sky-50 text-sky-800 ring-sky-600/15',
  Expense: 'bg-amber-50 text-amber-800 ring-amber-600/15',
  'Equity (Funds)': 'bg-violet-50 text-violet-800 ring-violet-600/15',
}

export function AccountingSetupWorkspace() {
  const { accountingBook, runAccountingAction, notify } = useSchool()
  const [subTab, setSubTab] = useState<SetupTab>('coa')
  const [coaMode, setCoaMode] = useState<'ledgers' | 'groups'>('ledgers')

  // Live balances computed from all vouchers
  const tb = useMemo(() => computeTrialBalance(accountingBook), [accountingBook])
  const balanceMap = useMemo(() => {
    const map = new Map<string, number>()
    tb.rows.forEach((r) => map.set(r.ledger.id, r.netBalance))
    return map
  }, [tb])
  const pettySummary = useMemo(() => computePettyCashSummary(accountingBook), [accountingBook])

  // --- COA Ledger Form ---
  const [headFilter, setHeadFilter] = useState<'All' | AccountingHead>('All')
  const [coaSearch, setCoaSearch] = useState('')
  const [editLedgerId, setEditLedgerId] = useState('')
  const [ledgerSubGroupId, setLedgerSubGroupId] = useState(
    accountingBook.subGroups[0]?.id || 'sub-cash',
  )
  const [ledgerName, setLedgerName] = useState('')
  const [ledgerOpening, setLedgerOpening] = useState('0')
  const [ledgerIsBank, setLedgerIsBank] = useState(false)
  const [ledgerIsParty, setLedgerIsParty] = useState(false)
  const [ledgerIsCash, setLedgerIsCash] = useState(false)
  const [ledgerActive, setLedgerActive] = useState(true)

  // --- Group & Sub-Group Forms ---
  const [grpHead, setGrpHead] = useState<AccountingHead>('Current Asset')
  const [grpName, setGrpName] = useState('')
  const [subHead, setSubHead] = useState<AccountingHead>('Current Asset')
  const [subGroupId, setSubGroupId] = useState(accountingBook.groups[0]?.id || '')
  const [subName, setSubName] = useState('')

  // --- Bank Form ---
  const [editBankId, setEditBankId] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankBranch, setBankBranch] = useState('')
  const [bankAccNo, setBankAccNo] = useState('')
  const [bankContact, setBankContact] = useState('')
  const [bankEmail, setBankEmail] = useState('')
  const [bankAddress, setBankAddress] = useState('')
  const [bankOpening, setBankOpening] = useState('0')

  // --- Party Form ---
  const [editPartyId, setEditPartyId] = useState('')
  const [partyName, setPartyName] = useState('')
  const [partyType, setPartyType] = useState<AccountingPartyRecord['partyType']>('Vendor / Supplier')
  const [partyContact, setPartyContact] = useState('')
  const [partyEmail, setPartyEmail] = useState('')
  const [partyAddress, setPartyAddress] = useState('')
  const [partyOpening, setPartyOpening] = useState('0')

  // --- Cheque Register Form ---
  const [chqBankId, setChqBankId] = useState(accountingBook.banks[0]?.id || '')
  const [chqNumber, setChqNumber] = useState('')
  const [chqDate, setChqDate] = useState(new Date().toISOString().slice(0, 10))
  const [chqPayee, setChqPayee] = useState('')
  const [chqAmount, setChqAmount] = useState('')
  const [chqNotes, setChqNotes] = useState('')
  const [chqFilterStatus, setChqFilterStatus] = useState<'All' | ChequeRegisterItem['status']>('All')
  const [chqSearch, setChqSearch] = useState('')
  const [chqClearExpenseLedger, setChqClearExpenseLedger] = useState('ldg-40001')

  // --- Petty Cash & Requisition ---
  const [pettyMode, setPettyMode] = useState<'requisitions' | 'fund'>('requisitions')
  const [reqApplicant, setReqApplicant] = useState('')
  const [reqDept, setReqDept] = useState('Administration')
  const [reqPurpose, setReqPurpose] = useState('')
  const [reqAmount, setReqAmount] = useState('')
  const [reqDate, setReqDate] = useState(new Date().toISOString().slice(0, 10))
  const [reqPriority, setReqPriority] = useState<PettyCashRequisition['priority']>('Normal')
  const [reqRemarks, setReqRemarks] = useState('')
  const [reqStatusFilter, setReqStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [reqApproveLedger, setReqApproveLedger] = useState('ldg-40002')
  const [fundAmount, setFundAmount] = useState('10000')
  const [fundSourceId, setFundSourceId] = useState('ldg-10109')
  const [fundRef, setFundRef] = useState('')

  const selectedChqBank = accountingBook.banks.find((b) => b.id === chqBankId) || accountingBook.banks[0]
  const selectedChqBankBalance = selectedChqBank ? balanceMap.get(selectedChqBank.ledgerId) ?? 0 : 0

  const filteredLedgers = accountingBook.ledgers.filter((l) => {
    if (headFilter !== 'All' && l.head !== headFilter) return false
    if (coaSearch.trim()) {
      const q = coaSearch.toLowerCase()
      return (
        l.name.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        getLedgerPath(accountingBook, l).toLowerCase().includes(q)
      )
    }
    return true
  })

  const expenseLedgers = accountingBook.ledgers.filter((l) => l.head === 'Expense' && l.active)
  const cashBankLedgers = accountingBook.ledgers.filter(
    (l) => (l.isBank || l.isCash) && l.id !== 'ldg-10110' && l.active,
  )

  const handleSaveLedger = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ledgerName.trim()) return
    const res = await runAccountingAction(
      {
        action: 'save_ledger',
        id: editLedgerId || undefined,
        subGroupId: ledgerSubGroupId,
        name: ledgerName,
        openingBalance: Number(ledgerOpening || 0),
        isBank: ledgerIsBank,
        isParty: ledgerIsParty,
        isCash: ledgerIsCash,
        active: ledgerActive,
      },
      editLedgerId ? 'Account ledger updated!' : 'New ledger added to Chart of Accounts!',
    )
    if (res.ok) {
      setEditLedgerId('')
      setLedgerName('')
      setLedgerOpening('0')
      setLedgerIsBank(false)
      setLedgerIsParty(false)
      setLedgerIsCash(false)
      setLedgerActive(true)
    }
  }

  const startEditLedger = (l: AccountLedgerItem) => {
    setEditLedgerId(l.id)
    setLedgerSubGroupId(l.subGroupId)
    setLedgerName(l.name)
    setLedgerOpening(String(l.openingBalance))
    setLedgerIsBank(Boolean(l.isBank))
    setLedgerIsParty(Boolean(l.isParty))
    setLedgerIsCash(Boolean(l.isCash))
    setLedgerActive(l.active)
  }

  const exportChartOfAccountsCsv = () => {
    const rows = [
      ['Code', 'Head', 'Hierarchy', 'Ledger Name', 'Tags', 'Opening Balance (BDT)', 'Live Balance (BDT)', 'Status'],
      ...accountingBook.ledgers.map((l) => [
        l.code,
        l.head,
        getLedgerPath(accountingBook, l),
        l.name,
        [l.isBank ? 'Bank' : '', l.isCash ? 'Cash' : '', l.isParty ? 'Party' : ''].filter(Boolean).join('/'),
        l.openingBalance,
        balanceMap.get(l.id) ?? 0,
        l.active ? 'Active' : 'Inactive',
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'DMHA-Chart-of-Accounts.csv'
    a.click()
    URL.revokeObjectURL(url)
    notify('Exported DMHA-Chart-of-Accounts.csv!')
  }

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankName.trim() || !bankAccNo.trim() || !bankContact.trim()) return
    const res = await runAccountingAction(
      {
        action: 'save_bank',
        id: editBankId || undefined,
        name: bankName,
        branch: bankBranch,
        accountNumber: bankAccNo,
        contactNo: bankContact,
        email: bankEmail,
        address: bankAddress,
        openingBalance: Number(bankOpening || 0),
        active: true,
      },
      editBankId ? 'Bank account updated!' : 'Bank account added & linked to Chart of Accounts!',
    )
    if (res.ok) {
      setEditBankId('')
      setBankName('')
      setBankBranch('')
      setBankAccNo('')
      setBankContact('')
      setBankEmail('')
      setBankAddress('')
      setBankOpening('0')
    }
  }

  const startEditBank = (b: SchoolBankRecord) => {
    setEditBankId(b.id)
    setBankName(b.name)
    setBankBranch(b.branch)
    setBankAccNo(b.accountNumber)
    setBankContact(b.contactNo)
    setBankEmail(b.email || '')
    setBankAddress(b.address || '')
    setBankOpening(String(b.openingBalance))
  }

  const handleSaveParty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partyName.trim() || !partyContact.trim()) return
    const res = await runAccountingAction(
      {
        action: 'save_party',
        id: editPartyId || undefined,
        name: partyName,
        partyType,
        contactNo: partyContact,
        email: partyEmail,
        address: partyAddress,
        openingBalance: Number(partyOpening || 0),
        active: true,
      },
      editPartyId ? 'Party updated!' : 'Vendor / Party added!',
    )
    if (res.ok) {
      setEditPartyId('')
      setPartyName('')
      setPartyContact('')
      setPartyEmail('')
      setPartyAddress('')
      setPartyOpening('0')
    }
  }

  const handleSaveCheque = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChqBank || !chqNumber.trim() || !chqPayee.trim() || !chqAmount) return
    const res = await runAccountingAction(
      {
        action: 'save_cheque',
        bankId: selectedChqBank.id,
        chequeNumber: chqNumber,
        issueDate: chqDate,
        payeeName: chqPayee,
        amount: Number(chqAmount),
        status: 'Active',
        notes: chqNotes,
      },
      `Cheque #${chqNumber} registered!`,
    )
    if (res.ok) {
      setChqNumber('')
      setChqPayee('')
      setChqAmount('')
      setChqNotes('')
    }
  }

  const handleCreateReq = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqApplicant.trim() || !reqPurpose.trim() || !reqAmount) return
    const res = await runAccountingAction(
      {
        action: 'create_requisition',
        applicantName: reqApplicant,
        department: reqDept,
        purpose: reqPurpose,
        amount: Number(reqAmount),
        dateIso: reqDate,
        priority: reqPriority,
        remarks: reqRemarks,
      },
      'Petty Cash requisition submitted!',
    )
    if (res.ok) {
      setReqApplicant('')
      setReqPurpose('')
      setReqAmount('')
      setReqRemarks('')
    }
  }

  const handleAddPettyFund = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await runAccountingAction(
      {
        action: 'add_petty_fund',
        amount: Number(fundAmount),
        sourceLedgerId: fundSourceId,
        reference: fundRef || undefined,
      },
      'Petty Cash replenished & Contra Voucher posted!',
    )
    if (res.ok) setFundRef('')
  }

  const pendingReqCount = accountingBook.pettyCashRequisitions.filter(
    (r) => r.status === 'pending',
  ).length

  return (
    <div className="space-y-6">
      {/* Clean Modern Sub-Navigation Pills */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-2xs">
        {(
          [
            { id: 'coa', label: 'Chart of Accounts', badge: accountingBook.ledgers.length },
            { id: 'banks', label: 'Bank Accounts', badge: accountingBook.banks.length },
            { id: 'parties', label: 'Parties & Vendors', badge: accountingBook.parties.length },
            { id: 'cheques', label: 'Cheque Register', badge: accountingBook.cheques.length },
            { id: 'petty', label: 'Petty Cash & Requisition', badge: pendingReqCount || undefined },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSubTab(item.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              subTab === item.id
                ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
            {item.badge !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  subTab === item.id
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : item.id === 'petty'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ================= 1. CHART OF ACCOUNTS (LEDGERS + GROUPS + SUB-GROUPS) ================= */}
      {subTab === 'coa' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCoaMode('ledgers')}
                className={`rounded-full px-4 py-1.5 text-xs font-extrabold ${
                  coaMode === 'ledgers'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                Ledgers ({accountingBook.ledgers.length})
              </button>
              <button
                type="button"
                onClick={() => setCoaMode('groups')}
                className={`rounded-full px-4 py-1.5 text-xs font-extrabold ${
                  coaMode === 'groups'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                Account Groups &amp; Sub-Groups ({accountingBook.groups.length} /{' '}
                {accountingBook.subGroups.length})
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportChartOfAccountsCsv}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
              >
                <Icon name="download" size={13} />
                Export Chart of Accounts
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-3.5 py-1.5 text-xs font-extrabold text-emerald-300"
              >
                <Icon name="print" size={13} />
                Print COA
              </button>
            </div>
          </div>

          {coaMode === 'ledgers' ? (
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <form onSubmit={handleSaveLedger} className="dmhs-card h-fit space-y-3.5 rounded-[24px] p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900">
                    {editLedgerId ? 'Edit Account Ledger' : 'Create Account Ledger'}
                  </h3>
                  {editLedgerId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditLedgerId('')
                        setLedgerName('')
                        setLedgerOpening('0')
                      }}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-700"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Parent Category (Head › Group › Sub-Group)
                  </label>
                  <select
                    value={ledgerSubGroupId}
                    onChange={(e) => setLedgerSubGroupId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold"
                  >
                    {accountingBook.subGroups.map((sg) => {
                      const grp = accountingBook.groups.find((g) => g.id === sg.groupId)
                      return (
                        <option key={sg.id} value={sg.id}>
                          {sg.head} › {grp?.name || 'General'} › {sg.name}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Ledger Name *
                  </label>
                  <input
                    value={ledgerName}
                    onChange={(e) => setLedgerName(e.target.value)}
                    placeholder="e.g., Sports & Lab Fee Income"
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Opening Balance (৳ BDT)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={ledgerOpening}
                    onChange={(e) => setLedgerOpening(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black"
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-1 text-xs font-bold text-slate-700">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={ledgerIsBank}
                      onChange={(e) => setLedgerIsBank(e.target.checked)}
                      className="size-4 accent-emerald-600"
                    />
                    Bank
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={ledgerIsCash}
                      onChange={(e) => setLedgerIsCash(e.target.checked)}
                      className="size-4 accent-emerald-600"
                    />
                    Cash In Hand
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={ledgerIsParty}
                      onChange={(e) => setLedgerIsParty(e.target.checked)}
                      className="size-4 accent-emerald-600"
                    />
                    Party
                  </label>
                  <label className="ml-auto flex items-center gap-1.5 text-emerald-700">
                    <input
                      type="checkbox"
                      checked={ledgerActive}
                      onChange={(e) => setLedgerActive(e.target.checked)}
                      className="size-4 accent-emerald-600"
                    />
                    Active
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300 hover:bg-slate-800"
                >
                  {editLedgerId ? 'Update Account Ledger' : '+ Save Account Ledger'}
                </button>
              </form>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={coaSearch}
                    onChange={(e) => setCoaSearch(e.target.value)}
                    placeholder="Search ledger name, code (e.g. 10107), or group..."
                    className="min-w-[220px] flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                  <select
                    value={headFilter}
                    onChange={(e) => setHeadFilter(e.target.value as 'All' | AccountingHead)}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700"
                  >
                    <option value="All">All 7 Heads</option>
                    {ACCOUNTING_HEADS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  {filteredLedgers.map((l) => {
                    const liveBal = balanceMap.get(l.id) ?? 0
                    return (
                      <div
                        key={l.id}
                        className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-300">
                              {l.code}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ring-1 ${HEAD_BADGE[l.head]}`}
                            >
                              {l.head}
                            </span>
                            {l.isBank && (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-black uppercase text-sky-800">
                                BANK
                              </span>
                            )}
                            {l.isCash && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                                CASH
                              </span>
                            )}
                            {l.isParty && (
                              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-black uppercase text-violet-800">
                                PARTY
                              </span>
                            )}
                            {!l.active && (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-black text-slate-600">
                                INACTIVE
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs font-black text-slate-900">{l.name}</p>
                          <p className="text-[11px] font-medium text-slate-400">
                            {getLedgerPath(accountingBook, l)}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase text-slate-400">Live Balance</p>
                            <p className="text-sm font-black text-slate-900">
                              ৳{liveBal.toLocaleString()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => startEditLedger(l)}
                            className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-extrabold text-slate-700 hover:bg-slate-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void runAccountingAction(
                                { action: 'delete_ledger', id: l.id },
                                `Deleted ledger ${l.name}`,
                              )
                            }
                            className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[10px] font-extrabold text-rose-600 hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Groups Panel */}
              <div className="dmhs-card space-y-4 rounded-[24px] p-5">
                <h3 className="text-sm font-black text-slate-900">Accounts Groups</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!grpName.trim()) return
                    const res = await runAccountingAction(
                      { action: 'save_group', head: grpHead, name: grpName, active: true },
                      'Accounts Group saved!',
                    )
                    if (res.ok) setGrpName('')
                  }}
                  className="flex flex-wrap gap-2"
                >
                  <select
                    value={grpHead}
                    onChange={(e) => setGrpHead(e.target.value as AccountingHead)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                  >
                    {ACCOUNTING_HEADS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <input
                    value={grpName}
                    onChange={(e) => setGrpName(e.target.value)}
                    placeholder="New group name..."
                    required
                    className="min-w-[160px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-black text-emerald-300"
                  >
                    + Add Group
                  </button>
                </form>

                <div className="space-y-2">
                  {accountingBook.groups.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs"
                    >
                      <div>
                        <span
                          className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1 ${HEAD_BADGE[g.head]}`}
                        >
                          {g.head}
                        </span>
                        <strong className="text-slate-900">{g.name}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void runAccountingAction({ action: 'delete_group', id: g.id }, 'Group deleted')
                        }
                        className="text-[10px] font-bold text-rose-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-Groups Panel */}
              <div className="dmhs-card space-y-4 rounded-[24px] p-5">
                <h3 className="text-sm font-black text-slate-900">Accounts Sub-Groups</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!subName.trim()) return
                    const matchedGrp =
                      accountingBook.groups.find((g) => g.id === subGroupId) ||
                      accountingBook.groups[0]
                    const res = await runAccountingAction(
                      {
                        action: 'save_subgroup',
                        head: matchedGrp?.head || subHead,
                        groupId: matchedGrp?.id || subGroupId,
                        name: subName,
                        active: true,
                      },
                      'Accounts Sub-Group saved!',
                    )
                    if (res.ok) setSubName('')
                  }}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  <select
                    value={subGroupId}
                    onChange={(e) => {
                      setSubGroupId(e.target.value)
                      const g = accountingBook.groups.find((x) => x.id === e.target.value)
                      if (g) setSubHead(g.head)
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold sm:col-span-2"
                  >
                    {accountingBook.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.head} › {g.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="New sub-group name..."
                    required
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-black text-emerald-300"
                  >
                    + Add Sub-Group
                  </button>
                </form>

                <div className="space-y-2">
                  {accountingBook.subGroups.map((sg) => {
                    const grp = accountingBook.groups.find((g) => g.id === sg.groupId)
                    return (
                      <div
                        key={sg.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs"
                      >
                        <div>
                          <span className="text-[10px] font-bold text-slate-400">
                            {sg.head} › {grp?.name} ›{' '}
                          </span>
                          <strong className="text-slate-900">{sg.name}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void runAccountingAction(
                              { action: 'delete_subgroup', id: sg.id },
                              'Sub-Group deleted',
                            )
                          }
                          className="text-[10px] font-bold text-rose-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 2. BANK ACCOUNTS ================= */}
      {subTab === 'banks' && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form onSubmit={handleSaveBank} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">
              {editBankId ? 'Edit School Bank Account' : 'Add School Bank Account'}
            </h3>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Bank Name (e.g., Dutch-Bangla Bank PLC) *"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                placeholder="Branch Name"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
              />
              <input
                value={bankAccNo}
                onChange={(e) => setBankAccNo(e.target.value)}
                placeholder="Account Number *"
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={bankContact}
                onChange={(e) => setBankContact(e.target.value)}
                placeholder="Contact No *"
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
              />
              <input
                type="number"
                min={0}
                value={bankOpening}
                onChange={(e) => setBankOpening(e.target.value)}
                placeholder="Opening Balance ৳"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black"
              />
            </div>
            <input
              value={bankEmail}
              onChange={(e) => setBankEmail(e.target.value)}
              placeholder="Branch Email (optional)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <input
              value={bankAddress}
              onChange={(e) => setBankAddress(e.target.value)}
              placeholder="Branch Address"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300"
            >
              {editBankId ? 'Update Bank Account' : '+ Save & Link Bank Ledger'}
            </button>
          </form>

          <div className="grid gap-4 sm:grid-cols-2">
            {accountingBook.banks.map((b) => {
              const liveBal = balanceMap.get(b.ledgerId) ?? b.openingBalance
              return (
                <div key={b.id} className="dmhs-card flex flex-col justify-between rounded-[24px] p-5">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-black text-sky-700">
                          LIVE TREASURY BANK
                        </span>
                        <h4 className="mt-2 text-base font-black text-slate-900">{b.name}</h4>
                        <p className="text-xs font-semibold text-slate-500">{b.branch}</p>
                      </div>
                      <p className="text-lg font-black text-emerald-700">
                        ৳{liveBal.toLocaleString()}
                      </p>
                    </div>
                    <dl className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 p-3 text-[11px]">
                      <div className="flex justify-between">
                        <dt className="font-bold text-slate-400">Account No</dt>
                        <dd className="font-mono font-black text-slate-800">{b.accountNumber}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="font-bold text-slate-400">Contact</dt>
                        <dd className="font-bold text-slate-700">{b.contactNo}</dd>
                      </div>
                      {b.address && (
                        <div className="flex justify-between">
                          <dt className="font-bold text-slate-400">Address</dt>
                          <dd className="font-semibold text-slate-600">{b.address}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEditBank(b)}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void runAccountingAction({ action: 'delete_bank', id: b.id }, 'Bank deleted')
                      }
                      className="rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] font-extrabold text-rose-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ================= 3. PARTIES & VENDORS ================= */}
      {subTab === 'parties' && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form onSubmit={handleSaveParty} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">
              {editPartyId ? 'Edit Party / Vendor' : 'Add Party / Vendor'}
            </h3>
            <input
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="Vendor / Supplier / Payee Name *"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
            />
            <select
              value={partyType}
              onChange={(e) => setPartyType(e.target.value as AccountingPartyRecord['partyType'])}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              <option>Vendor / Supplier</option>
              <option>Publisher / Books</option>
              <option>Contractor</option>
              <option>Landlord / Utility</option>
              <option>Donor / Sponsor</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={partyContact}
                onChange={(e) => setPartyContact(e.target.value)}
                placeholder="Phone *"
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
              />
              <input
                type="number"
                min={0}
                value={partyOpening}
                onChange={(e) => setPartyOpening(e.target.value)}
                placeholder="Opening Due ৳"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black"
              />
            </div>
            <input
              value={partyEmail}
              onChange={(e) => setPartyEmail(e.target.value)}
              placeholder="Email (optional)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <input
              value={partyAddress}
              onChange={(e) => setPartyAddress(e.target.value)}
              placeholder="Address"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300"
            >
              {editPartyId ? 'Update Party' : '+ Save Party'}
            </button>
          </form>

          <div className="space-y-2.5">
            {accountingBook.parties.map((p) => (
              <div
                key={p.id}
                className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
              >
                <div>
                  <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-black text-violet-700">
                    {p.partyType}
                  </span>
                  <h4 className="mt-1 text-sm font-black text-slate-900">{p.name}</h4>
                  <p className="text-xs font-semibold text-slate-500">
                    {p.contactNo} {p.email ? `· ${p.email}` : ''} {p.address ? `· ${p.address}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700">
                    Opening ৳{p.openingBalance.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditPartyId(p.id)
                      setPartyName(p.name)
                      setPartyType(p.partyType)
                      setPartyContact(p.contactNo)
                      setPartyEmail(p.email || '')
                      setPartyAddress(p.address || '')
                      setPartyOpening(String(p.openingBalance))
                    }}
                    className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void runAccountingAction({ action: 'delete_party', id: p.id }, 'Party deleted')
                    }
                    className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-extrabold text-rose-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= 4. CHEQUE REGISTER ================= */}
      {subTab === 'cheques' && (
        <div className="grid gap-6 lg:grid-cols-[370px_1fr]">
          <form onSubmit={handleSaveCheque} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">Issue &amp; Register Bank Cheque</h3>
            <select
              value={chqBankId}
              onChange={(e) => setChqBankId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold"
            >
              {accountingBook.banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.accountNumber}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2 text-xs">
              <span className="font-bold text-emerald-800">Live Bank Balance</span>
              <span className="font-black text-emerald-900">
                ৳{selectedChqBankBalance.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                value={chqNumber}
                onChange={(e) => setChqNumber(e.target.value.replace(/\./g, ''))}
                placeholder="Cheque No (no dots) *"
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold"
              />
              <input
                type="date"
                value={chqDate}
                onChange={(e) => setChqDate(e.target.value)}
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              />
            </div>

            <input
              list="dmhs-parties-list"
              value={chqPayee}
              onChange={(e) => setChqPayee(e.target.value)}
              placeholder="Payee / Party Name *"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
            />
            <datalist id="dmhs-parties-list">
              {accountingBook.parties.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>

            <input
              type="number"
              min={1}
              value={chqAmount}
              onChange={(e) => setChqAmount(e.target.value)}
              placeholder="Cheque Amount (৳ BDT) *"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black"
            />
            <input
              value={chqNotes}
              onChange={(e) => setChqNotes(e.target.value)}
              placeholder="Memo / purpose (optional)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300"
            >
              + Register Cheque
            </button>
          </form>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={chqSearch}
                onChange={(e) => setChqSearch(e.target.value)}
                placeholder="Search cheque #, bank, or payee..."
                className="min-w-[200px] flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold"
              />
              <select
                value={chqFilterStatus}
                onChange={(e) =>
                  setChqFilterStatus(e.target.value as 'All' | ChequeRegisterItem['status'])
                }
                className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Cleared">Cleared</option>
                <option value="Bounced">Bounced</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <select
                value={chqClearExpenseLedger}
                onChange={(e) => setChqClearExpenseLedger(e.target.value)}
                title="Debit ledger used when marking a cheque Cleared"
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600"
              >
                {expenseLedgers.map((el) => (
                  <option key={el.id} value={el.id}>
                    Clear → {el.name}
                  </option>
                ))}
              </select>
            </div>

            {accountingBook.cheques
              .filter((c) => {
                if (chqFilterStatus !== 'All' && c.status !== chqFilterStatus) return false
                if (chqSearch.trim()) {
                  const q = chqSearch.toLowerCase()
                  return (
                    c.chequeNumber.toLowerCase().includes(q) ||
                    c.payeeName.toLowerCase().includes(q) ||
                    c.bankName.toLowerCase().includes(q)
                  )
                }
                return true
              })
              .map((c) => (
                <div
                  key={c.id}
                  className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-black text-slate-400">
                        {c.chequeSerial}
                      </span>
                      <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-black text-sky-800">
                        {c.bankName} · #{c.chequeNumber}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">{c.issueDate}</span>
                    </div>
                    <p className="mt-1 text-sm font-black text-slate-900">{c.payeeName}</p>
                    {c.notes && <p className="text-xs text-slate-500">{c.notes}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-slate-900">
                      ৳{c.amount.toLocaleString()}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                        c.status === 'Cleared'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'Active'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {c.status}
                    </span>
                    {c.status === 'Active' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void runAccountingAction(
                              {
                                action: 'update_cheque_status',
                                chequeId: c.id,
                                status: 'Cleared',
                                postDebitLedgerId: chqClearExpenseLedger,
                              },
                              `Cheque #${c.chequeNumber} cleared & Debit Voucher posted!`,
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white"
                        >
                          Clear &amp; Post
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runAccountingAction(
                              { action: 'update_cheque_status', chequeId: c.id, status: 'Bounced' },
                              `Cheque #${c.chequeNumber} marked Bounced`,
                            )
                          }
                          className="rounded-lg bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-600"
                        >
                          Bounce
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ================= 5. PETTY CASH & REQUISITION ================= */}
      {subTab === 'petty' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="dmhs-hero rounded-[22px] p-5 text-white">
              <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-300">
                Total Petty Fund
              </p>
              <p className="mt-1 text-2xl font-black">৳{pettySummary.totalFund.toLocaleString()}</p>
            </div>
            <div className="dmhs-card rounded-[22px] p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-600">
                Approved &amp; Disbursed
              </p>
              <p className="mt-1 text-2xl font-black text-emerald-700">
                ৳{pettySummary.approved.toLocaleString()}
              </p>
            </div>
            <div className="dmhs-card rounded-[22px] p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-amber-600">
                Pending Approval
              </p>
              <p className="mt-1 text-2xl font-black text-amber-600">
                ৳{pettySummary.pending.toLocaleString()}
              </p>
            </div>
            <div className="dmhs-card rounded-[22px] p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-sky-600">
                Available Balance
              </p>
              <p className="mt-1 text-2xl font-black text-sky-700">
                ৳{pettySummary.balance.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPettyMode('requisitions')}
                className={`rounded-full px-4 py-1.5 text-xs font-extrabold ${
                  pettyMode === 'requisitions'
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                Requisitions ({accountingBook.pettyCashRequisitions.length})
              </button>
              <button
                type="button"
                onClick={() => setPettyMode('fund')}
                className={`rounded-full px-4 py-1.5 text-xs font-extrabold ${
                  pettyMode === 'fund'
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                Fund Replenishment ({accountingBook.pettyCashFunds.length})
              </button>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-extrabold text-slate-700"
            >
              <Icon name="print" size={13} />
              Print Petty Cash Report
            </button>
          </div>

          {pettyMode === 'requisitions' ? (
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <form onSubmit={handleCreateReq} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
                <h3 className="text-sm font-black text-slate-900">New Petty Cash Requisition</h3>
                <input
                  value={reqApplicant}
                  onChange={(e) => setReqApplicant(e.target.value)}
                  placeholder="Applicant Name *"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
                />
                <select
                  value={reqDept}
                  onChange={(e) => setReqDept(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                >
                  <option>Administration</option>
                  <option>Science &amp; Physics Lab</option>
                  <option>Campus Security &amp; Gate</option>
                  <option>Academics &amp; Library</option>
                  <option>Maintenance &amp; Hygiene</option>
                </select>
                <input
                  value={reqPurpose}
                  onChange={(e) => setReqPurpose(e.target.value)}
                  placeholder="What is the money for? *"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    value={reqAmount}
                    onChange={(e) => setReqAmount(e.target.value)}
                    placeholder="Amount (৳ BDT) *"
                    required
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black"
                  />
                  <input
                    type="date"
                    value={reqDate}
                    onChange={(e) => setReqDate(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <select
                  value={reqPriority}
                  onChange={(e) => setReqPriority(e.target.value as PettyCashRequisition['priority'])}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                >
                  <option>Low</option>
                  <option>Normal</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
                <textarea
                  value={reqRemarks}
                  onChange={(e) => setReqRemarks(e.target.value)}
                  rows={2}
                  placeholder="Remarks (optional)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300"
                >
                  Submit Requisition
                </button>
              </form>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setReqStatusFilter(st)}
                        className={`rounded-full px-3 py-1 text-[11px] font-extrabold capitalize ${
                          reqStatusFilter === st
                            ? 'bg-[#0f172a] text-emerald-300'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  <select
                    value={reqApproveLedger}
                    onChange={(e) => setReqApproveLedger(e.target.value)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600"
                  >
                    {expenseLedgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        Debit on Approve: {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                {accountingBook.pettyCashRequisitions
                  .filter((r) => reqStatusFilter === 'all' || r.status === reqStatusFilter)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-black text-slate-400">
                            {r.reqNo}
                          </span>
                          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700">
                            {r.department}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">
                            {r.dateIso} · {r.priority}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-black text-slate-900">{r.purpose}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          Applicant: {r.applicantName}
                          {r.remarks ? ` · ${r.remarks}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-900">
                          ৳{r.amount.toLocaleString()}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                            r.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'rejected'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                void runAccountingAction(
                                  {
                                    action: 'decide_requisition',
                                    reqId: r.id,
                                    decision: 'approved',
                                    expenseLedgerId: reqApproveLedger,
                                  },
                                  `Approved ${r.reqNo} & auto-posted Debit Voucher!`,
                                )
                              }
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-[10px] font-black text-white"
                            >
                              Approve &amp; Pay
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void runAccountingAction(
                                  { action: 'decide_requisition', reqId: r.id, decision: 'rejected' },
                                  `Rejected ${r.reqNo}`,
                                )
                              }
                              className="rounded-lg bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-600"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <form onSubmit={handleAddPettyFund} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
                <h3 className="text-sm font-black text-slate-900">Replenish Petty Cash Fund</h3>
                <p className="text-[11px] text-slate-500">
                  Automatically posts a balanced <strong>Contra Voucher</strong> (Dr Petty Cash / Cr
                  Source Cash or Bank).
                </p>
                <select
                  value={fundSourceId}
                  onChange={(e) => setFundSourceId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold"
                >
                  {cashBankLedgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      From: {l.name} (৳{(balanceMap.get(l.id) ?? 0).toLocaleString()})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={100}
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="Top-Up Amount (৳ BDT)"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black"
                />
                <input
                  value={fundRef}
                  onChange={(e) => setFundRef(e.target.value)}
                  placeholder="Reference / Slip No (optional)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white hover:bg-emerald-700"
                >
                  + Add Fund &amp; Post Contra Voucher
                </button>
              </form>

              <div className="space-y-2.5">
                {accountingBook.pettyCashFunds.map((f) => (
                  <div
                    key={f.id}
                    className="dmhs-card flex items-center justify-between rounded-2xl p-4"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-900">
                        Replenished from {f.sourceLedgerName}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        Ref: {f.reference} · {f.dateIso} · By {f.addedBy}
                      </p>
                    </div>
                    <span className="text-base font-black text-emerald-700">
                      +৳{f.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
