'use client'

import React, { useEffect, useState } from 'react'
import { computeMonthlyPayrollSheet } from '@/lib/dmhs-payroll'
import { scopeTasksForActor } from '@/lib/dmhs-tasks'
import { AccountsOverviewView, type AccountsSubTab } from './accounts-views'
import { AcademicCalendarView } from './academic-calendar-views'
import { AcademicOpsView } from './academic-ops-views'
import { AdminDirectoryView } from './admin-directory'
import { AdminOverview } from './admin-views'
import { AdmissionsPipelineView } from './admissions-views'
import { ParentAlertsHubView } from './alerts-hub-views'
import { ConsentAndCanteenView } from './campus-plus-views'
import { ClassMomentsView } from './class-moments-views'
import { CourseMaterialsView } from './course-materials-views'
import { ADMIN_PROFILE, GUARDIAN_PROFILE, TEACHER_PROFILE } from './data'
import { DeveloperAccountSwitcher } from './dev-switcher'
import { OfficialDocumentsView } from './documents-views'
import { EarlyYearsCareView } from './early-years-care-views'
import { EnglishMediumAcademicsView } from './english-medium-views'
import {
  JobApplicationsView,
  LiveMeetingsView,
  QuestionBankView,
  ReportManagerView,
  StockManagementView,
  WebsiteDesignView,
} from './erp-campus-views'
import {
  EmployeeDutyView,
  FineManagementView,
  FingerRfidAttendanceView,
  HelpDeskView,
  TaskManagementView,
} from './erp-ops-views'
import { ExamManagementHub, type ExamSubTab } from './exam-level2-views'
import { ExamSheetsView } from './exam-sheets-views'
import { FacultyFinanceView } from './faculty-finance-views'
import { FacultyHRView } from './faculty-hr-views'
import { ParentPinUnlockModal } from './family-mode-ui'
import {
  dispatchFloatingNotification,
  FloatingNotificationCenter,
  loadSoundPrefs,
  playNotificationSound,
  saveSoundPrefs,
  type NotificationSoundPrefs,
} from './floating-notifications'
import { FeedbackAndEvaluationView } from './feedback-views'
import { GlobalSearchModal } from './global-search'
import { GoLiveProductionView } from './golive-views'
import { GradebookView } from './gradebook-views'
import {
  GuardianAttendanceView,
  GuardianFeedbackView,
  GuardianOverview,
  GuardianResultsView,
} from './guardian-views'
import { AssignmentsView } from './homework-views'
import { Icon, type IconName } from './icons'
import { ClassLeaderboardView } from './leaderboard-views'
import { LeaveManagementView } from './leave-management-views'
import { LibraryAndLessonsView } from './library-hub-views'
import { LoginPortal } from './login-portal'
import { QuickNotebookWidget } from './notebook-drawer'
import { PtmSchedulerView } from './ptm-scheduler-views'
import { DesktopAppInstallButton } from './pwa-install'
import { SmartQRIdCardsView } from './qr-id-views'
import { OnlineQuizzesView } from './quizzes-views'
import { SafetyAndHealthView } from './safety-views'
import { SecurityAuditConsoleView } from './security-audit-views'
import { AdminRolesAndStaffView, CanteenOpsView, StaffOverview } from './staff-roles-views'
import {
  CampusServicesView,
  MessagesView,
  PaymentsView,
  ProfileView,
} from './shared-views'
import { SchoolProvider, useSchool } from './store'
import { StudentOverview, StudentSubjectsView } from './student-views'
import { SmartStudyCoachView } from './study-coach-view'
import { TeacherSubstitutionView } from './substitution-views'
import {
  TeacherFeedbackComposerView,
  TeacherGradebookView,
  TeacherOverview,
  TeacherRollCallView,
} from './teacher-views'
import { MasterTimetableView } from './timetable-views'
import { TransportManagementView } from './transport-views'
import type { NotificationItem, Role } from './types'
import { Brand, NotificationsDrawer } from './ui'

interface NavSubItem {
  id: string
  label: string
  badge?: number
}

interface NavGroup {
  heading: string
  items: {
    id: string
    label: string
    icon: IconName
    badge?: number
    children?: NavSubItem[]
  }[]
}

