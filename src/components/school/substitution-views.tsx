'use client'

import React, { useMemo, useState } from 'react'
import { DMHS_CLASS_SECTIONS, TIMETABLE_PERIODS } from './data'
import {
  DateFilterBar,
  extractIsoDate,
  formatPrettyDate,
  getTodayIso,
  matchesDateFilter,
  shiftIsoDate,
} from './date-utils'
import { Icon } from './icons'
import { useSchool } from './store'
import type { SchoolWeekday, TeacherLeaveSubItem, TimetableSlot } from './types'
import { PageShell } from './ui'

function getDayInfoFromIso(iso: string): { weekday: SchoolWeekday | null; isWeekend: boolean } {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return { weekday: 'Sun', isWeekend: false }
  }
  const dow = new Date(parts[0], parts[1] - 1, parts[2]).getDay()
  const map: Record<number, SchoolWeekday> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu' }
  return { weekday: map[dow] || null, isWeekend: dow === 5 || dow === 6 }
}

function getNextSchoolDayIso(): string {
  let iso = shiftIsoDate(getTodayIso(), 1)
  for (let i = 0; i < 4; i++) {
    if (!getDayInfoFromIso(iso).isWeekend) return iso
    iso = shiftIsoDate(iso, 1)
  }
  return iso
}

function parseReqPeriod(req: TeacherLeaveSubItem): number {
  if (req.period && req.period >= 1 && req.period <= 6) return req.period
  const m = req.periodSlot.match(/Period\s+(\d+)/i) || req.periodSlot.match(/P(\d+)/i)
  return m ? Number(m[1]) : 1
}

function getReqDayAndIso(req: TeacherLeaveSubItem): { dateIso: string; day: SchoolWeekday } {
  const dateIso = req.dateIso || extractIsoDate(req.date) || getTodayIso()
  const day = req.day || getDayInfoFromIso(dateIso).weekday || 'Sun'
  return { dateIso, day }
}

function findTeacherConflictOnSlot(
  teacherId: string,
  day: SchoolWeekday,
  period: number,
  dateIso: string,
  timetableSlots: TimetableSlot[],
  teacherLeaves: TeacherLeaveSubItem[],
): TimetableSlot | null {
  return (
    timetableSlots.find((s) => {
      if (s.teacherId !== teacherId || s.day !== day || s.period !== period) return false
      if (s.isSubstitute && s.substituteDate && s.substituteDate !== dateIso) return false
      const coveredOnDate = teacherLeaves.some(
        (l) =>
          l.status === 'substituted' &&
          l.teacherId === teacherId &&
          (l.dateIso || extractIsoDate(l.date)) === dateIso &&
          parseReqPeriod(l) === period,
      )
      if (!s.isSubstitute && coveredOnDate) return false
      return true
    }) || null
  )
}

