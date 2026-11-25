'use client'

import React, { useEffect, useState } from 'react'
import { Icon } from './icons'
import { useSchool } from './store'
import type { JobVacancyItem, Role, SchoolWebsiteConfig } from './types'
import { Brand } from './ui'

const DEMO_ACCOUNTS: {
  role: Role
  linkedEntityId?: string
  label: string
  name: string
  email: string
  code: string
  badge: string
}[] = [
  {
    role: 'admin',
    linkedEntityId: 'dev-master',
    label: 'Developer Master',
    name: 'DMHA Developer',
    email: 'dev@dmha.edu',
    code: 'DEV-001',
    badge: 'Access All Accounts',
  },
  {
    role: 'admin',
    linkedEntityId: 'admin-shahid',
    label: 'Principal / Admin',
    name: 'Shahid',
    email: 'shahid@dmha.edu',
    code: 'ADM-001',
    badge: 'Full Campus Control',
  },
  {
    role: 'guardian',
    label: 'Guardian Portal',
    name: 'Tariq Rahman',
    email: 'tariq@dmha.edu',
    code: 'GRD-001',
    badge: 'Guardian-Only View',
  },
  {
    role: 'teacher',
    label: 'Teacher Portal',
    name: 'Nadia Rahman',
    email: 'nadia@dmha.edu',
    code: 'TCH-001',
    badge: 'Teacher-Only View',
  },
  {
    role: 'student',
    label: 'Student Portal',
    name: 'Araf Rahman',
    email: 'araf@dmha.edu',
    code: 'STU-14',
    badge: 'Class 6 · Roll #14',
  },
  {
    role: 'staff',
    linkedEntityId: 'stf-rafiqul',
    label: 'Accountant Role',
    name: 'Rafiqul Islam',
    email: 'accountant@dmha.edu',
    code: 'STF-ACC',
    badge: 'Accounts & Payroll',
  },
  {
    role: 'staff',
    linkedEntityId: 'stf-salma',
    label: 'Canteen Role',
    name: 'Salma Akter',
    email: 'canteen@dmha.edu',
    code: 'STF-CNT',
    badge: 'Menu & QR POS',
  },
  {
    role: 'staff',
    linkedEntityId: 'stf-kamal',
    label: 'Gate Security',
    name: 'Kamal Hossain',
    email: 'security@dmha.edu',
    code: 'STF-SEC',
    badge: 'Pickup & Gate QR',
  },
]

