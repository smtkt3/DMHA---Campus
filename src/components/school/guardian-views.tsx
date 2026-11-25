'use client'

import React, { useEffect, useState } from 'react'
import { GuardianBiometricGateModal, VerificationSealBadge } from './biometric-ui'
import { GUARDIAN_PROFILE } from './data'
import { DateFilterBar, formatPrettyDate, getTodayIso } from './date-utils'
import { Icon } from './icons'
import { useSchool } from './store'
import type {
  AttendanceStatus,
  FeedbackCategory,
  PeriodSlot,
  StudentRecord,
  SubjectProgress,
} from './types'
import {
  AdmitCardModal,
  AttendanceBadge,
  ClassCard,
  FeedbackBadge,
  PageShell,
  PeriodDetailModal,
  ReportCardModal,
  SectionTitle,
  SubjectDetailModal,
} from './ui'

export function ChildSwitcherBar() {
  const {
    students,
    guardians,
    activeGuardianId,
    selectedChildId,
    setSelectedChildId,
    enterFamilyChildMode,
  } = useSchool()
  const activeGuardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]
  const myChildren = students.filter((s) =>
    activeGuardian ? activeGuardian.linkedStudentIds.includes(s.id) : false,
  )
  const displayChildren = myChildren.length > 0 ? myChildren : students.slice(0, 1)
  const activeChild = displayChildren.find((c) => c.id === selectedChildId) || displayChildren[0]
  const sharedEnabled = activeGuardian?.sharedDeviceMode !== false

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/6 bg-white p-2.5 shadow-[0_8px_24px_rgba(20,20,30,.04)]">
      <div className="flex items-center gap-2 pl-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
          <Icon name="shield" size={16} />
        </span>
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-black/35">
            Guardian · {activeGuardian?.name || GUARDIAN_PROFILE.name}
          </p>
          <p className="text-xs font-black">
            {myChildren.length} Linked Child{myChildren.length === 1 ? '' : 'ren'}
            {sharedEnabled ? ' · Shared Phone Ready' : ''}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {displayChildren.map((child) => {
          const active = child.id === selectedChildId
          return (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-left transition ${
                active
                  ? 'bg-[#0f172a] text-white shadow-md'
                  : 'bg-[#f4f5f8] text-black/70 hover:bg-black/8'
              }`}
            >
              <span
                className={`flex size-7 items-center justify-center rounded-full text-[10px] font-black ${
                  active ? 'bg-emerald-500 text-slate-950' : 'bg-white text-black'
                }`}
              >
                {child.initials}
              </span>
              <span>
                <span className="block text-xs font-black leading-none">{child.name}</span>
                <span
                  className={`mt-1 block text-[9px] font-bold ${
                    active ? 'text-white/55' : 'text-black/40'
                  }`}
                >
                  {child.className} · {child.section} · Roll #{child.roll}
                </span>
              </span>
            </button>
          )
        })}

        {sharedEnabled && activeChild && (
          <button
            type="button"
            onClick={() => enterFamilyChildMode(activeChild.id)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
            title="Hand your phone to your child in a PIN-protected Study Workspace"
          >
            <Icon name="book" size={14} />
            <span>Hand Phone to {activeChild.name.split(' ')[0]}</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function GuardianOverview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const {
    students,
    selectedChildId,
    feedback,
    assignments,
    fees,
    notices,
    campusUnits,
    earlyYearsCareLogs,
    acknowledgeFeedback,
    getSemesterEvaluationStatus,
    notify,
  } = useSchool()
  const [reportOpen, setReportOpen] = useState(false)
  const [admitOpen, setAdmitOpen] = useState(false)
  const [activePeriod, setActivePeriod] = useState<PeriodSlot | null>(null)

  const child: StudentRecord =
    students.find((s) => s.id === selectedChildId) || students[0]

  const childUnitObj =
    campusUnits.find((u) => u.name === (child.busRoute || 'Unit - 1')) || campusUnits[0]
  const latestGuardianNotice = notices
    .filter(
      (n) =>
        (n.audience === 'All' || n.audience === 'Guardians') &&
        (!n.targetUnit || n.targetUnit === 'All Units' || n.targetUnit === (child.busRoute || 'Unit - 1')),
    )
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))[0]
  const latestCareCard = earlyYearsCareLogs.find((c) => c.studentId === child.id)

  const childFeedback = feedback.filter((f) => f.studentId === child.id)
  const childAssignments = assignments.filter((a) => a.studentId === child.id)
  const pendingHw = childAssignments.filter((a) => a.status === 'pending' || a.status === 'overdue')
  const childDueFees = fees.filter((f) => f.studentId === child.id && f.status === 'due')
  const totalDue = childDueFees.reduce((sum, f) => sum + f.amount, 0)

  const weakestSubject = [...child.subjects].sort((a, b) => a.latestScore - b.latestScore)[0]
  const strongestSubject = [...child.subjects].sort((a, b) => b.latestScore - a.latestScore)[0]

  return (
    <>
      <ChildSwitcherBar />

      {/* Live Safety & Attendance Hero */}
      <section className="dmhs-hero relative overflow-hidden rounded-[28px] p-6 text-white sm:p-8">
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-emerald-300 ring-1 ring-white/10">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                DMHA Live Campus Status · {formatPrettyDate(getTodayIso())}
              </span>
              <AttendanceBadge status={child.todayStatus} />
              {childUnitObj && (
                <button
                  onClick={() => onNavigate('campus')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-sky-200 ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  {childUnitObj.name} · Gate {childUnitObj.gateStatus}
                </button>
              )}
            </div>

            <h2 className="mt-5 text-3xl font-black leading-[1.08] tracking-[-.03em] sm:text-4xl">
              {child.todayStatus === 'present' ? (
                <>
                  {child.name.split(' ')[0]} is{' '}
                  <span className="text-emerald-400">safely in class.</span>
                </>
              ) : child.todayStatus === 'late' ? (
                <>
                  {child.name.split(' ')[0]} arrived{' '}
                  <span className="text-amber-300">late today.</span>
                </>
              ) : child.todayStatus === 'leave' ? (
                <>
                  {child.name.split(' ')[0]} is on{' '}
                  <span className="text-indigo-300">approved leave.</span>
                </>
              ) : (
                <>
                  Absence alert for{' '}
                  <span className="text-rose-400">{child.name.split(' ')[0]}.</span>
                </>
              )}
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">
              {child.gateCheckIn
                ? `Campus gate check-in recorded at ${child.gateCheckIn} · ${child.busRoute}.`
                : `No campus gate check-in recorded today. Contact the class teacher if this is unexpected.`}
            </p>
            {latestGuardianNotice && (
              <button
                onClick={() => onNavigate('campus')}
                className="mt-3 inline-flex max-w-lg items-center gap-2 rounded-xl bg-white/8 px-3.5 py-2 text-left text-xs text-slate-200 ring-1 ring-white/10 transition hover:bg-white/15"
              >
                <span className="shrink-0 rounded-md bg-emerald-400/20 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-300">
                  {latestGuardianNotice.pinned ? '★ Pinned Notice' : 'Latest Notice'}
                </span>
                <span className="truncate font-bold">{latestGuardianNotice.title}</span>
                <span className="shrink-0 text-emerald-400">→</span>
              </button>
            )}
            {latestCareCard && (
              <button
                onClick={() => onNavigate('care')}
                className="mt-2 inline-flex max-w-lg items-center gap-2 rounded-xl bg-emerald-500/15 px-3.5 py-2 text-left text-xs text-emerald-100 ring-1 ring-emerald-400/25 transition hover:bg-emerald-500/25"
              >
                <span className="shrink-0 rounded-md bg-emerald-400 px-2 py-0.5 text-[10px] font-black uppercase text-slate-950">
                  Daily Care
                </span>
                <span className="truncate font-bold">
                  Tiffin: {latestCareCard.mealStatus} · Mood: {latestCareCard.mood}
                </span>
                <span className="shrink-0 text-emerald-300">→</span>
              </button>
            )}

            <div className="mt-6 flex flex-wrap gap-2.5">
              <button
                onClick={() => onNavigate('attendance')}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-emerald-300"
              >
                <Icon name="shield" size={16} />
                Attendance & Leave
              </button>
              <button
                onClick={() => setReportOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 py-3 text-xs font-extrabold text-white transition hover:bg-white/15"
              >
                <Icon name="exam" size={16} />
                View Report Card
              </button>
              <button
                onClick={() => setAdmitOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 py-3 text-xs font-extrabold text-white transition hover:bg-white/15"
              >
                <Icon name="clipboard" size={16} />
                Exam Admit Card
              </button>
              <button
                onClick={() => onNavigate('feedback')}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 py-3 text-xs font-extrabold text-white transition hover:bg-white/15"
              >
                <Icon name="star" size={16} />
                Teacher Feedback ({childFeedback.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[270px]">
            <button
              onClick={() => onNavigate('exams')}
              className="rounded-2xl border border-white/10 bg-white/8 p-4 text-left backdrop-blur transition hover:bg-white/14"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                Term GPA
              </p>
              <p className="mt-1 text-2xl font-black text-emerald-400">{child.gpa}</p>
              <p className="mt-0.5 text-[11px] text-slate-300">Rank {child.rank} · View →</p>
            </button>
            <button
              onClick={() => onNavigate('attendance')}
              className="rounded-2xl border border-white/10 bg-white/8 p-4 text-left backdrop-blur transition hover:bg-white/14"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                Attendance
              </p>
              <p className="mt-1 text-2xl font-black text-white">{child.attendanceRate}%</p>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {child.presentDays}/{child.totalDays} days · Log →
              </p>
            </button>
          </div>
        </div>
      </section>

      {/* Guardian KPI Quick Cards */}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          onClick={() => onNavigate('exams')}
          className="rounded-2xl border border-black/5 bg-white p-4 text-left shadow-[0_8px_24px_rgba(20,20,30,.04)] transition hover:-translate-y-0.5"
        >
          <span className="action-cyan mb-3 flex size-10 items-center justify-center rounded-xl">
            <Icon name="trend" size={19} />
          </span>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">
            Academic Average
          </p>
          <p className="mt-1 text-2xl font-black">{child.averageScore}%</p>
          <p className="mt-1 text-[10px] font-bold text-[#4e7c00]">
            Best: {strongestSubject?.name ?? 'Science'} ({strongestSubject?.latestScore ?? 90}%)
          </p>
        </button>

        <button
          onClick={() => onNavigate('assignments')}
          className="rounded-2xl border border-black/5 bg-white p-4 text-left shadow-[0_8px_24px_rgba(20,20,30,.04)] transition hover:-translate-y-0.5"
        >
          <span className="action-violet mb-3 flex size-10 items-center justify-center rounded-xl">
            <Icon name="sheet" size={19} />
          </span>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">
            Homework Status
          </p>
          <p className="mt-1 text-2xl font-black">
            {childAssignments.length - pendingHw.length}/{childAssignments.length}
          </p>
          <p className="mt-1 text-[10px] font-bold text-black/45">
            {pendingHw.length === 0 ? 'All caught up!' : `${pendingHw.length} pending due soon`}
          </p>
        </button>

        <button
          onClick={() => onNavigate('feedback')}
          className="rounded-2xl border border-black/5 bg-white p-4 text-left shadow-[0_8px_24px_rgba(20,20,30,.04)] transition hover:-translate-y-0.5"
        >
          <span className="action-lime mb-3 flex size-10 items-center justify-center rounded-xl">
            <Icon name="star" size={19} />
          </span>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">
            Teacher Remarks
          </p>
          <p className="mt-1 text-2xl font-black">{childFeedback.length}</p>
          <p className="mt-1 text-[10px] font-bold text-[#6935c3]">
            {childFeedback.filter((f) => !f.acknowledgedByGuardian).length} new unread
          </p>
        </button>

        <button
          onClick={() => onNavigate('payments')}
          className="rounded-2xl border border-black/5 bg-white p-4 text-left shadow-[0_8px_24px_rgba(20,20,30,.04)] transition hover:-translate-y-0.5"
        >
          <span className="action-orange mb-3 flex size-10 items-center justify-center rounded-xl">
            <Icon name="payment" size={19} />
          </span>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">
            School Fees Due
          </p>
          <p className="mt-1 text-2xl font-black">৳{totalDue.toLocaleString()}</p>
          <p className="mt-1 text-[10px] font-bold text-black/45">
            {totalDue > 0 ? 'Due 25 June 2026' : 'All invoices paid'}
          </p>
        </button>
      </section>

      {/* Premier English Medium Quick Strip */}
      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <button
          onClick={() => onNavigate('safety')}
          className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0f172a] text-emerald-300">
            <Icon name="shield" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black">Pickup QR & Infirmary</p>
            <p className="truncate text-[10px] font-bold text-black/45">
              Authorized gate pass · Campus Unit · Health
            </p>
          </div>
          <Icon name="chevron" size={15} className="text-black/30" />
        </button>

        <button
          onClick={() => onNavigate('house')}
          className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5"
        >
          <span className="action-violet flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Icon name="award" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black">House Points & Past Papers</p>
            <p className="truncate text-[10px] font-bold text-black/45">
              Emerald #1 · IGCSE predicted grades
            </p>
          </div>
          <Icon name="chevron" size={15} className="text-black/30" />
        </button>

        <button
          onClick={() => onNavigate('consent')}
          className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5"
        >
          <span className="action-lime flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Icon name="clipboard" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black">Consent Forms & Canteen</p>
            <p className="truncate text-[10px] font-bold text-black/45">
              1-tap e-signature · Cashless wallet
            </p>
          </div>
          <Icon name="chevron" size={15} className="text-black/30" />
        </button>
      </section>

      {/* Smart Guardian Insight Banner */}
      {weakestSubject && (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-emerald-200/80 bg-emerald-50/85 p-5 text-slate-900 shadow-xs">
          <div className="flex items-start gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f172a] text-emerald-400">
              <Icon name="spark" size={20} />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-800">
                DMHA Smart Parent Insight · {child.name}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                Strong momentum in <strong className="text-slate-950">{strongestSubject.name}</strong> ({strongestSubject.latestScore}%), while{' '}
                <strong className="text-slate-950">{weakestSubject.name}</strong> ({weakestSubject.latestScore}%) could benefit from extra review before Term Finals.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('messages')}
            className="rounded-full bg-[#0f172a] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-slate-800"
          >
            Message {weakestSubject.teacher}
          </button>
        </section>
      )}

      {/* Two-column: Teacher Feedback & Today's Period Attendance */}
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section>
          <SectionTitle
            eyebrow="Direct from teachers"
            title="Recent teacher feedback"
            action="All feedback & PTM"
            onAction={() => onNavigate('feedback')}
          />
          <div className="space-y-3">
            {childFeedback.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_8px_24px_rgba(20,20,30,.035)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FeedbackBadge category={item.category} />
                    <span className="text-[10px] font-extrabold text-black/45">
                      {item.subject} · {item.teacherName}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-black/30">{item.date}</span>
                </div>
                <h4 className="mt-2.5 text-sm font-black">{item.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-black/60">{item.message}</p>
                <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3">
                  {item.acknowledgedByGuardian ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800">
                      <Icon name="check" size={13} />
                      Acknowledged{item.guardianReply ? ' · Replied' : ''}
                    </span>
                  ) : (
                    <button
                      onClick={() => acknowledgeFeedback(item.id)}
                      className="rounded-full bg-[#0f172a] px-3.5 py-1.5 text-[10px] font-extrabold text-emerald-300"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => onNavigate('feedback')}
                    className="text-[10px] font-extrabold text-black/45 hover:text-black"
                  >
                    Reply / Book PTM →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle
            eyebrow="Period-by-period"
            title="Today’s classes & attendance"
            action="Full attendance log"
            onAction={() => onNavigate('attendance')}
          />
          <div className="space-y-2.5">
            {child.todayPeriods.map((period) => (
              <ClassCard
                key={period.id}
                item={period}
                showStatus
                onClick={() => setActivePeriod(period)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Weekly Guardian Digest Card */}
      <section className="mt-7 rounded-[26px] border border-black/6 bg-white p-5 shadow-[0_10px_28px_rgba(20,20,30,.04)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#5c8d00]">
              Automated Friday Digest · Week 24
            </p>
            <h3 className="mt-1 text-lg font-black">
              {child.name}’s Weekly School Summary
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAdmitOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-4 py-2 text-xs font-extrabold text-black transition hover:bg-black/10"
            >
              <Icon name="clipboard" size={14} />
              Admit Card PDF
            </button>
            <button
              onClick={() =>
                notify(`Weekly digest sent to ${GUARDIAN_PROFILE.email} & WhatsApp`)
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 transition hover:opacity-90"
            >
              <Icon name="send" size={14} />
              Send Digest to Email / WhatsApp
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-[#f4f5f8] p-3.5">
            <p className="text-[10px] font-extrabold uppercase text-black/40">Attendance</p>
            <p className="mt-1 text-lg font-black">{child.attendanceRate}%</p>
            <p className="text-[10px] font-bold text-[#4e7c00]">On time · {child.gateCheckIn || 'Pending'}</p>
          </div>
          <div className="rounded-2xl bg-[#f4f5f8] p-3.5">
            <p className="text-[10px] font-extrabold uppercase text-black/40">Homework</p>
            <p className="mt-1 text-lg font-black">
              {childAssignments.length - pendingHw.length}/{childAssignments.length} Done
            </p>
            <p className="text-[10px] font-bold text-black/50">
              {pendingHw.length === 0 ? 'Zero overdue tasks' : `${pendingHw.length} due this week`}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f4f5f8] p-3.5">
            <p className="text-[10px] font-extrabold uppercase text-black/40">Academic Trend</p>
            <p className="mt-1 text-lg font-black">
              {child.averageScore}% (GPA {child.gpa})
            </p>
            <p className="text-[10px] font-bold text-[#4e7c00]">
              Top: {strongestSubject?.name ?? 'Science'}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f4f5f8] p-3.5">
            <p className="text-[10px] font-extrabold uppercase text-black/40">Teacher Notes</p>
            <p className="mt-1 text-lg font-black">{childFeedback.length} Remarks</p>
            <p className="text-[10px] font-bold text-[#6935c3]">
              {childFeedback.filter((f) => f.category === 'praise').length} Praise ·{' '}
              {childFeedback.filter((f) => f.category === 'attention').length} Attention
            </p>
          </div>
        </div>
      </section>

      {reportOpen && <ReportCardModal student={child} onClose={() => setReportOpen(false)} />}
      {admitOpen && (() => {
        const evalStatus = getSemesterEvaluationStatus(child.id)
        return (
          <AdmitCardModal
            student={child}
            feesCleared={totalDue === 0}
            evaluationCleared={evalStatus.isComplete}
            evaluationProgressLabel={`Semester 5★–1★ Evaluation (${evalStatus.completedCount}/${evalStatus.requiredCount})`}
            onGoToEvaluation={() => {
              setAdmitOpen(false)
              onNavigate('feedback')
            }}
            onClose={() => setAdmitOpen(false)}
          />
        )
      })()}
      {activePeriod && (
        <PeriodDetailModal
          period={activePeriod}
          onClose={() => setActivePeriod(null)}
          onAction={() => onNavigate('schedule')}
          actionLabel="View Full Weekly Routine"
        />
      )}
    </>
  )
}

export function GuardianAttendanceView() {
  const {
    role,
    students,
    guardians,
    activeGuardianId,
    selectedChildId,
    activeStudentId,
    leaveRequests,
    submitLeaveRequest,
    addLeaveDiscussionMessage,
  } = useSchool()
  const child =
    role === 'student'
      ? students.find((s) => s.id === activeStudentId) || students[0]
      : students.find((s) => s.id === selectedChildId) || students[0]
  const activeGuardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]

  const todayIso = getTodayIso()
  const [dateRange, setDateRange] = useState(formatPrettyDate(todayIso))
  const [reason, setReason] = useState('')
  const [leaveReplyDrafts, setLeaveReplyDrafts] = useState<Record<string, string>>({})
  const [activePeriod, setActivePeriod] = useState<PeriodSlot | null>(null)
  const [biometricGateOpen, setBiometricGateOpen] = useState(false)

  // Previous daily attendance history (from SQLite dmhs_attendance_records)
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('ALL')
  const [historyMonth, setHistoryMonth] = useState<string>('ALL')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [attendanceHistory, setAttendanceHistory] = useState<
    Array<{
      id: string
      attendanceDate: string
      status: AttendanceStatus
      classLabel: string
      markedByName: string
      markedAt: string
    }>
  >([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    let active = true
    setLoadingHistory(true)
    const qs = new URLSearchParams({ studentId: child.id })
    if (historyDateFilter !== 'ALL') {
      qs.set('date', historyDateFilter)
    } else if (historyMonth !== 'ALL') {
      qs.set('month', historyMonth)
    }
    fetch(`/dmhs-api/attendance?${qs.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          json: {
            ok?: boolean
            records?: Array<{
              id: string
              attendanceDate: string
              status: AttendanceStatus
              classLabel: string
              markedByName: string
              markedAt: string
            }>
            availableMonths?: string[]
          } | null,
        ) => {
          if (!active || !json?.ok) return
          setAttendanceHistory(json.records || [])
          if (Array.isArray(json.availableMonths)) {
            setAvailableMonths(json.availableMonths)
          }
        },
      )
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingHistory(false)
      })
    return () => {
      active = false
    }
  }, [child.id, historyDateFilter, historyMonth])

  const childLeaves = leaveRequests.filter((l) => l.studentId === child.id)
  const requireBiometric = role === 'guardian' && activeGuardian?.biometricRequired !== false

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    if (requireBiometric) {
      setBiometricGateOpen(true)
      return
    }
    submitLeaveRequest({ studentId: child.id, dateRange, reason })
    setReason('')
  }

  return (
    <PageShell
      eyebrow="Safety & presence"
      title={`${child.name}’s Attendance & History`}
      subtitle="Live campus gate check-ins, SQLite previous-day attendance records, period status, and guardian leave applications."
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] bg-[#0f172a] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/45">
            Today’s Gate Check-In
          </p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-2xl font-black text-emerald-300">{child.gateCheckIn || 'Not Checked In'}</p>
            <AttendanceBadge status={child.todayStatus} />
          </div>
          <p className="mt-2 text-[11px] text-white/50">{child.busRoute}</p>
        </div>

        <div className="rounded-[24px] bg-white p-5 shadow-[0_8px_24px_rgba(20,20,30,.04)]">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">
            Term Attendance Rate
          </p>
          <p className="mt-2 text-3xl font-black">{child.attendanceRate}%</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/6">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${child.attendanceRate}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] font-bold text-black/45">
            {child.presentDays} present · {child.totalDays - child.presentDays} absent/leave out of{' '}
            {child.totalDays} days
          </p>
        </div>

        <div className="rounded-[24px] bg-white p-5 shadow-[0_8px_24px_rgba(20,20,30,.04)]">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">
            Instant Alert Rules
          </p>
          <p className="mt-2 text-sm font-black">SMS & App Push Active</p>
          <p className="mt-1 text-xs leading-relaxed text-black/50">
            Automatic alert sent to {child.guardianPhone} if {child.name.split(' ')[0]} is marked
            absent or late during roll call.
          </p>
        </div>
      </div>

      {/* SQLite Previous-Day Attendance History */}
      <section className="mt-7 rounded-[26px] border border-black/6 bg-white p-5 shadow-[0_8px_24px_rgba(20,20,30,.04)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#5c8d00]">
              SQLite Daily Register History
            </p>
            <h3 className="text-base font-black text-slate-900">
              Previous Attendance Records ({attendanceHistory.length})
            </h3>
          </div>
          {availableMonths.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setHistoryDateFilter('ALL')
                  setHistoryMonth('ALL')
                }}
                className={`rounded-full px-3 py-1 text-[10px] font-extrabold transition ${
                  historyMonth === 'ALL' && historyDateFilter === 'ALL'
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Months
              </button>
              {availableMonths.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setHistoryDateFilter('ALL')
                    setHistoryMonth(m)
                  }}
                  className={`rounded-full px-3 py-1 text-[10px] font-extrabold transition ${
                    historyMonth === m && historyDateFilter === 'ALL'
                      ? 'bg-[#0f172a] text-emerald-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <DateFilterBar
          value={historyDateFilter}
          onChange={(next) => {
            setHistoryDateFilter(next)
            if (next !== 'ALL') setHistoryMonth('ALL')
          }}
          allowAll
          compact
          label="Check Date"
          savedDates={attendanceHistory.map((r) => r.attendanceDate).slice(0, 5)}
        />

        <div className="mt-4 space-y-2">
          {loadingHistory ? (
            <div className="rounded-2xl bg-slate-50 py-6 text-center text-xs font-bold text-slate-400">
              Loading SQLite attendance history...
            </div>
          ) : attendanceHistory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-6 text-center text-xs font-semibold text-slate-400">
              No roll call record found for {child.name} on{' '}
              {historyDateFilter === 'ALL' ? 'this period' : formatPrettyDate(historyDateFilter)}.
            </div>
          ) : (
            attendanceHistory.slice(0, 14).map((rec) => (
              <div
                key={rec.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
              >
                <div>
                  <p className="text-xs font-black text-slate-900">
                    {formatPrettyDate(rec.attendanceDate)}
                    {rec.attendanceDate === todayIso && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">
                        TODAY
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                    {rec.classLabel} · Marked by {rec.markedByName}
                  </p>
                </div>
                <AttendanceBadge status={rec.status} />
              </div>
            ))
          )}
        </div>
      </section>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section>
          <SectionTitle
            eyebrow={`Today · ${formatPrettyDate(todayIso)}`}
            title="Period-by-period attendance"
          />
          <div className="space-y-2.5">
            {child.todayPeriods.map((period) => (
              <ClassCard
                key={period.id}
                item={period}
                showStatus
                onClick={() => setActivePeriod(period)}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="Guardian request" title="Apply for student leave" />
          <form
            onSubmit={handleLeaveSubmit}
            className="rounded-[24px] bg-white p-5 shadow-[0_8px_24px_rgba(20,20,30,.04)]"
          >
            <label className="block text-[11px] font-extrabold text-black/60">
              Leave Date(s)
              <input
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-bold outline-none focus:border-black"
                placeholder="e.g., 19–20 June 2026"
              />
            </label>
            <label className="mt-3 block text-[11px] font-extrabold text-black/60">
              Reason for Absence
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-black"
                placeholder="Medical appointment, family travel, or illness..."
              />
            </label>
            <button
              type="submit"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f172a] py-3 text-xs font-extrabold text-emerald-300 transition hover:opacity-90"
            >
              <Icon name="shield" size={14} />
              {requireBiometric
                ? 'Verify Biometric & Send Leave Application'
                : 'Send Leave Application to Class Teacher'}
            </button>
          </form>

          {childLeaves.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">
                Recent Applications
              </p>
              {childLeaves.map((lv) => {
                const thread = lv.messages || []
                const draftText = leaveReplyDrafts[lv.id] || ''
                return (
                  <div key={lv.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-black">{lv.dateRange}</p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold capitalize ${
                          lv.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-800'
                            : lv.status === 'declined'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-[#fff2d6] text-[#9a6200]'
                        }`}
                      >
                        {lv.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-black/55">{lv.reason}</p>
                    {lv.verification && (
                      <div className="mt-2">
                        <VerificationSealBadge verification={lv.verification} />
                      </div>
                    )}

                    {/* Inline Discussion with Class Teacher */}
                    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Discussion with Teacher ({thread.length})
                      </p>
                      {thread.length > 0 && (
                        <div className="mt-2 max-h-36 space-y-2 overflow-y-auto pr-1">
                          {thread.map((m) => {
                            const isMine = m.senderRole === role
                            return (
                              <div
                                key={m.id}
                                className={`max-w-[90%] rounded-xl px-3 py-2 text-[11px] ${
                                  isMine
                                    ? 'ml-auto bg-[#0f172a] text-white'
                                    : 'bg-white text-slate-800 shadow-2xs ring-1 ring-slate-200/70'
                                }`}
                              >
                                <p
                                  className={`text-[9px] font-extrabold ${
                                    isMine ? 'text-emerald-300' : 'text-emerald-700'
                                  }`}
                                >
                                  {m.sender} · {m.time}
                                </p>
                                <p className="mt-0.5 leading-relaxed">{m.text}</p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {role === 'guardian' && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()
                            if (!draftText.trim()) return
                            addLeaveDiscussionMessage(lv.id, draftText)
                            setLeaveReplyDrafts((prev) => ({ ...prev, [lv.id]: '' }))
                          }}
                          className="mt-2.5 flex gap-2"
                        >
                          <input
                            value={draftText}
                            onChange={(e) =>
                              setLeaveReplyDrafts((prev) => ({ ...prev, [lv.id]: e.target.value }))
                            }
                            placeholder="Write a note or reply to the teacher..."
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-800 outline-none focus:border-emerald-500"
                          />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-xl bg-[#0f172a] px-3.5 py-2 text-[11px] font-extrabold text-emerald-300 transition hover:bg-slate-800"
                          >
                            <Icon name="send" size={12} />
                            Send
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <GuardianBiometricGateModal
        open={biometricGateOpen}
        actionTitle="Confirm Absent / Leave Application"
        actionDescription={`Requesting official leave for ${child.name} (${dateRange}) — Reason: "${reason}"`}
        onVerified={(stamp) => {
          submitLeaveRequest({ studentId: child.id, dateRange, reason, verification: stamp })
          setReason('')
          setBiometricGateOpen(false)
        }}
        onClose={() => setBiometricGateOpen(false)}
      />

      {activePeriod && (
        <PeriodDetailModal period={activePeriod} onClose={() => setActivePeriod(null)} />
      )}
    </PageShell>
  )
}

export function GuardianResultsView({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { students, selectedChildId } = useSchool()
  const [reportOpen, setReportOpen] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<SubjectProgress | null>(null)
  const child = students.find((s) => s.id === selectedChildId) || students[0]

  return (
    <PageShell
      eyebrow="Academic performance"
      title={`${child.name}’s Results & Growth`}
      subtitle="Track term scores, subject-wise progress trends, and official report cards."
      action={
        <button
          onClick={() => setReportOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-5 py-3 text-xs font-extrabold text-emerald-300 transition hover:opacity-90"
        >
          <Icon name="download" size={15} />
          Official Report Card
        </button>
      }
    >
      <ChildSwitcherBar />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] bg-[#0f172a] p-6 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/40">
            Cumulative GPA
          </p>
          <p className="mt-2 text-4xl font-black text-emerald-300">{child.gpa}</p>
          <p className="mt-1 text-xs text-white/50">Out of 5.00 · Honor Roll Eligible</p>
        </div>
        <div className="rounded-[24px] bg-white p-6 shadow-[0_8px_24px_rgba(20,20,30,.04)]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-black/35">
            Term Average
          </p>
          <p className="mt-2 text-4xl font-black">{child.averageScore}%</p>
          <p className="mt-1 text-xs font-bold text-[#4e7c00]">Across {child.subjects.length} subjects</p>
        </div>
        <div className="rounded-[24px] bg-white p-6 shadow-[0_8px_24px_rgba(20,20,30,.04)]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-black/35">
            Class Position
          </p>
          <p className="mt-2 text-4xl font-black">{child.rank}</p>
          <p className="mt-1 text-xs font-bold text-black/45">
            {child.className} · {child.section}
          </p>
        </div>
      </div>

      <section className="mt-7">
        <SectionTitle eyebrow="Subject breakdown" title="Score comparison vs. previous term" />
        <div className="grid gap-4 sm:grid-cols-2">
          {child.subjects.map((sub) => {
            const delta = sub.latestScore - sub.previousScore
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSubject(sub)}
                className="dmhs-card rounded-[24px] p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-base font-black text-slate-900">{sub.name}</h4>
                    <p className="text-xs font-semibold text-slate-500">{sub.teacher}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900">{sub.latestScore}%</span>
                    <span className="ml-2 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
                      {sub.grade}
                    </span>
                  </div>
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      sub.latestScore >= 85
                        ? 'bg-emerald-500'
                        : sub.latestScore >= 75
                          ? 'bg-[#0f172a]'
                          : 'bg-rose-500'
                    }`}
                    style={{ width: `${sub.latestScore}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-400">Previous: {sub.previousScore}%</span>
                  <span className={delta >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                    {delta >= 0 ? `▲ +${delta}% improved` : `▼ ${delta}% needs review`} · Details →
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {reportOpen && <ReportCardModal student={child} onClose={() => setReportOpen(false)} />}
      {selectedSubject && (
        <SubjectDetailModal
          subject={selectedSubject}
          studentName={child.name}
          onClose={() => setSelectedSubject(null)}
          onOpenScripts={onNavigate ? () => onNavigate('scripts') : undefined}
          onMessageTeacher={onNavigate ? () => onNavigate('messages') : undefined}
        />
      )}
    </PageShell>
  )
}

export function GuardianFeedbackView() {
  const {
    students,
    teachers,
    selectedChildId,
    feedback,
    acknowledgeFeedback,
    ptmRequests,
    bookPTM,
  } = useSchool()
  const child = students.find((s) => s.id === selectedChildId) || students[0]
  const activeTeachers = teachers.filter((t) => t.status === 'active')

  const [filter, setFilter] = useState<'all' | FeedbackCategory>('all')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [ptmTeacher, setPtmTeacher] = useState(
    activeTeachers[0]?.name || child.subjects[0]?.teacher || 'Nadia Rahman',
  )
  const [ptmSlot, setPtmSlot] = useState('Saturday · 11:00 AM (Campus / Video)')
  const [ptmTopic, setPtmTopic] = useState('')

  const items = feedback
    .filter((f) => f.studentId === child.id)
    .filter((f) => (filter === 'all' ? true : f.category === filter))

  const childPTMs = ptmRequests.filter((p) => p.studentId === child.id)

  const handleBookPTM = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ptmTopic.trim()) return
    const sub = child.subjects.find((s) => s.teacher === ptmTeacher)?.name || 'General'
    bookPTM({
      studentId: child.id,
      teacherName: ptmTeacher,
      subject: sub,
      slot: ptmSlot,
      topic: ptmTopic,
    })
    setPtmTopic('')
  }

  return (
    <PageShell
      eyebrow="Teacher-parent partnership"
      title={`Teacher Feedback for ${child.name}`}
      subtitle="Read classroom observations, reply directly to teachers, and schedule Parent-Teacher Meetings."
    >
      <ChildSwitcherBar />

      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ['all', 'All Remarks'],
            ['praise', 'Praise'],
            ['academic', 'Academic'],
            ['behavior', 'Conduct'],
            ['attention', 'Needs Attention'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
              filter === key
                ? 'bg-[#0f172a] text-emerald-300'
                : 'bg-white text-black/55 hover:bg-black/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-3.5">
          {items.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center text-xs font-bold text-black/40">
              No feedback entries match this filter.
            </div>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(20,20,30,.04)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FeedbackBadge category={item.category} />
                    <span className="text-xs font-extrabold text-black/50">
                      {item.subject} · {item.teacherName}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-black/30">{item.date}</span>
                </div>

                <h3 className="mt-3 text-base font-black">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-6 text-black/65">{item.message}</p>

                {item.guardianReply && (
                  <div className="mt-3 rounded-xl bg-[#f4f5f8] p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">
                      Your Reply
                    </p>
                    <p className="mt-1 text-xs font-semibold text-black/80">{item.guardianReply}</p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/6 pt-4">
                  <input
                    value={replyDrafts[item.id] || ''}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="Write a quick note back to the teacher..."
                    className="min-w-[180px] flex-1 rounded-xl bg-[#f4f5f8] px-3.5 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-black/15"
                  />
                  <button
                    onClick={() => {
                      acknowledgeFeedback(item.id, replyDrafts[item.id])
                      setReplyDrafts((prev) => ({ ...prev, [item.id]: '' }))
                    }}
                    className="rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300"
                  >
                    {replyDrafts[item.id]?.trim() ? 'Send Reply' : 'Acknowledge'}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <aside>
          <SectionTitle eyebrow="1-on-1 meeting" title="Book Parent-Teacher Meeting" />
          <form
            onSubmit={handleBookPTM}
            className="rounded-[24px] bg-white p-5 shadow-[0_8px_24px_rgba(20,20,30,.04)]"
          >
            <label className="block text-[11px] font-extrabold text-black/60">
              Select Teacher
              <select
                value={ptmTeacher}
                onChange={(e) => setPtmTeacher(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
              >
                {activeTeachers.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name} ({t.subject})
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-[11px] font-extrabold text-black/60">
              Preferred Slot
              <select
                value={ptmSlot}
                onChange={(e) => setPtmSlot(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
              >
                <option>Saturday · 10:00 AM (Campus)</option>
                <option>Saturday · 11:00 AM (Campus / Video)</option>
                <option>Sunday · 02:30 PM (Online Video)</option>
              </select>
            </label>

            <label className="mt-3 block text-[11px] font-extrabold text-black/60">
              Discussion Topic
              <textarea
                rows={2}
                value={ptmTopic}
                onChange={(e) => setPtmTopic(e.target.value)}
                placeholder="e.g., Mid-term progress or exam preparation..."
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f4f5f8] px-3 py-2.5 text-xs font-semibold outline-none"
              />
            </label>

            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-emerald-400 py-3 text-xs font-black text-black transition hover:brightness-95"
            >
              Confirm PTM Slot
            </button>
          </form>

          {childPTMs.length > 0 && (
            <div className="mt-5 space-y-2.5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">
                Scheduled Meetings
              </p>
              {childPTMs.map((ptm) => (
                <div key={ptm.id} className="rounded-2xl bg-[#0f172a] p-4 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-300">{ptm.teacherName}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase">
                      {ptm.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-white/80">{ptm.slot}</p>
                  <p className="mt-1 text-[11px] text-white/50">{ptm.topic}</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </PageShell>
  )
}
