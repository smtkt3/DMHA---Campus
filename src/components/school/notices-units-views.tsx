'use client'

import React, { useMemo, useState } from 'react'
import { DateFilterBar, getTodayIso, matchesDateFilter } from './date-utils'
import { Icon } from './icons'
import { useSchool } from './store'
import type {
  CampusClubItem,
  CampusUnitRecord,
  Role,
  SchoolNotice,
  UnitGateStatus,
} from './types'
import { ChildSwitcherBar } from './guardian-views'
import { PageShell, SectionTitle } from './ui'

const DMHS_CLASS_OPTIONS = [
  'All Classes',
  'Pre-Play',
  'Playgroup',
  'Nursery',
  'KG-1',
  'KG-2',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
]

function isNoticeVisibleForUser(
  notice: SchoolNotice,
  role: Role,
  canManageNotices: boolean,
  currentUserId: string | undefined,
  studentUnit: string | undefined,
): boolean {
  if (role === 'admin' || canManageNotices) return true
  if (currentUserId && notice.authorId && notice.authorId === currentUserId) return true

  const audienceOk =
    notice.audience === 'All' ||
    (role === 'guardian' && notice.audience === 'Guardians') ||
    (role === 'student' && notice.audience === 'Students') ||
    (role === 'teacher' && notice.audience === 'Teachers') ||
    (role === 'staff' && notice.audience === 'Staff')

  if (!audienceOk) return false

  if (
    (role === 'student' || role === 'guardian') &&
    studentUnit &&
    notice.targetUnit &&
    notice.targetUnit !== 'All Units' &&
    notice.targetUnit !== studentUnit
  ) {
    return false
  }
  return true
}

function gateStatusBadgeClass(status: UnitGateStatus): string {
  switch (status) {
    case 'Open':
      return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-500/20'
    case 'Dismissal Active':
      return 'bg-amber-100 text-amber-800 ring-1 ring-amber-500/25'
    case 'Restricted':
      return 'bg-rose-100 text-rose-800 ring-1 ring-rose-500/25'
    default:
      return 'bg-slate-200 text-slate-700 ring-1 ring-slate-400/20'
  }
}

function categoryBadgeClass(cat: SchoolNotice['category']): string {
  switch (cat) {
    case 'urgent':
      return 'bg-rose-100 text-rose-800'
    case 'event':
      return 'bg-violet-100 text-violet-800'
    case 'transport':
      return 'bg-amber-100 text-amber-800'
    case 'unit':
      return 'bg-sky-100 text-sky-800'
    default:
      return 'bg-emerald-50 text-emerald-700'
  }
}

