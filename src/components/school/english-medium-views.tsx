'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DateFilterBar, matchesDateFilter } from './date-utils'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type {
  HouseName,
  MeritLogItem,
  PastPaperItem,
  StudentAchievementItem,
  SubjectProgress,
} from './types'
import { PageShell, SectionTitle, SubjectDetailModal } from './ui'

const HOUSES: HouseName[] = ['Emerald', 'Sapphire', 'Crimson', 'Gold']

const HOUSE_STYLES: Record<
  HouseName,
  { badge: string; bar: string; ring: string; darkAccent: string }
> = {
  Emerald: {
    badge: 'bg-emerald-100 text-emerald-900',
    bar: 'bg-emerald-400',
    ring: 'ring-emerald-400/35',
    darkAccent: 'text-emerald-400',
  },
  Sapphire: {
    badge: 'bg-sky-100 text-sky-900',
    bar: 'bg-sky-400',
    ring: 'ring-sky-400/35',
    darkAccent: 'text-sky-400',
  },
  Crimson: {
    badge: 'bg-rose-100 text-rose-900',
    bar: 'bg-rose-400',
    ring: 'ring-rose-400/35',
    darkAccent: 'text-rose-400',
  },
  Gold: {
    badge: 'bg-amber-100 text-amber-900',
    bar: 'bg-amber-400',
    ring: 'ring-amber-400/35',
    darkAccent: 'text-amber-300',
  },
}

function normalizeClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function predictedCambridgeGrade(score: number): string {
  if (score >= 90) return 'A*'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'E'
}

