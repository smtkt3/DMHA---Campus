'use client'

import React, { useMemo, useState } from 'react'
import { downloadExcelCsv } from '@/lib/csv-export'
import { evaluateGrade } from '@/lib/dmhs-exams'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { RealQrCode } from './real-qr'
import { useSchool } from './store'
import type { ExamGradeRule, IssuedDocumentLog } from './types'
import { PageShell } from './ui'

function VerificationQrSvg({ code, size = 84 }: { code: string; size?: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-1">
      <RealQrCode value={code} size={size} label={`Official Verification QR ${code}`} />
    </div>
  )
}

function scoreToGpa(
  score: number,
  scale?: ExamGradeRule[],
  passPercent = 33,
): { grade: string; point: number; passed: boolean } {
  const res = evaluateGrade(score, scale, passPercent)
  return { grade: res.grade, point: res.gpa, passed: res.passed }
}

export function OfficialDocumentsView({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void
} = {}) {
  const {
    role,
    students = [],
    selectedChildId,
    activeStudentId,
    fees = [],
    examSchedules = [],
    examBook,
    issuedDocuments = [],
    issueOfficialDocument,
    getSemesterEvaluationStatus,
    hasStaffPermission,
    notify,
  } = useSchool()

  const canSelectAnyStudent =
    role === 'admin' || role === 'teacher' || hasStaffPermission('documents')
  const scopedStudentId =
    role === 'guardian'
      ? selectedChildId
      : role === 'student'
        ? activeStudentId
        : students[0]?.id || ''

  const [pickedStudentId, setPickedStudentId] = useState(scopedStudentId)
  const effectiveStudentId = canSelectAnyStudent ? pickedStudentId || students[0]?.id : scopedStudentId
  const student = students.find((s) => s.id === effectiveStudentId) || students[0]

  // Privacy: Guardians & Students only see their own student's issued documents registry
  const scopedIssuedDocuments = canSelectAnyStudent
    ? issuedDocuments
    : issuedDocuments.filter((d) => d.studentId === student?.id)

  const [subTab, setSubTab] = useState<'report' | 'merit' | 'admit' | 'certificate' | 'verify'>('report')
  const [selectedExamSource, setSelectedExamSource] = useState<string>('gradebook')
  const [meritClassFilter, setMeritClassFilter] = useState<string>('All')
  const [bulkReportOpen, setBulkReportOpen] = useState(false)
  const [termName, setTermName] = useState('Term Final Examination 2026')
  const [certType, setCertType] = useState<
    'Transfer Certificate' | 'Bonafide Certificate' | 'Character Certificate'
  >('Bonafide Certificate')
  const [certNotes, setCertNotes] = useState(
    'Maintained exemplary academic discipline, punctual attendance, and active participation in DMHA House activities.',
  )
  const [adminFeeOverride, setAdminFeeOverride] = useState(false)
  const [adminEvalOverride, setAdminEvalOverride] = useState(false)
  const [activeVerifyCode, setActiveVerifyCode] = useState(
    scopedIssuedDocuments[0]?.verifyCode || 'DMHA-DOC-2026-8814',
  )
  const [verifyInput, setVerifyInput] = useState('')
  const [verifyResult, setVerifyResult] = useState<
    { status: 'idle' } | { status: 'valid'; doc: IssuedDocumentLog } | { status: 'invalid' }
  >({ status: 'idle' })

  if (!student) {
    return (
      <PageShell
        eyebrow="DMHA Official Registrar"
        title="Printable Report Cards, Admit Cards & Certificates"
        subtitle="No student records available yet."
      >
        <div className="dmhs-card p-6 text-sm text-slate-500">Add a student first to generate official documents.</div>
      </PageShell>
    )
  }

  const studentFees = fees.filter((f) => f.studentId === student.id)
  const unpaidFees = studentFees.filter((f) => f.status !== 'paid')
  const unpaidTotal = unpaidFees.reduce((sum, f) => sum + f.amount, 0)
  const isFeeCleared = unpaidTotal === 0 || (role === 'admin' && adminFeeOverride)

  const evalStatus = getSemesterEvaluationStatus(student.id)
  const isEvaluationCleared = evalStatus.isComplete || (role === 'admin' && adminEvalOverride)
  const canDownloadAdmitCard = isFeeCleared && isEvaluationCleared

  const studentExamRoutine = examSchedules.filter(
    (e) =>
      e.className.toLowerCase().includes(student.className.toLowerCase()) ||
      e.className === `${student.className} Â· ${student.section}`,
  )

  const gradingScale = examBook?.settings?.gradingScale
  const passPercent = examBook?.settings?.passPercent ?? 33

  const linkedExam =
    selectedExamSource !== 'gradebook'
      ? examBook?.declaredExams?.find((e) => e.id === selectedExamSource) || null
      : null

  const studentExamMarks = useMemo(() => {
    if (!linkedExam || !student) return []
    return (examBook?.examMarks || []).filter(
      (m) => m.examId === linkedExam.id && m.studentId === student.id,
    )
  }, [linkedExam, examBook?.examMarks, student])

  const reportRows = useMemo(() => {
    if (!student) return []
    if (linkedExam && studentExamMarks.length > 0) {
      return studentExamMarks.map((mk) => ({
        id: mk.id,
        subject: mk.subject,
        teacher: mk.submittedBy,
        prevOrBreakdown: `W:${mk.written} Â· M:${mk.mcq} Â· P:${mk.practical}`,
        latestScore: mk.percentage,
        grade: mk.grade,
        point: mk.gpa,
        passed: mk.passed,
        remark: mk.remarks || (mk.passed ? 'Official Exam Controller Verified' : 'Needs Remedial Support'),
      }))
    }
    return student.subjects.map((sub) => {
      const gp = scoreToGpa(sub.latestScore, gradingScale, passPercent)
      const delta = sub.latestScore - sub.previousScore
      return {
        id: sub.id,
        subject: sub.name,
        teacher: sub.teacher,
        prevOrBreakdown: `${sub.previousScore}%`,
        latestScore: sub.latestScore,
        grade: gp.grade,
        point: gp.point,
        passed: gp.passed,
        remark: `${delta >= 0 ? `+${delta}% progress` : `${delta}% needs focus`} Â· Next: ${sub.nextTopic}`,
      }
    })
  }, [student, linkedExam, studentExamMarks, gradingScale, passPercent])

  const avgGpa =
    reportRows.length > 0
      ? (reportRows.reduce((s, r) => s + r.point, 0) / reportRows.length).toFixed(2)
      : student.gpa

  const computedAverageScore =
    reportRows.length > 0
      ? Math.round(reportRows.reduce((s, r) => s + r.latestScore, 0) / reportRows.length)
      : student.averageScore

  const allSubjectsPassed =
    reportRows.length > 0 ? reportRows.every((r) => r.passed) : computedAverageScore >= passPercent

  const meritClassOptions = useMemo(
    () => ['All', ...Array.from(new Set(students.map((s) => `${s.className} Â· ${s.section}`)))],
    [students],
  )

  const meritSheetRows = useMemo(() => {
    return students
      .filter(
        (s) =>
          s.status !== 'suspended' &&
          (meritClassFilter === 'All' || `${s.className} Â· ${s.section}` === meritClassFilter),
      )
      .map((s) => {
        const subs = s.subjects
        const avg =
          subs.length > 0
            ? Math.round(subs.reduce((acc, x) => acc + x.latestScore, 0) / subs.length)
            : s.averageScore
        const gpas = subs.map((x) => scoreToGpa(x.latestScore, gradingScale, passPercent))
        const failedCount = gpas.filter((g) => !g.passed).length
        const gpaVal =
          gpas.length > 0
            ? Number((gpas.reduce((acc, g) => acc + g.point, 0) / gpas.length).toFixed(2))
            : Number(s.gpa || 0)
        const overallGrade = scoreToGpa(avg, gradingScale, passPercent).grade
        return {
          student: s,
          classLabel: `${s.className} Â· ${s.section}`,
          avg,
          gpa: gpaVal,
          grade: failedCount > 0 ? 'F' : overallGrade,
          failedCount,
          promoted: failedCount === 0 && avg >= passPercent,
        }
      })
      .sort((a, b) => b.gpa - a.gpa || b.avg - a.avg)
      .map((row, idx) => ({ ...row, meritRank: idx + 1 }))
  }, [students, meritClassFilter, gradingScale, passPercent])

  const handleIssueAndPrint = (docType: IssuedDocumentLog['docType']) => {
    const issued = issueOfficialDocument({ docType, studentId: student.id })
    if (issued) {
      setActiveVerifyCode(issued.verifyCode)
    }
    window.setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.print()
      }
    }, 180)
  }

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = verifyInput.trim().toUpperCase()
    if (!clean) return
    const found = issuedDocuments.find((d) => d.verifyCode.toUpperCase() === clean)
    if (found) {
      setVerifyResult({ status: 'valid', doc: found })
      notify(`Authentic DMHA document verified: ${found.docType}`)
    } else {
      setVerifyResult({ status: 'invalid' })
    }
  }

  return (
    <PageShell
      eyebrow="Official School Registrar Â· QR-Verified Printable Engine"
      title="Report Cards, Admit Cards & Certificates"
      subtitle="Generate official print/PDF DMHA transcripts, exam hall tickets with automatic fee-clearance guard, and QR-verified Transfer/Bonafide/Character certificates."
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      {/* Controls Bar (hidden when printing) */}
      <div className="dmhs-card mb-6 flex flex-wrap items-center justify-between gap-4 p-4 print:hidden">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'report' as const, label: 'Official Report Card' },
            ...(canSelectAnyStudent
              ? [{ id: 'merit' as const, label: 'Merit & Promotion Sheet' }]
              : []),
            { id: 'admit' as const, label: 'Exam Admit Card' },
            ...(role === 'admin' || role === 'teacher'
              ? [{ id: 'certificate' as const, label: 'TC / Bonafide / Character' }]
              : []),
            { id: 'verify' as const, label: `QR Verifier (${scopedIssuedDocuments.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
                subTab === t.id
                  ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {canSelectAnyStudent && subTab !== 'verify' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Student:
            </label>
            <select
              value={student.id}
              onChange={(e) => setPickedStudentId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.className} Â· Roll #{s.roll})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 1. REPORT CARD / OFFICIAL TRANSCRIPT */}
      {subTab === 'report' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Data Source:</span>
              <select
                value={selectedExamSource}
                onChange={(e) => {
                  setSelectedExamSource(e.target.value)
                  const ex = examBook?.declaredExams?.find((x) => x.id === e.target.value)
                  if (ex) setTermName(ex.title)
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="gradebook">Unified Gradebook (GPA 5.0)</option>
                {(examBook?.declaredExams || []).map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    Exam: {ex.title} ({ex.status.toUpperCase()})
                  </option>
                ))}
              </select>
              <input
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canSelectAnyStudent && (
                <button
                  type="button"
                  onClick={() => setBulkReportOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-800 hover:border-emerald-400"
                >
                  <Icon name="print" size={14} className="text-emerald-600" />
                  Bulk Print Class ({students.filter((s) => s.className === student.className).length})
                </button>
              )}
              <button
                type="button"
                onClick={() => handleIssueAndPrint('Report Card')}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
              >
                <Icon name="print" size={14} />
                Issue QR Code &amp; Print / Save PDF
              </button>
            </div>
          </div>

          <article className="dmhs-card mx-auto max-w-4xl border-2 border-slate-900/15 bg-white p-7 shadow-lg sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-[#0f172a] text-2xl font-black text-emerald-400">
                  D
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">
                    DMHA Â· Smart Learning App Â· Official Academic Transcript
                  </p>
                  <h2 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">
                    STUDENT PROGRESS REPORT CARD
                  </h2>
                  <p className="text-xs font-bold text-slate-500">
                    {termName} Â· Academic Session 2026
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    QR Verification Code
                  </p>
                  <p className="font-mono text-xs font-black text-slate-900">{activeVerifyCode}</p>
                  <p className="text-[10px] font-semibold text-emerald-700">Tamper-Evident Seal</p>
                </div>
                <VerificationQrSvg code={activeVerifyCode} size={76} />
              </div>
            </div>

            {/* Student Bio Strip */}
            <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-xs sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase text-slate-400">Student Name</p>
                <p className="mt-0.5 font-black text-slate-900">{student.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase text-slate-400">Class &amp; Roll</p>
                <p className="mt-0.5 font-black text-slate-900">
                  {student.className} Â· {student.section} (Roll #{student.roll})
                </p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase text-slate-400">Guardian</p>
                <p className="mt-0.5 font-bold text-slate-800">{student.guardianName}</p>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase text-slate-400">
                  Attendance &amp; House
                </p>
                <p className="mt-0.5 font-bold text-emerald-700">
                  {student.attendanceRate}% Â· {student.house || 'Emerald'} House
                </p>
              </div>
            </div>

            {/* Subject Marks Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-600">
                    <th className="px-3 py-2.5">Subject</th>
                    <th className="px-3 py-2.5">Faculty</th>
                    <th className="px-3 py-2.5 text-center">
                      {linkedExam && studentExamMarks.length > 0 ? 'W / M / P Split' : 'Prev. Term'}
                    </th>
                    <th className="px-3 py-2.5 text-center">Latest Marks</th>
                    <th className="px-3 py-2.5 text-center">Grade</th>
                    <th className="px-3 py-2.5 text-center">GPA (5.0)</th>
                    <th className="px-3 py-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reportRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2.5 font-black text-slate-900">{row.subject}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-600">{row.teacher}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-500">
                        {row.prevOrBreakdown}
                      </td>
                      <td className="px-3 py-2.5 text-center font-black text-slate-900">
                        {row.latestScore}%
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`rounded-md px-2 py-0.5 font-black ${
                            row.passed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {row.grade}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-black text-slate-900">
                        {row.point.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-600">
                        {row.remark}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary KPI Row */}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="dmhs-hero rounded-[18px] p-4 text-white">
                <p className="text-[10px] font-extrabold uppercase text-emerald-300">
                  Cumulative GPA (BD 5.0)
                </p>
                <p className="mt-1 text-2xl font-black">{avgGpa} / 5.00</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-extrabold uppercase text-slate-400">
                  Overall Average &amp; Rank
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {computedAverageScore}% Â· {student.rank}
                </p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-extrabold uppercase text-slate-400">
                  Promotion Status
                </p>
                <p
                  className={`mt-1 text-xl font-black ${
                    allSubjectsPassed ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {allSubjectsPassed ? 'ELIGIBLE FOR PROMOTION' : 'REMEDIAL REVIEW'}
                </p>
              </div>
            </div>

            {/* Signature Blocks */}
            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-slate-200 pt-6 text-center text-xs">
              <div>
                <p className="font-serif text-base italic text-slate-700">Nadia Rahman</p>
                <div className="mx-auto mt-1 h-px w-32 bg-slate-400" />
                <p className="mt-1 text-[10px] font-extrabold uppercase text-slate-500">
                  Class Teacher
                </p>
              </div>
              <div>
                <p className="font-serif text-base italic text-slate-700">
                  {student.guardianName}
                </p>
                <div className="mx-auto mt-1 h-px w-32 bg-slate-400" />
                <p className="mt-1 text-[10px] font-extrabold uppercase text-slate-500">
                  Guardian Signature
                </p>
              </div>
              <div>
                <p className="font-serif text-base font-bold italic text-slate-900">Shahid</p>
                <div className="mx-auto mt-1 h-px w-32 bg-slate-900" />
                <p className="mt-1 text-[10px] font-black uppercase text-slate-800">
                  Principal Â· DMHA
                </p>
              </div>
            </div>
          </article>

          {/* Bulk Class Report Card Print Modal */}
          {bulkReportOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
              onClick={() => setBulkReportOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="dmhs-print-receipt max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-slate-100 p-5 shadow-2xl print:bg-white print:p-0"
              >
                <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 print:hidden">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Bulk Class Report Cards Â· {student.className} ({termName})
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500">
                      Each studentâ€™s transcript prints on its own A4 page using the unified GPA 5.0 scale.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                    >
                      Print All A4
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkReportOpen(false)}
                      className="rounded-full bg-slate-100 p-2 text-slate-600"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-6">
                  {students
                    .filter((s) => s.className === student.className)
                    .map((clsStu) => {
                      const clsGpa =
                        clsStu.subjects.length > 0
                          ? (
                              clsStu.subjects.reduce(
                                (sum, x) => sum + scoreToGpa(x.latestScore, gradingScale, passPercent).point,
                                0,
                              ) / clsStu.subjects.length
                            ).toFixed(2)
                          : clsStu.gpa
                      return (
                        <div
                          key={clsStu.id}
                          className="rounded-3xl border-2 border-slate-900 bg-white p-6 print:break-after-page print:rounded-none"
                        >
                          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                DMHA Â· OFFICIAL PROGRESS REPORT CARD
                              </p>
                              <h4 className="text-lg font-black text-slate-950">{clsStu.name}</h4>
                              <p className="text-xs font-bold text-slate-500">
                                {clsStu.className} Â· {clsStu.section} Â· Roll #{clsStu.roll} Â· {termName}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-black text-emerald-700">GPA {clsGpa} / 5.00</p>
                              <p className="text-xs font-bold text-slate-500">
                                Avg {clsStu.averageScore}% Â· {clsStu.rank}
                              </p>
                            </div>
                          </div>
                          <table className="mt-4 w-full text-left text-xs">
                            <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-600">
                              <tr>
                                <th className="px-2.5 py-2">Subject</th>
                                <th className="px-2.5 py-2 text-center">Marks</th>
                                <th className="px-2.5 py-2 text-center">Grade</th>
                                <th className="px-2.5 py-2 text-center">GPA</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {clsStu.subjects.map((sub) => {
                                const g = scoreToGpa(sub.latestScore, gradingScale, passPercent)
                                return (
                                  <tr key={sub.id}>
                                    <td className="px-2.5 py-2 font-bold text-slate-900">{sub.name}</td>
                                    <td className="px-2.5 py-2 text-center font-black">{sub.latestScore}%</td>
                                    <td className="px-2.5 py-2 text-center font-black text-emerald-700">{g.grade}</td>
                                    <td className="px-2.5 py-2 text-center font-bold">{g.point.toFixed(2)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1B. MERIT & PROMOTION SUMMARY SHEET (RESULT MANAGEMENT) */}
      {subTab === 'merit' && canSelectAnyStudent && (
        <div className="space-y-4">
          <div className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-[24px] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={meritClassFilter}
                onChange={(e) => setMeritClassFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                {meritClassOptions.map((c) => (
                  <option key={c} value={c}>
                    {c === 'All' ? 'All Classes' : c}
                  </option>
                ))}
              </select>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
                Eligible for Promotion: {meritSheetRows.filter((r) => r.promoted).length} / {meritSheetRows.length}
              </span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-800">
                Remedial Review: {meritSheetRows.filter((r) => !r.promoted).length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadExcelCsv(
                    `DMHA-Merit-Promotion-Sheet-${new Date().toISOString().slice(0, 10)}.csv`,
                    ['Merit Rank', 'Roll', 'Student Name', 'Class', 'Average %', 'GPA (5.0)', 'Grade', 'Failed Subjects', 'Promotion Status'],
                    meritSheetRows.map((r) => [
                      r.meritRank,
                      r.student.roll,
                      r.student.name,
                      r.classLabel,
                      r.avg,
                      r.gpa.toFixed(2),
                      r.grade,
                      r.failedCount,
                      r.promoted ? 'ELIGIBLE FOR PROMOTION' : 'REMEDIAL REVIEW',
                    ]),
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-800 hover:border-emerald-400"
              >
                <Icon name="sheet" size={14} className="text-emerald-600" />
                Export Merit CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300"
              >
                Print Sheet A4
              </button>
            </div>
          </div>

          <div className="dmhs-card overflow-x-auto rounded-[24px] p-4">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                  <th className="py-2.5 pr-3">Merit Rank</th>
                  <th className="py-2.5 pr-3">Roll</th>
                  <th className="py-2.5 pr-3">Student &amp; Class</th>
                  <th className="py-2.5 pr-3 text-center">Avg %</th>
                  <th className="py-2.5 pr-3 text-center">GPA (5.0)</th>
                  <th className="py-2.5 pr-3 text-center">Grade</th>
                  <th className="py-2.5 pr-3">Promotion Status</th>
                  <th className="py-2.5 text-right">Transcript</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meritSheetRows.map((row) => (
                  <tr key={row.student.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-3 font-black text-emerald-700">#{row.meritRank}</td>
                    <td className="py-3 pr-3 font-mono font-bold text-slate-600">#{row.student.roll}</td>
                    <td className="py-3 pr-3">
                      <p className="font-extrabold text-slate-900">{row.student.name}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{row.classLabel}</p>
                    </td>
                    <td className="py-3 pr-3 text-center font-black text-slate-900">{row.avg}%</td>
                    <td className="py-3 pr-3 text-center font-black text-emerald-700">{row.gpa.toFixed(2)}</td>
                    <td className="py-3 pr-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                          row.promoted ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {row.grade}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                          row.promoted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.promoted ? 'ELIGIBLE FOR PROMOTION âœ“' : `REMEDIAL (${row.failedCount} failed)`}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setPickedStudentId(row.student.id)
                          setSubTab('report')
                        }}
                        className="rounded-full bg-[#0f172a] px-3 py-1 text-[10px] font-black text-emerald-300"
                      >
                        Open Report Card â†’
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. EXAM ADMIT CARD (HALL TICKET) WITH FEE + 5â˜…-1â˜… SEMESTER EVALUATION GUARD */}
      {subTab === 'admit' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold ${
                  unpaidTotal === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                <Icon name={unpaidTotal === 0 ? 'check' : 'alert'} size={14} />
                {unpaidTotal === 0
                  ? 'Tuition Fee Cleared'
                  : `Pending Tuition Due: à§³${unpaidTotal.toLocaleString()}`}
              </span>

              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold ${
                  evalStatus.isComplete
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                <Icon name={evalStatus.isComplete ? 'star' : 'lock'} size={14} />
                {evalStatus.isComplete
                  ? `Semester 5â˜…â€“1â˜… Evaluation Cleared (${evalStatus.completedCount}/${evalStatus.requiredCount})`
                  : `Semester 5â˜…â€“1â˜… Evaluation Pending (${evalStatus.completedCount}/${evalStatus.requiredCount})`}
              </span>

              {unpaidTotal > 0 && role === 'admin' && (
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={adminFeeOverride}
                    onChange={(e) => setAdminFeeOverride(e.target.checked)}
                    className="size-4 accent-emerald-600"
                  />
                  Principal Fee Override
                </label>
              )}

              {!evalStatus.isComplete && role === 'admin' && (
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={adminEvalOverride}
                    onChange={(e) => setAdminEvalOverride(e.target.checked)}
                    className="size-4 accent-emerald-600"
                  />
                  Principal Evaluation Override
                </label>
              )}
            </div>

            <button
              type="button"
              disabled={!canDownloadAdmitCard}
              onClick={() => handleIssueAndPrint('Admit Card')}
              className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-black text-emerald-300 shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Icon name="print" size={14} />
              {canDownloadAdmitCard
                ? 'Issue & Print Admit Card'
                : !isEvaluationCleared
                  ? 'Complete 5â˜…â€“1â˜… Evaluation to Unlock'
                  : 'Clear Tuition Fee to Unlock Print'}
            </button>
          </div>

          {!isEvaluationCleared && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 print:hidden">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
                  <Icon name="star" size={18} />
                </div>
                <div>
                  <p className="text-sm font-black">
                    End-of-Semester Teacher Evaluation (5â˜… to 1â˜…) Required Before Admit Card Download
                  </p>
                  <p className="mt-0.5 text-xs text-amber-900/80">
                    {student.name} has completed{' '}
                    <strong>
                      {evalStatus.completedCount} of {evalStatus.requiredCount}
                    </strong>{' '}
                    subject evaluations ({evalStatus.term}). Remaining:{' '}
                    <strong>{evalStatus.remainingSubjects.join(', ')}</strong>.
                  </p>
                </div>
              </div>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('feedback')}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-black text-emerald-300 shadow-sm hover:bg-slate-800"
                >
                  <Icon name="star" size={14} />
                  Complete 5â˜…â€“1â˜… Evaluation Now â†’
                </button>
              )}
            </div>
          )}

          <article className="dmhs-card mx-auto max-w-3xl border-2 border-slate-900 bg-white p-7 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-dashed border-slate-300 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">
                  DMHA Â· Smart Learning App Â· Exam Controller Office
                </p>
                <h2 className="mt-0.5 text-2xl font-black text-slate-950">
                  EXAMINATION ADMIT CARD / HALL TICKET
                </h2>
                <p className="text-xs font-bold text-slate-500">
                  Term Final Examination 2026 Â· Valid with Smart QR ID Card
                </p>
              </div>
              <VerificationQrSvg code={`ADMIT-${student.roll}-${activeVerifyCode}`} size={74} />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr]">
              <div className="flex size-24 flex-col items-center justify-center rounded-2xl bg-[#0f172a] text-2xl font-black text-emerald-400">
                {student.initials}
                <span className="mt-1 text-[9px] font-bold text-slate-300">
                  ROLL #{student.roll}
                </span>
              </div>
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Candidate:</span>
                  <p className="font-black text-slate-900">{student.name}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Class:</span>
                  <p className="font-black text-slate-900">
                    {student.className} Â· {student.section}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Seat / Hall Assignment:
                  </span>
                  <p className="font-bold text-slate-800">
                    Exam Hall A Â· Seat #{student.roll}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Fee Clearance:
                  </span>
                  <p
                    className={`font-black ${isFeeCleared ? 'text-emerald-700' : 'text-rose-600'}`}
                  >
                    {unpaidTotal === 0
                      ? 'CLEARED âœ“'
                      : isFeeCleared
                        ? 'PRINCIPAL PROVISIONAL CLEARANCE âœ“'
                        : `HOLD â€” à§³${unpaidTotal.toLocaleString()} DUE`}
                  </p>
                </div>
              </div>
            </div>

            <h3 className="mt-6 text-[11px] font-black uppercase tracking-wider text-slate-500">
              Scheduled Examination Papers
            </h3>
            <table className="mt-2 w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-y border-slate-300 bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Time Slot</th>
                  <th className="px-3 py-2">Hall / Room</th>
                  <th className="px-3 py-2">Invigilator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(studentExamRoutine.length > 0 ? studentExamRoutine : examSchedules).map((ex) => (
                  <tr key={ex.id}>
                    <td className="px-3 py-2 font-black text-slate-900">{ex.date}</td>
                    <td className="px-3 py-2 font-bold text-slate-800">{ex.subject}</td>
                    <td className="px-3 py-2 font-semibold text-slate-600">{ex.timeSlot}</td>
                    <td className="px-3 py-2 font-bold text-emerald-700">{ex.room}</td>
                    <td className="px-3 py-2 text-slate-500">{ex.invigilatorName}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 flex items-end justify-between border-t border-slate-200 pt-4 text-[11px] text-slate-500">
              <p>Bring Smart QR ID Card 15 minutes before exam start. Electronic devices prohibited.</p>
              <div className="text-right">
                <p className="font-serif text-sm font-bold italic text-slate-900">Shahid</p>
                <p className="text-[10px] font-black uppercase text-slate-700">
                  Principal &amp; Exam Controller
                </p>
              </div>
            </div>
          </article>

        </div>
      )}

      {/* 3. OFFICIAL CERTIFICATES (TC / BONAFIDE / CHARACTER) */}
      {subTab === 'certificate' && (
        <div className="space-y-4">
          <div className="dmhs-card flex flex-wrap items-end justify-between gap-4 p-4 print:hidden">
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase text-slate-400">
                  Certificate Type
                </label>
                <select
                  value={certType}
                  onChange={(e) => setCertType(e.target.value as typeof certType)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800"
                >
                  <option value="Bonafide Certificate">Bonafide / Studentship Certificate</option>
                  <option value="Character Certificate">Character &amp; Conduct Certificate</option>
                  <option value="Transfer Certificate">Transfer Certificate (TC)</option>
                </select>
              </div>
              <div className="min-w-[280px] flex-1">
                <label className="mb-1 block text-[10px] font-extrabold uppercase text-slate-400">
                  Custom Citation / Office Remarks
                </label>
                <input
                  value={certNotes}
                  onChange={(e) => setCertNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleIssueAndPrint(certType)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
            >
              <Icon name="print" size={14} />
              Register QR Seal &amp; Print Certificate
            </button>
          </div>

          <article className="dmhs-card mx-auto max-w-3xl border-[6px] border-double border-slate-900 bg-[#fffdf7] p-10 text-center shadow-xl">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#0f172a] text-2xl font-black text-emerald-400">
              D
            </div>
            <p className="mt-3 text-[11px] font-black uppercase tracking-[.26em] text-emerald-800">
              DMHA Â· Smart Learning App Â· Office of the Principal
            </p>
            <h2 className="mt-2 font-serif text-3xl font-black tracking-wide text-slate-950 uppercase">
              {certType}
            </h2>
            <p className="mt-1 font-mono text-[11px] font-bold text-slate-500">
              Ref No: {activeVerifyCode} Â· Issued {new Date().toLocaleDateString()}
            </p>

            <div className="mx-auto mt-8 max-w-2xl text-left text-sm leading-8 text-slate-800">
              <p>
                This is to formally certify that{' '}
                <strong className="border-b border-slate-400 px-1 text-slate-950">
                  {student.name}
                </strong>
                , son/daughter of{' '}
                <strong className="border-b border-slate-400 px-1 text-slate-950">
                  {student.guardianName}
                </strong>
                , bearing Roll Number <strong>#{student.roll}</strong>, is a{' '}
                {certType === 'Transfer Certificate' ? 'former bonafide' : 'bonafide'} student of{' '}
                <strong>
                  {student.className} ({student.section})
                </strong>{' '}
                at <strong>DMHA</strong> during Academic Session 2026.
              </p>
              <p className="mt-4">{certNotes}</p>
              {certType === 'Transfer Certificate' && (
                <p className="mt-3 font-semibold text-slate-700">
                  All school tuition dues and library books have been verified as{' '}
                  <strong>{unpaidTotal === 0 ? 'CLEARED' : 'PENDING SETTLEMENT'}</strong>. We wish
                  the student continued excellence in future academic endeavors.
                </p>
              )}
            </div>

            <div className="mt-10 flex items-end justify-between border-t border-slate-300 pt-6">
              <div className="flex items-center gap-3 text-left">
                <VerificationQrSvg code={activeVerifyCode} size={72} />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">
                    Digital Authenticity Seal
                  </p>
                  <p className="font-mono text-xs font-black text-slate-900">{activeVerifyCode}</p>
                  <p className="text-[10px] text-emerald-700">Verify inside DMHA Portal</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-serif text-xl font-bold italic text-slate-950">Shahid</p>
                <div className="mt-1 h-px w-40 bg-slate-900" />
                <p className="mt-1 text-[11px] font-black uppercase text-slate-800">
                  Principal Â· DMHA
                </p>
              </div>
            </div>
          </article>

        </div>
      )}

      {/* 4. QR DOCUMENT VERIFIER & ISSUED LOG */}
      {subTab === 'verify' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <div className="dmhs-card p-6">
            <h3 className="text-base font-black text-slate-900">
              Verify Printed Report Card / Certificate
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Enter or scan any DMHA QR code (e.g.{' '}
              <code className="font-mono font-bold text-slate-700">
                {scopedIssuedDocuments[0]?.verifyCode || 'DMHA-DOC-2026-8814'}
              </code>
              ) to confirm it was authentically issued by DMHA Office.
            </p>
            <form onSubmit={handleVerifyCode} className="mt-4 flex gap-2">
              <input
                value={verifyInput}
                onChange={(e) => setVerifyInput(e.target.value)}
                placeholder="DMHA-DOC-2026-XXXX"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
              >
                Verify
              </button>
            </form>

            {verifyResult.status === 'valid' && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                <p className="font-black">âœ“ AUTHENTIC DMHA DOCUMENT VERIFIED</p>
                <p className="mt-1 font-bold">
                  {verifyResult.doc.docType} â€” {verifyResult.doc.studentName} (
                  {verifyResult.doc.className})
                </p>
                <p className="mt-0.5 text-[11px] text-emerald-700">
                  Issued by {verifyResult.doc.issuedBy} on {verifyResult.doc.issuedAt}
                </p>
              </div>
            )}
            {verifyResult.status === 'invalid' && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
                âœ• No matching document found in DMHA Registrar SQLite database. Possible forgery or
                typo.
              </div>
            )}
          </div>

          <div className="dmhs-card p-6">
            <h3 className="text-base font-black text-slate-900">
              {canSelectAnyStudent
                ? `Issued Official Document Registry (${scopedIssuedDocuments.length})`
                : `${student.name}â€™s Issued Documents (${scopedIssuedDocuments.length})`}
            </h3>
            <div className="mt-4 space-y-2.5">
              {scopedIssuedDocuments.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-5 text-center text-xs font-bold text-slate-400">
                  No official documents issued yet for {student.name}. Print a Report Card or Admit Card to register its QR verification seal.
                </div>
              ) : (
                scopedIssuedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-xs"
                  >
                    <div>
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-800">
                        {doc.verifyCode}
                      </span>
                      <p className="mt-1 font-black text-slate-900">
                        {doc.docType} Â· {doc.studentName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {doc.className} Â· Issued by {doc.issuedBy}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifyInput(doc.verifyCode)
                        setVerifyResult({ status: 'valid', doc })
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700 hover:bg-slate-100"
                    >
                      Inspect Seal
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
