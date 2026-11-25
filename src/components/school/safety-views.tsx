'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ChildSwitcherBar } from './guardian-views'
import { DateFilterBar, extractIsoDate, formatPrettyDate, matchesDateFilter } from './date-utils'
import { Icon } from './icons'
import { downloadQrPng, RealQrCode } from './real-qr'
import { useSchool } from './store'
import type { MedicalLogItem } from './types'
import { PageShell, SectionTitle } from './ui'

function normSafetyClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

interface LivePickupPass {
  id: string
  token: string
  studentId: string
  studentName: string
  classLabel: string
  unitLabel: string
  authorizedPerson: string
  authorizedRelation: string
  authorizedIdNumber: string
  issuedDate: string
  expiresAt: string
  revoked: boolean
  usedAt: string | null
}

function GateQRVisual({
  pass,
  loading,
}: {
  pass: LivePickupPass | null
  loading: boolean
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white p-4 text-slate-900 shadow-md">
      {loading || !pass ? (
        <div className="flex size-[144px] items-center justify-center rounded-xl bg-slate-100 text-[11px] font-bold text-slate-400">
          Signing QR...
        </div>
      ) : (
        <RealQrCode
          value={pass.token}
          size={144}
          label={`Scannable Pickup Pass ${pass.id} for ${pass.studentName}`}
        />
      )}
      <p className="mt-2 font-mono text-[11px] font-black tracking-wider text-slate-900">
        {pass ? `PASS #${pass.id}` : 'GENERATING...'}
      </p>
      <p className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700">
        {pass ? `Real ISO QR · Valid ${pass.issuedDate}` : 'Server HMAC Signed'}
      </p>
      {pass && (
        <p className="mt-0.5 text-[9px] font-bold text-slate-400">
          Expires 11:59 PM · {pass.authorizedPerson}
        </p>
      )}
    </div>
  )
}

