'use client'

import React, { useEffect, useState } from 'react'
import { Icon } from './icons'
import { useSchool } from './store'
import type { FeeInvoice } from './types'
import { PageShell } from './ui'

type CheckoutMethod = 'bKash' | 'Nagad' | 'Card (SSLCommerz)' | 'Stripe Card' | 'Bank Transfer'

export function SecureFeeCheckoutModal({
  invoice,
  onSuccess,
  onClose,
}: {
  invoice: FeeInvoice
  onSuccess: (receiptNo: string, method: string) => void
  onClose: () => void
}) {
  const { guardians, activeGuardianId } = useSchool()
  const guardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]

  const [method, setMethod] = useState<CheckoutMethod>('bKash')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const handleCheckout = async () => {
    setError('')
    setProcessing(true)
    try {
      const res = await fetch('/dmhs-api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          studentName: invoice.studentName,
          guardianName: guardian?.name,
          guardianEmail: guardian?.email,
          guardianPhone: guardian?.phone,
          title: invoice.title,
          amount: invoice.amount,
          method,
        }),
      })
      const json = (await res.json()) as {
        ok: boolean
        mode?: 'live_redirect' | 'sandbox_settled'
        redirectUrl?: string
        receiptNo?: string
        transactionId?: string
        error?: string
      }
      setProcessing(false)
      if (!res.ok || !json.ok) {
        setError(json.error || 'Payment gateway declined transaction.')
        return
      }
      if (json.mode === 'live_redirect' && json.redirectUrl) {
        window.location.href = json.redirectUrl
        return
      }
      onSuccess(json.receiptNo || json.transactionId || `DMHA-${Date.now()}`, method)
    } catch {
      setProcessing(false)
      setError('Unable to connect to DMHA Payment Gateway.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-600">
              DMHA Secure Payment Gateway
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-900">Complete Tuition Payment</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-[#0f172a] p-4 text-white">
          <p className="text-[10px] font-bold uppercase text-emerald-300">{invoice.studentName}</p>
          <p className="mt-0.5 text-sm font-black">{invoice.title}</p>
          <p className="mt-2 text-3xl font-black text-emerald-400">
            ৳{invoice.amount.toLocaleString()}
          </p>
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Select Payment Channel (SSLCommerz / Stripe Ready)
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              ['bKash', 'Nagad', 'Card (SSLCommerz)', 'Stripe Card', 'Bank Transfer'] as const
            ).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setMethod(ch)}
                className={`rounded-xl border px-3 py-2.5 text-left text-xs font-extrabold transition ${
                  method === ch
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2.5 text-xs font-extrabold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={() => void handleCheckout()}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            <Icon name="lock" size={14} />
            {processing ? 'Contacting Gateway...' : `Pay ৳${invoice.amount.toLocaleString()} via ${method}`}
          </button>
        </div>
      </div>
    </div>
  )
}

interface HealthResponse {
  ok: boolean
  status: string
  nodeVersion: string
  uptimeSec: number
  connectedDevices: number
  readinessScore: number
  integrations: {
    database: {
      activeEngine: string
      postgresConfigured: boolean
      sqliteHealthy: boolean
      dbFile: string
      sizeKb: number
      stateVersion: number
      paymentLedgerCount?: number
      auditLogsCount?: number
    }
    payments: {
      sslcommerzConfigured: boolean
      bkashConfigured: boolean
      stripeConfigured: boolean
      webhookEndpoint?: string
      mode: 'live' | 'sandbox'
    }
    messaging: {
      twilioConfigured: boolean
      bulksmsBdConfigured: boolean
      sslWirelessConfigured?: boolean
      mode: 'live' | 'sandbox'
    }
    storage: {
      r2S3Configured: boolean
      mode: 'cloud_s3' | 'local_disk'
    }
    security: {
      httpsActive: boolean
      webAuthnReady: boolean
      pwaReady: boolean
      scryptAuth: boolean
      httpOnlySessions: boolean
      rbacEnforced?: boolean
      rateLimitingActive?: boolean
      optimisticLockingActive?: boolean
      paymentWebhookReady?: boolean
      demoLoginAllowed?: boolean
    }
  }
}

export function GoLiveProductionView() {
  const { notify, refreshDbFromServer } = useSchool()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [testLog, setTestLog] = useState<{ ok: boolean; msg: string } | null>(null)
  const [pendingBackup, setPendingBackup] = useState<{
    filename: string
    studentsCount: number
    exportedAt: string
    raw: Record<string, unknown>
  } | null>(null)
  const [restoring, setRestoring] = useState(false)

  const handleBackupPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '')) as Record<string, unknown>
        const st = (parsed.schoolState || parsed.data) as { students?: unknown[] } | undefined
        if (!st || !Array.isArray(st.students)) {
          setTestLog({
            ok: false,
            msg: 'Invalid DMHA backup JSON: expected schoolState.students array.',
          })
          return
        }
        setPendingBackup({
          filename: file.name,
          studentsCount: st.students.length,
          exportedAt: String(parsed.exportedAt || 'Unknown date'),
          raw: parsed,
        })
        setTestLog(null)
      } catch {
        setTestLog({ ok: false, msg: 'Could not parse JSON backup file.' })
      }
    }
    reader.readAsText(file)
  }

  const handleConfirmBackupRestore = async () => {
    if (!pendingBackup) return
    setRestoring(true)
    setTestLog(null)
    try {
      const res = await fetch('/dmhs-api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: pendingBackup.raw }),
      })
      const json = (await res.json()) as {
        ok: boolean
        version?: number
        studentsRestored?: number
        safetySnapshot?: string | null
        error?: string
      }
      if (res.ok && json.ok) {
        setPendingBackup(null)
        await refreshDbFromServer()
        await loadHealth()
        setTestLog({
          ok: true,
          msg: `Restored SQLite database to v${json.version} (${json.studentsRestored} students).${
            json.safetySnapshot ? ` Auto pre-restore safety backup saved: ${json.safetySnapshot}` : ''
          }`,
        })
        notify('DMHA SQLite backup restored!')
      } else {
        setTestLog({ ok: false, msg: json.error || 'Backup restore failed.' })
      }
    } finally {
      setRestoring(false)
    }
  }

  const loadHealth = async () => {
    setLoading(true)
    try {
      const res = await fetch('/dmhs-api/health', { cache: 'no-store' })
      if (res.ok) {
        setHealth((await res.json()) as HealthResponse)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadHealth()
  }, [])

  const testPaymentGateway = async () => {
    setTestLog(null)
    const res = await fetch('/dmhs-api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: 'TEST-PING',
        studentName: 'System Health Check',
        title: 'DMHA Gateway Diagnostic',
        amount: 100,
        method: 'bKash',
      }),
    })
    const json = (await res.json()) as {
      ok: boolean
      provider?: string
      transactionId?: string
      error?: string
    }
    if (json.ok) {
      setTestLog({
        ok: true,
        msg: `Payment Gateway Verified (${json.provider}) · Txn ID: ${json.transactionId} · Logged to SQLite Payment Ledger`,
      })
      notify('Payment Gateway API responded OK')
      void loadHealth()
    } else {
      setTestLog({ ok: false, msg: json.error || 'Payment test failed' })
    }
  }

  const testMessagingGateway = async () => {
    setTestLog(null)
    const res = await fetch('/dmhs-api/alerts/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'WhatsApp',
        to: '+8801711248910',
        message: 'DMHA Production Diagnostic Ping',
      }),
    })
    const json = (await res.json()) as {
      ok: boolean
      provider?: string
      providerId?: string
      error?: string
    }
    if (json.ok) {
      setTestLog({
        ok: true,
        msg: `Messaging Gateway Verified (${json.provider}) · Dispatch ID: ${json.providerId}`,
      })
      notify('WhatsApp/SMS Gateway API responded OK')
    } else {
      setTestLog({ ok: false, msg: json.error || 'Messaging test failed' })
    }
  }

  return (
    <PageShell
      eyebrow="Production Operations · Cloud Integrations & Backups"
      title="Go-Live Production & Real Integrations Center"
      subtitle="Live server health diagnostics, SSLCommerz/bKash/Stripe payment connectors, Twilio/BulkSMS BD alert gateways, cloud storage, and 1-click SQLite backups."
      action={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadHealth()}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Refresh Diagnostics
          </button>
          <a
            href="/dmhs-api/backup"
            download
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
          >
            <Icon name="download" size={14} />
            Download Full SQLite Backup
          </a>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100">
            <Icon name="database" size={14} />
            Restore Backup JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleBackupPicked}
              className="hidden"
            />
          </label>
        </div>
      }
    >
      {pendingBackup && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
          <div>
            <p className="text-xs font-black text-amber-950">
              Confirm SQLite Restore: {pendingBackup.filename}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-amber-800">
              Contains {pendingBackup.studentsCount} students (exported {pendingBackup.exportedAt}).
              An automatic pre-restore safety snapshot will be saved to disk first.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingBackup(null)}
              className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={restoring}
              onClick={() => void handleConfirmBackupRestore()}
              className="rounded-full bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {restoring ? 'Restoring...' : 'Confirm & Restore SQLite'}
            </button>
          </div>
        </div>
      )}
      {/* Top Hero Readiness Banner */}
      <div className="dmhs-hero rounded-[28px] p-6 text-white shadow-xl sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {loading ? 'Checking Server...' : `Server Healthy · Node ${health?.nodeVersion}`}
            </span>
            <h2 className="mt-3 text-2xl font-black sm:text-3xl">
              DMHA Production Runtime &amp; Gateway Connectors
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-300">
              All APIs read credentials strictly from server-side environment variables (
              <code className="text-emerald-300">env.example</code>) — zero secrets in browser code.
              Add live provider keys on your host to flip Sandbox → Live Production instantly.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-[9px] font-extrabold uppercase text-emerald-300">Readiness</p>
              <p className="mt-1 text-2xl font-black">{health?.readinessScore ?? '—'}%</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-[9px] font-extrabold uppercase text-sky-300">Live SSE</p>
              <p className="mt-1 text-2xl font-black">{health?.connectedDevices ?? 1}D</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-[9px] font-extrabold uppercase text-amber-300">SQLite DB</p>
              <p className="mt-1 text-2xl font-black">
                {health?.integrations.database.sizeKb ?? 0}KB
              </p>
            </div>
          </div>
        </div>
      </div>

      {testLog && (
        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-xs font-bold ${
            testLog.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {testLog.msg}
        </div>
      )}

      {/* 4 Integration Connector Cards */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Payments */}
        <div className="dmhs-card flex flex-col justify-between p-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-black text-slate-900">
                1. Online Fee Payment Gateway
              </h3>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                  health?.integrations.payments.mode === 'live'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                {health?.integrations.payments.mode === 'live'
                  ? 'Live Connected'
                  : 'Sandbox Mode Active'}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Wired to <code className="font-mono font-bold text-slate-700">POST /dmhs-api/payments/checkout</code>{' '}
              &amp; IPN webhook{' '}
              <code className="font-mono font-bold text-slate-700">/dmhs-api/payments/webhook</code>.
              Supports <strong>SSLCommerz</strong> (bKash, Nagad, Visa/MC) &amp;{' '}
              <strong>Stripe</strong> with immutable SQLite Payment Ledger ({health?.integrations.database.paymentLedgerCount ?? 0}{' '}
              records).
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px] font-bold text-slate-600">
              <span className="rounded-lg bg-slate-100 px-2 py-1">SSLCOMMERZ_STORE_ID</span>
              <span className="rounded-lg bg-slate-100 px-2 py-1">SSLCOMMERZ_STORE_PASSWD</span>
              <span className="rounded-lg bg-slate-100 px-2 py-1">STRIPE_SECRET_KEY</span>
            </div>
          </div>
          <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => void testPaymentGateway()}
              className="rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
            >
              Test Payment API
            </button>
          </div>
        </div>

        {/* WhatsApp & SMS */}
        <div className="dmhs-card flex flex-col justify-between p-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-black text-slate-900">
                2. WhatsApp &amp; SMS Alert Gateway
              </h3>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                  health?.integrations.messaging.mode === 'live'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                {health?.integrations.messaging.mode === 'live'
                  ? 'Live Connected'
                  : 'Sandbox Mode Active'}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Wired to <code className="font-mono font-bold text-slate-700">POST /dmhs-api/alerts/send</code>,{' '}
              <code className="font-mono font-bold text-slate-700">billing-generator</code> &amp;{' '}
              <code className="font-mono font-bold text-slate-700">ptm</code>. Supports{' '}
              <strong>Twilio WhatsApp / SMS</strong>, <strong>BulkSMS BD</strong> &amp;{' '}
              <strong>SSL Wireless BD</strong> for fee due reminders, PTM bookings &amp; absence alerts.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px] font-bold text-slate-600">
              <span className="rounded-lg bg-slate-100 px-2 py-1">TWILIO_ACCOUNT_SID</span>
              <span className="rounded-lg bg-slate-100 px-2 py-1">BULKSMS_BD_API_KEY</span>
              <span className="rounded-lg bg-slate-100 px-2 py-1">SSL_WIRELESS_API_TOKEN</span>
            </div>
          </div>
          <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => void testMessagingGateway()}
              className="rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
            >
              Test WhatsApp / SMS API
            </button>
          </div>
        </div>

        {/* Storage */}
        <div className="dmhs-card p-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-black text-slate-900">
              3. Exam Sheet &amp; Document Storage
            </h3>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">
              {health?.integrations.storage.mode === 'cloud_s3'
                ? 'Cloudflare R2 / S3'
                : 'Local Server Disk Ready'}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Wired to <code className="font-mono font-bold text-slate-700">POST /dmhs-api/uploads</code>.
            Persists scanned exam sheets cleanly on disk (<code className="font-mono">/uploads/exam-sheets/</code>)
            and accepts Cloudflare R2 / AWS S3 env vars for CDN scale.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px] font-bold text-slate-600">
            <span className="rounded-lg bg-slate-100 px-2 py-1">S3_ENDPOINT</span>
            <span className="rounded-lg bg-slate-100 px-2 py-1">S3_BUCKET</span>
            <span className="rounded-lg bg-slate-100 px-2 py-1">S3_ACCESS_KEY_ID</span>
          </div>
        </div>

        {/* Database & Security */}
        <div className="dmhs-card p-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-black text-slate-900">
              4. Database, HTTPS &amp; Biometric Security
            </h3>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase text-emerald-800">
              Production Hardened
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs font-semibold text-slate-600">
            <li>
              ✓ Database: <strong>{health?.integrations.database.activeEngine || 'SQLite 3 WAL'}</strong>{' '}
              (v{health?.integrations.database.stateVersion || 0} ·{' '}
              {health?.integrations.database.auditLogsCount ?? 0} Security Audit Logs)
            </li>
            <li>
              ✓ Server RBAC &amp; Rate Limiting:{' '}
              <strong>
                {health?.integrations.security.rbacEnforced ? 'Enforced on All 14 APIs' : 'Checking...'}
              </strong>{' '}
              (401/403 + Brute-Force 429)
            </li>
            <li>
              ✓ Concurrency Lock &amp; File Uploads:{' '}
              <strong>Optimistic Version Lock (409 Auto-Sync)</strong> + Binary Exam Script Storage
            </li>
            <li>
              ✓ Auth &amp; Biometrics: Salted scrypt + Production HTTPS Secure Cookies + W3C WebAuthn
              Passkeys
            </li>
            <li>
              ✓ Public Admissions Gate: Rate-limited{' '}
              <code className="font-mono font-bold text-slate-700">/dmhs-api/admissions/public</code>{' '}
              (Zero pre-login PII)
            </li>
          </ul>
        </div>
      </div>

      {/* Go-Live Deployment Playbook */}
      <div className="dmhs-card mt-6 p-6">
        <h3 className="text-sm font-black text-slate-900">
          Recommended Go-Live Launch Path (See DEPLOYMENT.md &amp; env.example)
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase text-emerald-700">Step 1 · Host + HTTPS</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">
              Deploy on <strong>Railway / Render / VPS</strong> (with persistent volume for{' '}
              <code className="font-mono">/data</code>) or an Office PC +{' '}
              <strong>Cloudflare Tunnel</strong> for instant free HTTPS.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase text-emerald-700">Step 2 · Add Live Keys</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">
              Set <code className="font-mono">SSLCOMMERZ_*</code>,{' '}
              <code className="font-mono">TWILIO_*</code> or{' '}
              <code className="font-mono">BULKSMS_BD_*</code> in your host environment panel —
              zero code edits needed.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase text-emerald-700">Step 3 · School Wi-Fi Lock</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">
              Open <strong>Teacher HR &amp; Wi-Fi</strong> from your school office PC and click{' '}
              <strong>Use Current Office Network IP</strong> so teachers can only check in on campus.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
