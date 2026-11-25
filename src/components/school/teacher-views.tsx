'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { downloadExcelCsv } from '@/lib/csv-export'
import { getTaskProgressPct, scopeTasksForActor } from '@/lib/dmhs-tasks'
import { VerificationSealBadge } from './biometric-ui'
import { DateFilterBar, formatPrettyDate, getTodayIso } from './date-utils'
import { Icon } from './icons'
import { useSchool } from './store'
import type { AccentColor, AttendanceStatus, FeedbackCategory, PeriodSlot, SchoolWeekday } from './types'
import { AttendanceBadge, ClassCard, FeedbackBadge, PageShell, SectionTitle } from './ui'

export function TeacherOverview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const {
    role,
    students,
    teachers,
    staffMembers,
    activeTeacherId,
    timetableSlots = [],
    campusTasks,
    leaveRequests,
    ptmRequests,
    updateLeaveStatus,
    addLeaveDiscussionMessage,
  } = useSchool()
  const [leaveDrafts, setLeaveDrafts] = useState<Record<string, string>>({})
  const class6A = students.filter((s) => s.className === 'Class 6')
  const presentCount = class6A.filter((s) => s.todayStatus === 'present').length
  const absentOrLate = class6A.filter(
    (s) => s.todayStatus === 'absent' || s.todayStatus === 'late',
  )
  const pendingLeaves = leaveRequests.filter((l) => l.status === 'pending')

  const activeTeacher = teachers.find((t) => t.id === activeTeacherId) || teachers[0]
  const myAssignedOpenTasks = useMemo(
    () =>
      scopeTasksForActor(campusTasks, 'teacher', activeTeacherId, teachers, staffMembers).filter(
        (t) => t.status !== 'completed',
      ),
    [campusTasks, activeTeacherId, teachers, staffMembers],
  )
  const todayDay: SchoolWeekday = (['Sun', 'Mon', 'Tue', 'Wed', 'Thu'] as SchoolWeekday[])[
    new Date().getDay()
  ] || 'Sun'

  const liveTodaySchedule = useMemo<PeriodSlot[]>(() => {
    const pickColor = (sub: string): AccentColor => {
      const s = sub.toLowerCase()
      if (s.includes('math')) return 'violet'
      if (s.includes('phys') || s.includes('ict')) return 'cyan'
      if (s.includes('eng')) return 'orange'
      return 'lime'
    }
    const todayIso = getTodayIso()
    return timetableSlots
      .filter((slot) => {
        if (slot.teacherId !== activeTeacher?.id || slot.day !== todayDay) return false
        if (slot.isSubstitute && slot.substituteDate && slot.substituteDate !== todayIso) {
          return false
        }
        return true
      })
      .sort((a, b) => a.period - b.period)
      .map((slot) => {
        const [startPart, endPart] = slot.timeLabel.split(/[–-]/).map((x) => x.trim())
        return {
          id: slot.id,
          time: startPart || '08:15',
          end: endPart || '09:00',
          subject: slot.isSubstitute ? `${slot.subject} (Sub Cover)` : slot.subject,
          topic: slot.isSubstitute
            ? `${slot.className} · Covering ${slot.originalTeacherName || 'Faculty'} · P${slot.period}`
            : `${slot.className} · Period ${slot.period}`,
          teacher: slot.teacherName,
          room: slot.room,
          color: pickColor(slot.subject),
        }
      })
  }, [timetableSlots, activeTeacher?.id, todayDay])

  return (
    <>
      <section className="dmhs-hero relative overflow-hidden rounded-[28px] p-6 text-white sm:p-8">
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-emerald-300 ring-1 ring-white/10">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              DMHA Faculty Command · {liveTodaySchedule.length} {liveTodaySchedule.length === 1 ? 'Period' : 'Periods'} Today ({todayDay})
            </span>
            <h2 className="mt-5 text-3xl font-black leading-[1.08] tracking-[-.03em] sm:text-4xl">
              Teach. Guide. <span className="text-emerald-400">Keep parents informed.</span>
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
              Mark digital roll call, post student feedback, publish grades, and approve guardian
              leave requests—synced directly to the Guardian Portal.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <button
                onClick={() => onNavigate('attendance')}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-emerald-300"
              >
                <Icon name="check" size={16} />
                Take Roll Call
              </button>
              <button
                onClick={() => onNavigate('feedback')}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 py-3 text-xs font-extrabold text-white transition hover:bg-white/15"
              >
                <Icon name="star" size={16} />
                Send Guardian Feedback
              </button>
              <button
                onClick={() => onNavigate('exams')}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 py-3 text-xs font-extrabold text-white transition hover:bg-white/15"
              >
                <Icon name="exam" size={16} />
                Enter Grades
              </button>
              <button
                onClick={() => onNavigate('scripts')}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 py-3 text-xs font-extrabold text-white transition hover:bg-white/15"
              >
                <Icon name="sheet" size={16} />
                Scan / Upload Exam Sheets
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:min-w-[260px]">
            <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Class 6A Today
              </p>
              <p className="mt-1 text-2xl font-black text-emerald-300">
                {presentCount}/{class6A.length}
              </p>
              <p className="mt-0.5 text-[10px] text-white/50">
                {absentOrLate.length} late/absent flagged
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                PTM & Leaves
              </p>
              <p className="mt-1 text-2xl font-black">
                {pendingLeaves.length} / {ptmRequests.length}
              </p>
              <p className="mt-0.5 text-[10px] text-white/50">Pending leaves · PTMs</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRINCIPAL ASSIGNED TASKS QUICK ACTION STRIP */}
      {myAssignedOpenTasks.length > 0 && (
        <section className="mt-5 rounded-[24px] border border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/50 p-4 shadow-2xs sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#0f172a] text-emerald-300">
                <Icon name="clipboard" size={18} />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  Principal Office Delegation · {myAssignedOpenTasks.length} Open{' '}
                  {myAssignedOpenTasks.length === 1 ? 'Task' : 'Tasks'}
                </p>
                <h3 className="text-sm font-black text-slate-900">
                  Tasks Assigned to {activeTeacher?.name || 'You'}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="rounded-full bg-[#0f172a] px-4 py-2 text-xs font-black text-emerald-300 shadow-2xs transition hover:bg-slate-800"
            >
              Open Assigned Tasks →
            </button>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {myAssignedOpenTasks.slice(0, 2).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onNavigate('tasks')}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-left transition hover:border-emerald-400"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                        t.priority === 'Urgent'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {t.priority}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Due {t.dueDate}</span>
                  </div>
                  <p className="mt-1 truncate text-xs font-black text-slate-900">{t.title}</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800">
                  {getTaskProgressPct(t)}%
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <section>
          <SectionTitle
            eyebrow="Today’s teaching"
            title="Scheduled periods"
            action="Full timetable"
            onAction={() => onNavigate('schedule')}
          />
          <div className="space-y-2.5">
            {liveTodaySchedule.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center text-xs font-bold text-slate-400">
                No classes assigned for {activeTeacher?.name || 'you'} on {todayDay} yet.
              </div>
            ) : (
              liveTodaySchedule.map((item) => (
                <ClassCard
                  key={item.id}
                  item={item}
                  onClick={() => onNavigate('schedule')}
                />
              ))
            )}
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="Guardian requests" title="Pending leave approvals" />
          <div className="space-y-3">
            {pendingLeaves.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center text-xs font-bold text-black/40">
                All guardian leave applications have been reviewed.
              </div>
            ) : (
              pendingLeaves.map((lv) => {
                const thread = lv.messages || []
                const draftText = leaveDrafts[lv.id] || ''
                return (
                  <div
                    key={lv.id}
                    className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-slate-900">{lv.studentName}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-black/55">
                          From {lv.guardianName} (Parent of {lv.studentName}): “{lv.reason}”
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                        {lv.dateRange}
                      </span>
                    </div>

                    {lv.verification && (
                      <div className="mt-2">
                        <VerificationSealBadge verification={lv.verification} />
                      </div>
                    )}

                    {/* Inline Discussion Thread with Parent */}
                    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Leave Discussion ({thread.length})
                      </p>
                      {thread.length > 0 && (
                        <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
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
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (!draftText.trim()) return
                          addLeaveDiscussionMessage(lv.id, draftText)
                          setLeaveDrafts((prev) => ({ ...prev, [lv.id]: '' }))
                        }}
                        className="mt-2.5 flex gap-2"
                      >
                        <input
                          value={draftText}
                          onChange={(e) =>
                            setLeaveDrafts((prev) => ({ ...prev, [lv.id]: e.target.value }))
                          }
                          placeholder={`Message ${lv.guardianName} about ${lv.studentName}’s leave...`}
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
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => updateLeaveStatus(lv.id, 'approved')}
                        className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-[11px] font-black text-slate-950 transition hover:bg-emerald-400"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateLeaveStatus(lv.id, 'declined')}
                        className="flex-1 rounded-xl bg-slate-100 py-2.5 text-[11px] font-black text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </>
  )
}

function normalizeClassToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function studentInAssignedClasses(
  stu: { className: string; section: string },
  assignedClasses: string[],
): boolean {
  if (!assignedClasses || assignedClasses.length === 0) return false
  const fullToken = normalizeClassToken(`${stu.className} ${stu.section}`)
  const classOnlyToken = normalizeClassToken(stu.className)
  const sectionLetter = stu.section.replace(/section/i, '').trim().toLowerCase()
  const compactToken = normalizeClassToken(`${stu.className}${sectionLetter}`)
  return assignedClasses.some((cls) => {
    const token = normalizeClassToken(cls)
    return token !== '' && (token === fullToken || token === compactToken || token === classOnlyToken)
  })
}

export function TeacherRollCallView() {
  const { role, students, teachers, activeTeacherId, saveRollCallAndNotify } = useSchool()
  const activeTeacher = teachers.find((t) => t.id === activeTeacherId) || teachers[0]
  const assignedClasses = activeTeacher?.assignedClasses || []
  const isTeacherScoped = role === 'teacher'

  const todayIso = getTodayIso()
  const [selectedDate, setSelectedDate] = useState<string>(todayIso)
  const isToday = selectedDate === todayIso

  const activeStudents = useMemo(
    () =>
      students.filter((s) => {
        if (s.status === 'suspended') return false
        if (isTeacherScoped) {
          return studentInAssignedClasses(s, assignedClasses)
        }
        return true
      }),
    [students, isTeacherScoped, assignedClasses],
  )

  const classSectionLabels = useMemo(
    () => [
      'All',
      ...Array.from(new Set(activeStudents.map((s) => `${s.className} · ${s.section}`))).sort(),
    ],
    [activeStudents],
  )

  const [classFilter, setClassFilter] = useState('All')
  const effectiveFilter = classSectionLabels.includes(classFilter) ? classFilter : 'All'

  const classStudents = useMemo(
    () =>
      effectiveFilter === 'All'
        ? activeStudents
        : activeStudents.filter((s) => `${s.className} · ${s.section}` === effectiveFilter),
    [activeStudents, effectiveFilter],
  )

  const [savedDates, setSavedDates] = useState<string[]>([])
  const [dateRecords, setDateRecords] = useState<
    Record<string, { status: AttendanceStatus; markedByName: string; markedAt: string }>
  >({})
  const [loadingDate, setLoadingDate] = useState(false)
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(activeStudents.map((s) => [s.id, s.todayStatus])),
  )
  const [saving, setSaving] = useState(false)
  const [saveBanner, setSaveBanner] = useState<{ ok: boolean; msg: string } | null>(null)

  const loadDateRegister = async (targetDate: string) => {
    setLoadingDate(true)
    setSaveBanner(null)
    try {
      const res = await fetch(`/dmhs-api/attendance?date=${encodeURIComponent(targetDate)}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        records?: Array<{
          studentId: string
          status: AttendanceStatus
          markedByName: string
          markedAt: string
        }>
        savedDates?: string[]
      }
      if (json.ok) {
        if (Array.isArray(json.savedDates)) {
          setSavedDates(json.savedDates)
        }
        const recMap: Record<
          string,
          { status: AttendanceStatus; markedByName: string; markedAt: string }
        > = {}
        ;(json.records || []).forEach((r) => {
          recMap[r.studentId] = {
            status: r.status,
            markedByName: r.markedByName,
            markedAt: r.markedAt,
          }
        })
        setDateRecords(recMap)
        const nextDraft: Record<string, AttendanceStatus> = {}
        activeStudents.forEach((s) => {
          if (recMap[s.id]) {
            nextDraft[s.id] = recMap[s.id].status
          } else if (targetDate === todayIso) {
            nextDraft[s.id] = s.todayStatus
          } else {
            nextDraft[s.id] = 'present'
          }
        })
        setDraft(nextDraft)
      }
    } finally {
      setLoadingDate(false)
    }
  }

  useEffect(() => {
    void loadDateRegister(selectedDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, activeTeacherId, role, activeStudents.length])

  const setStatus = (id: string, status: AttendanceStatus) => {
    setDraft((prev) => ({ ...prev, [id]: status }))
  }

  const markAllPresent = () => {
    setDraft((prev) => ({
      ...prev,
      ...Object.fromEntries(classStudents.map((s) => [s.id, 'present' as AttendanceStatus])),
    }))
  }

  const handleSaveRollCall = async () => {
    if (classStudents.length === 0) return
    setSaving(true)
    setSaveBanner(null)
    const payload: Record<string, AttendanceStatus> = Object.fromEntries(
      classStudents.map((s) => [s.id, draft[s.id] || (isToday ? s.todayStatus : 'present')]),
    )
    const res = await saveRollCallAndNotify(payload, selectedDate)
    setSaving(false)
    if (res.ok) {
      await loadDateRegister(selectedDate)
      setSaveBanner({
        ok: true,
        msg: isToday
          ? `Saved today's roll call (${formatPrettyDate(selectedDate)}) for ${res.updatedCount || classStudents.length} student(s) to SQLite Register & synced to Guardians.`
          : `Updated historical roll call for ${formatPrettyDate(selectedDate)} (${res.updatedCount || classStudents.length} student(s)) in SQLite Register.`,
      })
    } else {
      setSaveBanner({
        ok: false,
        msg: res.error || 'Roll call submission blocked by server.',
      })
    }
  }

  const recordedCountInView = classStudents.filter((s) => Boolean(dateRecords[s.id])).length
  const firstRecorder = Object.values(dateRecords)[0]

  const counts = classStudents.reduce(
    (acc, stu) => {
      const st = draft[stu.id] || (isToday ? stu.todayStatus : 'present')
      acc[st] += 1
      return acc
    },
    { present: 0, late: 0, absent: 0, leave: 0 },
  )

  const selectedDatePretty = formatPrettyDate(selectedDate)

  return (
    <PageShell
      eyebrow={`Digital Register · ${selectedDatePretty}${isToday ? ' (Today)' : ' (Historical)'}${isTeacherScoped ? ` · ${activeTeacher?.name}` : ''}`}
      title="Daily Roll Call & Attendance History"
      subtitle={
        isTeacherScoped
          ? `Restricted to your assigned classes (${assignedClasses.join(', ') || 'None assigned'}). Pick any date to view or update previous roll calls directly in SQLite.`
          : 'Switch dates to inspect or edit previous roll call registers, or use 1-Tap Mark All Present for today. Every change writes directly to SQLite.'
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={classStudents.length === 0}
            onClick={() =>
              downloadExcelCsv(
                `DMHA-RollCall-${selectedDate}.csv`,
                ['Date', 'Student Name', 'Class & Section', 'Roll', 'Status', 'Marked By'],
                classStudents.map((stu) => [
                  selectedDate,
                  stu.name,
                  `${stu.className} · ${stu.section}`,
                  stu.roll,
                  (draft[stu.id] || (isToday ? stu.todayStatus : 'present')).toUpperCase(),
                  dateRecords[stu.id]?.markedByName || (isToday ? 'Live Register' : 'Unsaved'),
                ]),
              )
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-extrabold text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/60 disabled:opacity-40"
          >
            <Icon name="sheet" size={14} className="text-emerald-600" />
            Export {selectedDate} CSV
          </button>
          <button
            type="button"
            disabled={classStudents.length === 0 || saving}
            onClick={markAllPresent}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-xs font-black text-black transition hover:brightness-95 disabled:opacity-40"
          >
            <Icon name="check" size={15} />
            Mark All Present
          </button>
          <button
            type="button"
            disabled={classStudents.length === 0 || saving}
            onClick={() => void handleSaveRollCall()}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-5 py-3 text-xs font-extrabold text-emerald-300 shadow-lg transition hover:opacity-90 disabled:opacity-40"
          >
            <Icon name="send" size={15} />
            {saving
              ? 'Saving to SQLite...'
              : isToday
                ? 'Save & Notify Guardians'
                : `Save ${selectedDate} Register`}
          </button>
        </div>
      }
    >
      {/* Date Navigator & Saved Roll Call History Bar */}
      <div className="mb-4">
        <DateFilterBar
          value={selectedDate}
          onChange={setSelectedDate}
          allowAll={false}
          label="Register Date"
          savedDates={savedDates}
          rightSlot={
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                loadingDate
                  ? 'bg-slate-100 text-slate-500'
                  : recordedCountInView > 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : isToday
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
              }`}
            >
              {loadingDate
                ? 'Loading SQLite...'
                : recordedCountInView > 0
                  ? `${recordedCountInView}/${classStudents.length} Saved in SQLite${firstRecorder ? ` · ${firstRecorder.markedByName}` : ''}`
                  : isToday
                    ? 'Live Today · Ready to Save'
                    : 'No Register Saved Yet'}
            </span>
          }
        />
      </div>

      {!isToday && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200/80 bg-indigo-50/70 px-4 py-3 text-xs font-bold text-indigo-950">
          <span>
            Viewing Historical Roll Call for <strong>{selectedDatePretty}</strong> — edits here
            update this past date&apos;s SQLite record without overwriting today&apos;s live gate
            status.
          </span>
          <button
            type="button"
            onClick={() => setSelectedDate(todayIso)}
            className="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-black text-white hover:bg-indigo-700"
          >
            Jump Back to Today
          </button>
        </div>
      )}

      {isTeacherScoped && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-xs font-bold text-emerald-900">
          <span className="inline-flex items-center gap-2">
            <Icon name="shield" size={15} className="text-emerald-700" />
            Assigned Classes Only: <strong>{assignedClasses.join(' · ') || 'No classes assigned'}</strong>
          </span>
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
            Server RBAC Enforced
          </span>
        </div>
      )}

      {saveBanner && (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-xs font-bold ${
            saveBanner.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {saveBanner.msg}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {classSectionLabels.map((cls) => (
          <button
            key={cls}
            type="button"
            onClick={() => setClassFilter(cls)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
              effectiveFilter === cls ? 'bg-[#0f172a] text-emerald-300' : 'bg-white text-black/55'
            }`}
          >
            {cls === 'All'
              ? `All Assigned (${activeStudents.length})`
              : `${cls} (${activeStudents.filter((s) => `${s.className} · ${s.section}` === cls).length})`}
          </button>
        ))}
      </div>
      <div className="mb-5 grid grid-cols-4 gap-2.5">
        <div className="rounded-2xl bg-white p-3.5 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">Present</p>
          <p className="mt-1 text-2xl font-black text-emerald-800">{counts.present}</p>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">Late</p>
          <p className="mt-1 text-2xl font-black text-[#9a6200]">{counts.late}</p>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">Absent</p>
          <p className="mt-1 text-2xl font-black text-[#c53219]">{counts.absent}</p>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">On Leave</p>
          <p className="mt-1 text-2xl font-black text-[#6935c3]">{counts.leave}</p>
        </div>
      </div>
      <div className="space-y-3">
        {classStudents.map((stu) => {
          const current = draft[stu.id] || (isToday ? stu.todayStatus : 'present')
          const savedRec = dateRecords[stu.id]
          return (
            <div
              key={stu.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-black/5 bg-white p-4 shadow-[0_8px_24px_rgba(20,20,30,.04)]"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#0f172a] text-xs font-black text-emerald-300">
                  {stu.initials}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black">{stu.name}</p>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                      {stu.className} · {stu.section}
                    </span>
                    <span className="rounded-md bg-black/5 px-2 py-0.5 text-[10px] font-bold text-black/50">
                      Roll #{stu.roll}
                    </span>
                    {savedRec ? (
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                        SQLite · {savedRec.markedByName}
                      </span>
                    ) : !isToday ? (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                        Not recorded yet
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] font-semibold text-black/45">
                    Guardian: {stu.guardianName} · {stu.guardianPhone}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {(['present', 'late', 'absent', 'leave'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatus(stu.id, status)}
                    className={`rounded-xl px-3.5 py-2 text-[11px] font-extrabold capitalize transition ${
                      current === status
                        ? status === 'present'
                          ? 'bg-emerald-500 text-slate-950'
                          : status === 'absent'
                            ? 'bg-[#ff6846] text-white'
                            : status === 'late'
                              ? 'bg-[#ffc642] text-black'
                              : 'bg-[#6935c3] text-white'
                        : 'bg-[#f4f5f8] text-black/45 hover:bg-black/8'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
        Tip: Use the <strong>Register Date</strong> arrows or calendar picker above to review or
        correct any previous day&apos;s roll call, or jump back to <strong>Today</strong> to alert
        guardians in real time.
      </div>
    </PageShell>
  )
}

export function TeacherFeedbackComposerView() {
  const { students, feedback, addTeacherFeedback } = useSchool()
  const [studentId, setStudentId] = useState(students[0].id)
  const [subject, setSubject] = useState('Physics')
  const [category, setCategory] = useState<FeedbackCategory>('praise')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')

  const quickPresets: {
    label: string
    category: FeedbackCategory
    title: string
    message: string
  }[] = [
    {
      label: 'Great class focus',
      category: 'praise',
      title: 'Excellent focus & participation today',
      message:
        'Actively participated in class discussion, answered analytical questions clearly, and helped peers stay on track.',
    },
    {
      label: 'Homework incomplete',
      category: 'attention',
      title: 'Homework submitted incomplete',
      message:
        'Today’s assigned worksheet was partially incomplete. Please help review the remaining questions at home before next period.',
    },
    {
      label: 'Quiz score improved',
      category: 'academic',
      title: 'Strong upward trend in class quiz',
      message:
        'Showed clear conceptual improvement on today’s short assessment compared to last week. Keep up the steady revision!',
    },
    {
      label: 'Needs exam revision',
      category: 'attention',
      title: 'Recommended extra revision before Term Final',
      message:
        'Struggled with multi-step problem solving in today’s practice set. 20 minutes of daily structured practice is recommended.',
    },
    {
      label: 'Exemplary conduct',
      category: 'behavior',
      title: 'Respectful & collaborative classroom conduct',
      message:
        'Demonstrated leadership, courtesy, and responsibility throughout the school day.',
    },
  ]

  const applyPreset = (preset: (typeof quickPresets)[number]) => {
    setCategory(preset.category)
    setTitle(preset.title)
    setMessage(preset.message)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return
    addTeacherFeedback({ studentId, subject, category, title, message })
    setTitle('')
    setMessage('')
  }

  return (
    <PageShell
      eyebrow="Parent communication"
      title="Student Feedback & Conduct Notes"
      subtitle="Use 1-tap Quick Feedback Chips or write a custom observation — synced instantly to the student's guardian."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_10px_30px_rgba(20,20,30,.04)]"
        >
          <h3 className="text-base font-black">Post New Feedback</h3>

          {/* 3-Second Quick Feedback Chips */}
          <div className="mt-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">
              3-Second Quick Chips
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickPresets.map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="rounded-full border border-black/8 bg-[#f4f5f8] px-3 py-1.5 text-[11px] font-extrabold text-black/75 transition hover:border-black hover:bg-emerald-500 hover:text-slate-950"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] font-extrabold text-black/60">
              Student
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1.5 w-full rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.className} {s.section})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[11px] font-extrabold text-black/60">
              Subject
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5 w-full rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
              >
                <option>Physics</option>
                <option>Mathematics</option>
                <option>Chemistry</option>
                <option>English</option>
                <option>ICT & Robotics</option>
                <option>General Conduct</option>
              </select>
            </label>
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-extrabold text-black/60">Feedback Category</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ['praise', 'Praise'],
                  ['academic', 'Academic'],
                  ['behavior', 'Conduct'],
                  ['attention', 'Attention'],
                ] as const
              ).map(([cat, label]) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`rounded-xl py-2 text-[11px] font-extrabold transition ${
                    category === cat
                      ? 'bg-[#0f172a] text-emerald-300'
                      : 'bg-[#f4f5f8] text-black/55'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-3 block text-[11px] font-extrabold text-black/60">
            Headline
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Great leadership during today's group experiment"
              className="mt-1.5 w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-black/15"
            />
          </label>

          <label className="mt-3 block text-[11px] font-extrabold text-black/60">
            Detailed Observation for Guardian
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write actionable details the parent can support at home..."
              className="mt-1.5 w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-black/15"
            />
          </label>

          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-emerald-400 py-3 text-xs font-black text-black transition hover:brightness-95"
          >
            Publish Feedback to Guardian & Student
          </button>
        </form>

        <section>
          <SectionTitle eyebrow="Published log" title="Recent remarks & guardian replies" />
          <div className="space-y-3">
            {feedback.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FeedbackBadge category={item.category} />
                    <span className="text-xs font-black">{item.studentName}</span>
                    <span className="text-[10px] font-bold text-black/40">· {item.subject}</span>
                  </div>
                  <span className="text-[10px] font-bold text-black/30">{item.date}</span>
                </div>
                <p className="mt-2 text-xs font-extrabold">{item.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-black/55">{item.message}</p>
                {item.guardianReply && (
                  <p className="mt-2.5 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800">
                    Guardian Reply: “{item.guardianReply}”
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  )
}

export function TeacherGradebookView() {
  const { students, updateSubjectScore } = useSchool()
  const editableStudents = students.filter((s) => s.subjects.length > 0)
  const [selectedStudentId, setSelectedStudentId] = useState(editableStudents[0].id)
  const student =
    editableStudents.find((s) => s.id === selectedStudentId) || editableStudents[0]

  const [scores, setScores] = useState<Record<string, string>>({})

  return (
    <PageShell
      eyebrow="Assessments & marks"
      title="Interactive Gradebook"
      subtitle="Update exam marks and publish instantly to the student and guardian report cards."
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {editableStudents.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedStudentId(s.id)}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
              s.id === student.id ? 'bg-[#0f172a] text-emerald-300' : 'bg-white text-black/60'
            }`}
          >
            {s.name} ({s.className} {s.section}) · Avg {s.averageScore}%
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {student.subjects.map((sub) => {
          const val = scores[sub.id] ?? String(sub.latestScore)
          return (
            <div
              key={sub.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="text-sm font-black">{sub.name}</p>
                <p className="text-[11px] font-semibold text-black/45">
                  Current: {sub.latestScore}% ({sub.grade}) · Prev: {sub.previousScore}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={val}
                  onChange={(e) => setScores((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                  className="w-20 rounded-xl bg-[#f4f5f8] px-3 py-2 text-center text-xs font-black outline-none"
                />
                <button
                  onClick={() => updateSubjectScore(student.id, sub.id, Number(val))}
                  className="rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300"
                >
                  Publish Score
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </PageShell>
  )
}
