'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { DMHS_CLASS_SECTIONS, TIMETABLE_PERIODS } from './data'
import { extractIsoDate, formatPrettyDate, getTodayIso } from './date-utils'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type { SchoolWeekday, TeacherLeaveSubItem, TimetableSlot } from './types'
import { PageShell } from './ui'

const WEEKDAYS: SchoolWeekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']
const CLASS_OPTIONS: string[] = [...DMHS_CLASS_SECTIONS]

function toLocalIso(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function getSundayOfWeek(baseIso: string): Date {
  const [y, m, d] = baseIso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() // 0=Sun..6=Sat
  // If Fri(5) or Sat(6), advance to upcoming Sunday so school week is always upcoming Sun–Thu
  if (dow === 5) {
    dt.setDate(dt.getDate() + 2)
  } else if (dow === 6) {
    dt.setDate(dt.getDate() + 1)
  } else {
    dt.setDate(dt.getDate() - dow)
  }
  return dt
}

function buildSchoolWeekDays(weekOffset: number): Array<{
  day: SchoolWeekday
  dateIso: string
  shortDate: string
}> {
  const sun = getSundayOfWeek(getTodayIso())
  sun.setDate(sun.getDate() + weekOffset * 7)
  return WEEKDAYS.map((day, idx) => {
    const dt = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + idx)
    return {
      day,
      dateIso: toLocalIso(dt),
      shortDate: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    }
  })
}

function getWeekOffsetForIso(targetIso: string): number {
  const baseSun = getSundayOfWeek(getTodayIso())
  const targetSun = getSundayOfWeek(targetIso)
  const diffDays = Math.round((targetSun.getTime() - baseSun.getTime()) / (1000 * 60 * 60 * 24))
  return Math.round(diffDays / 7)
}

function isoToWeekdayOrSun(iso: string): SchoolWeekday {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const map: Record<number, SchoolWeekday> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu' }
  return map[dt.getDay()] || 'Sun'
}

function getActiveSchoolWeekday(): SchoolWeekday {
  const map: Record<number, SchoolWeekday> = {
    0: 'Sun',
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
  }
  return map[new Date().getDay()] || 'Sun'
}

function parseLeavePeriod(lv: TeacherLeaveSubItem): number {
  if (lv.period && lv.period >= 1 && lv.period <= 6) return lv.period
  const m = lv.periodSlot.match(/Period\s+(\d+)/i) || lv.periodSlot.match(/P(\d+)/i)
  return m ? Number(m[1]) : 1
}

function getSubjectCardTone(subject: string): string {
  const s = subject.toLowerCase()
  if (s.includes('math')) return 'border-violet-200/90 bg-violet-50/60 hover:border-violet-400'
  if (s.includes('phys') || s.includes('ict') || s.includes('stem')) {
    return 'border-cyan-200/90 bg-cyan-50/60 hover:border-cyan-400'
  }
  if (s.includes('eng')) return 'border-amber-200/90 bg-amber-50/60 hover:border-amber-400'
  if (s.includes('bangla')) return 'border-rose-200/90 bg-rose-50/60 hover:border-rose-400'
  return 'border-emerald-200/90 bg-emerald-50/60 hover:border-emerald-400'
}