export function LoginPortal() {
  const {
    loginWithCredentials,
    loginDemoRole,
    demoLoginAllowed,
    dbStatus,
    dbStats,
  } = useSchool()

  const [identifier, setIdentifier] = useState('shahid@dmha.edu')
  const [password, setPassword] = useState('dmha2026')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showAdmissionModal, setShowAdmissionModal] = useState(false)
  const [submittedCode, setSubmittedCode] = useState('')
  const [admissionSubmitting, setAdmissionSubmitting] = useState(false)
  const [admissionError, setAdmissionError] = useState('')

  // Live Website CMS + Public Careers Portal state
  const [cmsConfig, setCmsConfig] = useState<SchoolWebsiteConfig | null>(null)
  const [openVacancies, setOpenVacancies] = useState<JobVacancyItem[]>([])
  const [showCareerModal, setShowCareerModal] = useState(false)
  const [careerVacancyId, setCareerVacancyId] = useState('')
  const [careerName, setCareerName] = useState('')
  const [careerEmail, setCareerEmail] = useState('')
  const [careerPhone, setCareerPhone] = useState('')
  const [careerQual, setCareerQual] = useState('')
  const [careerExp, setCareerExp] = useState('2 Years')
  const [careerSalary, setCareerSalary] = useState('Negotiable')
  const [careerNote, setCareerNote] = useState('')
  const [careerDone, setCareerDone] = useState('')
  const [careerError, setCareerError] = useState('')
  const [careerSubmitting, setCareerSubmitting] = useState(false)

  useEffect(() => {
    fetch('/dmhs-api/website/public', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.ok && j.config) setCmsConfig(j.config as SchoolWebsiteConfig)
      })
      .catch(() => {})
    fetch('/dmhs-api/careers/public', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.ok && Array.isArray(j.vacancies)) {
          setOpenVacancies(j.vacancies as JobVacancyItem[])
          if (j.vacancies[0]?.id) setCareerVacancyId(j.vacancies[0].id)
        }
      })
      .catch(() => {})
  }, [])

  const handleCareerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCareerError('')
    setCareerSubmitting(true)
    try {
      const res = await fetch('/dmhs-api/careers/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacancyId: careerVacancyId,
          applicantName: careerName,
          email: careerEmail,
          phone: careerPhone,
          qualification: careerQual,
          experienceYears: careerExp,
          expectedSalary: careerSalary,
          coverNote: careerNote,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; vacancyTitle?: string; error?: string }
      if (!res.ok || !json.ok) {
        setCareerError(json.error || 'Could not submit application.')
        return
      }
      setCareerDone(`Application received for ${json.vacancyTitle || 'DMHA Careers'}!`)
      setCareerName('')
      setCareerEmail('')
      setCareerPhone('')
      setCareerQual('')
      setCareerNote('')
    } catch {
      setCareerError('Unable to reach DMHA Careers server.')
    } finally {
      setCareerSubmitting(false)
    }
  }

  // Public Admission Form fields
  const [applicantName, setApplicantName] = useState('')
  const [applyingClass, setApplyingClass] = useState('Pre-Play')
  const [previousSchool, setPreviousSchool] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianRelation, setGuardianRelation] = useState('Father')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [bloodGroup, setBloodGroup] = useState('O+')
  const [preferredUnit, setPreferredUnit] = useState('Unit - 1')
  const [notes, setNotes] = useState('')

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const res = await loginWithCredentials(identifier, password)
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error || 'Sign-in failed')
    }
  }

  const handleQuickDemo = async (role: Role, linkedEntityId?: string) => {
    setError('')
    setSubmitting(true)
    const res = await loginDemoRole(role, linkedEntityId)
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error || 'Quick access failed')
    }
  }

  const handlePublicApply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!applicantName.trim() || !guardianName.trim() || !guardianPhone.trim()) return
    setAdmissionError('')
    setAdmissionSubmitting(true)
    try {
      const res = await fetch('/dmhs-api/admissions/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName,
          applyingClass,
          targetSection: 'Section A',
          previousSchool,
          guardianName,
          guardianRelation,
          guardianPhone,
          guardianEmail,
          bloodGroup,
          busRoute: preferredUnit,
          notes: `${guardianRelation} · Blood ${bloodGroup} · ${preferredUnit}${notes ? ` · ${notes}` : ''}`,
        }),
      })
      const json = (await res.json()) as {
        ok: boolean
        applicationCode?: string
        error?: string
      }
      if (!res.ok || !json.ok || !json.applicationCode) {
        setAdmissionError(json.error || 'Could not submit application right now.')
        return
      }
      setSubmittedCode(json.applicationCode)
      setApplicantName('')
      setPreviousSchool('')
      setGuardianName('')
      setGuardianPhone('')
      setGuardianEmail('')
      setNotes('')
    } catch {
      setAdmissionError('Unable to reach DMHA Admissions Server.')
    } finally {
      setAdmissionSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1222] text-slate-900">
      <div className="grid min-h-screen w-full lg:grid-cols-[1.08fr_1fr]">
        {/* Left Institutional Showcase Panel */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#132238] to-[#0b1325] p-8 text-white sm:p-12 lg:p-14">
          <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 size-80 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <Brand />
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-bold text-emerald-300">
              <span
                className={`size-2 rounded-full ${
                  dbStatus === 'synced'
                    ? 'bg-emerald-400'
                    : dbStatus === 'offline'
                      ? 'bg-amber-400'
                      : 'animate-pulse bg-sky-400'
                }`}
              />
              {dbStatus === 'synced'
                ? 'DMHA Secure Portal Online'
                : 'Connecting to DMHA Server...'}
            </div>
          </div>

          <div className="relative z-10 my-10 max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.16em] text-emerald-300">
              <Icon name="spark" size={13} />
              Academic Year 2026 · Unified Campus OS
            </span>
            <h1 className="mt-5 text-3xl font-black leading-[1.12] tracking-[-.03em] text-white sm:text-5xl">
              Welcome to <span className="text-emerald-400">DMHA</span> Smart Learning App.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
              Real-time guardian tracking, timed online quizzes, scanned exam sheet reviews,
              smart QR campus IDs, full school accounting, and admissions — all backed by a live
              SQLite server database.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: 'exam' as const,
                  title: 'Online Quizzes (CBT)',
                  desc: 'Timed tests with instant grading & explanations',
                },
                {
                  icon: 'qr' as const,
                  title: 'Smart QR Campus IDs',
                  desc: 'Unified Gate, Canteen & Library digital pass',
                },
                {
                  icon: 'userplus' as const,
                  title: 'Admissions Pipeline',
                  desc: 'Apply online & enroll into live classes in 1 click',
                },
                {
                  icon: 'database' as const,
                  title: 'Real SQLite Server DB',
                  desc: 'Encrypted scrypt auth & persistent server storage',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                      <Icon name={item.icon} size={16} />
                    </span>
                    <p className="text-xs font-extrabold text-white">{item.title}</p>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Public Admissions & Careers Banner (Live Website CMS) */}
          <div className="relative z-10 space-y-2.5">
            {cmsConfig?.announcementTicker && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3.5 py-2 text-[11px] font-semibold text-amber-200">
                ✦ {cmsConfig.announcementTicker}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
              <div>
                <p className="text-xs font-extrabold text-emerald-300">
                  {cmsConfig?.admissionsBannerText || '2027 Admissions Open (Pre-Play – Class 6)'}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-300">
                  Submit an online admission form or apply for open teaching vacancies at DMHA.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedCode('')
                    setShowAdmissionModal(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-300"
                >
                  <Icon name="userplus" size={14} />
                  Apply Online
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCareerDone('')
                    setCareerError('')
                    setShowCareerModal(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-white/20"
                >
                  Careers ({openVacancies.length})
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Right Sign-In Form Panel */}
        <section className="flex flex-col justify-center bg-[#f8fafc] p-6 sm:p-12 lg:p-14">
          <div className="mx-auto w-full max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 shadow-2xs">
              <Icon name="lock" size={13} className="text-emerald-600" />
              Secure Portal Sign-In
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-[-.02em] text-slate-900 sm:text-3xl">
              Sign in to DMHA
            </h2>
            <p className="mt-1.5 text-xs font-medium text-slate-500">
              Use your DMHA email or ID code (e.g., <code className="font-bold text-slate-700">ADM-001</code>) and password.
            </p>

            <form onSubmit={handleSignIn} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Email or DMHA ID Code
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="shahid@dmha.edu or ADM-001"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-2xs outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Demo pass: <strong className="text-slate-600">dmha2026</strong>
                  </span>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-2xs outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                  <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f172a] px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Icon name="key" size={16} />
                {submitting ? 'Verifying Credentials...' : 'Sign In to Portal'}
              </button>
            </form>

            {/* One-Click Demo Portal Accounts (Disabled automatically in Production unless DMHS_ALLOW_DEMO_LOGIN=true) */}
            {demoLoginAllowed && (
              <div className="mt-8">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">
                    1-Click Role Access (Verified Server Session)
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={`${acc.role}-${acc.code}`}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleQuickDemo(acc.role, acc.linkedEntityId)}
                      className="group rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-2xs transition hover:border-emerald-400 hover:bg-emerald-50/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                          {acc.label}
                        </span>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                          {acc.code}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-black text-slate-900 group-hover:text-emerald-950">
                        {acc.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
                        {acc.email}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-6 text-center text-[11px] font-semibold text-slate-400">
              One unified DMHA app — automatically loads only your role’s private workspace upon sign-in.
            </p>
          </div>
        </section>
      </div>

      {/* Public Online Admission Modal */}
      {showAdmissionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
          onClick={() => setShowAdmissionModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-600">
                  DMHA · Online Admissions 2027 (Pre-Play – Class 6)
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">
                  Submit Admission Application
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdmissionModal(false)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {submittedCode ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Icon name="check" size={28} />
                </div>
                <h4 className="mt-4 text-xl font-black text-slate-900">
                  Application Received!
                </h4>
                <p className="mt-2 text-sm text-slate-600">
                  Tracking Code:{' '}
                  <strong className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-slate-900">
                    {submittedCode}
                  </strong>
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Saved directly to DMHA SQLite Database. Sign in as Principal Shahid (Admin) to
                  review, schedule the entrance test, and enroll in 1 click.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAdmissionModal(false)}
                    className="rounded-full bg-slate-100 px-5 py-2.5 text-xs font-extrabold text-slate-700"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setShowAdmissionModal(false)
                      await handleQuickDemo('admin')
                    }}
                    className="rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-white"
                  >
                    Open in Admin Pipeline
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePublicApply} className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Student Full Name *
                    </label>
                    <input
                      required
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="e.g., Ayaan Mahmood"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Applying For Class *
                    </label>
                    <select
                      value={applyingClass}
                      onChange={(e) => setApplyingClass(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
                    >
                      {[
                        'Pre-Play',
                        'Playgroup',
                        'Nursery',
                        'KG-1',
                        'KG-2',
                        'Class 1',
                        'Class 2',
                        'Class 3',
                        'Class 4',
                        'Class 5',
                        'Class 6',
                      ].map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Previous School
                    </label>
                    <input
                      value={previousSchool}
                      onChange={(e) => setPreviousSchool(e.target.value)}
                      placeholder="e.g., Scholastica / Sunbeams"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Blood Group
                    </label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Guardian Name *
                    </label>
                    <input
                      required
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Parent / Guardian full name"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Relationship
                    </label>
                    <select
                      value={guardianRelation}
                      onChange={(e) => setGuardianRelation(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Legal Guardian">Legal Guardian</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Guardian Phone *
                    </label>
                    <input
                      required
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      placeholder="+880 17XX-XXXXXX"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Guardian Email
                    </label>
                    <input
                      type="email"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      placeholder="parent@email.com"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Preferred Campus Unit
                    </label>
                    <select
                      value={preferredUnit}
                      onChange={(e) => setPreferredUnit(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
                    >
                      <option value="Unit - 1">Unit - 1 (Early Years &amp; Primary Wing)</option>
                      <option value="Unit - 2">Unit - 2 (Class 1–6 Academic Wing)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Academic / Special Notes
                    </label>
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional sibling at DMHA, medical or transport note..."
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {admissionError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
                    {admissionError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdmissionModal(false)}
                    className="rounded-full bg-slate-100 px-4 py-2.5 text-xs font-extrabold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={admissionSubmitting}
                    className="rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {admissionSubmitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Public Careers / Job Application Modal */}
      {showCareerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          onClick={() => setShowCareerModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-700">
                  DMHA Careers · Teaching &amp; Staff Recruitment
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">Apply for a Position</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCareerModal(false)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {careerDone ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <p className="text-sm font-black text-emerald-900">{careerDone}</p>
                <p className="mt-1 text-xs text-emerald-700">
                  Your application has been routed directly into Principal Shahid&apos;s Job Applications CRM.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCareerModal(false)}
                  className="mt-4 rounded-full bg-[#0f172a] px-5 py-2 text-xs font-black text-emerald-300"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCareerSubmit} className="mt-5 space-y-3">
                <select
                  value={careerVacancyId}
                  onChange={(e) => setCareerVacancyId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold"
                >
                  {openVacancies.length > 0 ? (
                    openVacancies.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({v.campusUnit})
                      </option>
                    ))
                  ) : (
                    <option value="general">General Teaching / Campus Staff Application</option>
                  )}
                </select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={careerName}
                    onChange={(e) => setCareerName(e.target.value)}
                    placeholder="Full Name *"
                    required
                    className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold"
                  />
                  <input
                    value={careerPhone}
                    onChange={(e) => setCareerPhone(e.target.value)}
                    placeholder="Mobile Number *"
                    required
                    className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold"
                  />
                </div>
                <input
                  type="email"
                  value={careerEmail}
                  onChange={(e) => setCareerEmail(e.target.value)}
                  placeholder="Email Address *"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold"
                />
                <input
                  value={careerQual}
                  onChange={(e) => setCareerQual(e.target.value)}
                  placeholder="Highest Academic Qualification (e.g., M.Sc / B.A. Hons) *"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={careerExp}
                    onChange={(e) => setCareerExp(e.target.value)}
                    placeholder="Experience (e.g., 3 Years)"
                    className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold"
                  />
                  <input
                    value={careerSalary}
                    onChange={(e) => setCareerSalary(e.target.value)}
                    placeholder="Expected Salary (BDT)"
                    className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold"
                  />
                </div>
                <textarea
                  value={careerNote}
                  onChange={(e) => setCareerNote(e.target.value)}
                  rows={2}
                  placeholder="Short teaching experience / cover note..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold"
                />
                {careerError && (
                  <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                    {careerError}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCareerModal(false)}
                    className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={careerSubmitting}
                    className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {careerSubmitting ? 'Submitting...' : 'Submit Job Application'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
