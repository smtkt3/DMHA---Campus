'use client'

import React, { useState } from 'react'
import { downloadExcelCsv } from '@/lib/csv-export'
import { Icon } from './icons'
import { useSchool } from './store'
import type { AdmissionApplication, AdmissionStage } from './types'
import { PageShell } from './ui'

const STAGES: { id: AdmissionStage; label: string; color: string }[] = [
  { id: 'applied', label: 'Applied', color: 'bg-slate-100 text-slate-700' },
  { id: 'test_scheduled', label: 'Test Scheduled', color: 'bg-sky-50 text-sky-700' },
  { id: 'interview', label: 'Interview', color: 'bg-amber-50 text-amber-700' },
  { id: 'approved', label: 'Approved', color: 'bg-emerald-50 text-emerald-700' },
  { id: 'enrolled', label: 'Enrolled', color: 'bg-[#0f172a] text-emerald-300' },
  { id: 'waitlisted', label: 'Waitlisted', color: 'bg-rose-50 text-rose-700' },
]

export function AdmissionsPipelineView({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const {
    admissions,
    campusUnits,
    submitAdmissionApplication,
    updateAdmissionStage,
    updateAdmissionTestInfo,
    markAdmissionFeePaid,
    enrollApplicant,
  } = useSchool()

  const [stageFilter, setStageFilter] = useState<'all' | AdmissionStage>('all')
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Add Applicant State
  const [applicantName, setApplicantName] = useState('')
  const [applyingClass, setApplyingClass] = useState('Pre-Play')
  const [targetSection, setTargetSection] = useState('Section A')
  const [previousSchool, setPreviousSchool] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianRelation, setGuardianRelation] = useState('Father')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [bloodGroup, setBloodGroup] = useState('O+')
  const [busRoute, setBusRoute] = useState('Unit - 1')
  const [notes, setNotes] = useState('')

  const selectedApp = admissions.find((a) => a.id === selectedAppId) || null

  const filtered = admissions.filter((a) => stageFilter === 'all' || a.stage === stageFilter)
  const totalFeeCollected = admissions
    .filter((a) => a.admissionFeePaid)
    .reduce((sum, a) => sum + a.admissionFeeAmount, 0)

  const handleAddApplicant = (e: React.FormEvent) => {
    e.preventDefault()
    if (!applicantName.trim() || !guardianName.trim() || !guardianPhone.trim()) return
    submitAdmissionApplication({
      applicantName,
      applyingClass,
      targetSection,
      previousSchool,
      guardianName,
      guardianRelation,
      guardianPhone,
      guardianEmail,
      bloodGroup,
      busRoute,
      notes,
    })
    setShowAddModal(false)
    setApplicantName('')
    setPreviousSchool('')
    setGuardianName('')
    setGuardianPhone('')
    setGuardianEmail('')
    setNotes('')
  }

  return (
    <PageShell
      eyebrow="Enrollment CRM · 2027 Admissions (Pre-Play – Class 6)"
      title="Admissions Pipeline & 1-Click Enrollment"
      subtitle="Track prospective students from online application → entrance test → interview → automatic Student, Guardian, QR ID & Accounts invoice creation."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadExcelCsv(
                `DMHA-Admissions-2027-${new Date().toISOString().slice(0, 10)}.csv`,
                [
                  'Application Code',
                  'Applicant Name',
                  'Applying Class',
                  'Section',
                  'Stage',
                  'Test Score (%)',
                  'Guardian Name',
                  'Phone',
                  'Email',
                  'Admission Fee (BDT)',
                  'Fee Paid',
                  'Applied At',
                ],
                admissions.map((a) => [
                  a.applicationCode,
                  a.applicantName,
                  a.applyingClass,
                  a.targetSection,
                  a.stage,
                  a.testScore ?? '',
                  a.guardianName,
                  a.guardianPhone,
                  a.guardianEmail,
                  a.admissionFeeAmount,
                  a.admissionFeePaid ? 'YES' : 'NO',
                  a.appliedAt,
                ]),
              )
            }
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 shadow-xs transition hover:border-emerald-400 hover:bg-emerald-50/50"
          >
            <Icon name="sheet" size={15} className="text-emerald-600" />
            Export Excel CSV
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-slate-800"
          >
            <Icon name="userplus" size={15} />
            New Application
          </button>
        </div>
      }
    >
      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-card p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Total Applicants
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">{admissions.length}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Synced with SQLite CRM</p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Ready to Enroll
          </p>
          <p className="mt-2 text-3xl font-black text-emerald-600">
            {admissions.filter((a) => a.stage === 'approved').length}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Approved by Principal Shahid</p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Enrolled Students
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {admissions.filter((a) => a.stage === 'enrolled').length}
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-600">
            Auto-created in People & QR ID
          </p>
        </div>

        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
            Admission Fee Revenue
          </p>
          <p className="mt-2 text-3xl font-black">৳{totalFeeCollected.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-400">Auto-posted to Accounts Ledger</p>
        </div>
      </div>

      {/* Stage Filter Pills */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStageFilter('all')}
          className={`rounded-full px-4 py-1.5 text-xs font-extrabold transition ${
            stageFilter === 'all'
              ? 'bg-[#0f172a] text-white'
              : 'border border-slate-200 bg-white text-slate-600'
          }`}
        >
          All Stages ({admissions.length})
        </button>
        {STAGES.map((st) => {
          const count = admissions.filter((a) => a.stage === st.id).length
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => setStageFilter(st.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                stageFilter === st.id
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Applicants List */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {filtered.map((app) => {
          const stageMeta = STAGES.find((s) => s.id === app.stage) || STAGES[0]
          return (
            <div key={app.id} className="dmhs-card flex flex-col justify-between p-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-700">
                    {app.applicationCode}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${stageMeta.color}`}
                  >
                    {stageMeta.label}
                  </span>
                </div>

                <div className="mt-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{app.applicantName}</h3>
                    <p className="text-xs font-semibold text-slate-500">
                      Applying for <strong>{app.applyingClass}</strong>
                      {app.targetSection ? ` (${app.targetSection})` : ''}
                      {app.busRoute ? ` · ${app.busRoute}` : ' · Unit - 1'}
                      {app.previousSchool ? ` · Prev: ${app.previousSchool}` : ''}
                    </p>
                  </div>
                  {typeof app.testScore === 'number' && (
                    <div className="rounded-2xl bg-emerald-50 px-3 py-1.5 text-right">
                      <p className="text-[9px] font-extrabold uppercase text-emerald-700">
                        Test Score
                      </p>
                      <p className="text-base font-black text-emerald-800">{app.testScore}%</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-xs">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Guardian</p>
                    <p className="font-bold text-slate-800">
                      {app.guardianName}
                      {app.guardianRelation ? ` (${app.guardianRelation})` : ''}
                    </p>
                    <p className="text-[11px] text-slate-500">{app.guardianPhone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Admission Fee</p>
                    <p className="font-bold text-slate-800">
                      ৳{app.admissionFeeAmount.toLocaleString()}
                    </p>
                    <p
                      className={`text-[11px] font-extrabold ${
                        app.admissionFeePaid ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {app.admissionFeePaid
                        ? `Paid & Auto-Posted${app.admissionVoucherNo ? ` (${app.admissionVoucherNo})` : ' to Ledger'}`
                        : 'Payment Pending'}
                    </p>
                  </div>
                </div>

                {app.stage === 'enrolled' && (app.enrolledStudentLogin || app.enrolledGuardianLogin) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] font-bold text-emerald-900">
                    <span>🔑 Provisioned Logins (pass: dmha2026):</span>
                    {app.enrolledStudentLogin && (
                      <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[10px] font-black text-slate-900 ring-1 ring-emerald-200">
                        Student: {app.enrolledStudentLogin}
                      </span>
                    )}
                    {app.enrolledGuardianLogin && (
                      <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[10px] font-black text-slate-900 ring-1 ring-emerald-200">
                        Guardian: {app.enrolledGuardianLogin}
                      </span>
                    )}
                  </div>
                )}

                <p className="mt-3 text-xs leading-relaxed text-slate-600">{app.notes}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAppId(app.id)}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    Manage / Score
                  </button>
                  {!app.admissionFeePaid && (
                    <button
                      type="button"
                      onClick={() => markAdmissionFeePaid(app.id)}
                      className="rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-extrabold text-amber-800 hover:bg-amber-100"
                    >
                      Mark Fee Paid
                    </button>
                  )}
                </div>

                {app.stage !== 'enrolled' ? (
                  <button
                    type="button"
                    onClick={() => enrollApplicant(app.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-700"
                  >
                    <Icon name="check" size={14} />
                    1-Click Enroll
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate?.('qrid')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300"
                  >
                    <Icon name="qr" size={14} />
                    View Smart ID Card
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Applicant Management Modal */}
      {selectedApp && (
        <ApplicantDetailModal
          app={selectedApp}
          onClose={() => setSelectedAppId(null)}
          onStageChange={(st) => updateAdmissionStage(selectedApp.id, st)}
          onSaveEvaluation={(payload) => {
            updateAdmissionTestInfo(selectedApp.id, payload)
            setSelectedAppId(null)
          }}
          onEnroll={() => {
            enrollApplicant(selectedApp.id)
            setSelectedAppId(null)
          }}
        />
      )}

      {/* Add New Application Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setShowAddModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-600">
                  DMHA Admissions Office
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">Register New Applicant</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleAddApplicant} className="mt-5 space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Applicant Name *
                  </label>
                  <input
                    required
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Previous School
                  </label>
                  <input
                    value={previousSchool}
                    onChange={(e) => setPreviousSchool(e.target.value)}
                    placeholder="School name"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Applying Class
                  </label>
                  <select
                    value={applyingClass}
                    onChange={(e) => setApplyingClass(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold"
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
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">Section</label>
                  <select
                    value={targetSection}
                    onChange={(e) => setTargetSection(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold"
                  >
                    <option>Section A</option>
                    <option>Section B</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Guardian Name *
                  </label>
                  <input
                    required
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="Guardian full name"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Relationship
                  </label>
                  <select
                    value={guardianRelation}
                    onChange={(e) => setGuardianRelation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold"
                  >
                    <option>Father</option>
                    <option>Mother</option>
                    <option>Legal Guardian</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Guardian Phone *
                  </label>
                  <input
                    required
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="+880 17XX-XXXXXX"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium outline-none"
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
                    placeholder="guardian@mail.com"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Blood Group
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Campus Unit
                  </label>
                  <select
                    value={busRoute}
                    onChange={(e) => setBusRoute(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold outline-none"
                  >
                    {campusUnits.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-black text-white"
                >
                  Add to Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  )
}

function ApplicantDetailModal({
  app,
  onClose,
  onStageChange,
  onSaveEvaluation,
  onEnroll,
}: {
  app: AdmissionApplication
  onClose: () => void
  onStageChange: (stage: AdmissionStage) => void
  onSaveEvaluation: (payload: { testDate?: string; testScore?: number; notes?: string }) => void
  onEnroll: () => void
}) {
  const [testDate, setTestDate] = useState(app.testDate || '25 Nov 2026 · 10:00 AM')
  const [testScore, setTestScore] = useState(
    typeof app.testScore === 'number' ? String(app.testScore) : '',
  )
  const [notes, setNotes] = useState(app.notes)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="font-mono text-xs font-bold text-emerald-600">{app.applicationCode}</p>
            <h3 className="mt-0.5 text-xl font-black text-slate-900">{app.applicantName}</h3>
            <p className="text-xs font-semibold text-slate-500">
              {app.applyingClass} ({app.targetSection}) · Guardian: {app.guardianName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Pipeline Stage
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STAGES.filter((s) => s.id !== 'enrolled').map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={app.stage === 'enrolled'}
                onClick={() => onStageChange(s.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                  app.stage === s.id
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">
              Entrance Test Slot
            </label>
            <input
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">
              Test Score (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={testScore}
              onChange={(e) => setTestScore(e.target.value)}
              placeholder="e.g., 88"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-[11px] font-bold text-slate-600">
            Interview & Admission Remarks
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium outline-none"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          {app.stage !== 'enrolled' ? (
            <button
              type="button"
              onClick={onEnroll}
              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white"
            >
              Enroll Student Now
            </button>
          ) : (
            <span className="text-xs font-extrabold text-emerald-700">Already Enrolled</span>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                onSaveEvaluation({
                  testDate,
                  testScore: testScore !== '' ? Number(testScore) : undefined,
                  notes,
                })
              }
              className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-extrabold text-white"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
