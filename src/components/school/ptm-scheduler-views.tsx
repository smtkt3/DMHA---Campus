'use client'

import React, { useMemo, useState } from 'react'
import { formatPrettyDate } from './date-utils'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type { PtmSlotItem } from './types'
import { PageShell } from './ui'

export function PtmSchedulerView() {
  const {
    role,
    students,
    teachers,
    guardians,
    ptmSlots,
    selectedChildId,
    activeGuardianId,
    activeTeacherId,
    createPtmSlots,
    bookPtmSlot,
    cancelPtmSlot,
    completePtmSlot,
    deletePtmSlot,
    notify,
  } = useSchool()

  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isGuardian = role === 'guardian'
  const canPublish = isAdmin || isTeacher

  const activeGuardian = guardians.find((g) => g.id === activeGuardianId)
  const linkedStudentIds = useMemo(() => {
    if (!isGuardian) return new Set<string>()
    const set = new Set<string>(activeGuardian?.linkedStudentIds || [])
    students.forEach((s) => {
      if (s.guardianId === activeGuardianId) set.add(s.id)
    })
    return set
  }, [isGuardian, activeGuardian, students, activeGuardianId])

  const selectedChild = isGuardian
    ? students.find((s) => s.id === selectedChildId && linkedStudentIds.has(s.id)) ||
      students.find((s) => linkedStudentIds.has(s.id)) ||
      students[0]
    : students[0]

  // Teacher / Admin batch slot publisher state
  const [pubTeacherId, setPubTeacherId] = useState(activeTeacherId || teachers[0]?.id || 'tch-nadia')
  const [pubDate, setPubDate] = useState('2026-11-28')
  const [pubStart, setPubStart] = useState('10:00')
  const [pubEnd, setPubEnd] = useState('11:00')
  const [pubDuration, setPubDuration] = useState(15)
  const [pubMode, setPubMode] = useState<PtmSlotItem['mode']>('In-Person (Unit - 2)')
  const [pubRoom, setPubRoom] = useState('Room 6A · Academic Wing')
  const [publishing, setPublishing] = useState(false)

  // Guardian booking state
  const [teacherFilter, setTeacherFilter] = useState<string>('ALL')
  const [bookingSlot, setBookingSlot] = useState<PtmSlotItem | null>(null)
  const [bookingTopic, setBookingTopic] = useState('')
  const [bookingBusy, setBookingBusy] = useState(false)

  // Teacher completion modal state
  const [completingSlot, setCompletingSlot] = useState<PtmSlotItem | null>(null)
  const [outcomeNotes, setOutcomeNotes] = useState('')
  const [completingBusy, setCompletingBusy] = useState(false)

  const handlePublishSlots = async (e: React.FormEvent) => {
    e.preventDefault()
    setPublishing(true)
    const res = await createPtmSlots({
      teacherId: isAdmin ? pubTeacherId : activeTeacherId,
      dateIso: pubDate,
      startTime: pubStart,
      endTime: pubEnd,
      durationMins: pubDuration,
      mode: pubMode,
      roomOrLink: pubRoom.trim(),
    })
    setPublishing(false)
    if (!res.ok && res.error) notify(res.error)
  }

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookingSlot || !selectedChild) return
    setBookingBusy(true)
    const res = await bookPtmSlot({
      slotId: bookingSlot.id,
      studentId: selectedChild.id,
      topic: bookingTopic.trim(),
    })
    setBookingBusy(false)
    if (res.ok) {
      setBookingSlot(null)
      setBookingTopic('')
    }
  }

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completingSlot) return
    setCompletingBusy(true)
    const res = await completePtmSlot(completingSlot.id, outcomeNotes.trim())
    setCompletingBusy(false)
    if (res.ok) {
      setCompletingSlot(null)
      setOutcomeNotes('')
    }
  }

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>()
    ptmSlots.forEach((s) => map.set(s.teacherId, s.teacherName))
    return Array.from(map.entries())
  }, [ptmSlots])

  const filteredSlots = useMemo(
    () =>
      ptmSlots.filter((s) => (teacherFilter === 'ALL' ? true : s.teacherId === teacherFilter)),
    [ptmSlots, teacherFilter],
  )

  const openSlots = filteredSlots.filter((s) => s.status === 'open')
  const myBookings = isGuardian
    ? ptmSlots.filter((s) => s.guardianId === activeGuardianId && (s.status === 'booked' || s.status === 'completed'))
    : filteredSlots.filter((s) => s.status === 'booked' || s.status === 'completed')

  return (
    <PageShell
      eyebrow="DMHA Parent–Teacher Consultations · Double-Booking Safe"
      title="Interactive PTM 15-Minute Slot Scheduler"
      subtitle={
        canPublish
          ? 'Publish 15-minute In-Person (Unit - 1 / Unit - 2) or Video PTM slots, track booked guardian consultations, and record meeting outcome notes.'
          : 'Select your child, pick an open 15-minute PTM slot with any subject teacher, and view consultation outcome notes after the meeting.'
      }
    >
      {isGuardian && <ChildSwitcherBar />}

      {/* KPI Strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="dmhs-card rounded-2xl p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
            Open 15-Min Slots
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{openSlots.length}</p>
        </div>
        <div className="dmhs-card rounded-2xl p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
            {isGuardian ? 'My Confirmed / Past PTMs' : 'Booked Consultations'}
          </p>
          <p className="mt-1 text-2xl font-black text-indigo-700">
            {myBookings.filter((s) => s.status === 'booked').length}
          </p>
        </div>
        <div className="dmhs-hero rounded-2xl p-4 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
            Completed Meetings
          </p>
          <p className="mt-1 text-2xl font-black">
            {myBookings.filter((s) => s.status === 'completed').length}
          </p>
        </div>
      </div>

      {/* Teacher / Admin Batch Slot Generator */}
      {canPublish && (
        <form
          onSubmit={handlePublishSlots}
          className="dmhs-card mb-6 rounded-[24px] border-2 border-emerald-500/20 bg-white p-5"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
            1-Click PTM Availability Publisher
          </p>
          <h3 className="mt-0.5 text-base font-black text-slate-900">
            Generate 15-Minute PTM Consultation Slots
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {isAdmin && (
              <label className="block text-[11px] font-extrabold text-slate-600">
                Faculty
                <select
                  value={pubTeacherId}
                  onChange={(e) => setPubTeacherId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-[11px] font-extrabold text-slate-600">
              PTM Date *
              <input
                type="date"
                value={pubDate}
                onChange={(e) => setPubDate(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
            </label>
            <label className="block text-[11px] font-extrabold text-slate-600">
              From
              <input
                type="time"
                value={pubStart}
                onChange={(e) => setPubStart(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
            </label>
            <label className="block text-[11px] font-extrabold text-slate-600">
              To
              <input
                type="time"
                value={pubEnd}
                onChange={(e) => setPubEnd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
            </label>
            <label className="block text-[11px] font-extrabold text-slate-600">
              Duration
              <select
                value={pubDuration}
                onChange={(e) => setPubDuration(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              >
                <option value={15}>15 mins</option>
                <option value={20}>20 mins</option>
                <option value={30}>30 mins</option>
              </select>
            </label>
            <label className="block text-[11px] font-extrabold text-slate-600">
              Mode
              <select
                value={pubMode}
                onChange={(e) => setPubMode(e.target.value as PtmSlotItem['mode'])}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="In-Person (Unit - 1)">In-Person (Unit - 1)</option>
                <option value="In-Person (Unit - 2)">In-Person (Unit - 2)</option>
                <option value="Video Call">Video Call</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              value={pubRoom}
              onChange={(e) => setPubRoom(e.target.value)}
              placeholder="Room number or video meeting link..."
              className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold outline-none"
            />
            <button
              type="submit"
              disabled={publishing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-emerald-400 hover:bg-slate-800"
            >
              <Icon name="calendar" size={14} />
              {publishing ? 'Publishing...' : 'Publish PTM Slots'}
            </button>
          </div>
        </form>
      )}

      {/* Teacher Filter Pills for Guardians / Admin */}
      {!isTeacher && teacherOptions.length > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setTeacherFilter('ALL')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold ${
              teacherFilter === 'ALL' ? 'bg-[#0f172a] text-emerald-400' : 'bg-white text-slate-600'
            }`}
          >
            All Teachers
          </button>
          {teacherOptions.map(([id, name]) => (
            <button
              key={id}
              onClick={() => setTeacherFilter(id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold ${
                teacherFilter === id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Two-column layout: Booked/Completed Queue + Open Slots */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">
            {isGuardian ? 'My PTM Appointments & Outcomes' : 'Booked & Completed Consultations'} (
            {myBookings.length})
          </h3>
          {myBookings.length === 0 ? (
            <div className="dmhs-card rounded-2xl p-8 text-center text-xs font-semibold text-slate-400">
              {isGuardian
                ? 'No booked PTM appointments yet. Select any open 15-minute slot on the right to book.'
                : 'No guardian PTM bookings yet.'}
            </div>
          ) : (
            myBookings.map((sl) => (
              <div key={sl.id} className="dmhs-card rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        sl.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {sl.status}
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      {formatPrettyDate(sl.dateIso)} · {sl.startTime}–{sl.endTime}
                    </span>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                    {sl.mode}
                  </span>
                </div>

                <p className="mt-2 text-xs font-extrabold text-slate-800">
                  {sl.teacherName} ({sl.teacherSubject})
                  {sl.studentName ? ` · Re: ${sl.studentName}` : ''}
                </p>
                {sl.guardianName && (
                  <p className="text-[11px] font-semibold text-slate-500">
                    Guardian: {sl.guardianName} · {sl.roomOrLink}
                  </p>
                )}
                {sl.topic && (
                  <p className="mt-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                    Agenda: {sl.topic}
                  </p>
                )}
                {sl.outcomeNotes && (
                  <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
                    ✓ Meeting Outcome ({sl.completedAt}): {sl.outcomeNotes}
                  </p>
                )}

                {sl.status === 'booked' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canPublish && (
                      <button
                        onClick={() => {
                          setCompletingSlot(sl)
                          setOutcomeNotes('')
                        }}
                        className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700"
                      >
                        Mark Completed &amp; Add Notes
                      </button>
                    )}
                    <button
                      onClick={() => cancelPtmSlot(sl.id)}
                      className="rounded-xl bg-rose-50 px-3.5 py-1.5 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
                    >
                      Cancel &amp; Reopen Slot
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">
            Available Open 15-Min Slots ({openSlots.length})
          </h3>
          {openSlots.length === 0 ? (
            <div className="dmhs-card rounded-2xl p-8 text-center text-xs font-semibold text-slate-400">
              No open PTM slots right now.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {openSlots.map((sl) => (
                <div key={sl.id} className="dmhs-card flex flex-col justify-between rounded-2xl p-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
                        OPEN
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{sl.mode}</span>
                    </div>
                    <p className="mt-2 text-sm font-black text-slate-900">
                      {sl.startTime} – {sl.endTime}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      {formatPrettyDate(sl.dateIso)}
                    </p>
                    <p className="mt-1.5 text-xs font-extrabold text-slate-800">{sl.teacherName}</p>
                    <p className="text-[11px] font-medium text-slate-500">{sl.roomOrLink}</p>
                  </div>

                  <div className="mt-3">
                    {isGuardian ? (
                      <button
                        onClick={() => {
                          setBookingSlot(sl)
                          setBookingTopic('')
                        }}
                        className="w-full rounded-xl bg-[#0f172a] py-2 text-xs font-extrabold text-emerald-400 hover:bg-slate-800"
                      >
                        Book for {selectedChild?.name.split(' ')[0] || 'Child'}
                      </button>
                    ) : canPublish ? (
                      <button
                        onClick={() => deletePtmSlot(sl.id)}
                        className="w-full rounded-xl bg-rose-50 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
                      >
                        Remove Open Slot
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Guardian Booking Confirmation Modal */}
      {bookingSlot && selectedChild && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setBookingSlot(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleConfirmBooking}
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
              Confirm 15-Min PTM Slot
            </p>
            <h3 className="mt-1 text-lg font-black text-slate-900">
              {bookingSlot.teacherName} · {bookingSlot.startTime}–{bookingSlot.endTime}
            </h3>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {formatPrettyDate(bookingSlot.dateIso)} · {bookingSlot.mode} · Child:{' '}
              <strong>{selectedChild.name}</strong>
            </p>
            <label className="mt-4 block text-[11px] font-extrabold text-slate-600">
              Discussion Topic / Questions (Optional)
              <textarea
                rows={3}
                value={bookingTopic}
                onChange={(e) => setBookingTopic(e.target.value)}
                placeholder="e.g., Math revision strategy, classroom focus, or upcoming term exam..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold outline-none"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBookingSlot(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bookingBusy}
                className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-extrabold text-emerald-400"
              >
                {bookingBusy ? 'Booking...' : 'Confirm PTM Booking'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Teacher Complete PTM Outcome Notes Modal */}
      {completingSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setCompletingSlot(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCompleteSubmit}
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
              Complete Consultation &amp; Share Summary
            </p>
            <h3 className="mt-1 text-lg font-black text-slate-900">
              {completingSlot.studentName} · {completingSlot.guardianName}
            </h3>
            <label className="mt-4 block text-[11px] font-extrabold text-slate-600">
              PTM Outcome &amp; Action Notes *
              <textarea
                rows={3}
                required
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
                placeholder="Summarize key points discussed and home-study action items..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold outline-none"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCompletingSlot(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={completingBusy}
                className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-extrabold text-white"
              >
                {completingBusy ? 'Saving...' : 'Complete & Send Summary'}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
