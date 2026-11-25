'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { downloadExcelCsv } from '@/lib/csv-export'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type { HouseName, SubjectProgress } from './types'
import { PageShell } from './ui'

type RankingMode = 'overall' | 'assessment' | 'subject' | 'improved'

interface RankedLeaderboardRow {
  studentId: string
  studentName: string
  initials: string
  className: string
  section: string
  classSectionLabel: string
  roll: string
  house: HouseName
  gpa: string
  attendanceRate: number
  rank: number
  assessmentAvg: number
  highestSubjectName: string
  highestSubjectScore: number
  selectedSubjectScore: number | null
  quizAvg: number | null
  quizCount: number
  meritTotal: number
  improvementDelta: number
  leaderboardPoints: number
  canInspectDetails: boolean
  subjects: SubjectProgress[]
}

interface ServerLeaderboardPayload {
  ok: boolean
  role?: string
  effectiveClassFilter?: string
  allowedClasses?: string[]
  assignedTeacherClasses?: string[]
  availableSubjects?: string[]
  effectiveSubject?: string
  mode?: RankingMode
  focusStudentId?: string | null
  classAvg?: number
  entries?: RankedLeaderboardRow[]
  stateVersion?: number
  error?: string
}

function normalizeClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

export function ClassLeaderboardView({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const {
    role,
    students,
    teachers,
    quizAttempts,
    merits,
    activeTeacherId,
    selectedChildId,
    activeStudentId,
    awardMeritOrPastoral,
    syncLeaderboardRanks,
    notify,
  } = useSchool()

  const activeTeacher = useMemo(
    () => teachers.find((t) => t.id === activeTeacherId) || teachers[0] || null,
    [teachers, activeTeacherId],
  )

  const focusStudent =
    role === 'student'
      ? students.find((s) => s.id === activeStudentId) || students[0]
      : role === 'guardian'
        ? students.find((s) => s.id === selectedChildId) || students[0]
        : null

  const isClassLocked = role === 'guardian' || role === 'student'
  const isTeacher = role === 'teacher'
  const isAdmin = role === 'admin'
  const canAwardMerit = isTeacher || isAdmin

  const [classFilter, setClassFilter] = useState<string>(
    focusStudent ? `${focusStudent.className} · ${focusStudent.section}` : 'ALL',
  )
  const [rankingMode, setRankingMode] = useState<RankingMode>('overall')
  const [selectedSubject, setSelectedSubject] = useState<string>('Physics')
  const [inspectedStudent, setInspectedStudent] = useState<RankedLeaderboardRow | null>(null)
  const [serverData, setServerData] = useState<ServerLeaderboardPayload | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [awardingStudentId, setAwardingStudentId] = useState<string | null>(null)
  const [syncingRanks, setSyncingRanks] = useState<boolean>(false)

  // Keep locked role classFilter synced with active child
  useEffect(() => {
    if (isClassLocked && focusStudent) {
      setClassFilter(`${focusStudent.className} · ${focusStudent.section}`)
    } else if (isTeacher) {
      setClassFilter('ALL')
    }
  }, [isClassLocked, isTeacher, focusStudent?.id, focusStudent?.className, focusStudent?.section])

  const effectiveClassFilter =
    isClassLocked && focusStudent
      ? `${focusStudent.className} · ${focusStudent.section}`
      : classFilter

  const fetchServerLeaderboard = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('classFilter', effectiveClassFilter)
      params.set('mode', rankingMode)
      if (selectedSubject) params.set('subject', selectedSubject)
      if (role === 'guardian' && selectedChildId) params.set('childId', selectedChildId)

      const res = await fetch(`/dmhs-api/leaderboard?${params.toString()}`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as ServerLeaderboardPayload
      if (res.ok && json.ok) {
        setServerData(json)
      }
    } catch {
      // Keep last synced snapshot if offline
    } finally {
      setLoading(false)
    }
  }, [effectiveClassFilter, rankingMode, selectedSubject, role, selectedChildId])

  useEffect(() => {
    void fetchServerLeaderboard()
  }, [fetchServerLeaderboard, students, merits, quizAttempts, role, activeTeacherId])

  const rankedEntries = serverData?.entries || []
  const allowedClasses = serverData?.allowedClasses || []
  const assignedTeacherClasses =
    serverData?.assignedTeacherClasses?.length
      ? serverData.assignedTeacherClasses
      : activeTeacher?.assignedClasses || []
  const availableSubjects = serverData?.availableSubjects || []
  const effectiveSubject = serverData?.effectiveSubject || selectedSubject

  const podiumTop3 = rankedEntries.slice(0, 3)
  const focusStudentId = serverData?.focusStudentId || focusStudent?.id || null
  const myEntry = focusStudentId
    ? rankedEntries.find((e) => e.studentId === focusStudentId) || null
    : null
  const aheadEntry = myEntry && myEntry.rank > 1 ? rankedEntries[myEntry.rank - 2] : null
  const classTopper = rankedEntries[0] || null
  const classAvg = serverData?.classAvg ?? 0

  const handleInspectRow = (entry: RankedLeaderboardRow) => {
    if (!entry.canInspectDetails) {
      notify(
        `Privacy Protected: Classmates' individual subject mark sheets are private. You can view your own full breakdown.`,
      )
      return
    }
    setInspectedStudent(entry)
  }

  const handleAwardBonus = async (entry: RankedLeaderboardRow) => {
    setAwardingStudentId(entry.studentId)
    const res = await awardMeritOrPastoral({
      studentId: entry.studentId,
      house: entry.house,
      type: 'merit',
      points: 5,
      reason: 'Leaderboard Excellence Bonus (+5 Merit)',
    })
    setAwardingStudentId(null)
    if (res.ok) {
      await fetchServerLeaderboard()
    }
  }

  const handleSyncOfficialRanks = async () => {
    setSyncingRanks(true)
    const res = await syncLeaderboardRanks()
    setSyncingRanks(false)
    if (res.ok) {
      await fetchServerLeaderboard()
    }
  }

  const getPrimaryMetricLabel = (entry: RankedLeaderboardRow) => {
    if (rankingMode === 'assessment') return `${entry.assessmentAvg}% Avg`
    if (rankingMode === 'subject') {
      return entry.selectedSubjectScore !== null
        ? `${entry.selectedSubjectScore}% in ${effectiveSubject}`
        : 'N/A'
    }
    if (rankingMode === 'improved') {
      return `${entry.improvementDelta >= 0 ? '+' : ''}${entry.improvementDelta}% Gain`
    }
    return `${entry.leaderboardPoints.toLocaleString()} pts`
  }

  const eyebrowScope =
    effectiveClassFilter === 'ALL'
      ? isTeacher
        ? 'Assigned Classes Arena'
        : 'School-Wide Scholars'
      : effectiveClassFilter

  return (
    <PageShell
      eyebrow={`DMHA Academic Arena · ${eyebrowScope}`}
      title="Class Assessment Leaderboard & Live Ranks"
      subtitle="Server-verified SQLite rankings synced with Teacher Gradebook assessments, Online Quizzes, and House Merits."
      action={
        <div className="flex flex-wrap items-center gap-2">
          {canAwardMerit && (
            <>
              <button
                type="button"
                disabled={syncingRanks}
                onClick={() => void handleSyncOfficialRanks()}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-800 shadow-xs transition hover:bg-emerald-100 disabled:opacity-60"
              >
                <Icon name="database" size={14} className="text-emerald-700" />
                {syncingRanks ? 'Syncing Ranks…' : 'Sync Official Ranks'}
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadExcelCsv(
                    `DMHA-Leaderboard-${effectiveClassFilter.replace(/[^a-z0-9]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.csv`,
                    [
                      'Rank',
                      'Student Name',
                      'Class',
                      'Section',
                      'Roll #',
                      'House',
                      'Assessment Avg (%)',
                      'Highest Subject',
                      'Highest Score (%)',
                      'Quiz Avg (%)',
                      'Merit Points',
                      'Improvement (%)',
                      'Leaderboard Points',
                    ],
                    rankedEntries.map((e) => [
                      `#${e.rank}`,
                      e.studentName,
                      e.className,
                      e.section,
                      e.roll,
                      e.house,
                      e.assessmentAvg,
                      e.highestSubjectName,
                      e.highestSubjectScore,
                      e.quizAvg ?? '-',
                      e.meritTotal,
                      `${e.improvementDelta >= 0 ? '+' : ''}${e.improvementDelta}%`,
                      e.leaderboardPoints,
                    ]),
                  )
                }
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 shadow-xs transition hover:border-emerald-400 hover:bg-emerald-50/50"
              >
                <Icon name="sheet" size={14} className="text-emerald-600" />
                Export Rank Sheet CSV
              </button>
            </>
          )}
          {(role === 'student' || role === 'guardian') && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('quizzes')}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Icon name="play" size={13} />
              Take Quiz to Climb Rank
            </button>
          )}
        </div>
      }
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      {/* Teacher Assigned-Class RBAC Security Banner */}
      {isTeacher && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Icon name="shield" size={16} />
            </div>
            <div>
              <div className="font-black">
                Assigned-Class Leaderboard Access · {activeTeacher?.name}
              </div>
              <div className="text-emerald-800/80">
                Server RBAC enforced: you can view rankings and award House Merits strictly for
                students in your assigned classes.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {assignedTeacherClasses.map((cls) => (
              <span
                key={cls}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 shadow-xs ring-1 ring-emerald-200"
              >
                <Icon name="lock" size={11} className="text-emerald-600" />
                {cls}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Personal Motivation Banner (Guardian & Student) */}
      {myEntry && (
        <div className="dmhs-hero mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[26px] p-5 text-white shadow-lg sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-md">
              <span className="text-[9px] font-black uppercase tracking-wider">Rank</span>
              <span className="text-2xl font-black leading-none">#{myEntry.rank}</span>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-300">
                {role === 'student'
                  ? 'Your Live Server-Verified Standing'
                  : `${myEntry.studentName}’s Live Class Rank`}
              </p>
              <h3 className="mt-1 text-lg font-black sm:text-xl">
                {myEntry.rank === 1
                  ? `${myEntry.studentName.split(' ')[0]} is #1 Top Scholar in ${myEntry.classSectionLabel}!`
                  : aheadEntry
                    ? `Only ${Math.max(1, aheadEntry.leaderboardPoints - myEntry.leaderboardPoints)} pts behind #${aheadEntry.rank} (${aheadEntry.studentName.split(' ')[0]})!`
                    : `Ranked #${myEntry.rank} of ${rankedEntries.length}`}
              </h3>
              <p className="mt-0.5 text-xs text-slate-300">
                Assessment Avg: <strong>{myEntry.assessmentAvg}%</strong> · Highest Subject:{' '}
                <strong>
                  {myEntry.highestSubjectName} ({myEntry.highestSubjectScore}%)
                </strong>{' '}
                · Total: <strong>{myEntry.leaderboardPoints.toLocaleString()} pts</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {myEntry.rank > 1 && aheadEntry && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-right">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-amber-300">
                  Target to Overtake #{aheadEntry.rank}
                </p>
                <p className="mt-0.5 text-xs font-black text-white">
                  +{Math.max(1, aheadEntry.assessmentAvg - myEntry.assessmentAvg + 1)}% avg or 1 Top
                  Quiz
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Bar: Class Selector + Ranking Mode */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {isClassLocked ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 shadow-xs">
            <Icon name="shield" size={14} />
            <span>
              {effectiveClassFilter} Leaderboard · {focusStudent?.name}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {allowedClasses.map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setClassFilter(cls)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                  normalizeClassToken(effectiveClassFilter) === normalizeClassToken(cls)
                    ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cls}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setClassFilter('ALL')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                effectiveClassFilter === 'ALL'
                  ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {isTeacher ? 'All Assigned' : `School-Wide (${students.length})`}
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-slate-200 bg-white p-1">
          {(
            [
              ['overall', 'Overall Rank'],
              ['assessment', 'Highest Assessment'],
              ['subject', 'By Subject'],
              ['improved', 'Most Improved'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRankingMode(id)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold transition ${
                rankingMode === id
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Subject Selector Strip when "By Subject" mode is active */}
      {rankingMode === 'subject' && availableSubjects.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <span className="px-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Subject Ranking:
          </span>
          {availableSubjects.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => setSelectedSubject(sub)}
              className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
                effectiveSubject === sub
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* Top-3 Olympic Podium Cards */}
      {podiumTop3.length > 0 && (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {podiumTop3.map((entry) => {
            const isGold = entry.rank === 1
            const isSilver = entry.rank === 2
            const isMe = focusStudentId === entry.studentId

            return (
              <button
                key={entry.studentId}
                type="button"
                onClick={() => handleInspectRow(entry)}
                className={`relative overflow-hidden rounded-[26px] p-6 text-left transition hover:-translate-y-0.5 ${
                  isGold
                    ? 'dmhs-hero text-white shadow-xl ring-2 ring-amber-400/70'
                    : isSilver
                      ? 'border border-slate-200 bg-white text-slate-900 shadow-md ring-1 ring-slate-200'
                      : 'border border-amber-200/70 bg-white text-slate-900 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
                      isGold
                        ? 'bg-amber-400 text-slate-950'
                        : isSilver
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <Icon name="award" size={13} />
                    {isGold ? '1st · Gold Crown' : isSilver ? '2nd · Silver' : '3rd · Bronze'}
                  </span>
                  {isMe && (
                    <span className="rounded-full bg-emerald-400 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-950">
                      {role === 'student' ? 'You' : 'Your Child'}
                    </span>
                  )}
                </div>

                <div className="mt-5 flex items-center gap-3.5">
                  <span
                    className={`flex size-13 shrink-0 items-center justify-center rounded-2xl text-base font-black ${
                      isGold
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-[#0f172a] text-emerald-300'
                    }`}
                  >
                    {entry.initials}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black">{entry.studentName}</h3>
                    <p
                      className={`text-xs font-semibold ${
                        isGold ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {entry.classSectionLabel} · Roll #{entry.roll}
                    </p>
                  </div>
                </div>

                <div
                  className={`mt-5 grid grid-cols-2 gap-2 rounded-2xl p-3 ${
                    isGold ? 'bg-white/10' : 'bg-slate-50'
                  }`}
                >
                  <div>
                    <p
                      className={`text-[9px] font-extrabold uppercase ${
                        isGold ? 'text-amber-300' : 'text-slate-400'
                      }`}
                    >
                      Score
                    </p>
                    <p className="mt-0.5 text-base font-black">{getPrimaryMetricLabel(entry)}</p>
                  </div>
                  <div>
                    <p
                      className={`text-[9px] font-extrabold uppercase ${
                        isGold ? 'text-emerald-300' : 'text-slate-400'
                      }`}
                    >
                      Highest Assessment
                    </p>
                    <p className="mt-0.5 truncate text-xs font-black">
                      {entry.highestSubjectScore}% · {entry.highestSubjectName}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Quick Class Benchmark Strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="dmhs-card p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Highest Assessment Topper
          </p>
          <p className="mt-1 text-base font-black text-slate-900">
            {classTopper ? `${classTopper.studentName} (${classTopper.assessmentAvg}%)` : '—'}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-emerald-600">
            Best subject: {classTopper?.highestSubjectName || '—'} (
            {classTopper?.highestSubjectScore ?? 0}%)
          </p>
        </div>

        <div className="dmhs-card p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Class Assessment Benchmark
          </p>
          <p className="mt-1 text-base font-black text-slate-900">{classAvg}% Class Average</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            {rankedEntries.length} ranked students competing live
          </p>
        </div>

        <div className="dmhs-card p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            How Points Are Earned
          </p>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-700">
            Assessments (×10) + Online Quizzes (×1.5) + House Merits (×3) + Attendance Bonus
          </p>
        </div>
      </div>

      {/* Full Live Class Leaderboard Table */}
      <div className="dmhs-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">
              Complete Class Standings ({rankedEntries.length} Students)
            </h3>
            <p className="text-[11px] font-medium text-slate-400">
              {canAwardMerit
                ? 'Click any student row to inspect their subject-by-subject breakdown or award +5 Merit.'
                : 'Click your own row to view your full subject breakdown. Classmates’ individual subject sheets remain private.'}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-extrabold uppercase text-emerald-700">
            <Icon name="shield" size={12} />
            {loading ? 'Loading SQLite…' : 'Server-Verified SQLite'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3">Rank</th>
                <th className="px-4 py-3">Student &amp; House</th>
                <th className="px-4 py-3">Assessment Avg</th>
                <th className="px-4 py-3">Highest Subject</th>
                <th className="px-4 py-3">Online Quiz</th>
                <th className="px-4 py-3">Trend</th>
                <th className="px-4 py-3">Total Score</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rankedEntries.map((entry) => {
                const isMe = focusStudentId === entry.studentId
                const isAwarding = awardingStudentId === entry.studentId
                return (
                  <tr
                    key={entry.studentId}
                    onClick={() => handleInspectRow(entry)}
                    className={`transition ${
                      entry.canInspectDetails ? 'cursor-pointer' : 'cursor-default'
                    } ${isMe ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-slate-50/80'}`}
                  >
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex size-8 items-center justify-center rounded-xl text-xs font-black ${
                          entry.rank === 1
                            ? 'bg-amber-400 text-slate-950'
                            : entry.rank === 2
                              ? 'bg-slate-200 text-slate-800'
                              : entry.rank === 3
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        #{entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0f172a] text-[11px] font-black text-emerald-300">
                          {entry.initials}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-900">{entry.studentName}</span>
                            {isMe && (
                              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                                {role === 'student' ? 'You' : 'Your Child'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-semibold text-slate-400">
                            {entry.classSectionLabel} · Roll #{entry.roll} · {entry.house} House
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-black text-slate-900">
                        {entry.assessmentAvg}%
                      </span>
                      <span className="ml-1.5 text-[10px] font-bold text-slate-400">
                        GPA {entry.gpa}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-700">
                        {entry.highestSubjectName} · {entry.highestSubjectScore}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-600">
                      {entry.quizAvg !== null
                        ? `${entry.quizAvg}% (${entry.quizCount})`
                        : 'No quiz yet'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                          entry.improvementDelta > 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : entry.improvementDelta < 0
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {entry.improvementDelta > 0
                          ? `+${entry.improvementDelta}%`
                          : `${entry.improvementDelta}%`}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-black text-emerald-700">
                        {getPrimaryMetricLabel(entry)}
                      </span>
                    </td>
                    <td
                      className="px-5 py-3.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canAwardMerit ? (
                        <button
                          type="button"
                          disabled={isAwarding}
                          onClick={() => void handleAwardBonus(entry)}
                          className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700 transition hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                        >
                          {isAwarding ? 'Saving…' : '+5 Merit'}
                        </button>
                      ) : isMe ? (
                        <button
                          type="button"
                          onClick={() => setInspectedStudent(entry)}
                          className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-emerald-700"
                        >
                          My Breakdown
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                          <Icon name="lock" size={11} />
                          Private
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!loading && rankedEntries.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-xs text-slate-500">
                    No students found in this leaderboard scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Subject Assessment Breakdown Modal (Own Child or Faculty/Admin Only) */}
      {inspectedStudent && inspectedStudent.canInspectDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setInspectedStudent(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-600">
                  Rank #{inspectedStudent.rank} · {inspectedStudent.classSectionLabel}
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">
                  {inspectedStudent.studentName}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  Roll #{inspectedStudent.roll} · {inspectedStudent.house} House ·{' '}
                  {inspectedStudent.leaderboardPoints.toLocaleString()} Leaderboard Points
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedStudent(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Subject Assessment Scores
              </p>
              {inspectedStudent.subjects.map((sub) => {
                const delta = sub.latestScore - sub.previousScore
                return (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-900">{sub.name}</p>
                      <p className="text-[11px] font-medium text-slate-400">
                        Teacher: {sub.teacher}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-slate-900">{sub.latestScore}%</span>
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                        {sub.grade}
                      </span>
                      <p
                        className={`mt-0.5 text-[10px] font-bold ${
                          delta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {delta >= 0 ? `+${delta}%` : `${delta}%`} vs previous
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedStudent(null)}
                className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-extrabold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
