'use client'

import React, { useMemo, useState } from 'react'
import { extractIsoDate, formatPrettyDate, getTodayIso } from './date-utils'
import { Icon } from './icons'
import { useSchool } from './store'
import type { AcademicCalendarEvent } from './types'
import { PageShell } from './ui'

interface UnifiedCalendarItem {
  id: string
  dateIso: string
  endDateIso?: string
  title: string
  category: 'holiday' | 'exam' | 'ptm' | 'event' | 'trip' | 'deadline'
  source: string
  targetUnit: string
  description: string
  isSchoolClosed?: boolean
  deletableEventId?: string
  createdBy?: string
}

const CATEGORY_META: Record<
  UnifiedCalendarItem['category'],
  { label: string; pill: string; dot: string }
> = {
  holiday: {
    label: 'Holiday / Closed',
    pill: 'bg-rose-100 text-rose-800',
    dot: 'bg-rose-500',
  },
  exam: {
    label: 'Exam / Assessment',
    pill: 'bg-violet-100 text-violet-800',
    dot: 'bg-violet-500',
  },
  ptm: {
    label: 'PTM Day',
    pill: 'bg-sky-100 text-sky-800',
    dot: 'bg-sky-500',
  },
  trip: {
    label: 'Field Trip / Consent',
    pill: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  event: {
    label: 'School Event',
    pill: 'bg-indigo-100 text-indigo-800',
    dot: 'bg-indigo-500',
  },
  deadline: {
    label: 'Due / Deadline',
    pill: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
  },
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function AcademicCalendarView() {
  const {
    role,
    authUser,
    calendarEvents,
    campusUnits,
    examSchedules,
    consentForms,
    notices,
    ptmSlots,
    createCalendarEvent,
    deleteCalendarEvent,
  } = useSchool()

  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const canAdd = isAdmin || isTeacher

  const todayIso = getTodayIso()
  const [viewYear, setViewYear] = useState<number>(() => Number(todayIso.slice(0, 4)) || 2026)
  const [viewMonth, setViewMonth] = useState<number>(() => Number(todayIso.slice(5, 7)) - 1) // 0-11
  const [selectedDateIso, setSelectedDateIso] = useState<string>(todayIso)
  const [catFilter, setCatFilter] = useState<'all' | UnifiedCalendarItem['category']>('all')
  const [composerOpen, setComposerOpen] = useState(false)

  // Add event form
  const [title, setTitle] = useState('')
  const [dateIso, setDateIso] = useState(todayIso)
  const [endDateIso, setEndDateIso] = useState('')
  const [category, setCategory] = useState<AcademicCalendarEvent['category']>(
    isAdmin ? 'holiday' : 'event',
  )
  const [targetUnit, setTargetUnit] = useState('All Units')
  const [description, setDescription] = useState('')
  const [isSchoolClosed, setIsSchoolClosed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Aggregate unified events from Calendar + Exams + Consent Trips + Booked PTMs + Dated Notices
  const allItems = useMemo<UnifiedCalendarItem[]>(() => {
    const list: UnifiedCalendarItem[] = []

    calendarEvents.forEach((ev) => {
      list.push({
        id: ev.id,
        dateIso: ev.dateIso,
        endDateIso: ev.endDateIso,
        title: ev.title,
        category: ev.category,
        source: 'DMHA Calendar',
        targetUnit: ev.targetUnit || 'All Units',
        description: ev.description,
        isSchoolClosed: ev.isSchoolClosed,
        deletableEventId: ev.id,
        createdBy: ev.createdBy,
      })
    })

    examSchedules.forEach((ex) => {
      const iso = extractIsoDate(ex.date)
      if (!iso) return
      list.push({
        id: `ex-${ex.id}`,
        dateIso: iso,
        title: `${ex.subject} Exam (${ex.className})`,
        category: 'exam',
        source: 'Exam Schedule',
        targetUnit: 'All Units',
        description: `${ex.examName} · ${ex.timeSlot} · Room: ${ex.room}`,
      })
    })

    // Deduplicate multi-student consent campaigns onto 1 calendar entry
    const seenCampaigns = new Set<string>()
    consentForms.forEach((cf) => {
      const key = cf.campaignId || `${cf.title}|${cf.eventDate}`
      if (seenCampaigns.has(key)) return
      const iso = extractIsoDate(cf.eventDate)
      if (!iso) return
      seenCampaigns.add(key)
      list.push({
        id: `cf-${cf.id}`,
        dateIso: iso,
        title: cf.title,
        category: 'trip',
        source: 'Consent Form',
        targetUnit: cf.targetLabel || 'All Units',
        description: `${cf.category}${cf.venue ? ` · ${cf.venue}` : ''} — ${cf.details}`,
      })
    })

    // Booked PTM sessions
    ptmSlots
      .filter((sl) => sl.status === 'booked')
      .forEach((sl) => {
        list.push({
          id: `ptm-${sl.id}`,
          dateIso: sl.dateIso,
          title: `PTM: ${sl.teacherName} (${sl.startTime})`,
          category: 'ptm',
          source: 'PTM Scheduler',
          targetUnit: sl.mode,
          description: `${sl.studentName ? `${sl.studentName} · ` : ''}${sl.roomOrLink}`,
        })
      })

    notices.forEach((nt) => {
      if (!nt.eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(nt.eventDate)) return
      if (list.some((x) => x.dateIso === nt.eventDate && x.title === nt.title)) return
      list.push({
        id: `nt-${nt.id}`,
        dateIso: nt.eventDate,
        title: nt.title,
        category: nt.category === 'urgent' ? 'deadline' : 'event',
        source: 'School Notice',
        targetUnit: nt.targetUnit || 'All Units',
        description: nt.body,
      })
    })

    return list.sort((a, b) => a.dateIso.localeCompare(b.dateIso))
  }, [calendarEvents, examSchedules, consentForms, ptmSlots, notices])

  const filteredItems = useMemo(
    () => allItems.filter((it) => (catFilter === 'all' ? true : it.category === catFilter)),
    [allItems, catFilter],
  )

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: Array<{ iso: string | null; dayNum: number | null }> = []
    for (let i = 0; i < firstDay; i++) cells.push({ iso: null, dayNum: null })
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ iso, dayNum: d })
    }
    return cells
  }, [viewYear, viewMonth])

  const itemsOnDate = (iso: string) =>
    filteredItems.filter(
      (it) =>
        it.dateIso === iso ||
        (it.endDateIso && iso >= it.dateIso && iso <= it.endDateIso),
    )

  const selectedDayItems = itemsOnDate(selectedDateIso)
  const upcomingHolidays = allItems.filter((it) => it.category === 'holiday' && it.dateIso >= todayIso)
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const monthEvents = filteredItems.filter(
    (it) => it.dateIso.startsWith(monthPrefix) || (it.endDateIso || '').startsWith(monthPrefix),
  )

  const shiftMonth = (delta: number) => {
    const dt = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(dt.getFullYear())
    setViewMonth(dt.getMonth())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !dateIso) return
    setSubmitting(true)
    const res = await createCalendarEvent({
      title: title.trim(),
      dateIso,
      endDateIso: endDateIso || undefined,
      category,
      targetUnit,
      description: description.trim(),
      isSchoolClosed: category === 'holiday' || isSchoolClosed,
    })
    setSubmitting(false)
    if (res.ok) {
      setTitle('')
      setDescription('')
      setEndDateIso('')
      setIsSchoolClosed(false)
      setComposerOpen(false)
      setSelectedDateIso(dateIso)
    }
  }

  return (
    <PageShell
      eyebrow="DMHA Unified Academic Calendar · All Roles Synced"
      title="School Academic Calendar & Holiday Planner"
      subtitle="Monthly view unifying Government Holidays, Exam Weeks, PTM Days, Consent Field Trips, and School Notices across Unit - 1 & Unit - 2."
      action={
        canAdd ? (
          <button
            onClick={() => setComposerOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-400 hover:bg-slate-800"
          >
            <Icon name="plus" size={14} />
            {composerOpen ? 'Close Form' : isAdmin ? '+ Add Holiday / Event' : '+ Add Class Event'}
          </button>
        ) : undefined
      }
    >
      {/* Top KPI Strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-card rounded-2xl p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Events in {monthLabel}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">{monthEvents.length}</p>
        </div>
        <div className="dmhs-card rounded-2xl p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">
            Upcoming Holidays
          </p>
          <p className="mt-1 text-2xl font-black text-rose-700">{upcomingHolidays.length}</p>
        </div>
        <div className="dmhs-card rounded-2xl p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-600">
            Exams &amp; Assessments
          </p>
          <p className="mt-1 text-2xl font-black text-violet-700">
            {allItems.filter((i) => i.category === 'exam').length}
          </p>
        </div>
        <div className="dmhs-hero rounded-2xl p-4 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
            Next School Closure
          </p>
          <p className="mt-1 truncate text-sm font-black">
            {upcomingHolidays[0]
              ? `${upcomingHolidays[0].title} (${upcomingHolidays[0].dateIso})`
              : 'No upcoming closures'}
          </p>
        </div>
      </div>

      {/* Admin / Teacher Add Event Form */}
      {canAdd && composerOpen && (
        <form
          onSubmit={handleSubmit}
          className="dmhs-card mb-6 rounded-[24px] border-2 border-emerald-500/20 bg-white p-5"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
            Publish to School-Wide Calendar
          </p>
          <h3 className="mt-0.5 text-base font-black text-slate-900">
            Add Official Holiday, Exam Date, or Campus Event
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-[11px] font-extrabold text-slate-600">
              Event Title *
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g., Winter Vacation / Rain-Day Closure"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
            </label>
            <label className="block text-[11px] font-extrabold text-slate-600">
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AcademicCalendarEvent['category'])}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              >
                {isAdmin && <option value="holiday">Holiday / School Closed</option>}
                <option value="event">School Event</option>
                <option value="exam">Exam / Assessment</option>
                <option value="ptm">PTM Day</option>
                <option value="trip">Field Trip</option>
                <option value="deadline">Deadline</option>
              </select>
            </label>
            <label className="block text-[11px] font-extrabold text-slate-600">
              Start Date *
              <input
                type="date"
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
            </label>
            <label className="block text-[11px] font-extrabold text-slate-600">
              Campus Unit
              <select
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="All Units">All Units</option>
                {campusUnits.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block text-[11px] font-extrabold text-slate-600">
              End Date (Optional Multi-Day)
              <input
                type="date"
                value={endDateIso}
                onChange={(e) => setEndDateIso(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
            </label>
            <label className="block text-[11px] font-extrabold text-slate-600 sm:col-span-2">
              Description
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Timings, dress code, or campus closure instructions..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {isAdmin ? (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-rose-700">
                <input
                  type="checkbox"
                  checked={category === 'holiday' || isSchoolClosed}
                  onChange={(e) => setIsSchoolClosed(e.target.checked)}
                  className="size-4 accent-rose-600"
                />
                Mark campus closed (no classes / roll call paused)
              </label>
            ) : (
              <span className="text-[11px] font-semibold text-slate-400">
                Only Admins can mark official School Closures.
              </span>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-emerald-400 hover:bg-slate-800"
            >
              {submitting ? 'Publishing...' : 'Save to School Calendar'}
            </button>
          </div>
        </form>
      )}

      {/* Category Filter Pills */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setCatFilter('all')}
          className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold ${
            catFilter === 'all' ? 'bg-[#0f172a] text-emerald-400' : 'bg-white text-slate-600'
          }`}
        >
          All Categories ({allItems.length})
        </button>
        {(Object.keys(CATEGORY_META) as UnifiedCalendarItem['category'][]).map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold ${
              catFilter === cat ? 'bg-emerald-600 text-white' : CATEGORY_META[cat].pill
            }`}
          >
            {CATEGORY_META[cat].label}
          </button>
        ))}
      </div>

      {/* Main Split: Monthly Grid + Selected Day Agenda */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
        <section className="dmhs-card rounded-[24px] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900">{monthLabel}</h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => shiftMonth(-1)}
                className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-200"
              >
                ← Prev
              </button>
              <button
                onClick={() => {
                  setViewYear(Number(todayIso.slice(0, 4)))
                  setViewMonth(Number(todayIso.slice(5, 7)) - 1)
                  setSelectedDateIso(todayIso)
                }}
                className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700"
              >
                Today
              </button>
              <button
                onClick={() => shiftMonth(1)}
                className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-200"
              >
                Next →
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1.5">
            {calendarCells.map((cell, idx) => {
              if (!cell.iso || !cell.dayNum) {
                return <div key={`empty-${idx}`} className="h-20 rounded-xl bg-slate-50/40" />
              }
              const dayItems = itemsOnDate(cell.iso)
              const isSelected = cell.iso === selectedDateIso
              const isToday = cell.iso === todayIso
              const hasHoliday = dayItems.some((x) => x.isSchoolClosed || x.category === 'holiday')
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedDateIso(cell.iso!)}
                  className={`flex h-20 flex-col items-start justify-between rounded-xl border p-1.5 text-left transition ${
                    isSelected
                      ? 'border-[#0f172a] bg-[#0f172a] text-white shadow-sm'
                      : hasHoliday
                        ? 'border-rose-200 bg-rose-50/70 text-rose-950 hover:border-rose-400'
                        : isToday
                          ? 'border-emerald-400 bg-emerald-50/70 text-slate-900'
                          : 'border-slate-100 bg-white text-slate-800 hover:border-emerald-300'
                  }`}
                >
                  <span className="text-[11px] font-black">{cell.dayNum}</span>
                  <div className="flex w-full flex-wrap gap-1 overflow-hidden">
                    {dayItems.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className={`size-2 rounded-full ${CATEGORY_META[ev.category].dot}`}
                        title={ev.title}
                      />
                    ))}
                    {dayItems.length > 3 && (
                      <span className="text-[9px] font-bold opacity-70">
                        +{dayItems.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Right: Selected Day Details + Upcoming Month Agenda */}
        <section className="space-y-4">
          <div className="dmhs-card rounded-[24px] p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
              Selected Day Agenda
            </p>
            <h3 className="mt-0.5 text-base font-black text-slate-900">
              {formatPrettyDate(selectedDateIso)}
            </h3>

            {selectedDayItems.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-center text-xs font-semibold text-slate-400">
                Regular school day — no special holidays or events scheduled on this date.
              </p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {selectedDayItems.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${CATEGORY_META[ev.category].pill}`}
                      >
                        {CATEGORY_META[ev.category].label}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{ev.source}</span>
                    </div>
                    <h4 className="mt-1.5 text-xs font-black text-slate-900">{ev.title}</h4>
                    <p className="mt-1 text-[11px] font-medium text-slate-600">{ev.description}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>{ev.targetUnit}</span>
                      {ev.deletableEventId &&
                        (isAdmin || (isTeacher && ev.createdBy === authUser?.displayName)) && (
                          <button
                            onClick={() => deleteCalendarEvent(ev.deletableEventId!)}
                            className="text-rose-600 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dmhs-card rounded-[24px] p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              All Scheduled Events · {monthLabel}
            </p>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {monthEvents.length === 0 ? (
                <p className="text-xs font-semibold text-slate-400">No events in {monthLabel}.</p>
              ) : (
                monthEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedDateIso(ev.dateIso)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-left hover:bg-emerald-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-slate-900">{ev.title}</p>
                      <p className="text-[10px] font-bold text-slate-400">
                        {ev.dateIso} · {ev.targetUnit}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${CATEGORY_META[ev.category].pill}`}
                    >
                      {ev.category.toUpperCase()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  )
}