function SchoolShell() {
  const {
    role,
    setRole,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    toast,
    students,
    teachers,
    guardians,
    feedback,
    consentForms,
    classMoments,
    earlyYearsCareLogs,
    ptmSlots,
    helpDeskTickets,
    campusTasks,
    stockItems,
    jobApplications,
    fees,
    expenses,
    otherIncomes,
    accountingBook,
    payrollBook,
    examBook,
    leaveRequests,
    examSheets,
    quizzes,
    quizAttempts,
    admissions,
    teacherLeaves,
    teacherSalaries,
    connectedDevices,
    realtimeConnected,
    selectedChildId,
    setSelectedChildId,
    activeGuardianId,
    activeTeacherId,
    activeStudentId,
    activeStaffMember,
    activeCustomRole,
    staffMembers,
    customRoles,
    hasStaffPermission,
    impersonateStaff,
    authUser,
    authLoading,
    isDeveloperMode,
    logout,
    demoSwitcherEnabled,
    dbStatus,
    familyChildMode,
    familyLockGuardianId,
    enterFamilyChildMode,
    exitFamilyChildMode,
  } = useSchool()

  const [tab, setTab] = useState('home')
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [soundPrefs, setSoundPrefs] = useState<NotificationSoundPrefs>(() => loadSoundPrefs())
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleUpdateSoundPrefs = (next: NotificationSoundPrefs) => {
    setSoundPrefs(next)
    saveSoundPrefs(next)
    if (next.enabled) {
      playNotificationSound('notice', next.preset)
    }
  }

  const handleTestFloatingAlert = () => {
    dispatchFloatingNotification({
      title: `DMHA Live Alert (${soundPrefs.preset.toUpperCase()} Sound)`,
      text: `Floating app notifications are active for ${role.toUpperCase()} — new roll call, quiz grades, fees & messages will float here with sound.`,
      type: 'result',
      forRoles: [role],
    })
  }
  const [searchOpen, setSearchOpen] = useState(false)
  const [pinModalOpen, setPinModalOpen] = useState(false)

  // Reset active route tab & accordion whenever the signed-in account changes
  useEffect(() => {
    setTab('home')
    setOpenGroupId(null)
  }, [authUser?.id])

  // Enforce strict role-based route boundaries so no role can ever stay on an unauthorized page
  useEffect(() => {
    const adminOnlyTabs = [
      'directory',
      'roles',
      'academicops',
      'golive',
      'helpdesk',
      'website',
      'rfid',
      'fines',
      'meetings',
      'reports',
      'duty',
      'stock',
      'qbank',
      'careers',
    ]
    if (adminOnlyTabs.includes(tab) && role !== 'admin') {
      setTab('home')
      return
    }
    if (tab === 'tasks' && role !== 'admin' && role !== 'teacher' && role !== 'staff') {
      setTab('home')
      return
    }
    if (role === 'staff') {
      const allowedStaffTabs = new Set<string>(['home', 'tasks', 'profile'])
      if (hasStaffPermission('accounts')) {
        allowedStaffTabs.add('accounts')
        allowedStaffTabs.add('accounts:vouchers')
        allowedStaffTabs.add('accounts:acctreports')
        allowedStaffTabs.add('accounts:setup')
        allowedStaffTabs.add('accounts:payroll')
        allowedStaffTabs.add('accounts:fees')
        allowedStaffTabs.add('accounts:autobill')
        allowedStaffTabs.add('accounts:expenses')
        allowedStaffTabs.add('accounts:income')
        allowedStaffTabs.add('payroll')
      }
      if (hasStaffPermission('payroll')) {
        allowedStaffTabs.add('facultyfinance')
        allowedStaffTabs.add('accounts:payroll')
        allowedStaffTabs.add('payroll')
      }
      if (hasStaffPermission('payment_ledger')) allowedStaffTabs.add('security')
      if (hasStaffPermission('canteen_pos')) {
        allowedStaffTabs.add('canteenops')
        allowedStaffTabs.add('qrid')
      }
      if (hasStaffPermission('gate_security')) {
        allowedStaffTabs.add('safety')
        allowedStaffTabs.add('qrid')
      }
      if (hasStaffPermission('infirmary')) allowedStaffTabs.add('safety')
      if (hasStaffPermission('library')) allowedStaffTabs.add('library')
      if (hasStaffPermission('admissions')) allowedStaffTabs.add('admissions')
      if (hasStaffPermission('documents')) allowedStaffTabs.add('documents')
      if (hasStaffPermission('timetable')) {
        allowedStaffTabs.add('schedule')
        allowedStaffTabs.add('schedule:declare')
        allowedStaffTabs.add('schedule:attendance')
        allowedStaffTabs.add('schedule:marks')
        allowedStaffTabs.add('schedule:marklist')
        allowedStaffTabs.add('schedule:admit')
        allowedStaffTabs.add('schedule:seatplan')
        allowedStaffTabs.add('schedule:invigilators')
        allowedStaffTabs.add('schedule:papers')
        allowedStaffTabs.add('schedule:settings')
      }
      if (hasStaffPermission('notices')) allowedStaffTabs.add('campus')
      if (!allowedStaffTabs.has(tab)) {
        setTab('home')
      }
      return
    }
    const staffOnlyTabs = [
      'substitution',
      'alerts',
      'facultyhr',
      'facultyfinance',
      'canteenops',
      'security',
      'accounts',
      'admissions',
    ]
    if (
      (role === 'guardian' || role === 'student') &&
      (staffOnlyTabs.includes(tab) || tab.startsWith('schedule:') || tab.startsWith('accounts:'))
    ) {
      setTab('home')
      return
    }
    if (
      role === 'teacher' &&
      (['accounts', 'admissions', 'security', 'canteenops'].includes(tab) ||
        tab.startsWith('accounts:') ||
        (tab.startsWith('schedule:') &&
          tab !== 'schedule:attendance' &&
          tab !== 'schedule:marks'))
    ) {
      setTab('home')
      return
    }
    if (
      familyChildMode &&
      ([
        'payments',
        'consent',
        'messages',
        'profile',
        'safety',
        'ptm',
        'care',
        ...adminOnlyTabs,
        ...staffOnlyTabs,
      ].includes(tab) ||
        tab.startsWith('schedule:') ||
        tab.startsWith('accounts:'))
    ) {
      setTab('home')
    }
  }, [role, familyChildMode, tab, activeCustomRole, activeStaffMember, hasStaffPermission])

  // Global Ctrl+K / Cmd+K Spotlight Search shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f172a] text-white">
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-400 text-2xl font-black text-slate-950 shadow-xl">
            D
          </div>
          <p className="mt-4 text-sm font-extrabold tracking-wide text-white">
            DMHA · Smart Learning App
          </p>
          <p className="mt-1 text-xs text-slate-400">Connecting to SQLite server database...</p>
        </div>
      </main>
    )
  }

  if (!authUser) {
    return <LoginPortal />
  }

  const activeChild = students.find((s) => s.id === selectedChildId) || students[0]
  const activeGuardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]
  const activeTeacher = teachers.find((t) => t.id === activeTeacherId) || teachers[0]
  const activeStudent = students.find((s) => s.id === activeStudentId) || students[0]

  // Privacy-filtered notifications: Guardians/Students NEVER see notifications about other families' students
  const privacyScopedNotifications = notifications.filter((n) => {
    if (!n.forRoles.includes(role)) return false
    if (role === 'admin' || role === 'teacher') return true
    const allowedIds = new Set<string>(
      role === 'student'
        ? [activeStudent?.id || '']
        : activeGuardian?.linkedStudentIds?.length
          ? activeGuardian.linkedStudentIds
          : [activeChild?.id || ''],
    )
    const otherStudents = students.filter((s) => !allowedIds.has(s.id))
    const text = `${n.title} ${n.text}`.toLowerCase()
    if (text.includes('class moment')) {
      const enrolledClasses = students
        .filter((s) => allowedIds.has(s.id))
        .map((s) => `${s.className} · ${s.section}`.toLowerCase())
      if (enrolledClasses.length > 0 && !enrolledClasses.some((cls) => text.includes(cls))) {
        return false
      }
    }
    const mentionsOtherStudent = otherStudents.some((other) => {
      const full = other.name.toLowerCase()
      return full.length >= 4 && text.includes(full)
    })
    return !mentionsOtherStudent
  })

  const unreadCount = privacyScopedNotifications.filter((n) => !n.read).length

  const unseenMomentsCount =
    role === 'guardian'
      ? classMoments.filter((m) => !(m.seenByGuardianIds || []).includes(activeGuardianId)).length
      : 0
  const linkedChildIdsSet = new Set(
    activeGuardian?.linkedStudentIds?.length
      ? activeGuardian.linkedStudentIds
      : activeChild?.id
        ? [activeChild.id]
        : [],
  )
  const unackCareLogsCount =
    role === 'guardian'
      ? earlyYearsCareLogs.filter(
          (c) => linkedChildIdsSet.has(c.studentId) && !c.guardianAcknowledged,
        ).length
      : 0
  const guardianBookedPtmCount =
    role === 'guardian'
      ? ptmSlots.filter((s) => s.guardianId === activeGuardianId && s.status === 'booked').length
      : 0
  const teacherBookedPtmCount =
    role === 'teacher'
      ? ptmSlots.filter((s) => s.teacherId === activeTeacherId && s.status === 'booked').length
      : 0
  const adminBookedPtmCount =
    role === 'admin' ? ptmSlots.filter((s) => s.status === 'booked').length : 0
  const openHelpDeskCount =
    role === 'admin' ? helpDeskTickets.filter((t) => t.status !== 'resolved').length : 0
  const myScopedTasks = scopeTasksForActor(
    campusTasks,
    role,
    role === 'teacher' ? activeTeacherId : role === 'staff' ? activeStaffMember?.id || '' : 'admin',
    teachers,
    staffMembers,
  )
  const myOpenTasksCount = myScopedTasks.filter(
    (t) => t.status === 'todo' || t.status === 'in_progress',
  ).length
  const adminReviewTasksCount =
    role === 'admin' ? campusTasks.filter((t) => t.status === 'in_review').length : 0
  const lowStockBadgeCount =
    role === 'admin' ? stockItems.filter((i) => i.quantity <= i.minThreshold).length : 0
  const activeJobAppsCount =
    role === 'admin'
      ? jobApplications.filter((a) => a.stage === 'applied' || a.stage === 'shortlisted').length
      : 0

  const unreadFeedbackCount = feedback.filter(
    (f) => f.studentId === activeChild?.id && !f.acknowledgedByGuardian,
  ).length
  const pendingConsentCount = consentForms.filter(
    (c) => c.studentId === activeChild?.id && !c.signed,
  ).length
  const pendingLeavesCount = leaveRequests.filter((l) => l.status === 'pending').length
  const unreviewedScriptsCount = examSheets.filter(
    (s) => s.studentId === activeChild?.id && !s.guardianReviewed,
  ).length
  const recheckScriptsCount = examSheets.filter((s) => s.recheckRequested).length
  const pendingQuizzesCount = quizzes.filter(
    (q) =>
      q.status === 'published' &&
      !quizAttempts.some(
        (a) =>
          a.quizId === q.id &&
          a.studentId === (role === 'student' ? activeStudent?.id : activeChild?.id),
      ),
  ).length
  const pendingAdmissionsCount = admissions.filter(
    (a) => a.stage !== 'enrolled' && a.stage !== 'waitlisted',
  ).length
  const pendingSubstitutionsCount = teacherLeaves.filter((l) => l.status === 'pending').length
  const pendingPayrollCount = teacherSalaries.filter((s) => s.status === 'pending').length
  const payrollSuitePendingCount = computeMonthlyPayrollSheet(
    payrollBook,
    'November 2026',
  ).pendingCount
  const dueFeesBadgeCount = fees.filter((f) => f.status === 'due').length

  const accountsSubmenuItems: NavSubItem[] = [
    { id: 'accounts', label: 'Executive Overview' },
    {
      id: 'accounts:vouchers',
      label: 'Vouchers & Transactions',
      badge: accountingBook.vouchers.length || undefined,
    },
    { id: 'accounts:acctreports', label: 'Ledger, Trial Balance & P&L' },
    { id: 'accounts:setup', label: 'Chart of Accounts & Petty Cash' },
    {
      id: 'accounts:payroll',
      label: 'Payroll Management',
      badge: payrollSuitePendingCount || undefined,
    },
    {
      id: 'accounts:fees',
      label: 'Student Fees',
      badge: dueFeesBadgeCount || undefined,
    },
    { id: 'accounts:autobill', label: 'Monthly Auto-Billing' },
    { id: 'accounts:expenses', label: 'Quick Costs', badge: expenses.length || undefined },
    { id: 'accounts:income', label: 'Other Income', badge: otherIncomes.length || undefined },
  ]

  const adminFinanceSubmenuItems: NavSubItem[] = [
    ...accountsSubmenuItems,
    { id: 'fines', label: 'Fine Management' },
    {
      id: 'facultyfinance',
      label: 'Faculty Finance Claims',
      badge: pendingPayrollCount || undefined,
    },
  ]

  const activeDeclaredExamsCount = examBook.declaredExams.filter(
    (e) => e.status === 'declared',
  ).length

  const examControllerSubmenuItems: NavSubItem[] = [
    {
      id: 'schedule:declare',
      label: 'Exam Declare & Schedule',
      badge: examBook.declaredExams.length || undefined,
    },
    { id: 'schedule:attendance', label: 'Exam Attendance' },
    {
      id: 'schedule:marks',
      label: 'Marks Entry',
      badge: examBook.examMarks.length || undefined,
    },
    { id: 'schedule:marklist', label: 'Exam Mark List' },
    { id: 'schedule:admit', label: 'Admit Cards' },
    {
      id: 'schedule:seatplan',
      label: 'Seat Plan & Hall Sheet',
      badge: examBook.seatAllocations.length || undefined,
    },
    {
      id: 'schedule:invigilators',
      label: 'Committee & Invigilators',
      badge: examBook.invigilators.length || undefined,
    },
    { id: 'schedule:papers', label: 'Paper & Script Control' },
    { id: 'schedule:settings', label: 'Examination Settings' },
  ]

  const adminExamSubmenuItems: NavSubItem[] = [
    ...examControllerSubmenuItems,
    { id: 'qbank', label: 'Question Bank' },
    {
      id: 'scripts',
      label: 'Exam Sheets Review',
      badge: recheckScriptsCount || undefined,
    },
    { id: 'exams', label: 'Gradebook & GPA' },
    { id: 'documents', label: 'Report Cards & Certs' },
  ]

  const adminScheduleSubmenuItems: NavSubItem[] = [
    { id: 'schedule', label: 'Master Timetable' },
    { id: 'calendar', label: 'School Calendar' },
    {
      id: 'ptm',
      label: 'PTM Scheduler',
      badge: adminBookedPtmCount || undefined,
    },
    { id: 'meetings', label: 'Live Meeting' },
    {
      id: 'substitution',
      label: 'Leave & Substitutes',
      badge: pendingSubstitutionsCount || undefined,
    },
    { id: 'duty', label: 'Employee Duty' },
  ]

  const isCurrentAccountSuspended =
    (role === 'guardian' && activeGuardian?.status === 'suspended') ||
    (role === 'teacher' && activeTeacher?.status === 'suspended') ||
    (role === 'student' && activeStudent?.status === 'suspended') ||
    (role === 'staff' && activeStaffMember?.status === 'suspended')

  const staffSidebarItems: NavGroup['items'] = (() => {
    const items: NavGroup['items'] = [
      { id: 'home', label: `${activeCustomRole?.name || 'Staff'} Desk`, icon: 'home' },
    ]
    if (hasStaffPermission('timetable')) {
      items.push({
        id: 'nav:staff-schedule',
        label: 'Schedule & Calendar',
        icon: 'calendar',
        children: [{ id: 'schedule', label: 'Master Timetable' }],
      })
      items.push({
        id: 'nav:staff-exams',
        label: 'Exam Management',
        icon: 'exam',
        badge: activeDeclaredExamsCount || undefined,
        children: examControllerSubmenuItems,
      })
    }
    if (hasStaffPermission('accounts')) {
      items.push({
        id: 'nav:staff-accounts',
        label: 'Accounts & Finance',
        icon: 'payment',
        badge: payrollSuitePendingCount || undefined,
        children: [
          ...accountsSubmenuItems,
          ...(hasStaffPermission('payroll')
            ? [
                {
                  id: 'facultyfinance',
                  label: 'Faculty Finance',
                  badge: pendingPayrollCount || undefined,
                },
              ]
            : []),
        ],
      })
    } else if (hasStaffPermission('payroll')) {
      items.push({
        id: 'nav:staff-payroll',
        label: 'Payroll & Finance',
        icon: 'payment',
        badge: (payrollSuitePendingCount + pendingPayrollCount) || undefined,
        children: [
          {
            id: 'accounts:payroll',
            label: 'Payroll Management',
            badge: payrollSuitePendingCount || undefined,
          },
          {
            id: 'facultyfinance',
            label: 'Faculty Finance',
            badge: pendingPayrollCount || undefined,
          },
        ],
      })
    }
    if (hasStaffPermission('payment_ledger')) {
      items.push({ id: 'security', label: 'Payment Ledger', icon: 'shield' })
    }
    if (hasStaffPermission('canteen_pos')) {
      items.push({ id: 'canteenops', label: 'Canteen POS & Menu', icon: 'clipboard' })
    }
    if (hasStaffPermission('gate_security')) {
      items.push({
        id: 'nav:staff-gate',
        label: 'Gate & Security',
        icon: 'shield',
        children: [
          { id: 'safety', label: 'Pickup QR & Gate' },
          { id: 'qrid', label: 'Gate QR Scanner' },
        ],
      })
    } else if (hasStaffPermission('infirmary')) {
      items.push({ id: 'safety', label: 'Campus Infirmary', icon: 'heart' })
    }
    if (hasStaffPermission('library')) {
      items.push({ id: 'library', label: 'Smart Library', icon: 'book' })
    }
    if (hasStaffPermission('admissions')) {
      items.push({
        id: 'admissions',
        label: 'Admissions CRM',
        icon: 'userplus',
        badge: pendingAdmissionsCount || undefined,
      })
    }
    if (hasStaffPermission('documents')) {
      items.push({ id: 'documents', label: 'Report Cards & Admit', icon: 'print' })
    }
    return items
  })()

  const navGroups: NavGroup[] =
    role === 'guardian'
      ? [
          {
            heading: 'Parent Portal',
            items: [
              { id: 'home', label: 'Parent Dashboard', icon: 'home' },
              {
                id: 'nav:grd-schedule',
                label: 'Schedule & Calendar',
                icon: 'calendar',
                badge: guardianBookedPtmCount || undefined,
                children: [
                  { id: 'schedule', label: 'Class Routine' },
                  { id: 'calendar', label: 'School Calendar' },
                  {
                    id: 'ptm',
                    label: 'PTM Scheduler',
                    badge: guardianBookedPtmCount || undefined,
                  },
                ],
              },
              {
                id: 'nav:grd-academics',
                label: 'Academics & Learning',
                icon: 'book',
                badge: (pendingQuizzesCount + unseenMomentsCount + unackCareLogsCount) || undefined,
                children: [
                  {
                    id: 'quizzes',
                    label: 'Online Quizzes',
                    badge: pendingQuizzesCount || undefined,
                  },
                  { id: 'assignments', label: 'Homework Tracker' },
                  { id: 'materials', label: 'Course Materials' },
                  { id: 'library', label: 'Library & Lessons' },
                  { id: 'coach', label: 'Smart Study Coach' },
                  { id: 'leaderboard', label: 'Class Leaderboard' },
                  { id: 'house', label: 'House & Past Papers' },
                  {
                    id: 'moments',
                    label: 'Class Moments',
                    badge: unseenMomentsCount || undefined,
                  },
                  {
                    id: 'care',
                    label: 'Daily Care Log',
                    badge: unackCareLogsCount || undefined,
                  },
                ],
              },
              {
                id: 'nav:grd-exams',
                label: 'Exams & Results',
                icon: 'exam',
                badge: (unreviewedScriptsCount + unreadFeedbackCount) || undefined,
                children: [
                  { id: 'exams', label: 'Results & GPA' },
                  { id: 'documents', label: 'Report Cards & Admit' },
                  {
                    id: 'scripts',
                    label: 'Exam Sheets',
                    badge: unreviewedScriptsCount || undefined,
                  },
                  {
                    id: 'feedback',
                    label: 'Feedback & 5★ Rating',
                    badge: unreadFeedbackCount || undefined,
                  },
                ],
              },
              {
                id: 'nav:grd-safety',
                label: 'Safety, Attn. & Fees',
                icon: 'shield',
                badge: pendingConsentCount || undefined,
                children: [
                  { id: 'attendance', label: 'Attendance & Leave' },
                  { id: 'leaves', label: 'Leave Applications' },
                  { id: 'safety', label: 'Pickup QR & Health' },
                  { id: 'transport', label: 'School Bus & Stops' },
                  { id: 'qrid', label: 'Smart QR ID Card' },
                  {
                    id: 'consent',
                    label: 'Consent & Canteen',
                    badge: pendingConsentCount || undefined,
                  },
                  { id: 'payments', label: 'School Fees' },
                ],
              },
              {
                id: 'nav:grd-comms',
                label: 'Chats & Profile',
                icon: 'message',
                children: [
                  { id: 'messages', label: 'Messages' },
                  { id: 'campus', label: 'Notices & Units' },
                  { id: 'profile', label: 'Settings & Profile' },
                ],
              },
            ],
          },
        ]
      : role === 'teacher'
        ? [
            {
              heading: 'Faculty Portal',
              items: [
                {
                  id: 'home',
                  label: 'Faculty Overview',
                  icon: 'home',
                  badge: pendingLeavesCount || undefined,
                },
                {
                  id: 'tasks',
                  label: 'Assigned Tasks',
                  icon: 'clipboard',
                  badge: myOpenTasksCount || undefined,
                },
                {
                  id: 'nav:tch-schedule',
                  label: 'Schedule & Calendar',
                  icon: 'calendar',
                  badge: (teacherBookedPtmCount + pendingSubstitutionsCount) || undefined,
                  children: [
                    { id: 'schedule', label: 'Teaching Timetable' },
                    { id: 'calendar', label: 'School Calendar' },
                    {
                      id: 'ptm',
                      label: 'PTM Scheduler',
                      badge: teacherBookedPtmCount || undefined,
                    },
                    {
                      id: 'substitution',
                      label: 'Leave & Substitutes',
                      badge: pendingSubstitutionsCount || undefined,
                    },
                  ],
                },
                {
                  id: 'nav:tch-exams',
                  label: 'Exams & Grading',
                  icon: 'exam',
                  badge: (activeDeclaredExamsCount + recheckScriptsCount) || undefined,
                  children: [
                    { id: 'schedule:attendance', label: 'Exam Attendance' },
                    { id: 'schedule:marks', label: 'Teacher Marks Entry' },
                    { id: 'exams', label: 'Gradebook' },
                    {
                      id: 'scripts',
                      label: 'Exam Sheets (Scan)',
                      badge: recheckScriptsCount || undefined,
                    },
                    { id: 'documents', label: 'Report Cards & Certs' },
                  ],
                },
                {
                  id: 'nav:tch-classes',
                  label: 'Classroom & Learning',
                  icon: 'book',
                  children: [
                    { id: 'attendance', label: 'Daily Roll Call' },
                    { id: 'assignments', label: 'Homework Manager' },
                    { id: 'materials', label: 'Course Materials' },
                    { id: 'quizzes', label: 'Online Quizzes' },
                    { id: 'library', label: 'Library & Lessons' },
                    { id: 'leaderboard', label: 'Class Leaderboard' },
                    { id: 'moments', label: 'Class Moments' },
                    { id: 'care', label: 'Daily Care Log' },
                    { id: 'feedback', label: 'Student Feedback' },
                    { id: 'house', label: 'House & Pastoral' },
                  ],
                },
                {
                  id: 'nav:tch-hr',
                  label: 'HR, Finance & Safety',
                  icon: 'clock',
                  badge: pendingLeavesCount || undefined,
                  children: [
                    { id: 'facultyhr', label: 'Wi-Fi Check-In & HR' },
                    { id: 'leaves', label: 'Leave Management', badge: pendingLeavesCount || undefined },
                    { id: 'facultyfinance', label: 'Finance & Payslips' },
                    { id: 'transport', label: 'School Bus & Boarding' },
                    { id: 'qrid', label: 'Faculty QR ID Card' },
                    { id: 'safety', label: 'Gate & Infirmary' },
                    { id: 'consent', label: 'Consent Forms' },
                  ],
                },
                {
                  id: 'nav:tch-comms',
                  label: 'Chats & Profile',
                  icon: 'message',
                  children: [
                    { id: 'alerts', label: 'Parent Alert Hub' },
                    { id: 'messages', label: 'Parent Chats' },
                    { id: 'campus', label: 'School Notices' },
                    { id: 'profile', label: 'Settings & Profile' },
                  ],
                },
              ],
            },
          ]
        : role === 'admin'
          ? [
              {
                heading: 'Core Operations',
                items: [
                  { id: 'home', label: 'Command Center', icon: 'home' },
                  {
                    id: 'nav:schedule',
                    label: 'Schedule & Calendar',
                    icon: 'calendar',
                    badge: (adminBookedPtmCount + pendingSubstitutionsCount) || undefined,
                    children: adminScheduleSubmenuItems,
                  },
                  {
                    id: 'nav:exams',
                    label: 'Exam Management',
                    icon: 'exam',
                    badge: (activeDeclaredExamsCount + recheckScriptsCount) || undefined,
                    children: adminExamSubmenuItems,
                  },
                  {
                    id: 'nav:academics',
                    label: 'Academics & Learning',
                    icon: 'book',
                    children: [
                      { id: 'quizzes', label: 'Online Quizzes' },
                      { id: 'materials', label: 'Course Materials' },
                      { id: 'library', label: 'Library & Lessons' },
                      { id: 'leaderboard', label: 'Class Leaderboard' },
                      { id: 'feedback', label: 'Feedback & 5★ Ratings' },
                      { id: 'moments', label: 'Class Moments' },
                      { id: 'care', label: 'Daily Care Log' },
                      { id: 'house', label: 'House & Pastoral' },
                    ],
                  },
                  {
                    id: 'nav:attendance',
                    label: 'Attendance & Safety',
                    icon: 'shield',
                    badge: pendingLeavesCount || undefined,
                    children: [
                      { id: 'attendance', label: 'Daily Roll Call' },
                      {
                        id: 'leaves',
                        label: 'Leave Management',
                        badge: pendingLeavesCount || undefined,
                      },
                      { id: 'rfid', label: 'Finger & RF Attn.' },
                      { id: 'safety', label: 'Gate & Infirmary' },
                      { id: 'qrid', label: 'Smart QR ID Cards' },
                    ],
                  },
                  {
                    id: 'nav:accounts',
                    label: 'Accounts & Finance',
                    icon: 'payment',
                    badge: payrollSuitePendingCount || undefined,
                    children: adminFinanceSubmenuItems,
                  },
                ],
              },
              {
                heading: 'Administration & Campus',
                items: [
                  {
                    id: 'nav:people',
                    label: 'People & HR',
                    icon: 'users',
                    badge: (pendingAdmissionsCount + activeJobAppsCount) || undefined,
                    children: [
                      {
                        id: 'admissions',
                        label: 'Admissions CRM',
                        badge: pendingAdmissionsCount || undefined,
                      },
                      { id: 'directory', label: 'People & Access' },
                      { id: 'academicops', label: 'Import & Promotion' },
                      { id: 'facultyhr', label: 'Teacher Wi-Fi & HR' },
                      { id: 'roles', label: 'Roles & Staff' },
                      {
                        id: 'careers',
                        label: 'Job Applications',
                        badge: activeJobAppsCount || undefined,
                      },
                    ],
                  },
                  {
                    id: 'nav:campus',
                    label: 'Campus & Stock',
                    icon: 'clipboard',
                    badge: (lowStockBadgeCount + adminReviewTasksCount) || undefined,
                    children: [
                      { id: 'transport', label: 'Transport & School Bus' },
                      { id: 'canteenops', label: 'Canteen POS & Menu' },
                      { id: 'consent', label: 'Consent & Canteen' },
                      {
                        id: 'stock',
                        label: 'Stock Management',
                        badge: lowStockBadgeCount || undefined,
                      },
                      {
                        id: 'tasks',
                        label: 'Task Management',
                        badge: adminReviewTasksCount || undefined,
                      },
                    ],
                  },
                  {
                    id: 'nav:comms',
                    label: 'Notices & Help Desk',
                    icon: 'message',
                    badge: openHelpDeskCount || undefined,
                    children: [
                      { id: 'alerts', label: 'Parent Alert Hub' },
                      { id: 'campus', label: 'Notices & Units' },
                      { id: 'messages', label: 'Messages' },
                      {
                        id: 'helpdesk',
                        label: 'Help Desk',
                        badge: openHelpDeskCount || undefined,
                      },
                    ],
                  },
                  {
                    id: 'nav:system',
                    label: 'Reports & System',
                    icon: 'database',
                    children: [
                      { id: 'reports', label: 'Report Manager' },
                      { id: 'website', label: 'Website Design' },
                      { id: 'security', label: 'Security & Ledger' },
                      { id: 'golive', label: 'Go-Live & Cloud' },
                      { id: 'profile', label: 'Settings & Profile' },
                    ],
                  },
                ],
              },
            ]
          : role === 'staff'
            ? [
                {
                  heading: activeCustomRole?.name || 'Staff Workspace',
                  items: staffSidebarItems,
                },
                {
                  heading: 'Account',
                  items: [
                    {
                      id: 'tasks',
                      label: 'Assigned Tasks',
                      icon: 'clipboard',
                      badge: myOpenTasksCount || undefined,
                    },
                    ...(hasStaffPermission('notices')
                      ? [{ id: 'campus', label: 'School Notices', icon: 'bell' as IconName }]
                      : []),
                    { id: 'profile', label: 'Settings & Profile', icon: 'profile' },
                  ],
                },
              ]
            : [
                {
                  heading: 'Student Portal',
                  items: [
                    { id: 'home', label: 'Student Home', icon: 'home' },
                    {
                      id: 'nav:stu-schedule',
                      label: 'Schedule & Calendar',
                      icon: 'calendar',
                      children: [
                        { id: 'schedule', label: 'Class Routine' },
                        { id: 'calendar', label: 'School Calendar' },
                        { id: 'attendance', label: 'My Attendance' },
                      ],
                    },
                    {
                      id: 'nav:stu-studies',
                      label: 'Studies & Learning',
                      icon: 'book',
                      badge: pendingQuizzesCount || undefined,
                      children: [
                        { id: 'classes', label: 'My Subjects' },
                        {
                          id: 'quizzes',
                          label: 'Online Quizzes',
                          badge: pendingQuizzesCount || undefined,
                        },
                        { id: 'assignments', label: 'Homework' },
                        { id: 'materials', label: 'Course Materials' },
                        { id: 'library', label: 'Library & Lessons' },
                        { id: 'coach', label: 'Smart Study Coach' },
                        { id: 'moments', label: 'Class Moments' },
                      ],
                    },
                    {
                      id: 'nav:stu-exams',
                      label: 'Exams & Progress',
                      icon: 'exam',
                      children: [
                        { id: 'exams', label: 'Results & GPA' },
                        { id: 'documents', label: 'Report Card & Admit' },
                        { id: 'scripts', label: 'My Exam Sheets' },
                        { id: 'leaderboard', label: 'Class Leaderboard' },
                        { id: 'house', label: 'House & Past Papers' },
                        { id: 'feedback', label: 'Feedback & 5★ Rating' },
                      ],
                    },
                    {
                      id: 'nav:stu-campus',
                      label: 'Campus Life & Account',
                      icon: 'qr',
                      children: familyChildMode
                        ? [
                            { id: 'qrid', label: 'My Smart QR ID' },
                            { id: 'transport', label: 'My School Bus' },
                            { id: 'campus', label: 'Notices & Units' },
                          ]
                        : [
                            { id: 'qrid', label: 'My Smart QR ID' },
                            { id: 'transport', label: 'My School Bus' },
                            { id: 'consent', label: 'Canteen & Consent' },
                            { id: 'payments', label: 'School Fees' },
                            { id: 'campus', label: 'Notices & Units' },
                            { id: 'profile', label: 'Settings & Profile' },
                          ],
                    },
                  ],
                },
              ]

  const mobileNav: [string, string, IconName][] =
    role === 'guardian'
      ? [
          ['home', 'Home', 'home'],
          ['attendance', 'Attend', 'check'],
          ['safety', 'Safety', 'shield'],
          ['exams', 'Results', 'exam'],
          ['feedback', 'Feedback', 'star'],
        ]
      : role === 'teacher'
        ? [
            ['home', 'Home', 'home'],
            ['attendance', 'Roll Call', 'check'],
            ['feedback', 'Feedback', 'star'],
            ['exams', 'Grades', 'exam'],
            ['messages', 'Chats', 'message'],
          ]
        : role === 'admin'
          ? [
              ['home', 'Overview', 'home'],
              ['directory', 'People', 'users'],
              ['roles', 'Roles', 'key'],
              ['accounts', 'Accounts', 'payment'],
              ['campus', 'Notices', 'bell'],
            ]
          : role === 'staff'
            ? staffSidebarItems
                .slice(0, 4)
                .map(
                  (i) =>
                    [i.children?.[0]?.id || i.id, i.label.split(' ')[0], i.icon] as [
                      string,
                      string,
                      IconName,
                    ],
                )
                .concat([['profile', 'Profile', 'profile']])
            : [
                ['home', 'Home', 'home'],
                ['classes', 'Subjects', 'book'],
                ['assignments', 'Homework', 'sheet'],
                ['house', 'Papers', 'award'],
                ['exams', 'Results', 'exam'],
              ]

  const headerMeta: Record<Role, { title: string; initials: string; shortName: string }> = {
    guardian: {
      title: `Guardian Portal · ${activeGuardian?.name || GUARDIAN_PROFILE.name}`,
      initials: activeGuardian?.initials || GUARDIAN_PROFILE.initials,
      shortName: (activeGuardian?.name || 'Tariq').split(' ')[0],
    },
    student: {
      title: `Student Portal · ${activeStudent?.name || 'Araf Rahman'}`,
      initials: activeStudent?.initials || 'AR',
      shortName: (activeStudent?.name || 'Araf').split(' ')[0],
    },
    teacher: {
      title: `Faculty Workspace · ${activeTeacher?.name || TEACHER_PROFILE.name}`,
      initials: activeTeacher?.initials || TEACHER_PROFILE.initials,
      shortName: (activeTeacher?.name || 'Nadia').split(' ')[0],
    },
    admin:
      authUser.linkedEntityId === 'dev-master'
        ? {
            title: 'Developer Master Console · DMHA Developer',
            initials: 'DV',
            shortName: 'Developer',
          }
        : {
            title: 'Principal & Admin Office · Shahid',
            initials: ADMIN_PROFILE.initials,
            shortName: 'Shahid',
          },
    staff: {
      title: `${activeCustomRole?.name || 'Staff'} Workspace · ${activeStaffMember?.name || 'Staff'}`,
      initials: activeStaffMember?.initials || 'ST',
      shortName: (activeStaffMember?.name || 'Staff').split(' ')[0],
    },
  }

  const findOwnerGroupId = (targetTab: string): string | null => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (item.children?.some((c) => c.id === targetTab)) {
          return item.id
        }
      }
    }
    return null
  }

  const switchRole = (nextRole: Role) => {
    setRole(nextRole)
    setTab('home')
    setOpenGroupId(null)
    setMobileMenuOpen(false)
  }

  const navigateTo = (nextTab: string) => {
    const normalized = nextTab === 'payroll' ? 'accounts:payroll' : nextTab
    const owner = findOwnerGroupId(normalized)
    if (owner) {
      setOpenGroupId(owner)
    } else {
      setOpenGroupId(null)
    }
    setTab(normalized)
    setMobileMenuOpen(false)
  }

  const renderSidebarNav = () => (
    <nav className="mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 pb-6">
      {navGroups.map((group) => (
        <div key={group.heading}>
          <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400/70">
            {group.heading}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const hasChildren = Boolean(item.children && item.children.length > 0)
              const childActive =
                hasChildren && item.children!.some((child) => child.id === tab)
              const active = !hasChildren && tab === item.id
              const isOpen = hasChildren && openGroupId === item.id

              return (
                <div key={item.id}>
                  <button
                    type="button"
                    aria-expanded={hasChildren ? isOpen : undefined}
                    onClick={() => {
                      if (hasChildren) {
                        setOpenGroupId((prev) => (prev === item.id ? null : item.id))
                      } else {
                        navigateTo(item.id)
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                      active
                        ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-sm shadow-emerald-500/20'
                        : childActive
                          ? 'bg-white/10 text-emerald-300 font-extrabold'
                          : isOpen
                            ? 'bg-white/8 text-white font-bold'
                            : 'text-slate-300 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon name={item.icon} size={17} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="ml-2 flex shrink-0 items-center gap-1.5">
                      {item.badge && item.badge > 0 ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            active ? 'bg-slate-950 text-emerald-300' : 'bg-rose-500 text-white'
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                      {hasChildren && (
                        <span
                          className={`text-[11px] font-black transition-transform duration-200 ${
                            isOpen ? 'rotate-90 text-emerald-300' : 'text-slate-400'
                          }`}
                        >
                          ▸
                        </span>
                      )}
                    </span>
                  </button>

                  {hasChildren && isOpen && (
                    <div className="mt-1 ml-4 space-y-0.5 border-l border-white/15 pl-2.5">
                      {item.children!.map((child) => {
                        const subActive = tab === child.id
                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => navigateTo(child.id)}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold transition ${
                              subActive
                                ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-xs'
                                : 'text-slate-300/90 hover:bg-white/8 hover:text-white'
                            }`}
                          >
                            <span className="truncate">{child.label}</span>
                            {child.badge && child.badge > 0 ? (
                              <span
                                className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                                  subActive
                                    ? 'bg-slate-950 text-emerald-300'
                                    : child.id === 'accounts:payroll'
                                      ? 'bg-amber-400/20 text-amber-300'
                                      : 'bg-white/10 text-slate-300'
                                }`}
                              >
                                {child.badge}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900 selection:bg-emerald-200 selection:text-slate-950">
      <DeveloperAccountSwitcher onAccountSwitched={() => setTab('home')} />
      <div className="min-h-screen w-full lg:grid lg:grid-cols-[268px_1fr]">
        {/* Executive Navy Desktop Sidebar */}
        <aside
          className={`sticky hidden flex-col border-r border-slate-800 bg-[#0f172a] px-4 py-5 text-white lg:flex ${
            isDeveloperMode ? 'top-[44px] h-[calc(100dvh-44px)]' : 'top-0 h-[100dvh]'
          }`}
        >
          <div className="shrink-0 px-2">
            <Brand />
          </div>

          {renderSidebarNav()}

          {familyChildMode ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-emerald-300">
                  Child Study Mode
                </span>
                <Icon name="lock" size={14} className="text-emerald-300" />
              </div>
              <p className="mt-1.5 text-sm font-black text-white">{activeStudent?.name}</p>
              <p className="mt-0.5 text-[11px] text-slate-300">
                Parent controls are PIN-locked.
              </p>
              <button
                type="button"
                onClick={() => setPinModalOpen(true)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-400 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-300"
              >
                <Icon name="lock" size={13} />
                Exit to Parent Portal
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-emerald-300">
                  {role === 'guardian' ? activeChild.name : 'DMHA Live Pulse'}
                </span>
                <span className="size-2 rounded-full bg-emerald-400" />
              </div>
              <p className="mt-1.5 text-xl font-black text-white">
                {role === 'guardian' ? `${activeChild.attendanceRate}% Present` : '94% Attendance'}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                {role === 'guardian'
                  ? `GPA ${activeChild.gpa} · ${activeChild.className} ${activeChild.section}`
                  : `${students.length} students · ${teachers.length} faculty`}
              </p>
            </div>
          )}
        </aside>

        {/* Main Workspace */}
        <section className="min-w-0 pb-24 lg:pb-12">
          <header
            className={`sticky z-30 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200/80 bg-white/95 px-4 py-2.5 backdrop-blur-xl sm:px-6 lg:px-8 ${
              isDeveloperMode ? 'top-[44px]' : 'top-0'
            }`}
          >
            <div className="flex items-center gap-3 lg:hidden">
              <button
                aria-label="Open menu"
                onClick={() => setMobileMenuOpen(true)}
                className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs"
              >
                <Icon name="menu" size={19} />
              </button>
              <Brand dark />
            </div>

            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">
                DMHA · Smart Learning App · Academic Year 2026
              </p>
              <h1 className="mt-0.5 truncate text-base font-extrabold tracking-[-.02em] text-slate-900">
                {headerMeta[role].title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Global Spotlight Search Trigger (Ctrl+K) */}
              <button
                type="button"
                aria-label="Global Search"
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 shadow-xs transition hover:border-slate-300 hover:text-slate-900"
              >
                <Icon name="search" size={15} className="text-emerald-600" />
                <span className="hidden md:inline">Search DMHA...</span>
                <kbd className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-400 xl:inline">
                  Ctrl K
                </kbd>
              </button>

              {/* Installable Office Desktop App (PWA) button for Admin & Faculty */}
              {!familyChildMode && (role === 'admin' || role === 'teacher') && (
                <DesktopAppInstallButton compact />
              )}

              {/* Live SQLite Database Sync Badge — Full device count for Admin only */}
              {role === 'admin' && (
                <button
                  type="button"
                  onClick={() => navigateTo('profile')}
                  title="Live SQLite Server Database Status"
                  className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-extrabold xl:inline-flex ${
                    dbStatus === 'synced'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : dbStatus === 'saving'
                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      dbStatus === 'synced'
                        ? 'bg-emerald-500'
                        : dbStatus === 'saving'
                          ? 'animate-pulse bg-sky-500'
                          : 'bg-amber-500'
                    }`}
                  />
                  {dbStatus === 'synced'
                    ? realtimeConnected
                      ? `Live Sync · ${connectedDevices}D`
                      : 'DB Synced'
                    : dbStatus === 'saving'
                      ? 'Saving...'
                      : 'DB Local'}
                </button>
              )}

              {/* Quick Child Study Mode launcher for Guardian with Shared Phone Mode ON */}
              {!familyChildMode &&
                role === 'guardian' &&
                activeGuardian?.sharedDeviceMode !== false &&
                activeChild && (
                  <button
                    type="button"
                    onClick={() => {
                      setTab('home')
                      enterFamilyChildMode(activeChild.id)
                    }}
                    className="hidden items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-2 text-[11px] font-black text-white shadow-xs transition hover:bg-emerald-700 md:inline-flex"
                  >
                    <Icon name="book" size={14} />
                    Study Mode: {activeChild.name.split(' ')[0]}
                  </button>
                )}

              {/* Child Study Mode Exit Button (PIN-Locked) */}
              {familyChildMode && (
                <button
                  type="button"
                  onClick={() => setPinModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-black text-emerald-300 shadow-sm transition hover:bg-slate-800"
                >
                  <Icon name="lock" size={14} />
                  Return to Parent Portal
                </button>
              )}

              {/* Crisp Role Preview Switcher (Admin Session Only — Non-admin logins NEVER see this!) */}
              {!familyChildMode && demoSwitcherEnabled && authUser.role === 'admin' && (
                <div className="flex flex-wrap items-center gap-1 rounded-full border border-slate-200 bg-slate-100/90 p-1">
                  {(['guardian', 'student', 'teacher', 'admin'] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => switchRole(item)}
                      className={`rounded-full px-2.5 py-1.5 text-[11px] font-extrabold capitalize transition sm:px-3 ${
                        role === item
                          ? 'bg-[#0f172a] text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                  {staffMembers.length > 0 && (
                    <select
                      aria-label="Preview Custom Staff Role"
                      value={role === 'staff' ? activeStaffMember?.id || '' : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          impersonateStaff(e.target.value)
                          setTab('home')
                        }
                      }}
                      className={`rounded-full px-2.5 py-1.5 text-[11px] font-extrabold outline-none transition ${
                        role === 'staff'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <option value="" className="text-slate-900">
                        Staff Roles ▾
                      </option>
                      {staffMembers.map((stf) => {
                        const rDef = customRoles.find((r) => r.id === stf.customRoleId)
                        return (
                          <option key={stf.id} value={stf.id} className="text-slate-900">
                            {rDef?.name || 'Staff'} · {stf.name.split(' ')[0]}
                          </option>
                        )
                      })}
                    </select>
                  )}
                </div>
              )}

              <button
                type="button"
                aria-label={soundPrefs.enabled ? 'Mute notification sound' : 'Enable notification sound'}
                title={
                  soundPrefs.enabled
                    ? `Floating notification sound ON (${soundPrefs.preset}) — click to mute`
                    : 'Floating notification sound muted — click to enable'
                }
                onClick={() =>
                  handleUpdateSoundPrefs({ ...soundPrefs, enabled: !soundPrefs.enabled })
                }
                className={`flex size-10 items-center justify-center rounded-full border shadow-xs transition ${
                  soundPrefs.enabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                {soundPrefs.enabled ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4.5"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4.5"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="22" y1="9" x2="16" y2="15" />
                    <line x1="16" y1="9" x2="22" y2="15" />
                  </svg>
                )}
              </button>

              <button
                aria-label="Open notifications"
                onClick={() => setNotificationsOpen(true)}
                className="relative flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Icon name="bell" size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {!familyChildMode && (
                <>
                  <button
                    onClick={() => navigateTo('profile')}
                    className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pr-3 text-slate-800 shadow-xs transition hover:border-slate-300 sm:flex"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-[#0f172a] text-[11px] font-black text-emerald-400">
                      {headerMeta[role].initials}
                    </span>
                    <span className="text-xs font-extrabold">{headerMeta[role].shortName}</span>
                  </button>

                  <button
                    type="button"
                    aria-label="Sign out"
                    title="Sign out to Login Portal"
                    onClick={logout}
                    className="flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-xs transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Icon name="logout" size={16} />
                  </button>
                </>
              )}
            </div>
          </header>

          <div className="px-4 pt-6 sm:px-8 lg:px-10 lg:pt-8">
            {familyChildMode && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-[#0f172a] to-[#13293d] px-4 py-3 text-white shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
                    <Icon name="lock" size={17} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-emerald-300">
                      Merged Family Mode · Studying as {activeStudent?.name} ({activeStudent?.className})
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Quizzes, Subjects, Homework, Exam Sheets &amp; QR ID are active. Parent fees,
                      consent forms, chats &amp; role switching are PIN-locked.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPinModalOpen(true)}
                  className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-300"
                >
                  Unlock Parent Mode (PIN)
                </button>
              </div>
            )}
            {isCurrentAccountSuspended && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                <span>
                  This account is currently suspended by DMHA Administration. Portal actions are
                  restricted until reactivated.
                </span>
                <button
                  onClick={() => switchRole('admin')}
                  className="rounded-full bg-[#0f172a] px-3.5 py-1.5 text-[11px] font-extrabold text-white"
                >
                  Return to Admin
                </button>
              </div>
            )}

            {/* Home Routes */}
            {tab === 'home' && role === 'guardian' && <GuardianOverview onNavigate={navigateTo} />}
            {tab === 'home' && role === 'teacher' && <TeacherOverview onNavigate={navigateTo} />}
            {tab === 'home' && role === 'student' && <StudentOverview onNavigate={navigateTo} />}
            {tab === 'home' && role === 'admin' && <AdminOverview onNavigate={navigateTo} />}
            {tab === 'home' && role === 'staff' && <StaffOverview onNavigate={navigateTo} />}

            {/* Admin People & Access + Custom Roles + Accounts System + Admissions CRM + Canteen POS */}
            {tab === 'directory' && role === 'admin' && (
              <AdminDirectoryView onOpenPortal={() => navigateTo('home')} />
            )}
            {tab === 'roles' && role === 'admin' && (
              <AdminRolesAndStaffView onOpenPortal={() => navigateTo('home')} />
            )}
            {tab === 'canteenops' && (role === 'admin' || hasStaffPermission('canteen_pos')) && (
              <CanteenOpsView />
            )}
            {(tab === 'accounts' || tab.startsWith('accounts:') || tab === 'payroll') &&
              (role === 'admin' || hasStaffPermission('accounts') || hasStaffPermission('payroll')) && (
                <AccountsOverviewView
                  activeSubTab={
                    (tab === 'payroll'
                      ? 'payroll'
                      : tab.startsWith('accounts:')
                        ? (tab.slice('accounts:'.length) as AccountsSubTab)
                        : role === 'staff' && !hasStaffPermission('accounts')
                          ? 'payroll'
                          : 'ledger') as AccountsSubTab
                  }
                  onSelectSubTab={(sub) =>
                    navigateTo(sub === 'ledger' ? 'accounts' : `accounts:${sub}`)
                  }
                />
              )}
            {tab === 'admissions' && (role === 'admin' || hasStaffPermission('admissions')) && (
              <AdmissionsPipelineView onNavigate={navigateTo} />
            )}

            {/* Online Quizzes, Class Leaderboard, Smart Campus Modules & QR IDs */}
            {tab === 'quizzes' && <OnlineQuizzesView />}
            {tab === 'materials' && <CourseMaterialsView onNavigate={navigateTo} />}
            {tab === 'leaderboard' && <ClassLeaderboardView onNavigate={navigateTo} />}
            {tab === 'coach' && <SmartStudyCoachView onNavigate={navigateTo} />}
            {tab === 'library' && <LibraryAndLessonsView />}
            {tab === 'substitution' && (role === 'teacher' || role === 'admin') && (
              <TeacherSubstitutionView />
            )}
            {tab === 'alerts' && (role === 'teacher' || role === 'admin') && (
              <ParentAlertsHubView />
            )}
            {tab === 'facultyhr' && (role === 'teacher' || role === 'admin') && <FacultyHRView />}
            {tab === 'facultyfinance' &&
              (role === 'teacher' ||
                role === 'admin' ||
                hasStaffPermission('payroll') ||
                hasStaffPermission('accounts')) && <FacultyFinanceView />}
            {tab === 'documents' && <OfficialDocumentsView onNavigate={navigateTo} />}
            {tab === 'academicops' && role === 'admin' && <AcademicOpsView />}
            {tab === 'security' &&
              (role === 'admin' || hasStaffPermission('payment_ledger')) && (
                <SecurityAuditConsoleView />
              )}
            {tab === 'golive' && role === 'admin' && <GoLiveProductionView />}
            {tab === 'qrid' && <SmartQRIdCardsView />}

            {/* Attendance Routes */}
            {tab === 'attendance' && (role === 'teacher' || role === 'admin') && (
              <TeacherRollCallView />
            )}
            {tab === 'attendance' && role !== 'teacher' && role !== 'admin' && (
              <GuardianAttendanceView />
            )}

            {/* Exams / Results / Gradebook Routes */}
            {tab === 'exams' && (role === 'teacher' || role === 'admin') && <GradebookView />}
            {tab === 'exams' && role !== 'teacher' && role !== 'admin' && (
              <GuardianResultsView onNavigate={navigateTo} />
            )}

            {/* Feedback & 5-Star Semester Evaluation Routes (All Roles) */}
            {tab === 'feedback' && <FeedbackAndEvaluationView onNavigate={navigateTo} />}

            {/* Student Subjects */}
            {tab === 'classes' && <StudentSubjectsView onNavigate={navigateTo} />}

            {/* English Medium Premier Modules */}
            {tab === 'scripts' && <ExamSheetsView />}
            {tab === 'safety' && <SafetyAndHealthView />}
            {tab === 'house' && <EnglishMediumAcademicsView />}
            {tab === 'consent' && <ConsentAndCanteenView />}
            {tab === 'moments' && <ClassMomentsView />}
            {tab === 'calendar' && <AcademicCalendarView />}
            {tab === 'ptm' && <PtmSchedulerView />}
            {tab === 'care' && <EarlyYearsCareView />}

            {/* Admin-Only ERP Suite Routes */}
            {role === 'admin' && tab === 'helpdesk' && <HelpDeskView />}
            {role === 'admin' && tab === 'website' && <WebsiteDesignView />}
            {(role === 'admin' || role === 'teacher' || role === 'staff') && tab === 'tasks' && (
              <TaskManagementView />
            )}
            {role === 'admin' && tab === 'rfid' && <FingerRfidAttendanceView />}
            {role === 'admin' && tab === 'fines' && <FineManagementView />}
            {role === 'admin' && tab === 'meetings' && <LiveMeetingsView />}
            {role === 'admin' && tab === 'reports' && <ReportManagerView />}
            {role === 'admin' && tab === 'duty' && <EmployeeDutyView />}
            {role === 'admin' && tab === 'stock' && <StockManagementView />}
            {role === 'admin' && tab === 'qbank' && <QuestionBankView />}
            {role === 'admin' && tab === 'careers' && <JobApplicationsView />}

            {/* Shared Interactive Routes */}
            {tab === 'transport' && <TransportManagementView />}
            {tab === 'leaves' && role !== 'student' && <LeaveManagementView />}
            {tab === 'schedule' && <MasterTimetableView />}
            {tab.startsWith('schedule:') &&
              (role === 'admin' ||
                hasStaffPermission('timetable') ||
                (role === 'teacher' &&
                  (tab === 'schedule:attendance' || tab === 'schedule:marks'))) && (
                <ExamManagementHub
                  activeSubTab={tab.slice('schedule:'.length) as ExamSubTab}
                  onSelectSubTab={(sub) => navigateTo(`schedule:${sub}`)}
                  onOpenTimetable={() => navigateTo('schedule')}
                />
              )}
            {tab === 'assignments' && <AssignmentsView onNavigate={setTab} />}
            {tab === 'payments' && <PaymentsView />}
            {tab === 'messages' && <MessagesView />}
            {tab === 'campus' && <CampusServicesView />}
            {tab === 'profile' && <ProfileView />}
          </div>
        </section>
      </div>

      {/* Mobile Slide-Over Menu Drawer (Full Access to Every Module) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-[min(86vw,300px)] flex-col bg-[#0f172a] px-4 py-5 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between px-2">
              <Brand />
              <button
                aria-label="Close menu"
                onClick={() => setMobileMenuOpen(false)}
                className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            {renderSidebarNav()}
          </aside>
        </div>
      )}

      {/* Clean Mobile Bottom Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-slate-200 bg-white/95 px-2 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
        {mobileNav.map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => navigateTo(id)}
            className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-bold transition ${
              tab === id ? 'text-slate-950' : 'text-slate-400'
            }`}
          >
            <span
              className={`flex h-7 w-10 items-center justify-center rounded-full transition ${
                tab === id ? 'bg-emerald-500 text-slate-950' : ''
              }`}
            >
              <Icon name={icon} size={17} />
            </span>
            {label}
          </button>
        ))}
      </nav>

      {(() => {
        const handleSelectNotification = (item: NotificationItem) => {
          const haystack = `${item.title} ${item.text}`.toLowerCase()
          // Auto-switch selected child for Guardians when notification mentions a specific child
          if (role === 'guardian') {
            const linked = students.filter((s) =>
              activeGuardian ? activeGuardian.linkedStudentIds.includes(s.id) : false,
            )
            const matchedChild = linked.find(
              (s) =>
                haystack.includes(s.name.toLowerCase()) ||
                haystack.includes(s.name.split(' ')[0].toLowerCase()),
            )
            if (matchedChild) {
              setSelectedChildId(matchedChild.id)
            }
          }

          let targetTab = 'campus'
          if (haystack.includes('class moment')) {
            targetTab = 'moments'
          } else if (haystack.includes('ptm')) {
            targetTab = 'ptm'
          } else if (haystack.includes('daily care')) {
            targetTab = 'care'
          } else if (haystack.includes('calendar') || haystack.includes('holiday')) {
            targetTab = 'calendar'
          } else if (haystack.includes('message') || haystack.includes('reply from')) {
            targetTab = 'messages'
          } else if (
            haystack.includes('salary') ||
            haystack.includes('payslip') ||
            haystack.includes('payroll') ||
            haystack.includes('reimbursement') ||
            haystack.includes('advance') ||
            haystack.includes('allowance')
          ) {
            targetTab =
              role === 'teacher' ||
              role === 'admin' ||
              hasStaffPermission('payroll') ||
              hasStaffPermission('accounts')
                ? 'facultyfinance'
                : 'home'
          } else if (
            haystack.includes('faculty checked') ||
            haystack.includes('wi-fi') ||
            haystack.includes('training') ||
            haystack.includes('next class')
          ) {
            targetTab = role === 'teacher' || role === 'admin' ? 'facultyhr' : 'home'
          } else if (haystack.includes('substitute') || haystack.includes('teacher leave')) {
            targetTab = role === 'teacher' || role === 'admin' ? 'substitution' : 'schedule'
          } else if (
            haystack.includes('exam sheet') ||
            haystack.includes('script') ||
            haystack.includes('recheck')
          ) {
            targetTab = 'scripts'
          } else if (
            haystack.includes('consent') ||
            haystack.includes('canteen') ||
            haystack.includes('wallet')
          ) {
            targetTab = 'consent'
          } else if (haystack.includes('leave application') || haystack.includes('leave ')) {
            targetTab = role === 'teacher' || role === 'admin' ? 'home' : 'attendance'
          } else if (haystack.includes('quiz')) {
            targetTab = 'quizzes'
          } else if (
            haystack.includes('leaderboard') ||
            haystack.includes('rank') ||
            haystack.includes('top scholar')
          ) {
            targetTab = 'leaderboard'
          } else if (haystack.includes('admission') || haystack.includes('applicant')) {
            targetTab = role === 'admin' ? 'admissions' : 'home'
          } else if (
            haystack.includes('library') ||
            haystack.includes('book') ||
            haystack.includes('lesson')
          ) {
            targetTab = 'library'
          } else if (
            haystack.includes('report card') ||
            haystack.includes('admit card') ||
            haystack.includes('certificate')
          ) {
            targetTab = 'documents'
          } else if (haystack.includes('timetable') || haystack.includes('exam scheduled')) {
            targetTab = 'schedule'
          } else if (
            item.type === 'pickup' ||
            item.type === 'health' ||
            haystack.includes('pickup') ||
            haystack.includes('dismissal') ||
            haystack.includes('infirmary') ||
            haystack.includes('medical') ||
            haystack.includes('gate')
          ) {
            targetTab = 'safety'
          } else if (
            item.type === 'merit' ||
            haystack.includes('house') ||
            haystack.includes('merit') ||
            haystack.includes('pastoral')
          ) {
            targetTab = 'house'
          } else if (
            item.type === 'fee' ||
            haystack.includes('fee') ||
            haystack.includes('invoice') ||
            haystack.includes('payment') ||
            haystack.includes('receipt')
          ) {
            targetTab = role === 'admin' ? 'accounts' : 'payments'
          } else if (haystack.includes('homework') || haystack.includes('assignment')) {
            targetTab = 'assignments'
          } else if (
            item.type === 'feedback' ||
            haystack.includes('ptm') ||
            haystack.includes('feedback') ||
            haystack.includes('remark')
          ) {
            targetTab = 'feedback'
          } else if (
            item.type === 'result' ||
            haystack.includes('grade') ||
            haystack.includes('result') ||
            haystack.includes('gpa') ||
            haystack.includes('score')
          ) {
            targetTab = 'exams'
          } else if (
            item.type === 'attendance' ||
            haystack.includes('attendance') ||
            haystack.includes('roll call')
          ) {
            targetTab = 'attendance'
          }

          markNotificationRead(item.id)
          setNotificationsOpen(false)
          navigateTo(targetTab)
        }

        return (
          <>
            <FloatingNotificationCenter
              notifications={privacyScopedNotifications}
              scopeKey={`${role}:${authUser?.id || ''}:${activeStudentId}:${activeTeacherId}:${activeGuardianId}`}
              soundPrefs={soundPrefs}
              onSelectNotification={handleSelectNotification}
              onMarkRead={markNotificationRead}
            />

            {notificationsOpen && (
              <NotificationsDrawer
                role={role}
                notifications={privacyScopedNotifications}
                onMarkAllRead={markAllNotificationsRead}
                soundPrefs={soundPrefs}
                onUpdateSoundPrefs={handleUpdateSoundPrefs}
                onTestFloatingAlert={handleTestFloatingAlert}
                onSelectNotification={handleSelectNotification}
                onClose={() => setNotificationsOpen(false)}
              />
            )}
          </>
        )
      })()}

      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={navigateTo}
      />

      <ParentPinUnlockModal
        open={pinModalOpen}
        guardianName={
          guardians.find((g) => g.id === (familyLockGuardianId || activeGuardianId))?.name ||
          GUARDIAN_PROFILE.name
        }
        studentName={activeStudent?.name || 'Student'}
        onVerify={(pin) => {
          const ok = exitFamilyChildMode(pin)
          if (ok) setTab('home')
          return ok
        }}
        onClose={() => setPinModalOpen(false)}
      />

      <QuickNotebookWidget />

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full bg-[#0f172a] px-5 py-3 text-xs font-bold text-white shadow-2xl ring-1 ring-white/10 lg:bottom-8">
          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-400 text-slate-950">
            <Icon name="check" size={13} />
          </span>
          {toast}
        </div>
      )}
    </main>
  )
}

export function SchoolApp() {
  return (
    <SchoolProvider>
      <SchoolShell />
    </SchoolProvider>
  )
}
