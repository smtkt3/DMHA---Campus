'use client'

import React, { useState } from 'react'
import type {
  NotificationSoundPrefs,
  NotificationSoundPreset,
} from './floating-notifications'
import { Icon, type IconName } from './icons'
import type {
  AttendanceStatus,
  FeedbackCategory,
  FeeInvoice,
  NotificationItem,
  PeriodSlot,
  Role,
  StudentRecord,
  SubjectProgress,
} from './types'

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`relative flex size-10 items-center justify-center rounded-xl shadow-sm ${
          dark
            ? 'bg-[#0f172a] text-emerald-400 ring-1 ring-slate-900/10'
            : 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 shadow-emerald-500/20'
        }`}
      >
        <Icon name="shield" size={20} />
      </span>
      <div>
        <span className="flex items-center gap-1.5 text-lg font-black leading-none tracking-[-.03em]">
          DMHA
          <span
            className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
              dark
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-emerald-500/15 text-emerald-300'
            }`}
          >
            OS
          </span>
        </span>
        <span
          className={`mt-1 block text-[9px] font-bold uppercase tracking-[.16em] ${
            dark ? 'text-slate-400' : 'text-slate-400'
          }`}
        >
          Smart Learning App
        </span>
      </div>
    </div>
  )
}

export function PageShell({
  eyebrow,
  title,
  subtitle,
  action,
  children,
}: {
  eyebrow: string
  title: string
  subtitle: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="dmhs-fade w-full">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/75 pb-5">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-emerald-700">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-.03em] text-slate-900 sm:text-3xl">
            {title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm font-medium text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function SectionTitle({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="mb-3.5 flex items-end justify-between">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
          {eyebrow}
        </p>
        <h3 className="mt-0.5 text-lg font-extrabold tracking-[-.02em] text-slate-900">{title}</h3>
      </div>
      {action && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
        >
          {action}
          <Icon name="arrow" size={14} />
        </button>
      )}
    </div>
  )
}

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const styles: Record<AttendanceStatus, string> = {
    present: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15',
    late: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/15',
    absent: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/15',
    leave: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/15',
  }
  const labels: Record<AttendanceStatus, string> = {
    present: 'Present',
    late: 'Late Arrival',
    absent: 'Absent',
    leave: 'On Leave',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {labels[status]}
    </span>
  )
}

export function FeedbackBadge({ category }: { category: FeedbackCategory }) {
  const map: Record<FeedbackCategory, { cls: string; label: string }> = {
    praise: { cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15', label: 'Praise' },
    academic: { cls: 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/15', label: 'Academic' },
    behavior: { cls: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/15', label: 'Conduct' },
    attention: { cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/15', label: 'Needs Attention' },
  }
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${map[category].cls}`}>
      {map[category].label}
    </span>
  )
}

export function CalendarStrip({
  selected,
  onSelect,
}: {
  selected: number
  onSelect: (day: number) => void
}) {
  const days: [string, number][] = [
    ['Sun', 15],
    ['Mon', 16],
    ['Tue', 17],
    ['Wed', 18],
    ['Thu', 19],
    ['Fri', 20],
    ['Sat', 21],
  ]
  return (
    <div className="grid grid-cols-7 gap-1.5 rounded-2xl bg-white p-2 shadow-[0_6px_20px_rgba(20,20,30,.03)]">
      {days.map(([name, date], i) => (
        <button
          key={name}
          onClick={() => onSelect(i)}
          className={`rounded-xl py-2.5 text-center transition ${
            selected === i ? 'bg-[#0f172a] text-white shadow-lg' : 'hover:bg-black/[.03]'
          }`}
        >
          <span
            className={`block text-[8px] font-extrabold uppercase ${
              selected === i ? 'text-white/45' : 'text-black/30'
            }`}
          >
            {name}
          </span>
          <span className="mt-1 block text-xs font-black">{date}</span>
          {i === 3 && (
            <span
              className={`mx-auto mt-1 block size-1 rounded-full ${
                selected === i ? 'bg-emerald-400' : 'bg-emerald-500'
              }`}
            />
          )}
        </button>
      ))}
    </div>
  )
}

