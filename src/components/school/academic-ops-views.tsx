'use client'

import React, { useMemo, useRef, useState } from 'react'
import { downloadExcelCsv } from '@/lib/csv-export'
import { computeExamTabulation } from '@/lib/dmhs-exams'
import { Icon } from './icons'
import { useSchool } from './store'
import type { HouseName } from './types'
import { PageShell } from './ui'

interface ParsedCsvRow {
  name: string
  className: string
  section: string
  roll: string
  guardianName: string
  guardianPhone: string
  guardianEmail: string
  house: HouseName
  bloodGroup: string
  busRoute: string
  valid: boolean
  reason?: string
}

const SAMPLE_CSV = `Name,Class,Section,Roll,GuardianName,GuardianPhone,GuardianEmail,House,BloodGroup,Unit
Ayaan Chowdhury,Class 4,Section A,21,Faruk Chowdhury,+8801711882211,faruk.c@mail.com,Emerald,O+,Unit - 1
Nusrat Jahan,Class 5,Section A,22,Mahmudul Hasan,+8801819334455,mahmud.h@mail.com,Sapphire,A+,Unit - 2
Ibrahim Siddiqui,Class 6,Section A,19,Dr. Tariq Siddiqui,+8801911776622,tariq.s@mail.com,Crimson,B+,Unit - 2`

const VALID_HOUSES: HouseName[] = ['Emerald', 'Sapphire', 'Crimson', 'Gold']

function parseCsvText(raw: string): ParsedCsvRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []
  const startIdx = lines[0].toLowerCase().startsWith('name,') ? 1 : 0
  return lines.slice(startIdx).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const [
      name = '',
      className = 'Class 4',
      section = 'Section A',
      roll = '',
      guardianName = '',
      guardianPhone = '',
      guardianEmail = '',
      houseRaw = 'Emerald',
      bloodGroup = 'O+',
      busRoute = 'Unit - 1',
    ] = cols
    const house = (VALID_HOUSES.find((h) => h.toLowerCase() === houseRaw.toLowerCase()) ||
      'Emerald') as HouseName
    const valid = Boolean(name && guardianName && guardianPhone)
    return {
      name,
      className,
      section,
      roll,
      guardianName,
      guardianPhone,
      guardianEmail,
      house,
      bloodGroup,
      busRoute,
      valid,
      reason: valid ? undefined : 'Missing Name, Guardian Name, or Phone',
    }
  })
}