export function TeacherSubstitutionView() {
  const {
    role,
    teachers,
    activeTeacherId,
    timetableSlots = [],
    teacherLeaves = [],
    requestTeacherLeave,
    assignSubstituteTeacher,
    declineTeacherLeave,
  } = useSchool()

  const isAdmin = role === 'admin'
  const activeTeacher = teachers.find((t) => t.id === activeTeacherId) || teachers[0]

  // Teacher leave request form state
  const [date, setDate] = useState(getNextSchoolDayIso)
  const [period, setPeriod] = useState<number>(2)
  const [classSection, setClassSection] = useState('Class 6 · Section A')
  const [subject, setSubject] = useState(activeTeacher?.subject || 'Physics')
  const [room, setRoom] = useState('Room 201')
  const [preferredSubId, setPreferredSubId] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null)

  // Board filters
  const [subDateFilter, setSubDateFilter] = useState<string>('ALL')
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'substituted' | 'mine'>('all')

  const dayInfo = useMemo(() => getDayInfoFromIso(date), [date])
  const selectedWeekday: SchoolWeekday = dayInfo.weekday || 'Sun'

  // Auto-load the active teacher's scheduled periods on the selected weekday for 1-click fill!
  const myScheduledPeriodsForDate = useMemo(() => {
    if (!activeTeacher || dayInfo.isWeekend) return []
    return timetableSlots
      .filter(
        (s) =>
          !s.isSubstitute &&
          s.teacherId === activeTeacher.id &&
          s.day === selectedWeekday,
      )
      .sort((a, b) => a.period - b.period)
  }, [timetableSlots, activeTeacher, selectedWeekday, dayInfo.isWeekend])

  const selectedPeriodMeta =
    TIMETABLE_PERIODS.find((p) => p.period === period) || TIMETABLE_PERIODS[0]

  const applyScheduledSlot = (slot: TimetableSlot) => {
    setPeriod(slot.period)
    setClassSection(slot.className)
    setSubject(slot.subject)
    setRoom(slot.room)
  }

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    if (dayInfo.isWeekend) {
      setBanner({
        ok: false,
        text: 'Friday & Saturday are DMHA weekend holidays. Please choose a Sun–Thu school day.',
      })
      return
    }
    setSubmitting(true)
    setBanner(null)
    const res = await requestTeacherLeave({
      date: formatPrettyDate(date),
      dateIso: date,
      day: selectedWeekday,
      period,
      periodSlot: `${selectedPeriodMeta.timeLabel} (Period ${period})`,
      classSection,
      subject,
      room,
      preferredSubstituteId: preferredSubId || undefined,
      reason,
    })
    setSubmitting(false)
    if (res.ok) {
      setReason('')
      setPreferredSubId('')
      setBanner({
        ok: true,
        text: `Substitution request submitted for ${formatPrettyDate(date)} (${selectedWeekday} P${period} · ${classSection}). Colleagues & Admin can now accept/assign cover.`,
      })
    } else {
      setBanner({ ok: false, text: res.error || 'Could not submit request.' })
    }
  }

  const handleAssignOrAccept = async (leaveId: string, subTeacherId: string) => {
    setActionBusyId(`${leaveId}:${subTeacherId}`)
    setBanner(null)
    const res = await assignSubstituteTeacher(leaveId, subTeacherId)
    setActionBusyId(null)
    if (res.ok) {
      setBanner({
        ok: true,
        text:
          res.message ||
          'Substitute confirmed & added automatically to Teaching Timetable (SQLite synced)!',
      })
    } else {
      setBanner({ ok: false, text: res.error || 'Could not assign substitute.' })
    }
  }

  const handleDecline = async (leaveId: string) => {
    setActionBusyId(`${leaveId}:decline`)
    setBanner(null)
    const res = await declineTeacherLeave(leaveId)
    setActionBusyId(null)
    if (!res.ok) {
      setBanner({ ok: false, text: res.error || 'Could not cancel/decline request.' })
    }
  }

  const filteredTeacherLeaves = teacherLeaves.filter((req) => {
    if (!matchesDateFilter(req.dateIso || req.date, subDateFilter)) return false
    if (statusTab === 'pending') return req.status === 'pending'
    if (statusTab === 'substituted') return req.status === 'substituted'
    if (statusTab === 'mine' && activeTeacher) {
      return (
        req.teacherId === activeTeacher.id ||
        req.substituteTeacherId === activeTeacher.id ||
        req.preferredSubstituteId === activeTeacher.id
      )
    }
    return true
  })

  const savedSubDates = Array.from(
    new Set(
      teacherLeaves
        .map((req) => req.dateIso || extractIsoDate(req.date))
        .filter((d): d is string => Boolean(d)),
    ),
  ).sort((a, b) => (a < b ? 1 : -1))

  const pendingCount = teacherLeaves.filter((l) => l.status === 'pending').length
  const coveredCount = teacherLeaves.filter((l) => l.status === 'substituted').length
  const myCoversCount = activeTeacher
    ? teacherLeaves.filter(
        (l) => l.status === 'substituted' && l.substituteTeacherId === activeTeacher.id,
      ).length
    : 0

  return (
    <PageShell
      eyebrow="Smart Timetable Operations · Zero Empty Classrooms"
      title="Teacher Leave & Auto-Substitution Manager"
      subtitle={
        isAdmin
          ? 'Real timetable clash-checked substitute assignment — assigning any free teacher automatically adds the cover class to their Teaching Timetable & Student Routine.'
          : 'Request substitute cover for any scheduled period, or accept a colleague’s open request to automatically add it to your Teaching Timetable.'
      }
    >
      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Needs Substitute Now
          </p>
          <p className="mt-1.5 text-3xl font-black text-amber-600">{pendingCount}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Open for colleague accept or Admin assign
          </p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Covered &amp; Synced to Timetable
          </p>
          <p className="mt-1.5 text-3xl font-black text-emerald-600">{coveredCount}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {isAdmin
              ? 'Auto-added to Substitute Teacher Timetable'
              : `${myCoversCount} cover class${myCoversCount === 1 ? '' : 'es'} added to your timetable`}
          </p>
        </div>

        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            Active Faculty Pool
          </p>
          <p className="mt-1.5 text-3xl font-black">
            {teachers.filter((t) => t.status === 'active').length}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Real SQLite Timetable clash detection active
          </p>
        </div>
      </div>

      {banner && (
        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-xs font-bold ${
            banner.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Teacher Leave Submission Box */}
        <form onSubmit={handleRequestSubmit} className="dmhs-card h-fit p-5">
          <h3 className="text-sm font-black text-slate-900">
            + Request Leave / Substitute Cover
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Pick a date to load your scheduled periods, then submit to notify colleagues &amp;
            Principal Shahid.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">
                Leave Date (Sun–Thu)
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
              />
              {dayInfo.isWeekend ? (
                <p className="mt-1 text-[10px] font-bold text-rose-600">
                  Weekend (Fri/Sat) — please select a Sun–Thu school day.
                </p>
              ) : (
                <p className="mt-1 text-[10px] font-bold text-emerald-700">
                  School Day: {selectedWeekday} · {formatPrettyDate(date)}
                </p>
              )}
            </div>

            {/* 1-Click Picker from Teacher's Scheduled Timetable on that Day */}
            {!isAdmin && myScheduledPeriodsForDate.length > 0 && (
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                  Your Scheduled {selectedWeekday} Classes (1-Tap Fill)
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {myScheduledPeriodsForDate.map((slot) => {
                    const selected =
                      period === slot.period &&
                      classSection.toLowerCase() === slot.className.toLowerCase()
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => applyScheduledSlot(slot)}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] font-bold transition ${
                          selected
                            ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                            : 'bg-white text-slate-800 ring-1 ring-emerald-200/70 hover:bg-emerald-50'
                        }`}
                      >
                        <span>
                          P{slot.period} · {slot.subject} ({slot.className})
                        </span>
                        <span className="text-[10px] opacity-75">{slot.room}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Period Slot
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
                >
                  {TIMETABLE_PERIODS.map((p) => (
                    <option key={p.period} value={p.period}>
                      P{p.period} ({p.timeLabel})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  Class &amp; Section
                </label>
                <select
                  value={classSection}
                  onChange={(e) => setClassSection(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
                >
                  {DMHS_CLASS_SECTIONS.map((sec) => (
                    <option key={sec}>{sec}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Room / Lab</label>
                <input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">
                Preferred Substitute Colleague (Clash-Checked)
              </label>
              <select
                value={preferredSubId}
                onChange={(e) => setPreferredSubId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                <option value="">Open to Any Free Teacher</option>
                {teachers
                  .filter((t) => t.id !== activeTeacher?.id && t.status === 'active')
                  .map((t) => {
                    const clash = findTeacherConflictOnSlot(
                      t.id,
                      selectedWeekday,
                      period,
                      date,
                      timetableSlots,
                      teacherLeaves,
                    )
                    return (
                      <option key={t.id} value={t.id} disabled={Boolean(clash)}>
                        {t.name} ({t.subject}) — {clash ? `Busy (${clash.className})` : 'Free ✓'}
                      </option>
                    )
                  })}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">Reason *</label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Medical appointment or Cambridge training..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || dayInfo.isWeekend}
              className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300 shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Submitting to SQLite...' : 'Submit Substitution Request'}
            </button>
          </div>
        </form>

        {/* Substitution Board with Real Clash-Free Teacher Matcher & Colleague Accept */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['all', `All (${teacherLeaves.length})`],
                ['pending', `Needs Cover (${pendingCount})`],
                ['substituted', `Covered (${coveredCount})`],
                ...(!isAdmin ? ([['mine', 'My Requests & Covers']] as const) : []),
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setStatusTab(k)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                  statusTab === k
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <DateFilterBar
            value={subDateFilter}
            onChange={setSubDateFilter}
            allowAll
            allowFuture
            compact
            label="Filter Date"
            savedDates={savedSubDates}
          />

          {filteredTeacherLeaves.length === 0 ? (
            <div className="dmhs-card py-10 text-center text-xs font-semibold text-slate-400">
              No substitution requests recorded for{' '}
              {subDateFilter === 'ALL' ? 'this view' : formatPrettyDate(subDateFilter)}.
            </div>
          ) : (
            filteredTeacherLeaves.map((req) => {
              const { dateIso: reqDateIso, day: reqDay } = getReqDayAndIso(req)
              const reqPeriod = parseReqPeriod(req)
              const activeCandidates = teachers
                .filter((t) => t.id !== req.teacherId && t.status === 'active')
                .map((t) => ({
                  teacher: t,
                  clash: findTeacherConflictOnSlot(
                    t.id,
                    reqDay,
                    reqPeriod,
                    reqDateIso,
                    timetableSlots,
                    teacherLeaves,
                  ),
                }))
              const myClash = activeTeacher
                ? findTeacherConflictOnSlot(
                    activeTeacher.id,
                    reqDay,
                    reqPeriod,
                    reqDateIso,
                    timetableSlots,
                    teacherLeaves,
                  )
                : null
              const isMyOwnRequest = !isAdmin && activeTeacher?.id === req.teacherId
              const canColleagueAccept =
                !isAdmin && req.status === 'pending' && Boolean(activeTeacher) && !isMyOwnRequest

              return (
                <div key={req.id} className="dmhs-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
                          {req.subject}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                          {req.classSection} · {reqDay} P{reqPeriod} · {req.periodSlot}
                        </span>
                        {req.room && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            {req.room}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-base font-black text-slate-900">
                        {req.teacherName} — {req.date}
                      </h3>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">{req.reason}</p>
                      {req.preferredSubstituteName && req.status === 'pending' && (
                        <p className="mt-1 text-[11px] font-bold text-indigo-700">
                          Requested Preferred Substitute: {req.preferredSubstituteName}
                        </p>
                      )}
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                        req.status === 'substituted'
                          ? 'bg-emerald-50 text-emerald-700'
                          : req.status === 'declined'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {req.status === 'substituted'
                        ? `Covered by ${req.substituteTeacherName}`
                        : req.status}
                    </span>
                  </div>

                  {/* Confirmation strip when already added to timetable */}
                  {req.status === 'substituted' && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs font-bold text-emerald-900">
                      <span>
                        ✓ Automatically added to <strong>{req.substituteTeacherName}</strong>
                        &apos;s Teaching Timetable ({reqDay} P{reqPeriod} ·{' '}
                        {formatPrettyDate(reqDateIso)}) &amp; synced to {req.classSection}.
                      </span>
                    </div>
                  )}

                  {/* Colleague Teacher 1-Click Accept & Add to My Timetable */}
                  {canColleagueAccept && activeTeacher && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200/80 bg-violet-50/50 p-4">
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-violet-800">
                          Colleague Substitute Cover
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-600">
                          {myClash
                            ? `You have a timetable clash during ${reqDay} P${reqPeriod} (${myClash.subject} · ${myClash.className}).`
                            : `You are FREE on ${reqDay} Period ${reqPeriod} (${formatPrettyDate(reqDateIso)}). Accepting adds this class to your Teaching Timetable automatically!`}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(myClash) || actionBusyId !== null}
                        onClick={() => void handleAssignOrAccept(req.id, activeTeacher.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white shadow-xs transition hover:bg-violet-700 disabled:bg-slate-300 disabled:text-slate-500"
                      >
                        <Icon name="check" size={14} />
                        {actionBusyId === `${req.id}:${activeTeacher.id}`
                          ? 'Adding to Timetable...'
                          : myClash
                            ? 'Busy (Clash)'
                            : 'Accept & Add to My Timetable'}
                      </button>
                    </div>
                  )}

                  {/* Requesting Teacher Cancel Button */}
                  {isMyOwnRequest && req.status === 'pending' && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        disabled={actionBusyId !== null}
                        onClick={() => void handleDecline(req.id)}
                        className="rounded-xl bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                      >
                        Cancel Request
                      </button>
                    </div>
                  )}

                  {/* Admin Real Clash-Free Teacher Matcher (1-Click Assign & Auto-Add to Timetable) */}
                  {isAdmin && req.status === 'pending' && (
                    <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                          Real Clash-Free Teacher Matcher ({reqDay} P{reqPeriod}) · 1-Click Add to
                          Timetable
                        </p>
                        <button
                          type="button"
                          disabled={actionBusyId !== null}
                          onClick={() => void handleDecline(req.id)}
                          className="text-[11px] font-bold text-rose-600 hover:underline"
                        >
                          Decline Leave
                        </button>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {activeCandidates.map(({ teacher: ft, clash }) => {
                          const isPreferred = req.preferredSubstituteId === ft.id
                          const sameFaculty =
                            ft.department.toLowerCase().includes(req.subject.toLowerCase()) ||
                            ft.subject.toLowerCase().includes(req.subject.toLowerCase())
                          return (
                            <button
                              key={ft.id}
                              type="button"
                              disabled={Boolean(clash) || actionBusyId !== null}
                              onClick={() => void handleAssignOrAccept(req.id, ft.id)}
                              title={
                                clash
                                  ? `Busy teaching ${clash.subject} in ${clash.className}`
                                  : `Assign ${ft.name} & add to their Teaching Timetable`
                              }
                              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-extrabold shadow-2xs transition ${
                                clash
                                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                  : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-500 hover:bg-emerald-600 hover:text-white'
                              }`}
                            >
                              <Icon name={clash ? 'close' : 'check'} size={13} />
                              <span>
                                {ft.name} ({ft.subject})
                              </span>
                              {clash ? (
                                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-700">
                                  Busy · {clash.className}
                                </span>
                              ) : isPreferred ? (
                                <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-black text-indigo-800">
                                  Requested
                                </span>
                              ) : sameFaculty ? (
                                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-800">
                                  Best Fit
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                                  Free ✓
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </PageShell>
  )
}