export function ClassCard({
  item,
  onClick,
  showStatus = false,
}: {
  item: PeriodSlot
  onClick?: () => void
  showStatus?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-[0_7px_24px_rgba(20,20,30,.035)] transition hover:-translate-y-0.5"
    >
      <div className="w-12 shrink-0 text-center">
        <span className="block text-xs font-black">{item.time}</span>
        <span className="text-[9px] font-semibold text-black/30">{item.end}</span>
      </div>
      <span className={`h-11 w-1 rounded-full bar-${item.color === 'orange' ? 'violet' : item.color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-xs font-black">{item.subject}</span>
          {showStatus && item.status && <AttendanceBadge status={item.status} />}
        </div>
        <p className="mt-1 truncate text-[10px] text-black/45">
          {item.topic} · {item.teacher}
        </p>
      </div>
      <div className="hidden items-center gap-1 text-[10px] font-bold text-black/40 sm:flex">
        <Icon name="profile" size={13} />
        {item.room}
      </div>
      <span className="flex size-8 items-center justify-center rounded-full bg-black/[.035] transition group-hover:bg-emerald-400">
        <Icon name="chevron" size={14} />
      </span>
    </button>
  )
}

export function NotificationsDrawer({
  role,
  notifications,
  onMarkAllRead,
  onSelectNotification,
  soundPrefs,
  onUpdateSoundPrefs,
  onTestFloatingAlert,
  onClose,
}: {
  role: Role
  notifications: NotificationItem[]
  onMarkAllRead: () => void
  onSelectNotification?: (item: NotificationItem) => void
  soundPrefs?: NotificationSoundPrefs
  onUpdateSoundPrefs?: (next: NotificationSoundPrefs) => void
  onTestFloatingAlert?: () => void
  onClose: () => void
}) {
  const visible = notifications.filter((n) => n.forRoles.includes(role))
  const [pushPerm, setPushPerm] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? window.Notification.permission
      : 'unsupported',
  )
  const iconFor = (type: NotificationItem['type']): IconName => {
    if (type === 'attendance' || type === 'pickup') return 'shield'
    if (type === 'health') return 'heart'
    if (type === 'merit') return 'award'
    if (type === 'result') return 'exam'
    if (type === 'feedback') return 'star'
    if (type === 'fee') return 'payment'
    return 'bell'
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 flex h-full w-[min(92vw,410px)] flex-col bg-[#f7f7f8] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-black/35">
              Live School Alerts
            </p>
            <h2 className="text-xl font-black">Notifications</h2>
          </div>
          <button
            aria-label="Close notifications"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Floating Alert & Sound Controls */}
        {soundPrefs && onUpdateSoundPrefs && (
          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                  Floating Alerts &amp; Sound
                </p>
                <p className="text-[11px] font-semibold text-slate-500">
                  Pop-up banner + chime on live school updates
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSoundPrefs({ ...soundPrefs, enabled: !soundPrefs.enabled })
                }
                className={`rounded-full px-3 py-1 text-[11px] font-black transition ${
                  soundPrefs.enabled
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {soundPrefs.enabled ? 'Sound ON' : 'Muted'}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {(['chime', 'bell', 'pop'] as NotificationSoundPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onUpdateSoundPrefs({ ...soundPrefs, preset, enabled: true })}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold capitalize transition ${
                      soundPrefs.preset === preset
                        ? 'bg-[#0f172a] text-emerald-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {onTestFloatingAlert && (
                <button
                  type="button"
                  onClick={onTestFloatingAlert}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-[10px] font-black text-white transition hover:bg-emerald-700"
                >
                  Test Sound Alert
                </button>
              )}
            </div>

            {pushPerm !== 'unsupported' && (
              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[10px]">
                <span className="font-semibold text-slate-500">
                  Background Desktop Alert:{' '}
                  <strong className="text-slate-700">
                    {pushPerm === 'granted' && soundPrefs.browserPush
                      ? 'Active'
                      : pushPerm === 'denied'
                        ? 'Blocked in browser'
                        : 'Off'}
                  </strong>
                </span>
                {pushPerm !== 'denied' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof window === 'undefined' || !('Notification' in window)) return
                      if (pushPerm === 'granted') {
                        onUpdateSoundPrefs({
                          ...soundPrefs,
                          browserPush: !soundPrefs.browserPush,
                        })
                        return
                      }
                      const res = await window.Notification.requestPermission()
                      setPushPerm(res)
                      if (res === 'granted') {
                        onUpdateSoundPrefs({ ...soundPrefs, browserPush: true })
                      }
                    }}
                    className="font-extrabold text-emerald-700 hover:underline"
                  >
                    {pushPerm === 'granted' && soundPrefs.browserPush ? 'Disable' : 'Enable'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onMarkAllRead}
          className="mt-3 w-full rounded-xl bg-[#0f172a] py-3 text-xs font-black text-emerald-300 transition hover:bg-slate-800"
        >
          Mark all as read
        </button>
        <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto pr-1">
          {visible.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center text-xs font-bold text-black/40">
              No notifications yet for this workspace.
            </div>
          ) : (
            visible.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelectNotification?.(item)}
                className={`group flex w-full gap-3 rounded-2xl border border-transparent bg-white p-4 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50/35 ${
                  item.read ? 'opacity-65 hover:opacity-100' : ''
                }`}
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                    item.type === 'attendance'
                      ? 'bg-[#ffe7df] text-[#d24b28]'
                      : item.type === 'feedback'
                        ? 'bg-[#eee5ff] text-[#6935c3]'
                        : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <Icon name={iconFor(item.type)} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-black text-slate-900">{item.title}</p>
                    {!item.read && <span className="size-2 shrink-0 rounded-full bg-[#ff6846]" />}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-black/60">{item.text}</p>
                  <div className="mt-2 flex items-center justify-between text-[9px] font-bold">
                    <span className="text-black/35">{item.time}</span>
                    <span className="text-emerald-700 opacity-75 transition group-hover:opacity-100">
                      Open →
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  )
}

export function ReportCardModal({
  student,
  onClose,
}: {
  student: StudentRecord
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/8 pb-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#5c8d00]">
              Official Academic Transcript · Mid-Term 2026
            </p>
            <h3 className="mt-1 text-2xl font-black">DMHA · Smart Learning App</h3>
            <p className="mt-1 text-xs font-semibold text-black/50">
              {student.name} · {student.className} ({student.section}) · Roll #{student.roll}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-black/5 hover:bg-black/10"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-[#0f172a] p-4 text-white">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">Term GPA</p>
            <p className="mt-1 text-2xl font-black text-emerald-300">{student.gpa}</p>
          </div>
          <div className="rounded-2xl bg-[#f4f5f8] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-black/45">
              Average Score
            </p>
            <p className="mt-1 text-2xl font-black">{student.averageScore}%</p>
          </div>
          <div className="rounded-2xl bg-[#f4f5f8] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-black/45">
              Class Rank & Attendance
            </p>
            <p className="mt-1 text-2xl font-black">
              {student.rank} · {student.attendanceRate}%
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-black/8">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f5f8] text-[10px] font-extrabold uppercase tracking-wider text-black/45">
              <tr>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3 text-right">Prev</th>
                <th className="px-4 py-3 text-right">Current</th>
                <th className="px-4 py-3 text-right">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6">
              {student.subjects.map((sub) => {
                const delta = sub.latestScore - sub.previousScore
                return (
                  <tr key={sub.id}>
                    <td className="px-4 py-3 font-extrabold">{sub.name}</td>
                    <td className="px-4 py-3 text-black/55">{sub.teacher}</td>
                    <td className="px-4 py-3 text-right text-black/45">{sub.previousScore}%</td>
                    <td className="px-4 py-3 text-right font-black">
                      {sub.latestScore}%{' '}
                      <span
                        className={`ml-1 text-[10px] ${delta >= 0 ? 'text-[#528500]' : 'text-[#c53219]'}`}
                      >
                        ({delta >= 0 ? `+${delta}` : delta})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                        {sub.grade}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold text-black/45">
            Guardian: {student.guardianName} · Verified by Academic Office
          </p>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-emerald-300 transition hover:opacity-90"
          >
            <Icon name="download" size={15} />
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdmitCardModal({
  student,
  feesCleared,
  evaluationCleared = true,
  evaluationProgressLabel,
  onGoToEvaluation,
  onClose,
}: {
  student: StudentRecord
  feesCleared: boolean
  evaluationCleared?: boolean
  evaluationProgressLabel?: string
  onGoToEvaluation?: () => void
  onClose: () => void
}) {
  const canPrint = feesCleared && evaluationCleared
  const examSchedule = [
    { date: '05 July 2026', time: '09:00 AM', subject: student.subjects[0]?.name || 'Mathematics', room: 'Main Exam Hall · Seat B-14' },
    { date: '07 July 2026', time: '09:00 AM', subject: student.subjects[1]?.name || 'Physics', room: 'Main Exam Hall · Seat B-14' },
    { date: '09 July 2026', time: '09:00 AM', subject: student.subjects[2]?.name || 'Chemistry', room: 'Science Wing · Room 204' },
    { date: '11 July 2026', time: '09:00 AM', subject: student.subjects[3]?.name || 'English Language', room: 'Main Exam Hall · Seat B-14' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/8 pb-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#5c8d00]">
              Official Exam Admit Card · Term Final 2026
            </p>
            <h3 className="mt-1 text-2xl font-black">DMHA · Smart Learning App</h3>
            <p className="mt-1 text-xs font-semibold text-black/50">
              Smart Learning & Cambridge Track
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-black/5 hover:bg-black/10"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#0f172a] p-5 text-white">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-400 text-lg font-black text-black">
              {student.initials}
            </span>
            <div>
              <p className="text-lg font-black">{student.name}</p>
              <p className="text-xs text-white/60">
                {student.className} · {student.section} · Roll #{student.roll}
              </p>
              <p className="mt-0.5 text-[11px] text-white/45">
                Guardian: {student.guardianName}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-right">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black ${
                feesCleared ? 'bg-emerald-500 text-slate-950' : 'bg-rose-50 text-rose-700'
              }`}
            >
              <Icon name={feesCleared ? 'check' : 'alert'} size={12} />
              {feesCleared ? 'Fees Cleared · Verified' : 'Pending Fee Clearance'}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black ${
                evaluationCleared ? 'bg-emerald-400 text-slate-950' : 'bg-amber-300 text-slate-950'
              }`}
            >
              <Icon name={evaluationCleared ? 'star' : 'lock'} size={12} />
              {evaluationCleared
                ? '5★–1★ Evaluation Cleared'
                : evaluationProgressLabel || 'Semester 5★–1★ Evaluation Pending'}
            </span>
            <p className="mt-1 font-mono text-[10px] text-white/50">
              ADMIT ID: DMHA-2026-{student.roll}09
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-black/8">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f5f8] text-[10px] font-extrabold uppercase tracking-wider text-black/45">
              <tr>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Hall & Seat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6">
              {examSchedule.map((row) => (
                <tr key={row.date}>
                  <td className="px-4 py-3 font-bold">
                    {row.date} · <span className="text-black/50">{row.time}</span>
                  </td>
                  <td className="px-4 py-3 font-black">{row.subject}</td>
                  <td className="px-4 py-3 text-black/55">{row.room}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!evaluationCleared && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
            <div>
              <p className="font-black">
                Complete End-of-Semester 5★ to 1★ Evaluation Before Download
              </p>
              <p className="mt-0.5 text-[11px] text-amber-900/80">
                {evaluationProgressLabel || 'Rate your subject teachers (5★–1★)'} to unlock the
                official Term Final Admit Card PDF.
              </p>
            </div>
            {onGoToEvaluation && (
              <button
                type="button"
                onClick={onGoToEvaluation}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-[11px] font-black text-emerald-300 hover:bg-slate-800"
              >
                <Icon name="star" size={13} />
                Evaluate Now →
              </button>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold text-black/45">
            Students must arrive 15 minutes prior to exam start with school ID.
          </p>
          <button
            type="button"
            disabled={!canPrint}
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-emerald-300 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="download" size={15} />
            {canPrint
              ? 'Print / Save Admit Card PDF'
              : !evaluationCleared
                ? 'Complete 5★–1★ Evaluation to Unlock'
                : 'Clear Tuition Fee to Unlock'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function FeeReceiptModal({
  invoice,
  guardianName,
  studentClass,
  campusUnit,
  onClose,
}: {
  invoice: FeeInvoice
  guardianName: string
  studentClass?: string
  campusUnit?: string
  onClose: () => void
}) {
  const isPaid = invoice.status === 'paid'
  const siblingMatch = invoice.title.match(/(\d+%\s*Sibling Discount[^)]*)/i)
  const siblingTag = siblingMatch ? siblingMatch[1] : null
  const cleanTitle = siblingTag
    ? invoice.title.replace(/\s*\([^)]*Sibling Discount[^)]*\)/i, '').trim()
    : invoice.title
  const docCode = invoice.receiptNo || `DMHA-INV-${invoice.id.slice(-6).toUpperCase()}`

  return (
    <div
      className="dmhs-print-receipt fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="dmhs-print-receipt-card w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"
      >
        {/* Official DMHA Institutional Letterhead */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f172a] text-lg font-black text-emerald-400">
              D
            </div>
            <div>
              <p
                className={`text-[10px] font-black uppercase tracking-[.18em] ${
                  isPaid ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {isPaid ? 'Official Tuition Payment Receipt' : 'Official Fee Demand Challan'}
              </p>
              <h3 className="mt-0.5 text-lg font-black text-slate-900">
                DMHA · Smart Learning App
              </h3>
              <p className="text-[11px] font-semibold text-slate-500">
                English Medium School · Pre-Play – Class 6 · {campusUnit || 'Unit - 1 & Unit - 2'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="dmhs-no-print flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Amount & Stamp Box */}
        <div
          className={`mt-5 rounded-2xl border p-4 ${
            isPaid
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-amber-200 bg-amber-50/70'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              {isPaid ? 'Total Amount Settled' : 'Total Payable Balance'}
            </span>
            <span
              className={`rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                isPaid
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-600 text-white'
              }`}
            >
              {isPaid ? 'PAID IN FULL' : 'PAYMENT DUE'}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-3xl font-black text-slate-950">
              ৳{invoice.amount.toLocaleString()}
            </p>
            <span className="rounded-lg bg-white/80 px-2.5 py-1 text-[10px] font-extrabold text-slate-600 ring-1 ring-slate-200">
              {invoice.category || 'Tuition Fee'}
            </span>
          </div>
          <p className="mt-1 text-xs font-bold text-slate-700">{cleanTitle}</p>
          {siblingTag && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-black text-indigo-800">
              <Icon name="award" size={12} />
              Automatic Multi-Child Benefit Applied: {siblingTag}
            </p>
          )}
        </div>

        {/* Structured Receipt / Challan Details */}
        <dl className="mt-5 grid gap-2.5 text-xs sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
            <dt className="text-[10px] font-bold uppercase text-slate-400">
              {isPaid ? 'Receipt Number' : 'Challan / Invoice Ref'}
            </dt>
            <dd className="mt-0.5 font-mono font-black text-slate-900">{docCode}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
            <dt className="text-[10px] font-bold uppercase text-slate-400">
              {isPaid ? 'Settlement Date' : 'Payment Due Date'}
            </dt>
            <dd className="mt-0.5 font-black text-slate-900">
              {isPaid ? invoice.paidAt || 'Verified Today' : invoice.dueDate}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
            <dt className="text-[10px] font-bold uppercase text-slate-400">Student Name</dt>
            <dd className="mt-0.5 font-black text-slate-900">
              {invoice.studentName}
              {studentClass ? (
                <span className="ml-1.5 font-semibold text-slate-500">({studentClass})</span>
              ) : null}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
            <dt className="text-[10px] font-bold uppercase text-slate-400">Guardian</dt>
            <dd className="mt-0.5 font-bold text-slate-900">{guardianName}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 sm:col-span-2">
            <dt className="text-[10px] font-bold uppercase text-slate-400">Payment Channel</dt>
            <dd className="mt-0.5 font-bold text-slate-800">
              {isPaid
                ? 'DMHA Verified Accounts Ledger (bKash / Nagad / Card / Campus Desk)'
                : 'Pay via bKash, Nagad, SSLCommerz Card in DMHA App, or Campus Accounts Office'}
            </dd>
          </div>
        </dl>

        {/* Official Stamp Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-dashed border-slate-200 pt-3.5 text-[10px] font-bold text-slate-400">
          <span>Computer-generated verified DMHA Accounts document · No ink signature required</span>
          <span className="font-mono text-slate-500">DMHA-ACC-2026</span>
        </div>

        <div className="dmhs-no-print mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2.5 text-xs font-extrabold text-slate-600 hover:bg-slate-200"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
          >
            <Icon name="print" size={14} />
            {isPaid ? 'Print / Save Receipt PDF' : 'Print / Save Fee Challan PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PeriodDetailModal({
  period,
  onClose,
  onAction,
  actionLabel = 'Open Class Routine',
}: {
  period: PeriodSlot
  onClose: () => void
  onAction?: () => void
  actionLabel?: string
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">
              DMHA Class Period · {period.time} – {period.end}
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">{period.subject}</h3>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{period.topic}</p>
          </div>
          <button
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-2xl bg-slate-50 p-3.5">
            <p className="text-[10px] font-extrabold uppercase text-slate-400">Faculty / Instructor</p>
            <p className="mt-1 font-black text-slate-900">{period.teacher}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3.5">
            <p className="text-[10px] font-extrabold uppercase text-slate-400">Room / Lab</p>
            <p className="mt-1 font-black text-slate-900">{period.room}</p>
          </div>
        </div>

        {period.status && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50/70 px-4 py-3">
            <span className="text-xs font-extrabold text-slate-700">Period Attendance Status</span>
            <AttendanceBadge status={period.status} />
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Lesson Focus & Preparation
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 font-semibold text-slate-600">
            <li>Core concept review: {period.topic}</li>
            <li>Bring lab notebook, textbook, and completed worksheet</li>
            <li>Short 10-minute concept check at end of period</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2.5 text-xs font-extrabold text-slate-600"
          >
            Close
          </button>
          {onAction && (
            <button
              onClick={() => {
                onAction()
                onClose()
              }}
              className="rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-emerald-400"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function SubjectDetailModal({
  subject,
  studentName,
  onClose,
  onOpenScripts,
  onMessageTeacher,
}: {
  subject: SubjectProgress
  studentName: string
  onClose: () => void
  onOpenScripts?: () => void
  onMessageTeacher?: () => void
}) {
  const delta = subject.latestScore - subject.previousScore
  const predicted =
    subject.latestScore >= 90
      ? 'A*'
      : subject.latestScore >= 80
        ? 'A'
        : subject.latestScore >= 70
          ? 'B'
          : 'C'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">
              {subject.section} · {studentName}
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">{subject.name}</h3>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              Subject Teacher: {subject.teacher}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-[#0f172a] p-4 text-white">
            <p className="text-[10px] font-bold uppercase text-slate-400">Latest Score</p>
            <p className="mt-1 text-2xl font-black text-emerald-400">{subject.latestScore}%</p>
            <p className="text-[10px] text-slate-300">Grade {subject.grade}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase text-slate-400">Term Delta</p>
            <p
              className={`mt-1 text-2xl font-black ${
                delta >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {delta >= 0 ? `+${delta}%` : `${delta}%`}
            </p>
            <p className="text-[10px] font-semibold text-slate-500">Prev: {subject.previousScore}%</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase text-slate-400">IGCSE Target</p>
            <p className="mt-1 text-2xl font-black text-indigo-700">{predicted}</p>
            <p className="text-[10px] font-semibold text-slate-500">Syllabus {subject.progress}%</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Upcoming Chapter & Revision Focus
          </p>
          <p className="mt-1 text-sm font-black text-slate-900">{subject.nextTopic}</p>
          <p className="mt-1 text-slate-600">
            Complete assigned worksheet and review past paper mark schemes before the next quiz.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {onMessageTeacher && (
            <button
              onClick={() => {
                onMessageTeacher()
                onClose()
              }}
              className="rounded-full bg-slate-100 px-4 py-2.5 text-xs font-extrabold text-slate-800 hover:bg-slate-200"
            >
              Message {subject.teacher}
            </button>
          )}
          {onOpenScripts && (
            <button
              onClick={() => {
                onOpenScripts()
                onClose()
              }}
              className="rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-emerald-400"
            >
              View Graded Exam Sheets →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
