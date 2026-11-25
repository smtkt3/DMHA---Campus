'use client'

import React, { useMemo, useState } from 'react'
import { downloadExcelCsv } from '@/lib/csv-export'
import { GuardianBiometricGateModal, VerificationSealBadge } from './biometric-ui'
import { DMHS_CLASS_SECTIONS } from './data'
import {
  DateFilterBar,
  extractIsoDate,
  formatPrettyDate,
  getTodayIso,
  matchesDateFilter,
  shiftIsoDate,
} from './date-utils'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type { ConsentFormItem } from './types'
import { PageShell, SectionTitle } from './ui'

const CONSENT_CATEGORIES: ConsentFormItem['category'][] = [
  'Field Trip',
  'Science & Lab',
  'Sports & CCA',
  'Medical & Health',
  'Media & Photo Release',
]

function getConsentStatus(cf: ConsentFormItem): 'approved' | 'declined' | 'pending' {
  if (cf.status === 'declined') return 'declined'
  if (cf.signed || cf.status === 'approved') return 'approved'
  return 'pending'
}

function normalizeToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

interface ConsentCampaignGroup {
  key: string
  campaignId?: string
  title: string
  category: ConsentFormItem['category']
  eventDate: string
  deadlineDate?: string
  venue?: string
  feeAmount?: number
  details: string
  targetLabel: string
  createdBy: string
  forms: ConsentFormItem[]
  approvedCount: number
  declinedCount: number
  pendingCount: number
}

