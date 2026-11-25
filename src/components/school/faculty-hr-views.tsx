'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { downloadExcelCsv } from '@/lib/csv-export'
import { DMHS_CLASS_TAGS } from './data'
import {
  DateFilterBar,
  extractIsoDate,
  formatPrettyDate,
  getTodayIso,
  matchesDateFilter,
} from './date-utils'
import { Icon } from './icons'
import { useSchool } from './store'
import type { SchoolWeekday, TeacherTrainingItem } from './types'
import { PageShell } from './ui'

const ALL_SECTIONS = [...DMHS_CLASS_TAGS]

export function FacultyHRView() {
  const {
    role,
    teachers,
    activeTeacherId,
    timetableSlots = [],
    campusWifiConfig,
    teacherAttendance,
    teacherTrainings,
    updateCampusWifiConfig,
    performTeacherWifiPunch,
    updateTeacherClasses,
    assignTeacherTraining,
    toggleTeacherTrainingCompletion,
    sendNextClassReminder,
    notify,
  } = useSchool()

  const isAdmin = role === 'admin'
  const activeTeacher = teachers.find((t) => t.id === activeTeacherId) || teachers[0]

  const [subTab, setSubTab] = useState<'wifi' | 'classes' | 'training'>('wifi')

  // Live server-verified Campus Wi-Fi probe
  const [detectedIp, setDetectedIp] = useState('Checking...')
  const [onSchoolWifi, setOnSchoolWifi] = useState(true)
  const [simulateOffCampus, setSimulateOffCampus] = useState(false)
  const [punchBusy, setPunchBusy] = useState(false)
  const [punchAlert, setPunchAlert] = useState<{ ok: boolean; msg: string } | null>(null)

  // Admin Wi-Fi config form
  const [ssidDraft, setSsidDraft] = useState(campusWifiConfig.ssidLabel)
  const [newIpInput, setNewIpInput] = useState('')

  // Admin Assign New Training modal
  const [showTrainingModal, setShowTrainingModal] = useState(false)
  const [trnTitle, setTrnTitle] = useState('')
  const [trnCategory, setTrnCategory] =
    useState<TeacherTrainingItem['category']>('Cambridge Curriculum')
  const [trnMode, setTrnMode] = useState<TeacherTrainingItem['mode']>('On-Campus Workshop')
  const [trnDue, setTrnDue] = useState('15 Dec 2026')
  const [trnMandatory, setTrnMandatory] = useState(true)
  const [trnDesc, setTrnDesc] = useState('')
  const [trnTargets, setTrnTargets] = useState<string[]>([])

  const probeCampusWifi = async () => {
    try {
      const res = await fetch('/dmhs-api/faculty-checkin', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        detectedIp: string
        onSchoolWifi: boolean
      }
      if (json.ok) {
        setDetectedIp(json.detectedIp)
        setOnSchoolWifi(json.onSchoolWifi)
      }
    } catch {
      setDetectedIp('127.0.0.1')
    }
  }

  useEffect(() => {
    void probeCampusWifi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusWifiConfig.allowedIps.join(',')])

  // Faculty Attendance Date Filter (Today, previous date, or ALL history)
  const todayIso = getTodayIso()
  const [selectedAttDate, setSelectedAttDate] = useState<string>(todayIso)
  const savedFacultyDates = useMemo(
    () =>
      Array.from(
        new Set(
          teacherAttendance
            .map((a) => extractIsoDate(a.date))
            .filter((d): d is string => Boolean(d)),
        ),
      ).sort((a, b) => (a < b ? 1 : -1)),
    [teacherAttendance],
  )

  const myAttendance =
    teacherAttendance.find(
      (a) => a.teacherId === activeTeacher?.id && matchesDateFilter(a.date, todayIso),
    ) || teacherAttendance.find((a) => a.teacherId === activeTeacher?.id)
  const myTrainings = teacherTrainings.filter((t) =>
    t.assignedTeacherIds.includes(activeTeacher?.id || ''),
  )
  const todayDay: SchoolWeekday = (['Sun', 'Mon', 'Tue', 'Wed', 'Thu'] as SchoolWeekday[])[
    new Date().getDay()
  ] || 'Sun'
  const myTodaySlots = timetableSlots
    .filter((s) => s.teacherId === activeTeacher?.id && s.day === todayDay)
    .sort((a, b) => a.period - b.period)
  const firstLiveSlot =
    myTodaySlots[0] ||
    timetableSlots
      .filter((s) => s.teacherId === activeTeacher?.id)
      .sort((a, b) => a.period - b.period)[0]
  const nextPeriod = firstLiveSlot
    ? (() => {
        const [startPart, endPart] = firstLiveSlot.timeLabel.split(/[–-]/).map((x) => x.trim())
        return {
          subject: firstLiveSlot.subject,
          topic: `${firstLiveSlot.className} · ${firstLiveSlot.day} P${firstLiveSlot.period}`,
          room: firstLiveSlot.room,
          time: startPart || '08:15',
          end: endPart || '09:00',
        }
      })()
    : null

  const onCampusNowCount = teacherAttendance.filter(
    (a) =>
      matchesDateFilter(a.date, todayIso) && (a.status === 'checked_in' || a.status === 'late'),
  ).length
  const totalAssignedSections = teachers.reduce((sum, t) => sum + t.assignedClasses.length, 0)

  const totalTrainingAssignments = teacherTrainings.reduce(
    (sum, t) => sum + t.assignedTeacherIds.length,
    0,
  )
  const totalTrainingCompleted = teacherTrainings.reduce(
    (sum, t) => sum + t.completedTeacherIds.length,
    0,
  )
  const trainingPct =
    totalTrainingAssignments > 0
      ? Math.round((totalTrainingCompleted / totalTrainingAssignments) * 100)
      : 100

  const handleWifiPunch = async (action: 'checkin' | 'checkout') => {
    if (!activeTeacher) return
    setPunchAlert(null)
    setPunchBusy(true)
    const res = await performTeacherWifiPunch({
      teacherId: activeTeacher.id,
      action,
      simulateOffCampus,
      biometricVerified: true,
    })
    setPunchBusy(false)
    if (!res.ok) {
      setPunchAlert({ ok: false, msg: res.error || 'Check-in blocked by School Wi-Fi policy.' })
      return
    }
    setPunchAlert({
      ok: true,
      msg: `Verified on ${campusWifiConfig.ssidLabel} (${res.verifiedIp}) — ${action === 'checkin' ? 'Checked In' : 'Checked Out'} recorded in SQLite DB.`,
    })
  }

  const handleCreateTraining = (e: React.FormEvent) => {
    e.preventDefault()
    if (!trnTitle.trim()) return
    assignTeacherTraining({
      title: trnTitle,
      category: trnCategory,
      assignedTeacherIds: trnTargets.length > 0 ? trnTargets : teachers.map((t) => t.id),
      dueDate: trnDue,
      mode: trnMode,
      mandatory: trnMandatory,
      description: trnDesc,
    })
    setShowTrainingModal(false)
    setTrnTitle('')
    setTrnDesc('')
    setTrnTargets([])
  }

  return (
    <PageShell
      eyebrow={
        isAdmin
          ? 'Principal Shahid · Anti-Cheat Campus Wi-Fi & Faculty HR'
          : `Faculty Desk · ${activeTeacher?.name} (${activeTeacher?.subject})`
      }
      title={
        isAdmin
          ? 'Teacher Wi-Fi Check-In, Workload & Trainings'
          : 'Campus Wi-Fi Check-In & Trainings'
      }
      subtitle={
        isAdmin
          ? 'Enforce school-Wi-Fi-only teacher check-in/out, review previous attendance dates, balance class workloads, and assign faculty trainings.'
          : 'Check in/out exclusively on official DMHA Campus Wi-Fi, receive next-class bell alerts, review attendance history, and complete assigned trainings.'
      }
      action={
        isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                downloadExcelCsv(
                  `DMHA-Faculty-Attendance-${selectedAttDate === 'ALL' ? todayIso : selectedAttDate}.csv`,
                  [
                    'Date',
                    'Teacher Name',
                    'Status',
                    'Check-In',
                    'Check-Out',
                    'Hours Worked',
                    'Verified Wi-Fi IP',
                  ],
                  teachers.map((t) => {
                    const att =
                      selectedAttDate === 'ALL'
                        ? teacherAttendance.find((a) => a.teacherId === t.id)
                        : teacherAttendance.find(
                            (a) => a.teacherId === t.id && matchesDateFilter(a.date, selectedAttDate),
                          )
                    return [
                      selectedAttDate === 'ALL' ? att?.date || todayIso : selectedAttDate,
                      t.name,
                      att?.status || 'absent',
                      att?.checkInTime || '-',
                      att?.checkOutTime || '-',
                      att?.hoursWorked || '-',
                      att?.verifiedIp || '-',
                    ]
                  }),
                )
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50"
            >
              <Icon name="sheet" size={14} className="text-emerald-600" />
              Export Attendance CSV
            </button>
            <button
              type="button"
              onClick={() => setShowTrainingModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
            >
              <Icon name="plus" size={14} />
              Assign Training
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              activeTeacher &&
              nextPeriod &&
              sendNextClassReminder(
                activeTeacher.id,
                `${nextPeriod.subject} · ${nextPeriod.topic} (${nextPeriod.room}) starts at ${nextPeriod.time}`,
              )
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
          >
            <Icon name="bell" size={14} />
            Test Next-Class Alert
          </button>
        )
      }
    >
      {/* Teacher Live Next-Class Countdown Banner */}
      {!isAdmin && nextPeriod && (
        <div className="dmhs-hero mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[26px] p-5 text-white shadow-lg sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-md">
              <Icon name="clock" size={24} />
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-300">
                Live Next-Class Bell Alert · Starting Soon
              </p>
              <h3 className="mt-0.5 text-lg font-black">
                {nextPeriod.subject} — {nextPeriod.topic} ({nextPeriod.room})
              </h3>
              <p className="mt-0.5 text-xs text-slate-300">
                Scheduled {nextPeriod.time} – {nextPeriod.end} · Assigned Sections:{' '}
                <strong>{activeTeacher?.assignedClasses.join(', ')}</strong>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-right">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
              Today&apos;s Check-In
            </p>
            <p className="mt-0.5 text-base font-black text-white">
              {myAttendance?.checkInTime || 'Not Punched Yet'}
            </p>
          </div>
        </div>
      )}

      {/* Executive KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            On Campus (Wi-Fi Verified)
          </p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">
            {onCampusNowCount}/{teachers.length}
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-600">
            Strict Campus Wi-Fi: {campusWifiConfig.strictWifiOnly ? 'ENFORCED' : 'Flexible'}
          </p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            {isAdmin ? 'Allocated Class Sections' : 'My Assigned Sections'}
          </p>
          <p className="mt-1.5 text-3xl font-black text-emerald-600">
            {isAdmin ? totalAssignedSections : activeTeacher?.assignedClasses.length || 0}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {isAdmin ? `Across ${teachers.length} active teachers` : activeTeacher?.assignedClasses.join(', ')}
          </p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Training Completion
          </p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">{trainingPct}%</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {teacherTrainings.length} active faculty program(s)
          </p>
        </div>

        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            Detected Network IP
          </p>
          <p className="mt-1.5 truncate font-mono text-xl font-black text-white">
            {simulateOffCampus ? '45.125.220.89' : detectedIp}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            {!simulateOffCampus && onSchoolWifi
              ? '✓ Verified DMHA Campus Wi-Fi'
              : '✕ External Network (Blocked)'}
          </p>
        </div>
      </div>

      {/* Sub-Navigation Pills */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ['wifi', 'Campus Wi-Fi Check-In & Attendance'],
            ['classes', 'Class Allocation & Workload'],
            ['training', `Faculty Trainings (${teacherTrainings.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
              subTab === id
                ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ==================== TAB 1: ANTI-CHEAT CAMPUS WI-FI ATTENDANCE ==================== */}
      {subTab === 'wifi' && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* Left Panel: Teacher Punch Card OR Admin Wi-Fi Allowlist Config */}
          <div className="space-y-4">
            <div className="dmhs-card p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                  Anti-Cheat School Wi-Fi Punch
                </p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase ${
                    !simulateOffCampus && onSchoolWifi
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {!simulateOffCampus && onSchoolWifi ? 'Campus Wi-Fi OK' : 'Off-Campus IP'}
                </span>
              </div>
              <h3 className="mt-1.5 text-base font-black text-slate-900">
                {activeTeacher?.name} · Daily Check-In / Out
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Server verifies incoming IP against <strong>{campusWifiConfig.ssidLabel}</strong>.
                Remote check-in from home or mobile data is automatically rejected.
              </p>

              {/* Anti-Cheat Demo Switch so user can test blocking! */}
              <label className="mt-3.5 flex cursor-pointer items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs font-bold text-amber-950">
                <span>Simulate Off-Campus 4G / Home Wi-Fi</span>
                <input
                  type="checkbox"
                  checked={simulateOffCampus}
                  onChange={(e) => {
                    setSimulateOffCampus(e.target.checked)
                    setPunchAlert(null)
                  }}
                  className="size-4 accent-rose-600"
                />
              </label>

              {myAttendance && (
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-xs">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Check-In</p>
                    <p className="font-black text-slate-900">
                      {myAttendance.checkInTime || 'Not Yet'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Check-Out</p>
                    <p className="font-black text-slate-900">
                      {myAttendance.checkOutTime || 'On Campus'}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={punchBusy}
                  onClick={() => void handleWifiPunch('checkin')}
                  className="rounded-xl bg-emerald-600 py-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {punchBusy ? 'Verifying IP...' : 'Check In (Wi-Fi)'}
                </button>
                <button
                  type="button"
                  disabled={punchBusy}
                  onClick={() => void handleWifiPunch('checkout')}
                  className="rounded-xl bg-[#0f172a] py-3 text-xs font-black text-emerald-300 shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Check Out (Wi-Fi)
                </button>
              </div>

              {punchAlert && (
                <div
                  className={`mt-3 rounded-2xl border px-3.5 py-2.5 text-xs font-bold ${
                    punchAlert.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {punchAlert.msg}
                </div>
              )}
            </div>

            {/* Principal School Wi-Fi Allowlist Configuration */}
            {isAdmin && (
              <div className="dmhs-card p-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Official School Wi-Fi Allowlist
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      updateCampusWifiConfig({
                        strictWifiOnly: !campusWifiConfig.strictWifiOnly,
                      })
                    }
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                      campusWifiConfig.strictWifiOnly
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Strict Mode: {campusWifiConfig.strictWifiOnly ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="mt-3 space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      value={ssidDraft}
                      onChange={(e) => setSsidDraft(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateCampusWifiConfig({ ssidLabel: ssidDraft })}
                      className="rounded-xl bg-[#0f172a] px-3 py-1.5 text-[11px] font-extrabold text-emerald-300"
                    >
                      Save SSID
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {campusWifiConfig.allowedIps.map((ip) => (
                      <span
                        key={ip}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-700"
                      >
                        {ip}
                        <button
                          type="button"
                          onClick={() =>
                            updateCampusWifiConfig({
                              allowedIps: campusWifiConfig.allowedIps.filter((x) => x !== ip),
                            })
                          }
                          className="text-rose-500 hover:text-rose-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={newIpInput}
                      onChange={(e) => setNewIpInput(e.target.value)}
                      placeholder="Add school IP / subnet (e.g. 103.48.16.*)"
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-1.5 font-mono text-xs font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newIpInput.trim()) return
                        updateCampusWifiConfig({
                          allowedIps: Array.from(
                            new Set([...campusWifiConfig.allowedIps, newIpInput.trim()]),
                          ),
                        })
                        setNewIpInput('')
                      }}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white"
                    >
                      + Add IP
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (detectedIp && detectedIp !== 'Checking...') {
                        updateCampusWifiConfig({
                          allowedIps: Array.from(
                            new Set([...campusWifiConfig.allowedIps, detectedIp]),
                          ),
                        })
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-[11px] font-extrabold text-slate-700 hover:bg-slate-100"
                  >
                    Use Current Office Network IP ({detectedIp}) as School Wi-Fi
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Live & Historical Faculty Campus Presence Board */}
          <div className="dmhs-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Campus Faculty Attendance Board ·{' '}
                  {selectedAttDate === 'ALL'
                    ? 'All Recorded Dates'
                    : selectedAttDate === todayIso
                      ? `Today (${formatPrettyDate(todayIso)})`
                      : formatPrettyDate(selectedAttDate)}
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time School Wi-Fi &amp; Faculty QR Gate logs synced to SQLite DB. Switch
                  dates to inspect previous days.
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-extrabold text-emerald-700">
                Anti-Cheat Verified
              </span>
            </div>

            <div className="mt-3">
              <DateFilterBar
                value={selectedAttDate}
                onChange={setSelectedAttDate}
                allowAll
                compact
                label="Attendance Date"
                savedDates={savedFacultyDates}
              />
            </div>

            <div className="mt-4 space-y-3">
              {selectedAttDate === 'ALL' ? (
                teacherAttendance.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-xs font-semibold text-slate-400">
                    No faculty attendance logs recorded yet.
                  </div>
                ) : (
                  teacherAttendance.map((log) => {
                    const tch = teachers.find((t) => t.id === log.teacherId)
                    const st = log.status || 'absent'
                    return (
                      <div
                        key={log.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 items-center justify-center rounded-xl bg-[#0f172a] text-xs font-black text-emerald-300">
                            {tch?.initials || log.teacherName.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <p className="text-xs font-black text-slate-900">
                              {log.teacherName}{' '}
                              <span className="ml-1 rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                {log.date}
                              </span>
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500">
                              {tch?.subject || 'Faculty'} · {log.wifiNetwork} · IP:{' '}
                              <span className="font-mono text-slate-700">{log.verifiedIp}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-right">
                          <div className="text-[11px] font-bold text-slate-600">
                            <span>In: {log.checkInTime || '—'}</span>
                            <span className="mx-1.5 text-slate-300">|</span>
                            <span>Out: {log.checkOutTime || '—'}</span>
                            {log.hoursWorked && (
                              <span className="ml-2 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                                {log.hoursWorked}
                              </span>
                            )}
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                              st === 'checked_in'
                                ? 'bg-emerald-100 text-emerald-800'
                                : st === 'checked_out'
                                  ? 'bg-sky-100 text-sky-800'
                                  : st === 'late'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {st.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )
              ) : (
                teachers.map((tch) => {
                  const log = teacherAttendance.find(
                    (a) => a.teacherId === tch.id && matchesDateFilter(a.date, selectedAttDate),
                  )
                  const st = log?.status || 'absent'
                  return (
                    <div
                      key={tch.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-[#0f172a] text-xs font-black text-emerald-300">
                          {tch.initials}
                        </span>
                        <div>
                          <p className="text-xs font-black text-slate-900">{tch.name}</p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {tch.subject} · IP:{' '}
                            <span className="font-mono text-slate-700">
                              {log?.verifiedIp || 'No punch logged'}
                            </span>
                            {log?.wifiNetwork && (
                              <span className="ml-1.5 text-[10px] text-slate-400">
                                ({log.wifiNetwork})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-right">
                        <div className="text-[11px] font-bold text-slate-600">
                          <span>In: {log?.checkInTime || '—'}</span>
                          <span className="mx-1.5 text-slate-300">|</span>
                          <span>Out: {log?.checkOutTime || '—'}</span>
                          {log?.hoursWorked && (
                            <span className="ml-2 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                              {log.hoursWorked}
                            </span>
                          )}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                            st === 'checked_in'
                              ? 'bg-emerald-100 text-emerald-800'
                              : st === 'checked_out'
                                ? 'bg-sky-100 text-sky-800'
                                : st === 'late'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {log ? st.replace('_', ' ') : 'no record'}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: CLASS ALLOCATION & WORKLOAD ==================== */}
      {subTab === 'classes' && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {(isAdmin ? teachers : teachers.filter((t) => t.id === activeTeacher?.id)).map((tch) => {
            const livePeriodsCount = timetableSlots.filter((s) => s.teacherId === tch.id).length
            const periodsPerWeek = livePeriodsCount > 0 ? livePeriodsCount : tch.assignedClasses.length * 4
            const loadPct = Math.min(100, Math.round((periodsPerWeek / 25) * 100))
            return (
              <div key={tch.id} className="dmhs-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900">{tch.name}</h3>
                    <p className="text-xs font-semibold text-slate-500">
                      {tch.subject} · {tch.department}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                      periodsPerWeek > 20
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {periodsPerWeek} / 25 periods/wk
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      periodsPerWeek > 20 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${loadPct}%` }}
                  />
                </div>

                <p className="mt-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {isAdmin
                    ? 'Principal Class Assignment (Click to Assign / Remove)'
                    : 'Assigned Sections by Principal Shahid'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(isAdmin ? ALL_SECTIONS : tch.assignedClasses).map((sec) => {
                    const assigned = tch.assignedClasses.includes(sec)
                    return (
                      <button
                        key={sec}
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => {
                          if (!isAdmin) return
                          const next = assigned
                            ? tch.assignedClasses.filter((c) => c !== sec)
                            : [...tch.assignedClasses, sec]
                          updateTeacherClasses(tch.id, next)
                          notify(
                            `${tch.name}’s classes updated (${next.length} sections) & teacher notified`,
                          )
                        }}
                        className={`rounded-full px-3 py-1 text-[11px] font-extrabold transition ${
                          assigned
                            ? 'bg-[#0f172a] text-emerald-300'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {assigned ? `✓ ${sec}` : `+ ${sec}`}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ==================== TAB 4: FACULTY TRAININGS ==================== */}
      {subTab === 'training' && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {(isAdmin ? teacherTrainings : myTrainings).map((trn) => {
            const pct =
              trn.assignedTeacherIds.length > 0
                ? Math.round(
                    (trn.completedTeacherIds.length / trn.assignedTeacherIds.length) * 100,
                  )
                : 0
            const myCompleted = activeTeacher
              ? trn.completedTeacherIds.includes(activeTeacher.id)
              : false

            return (
              <div key={trn.id} className="dmhs-card flex flex-col justify-between p-5">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
                      {trn.category}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        trn.mandatory
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {trn.mandatory ? 'Mandatory' : 'Optional'} · Due {trn.dueDate}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-base font-black text-slate-900">{trn.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{trn.description}</p>
                  <p className="mt-2 text-[11px] font-semibold text-slate-400">
                    Mode: {trn.mode} · Assigned by {trn.assignedBy}
                  </p>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span>
                        Completion: {trn.completedTeacherIds.length}/{trn.assignedTeacherIds.length}{' '}
                        teachers
                      </span>
                      <span className="text-emerald-700">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {!isAdmin && activeTeacher && (
                  <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => toggleTeacherTrainingCompletion(trn.id, activeTeacher.id)}
                      className={`rounded-full px-4 py-2 text-xs font-black transition ${
                        myCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {myCompleted ? '✓ Training Completed' : 'Mark Training Completed'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Principal Assign New Training Modal */}
      {showTrainingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setShowTrainingModal(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateTraining}
            className="w-full max-w-lg space-y-3 rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <h3 className="text-lg font-black text-slate-900">
              Assign Faculty Training Program
            </h3>
            <input
              required
              value={trnTitle}
              onChange={(e) => setTrnTitle(e.target.value)}
              placeholder="Training Title (e.g., AI Classroom Tools Workshop) *"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={trnCategory}
                onChange={(e) =>
                  setTrnCategory(e.target.value as TeacherTrainingItem['category'])
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
              >
                <option value="Cambridge Curriculum">Cambridge Curriculum</option>
                <option value="Smart EdTech">Smart EdTech</option>
                <option value="Safeguarding & First Aid">Safeguarding &amp; First Aid</option>
                <option value="Leadership">Leadership</option>
              </select>
              <select
                value={trnMode}
                onChange={(e) => setTrnMode(e.target.value as TeacherTrainingItem['mode'])}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
              >
                <option value="On-Campus Workshop">On-Campus Workshop</option>
                <option value="Online Module">Online Module</option>
                <option value="External Seminar">External Seminar</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={trnDue}
                onChange={(e) => setTrnDue(e.target.value)}
                placeholder="Due Date"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
              />
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={trnMandatory}
                  onChange={(e) => setTrnMandatory(e.target.checked)}
                />
                Mandatory Training
              </label>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold text-slate-500">
                Select Teachers (leave unchecked for All Faculty):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {teachers.map((t) => {
                  const chosen = trnTargets.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setTrnTargets((prev) =>
                          chosen ? prev.filter((id) => id !== t.id) : [...prev, t.id],
                        )
                      }
                      className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                        chosen ? 'bg-[#0f172a] text-emerald-300' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <textarea
              rows={2}
              value={trnDesc}
              onChange={(e) => setTrnDesc(e.target.value)}
              placeholder="Objectives & materials..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTrainingModal(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-black text-white"
              >
                Assign &amp; Notify Teachers
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
