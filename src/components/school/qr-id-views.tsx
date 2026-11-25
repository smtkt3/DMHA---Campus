'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChildSwitcherBar } from './guardian-views'
import { DateFilterBar, extractIsoDate, formatPrettyDate, matchesDateFilter } from './date-utils'
import { Icon } from './icons'
import { downloadQrPng, RealQrCode } from './real-qr'
import { useSchool } from './store'
import type { AuthAccountSummary, QRScanLog, TeacherRecord } from './types'
import { PageShell } from './ui'

function SmartQRMatrixSvg({ code, size = 132 }: { code: string; size?: number }) {
  return (
    <div className="rounded-xl bg-white p-1 shadow-inner">
      <RealQrCode value={code} size={size} label={`DMHA Smart ID QR ${code}`} />
    </div>
  )
}

const STUDENT_CHECKPOINTS: QRScanLog['checkpoint'][] = [
  'Main Gate Check-In',
  'Main Gate Check-Out',
  'Canteen Checkout',
  'Library Desk',
  'Bus Boarding',
]

const FACULTY_CHECKPOINTS: QRScanLog['checkpoint'][] = [
  'Main Gate Check-In',
  'Main Gate Check-Out',
  'Canteen Checkout',
  'Library Desk',
]

const CANTEEN_MENU_ITEMS = [
  { label: 'Chicken Sandwich & Juice', price: 120 },
  { label: 'Fresh Fruit Bowl & Milk', price: 90 },
  { label: 'Veg Pasta Box', price: 110 },
  { label: 'Whole-Wheat Muffin & Water', price: 65 },
  { label: 'Custom Amount', price: 50 },
]

function getTeacherCardCode(
  teacher: TeacherRecord,
  index: number,
  authAccounts: AuthAccountSummary[],
): string {
  const matchedAcc = authAccounts.find(
    (a) => a.role === 'teacher' && a.linkedEntityId === teacher.id,
  )
  if (matchedAcc?.loginCode) {
    return `DMHA-ID-${matchedAcc.loginCode.toUpperCase()}`
  }
  return `DMHA-ID-TCH-${String(index + 1).padStart(3, '0')}`
}

