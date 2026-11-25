'use client'

import React, { useEffect, useRef, useState } from 'react'
import { downloadExcelCsv } from '@/lib/csv-export'
import { DateRangeBar, matchesDateRange } from './date-utils'
import { Icon } from './icons'
import { useSchool } from './store'
import { PageShell } from './ui'

interface PaymentLedgerRow {
  id: string
  transactionId: string
  invoiceId: string
  studentName: string
  guardianName: string
  amount: number
  method: string
  provider: string
  status: 'pending' | 'settled' | 'failed'
  verifiedBy: string
  createdAt: string
  settledAt: string | null
}

interface SecurityAuditRow {
  id: string
  action: string
  target: string
  actor: string
  actorRole: string
  ipAddress: string
  createdAt: string
}

interface SnapshotFile {
  filename: string
  sizeKb: number
  createdAt: string
}

export function SecurityAuditConsoleView() {
  const { role, notify, refreshDbFromServer } = useSchool()
  const isAdmin = role === 'admin'
  const [subTab, setSubTab] = useState<'payments' | 'security' | 'backups'>('payments')
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<PaymentLedgerRow[]>([])
  const [securityLogs, setSecurityLogs] = useState<SecurityAuditRow[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotFile[]>([])
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<{
    filename: string
    studentsCount: number
    exportedAt: string
    raw: Record<string, unknown>
  } | null>(null)
  const [restoring, setRestoring] = useState(false)
  const restoreInputRef = useRef<HTMLInputElement | null>(null)

  const loadLedger = async () => {
    setLoading(true)
    try {
      const res = await fetch('/dmhs-api/audit-ledger', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        payments?: PaymentLedgerRow[]
        securityLogs?: SecurityAuditRow[]
        snapshots?: SnapshotFile[]
      }
      if (json.ok) {
        setPayments(json.payments || [])
        setSecurityLogs(json.securityLogs || [])
        setSnapshots(json.snapshots || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadLedger()
  }, [])

  const totalSettledBdt = payments
    .filter((p) => p.status === 'settled')
    .reduce((sum, p) => sum + p.amount, 0)

  const filteredPayments = payments.filter(
    (p) =>
      matchesDateRange(p.createdAt, fromDate, toDate) &&
      `${p.transactionId} ${p.invoiceId} ${p.studentName} ${p.guardianName} ${p.method} ${p.provider}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )

  const filteredLogs = securityLogs.filter(
    (l) =>
      matchesDateRange(l.createdAt, fromDate, toDate) &&
      `${l.action} ${l.target} ${l.actor} ${l.actorRole} ${l.ipAddress}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )

  const handleCreateDiskSnapshot = async () => {
    setSavingSnapshot(true)
    setStatusMsg(null)
    try {
      const res = await fetch('/dmhs-api/audit-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      })
      const json = (await res.json()) as {
        ok: boolean
        snapshot?: SnapshotFile
        snapshots?: SnapshotFile[]
        securityLogs?: SecurityAuditRow[]
        error?: string
      }
      if (res.ok && json.ok) {
        if (json.snapshots) setSnapshots(json.snapshots)
        if (json.securityLogs) setSecurityLogs(json.securityLogs)
        setStatusMsg({
          ok: true,
          text: `Saved timestamped SQLite snapshot to server disk: data/backups/${json.snapshot?.filename} (${json.snapshot?.sizeKb} KB)`,
        })
        notify('Server disk backup snapshot saved')
      } else {
        setStatusMsg({ ok: false, text: json.error || 'Failed to save snapshot' })
      }
    } finally {
      setSavingSnapshot(false)
    }
  }

  const handleBackupFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '')) as Record<string, unknown>
        const schoolState = (parsed.schoolState || parsed.data) as
          | { students?: unknown[] }
          | undefined
        if (!schoolState || !Array.isArray(schoolState.students)) {
          setStatusMsg({
            ok: false,
            text: 'Invalid backup file: expected a DMHA SQLite JSON backup containing schoolState.students.',
          })
          return
        }
        setPendingRestore({
          filename: file.name,
          studentsCount: schoolState.students.length,
          exportedAt: String(parsed.exportedAt || 'Unknown date'),
          raw: parsed,
        })
        setStatusMsg(null)
      } catch {
        setStatusMsg({ ok: false, text: 'Could not parse JSON backup file.' })
      }
    }
    reader.readAsText(file)
  }

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return
    setRestoring(true)
    setStatusMsg(null)
    try {
      const res = await fetch('/dmhs-api/audit-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', backup: pendingRestore.raw }),
      })
      const json = (await res.json()) as {
        ok: boolean
        version?: number
        studentsRestored?: number
        safetySnapshot?: string | null
        snapshots?: SnapshotFile[]
        securityLogs?: SecurityAuditRow[]
        error?: string
      }
      if (res.ok && json.ok) {
        if (json.securityLogs) setSecurityLogs(json.securityLogs)
        if (json.snapshots) setSnapshots(json.snapshots)
        setPendingRestore(null)
        await refreshDbFromServer()
        setStatusMsg({
          ok: true,
          text: `Restored DMHA database to snapshot v${json.version} (${json.studentsRestored} students) and broadcast live sync.${
            json.safetySnapshot ? ` Auto pre-restore safety copy saved: ${json.safetySnapshot}` : ''
          }`,
        })
        notify('Campus database restored from backup!')
      } else {
        setStatusMsg({ ok: false, text: json.error || 'Backup restore failed' })
      }
    } finally {
      setRestoring(false)
    }
  }

  return (
    <PageShell
      eyebrow="Server-Immutable Compliance · Financial & Security Ops"
      title="Security Audit Log, Payment Ledger & Backup Restore"
      subtitle="Live SQLite reconciliation ledger for every bKash/SSLCommerz/Stripe fee payment, real-time RBAC/Wi-Fi/login security audit stream, server disk snapshots, and 1-click JSON restore."
      action={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadLedger()}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Refresh SQLite Logs
          </button>
          {isAdmin && (
            <a
              href="/dmhs-api/backup"
              download
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
            >
              <Icon name="download" size={14} />
              Download Backup JSON
            </a>
          )}
        </div>
      }
    >
      {/* Top KPI Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-300">
            Verified Payment Ledger
          </p>
          <p className="mt-1.5 text-2xl font-black">৳{totalSettledBdt.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-slate-300">{payments.length} gateway records</p>
        </div>
        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
            Security Audit Events
          </p>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{securityLogs.length}</p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-700">
            Immutable SQLite log table
          </p>
        </div>
        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
            Blocked / Alert Events
          </p>
          <p className="mt-1.5 text-2xl font-black text-amber-600">
            {
              securityLogs.filter(
                (l) =>
                  l.action.includes('blocked') ||
                  l.action.includes('failed') ||
                  l.action.includes('rate_limited'),
              ).length
            }
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Failed logins, Wi-Fi blocks &amp; 429s
          </p>
        </div>
        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
            Disk Snapshots
          </p>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{snapshots.length}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">Stored in data/backups/</p>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`mb-5 rounded-2xl border px-4 py-3 text-xs font-bold ${
            statusMsg.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Sub-Tabs & Search */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'payments' as const, label: `Payment Ledger (${payments.length})` },
            ...(isAdmin
              ? [
                  { id: 'security' as const, label: `Security Audit Stream (${securityLogs.length})` },
                  { id: 'backups' as const, label: `Snapshots & Restore (${snapshots.length})` },
                ]
              : []),
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
                subTab === t.id
                  ? 'bg-[#0f172a] text-emerald-300'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {subTab !== 'backups' && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by Txn ID, user, IP, action..."
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => {
                if (subTab === 'payments') {
                  downloadExcelCsv(
                    'DMHA-Payment-Reconciliation-Ledger.csv',
                    [
                      'Transaction ID',
                      'Invoice ID',
                      'Student',
                      'Guardian',
                      'Amount (BDT)',
                      'Method',
                      'Provider',
                      'Status',
                      'Verified By',
                      'Created At',
                    ],
                    filteredPayments.map((p) => [
                      p.transactionId,
                      p.invoiceId,
                      p.studentName,
                      p.guardianName,
                      p.amount,
                      p.method,
                      p.provider,
                      p.status,
                      p.verifiedBy,
                      p.createdAt,
                    ]),
                  )
                } else {
                  downloadExcelCsv(
                    'DMHA-Security-Audit-Logs.csv',
                    ['Action', 'Target', 'Actor', 'Role', 'IP Address', 'Timestamp'],
                    filteredLogs.map((l) => [
                      l.action,
                      l.target,
                      l.actor,
                      l.actorRole,
                      l.ipAddress,
                      l.createdAt,
                    ]),
                  )
                }
                notify('Exported CSV report for Excel/Auditors')
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
            >
              <Icon name="download" size={13} />
              Export CSV
            </button>
          </div>
        )}
      </div>

      {subTab !== 'backups' && (
        <div className="mb-5">
          <DateRangeBar
            fromDate={fromDate}
            toDate={toDate}
            onChange={(f, t) => {
              setFromDate(f)
              setToDate(t)
            }}
            label={subTab === 'payments' ? 'Ledger Period' : 'Audit Period'}
            rightSlot={
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold text-slate-600">
                {subTab === 'payments' ? filteredPayments.length : filteredLogs.length} matching
              </span>
            }
          />
        </div>
      )}

      {/* 1. PAYMENT RECONCILIATION LEDGER */}
      {subTab === 'payments' && (
        <div className="dmhs-card overflow-x-auto p-5">
          {loading ? (
            <p className="py-6 text-center text-xs font-bold text-slate-400">
              Loading SQLite Payment Ledger...
            </p>
          ) : filteredPayments.length === 0 ? (
            <p className="py-8 text-center text-xs font-semibold text-slate-500">
              No gateway payment transactions recorded yet. Test a fee checkout from Guardian School
              Fees or Go-Live &amp; Cloud.
            </p>
          ) : (
            <table className="w-full min-w-[740px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
                  <th className="px-3 py-2.5">Transaction ID</th>
                  <th className="px-3 py-2.5">Student / Guardian</th>
                  <th className="px-3 py-2.5">Channel / Provider</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5">Verified By</th>
                  <th className="px-3 py-2.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2.5 font-mono font-black text-slate-900">
                      {p.transactionId}
                      <div className="text-[10px] font-semibold text-slate-400">
                        Inv: {p.invoiceId}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-slate-900">{p.studentName}</p>
                      <p className="text-[11px] text-slate-500">{p.guardianName}</p>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-700">{p.provider}</td>
                    <td className="px-3 py-2.5 text-right font-black text-emerald-700">
                      ৳{p.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          p.status === 'settled'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">
                      {p.verifiedBy}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-500">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 2. SECURITY AUDIT STREAM */}
      {subTab === 'security' && (
        <div className="dmhs-card overflow-x-auto p-5">
          <table className="w-full min-w-[740px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
                <th className="px-3 py-2.5">Action</th>
                <th className="px-3 py-2.5">Target / Details</th>
                <th className="px-3 py-2.5">Actor</th>
                <th className="px-3 py-2.5">IP Address</th>
                <th className="px-3 py-2.5">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const isAlert =
                  log.action.includes('blocked') ||
                  log.action.includes('failed') ||
                  log.action.includes('rate_limited')
                return (
                  <tr key={log.id}>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-black ${
                          isAlert
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{log.target}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-700">
                      {log.actor}{' '}
                      <span className="text-[10px] font-semibold uppercase text-slate-400">
                        ({log.actorRole})
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">
                      {log.ipAddress}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. SERVER SNAPSHOTS & 1-CLICK BACKUP RESTORE */}
      {subTab === 'backups' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="dmhs-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Server Disk Snapshots (<code className="font-mono text-xs text-emerald-700">data/backups/</code>)
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Save immutable timestamped JSON backups directly on your campus server disk before
                  term exams or annual promotions.
                </p>
              </div>
              <button
                type="button"
                disabled={savingSnapshot}
                onClick={() => void handleCreateDiskSnapshot()}
                className="shrink-0 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {savingSnapshot ? 'Saving...' : '+ Save Snapshot Now'}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {snapshots.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">
                  No server disk snapshots created yet. Click <strong>+ Save Snapshot Now</strong>{' '}
                  above to archive the current SQLite state to <code>data/backups/</code>.
                </p>
              ) : (
                snapshots.map((snap) => (
                  <div
                    key={snap.filename}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-mono font-black text-slate-800">{snap.filename}</p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(snap.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-emerald-700 shadow-2xs">
                      {snap.sizeKb} KB
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dmhs-card p-6">
            <h3 className="text-base font-black text-slate-900">
              1-Click Restore from Backup JSON
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Upload any previously downloaded <code>DMHA-SQLite-Backup-*.json</code> file. DMHA
              validates the file structure first and lets you confirm before overwriting live state.
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => restoreInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-800 hover:bg-slate-50"
              >
                <Icon name="database" size={14} />
                Choose DMHA Backup JSON File
              </button>
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleBackupFilePicked}
              />
            </div>

            {pendingRestore && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                <p className="font-black">Confirm Database Restore</p>
                <p className="mt-1 font-semibold">
                  File: <code>{pendingRestore.filename}</code> · Exported:{' '}
                  {pendingRestore.exportedAt} · Contains{' '}
                  <strong>{pendingRestore.studentsCount} students</strong>.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={restoring}
                    onClick={() => void handleConfirmRestore()}
                    className="rounded-full bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {restoring ? 'Restoring SQLite...' : 'Yes, Restore Database Now'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingRestore(null)}
                    className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  )
}
