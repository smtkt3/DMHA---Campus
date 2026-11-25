'use client'

import React, { useState } from 'react'
import { Icon } from './icons'
import { useSchool } from './store'
import type { PeriodSlot, SubjectProgress } from './types'
import {
  AttendanceBadge,
  ClassCard,
  FeedbackBadge,
  PageShell,
  PeriodDetailModal,
  ReportCardModal,
  SectionTitle,
} from './ui'

export function StudentOverview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const {
    students,
    activeStudentId,
    assignments,
    feedback,
    notices,
    getSemesterEvaluationStatus,
  } = useSchool()
  const [reportOpen, setReportOpen] = useState(false)
  const [activePeriod, setActivePeriod] = useState<PeriodSlot | null>(null)
  const student = students.find((s) => s.id === activeStudentId) || students[0]
  const myFeedback = feedback.filter((f) => f.studentId === student.id)
  const myPendingHw = assignments.filter(
    (a) => a.studentId === student.id && a.status === 'pending',
  )
  const evalStatus = getSemesterEvaluationStatus(student.id)

  return (
    <>
      <section className="dmhs-hero relative overflow-hidden rounded-[28px] p-6 text-white sm:p-8">
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-emerald-300 ring-1 ring-white/10">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                DMHA · {student.className} · {student.section} · Roll #{student.roll}
              </span>
              <AttendanceBadge status={student.todayStatus} />
            </div>
            <h2 className="mt-5 text-3xl font-black leading-[1.08] tracking-[-.03em] sm:text-4xl">
              Your school day, <span className="text-emerald-400">all in one place.</span>
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
              You have {myPendingHw.length} pending homework task(s) and {myFeedback.length} teacher
              remarks this term. Keep your momentum going!
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <button
                onClick={() => onNavigate('schedule')}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-emerald-300"
              >
                <Icon name="calendar" size={16} />
                Today’s Routine
              </button>
              <button
                onClick={() => setReportOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 py-3 text-xs font-extrabold text-white transition hover:bg-white/15"
              >
                <Icon name="exam" size={16} />
                My Report Card
              </button>
              <button
                onClick={() => onNavigate('scripts')}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 py-3 text-xs font-extrabold text-white transition hover:bg-white/15"
              >
                <Icon name="sheet" size={16} />
                My Exam Sheets
              </button>
              <button
                onClick={() => onNavigate('feedback')}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs font-extrabold transition ${
                  evalStatus.isComplete
                    ? 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                    : 'bg-amber-400 text-slate-950 shadow-sm hover:bg-amber-300'
                }`}
              >
                <Icon name="star" size={16} />
                {evalStatus.isComplete
                  ? '5★ Evaluation Done · Admit Ready'
                  : `Rate Teachers 5★–1★ (${evalStatus.completedCount}/${evalStatus.requiredCount})`}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:min-w-[240px]">
            <button
              onClick={() => onNavigate('exams')}
              className="rounded-2xl border border-white/10 bg-white/8 p-4 text-left transition hover:bg-white/14"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">GPA</p>
              <p className="mt-1 text-2xl font-black text-emerald-400">{student.gpa}</p>
              <p className="mt-0.5 text-[10px] text-slate-300">Avg {student.averageScore}% →</p>
            </button>
            <button
              onClick={() => onNavigate('attendance')}
              className="rounded-2xl border border-white/10 bg-white/8 p-4 text-left transition hover:bg-white/14"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                Attendance
              </p>
              <p className="mt-1 text-2xl font-black">{student.attendanceRate}%</p>
              <p className="mt-0.5 text-[10px] text-slate-300">Rank {student.rank} →</p>
            </button>
          </div>
        </div>
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <section>
          <SectionTitle
            eyebrow="Today’s timetable"
            title="Periods & rooms"
            action="Full routine"
            onAction={() => onNavigate('schedule')}
          />
          <div className="space-y-2.5">
            {student.todayPeriods.map((item) => (
              <ClassCard
                key={item.id}
                item={item}
                showStatus
                onClick={() => setActivePeriod(item)}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="Latest from teachers" title="Feedback & notices" />
          <div className="space-y-2.5">
            {myFeedback.slice(0, 2).map((fb) => (
              <button
                key={fb.id}
                onClick={() => onNavigate('feedback')}
                className="dmhs-card w-full rounded-2xl p-4 text-left transition hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <FeedbackBadge category={fb.category} />
                  <span className="text-[10px] font-bold text-slate-400">{fb.subject}</span>
                </div>
                <p className="mt-2 text-xs font-black text-slate-900">{fb.title}</p>
                <p className="mt-1 text-[11px] text-slate-500">{fb.message}</p>
              </button>
            ))}
            {notices
              .filter(
                (nt) =>
                  (nt.audience === 'All' || nt.audience === 'Students') &&
                  (!nt.targetUnit ||
                    nt.targetUnit === 'All Units' ||
                    nt.targetUnit === (student.busRoute || 'Unit - 1')),
              )
              .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
              .slice(0, 2)
              .map((nt) => (
                <button
                  key={nt.id}
                  onClick={() => onNavigate('campus')}
                  className="w-full rounded-2xl bg-[#0f172a] p-4 text-left text-white transition hover:bg-slate-800"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                    {nt.pinned ? '★ Pinned ' : ''}DMHA School Notice · {nt.targetUnit || 'All Units'} →
                  </p>
                  <p className="mt-1 text-xs font-black">{nt.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-300">{nt.body}</p>
                </button>
              ))}
          </div>
        </section>
      </div>

      {reportOpen && <ReportCardModal student={student} onClose={() => setReportOpen(false)} />}
      {activePeriod && (
        <PeriodDetailModal
          period={activePeriod}
          onClose={() => setActivePeriod(null)}
          onAction={() => onNavigate('schedule')}
        />
      )}
    </>
  )
}

export function StudentSubjectsView({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { students, activeStudentId, assignments, examSheets, notify } = useSchool()
  const [search, setSearch] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<SubjectProgress | null>(null)
  const [completedChapters, setCompletedChapters] = useState<Record<string, boolean>>({
    'ch-1': true,
    'ch-2': true,
  })

  const student = students.find((s) => s.id === activeStudentId) || students[0]
  const filtered = student.subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.teacher.toLowerCase().includes(search.toLowerCase()),
  )

  // Dedicated Subject Detail Page
  if (selectedSubject) {
    const subHomework = assignments.filter(
      (a) => a.studentId === student.id && a.subject === selectedSubject.name,
    )
    const subScripts = examSheets.filter(
      (s) => s.studentId === student.id && s.subject === selectedSubject.name,
    )
    const chapters = [
      { id: 'ch-1', title: 'Unit 1 · Core Foundations & Terminology' },
      { id: 'ch-2', title: 'Unit 2 · Analytical Problem Solving' },
      { id: 'ch-3', title: `Unit 3 · ${selectedSubject.nextTopic} (Current)` },
      { id: 'ch-4', title: 'Unit 4 · Term Final Revision & Past Papers' },
    ]

    return (
      <PageShell
        eyebrow={`${selectedSubject.section} · Subject Workspace`}
        title={selectedSubject.name}
        subtitle={`Instructor: ${selectedSubject.teacher} · Current Score: ${selectedSubject.latestScore}% (${selectedSubject.grade})`}
        action={
          <button
            onClick={() => setSelectedSubject(null)}
            className="rounded-full bg-slate-200 px-4 py-2 text-xs font-extrabold text-slate-800 hover:bg-slate-300"
          >
            ← Back to All Subjects
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="dmhs-hero rounded-[24px] p-5 text-white">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
              Latest Score
            </p>
            <p className="mt-1 text-3xl font-black text-emerald-400">
              {selectedSubject.latestScore}% ({selectedSubject.grade})
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Previous Term: {selectedSubject.previousScore}%
            </p>
          </div>
          <div className="dmhs-card rounded-[24px] p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Syllabus Progress
            </p>
            <p className="mt-1 text-3xl font-black text-slate-900">{selectedSubject.progress}%</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Next: {selectedSubject.nextTopic}
            </p>
          </div>
          <div className="dmhs-card rounded-[24px] p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Resources
            </p>
            <p className="mt-1 text-3xl font-black text-slate-900">
              {subHomework.length} HW · {subScripts.length} Scripts
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate('scripts')}
                className="mt-1 text-xs font-extrabold text-emerald-700 hover:underline"
              >
                Open Exam Sheets →
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="dmhs-card rounded-[24px] p-5">
            <SectionTitle eyebrow="Interactive syllabus" title="Study Checklist" />
            <div className="space-y-2.5">
              {chapters.map((ch) => {
                const checked = !!completedChapters[ch.id]
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setCompletedChapters((prev) => ({ ...prev, [ch.id]: !checked }))
                      notify(checked ? 'Marked incomplete' : `Completed: ${ch.title}`)
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3.5 text-left transition hover:bg-slate-100"
                  >
                    <span
                      className={`flex size-6 items-center justify-center rounded-lg ${
                        checked
                          ? 'bg-emerald-500 text-slate-950'
                          : 'border border-slate-300 bg-white'
                      }`}
                    >
                      {checked && <Icon name="check" size={14} />}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        checked ? 'text-slate-400 line-through' : 'text-slate-900'
                      }`}
                    >
                      {ch.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="dmhs-card rounded-[24px] p-5">
            <SectionTitle eyebrow="Subject actions" title="Quick Links & Materials" />
            <div className="space-y-2.5">
              <button
                onClick={() => onNavigate?.('house')}
                className="flex w-full items-center justify-between rounded-2xl bg-slate-50 p-4 text-left hover:bg-emerald-50"
              >
                <div>
                  <p className="text-xs font-black text-slate-900">
                    Cambridge Past Papers & Mark Schemes
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Practice {selectedSubject.name} past exams
                  </p>
                </div>
                <Icon name="arrow" size={16} />
              </button>
              <button
                onClick={() => onNavigate?.('assignments')}
                className="flex w-full items-center justify-between rounded-2xl bg-slate-50 p-4 text-left hover:bg-emerald-50"
              >
                <div>
                  <p className="text-xs font-black text-slate-900">
                    Homework & Worksheets ({subHomework.length})
                  </p>
                  <p className="text-[11px] text-slate-500">Submit assignments online</p>
                </div>
                <Icon name="arrow" size={16} />
              </button>
              <button
                onClick={() => onNavigate?.('scripts')}
                className="flex w-full items-center justify-between rounded-2xl bg-slate-50 p-4 text-left hover:bg-emerald-50"
              >
                <div>
                  <p className="text-xs font-black text-slate-900">
                    Graded Exam Answer Sheets ({subScripts.length})
                  </p>
                  <p className="text-[11px] text-slate-500">Inspect teacher markings & feedback</p>
                </div>
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </section>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      eyebrow={`Academic Year 2026 · ${student.className} ${student.section}`}
      title="My School Subjects"
      subtitle="Click any subject card to open its full syllabus checklist, scores, homework, and past papers."
    >
      <label className="dmhs-card mb-5 flex items-center gap-3 rounded-2xl px-4 py-3.5">
        <Icon name="search" size={18} className="text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subjects or teachers..."
          className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((sub) => (
          <button
            key={sub.id}
            onClick={() => setSelectedSubject(sub)}
            className="dmhs-card overflow-hidden rounded-[24px] text-left transition hover:-translate-y-0.5 hover:border-emerald-300"
          >
            <div
              className={`p-5 ${
                sub.color === 'violet'
                  ? 'bg-gradient-to-br from-indigo-50 to-indigo-100/80'
                  : sub.color === 'cyan'
                    ? 'bg-gradient-to-br from-sky-50 to-cyan-100/80'
                    : sub.color === 'orange'
                      ? 'bg-gradient-to-br from-amber-50 to-orange-100/80'
                      : 'bg-gradient-to-br from-emerald-50 to-teal-100/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-700">
                  {sub.section}
                </span>
                <span className="rounded-full bg-[#0f172a] px-2.5 py-1 text-[10px] font-black text-emerald-400">
                  {sub.grade} · {sub.latestScore}%
                </span>
              </div>
              <h3 className="mt-6 text-xl font-black text-slate-900">{sub.name}</h3>
              <p className="mt-0.5 text-xs font-bold text-slate-600">{sub.teacher}</p>
            </div>
            <div className="p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Next Topic
              </p>
              <p className="mt-1 text-xs font-black text-slate-900">{sub.nextTopic}</p>
              <div className="mt-4 flex items-center justify-between text-[10px] font-extrabold text-slate-500">
                <span>Syllabus Completed</span>
                <span>{sub.progress}% · Open →</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#0f172a]"
                  style={{ width: `${sub.progress}%` }}
                />
              </div>
            </div>
          </button>
        ))}
      </div>
    </PageShell>
  )
}