export function SmartQRIdCardsView() {
  const {
    role,
    students,
    teachers,
    authAccounts,
    selectedChildId,
    activeStudentId,
    activeTeacherId,
    canteenWallets,
    libraryBooks,
    qrScans,
    teacherAttendance,
    processServerQRScan,
    hasStaffPermission,
    notify,
  } = useSchool()

  const isCampusScanner =
    role === 'admin' || hasStaffPermission('gate_security') || hasStaffPermission('canteen_pos')
  const isTeacherSelf = role === 'teacher'

  const [holderKind, setHolderKind] = useState<'student' | 'teacher'>(
    role === 'teacher' ? 'teacher' : 'student',
  )
  const [selectedId, setSelectedId] = useState<string>(
    role === 'teacher'
      ? activeTeacherId
      : role === 'student'
        ? activeStudentId
        : selectedChildId,
  )
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [checkpoint, setCheckpoint] = useState<QRScanLog['checkpoint']>(
    role === 'teacher' ? 'Main Gate Check-In' : 'Canteen Checkout',
  )
  const [canteenItem, setCanteenItem] = useState(CANTEEN_MENU_ITEMS[0].label)
  const [canteenAmount, setCanteenAmount] = useState(CANTEEN_MENU_ITEMS[0].price)
  const availableBooks = libraryBooks.filter((b) => b.status === 'available')
  const [selectedBookId, setSelectedBookId] = useState(availableBooks[0]?.id || '')
  const [usbScanInput, setUsbScanInput] = useState('')
  const [usbScanFeedback, setUsbScanFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [scanDateFilter, setScanDateFilter] = useState<string>('ALL')
  const [scanningBusy, setScanningBusy] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStatus, setCameraStatus] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Keep holder & default checkpoint cleanly synchronized on role/account switches
  useEffect(() => {
    if (role === 'teacher') {
      setHolderKind('teacher')
      setSelectedId(activeTeacherId)
      setCheckpoint('Main Gate Check-In')
    } else if (role === 'student') {
      setHolderKind('student')
      setSelectedId(activeStudentId)
    } else if (role === 'guardian') {
      setHolderKind('student')
      setSelectedId(selectedChildId)
    }
    setUsbScanFeedback(null)
  }, [role, activeTeacherId, activeStudentId, selectedChildId])

  const effectiveKind: 'student' | 'teacher' = isCampusScanner
    ? holderKind
    : role === 'teacher'
      ? 'teacher'
      : 'student'

  // Ensure Faculty view never sits on Student-only 'Bus Boarding'
  useEffect(() => {
    if (effectiveKind === 'teacher' && checkpoint === 'Bus Boarding') {
      setCheckpoint('Main Gate Check-In')
    }
  }, [effectiveKind, checkpoint])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraOpen(false)
    setCameraStatus('')
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const teacherCodesById = useMemo(() => {
    const map = new Map<string, string>()
    teachers.forEach((t, idx) => {
      map.set(t.id, getTeacherCardCode(t, idx, authAccounts))
    })
    return map
  }, [teachers, authAccounts])

  const student =
    students.find(
      (s) => s.id === (isCampusScanner ? selectedId : role === 'student' ? activeStudentId : selectedChildId),
    ) || students[0]

  const teacher =
    teachers.find((t) => t.id === (isCampusScanner ? selectedId : activeTeacherId)) || teachers[0]

  const todayIso = new Date().toISOString().slice(0, 10)
  const todayTeacherAtt = useMemo(() => {
    if (!teacher) return null
    return (
      teacherAttendance.find(
        (a) => a.teacherId === teacher.id && (a.date === todayIso || a.date.startsWith('Today')),
      ) ||
      teacherAttendance.find((a) => a.teacherId === teacher.id) ||
      null
    )
  }, [teacherAttendance, teacher, todayIso])

  const activeCard =
    effectiveKind === 'student'
      ? {
          id: student.id,
          code: `DMHA-ID-STU-${student.roll}`,
          name: student.name,
          initials: student.initials,
          roleLabel: 'STUDENT SMART PASS',
          primaryMeta: `${student.className} · ${student.section} · Roll #${student.roll}`,
          houseOrDept: `${student.house || 'Emerald'} House`,
          badgeLabel: `Blood: ${student.bloodGroup}`,
          badgeStyle: 'bg-rose-500/20 text-rose-200',
          emergencyLabel: `${student.guardianName} (${student.guardianPhone})`,
          transportOrClasses: student.busRoute,
          accessOrAllergyTitle: 'Medical / Allergy Guard',
          accessOrAllergy:
            canteenWallets.find((w) => w.studentId === student.id)?.allergyGuard ||
            'No known allergies',
          footerServices: 'Gate · Canteen · Library · Bus',
          walletBalance: canteenWallets.find((w) => w.studentId === student.id)?.balance ?? 0,
          status: student.status || 'active',
        }
      : {
          id: teacher.id,
          code: teacherCodesById.get(teacher.id) || 'DMHA-ID-TCH-001',
          name: teacher.name,
          initials: teacher.initials,
          roleLabel: 'FACULTY SMART PASS',
          primaryMeta: `${teacher.subject} · ${teacher.department}`,
          houseOrDept: `${teacher.department} Dept.`,
          badgeLabel: teacher.status === 'suspended' ? 'Suspended' : 'Active Faculty ✓',
          badgeStyle:
            teacher.status === 'suspended'
              ? 'bg-rose-500/30 text-rose-200'
              : 'bg-emerald-500/25 text-emerald-200',
          emergencyLabel: `${teacher.phone} · ${teacher.email}`,
          transportOrClasses: teacher.assignedClasses.length
            ? `Assigned: ${teacher.assignedClasses.join(', ')}`
            : 'No assigned classes',
          accessOrAllergyTitle: 'Campus Access Clearance',
          accessOrAllergy: 'Main Gate · Staff Lab · Library · Cafeteria',
          footerServices: 'Gate HR · Lab · Library · Cafeteria',
          walletBalance: null,
          status: teacher.status,
        }

  const startMobileCameraScanner = async () => {
    setCameraOpen(true)
    setCameraStatus('Starting rear camera for QR scanning...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraStatus('Camera active — hold DMHA Student or Faculty QR ID Card inside the frame')
    } catch {
      setCameraStatus('Camera unavailable on this device — use USB Scanner or Quick Tap below.')
    }
  }

  const handleScanCode = async (rawCode: string) => {
    const raw = rawCode.trim().toUpperCase()
    if (!raw) return
    setScanningBusy(true)

    const matchedStudent = students.find(
      (s) =>
        `DMHA-ID-STU-${s.roll}`.toUpperCase() === raw ||
        s.roll.toUpperCase() === raw ||
        s.id.toUpperCase() === raw,
    )
    if (matchedStudent) {
      setHolderKind('student')
      setSelectedId(matchedStudent.id)
      const outcome = await processServerQRScan({
        cardCode: `DMHA-ID-STU-${matchedStudent.roll}`,
        holderId: matchedStudent.id,
        holderName: matchedStudent.name,
        holderRole: 'student',
        checkpoint,
        canteenItem: checkpoint === 'Canteen Checkout' ? canteenItem : undefined,
        canteenAmount: checkpoint === 'Canteen Checkout' ? canteenAmount : undefined,
        libraryBookId:
          checkpoint === 'Library Desk' ? selectedBookId || availableBooks[0]?.id : undefined,
      })
      setUsbScanFeedback({ ok: outcome.ok, msg: outcome.message })
      setUsbScanInput('')
      setScanningBusy(false)
      return
    }

    const matchedTeacher = teachers.find((t) => {
      const canonical = (teacherCodesById.get(t.id) || '').toUpperCase()
      const legacy = `DMHA-ID-TCH-${t.id.slice(-3).toUpperCase()}`
      const loginCode = canonical.replace('DMHA-ID-', '')
      return (
        canonical === raw ||
        loginCode === raw ||
        legacy === raw ||
        t.id.toUpperCase() === raw ||
        t.email.toUpperCase() === raw
      )
    })

    if (matchedTeacher) {
      const canonicalCode = teacherCodesById.get(matchedTeacher.id) || 'DMHA-ID-TCH-001'
      setHolderKind('teacher')
      setSelectedId(matchedTeacher.id)
      const safeCheckpoint: QRScanLog['checkpoint'] =
        checkpoint === 'Bus Boarding' ? 'Main Gate Check-In' : checkpoint
      const outcome = await processServerQRScan({
        cardCode: canonicalCode,
        holderId: matchedTeacher.id,
        holderName: matchedTeacher.name,
        holderRole: 'teacher',
        checkpoint: safeCheckpoint,
        canteenItem: safeCheckpoint === 'Canteen Checkout' ? 'Faculty Cafeteria Meal' : undefined,
      })
      setUsbScanFeedback({ ok: outcome.ok, msg: outcome.message })
      setUsbScanInput('')
      setScanningBusy(false)
      return
    }

    setUsbScanFeedback({
      ok: false,
      msg: `No DMHA ID found matching "${raw}". Try DMHA-ID-TCH-001 or DMHA-ID-STU-14.`,
    })
    setScanningBusy(false)
  }

  const handleUsbHardwareScan = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleScanCode(usbScanInput)
  }

  const handleProcessActiveCard = async (overrideCheckpoint?: QRScanLog['checkpoint']) => {
    const cp = overrideCheckpoint || checkpoint
    setScanningBusy(true)
    const outcome = await processServerQRScan({
      cardCode: activeCard.code,
      holderId: activeCard.id,
      holderName: activeCard.name,
      holderRole: effectiveKind,
      checkpoint: cp,
      canteenItem:
        cp === 'Canteen Checkout'
          ? effectiveKind === 'teacher'
            ? 'Faculty Cafeteria Meal'
            : canteenItem
          : undefined,
      canteenAmount:
        cp === 'Canteen Checkout' && effectiveKind === 'student' ? canteenAmount : undefined,
      libraryBookId:
        cp === 'Library Desk' && effectiveKind === 'student'
          ? selectedBookId || availableBooks[0]?.id
          : undefined,
    })
    setUsbScanFeedback({ ok: outcome.ok, msg: outcome.message })
    setScanningBusy(false)
  }

  const handleDownloadQrPng = () => {
    void downloadQrPng(
      activeCard.code,
      `DMHA-SmartID-${activeCard.name.replace(/\s+/g, '-')}-${activeCard.code}.png`,
    )
    notify(`Downloaded high-res scannable QR PNG (${activeCard.code})`)
  }

  const handleCopyCardCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(activeCard.code)
      notify(`Copied QR ID Code: ${activeCard.code}`)
    }
  }

  // Strictly scope scan logs: Campus Scanners see all; Teachers/Students/Guardians see only their card
  const cardScans = isCampusScanner
    ? qrScans
    : qrScans.filter((s) => s.holderId === activeCard.id)

  const checkpointsToDisplay =
    effectiveKind === 'teacher' ? FACULTY_CHECKPOINTS : STUDENT_CHECKPOINTS

  return (
    <PageShell
      eyebrow={
        effectiveKind === 'teacher'
          ? 'Official Faculty Identity · Digital & Printable Pass'
          : 'Unified Campus Identity · Digital & Printable'
      }
      title={effectiveKind === 'teacher' && isTeacherSelf ? 'My Faculty QR ID Card' : 'Smart QR ID Cards'}
      subtitle={
        effectiveKind === 'teacher'
          ? 'Official DMHA scannable Faculty ID Pass synced live with Gate HR Attendance, Staff Library, Lab Access, and Cafeteria.'
          : 'Official DMHA scannable ID pass powering Main Gate Attendance, Cashless Canteen Checkout, Library Issue, and School Bus Boarding.'
      }
      action={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyCardCode}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 font-mono text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            {activeCard.code}
          </button>
          <button
            type="button"
            onClick={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Flip to {side === 'front' ? 'Back Side' : 'Front Side'}
          </button>
          <button
            type="button"
            onClick={handleDownloadQrPng}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100"
          >
            <Icon name="download" size={14} />
            Download QR PNG
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-white hover:bg-slate-800"
          >
            <Icon name="print" size={15} />
            Print ID Card
          </button>
        </div>
      }
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      {/* Admin / Gate Security / Canteen Directory Card Picker */}
      {isCampusScanner && (
        <div className="dmhs-card mb-6 flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setHolderKind('student')
                setSelectedId(students[0]?.id || '')
                setCheckpoint('Main Gate Check-In')
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-extrabold ${
                holderKind === 'student'
                  ? 'bg-[#0f172a] text-emerald-300'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              Student IDs ({students.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setHolderKind('teacher')
                setSelectedId(teachers[0]?.id || '')
                setCheckpoint('Main Gate Check-In')
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-extrabold ${
                holderKind === 'teacher'
                  ? 'bg-[#0f172a] text-emerald-300'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              Faculty IDs ({teachers.length})
            </button>
          </div>

          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 outline-none"
          >
            {holderKind === 'student'
              ? students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.className} (Roll #{s.roll})
                  </option>
                ))
              : teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({teacherCodesById.get(t.id)}) — {t.subject}
                  </option>
                ))}
          </select>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        {/* Luxury Smart ID Card Preview */}
        <div className="flex flex-col items-center">
          {side === 'front' ? (
            <div className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0f172a] via-[#13223b] to-[#0a1426] p-6 text-white shadow-2xl ring-1 ring-white/10">
              <div className="pointer-events-none absolute -right-14 -top-14 size-44 rounded-full bg-emerald-400/20 blur-2xl" />

              {/* Top Brand Row */}
              <div className="relative flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-400 text-sm font-black text-slate-950">
                    D
                  </div>
                  <div>
                    <p className="text-sm font-black tracking-tight">DMHA</p>
                    <p className="text-[9px] font-bold uppercase tracking-[.16em] text-emerald-300">
                      Smart Learning App
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                  {activeCard.roleLabel}
                </span>
              </div>

              {/* Identity & QR Row */}
              <div className="relative mt-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-300 text-xl font-black text-slate-950 shadow-lg">
                    {activeCard.initials}
                  </div>
                  <h3 className="mt-3 truncate text-xl font-black tracking-tight text-white">
                    {activeCard.name}
                  </h3>
                  <p className="mt-0.5 text-xs font-semibold text-slate-300">
                    {activeCard.primaryMeta}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-lg bg-white/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                      {activeCard.houseOrDept}
                    </span>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${activeCard.badgeStyle}`}
                    >
                      {activeCard.badgeLabel}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-center">
                  <SmartQRMatrixSvg code={activeCard.code} size={124} />
                  <p className="mt-1.5 font-mono text-[10px] font-bold tracking-wider text-emerald-300">
                    {activeCard.code}
                  </p>
                </div>
              </div>

              {/* Footer Strip */}
              <div className="relative mt-5 flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-2.5 text-[10px] font-bold text-slate-300">
                <span>Valid Thru: Dec 2026</span>
                <span className="text-emerald-300">{activeCard.footerServices}</span>
              </div>
            </div>
          ) : (
            /* Back of Card */
            <div className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
              <div className="h-9 -mx-6 -mt-6 bg-[#0f172a]" />

              <div className="mt-5 space-y-3 text-xs">
                <div className="rounded-2xl bg-slate-50 p-3.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {effectiveKind === 'student' ? 'Emergency Contact' : 'Official Faculty Contact'}
                  </p>
                  <p className="mt-1 font-bold text-slate-900">{activeCard.emergencyLabel}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {effectiveKind === 'student' ? 'Campus Unit' : 'Assigned Classes'}
                  </p>
                  <p className="mt-1 font-bold text-slate-900">{activeCard.transportOrClasses}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-emerald-50 p-3">
                    <p className="text-[10px] font-extrabold uppercase text-emerald-700">
                      {activeCard.accessOrAllergyTitle}
                    </p>
                    <p className="mt-1 font-bold text-slate-800">{activeCard.accessOrAllergy}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400">
                      Authorized By
                    </p>
                    <p className="mt-1 font-serif text-sm italic font-bold text-slate-900">
                      Shahid
                    </p>
                    <p className="text-[9px] font-bold text-slate-400">Principal · DMHA</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-dashed border-slate-200 pt-3 text-center">
                <p className="font-mono text-xs font-extrabold tracking-[.22em] text-slate-700">
                  * {activeCard.code} *
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  If found, please return to DMHA Campus Security Desk.
                </p>
              </div>
            </div>
          )}

          {/* ==================== CARD ACTION PANEL BY ROLE ==================== */}
          {isTeacherSelf ? (
            /* Dedicated Faculty Smart Pass Self-Tap & HR Sync Panel */
            <div className="dmhs-card mt-5 w-full max-w-[420px] p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                  Faculty Smart Pass · Live Gate &amp; Campus Tap
                </p>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[9px] font-black text-emerald-800">
                  ISO QR VALID ✓
                </span>
              </div>

              {/* Today's Faculty HR Sync Status */}
              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400">
                    Today’s Gate / HR Attendance
                  </p>
                  <p className="mt-0.5 font-black text-slate-900">
                    {todayTeacherAtt?.status === 'checked_out'
                      ? `Checked Out · ${todayTeacherAtt.checkOutTime} (${todayTeacherAtt.hoursWorked || 'Logged'})`
                      : todayTeacherAtt?.checkInTime
                        ? `Checked In · ${todayTeacherAtt.checkInTime} (${todayTeacherAtt.status === 'late' ? 'Late' : 'On Time'})`
                        : 'Not Checked In Yet'}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                    todayTeacherAtt?.status === 'checked_in'
                      ? 'bg-emerald-100 text-emerald-800'
                      : todayTeacherAtt?.status === 'checked_out'
                        ? 'bg-sky-100 text-sky-800'
                        : todayTeacherAtt?.status === 'late'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {todayTeacherAtt?.status?.replace('_', ' ') || 'Pending'}
                </span>
              </div>

              <div className="mt-3.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={scanningBusy}
                  onClick={() => void handleProcessActiveCard('Main Gate Check-In')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Icon name="qr" size={14} />
                  Gate Check-In
                </button>
                <button
                  type="button"
                  disabled={scanningBusy}
                  onClick={() => void handleProcessActiveCard('Main Gate Check-Out')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#0f172a] px-3 py-2.5 text-xs font-black text-emerald-300 shadow-xs transition hover:bg-slate-800 disabled:opacity-50"
                >
                  <Icon name="clock" size={14} />
                  Gate Check-Out
                </button>
                <button
                  type="button"
                  disabled={scanningBusy}
                  onClick={() => void handleProcessActiveCard('Canteen Checkout')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cafeteria Tap
                </button>
                <button
                  type="button"
                  disabled={scanningBusy}
                  onClick={() => void handleProcessActiveCard('Library Desk')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Library Desk Tap
                </button>
              </div>

              {usbScanFeedback && (
                <p
                  className={`mt-3 rounded-xl px-3 py-2 text-[11px] font-bold ${
                    usbScanFeedback.ok
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {usbScanFeedback.msg}
                </p>
              )}

              <button
                type="button"
                onClick={handleDownloadQrPng}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
              >
                <Icon name="download" size={15} />
                Download High-Res Faculty QR PNG (For Lanyard)
              </button>
            </div>
          ) : isCampusScanner ? (
            /* Admin / Gate Security / Canteen Staff POS & USB/Camera Hardware QR Scanner */
            <div className="dmhs-card mt-5 w-full max-w-[420px] p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600">
                  Campus POS &amp; USB QR Scanner
                </p>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                  Student + Faculty Ready
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Scan any Student or Faculty QR ID card for Gate Attendance, Cafeteria/Canteen,
                Library Desk, or Bus Boarding.
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {checkpointsToDisplay.map((cp) => (
                  <button
                    key={cp}
                    type="button"
                    onClick={() => {
                      setCheckpoint(cp)
                      setUsbScanFeedback(null)
                    }}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                      checkpoint === cp
                        ? 'bg-[#0f172a] text-emerald-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cp === 'Canteen Checkout' && effectiveKind === 'teacher'
                      ? 'Faculty Cafeteria'
                      : cp}
                  </button>
                ))}
              </div>

              {/* Student-Only Canteen Wallet Deduction Controls */}
              {checkpoint === 'Canteen Checkout' && effectiveKind === 'student' && (
                <div className="mt-3 space-y-2 rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                    Canteen Purchase (Auto-Deducts from Top-Up Wallet)
                  </p>
                  <select
                    value={canteenItem}
                    onChange={(e) => {
                      const chosen = CANTEEN_MENU_ITEMS.find((i) => i.label === e.target.value)
                      setCanteenItem(e.target.value)
                      if (chosen) setCanteenAmount(chosen.price)
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    {CANTEEN_MENU_ITEMS.map((item) => (
                      <option key={item.label} value={item.label}>
                        {item.label} — ৳{item.price}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600">Charge (৳):</span>
                    <input
                      type="number"
                      min={1}
                      value={canteenAmount}
                      onChange={(e) => setCanteenAmount(Math.max(1, Number(e.target.value) || 0))}
                      className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-900"
                    />
                  </div>
                </div>
              )}

              {/* Student-Only Library Book Issue Picker */}
              {checkpoint === 'Library Desk' && effectiveKind === 'student' && (
                <div className="mt-3 space-y-2 rounded-2xl border border-sky-200/70 bg-sky-50/50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-sky-800">
                    Select Book to Issue via Student QR
                  </p>
                  <select
                    value={selectedBookId || availableBooks[0]?.id || ''}
                    onChange={(e) => setSelectedBookId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    {availableBooks.length === 0 ? (
                      <option value="">No available books in library</option>
                    ) : (
                      availableBooks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} ({b.shelf})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <form onSubmit={(e) => void handleUsbHardwareScan(e)} className="mt-3.5 flex gap-2">
                <input
                  value={usbScanInput}
                  onChange={(e) => setUsbScanInput(e.target.value)}
                  placeholder="Scan or type DMHA-ID-TCH-001 or DMHA-ID-STU-14"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={scanningBusy}
                  className="shrink-0 rounded-xl bg-[#0f172a] px-3.5 py-2 text-xs font-extrabold text-emerald-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Scan
                </button>
              </form>

              {usbScanFeedback && (
                <p
                  className={`mt-2.5 rounded-xl px-3 py-2 text-[11px] font-bold ${
                    usbScanFeedback.ok
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {usbScanFeedback.msg}
                </p>
              )}

              <button
                type="button"
                disabled={scanningBusy}
                onClick={() => void handleProcessActiveCard()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                <Icon name="qr" size={16} />
                {scanningBusy
                  ? 'Verifying on SQLite Server…'
                  : checkpoint === 'Canteen Checkout' && effectiveKind === 'student'
                    ? `Charge ৳${canteenAmount} to ${activeCard.name.split(' ')[0]}’s Wallet`
                    : checkpoint === 'Canteen Checkout' && effectiveKind === 'teacher'
                      ? `Verify Faculty Cafeteria Pass for ${activeCard.name.split(' ')[0]}`
                      : `Process ${checkpoint} for ${activeCard.name.split(' ')[0]}`}
              </button>

              <button
                type="button"
                onClick={() => (cameraOpen ? stopCamera() : void startMobileCameraScanner())}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50"
              >
                <Icon name="video" size={15} className="text-emerald-600" />
                {cameraOpen
                  ? 'Close Phone Camera Scanner'
                  : 'Open Phone Camera QR Scanner (Live SSE)'}
              </button>

              {cameraOpen && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-emerald-200 bg-[#0f172a] p-3 text-white">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="h-44 w-full rounded-xl bg-black object-cover"
                  />
                  <p className="mt-2 text-center text-[11px] font-semibold text-emerald-300">
                    {cameraStatus}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Guardian / Student Card Actions */
            <div className="dmhs-card mt-5 w-full max-w-[420px] p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                  Official Scannable Student Card
                </p>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[9px] font-black text-emerald-800">
                  ISO QR VALID ✓
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Print or laminate this QR ID card. Campus staff scan it for{' '}
                <strong>Gate Check-In/Out</strong>, <strong>Canteen Wallet Deductions</strong>,{' '}
                <strong>Library Book Borrowing</strong>, and <strong>Bus Boarding</strong>.
              </p>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
                <span className="font-bold text-slate-500">Linked Canteen Top-Up Balance</span>
                <span className="text-sm font-black text-emerald-700">
                  ৳{(activeCard.walletBalance ?? 0).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownloadQrPng}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f172a] py-3 text-xs font-extrabold text-emerald-300 transition hover:bg-slate-800"
              >
                <Icon name="download" size={15} />
                Download High-Res Card QR PNG (For Printing)
              </button>
            </div>
          )}
        </div>

        {/* Live Scan Activity Feed & Card Privileges */}
        <div className="space-y-5">
          <div className="dmhs-card p-6">
            <h3 className="text-base font-black text-slate-900">
              {effectiveKind === 'teacher' ? 'Faculty Smart Pass Privileges' : 'Smart Pass Capabilities'}
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(effectiveKind === 'teacher'
                ? [
                    {
                      title: 'Main Gate & HR Attendance Sync',
                      desc: 'Tapping your Faculty QR at Main Gate logs Check-In/Out and computes daily hours worked in HR.',
                      badge: 'Live HR Sync',
                    },
                    {
                      title: 'Faculty Cafeteria Pass',
                      desc: 'Quick-tap staff cafeteria verification without needing cash or a student top-up wallet.',
                      badge: 'Staff Pass',
                    },
                    {
                      title: 'Library & Science Lab Access',
                      desc: 'Instant verification at DMHA Library Desk, Science Labs, and Faculty Resource Rooms.',
                      badge: 'Authorized',
                    },
                    {
                      title: 'Assigned-Class Verification',
                      desc: activeCard.transportOrClasses,
                      badge: 'Active',
                    },
                  ]
                : [
                    {
                      title: 'Instant Gate Attendance',
                      desc: 'Scanning at Main Gate automatically marks student Present & alerts Guardian.',
                      badge: 'Active',
                    },
                    {
                      title: 'Cashless Canteen Wallet',
                      desc: `Linked Balance: ৳${(activeCard.walletBalance ?? 0).toLocaleString()} · Allergy Guard ON`,
                      badge: 'Linked',
                    },
                    {
                      title: 'Library Book Checkout',
                      desc: 'Tap QR at Library Desk for 14-day instant book issue & due alerts.',
                      badge: 'Active',
                    },
                    {
                      title: 'Safe Bus Boarding',
                      desc: 'Driver scans QR on boarding & drop-off for live parent GPS updates.',
                      badge: 'Active',
                    },
                  ]
              ).map((cap) => (
                <div key={cap.title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-slate-900">{cap.title}</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                      {cap.badge}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{cap.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="dmhs-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-black text-slate-900">
                QR Checkpoint Scans (SQLite Live Log)
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                {cardScans.filter((s) => matchesDateFilter(s.scannedAt, scanDateFilter)).length}{' '}
                {scanDateFilter === 'ALL' ? 'total records' : `on ${formatPrettyDate(scanDateFilter)}`}
              </span>
            </div>

            <div className="mt-3">
              <DateFilterBar
                value={scanDateFilter}
                onChange={setScanDateFilter}
                allowAll
                compact
                label="Scan Date"
                savedDates={Array.from(
                  new Set(
                    cardScans
                      .map((s) => extractIsoDate(s.scannedAt))
                      .filter((d): d is string => Boolean(d)),
                  ),
                ).sort((a, b) => (a < b ? 1 : -1))}
              />
            </div>

            {(() => {
              const dateFilteredScans = cardScans.filter((s) =>
                matchesDateFilter(s.scannedAt, scanDateFilter),
              )
              return (
                <div className="mt-4 space-y-2.5">
                  {dateFilteredScans.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-xs font-semibold text-slate-400">
                      {scanDateFilter === 'ALL'
                        ? 'No QR checkpoint scans recorded yet for this card. Tap Gate Check-In to log a verified scan.'
                        : `No QR checkpoint scans recorded on ${formatPrettyDate(scanDateFilter)}.`}
                    </div>
                  ) : (
                    (scanDateFilter === 'ALL'
                      ? dateFilteredScans.slice(0, 12)
                      : dateFilteredScans
                    ).map((scan) => (
                      <div
                        key={scan.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                            <Icon name="qr" size={16} />
                          </span>
                          <div>
                            <p className="text-xs font-extrabold text-slate-900">
                              {scan.holderName}{' '}
                              <span className="font-mono text-[10px] text-slate-400">
                                ({scan.cardCode})
                              </span>
                            </p>
                            <p className="text-[11px] font-semibold text-slate-600">
                              {scan.checkpoint}
                            </p>
                            {scan.details && (
                              <p className="mt-0.5 text-[10px] font-bold text-emerald-700">
                                {scan.details}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                              scan.status === 'flagged'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {scan.status}
                          </span>
                          <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                            {scan.scannedAt}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
