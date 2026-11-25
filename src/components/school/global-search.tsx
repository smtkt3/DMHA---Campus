'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, type IconName } from './icons'
import { useSchool } from './store'

interface SearchResultItem {
  id: string
  category: string
  title: string
  subtitle: string
  icon: IconName
  action: () => void
}

export function GlobalSearchModal({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean
  onClose: () => void
  onNavigate: (tab: string) => void
}) {
  const {
    role,
    students,
    teachers,
    guardians,
    activeGuardianId,
    activeTeacherId,
    activeStudentId,
    selectedChildId,
    hasStaffPermission,
    quizzes,
    admissions,
    examSheets,
    fees,
    notices,
    classMoments,
    familyChildMode,
    setSelectedChildId,
  } = useSchool()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      window.setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  const allItems = useMemo<SearchResultItem[]>(() => {
    const items: SearchResultItem[] = []
    const isAdmin = role === 'admin'
    const isStaff = role === 'admin' || role === 'teacher'
    const isCustomStaff = role === 'staff'
    const activeGuardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]

    // Dedicated strict search index for Custom Staff roles (only their granted modules!)
    if (isCustomStaff) {
      if (hasStaffPermission('accounts')) {
        items.push({ id: 'nav-accounts', category: 'My Workspace', title: 'Accounts & Finance Ledger', subtitle: 'Fees, campus expenses & P&L balance', icon: 'payment', action: () => onNavigate('accounts') })
        fees.forEach((f) => {
          items.push({ id: `fee-${f.id}`, category: 'Fees & Invoices', title: f.title, subtitle: `${f.studentName} · ৳${f.amount.toLocaleString()} · ${f.status.toUpperCase()}`, icon: 'payment', action: () => onNavigate('accounts') })
        })
      }
      if (hasStaffPermission('payroll')) {
        items.push({ id: 'nav-payroll', category: 'My Workspace', title: 'Faculty Finance & Payroll', subtitle: 'Salaries, reimbursements, advances & allowances', icon: 'payment', action: () => onNavigate('facultyfinance') })
      }
      if (hasStaffPermission('payment_ledger')) {
        items.push({ id: 'nav-ledger', category: 'My Workspace', title: 'Payment Reconciliation Ledger', subtitle: 'Verified SQLite payment records', icon: 'shield', action: () => onNavigate('security') })
      }
      if (hasStaffPermission('canteen_pos')) {
        items.push({ id: 'nav-canteen', category: 'My Workspace', title: 'Canteen POS & Live Food Menu', subtitle: 'Scan Student QR wallet & manage food items', icon: 'clipboard', action: () => onNavigate('canteenops') })
      }
      if (hasStaffPermission('gate_security')) {
        items.push({ id: 'nav-safety', category: 'My Workspace', title: 'Pickup QR & Gate Security', subtitle: 'Verify HMAC-signed pickup passes & dismissal logs', icon: 'shield', action: () => onNavigate('safety') })
        items.push({ id: 'nav-qrid', category: 'My Workspace', title: 'Student Gate QR Scanner', subtitle: 'Main Gate Check-In & Check-Out QR POS', icon: 'qr', action: () => onNavigate('qrid') })
      }
      if (hasStaffPermission('library')) {
        items.push({ id: 'nav-library', category: 'My Workspace', title: 'Smart Library Manager', subtitle: 'Issue & return books via Student QR ID', icon: 'book', action: () => onNavigate('library') })
      }
      if (hasStaffPermission('admissions')) {
        items.push({ id: 'nav-adm', category: 'My Workspace', title: 'Admissions Pipeline CRM', subtitle: 'Review 2027 applicants', icon: 'userplus', action: () => onNavigate('admissions') })
      }
      if (hasStaffPermission('documents')) {
        items.push({ id: 'nav-docs', category: 'My Workspace', title: 'Report Cards & Admit Cards', subtitle: 'Verify & print official QR documents', icon: 'print', action: () => onNavigate('documents') })
      }
      if (hasStaffPermission('timetable')) {
        items.push({ id: 'nav-schedule', category: 'My Workspace', title: 'Timetable & Exam Management Suite', subtitle: 'Master routine, exam declare, marks, admit cards & seat plan', icon: 'calendar', action: () => onNavigate('schedule') })
        items.push({ id: 'nav-exam-declare', category: 'My Workspace', title: 'Exam Declare & Schedule', subtitle: 'Declare term exams, lock marks & publish results', icon: 'exam', action: () => onNavigate('schedule:declare') })
        items.push({ id: 'nav-exam-seatplan', category: 'My Workspace', title: 'Exam Seat Plan & Hall Attendance', subtitle: 'Auto seat plan with anti-cheating interleaving & hall door sheets', icon: 'calendar', action: () => onNavigate('schedule:seatplan') })
        items.push({ id: 'nav-exam-admit', category: 'My Workspace', title: 'Exam Admit Cards (Bulk A4)', subtitle: 'Generate individual or bulk exam admit cards', icon: 'print', action: () => onNavigate('schedule:admit') })
      }
      if (hasStaffPermission('notices')) {
        notices.forEach((n) => {
          items.push({ id: `not-${n.id}`, category: 'Notices', title: n.title, subtitle: `${n.category.toUpperCase()} · ${n.date}`, icon: 'bell', action: () => onNavigate('campus') })
        })
      }
      return items
    }

    // Determine strictly allowed student IDs for the active user
    const normCls = (v: string) =>
      String(v || '')
        .toLowerCase()
        .replace(/section/g, '')
        .replace(/[·\-_\s]/g, '')
        .trim()
    const activeTeacher = teachers.find((t) => t.id === activeTeacherId)
    const assignedTeacherTokens = (activeTeacher?.assignedClasses || []).map(normCls)
    const allowedStudentIds = new Set<string>(
      isAdmin
        ? students.map((s) => s.id)
        : role === 'teacher'
          ? students
              .filter((s) => {
                const full = normCls(`${s.className} ${s.section}`)
                const secL = s.section.replace(/section/i, '').trim().toLowerCase()
                const compact = normCls(`${s.className}${secL}`)
                const grade = normCls(s.className)
                return (
                  assignedTeacherTokens.includes(full) ||
                  assignedTeacherTokens.includes(compact) ||
                  assignedTeacherTokens.includes(grade)
                )
              })
              .map((s) => s.id)
          : role === 'student'
            ? [activeStudentId || students[0]?.id || '']
            : activeGuardian?.linkedStudentIds?.length
              ? activeGuardian.linkedStudentIds
              : [selectedChildId || students[0]?.id || ''],
    )
    const allowedStudents = students.filter((s) => allowedStudentIds.has(s.id))
    const allowedClasses = new Set(allowedStudents.map((s) => s.className.toLowerCase()))

    // Quick Navigation Destinations (strictly role-gated)
    const quickPages: {
      label: string
      sub: string
      tab: string
      icon: IconName
      adminOnly?: boolean
      staffOnly?: boolean
      hideInChildMode?: boolean
    }[] = [
      { label: 'Class Moments (Photos & Videos)', sub: 'Live classroom photos & videos for enrolled guardians', tab: 'moments', icon: 'video' },
      { label: 'School Academic Calendar & Holidays', sub: 'Unified monthly calendar of holidays, exams, trips & PTM days', tab: 'calendar', icon: 'calendar' },
      { label: 'PTM 15-Minute Slot Scheduler', sub: 'Book or publish In-Person & Video Parent–Teacher slots', tab: 'ptm', icon: 'calendar', hideInChildMode: true },
      { label: 'Early-Years Daily Care Log', sub: 'Daily tiffin/meal, mood, nap & teacher care cards', tab: 'care', icon: 'heart', hideInChildMode: true },
      { label: 'Course Materials & Semester Syllabus', sub: 'Weekly class topics, teacher notes & downloadable slides', tab: 'materials', icon: 'book' },
      { label: 'Daily Roll Call & Attendance History', sub: 'Daily attendance, historical dates & leave requests', tab: 'attendance', icon: 'check' },
      { label: 'Online Quizzes (CBT)', sub: 'Take or review interactive quizzes', tab: 'quizzes', icon: 'exam' },
      { label: 'Class Leaderboard & Ranks', sub: 'Live class standings & subject highlights', tab: 'leaderboard', icon: 'trend' },
      { label: 'Smart Study Coach & Quest Arena', sub: 'Personalized result analysis & game study missions', tab: 'coach', icon: 'spark' },
      { label: 'Homework Tracker & Daily Diary', sub: 'Everyday homework, steps, study guide & due alerts', tab: 'assignments', icon: 'sheet' },
      { label: 'Transport & School Bus Management', sub: 'Dhaka bus routes, drivers, stops, boarding alerts & bus billing', tab: 'transport', icon: 'bus' },
      { label: 'Unified Leave Management Hub', sub: 'Student & faculty leave approvals, quotas & medical attachments', tab: 'leaves', icon: 'clipboard', hideInChildMode: true },
      { label: 'Smart Library & Lesson Hub', sub: 'Multi-copy book catalog, QR issue/return, auto-fines & PDF notes', tab: 'library', icon: 'book' },
      { label: 'Official Report Cards & Admit Cards', sub: 'Print QR-verified transcripts & admit cards', tab: 'documents', icon: 'print' },
      { label: 'Class Routine & Exam Schedule', sub: 'Weekly Sun–Thu class schedule & exam dates', tab: 'schedule', icon: 'calendar' },
      { label: 'Exam Attendance (Hall Roll Call)', sub: 'Mark candidate hall attendance by class & subject', tab: 'schedule:attendance', icon: 'check', staffOnly: true },
      { label: 'Exam Marks Entry (Admin & Teacher)', sub: 'Submit Written, MCQ & Practical marks with auto GPA 5.0', tab: 'schedule:marks', icon: 'exam', staffOnly: true },
      { label: 'Exam Declare & Lifecycle', sub: 'Declare term exams, lock marks & publish results', tab: 'schedule:declare', icon: 'exam', adminOnly: true },
      { label: 'Exam Mark List & Tabulation Sheet', sub: 'Master GPA ranking sheet, pass stats & Excel CSV export', tab: 'schedule:marklist', icon: 'sheet', adminOnly: true },
      { label: 'Exam Admit Cards (Bulk & Individual A4)', sub: 'Printable A4 admit cards with room/seat # & fee-clearance gate', tab: 'schedule:admit', icon: 'print', adminOnly: true },
      { label: 'Exam Seat Plan & Hall Attendance Sheet', sub: 'Mixed-class anti-cheating seat planner & visual room bench grid', tab: 'schedule:seatplan', icon: 'calendar', adminOnly: true },
      { label: 'Exam Committee & Invigilators', sub: 'Committee roles & conflict-guarded hall invigilator roster', tab: 'schedule:invigilators', icon: 'users', adminOnly: true },
      { label: 'Question Paper & Answer Script Control', sub: 'Sealed question packets & examiner answer script checking tracker', tab: 'schedule:papers', icon: 'clipboard', adminOnly: true },
      { label: 'Examination Settings & Grading Scale', sub: 'Bangladesh GPA 5.0 grading table, pass % & exam rules', tab: 'schedule:settings', icon: 'database', adminOnly: true },
      { label: 'Smart QR ID Cards', sub: 'View, download & print digital campus ID cards', tab: 'qrid', icon: 'qr' },
      { label: 'Exam Answer Sheets', sub: 'Inspect checked exam scripts & teacher remarks', tab: 'scripts', icon: 'sheet' },
      { label: 'Digital Consent Forms & Canteen', sub: 'Paperless permission slips, biometric e-sign & canteen wallet', tab: 'consent', icon: 'clipboard', hideInChildMode: true },
      { label: 'Notices & Campus Units', sub: 'Official circulars, Unit - 1 / Unit - 2 live gates & clubs', tab: 'campus', icon: 'bell' },
      { label: 'Safe Dismissal & Infirmary', sub: 'Gate QR pass, pickup persons & medical log', tab: 'safety', icon: 'shield', hideInChildMode: true },
      { label: 'House & Pastoral Care', sub: 'Inter-house points, pastoral cases & practice papers', tab: 'house', icon: 'award' },
      { label: 'School Fees & Receipts', sub: 'View term invoices and download payment receipts', tab: 'payments', icon: 'payment', hideInChildMode: true },
      // Staff-only (Teacher + Admin)
      { label: 'Teacher Leave & Auto-Substitution', sub: 'Assign free teachers to cover classes live', tab: 'substitution', icon: 'calendar', staffOnly: true },
      { label: 'Campus Wi-Fi Check-In & Faculty HR', sub: 'School Wi-Fi check-in, class workload & faculty training', tab: 'facultyhr', icon: 'clock', staffOnly: true },
      { label: 'Finance (Salary, Reimbursements & Tax)', sub: 'Payslips, expense claims, salary advances, allowances & PF', tab: 'facultyfinance', icon: 'payment', staffOnly: true },
      { label: 'WhatsApp / SMS Parent Alert Hub', sub: 'Send automated absence, fee & rank alerts', tab: 'alerts', icon: 'send', staffOnly: true },
      // Admin-only
      { label: 'Go-Live & Cloud Integrations', sub: 'Payment gateways, SMS/WhatsApp APIs & SQLite backup', tab: 'golive', icon: 'database', adminOnly: true },
      { label: 'Bulk CSV Import & Class Promotion', sub: 'Onboard classes from Excel/CSV & promote cohorts', tab: 'academicops', icon: 'userplus', adminOnly: true },
      { label: 'Security Audit & Payment Ledger', sub: 'SQLite payment reconciliation, audit logs & restore', tab: 'security', icon: 'shield', adminOnly: true },
      { label: 'Admissions Pipeline CRM', sub: 'Review applicants & 1-click enroll', tab: 'admissions', icon: 'userplus', adminOnly: true },
      { label: 'Accounts & Finance Overview', sub: 'Executive treasury, P&L summary & launchpad', tab: 'accounts', icon: 'payment', adminOnly: true },
      { label: 'Vouchers & Transactions (Credit / Debit / Journal / Contra)', sub: 'Post balanced double-entry vouchers & print A4 slips', tab: 'accounts:vouchers', icon: 'payment', adminOnly: true },
      { label: 'General Ledger, Trial Balance & Balance Sheet', sub: 'Live double-entry financial statements & CSV export', tab: 'accounts:acctreports', icon: 'print', adminOnly: true },
      { label: 'Chart of Accounts, Banks, Cheques & Petty Cash', sub: 'Ledgers, groups, banks, vendors, cheque register & requisitions', tab: 'accounts:setup', icon: 'database', adminOnly: true },
      { label: 'Payroll Management (Accounts Subsection)', sub: 'Base salary, allowances, bulk bonus, attendance & payslips', tab: 'accounts:payroll', icon: 'payment', adminOnly: true },
      { label: 'Monthly Auto-Billing & Sibling Discounts', sub: 'Batch tuition invoice generator with multi-child discounts', tab: 'accounts:autobill', icon: 'payment', adminOnly: true },
      { label: 'People & Access Directory', sub: 'Manage students, teachers & guardians', tab: 'directory', icon: 'users', adminOnly: true },
      { label: 'Help Desk & Support Tickets', sub: 'Admin SLA ticket desk for billing, IT & campus issues', tab: 'helpdesk', icon: 'message', adminOnly: true },
      { label: 'Website Design & Portal CMS', sub: 'Edit public landing banner, ticker & Principal welcome message', tab: 'website', icon: 'spark', adminOnly: true },
      { label: 'Task Management Board', sub: 'Assign and track campus tasks across departments', tab: 'tasks', icon: 'clipboard', adminOnly: true },
      { label: 'Fingerprint & RF Attendance Hub', sub: 'ZKTeco/RFID gate devices and live punch sync', tab: 'rfid', icon: 'qr', adminOnly: true },
      { label: 'Fine Management Ledger', sub: 'Issue, waive, or post student fines to billing', tab: 'fines', icon: 'payment', adminOnly: true },
      { label: 'Live Meeting & Online Class Hub', sub: 'Schedule Zoom, Google Meet & instant Jitsi rooms', tab: 'meetings', icon: 'video', adminOnly: true },
      { label: 'Report Manager (CSV & Print)', sub: 'Export attendance, defaulters, fines, duty & stock reports', tab: 'reports', icon: 'print', adminOnly: true },
      { label: 'Employee Duty Roster', sub: 'Gate, assembly, exam invigilation & bus escort shifts', tab: 'duty', icon: 'clock', adminOnly: true },
      { label: 'Stock Management & Inventory', sub: 'Uniforms, lab kits, stationery & Stock IN/OUT audit', tab: 'stock', icon: 'database', adminOnly: true },
      { label: 'Question Bank & Paper Builder', sub: 'Subject question repository & printable A4 exam builder', tab: 'qbank', icon: 'book', adminOnly: true },
      { label: 'Job Applications & Careers CRM', sub: 'Manage open teacher/staff vacancies and applicants', tab: 'careers', icon: 'userplus', adminOnly: true },
    ]

    quickPages.forEach((p) => {
      if (p.adminOnly && !isAdmin) return
      if (p.staffOnly && !isStaff) return
      if (p.hideInChildMode && familyChildMode) return
      if (p.tab === 'payments' && role === 'teacher') return
      items.push({
        id: `nav-${p.tab}`,
        category: 'Quick Jump',
        title: p.label,
        subtitle: p.sub,
        icon: p.icon,
        action: () => onNavigate(p.tab),
      })
    })

    // Students (strictly scoped: Guardian = own children, Student = self, Staff = all)
    allowedStudents.forEach((s) => {
      items.push({
        id: `stu-${s.id}`,
        category: isStaff ? 'Students' : role === 'guardian' ? 'My Children' : 'My Profile',
        title: s.name,
        subtitle: `${s.className} (${s.section}) · Roll #${s.roll} · GPA ${s.gpa} · ${s.house || 'Emerald'} House`,
        icon: 'profile',
        action: () => {
          if (role === 'guardian') setSelectedChildId(s.id)
          onNavigate(isAdmin ? 'directory' : 'exams')
        },
      })
    })

    // Teachers (public faculty subject list; hide personal email/phone for students)
    teachers.forEach((t) => {
      items.push({
        id: `tch-${t.id}`,
        category: 'Faculty',
        title: t.name,
        subtitle: isStaff
          ? `${t.subject} · ${t.department} · ${t.email}`
          : `${t.subject} · ${t.department}`,
        icon: 'users',
        action: () => onNavigate(isAdmin ? 'directory' : role === 'student' ? 'schedule' : 'messages'),
      })
    })

    // Guardians (Admin = all; Teacher = guardians of assigned classes only)
    if (isStaff) {
      guardians
        .filter(
          (g) =>
            isAdmin ||
            g.linkedStudentIds.some((sid) => allowedStudentIds.has(sid)) ||
            allowedStudents.some((s) => s.guardianId === g.id),
        )
        .forEach((g) => {
          items.push({
            id: `grd-${g.id}`,
            category: 'Guardians',
            title: g.name,
            subtitle: `${g.relation} · ${g.phone} · ${g.linkedStudentIds.length} child(ren)`,
            icon: 'shield',
            action: () => onNavigate(isAdmin ? 'directory' : 'messages'),
          })
        })
    }

    // Online Quizzes (Guardians/Students only see published quizzes for their own class)
    quizzes
      .filter((q) => {
        if (isStaff) return true
        if (q.status !== 'published') return false
        return (
          q.className.toLowerCase() === 'all classes' ||
          allowedClasses.has(q.className.toLowerCase())
        )
      })
      .forEach((q) => {
        items.push({
          id: `qz-${q.id}`,
          category: 'Online Quizzes',
          title: q.title,
          subtitle: `${q.subject} · ${q.className} · ${q.questions.length} Qs · ${q.durationMins} mins`,
          icon: 'exam',
          action: () => onNavigate('quizzes'),
        })
      })

    // Admissions (Admin only)
    if (isAdmin) {
      admissions.forEach((a) => {
        items.push({
          id: `adm-${a.id}`,
          category: 'Admissions',
          title: `${a.applicantName} (${a.applicationCode})`,
          subtitle: `Applying for ${a.applyingClass} · Stage: ${a.stage.replace('_', ' ')} · Guardian: ${a.guardianName}`,
          icon: 'userplus',
          action: () => onNavigate('admissions'),
        })
      })
    }

    // Exam Sheets (strictly scoped to allowedStudentIds)
    examSheets
      .filter((es) => allowedStudentIds.has(es.studentId))
      .forEach((es) => {
        items.push({
          id: `es-${es.id}`,
          category: 'Exam Sheets',
          title: `${es.examTitle} — ${es.subject}`,
          subtitle: `${es.studentName} · ${es.marksObtained}/${es.totalMarks} · ${es.captureMethod}`,
          icon: 'sheet',
          action: () => {
            if (role === 'guardian') setSelectedChildId(es.studentId)
            onNavigate('scripts')
          },
        })
      })

    // Fees (Admin = all, Guardian/Student = own children only, Teacher = none, hidden in Child Study Mode)
    if (!familyChildMode && role !== 'teacher') {
      fees
        .filter((f) => isAdmin || allowedStudentIds.has(f.studentId))
        .forEach((f) => {
          items.push({
            id: `fee-${f.id}`,
            category: 'Fees & Receipts',
            title: f.title,
            subtitle: `${f.studentName} · ৳${f.amount.toLocaleString()} · ${f.status.toUpperCase()}`,
            icon: 'payment',
            action: () => {
              if (role === 'guardian') setSelectedChildId(f.studentId)
              onNavigate(isAdmin ? 'accounts' : 'payments')
            },
          })
        })
    }

    // Class Moments (already server-scoped by role/enrollment!)
    classMoments.forEach((cm) => {
      items.push({
        id: `cm-${cm.id}`,
        category: 'Class Moments',
        title: cm.title,
        subtitle: `${cm.classLabel} · ${cm.subject} · By ${cm.teacherName}`,
        icon: 'video',
        action: () => onNavigate('moments'),
      })
    })

    // Notices (audience-filtered for Students & Guardians)
    notices
      .filter((n) => {
        if (isAdmin) return true
        if (n.audience === 'All') return true
        if (role === 'guardian' && n.audience === 'Guardians') return true
        if (role === 'student' && n.audience === 'Students') return true
        if (role === 'teacher' && n.audience === 'Teachers') return true
        return false
      })
      .forEach((n) => {
        items.push({
          id: `not-${n.id}`,
          category: 'Notices',
          title: n.title,
          subtitle: `${n.category.toUpperCase()} · ${n.targetUnit || 'All Units'} · ${n.date}`,
          icon: 'bell',
          action: () => onNavigate('campus'),
        })
      })

    return items
  }, [
    role,
    students,
    teachers,
    guardians,
    activeGuardianId,
    activeTeacherId,
    activeStudentId,
    selectedChildId,
    hasStaffPermission,
    quizzes,
    admissions,
    examSheets,
    fees,
    notices,
    classMoments,
    familyChildMode,
    onNavigate,
    setSelectedChildId,
  ])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allItems.slice(0, 10)
    return allItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q),
      )
      .slice(0, 14)
  }, [allItems, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  if (!open) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (results.length ? (prev + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) =>
        results.length ? (prev - 1 + results.length) % results.length : 0,
      )
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      results[activeIndex].action()
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 px-4 pt-[10vh] backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <Icon name="search" size={19} className="text-emerald-600" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search students, teachers, quizzes, admissions, invoices, QR IDs..."
            className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-extrabold text-slate-400 sm:inline-block">
            ESC
          </kbd>
        </div>

        <div className="max-h-[58vh] overflow-y-auto p-3">
          {results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-extrabold text-slate-700">No matches found for “{query}”</p>
              <p className="mt-1 text-xs text-slate-400">
                Try searching by student name, class, quiz topic, admission code, or fee title.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item, idx) => {
                const selected = idx === activeIndex
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      item.action()
                      onClose()
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left transition ${
                      selected ? 'bg-[#0f172a] text-white' : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                          selected
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon name={item.icon} size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold">{item.title}</p>
                        <p
                          className={`truncate text-[11px] font-medium ${
                            selected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                        selected
                          ? 'bg-white/10 text-emerald-300'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.category}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[11px] font-semibold text-slate-400">
          <span>↑↓ Navigate · ↵ Open · Global Spotlight Search</span>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  )
}