export function MasterTimetableView() {
  const {
    role,
    teachers = [],
    students = [],
    activeTeacherId,
    selectedChildId,
    activeStudentId,
    timetableSlots = [],
    teacherLeaves = [],
    examSchedules = [],
    upsertTimetableSlot,
    deleteTimetableSlot,
    addExamSchedule,
    deleteExamSchedule,
    requestTeacherLeave,
  } = useSchool()

  const canEdit = role === 'admin'
  const isClassLocked = role === 'guardian' || role === 'student'
  const todayIso = useMemo(() => getTodayIso(), [])
  const todayDay = useMemo(() => getActiveSchoolWeekday(), [])

  // Advance Day / Week Selector State (click any day to inspect advance schedule!)
  const [weekOffset, setWeekOffset] = useState<number>(0)
  const schoolWeekDays = useMemo(() => buildSchoolWeekDays(weekOffset), [weekOffset])
  const [selectedDay, setSelectedDay] = useState<SchoolWeekday>(todayDay)
  const selectedDayMeta =
    schoolWeekDays.find((d) => d.day === selectedDay) || schoolWeekDays[0]
  const selectedDateIso = selectedDayMeta.dateIso

  // Quick Inline Substitute Request Modal (for Teachers directly from their Teaching Timetable!)
  const [quickSubSlot, setQuickSubSlot] = useState<{
    day: SchoolWeekday
    dateIso: string
    period: number
    timeLabel: string
    className: string
    subject: string
    room: string
  } | null>(null)
  const [quickSubReason, setQuickSubReason] = useState('')
  const [quickSubPrefId, setQuickSubPrefId] = useState('')
  const [quickSubBusy, setQuickSubBusy] = useState(false)

  const [subTab, setSubTab] = useState<'weekly' | 'exams'>('weekly')
  const [filterMode, setFilterMode] = useState<'class' | 'teacher'>(
    role === 'teacher' ? 'teacher' : 'class',
  )
  const [teacherExamScope, setTeacherExamScope] = useState<'mine' | 'all'>('mine')

  const defaultStudent =
    role === 'guardian'
      ? students.find((s) => s.id === selectedChildId) || students[0]
      : role === 'student'
        ? students.find((s) => s.id === activeStudentId) || students[0]
        : students[0]

  const defaultClassLabel = defaultStudent
    ? `${defaultStudent.className} · ${defaultStudent.section}`
    : CLASS_OPTIONS[0]

  const [selectedClass, setSelectedClass] = useState(defaultClassLabel)
  const [selectedTeacherId, setSelectedTeacherId] = useState(
    role === 'teacher' ? activeTeacherId : teachers[0]?.id || 'tch-nadia',
  )

  // Keep role-specific view mode & selection always accurate when switching roles or children!
  useEffect(() => {
    if (role === 'guardian' || role === 'student') {
      setFilterMode('class')
      setSelectedClass(defaultClassLabel)
    } else if (role === 'teacher') {
      setFilterMode('teacher')
      if (activeTeacherId) setSelectedTeacherId(activeTeacherId)
    }
  }, [role, defaultClassLabel, activeTeacherId])

  const effectiveFilterMode: 'class' | 'teacher' = isClassLocked ? 'class' : filterMode
  const effectiveClass = isClassLocked ? defaultClassLabel : selectedClass
  const effectiveTeacherId =
    role === 'teacher' && !selectedTeacherId ? activeTeacherId : selectedTeacherId

  const activeTeacherRecord = teachers.find((t) => t.id === activeTeacherId) || teachers[0]

  // Admin Period Builder Form State (supports both Create and Edit existing slot!)
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null)
  const [slotDay, setSlotDay] = useState<SchoolWeekday>(todayDay)
  const [slotPeriod, setSlotPeriod] = useState<number>(1)
  const [slotClass, setSlotClass] = useState<string>('Class 6 · Section A')
  const [slotSubject, setSlotSubject] = useState<string>('Physics')
  const [slotTeacherId, setSlotTeacherId] = useState<string>(teachers[0]?.id || 'tch-nadia')
  const [slotRoom, setSlotRoom] = useState<string>('Lab 204')
  const [slotError, setSlotError] = useState('')

  // Exam Scheduler Form State
  const [examName, setExamName] = useState('Term Final Examination 2026')
  const [examClass, setExamClass] = useState('Class 6 · Section A')
  const [examSubject, setExamSubject] = useState('Chemistry Paper 1')
  const [examDate, setExamDate] = useState('09 Dec 2026')
  const [examTime, setExamTime] = useState('09:00 AM – 11:30 AM')
  const [examRoom, setExamRoom] = useState('Exam Hall A')
  const [examInvigilator, setExamInvigilator] = useState(teachers[0]?.id || 'tch-nadia')
  const [examError, setExamError] = useState('')

  // Live Clash Preview before Admin even submits
  const liveClashWarning = useMemo(() => {
    const tClash = timetableSlots.find(
      (s) =>
        s.id !== editingSlotId &&
        s.day === slotDay &&
        s.period === slotPeriod &&
        s.teacherId === slotTeacherId,
    )
    if (tClash) {
      return `Teacher Clash: ${tClash.teacherName} is already teaching ${tClash.subject} in ${tClash.className} (${tClash.room}).`
    }
    const rClash = timetableSlots.find(
      (s) =>
        s.id !== editingSlotId &&
        s.day === slotDay &&
        s.period === slotPeriod &&
        s.room.toLowerCase() === slotRoom.trim().toLowerCase(),
    )
    if (rClash) {
      return `Room Clash: ${slotRoom} is booked by ${rClash.className} (${rClash.teacherName}).`
    }
    const cClash = timetableSlots.find(
      (s) =>
        s.id !== editingSlotId &&
        s.day === slotDay &&
        s.period === slotPeriod &&
        s.className === slotClass,
    )
    if (cClash) {
      return `Class Clash: ${slotClass} already has ${cClash.subject} in Period ${slotPeriod}.`
    }
    return ''
  }, [timetableSlots, editingSlotId, slotDay, slotPeriod, slotTeacherId, slotRoom, slotClass])

  const freeTeachersForSelectedSlot = useMemo(() => {
    const busyIds = new Set(
      timetableSlots
        .filter((s) => s.id !== editingSlotId && s.day === slotDay && s.period === slotPeriod)
        .map((s) => s.teacherId),
    )
    return teachers.filter((t) => !busyIds.has(t.id))
  }, [timetableSlots, editingSlotId, teachers, slotDay, slotPeriod])

  const handleAssignSlot = (e: React.FormEvent) => {
    e.preventDefault()
    setSlotError('')
    const periodInfo = TIMETABLE_PERIODS.find((p) => p.period === slotPeriod) || TIMETABLE_PERIODS[0]
    const res = upsertTimetableSlot({
      id: editingSlotId || undefined,
      day: slotDay,
      period: slotPeriod,
      timeLabel: periodInfo.timeLabel,
      className: slotClass,
      subject: slotSubject,
      teacherId: slotTeacherId,
      room: slotRoom,
    })
    if (!res.ok) {
      setSlotError(res.clashError || 'Unable to assign period due to schedule conflict.')
    } else {
      setEditingSlotId(null)
    }
  }

  const startEditingSlot = (slot: TimetableSlot) => {
    if (!canEdit) return
    setEditingSlotId(slot.id)
    setSlotDay(slot.day)
    setSlotPeriod(slot.period)
    setSlotClass(slot.className)
    setSlotSubject(slot.subject)
    setSlotTeacherId(slot.teacherId)
    setSlotRoom(slot.room)
    setSlotError('')
  }

  const prefillEmptySlot = (day: SchoolWeekday, period: number) => {
    if (!canEdit) return
    setEditingSlotId(null)
    setSlotDay(day)
    setSlotPeriod(period)
    if (effectiveFilterMode === 'class') {
      setSlotClass(effectiveClass)
    } else if (effectiveTeacherId) {
      setSlotTeacherId(effectiveTeacherId)
    }
    setSlotError('')
  }

  const handleAddExam = (e: React.FormEvent) => {
    e.preventDefault()
    setExamError('')
    const res = addExamSchedule({
      examName,
      className: examClass,
      subject: examSubject,
      date: examDate,
      timeSlot: examTime,
      room: examRoom,
      invigilatorId: examInvigilator,
    })
    if (!res.ok) {
      setExamError(res.clashError || 'Exam schedule conflict detected.')
    }
  }

  // Resolve effective timetable slots for a given (day, dateIso) including live Substitute Covers!
  const getEffectiveSlotForDayDate = (
    day: SchoolWeekday,
    dateIso: string,
    period: number,
  ): {
    slot: TimetableSlot | null
    coveredByLeave: TeacherLeaveSubItem | null
  } => {
    if (effectiveFilterMode === 'teacher') {
      // 1. Check if this teacher is covering as a SUBSTITUTE on this exact date & period!
      const subCover = timetableSlots.find(
        (s) =>
          s.isSubstitute &&
          s.teacherId === effectiveTeacherId &&
          s.day === day &&
          s.period === period &&
          (!s.substituteDate || s.substituteDate === dateIso),
      )
      if (subCover) return { slot: subCover, coveredByLeave: null }

      // 2. Otherwise find regular slot for this teacher
      const regular = timetableSlots.find(
        (s) =>
          !s.isSubstitute &&
          s.teacherId === effectiveTeacherId &&
          s.day === day &&
          s.period === period,
      )
      if (!regular) return { slot: null, coveredByLeave: null }

      // Check if this regular slot is covered by a substitute on this exact date
      const leaveCover =
        teacherLeaves.find(
          (lv) =>
            lv.status === 'substituted' &&
            lv.teacherId === effectiveTeacherId &&
            (lv.dateIso || extractIsoDate(lv.date)) === dateIso &&
            parseLeavePeriod(lv) === period,
        ) || null

      return { slot: regular, coveredByLeave: leaveCover }
    }

    // Class view (Students, Guardians, Admin viewing a class):
    // Prefer date-specific Substitute Cover slot for that class if present!
    const classSub = timetableSlots.find(
      (s) =>
        s.isSubstitute &&
        s.className.toLowerCase() === effectiveClass.toLowerCase() &&
        s.day === day &&
        s.period === period &&
        (!s.substituteDate || s.substituteDate === dateIso),
    )
    if (classSub) return { slot: classSub, coveredByLeave: null }

    const regular = timetableSlots.find(
      (s) =>
        !s.isSubstitute &&
        s.className.toLowerCase() === effectiveClass.toLowerCase() &&
        s.day === day &&
        s.period === period,
    )
    return { slot: regular || null, coveredByLeave: null }
  }

  // Visible slots in the currently viewed week (regular slots + substitute covers falling in this week)
  const weekDateSet = useMemo(() => new Set(schoolWeekDays.map((d) => d.dateIso)), [schoolWeekDays])
  const visibleSlots = useMemo(
    () =>
      timetableSlots.filter((s) => {
        if (s.isSubstitute && s.substituteDate && !weekDateSet.has(s.substituteDate)) {
          return false
        }
        return effectiveFilterMode === 'class'
          ? s.className.toLowerCase() === effectiveClass.toLowerCase()
          : s.teacherId === effectiveTeacherId
      }),
    [timetableSlots, weekDateSet, effectiveFilterMode, effectiveClass, effectiveTeacherId],
  )

  const weekSubstituteCovers = useMemo(
    () => visibleSlots.filter((s) => s.isSubstitute),
    [visibleSlots],
  )

  const selectedDayPeriods = useMemo(
    () =>
      TIMETABLE_PERIODS.map((p) => ({
        ...p,
        ...getEffectiveSlotForDayDate(selectedDay, selectedDateIso, p.period),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timetableSlots, teacherLeaves, selectedDay, selectedDateIso, effectiveFilterMode, effectiveClass, effectiveTeacherId],
  )

  const selectedDayClassCount = selectedDayPeriods.filter((p) => Boolean(p.slot)).length

  const todayVisibleCount = useMemo(
    () =>
      TIMETABLE_PERIODS.filter((p) =>
        Boolean(getEffectiveSlotForDayDate(todayDay, todayIso, p.period).slot),
      ).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timetableSlots, teacherLeaves, todayDay, todayIso, effectiveFilterMode, effectiveClass, effectiveTeacherId],
  )

  const visibleExams = useMemo(() => {
    if (isClassLocked) {
      return examSchedules.filter(
        (ex) => ex.className.toLowerCase() === effectiveClass.toLowerCase(),
      )
    }
    if (role === 'teacher' && teacherExamScope === 'mine') {
      return examSchedules.filter((ex) => ex.invigilatorId === activeTeacherId)
    }
    return examSchedules
  }, [isClassLocked, effectiveClass, role, teacherExamScope, examSchedules, activeTeacherId])

  const pageTitle = canEdit
    ? 'Master Weekly Timetable & Exam Scheduler'
    : role === 'teacher'
      ? `${activeTeacherRecord?.name || 'Faculty'}’s Teaching Timetable`
      : role === 'guardian'
        ? `${defaultStudent?.name}’s Class Routine`
        : 'My Class Routine & Exam Schedule'

  const pageSubtitle = canEdit
    ? 'Single source of truth with real-time Teacher, Room, Class & Exam Hall clash protection — every edit syncs live to Teacher, Guardian & Student portals.'
    : role === 'teacher'
      ? 'Live teaching periods & exam invigilation duties synced automatically with Principal Shahid’s Master Timetable and Substitute assignments.'
      : `Live weekly Sun–Thu class schedule & exam dates for ${effectiveClass} — synced automatically with DMHA Admin & Substitute updates.`

  return (
    <PageShell
      eyebrow={
        canEdit
          ? 'Schedule & Calendar · Zero-Clash Master Control'
          : role === 'teacher'
            ? 'Schedule & Calendar · Live Faculty Timetable'
            : `Schedule & Calendar · ${effectiveClass}`
      }
      title={pageTitle}
      subtitle={pageSubtitle}
      action={
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 shadow-2xs hover:bg-slate-50"
        >
          <Icon name="print" size={14} />
          Print Routine
        </button>
      }
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      {/* Top Role-Aware KPI Row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-300">
            {canEdit
              ? 'Master Weekly Periods'
              : role === 'teacher'
                ? 'My Teaching Periods / Wk'
                : `${effectiveClass} Weekly Periods`}
          </p>
          <p className="mt-1.5 text-3xl font-black">
            {canEdit ? timetableSlots.length : visibleSlots.length}
          </p>
          <p className="mt-1 text-[11px] text-slate-300">
            Sun–Thu · Zero double-bookings · Live SQLite sync
          </p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
            Today’s Schedule ({todayDay})
          </p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">
            {todayVisibleCount} {todayVisibleCount === 1 ? 'Period' : 'Periods'}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-700">
            {canEdit
              ? `Viewing ${effectiveFilterMode === 'class' ? effectiveClass : teachers.find((t) => t.id === effectiveTeacherId)?.name || 'Faculty'}`
              : 'Synced live to Overview & Bell Alerts'}
          </p>
        </div>

        {canEdit ? (
          <div className="dmhs-card p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
              Free Teachers ({slotDay} P{slotPeriod})
            </p>
            <p className="mt-1.5 text-2xl font-black text-slate-900">
              {freeTeachersForSelectedSlot.length} Available
            </p>
            <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">
              {freeTeachersForSelectedSlot.map((t) => t.name.split(' ')[0]).join(', ') || 'All busy'}
            </p>
          </div>
        ) : (
          <div className="dmhs-card p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
              {role === 'teacher' ? 'My Exam Invigilations' : 'Upcoming Exam Papers'}
            </p>
            <p className="mt-1.5 text-3xl font-black text-slate-900">{visibleExams.length}</p>
            <p className="mt-1 text-[11px] font-semibold text-emerald-700">
              Synced directly to Official Admit Cards
            </p>
          </div>
        )}
      </div>

      {/* Sub-Tabs & Role-Aware Filter Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab('weekly')}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
              subTab === 'weekly'
                ? 'bg-[#0f172a] text-emerald-300'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            Weekly Period Grid
          </button>
          <button
            type="button"
            onClick={() => setSubTab('exams')}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
              subTab === 'exams'
                ? 'bg-[#0f172a] text-emerald-300'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {canEdit
              ? `Exam Routine Scheduler (${examSchedules.length})`
              : `Exam Routine (${visibleExams.length})`}
          </button>
        </div>

        {subTab === 'weekly' &&
          (isClassLocked ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 shadow-xs">
              <Icon name="shield" size={14} />
              <span>
                {effectiveClass} · {defaultStudent?.name}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full bg-slate-100 p-1 text-[11px] font-extrabold">
                <button
                  type="button"
                  onClick={() => setFilterMode('class')}
                  className={`rounded-full px-3 py-1 transition ${
                    effectiveFilterMode === 'class'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  By Class
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('teacher')}
                  className={`rounded-full px-3 py-1 transition ${
                    effectiveFilterMode === 'teacher'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  {role === 'teacher' ? 'My Schedule / Faculty' : 'By Teacher'}
                </button>
              </div>

              {effectiveFilterMode === 'class' ? (
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                >
                  {CLASS_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={effectiveTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject})
                      {role === 'teacher' && t.id === activeTeacherId ? ' — You' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}

        {subTab === 'exams' && role === 'teacher' && (
          <div className="inline-flex rounded-full bg-slate-100 p-1 text-[11px] font-extrabold">
            <button
              type="button"
              onClick={() => setTeacherExamScope('mine')}
              className={`rounded-full px-3 py-1 transition ${
                teacherExamScope === 'mine' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              My Invigilations
            </button>
            <button
              type="button"
              onClick={() => setTeacherExamScope('all')}
              className={`rounded-full px-3 py-1 transition ${
                teacherExamScope === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              All Exam Papers ({examSchedules.length})
            </button>
          </div>
        )}
      </div>

      {subTab === 'weekly' && (
        <div className="space-y-6">
          {/* Interactive Clickable Day & Advance Week Navigator */}
          <div className="dmhs-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-600">
                  Interactive Advance Day Timetable · Click Any Day
                </p>
                <h3 className="mt-0.5 text-base font-black text-slate-900">
                  {selectedDay} · {formatPrettyDate(selectedDateIso)}
                  {selectedDateIso === todayIso && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                      TODAY
                    </span>
                  )}
                  {weekOffset > 0 && (
                    <span className="ml-2 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-black text-indigo-800">
                      +{weekOffset} Week{weekOffset === 1 ? '' : 's'} Ahead
                    </span>
                  )}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekOffset((w) => w - 1)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                >
                  ← Prev Week
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWeekOffset(0)
                    setSelectedDay(todayDay)
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                    weekOffset === 0
                      ? 'bg-[#0f172a] text-emerald-300'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset((w) => w + 1)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                >
                  Next Week →
                </button>
                <input
                  type="date"
                  aria-label="Jump to advance date"
                  value={selectedDateIso}
                  onChange={(e) => {
                    const picked = e.target.value
                    if (!picked) return
                    setWeekOffset(getWeekOffsetForIso(picked))
                    setSelectedDay(isoToWeekdayOrSun(picked))
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-extrabold text-slate-800 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Clickable Sun–Thu Day Cards */}
            <div className="mt-4 grid grid-cols-5 gap-2">
              {schoolWeekDays.map((d) => {
                const isSelected = d.day === selectedDay
                const isTodayCard = d.dateIso === todayIso
                const daySlots = TIMETABLE_PERIODS.map((p) =>
                  getEffectiveSlotForDayDate(d.day, d.dateIso, p.period),
                )
                const totalCount = daySlots.filter((x) => Boolean(x.slot)).length
                const subCount = daySlots.filter((x) => Boolean(x.slot?.isSubstitute)).length
                const leaveCount = daySlots.filter((x) => Boolean(x.coveredByLeave)).length
                return (
                  <button
                    key={d.day}
                    type="button"
                    onClick={() => setSelectedDay(d.day)}
                    className={`flex flex-col items-start rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? 'border-[#0f172a] bg-[#0f172a] text-white shadow-md'
                        : 'border-slate-200/80 bg-slate-50/70 text-slate-800 hover:border-emerald-400 hover:bg-emerald-50/40'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <span className="text-xs font-black">{d.day}</span>
                      {isTodayCard && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${
                            isSelected ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-600 text-white'
                          }`}
                        >
                          Today
                        </span>
                      )}
                    </div>
                    <span
                      className={`mt-0.5 text-[11px] font-bold ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {d.shortDate}
                    </span>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                          isSelected
                            ? 'bg-white/15 text-emerald-300'
                            : 'bg-white text-slate-700 ring-1 ring-slate-200'
                        }`}
                      >
                        {totalCount} {totalCount === 1 ? 'class' : 'classes'}
                      </span>
                      {subCount > 0 && (
                        <span className="rounded-full bg-violet-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                          +{subCount} Sub
                        </span>
                      )}
                      {leaveCount > 0 && (
                        <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                          {leaveCount} Leave
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Selected Day Chronological Schedule Breakdown */}
            <div className="mt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black text-slate-800">
                  {selectedDay} ({selectedDayMeta.shortDate}) Schedule · {selectedDayClassCount} of{' '}
                  {TIMETABLE_PERIODS.length} periods scheduled
                </p>
                {weekSubstituteCovers.length > 0 && (
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-[10px] font-black text-violet-800">
                    ✓ {weekSubstituteCovers.length} Substitute Cover
                    {weekSubstituteCovers.length === 1 ? '' : 's'} Auto-Added This Week
                  </span>
                )}
              </div>

              <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                {selectedDayPeriods.map(({ period, timeLabel, slot, coveredByLeave }) => (
                  <div
                    key={period}
                    className={`flex flex-col justify-between rounded-2xl border p-3.5 transition ${
                      slot?.isSubstitute
                        ? 'border-violet-300 bg-violet-50/70 ring-1 ring-violet-200'
                        : coveredByLeave
                          ? 'border-amber-300 bg-amber-50/60'
                          : slot
                            ? getSubjectCardTone(slot.subject)
                            : 'border-dashed border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Period {period} · {timeLabel}
                        </span>
                        {slot?.isSubstitute && (
                          <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-black text-white">
                            SUBSTITUTE COVER
                          </span>
                        )}
                        {coveredByLeave && (
                          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-slate-950">
                            ON LEAVE · COVERED
                          </span>
                        )}
                      </div>

                      {slot ? (
                        <>
                          <p className="mt-2 text-sm font-black text-slate-900">{slot.subject}</p>
                          <p className="mt-0.5 text-xs font-bold text-slate-700">
                            {effectiveFilterMode === 'class' ? slot.teacherName : slot.className} ·{' '}
                            <span className="text-slate-500">{slot.room}</span>
                          </p>
                          {slot.isSubstitute && slot.originalTeacherName && (
                            <p className="mt-1 text-[11px] font-extrabold text-violet-700">
                              Covering for {slot.originalTeacherName}
                              {slot.substituteDate ? ` (${formatPrettyDate(slot.substituteDate)})` : ''}
                            </p>
                          )}
                          {coveredByLeave && (
                            <p className="mt-1 text-[11px] font-extrabold text-amber-800">
                              Covered by {coveredByLeave.substituteTeacherName}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="mt-3 text-xs font-bold text-slate-400">
                          Free Period · Available for Prep or Substitute Cover
                        </p>
                      )}
                    </div>

                    {slot &&
                      !slot.isSubstitute &&
                      !coveredByLeave &&
                      role === 'teacher' &&
                      slot.teacherId === activeTeacherId && (
                        <div className="mt-3 flex justify-end border-t border-black/5 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setQuickSubSlot({
                                day: selectedDay,
                                dateIso: selectedDateIso,
                                period,
                                timeLabel,
                                className: slot.className,
                                subject: slot.subject,
                                room: slot.room,
                              })
                              setQuickSubReason('')
                              setQuickSubPrefId('')
                            }}
                            className="rounded-lg bg-white/90 px-2.5 py-1 text-[10px] font-extrabold text-slate-700 ring-1 ring-slate-200 hover:bg-[#0f172a] hover:text-emerald-300"
                          >
                            Request Substitute →
                          </button>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Admin Clash-Checked Slot Assigner / Editor */}
          {canEdit && (
            <form onSubmit={handleAssignSlot} className="dmhs-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-700">
                    Real-Time Clash Protection · Auto-Syncs Teacher &amp; Guardian Portals
                  </p>
                  <h3 className="text-base font-black text-slate-900">
                    {editingSlotId
                      ? `Edit Period (${slotDay} P${slotPeriod} · ${slotClass})`
                      : 'Assign Period to Master Timetable'}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {editingSlotId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSlotId(null)
                        setSlotError('')
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-extrabold text-slate-600"
                    >
                      Cancel Edit
                    </button>
                  )}
                  {liveClashWarning ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black text-rose-700">
                      <Icon name="alert" size={13} />
                      Conflict Detected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800">
                      <Icon name="check" size={13} />
                      Slot Clear · No Clashes
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Day
                  <select
                    value={slotDay}
                    onChange={(e) => setSlotDay(e.target.value as SchoolWeekday)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-900"
                  >
                    {WEEKDAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Period
                  <select
                    value={slotPeriod}
                    onChange={(e) => setSlotPeriod(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-900"
                  >
                    {TIMETABLE_PERIODS.map((p) => (
                      <option key={p.period} value={p.period}>
                        P{p.period} ({p.timeLabel})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Class
                  <select
                    value={slotClass}
                    onChange={(e) => setSlotClass(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-900"
                  >
                    {CLASS_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Teacher
                  <select
                    value={slotTeacherId}
                    onChange={(e) => setSlotTeacherId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-900"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Subject
                  <input
                    required
                    value={slotSubject}
                    onChange={(e) => setSlotSubject(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-900"
                  />
                </label>

                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Room / Lab
                  <input
                    required
                    value={slotRoom}
                    onChange={(e) => setSlotRoom(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-900"
                  />
                </label>
              </div>

              {(liveClashWarning || slotError) && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
                  {slotError || liveClashWarning}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-400">
                  Tip: Click any cell in the timetable grid below to edit an existing period or prefill an empty slot.
                </p>
                <button
                  type="submit"
                  className="rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
                >
                  {editingSlotId ? 'Save Period Changes' : '+ Assign Period (Clash-Checked)'}
                </button>
              </div>
            </form>
          )}

          {/* Weekly Grid */}
          <div className="dmhs-card overflow-x-auto p-5">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="w-32 px-3 py-3">Period / Time</th>
                  {schoolWeekDays.map((d) => {
                    const isToday = d.dateIso === todayIso
                    const isFocused = d.day === selectedDay
                    return (
                      <th key={d.day} className="px-2 py-2.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDay(d.day)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-left transition ${
                            isFocused
                              ? 'bg-[#0f172a] text-emerald-300'
                              : 'hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span className="font-black">
                            {d.day} · {d.shortDate}
                          </span>
                          {isToday && (
                            <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-black text-slate-950">
                              TODAY
                            </span>
                          )}
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {TIMETABLE_PERIODS.map((p) => (
                  <tr key={p.period}>
                    <td className="px-3 py-3 align-top">
                      <p className="font-black text-slate-900">Period {p.period}</p>
                      <p className="text-[10px] font-semibold text-slate-400">{p.timeLabel}</p>
                    </td>
                    {schoolWeekDays.map((d) => {
                      const day = d.day
                      const { slot, coveredByLeave } = getEffectiveSlotForDayDate(
                        day,
                        d.dateIso,
                        p.period,
                      )
                      const isTodayCol = d.dateIso === todayIso
                      const isFocusedCol = day === selectedDay
                      const isEditingThis = slot && editingSlotId === slot.id
                      return (
                        <td
                          key={day}
                          className={`px-2 py-2 align-top ${
                            isFocusedCol
                              ? 'bg-emerald-50/45'
                              : isTodayCol
                                ? 'bg-emerald-50/20'
                                : ''
                          }`}
                        >
                          {slot ? (
                            <div
                              onClick={() => {
                                setSelectedDay(day)
                                if (canEdit && !slot.isSubstitute) startEditingSlot(slot)
                              }}
                              className={`group relative cursor-pointer rounded-2xl border p-3 transition ${
                                slot.isSubstitute
                                  ? 'border-violet-300 bg-violet-50/80 ring-1 ring-violet-200'
                                  : coveredByLeave
                                    ? 'border-amber-300 bg-amber-50/60 opacity-85'
                                    : getSubjectCardTone(slot.subject)
                              } ${isEditingThis ? 'ring-2 ring-slate-900' : ''}`}
                            >
                              {slot.isSubstitute && (
                                <span className="mb-1 inline-block rounded-full bg-violet-600 px-2 py-0.5 text-[8px] font-black uppercase text-white">
                                  Sub Cover · {d.shortDate}
                                </span>
                              )}
                              {coveredByLeave && (
                                <span className="mb-1 inline-block rounded-full bg-amber-500 px-2 py-0.5 text-[8px] font-black uppercase text-slate-950">
                                  Covered ({coveredByLeave.substituteTeacherName?.split(' ')[0]})
                                </span>
                              )}
                              <p className="pr-5 font-black text-slate-900">{slot.subject}</p>
                              <p className="mt-0.5 text-[11px] font-bold text-slate-700">
                                {effectiveFilterMode === 'class' ? slot.teacherName : slot.className}
                              </p>
                              {slot.isSubstitute && slot.originalTeacherName && (
                                <p className="mt-0.5 text-[10px] font-bold text-violet-700">
                                  For {slot.originalTeacherName}
                                </p>
                              )}
                              <p className="mt-1.5 inline-block rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-extrabold text-slate-600 shadow-2xs">
                                {slot.room}
                              </p>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (editingSlotId === slot.id) setEditingSlotId(null)
                                    deleteTimetableSlot(slot.id)
                                  }}
                                  title="Remove slot"
                                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-slate-400 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
                                >
                                  <Icon name="close" size={12} />
                                </button>
                              )}
                            </div>
                          ) : canEdit ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDay(day)
                                prefillEmptySlot(day, p.period)
                              }}
                              className="flex h-20 w-full items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/40 text-[10px] font-bold text-slate-400 transition hover:border-emerald-400 hover:bg-emerald-50/40 hover:text-emerald-700"
                            >
                              + Assign {day} P{p.period}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedDay(day)}
                              className="flex h-20 w-full items-center justify-center rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/40 text-[10px] font-bold text-slate-300 transition hover:border-emerald-300 hover:text-slate-500"
                            >
                              Free Period
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick Inline Substitute Request Modal (Teacher) */}
          {quickSubSlot && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
              onClick={() => setQuickSubSlot(null)}
            >
              <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!quickSubReason.trim()) return
                  setQuickSubBusy(true)
                  const res = await requestTeacherLeave({
                    date: formatPrettyDate(quickSubSlot.dateIso),
                    dateIso: quickSubSlot.dateIso,
                    day: quickSubSlot.day,
                    period: quickSubSlot.period,
                    periodSlot: `${quickSubSlot.timeLabel} (Period ${quickSubSlot.period})`,
                    classSection: quickSubSlot.className,
                    subject: quickSubSlot.subject,
                    room: quickSubSlot.room,
                    preferredSubstituteId: quickSubPrefId || undefined,
                    reason: quickSubReason,
                  })
                  setQuickSubBusy(false)
                  if (res.ok) setQuickSubSlot(null)
                }}
                className="w-full max-w-md space-y-3 rounded-[28px] bg-white p-6 shadow-2xl"
              >
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                  Quick Leave &amp; Substitute Request
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  {quickSubSlot.subject} · {quickSubSlot.className}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  {formatPrettyDate(quickSubSlot.dateIso)} ({quickSubSlot.day} · Period{' '}
                  {quickSubSlot.period} · {quickSubSlot.timeLabel} · {quickSubSlot.room})
                </p>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Preferred Colleague Substitute (Optional)
                  </label>
                  <select
                    value={quickSubPrefId}
                    onChange={(e) => setQuickSubPrefId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                  >
                    <option value="">Any Available Free Teacher</option>
                    {teachers
                      .filter((t) => t.id !== activeTeacherId && t.status === 'active')
                      .map((t) => {
                        const busy = timetableSlots.some(
                          (s) =>
                            s.teacherId === t.id &&
                            s.day === quickSubSlot.day &&
                            s.period === quickSubSlot.period &&
                            (!s.isSubstitute || s.substituteDate === quickSubSlot.dateIso),
                        )
                        return (
                          <option key={t.id} value={t.id} disabled={busy}>
                            {t.name} ({t.subject}) — {busy ? 'Busy (Clash)' : 'Free ✓'}
                          </option>
                        )
                      })}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Reason for Leave *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={quickSubReason}
                    onChange={(e) => setQuickSubReason(e.target.value)}
                    placeholder="e.g., Medical appointment, family event, or training..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setQuickSubSlot(null)}
                    className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={quickSubBusy}
                    className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-black text-emerald-300 disabled:opacity-50"
                  >
                    {quickSubBusy ? 'Submitting...' : 'Submit Substitute Request'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* EXAM ROUTINE SCHEDULER */}
      {subTab === 'exams' && (
        <div className="space-y-6">
          {canEdit && (
            <form onSubmit={handleAddExam} className="dmhs-card p-6">
              <h3 className="text-base font-black text-slate-900">
                Schedule Exam Paper (Hall &amp; Invigilator Clash-Checked)
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <input
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="Exam Name"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                />
                <select
                  value={examClass}
                  onChange={(e) => setExamClass(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                >
                  {CLASS_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  required
                  value={examSubject}
                  onChange={(e) => setExamSubject(e.target.value)}
                  placeholder="Subject Paper"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                />
                <input
                  required
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  placeholder="e.g. 09 Dec 2026"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                />
                <input
                  required
                  value={examRoom}
                  onChange={(e) => setExamRoom(e.target.value)}
                  placeholder="Exam Hall"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                />
                <select
                  value={examInvigilator}
                  onChange={(e) => setExamInvigilator(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {examError && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
                  {examError}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <input
                  value={examTime}
                  onChange={(e) => setExamTime(e.target.value)}
                  placeholder="09:00 AM – 11:30 AM"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                />
                <button
                  type="submit"
                  className="rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700"
                >
                  + Add to Exam Routine
                </button>
              </div>
            </form>
          )}

          <div className="dmhs-card overflow-x-auto p-5">
            {visibleExams.length === 0 ? (
              <div className="py-10 text-center text-xs font-bold text-slate-400">
                No exam papers scheduled yet for this view.
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-3">Date &amp; Time</th>
                    <th className="px-3 py-3">Class</th>
                    <th className="px-3 py-3">Subject</th>
                    <th className="px-3 py-3">Exam Hall</th>
                    <th className="px-3 py-3">Invigilator</th>
                    {canEdit && <th className="px-3 py-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleExams.map((ex) => (
                    <tr key={ex.id}>
                      <td className="px-3 py-3">
                        <p className="font-black text-slate-900">{ex.date}</p>
                        <p className="text-[11px] text-slate-500">{ex.timeSlot}</p>
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-800">{ex.className}</td>
                      <td className="px-3 py-3 font-black text-emerald-800">{ex.subject}</td>
                      <td className="px-3 py-3 font-bold text-slate-700">{ex.room}</td>
                      <td className="px-3 py-3 font-semibold text-slate-600">
                        {ex.invigilatorName}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => deleteExamSchedule(ex.id)}
                            className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-extrabold text-rose-600 hover:bg-rose-100"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </PageShell>
  )
}