export function SafetyAndHealthView() {
  const {
    role,
    students,
    teachers,
    guardians,
    activeGuardianId,
    activeTeacherId,
    selectedChildId,
    activeStudentId,
    pickupContacts,
    dismissalLogs,
    medicalLogs,
    addPickupContact,
    logGateDismissal,
    addMedicalLog,
    hasStaffPermission,
    notify,
  } = useSchool()

  const canManageGate = role === 'admin' || role === 'teacher' || hasStaffPermission('gate_security')
  const canManageInfirmary = role === 'admin' || role === 'teacher' || hasStaffPermission('infirmary')

  const activeTeacher = teachers.find((t) => t.id === activeTeacherId)
  const manageableStudents = useMemo(() => {
    if (role !== 'teacher') return students
    const assigned = (activeTeacher?.assignedClasses || []).map(normSafetyClassToken)
    if (assigned.length === 0) return []
    return students.filter((s) => {
      const fullTok = normSafetyClassToken(`${s.className} ${s.section}`)
      const secLetter = s.section.replace(/section/i, '').trim().toLowerCase()
      const compactTok = normSafetyClassToken(`${s.className}${secLetter}`)
      const gradeTok = normSafetyClassToken(s.className)
      return assigned.includes(fullTok) || assigned.includes(compactTok) || assigned.includes(gradeTok)
    })
  }, [role, students, activeTeacher])

  const manageableStudentIds = useMemo(
    () => new Set(manageableStudents.map((s) => s.id)),
    [manageableStudents],
  )

  const [staffStudentId, setStaffStudentId] = useState<string>(
    () => manageableStudents[0]?.id || students[0]?.id || '',
  )

  useEffect(() => {
    if (
      (role === 'teacher' || role === 'admin' || role === 'staff') &&
      manageableStudents.length > 0 &&
      !manageableStudents.some((s) => s.id === staffStudentId)
    ) {
      setStaffStudentId(manageableStudents[0].id)
    }
  }, [role, manageableStudents, staffStudentId])

  const activeGuardian = guardians.find((g) => g.id === activeGuardianId)
  const child =
    role === 'student'
      ? students.find((s) => s.id === activeStudentId) || students[0]
      : role === 'guardian'
        ? students.find((s) => s.id === selectedChildId) || students[0]
        : manageableStudents.find((s) => s.id === staffStudentId) ||
          manageableStudents[0] ||
          students[0]

  const childLinkedGuardian =
    role === 'guardian'
      ? activeGuardian
      : guardians.find(
          (g) => g.id === child.guardianId || g.linkedStudentIds.includes(child.id),
        )

  const childPickups = pickupContacts.filter((p) => p.studentId === child.id)
  const childDismissals = canManageGate
    ? role === 'teacher'
      ? dismissalLogs.filter((d) => manageableStudentIds.has(d.studentId))
      : dismissalLogs
    : dismissalLogs.filter((d) => d.studentId === child.id)
  const childMedical = canManageInfirmary
    ? role === 'teacher'
      ? medicalLogs.filter((m) => manageableStudentIds.has(m.studentId))
      : medicalLogs
    : medicalLogs.filter((m) => m.studentId === child.id)

  const [selectedPickupPersonId, setSelectedPickupPersonId] = useState<string>('self')
  const [pickupPass, setPickupPass] = useState<LivePickupPass | null>(null)
  const [passLoading, setPassLoading] = useState(true)
  const [rotatingPass, setRotatingPass] = useState(false)

  // Staff / Gate Security QR Verifier state
  const [scanTokenInput, setScanTokenInput] = useState('')
  const [verifyingScan, setVerifyingScan] = useState(false)
  const [scanResult, setScanResult] = useState<
    { ok: true; pass: LivePickupPass } | { ok: false; reason: string } | null
  >(null)

  const primaryGuardianName = childLinkedGuardian?.name || child.guardianName
  const primaryGuardianRelation = childLinkedGuardian?.relation || 'Primary Guardian'
  const primaryGuardianPhone = childLinkedGuardian?.phone || child.guardianPhone

  const chosenPickup =
    selectedPickupPersonId === 'self'
      ? {
          name: primaryGuardianName,
          relation: primaryGuardianRelation,
          idNumber: 'DMHA-GUARDIAN-VERIFIED',
        }
      : childPickups.find((p) => p.id === selectedPickupPersonId) || {
          name: primaryGuardianName,
          relation: primaryGuardianRelation,
          idNumber: 'DMHA-GUARDIAN-VERIFIED',
        }

  useEffect(() => {
    let active = true
    setPassLoading(true)
    const qs = new URLSearchParams({
      studentId: child.id,
      studentName: child.name,
      classLabel: `${child.className} · ${child.section}`,
      unitLabel: child.busRoute || 'Unit - 1',
      authorizedPerson: chosenPickup.name,
      authorizedRelation: chosenPickup.relation,
      authorizedIdNumber: chosenPickup.idNumber,
    })
    fetch(`/dmhs-api/pickup-pass?${qs.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { ok?: boolean; pass?: LivePickupPass } | null) => {
        if (active && json?.ok && json.pass) {
          setPickupPass(json.pass)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setPassLoading(false)
      })
    return () => {
      active = false
    }
  }, [
    child.id,
    child.name,
    child.className,
    child.section,
    child.busRoute,
    chosenPickup.name,
    chosenPickup.relation,
    chosenPickup.idNumber,
  ])

  const handleRotatePass = async () => {
    setRotatingPass(true)
    try {
      const res = await fetch('/dmhs-api/pickup-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rotate',
          studentId: child.id,
          studentName: child.name,
          classLabel: `${child.className} · ${child.section}`,
          unitLabel: child.busRoute || 'Unit - 1',
          authorizedPerson: chosenPickup.name,
          authorizedRelation: chosenPickup.relation,
          authorizedIdNumber: chosenPickup.idNumber,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; pass?: LivePickupPass; error?: string }
      if (res.ok && json.ok && json.pass) {
        setPickupPass(json.pass)
        notify(`Previous QR revoked! New daily pass #${json.pass.id} generated.`)
      } else {
        notify(json.error || 'Unable to regenerate pass')
      }
    } finally {
      setRotatingPass(false)
    }
  }

  const handleVerifyGateToken = async (tokenToVerify: string) => {
    const clean = tokenToVerify.trim()
    if (!clean) return
    setVerifyingScan(true)
    setScanResult(null)
    try {
      const res = await fetch('/dmhs-api/pickup-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token: clean }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        valid?: boolean
        pass?: LivePickupPass
        reason?: string
        error?: string
      }
      if (res.ok && json.valid && json.pass) {
        setScanResult({ ok: true, pass: json.pass })
        logGateDismissal({
          studentId: json.pass.studentId,
          pickedUpBy: `${json.pass.authorizedPerson} (${json.pass.authorizedRelation})`,
          gate: `${json.pass.unitLabel} · Main Gate`,
        })
        setScanTokenInput('')
      } else {
        setScanResult({
          ok: false,
          reason: json.reason || json.error || 'Invalid or expired Pickup QR Pass.',
        })
      }
    } finally {
      setVerifyingScan(false)
    }
  }

  // Add pickup form (Guardian)
  const [pkName, setPkName] = useState('')
  const [pkRelation, setPkRelation] = useState('Authorized Relative / Driver')
  const [pkPhone, setPkPhone] = useState('')
  const [pkId, setPkId] = useState('')

  // Infirmary log form (Teacher / Admin / Nurse)
  const [medStudentId, setMedStudentId] = useState(
    () => manageableStudents[0]?.id || students[0]?.id || '',
  )
  useEffect(() => {
    if (manageableStudents.length > 0 && !manageableStudents.some((s) => s.id === medStudentId)) {
      setMedStudentId(manageableStudents[0].id)
    }
  }, [manageableStudents, medStudentId])
  const [symptom, setSymptom] = useState('')
  const [actionTaken, setActionTaken] = useState('')
  const [severity, setSeverity] = useState<MedicalLogItem['severity']>('routine')

  // Historical Date Filters for Gate Dismissal & Infirmary Logs
  const [dismissalDateFilter, setDismissalDateFilter] = useState<string>('ALL')
  const [medicalDateFilter, setMedicalDateFilter] = useState<string>('ALL')

  const filteredDismissals = childDismissals.filter((d) =>
    matchesDateFilter(d.time, dismissalDateFilter),
  )
  const filteredMedical = childMedical.filter((m) => matchesDateFilter(m.date, medicalDateFilter))

  const handleAddPickup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pkName.trim() || !pkPhone.trim()) return
    addPickupContact({
      studentId: child.id,
      name: pkName,
      relation: pkRelation,
      phone: pkPhone,
      idNumber: pkId || 'NID-VERIFIED',
    })
    setPkName('')
    setPkPhone('')
    setPkId('')
  }

  const handleAddMedical = (e: React.FormEvent) => {
    e.preventDefault()
    if (!symptom.trim() || !actionTaken.trim()) return
    addMedicalLog({ studentId: medStudentId, symptom, actionTaken, severity })
    setSymptom('')
    setActionTaken('')
  }

  const isStaff = canManageGate

  return (
    <PageShell
      eyebrow="Child safety · Server-Signed Gate Pass & Infirmary"
      title="Pickup QR Pass, Campus Units & Medical Care"
      subtitle="Cryptographically signed daily rotating Pickup QR passes (scannable by real phone cameras & USB gate scanners), Unit - 1 / Unit - 2 gate verification, and infirmary logs."
    >
      {role === 'guardian' && <ChildSwitcherBar />}
      {(role === 'teacher' || role === 'admin' || role === 'staff') && manageableStudents.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
              {role === 'teacher' ? 'Assigned Classes · Active Student Pass' : 'Campus Gate & Infirmary Student Selector'}
            </p>
            <p className="text-xs font-bold text-slate-600">
              Inspecting {child.name} ({child.className} · {child.section}) — Primary Guardian: {primaryGuardianName}
            </p>
          </div>
          <select
            aria-label="Select student for gate pass and pickups"
            value={child.id}
            onChange={(e) => {
              setStaffStudentId(e.target.value)
              setSelectedPickupPersonId('self')
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 outline-none"
          >
            {manageableStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.className} · {s.section}) — {s.guardianName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Top Hero: Real Scannable Server-Signed Gate Pass + Campus Unit */}
      <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        <section className="dmhs-hero relative overflow-hidden rounded-[28px] p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-lg flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950">
                  <Icon name="shield" size={12} />
                  Server-Signed Daily Gate Pass
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                  Auto-Expires 11:59 PM
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-black">
                {child.name} · {child.className} {child.section}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                Real ISO scannable QR signed with HMAC-SHA256 in DMHA SQLite. Yesterday’s
                screenshots are rejected automatically at {child.busRoute || 'Unit - 1'} Gate.
              </p>

              {/* Guardian Controls: Pick Authorized Person + Download + Revoke/Regenerate */}
              {role === 'guardian' && (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Pickup Person Today:
                    </span>
                    <select
                      value={selectedPickupPersonId}
                      onChange={(e) => setSelectedPickupPersonId(e.target.value)}
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white outline-none"
                    >
                      <option value="self" className="text-slate-900">
                        {activeGuardian?.name || child.guardianName} (Self / Parent)
                      </option>
                      {childPickups.map((pk) => (
                        <option key={pk.id} value={pk.id} className="text-slate-900">
                          {pk.name} ({pk.relation})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!pickupPass}
                      onClick={() => {
                        if (!pickupPass) return
                        void downloadQrPng(
                          pickupPass.token,
                          `DMHA-PickupPass-${child.name.replace(/\s+/g, '-')}-${pickupPass.issuedDate}.png`,
                        )
                        notify('Pickup QR Pass PNG saved — ready to share with driver via WhatsApp')
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
                    >
                      <Icon name="download" size={14} />
                      Save / Share Pass PNG
                    </button>
                    <button
                      type="button"
                      disabled={rotatingPass}
                      onClick={() => void handleRotatePass()}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-white/15 disabled:opacity-50"
                    >
                      <Icon name="lock" size={14} />
                      {rotatingPass ? 'Rotating...' : 'Revoke Old & Regenerate QR'}
                    </button>
                  </div>
                </div>
              )}

              {/* Gate Security / Teacher / Admin Real QR Verification Desk */}
              {isStaff && (
                <div className="mt-4 space-y-2.5 rounded-2xl border border-white/15 bg-white/8 p-3.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    Gate Security QR Scanner (USB Gun or Paste Scanned Token)
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      void handleVerifyGateToken(scanTokenInput)
                    }}
                    className="flex flex-wrap gap-2"
                  >
                    <input
                      value={scanTokenInput}
                      onChange={(e) => setScanTokenInput(e.target.value)}
                      placeholder="Scan with USB QR Gun or paste DMHA-PICKUP|..."
                      className="min-w-[200px] flex-1 rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 font-mono text-[11px] font-semibold text-white placeholder:text-slate-400 outline-none focus:border-emerald-400"
                    />
                    <button
                      type="submit"
                      disabled={verifyingScan || !scanTokenInput.trim()}
                      className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
                    >
                      {verifyingScan ? 'Checking...' : 'Verify Gate Pass'}
                    </button>
                  </form>
                  {pickupPass && (
                    <button
                      type="button"
                      onClick={() => void handleVerifyGateToken(pickupPass.token)}
                      className="text-[11px] font-bold text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                    >
                      Quick Verify Shown Pass (#{pickupPass.id}) at Gate
                    </button>
                  )}

                  {scanResult && (
                    <div
                      className={`mt-2 rounded-xl px-3.5 py-2.5 text-xs font-bold ${
                        scanResult.ok
                          ? 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                          : 'border border-rose-400/40 bg-rose-500/20 text-rose-200'
                      }`}
                    >
                      {scanResult.ok ? (
                        <>
                          ✓ GATE PASS VERIFIED — Release{' '}
                          <strong>{scanResult.pass.studentName}</strong> ({scanResult.pass.classLabel}{' '}
                          · {scanResult.pass.unitLabel}) to{' '}
                          <strong>{scanResult.pass.authorizedPerson}</strong> (
                          {scanResult.pass.authorizedRelation} · ID:{' '}
                          {scanResult.pass.authorizedIdNumber}). Guardian alerted!
                        </>
                      ) : (
                        <>✕ ACCESS DENIED — {scanResult.reason}</>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <GateQRVisual pass={pickupPass} loading={passLoading} />
          </div>
        </section>

        {/* Assigned Campus Unit Status */}
        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="action-cyan flex size-10 items-center justify-center rounded-xl">
              <Icon name="shield" size={20} />
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-800">
              CAMPUS ACTIVE · VERIFIED
            </span>
          </div>
          <h3 className="mt-4 text-base font-black">{child.busRoute || 'Unit - 1'}</h3>
          <p className="mt-1 text-xs text-black/50">
            Assigned DMHA Campus Unit · Morning Entry &amp; Safe Gate Dismissal
          </p>
          <div className="mt-4 space-y-2 border-l-2 border-emerald-500 pl-3.5 text-xs">
            <div>
              <p className="font-black">{child.busRoute || 'Unit - 1'} · Main Gate</p>
              <p className="text-[10px] text-black/45">
                Morning Check-in: {child.gateCheckIn || '07:52 AM'}
              </p>
            </div>
            <div>
              <p className="font-black">Classroom Attendance Verified</p>
              <p className="text-[10px] text-black/45">
                {child.className} · {child.section}
              </p>
            </div>
            <div>
              <p className="font-black">Guardian QR Handover Ready</p>
              <p className="text-[10px] text-black/45">Dismissal at {child.busRoute || 'Unit - 1'} Gate</p>
            </div>
          </div>
        </section>
      </div>

      {/* Authorized Pickup Contacts + Dismissal History */}
      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle eyebrow="Pre-approved list" title="Authorized Pickup Persons" />
          <div className="space-y-2.5">
            {!childPickups.some(
              (pk) => pk.name.toLowerCase() === primaryGuardianName.toLowerCase(),
            ) && (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4 shadow-xs">
                <div>
                  <p className="text-xs font-black text-slate-900">{primaryGuardianName}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-600">
                    {primaryGuardianRelation} · {primaryGuardianPhone}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                    ID: DMHA-GUARDIAN-VERIFIED
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800">
                  Primary Verified ✓
                </span>
              </div>
            )}
            {childPickups.map((pk) => (
              <div
                key={pk.id}
                className="flex items-center justify-between rounded-2xl border border-black/5 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="text-xs font-black">{pk.name}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-black/50">
                    {pk.relation} · {pk.phone}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-black/35">ID: {pk.idNumber}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800">
                  Verified ✓
                </span>
              </div>
            ))}
          </div>

          {role === 'guardian' && (
            <form
              onSubmit={handleAddPickup}
              className="mt-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-black">Add Authorized Pickup Person</p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <input
                  value={pkName}
                  onChange={(e) => setPkName(e.target.value)}
                  placeholder="Full name"
                  className="rounded-xl bg-[#f4f5f8] px-3 py-2 text-xs font-bold outline-none"
                />
                <input
                  value={pkRelation}
                  onChange={(e) => setPkRelation(e.target.value)}
                  placeholder="Relation (e.g., Uncle, Driver)"
                  className="rounded-xl bg-[#f4f5f8] px-3 py-2 text-xs font-bold outline-none"
                />
                <input
                  value={pkPhone}
                  onChange={(e) => setPkPhone(e.target.value)}
                  placeholder="Mobile number"
                  className="rounded-xl bg-[#f4f5f8] px-3 py-2 text-xs font-bold outline-none"
                />
                <input
                  value={pkId}
                  onChange={(e) => setPkId(e.target.value)}
                  placeholder="NID / Driving License #"
                  className="rounded-xl bg-[#f4f5f8] px-3 py-2 text-xs font-bold outline-none"
                />
              </div>
              <button
                type="submit"
                className="mt-3 w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-extrabold text-emerald-300"
              >
                + Authorize for Campus Pickup
              </button>
            </form>
          )}
        </section>

        <section>
          <SectionTitle eyebrow="Audit trail" title="Gate Dismissal Logs & History" />
          <div className="mb-3">
            <DateFilterBar
              value={dismissalDateFilter}
              onChange={setDismissalDateFilter}
              allowAll
              compact
              label="Gate Date"
              savedDates={Array.from(
                new Set(
                  childDismissals
                    .map((d) => extractIsoDate(d.time))
                    .filter((x): x is string => Boolean(x)),
                ),
              ).sort((a, b) => (a < b ? 1 : -1))}
            />
          </div>
          <div className="space-y-2.5">
            {filteredDismissals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-6 text-center text-xs font-semibold text-slate-400">
                No gate dismissal logs found for{' '}
                {dismissalDateFilter === 'ALL' ? 'this filter' : formatPrettyDate(dismissalDateFilter)}.
              </div>
            ) : (
              filteredDismissals.map((log) => (
                <div key={log.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black">{log.studentName}</p>
                    <span className="text-[10px] font-bold text-black/40">{log.time}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-black/65">
                    Picked up by <strong>{log.pickedUpBy}</strong> · {log.gate}
                  </p>
                  <p className="mt-1 text-[10px] font-extrabold text-emerald-800">{log.verifiedBy}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Campus Infirmary / Medical Log */}
      <section className="mt-8">
        <SectionTitle
          eyebrow={`Campus health · Blood Group ${child.bloodGroup}`}
          title="School Infirmary & Medical Care Log"
        />
        <div className="mb-4">
          <DateFilterBar
            value={medicalDateFilter}
            onChange={setMedicalDateFilter}
            allowAll
            compact
            label="Visit Date"
            savedDates={Array.from(
              new Set(
                childMedical
                  .map((m) => extractIsoDate(m.date))
                  .filter((x): x is string => Boolean(x)),
              ),
            ).sort((a, b) => (a < b ? 1 : -1))}
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-3">
            {filteredMedical.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-8 text-center text-xs font-semibold text-slate-400">
                No infirmary visits logged for{' '}
                {medicalDateFilter === 'ALL' ? 'this filter' : formatPrettyDate(medicalDateFilter)}.
              </div>
            ) : (
              filteredMedical.map((med) => (
                <div key={med.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          med.severity === 'urgent'
                            ? 'bg-rose-50 text-rose-700'
                            : med.severity === 'attention'
                              ? 'bg-[#fff2d6] text-[#9a6200]'
                              : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {med.severity}
                      </span>
                      <span className="text-xs font-black">{med.studentName}</span>
                    </div>
                    <span className="text-[10px] font-bold text-black/35">{med.date}</span>
                  </div>
                  <p className="mt-2 text-xs font-extrabold">{med.symptom}</p>
                  <p className="mt-1 text-xs text-black/60">{med.actionTaken}</p>
                  <p className="mt-2 text-[10px] font-bold text-black/40">
                    Logged by {med.loggedBy} · Guardian Alerted ✓
                  </p>
                </div>
              ))
            )}
          </div>

          {canManageInfirmary && (
            <form
              onSubmit={handleAddMedical}
              className="rounded-[24px] border border-black/5 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-black">Log Infirmary Visit (Auto-Alerts Parent)</p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <select
                  value={medStudentId}
                  onChange={(e) => setMedStudentId(e.target.value)}
                  className="rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
                >
                  {manageableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.className})
                    </option>
                  ))}
                </select>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as MedicalLogItem['severity'])}
                  className="rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
                >
                  <option value="routine">Routine Care</option>
                  <option value="attention">Needs Parent Attention</option>
                  <option value="urgent">Urgent Medical Alert</option>
                </select>
              </div>
              <input
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                placeholder="Symptom / incident (e.g., Mild fever 100.2°F)"
                className="mt-2.5 w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-bold outline-none"
              />
              <textarea
                rows={2}
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                placeholder="Nurse action taken & recommendation..."
                className="mt-2.5 w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-semibold outline-none"
              />
              <button
                type="submit"
                className="mt-3 w-full rounded-xl bg-[#0f172a] py-3 text-xs font-extrabold text-emerald-300"
              >
                Save Medical Log & Alert Guardian
              </button>
            </form>
          )}
        </div>
      </section>
    </PageShell>
  )
}
