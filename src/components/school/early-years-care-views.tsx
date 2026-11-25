'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { DateFilterBar, formatPrettyDate, getTodayIso, matchesDateFilter } from './date-utils'
import { ChildSwitcherBar } from './guardian-views'
import { useSchool } from './store'
import type { EarlyYearsCareLog } from './types'
import { PageShell } from './ui'

const MEAL_OPTIONS: EarlyYearsCareLog['mealStatus'][] = [
  'Finished All',
  'Ate Most',
  'Ate Little',
  'Refused',
]
const MOOD_OPTIONS: EarlyYearsCareLog['mood'][] = [
  'Happy & Active',
  'Calm & Focused',
  'Tired / Quiet',
  'Needs Extra Care',
]

function normCls(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

export function EarlyYearsCareView() {
  const {
    role,
    authUser,
    students,
    teachers,
    guardians,
    earlyYearsCareLogs,
    selectedChildId,
    activeGuardianId,
    activeTeacherId,
    logEarlyYearsCare,
    acknowledgeEarlyYearsCare,
    deleteEarlyYearsCare,
  } = useSchool()

  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isGuardian = role === 'guardian'
  const canLog = isAdmin || isTeacher

  const activeTeacher = teachers.find((t) => t.id === activeTeacherId)
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

  const manageableStudents = useMemo(() => {
    if (isAdmin) return students
    if (isTeacher) {
      const assigned = (activeTeacher?.assignedClasses || []).map(normCls)
      return students.filter((s) => {
        const full = normCls(`${s.className} ${s.section}`)
        const secL = s.section.replace(/section/i, '').trim().toLowerCase()
        const compact = normCls(`${s.className}${secL}`)
        const grade = normCls(s.className)
        return assigned.includes(full) || assigned.includes(compact) || assigned.includes(grade)
      })
    }
    return []
  }, [isAdmin, isTeacher, students, activeTeacher])

  const [studentId, setStudentId] = useState(
    () => manageableStudents[0]?.id || students[0]?.id || '',
  )
  const [dateIso, setDateIso] = useState(getTodayIso())
  const [mealStatus, setMealStatus] = useState<EarlyYearsCareLog['mealStatus']>('Finished All')
  const [mood, setMood] = useState<EarlyYearsCareLog['mood']>('Happy & Active')
  const [napOrActivity, setNapOrActivity] = useState('')
  const [hygieneOrHealth, setHygieneOrHealth] = useState('')
  const [teacherNote, setTeacherNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [dateFilter, setDateFilter] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (
      canLog &&
      manageableStudents.length > 0 &&
      !manageableStudents.some((s) => s.id === studentId)
    ) {
      setStudentId(manageableStudents[0].id)
    }
  }, [canLog, manageableStudents, studentId])

  const visibleLogs = useMemo(() => {
    return earlyYearsCareLogs
      .filter((l) => (isGuardian && selectedChild ? l.studentId === selectedChild.id : true))
      .filter((l) => (!dateFilter ? true : matchesDateFilter(l.dateIso, dateFilter)))
  }, [earlyYearsCareLogs, isGuardian, selectedChild, dateFilter])

  const savedDates = useMemo(
    () => Array.from(new Set(earlyYearsCareLogs.map((l) => l.dateIso))).sort((a, b) => b.localeCompare(a)).slice(0, 6),
    [earlyYearsCareLogs],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId) return
    setSaving(true)
    const res = await logEarlyYearsCare({
      studentId,
      dateIso,
      mealStatus,
      mood,
      napOrActivity: napOrActivity.trim(),
      hygieneOrHealth: hygieneOrHealth.trim(),
      teacherNote: teacherNote.trim(),
    })
    setSaving(false)
    if (res.ok) {
      setNapOrActivity('')
      setHygieneOrHealth('')
      setTeacherNote('')
    }
  }

  return (
    <PageShell
      eyebrow="DMHA Early Years & Primary Care · Unit - 1 & Unit - 2"
      title={
        isGuardian && selectedChild
          ? `${selectedChild.name}’s Daily Care & Tiffin Log`
          : 'Early-Years Daily Care Log (Tiffin, Mood & Wellness)'
      }
      subtitle={
        canLog
          ? 'Log 1-tap daily care cards (tiffin/meal intake, mood, nap/activity & teacher note) — delivered privately to the child’s guardian.'
          : 'Real-time daily wellbeing cards from your child’s class teacher: tiffin finished, mood & energy, classroom activity, and teacher notes.'
      }
    >
      {isGuardian && <ChildSwitcherBar />}

      <div className="grid gap-6 lg:grid-cols-[.95fr_1.05fr]">
        {/* Left: Teacher / Admin 1-Tap Care Card Logger */}
        {canLog && (
          <form
            onSubmit={handleSubmit}
            className="dmhs-card h-fit rounded-[24px] border-2 border-emerald-500/20 bg-white p-5"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
              1-Tap Daily Care Card
            </p>
            <h3 className="mt-0.5 text-base font-black text-slate-900">
              Log Student Tiffin, Mood &amp; Daily Care
            </h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] font-extrabold text-slate-600">
                Student ({isTeacher ? 'Assigned Classes' : 'All Students'})
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                >
                  {manageableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.className} · {s.section})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[11px] font-extrabold text-slate-600">
                Care Date
                <input
                  type="date"
                  value={dateIso}
                  onChange={(e) => setDateIso(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>
            </div>

            <div className="mt-3">
              <p className="text-[11px] font-extrabold text-slate-600">Tiffin / Meal Eaten</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {MEAL_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setMealStatus(opt)}
                    className={`rounded-xl px-2.5 py-2 text-[11px] font-extrabold transition ${
                      mealStatus === opt
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <p className="text-[11px] font-extrabold text-slate-600">Mood &amp; Participation</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {MOOD_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setMood(opt)}
                    className={`rounded-xl px-3 py-2 text-[11px] font-extrabold transition ${
                      mood === opt
                        ? 'bg-[#0f172a] text-emerald-400'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              <label className="block text-[11px] font-extrabold text-slate-600">
                Nap / Classroom Activity Highlight
                <input
                  value={napOrActivity}
                  onChange={(e) => setNapOrActivity(e.target.value)}
                  placeholder="e.g., Enjoyed storytelling, finger painting & 20 min quiet rest"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none"
                />
              </label>
              <label className="block text-[11px] font-extrabold text-slate-600">
                Hydration / Hygiene / Comfort Check
                <input
                  value={hygieneOrHealth}
                  onChange={(e) => setHygieneOrHealth(e.target.value)}
                  placeholder="e.g., Finished water bottle; all comfortable"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none"
                />
              </label>
              <label className="block text-[11px] font-extrabold text-slate-600">
                Personal Note for Parent
                <textarea
                  rows={2}
                  value={teacherNote}
                  onChange={(e) => setTeacherNote(e.target.value)}
                  placeholder="Warm note about the child’s day..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving || manageableStudents.length === 0}
              className="mt-4 w-full rounded-xl bg-[#0f172a] py-3 text-xs font-black text-emerald-400 hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Daily Care Card & Notify Guardian'}
            </button>
          </form>
        )}

        {/* Right (or full width for Guardian): Care Cards Timeline */}
        <section className={canLog ? 'space-y-4' : 'space-y-4 lg:col-span-2'}>
          <div className="dmhs-card flex flex-wrap items-center justify-between gap-2 rounded-2xl p-4">
            <h3 className="text-sm font-black text-slate-900">
              Daily Care Timeline ({visibleLogs.length})
            </h3>
            <DateFilterBar
              value={dateFilter}
              onChange={setDateFilter}
              label="Care Date"
              allowAll
              compact
              savedDates={savedDates}
            />
          </div>

          {visibleLogs.length === 0 ? (
            <div className="dmhs-card rounded-[24px] p-10 text-center text-xs font-semibold text-slate-400">
              No daily care cards recorded yet for this selection.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleLogs.map((log) => {
                const replyDraft = replyDrafts[log.id] || ''
                const canDelete = isAdmin || (isTeacher && log.loggedById === authUser?.id)
                return (
                  <div key={log.id} className="dmhs-card rounded-[24px] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-black text-emerald-400">
                            {formatPrettyDate(log.dateIso)}
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {log.studentName}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">
                            · {log.classLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-bold text-slate-400">
                          Logged by {log.loggedBy} · {log.loggedAt}
                        </p>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => deleteEarlyYearsCare(log.id)}
                          className="rounded-lg bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold text-rose-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                      <div className="rounded-2xl bg-emerald-50/70 p-3">
                        <p className="text-[10px] font-extrabold uppercase text-emerald-700">
                          Tiffin / Meal Status
                        </p>
                        <p className="mt-0.5 text-sm font-black text-emerald-950">
                          {log.mealStatus}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-sky-50/70 p-3">
                        <p className="text-[10px] font-extrabold uppercase text-sky-700">
                          Mood &amp; Energy
                        </p>
                        <p className="mt-0.5 text-sm font-black text-sky-950">{log.mood}</p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-700">
                      <p>
                        <strong className="text-slate-900">Activity / Rest:</strong>{' '}
                        {log.napOrActivity}
                      </p>
                      <p>
                        <strong className="text-slate-900">Hydration &amp; Wellness:</strong>{' '}
                        {log.hygieneOrHealth}
                      </p>
                      <p className="rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-800">
                        “{log.teacherNote}”
                      </p>
                    </div>

                    {log.guardianAcknowledged ? (
                      <div className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900">
                        ✓ Parent Acknowledged ({log.guardianAcknowledgedAt || 'Confirmed'})
                        {log.guardianReply ? ` · Reply: “${log.guardianReply}”` : ''}
                      </div>
                    ) : isGuardian ? (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault()
                          const res = await acknowledgeEarlyYearsCare(
                            log.id,
                            replyDraft.trim() || undefined,
                          )
                          if (res.ok) {
                            setReplyDrafts((prev) => ({ ...prev, [log.id]: '' }))
                          }
                        }}
                        className="mt-3 flex flex-wrap items-center gap-2"
                      >
                        <input
                          value={replyDraft}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [log.id]: e.target.value }))
                          }
                          placeholder="Optional thank-you note or tomorrow’s dietary tip for teacher..."
                          className="min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none"
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-700"
                        >
                          ✓ Acknowledge Care Card
                        </button>
                      </form>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  )
}