export function CampusServicesView() {
  const {
    role,
    authUser,
    hasStaffPermission,
    notices,
    campusUnits,
    unitTransferRequests,
    campusClubs,
    libraryBooks,
    students,
    teachers,
    guardians,
    selectedChildId,
    activeStudentId,
    activeGuardianId,
    activeTeacherId,
    publishNotice,
    updateNotice,
    togglePinNotice,
    deleteNotice,
    acknowledgeNotice,
    saveCampusUnit,
    setCampusUnitGateStatus,
    deleteCampusUnit,
    reassignStudentUnit,
    requestUnitTransfer,
    reviewUnitTransfer,
    toggleCampusClubMembership,
    addCampusClub,
    issueLibraryBook,
    returnLibraryBook,
    addLibraryBook,
    notify,
  } = useSchool()

  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isGuardian = role === 'guardian'
  const isStudent = role === 'student'
  const canPublishNotice = isAdmin || isTeacher || hasStaffPermission('notices')
  const canManageGate = isAdmin || hasStaffPermission('gate_security')
  const canManageLibrary = isAdmin || isTeacher || hasStaffPermission('library')

  const guardianObj = guardians.find((g) => g.id === activeGuardianId)
  const linkedStudentIds = useMemo(() => {
    if (!isGuardian) return new Set<string>()
    const set = new Set<string>(guardianObj?.linkedStudentIds || [])
    students.forEach((s) => {
      if (s.guardianId === activeGuardianId) set.add(s.id)
    })
    return set
  }, [isGuardian, guardianObj, students, activeGuardianId])

  const activeTeacher = teachers.find((t) => t.id === activeTeacherId)

  const child =
    isStudent
      ? students.find((s) => s.id === activeStudentId) || students[0]
      : isGuardian
        ? students.find((s) => s.id === selectedChildId && linkedStudentIds.has(s.id)) ||
          students.find((s) => linkedStudentIds.has(s.id)) ||
          students[0]
        : students.find((s) => s.id === selectedChildId) || students[0]

  const childUnitName = child?.busRoute || campusUnits[0]?.name || 'Unit - 1'
  const childUnitObj =
    campusUnits.find((u) => u.name === childUnitName) || campusUnits[0]

  // Top-level hub tab
  const [activeTab, setActiveTab] = useState<'notices' | 'units' | 'library' | 'clubs'>('notices')

  // ==================== NOTICES STATE ====================
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null)
  const [ntTitle, setNtTitle] = useState('')
  const [ntBody, setNtBody] = useState('')
  const [ntCategory, setNtCategory] = useState<SchoolNotice['category']>('academic')
  const [ntAudience, setNtAudience] = useState<SchoolNotice['audience']>('All')
  const [ntUnit, setNtUnit] = useState<string>('All Units')
  const [ntClass, setNtClass] = useState<string>('All Classes')
  const [ntEventDate, setNtEventDate] = useState<string>(getTodayIso())
  const [ntPinned, setNtPinned] = useState(false)
  const [ntRequireAck, setNtRequireAck] = useState(true)
  const [ntSubmitting, setNtSubmitting] = useState(false)

  const [noticeSearch, setNoticeSearch] = useState('')
  const [noticeCatFilter, setNoticeCatFilter] = useState<'all' | SchoolNotice['category']>('all')
  const [noticeUnitFilter, setNoticeUnitFilter] = useState<string>('All Units')
  const [noticeDateFilter, setNoticeDateFilter] = useState<string>('')
  const [activeNotice, setActiveNotice] = useState<SchoolNotice | null>(null)
  const [receiptsNotice, setReceiptsNotice] = useState<SchoolNotice | null>(null)

  // ==================== UNITS STATE ====================
  const [unitModalOpen, setUnitModalOpen] = useState(false)
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null)
  const [uName, setUName] = useState('')
  const [uCode, setUCode] = useState('')
  const [uSubtitle, setUSubtitle] = useState('')
  const [uGrades, setUGrades] = useState('')
  const [uAddress, setUAddress] = useState('')
  const [uHours, setUHours] = useState('07:45 AM – 02:30 PM')
  const [uGateStatus, setUGateStatus] = useState<UnitGateStatus>('Open')
  const [uCoordinator, setUCoordinator] = useState('')
  const [uPhone, setUPhone] = useState('')
  const [uFacilities, setUFacilities] = useState('')
  const [uNote, setUNote] = useState('')
  const [uAccent, setUAccent] = useState<CampusUnitRecord['accent']>('emerald')
  const [uSubmitting, setUSubmitting] = useState(false)

  const [rosterUnit, setRosterUnit] = useState<CampusUnitRecord | null>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferToUnit, setTransferToUnit] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [transferSubmitting, setTransferSubmitting] = useState(false)

  // ==================== LIBRARY & CLUBS STATE ====================
  const [bookSearch, setBookSearch] = useState('')
  const [addBookOpen, setAddBookOpen] = useState(false)
  const [bkTitle, setBkTitle] = useState('')
  const [bkAuthor, setBkAuthor] = useState('')
  const [bkSubject, setBkSubject] = useState('Science')
  const [bkIsbn, setBkIsbn] = useState('')
  const [bkShelf, setBkShelf] = useState('Rack A-2')

  const [addClubOpen, setAddClubOpen] = useState(false)
  const [clName, setClName] = useState('')
  const [clSchedule, setClSchedule] = useState('')
  const [clMentor, setClMentor] = useState(activeTeacher?.name || authUser?.displayName || '')
  const [clUnit, setClUnit] = useState('All Units')
  const [clCategory, setClCategory] = useState<CampusClubItem['category']>('STEM')

  const currentUserId = authUser?.id || `${role}-${activeTeacherId || activeGuardianId || activeStudentId}`

  // Filtered & sorted notices
  const visibleNotices = useMemo(() => {
    const q = noticeSearch.trim().toLowerCase()
    return notices
      .filter((nt) =>
        isNoticeVisibleForUser(
          nt,
          role,
          canPublishNotice,
          authUser?.id,
          isStudent || isGuardian ? childUnitName : undefined,
        ),
      )
      .filter((nt) => (noticeCatFilter === 'all' ? true : nt.category === noticeCatFilter))
      .filter((nt) => {
        if (noticeUnitFilter === 'All Units') return true
        return !nt.targetUnit || nt.targetUnit === 'All Units' || nt.targetUnit === noticeUnitFilter
      })
      .filter((nt) => {
        if (!noticeDateFilter) return true
        return matchesDateFilter(nt.eventDate || nt.date, noticeDateFilter)
      })
      .filter((nt) => {
        if (!q) return true
        return (
          nt.title.toLowerCase().includes(q) ||
          nt.body.toLowerCase().includes(q) ||
          nt.author.toLowerCase().includes(q) ||
          (nt.targetUnit || '').toLowerCase().includes(q) ||
          (nt.targetClass || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
  }, [
    notices,
    role,
    canPublishNotice,
    authUser?.id,
    isStudent,
    isGuardian,
    childUnitName,
    noticeCatFilter,
    noticeUnitFilter,
    noticeDateFilter,
    noticeSearch,
  ])

  const savedNoticeDates = useMemo(() => {
    const dates = new Set<string>()
    notices.forEach((n) => {
      if (n.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(n.eventDate)) dates.add(n.eventDate)
    })
    return Array.from(dates).sort((a, b) => b.localeCompare(a)).slice(0, 6)
  }, [notices])

  const pinnedCount = visibleNotices.filter((n) => n.pinned).length
  const unacknowledgedCount = visibleNotices.filter(
    (n) =>
      n.requireAcknowledgement &&
      !(n.acknowledgedBy || []).some((r) => r.userId === currentUserId),
  ).length

  const pendingTransfers = useMemo(() => {
    if (isAdmin) return unitTransferRequests.filter((r) => r.status === 'pending')
    if (isStudent) return unitTransferRequests.filter((r) => r.studentId === activeStudentId)
    if (isGuardian) return unitTransferRequests.filter((r) => linkedStudentIds.has(r.studentId))
    return []
  }, [isAdmin, isStudent, isGuardian, unitTransferRequests, activeStudentId, linkedStudentIds])

  // ==================== HANDLERS ====================
  const openCreateNotice = () => {
    setEditingNoticeId(null)
    setNtTitle('')
    setNtBody('')
    setNtCategory('academic')
    setNtAudience('All')
    setNtUnit('All Units')
    setNtClass('All Classes')
    setNtEventDate(getTodayIso())
    setNtPinned(false)
    setNtRequireAck(true)
    setComposerOpen(true)
  }

  const openEditNotice = (nt: SchoolNotice) => {
    setEditingNoticeId(nt.id)
    setNtTitle(nt.title)
    setNtBody(nt.body)
    setNtCategory(nt.category)
    setNtAudience(nt.audience)
    setNtUnit(nt.targetUnit || 'All Units')
    setNtClass(nt.targetClass || 'All Classes')
    setNtEventDate(nt.eventDate || getTodayIso())
    setNtPinned(Boolean(nt.pinned))
    setNtRequireAck(Boolean(nt.requireAcknowledgement))
    setComposerOpen(true)
  }

  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ntTitle.trim() || !ntBody.trim()) {
      notify('Please enter a notice title and message body')
      return
    }
    setNtSubmitting(true)
    const res = editingNoticeId
      ? await updateNotice({
          noticeId: editingNoticeId,
          title: ntTitle.trim(),
          body: ntBody.trim(),
          category: ntCategory,
          audience: ntAudience,
          targetUnit: ntUnit,
          targetClass: ntClass,
          eventDate: ntEventDate,
          pinned: isAdmin ? ntPinned : undefined,
          requireAcknowledgement: ntRequireAck,
        })
      : await publishNotice({
          title: ntTitle.trim(),
          body: ntBody.trim(),
          category: ntCategory,
          audience: ntAudience,
          targetUnit: ntUnit,
          targetClass: ntClass,
          eventDate: ntEventDate,
          pinned: isAdmin ? ntPinned : false,
          requireAcknowledgement: ntRequireAck,
        })
    setNtSubmitting(false)
    if (res.ok) {
      setComposerOpen(false)
      setEditingNoticeId(null)
      setNtTitle('')
      setNtBody('')
    }
  }

  const openCreateUnitModal = () => {
    setEditingUnitId(null)
    setUName(`Unit - ${campusUnits.length + 1}`)
    setUCode(`U${campusUnits.length + 1}`)
    setUSubtitle('New DMHA Campus Wing')
    setUGrades('Pre-Play to Class 6')
    setUAddress('')
    setUHours('07:45 AM – 02:30 PM')
    setUGateStatus('Open')
    setUCoordinator('')
    setUPhone('+880 1711-')
    setUFacilities('Main Security Gate, QR Pickup Lane')
    setUNote('')
    setUAccent('violet')
    setUnitModalOpen(true)
  }

  const openEditUnitModal = (unit: CampusUnitRecord) => {
    setEditingUnitId(unit.id)
    setUName(unit.name)
    setUCode(unit.code)
    setUSubtitle(unit.subtitle)
    setUGrades(unit.gradesCovered)
    setUAddress(unit.address)
    setUHours(unit.gateHours)
    setUGateStatus(unit.gateStatus)
    setUCoordinator(unit.coordinatorName)
    setUPhone(unit.coordinatorPhone)
    setUFacilities((unit.facilities || []).join(', '))
    setUNote(unit.statusNote || '')
    setUAccent(unit.accent)
    setUnitModalOpen(true)
  }

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uName.trim()) {
      notify('Unit name is required')
      return
    }
    setUSubmitting(true)
    const res = await saveCampusUnit({
      id: editingUnitId || undefined,
      name: uName.trim(),
      code: uCode.trim() || undefined,
      subtitle: uSubtitle.trim(),
      gradesCovered: uGrades.trim(),
      address: uAddress.trim(),
      gateHours: uHours.trim() || '07:45 AM – 02:30 PM',
      gateStatus: uGateStatus,
      coordinatorName: uCoordinator.trim(),
      coordinatorPhone: uPhone.trim(),
      facilities: uFacilities
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      statusNote: uNote.trim(),
      accent: uAccent,
    })
    setUSubmitting(false)
    if (res.ok) {
      setUnitModalOpen(false)
      setEditingUnitId(null)
    }
  }

  const openTransferModal = () => {
    const otherUnit = campusUnits.find((u) => u.name !== childUnitName)
    setTransferToUnit(otherUnit?.name || campusUnits[0]?.name || 'Unit - 2')
    setTransferReason('')
    setTransferModalOpen(true)
  }

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!child || !transferToUnit || !transferReason.trim()) {
      notify('Please select destination unit and provide a reason')
      return
    }
    setTransferSubmitting(true)
    const res = await requestUnitTransfer({
      studentId: child.id,
      toUnit: transferToUnit,
      reason: transferReason.trim(),
    })
    setTransferSubmitting(false)
    if (res.ok) {
      setTransferModalOpen(false)
      setTransferReason('')
    }
  }

  const exportReceiptsCsv = (nt: SchoolNotice) => {
    const rows = [
      ['Notice Title', 'Reader Name', 'Role', 'Acknowledged At'],
      ...(nt.acknowledgedBy || []).map((r) => [nt.title, r.name, r.role, r.acknowledgedAt]),
    ]
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DMHA-Notice-Receipts-${nt.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
    notify('Downloaded notice read receipts CSV')
  }

  const filteredBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase()
    return libraryBooks.filter((bk) => {
      if (!q) return true
      return (
        bk.title.toLowerCase().includes(q) ||
        bk.author.toLowerCase().includes(q) ||
        bk.subject.toLowerCase().includes(q) ||
        bk.isbn.toLowerCase().includes(q)
      )
    })
  }, [libraryBooks, bookSearch])

  const liveActiveNotice = activeNotice
    ? notices.find((n) => n.id === activeNotice.id) || activeNotice
    : null
  const liveReceiptsNotice = receiptsNotice
    ? notices.find((n) => n.id === receiptsNotice.id) || receiptsNotice
    : null
  const liveRosterUnit = rosterUnit
    ? campusUnits.find((u) => u.id === rosterUnit.id) || rosterUnit
    : null

  return (
    <PageShell
      eyebrow="DMHA Digital Campus · Real-Time Synced"
      title={role === 'teacher' || role === 'staff' ? 'School Notices & Campus Units' : 'Notices, Campus Units & Services'}
      subtitle="Official DMHA circulars with audience targeting & read receipts, live Unit - 1 / Unit - 2 gate operations, student unit transfers, library catalog, and CCA clubs."
      action={
        <div className="flex flex-wrap items-center gap-2">
          {canPublishNotice && activeTab === 'notices' && (
            <button
              onClick={() => (composerOpen ? setComposerOpen(false) : openCreateNotice())}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-400 shadow-sm transition hover:bg-slate-800"
            >
              <Icon name="send" size={14} />
              {composerOpen ? 'Close Composer' : '+ Publish Notice'}
            </button>
          )}
          {isAdmin && activeTab === 'units' && (
            <button
              onClick={openCreateUnitModal}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-400 shadow-sm transition hover:bg-slate-800"
            >
              <Icon name="plus" size={14} />
              + Add Campus Unit
            </button>
          )}
        </div>
      }
    >
      {isGuardian && <ChildSwitcherBar />}

      {/* Top Mode Switcher */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs">
        <button
          onClick={() => setActiveTab('notices')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'notices'
              ? 'bg-[#0f172a] text-emerald-400 shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="bell" size={15} />
          Official Notices ({visibleNotices.length})
          {unacknowledgedCount > 0 && (
            <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
              {unacknowledgedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('units')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'units'
              ? 'bg-[#0f172a] text-emerald-400 shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="bus" size={15} />
          Campus Units ({campusUnits.length})
          {isAdmin && pendingTransfers.length > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
              {pendingTransfers.length} req
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'library'
              ? 'bg-[#0f172a] text-emerald-400 shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="book" size={15} />
          Library ({libraryBooks.length})
        </button>

        <button
          onClick={() => setActiveTab('clubs')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'clubs'
              ? 'bg-[#0f172a] text-emerald-400 shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="award" size={15} />
          Clubs &amp; CCA ({campusClubs.length})
        </button>
      </div>

      {/* ============================================================
          TAB 1: OFFICIAL NOTICES & CIRCULARS
         ============================================================ */}
      {activeTab === 'notices' && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="dmhs-card rounded-2xl p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Visible Circulars
              </p>
              <p className="mt-1.5 text-2xl font-black text-slate-900">{visibleNotices.length}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                Synced across all DMHA devices
              </p>
            </div>
            <div className="dmhs-card rounded-2xl p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">
                Pinned Official Notices
              </p>
              <p className="mt-1.5 text-2xl font-black text-slate-900">{pinnedCount}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                Highlighted at top of board
              </p>
            </div>
            <div className="dmhs-card rounded-2xl p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                Needs Your Acknowledgement
              </p>
              <p className="mt-1.5 text-2xl font-black text-emerald-700">{unacknowledgedCount}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                1-click read receipt tracking
              </p>
            </div>
            <button
              onClick={() => setActiveTab('units')}
              className="dmhs-hero rounded-2xl p-4 text-left text-white transition hover:-translate-y-0.5"
            >
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                Active Campus Units →
              </p>
              <p className="mt-1.5 text-2xl font-black">
                {campusUnits.map((u) => u.code).join(' · ')}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-300">
                {isStudent || isGuardian
                  ? `${child?.name}: ${childUnitName} (${childUnitObj?.gateStatus || 'Open'})`
                  : `${campusUnits.length} live units · ${students.length} enrolled students`}
              </p>
            </button>
          </div>

          {/* Publish / Edit Notice Composer (Admin, Teacher, Notices Staff) */}
          {canPublishNotice && composerOpen && (
            <form
              onSubmit={handleNoticeSubmit}
              className="dmhs-card rounded-[24px] border-2 border-emerald-500/25 bg-white p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                    {editingNoticeId ? 'Edit Official Circular' : 'Broadcast New School Circular'}
                  </p>
                  <h3 className="text-base font-black text-slate-900">
                    {editingNoticeId
                      ? 'Update Notice & Sync Immediately'
                      : 'Publish Official Notice to DMHA Portal'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setComposerOpen(false)
                    setEditingNoticeId(null)
                  }}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="block text-[11px] font-extrabold text-slate-600">
                  Category
                  <select
                    value={ntCategory}
                    onChange={(e) => setNtCategory(e.target.value as SchoolNotice['category'])}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="academic">Academic</option>
                    <option value="event">Event</option>
                    <option value="urgent">Urgent Alert</option>
                    <option value="unit">Campus Unit</option>
                    <option value="transport">Gate &amp; Transport</option>
                  </select>
                </label>

                <label className="block text-[11px] font-extrabold text-slate-600">
                  Audience
                  <select
                    value={ntAudience}
                    onChange={(e) => setNtAudience(e.target.value as SchoolNotice['audience'])}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="All">All (School-Wide)</option>
                    <option value="Guardians">Guardians Only</option>
                    <option value="Students">Students Only</option>
                    <option value="Teachers">Teachers Only</option>
                    <option value="Staff">Staff Only</option>
                  </select>
                </label>

                <label className="block text-[11px] font-extrabold text-slate-600">
                  Target Campus Unit
                  <select
                    value={ntUnit}
                    onChange={(e) => setNtUnit(e.target.value)}
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

                <label className="block text-[11px] font-extrabold text-slate-600">
                  Target Class
                  <select
                    value={ntClass}
                    onChange={(e) => setNtClass(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                  >
                    {DMHS_CLASS_OPTIONS.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-[11px] font-extrabold text-slate-600">
                  Effective / Event Date
                  <input
                    type="date"
                    value={ntEventDate}
                    onChange={(e) => setNtEventDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                  />
                </label>
              </div>

              <div className="mt-3 grid gap-3">
                <label className="block text-[11px] font-extrabold text-slate-600">
                  Circular Headline *
                  <input
                    value={ntTitle}
                    onChange={(e) => setNtTitle(e.target.value)}
                    placeholder="e.g., Unit - 2 Science Lab Exhibition & Early Dismissal Schedule"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-emerald-500"
                    required
                  />
                </label>
                <label className="block text-[11px] font-extrabold text-slate-600">
                  Official Circular Details *
                  <textarea
                    rows={3}
                    value={ntBody}
                    onChange={(e) => setNtBody(e.target.value)}
                    placeholder="Write complete instructions, timings, campus gate guidelines, or exam requirements..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
                    required
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  {isAdmin && (
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={ntPinned}
                        onChange={(e) => setNtPinned(e.target.checked)}
                        className="size-4 rounded accent-emerald-600"
                      />
                      Pin to top of notice board
                    </label>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={ntRequireAck}
                      onChange={(e) => setNtRequireAck(e.target.checked)}
                      className="size-4 rounded accent-emerald-600"
                    />
                    Track Reader Acknowledgements (Read Receipts)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={ntSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-emerald-400 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  <Icon name="send" size={14} />
                  {ntSubmitting
                    ? 'Saving...'
                    : editingNoticeId
                      ? 'Save Notice Updates'
                      : 'Publish & Broadcast Notice'}
                </button>
              </div>
            </form>
          )}

          {/* Filter & Search Bar */}
          <div className="dmhs-card space-y-3 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px] flex-1">
                <input
                  value={noticeSearch}
                  onChange={(e) => setNoticeSearch(e.target.value)}
                  placeholder="Search circulars by title, keyword, author, or unit..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                />
              </div>

              {/* Unit Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {['All Units', ...campusUnits.map((u) => u.name)].map((unitName) => (
                  <button
                    key={unitName}
                    onClick={() => setNoticeUnitFilter(unitName)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold transition ${
                      noticeUnitFilter === unitName
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {unitName}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', 'urgent', 'academic', 'event', 'unit', 'transport'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setNoticeCatFilter(cat)}
                    className={`rounded-full px-3 py-1 text-[11px] font-extrabold capitalize transition ${
                      noticeCatFilter === cat
                        ? 'bg-[#0f172a] text-emerald-400'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'all' ? 'All Categories' : cat}
                  </button>
                ))}
              </div>

              <DateFilterBar
                value={noticeDateFilter}
                onChange={setNoticeDateFilter}
                label="Notice Date"
                allowAll
                allowFuture
                savedDates={savedNoticeDates}
              />
            </div>
          </div>

          {/* Notice Cards List */}
          <div className="space-y-3">
            {visibleNotices.length === 0 ? (
              <div className="dmhs-card rounded-[24px] p-10 text-center">
                <p className="text-sm font-black text-slate-800">No circulars match your current filters</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Clear the date, unit, or search filter to view all official DMHA notices.
                </p>
                {(noticeSearch || noticeCatFilter !== 'all' || noticeUnitFilter !== 'All Units' || noticeDateFilter) && (
                  <button
                    onClick={() => {
                      setNoticeSearch('')
                      setNoticeCatFilter('all')
                      setNoticeUnitFilter('All Units')
                      setNoticeDateFilter('')
                    }}
                    className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-xs font-extrabold text-emerald-400"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              visibleNotices.map((nt) => {
                const receipts = nt.acknowledgedBy || []
                const hasAck = receipts.some((r) => r.userId === currentUserId)
                const canModifyThis =
                  isAdmin || (canPublishNotice && Boolean(authUser?.id) && nt.authorId === authUser?.id)

                return (
                  <div
                    key={nt.id}
                    className={`dmhs-card rounded-[22px] p-5 transition ${
                      nt.pinned
                        ? 'border-2 border-amber-300/80 bg-amber-50/25'
                        : 'hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {nt.pinned && (
                          <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-950">
                            ★ Pinned
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${categoryBadgeClass(nt.category)}`}
                        >
                          {nt.category}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                          Audience: {nt.audience}
                        </span>
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                          {nt.targetUnit || 'All Units'}
                        </span>
                        {nt.targetClass && nt.targetClass !== 'All Classes' && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                            {nt.targetClass}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-400">
                        {nt.eventDate ? `Date: ${nt.eventDate} · ` : ''}
                        {nt.date}
                      </span>
                    </div>

                    <button
                      onClick={() => setActiveNotice(nt)}
                      className="mt-2.5 block w-full text-left"
                    >
                      <h4 className="text-base font-black text-slate-900 hover:text-emerald-700">
                        {nt.title}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{nt.body}</p>
                    </button>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <p className="text-[11px] font-bold text-slate-500">
                        Posted by <span className="text-slate-800">{nt.author}</span>
                        {nt.updatedAt ? ` · Edited ${nt.updatedAt}` : ''}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Acknowledge Button */}
                        <button
                          onClick={() => acknowledgeNotice(nt.id)}
                          disabled={hasAck}
                          className={`rounded-xl px-3 py-1.5 text-[11px] font-extrabold transition ${
                            hasAck
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {hasAck ? '✓ Acknowledged' : '✓ Acknowledge Circular'}
                        </button>

                        {/* Read Receipts Modal trigger for publishers */}
                        {canPublishNotice && (
                          <button
                            onClick={() => setReceiptsNotice(nt)}
                            className="rounded-xl bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-700 hover:bg-slate-200"
                          >
                            Read Receipts ({receipts.length})
                          </button>
                        )}

                        <button
                          onClick={() => setActiveNotice(nt)}
                          className="rounded-xl bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-700 hover:bg-slate-200"
                        >
                          Open / Print PDF
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => togglePinNotice(nt.id)}
                            className="rounded-xl bg-amber-50 px-3 py-1.5 text-[11px] font-extrabold text-amber-800 hover:bg-amber-100"
                          >
                            {nt.pinned ? 'Unpin' : 'Pin'}
                          </button>
                        )}

                        {canModifyThis && (
                          <>
                            <button
                              onClick={() => openEditNotice(nt)}
                              className="rounded-xl bg-sky-50 px-3 py-1.5 text-[11px] font-extrabold text-sky-700 hover:bg-sky-100"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteNotice(nt.id)}
                              className="rounded-xl bg-rose-50 px-3 py-1.5 text-[11px] font-extrabold text-rose-700 hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 2: CAMPUS UNITS (UNIT - 1, UNIT - 2 & LIVE MANAGEMENT)
         ============================================================ */}
      {activeTab === 'units' && (
        <div className="space-y-6">
          {/* Guardian / Student Assigned Unit Hero */}
          {(isGuardian || isStudent) && child && childUnitObj && (
            <div className="dmhs-hero rounded-[26px] p-6 text-white">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black uppercase text-slate-950">
                      Assigned Campus Unit · {child.name}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${gateStatusBadgeClass(childUnitObj.gateStatus)}`}
                    >
                      Gate: {childUnitObj.gateStatus}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-black">
                    {childUnitObj.name} — {childUnitObj.subtitle}
                  </h3>
                  <p className="mt-1 text-xs text-slate-300">
                    {childUnitObj.gradesCovered} · Gate Hours: {childUnitObj.gateHours}
                  </p>
                  <p className="mt-1.5 text-xs font-semibold text-emerald-300">
                    Coordinator: {childUnitObj.coordinatorName} ({childUnitObj.coordinatorPhone}) ·{' '}
                    {child.gateCheckIn
                      ? `Today Gate Check-In: ${child.gateCheckIn}`
                      : 'Awaiting Gate Scan Today'}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={openTransferModal}
                    className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-slate-950 shadow-sm transition hover:bg-emerald-300"
                  >
                    Request Campus Unit Transfer
                  </button>
                  <button
                    onClick={() => {
                      setNoticeUnitFilter(childUnitObj.name)
                      setActiveTab('notices')
                    }}
                    className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
                  >
                    View {childUnitObj.name} Circulars →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Transfer Requests Queue (Admin sees pending approvals; Guardian/Student see their requests) */}
          {pendingTransfers.length > 0 && (
            <section className="dmhs-card rounded-[24px] border-2 border-amber-300/70 bg-amber-50/30 p-5">
              <SectionTitle
                eyebrow={isAdmin ? 'Admin Action Required' : 'Campus Unit Transfer Status'}
                title={
                  isAdmin
                    ? `Pending Campus Unit Transfer Requests (${pendingTransfers.length})`
                    : 'Your Campus Unit Transfer Requests'
                }
              />
              <div className="space-y-3">
                {pendingTransfers.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-900">{req.studentName}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                          {req.classLabel}
                        </span>
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black text-indigo-700">
                          {req.fromUnit} → {req.toUnit}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            req.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'declined'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        Reason: &ldquo;{req.reason}&rdquo; · Requested by {req.requestedBy} ({req.requestedAt})
                      </p>
                      {req.reviewedBy && (
                        <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                          Reviewed by {req.reviewedBy} ({req.reviewedAt})
                          {req.reviewNote ? ` · ${req.reviewNote}` : ''}
                        </p>
                      )}
                    </div>

                    {isAdmin && req.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => reviewUnitTransfer(req.id, 'approved')}
                          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-emerald-700"
                        >
                          Approve &amp; Move Student
                        </button>
                        <button
                          onClick={() =>
                            reviewUnitTransfer(req.id, 'declined', 'Current unit allocation maintained.')
                          }
                          className="rounded-xl bg-rose-50 px-3.5 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Live Campus Units Grid */}
          <div className="grid gap-5 lg:grid-cols-2">
            {campusUnits.map((unit) => {
              const unitStudents = students.filter(
                (s) => (s.busRoute || 'Unit - 1') === unit.name,
              )
              const presentToday = unitStudents.filter(
                (s) => s.todayStatus === 'present' || s.todayStatus === 'late',
              ).length
              const unitNoticesCount = notices.filter(
                (n) => !n.targetUnit || n.targetUnit === 'All Units' || n.targetUnit === unit.name,
              ).length
              const isAssignedToActive = (isGuardian || isStudent) && childUnitName === unit.name

              return (
                <div
                  key={unit.id}
                  className={`dmhs-card rounded-[24px] p-6 ${
                    isAssignedToActive ? 'ring-2 ring-emerald-500/40' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#0f172a] px-3 py-1 text-[10px] font-black uppercase text-emerald-400">
                          {unit.code} · {unit.name}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${gateStatusBadgeClass(unit.gateStatus)}`}
                        >
                          {unit.gateStatus}
                        </span>
                        {isAssignedToActive && (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
                            Your Assigned Unit
                          </span>
                        )}
                      </div>
                      <h4 className="mt-2.5 text-lg font-black text-slate-900">
                        DMHA Campus · {unit.name}
                      </h4>
                      <p className="text-xs font-bold text-slate-500">{unit.subtitle}</p>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditUnitModal(unit)}
                          className="rounded-xl bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-700 hover:bg-slate-200"
                        >
                          Edit Unit
                        </button>
                        {campusUnits.length > 2 && unitStudents.length === 0 && (
                          <button
                            onClick={() => deleteCampusUnit(unit.id)}
                            className="rounded-xl bg-rose-50 px-3 py-1.5 text-[11px] font-extrabold text-rose-700 hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Live Headcount KPIs */}
                  <div className="mt-4 grid grid-cols-3 gap-2.5 rounded-2xl bg-slate-50 p-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">Students</p>
                      <p className="text-lg font-black text-slate-900">{unitStudents.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase text-emerald-600">
                        Present Today
                      </p>
                      <p className="text-lg font-black text-emerald-700">{presentToday}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase text-indigo-600">
                        Circulars
                      </p>
                      <p className="text-lg font-black text-indigo-700">{unitNoticesCount}</p>
                    </div>
                  </div>

                  {/* Unit Operational Info */}
                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    <p>
                      <span className="font-extrabold text-slate-800">Classes Covered:</span>{' '}
                      {unit.gradesCovered}
                    </p>
                    <p>
                      <span className="font-extrabold text-slate-800">Gate Hours:</span>{' '}
                      {unit.gateHours}
                    </p>
                    <p>
                      <span className="font-extrabold text-slate-800">Unit In-Charge:</span>{' '}
                      {unit.coordinatorName} ({unit.coordinatorPhone})
                    </p>
                    <p>
                      <span className="font-extrabold text-slate-800">Campus Location:</span>{' '}
                      {unit.address}
                    </p>
                    {unit.statusNote && (
                      <p className="rounded-xl bg-emerald-50/70 px-3 py-2 text-[11px] font-bold text-emerald-900">
                        Live Status Note: {unit.statusNote}
                      </p>
                    )}
                  </div>

                  {/* Facilities Chips */}
                  {unit.facilities && unit.facilities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {unit.facilities.map((fac) => (
                        <span
                          key={fac}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600"
                        >
                          {fac}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Admin / Gate Staff Live Gate Status Controls */}
                  {canManageGate && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Live Gate Status Switch (Broadcasts Alert)
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(['Open', 'Dismissal Active', 'Closed', 'Restricted'] as UnitGateStatus[]).map(
                          (st) => (
                            <button
                              key={st}
                              onClick={() => setCampusUnitGateStatus(unit.id, st)}
                              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition ${
                                unit.gateStatus === st
                                  ? 'bg-[#0f172a] text-emerald-400'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {st}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card Footer Actions */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    {(isAdmin || isTeacher || canManageGate) && (
                      <button
                        onClick={() => setRosterUnit(unit)}
                        className="rounded-xl bg-[#0f172a] px-3.5 py-2 text-xs font-extrabold text-emerald-400 hover:bg-slate-800"
                      >
                        {isAdmin ? `Manage Student Roster (${unitStudents.length})` : `View Student Roster (${unitStudents.length})`}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setNoticeUnitFilter(unit.name)
                        setActiveTab('notices')
                      }}
                      className="rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-200"
                    >
                      Unit Circulars ({unitNoticesCount}) →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 3: SCHOOL LIBRARY (PERSISTED IN SQLITE)
         ============================================================ */}
      {activeTab === 'library' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              value={bookSearch}
              onChange={(e) => setBookSearch(e.target.value)}
              placeholder="Search DMHA Library by title, author, subject, or ISBN..."
              className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
            />
            {canManageLibrary && (
              <button
                onClick={() => setAddBookOpen((v) => !v)}
                className="rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-extrabold text-emerald-400"
              >
                {addBookOpen ? 'Cancel' : '+ Add Book to Catalog'}
              </button>
            )}
          </div>

          {canManageLibrary && addBookOpen && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!bkTitle.trim() || !bkAuthor.trim()) return
                addLibraryBook({
                  title: bkTitle.trim(),
                  author: bkAuthor.trim(),
                  subject: bkSubject.trim() || 'General',
                  isbn: bkIsbn.trim() || `ISBN-${Date.now().toString().slice(-6)}`,
                  shelf: bkShelf.trim() || 'Rack A-1',
                })
                setBkTitle('')
                setBkAuthor('')
                setBkIsbn('')
                setAddBookOpen(false)
              }}
              className="dmhs-card grid gap-3 rounded-2xl p-5 sm:grid-cols-2 lg:grid-cols-5"
            >
              <input
                value={bkTitle}
                onChange={(e) => setBkTitle(e.target.value)}
                placeholder="Book title *"
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
              <input
                value={bkAuthor}
                onChange={(e) => setBkAuthor(e.target.value)}
                placeholder="Author *"
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
              <input
                value={bkSubject}
                onChange={(e) => setBkSubject(e.target.value)}
                placeholder="Subject (e.g., Physics)"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
              <input
                value={bkShelf}
                onChange={(e) => setBkShelf(e.target.value)}
                placeholder="Shelf (e.g., Rack B-2)"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white"
              >
                Save Book
              </button>
            </form>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {filteredBooks.map((bk) => {
              const isIssuedToChild = bk.status === 'issued' && bk.issuedToStudentId === child?.id
              const canReturn = isIssuedToChild || canManageLibrary
              return (
                <div
                  key={bk.id}
                  className="dmhs-card flex items-center justify-between gap-3 rounded-2xl p-5"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700">
                        {bk.subject}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {bk.shelf}
                      </span>
                    </div>
                    <h4 className="mt-2 text-sm font-black text-slate-900">{bk.title}</h4>
                    <p className="text-xs font-semibold text-slate-500">
                      {bk.author} ·{' '}
                      {bk.status === 'issued'
                        ? `Issued to ${bk.issuedToName || 'Student'} · Due ${bk.dueDate || 'Soon'}`
                        : 'Available On Shelf'}
                    </p>
                  </div>

                  {bk.status === 'available' ? (
                    <button
                      onClick={() => {
                        if (!child) return
                        const res = issueLibraryBook(bk.id, child.id)
                        if (!res.ok && res.error) notify(res.error)
                      }}
                      className="shrink-0 rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-400 hover:bg-slate-800"
                    >
                      Borrow Book
                    </button>
                  ) : canReturn ? (
                    <button
                      onClick={() => returnLibraryBook(bk.id, false)}
                      className="shrink-0 rounded-xl bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-200"
                    >
                      Return Book
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-xl bg-amber-50 px-3 py-1.5 text-[11px] font-extrabold text-amber-800">
                      Checked Out
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 4: SCHOOL CLUBS & CO-CURRICULAR (PERSISTED IN SQLITE)
         ============================================================ */}
      {activeTab === 'clubs' && (
        <div className="space-y-4">
          {(isAdmin || isTeacher) && (
            <div className="flex justify-end">
              <button
                onClick={() => setAddClubOpen((v) => !v)}
                className="rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-400"
              >
                {addClubOpen ? 'Cancel' : '+ Create CCA Club'}
              </button>
            </div>
          )}

          {(isAdmin || isTeacher) && addClubOpen && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!clName.trim() || !clSchedule.trim()) return
                const res = await addCampusClub({
                  name: clName.trim(),
                  schedule: clSchedule.trim(),
                  mentor: clMentor.trim() || undefined,
                  unitName: clUnit,
                  category: clCategory,
                })
                if (res.ok) {
                  setClName('')
                  setClSchedule('')
                  setAddClubOpen(false)
                }
              }}
              className="dmhs-card grid gap-3 rounded-2xl p-5 sm:grid-cols-2 lg:grid-cols-5"
            >
              <input
                value={clName}
                onChange={(e) => setClName(e.target.value)}
                placeholder="Club name *"
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
              <input
                value={clSchedule}
                onChange={(e) => setClSchedule(e.target.value)}
                placeholder="Schedule (e.g., Wed 2:30 PM) *"
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
              <input
                value={clMentor}
                onChange={(e) => setClMentor(e.target.value)}
                placeholder="Mentor name"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              />
              <select
                value={clUnit}
                onChange={(e) => setClUnit(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="All Units">All Units</option>
                {campusUnits.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white"
              >
                Create Club
              </button>
            </form>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {campusClubs.map((cl) => {
              const joined = child ? cl.memberIds.includes(child.id) : false
              return (
                <div
                  key={cl.id}
                  className="dmhs-card flex items-center justify-between gap-3 rounded-2xl p-5"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-[10px] font-extrabold text-cyan-800">
                        {cl.category}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                        {cl.unitName}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {cl.memberIds.length} member{cl.memberIds.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <h4 className="mt-1.5 text-sm font-black text-slate-900">{cl.name}</h4>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{cl.schedule}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                      Mentor: {cl.mentor}
                    </p>
                  </div>
                  {child && (
                    <button
                      onClick={() => toggleCampusClubMembership(cl.id, child.id)}
                      className={`shrink-0 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                        joined
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 hover:bg-emerald-100'
                          : 'bg-[#0f172a] text-white hover:bg-slate-800'
                      }`}
                    >
                      {joined ? 'Member ✓' : 'Join Club'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 1: FULL OFFICIAL CIRCULAR & PRINT PDF
         ============================================================ */}
      {liveActiveNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setActiveNotice(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">
                  DMHA Official Circular · {liveActiveNotice.category} ·{' '}
                  {liveActiveNotice.targetUnit || 'All Units'}
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">{liveActiveNotice.title}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {liveActiveNotice.eventDate ? `Date: ${liveActiveNotice.eventDate} · ` : ''}
                  {liveActiveNotice.date} · Audience: {liveActiveNotice.audience}
                  {liveActiveNotice.targetClass && liveActiveNotice.targetClass !== 'All Classes'
                    ? ` · ${liveActiveNotice.targetClass}`
                    : ''}
                </p>
              </div>
              <button
                onClick={() => setActiveNotice(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <p className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-700">
              {liveActiveNotice.body}
            </p>
            <div className="mt-5 rounded-2xl bg-slate-50 p-3.5 text-xs font-semibold text-slate-600">
              <p>
                Issued by: <span className="font-black text-slate-900">{liveActiveNotice.author}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Read Receipts: {(liveActiveNotice.acknowledgedBy || []).length} acknowledged · DMHA Smart Learning App
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {!(liveActiveNotice.acknowledgedBy || []).some((r) => r.userId === currentUserId) && (
                <button
                  onClick={() => acknowledgeNotice(liveActiveNotice.id)}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white"
                >
                  ✓ Acknowledge Circular
                </button>
              )}
              <button
                onClick={() => setActiveNotice(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-extrabold text-emerald-400"
              >
                Print Circular PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 2: NOTICE READ RECEIPTS ROSTER
         ============================================================ */}
      {liveReceiptsNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setReceiptsNotice(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                  Circular Read Receipts
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-900">{liveReceiptsNotice.title}</h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {(liveReceiptsNotice.acknowledgedBy || []).length} confirmed acknowledgement(s)
                </p>
              </div>
              <button
                onClick={() => setReceiptsNotice(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {(liveReceiptsNotice.acknowledgedBy || []).length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-semibold text-slate-500">
                  No acknowledgements recorded yet.
                </p>
              ) : (
                (liveReceiptsNotice.acknowledgedBy || []).map((r) => (
                  <div
                    key={r.userId}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-900">{r.name}</p>
                      <p className="text-[10px] font-bold uppercase text-slate-500">{r.role}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-800">
                      ✓ {r.acknowledgedAt}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => exportReceiptsCsv(liveReceiptsNotice)}
                className="rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-400"
              >
                Export Receipts CSV
              </button>
              <button
                onClick={() => setReceiptsNotice(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 3: CREATE / EDIT CAMPUS UNIT (ADMIN)
         ============================================================ */}
      {unitModalOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setUnitModalOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveUnit}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                  DMHA Campus Architecture
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-900">
                  {editingUnitId ? `Edit ${uName}` : 'Add New Campus Unit'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUnitModalOpen(false)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] font-extrabold text-slate-600">
                Unit Name *
                <input
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  required
                  placeholder="e.g., Unit - 1"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>
              <label className="block text-[11px] font-extrabold text-slate-600">
                Short Code
                <input
                  value={uCode}
                  onChange={(e) => setUCode(e.target.value)}
                  placeholder="e.g., U1"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>
              <label className="block text-[11px] font-extrabold text-slate-600">
                Wing Subtitle
                <input
                  value={uSubtitle}
                  onChange={(e) => setUSubtitle(e.target.value)}
                  placeholder="Early Years & Primary Wing"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>
              <label className="block text-[11px] font-extrabold text-slate-600">
                Gate Status
                <select
                  value={uGateStatus}
                  onChange={(e) => setUGateStatus(e.target.value as UnitGateStatus)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                >
                  <option value="Open">Open</option>
                  <option value="Dismissal Active">Dismissal Active</option>
                  <option value="Closed">Closed</option>
                  <option value="Restricted">Restricted</option>
                </select>
              </label>
              <label className="block text-[11px] font-extrabold text-slate-600">
                Grades Covered
                <input
                  value={uGrades}
                  onChange={(e) => setUGrades(e.target.value)}
                  placeholder="Pre-Play to Class 6"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>
              <label className="block text-[11px] font-extrabold text-slate-600">
                Gate Hours
                <input
                  value={uHours}
                  onChange={(e) => setUHours(e.target.value)}
                  placeholder="07:45 AM – 02:30 PM"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>
              <label className="block text-[11px] font-extrabold text-slate-600">
                Unit Coordinator / In-Charge
                <input
                  value={uCoordinator}
                  onChange={(e) => setUCoordinator(e.target.value)}
                  placeholder="Coordinator name"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>
              <label className="block text-[11px] font-extrabold text-slate-600">
                Gate Helpline Phone
                <input
                  value={uPhone}
                  onChange={(e) => setUPhone(e.target.value)}
                  placeholder="+880 1711-..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>
            </div>

            <div className="mt-3 space-y-3">
              <label className="block text-[11px] font-extrabold text-slate-600">
                Campus Address / Gate Location
                <input
                  value={uAddress}
                  onChange={(e) => setUAddress(e.target.value)}
                  placeholder="DMHA Campus Address"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>
              <label className="block text-[11px] font-extrabold text-slate-600">
                Facilities (comma-separated)
                <input
                  value={uFacilities}
                  onChange={(e) => setUFacilities(e.target.value)}
                  placeholder="Main Gate, Science Lab, Library, Infirmary"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>
              <label className="block text-[11px] font-extrabold text-slate-600">
                Live Status Banner Note
                <input
                  value={uNote}
                  onChange={(e) => setUNote(e.target.value)}
                  placeholder="Optional live advisory shown to parents and teachers..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnitModalOpen(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uSubmitting}
                className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-extrabold text-emerald-400"
              >
                {uSubmitting ? 'Saving...' : editingUnitId ? 'Save Unit Changes' : 'Create Campus Unit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================
          MODAL 4: UNIT STUDENT ROSTER & ADMIN REASSIGNMENT
         ============================================================ */}
      {liveRosterUnit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setRosterUnit(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                  {liveRosterUnit.name} · Live Student Roster
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-900">
                  Assigned Students ({students.filter((s) => (s.busRoute || 'Unit - 1') === liveRosterUnit.name).length})
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {isAdmin
                    ? 'Use the unit dropdown on any student to reassign them immediately across QR Gate Passes, Directory, and Guardian Portal.'
                    : 'Live campus unit roster and today’s gate check-in status.'}
                </p>
              </div>
              <button
                onClick={() => setRosterUnit(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {students.filter((s) => (s.busRoute || 'Unit - 1') === liveRosterUnit.name).length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-semibold text-slate-500">
                  No students are currently assigned to {liveRosterUnit.name}.
                </p>
              ) : (
                students
                  .filter((s) => (s.busRoute || 'Unit - 1') === liveRosterUnit.name)
                  .map((stu) => (
                    <div
                      key={stu.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-900">{stu.name}</p>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {stu.className} · {stu.section} · Roll #{stu.roll} · Guardian: {stu.guardianName}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                            stu.todayStatus === 'present'
                              ? 'bg-emerald-100 text-emerald-800'
                              : stu.todayStatus === 'late'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {stu.todayStatus}
                          {stu.gateCheckIn ? ` · ${stu.gateCheckIn}` : ''}
                        </span>

                        {isAdmin && (
                          <select
                            aria-label={`Reassign unit for ${stu.name}`}
                            value={stu.busRoute || 'Unit - 1'}
                            onChange={(e) => reassignStudentUnit(stu.id, e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none"
                          >
                            {campusUnits.map((u) => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 5: GUARDIAN / STUDENT REQUEST CAMPUS UNIT TRANSFER
         ============================================================ */}
      {transferModalOpen && child && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setTransferModalOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmitTransfer}
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                  Campus Unit Transfer Request
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-900">{child.name}</h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  Current Unit: {childUnitName} · Admin approval updates QR Gate Passes automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-[11px] font-extrabold text-slate-600">
                Destination Campus Unit
                <select
                  value={transferToUnit}
                  onChange={(e) => setTransferToUnit(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none"
                >
                  {campusUnits
                    .filter((u) => u.name !== childUnitName)
                    .map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} — {u.subtitle}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block text-[11px] font-extrabold text-slate-600">
                Reason for Unit Transfer *
                <textarea
                  rows={3}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g., Sibling attends Unit - 2, or easier afternoon QR pickup coordination..."
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={transferSubmitting}
                className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-extrabold text-emerald-400"
              >
                {transferSubmitting ? 'Submitting...' : 'Submit Transfer Request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