export function ConsentAndCanteenView() {
  const {
    role,
    students,
    teachers,
    guardians,
    activeTeacherId,
    activeGuardianId,
    selectedChildId,
    activeStudentId,
    consentForms,
    signConsentForm,
    declineConsentForm,
    createConsentForm,
    remindConsentForm,
    deleteConsentForm,
    canteenWallets,
    canteenTransactions,
    topUpCanteenWallet,
    updateCanteenLimit,
  } = useSchool()

  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isStaffCreator = isAdmin || isTeacher
  const isGuardian = role === 'guardian'
  const isStudent = role === 'student'

  const activeTeacher = teachers.find((t) => t.id === activeTeacherId) || teachers[0]
  const activeGuardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]

  const child = isStudent
    ? students.find((s) => s.id === activeStudentId) || students[0]
    : isGuardian
      ? students.find((s) => s.id === selectedChildId) || students[0]
      : students[0]

  const activeStudents = useMemo(
    () => students.filter((s) => s.status !== 'suspended'),
    [students],
  )

  const teacherAssignedClasses = useMemo(
    () => activeTeacher?.assignedClasses || [],
    [activeTeacher],
  )

  const eligibleStudentsForCreator = useMemo(() => {
    if (isAdmin) return activeStudents
    if (!isTeacher) return []
    return activeStudents.filter((s) =>
      teacherAssignedClasses.some((cls) => {
        const tok = normalizeToken(cls)
        const full = normalizeToken(`${s.className} ${s.section}`)
        const compact = normalizeToken(
          `${s.className}${s.section.replace(/section/i, '').trim()}`,
        )
        return tok === full || tok === compact || tok === normalizeToken(s.className)
      }),
    )
  }, [isAdmin, isTeacher, activeStudents, teacherAssignedClasses])

  const classOptionsForCreator = useMemo(() => {
    if (isAdmin) return [...DMHS_CLASS_SECTIONS]
    const fromEligible = Array.from(
      new Set(eligibleStudentsForCreator.map((s) => `${s.className} · ${s.section}`)),
    )
    return fromEligible.length > 0 ? fromEligible : teacherAssignedClasses
  }, [isAdmin, eligibleStudentsForCreator, teacherAssignedClasses])

  // Forms visible to current role
  const roleScopedForms = useMemo(() => {
    if (isAdmin) return consentForms
    if (isTeacher) {
      const eligibleIds = new Set(eligibleStudentsForCreator.map((s) => s.id))
      return consentForms.filter(
        (cf) => eligibleIds.has(cf.studentId) || cf.createdBy === activeTeacher?.name,
      )
    }
    return consentForms.filter((cf) => cf.studentId === child?.id)
  }, [isAdmin, isTeacher, consentForms, eligibleStudentsForCreator, activeTeacher?.name, child?.id])

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'declined'>('all')
  const [eventDateFilter, setEventDateFilter] = useState<string>('ALL')
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  // Admin / Teacher Create Consent Form state
  const todayIso = getTodayIso()
  const [targetType, setTargetType] = useState<'class' | 'all' | 'student'>('class')
  const [targetClass, setTargetClass] = useState<string>(classOptionsForCreator[0] || 'Class 6 · Section A')
  const [targetStudentId, setTargetStudentId] = useState<string>(
    eligibleStudentsForCreator[0]?.id || students[0]?.id || 'stu-araf',
  )
  const [cfTitle, setCfTitle] = useState('')
  const [cfCategory, setCfCategory] = useState<ConsentFormItem['category']>('Field Trip')
  const [cfDate, setCfDate] = useState(shiftIsoDate(todayIso, 7))
  const [cfDeadline, setCfDeadline] = useState(shiftIsoDate(todayIso, 4))
  const [cfVenue, setCfVenue] = useState('')
  const [cfFee, setCfFee] = useState('')
  const [cfDetails, setCfDetails] = useState('')
  const [creating, setCreating] = useState(false)

  // Guardian Sign Modal (Emergency phone + medical note + biometric gate)
  const [signingForm, setSigningForm] = useState<ConsentFormItem | null>(null)
  const [signEmergencyPhone, setSignEmergencyPhone] = useState('')
  const [signMedicalNote, setSignMedicalNote] = useState('')
  const [signComment, setSignComment] = useState('')
  const [biometricGateOpen, setBiometricGateOpen] = useState(false)

  // Guardian Decline Modal
  const [decliningForm, setDecliningForm] = useState<ConsentFormItem | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  // Admin / Teacher Campaign Roster Modal ("Who Signed / Declined / Pending")
  const [rosterCampaignKey, setRosterCampaignKey] = useState<string | null>(null)
  const [rosterFilter, setRosterFilter] = useState<'all' | 'approved' | 'pending' | 'declined'>('all')

  // Printable Official Consent Slip Modal
  const [printSlipForm, setPrintSlipForm] = useState<ConsentFormItem | null>(null)

  // Cashless Canteen state
  const wallet = canteenWallets.find((w) => w.studentId === child?.id) || canteenWallets[0]
  const txns = canteenTransactions.filter((t) => t.studentId === child?.id)
  const [mealDateFilter, setMealDateFilter] = useState<string>('ALL')
  const filteredTxns = txns.filter((t) => matchesDateFilter(t.time, mealDateFilter))

  // Grouped Campaigns for Admin / Teacher view
  const campaignGroups = useMemo<ConsentCampaignGroup[]>(() => {
    const map = new Map<string, ConsentFormItem[]>()
    roleScopedForms.forEach((cf) => {
      const k = cf.campaignId || `${cf.title}||${cf.eventDate}||${cf.category}`
      const arr = map.get(k) || []
      arr.push(cf)
      map.set(k, arr)
    })

    const groups: ConsentCampaignGroup[] = []
    map.forEach((forms, key) => {
      const first = forms[0]
      const approvedCount = forms.filter((f) => getConsentStatus(f) === 'approved').length
      const declinedCount = forms.filter((f) => getConsentStatus(f) === 'declined').length
      const pendingCount = forms.length - approvedCount - declinedCount
      const firstStu = students.find((s) => s.id === first.studentId)
      groups.push({
        key,
        campaignId: first.campaignId,
        title: first.title,
        category: first.category,
        eventDate: first.eventDate,
        deadlineDate: first.deadlineDate,
        venue: first.venue,
        feeAmount: first.feeAmount,
        details: first.details,
        targetLabel:
          first.targetLabel ||
          (forms.length === 1 && firstStu
            ? `${firstStu.name} (${firstStu.className} · ${firstStu.section})`
            : `${forms.length} Students`),
        createdBy: first.createdBy || 'DMHA Administration',
        forms,
        approvedCount,
        declinedCount,
        pendingCount,
      })
    })
    return groups
  }, [roleScopedForms, students])

  const filteredCampaignGroups = campaignGroups.filter((g) => {
    if (!matchesDateFilter(g.eventDate, eventDateFilter)) return false
    if (statusFilter === 'pending') return g.pendingCount > 0
    if (statusFilter === 'approved') return g.approvedCount > 0
    if (statusFilter === 'declined') return g.declinedCount > 0
    return true
  })

  const filteredPersonalForms = roleScopedForms.filter((f) => {
    if (!matchesDateFilter(f.eventDate, eventDateFilter)) return false
    if (statusFilter === 'all') return true
    return getConsentStatus(f) === statusFilter
  })

  const activeRosterGroup = rosterCampaignKey
    ? campaignGroups.find((g) => g.key === rosterCampaignKey) || null
    : null

  const totalApproved = roleScopedForms.filter((f) => getConsentStatus(f) === 'approved').length
  const totalPending = roleScopedForms.filter((f) => getConsentStatus(f) === 'pending').length
  const totalDeclined = roleScopedForms.filter((f) => getConsentStatus(f) === 'declined').length

  const savedConsentDates = Array.from(
    new Set(
      roleScopedForms
        .map((f) => extractIsoDate(f.eventDate))
        .filter((d): d is string => Boolean(d)),
    ),
  ).sort((a, b) => (a < b ? 1 : -1))

  const handleCreateConsent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cfTitle.trim() || !cfDetails.trim()) return
    setCreating(true)
    setBanner(null)
    const res = await createConsentForm({
      targetType,
      targetValue:
        targetType === 'class'
          ? targetClass
          : targetType === 'student'
            ? targetStudentId
            : 'ALL',
      title: cfTitle,
      eventDate: formatPrettyDate(cfDate),
      deadlineDate: cfDeadline ? formatPrettyDate(cfDeadline) : undefined,
      venue: cfVenue.trim() || undefined,
      feeAmount: cfFee ? Number(cfFee) : undefined,
      category: cfCategory,
      details: cfDetails,
    })
    setCreating(false)
    if (res.ok) {
      setCfTitle('')
      setCfVenue('')
      setCfFee('')
      setCfDetails('')
      setBanner({
        ok: true,
        text: `Digital Consent Form issued to ${res.createdCount || 1} student(s) & guardians in SQLite!`,
      })
    } else {
      setBanner({ ok: false, text: res.error || 'Could not send consent form.' })
    }
  }

  const openSignDialog = (form: ConsentFormItem) => {
    setSigningForm(form)
    setSignEmergencyPhone(
      form.emergencyPhone || activeGuardian?.phone || child?.guardianPhone || '+880 1711-000000',
    )
    setSignMedicalNote(form.medicalNote || '')
    setSignComment(form.guardianComment || '')
  }

  const handleDeclineSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!decliningForm || !declineReason.trim()) return
    setBusyKey(`decline:${decliningForm.id}`)
    const res = await declineConsentForm(decliningForm.id, declineReason.trim())
    setBusyKey(null)
    if (res.ok) {
      setDecliningForm(null)
      setDeclineReason('')
      setBanner({ ok: true, text: 'Consent declined and synced to Teacher & School Office.' })
    } else {
      setBanner({ ok: false, text: res.error || 'Could not decline consent.' })
    }
  }

  const handleRemind = async (payload: { formId?: string; campaignId?: string }, key: string) => {
    setBusyKey(key)
    setBanner(null)
    const res = await remindConsentForm(payload)
    setBusyKey(null)
    setBanner({
      ok: res.ok,
      text: res.ok
        ? `Consent reminder sent to ${res.remindedCount || 1} pending guardian(s)!`
        : res.error || 'Could not send reminder.',
    })
  }

  const handleDeleteGroup = async (group: ConsentCampaignGroup) => {
    setBusyKey(`del:${group.key}`)
    const res = await deleteConsentForm(
      group.campaignId ? { campaignId: group.campaignId } : { formId: group.forms[0]?.id },
    )
    setBusyKey(null)
    if (res.ok) {
      if (rosterCampaignKey === group.key) setRosterCampaignKey(null)
      setBanner({ ok: true, text: `Removed "${group.title}" from SQLite.` })
    } else {
      setBanner({ ok: false, text: res.error || 'Could not delete consent form.' })
    }
  }

  const exportRosterCsv = (group: ConsentCampaignGroup) => {
    downloadExcelCsv(
      `DMHA-Consent-Roster-${group.title.replace(/[^a-z0-9]+/gi, '-')}.csv`,
      [
        'Student Name',
        'Class & Section',
        'Roll',
        'Status',
        'Signed / Responded By',
        'Timestamp',
        'Emergency Phone',
        'Medical / Allergy Note',
        'Comment / Decline Reason',
      ],
      group.forms.map((f) => {
        const stu = students.find((s) => s.id === f.studentId)
        const st = getConsentStatus(f)
        return [
          stu?.name || f.studentName || f.studentId,
          stu ? `${stu.className} · ${stu.section}` : f.classLabel || '-',
          stu?.roll || '-',
          st.toUpperCase(),
          f.signedBy || stu?.guardianName || '-',
          f.signedAt || 'Pending',
          f.emergencyPhone || stu?.guardianPhone || '-',
          f.medicalNote || 'None',
          st === 'declined' ? f.declineReason || '-' : f.guardianComment || '-',
        ]
      }),
    )
  }

  return (
    <PageShell
      eyebrow="Zero-paperwork campus · SQLite Biometric E-Signatures"
      title={
        isTeacher
          ? 'Digital Consent Forms & Parent Approvals'
          : 'Digital Consent Forms & Cashless Canteen'
      }
      subtitle={
        isStaffCreator
          ? 'Send consent slips to an entire class, all students, or a single student — track who signed, declined, or is pending with emergency & medical notes.'
          : isGuardian
            ? `Review, approve with Biometric/PIN e-signature, add emergency/medical notes, or decline permission slips for ${child?.name} — plus manage cashless canteen spend.`
            : 'Track your permission slip status, remind your guardian in 1 tap, download signed slips, and view cafeteria wallet history.'
      }
    >
      {isGuardian && <ChildSwitcherBar />}

      {/* Executive Consent Status KPI Strip */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="dmhs-card rounded-2xl p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
            Approved &amp; E-Signed ✓
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{totalApproved}</p>
        </div>
        <div className="dmhs-card rounded-2xl p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
            Pending Signature ⏳
          </p>
          <p className="mt-1 text-2xl font-black text-amber-600">{totalPending}</p>
        </div>
        <div className="dmhs-card rounded-2xl p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">
            Declined / Opted Out
          </p>
          <p className="mt-1 text-2xl font-black text-rose-600">{totalDeclined}</p>
        </div>
      </div>

      {banner && (
        <div
          className={`mb-5 rounded-2xl border px-4 py-3 text-xs font-bold ${
            banner.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className={`grid gap-6 ${isTeacher ? 'lg:grid-cols-1' : 'lg:grid-cols-[1.25fr_.75fr]'}`}>
        {/* ==================== DIGITAL CONSENT FORMS SECTION ==================== */}
        <section>
          <SectionTitle
            eyebrow="Paperless approvals · All Roles Synced"
            title="Digital Consent & Permission Slips"
          />

          {/* Admin / Teacher Multi-Target Consent Builder */}
          {isStaffCreator && (
            <form
              onSubmit={handleCreateConsent}
              className="dmhs-card mb-5 rounded-[24px] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                    Issue New Permission Slip
                  </p>
                  <h3 className="text-sm font-black text-slate-900">
                    + Send Digital Consent Form to Guardians
                  </h3>
                </div>
                <div className="inline-flex rounded-full bg-slate-100 p-1 text-[11px] font-extrabold">
                  {(
                    [
                      ['class', 'By Class'],
                      ['all', isAdmin ? 'All Students' : 'All Assigned'],
                      ['student', 'Single Student'],
                    ] as const
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTargetType(k)}
                      className={`rounded-full px-3 py-1 transition ${
                        targetType === k ? 'bg-[#0f172a] text-emerald-300' : 'text-slate-600'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
                <input
                  required
                  value={cfTitle}
                  onChange={(e) => setCfTitle(e.target.value)}
                  placeholder="Event / trip / lab title *"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                />
                <select
                  value={cfCategory}
                  onChange={(e) =>
                    setCfCategory(e.target.value as ConsentFormItem['category'])
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                >
                  {CONSENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {targetType === 'class' && (
                <div className="mt-2.5">
                  <label className="mb-1 block text-[10px] font-extrabold uppercase text-slate-400">
                    Target Class &amp; Section
                  </label>
                  <select
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                  >
                    {classOptionsForCreator.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'student' && (
                <div className="mt-2.5">
                  <label className="mb-1 block text-[10px] font-extrabold uppercase text-slate-400">
                    Select Student
                  </label>
                  <select
                    value={targetStudentId}
                    onChange={(e) => setTargetStudentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                  >
                    {eligibleStudentsForCreator.map((stu) => (
                      <option key={stu.id} value={stu.id}>
                        {stu.name} ({stu.className} · {stu.section} · Roll #{stu.roll})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-4">
                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Event Date *
                  <input
                    required
                    type="date"
                    value={cfDate}
                    onChange={(e) => setCfDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                  />
                </label>
                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Reply Deadline
                  <input
                    type="date"
                    value={cfDeadline}
                    onChange={(e) => setCfDeadline(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                  />
                </label>
                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Venue / Location
                  <input
                    value={cfVenue}
                    onChange={(e) => setCfVenue(e.target.value)}
                    placeholder="e.g., Science Museum"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                  />
                </label>
                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Fee (৳ Optional)
                  <input
                    type="number"
                    min={0}
                    value={cfFee}
                    onChange={(e) => setCfFee(e.target.value)}
                    placeholder="0 (Free)"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                  />
                </label>
              </div>

              <textarea
                required
                rows={2}
                value={cfDetails}
                onChange={(e) => setCfDetails(e.target.value)}
                placeholder="Consent terms, departure/return time, transport & safety details..."
                className="mt-2.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={creating}
                className="mt-3 w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-extrabold text-emerald-300 shadow-xs transition hover:bg-slate-800 disabled:opacity-50"
              >
                {creating ? 'Sending to Guardians...' : 'Send Digital Consent Form to Guardians'}
              </button>
            </form>
          )}

          {/* Status Filter & Event Date Bar */}
          <div className="mb-4 space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['all', 'All Forms'],
                  ['pending', `Pending (${totalPending})`],
                  ['approved', `Approved (${totalApproved})`],
                  ['declined', `Declined (${totalDeclined})`],
                ] as const
              ).map(([st, label]) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                    statusFilter === st
                      ? 'bg-[#0f172a] text-emerald-300'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <DateFilterBar
              value={eventDateFilter}
              onChange={setEventDateFilter}
              allowAll
              allowFuture
              compact
              label="Event Date"
              savedDates={savedConsentDates}
            />
          </div>

          {/* ADMIN & TEACHER VIEW: Grouped Consent Campaigns with Who Signed / Declined / Pending */}
          {isStaffCreator ? (
            <div className="space-y-3.5">
              {filteredCampaignGroups.length === 0 ? (
                <div className="dmhs-card rounded-2xl py-10 text-center text-xs font-semibold text-slate-400">
                  No consent forms match the current filter.
                </div>
              ) : (
                filteredCampaignGroups.map((group) => {
                  const pct =
                    group.forms.length > 0
                      ? Math.round((group.approvedCount / group.forms.length) * 100)
                      : 0
                  return (
                    <article
                      key={group.key}
                      className="dmhs-card rounded-[24px] p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-[#eee5ff] px-2.5 py-0.5 text-[10px] font-black text-[#6935c3]">
                            {group.category}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                            {group.targetLabel}
                          </span>
                          {group.feeAmount ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-800">
                              Fee: ৳{group.feeAmount.toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                          Event: {group.eventDate}
                          {group.deadlineDate ? ` · Due ${group.deadlineDate}` : ''}
                        </span>
                      </div>

                      <h4 className="mt-2.5 text-base font-black text-slate-900">{group.title}</h4>
                      {group.venue && (
                        <p className="mt-0.5 text-[11px] font-bold text-emerald-700">
                          Venue: {group.venue}
                        </p>
                      )}
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{group.details}</p>

                      {/* Response Progress Strip */}
                      <div className="mt-3.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-extrabold">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-800">
                              ✓ {group.approvedCount}/{group.forms.length} Approved
                            </span>
                            {group.pendingCount > 0 && (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800">
                                ⏳ {group.pendingCount} Pending
                              </span>
                            )}
                            {group.declinedCount > 0 && (
                              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-rose-700">
                                ✕ {group.declinedCount} Declined
                              </span>
                            )}
                          </div>
                          <span className="text-slate-500">{pct}% Signed</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <span className="text-[10px] font-bold text-slate-400">
                          Issued by {group.createdBy}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRosterFilter('all')
                              setRosterCampaignKey(group.key)
                            }}
                            className="rounded-xl bg-[#0f172a] px-3.5 py-1.5 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
                          >
                            View Responses ({group.approvedCount}/{group.forms.length})
                          </button>
                          {group.pendingCount > 0 && (
                            <button
                              type="button"
                              disabled={busyKey !== null}
                              onClick={() =>
                                void handleRemind(
                                  group.campaignId
                                    ? { campaignId: group.campaignId }
                                    : { formId: group.forms.find((f) => getConsentStatus(f) === 'pending')?.id },
                                  `rem:${group.key}`,
                                )
                              }
                              className="rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-extrabold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
                            >
                              {busyKey === `rem:${group.key}`
                                ? 'Sending...'
                                : `Remind Pending (${group.pendingCount})`}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() => void handleDeleteGroup(group)}
                            className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          ) : (
            /* GUARDIAN & STUDENT VIEW: Personal Student Consent Slips */
            <div className="space-y-3">
              {filteredPersonalForms.length === 0 ? (
                <div className="dmhs-card rounded-2xl py-10 text-center text-xs font-semibold text-slate-400">
                  No consent forms found for {child?.name} under this filter.
                </div>
              ) : (
                filteredPersonalForms.map((form) => {
                  const st = getConsentStatus(form)
                  return (
                    <article
                      key={form.id}
                      className="rounded-[24px] border border-black/5 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-[#eee5ff] px-2.5 py-0.5 text-[10px] font-black text-[#6935c3]">
                            {form.category}
                          </span>
                          {form.feeAmount ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-800">
                              Fee: ৳{form.feeAmount.toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-[10px] font-bold text-black/40">
                          Event: {form.eventDate}
                          {form.deadlineDate ? ` · Due ${form.deadlineDate}` : ''}
                        </span>
                      </div>

                      <h4 className="mt-2.5 text-sm font-black text-slate-900">{form.title}</h4>
                      {form.venue && (
                        <p className="mt-0.5 text-[11px] font-bold text-emerald-700">
                          Venue: {form.venue}
                        </p>
                      )}
                      <p className="mt-1 text-xs leading-relaxed text-black/60">{form.details}</p>

                      {st === 'approved' && (form.emergencyPhone || form.medicalNote || form.guardianComment) && (
                        <div className="mt-3 rounded-xl bg-emerald-50/70 px-3.5 py-2.5 text-[11px] text-emerald-950">
                          {form.emergencyPhone && (
                            <p>
                              <strong>Emergency Phone:</strong> {form.emergencyPhone}
                            </p>
                          )}
                          {form.medicalNote && (
                            <p className="mt-0.5">
                              <strong>Medical / Allergy Note:</strong> {form.medicalNote}
                            </p>
                          )}
                          {form.guardianComment && (
                            <p className="mt-0.5">
                              <strong>Guardian Note:</strong> {form.guardianComment}
                            </p>
                          )}
                        </div>
                      )}

                      {st === 'declined' && (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-[11px] text-rose-800">
                          <strong>Declined by {form.signedBy || 'Guardian'}:</strong>{' '}
                          {form.declineReason || 'Guardian opted out of this event.'}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/6 pt-3.5">
                        {st === 'approved' ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-800">
                                <Icon name="check" size={14} />
                                E-Signed by {form.signedBy} · {form.signedAt}
                              </span>
                              <VerificationSealBadge verification={form.verification} />
                            </div>
                            <button
                              type="button"
                              onClick={() => setPrintSlipForm(form)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                            >
                              <Icon name="print" size={13} />
                              View / Print Slip
                            </button>
                          </>
                        ) : st === 'declined' ? (
                          <>
                            <span className="text-[11px] font-extrabold text-rose-700">
                              ✕ Declined / Opted Out · {form.signedAt}
                            </span>
                            {isGuardian && (
                              <button
                                type="button"
                                onClick={() => openSignDialog(form)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3.5 py-1.5 text-xs font-extrabold text-emerald-800 hover:bg-emerald-200"
                              >
                                Change to Approve &amp; E-Sign
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-[11px] font-extrabold text-[#c53219]">
                              ⏳ {isStudent ? 'Awaiting Guardian Signature' : 'Signature Pending'}
                            </span>
                            {isGuardian && (
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDecliningForm(form)
                                    setDeclineReason('')
                                  }}
                                  className="rounded-full bg-rose-50 px-3.5 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
                                >
                                  Decline
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openSignDialog(form)}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-xs font-black text-black transition hover:brightness-95"
                                >
                                  <Icon name="shield" size={14} />
                                  Approve &amp; Biometric E-Sign
                                </button>
                              </div>
                            )}
                            {isStudent && (
                              <button
                                type="button"
                                disabled={busyKey !== null}
                                onClick={() =>
                                  void handleRemind({ formId: form.id }, `sturem:${form.id}`)
                                }
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 hover:bg-slate-800 disabled:opacity-50"
                              >
                                <Icon name="bell" size={13} />
                                {busyKey === `sturem:${form.id}`
                                  ? 'Notifying Parent...'
                                  : 'Remind My Guardian'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          )}
        </section>

        {/* ==================== CASHLESS SCHOOL CANTEEN WALLET (Guardian, Student, Admin) ==================== */}
        {!isTeacher && wallet && (
          <section>
            <SectionTitle
              eyebrow="Nutrition & spend control"
              title={`${child?.name}’s Canteen Wallet`}
            />
            <div className="rounded-[26px] bg-[#0f172a] p-6 text-white">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/45">
                  Cashless Cafeteria Balance
                </p>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                  {wallet.allergyGuard}
                </span>
              </div>
              <p className="mt-2 text-4xl font-black text-emerald-300">
                ৳{wallet.balance.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-white/55">
                Daily Spend Cap: <strong>৳{wallet.dailyLimit}/day</strong> · Tap Student ID at
                Counter
              </p>

              {isGuardian && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => topUpCanteenWallet(child.id, 500)}
                    className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-black text-black"
                  >
                    + Top Up ৳500
                  </button>
                  <button
                    onClick={() =>
                      updateCanteenLimit(child.id, wallet.dailyLimit === 250 ? 350 : 250)
                    }
                    className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-extrabold text-white"
                  >
                    Toggle Limit (৳250 / ৳350)
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">
                  Cafeteria Meals History ({filteredTxns.length})
                </p>
              </div>
              <DateFilterBar
                value={mealDateFilter}
                onChange={setMealDateFilter}
                allowAll
                compact
                label="Meal Date"
                savedDates={Array.from(
                  new Set(
                    txns
                      .map((t) => extractIsoDate(t.time))
                      .filter((d): d is string => Boolean(d)),
                  ),
                ).sort((a, b) => (a < b ? 1 : -1))}
              />
              {filteredTxns.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-6 text-center text-xs font-semibold text-slate-400">
                  No cafeteria meals logged on{' '}
                  {mealDateFilter === 'ALL' ? 'this view' : formatPrettyDate(mealDateFilter)}.
                </div>
              ) : (
                filteredTxns.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-2xl border border-black/5 bg-white p-4 shadow-sm"
                  >
                    <div>
                      <p className="text-xs font-black">{tx.item}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-black/45">
                        {tx.time} · {tx.calories}
                      </p>
                    </div>
                    <span className="text-xs font-black text-black">-৳{tx.amount}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      {/* ==================== GUARDIAN EMERGENCY / MEDICAL NOTE STEP BEFORE BIOMETRIC E-SIGN ==================== */}
      {signingForm && !biometricGateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setSigningForm(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              setBiometricGateOpen(true)
            }}
            className="w-full max-w-md space-y-3 rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
              Guardian Approval &amp; Emergency Info
            </p>
            <h3 className="text-lg font-black text-slate-900">{signingForm.title}</h3>
            <p className="text-xs text-slate-500">
              For <strong>{child?.name}</strong> · Event: {signingForm.eventDate}
              {signingForm.venue ? ` · ${signingForm.venue}` : ''}
            </p>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">
                Emergency Contact Phone *
              </label>
              <input
                required
                value={signEmergencyPhone}
                onChange={(e) => setSignEmergencyPhone(e.target.value)}
                placeholder="+880 1711-XXXXXX"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">
                Allergy / Medical Instructions (Optional)
              </label>
              <input
                value={signMedicalNote}
                onChange={(e) => setSignMedicalNote(e.target.value)}
                placeholder="e.g., No peanuts, carries asthma inhaler, or None"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">
                Note for Teacher (Optional)
              </label>
              <textarea
                rows={2}
                value={signComment}
                onChange={(e) => setSignComment(e.target.value)}
                placeholder="Pickup instructions or special message..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSigningForm(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-5 py-2 text-xs font-black text-emerald-300"
              >
                <Icon name="shield" size={14} />
                Continue to Biometric / PIN Sign
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== BIOMETRIC / PIN VERIFICATION GATE ==================== */}
      <GuardianBiometricGateModal
        open={Boolean(signingForm && biometricGateOpen)}
        actionTitle="Sign Official Digital Consent Form"
        actionDescription={
          signingForm
            ? `Authorizing "${signingForm.title}" (${signingForm.eventDate}) for ${child?.name}. Emergency: ${signEmergencyPhone}.`
            : ''
        }
        onVerified={async (stamp) => {
          if (signingForm) {
            await signConsentForm(signingForm.id, stamp, {
              emergencyPhone: signEmergencyPhone,
              medicalNote: signMedicalNote,
              guardianComment: signComment,
            })
          }
          setBiometricGateOpen(false)
          setSigningForm(null)
        }}
        onClose={() => {
          setBiometricGateOpen(false)
        }}
      />

      {/* ==================== GUARDIAN DECLINE MODAL ==================== */}
      {decliningForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setDecliningForm(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleDeclineSubmit}
            className="w-full max-w-md space-y-3 rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">
              Decline / Opt Out of Consent
            </p>
            <h3 className="text-lg font-black text-slate-900">{decliningForm.title}</h3>
            <p className="text-xs text-slate-500">
              Please share a brief reason so {child?.name}&apos;s teacher can arrange alternate class
              supervision.
            </p>
            <textarea
              required
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g., Family travel scheduled on that day / medical rest advised..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-rose-400 focus:bg-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDecliningForm(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyKey !== null}
                className="rounded-full bg-rose-600 px-5 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Decline
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== ADMIN / TEACHER CONSENT RESPONSE ROSTER MODAL ==================== */}
      {activeRosterGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setRosterCampaignKey(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="rounded-full bg-[#eee5ff] px-2.5 py-0.5 text-[10px] font-black text-[#6935c3]">
                  {activeRosterGroup.category} · {activeRosterGroup.targetLabel}
                </span>
                <h3 className="mt-2 text-xl font-black text-slate-900">
                  {activeRosterGroup.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Event: {activeRosterGroup.eventDate}
                  {activeRosterGroup.venue ? ` · ${activeRosterGroup.venue}` : ''} ·{' '}
                  {activeRosterGroup.approvedCount} Approved · {activeRosterGroup.pendingCount}{' '}
                  Pending · {activeRosterGroup.declinedCount} Declined
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportRosterCsv(activeRosterGroup)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  <Icon name="sheet" size={13} className="text-emerald-600" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setRosterCampaignKey(null)}
                  className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['all', `All (${activeRosterGroup.forms.length})`],
                    ['approved', `✓ Approved (${activeRosterGroup.approvedCount})`],
                    ['pending', `⏳ Pending (${activeRosterGroup.pendingCount})`],
                    ['declined', `✕ Declined (${activeRosterGroup.declinedCount})`],
                  ] as const
                ).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRosterFilter(k)}
                    className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                      rosterFilter === k
                        ? 'bg-[#0f172a] text-emerald-300'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {activeRosterGroup.pendingCount > 0 && (
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() =>
                    void handleRemind(
                      activeRosterGroup.campaignId
                        ? { campaignId: activeRosterGroup.campaignId }
                        : {
                            formId: activeRosterGroup.forms.find(
                              (f) => getConsentStatus(f) === 'pending',
                            )?.id,
                          },
                      `rem-modal:${activeRosterGroup.key}`,
                    )
                  }
                  className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-[11px] font-black text-slate-950 hover:bg-amber-400"
                >
                  Remind All Pending ({activeRosterGroup.pendingCount})
                </button>
              )}
            </div>

            <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200/80">
              {activeRosterGroup.forms
                .filter((f) => (rosterFilter === 'all' ? true : getConsentStatus(f) === rosterFilter))
                .map((f) => {
                  const stu = students.find((s) => s.id === f.studentId)
                  const st = getConsentStatus(f)
                  return (
                    <div
                      key={f.id}
                      className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-slate-900">
                            {stu?.name || f.studentName || f.studentId}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {stu ? `${stu.className} · ${stu.section} · Roll #${stu.roll}` : f.classLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                          Guardian: {f.signedBy || stu?.guardianName} ({f.emergencyPhone || stu?.guardianPhone})
                        </p>
                        {st === 'approved' && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-bold text-emerald-700">{f.signedAt}</span>
                            {f.verification && <VerificationSealBadge verification={f.verification} />}
                            {f.medicalNote && (
                              <span className="rounded-md bg-rose-50 px-2 py-0.5 font-bold text-rose-700">
                                Medical: {f.medicalNote}
                              </span>
                            )}
                            {f.guardianComment && (
                              <span className="text-slate-600">Note: &ldquo;{f.guardianComment}&rdquo;</span>
                            )}
                          </div>
                        )}
                        {st === 'declined' && (
                          <p className="mt-1 text-[11px] font-bold text-rose-700">
                            Reason: {f.declineReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                            st === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : st === 'declined'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {st}
                        </span>
                        {st === 'approved' && (
                          <button
                            type="button"
                            onClick={() => setPrintSlipForm(f)}
                            className="rounded-xl border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Slip PDF
                          </button>
                        )}
                        {st === 'pending' && (
                          <button
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() => void handleRemind({ formId: f.id }, `remrow:${f.id}`)}
                            className="rounded-xl bg-[#0f172a] px-2.5 py-1 text-[11px] font-bold text-emerald-300"
                          >
                            Remind
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== PRINTABLE OFFICIAL SIGNED CONSENT SLIP MODAL ==================== */}
      {printSlipForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
          onClick={() => setPrintSlipForm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">
                  DMHA · Official Signed Consent Slip
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-900">{printSlipForm.title}</h3>
                <p className="text-xs font-semibold text-slate-500">
                  {printSlipForm.category} · Event: {printSlipForm.eventDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrintSlipForm(null)}
                className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            {(() => {
              const stu = students.find((s) => s.id === printSlipForm.studentId)
              return (
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Student</span>
                    <strong className="text-slate-900">
                      {stu?.name || printSlipForm.studentName} (
                      {stu ? `${stu.className} · ${stu.section}` : printSlipForm.classLabel})
                    </strong>
                  </div>
                  {printSlipForm.venue && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Venue</span>
                      <strong className="text-slate-900">{printSlipForm.venue}</strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Approved By Guardian</span>
                    <strong className="text-emerald-700">{printSlipForm.signedBy}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Emergency Contact</span>
                    <strong className="font-mono text-slate-900">
                      {printSlipForm.emergencyPhone || stu?.guardianPhone}
                    </strong>
                  </div>
                  {printSlipForm.medicalNote && (
                    <div className="rounded-xl bg-rose-50 p-2.5 text-rose-800">
                      <strong>Medical / Allergy Note:</strong> {printSlipForm.medicalNote}
                    </div>
                  )}
                  <div className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                    {printSlipForm.details}
                  </div>
                  {printSlipForm.verification && (
                    <div className="pt-1">
                      <VerificationSealBadge verification={printSlipForm.verification} />
                    </div>
                  )}
                  <p className="pt-1 text-center font-mono text-[10px] text-slate-400">
                    Record ID: {printSlipForm.id} · Verified {printSlipForm.signedAt}
                  </p>
                </div>
              )
            })()}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300"
              >
                <Icon name="print" size={14} />
                Print Official Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
