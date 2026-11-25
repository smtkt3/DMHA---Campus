'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { computeExamTabulation, evaluateGrade } from '@/lib/dmhs-exams'
import { DMHS_CLASS_SECTIONS } from './data'
import { Icon } from './icons'
import { useSchool } from './store'
import type { DeclaredExamItem, ExamAttendanceRecord, ExamLifecycleStatus } from './types'

const COMMON_SUBJECTS = [
  'Physics',
  'Mathematics',
  'English',
  'General Science',
  'Bangla',
  'ICT & Coding',
  'Social Studies',
]

function normCls(v: string) {
  return String(v || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

// ==================== 1. EXAM DECLARE & LIFECYCLE ====================
export function ExamDeclareSection({
  onSelectExam,
}: {
  onSelectExam?: (examId: string) => void
}) {
  const { examBook, runExamAction } = useSchool()
  const [title, setTitle] = useState('')
  const [termName, setTermName] = useState('Winter Term 2026')
  const [startDateIso, setStartDateIso] = useState('2026-12-06')
  const [endDateIso, setEndDateIso] = useState('2026-12-15')
  const [maxWritten, setMaxWritten] = useState(String(examBook.settings.defaultMaxWritten))
  const [maxMcq, setMaxMcq] = useState(String(examBook.settings.defaultMaxMcq))
  const [maxPractical, setMaxPractical] = useState(String(examBook.settings.defaultMaxPractical))
  const [passPercent, setPassPercent] = useState(String(examBook.settings.passPercent))
  const [selectedClasses, setSelectedClasses] = useState<string[]>([
    'Class 6 · Section A',
    'Class 5 · Section B',
    'Class 4 · Section A',
  ])
  const [instructions, setInstructions] = useState(examBook.settings.admitCardInstructions)

  const toggleClass = (c: string) =>
    setSelectedClasses((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  const handleDeclare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const res = await runExamAction(
      {
        action: 'declare_exam',
        title,
        termName,
        startDateIso,
        endDateIso,
        targetClasses: selectedClasses,
        maxWritten: Number(maxWritten),
        maxMcq: Number(maxMcq),
        maxPractical: Number(maxPractical),
        passPercent: Number(passPercent),
        instructions,
        status: 'declared',
      },
      `Declared examination: ${title}`,
    )
    if (res.ok) setTitle('')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={handleDeclare} className="dmhs-card h-fit space-y-3.5 rounded-[24px] p-5">
        <h3 className="text-sm font-black text-slate-900">Declare New Examination</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Exam Title (e.g., Annual Term Final Exam 2026) *"
          required
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
        />
        <input
          value={termName}
          onChange={(e) => setTermName(e.target.value)}
          placeholder="Term Name"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Start Date</label>
            <input
              type="date"
              value={startDateIso}
              onChange={(e) => setStartDateIso(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">End Date</label>
            <input
              type="date"
              value={endDateIso}
              onChange={(e) => setEndDateIso(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400">Written</label>
            <input
              type="number"
              min={0}
              value={maxWritten}
              onChange={(e) => setMaxWritten(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-black"
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400">MCQ</label>
            <input
              type="number"
              min={0}
              value={maxMcq}
              onChange={(e) => setMaxMcq(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-black"
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400">Practical</label>
            <input
              type="number"
              min={0}
              value={maxPractical}
              onChange={(e) => setMaxPractical(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-black"
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400">Pass %</label>
            <input
              type="number"
              min={1}
              max={100}
              value={passPercent}
              onChange={(e) => setPassPercent(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-black"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-slate-400">
            Target Classes ({selectedClasses.length} selected)
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DMHS_CLASS_SECTIONS.slice(0, 8).map((cls) => {
              const active = selectedClasses.includes(cls)
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => toggleClass(cls)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold transition ${
                    active ? 'bg-[#0f172a] text-emerald-300' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cls}
                </button>
              )
            })}
          </div>
        </div>

        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
          placeholder="Admit card & hall instructions..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
        />

        <button
          type="submit"
          className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300 hover:bg-slate-800"
        >
          + Declare Examination &amp; Notify Campus
        </button>
      </form>

      <div className="space-y-3">
        {examBook.declaredExams.map((ex) => {
          const totalMarks = ex.maxWritten + ex.maxMcq + ex.maxPractical
          const marksCount = examBook.examMarks.filter((m) => m.examId === ex.id).length
          const seatCount = examBook.seatAllocations.filter((s) => s.examId === ex.id).length
          return (
            <div key={ex.id} className="dmhs-card rounded-[24px] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-300">
                      {ex.code}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        ex.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ex.status === 'marks_locked'
                            ? 'bg-amber-100 text-amber-800'
                            : ex.status === 'declared'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ex.status.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {ex.startDateIso} → {ex.endDateIso}
                    </span>
                  </div>
                  <h4 className="mt-1.5 text-base font-black text-slate-900">{ex.title}</h4>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">
                    Total {totalMarks} Marks (Written {ex.maxWritten} · MCQ {ex.maxMcq} · Practical{' '}
                    {ex.maxPractical}) · Pass {ex.passPercent}% · {marksCount} mark entries ·{' '}
                    {seatCount} seats assigned
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ex.targetClasses.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {onSelectExam && (
                  <button
                    type="button"
                    onClick={() => onSelectExam(ex.id)}
                    className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-800 hover:bg-emerald-100"
                  >
                    Set Active Exam
                  </button>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { key: 'draft', label: 'Draft' },
                      { key: 'declared', label: 'Declare Open' },
                      { key: 'marks_locked', label: 'Lock Marks' },
                      { key: 'published', label: 'Publish Results' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() =>
                        void runExamAction(
                          {
                            action: 'update_exam_status',
                            examId: ex.id,
                            status: st.key as ExamLifecycleStatus,
                          },
                          `${ex.title} → ${st.label}`,
                        )
                      }
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                        ex.status === st.key
                          ? 'bg-[#0f172a] text-emerald-300'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  {marksCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void runExamAction(
                          { action: 'sync_results_to_report_cards', examId: ex.id },
                          `Synced ${ex.title} marks & GPA 5.0 to Gradebook & Report Cards!`,
                        )
                      }
                      className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-black text-white shadow-2xs hover:bg-emerald-700"
                    >
                      Sync to Report Cards ★
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void runExamAction(
                        { action: 'delete_exam', examId: ex.id },
                        `Removed exam ${ex.code}`,
                      )
                    }
                    className="text-[11px] font-bold text-rose-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== 2. EXAM ATTENDANCE ====================
export function ExamAttendanceSection({ exam }: { exam: DeclaredExamItem }) {
  const { students, teachers, role, activeTeacherId, examBook, runExamAction } = useSchool()
  const classOptions = useMemo(() => {
    const allClasses = Array.from(
      new Set(students.map((s) => `${s.className} · ${s.section}`)),
    )
    if (role === 'teacher') {
      const tch = teachers.find((t) => t.id === activeTeacherId)
      const tokens = (tch?.assignedClasses || []).map(normCls)
      const scoped = allClasses.filter((c) => {
        const tc = normCls(c)
        return tokens.some((tok) => tok === tc || tc.startsWith(tok))
      })
      return scoped.length > 0 ? scoped : allClasses
    }
    return allClasses
  }, [students, teachers, role, activeTeacherId])

  const [classLabel, setClassLabel] = useState(classOptions[0] || 'Class 6 · Section A')
  const [subject, setSubject] = useState('Physics')
  const [dateIso, setDateIso] = useState(exam.startDateIso || new Date().toISOString().slice(0, 10))
  const [statusMap, setStatusMap] = useState<Record<string, ExamAttendanceRecord['status']>>({})

  const classStudents = useMemo(
    () => students.filter((s) => `${s.className} · ${s.section}` === classLabel),
    [students, classLabel],
  )

  useEffect(() => {
    const next: Record<string, ExamAttendanceRecord['status']> = {}
    classStudents.forEach((s) => {
      const existing = examBook.examAttendance.find(
        (a) =>
          a.examId === exam.id &&
          a.classLabel === classLabel &&
          a.subject === subject &&
          a.studentId === s.id,
      )
      next[s.id] = existing?.status || 'present'
    })
    setStatusMap(next)
  }, [exam.id, classLabel, subject, classStudents, examBook.examAttendance])

  const presentCount = classStudents.filter((s) => (statusMap[s.id] || 'present') === 'present').length
  const absentCount = classStudents.filter((s) => statusMap[s.id] === 'absent').length

  const handleSave = async () => {
    await runExamAction(
      {
        action: 'save_exam_attendance',
        examId: exam.id,
        classLabel,
        subject,
        dateIso,
        entries: classStudents.map((s) => ({
          studentId: s.id,
          status: statusMap[s.id] || 'present',
        })),
      },
      `Saved ${subject} Exam Hall Attendance (${classLabel})!`,
    )
  }

  return (
    <div className="space-y-4">
      <div className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={classLabel}
            onChange={(e) => setClassLabel(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
          >
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
          >
            {COMMON_SUBJECTS.map((sub) => (
              <option key={sub}>{sub}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateIso}
            onChange={(e) => setDateIso(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
          />
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
            Present: {presentCount} · Absent: {absentCount}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const allP: Record<string, ExamAttendanceRecord['status']> = {}
              classStudents.forEach((s) => (allP[s.id] = 'present'))
              setStatusMap(allP)
            }}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700"
          >
            Mark All Present
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700"
          >
            Print Hall Sheet
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className="rounded-xl bg-[#0f172a] px-5 py-2 text-xs font-black text-emerald-300"
          >
            Save Attendance
          </button>
        </div>
      </div>

      <div className="dmhs-card overflow-x-auto rounded-[24px]">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-200">
            <tr>
              <th className="px-4 py-3">Roll</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Assigned Seat / Hall</th>
              <th className="px-4 py-3 text-right">Exam Hall Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {classStudents.map((s) => {
              const seat = examBook.seatAllocations.find(
                (sa) => sa.examId === exam.id && sa.studentId === s.id,
              )
              const st = statusMap[s.id] || 'present'
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono font-black text-slate-500">#{s.roll}</td>
                  <td className="px-4 py-3 font-black text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 font-semibold text-slate-500">
                    {seat ? `${seat.roomName} · ${seat.benchLabel}-S${seat.seatNo}` : 'Unassigned'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-wrap gap-1.5">
                      {(['present', 'absent', 'late', 'expelled'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setStatusMap((prev) => ({ ...prev, [s.id]: opt }))}
                          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                            st === opt
                              ? opt === 'present'
                                ? 'bg-emerald-600 text-white'
                                : opt === 'late'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-rose-600 text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==================== 3. EXAM MARKS ENTRY (ADMIN + TEACHER) ====================
export function ExamMarksEntrySection({ exam }: { exam: DeclaredExamItem }) {
  const { students, teachers, role, activeTeacherId, examBook, runExamAction } = useSchool()
  const classOptions = useMemo(() => {
    const allClasses = Array.from(
      new Set(students.map((s) => `${s.className} · ${s.section}`)),
    )
    if (role === 'teacher') {
      const tch = teachers.find((t) => t.id === activeTeacherId)
      const tokens = (tch?.assignedClasses || []).map(normCls)
      const scoped = allClasses.filter((c) => {
        const tc = normCls(c)
        return tokens.some((tok) => tok === tc || tc.startsWith(tok))
      })
      return scoped.length > 0 ? scoped : allClasses
    }
    return allClasses
  }, [students, teachers, role, activeTeacherId])

  const [classLabel, setClassLabel] = useState(classOptions[0] || 'Class 6 · Section A')
  const [subject, setSubject] = useState('Physics')
  const [drafts, setDrafts] = useState<
    Record<string, { written: string; mcq: string; practical: string; remarks: string }>
  >({})

  const classStudents = useMemo(
    () => students.filter((s) => `${s.className} · ${s.section}` === classLabel),
    [students, classLabel],
  )

  useEffect(() => {
    const next: Record<string, { written: string; mcq: string; practical: string; remarks: string }> = {}
    classStudents.forEach((s) => {
      const ex = examBook.examMarks.find(
        (m) =>
          m.examId === exam.id &&
          m.classLabel === classLabel &&
          m.subject === subject &&
          m.studentId === s.id,
      )
      next[s.id] = {
        written: ex ? String(ex.written) : '',
        mcq: ex ? String(ex.mcq) : '',
        practical: ex ? String(ex.practical) : '',
        remarks: ex?.remarks || '',
      }
    })
    setDrafts(next)
  }, [exam.id, classLabel, subject, classStudents, examBook.examMarks])

  const maxTotal = exam.maxWritten + exam.maxMcq + exam.maxPractical
  const lockedForTeacher =
    role === 'teacher' && (exam.status === 'marks_locked' || exam.status === 'published')

  const handleSaveMarks = async () => {
    const entries = classStudents
      .filter((s) => {
        const d = drafts[s.id]
        return d && (d.written !== '' || d.mcq !== '' || d.practical !== '')
      })
      .map((s) => {
        const d = drafts[s.id]
        return {
          studentId: s.id,
          written: Number(d.written || 0),
          mcq: Number(d.mcq || 0),
          practical: Number(d.practical || 0),
          remarks: d.remarks,
        }
      })
    if (entries.length === 0) return
    await runExamAction(
      { action: 'save_marks', examId: exam.id, classLabel, subject, entries },
      `Saved ${entries.length} student mark(s) for ${classLabel} · ${subject}!`,
    )
  }

  return (
    <div className="space-y-4">
      <div className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={classLabel}
            onChange={(e) => setClassLabel(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
          >
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
          >
            {COMMON_SUBJECTS.map((sub) => (
              <option key={sub}>{sub}</option>
            ))}
          </select>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700">
            Max: Written {exam.maxWritten} · MCQ {exam.maxMcq} · Practical {exam.maxPractical} (Total{' '}
            {maxTotal})
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {role === 'admin' && (
            <button
              type="button"
              onClick={() =>
                void runExamAction(
                  { action: 'verify_marks_batch', examId: exam.id, classLabel, subject },
                  `Verified all ${subject} marks for ${classLabel}!`,
                )
              }
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100"
            >
              ✓ Verify Teacher Marks
            </button>
          )}
          <button
            type="button"
            disabled={lockedForTeacher}
            onClick={() => void handleSaveMarks()}
            className="rounded-xl bg-[#0f172a] px-5 py-2 text-xs font-black text-emerald-300 disabled:opacity-40"
          >
            {lockedForTeacher ? 'Marks Locked by Admin' : 'Save Marks Sheet'}
          </button>
        </div>
      </div>

      <div className="dmhs-card overflow-x-auto rounded-[24px]">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-200">
            <tr>
              <th className="px-3.5 py-3">Roll &amp; Student</th>
              <th className="px-2 py-3 text-center">Written (/{exam.maxWritten})</th>
              <th className="px-2 py-3 text-center">MCQ (/{exam.maxMcq})</th>
              <th className="px-2 py-3 text-center">Practical (/{exam.maxPractical})</th>
              <th className="px-3 py-3 text-center">Total / Grade</th>
              <th className="px-3 py-3">Remarks</th>
              <th className="px-3.5 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {classStudents.map((s) => {
              const d = drafts[s.id] || { written: '', mcq: '', practical: '', remarks: '' }
              const savedRec = examBook.examMarks.find(
                (m) =>
                  m.examId === exam.id &&
                  m.classLabel === classLabel &&
                  m.subject === subject &&
                  m.studentId === s.id,
              )
              const w = Number(d.written || 0)
              const m = Number(d.mcq || 0)
              const p = Number(d.practical || 0)
              const tot = w + m + p
              const pct = maxTotal > 0 ? Math.round((tot / maxTotal) * 100) : 0
              const graded = evaluateGrade(pct, examBook.settings.gradingScale, exam.passPercent)

              return (
                <tr key={s.id}>
                  <td className="px-3.5 py-2.5">
                    <p className="font-black text-slate-900">
                      <span className="mr-1.5 font-mono text-slate-400">#{s.roll}</span>
                      {s.name}
                    </p>
                  </td>
                  {(
                    [
                      ['written', exam.maxWritten],
                      ['mcq', exam.maxMcq],
                      ['practical', exam.maxPractical],
                    ] as const
                  ).map(([field, maxVal]) => (
                    <td key={field} className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        max={maxVal}
                        disabled={lockedForTeacher}
                        value={d[field]}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [s.id]: { ...d, [field]: e.target.value },
                          }))
                        }
                        placeholder="0"
                        className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center font-mono text-xs font-black"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <span className="font-mono font-black text-slate-900">{tot}</span>
                    <span
                      className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                        graded.passed
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {graded.grade} ({graded.gpa.toFixed(1)})
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={d.remarks}
                      disabled={lockedForTeacher}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [s.id]: { ...d, remarks: e.target.value },
                        }))
                      }
                      placeholder="Examiner note..."
                      className="w-full min-w-[140px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </td>
                  <td className="px-3.5 py-2 text-right">
                    {savedRec ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                          savedRec.verifiedByAdmin
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {savedRec.verifiedByAdmin ? 'Verified ✓' : 'Teacher Submitted'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">Pending</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==================== 4. EXAM MARK LIST & TABULATION SHEET ====================
export function ExamMarkListSection({ exam }: { exam: DeclaredExamItem }) {
  const { examBook, notify } = useSchool()
  const [classFilter, setClassFilter] = useState('All')
  const [subjectFilter, setSubjectFilter] = useState('All')

  const examMarksForExam = useMemo(
    () => examBook.examMarks.filter((m) => m.examId === exam.id),
    [examBook.examMarks, exam.id],
  )
  const classList = ['All', ...Array.from(new Set(examMarksForExam.map((m) => m.classLabel)))]
  const subjectList = ['All', ...Array.from(new Set(examMarksForExam.map((m) => m.subject)))]

  const tab = useMemo(
    () => computeExamTabulation(examBook, exam.id, classFilter, subjectFilter),
    [examBook, exam.id, classFilter, subjectFilter],
  )

  const exportCsv = () => {
    const rows = [
      ['Merit Rank', 'Roll', 'Student Name', 'Class', 'Subjects', 'Obtained', 'Max Marks', 'Percent %', 'GPA', 'Grade', 'Result'],
      ...tab.rows.map((r) => [
        r.meritRank,
        r.roll,
        r.studentName,
        r.classLabel,
        r.subjectsCount,
        r.totalObtained,
        r.totalMax,
        r.averagePercent,
        r.gpa,
        r.grade,
        r.passed ? 'PASS' : 'FAIL',
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DMHA-MarkList-${exam.code}.csv`
    a.click()
    URL.revokeObjectURL(url)
    notify(`Exported ${exam.code} Tabulation Mark List CSV!`)
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            Evaluated Students
          </p>
          <p className="mt-1 text-3xl font-black">{tab.rows.length}</p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
            Pass Rate
          </p>
          <p className="mt-1 text-3xl font-black text-emerald-700">{tab.passRate}%</p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600">
            Average Score
          </p>
          <p className="mt-1 text-3xl font-black text-slate-900">{tab.averagePercent}%</p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
            Highest Score
          </p>
          <p className="mt-1 text-3xl font-black text-indigo-700">{tab.highestPercent}%</p>
        </div>
      </div>

      <div className="dmhs-card flex flex-wrap items-center justify-between gap-2 rounded-2xl p-4">
        <div className="flex flex-wrap gap-2">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
          >
            {classList.map((c) => (
              <option key={c} value={c}>
                Class: {c}
              </option>
            ))}
          </select>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
          >
            {subjectList.map((s) => (
              <option key={s} value={s}>
                Subject: {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700"
          >
            <Icon name="download" size={13} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-black text-emerald-300"
          >
            <Icon name="print" size={13} />
            Print Tabulation A4
          </button>
        </div>
      </div>

      <div className="dmhs-card overflow-x-auto rounded-[24px]">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-200">
            <tr>
              <th className="px-4 py-3">Merit</th>
              <th className="px-4 py-3">Roll &amp; Student</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Subject Breakdown</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">%</th>
              <th className="px-4 py-3 text-center">Grade / GPA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tab.rows.map((r) => (
              <tr key={r.studentId} className="hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-black ${
                      r.meritRank === 1
                        ? 'bg-amber-400 text-slate-950'
                        : r.meritRank === 2
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    #{r.meritRank}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-black text-slate-900">{r.studentName}</p>
                  <p className="font-mono text-[10px] font-bold text-slate-400">Roll #{r.roll}</p>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-600">{r.classLabel}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {r.entries.map((e) => (
                      <span
                        key={e.id}
                        className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700"
                      >
                        {e.subject}: <strong>{e.total}/{e.maxTotal}</strong> ({e.grade})
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono font-black text-slate-950">
                  {r.totalObtained} / {r.totalMax}
                </td>
                <td className="px-4 py-3 text-right font-mono font-black text-emerald-700">
                  {r.averagePercent}%
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-black ${
                      r.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {r.grade} · GPA {r.gpa.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
            {tab.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs font-bold text-slate-400">
                  No marks entered yet for this exam filter. Open Marks Entry to record scores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