export function AcademicOpsView() {
  const {
    students = [],
    alumni = [],
    examBook,
    bulkImportStudents,
    promoteClassCohort,
  } = useSchool()
  const [subTab, setSubTab] = useState<'import' | 'promote' | 'alumni'>('import')

  // Bulk CSV State
  const [csvText, setCsvText] = useState(SAMPLE_CSV)
  const [importSummary, setImportSummary] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const parsedRows = useMemo(() => parseCsvText(csvText), [csvText])
  const validRows = parsedRows.filter((r) => r.valid)

  // Promotion Wizard State (Exam-Linked!)
  const uniqueClasses = useMemo(
    () => Array.from(new Set(students.map((s) => s.className))).sort(),
    [students],
  )
  const [fromClass, setFromClass] = useState(uniqueClasses[0] || 'Class 5')
  const [toClass, setToClass] = useState('Class 6')
  const [minPassScore, setMinPassScore] = useState(40)
  const [archiveAsAlumni, setArchiveAsAlumni] = useState(false)
  const [selectedExamId, setSelectedExamId] = useState(
    examBook.declaredExams.find((e) => e.status === 'published')?.id ||
      examBook.declaredExams[0]?.id ||
      '',
  )
  const [enforceExamPass, setEnforceExamPass] = useState(true)
  const [overrideIds, setOverrideIds] = useState<string[]>([])
  const [promoting, setPromoting] = useState(false)
  const [promotionSummary, setPromotionSummary] = useState('')

  const examTabByStudent = useMemo(() => {
    const map = new Map<
      string,
      { averagePercent: number; gpa: number; grade: string; passed: boolean }
    >()
    if (!selectedExamId) return map
    const tab = computeExamTabulation(examBook, selectedExamId, 'All', 'All')
    tab.rows.forEach((row) => {
      map.set(row.studentId, {
        averagePercent: row.averagePercent,
        gpa: row.gpa,
        grade: row.grade,
        passed: row.passed,
      })
    })
    return map
  }, [examBook, selectedExamId])

  const cohortStudents = useMemo(
    () => students.filter((s) => s.className === fromClass && s.status !== 'suspended'),
    [students, fromClass],
  )

  const evaluateCohortStudent = (s: (typeof cohortStudents)[number]) => {
    const examRow = examTabByStudent.get(s.id)
    const effectiveAvg = examRow ? examRow.averagePercent : s.averageScore
    const examFailed = enforceExamPass && examRow ? !examRow.passed : false
    const isOverridden = overrideIds.includes(s.id)
    const eligible = isOverridden || (!examFailed && effectiveAvg >= minPassScore)
    return { examRow, effectiveAvg, examFailed, isOverridden, eligible }
  }

  const eligiblePreview = cohortStudents.filter((s) => evaluateCohortStudent(s).eligible)
  const retainedPreview = cohortStudents.filter((s) => !evaluateCohortStudent(s).eligible)

  const handleDownloadTemplate = () => {
    downloadExcelCsv(
      'DMHA-Student-Import-Template.csv',
      [
        'Name',
        'Class',
        'Section',
        'Roll',
        'GuardianName',
        'GuardianPhone',
        'GuardianEmail',
        'House',
        'BloodGroup',
        'Unit',
      ],
      [
        [
          'Ayaan Chowdhury',
          'Class 4',
          'Section A',
          '21',
          'Faruk Chowdhury',
          '+8801711882211',
          'faruk.c@mail.com',
          'Emerald',
          'O+',
          'Unit - 1',
        ],
      ],
    )
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result)
        setImportSummary('')
      }
    }
    reader.readAsText(file)
  }

  const handleCommitImport = () => {
    if (validRows.length === 0) return
    const res = bulkImportStudents(validRows)
    setImportSummary(
      `Imported ${res.importedCount} student(s) and auto-created ${res.createdGuardiansCount} guardian account(s) in SQLite (default login pass: dmha2026).`,
    )
  }

  const handleExecutePromotion = async () => {
    if (cohortStudents.length === 0 || promoting) return
    setPromoting(true)
    const res = await promoteClassCohort({
      fromClass,
      toClass,
      minPassScore,
      archiveAsAlumni,
      examId: selectedExamId || undefined,
      enforceExamPass,
      overrideStudentIds: overrideIds,
    })
    setPromoting(false)
    if (res.ok) {
      setOverrideIds([])
      setPromotionSummary(
        archiveAsAlumni
          ? `Graduated ${res.graduatedCount} student(s) from ${fromClass} to DMHA Alumni Archive (${res.retainedCount} retained${res.verifiedExamTitle ? ` · Verified via ${res.verifiedExamTitle}` : ''}).`
          : `Promoted ${res.promotedCount} student(s) from ${fromClass} → ${toClass} (${res.retainedCount} retained${res.examBlockedCount > 0 ? `, ${res.examBlockedCount} held by Exam fail` : ''}${res.verifiedExamTitle ? ` · Verified via ${res.verifiedExamTitle}` : ''}).`,
      )
    }
  }

  return (
    <PageShell
      eyebrow="Registrar & Annual Operations · Bulk Onboarding"
      title="Bulk CSV Student Importer & Year-End Class Promotion"
      subtitle="Onboard entire classes (Pre-Play – Class 6) from Excel/CSV spreadsheets in seconds and execute annual class promotions or Class 6 Alumni graduations with live dry-run previews."
    >
      {/* Top KPI Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-300">
            Active Enrolled Students
          </p>
          <p className="mt-1.5 text-3xl font-black">{students.length}</p>
          <p className="mt-1 text-[11px] text-slate-300">
            Across {uniqueClasses.length} active classes
          </p>
        </div>
        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
            CSV Rows Ready to Import
          </p>
          <p className="mt-1.5 text-3xl font-black text-emerald-700">{validRows.length}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Auto-provisions Guardian &amp; Student SQLite logins
          </p>
        </div>
        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
            Graduated DMHA Alumni
          </p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">{alumni.length}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Permanent historical transcript archive
          </p>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { id: 'import' as const, label: '1. Bulk Excel / CSV Importer' },
          { id: 'promote' as const, label: '2. End-of-Year Promotion Wizard' },
          { id: 'alumni' as const, label: `3. Alumni Archive (${alumni.length})` },
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

      {/* 1. BULK CSV IMPORTER */}
      {subTab === 'import' && (
        <div className="space-y-5">
          <div className="dmhs-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Upload or Paste Excel / CSV Student Sheet
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Automatically creates student records, links or creates guardian accounts, sets up
                  canteen wallets, and provisions SQLite login credentials.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  <Icon name="download" size={14} />
                  Download CSV Template
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
                >
                  <Icon name="sheet" size={14} />
                  Upload .CSV File
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 font-mono text-[11px] font-semibold text-slate-800 outline-none focus:border-emerald-500"
            />

            {importSummary && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
                ✓ {importSummary}
              </div>
            )}

            {/* Validation Preview Table */}
            <div className="mt-5 overflow-x-auto">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Live Validation Preview ({validRows.length}/{parsedRows.length} valid rows)
                </p>
                <button
                  type="button"
                  disabled={validRows.length === 0}
                  onClick={handleCommitImport}
                  className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-45"
                >
                  Import {validRows.length} Students into SQLite
                </button>
              </div>
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Class &amp; Roll</th>
                    <th className="px-3 py-2">Guardian &amp; Phone</th>
                    <th className="px-3 py-2">House &amp; Bus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((row, idx) => (
                    <tr key={`${row.name}-${idx}`}>
                      <td className="px-3 py-2">
                        {row.valid ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                            READY
                          </span>
                        ) : (
                          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black text-rose-700">
                            {row.reason}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-black text-slate-900">{row.name || '—'}</td>
                      <td className="px-3 py-2 font-semibold text-slate-600">
                        {row.className} · {row.section} (#{row.roll || 'Auto'})
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-600">
                        {row.guardianName} · {row.guardianPhone}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-500">
                        {row.house} · {row.busRoute}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. YEAR-END CLASS PROMOTION WIZARD */}
      {subTab === 'promote' && (
        <div className="dmhs-card p-6">
          <h3 className="text-base font-black text-slate-900">
            End-of-Year Academic Promotion &amp; Graduation Wizard
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Preview which students meet the minimum pass percentage before promoting an entire
            cohort to the next grade (Pre-Play → Class 6) or graduating Class 6 students to Alumni.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-[10px] font-extrabold uppercase text-slate-400">
              Source Class
              <select
                value={fromClass}
                onChange={(e) => {
                  setFromClass(e.target.value)
                  setOverrideIds([])
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900"
              >
                {uniqueClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[10px] font-extrabold uppercase text-slate-400">
              Target Class
              <input
                disabled={archiveAsAlumni}
                value={toClass}
                onChange={(e) => setToClass(e.target.value)}
                placeholder="e.g. Class 6"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900 disabled:opacity-45"
              />
            </label>

            <label className="text-[10px] font-extrabold uppercase text-slate-400">
              Verify via Exam Results
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900"
              >
                <option value="">Student Overall Average Only</option>
                {examBook.declaredExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} ({ex.status})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[10px] font-extrabold uppercase text-slate-400">
              Min Pass Average (%)
              <input
                type="number"
                min={0}
                max={100}
                value={minPassScore}
                onChange={(e) => setMinPassScore(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-900"
              />
            </label>

            <div className="flex flex-col justify-end gap-1.5 pb-1">
              <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={enforceExamPass}
                  onChange={(e) => setEnforceExamPass(e.target.checked)}
                  className="size-3.5 accent-emerald-600"
                />
                Block Exam Fails
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={archiveAsAlumni}
                  onChange={(e) => setArchiveAsAlumni(e.target.checked)}
                  className="size-3.5 accent-emerald-600"
                />
                Graduate to Alumni
              </label>
            </div>
          </div>

          {promotionSummary && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
              ✓ {promotionSummary}
            </div>
          )}

          {/* Dry-Run Preview */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black text-slate-900">
                Live Exam-Verified Preview for {fromClass}: {eligiblePreview.length} Eligible ·{' '}
                {retainedPreview.length} Retained
              </p>
              <button
                type="button"
                disabled={eligiblePreview.length === 0 || promoting}
                onClick={() => void handleExecutePromotion()}
                className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-black text-emerald-300 hover:bg-slate-800 disabled:opacity-45"
              >
                {promoting
                  ? 'Saving Promotion to SQLite...'
                  : archiveAsAlumni
                    ? `Graduate ${eligiblePreview.length} to Alumni`
                    : `Promote ${eligiblePreview.length} to ${toClass}`}
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {cohortStudents.map((s) => {
                const ev = evaluateCohortStudent(s)
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 text-xs shadow-2xs"
                  >
                    <div className="min-w-0">
                      <p className="font-black text-slate-900">{s.name}</p>
                      <p className="text-[11px] text-slate-500">
                        Roll #{s.roll} ·{' '}
                        {ev.examRow ? (
                          <span
                            className={
                              ev.examRow.passed
                                ? 'font-bold text-emerald-700'
                                : 'font-bold text-rose-600'
                            }
                          >
                            Exam GPA {ev.examRow.gpa.toFixed(2)} ({ev.examRow.grade} ·{' '}
                            {ev.examRow.averagePercent}%)
                          </span>
                        ) : (
                          <span>Avg {s.averageScore}%</span>
                        )}{' '}
                        · Attendance {s.attendanceRate}%
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {(!ev.eligible || ev.isOverridden) && (
                        <button
                          type="button"
                          onClick={() =>
                            setOverrideIds((prev) =>
                              prev.includes(s.id)
                                ? prev.filter((id) => id !== s.id)
                                : [...prev, s.id],
                            )
                          }
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            ev.isOverridden
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {ev.isOverridden ? 'Override ✓' : 'Override'}
                        </button>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                          ev.eligible
                            ? 'bg-emerald-100 text-emerald-800'
                            : ev.examFailed
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ev.eligible
                          ? archiveAsAlumni
                            ? 'GRADUATE'
                            : `→ ${toClass}`
                          : ev.examFailed
                            ? 'EXAM FAIL'
                            : 'RETAIN'}
                      </span>
                    </div>
                  </div>
                )
              })}
              {cohortStudents.length === 0 && (
                <p className="text-xs text-slate-400">No active students in {fromClass}.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. ALUMNI ARCHIVE */}
      {subTab === 'alumni' && (
        <div className="dmhs-card p-6">
          <h3 className="text-base font-black text-slate-900">
            DMHA Graduated Alumni Archive ({alumni.length})
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
                  <th className="px-3 py-2.5">Graduate Name</th>
                  <th className="px-3 py-2.5">Final Class &amp; Roll</th>
                  <th className="px-3 py-2.5">Batch</th>
                  <th className="px-3 py-2.5">Final Average</th>
                  <th className="px-3 py-2.5">Guardian</th>
                  <th className="px-3 py-2.5">Archived On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alumni.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2.5 font-black text-slate-900">{a.studentName}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-600">
                      {a.graduatedClass} (#{a.roll})
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                        Class of {a.graduationYear}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-black text-emerald-700">{a.finalAverage}%</td>
                    <td className="px-3 py-2.5 text-slate-600">{a.guardianName}</td>
                    <td className="px-3 py-2.5 text-slate-400">{a.archivedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  )
}