export function EnglishMediumAcademicsView() {
  const {
    role,
    authUser,
    students,
    teachers,
    guardians,
    selectedChildId,
    activeStudentId,
    activeGuardianId,
    activeTeacherId,
    houseStandings,
    merits,
    studentAchievements,
    pastPapers,
    awardMeritOrPastoral,
    updatePastoralCase,
    acknowledgeMeritOrPastoral,
    deleteMeritOrPastoral,
    reassignStudentHouse,
    addStudentAchievement,
    addPastPaperItem,
    deletePastPaperItem,
    notify,
  } = useSchool()

  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isGuardian = role === 'guardian'
  const isStudent = role === 'student'
  const canManage = isAdmin || isTeacher
  const isSingleStudentView = isGuardian || isStudent

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

  const child = isGuardian
    ? students.find((s) => s.id === selectedChildId && linkedStudentIds.has(s.id)) ||
      students.find((s) => linkedStudentIds.has(s.id)) ||
      students[0]
    : isStudent
      ? students.find((s) => s.id === activeStudentId) || students[0]
      : students[0]

  // Students eligible for this Teacher (assigned classes only) or Admin (all)
  const manageableStudents = useMemo(() => {
    if (isAdmin) return students
    if (isTeacher) {
      const assigned = activeTeacher?.assignedClasses || []
      if (assigned.length === 0) return []
      return students.filter((s) => {
        const fullTok = normalizeClassToken(`${s.className} ${s.section}`)
        const secLetter = s.section.replace(/section/i, '').trim().toLowerCase()
        const compactTok = normalizeClassToken(`${s.className}${secLetter}`)
        const gradeTok = normalizeClassToken(s.className)
        return assigned.some((cls) => {
          const t = normalizeClassToken(cls)
          return t === fullTok || t === compactTok || t === gradeTok
        })
      })
    }
    return []
  }, [isAdmin, isTeacher, students, activeTeacher])

  const [activeTab, setActiveTab] = useState<'merits' | 'pastoral' | 'achievements' | 'papers'>(
    'merits',
  )

  // ==================== AWARD MERIT / PASTORAL COMPOSER ====================
  const [targetStudentId, setTargetStudentId] = useState<string>(
    () => manageableStudents[0]?.id || students[0]?.id || '',
  )
  const [house, setHouse] = useState<HouseName>(
    () => (manageableStudents[0]?.house as HouseName) || 'Emerald',
  )
  const [entryType, setEntryType] = useState<'merit' | 'pastoral'>('merit')
  const [category, setCategory] = useState<NonNullable<MeritLogItem['category']>>('Academic')
  const [points, setPoints] = useState(10)
  const [tier, setTier] = useState<NonNullable<MeritLogItem['tier']>>('Level 1 Reminder')
  const [actionPlan, setActionPlan] = useState('')
  const [reason, setReason] = useState('')
  const [submittingEntry, setSubmittingEntry] = useState(false)

  useEffect(() => {
    if (
      canManage &&
      manageableStudents.length > 0 &&
      !manageableStudents.some((s) => s.id === targetStudentId)
    ) {
      const first = manageableStudents[0]
      setTargetStudentId(first.id)
      setHouse((first.house as HouseName) || 'Emerald')
    }
  }, [canManage, manageableStudents, targetStudentId])

  const handleSelectTargetStudent = (stuId: string) => {
    setTargetStudentId(stuId)
    const found = students.find((s) => s.id === stuId)
    if (found?.house && HOUSES.includes(found.house)) {
      setHouse(found.house)
    }
  }

  // ==================== MERITS FILTERS ====================
  const [logTypeFilter, setLogTypeFilter] = useState<'all' | 'merit' | 'pastoral'>('all')
  const [logHouseFilter, setLogHouseFilter] = useState<'all' | HouseName>('all')
  const [logSearch, setLogSearch] = useState('')
  const [logDateFilter, setLogDateFilter] = useState('')

  // ==================== PASTORAL TRACKER STATE ====================
  const [pastoralStatusFilter, setPastoralStatusFilter] = useState<
    'all' | 'open' | 'follow_up' | 'resolved'
  >('all')
  const [pastoralTierFilter, setPastoralTierFilter] = useState<'all' | NonNullable<MeritLogItem['tier']>>('all')
  const [followUpDrafts, setFollowUpDrafts] = useState<Record<string, string>>({})
  const [guardianReplyDrafts, setGuardianReplyDrafts] = useState<Record<string, string>>({})

  // ==================== HOUSE ROSTER MODAL ====================
  const [rosterHouse, setRosterHouse] = useState<HouseName | null>(null)

  // ==================== ACHIEVEMENTS STATE ====================
  const [achStudentId, setAchStudentId] = useState<string>(
    () => manageableStudents[0]?.id || students[0]?.id || '',
  )
  const [achTitle, setAchTitle] = useState('')
  const [achDetail, setAchDetail] = useState('')
  const [achCategory, setAchCategory] =
    useState<StudentAchievementItem['category']>('Academic Honor')
  const [achBonusPoints, setAchBonusPoints] = useState(10)
  const [achSubmitting, setAchSubmitting] = useState(false)
  const [certificateOpen, setCertificateOpen] = useState(false)

  useEffect(() => {
    if (
      canManage &&
      manageableStudents.length > 0 &&
      !manageableStudents.some((s) => s.id === achStudentId)
    ) {
      setAchStudentId(manageableStudents[0].id)
    }
  }, [canManage, manageableStudents, achStudentId])

  // ==================== PAST PAPERS STATE ====================
  const [paperFilter, setPaperFilter] = useState('All')
  const [paperSearch, setPaperSearch] = useState('')
  const [addPaperOpen, setAddPaperOpen] = useState(false)
  const [ppTitle, setPpTitle] = useState('')
  const [ppSubject, setPpSubject] = useState('Physics')
  const [ppBoard, setPpBoard] = useState<PastPaperItem['board']>('DMHA Term Practice')
  const [ppYear, setPpYear] = useState('2026 Term 2')
  const [ppCode, setPpCode] = useState('')
  const [ppSummary, setPpSummary] = useState('')
  const [ppFile, setPpFile] = useState<File | null>(null)
  const [ppSubmitting, setPpSubmitting] = useState(false)
  const ppFileInputRef = useRef<HTMLInputElement | null>(null)

  const [selectedSubject, setSelectedSubject] = useState<SubjectProgress | null>(null)
  const [activePaper, setActivePaper] = useState<PastPaperItem | null>(null)
  const [showMarkScheme, setShowMarkScheme] = useState(false)

  // ==================== DERIVED DATA ====================
  const sortedHouses = useMemo(() => {
    const entries: [HouseName, number][] = HOUSES.map((h) => [
      h,
      Number(houseStandings[h] ?? 0),
    ])
    return entries.sort((a, b) => b[1] - a[1])
  }, [houseStandings])

  const maxHouseScore = Math.max(1, sortedHouses[0]?.[1] || 1)

  const roleScopedMerits = useMemo(() => {
    if (isSingleStudentView && child) {
      return merits.filter((m) => m.studentId === child.id)
    }
    if (isTeacher) {
      const allowedIds = new Set(manageableStudents.map((s) => s.id))
      return merits.filter(
        (m) =>
          m.type === 'merit' ||
          allowedIds.has(m.studentId) ||
          m.awardedById === authUser?.id ||
          m.awardedBy === activeTeacher?.name,
      )
    }
    return merits
  }, [merits, isSingleStudentView, child, isTeacher, manageableStudents, authUser?.id, activeTeacher?.name])

  const filteredLog = useMemo(() => {
    const q = logSearch.trim().toLowerCase()
    return roleScopedMerits
      .filter((m) => (logTypeFilter === 'all' ? true : m.type === logTypeFilter))
      .filter((m) => (logHouseFilter === 'all' ? true : m.house === logHouseFilter))
      .filter((m) => (!logDateFilter ? true : matchesDateFilter(m.dateIso || m.date, logDateFilter)))
      .filter((m) => {
        if (!q) return true
        return (
          m.studentName.toLowerCase().includes(q) ||
          m.reason.toLowerCase().includes(q) ||
          m.awardedBy.toLowerCase().includes(q) ||
          m.house.toLowerCase().includes(q)
        )
      })
  }, [roleScopedMerits, logTypeFilter, logHouseFilter, logDateFilter, logSearch])

  const pastoralCases = useMemo(() => {
    const base = roleScopedMerits.filter((m) => m.type === 'pastoral')
    return base
      .filter((m) => {
        const st = m.pastoralStatus || 'open'
        return pastoralStatusFilter === 'all' ? true : st === pastoralStatusFilter
      })
      .filter((m) => (pastoralTierFilter === 'all' ? true : m.tier === pastoralTierFilter))
  }, [roleScopedMerits, pastoralStatusFilter, pastoralTierFilter])

  const openPastoralCount = roleScopedMerits.filter(
    (m) => m.type === 'pastoral' && (m.pastoralStatus || 'open') !== 'resolved',
  ).length

  const visibleAchievements = useMemo(() => {
    if (isSingleStudentView && child) {
      return studentAchievements.filter((a) => a.studentId === child.id)
    }
    return studentAchievements
  }, [studentAchievements, isSingleStudentView, child])

  const paperSubjects = useMemo(() => {
    const set = new Set<string>(['All', 'Physics', 'Mathematics', 'Chemistry', 'English', 'ICT & Robotics'])
    pastPapers.forEach((p) => set.add(p.subject))
    return Array.from(set)
  }, [pastPapers])

  const filteredPapers = useMemo(() => {
    const q = paperSearch.trim().toLowerCase()
    return pastPapers
      .filter((p) => (paperFilter === 'All' ? true : p.subject === paperFilter))
      .filter((p) => {
        if (!q) return true
        return (
          p.title.toLowerCase().includes(q) ||
          p.subject.toLowerCase().includes(q) ||
          p.paperCode.toLowerCase().includes(q) ||
          p.board.toLowerCase().includes(q)
        )
      })
  }, [pastPapers, paperFilter, paperSearch])

  const savedLogDates = useMemo(() => {
    const set = new Set<string>()
    roleScopedMerits.forEach((m) => {
      if (m.dateIso) set.add(m.dateIso)
    })
    return Array.from(set).sort((a, b) => b.localeCompare(a)).slice(0, 6)
  }, [roleScopedMerits])

  // ==================== HANDLERS ====================
  const handleMeritSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetStudentId || !reason.trim()) {
      notify('Please select a student and enter a reason')
      return
    }
    setSubmittingEntry(true)
    const res = await awardMeritOrPastoral({
      studentId: targetStudentId,
      house,
      points,
      type: entryType,
      category: entryType === 'pastoral' ? 'Conduct' : category,
      tier: entryType === 'pastoral' ? tier : undefined,
      actionPlan: entryType === 'pastoral' ? actionPlan.trim() || undefined : undefined,
      reason: reason.trim(),
    })
    setSubmittingEntry(false)
    if (res.ok) {
      setReason('')
      setActionPlan('')
    }
  }

  const handleAwardAchievement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!achStudentId || !achTitle.trim()) {
      notify('Please select a student and enter an achievement title')
      return
    }
    setAchSubmitting(true)
    const res = await addStudentAchievement({
      studentId: achStudentId,
      title: achTitle.trim(),
      detail: achDetail.trim(),
      category: achCategory,
      bonusPoints: achBonusPoints,
    })
    setAchSubmitting(false)
    if (res.ok) {
      setAchTitle('')
      setAchDetail('')
    }
  }

  const handleAddPaper = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ppTitle.trim()) {
      notify('Practice sheet title is required')
      return
    }
    setPpSubmitting(true)
    try {
      let fileUrl: string | undefined
      let fileName: string | undefined
      if (ppFile) {
        const fd = new FormData()
        fd.append('folder', 'past-papers')
        fd.append('file', ppFile)
        const upRes = await fetch('/dmhs-api/uploads', { method: 'POST', body: fd })
        const upJson = (await upRes.json()) as { ok?: boolean; url?: string; error?: string }
        if (!upRes.ok || !upJson.ok || !upJson.url) {
          throw new Error(upJson.error || 'Failed to upload practice file')
        }
        fileUrl = upJson.url
        fileName = ppFile.name
      }
      const res = await addPastPaperItem({
        title: ppTitle.trim(),
        subject: ppSubject.trim() || 'General',
        board: ppBoard,
        year: ppYear.trim() || '2026',
        paperCode: ppCode.trim() || `DMHA-${Date.now().toString().slice(-4)}`,
        summary: ppSummary.trim() || undefined,
        hasMarkScheme: true,
        fileUrl,
        fileName,
      })
      if (res.ok) {
        setPpTitle('')
        setPpCode('')
        setPpSummary('')
        setPpFile(null)
        setAddPaperOpen(false)
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to publish practice paper')
    } finally {
      setPpSubmitting(false)
    }
  }

  const exportLogCsv = () => {
    const rows = [
      ['Date', 'Student', 'House', 'Type', 'Points', 'Tier', 'Status', 'Reason', 'Awarded By', 'Guardian Acknowledged'],
      ...filteredLog.map((m) => [
        m.dateIso || m.date,
        m.studentName,
        m.house,
        m.type,
        m.points,
        m.tier || '',
        m.pastoralStatus || (m.type === 'merit' ? 'awarded' : 'open'),
        m.reason,
        m.awardedBy,
        m.guardianAcknowledged ? 'Yes' : 'No',
      ]),
    ]
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DMHA-House-Pastoral-Log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    notify('Exported House & Pastoral CSV report')
  }

  const applyPreset = (preset: {
    type: 'merit' | 'pastoral'
    pts: number
    cat: NonNullable<MeritLogItem['category']>
    reasonText: string
    tierVal?: NonNullable<MeritLogItem['tier']>
  }) => {
    setEntryType(preset.type)
    setPoints(preset.pts)
    setCategory(preset.cat)
    setReason(preset.reasonText)
    if (preset.tierVal) setTier(preset.tierVal)
  }

  return (
    <PageShell
      eyebrow="DMHA House Championship & Pastoral Care · Real-Time Synced"
      title={
        isSingleStudentView && child
          ? `${child.name}’s House, Pastoral & CCA Portfolio`
          : 'House Championship, Pastoral Care & Practice Vault'
      }
      subtitle={
        isSingleStudentView && child
          ? `Showing ${child.name}’s (${child.className} · ${child.section} · ${child.house || 'Emerald'} House) merits, confidential pastoral updates, verified achievements, and exam revision sheets.`
          : 'Live 4-House standings, teacher merit & pastoral workflows, counselor follow-ups, guardian acknowledgements, CCA awards, and practice papers.'
      }
      action={
        canManage ? (
          <button
            onClick={exportLogCsv}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-400 shadow-xs hover:bg-slate-800"
          >
            <Icon name="download" size={14} />
            Export Log CSV
          </button>
        ) : isSingleStudentView && child ? (
          <button
            onClick={() => setCertificateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-400 shadow-xs hover:bg-slate-800"
          >
            <Icon name="print" size={14} />
            Print CCA Certificate
          </button>
        ) : undefined
      }
    >
      {isGuardian && <ChildSwitcherBar />}

      {/* ============================================================
          LIVE INTER-HOUSE CHAMPIONSHIP 2026 BANNER (ALL 4 HOUSES)
         ============================================================ */}
      <section className="dmhs-hero rounded-[28px] p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-400">
              Inter-House Championship 2026 · Emerald · Sapphire · Crimson · Gold
            </p>
            <h3 className="mt-1 text-xl font-black">Live House Standings</h3>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-slate-300">
            Click any House card to inspect members{isAdmin ? ' & reassign houses' : ''}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sortedHouses.map(([hName, score], idx) => {
            const members = students.filter((s) => (s.house || 'Emerald') === hName)
            const pct = Math.max(12, Math.round((score / maxHouseScore) * 100))
            const isMyHouse = isSingleStudentView && (child?.house || 'Emerald') === hName
            const style = HOUSE_STYLES[hName]

            return (
              <button
                key={hName}
                type="button"
                onClick={() => setRosterHouse(hName)}
                className={`rounded-2xl border bg-white/8 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/12 ${
                  isMyHouse ? `border-emerald-400/70 ring-2 ${style.ring}` : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${style.badge}`}>
                    {hName} House
                  </span>
                  <span className="text-xs font-black text-white/60">
                    {idx === 0 ? '🏆 #1' : `#${idx + 1}`}
                  </span>
                </div>
                <p className={`mt-3 text-3xl font-black ${style.darkAccent}`}>
                  {score.toLocaleString()}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-300">
                  <span>{members.length} student{members.length === 1 ? '' : 's'}</span>
                  <span className="text-emerald-300">
                    {isMyHouse ? 'Your House · ' : ''}Roster →
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ============================================================
          4-TAB SUB-NAVIGATION BAR
         ============================================================ */}
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs">
        <button
          onClick={() => setActiveTab('merits')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'merits'
              ? 'bg-[#0f172a] text-emerald-400 shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="award" size={15} />
          House &amp; Merits ({roleScopedMerits.length})
        </button>

        <button
          onClick={() => setActiveTab('pastoral')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'pastoral'
              ? 'bg-[#0f172a] text-emerald-400 shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="shield" size={15} />
          Pastoral Care
          {openPastoralCount > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
              {openPastoralCount} open
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('achievements')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'achievements'
              ? 'bg-[#0f172a] text-emerald-400 shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="star" size={15} />
          Achievements &amp; CCA ({visibleAchievements.length})
        </button>

        <button
          onClick={() => setActiveTab('papers')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'papers'
              ? 'bg-[#0f172a] text-emerald-400 shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="book" size={15} />
          Practice &amp; Past Papers ({pastPapers.length})
        </button>
      </div>

      {/* ============================================================
          TAB 1: HOUSE POINTS & MERITS LOG + AWARD COMPOSER
         ============================================================ */}
      {activeTab === 'merits' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          {/* Left: Filterable Log */}
          <section className="space-y-4">
            <div className="dmhs-card space-y-3 rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Search student, house, teacher, or reason..."
                  className="min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                />
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                  {(['all', 'merit', 'pastoral'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setLogTypeFilter(t)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold capitalize ${
                        logTypeFilter === t ? 'bg-[#0f172a] text-emerald-400' : 'text-slate-600'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setLogHouseFilter('all')}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                      logHouseFilter === 'all'
                        ? 'bg-[#0f172a] text-emerald-400'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    All Houses
                  </button>
                  {HOUSES.map((h) => (
                    <button
                      key={h}
                      onClick={() => setLogHouseFilter(h)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                        logHouseFilter === h ? 'bg-emerald-600 text-white' : HOUSE_STYLES[h].badge
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>

                <DateFilterBar
                  value={logDateFilter}
                  onChange={setLogDateFilter}
                  label="Date"
                  allowAll
                  savedDates={savedLogDates}
                  compact
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredLog.length === 0 ? (
                <div className="dmhs-card rounded-2xl p-8 text-center text-xs font-bold text-slate-400">
                  No house points or conduct records match your current filter.
                </div>
              ) : (
                filteredLog.map((item) => {
                  const canDeleteThis =
                    isAdmin ||
                    (isTeacher &&
                      (item.awardedById === authUser?.id ||
                        item.awardedBy === activeTeacher?.name))
                  return (
                    <div
                      key={item.id}
                      className="dmhs-card rounded-2xl p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${HOUSE_STYLES[item.house]?.badge || 'bg-slate-100 text-slate-700'}`}
                            >
                              {item.house}
                            </span>
                            <span className="text-xs font-black text-slate-900">
                              {item.studentName}
                            </span>
                            {item.category && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                {item.category}
                              </span>
                            )}
                            {item.tier && (
                              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-800">
                                {item.tier}
                              </span>
                            )}
                            {item.type === 'pastoral' && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                  item.pastoralStatus === 'resolved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.pastoralStatus === 'follow_up'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {(item.pastoralStatus || 'open').replace('_', ' ')}
                              </span>
                            )}
                          </div>

                          <p className="mt-1.5 text-xs font-semibold text-slate-700">
                            {item.reason}
                          </p>
                          <p className="mt-1 text-[10px] font-bold text-slate-400">
                            {item.awardedBy} · {item.date}
                            {item.guardianAcknowledged
                              ? ` · ✓ Acknowledged by ${item.guardianAcknowledgedBy || 'Guardian'}`
                              : ''}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span
                            className={`rounded-xl px-3 py-1.5 text-xs font-black ${
                              item.points >= 0
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {item.points >= 0 ? `+${item.points}` : item.points} pts
                          </span>

                          <div className="flex items-center gap-1.5">
                            {isGuardian && !item.guardianAcknowledged && (
                              <button
                                onClick={() => acknowledgeMeritOrPastoral(item.id)}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-extrabold text-white hover:bg-emerald-700"
                              >
                                ✓ Acknowledge
                              </button>
                            )}
                            {item.type === 'pastoral' && (
                              <button
                                onClick={() => setActiveTab('pastoral')}
                                className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold text-slate-700 hover:bg-slate-200"
                              >
                                Manage Case
                              </button>
                            )}
                            {canDeleteThis && (
                              <button
                                onClick={() => deleteMeritOrPastoral(item.id)}
                                className="rounded-lg bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold text-rose-700 hover:bg-rose-100"
                              >
                                Revert
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* Right: Award Composer (Teacher/Admin) OR Child Summary (Guardian/Student) */}
          {canManage ? (
            <form
              onSubmit={handleMeritSubmit}
              className="dmhs-card h-fit rounded-[24px] border-2 border-emerald-500/20 bg-white p-5"
            >
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                Real-Time House &amp; Pastoral Logger
              </p>
              <h3 className="mt-0.5 text-base font-black text-slate-900">
                Award House Points or Open Pastoral Case
              </h3>

              {/* Quick Presets */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    applyPreset({
                      type: 'merit',
                      pts: 5,
                      cat: 'Community',
                      reasonText: 'Helpful peer mentoring & positive teamwork in class',
                    })
                  }
                  className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 hover:bg-emerald-100"
                >
                  +5 Teamwork
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPreset({
                      type: 'merit',
                      pts: 10,
                      cat: 'Academic',
                      reasonText: 'Outstanding class presentation & mastery of topic',
                    })
                  }
                  className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 hover:bg-emerald-100"
                >
                  +10 Academic Star
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPreset({
                      type: 'merit',
                      pts: 15,
                      cat: 'Leadership',
                      reasonText: 'Inter-House competition excellence & leadership',
                    })
                  }
                  className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold text-amber-800 hover:bg-amber-100"
                >
                  +15 Leadership
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPreset({
                      type: 'pastoral',
                      pts: 5,
                      cat: 'Conduct',
                      tierVal: 'Level 1 Reminder',
                      reasonText: 'Repeated late arrival & homework readiness check-in',
                    })
                  }
                  className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold text-rose-700 hover:bg-rose-100"
                >
                  -5 Pastoral L1
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEntryType('merit')}
                  className={`rounded-xl py-2.5 text-xs font-black transition ${
                    entryType === 'merit'
                      ? 'bg-[#0f172a] text-emerald-400'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  + Merit Award
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('pastoral')}
                  className={`rounded-xl py-2.5 text-xs font-black transition ${
                    entryType === 'pastoral'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  Pastoral / Care Case
                </button>
              </div>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <label className="block text-[11px] font-extrabold text-slate-600">
                  Student ({isTeacher ? 'Assigned Classes' : 'All Students'})
                  <select
                    value={targetStudentId}
                    onChange={(e) => handleSelectTargetStudent(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                  >
                    {manageableStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.className} · {s.house || 'Emerald'})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-[11px] font-extrabold text-slate-600">
                  House
                  <select
                    value={house}
                    onChange={(e) => setHouse(e.target.value as HouseName)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                  >
                    {HOUSES.map((h) => (
                      <option key={h} value={h}>
                        {h} House
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                <label className="block text-[11px] font-extrabold text-slate-600">
                  Points ({entryType === 'merit' ? 'Add' : 'Deduct'})
                  <select
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                  >
                    {entryType === 'pastoral' && <option value={0}>0 pts (Pastoral Note Only)</option>}
                    <option value={5}>5 Points</option>
                    <option value={10}>10 Points</option>
                    <option value={15}>15 Points</option>
                    <option value={20}>20 Points</option>
                    <option value={25}>25 Points</option>
                  </select>
                </label>

                {entryType === 'pastoral' ? (
                  <label className="block text-[11px] font-extrabold text-slate-600">
                    Escalation Tier
                    <select
                      value={tier}
                      onChange={(e) =>
                        setTier(e.target.value as NonNullable<MeritLogItem['tier']>)
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                    >
                      <option value="Level 1 Reminder">Level 1 Reminder</option>
                      <option value="Level 2 Counselor">Level 2 Counselor</option>
                      <option value="Level 3 Principal">Level 3 Principal</option>
                    </select>
                  </label>
                ) : (
                  <label className="block text-[11px] font-extrabold text-slate-600">
                    Merit Category
                    <select
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as NonNullable<MeritLogItem['category']>)
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                    >
                      <option value="Academic">Academic</option>
                      <option value="Leadership">Leadership</option>
                      <option value="Sports">Sports</option>
                      <option value="Community">Community</option>
                    </select>
                  </label>
                )}
              </div>

              <label className="mt-2.5 block text-[11px] font-extrabold text-slate-600">
                Reason / Observation *
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder={
                    entryType === 'merit'
                      ? 'Describe the student’s achievement or positive contribution...'
                      : 'Describe the pastoral observation or behavior support need...'
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
                />
              </label>

              {entryType === 'pastoral' && (
                <label className="mt-2.5 block text-[11px] font-extrabold text-slate-600">
                  Recommended Support / Action Plan (Optional)
                  <input
                    value={actionPlan}
                    onChange={(e) => setActionPlan(e.target.value)}
                    placeholder="e.g., Check-in with class teacher & guardian follow-up call"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </label>
              )}

              <button
                type="submit"
                disabled={submittingEntry || manageableStudents.length === 0}
                className={`mt-4 w-full rounded-xl py-3 text-xs font-black transition disabled:opacity-50 ${
                  entryType === 'pastoral'
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-[#0f172a] text-emerald-400 hover:bg-slate-800'
                }`}
              >
                {submittingEntry
                  ? 'Saving...'
                  : entryType === 'merit'
                    ? `Award +${points} ${house} Points & Notify Guardian`
                    : 'Log Pastoral Case & Alert Guardian'}
              </button>
            </form>
          ) : (
            <section className="dmhs-card h-fit rounded-[24px] p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                {child?.house || 'Emerald'} House Summary · {child?.className}
              </p>
              <h3 className="mt-1 text-base font-black text-slate-900">
                {child?.name}’s House &amp; Conduct Standing
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3.5">
                  <p className="text-[10px] font-extrabold uppercase text-emerald-700">
                    Total Merits Earned
                  </p>
                  <p className="mt-1 text-2xl font-black text-emerald-900">
                    +
                    {roleScopedMerits
                      .filter((m) => m.type === 'merit')
                      .reduce((sum, m) => sum + Math.max(0, m.points), 0)}{' '}
                    pts
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3.5">
                  <p className="text-[10px] font-extrabold uppercase text-slate-500">
                    Verified CCA Badges
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {visibleAchievements.length}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold text-slate-500">
                All teacher merit awards automatically contribute to{' '}
                <span className="font-black text-slate-900">{child?.house || 'Emerald'} House</span>{' '}
                standings and appear on the official CCA Certificate.
              </p>
              <button
                onClick={() => setCertificateOpen(true)}
                className="mt-4 w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-extrabold text-emerald-400"
              >
                Open Official CCA &amp; Merit Certificate →
              </button>
            </section>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 2: PASTORAL CARE & SAFEGUARDING CASE TRACKER
         ============================================================ */}
      {activeTab === 'pastoral' && (
        <div className="mt-6 space-y-5">
          {/* Pastoral KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="dmhs-card rounded-2xl p-4">
              <p className="text-[10px] font-extrabold uppercase text-rose-600">Open Cases</p>
              <p className="mt-1 text-2xl font-black text-rose-700">
                {
                  roleScopedMerits.filter(
                    (m) => m.type === 'pastoral' && (m.pastoralStatus || 'open') === 'open',
                  ).length
                }
              </p>
            </div>
            <div className="dmhs-card rounded-2xl p-4">
              <p className="text-[10px] font-extrabold uppercase text-amber-600">In Follow-Up</p>
              <p className="mt-1 text-2xl font-black text-amber-700">
                {
                  roleScopedMerits.filter(
                    (m) => m.type === 'pastoral' && m.pastoralStatus === 'follow_up',
                  ).length
                }
              </p>
            </div>
            <div className="dmhs-card rounded-2xl p-4">
              <p className="text-[10px] font-extrabold uppercase text-emerald-600">Resolved ✓</p>
              <p className="mt-1 text-2xl font-black text-emerald-700">
                {
                  roleScopedMerits.filter(
                    (m) => m.type === 'pastoral' && m.pastoralStatus === 'resolved',
                  ).length
                }
              </p>
            </div>
            <div className="dmhs-card rounded-2xl p-4">
              <p className="text-[10px] font-extrabold uppercase text-indigo-600">
                Guardian Acknowledged
              </p>
              <p className="mt-1 text-2xl font-black text-indigo-700">
                {
                  roleScopedMerits.filter(
                    (m) => m.type === 'pastoral' && m.guardianAcknowledged,
                  ).length
                }
              </p>
            </div>
          </div>

          {/* Pastoral Filters */}
          <div className="dmhs-card flex flex-wrap items-center justify-between gap-2 rounded-2xl p-4">
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'open', 'follow_up', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setPastoralStatusFilter(st)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold capitalize ${
                    pastoralStatusFilter === st
                      ? 'bg-[#0f172a] text-emerald-400'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {st === 'all' ? 'All Statuses' : st.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                ['all', 'Level 1 Reminder', 'Level 2 Counselor', 'Level 3 Principal'] as const
              ).map((t) => (
                <button
                  key={t}
                  onClick={() => setPastoralTierFilter(t)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold ${
                    pastoralTierFilter === t
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t === 'all' ? 'All Tiers' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Pastoral Case Cards */}
          {pastoralCases.length === 0 ? (
            <div className="dmhs-card rounded-[24px] p-10 text-center">
              <p className="text-sm font-black text-slate-900">
                No pastoral care cases match this filter
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {canManage
                  ? 'Use the "Pastoral / Care Case" option in House & Merits to open a confidential support case.'
                  : 'All clear — no open pastoral or conduct notes on record.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pastoralCases.map((pc) => {
                const status = pc.pastoralStatus || 'open'
                const followDraft = followUpDrafts[pc.id] || ''
                const replyDraft = guardianReplyDrafts[pc.id] || ''

                return (
                  <div
                    key={pc.id}
                    className={`dmhs-card rounded-[24px] border-l-4 p-5 ${
                      status === 'resolved'
                        ? 'border-l-emerald-500'
                        : status === 'follow_up'
                          ? 'border-l-amber-500'
                          : 'border-l-rose-500'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black text-rose-800">
                            {pc.tier || 'Level 1 Reminder'}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                              status === 'resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : status === 'follow_up'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {status.replace('_', ' ')}
                          </span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${HOUSE_STYLES[pc.house]?.badge || 'bg-slate-100'}`}>
                            {pc.house}
                          </span>
                          {pc.guardianAcknowledged ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
                              ✓ Guardian Acknowledged
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-800">
                              ⏳ Awaiting Guardian Ack
                            </span>
                          )}
                        </div>
                        <h4 className="mt-2 text-base font-black text-slate-900">
                          {pc.studentName}{' '}
                          {pc.classLabel && (
                            <span className="text-xs font-bold text-slate-400">
                              · {pc.classLabel}
                            </span>
                          )}
                        </h4>
                        <p className="mt-1 text-xs font-semibold text-slate-700">{pc.reason}</p>
                        {pc.actionPlan && (
                          <p className="mt-1.5 rounded-xl bg-amber-50/70 px-3 py-2 text-xs font-bold text-amber-950">
                            Support / Action Plan: {pc.actionPlan}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11px] font-bold text-slate-400">
                          Logged by {pc.awardedBy} · {pc.date} · {pc.points} house pts
                        </p>
                      </div>

                      {/* Admin / Teacher Status Transitions */}
                      {canManage && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {status !== 'follow_up' && (
                            <button
                              onClick={() =>
                                updatePastoralCase({ entryId: pc.id, pastoralStatus: 'follow_up' })
                              }
                              className="rounded-xl bg-amber-100 px-3 py-1.5 text-[11px] font-extrabold text-amber-900 hover:bg-amber-200"
                            >
                              Move to Follow-Up
                            </button>
                          )}
                          {status !== 'resolved' ? (
                            <button
                              onClick={() =>
                                updatePastoralCase({ entryId: pc.id, pastoralStatus: 'resolved' })
                              }
                              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-emerald-700"
                            >
                              Mark Resolved ✓
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                updatePastoralCase({ entryId: pc.id, pastoralStatus: 'open' })
                              }
                              className="rounded-xl bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-700 hover:bg-slate-200"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Guardian Reply Display */}
                    {pc.guardianAcknowledged && (
                      <div className="mt-3 rounded-xl bg-emerald-50/80 px-3.5 py-2.5 text-xs">
                        <p className="font-black text-emerald-900">
                          ✓ Acknowledged by {pc.guardianAcknowledgedBy || 'Guardian'} (
                          {pc.guardianAcknowledgedAt || 'Recorded'})
                        </p>
                        {pc.guardianReply && (
                          <p className="mt-0.5 font-semibold text-emerald-800">
                            Parent Note: &ldquo;{pc.guardianReply}&rdquo;
                          </p>
                        )}
                      </div>
                    )}

                    {/* Counselor / Teacher Follow-Up Notes Thread */}
                    {(pc.followUpNotes || []).length > 0 && (
                      <div className="mt-3 space-y-1.5 rounded-2xl bg-slate-50 p-3">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Counselor &amp; Faculty Follow-Up Notes
                        </p>
                        {(pc.followUpNotes || []).map((fn) => (
                          <div key={fn.id} className="rounded-xl bg-white px-3 py-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-black text-slate-900">
                                {fn.authorName}{' '}
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] uppercase text-slate-500">
                                  {fn.authorRole}
                                </span>
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">
                                {fn.createdAt}
                              </span>
                            </div>
                            <p className="mt-1 font-medium text-slate-700">{fn.note}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Teacher / Admin Add Follow-Up Note */}
                    {canManage && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault()
                          if (!followDraft.trim()) return
                          const res = await updatePastoralCase({
                            entryId: pc.id,
                            pastoralStatus: status === 'open' ? 'follow_up' : status,
                            followUpNote: followDraft.trim(),
                          })
                          if (res.ok) {
                            setFollowUpDrafts((prev) => ({ ...prev, [pc.id]: '' }))
                          }
                        }}
                        className="mt-3 flex items-center gap-2"
                      >
                        <input
                          value={followDraft}
                          onChange={(e) =>
                            setFollowUpDrafts((prev) => ({ ...prev, [pc.id]: e.target.value }))
                          }
                          placeholder="Add counselor / teacher follow-up note or meeting outcome..."
                          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-400 hover:bg-slate-800"
                        >
                          Add Note
                        </button>
                      </form>
                    )}

                    {/* Guardian Acknowledge & Reply Box */}
                    {isGuardian && !pc.guardianAcknowledged && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault()
                          const res = await acknowledgeMeritOrPastoral(
                            pc.id,
                            replyDraft.trim() || undefined,
                          )
                          if (res.ok) {
                            setGuardianReplyDrafts((prev) => ({ ...prev, [pc.id]: '' }))
                          }
                        }}
                        className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-emerald-50/70 p-3"
                      >
                        <input
                          value={replyDraft}
                          onChange={(e) =>
                            setGuardianReplyDrafts((prev) => ({ ...prev, [pc.id]: e.target.value }))
                          }
                          placeholder="Optional reply to teacher / counselor (e.g., We spoke with him at home)..."
                          className="min-w-[200px] flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold outline-none"
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-700"
                        >
                          ✓ Acknowledge &amp; Confirm
                        </button>
                      </form>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 3: VERIFIED ACHIEVEMENTS, CCA PORTFOLIO & GRADE TARGETS
         ============================================================ */}
      {activeTab === 'achievements' && (
        <div className="mt-6 space-y-6">
          {canManage && (
            <form
              onSubmit={handleAwardAchievement}
              className="dmhs-card rounded-[24px] border-2 border-emerald-500/20 bg-white p-5"
            >
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                Verified CCA &amp; Co-Curricular Honors
              </p>
              <h3 className="mt-0.5 text-base font-black text-slate-900">
                + Award Verified Student Achievement Badge
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  value={achStudentId}
                  onChange={(e) => setAchStudentId(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                >
                  {manageableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.className})
                    </option>
                  ))}
                </select>
                <select
                  value={achCategory}
                  onChange={(e) =>
                    setAchCategory(e.target.value as StudentAchievementItem['category'])
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                >
                  <option value="Science & STEM">Science &amp; STEM</option>
                  <option value="Academic Honor">Academic Honor</option>
                  <option value="Debate & Arts">Debate &amp; Arts</option>
                  <option value="Sports">Sports</option>
                  <option value="Community Service">Community Service</option>
                </select>
                <input
                  value={achTitle}
                  onChange={(e) => setAchTitle(e.target.value)}
                  placeholder="Achievement title *"
                  required
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
                <select
                  value={achBonusPoints}
                  onChange={(e) => setAchBonusPoints(Number(e.target.value))}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                >
                  <option value={0}>No bonus house pts</option>
                  <option value={5}>+5 House Bonus Pts</option>
                  <option value={10}>+10 House Bonus Pts</option>
                  <option value={15}>+15 House Bonus Pts</option>
                  <option value={20}>+20 House Bonus Pts</option>
                </select>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  value={achDetail}
                  onChange={(e) => setAchDetail(e.target.value)}
                  placeholder="Details (e.g., 1st Place Robotics Showcase · Unit - 2 Auditorium)"
                  className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold outline-none"
                />
                <button
                  type="submit"
                  disabled={achSubmitting}
                  className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-emerald-400 hover:bg-slate-800"
                >
                  {achSubmitting ? 'Awarding...' : 'Award Achievement'}
                </button>
              </div>
            </form>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleAchievements.length === 0 ? (
              <div className="dmhs-card col-span-full rounded-2xl p-8 text-center text-xs font-bold text-slate-400">
                No verified CCA achievements recorded yet.
              </div>
            ) : (
              visibleAchievements.map((ach) => (
                <div key={ach.id} className="dmhs-card rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black text-indigo-700">
                      {ach.category}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${HOUSE_STYLES[ach.house]?.badge || 'bg-slate-100'}`}>
                      {ach.house}
                    </span>
                  </div>
                  <h4 className="mt-2.5 text-sm font-black text-slate-900">{ach.title}</h4>
                  <p className="mt-1 text-xs font-semibold text-slate-600">{ach.detail}</p>
                  <p className="mt-3 text-[10px] font-bold text-slate-400">
                    {ach.studentName} · Verified by {ach.awardedBy} ({ach.date})
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Subject Grade Targets (Single-Student Guardian & Student View) */}
          {isSingleStudentView && child && (
            <section>
              <SectionTitle
                eyebrow={`${child.className} · Term trajectory`}
                title={`${child.name}’s Subject Grade Targets`}
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {child.subjects.map((sub) => {
                  const predicted = predictedCambridgeGrade(sub.latestScore)
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubject(sub)}
                      className="dmhs-card flex items-center justify-between rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-900">{sub.name}</p>
                        <p className="text-[11px] font-semibold text-slate-500">
                          Latest: {sub.latestScore}% · Target: A* · View →
                        </p>
                      </div>
                      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#0f172a] text-sm font-black text-emerald-400">
                        {predicted}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 4: PRACTICE SHEETS & PAST PAPER VAULT (PERSISTED)
         ============================================================ */}
      {activeTab === 'papers' && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              value={paperSearch}
              onChange={(e) => setPaperSearch(e.target.value)}
              placeholder="Search practice sheets or past papers by subject, code, or topic..."
              className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
            />
            {canManage && (
              <button
                onClick={() => setAddPaperOpen((v) => !v)}
                className="rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-extrabold text-emerald-400 hover:bg-slate-800"
              >
                {addPaperOpen ? 'Cancel' : '+ Upload Practice Sheet / Paper'}
              </button>
            )}
          </div>

          {canManage && addPaperOpen && (
            <form
              onSubmit={handleAddPaper}
              className="dmhs-card space-y-3 rounded-[24px] border-2 border-emerald-500/20 bg-white p-5"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  value={ppTitle}
                  onChange={(e) => setPpTitle(e.target.value)}
                  placeholder="Paper / worksheet title *"
                  required
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
                <input
                  value={ppSubject}
                  onChange={(e) => setPpSubject(e.target.value)}
                  placeholder="Subject (e.g., Physics)"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
                <select
                  value={ppBoard}
                  onChange={(e) => setPpBoard(e.target.value as PastPaperItem['board'])}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                >
                  <option value="DMHA Term Practice">DMHA Term Practice</option>
                  <option value="Cambridge Checkpoint">Cambridge Checkpoint</option>
                  <option value="Cambridge IGCSE">Cambridge IGCSE</option>
                  <option value="Edexcel IAL">Edexcel IAL</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={ppYear}
                    onChange={(e) => setPpYear(e.target.value)}
                    placeholder="Year/Term"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                  />
                  <input
                    value={ppCode}
                    onChange={(e) => setPpCode(e.target.value)}
                    placeholder="Code"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>
              </div>
              <textarea
                rows={2}
                value={ppSummary}
                onChange={(e) => setPpSummary(e.target.value)}
                placeholder="Instructions, key questions, or official marking scheme summary..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => ppFileInputRef.current?.click()}
                    className="rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-200"
                  >
                    {ppFile ? `Attached: ${ppFile.name}` : 'Attach PDF / Worksheet (Optional)'}
                  </button>
                  <input
                    ref={ppFileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => setPpFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </div>
                <button
                  type="submit"
                  disabled={ppSubmitting}
                  className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-emerald-400"
                >
                  {ppSubmitting ? 'Publishing...' : 'Publish to Vault'}
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap gap-2">
            {paperSubjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setPaperFilter(sub)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                  paperFilter === sub ? 'bg-[#0f172a] text-emerald-400' : 'bg-white text-slate-500'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {filteredPapers.map((paper) => (
              <div
                key={paper.id}
                className="dmhs-card flex items-center justify-between gap-3 rounded-2xl p-4"
              >
                <button
                  onClick={() => {
                    setActivePaper(paper)
                    setShowMarkScheme(false)
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[9px] font-black text-indigo-700">
                      {paper.board}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-slate-400">
                      {paper.paperCode} · {paper.year}
                    </span>
                    {paper.fileUrl && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">
                        PDF Attached
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs font-black text-slate-900 hover:text-emerald-700">
                    {paper.title}
                  </p>
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => {
                      setActivePaper(paper)
                      setShowMarkScheme(false)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-800 hover:bg-slate-200"
                  >
                    <Icon name="download" size={13} />
                    Open
                  </button>
                  {canManage && (
                    <button
                      onClick={() => deletePastPaperItem(paper.id)}
                      className="rounded-xl bg-rose-50 px-2.5 py-2 text-[10px] font-black text-rose-700 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 1: HOUSE ROSTER & ADMIN HOUSE REASSIGNMENT
         ============================================================ */}
      {rosterHouse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setRosterHouse(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black ${HOUSE_STYLES[rosterHouse].badge}`}>
                  {rosterHouse} House · {Number(houseStandings[rosterHouse] ?? 0).toLocaleString()} pts
                </span>
                <h3 className="mt-2 text-lg font-black text-slate-900">
                  {rosterHouse} House Student Roster
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {isAdmin
                    ? 'Use the House dropdown beside any student to reassign them between Emerald, Sapphire, Crimson, and Gold.'
                    : 'Active DMHA students representing this House.'}
                </p>
              </div>
              <button
                onClick={() => setRosterHouse(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {students.filter((s) => (s.house || 'Emerald') === rosterHouse).length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-semibold text-slate-500">
                  No students currently assigned to {rosterHouse} House.
                </p>
              ) : (
                students
                  .filter((s) => (s.house || 'Emerald') === rosterHouse)
                  .map((stu) => {
                    const stuMerits = merits
                      .filter((m) => m.studentId === stu.id && m.type === 'merit')
                      .reduce((sum, m) => sum + Math.max(0, m.points), 0)
                    return (
                      <div
                        key={stu.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-black text-slate-900">{stu.name}</p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {stu.className} · {stu.section} · Roll #{stu.roll} · +{stuMerits} personal merits
                          </p>
                        </div>
                        {isAdmin && (
                          <select
                            aria-label={`Reassign house for ${stu.name}`}
                            value={stu.house || 'Emerald'}
                            onChange={(e) =>
                              reassignStudentHouse(stu.id, e.target.value as HouseName)
                            }
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
                          >
                            {HOUSES.map((h) => (
                              <option key={h} value={h}>
                                {h} House
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 2: OFFICIAL CCA & MERIT CERTIFICATE (PRINTABLE)
         ============================================================ */}
      {certificateOpen && child && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setCertificateOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border-4 border-emerald-500/30 bg-white p-7 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-700">
                  DMHA · Official Co-Curricular &amp; House Merit Transcript
                </p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">{child.name}</h3>
                <p className="mt-0.5 text-xs font-bold text-slate-500">
                  {child.className} · {child.section} · Roll #{child.roll} ·{' '}
                  {child.house || 'Emerald'} House
                </p>
              </div>
              <button
                onClick={() => setCertificateOpen(false)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Verified Co-Curricular Achievements ({visibleAchievements.length})
              </p>
              {visibleAchievements.map((a) => (
                <div key={a.id} className="rounded-xl bg-slate-50 p-3.5 text-xs">
                  <p className="font-black text-slate-900">
                    {a.title} <span className="text-emerald-700">({a.category})</span>
                  </p>
                  <p className="mt-0.5 text-slate-600">{a.detail}</p>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                    Verified by {a.awardedBy} · {a.date}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setCertificateOpen(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-extrabold text-emerald-400"
              >
                Print Official Certificate PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSubject && child && (
        <SubjectDetailModal
          subject={selectedSubject}
          studentName={child.name}
          onClose={() => setSelectedSubject(null)}
        />
      )}

      {/* ============================================================
          MODAL 3: PRACTICE PAPER & MARKING SCHEME VIEWER
         ============================================================ */}
      {activePaper && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setActivePaper(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">
                  {activePaper.board} · {activePaper.paperCode} ({activePaper.year})
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">{activePaper.title}</h3>
              </div>
              <button
                onClick={() => setActivePaper(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {activePaper.summary && (
                <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Worksheet Overview &amp; Instructions
                  </p>
                  <p className="mt-1 font-semibold">{activePaper.summary}</p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 p-4 text-xs leading-6 text-slate-700">
                <p className="font-black text-slate-900">
                  Practice Section A — Structured Questions ({activePaper.subject})
                </p>
                <ol className="mt-2 list-decimal space-y-2 pl-4 font-semibold">
                  <li>
                    Define the core principle tested in {activePaper.title} and illustrate with a
                    clear labeled diagram. [4 marks]
                  </li>
                  <li>
                    Apply the concept to a real-world problem and show full step-by-step working
                    with correct units. [6 marks]
                  </li>
                  <li>
                    Evaluate one common misconception and justify your final answer clearly.
                    [5 marks]
                  </li>
                </ol>
              </div>

              {showMarkScheme && (
                <div className="rounded-2xl bg-emerald-50 p-4 text-xs leading-6 text-emerald-950 ring-1 ring-emerald-500/20">
                  <p className="font-black text-emerald-900">Official Marking Scheme Key</p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 font-semibold">
                    <li>Q1: Full credit for accurate definition (2) + cleanly labeled diagram (2).</li>
                    <li>Q2: Method mark for formula/setup (2) + intermediate steps (2) + final value with unit (2).</li>
                    <li>Q3: Clear identification of misconception (2) + logical reasoning (3).</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-between gap-2">
              <button
                onClick={() => setShowMarkScheme((v) => !v)}
                className="rounded-full bg-indigo-50 px-4 py-2 text-xs font-extrabold text-indigo-700 hover:bg-indigo-100"
              >
                {showMarkScheme ? 'Hide Marking Scheme' : 'Reveal Official Marking Scheme'}
              </button>
              <div className="flex flex-wrap gap-2">
                {activePaper.fileUrl && (
                  <a
                    href={activePaper.fileUrl}
                    download={activePaper.fileName || `${activePaper.paperCode}.pdf`}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white"
                  >
                    Download Attached File
                  </a>
                )}
                <button
                  onClick={() => window.print()}
                  className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-extrabold text-emerald-400"
                >
                  Print / Save PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
