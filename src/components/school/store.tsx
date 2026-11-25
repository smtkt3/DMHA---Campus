'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { initialAccountingBook } from '@/lib/dmhs-accounting'
import { initialExamBook } from '@/lib/dmhs-exams'
import { initialPayrollBook } from '@/lib/dmhs-payroll'
import { initialTransportBook } from '@/lib/dmhs-transport'
import {
  ADMIN_PROFILE,
  CURRENT_SEMESTER_TERM,
  GUARDIAN_PROFILE,
  initialAdmissions,
  initialAlumni,
  initialAssignments,
  initialAuditLogs,
  initialCampusWifiConfig,
  initialCanteenMenu,
  initialCanteenTransactions,
  initialCanteenWallets,
  initialChats,
  initialConsentForms,
  initialCourseMaterials,
  initialCustomRoles,
  initialDismissalLogs,
  initialExamSchedules,
  initialExamSheets,
  initialExpenses,
  initialFeedback,
  initialFees,
  initialGuardians,
  initialHouseStandings,
  initialIssuedDocuments,
  initialSemesterEvaluations,
  initialSemesterSyllabusConfig,
  initialStudyQuestProfiles,
  initialStaffMembers,
  initialLeaveRequests,
  initialLibraryBooks,
  initialMedicalLogs,
  initialMerits,
  initialAcademicCalendarEvents,
  initialCampusClubs,
  initialCampusTasks,
  initialCampusUnits,
  initialClassFeeSchedules,
  initialClassMoments,
  initialEarlyYearsCareLogs,
  initialEmployeeDuties,
  initialHelpDeskTickets,
  initialJobApplications,
  initialJobVacancies,
  initialLiveMeetings,
  initialNotices,
  initialNotifications,
  initialPtmSlots,
  initialQuestionBank,
  initialRfidDevices,
  initialRfidPunches,
  initialSchoolWebsiteConfig,
  initialStockItems,
  initialStockMovements,
  initialStudentFines,
  initialUnitTransferRequests,
  initialOtherIncomes,
  initialParentAlerts,
  initialPickupContacts,
  initialPTMRequests,
  initialQRScans,
  initialQuizAttempts,
  initialQuizzes,
  initialStudents,
  initialStudentAchievements,
  initialStudyResources,
  pastPapersVault,
  initialTeacherAttendance,
  initialTeacherLeaves,
  initialTeacherSalaries,
  initialTeacherTrainings,
  initialTeachers,
  initialTimetableSlots,
  TEACHER_PROFILE,
} from './data'
import type {
  AcademicCalendarEvent,
  AccentColor,
  AccountingBookState,
  AdmissionApplication,
  ExamBookState,
  PayrollBookState,
  AdmissionStage,
  AlumniRecord,
  AssignmentItem,
  AttendanceStatus,
  AuditLogItem,
  AuthAccountSummary,
  AuthUserSession,
  BiometricVerificationStamp,
  CampusClubItem,
  CampusTaskItem,
  CampusUnitRecord,
  CampusWifiConfig,
  CanteenMenuItem,
  CanteenTransaction,
  CanteenWallet,
  ChatThread,
  ClassFeeScheduleItem,
  ClassMomentMedia,
  ClassMomentPost,
  ConsentFormItem,
  CourseMaterialAttachment,
  CourseMaterialItem,
  CustomRoleDefinition,
  DbSyncStats,
  DismissalLogItem,
  EarlyYearsCareLog,
  EmployeeDutyShift,
  ExamScheduleEntry,
  ExamSheetItem,
  ExpenseCategory,
  ExpenseRecord,
  FeedbackCategory,
  FeeCategory,
  HelpDeskTicket,
  JobApplicationRecord,
  JobVacancyItem,
  LiveMeetingItem,
  QuestionBankItem,
  RfidDeviceRecord,
  RfidPunchLog,
  SchoolWebsiteConfig,
  StockItemRecord,
  StockMovementLog,
  StudentFineRecord,
  FeeInvoice,
  GuardianBiometricDevice,
  GuardianRecord,
  HomeworkKind,
  HomeworkSubmissionMode,
  HouseName,
  IssuedDocumentLog,
  LeaveRequest,
  LibraryBook,
  LibraryCirculationLog,
  MedicalLogItem,
  MeritLogItem,
  NotificationItem,
  OnlineQuiz,
  OtherIncomeRecord,
  ParentAlertLogItem,
  PastPaperItem,
  PeriodSlot,
  PickupContact,
  PTMRequest,
  PtmSlotItem,
  QRScanLog,
  QuizAttempt,
  QuizQuestion,
  Role,
  SchoolNotice,
  SchoolWeekday,
  SemesterEvaluationItem,
  SemesterEvaluationStatus,
  SemesterSyllabusConfig,
  StaffMemberRecord,
  StaffPermission,
  StudentAchievementItem,
  StudentRecord,
  StudyQuestProfile,
  StudyResourceItem,
  TeacherAttendanceLog,
  UnitGateStatus,
  UnitTransferRequest,
  TeacherFeedbackItem,
  TeacherLeaveSubItem,
  TeacherRecord,
  TeacherSalaryRecord,
  TeacherTrainingItem,
  TimetableSlot,
  TransportBookState,
} from './types'

interface SchoolState {
  role: Role
  setRole: (role: Role) => void
  selectedChildId: string
  setSelectedChildId: (id: string) => void
  activeGuardianId: string
  setActiveGuardianId: (id: string) => void
  activeTeacherId: string
  setActiveTeacherId: (id: string) => void
  activeStudentId: string
  setActiveStudentId: (id: string) => void
  activeStaffId: string
  setActiveStaffId: (id: string) => void
  customRoles: CustomRoleDefinition[]
  staffMembers: StaffMemberRecord[]
  canteenMenu: CanteenMenuItem[]
  activeStaffMember: StaffMemberRecord | null
  activeCustomRole: CustomRoleDefinition | null
  hasStaffPermission: (perm: StaffPermission) => boolean
  students: StudentRecord[]
  teachers: TeacherRecord[]
  guardians: GuardianRecord[]
  auditLogs: AuditLogItem[]
  feedback: TeacherFeedbackItem[]
  semesterEvaluations: SemesterEvaluationItem[]
  getSemesterEvaluationStatus: (studentId: string, term?: string) => SemesterEvaluationStatus
  courseMaterials: CourseMaterialItem[]
  semesterSyllabusConfig: SemesterSyllabusConfig
  assignments: AssignmentItem[]
  fees: FeeInvoice[]
  leaveRequests: LeaveRequest[]
  ptmRequests: PTMRequest[]
  notices: SchoolNotice[]
  campusUnits: CampusUnitRecord[]
  unitTransferRequests: UnitTransferRequest[]
  campusClubs: CampusClubItem[]
  classMoments: ClassMomentPost[]
  calendarEvents: AcademicCalendarEvent[]
  ptmSlots: PtmSlotItem[]
  earlyYearsCareLogs: EarlyYearsCareLog[]
  classFeeSchedules: ClassFeeScheduleItem[]
  siblingDiscountPct: number
  helpDeskTickets: HelpDeskTicket[]
  campusTasks: CampusTaskItem[]
  employeeDuties: EmployeeDutyShift[]
  rfidDevices: RfidDeviceRecord[]
  rfidPunches: RfidPunchLog[]
  studentFines: StudentFineRecord[]
  liveMeetings: LiveMeetingItem[]
  stockItems: StockItemRecord[]
  stockMovements: StockMovementLog[]
  questionBank: QuestionBankItem[]
  jobVacancies: JobVacancyItem[]
  jobApplications: JobApplicationRecord[]
  websiteConfig: SchoolWebsiteConfig
  accountingBook: AccountingBookState
  payrollBook: PayrollBookState
  examBook: ExamBookState
  transportBook: TransportBookState
  libraryCirculation: LibraryCirculationLog[]
  chats: ChatThread[]
  notifications: NotificationItem[]
  pickupContacts: PickupContact[]
  dismissalLogs: DismissalLogItem[]
  medicalLogs: MedicalLogItem[]
  houseStandings: Record<HouseName, number>
  merits: MeritLogItem[]
  studentAchievements: StudentAchievementItem[]
  pastPapers: PastPaperItem[]
  consentForms: ConsentFormItem[]
  canteenWallets: CanteenWallet[]
  canteenTransactions: CanteenTransaction[]
  expenses: ExpenseRecord[]
  otherIncomes: OtherIncomeRecord[]
  examSheets: ExamSheetItem[]
  quizzes: OnlineQuiz[]
  quizAttempts: QuizAttempt[]
  admissions: AdmissionApplication[]
  qrScans: QRScanLog[]
  libraryBooks: LibraryBook[]
  studyResources: StudyResourceItem[]
  teacherLeaves: TeacherLeaveSubItem[]
  parentAlerts: ParentAlertLogItem[]
  campusWifiConfig: CampusWifiConfig
  teacherAttendance: TeacherAttendanceLog[]
  teacherSalaries: TeacherSalaryRecord[]
  teacherTrainings: TeacherTrainingItem[]
  timetableSlots: TimetableSlot[]
  examSchedules: ExamScheduleEntry[]
  alumni: AlumniRecord[]
  issuedDocuments: IssuedDocumentLog[]
  studyQuestProfiles: Record<string, StudyQuestProfile>

  // Real-Time Multi-Device SSE Interconnection
  connectedDevices: number
  realtimeConnected: boolean

  // Real SQLite Database & Auth Session State
  authUser: AuthUserSession | null
  authAccounts: AuthAccountSummary[]
  authLoading: boolean
  isDeveloperMode: boolean
  devSwitchAccount: (payload: {
    targetUserId?: string
    role?: Role
    linkedEntityId?: string
  }) => Promise<{ ok: boolean; error?: string }>
  devReturnToDeveloper: () => Promise<{ ok: boolean; error?: string }>
  demoLoginAllowed: boolean
  refreshAuthAccounts: () => Promise<void>
  changeOwnPassword: (payload: {
    currentPassword: string
    newPassword: string
  }) => Promise<{ ok: boolean; error?: string }>
  adminResetUserPassword: (payload: {
    linkedEntityId: string
    role: Role
    displayName: string
    email?: string
    loginCode?: string
    status?: 'active' | 'suspended'
    newPassword?: string
  }) => Promise<{ ok: boolean; error?: string }>
  demoSwitcherEnabled: boolean
  setDemoSwitcherEnabled: (enabled: boolean) => void
  dbStatus: 'connecting' | 'synced' | 'saving' | 'offline'
  dbStats: DbSyncStats | null
  loginWithCredentials: (
    identifier: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>
  loginDemoRole: (role: Role, linkedEntityId?: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  refreshDbFromServer: () => Promise<void>

  toast: string
  notify: (message: string) => void

  // Online Quizzes (CBT — Server-Authoritative with Assigned-Class RBAC)
  createQuiz: (payload: {
    title: string
    subject: string
    className: string
    durationMins: number
    passPercentage: number
    dueDate: string
    questions: Omit<QuizQuestion, 'id'>[]
    uploadMode?: 'manual' | 'bulk'
  }) => Promise<{ ok: boolean; error?: string; quiz?: OnlineQuiz }>
  updateQuiz: (
    quizId: string,
    payload: {
      title: string
      subject: string
      className: string
      durationMins: number
      passPercentage: number
      dueDate: string
      questions: Omit<QuizQuestion, 'id'>[]
    },
  ) => Promise<{ ok: boolean; error?: string; quiz?: OnlineQuiz }>
  toggleQuizStatus: (quizId: string) => Promise<{ ok: boolean; error?: string }>
  deleteQuiz: (quizId: string) => Promise<{ ok: boolean; error?: string }>
  submitQuizAttempt: (payload: {
    quizId: string
    studentId: string
    answers: number[]
    timeTakenSec: number
  }) => Promise<{ ok: boolean; error?: string; attempt?: QuizAttempt }>
  syncQuizResultsToGradebook: (
    quizId: string,
    studentId?: string,
  ) => Promise<{ ok: boolean; error?: string; syncedCount?: number }>
  remindUnattemptedStudents: (
    quizId: string,
    studentId?: string,
  ) => Promise<{ ok: boolean; error?: string; remindedCount?: number }>

  // Admissions Pipeline (CRM)
  submitAdmissionApplication: (payload: {
    applicantName: string
    applyingClass: string
    targetSection: string
    previousSchool: string
    guardianName: string
    guardianRelation: string
    guardianPhone: string
    guardianEmail: string
    bloodGroup: string
    busRoute: string
    notes: string
  }) => AdmissionApplication
  updateAdmissionStage: (appId: string, stage: AdmissionStage) => void
  updateAdmissionTestInfo: (appId: string, payload: { testDate?: string; testScore?: number; notes?: string }) => void
  markAdmissionFeePaid: (appId: string) => void
  enrollApplicant: (appId: string) => void

  // Smart QR ID Cards (Check-In, Check-Out, Canteen Wallet Deduction, Library Issue, Bus Boarding)
  logQRCardScan: (payload: {
    cardCode: string
    holderId: string
    holderName: string
    holderRole: 'student' | 'teacher'
    checkpoint: QRScanLog['checkpoint']
    canteenItem?: string
    canteenAmount?: number
    libraryBookId?: string
  }) => { ok: boolean; message: string; remainingBalance?: number }
  processServerQRScan: (payload: {
    cardCode: string
    holderId: string
    holderName: string
    holderRole: 'student' | 'teacher'
    checkpoint: QRScanLog['checkpoint']
    canteenItem?: string
    canteenAmount?: number
    libraryBookId?: string
  }) => Promise<{ ok: boolean; message: string; remainingBalance?: number }>

  // WebAuthn Guardian Biometric Confirmation System
  biometricDevices: GuardianBiometricDevice[]
  refreshBiometricDevices: (guardianId?: string) => Promise<void>
  toggleGuardianBiometricRequired: (guardianId: string, enabled?: boolean) => void

  // Merged Guardian + Student Family Shared Mode (Child-Safe PIN Lock)
  familyChildMode: boolean
  familyLockGuardianId: string | null
  toggleGuardianSharedMode: (guardianId: string, enabled?: boolean) => void
  updateGuardianParentPin: (guardianId: string, newPin: string) => void
  enterFamilyChildMode: (studentId: string) => void
  exitFamilyChildMode: (pin: string) => boolean
  forceExitFamilyChildMode: () => void

  // Smart Library (QR Checkout) & Digital Study Hub
  issueLibraryBook: (bookId: string, studentIdOrCode: string) => { ok: boolean; error?: string }
  returnLibraryBook: (bookId: string, chargeFine?: boolean) => void
  addLibraryBook: (payload: { title: string; author: string; subject: string; isbn: string; shelf: string }) => void
  addStudyResource: (payload: {
    subject: string
    className: string
    title: string
    type: StudyResourceItem['type']
    summary: string
    durationOrPages: string
  }) => void
  trackResourceDownload: (resourceId: string) => void

  // Semester Course Materials & Syllabus Planner (Flexible Weeks)
  createCourseMaterial: (payload: {
    termName?: string
    weekNumber: number
    weekLabel?: string
    dayOfWeek: SchoolWeekday
    lessonDate: string
    periodTime?: string
    classSection: string
    subject: string
    chapterNumber?: number
    chapterTitle: string
    topicTitle: string
    learningObjectives: string[]
    classNotes: string
    examTips?: string
    textbookRef?: string
    attachments: CourseMaterialAttachment[]
    linkedHomeworkId?: string
    linkedQuizId?: string
    status: 'draft' | 'published'
  }) => Promise<{ ok: boolean; error?: string; material?: CourseMaterialItem }>
  updateCourseMaterial: (
    materialId: string,
    payload: Partial<Omit<CourseMaterialItem, 'id' | 'teacherId' | 'teacherName' | 'downloads' | 'revisedByStudentIds' | 'createdAt' | 'updatedAt'>>,
  ) => Promise<{ ok: boolean; error?: string; material?: CourseMaterialItem }>
  toggleCourseMaterialPublish: (materialId: string) => Promise<{ ok: boolean; error?: string }>
  duplicateCourseMaterialToClass: (
    materialId: string,
    targetClassSection: string,
  ) => Promise<{ ok: boolean; error?: string }>
  deleteCourseMaterial: (materialId: string) => Promise<{ ok: boolean; error?: string }>
  trackCourseMaterialDownload: (materialId: string) => Promise<void>
  toggleCourseMaterialRevised: (
    materialId: string,
    studentId: string,
  ) => Promise<{ ok: boolean; revised?: boolean }>
  updateSemesterSyllabusConfig: (payload: {
    termName: string
    totalWeeks: number
  }) => Promise<{ ok: boolean; error?: string }>

  // Smart Teacher Leave & Auto-Substitution
  requestTeacherLeave: (payload: {
    date: string
    dateIso?: string
    day?: SchoolWeekday
    period?: number
    subject?: string
    room?: string
    preferredSubstituteId?: string
    periodSlot: string
    classSection: string
    reason: string
  }) => Promise<{ ok: boolean; error?: string }>
  assignSubstituteTeacher: (
    leaveId: string,
    substituteTeacherId: string,
  ) => Promise<{ ok: boolean; error?: string; message?: string }>
  declineTeacherLeave: (leaveId: string) => Promise<{ ok: boolean; error?: string }>

  // Automated WhatsApp / SMS Parent Alert Hub
  dispatchParentAlert: (payload: {
    channel: ParentAlertLogItem['channel']
    category: ParentAlertLogItem['category']
    recipientName: string
    recipientPhone: string
    studentName: string
    message: string
  }) => void

  // Faculty Management & Anti-Cheat Campus Wi-Fi HR Suite
  updateCampusWifiConfig: (updates: Partial<CampusWifiConfig>) => void
  performTeacherWifiPunch: (payload: {
    teacherId: string
    action: 'checkin' | 'checkout'
    simulateOffCampus?: boolean
    biometricVerified?: boolean
  }) => Promise<{ ok: boolean; blocked?: boolean; error?: string; verifiedIp?: string }>
  disburseTeacherSalary: (salaryId: string) => void
  disburseAllPendingSalaries: (month?: string) => void
  generateMonthlyPayroll: (month: string) => Promise<{ ok: boolean; error?: string; createdCount?: number }>
  updateTeacherSalaryPackage: (
    salaryId: string,
    updates: { baseSalary: number; bonusAllowance: number; lateDeduction: number },
  ) => void
  assignTeacherTraining: (payload: {
    title: string
    category: TeacherTrainingItem['category']
    assignedTeacherIds: string[]
    dueDate: string
    mode: TeacherTrainingItem['mode']
    mandatory: boolean
    description: string
  }) => void
  toggleTeacherTrainingCompletion: (trainingId: string, teacherId: string) => void
  sendNextClassReminder: (teacherId: string, classSummary: string) => void

  // Master Timetable & Clash-Free Exam Scheduler
  upsertTimetableSlot: (payload: {
    id?: string
    day: SchoolWeekday
    period: number
    timeLabel: string
    className: string
    subject: string
    teacherId: string
    room: string
  }) => { ok: boolean; clashError?: string }
  deleteTimetableSlot: (slotId: string) => void
  addExamSchedule: (payload: {
    examName: string
    className: string
    subject: string
    date: string
    timeSlot: string
    room: string
    invigilatorId: string
  }) => { ok: boolean; clashError?: string }
  deleteExamSchedule: (examId: string) => void

  // Official Printable Documents & QR Verification Registry
  issueOfficialDocument: (payload: {
    docType: IssuedDocumentLog['docType']
    studentId: string
  }) => IssuedDocumentLog | null

  // Bulk CSV Importer & End-of-Year Class Promotion Wizard
  bulkImportStudents: (
    rows: {
      name: string
      className: string
      section: string
      roll: string
      guardianName: string
      guardianPhone: string
      guardianEmail?: string
      house?: HouseName
      bloodGroup?: string
      busRoute?: string
    }[],
  ) => { importedCount: number; createdGuardiansCount: number }
  promoteClassCohort: (payload: {
    fromClass: string
    toClass: string
    minPassScore: number
    archiveAsAlumni: boolean
    examId?: string
    enforceExamPass?: boolean
    overrideStudentIds?: string[]
  }) => Promise<{
    ok: boolean
    promotedCount: number
    retainedCount: number
    graduatedCount: number
    examBlockedCount: number
    verifiedExamTitle?: string | null
  }>

  // Exam Answer Sheets (Upload / Scan / Camera Photo + Cross-Role Review)
  uploadExamSheet: (payload: {
    studentId: string
    subject: string
    examTitle: string
    marksObtained: number
    totalMarks: number
    captureMethod: ExamSheetItem['captureMethod']
    scanEnhanced: boolean
    fileType: 'image' | 'pdf'
    fileDataUrl: string
    teacherRemarks: string
  }) => void
  reviewExamSheet: (
    sheetId: string,
    payload: {
      comment?: string
      requestRecheck?: boolean
      verification?: BiometricVerificationStamp
    },
  ) => void
  verifyExamSheetByAdmin: (sheetId: string) => void

  // Accounts & Overall Accounting System
  createFeeInvoice: (payload: {
    target: string // studentId or 'ALL'
    title: string
    category: FeeCategory
    amount: number
    dueDate: string
    status?: 'due' | 'paid'
  }) => void
  addExpense: (payload: {
    title: string
    category: ExpenseCategory
    vendor: string
    amount: number
    status: 'paid' | 'pending'
  }) => void
  toggleExpenseStatus: (expenseId: string) => void
  deleteExpense: (expenseId: string) => void
  addOtherIncome: (payload: {
    title: string
    category: OtherIncomeRecord['category']
    amount: number
  }) => void

  // Admin People & Access Control
  addTeacher: (payload: {
    name: string
    email: string
    phone: string
    subject: string
    department: string
    assignedClasses: string[]
    initialPassword?: string
  }) => void
  updateTeacherProfile: (
    teacherId: string,
    updates: Partial<Pick<TeacherRecord, 'name' | 'email' | 'phone' | 'subject' | 'department' | 'assignedClasses'>>,
    newPassword?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  toggleTeacherStatus: (teacherId: string) => void
  updateTeacherClasses: (teacherId: string, classes: string[]) => void
  removeTeacher: (teacherId: string) => void

  addGuardian: (payload: {
    name: string
    relation: string
    phone: string
    email: string
    linkedStudentId?: string
    initialPassword?: string
  }) => void
  updateGuardianProfile: (
    guardianId: string,
    updates: Partial<
      Pick<GuardianRecord, 'name' | 'relation' | 'phone' | 'email' | 'sharedDeviceMode' | 'parentPin'>
    >,
    newPassword?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  toggleGuardianStatus: (guardianId: string) => void
  linkStudentToGuardian: (studentId: string, guardianId: string) => void
  removeGuardian: (guardianId: string) => void

  addStudent: (payload: {
    name: string
    className: string
    section: string
    roll: string
    guardianId: string
    house: HouseName
    bloodGroup: string
    busRoute: string
    initialPassword?: string
  }) => void
  updateStudentProfile: (
    studentId: string,
    updates: Partial<
      Pick<
        StudentRecord,
        'name' | 'className' | 'section' | 'roll' | 'house' | 'bloodGroup' | 'busRoute' | 'guardianId'
      >
    >,
    newPassword?: string,
    customEmail?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  toggleStudentStatus: (studentId: string) => void
  removeStudent: (studentId: string) => void
  impersonateUser: (targetRole: Role, userId: string) => void

  // Real cross-role actions
  updateStudentAttendance: (studentId: string, status: AttendanceStatus) => void
  saveRollCallAndNotify: (
    updates: Record<string, AttendanceStatus>,
    dateIso?: string,
  ) => Promise<{ ok: boolean; error?: string; updatedCount?: number; dateIso?: string }>
  addTeacherFeedback: (payload: {
    studentId: string
    subject: string
    category: FeedbackCategory
    title: string
    message: string
  }) => Promise<{ ok: boolean; error?: string }>
  submitFamilyFeedback: (payload: {
    studentId: string
    teacherName: string
    subject: string
    category: FeedbackCategory
    title: string
    message: string
    rating?: 1 | 2 | 3 | 4 | 5
  }) => Promise<{ ok: boolean; error?: string }>
  acknowledgeFeedback: (
    feedbackId: string,
    reply?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  submitSemesterEvaluations: (payload: {
    studentId: string
    term?: string
    evaluations: Array<{
      subject: string
      teacherName: string
      teacherId?: string
      rating: 1 | 2 | 3 | 4 | 5
      teachingClarity?: 1 | 2 | 3 | 4 | 5
      supportiveness?: 1 | 2 | 3 | 4 | 5
      comment?: string
    }>
  }) => Promise<{ ok: boolean; error?: string; evaluationStatus?: SemesterEvaluationStatus }>
  updateSubjectScore: (
    studentId: string,
    subjectId: string,
    newScore: number,
    options?: { progress?: number; nextTopic?: string; assessmentLabel?: string },
  ) => Promise<{ ok: boolean; error?: string }>
  publishGradebookBatch: (payload: {
    assessmentLabel?: string
    entries: Array<{
      studentId: string
      subjectId?: string
      subjectName?: string
      score: number
      progress?: number
      nextTopic?: string
    }>
  }) => Promise<{ ok: boolean; error?: string; updatedCount?: number }>
  addGradebookSubject: (payload: {
    studentId?: string
    classSection?: string
    subjectName: string
    teacherName?: string
    initialScore?: number
    nextTopic?: string
  }) => Promise<{ ok: boolean; error?: string; addedCount?: number }>
  uploadGradebookExamSheet: (payload: {
    studentId: string
    subject: string
    subjectId?: string
    examTitle: string
    marksObtained: number
    totalMarks: number
    captureMethod: ExamSheetItem['captureMethod']
    scanEnhanced: boolean
    fileType: 'image' | 'pdf'
    fileDataUrl: string
    teacherRemarks: string
    syncToGradebook?: boolean
  }) => Promise<{ ok: boolean; error?: string; sheet?: ExamSheetItem }>
  submitAssignment: (
    assignmentId: string,
    studentNote?: string,
    extra?: {
      submittedVia?: 'offline' | 'online'
      onlineResponseText?: string
      onlineAttachmentName?: string
      onlineAttachmentUrl?: string
    },
  ) => void
  markOfflineCopyReceived: (assignmentId: string) => void
  toggleAssignmentStep: (assignmentId: string, stepIndex: number) => void
  gradeAssignment: (assignmentId: string, score: string, teacherRemark?: string) => void
  createAssignment: (payload: {
    title: string
    subject: string
    dueDate: string
    className?: string
    kind?: HomeworkKind
    submissionMode?: HomeworkSubmissionMode
    offlineDropoffLocation?: string
    assignedDay?: SchoolWeekday
    submissionIso?: string
    submissionTime?: string
    estimatedMins?: number
    instructions?: string
    howToSteps?: string[]
    whatToStudy?: string[]
    studyTip?: string
    submissionFormat?: string
    chapterTitle?: string
    linkedMaterialId?: string
  }) => void
  payFeeInvoice: (feeId: string) => void
  submitLeaveRequest: (payload: {
    studentId: string
    dateRange: string
    reason: string
    verification?: BiometricVerificationStamp
  }) => void
  updateLeaveStatus: (leaveId: string, status: 'approved' | 'declined') => void
  addLeaveDiscussionMessage: (leaveId: string, text: string) => void
  bookPTM: (payload: {
    studentId: string
    teacherName: string
    subject: string
    slot: string
    topic: string
  }) => void
  publishNotice: (payload: {
    title: string
    body: string
    category: SchoolNotice['category']
    audience: SchoolNotice['audience']
    targetUnit?: string
    targetClass?: string
    eventDate?: string
    pinned?: boolean
    requireAcknowledgement?: boolean
  }) => Promise<{ ok: boolean; error?: string }>
  updateNotice: (payload: {
    noticeId: string
    title: string
    body: string
    category: SchoolNotice['category']
    audience: SchoolNotice['audience']
    targetUnit?: string
    targetClass?: string
    eventDate?: string
    pinned?: boolean
    requireAcknowledgement?: boolean
  }) => Promise<{ ok: boolean; error?: string }>
  togglePinNotice: (noticeId: string) => Promise<{ ok: boolean; error?: string }>
  deleteNotice: (noticeId: string) => Promise<{ ok: boolean; error?: string }>
  acknowledgeNotice: (noticeId: string) => Promise<{ ok: boolean; error?: string }>
  saveCampusUnit: (payload: {
    id?: string
    name: string
    code?: string
    subtitle?: string
    gradesCovered?: string
    address?: string
    gateHours: string
    gateStatus: UnitGateStatus
    coordinatorName?: string
    coordinatorPhone?: string
    facilities?: string[]
    statusNote?: string
    accent?: CampusUnitRecord['accent']
  }) => Promise<{ ok: boolean; error?: string }>
  setCampusUnitGateStatus: (
    unitId: string,
    gateStatus: UnitGateStatus,
    statusNote?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  deleteCampusUnit: (unitId: string) => Promise<{ ok: boolean; error?: string }>
  reassignStudentUnit: (
    studentId: string,
    targetUnit: string,
  ) => Promise<{ ok: boolean; error?: string }>
  requestUnitTransfer: (payload: {
    studentId: string
    toUnit: string
    reason: string
  }) => Promise<{ ok: boolean; error?: string }>
  reviewUnitTransfer: (
    requestId: string,
    decision: 'approved' | 'declined',
    reviewNote?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  toggleCampusClubMembership: (
    clubId: string,
    studentId: string,
  ) => Promise<{ ok: boolean; error?: string }>
  addCampusClub: (payload: {
    name: string
    schedule: string
    mentor?: string
    unitName?: string
    category?: CampusClubItem['category']
  }) => Promise<{ ok: boolean; error?: string }>
  createClassMoment: (payload: {
    className: string
    section: string
    subject: string
    title: string
    caption: string
    dateIso?: string
    media: ClassMomentMedia[]
  }) => Promise<{
    ok: boolean
    error?: string
    deliveredToGuardians?: number
    deliveredToStudents?: number
  }>
  reactClassMoment: (
    momentId: string,
    opts?: { toggleLike?: boolean; markSeen?: boolean },
  ) => Promise<{ ok: boolean; error?: string }>
  commentClassMoment: (
    momentId: string,
    text: string,
  ) => Promise<{ ok: boolean; error?: string }>
  deleteClassMoment: (momentId: string) => Promise<{ ok: boolean; error?: string }>
  createCalendarEvent: (payload: {
    title: string
    dateIso: string
    endDateIso?: string
    category: AcademicCalendarEvent['category']
    targetUnit?: string
    description?: string
    isSchoolClosed?: boolean
  }) => Promise<{ ok: boolean; error?: string }>
  deleteCalendarEvent: (eventId: string) => Promise<{ ok: boolean; error?: string }>
  createPtmSlots: (payload: {
    teacherId?: string
    dateIso: string
    startTime: string
    endTime: string
    durationMins?: number
    mode: PtmSlotItem['mode']
    roomOrLink?: string
  }) => Promise<{ ok: boolean; error?: string; createdCount?: number }>
  bookPtmSlot: (payload: {
    slotId: string
    studentId: string
    topic?: string
  }) => Promise<{ ok: boolean; error?: string }>
  cancelPtmSlot: (slotId: string) => Promise<{ ok: boolean; error?: string }>
  completePtmSlot: (slotId: string, outcomeNotes: string) => Promise<{ ok: boolean; error?: string }>
  deletePtmSlot: (slotId: string) => Promise<{ ok: boolean; error?: string }>
  logEarlyYearsCare: (payload: {
    studentId: string
    dateIso?: string
    mealStatus: EarlyYearsCareLog['mealStatus']
    mood: EarlyYearsCareLog['mood']
    napOrActivity?: string
    hygieneOrHealth?: string
    teacherNote?: string
  }) => Promise<{ ok: boolean; error?: string }>
  acknowledgeEarlyYearsCare: (
    logId: string,
    guardianReply?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  deleteEarlyYearsCare: (logId: string) => Promise<{ ok: boolean; error?: string }>
  saveClassFeeSchedules: (
    schedules: ClassFeeScheduleItem[],
    siblingDiscountPct: number,
  ) => Promise<{ ok: boolean; error?: string }>
  generateMonthlyFeeInvoices: (payload: {
    billingMonth: string
    dueDate: string
    targetClass?: string
    siblingDiscountPct?: number
    includeActivityFee?: boolean
  }) => Promise<{
    ok: boolean
    error?: string
    createdCount?: number
    skippedDuplicates?: number
    siblingDiscountsApplied?: number
    totalDiscountBdt?: number
    totalBilled?: number
  }>
  sendBulkFeeReminders: () => Promise<{ ok: boolean; error?: string; remindedCount?: number }>
  runErpOps: (
    payload: Record<string, unknown>,
    successMsg?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  runErpCampus: (
    payload: Record<string, unknown>,
    successMsg?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  runAccountingAction: (
    payload: Record<string, unknown>,
    successMsg?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  runPayrollAction: (
    payload: Record<string, unknown>,
    successMsg?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  runExamAction: (
    payload: Record<string, unknown>,
    successMsg?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  runMessageAction: (
    payload: Record<string, unknown>,
    successMsg?: string,
  ) => Promise<{ ok: boolean; error?: string; threadId?: string }>
  runLibraryAction: (
    payload: Record<string, unknown>,
    successMsg?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  runTransportAction: (
    payload: Record<string, unknown>,
    successMsg?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  runLeaveAction: (
    payload: Record<string, unknown>,
    successMsg?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  runTaskAction: (
    payload: Record<string, unknown>,
    successMsg?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  sendChatMessage: (threadId: string, text: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  addPickupContact: (payload: {
    studentId: string
    name: string
    relation: string
    phone: string
    idNumber: string
  }) => void
  logGateDismissal: (payload: { studentId: string; pickedUpBy: string; gate: string }) => void
  addMedicalLog: (payload: {
    studentId: string
    symptom: string
    actionTaken: string
    severity: MedicalLogItem['severity']
  }) => void
  awardMeritOrPastoral: (payload: {
    studentId: string
    house: HouseName
    points: number
    type: 'merit' | 'pastoral'
    category?: MeritLogItem['category']
    tier?: MeritLogItem['tier']
    actionPlan?: string
    reason: string
    studyQuestReward?: boolean
  }) => Promise<{ ok: boolean; error?: string }>
  updatePastoralCase: (payload: {
    entryId: string
    pastoralStatus?: 'open' | 'follow_up' | 'resolved'
    tier?: MeritLogItem['tier']
    actionPlan?: string
    followUpNote?: string
  }) => Promise<{ ok: boolean; error?: string }>
  acknowledgeMeritOrPastoral: (
    entryId: string,
    guardianReply?: string,
  ) => Promise<{ ok: boolean; error?: string }>
  deleteMeritOrPastoral: (entryId: string) => Promise<{ ok: boolean; error?: string }>
  reassignStudentHouse: (
    studentId: string,
    house: HouseName,
  ) => Promise<{ ok: boolean; error?: string }>
  addStudentAchievement: (payload: {
    studentId: string
    title: string
    detail: string
    category: StudentAchievementItem['category']
    bonusPoints?: number
  }) => Promise<{ ok: boolean; error?: string }>
  addPastPaperItem: (payload: {
    title: string
    subject: string
    board: PastPaperItem['board']
    year: string
    paperCode: string
    summary?: string
    hasMarkScheme?: boolean
    fileUrl?: string
    fileName?: string
  }) => Promise<{ ok: boolean; error?: string }>
  deletePastPaperItem: (paperId: string) => Promise<{ ok: boolean; error?: string }>
  syncLeaderboardRanks: () => Promise<{ ok: boolean; error?: string; updatedCount?: number }>
  signConsentForm: (
    formId: string,
    verification?: BiometricVerificationStamp,
    extra?: { emergencyPhone?: string; medicalNote?: string; guardianComment?: string },
  ) => Promise<{ ok: boolean; error?: string }>
  declineConsentForm: (
    formId: string,
    reason: string,
  ) => Promise<{ ok: boolean; error?: string }>
  createConsentForm: (payload: {
    targetType?: 'all' | 'class' | 'student'
    targetValue?: string
    studentId?: string
    title: string
    eventDate: string
    deadlineDate?: string
    venue?: string
    feeAmount?: number
    category: ConsentFormItem['category']
    details: string
  }) => Promise<{ ok: boolean; error?: string; createdCount?: number }>
  remindConsentForm: (payload: {
    formId?: string
    campaignId?: string
  }) => Promise<{ ok: boolean; error?: string; remindedCount?: number }>
  deleteConsentForm: (payload: {
    formId?: string
    campaignId?: string
  }) => Promise<{ ok: boolean; error?: string }>
  topUpCanteenWallet: (studentId: string, amount: number) => void
  updateCanteenLimit: (studentId: string, limit: number) => void
  completeStudyMission: (payload: {
    studentId: string
    missionId: string
    title: string
    subject: string
    xpReward: number
    focusMinutes?: number
  }) => void
  logStudyFocusSession: (payload: {
    studentId: string
    subject: string
    minutes: number
    xpReward: number
  }) => void
  clearStudyBossBattle: (payload: {
    studentId: string
    bossId: string
    bossName: string
    subject: string
    xpReward: number
  }) => void
  sendGuardianStudyCheer: (studentId: string) => void

  // Custom Staff Roles, Staff Directory & Canteen Menu Manager
  createCustomRole: (payload: {
    name: string
    description: string
    accent: CustomRoleDefinition['accent']
    permissions: StaffPermission[]
  }) => CustomRoleDefinition
  updateCustomRolePermissions: (roleId: string, permissions: StaffPermission[]) => void
  deleteCustomRole: (roleId: string) => { ok: boolean; error?: string }
  addStaffMember: (payload: {
    name: string
    email: string
    phone: string
    customRoleId: string
    department: string
    initialPassword?: string
  }) => Promise<{ ok: boolean; error?: string }>
  toggleStaffStatus: (staffId: string) => void
  removeStaffMember: (staffId: string) => void
  impersonateStaff: (staffId: string) => void
  addCanteenMenuItem: (payload: {
    name: string
    category: CanteenMenuItem['category']
    price: number
    allergens?: string
  }) => void
  toggleCanteenMenuAvailability: (itemId: string) => void
  updateCanteenMenuItemPrice: (itemId: string, price: number) => void
  deleteCanteenMenuItem: (itemId: string) => void

  resetDemoData: () => void
}

const STORAGE_KEY = 'dmhs-school-os-v8'

const SchoolContext = createContext<SchoolState | null>(null)

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'US'
}

function scoreToGrade(score: number): string {
  if (score >= 80) return 'A+'
  if (score >= 70) return 'A'
  if (score >= 60) return 'A-'
  if (score >= 50) return 'B'
  if (score >= 40) return 'C'
  return 'F'
}

function calcGpa(avg: number): string {
  const val = Math.min(5, Math.max(1, (avg / 100) * 5.35))
  return val.toFixed(2)
}

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>('guardian')
  const [selectedChildId, setSelectedChildId] = useState<string>('stu-araf')
  const [activeGuardianId, setActiveGuardianId] = useState<string>('grd-tariq')
  const [activeTeacherId, setActiveTeacherId] = useState<string>('tch-nadia')
  const [activeStudentId, setActiveStudentId] = useState<string>('stu-araf')
  const [activeStaffId, setActiveStaffId] = useState<string>('stf-rafiqul')
  const [customRoles, setCustomRoles] = useState<CustomRoleDefinition[]>(initialCustomRoles)
  const [staffMembers, setStaffMembers] = useState<StaffMemberRecord[]>(initialStaffMembers)
  const [canteenMenu, setCanteenMenu] = useState<CanteenMenuItem[]>(initialCanteenMenu)
  const [students, setStudents] = useState<StudentRecord[]>(initialStudents)
  const [teachers, setTeachers] = useState<TeacherRecord[]>(initialTeachers)
  const [guardians, setGuardians] = useState<GuardianRecord[]>(initialGuardians)
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(initialAuditLogs)
  const [feedback, setFeedback] = useState<TeacherFeedbackItem[]>(initialFeedback)
  const [semesterEvaluations, setSemesterEvaluations] = useState<SemesterEvaluationItem[]>(
    initialSemesterEvaluations,
  )
  const [courseMaterials, setCourseMaterials] = useState<CourseMaterialItem[]>(
    initialCourseMaterials,
  )
  const [semesterSyllabusConfig, setSemesterSyllabusConfig] = useState<SemesterSyllabusConfig>(
    initialSemesterSyllabusConfig,
  )
  const [assignments, setAssignments] = useState<AssignmentItem[]>(initialAssignments)
  const [fees, setFees] = useState<FeeInvoice[]>(initialFees)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(initialLeaveRequests)
  const [ptmRequests, setPtmRequests] = useState<PTMRequest[]>(initialPTMRequests)
  const [notices, setNotices] = useState<SchoolNotice[]>(initialNotices)
  const [campusUnits, setCampusUnits] = useState<CampusUnitRecord[]>(initialCampusUnits)
  const [unitTransferRequests, setUnitTransferRequests] = useState<UnitTransferRequest[]>(
    initialUnitTransferRequests,
  )
  const [campusClubs, setCampusClubs] = useState<CampusClubItem[]>(initialCampusClubs)
  const [classMoments, setClassMoments] = useState<ClassMomentPost[]>(initialClassMoments)
  const [calendarEvents, setCalendarEvents] = useState<AcademicCalendarEvent[]>(
    initialAcademicCalendarEvents,
  )
  const [ptmSlots, setPtmSlots] = useState<PtmSlotItem[]>(initialPtmSlots)
  const [earlyYearsCareLogs, setEarlyYearsCareLogs] = useState<EarlyYearsCareLog[]>(
    initialEarlyYearsCareLogs,
  )
  const [classFeeSchedules, setClassFeeSchedules] = useState<ClassFeeScheduleItem[]>(
    initialClassFeeSchedules,
  )
  const [siblingDiscountPct, setSiblingDiscountPct] = useState<number>(10)
  const [helpDeskTickets, setHelpDeskTickets] = useState<HelpDeskTicket[]>(initialHelpDeskTickets)
  const [campusTasks, setCampusTasks] = useState<CampusTaskItem[]>(initialCampusTasks)
  const [employeeDuties, setEmployeeDuties] = useState<EmployeeDutyShift[]>(initialEmployeeDuties)
  const [rfidDevices, setRfidDevices] = useState<RfidDeviceRecord[]>(initialRfidDevices)
  const [rfidPunches, setRfidPunches] = useState<RfidPunchLog[]>(initialRfidPunches)
  const [studentFines, setStudentFines] = useState<StudentFineRecord[]>(initialStudentFines)
  const [liveMeetings, setLiveMeetings] = useState<LiveMeetingItem[]>(initialLiveMeetings)
  const [stockItems, setStockItems] = useState<StockItemRecord[]>(initialStockItems)
  const [stockMovements, setStockMovements] = useState<StockMovementLog[]>(initialStockMovements)
  const [questionBank, setQuestionBank] = useState<QuestionBankItem[]>(initialQuestionBank)
  const [jobVacancies, setJobVacancies] = useState<JobVacancyItem[]>(initialJobVacancies)
  const [jobApplications, setJobApplications] =
    useState<JobApplicationRecord[]>(initialJobApplications)
  const [websiteConfig, setWebsiteConfig] = useState<SchoolWebsiteConfig>(
    initialSchoolWebsiteConfig,
  )
  const [accountingBook, setAccountingBook] = useState<AccountingBookState>(initialAccountingBook)
  const [payrollBook, setPayrollBook] = useState<PayrollBookState>(initialPayrollBook)
  const [examBook, setExamBook] = useState<ExamBookState>(initialExamBook)
  const [transportBook, setTransportBook] = useState<TransportBookState>(initialTransportBook)
  const [libraryCirculation, setLibraryCirculation] = useState<LibraryCirculationLog[]>([])
  const [chats, setChats] = useState<ChatThread[]>(initialChats)
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications)
  const [pickupContacts, setPickupContacts] = useState<PickupContact[]>(initialPickupContacts)
  const [dismissalLogs, setDismissalLogs] = useState<DismissalLogItem[]>(initialDismissalLogs)
  const [medicalLogs, setMedicalLogs] = useState<MedicalLogItem[]>(initialMedicalLogs)
  const [houseStandings, setHouseStandings] =
    useState<Record<HouseName, number>>(initialHouseStandings)
  const [merits, setMerits] = useState<MeritLogItem[]>(initialMerits)
  const [studentAchievements, setStudentAchievements] = useState<StudentAchievementItem[]>(
    initialStudentAchievements,
  )
  const [pastPapers, setPastPapers] = useState<PastPaperItem[]>(pastPapersVault)
  const [consentForms, setConsentForms] = useState<ConsentFormItem[]>(initialConsentForms)
  const [canteenWallets, setCanteenWallets] = useState<CanteenWallet[]>(initialCanteenWallets)
  const [canteenTransactions, setCanteenTransactions] = useState<CanteenTransaction[]>(
    initialCanteenTransactions,
  )
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(initialExpenses)
  const [otherIncomes, setOtherIncomes] = useState<OtherIncomeRecord[]>(initialOtherIncomes)
  const [examSheets, setExamSheets] = useState<ExamSheetItem[]>(initialExamSheets)
  const [quizzes, setQuizzes] = useState<OnlineQuiz[]>(initialQuizzes)
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>(initialQuizAttempts)
  const [admissions, setAdmissions] = useState<AdmissionApplication[]>(initialAdmissions)
  const [qrScans, setQrScans] = useState<QRScanLog[]>(initialQRScans)
  const [libraryBooks, setLibraryBooks] = useState<LibraryBook[]>(initialLibraryBooks)
  const [studyResources, setStudyResources] = useState<StudyResourceItem[]>(initialStudyResources)
  const [teacherLeaves, setTeacherLeaves] = useState<TeacherLeaveSubItem[]>(initialTeacherLeaves)
  const [parentAlerts, setParentAlerts] = useState<ParentAlertLogItem[]>(initialParentAlerts)
  const [campusWifiConfig, setCampusWifiConfig] =
    useState<CampusWifiConfig>(initialCampusWifiConfig)
  const [teacherAttendance, setTeacherAttendance] = useState<TeacherAttendanceLog[]>(
    initialTeacherAttendance,
  )
  const [teacherSalaries, setTeacherSalaries] =
    useState<TeacherSalaryRecord[]>(initialTeacherSalaries)
  const [teacherTrainings, setTeacherTrainings] =
    useState<TeacherTrainingItem[]>(initialTeacherTrainings)
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>(initialTimetableSlots)
  const [examSchedules, setExamSchedules] = useState<ExamScheduleEntry[]>(initialExamSchedules)
  const [alumni, setAlumni] = useState<AlumniRecord[]>(initialAlumni)
  const [issuedDocuments, setIssuedDocuments] =
    useState<IssuedDocumentLog[]>(initialIssuedDocuments)
  const [studyQuestProfiles, setStudyQuestProfiles] =
    useState<Record<string, StudyQuestProfile>>(initialStudyQuestProfiles)

  const [connectedDevices, setConnectedDevices] = useState(1)
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  const [authUser, setAuthUser] = useState<AuthUserSession | null>(null)
  const [authAccounts, setAuthAccounts] = useState<AuthAccountSummary[]>([])
  const [biometricDevices, setBiometricDevices] = useState<GuardianBiometricDevice[]>([])
  const [authLoading, setAuthLoading] = useState(true)
  const [isDeveloperMode, setIsDeveloperMode] = useState(false)
  const [demoLoginAllowed, setDemoLoginAllowed] = useState(true)
  const [demoSwitcherEnabled, setDemoSwitcherEnabled] = useState(true)
  const [familyChildMode, setFamilyChildMode] = useState(false)
  const [familyLockGuardianId, setFamilyLockGuardianId] = useState<string | null>(null)
  const [dbStatus, setDbStatus] = useState<'connecting' | 'synced' | 'saving' | 'offline'>(
    'connecting',
  )
  const [dbStats, setDbStats] = useState<DbSyncStats | null>(null)

  const [toast, setToast] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const skipNextServerSaveRef = useRef(false)
  const stateVersionRef = useRef<number>(0)
  const saveTimerRef = useRef<number | null>(null)
  const clientIdRef = useRef<string>(
    `cli-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
  )

  const applySerializedPayload = (parsed: Record<string, unknown>) => {
    if (Array.isArray(parsed.students)) setStudents(parsed.students as StudentRecord[])
    if (Array.isArray(parsed.teachers)) setTeachers(parsed.teachers as TeacherRecord[])
    if (Array.isArray(parsed.guardians)) setGuardians(parsed.guardians as GuardianRecord[])
    if (Array.isArray(parsed.auditLogs)) setAuditLogs(parsed.auditLogs as AuditLogItem[])
    if (Array.isArray(parsed.feedback)) setFeedback(parsed.feedback as TeacherFeedbackItem[])
    if (Array.isArray(parsed.semesterEvaluations)) {
      setSemesterEvaluations(parsed.semesterEvaluations as SemesterEvaluationItem[])
    }
    if (Array.isArray(parsed.courseMaterials)) {
      setCourseMaterials(parsed.courseMaterials as CourseMaterialItem[])
    }
    if (parsed.semesterSyllabusConfig && typeof parsed.semesterSyllabusConfig === 'object') {
      setSemesterSyllabusConfig(parsed.semesterSyllabusConfig as SemesterSyllabusConfig)
    }
    if (Array.isArray(parsed.assignments)) setAssignments(parsed.assignments as AssignmentItem[])
    if (Array.isArray(parsed.fees)) setFees(parsed.fees as FeeInvoice[])
    if (Array.isArray(parsed.leaveRequests)) setLeaveRequests(parsed.leaveRequests as LeaveRequest[])
    if (Array.isArray(parsed.ptmRequests)) setPtmRequests(parsed.ptmRequests as PTMRequest[])
    if (Array.isArray(parsed.notices)) setNotices(parsed.notices as SchoolNotice[])
    if (Array.isArray(parsed.campusUnits) && parsed.campusUnits.length > 0) {
      setCampusUnits(parsed.campusUnits as CampusUnitRecord[])
    }
    if (Array.isArray(parsed.unitTransferRequests)) {
      setUnitTransferRequests(parsed.unitTransferRequests as UnitTransferRequest[])
    }
    if (Array.isArray(parsed.campusClubs) && parsed.campusClubs.length > 0) {
      setCampusClubs(parsed.campusClubs as CampusClubItem[])
    }
    if (Array.isArray(parsed.classMoments)) {
      setClassMoments(parsed.classMoments as ClassMomentPost[])
    }
    if (Array.isArray(parsed.calendarEvents) && parsed.calendarEvents.length > 0) {
      setCalendarEvents(parsed.calendarEvents as AcademicCalendarEvent[])
    }
    if (Array.isArray(parsed.ptmSlots)) {
      setPtmSlots(parsed.ptmSlots as PtmSlotItem[])
    }
    if (Array.isArray(parsed.earlyYearsCareLogs)) {
      setEarlyYearsCareLogs(parsed.earlyYearsCareLogs as EarlyYearsCareLog[])
    }
    if (Array.isArray(parsed.classFeeSchedules) && parsed.classFeeSchedules.length > 0) {
      setClassFeeSchedules(parsed.classFeeSchedules as ClassFeeScheduleItem[])
    }
    if (typeof parsed.siblingDiscountPct === 'number') {
      setSiblingDiscountPct(parsed.siblingDiscountPct)
    }
    if (Array.isArray(parsed.helpDeskTickets)) {
      setHelpDeskTickets(parsed.helpDeskTickets as HelpDeskTicket[])
    }
    if (Array.isArray(parsed.campusTasks)) {
      setCampusTasks(parsed.campusTasks as CampusTaskItem[])
    }
    if (Array.isArray(parsed.employeeDuties)) {
      setEmployeeDuties(parsed.employeeDuties as EmployeeDutyShift[])
    }
    if (Array.isArray(parsed.rfidDevices)) {
      setRfidDevices(parsed.rfidDevices as RfidDeviceRecord[])
    }
    if (Array.isArray(parsed.rfidPunches)) {
      setRfidPunches(parsed.rfidPunches as RfidPunchLog[])
    }
    if (Array.isArray(parsed.studentFines)) {
      setStudentFines(parsed.studentFines as StudentFineRecord[])
    }
    if (Array.isArray(parsed.liveMeetings)) {
      setLiveMeetings(parsed.liveMeetings as LiveMeetingItem[])
    }
    if (Array.isArray(parsed.stockItems)) {
      setStockItems(parsed.stockItems as StockItemRecord[])
    }
    if (Array.isArray(parsed.stockMovements)) {
      setStockMovements(parsed.stockMovements as StockMovementLog[])
    }
    if (Array.isArray(parsed.questionBank)) {
      setQuestionBank(parsed.questionBank as QuestionBankItem[])
    }
    if (Array.isArray(parsed.jobVacancies)) {
      setJobVacancies(parsed.jobVacancies as JobVacancyItem[])
    }
    if (Array.isArray(parsed.jobApplications)) {
      setJobApplications(parsed.jobApplications as JobApplicationRecord[])
    }
    if (parsed.websiteConfig && typeof parsed.websiteConfig === 'object') {
      setWebsiteConfig(parsed.websiteConfig as SchoolWebsiteConfig)
    }
    if (
      parsed.accountingBook &&
      typeof parsed.accountingBook === 'object' &&
      Array.isArray((parsed.accountingBook as AccountingBookState).ledgers)
    ) {
      setAccountingBook(parsed.accountingBook as AccountingBookState)
    }
    if (
      parsed.payrollBook &&
      typeof parsed.payrollBook === 'object' &&
      Array.isArray((parsed.payrollBook as PayrollBookState).employees)
    ) {
      setPayrollBook(parsed.payrollBook as PayrollBookState)
    }
    if (
      parsed.examBook &&
      typeof parsed.examBook === 'object' &&
      Array.isArray((parsed.examBook as ExamBookState).declaredExams)
    ) {
      setExamBook(parsed.examBook as ExamBookState)
    }
    if (
      parsed.transportBook &&
      typeof parsed.transportBook === 'object' &&
      Array.isArray((parsed.transportBook as TransportBookState).routes)
    ) {
      setTransportBook(parsed.transportBook as TransportBookState)
    }
    if (Array.isArray(parsed.libraryCirculation)) {
      setLibraryCirculation(parsed.libraryCirculation as LibraryCirculationLog[])
    }
    if (Array.isArray(parsed.chats)) setChats(parsed.chats as ChatThread[])
    if (Array.isArray(parsed.notifications)) setNotifications(parsed.notifications as NotificationItem[])
    if (Array.isArray(parsed.pickupContacts)) setPickupContacts(parsed.pickupContacts as PickupContact[])
    if (Array.isArray(parsed.dismissalLogs)) setDismissalLogs(parsed.dismissalLogs as DismissalLogItem[])
    if (Array.isArray(parsed.medicalLogs)) setMedicalLogs(parsed.medicalLogs as MedicalLogItem[])
    if (parsed.houseStandings && typeof parsed.houseStandings === 'object') {
      setHouseStandings(parsed.houseStandings as Record<HouseName, number>)
    }
    if (Array.isArray(parsed.merits)) setMerits(parsed.merits as MeritLogItem[])
    if (Array.isArray(parsed.studentAchievements)) {
      setStudentAchievements(parsed.studentAchievements as StudentAchievementItem[])
    }
    if (Array.isArray(parsed.pastPapers) && parsed.pastPapers.length > 0) {
      setPastPapers(parsed.pastPapers as PastPaperItem[])
    }
    if (Array.isArray(parsed.consentForms)) setConsentForms(parsed.consentForms as ConsentFormItem[])
    if (Array.isArray(parsed.canteenWallets)) setCanteenWallets(parsed.canteenWallets as CanteenWallet[])
    if (Array.isArray(parsed.canteenTransactions)) {
      setCanteenTransactions(parsed.canteenTransactions as CanteenTransaction[])
    }
    if (Array.isArray(parsed.expenses)) setExpenses(parsed.expenses as ExpenseRecord[])
    if (Array.isArray(parsed.otherIncomes)) setOtherIncomes(parsed.otherIncomes as OtherIncomeRecord[])
    if (Array.isArray(parsed.examSheets)) setExamSheets(parsed.examSheets as ExamSheetItem[])
    if (Array.isArray(parsed.quizzes)) setQuizzes(parsed.quizzes as OnlineQuiz[])
    if (Array.isArray(parsed.quizAttempts)) setQuizAttempts(parsed.quizAttempts as QuizAttempt[])
    if (Array.isArray(parsed.admissions)) setAdmissions(parsed.admissions as AdmissionApplication[])
    if (Array.isArray(parsed.qrScans)) setQrScans(parsed.qrScans as QRScanLog[])
    if (Array.isArray(parsed.libraryBooks)) setLibraryBooks(parsed.libraryBooks as LibraryBook[])
    if (Array.isArray(parsed.studyResources)) {
      setStudyResources(parsed.studyResources as StudyResourceItem[])
    }
    if (Array.isArray(parsed.teacherLeaves)) {
      setTeacherLeaves(parsed.teacherLeaves as TeacherLeaveSubItem[])
    }
    if (Array.isArray(parsed.parentAlerts)) {
      setParentAlerts(parsed.parentAlerts as ParentAlertLogItem[])
    }
    if (parsed.campusWifiConfig && typeof parsed.campusWifiConfig === 'object') {
      setCampusWifiConfig(parsed.campusWifiConfig as CampusWifiConfig)
    }
    if (Array.isArray(parsed.teacherAttendance)) {
      setTeacherAttendance(parsed.teacherAttendance as TeacherAttendanceLog[])
    }
    if (Array.isArray(parsed.teacherSalaries)) {
      setTeacherSalaries(parsed.teacherSalaries as TeacherSalaryRecord[])
    }
    if (Array.isArray(parsed.teacherTrainings)) {
      setTeacherTrainings(parsed.teacherTrainings as TeacherTrainingItem[])
    }
    if (Array.isArray(parsed.timetableSlots)) {
      setTimetableSlots(parsed.timetableSlots as TimetableSlot[])
    }
    if (Array.isArray(parsed.examSchedules)) {
      setExamSchedules(parsed.examSchedules as ExamScheduleEntry[])
    }
    if (Array.isArray(parsed.alumni)) {
      setAlumni(parsed.alumni as AlumniRecord[])
    }
    if (Array.isArray(parsed.issuedDocuments)) {
      setIssuedDocuments(parsed.issuedDocuments as IssuedDocumentLog[])
    }
    if (parsed.studyQuestProfiles && typeof parsed.studyQuestProfiles === 'object') {
      setStudyQuestProfiles(parsed.studyQuestProfiles as Record<string, StudyQuestProfile>)
    }
    if (Array.isArray(parsed.customRoles) && parsed.customRoles.length > 0) {
      setCustomRoles(parsed.customRoles as CustomRoleDefinition[])
    }
    if (Array.isArray(parsed.staffMembers) && parsed.staffMembers.length > 0) {
      setStaffMembers(parsed.staffMembers as StaffMemberRecord[])
    }
    if (Array.isArray(parsed.canteenMenu) && parsed.canteenMenu.length > 0) {
      setCanteenMenu(parsed.canteenMenu as CanteenMenuItem[])
    }
  }

  const syncUserRoleContext = (user: AuthUserSession) => {
    setRole(user.role)
    if (user.role === 'guardian' && user.linkedEntityId) {
      setActiveGuardianId(user.linkedEntityId)
    } else if (user.role === 'teacher' && user.linkedEntityId) {
      setActiveTeacherId(user.linkedEntityId)
    } else if (user.role === 'student' && user.linkedEntityId) {
      setActiveStudentId(user.linkedEntityId)
      setSelectedChildId(user.linkedEntityId)
    } else if (user.role === 'staff' && user.linkedEntityId) {
      setActiveStaffId(user.linkedEntityId)
    }
  }

  const refreshBiometricDevices = async (guardianId?: string) => {
    try {
      const qs = guardianId ? `?guardianId=${encodeURIComponent(guardianId)}` : ''
      const res = await fetch(`/dmhs-api/biometric${qs}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as { ok: boolean; devices?: GuardianBiometricDevice[] }
      if (json.ok && Array.isArray(json.devices)) {
        setBiometricDevices(json.devices)
      }
    } catch {
      // ignore
    }
  }

  const toggleGuardianBiometricRequired = (guardianId: string, enabled?: boolean) => {
    const target = guardians.find((g) => g.id === guardianId)
    if (!target) return
    const nextVal = enabled !== undefined ? enabled : !(target.biometricRequired !== false)
    setGuardians((prev) =>
      prev.map((g) => (g.id === guardianId ? { ...g, biometricRequired: nextVal } : g)),
    )
    notify(
      nextVal
        ? 'Biometric Guardian confirmation enforced on Leave, Exam Sheets & Consent'
        : 'Biometric Guardian confirmation set to optional',
    )
  }

  const refreshAuthAccounts = async () => {
    try {
      const res = await fetch('/dmhs-api/users', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        accounts?: AuthAccountSummary[]
        stats?: DbSyncStats
      }
      if (json.ok && Array.isArray(json.accounts)) {
        setAuthAccounts(json.accounts)
      }
      if (json.stats) setDbStats(json.stats)
    } catch {
      // ignore
    }
  }

  const adminResetUserPassword: SchoolState['adminResetUserPassword'] = async (payload) => {
    try {
      const res = await fetch('/dmhs-api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as {
        ok: boolean
        accounts?: AuthAccountSummary[]
        stats?: DbSyncStats
        error?: string
      }
      if (!res.ok || !json.ok) {
        return { ok: false, error: json.error || 'Failed to update account credentials.' }
      }
      if (Array.isArray(json.accounts)) setAuthAccounts(json.accounts)
      if (json.stats) setDbStats(json.stats)
      if (payload.newPassword) {
        pushAudit('Reset User Password', `${payload.displayName} (${payload.role})`)
      }
      return { ok: true }
    } catch {
      return { ok: false, error: 'Unable to reach DMHA database server.' }
    }
  }

  const changeOwnPassword: SchoolState['changeOwnPassword'] = async ({
    currentPassword,
    newPassword,
  }) => {
    const linkedEntityId =
      role === 'teacher'
        ? activeTeacherId
        : role === 'guardian'
          ? activeGuardianId
          : role === 'student'
            ? activeStudentId
            : 'admin-shahid'
    try {
      const res = await fetch('/dmhs-api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedEntityId,
          role,
          currentPassword,
          newPassword,
        }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) {
        return { ok: false, error: json.error || 'Password update failed.' }
      }
      pushAudit('Self Password Changed', `${role} account (${linkedEntityId})`)
      notify('Your password has been updated securely')
      return { ok: true }
    } catch {
      return { ok: false, error: 'Unable to reach DMHA authentication server.' }
    }
  }

  const refreshDbFromServer = async () => {
    setDbStatus('connecting')
    try {
      const res = await fetch('/dmhs-api/state', { cache: 'no-store' })
      if (!res.ok) throw new Error('DB unreachable')
      const json = (await res.json()) as {
        ok: boolean
        exists: boolean
        data: Record<string, unknown> | null
        version?: number
        stats: DbSyncStats | null
      }
      if (typeof json.version === 'number') {
        stateVersionRef.current = json.version
      }
      if (json.stats) setDbStats(json.stats)
      if (json.exists && json.data) {
        skipNextServerSaveRef.current = true
        applySerializedPayload(json.data)
      }
      setDbStatus('synced')
    } catch {
      setDbStatus('offline')
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      // 1. Check real server auth session cookie in SQLite first
      let authenticatedUser: AuthUserSession | null = null
      try {
        const authRes = await fetch('/dmhs-api/auth', { cache: 'no-store' })
        if (authRes.ok && active) {
          const authJson = (await authRes.json()) as {
            authenticated: boolean
            isDeveloperMode?: boolean
            demoLoginAllowed?: boolean
            user: AuthUserSession | null
            stats?: DbSyncStats
          }
          if (typeof authJson.demoLoginAllowed === 'boolean') {
            setDemoLoginAllowed(authJson.demoLoginAllowed)
          }
          setIsDeveloperMode(Boolean(authJson.isDeveloperMode))
          if (authJson.stats) setDbStats(authJson.stats)
          if (authJson.authenticated && authJson.user) {
            authenticatedUser = authJson.user
            setAuthUser(authJson.user)
            syncUserRoleContext(authJson.user)
          } else {
            setDbStatus('synced')
          }
        }
      } catch {
        if (active) setDbStatus('offline')
      } finally {
        if (active) setAuthLoading(false)
      }

      // 2. Only load protected school state, accounts & biometrics when authenticated (zero unauth 401s or PII leaks)
      if (authenticatedUser && active) {
        let loadedFromServer = false
        try {
          const res = await fetch('/dmhs-api/state', { cache: 'no-store' })
          if (res.ok && active) {
            const json = (await res.json()) as {
              ok: boolean
              exists: boolean
              data: Record<string, unknown> | null
              version?: number
              stats: DbSyncStats | null
            }
            if (typeof json.version === 'number') {
              stateVersionRef.current = json.version
            }
            if (json.stats) setDbStats(json.stats)
            if (json.exists && json.data) {
              skipNextServerSaveRef.current = true
              applySerializedPayload(json.data)
              loadedFromServer = true
            }
            setDbStatus('synced')
          }
        } catch {
          if (active) setDbStatus('offline')
        }

        if (!loadedFromServer && active) {
          try {
            const saved = window.localStorage.getItem(STORAGE_KEY)
            if (saved) {
              applySerializedPayload(JSON.parse(saved) as Record<string, unknown>)
            }
          } catch {
            // ignore storage errors
          }
        }

        if (active) {
          void refreshAuthAccounts()
          if (authenticatedUser.role === 'guardian' || authenticatedUser.role === 'admin') {
            void refreshBiometricDevices()
          }
        }
      }

      if (active) {
        setHydrated(true)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  // Real-Time Multi-Device SSE Interconnection (Mobile <-> Office Desktop Live Sync)
  useEffect(() => {
    if (!hydrated || !authUser || typeof window === 'undefined' || typeof EventSource === 'undefined')
      return
    const clientId = clientIdRef.current
    const es = new EventSource(`/dmhs-api/stream?clientId=${encodeURIComponent(clientId)}&role=${role}`)

    es.onopen = () => {
      setRealtimeConnected(true)
    }

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as {
          type: 'connected' | 'presence' | 'state_updated'
          connectedCount?: number
          sourceClientId?: string
          updatedBy?: string
          version?: number
        }
        if (typeof msg.connectedCount === 'number') {
          setConnectedDevices(Math.max(1, msg.connectedCount))
        }
        if (msg.type === 'state_updated' && msg.sourceClientId !== clientId) {
          void refreshDbFromServer().then(() => {
            notify(`Live sync from ${msg.updatedBy || 'another DMHA device'} (v${msg.version || ''})`)
          })
        }
      } catch {
        // ignore malformed frames
      }
    }

    es.onerror = () => {
      setRealtimeConnected(false)
    }

    const onFocusVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshDbFromServer()
      }
    }
    document.addEventListener('visibilitychange', onFocusVisible)

    return () => {
      es.close()
      setRealtimeConnected(false)
      document.removeEventListener('visibilitychange', onFocusVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, authUser?.id])

  useEffect(() => {
    if (!hydrated || !authUser) return
    const payload = {
      students,
      teachers,
      guardians,
      auditLogs,
      feedback,
      semesterEvaluations,
      courseMaterials,
      semesterSyllabusConfig,
      assignments,
      fees,
      leaveRequests,
      ptmRequests,
      notices,
      campusUnits,
      unitTransferRequests,
      campusClubs,
      chats,
      notifications,
      pickupContacts,
      dismissalLogs,
      medicalLogs,
      houseStandings,
      merits,
      consentForms,
      canteenWallets,
      canteenTransactions,
      expenses,
      otherIncomes,
      examSheets,
      quizzes,
      quizAttempts,
      admissions,
      qrScans,
      libraryBooks,
      studyResources,
      teacherLeaves,
      parentAlerts,
      campusWifiConfig,
      teacherAttendance,
      teacherSalaries,
      teacherTrainings,
      timetableSlots,
      examSchedules,
      alumni,
      issuedDocuments,
      studyQuestProfiles,
      customRoles,
      staffMembers,
      canteenMenu,
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore storage errors
    }

    if (skipNextServerSaveRef.current) {
      skipNextServerSaveRef.current = false
      return
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    setDbStatus('saving')
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch('/dmhs-api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: payload,
            updatedBy: authUser?.displayName || role,
            clientId: clientIdRef.current,
            expectedVersion: stateVersionRef.current || undefined,
          }),
        })
        if (res.status === 409) {
          await refreshDbFromServer()
          notify('Synced newer changes saved from another DMHA device')
          return
        }
        if (!res.ok) throw new Error('Save failed')
        const json = (await res.json()) as {
          version?: number
          stats?: DbSyncStats
          connectedDevices?: number
        }
        if (typeof json.version === 'number') stateVersionRef.current = json.version
        if (json.stats) setDbStats(json.stats)
        if (typeof json.connectedDevices === 'number') setConnectedDevices(json.connectedDevices)
        setDbStatus('synced')
      } catch {
        setDbStatus('offline')
      }
    }, 350)

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [
    hydrated,
    students,
    teachers,
    guardians,
    auditLogs,
    feedback,
    semesterEvaluations,
    courseMaterials,
    semesterSyllabusConfig,
    assignments,
    fees,
    leaveRequests,
    ptmRequests,
    notices,
    campusUnits,
    unitTransferRequests,
    campusClubs,
    chats,
    notifications,
    pickupContacts,
    dismissalLogs,
    medicalLogs,
    houseStandings,
    merits,
    consentForms,
    canteenWallets,
    canteenTransactions,
    expenses,
    otherIncomes,
    examSheets,
    quizzes,
    quizAttempts,
    admissions,
    qrScans,
    libraryBooks,
    studyResources,
    teacherLeaves,
    parentAlerts,
    campusWifiConfig,
    teacherAttendance,
    teacherSalaries,
    teacherTrainings,
    timetableSlots,
    examSchedules,
    alumni,
    issuedDocuments,
    studyQuestProfiles,
    customRoles,
    staffMembers,
    canteenMenu,
    authUser,
    role,
  ])

  const loginWithCredentials = async (
    identifier: string,
    password: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/dmhs-api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'credentials', identifier, password }),
      })
      const json = (await res.json()) as {
        ok: boolean
        isDeveloperMode?: boolean
        user?: AuthUserSession
        stats?: DbSyncStats
        error?: string
      }
      if (!res.ok || !json.ok || !json.user) {
        return { ok: false, error: json.error || 'Invalid credentials' }
      }
      setIsDeveloperMode(Boolean(json.isDeveloperMode))
      if (json.stats) setDbStats(json.stats)
      setAuthUser(json.user)
      syncUserRoleContext(json.user)
      await refreshDbFromServer()
      void refreshAuthAccounts()
      if (json.user.role === 'guardian' || json.user.role === 'admin') {
        void refreshBiometricDevices()
      }
      notify(`Welcome back, ${json.user.displayName}`)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Unable to reach DMHA authentication server.' }
    }
  }

  const loginDemoRole = async (
    targetRole: Role,
    linkedEntityId?: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/dmhs-api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'demo', role: targetRole, linkedEntityId }),
      })
      const json = (await res.json()) as {
        ok: boolean
        isDeveloperMode?: boolean
        user?: AuthUserSession
        stats?: DbSyncStats
        error?: string
      }
      if (!res.ok || !json.ok || !json.user) {
        return { ok: false, error: json.error || 'Demo sign-in failed' }
      }
      setIsDeveloperMode(Boolean(json.isDeveloperMode))
      if (json.stats) setDbStats(json.stats)
      setAuthUser(json.user)
      syncUserRoleContext(json.user)
      await refreshDbFromServer()
      void refreshAuthAccounts()
      if (json.user.role === 'guardian' || json.user.role === 'admin') {
        void refreshBiometricDevices()
      }
      notify(`Signed in as ${json.user.displayName} (${json.user.role})`)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Unable to reach DMHA authentication server.' }
    }
  }

  const devSwitchAccount: SchoolState['devSwitchAccount'] = async (payload) => {
    try {
      const res = await fetch('/dmhs-api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'dev_impersonate',
          targetUserId: payload.targetUserId,
          role: payload.role,
          linkedEntityId: payload.linkedEntityId,
        }),
      })
      const json = (await res.json()) as {
        ok: boolean
        isDeveloperMode?: boolean
        user?: AuthUserSession
        accounts?: AuthAccountSummary[]
        stats?: DbSyncStats
        error?: string
      }
      if (!res.ok || !json.ok || !json.user) {
        const msg = json.error || 'Unable to switch account.'
        notify(msg)
        return { ok: false, error: msg }
      }
      setFamilyChildMode(false)
      setFamilyLockGuardianId(null)
      setIsDeveloperMode(Boolean(json.isDeveloperMode))
      if (Array.isArray(json.accounts)) setAuthAccounts(json.accounts)
      if (json.stats) setDbStats(json.stats)
      setAuthUser(json.user)
      syncUserRoleContext(json.user)
      await refreshDbFromServer()
      void refreshAuthAccounts()
      notify(`DEV Switched → ${json.user.displayName} (${json.user.role} · ${json.user.loginCode})`)
      return { ok: true }
    } catch {
      const msg = 'Network error while switching developer account.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const devReturnToDeveloper: SchoolState['devReturnToDeveloper'] = async () => {
    try {
      const res = await fetch('/dmhs-api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'dev_return' }),
      })
      const json = (await res.json()) as {
        ok: boolean
        user?: AuthUserSession
        accounts?: AuthAccountSummary[]
        stats?: DbSyncStats
        error?: string
      }
      if (!res.ok || !json.ok || !json.user) {
        const msg = json.error || 'Unable to return to Developer account.'
        notify(msg)
        return { ok: false, error: msg }
      }
      setFamilyChildMode(false)
      setFamilyLockGuardianId(null)
      setIsDeveloperMode(true)
      if (Array.isArray(json.accounts)) setAuthAccounts(json.accounts)
      if (json.stats) setDbStats(json.stats)
      setAuthUser(json.user)
      syncUserRoleContext(json.user)
      await refreshDbFromServer()
      void refreshAuthAccounts()
      notify('Returned to DMHA Developer Master Account (DEV-001)')
      return { ok: true }
    } catch {
      const msg = 'Network error while returning to Developer account.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const logout = async () => {
    try {
      await fetch('/dmhs-api/auth', { method: 'DELETE' })
    } catch {
      // ignore
    }
    setFamilyChildMode(false)
    setFamilyLockGuardianId(null)
    setIsDeveloperMode(false)
    setAuthUser(null)
    notify('Signed out of DMHA Smart Learning App')
  }

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  const pushNotification = (item: Omit<NotificationItem, 'id' | 'time' | 'read'>) => {
    setNotifications((prev) => [
      {
        ...item,
        id: `not-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: 'Just now',
        read: false,
      },
      ...prev,
    ])
  }

  const updateStudentAttendance = (studentId: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s
        const checkIn =
          status === 'present'
            ? s.gateCheckIn || '07:55 AM'
            : status === 'late'
              ? '08:16 AM'
              : null
        return {
          ...s,
          todayStatus: status,
          gateCheckIn: checkIn,
          todayPeriods: s.todayPeriods.map((p) => ({ ...p, status })),
        }
      }),
    )
  }

  const saveRollCallAndNotify: SchoolState['saveRollCallAndNotify'] = async (updates, dateIso) => {
    try {
      const res = await fetch('/dmhs-api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, ...(dateIso ? { dateIso } : {}) }),
      })
      const json = (await res.json()) as {
        ok: boolean
        error?: string
        dateIso?: string
        isToday?: boolean
        savedBy?: string
        updatedCount?: number
        alertedStudents?: Array<{
          studentId: string
          studentName: string
          classLabel: string
          status: AttendanceStatus
        }>
        students?: StudentRecord[]
        version?: number
      }

      if (!res.ok || !json.ok) {
        notify(json.error || 'Unable to save daily roll call.')
        return { ok: false, error: json.error || 'Unable to save daily roll call.' }
      }

      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.students)) {
        setStudents(json.students)
      }

      const actorName =
        json.savedBy ||
        teachers.find((t) => t.id === activeTeacherId)?.name ||
        TEACHER_PROFILE.name
      const targetDate = json.dateIso || dateIso || new Date().toISOString().slice(0, 10)
      const alerts = json.alertedStudents || []
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      if (json.isToday !== false) {
        alerts.forEach((a) => {
          pushNotification({
            title:
              a.status === 'absent'
                ? `Absence Alert · ${a.studentName}`
                : `Late Arrival · ${a.studentName}`,
            text:
              a.status === 'absent'
                ? `${a.studentName} (${a.classLabel}) was marked Absent during roll call (${targetDate}) by ${actorName}.`
                : `${a.studentName} (${a.classLabel}) arrived late at ${nowTime} during roll call (${targetDate}) by ${actorName}.`,
            type: 'attendance',
            forRoles: ['guardian', 'admin'],
          })
        })
      }

      notify(
        json.isToday === false
          ? `Historical roll call (${targetDate}) updated in SQLite for ${json.updatedCount || Object.keys(updates).length} student(s)`
          : alerts.length > 0
            ? `Roll call (${targetDate}) saved to SQLite · ${alerts.length} guardian alert(s) dispatched`
            : `Roll call (${targetDate}) saved to SQLite for ${json.updatedCount || Object.keys(updates).length} student(s)`,
      )
      return { ok: true, updatedCount: json.updatedCount, dateIso: targetDate }
    } catch {
      const msg = 'Unable to reach DMHA Attendance Server.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const getSemesterEvaluationStatus: SchoolState['getSemesterEvaluationStatus'] = (
    studentId,
    term = CURRENT_SEMESTER_TERM,
  ) => {
    const stu = students.find((s) => s.id === studentId)
    const requiredItems = (stu?.subjects || []).map((sub) => {
      const matchedTeacher = teachers.find(
        (t) => t.name.trim().toLowerCase() === sub.teacher.trim().toLowerCase(),
      )
      return {
        subject: sub.name,
        teacherName: sub.teacher,
        teacherId: matchedTeacher?.id || `tch-${sub.name.toLowerCase().replace(/\s+/g, '-')}`,
      }
    })
    const stuEvals = semesterEvaluations.filter((e) => e.studentId === studentId && e.term === term)
    const completedSet = new Set(stuEvals.map((e) => e.subject.toLowerCase()))
    const completedSubjects = requiredItems
      .filter((r) => completedSet.has(r.subject.toLowerCase()))
      .map((r) => r.subject)
    const remainingSubjects = requiredItems
      .filter((r) => !completedSet.has(r.subject.toLowerCase()))
      .map((r) => r.subject)
    const averageGivenRating =
      stuEvals.length > 0
        ? Number((stuEvals.reduce((s, e) => s + e.rating, 0) / stuEvals.length).toFixed(1))
        : null

    return {
      term,
      requiredItems,
      completedSubjects,
      remainingSubjects,
      completedCount: completedSubjects.length,
      requiredCount: requiredItems.length,
      isComplete: requiredItems.length > 0 && remainingSubjects.length === 0,
      averageGivenRating,
    }
  }

  const addTeacherFeedback: SchoolState['addTeacherFeedback'] = async (payload) => {
    const stu = students.find((s) => s.id === payload.studentId)
    if (!stu) return { ok: false, error: 'Student not found.' }
    try {
      const res = await fetch('/dmhs-api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'teacher_post',
          studentId: payload.studentId,
          subject: payload.subject,
          category: payload.category,
          title: payload.title,
          message: payload.message,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        item?: TeacherFeedbackItem
        feedback?: TeacherFeedbackItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to post classroom feedback.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.feedback)) setFeedback(json.feedback)
      const author = json.item?.teacherName || TEACHER_PROFILE.name
      pushNotification({
        title: `New Teacher Feedback · ${payload.subject}`,
        text: `${author} posted a ${payload.category} remark for ${stu.name}: "${payload.title}"`,
        type: 'feedback',
        forRoles: ['guardian', 'student'],
      })
      notify(`Feedback saved to SQLite & sent to ${stu.guardianName} and ${stu.name}`)
      return { ok: true }
    } catch {
      const msg = 'Network error while posting feedback.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const submitFamilyFeedback: SchoolState['submitFamilyFeedback'] = async (payload) => {
    const stu = students.find((s) => s.id === payload.studentId)
    if (!stu) return { ok: false, error: 'Student not found.' }
    try {
      const res = await fetch('/dmhs-api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'family_submit',
          studentId: payload.studentId,
          teacherName: payload.teacherName,
          subject: payload.subject,
          category: payload.category,
          title: payload.title,
          message: payload.message,
          rating: payload.rating,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        item?: TeacherFeedbackItem
        feedback?: TeacherFeedbackItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to submit feedback.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.feedback)) setFeedback(json.feedback)
      const senderLabel = role === 'student' ? stu.name : stu.guardianName
      pushNotification({
        title: `${role === 'student' ? 'Student' : 'Guardian'} Feedback · ${payload.subject}`,
        text: `${senderLabel} sent feedback regarding ${payload.subject}: "${payload.title}"`,
        type: 'feedback',
        forRoles: ['teacher', 'admin'],
      })
      notify(`Feedback delivered to ${payload.teacherName} & recorded in SQLite`)
      return { ok: true }
    } catch {
      const msg = 'Network error while submitting feedback.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const acknowledgeFeedback: SchoolState['acknowledgeFeedback'] = async (feedbackId, reply) => {
    try {
      const res = await fetch('/dmhs-api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          feedbackId,
          reply: reply || '',
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        feedback?: TeacherFeedbackItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to save reply.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.feedback)) setFeedback(json.feedback)
      pushNotification({
        title:
          role === 'teacher' || role === 'admin'
            ? 'Teacher Replied to Feedback'
            : role === 'student'
              ? 'Student Replied to Feedback'
              : 'Guardian Replied to Feedback',
        text: `${authUser?.displayName || GUARDIAN_PROFILE.name} responded${reply?.trim() ? `: "${reply.trim()}"` : '.'}`,
        type: 'feedback',
        forRoles: role === 'teacher' || role === 'admin' ? ['guardian', 'student'] : ['teacher', 'admin'],
      })
      notify(reply?.trim() ? 'Reply saved & synced to SQLite' : 'Feedback acknowledged')
      return { ok: true }
    } catch {
      const msg = 'Network error while saving feedback reply.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const submitSemesterEvaluations: SchoolState['submitSemesterEvaluations'] = async (payload) => {
    try {
      const res = await fetch('/dmhs-api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_semester_evaluation',
          studentId: payload.studentId,
          term: payload.term || CURRENT_SEMESTER_TERM,
          evaluations: payload.evaluations,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        semesterEvaluations?: SemesterEvaluationItem[]
        evaluationStatus?: SemesterEvaluationStatus
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to submit end-of-semester evaluation.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.semesterEvaluations)) {
        setSemesterEvaluations((prev) => {
          if (role === 'admin') return json.semesterEvaluations!
          // Merge this student's newly saved evaluations without losing sibling entries
          const remainingOthers = prev.filter((e) => e.studentId !== payload.studentId)
          return [...json.semesterEvaluations!, ...remainingOthers]
        })
      }
      const unlocked = json.evaluationStatus?.isComplete
      pushNotification({
        title: unlocked
          ? 'End-of-Semester Evaluation Complete · Admit Card Unlocked'
          : 'Semester Evaluation Progress Saved',
        text: `${authUser?.displayName || 'Family'} completed confidential 5★–1★ semester ratings (${payload.term || CURRENT_SEMESTER_TERM}).`,
        type: 'feedback',
        forRoles: ['admin', 'guardian', 'student'],
      })
      notify(
        unlocked
          ? 'All teachers evaluated! Your Term Final Exam Admit Card is now UNLOCKED.'
          : 'End-of-semester star ratings saved to SQLite.',
      )
      return { ok: true, evaluationStatus: json.evaluationStatus }
    } catch {
      const msg = 'Network error while submitting semester evaluation.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const publishGradebookBatch: SchoolState['publishGradebookBatch'] = async (payload) => {
    try {
      const res = await fetch('/dmhs-api/gradebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish_scores',
          assessmentLabel: payload.assessmentLabel || 'Term Assessment',
          entries: payload.entries,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        updatedCount?: number
        students?: StudentRecord[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to publish gradebook scores.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.students)) setStudents(json.students)
      const count = json.updatedCount ?? payload.entries.length
      pushNotification({
        title: `Gradebook Published · ${payload.assessmentLabel || 'Term Assessment'}`,
        text: `${count} subject score(s) updated & class ranks recalculated across Report Cards and Leaderboard.`,
        type: 'result',
        forRoles: ['guardian', 'student', 'admin'],
      })
      notify(`Published ${count} score(s) to SQLite & synced GPA, Report Cards & Live Ranks`)
      return { ok: true, updatedCount: count }
    } catch {
      const msg = 'Network error while saving gradebook marks.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const updateSubjectScore: SchoolState['updateSubjectScore'] = async (
    studentId,
    subjectId,
    newScore,
    options,
  ) => {
    const res = await publishGradebookBatch({
      assessmentLabel: options?.assessmentLabel || 'Subject Mark Update',
      entries: [
        {
          studentId,
          subjectId,
          score: newScore,
          progress: options?.progress,
          nextTopic: options?.nextTopic,
        },
      ],
    })
    return { ok: res.ok, error: res.error }
  }

  const addGradebookSubject: SchoolState['addGradebookSubject'] = async (payload) => {
    try {
      const res = await fetch('/dmhs-api/gradebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_subject',
          ...payload,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        addedCount?: number
        students?: StudentRecord[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to add subject.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.students)) setStudents(json.students)
      notify(`Added "${payload.subjectName}" to ${json.addedCount || 0} student(s) in SQLite`)
      return { ok: true, addedCount: json.addedCount }
    } catch {
      const msg = 'Network error while adding gradebook subject.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  // ==================== COURSE MATERIALS & SEMESTER SYLLABUS ====================
  const createCourseMaterial: SchoolState['createCourseMaterial'] = async (payload) => {
    try {
      const res = await fetch('/dmhs-api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...payload }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        material?: CourseMaterialItem
        materials?: CourseMaterialItem[]
        assignments?: AssignmentItem[]
        semesterConfig?: SemesterSyllabusConfig
        version?: number
      }
      if (!res.ok || !json.ok || !json.material) {
        const msg = json.error || 'Unable to save course material.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.materials)) setCourseMaterials(json.materials)
      if (Array.isArray(json.assignments)) setAssignments(json.assignments)
      if (json.semesterConfig) setSemesterSyllabusConfig(json.semesterConfig)
      const mat = json.material
      if (mat.status === 'published') {
        pushNotification({
          title: `New Class Material · ${mat.subject} (${mat.weekLabel})`,
          text: `${mat.teacherName} published "${mat.topicTitle}" for ${mat.classSection}${mat.attachments.length ? ` with ${mat.attachments.length} file(s)` : ''}.`,
          type: 'notice',
          forRoles: ['student', 'guardian', 'admin'],
        })
      }
      notify(
        mat.status === 'published'
          ? `Published "${mat.topicTitle}" (${mat.weekLabel}) to ${mat.classSection}`
          : `Saved draft "${mat.topicTitle}" (${mat.weekLabel}) privately`,
      )
      return { ok: true, material: mat }
    } catch {
      const msg = 'Network error while saving course material.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const updateCourseMaterial: SchoolState['updateCourseMaterial'] = async (materialId, payload) => {
    try {
      const res = await fetch('/dmhs-api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', materialId, ...payload }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        material?: CourseMaterialItem
        materials?: CourseMaterialItem[]
        assignments?: AssignmentItem[]
        semesterConfig?: SemesterSyllabusConfig
        version?: number
      }
      if (!res.ok || !json.ok || !json.material) {
        const msg = json.error || 'Unable to update course material.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.materials)) setCourseMaterials(json.materials)
      if (Array.isArray(json.assignments)) setAssignments(json.assignments)
      if (json.semesterConfig) setSemesterSyllabusConfig(json.semesterConfig)
      notify(`Updated "${json.material.topicTitle}" in SQLite`)
      return { ok: true, material: json.material }
    } catch {
      const msg = 'Network error while updating course material.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const toggleCourseMaterialPublish: SchoolState['toggleCourseMaterialPublish'] = async (
    materialId,
  ) => {
    try {
      const res = await fetch('/dmhs-api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_publish', materialId }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        material?: CourseMaterialItem
        materials?: CourseMaterialItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to change publish status.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.materials)) setCourseMaterials(json.materials)
      notify(
        json.material?.status === 'published'
          ? `Published "${json.material.topicTitle}" to students & parents`
          : `Moved "${json.material?.topicTitle || 'lesson'}" back to Teacher Draft`,
      )
      return { ok: true }
    } catch {
      const msg = 'Network error while updating publish status.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const duplicateCourseMaterialToClass: SchoolState['duplicateCourseMaterialToClass'] = async (
    materialId,
    targetClassSection,
  ) => {
    try {
      const res = await fetch('/dmhs-api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate_to_class', materialId, targetClassSection }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        materials?: CourseMaterialItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to copy lesson.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.materials)) setCourseMaterials(json.materials)
      notify(`Copied lesson & slides to ${targetClassSection}`)
      return { ok: true }
    } catch {
      const msg = 'Network error while copying course material.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const deleteCourseMaterial: SchoolState['deleteCourseMaterial'] = async (materialId) => {
    try {
      const res = await fetch('/dmhs-api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', materialId }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        materials?: CourseMaterialItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to delete course material.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.materials)) setCourseMaterials(json.materials)
      notify('Course material removed from semester plan')
      return { ok: true }
    } catch {
      const msg = 'Network error while deleting course material.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const trackCourseMaterialDownload: SchoolState['trackCourseMaterialDownload'] = async (
    materialId,
  ) => {
    setCourseMaterials((prev) =>
      prev.map((m) => (m.id === materialId ? { ...m, downloads: (m.downloads || 0) + 1 } : m)),
    )
    try {
      const res = await fetch('/dmhs-api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'track_download', materialId }),
      })
      const json = (await res.json()) as { version?: number }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
    } catch {
      // ignore offline
    }
  }

  const toggleCourseMaterialRevised: SchoolState['toggleCourseMaterialRevised'] = async (
    materialId,
    studentId,
  ) => {
    try {
      const res = await fetch('/dmhs-api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_revised', materialId, studentId }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        revised?: boolean
        revisedByStudentIds?: string[]
        version?: number
      }
      if (!res.ok || !json.ok) return { ok: false }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.revisedByStudentIds)) {
        setCourseMaterials((prev) =>
          prev.map((m) =>
            m.id === materialId
              ? { ...m, revisedByStudentIds: json.revisedByStudentIds! }
              : m,
          ),
        )
      }
      notify(json.revised ? 'Marked lesson as Revised ✓' : 'Removed Revised mark')
      return { ok: true, revised: json.revised }
    } catch {
      return { ok: false }
    }
  }

  const updateSemesterSyllabusConfig: SchoolState['updateSemesterSyllabusConfig'] = async (
    payload,
  ) => {
    try {
      const res = await fetch('/dmhs-api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_semester_config', ...payload }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        semesterConfig?: SemesterSyllabusConfig
        version?: number
      }
      if (!res.ok || !json.ok || !json.semesterConfig) {
        const msg = json.error || 'Unable to update semester configuration.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      setSemesterSyllabusConfig(json.semesterConfig)
      notify(
        `Semester updated: ${json.semesterConfig.termName} (${json.semesterConfig.totalWeeks} weeks)`,
      )
      return { ok: true }
    } catch {
      const msg = 'Network error while updating semester config.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const uploadGradebookExamSheet: SchoolState['uploadGradebookExamSheet'] = async (payload) => {
    const stu = students.find((s) => s.id === payload.studentId)
    try {
      const res = await fetch('/dmhs-api/gradebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload_exam_sheet',
          ...payload,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        sheet?: ExamSheetItem
        examSheets?: ExamSheetItem[]
        students?: StudentRecord[]
        version?: number
      }
      if (!res.ok || !json.ok || !json.sheet) {
        const msg = json.error || 'Unable to upload exam sheet.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.examSheets)) setExamSheets(json.examSheets)
      if (Array.isArray(json.students)) setStudents(json.students)
      const sheet = json.sheet
      pushNotification({
        title: `Graded Exam Sheet Ready for Review · ${sheet.subject}`,
        text: `${sheet.teacherName} uploaded ${sheet.studentName}’s ${sheet.examTitle} (${sheet.marksObtained}/${sheet.totalMarks}) for Guardian review.`,
        type: 'result',
        forRoles: ['guardian', 'student', 'admin'],
      })
      notify(
        `Exam sheet uploaded for ${stu?.name || sheet.studentName} & sent to Guardian for review`,
      )
      return { ok: true, sheet }
    } catch {
      const msg = 'Network error while uploading exam sheet.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const toggleAssignmentStep = (assignmentId: string, stepIndex: number) => {
    void callModuleApi('/dmhs-api/homework', {
      action: 'toggle_step',
      assignmentId,
      stepIndex,
    })
  }

  const submitAssignment: SchoolState['submitAssignment'] = (assignmentId, studentNote, extra) => {
    const via = extra?.submittedVia || 'online'
    void callModuleApi(
      '/dmhs-api/homework',
      {
        action: 'submit_assignment',
        assignmentId,
        studentNote,
        submittedVia: via,
        onlineResponseText: extra?.onlineResponseText,
        onlineAttachmentName: extra?.onlineAttachmentName,
        onlineAttachmentUrl: extra?.onlineAttachmentUrl,
      },
      via === 'offline'
        ? 'Marked done in copy — remember to pack it in your bag!'
        : 'Homework submitted online and saved to DMHA server!',
    )
  }

  const markOfflineCopyReceived = (assignmentId: string) => {
    void callModuleApi(
      '/dmhs-api/homework',
      {
        action: 'mark_offline_received',
        assignmentId,
      },
      'Marked physical copy received in class!',
    )
  }

  const gradeAssignment = (assignmentId: string, score: string, teacherRemark?: string) => {
    void callModuleApi(
      '/dmhs-api/homework',
      {
        action: 'grade_assignment',
        assignmentId,
        score: score.trim() || 'A+',
        teacherRemark,
      },
      `Homework graded (${score.trim() || 'A+'}) and saved!`,
    )
  }

  const createAssignment: SchoolState['createAssignment'] = (payload) => {
    const activeTeacher =
      teachers.find((t) => t.id === activeTeacherId)?.name || TEACHER_PROFILE.name
    void callModuleApi(
      '/dmhs-api/homework',
      {
        action: 'create_assignment',
        title: payload.title.trim(),
        subject: payload.subject,
        dueDate: payload.dueDate || 'Due next class',
        targetClass: payload.className || 'Class 6',
        teacher: activeTeacher,
        kind: payload.kind || 'Daily Homework',
        submissionMode: payload.submissionMode || 'offline',
        offlineDropoffLocation: payload.offlineDropoffLocation,
        assignedDay: payload.assignedDay,
        submissionIso: payload.submissionIso,
        submissionTime: payload.submissionTime,
        estimatedMins: payload.estimatedMins || 20,
        instructions: payload.instructions,
        howToSteps: payload.howToSteps,
        whatToStudy: payload.whatToStudy,
        studyTip: payload.studyTip,
        submissionFormat: payload.submissionFormat,
        chapterTitle: payload.chapterTitle,
        linkedMaterialId: payload.linkedMaterialId,
      },
      `${payload.kind || 'Homework'} "${payload.title.trim()}" published to ${payload.className || 'class'}!`,
    )
  }

  const payFeeInvoice = (feeId: string) => {
    void (async () => {
      const res = await callModuleApi(
        '/dmhs-api/fees/pay',
        { feeId, paymentMethod: role === 'admin' || role === 'staff' ? 'Cash' : 'bKash' },
      )
      if (res.ok) {
        const rc = String(res.json?.receiptNo || '')
        const vno = String(res.json?.voucherNo || '')
        notify(
          vno
            ? `Payment recorded · Receipt ${rc} · Double-Entry ${vno} posted!`
            : `Payment successful · Receipt ${rc}`,
        )
      }
    })()
  }

  const submitLeaveRequest = (payload: {
    studentId: string
    dateRange: string
    reason: string
    verification?: BiometricVerificationStamp
  }) => {
    const stu = students.find((s) => s.id === payload.studentId)
    if (!stu) return
    const activeGrd = guardians.find((g) => g.id === activeGuardianId) || guardians[0]
    const req: LeaveRequest = {
      id: `lv-${Date.now()}`,
      studentId: stu.id,
      studentName: stu.name,
      guardianName: activeGrd?.name || GUARDIAN_PROFILE.name,
      dateRange: payload.dateRange,
      reason: payload.reason,
      status: 'pending',
      submittedAt: 'Just now',
      verification: payload.verification,
    }
    setLeaveRequests((prev) => [req, ...prev])
    pushNotification({
      title: `Leave Application · ${stu.name}`,
      text: `${req.guardianName} requested leave for ${stu.name} (${payload.dateRange})${
        payload.verification ? ` · ${payload.verification.method} Verified` : ''
      }.`,
      type: 'attendance',
      forRoles: ['teacher', 'admin'],
    })
    pushAudit(
      'Guardian Leave Application',
      `${stu.name} (${payload.dateRange})${payload.verification ? ` · ${payload.verification.method}` : ''}`,
    )
    notify(
      payload.verification
        ? `Leave request verified (${payload.verification.method}) & submitted`
        : `Leave request submitted for ${stu.name}`,
    )
  }

  const updateLeaveStatus = (leaveId: string, status: 'approved' | 'declined') => {
    let target: LeaveRequest | undefined
    setLeaveRequests((prev) =>
      prev.map((lv) => {
        if (lv.id !== leaveId) return lv
        target = lv
        return { ...lv, status }
      }),
    )
    if (target) {
      if (status === 'approved') {
        updateStudentAttendance(target.studentId, 'leave')
      }
      pushNotification({
        title: `Leave ${status === 'approved' ? 'Approved' : 'Declined'}`,
        text: `Class teacher ${status} leave request for ${target.studentName} (${target.dateRange}).`,
        type: 'attendance',
        forRoles: ['guardian', 'student'],
      })
      notify(`Leave request ${status}`)
    }
  }

  const addLeaveDiscussionMessage = (leaveId: string, text: string) => {
    const clean = text.trim()
    if (!clean) return
    void callModuleApi(
      '/dmhs-api/leaves',
      { action: 'add_leave_discussion', leaveId, text: clean },
      'Sent reply to Leave Discussion & Private Messages',
    )
  }

  const bookPTM = (payload: {
    studentId: string
    teacherName: string
    subject: string
    slot: string
    topic: string
  }) => {
    const stu = students.find((s) => s.id === payload.studentId)
    if (!stu) return
    const req: PTMRequest = {
      id: `ptm-${Date.now()}`,
      studentId: stu.id,
      studentName: stu.name,
      guardianName: GUARDIAN_PROFILE.name,
      teacherName: payload.teacherName,
      subject: payload.subject,
      slot: payload.slot,
      topic: payload.topic,
      status: 'confirmed',
    }
    setPtmRequests((prev) => [req, ...prev])
    pushNotification({
      title: `PTM Booked · ${stu.name}`,
      text: `${GUARDIAN_PROFILE.name} booked ${payload.slot} with ${payload.teacherName}.`,
      type: 'feedback',
      forRoles: ['teacher', 'guardian'],
    })
    notify(`PTM slot confirmed with ${payload.teacherName}`)
  }

    const callNoticesUnitsApi = async (
      body: Record<string, unknown>,
      successMsg?: string,
    ): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> => {
      try {
        const res = await fetch('/dmhs-api/notices-units', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = (await res.json()) as Record<string, unknown> & {
          ok?: boolean
          error?: string
          version?: number
          notices?: SchoolNotice[]
          campusUnits?: CampusUnitRecord[]
          unitTransferRequests?: UnitTransferRequest[]
          campusClubs?: CampusClubItem[]
          students?: StudentRecord[]
          notifications?: NotificationItem[]
        }
        if (!res.ok || !json.ok) {
          const msg = json.error || 'Operation failed.'
          notify(msg)
          return { ok: false, error: msg }
        }
        if (typeof json.version === 'number') {
          stateVersionRef.current = json.version
          skipNextServerSaveRef.current = true
        }
        if (Array.isArray(json.notices)) setNotices(json.notices)
        if (Array.isArray(json.campusUnits)) setCampusUnits(json.campusUnits)
        if (Array.isArray(json.unitTransferRequests)) {
          setUnitTransferRequests(json.unitTransferRequests)
        }
        if (Array.isArray(json.campusClubs)) setCampusClubs(json.campusClubs)
        if (Array.isArray(json.students)) setStudents(json.students)
        if (Array.isArray(json.notifications)) setNotifications(json.notifications)
        if (successMsg) notify(successMsg)
        return { ok: true, data: json }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error'
        notify(msg)
        return { ok: false, error: msg }
      }
    }

  const publishNotice: SchoolState['publishNotice'] = async (payload) => {
    const res = await callNoticesUnitsApi(
      { action: 'create_notice', ...payload },
      `Official notice published to ${payload.audience}${payload.targetUnit && payload.targetUnit !== 'All Units' ? ` (${payload.targetUnit})` : ''}`,
    )
    return { ok: res.ok, error: res.error }
  }

  const updateNotice: SchoolState['updateNotice'] = async (payload) => {
    const res = await callNoticesUnitsApi(
      { action: 'update_notice', ...payload },
      `Notice "${payload.title}" updated`,
    )
    return { ok: res.ok, error: res.error }
  }

  const togglePinNotice: SchoolState['togglePinNotice'] = async (noticeId) => {
    const res = await callNoticesUnitsApi({ action: 'toggle_pin_notice', noticeId })
    if (res.ok) {
      notify(res.data?.pinned ? 'Notice pinned to top of board' : 'Notice unpinned')
    }
    return { ok: res.ok, error: res.error }
  }

  const deleteNotice: SchoolState['deleteNotice'] = async (noticeId) => {
    const res = await callNoticesUnitsApi(
      { action: 'delete_notice', noticeId },
      'Notice removed from board',
    )
    return { ok: res.ok, error: res.error }
  }

  const acknowledgeNotice: SchoolState['acknowledgeNotice'] = async (noticeId) => {
    const res = await callNoticesUnitsApi(
      { action: 'acknowledge_notice', noticeId },
      'Circular acknowledged ✓ Read receipt saved',
    )
    return { ok: res.ok, error: res.error }
  }

  const saveCampusUnit: SchoolState['saveCampusUnit'] = async (payload) => {
    const res = await callNoticesUnitsApi(
      { action: 'save_unit', ...payload },
      payload.id
        ? `Campus Unit "${payload.name}" updated`
        : `Campus Unit "${payload.name}" added`,
    )
    return { ok: res.ok, error: res.error }
  }

  const setCampusUnitGateStatus: SchoolState['setCampusUnitGateStatus'] = async (
    unitId,
    gateStatus,
    statusNote,
  ) => {
    const res = await callNoticesUnitsApi(
      { action: 'set_unit_gate_status', unitId, gateStatus, statusNote },
      `Live gate status updated to "${gateStatus}"`,
    )
    return { ok: res.ok, error: res.error }
  }

  const deleteCampusUnit: SchoolState['deleteCampusUnit'] = async (unitId) => {
    const res = await callNoticesUnitsApi(
      { action: 'delete_unit', unitId },
      'Campus Unit removed',
    )
    return { ok: res.ok, error: res.error }
  }

  const reassignStudentUnit: SchoolState['reassignStudentUnit'] = async (
    studentId,
    targetUnit,
  ) => {
    const stu = students.find((s) => s.id === studentId)
    const res = await callNoticesUnitsApi(
      { action: 'reassign_student_unit', studentId, targetUnit },
      `${stu?.name || 'Student'} assigned to ${targetUnit}`,
    )
    return { ok: res.ok, error: res.error }
  }

  const requestUnitTransfer: SchoolState['requestUnitTransfer'] = async (payload) => {
    const res = await callNoticesUnitsApi(
      { action: 'request_unit_transfer', ...payload },
      `Campus Unit transfer request submitted (${payload.toUnit})`,
    )
    return { ok: res.ok, error: res.error }
  }

  const reviewUnitTransfer: SchoolState['reviewUnitTransfer'] = async (
    requestId,
    decision,
    reviewNote,
  ) => {
    const res = await callNoticesUnitsApi(
      { action: 'review_unit_transfer', requestId, decision, reviewNote },
      decision === 'approved'
        ? 'Campus Unit transfer approved & student moved ✓'
        : 'Campus Unit transfer request declined',
    )
    return { ok: res.ok, error: res.error }
  }

  const toggleCampusClubMembership: SchoolState['toggleCampusClubMembership'] = async (
    clubId,
    studentId,
  ) => {
    const club = campusClubs.find((c) => c.id === clubId)
    const res = await callNoticesUnitsApi({
      action: 'toggle_club_membership',
      clubId,
      studentId,
    })
    if (res.ok) {
      notify(res.data?.joined ? `Enrolled in ${club?.name || 'Club'}!` : `Left ${club?.name || 'Club'}`)
    }
    return { ok: res.ok, error: res.error }
  }

  const addCampusClub: SchoolState['addCampusClub'] = async (payload) => {
    const res = await callNoticesUnitsApi(
      { action: 'add_club', ...payload },
      `Added new CCA club: ${payload.name}`,
    )
    return { ok: res.ok, error: res.error }
  }

  const callClassMomentsApi = async (
    body: Record<string, unknown>,
    successMsg?: string,
  ): Promise<{
    ok: boolean
    error?: string
    deliveredToGuardians?: number
    deliveredToStudents?: number
  }> => {
    try {
      const res = await fetch('/dmhs-api/class-moments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        version?: number
        classMoments?: ClassMomentPost[]
        notifications?: NotificationItem[]
        deliveredToGuardians?: number
        deliveredToStudents?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Class moments action failed.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        stateVersionRef.current = json.version
        skipNextServerSaveRef.current = true
      }
      if (Array.isArray(json.classMoments)) setClassMoments(json.classMoments)
      if (Array.isArray(json.notifications)) setNotifications(json.notifications)
      if (successMsg) notify(successMsg)
      return {
        ok: true,
        deliveredToGuardians: json.deliveredToGuardians,
        deliveredToStudents: json.deliveredToStudents,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const createClassMoment: SchoolState['createClassMoment'] = async (payload) => {
    const res = await callClassMomentsApi({ action: 'create', ...payload })
    if (res.ok) {
      notify(
        `Class Moment sent to ${res.deliveredToGuardians ?? 0} guardian(s) of ${res.deliveredToStudents ?? 0} enrolled student(s) in ${payload.className} · ${payload.section}!`,
      )
    }
    return res
  }

  const reactClassMoment: SchoolState['reactClassMoment'] = async (momentId, opts) => {
    const res = await callClassMomentsApi(
      {
        action: 'react',
        momentId,
        toggleLike: Boolean(opts?.toggleLike),
        markSeen: opts?.markSeen !== false,
      },
      opts?.toggleLike ? 'Appreciation reaction updated ♥' : undefined,
    )
    return { ok: res.ok, error: res.error }
  }

  const commentClassMoment: SchoolState['commentClassMoment'] = async (momentId, text) => {
    const res = await callClassMomentsApi(
      { action: 'comment', momentId, text },
      'Reply posted on Class Moment',
    )
    return { ok: res.ok, error: res.error }
  }

  const deleteClassMoment: SchoolState['deleteClassMoment'] = async (momentId) => {
    const res = await callClassMomentsApi(
      { action: 'delete', momentId },
      'Class Moment deleted',
    )
    return { ok: res.ok, error: res.error }
  }

  const callModuleApi = async (
    endpoint: string,
    body: Record<string, unknown>,
    successMsg?: string,
  ): Promise<{ ok: boolean; error?: string; json?: Record<string, unknown> }> => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as Record<string, unknown> & {
        ok?: boolean
        error?: string
        version?: number
        calendarEvents?: AcademicCalendarEvent[]
        ptmSlots?: PtmSlotItem[]
        earlyYearsCareLogs?: EarlyYearsCareLog[]
        classFeeSchedules?: ClassFeeScheduleItem[]
        siblingDiscountPct?: number
        fees?: FeeInvoice[]
        students?: StudentRecord[]
        parentAlerts?: ParentAlertLogItem[]
        notifications?: NotificationItem[]
        helpDeskTickets?: HelpDeskTicket[]
        campusTasks?: CampusTaskItem[]
        employeeDuties?: EmployeeDutyShift[]
        rfidDevices?: RfidDeviceRecord[]
        rfidPunches?: RfidPunchLog[]
        studentFines?: StudentFineRecord[]
        liveMeetings?: LiveMeetingItem[]
        stockItems?: StockItemRecord[]
        stockMovements?: StockMovementLog[]
        questionBank?: QuestionBankItem[]
        jobVacancies?: JobVacancyItem[]
        jobApplications?: JobApplicationRecord[]
        websiteConfig?: SchoolWebsiteConfig
        accountingBook?: AccountingBookState
        payrollBook?: PayrollBookState
        examBook?: ExamBookState
        transportBook?: TransportBookState
        libraryCirculation?: LibraryCirculationLog[]
        teacherSalaries?: TeacherSalaryRecord[]
        chats?: ChatThread[]
        libraryBooks?: LibraryBook[]
        studyResources?: StudyResourceItem[]
        leaveRequests?: LeaveRequest[]
        teacherLeaves?: TeacherLeaveSubItem[]
        assignments?: AssignmentItem[]
        expenses?: ExpenseRecord[]
        otherIncomes?: OtherIncomeRecord[]
        admissions?: AdmissionApplication[]
        guardians?: GuardianRecord[]
        canteenWallets?: CanteenWallet[]
        canteenTransactions?: CanteenTransaction[]
        alumni?: AlumniRecord[]
        courseMaterials?: CourseMaterialItem[]
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Operation failed.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        stateVersionRef.current = json.version
        skipNextServerSaveRef.current = true
      }
      if (Array.isArray(json.calendarEvents)) setCalendarEvents(json.calendarEvents)
      if (Array.isArray(json.ptmSlots)) setPtmSlots(json.ptmSlots)
      if (Array.isArray(json.earlyYearsCareLogs)) setEarlyYearsCareLogs(json.earlyYearsCareLogs)
      if (Array.isArray(json.classFeeSchedules)) setClassFeeSchedules(json.classFeeSchedules)
      if (typeof json.siblingDiscountPct === 'number') {
        setSiblingDiscountPct(json.siblingDiscountPct)
      }
      if (Array.isArray(json.fees)) setFees(json.fees)
      if (Array.isArray(json.students)) setStudents(json.students)
      if (Array.isArray(json.parentAlerts)) setParentAlerts(json.parentAlerts)
      if (Array.isArray(json.notifications)) setNotifications(json.notifications)
      if (Array.isArray(json.helpDeskTickets)) setHelpDeskTickets(json.helpDeskTickets)
      if (Array.isArray(json.campusTasks)) setCampusTasks(json.campusTasks)
      if (Array.isArray(json.employeeDuties)) setEmployeeDuties(json.employeeDuties)
      if (Array.isArray(json.rfidDevices)) setRfidDevices(json.rfidDevices)
      if (Array.isArray(json.rfidPunches)) setRfidPunches(json.rfidPunches)
      if (Array.isArray(json.studentFines)) setStudentFines(json.studentFines)
      if (Array.isArray(json.liveMeetings)) setLiveMeetings(json.liveMeetings)
      if (Array.isArray(json.stockItems)) setStockItems(json.stockItems)
      if (Array.isArray(json.stockMovements)) setStockMovements(json.stockMovements)
      if (Array.isArray(json.questionBank)) setQuestionBank(json.questionBank)
      if (Array.isArray(json.jobVacancies)) setJobVacancies(json.jobVacancies)
      if (Array.isArray(json.jobApplications)) setJobApplications(json.jobApplications)
      if (json.websiteConfig && typeof json.websiteConfig === 'object') {
        setWebsiteConfig(json.websiteConfig)
      }
      if (json.accountingBook && typeof json.accountingBook === 'object') {
        setAccountingBook(json.accountingBook)
      }
      if (json.payrollBook && typeof json.payrollBook === 'object') {
        setPayrollBook(json.payrollBook)
      }
      if (json.examBook && typeof json.examBook === 'object') {
        setExamBook(json.examBook)
      }
      if (json.transportBook && typeof json.transportBook === 'object') {
        setTransportBook(json.transportBook)
      }
      if (Array.isArray(json.libraryCirculation)) {
        setLibraryCirculation(json.libraryCirculation)
      }
      if (Array.isArray(json.teacherSalaries)) {
        setTeacherSalaries(json.teacherSalaries)
      }
      if (Array.isArray(json.chats)) setChats(json.chats)
      if (Array.isArray(json.libraryBooks)) setLibraryBooks(json.libraryBooks)
      if (Array.isArray(json.studyResources)) setStudyResources(json.studyResources)
      if (Array.isArray(json.leaveRequests)) setLeaveRequests(json.leaveRequests)
      if (Array.isArray(json.teacherLeaves)) setTeacherLeaves(json.teacherLeaves)
      if (Array.isArray(json.assignments)) setAssignments(json.assignments)
      if (Array.isArray(json.expenses)) setExpenses(json.expenses)
      if (Array.isArray(json.otherIncomes)) setOtherIncomes(json.otherIncomes)
      if (Array.isArray(json.admissions)) setAdmissions(json.admissions)
      if (Array.isArray(json.guardians)) setGuardians(json.guardians)
      if (Array.isArray(json.canteenWallets)) setCanteenWallets(json.canteenWallets)
      if (Array.isArray(json.canteenTransactions)) {
        setCanteenTransactions(json.canteenTransactions)
      }
      if (Array.isArray(json.alumni)) setAlumni(json.alumni)
      if (Array.isArray(json.courseMaterials)) setCourseMaterials(json.courseMaterials)
      if (successMsg) notify(successMsg)
      return { ok: true, json }
    } catch {
      const msg = 'Network error while syncing with DMHA server.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const runErpOps: SchoolState['runErpOps'] = async (payload, successMsg) => {
    const res = await callModuleApi('/dmhs-api/erp-ops', payload, successMsg)
    return { ok: res.ok, error: res.error }
  }

  const runErpCampus: SchoolState['runErpCampus'] = async (payload, successMsg) => {
    const res = await callModuleApi('/dmhs-api/erp-campus', payload, successMsg)
    return { ok: res.ok, error: res.error }
  }

  const runAccountingAction: SchoolState['runAccountingAction'] = async (payload, successMsg) => {
    const res = await callModuleApi('/dmhs-api/accounting', payload, successMsg)
    return { ok: res.ok, error: res.error }
  }

  const runPayrollAction: SchoolState['runPayrollAction'] = async (payload, successMsg) => {
    const res = await callModuleApi('/dmhs-api/payroll-suite', payload, successMsg)
    return { ok: res.ok, error: res.error }
  }

  const runExamAction: SchoolState['runExamAction'] = async (payload, successMsg) => {
    const res = await callModuleApi('/dmhs-api/exam-ops', payload, successMsg)
    return { ok: res.ok, error: res.error }
  }

  const runMessageAction: SchoolState['runMessageAction'] = async (payload, successMsg) => {
    const res = await callModuleApi('/dmhs-api/messages', payload, successMsg)
    return {
      ok: res.ok,
      error: res.error,
      threadId: typeof res.json?.threadId === 'string' ? res.json.threadId : undefined,
    }
  }

  const runLibraryAction: SchoolState['runLibraryAction'] = async (payload, successMsg) => {
    const res = await callModuleApi('/dmhs-api/library', payload, successMsg)
    return { ok: res.ok, error: res.error }
  }

  const runTransportAction: SchoolState['runTransportAction'] = async (payload, successMsg) => {
    const res = await callModuleApi('/dmhs-api/transport', payload, successMsg)
    return { ok: res.ok, error: res.error }
  }

  const runLeaveAction: SchoolState['runLeaveAction'] = async (payload, successMsg) => {
    const res = await callModuleApi('/dmhs-api/leaves', payload, successMsg)
    return { ok: res.ok, error: res.error }
  }

  const runTaskAction: SchoolState['runTaskAction'] = async (payload, successMsg) => {
    const res = await callModuleApi('/dmhs-api/tasks', payload, successMsg)
    return { ok: res.ok, error: res.error }
  }

  const createCalendarEvent: SchoolState['createCalendarEvent'] = async (payload) => {
    const res = await callModuleApi(
      '/dmhs-api/campus-calendar',
      { action: 'create_event', ...payload },
      `Added "${payload.title}" to DMHA School Calendar`,
    )
    return { ok: res.ok, error: res.error }
  }

  const deleteCalendarEvent: SchoolState['deleteCalendarEvent'] = async (eventId) => {
    const res = await callModuleApi(
      '/dmhs-api/campus-calendar',
      { action: 'delete_event', eventId },
      'Removed event from School Calendar',
    )
    return { ok: res.ok, error: res.error }
  }

  const createPtmSlots: SchoolState['createPtmSlots'] = async (payload) => {
    const res = await callModuleApi('/dmhs-api/ptm', { action: 'create_slots', ...payload })
    const createdCount = Number(res.json?.createdCount || 0)
    if (res.ok) notify(`Published ${createdCount} PTM slot(s) for ${payload.dateIso}!`)
    return { ok: res.ok, error: res.error, createdCount }
  }

  const bookPtmSlot: SchoolState['bookPtmSlot'] = async (payload) => {
    const res = await callModuleApi(
      '/dmhs-api/ptm',
      { action: 'book_slot', ...payload },
      'PTM consultation slot confirmed ✓',
    )
    return { ok: res.ok, error: res.error }
  }

  const cancelPtmSlot: SchoolState['cancelPtmSlot'] = async (slotId) => {
    const res = await callModuleApi(
      '/dmhs-api/ptm',
      { action: 'cancel_booking', slotId },
      'PTM booking cancelled & slot reopened',
    )
    return { ok: res.ok, error: res.error }
  }

  const completePtmSlot: SchoolState['completePtmSlot'] = async (slotId, outcomeNotes) => {
    const res = await callModuleApi(
      '/dmhs-api/ptm',
      { action: 'complete_slot', slotId, outcomeNotes },
      'PTM marked Completed & outcome notes sent to Guardian ✓',
    )
    return { ok: res.ok, error: res.error }
  }

  const deletePtmSlot: SchoolState['deletePtmSlot'] = async (slotId) => {
    const res = await callModuleApi(
      '/dmhs-api/ptm',
      { action: 'delete_slot', slotId },
      'PTM slot removed',
    )
    return { ok: res.ok, error: res.error }
  }

  const logEarlyYearsCare: SchoolState['logEarlyYearsCare'] = async (payload) => {
    const stu = students.find((s) => s.id === payload.studentId)
    const res = await callModuleApi(
      '/dmhs-api/early-years-care',
      { action: 'log_care', ...payload },
      `Daily Care Card saved & sent to ${stu?.name || 'student'}’s Guardian ✓`,
    )
    return { ok: res.ok, error: res.error }
  }

  const acknowledgeEarlyYearsCare: SchoolState['acknowledgeEarlyYearsCare'] = async (
    logId,
    guardianReply,
  ) => {
    const res = await callModuleApi(
      '/dmhs-api/early-years-care',
      { action: 'acknowledge_care', logId, guardianReply },
      'Daily Care Card acknowledged ✓',
    )
    return { ok: res.ok, error: res.error }
  }

  const deleteEarlyYearsCare: SchoolState['deleteEarlyYearsCare'] = async (logId) => {
    const res = await callModuleApi(
      '/dmhs-api/early-years-care',
      { action: 'delete_care', logId },
      'Daily Care Card removed',
    )
    return { ok: res.ok, error: res.error }
  }

  const saveClassFeeSchedules: SchoolState['saveClassFeeSchedules'] = async (
    schedules,
    discountPct,
  ) => {
    const res = await callModuleApi(
      '/dmhs-api/billing-generator',
      { action: 'save_schedule', schedules, siblingDiscountPct: discountPct },
      `Fee schedule & ${discountPct}% Sibling Discount saved`,
    )
    return { ok: res.ok, error: res.error }
  }

  const generateMonthlyFeeInvoices: SchoolState['generateMonthlyFeeInvoices'] = async (payload) => {
    const res = await callModuleApi('/dmhs-api/billing-generator', {
      action: 'generate_monthly',
      ...payload,
    })
    const createdCount = Number(res.json?.createdCount || 0)
    const siblingDiscountsApplied = Number(res.json?.siblingDiscountsApplied || 0)
    const skippedDuplicates = Number(res.json?.skippedDuplicates || 0)
    const totalDiscountBdt = Number(res.json?.totalDiscountBdt || 0)
    const totalBilled = Number(res.json?.totalBilled || 0)
    if (res.ok) {
      notify(
        `Generated ${createdCount} invoice(s) (৳${totalBilled.toLocaleString()}) · ${siblingDiscountsApplied} sibling discount(s) applied!`,
      )
    }
    return {
      ok: res.ok,
      error: res.error,
      createdCount,
      skippedDuplicates,
      siblingDiscountsApplied,
      totalDiscountBdt,
      totalBilled,
    }
  }

  const sendBulkFeeReminders: SchoolState['sendBulkFeeReminders'] = async () => {
    const res = await callModuleApi('/dmhs-api/billing-generator', {
      action: 'send_due_reminders',
    })
    const remindedCount = Number(res.json?.remindedCount || 0)
    if (res.ok) notify(`Dispatched ${remindedCount} payment reminder(s) to Guardians ✓`)
    return { ok: res.ok, error: res.error, remindedCount }
  }

  const sendChatMessage = (threadId: string, text: string) => {
    const clean = text.trim()
    if (!clean) return
    void callModuleApi(
      '/dmhs-api/messages',
      { action: 'send_message', threadId, text: clean },
      'Message sent',
    )
  }

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const addPickupContact = (payload: {
    studentId: string
    name: string
    relation: string
    phone: string
    idNumber: string
  }) => {
    const next: PickupContact = {
      id: `pk-${Date.now()}`,
      ...payload,
      verified: true,
    }
    setPickupContacts((prev) => [next, ...prev])
    notify(`Authorized pickup contact "${payload.name}" added`)
  }

  const logGateDismissal = (payload: { studentId: string; pickedUpBy: string; gate: string }) => {
    const stu = students.find((s) => s.id === payload.studentId)
    if (!stu) return
    const item: DismissalLogItem = {
      id: `dis-${Date.now()}`,
      studentId: stu.id,
      studentName: stu.name,
      pickedUpBy: payload.pickedUpBy,
      time: 'Today · Just now',
      gate: payload.gate,
      verifiedBy: 'QR Gate Pass Verified',
    }
    setDismissalLogs((prev) => [item, ...prev])
    pushNotification({
      title: `Safe Dismissal Confirmed · ${stu.name}`,
      text: `${stu.name} was picked up by ${payload.pickedUpBy} at ${payload.gate} (QR Verified).`,
      type: 'pickup',
      forRoles: ['guardian', 'admin'],
    })
    notify(`Dismissal verified & Guardian notified for ${stu.name}`)
  }

  const addMedicalLog = (payload: {
    studentId: string
    symptom: string
    actionTaken: string
    severity: MedicalLogItem['severity']
  }) => {
    const stu = students.find((s) => s.id === payload.studentId)
    if (!stu) return
    const item: MedicalLogItem = {
      id: `med-${Date.now()}`,
      studentId: stu.id,
      studentName: stu.name,
      date: 'Today · Just now',
      symptom: payload.symptom,
      actionTaken: payload.actionTaken,
      severity: payload.severity,
      loggedBy: 'School Infirmary (RN)',
      guardianNotified: true,
    }
    setMedicalLogs((prev) => [item, ...prev])
    pushNotification({
      title: `Infirmary Health Update · ${stu.name}`,
      text: `${payload.symptom}. Action: ${payload.actionTaken}`,
      type: 'health',
      forRoles: ['guardian', 'admin'],
    })
    notify(`Medical log saved & Guardian alerted for ${stu.name}`)
  }

  const callHousePastoralApi = async (
    body: Record<string, unknown>,
    successMsg?: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/dmhs-api/house-pastoral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        version?: number
        merits?: MeritLogItem[]
        houseStandings?: Record<HouseName, number>
        students?: StudentRecord[]
        studentAchievements?: StudentAchievementItem[]
        pastPapers?: PastPaperItem[]
        notifications?: NotificationItem[]
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'House & Pastoral operation failed.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        stateVersionRef.current = json.version
        skipNextServerSaveRef.current = true
      }
      if (Array.isArray(json.merits)) setMerits(json.merits)
      if (json.houseStandings) setHouseStandings(json.houseStandings)
      if (Array.isArray(json.students)) setStudents(json.students)
      if (Array.isArray(json.studentAchievements)) setStudentAchievements(json.studentAchievements)
      if (Array.isArray(json.pastPapers)) setPastPapers(json.pastPapers)
      if (Array.isArray(json.notifications)) setNotifications(json.notifications)
      if (successMsg) notify(successMsg)
      return { ok: true }
    } catch {
      const msg = 'Network error while updating House & Pastoral records.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const awardMeritOrPastoral: SchoolState['awardMeritOrPastoral'] = async (payload) => {
    const stu = students.find((s) => s.id === payload.studentId)
    if (!stu) return { ok: false, error: 'Student not found.' }
    if (!payload.studyQuestReward) {
      return callHousePastoralApi(
        {
          action: 'award_entry',
          studentId: payload.studentId,
          house: payload.house,
          points: payload.points,
          type: payload.type,
          category: payload.category,
          tier: payload.tier,
          actionPlan: payload.actionPlan,
          reason: payload.reason,
        },
        payload.type === 'merit'
          ? `Awarded +${Math.abs(payload.points)} ${payload.house} House points to ${stu.name}!`
          : `Pastoral case logged (${payload.tier || 'Review'}) & Guardian alerted for ${stu.name}`,
      )
    }
    try {
      const res = await fetch('/dmhs-api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim_study_reward',
          studentId: payload.studentId,
          house: payload.house,
          points: payload.points,
          type: payload.type,
          tier: payload.tier,
          reason: payload.reason,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        duplicate?: boolean
        merits?: MeritLogItem[]
        houseStandings?: Record<HouseName, number>
        students?: StudentRecord[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to record merit points.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        stateVersionRef.current = json.version
        skipNextServerSaveRef.current = true
      }
      if (Array.isArray(json.merits)) setMerits(json.merits)
      if (json.houseStandings) setHouseStandings(json.houseStandings)
      if (Array.isArray(json.students)) setStudents(json.students)
      return { ok: true }
    } catch {
      const msg = 'Network error while updating leaderboard merits.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const updatePastoralCase: SchoolState['updatePastoralCase'] = async (payload) => {
    return callHousePastoralApi(
      { action: 'update_pastoral_case', ...payload },
      payload.pastoralStatus === 'resolved'
        ? 'Pastoral case marked Resolved ✓'
        : 'Pastoral care case updated & saved',
    )
  }

  const acknowledgeMeritOrPastoral: SchoolState['acknowledgeMeritOrPastoral'] = async (
    entryId,
    guardianReply,
  ) => {
    return callHousePastoralApi(
      { action: 'acknowledge_entry', entryId, guardianReply },
      'Guardian acknowledgement & reply saved ✓',
    )
  }

  const deleteMeritOrPastoral: SchoolState['deleteMeritOrPastoral'] = async (entryId) => {
    return callHousePastoralApi(
      { action: 'delete_entry', entryId },
      'Entry removed & House Standings recalculated',
    )
  }

  const reassignStudentHouse: SchoolState['reassignStudentHouse'] = async (studentId, house) => {
    const stu = students.find((s) => s.id === studentId)
    return callHousePastoralApi(
      { action: 'reassign_student_house', studentId, house },
      `${stu?.name || 'Student'} assigned to ${house} House`,
    )
  }

  const addStudentAchievement: SchoolState['addStudentAchievement'] = async (payload) => {
    const stu = students.find((s) => s.id === payload.studentId)
    return callHousePastoralApi(
      { action: 'add_achievement', ...payload },
      `Verified achievement "${payload.title}" awarded to ${stu?.name || 'Student'}!`,
    )
  }

  const addPastPaperItem: SchoolState['addPastPaperItem'] = async (payload) => {
    return callHousePastoralApi(
      { action: 'add_past_paper', ...payload },
      `Published "${payload.title}" to Practice & Past Paper Vault`,
    )
  }

  const deletePastPaperItem: SchoolState['deletePastPaperItem'] = async (paperId) => {
    return callHousePastoralApi(
      { action: 'delete_past_paper', paperId },
      'Removed practice paper from vault',
    )
  }

  const syncLeaderboardRanks: SchoolState['syncLeaderboardRanks'] = async () => {
    try {
      const res = await fetch('/dmhs-api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_ranks' }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        updatedCount?: number
        students?: StudentRecord[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to sync class ranks.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.students)) setStudents(json.students)
      notify(`Synced official live ranks for ${json.updatedCount || 0} students in SQLite`)
      return { ok: true, updatedCount: json.updatedCount }
    } catch {
      const msg = 'Network error while syncing class ranks.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const signConsentForm: SchoolState['signConsentForm'] = async (formId, verification, extra) => {
    try {
      const res = await fetch('/dmhs-api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond',
          formId,
          decision: 'approved',
          verification,
          ...(extra || {}),
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        consentForms?: ConsentFormItem[]
        notifications?: NotificationItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to sign consent form.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.consentForms)) setConsentForms(json.consentForms)
      if (Array.isArray(json.notifications)) setNotifications(json.notifications)
      notify(
        verification
          ? `Consent verified (${verification.method}) & e-signed in SQLite!`
          : 'Consent form approved & e-signed in SQLite!',
      )
      return { ok: true }
    } catch {
      const msg = 'Unable to reach DMHA Consent server.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const declineConsentForm: SchoolState['declineConsentForm'] = async (formId, reason) => {
    try {
      const res = await fetch('/dmhs-api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond',
          formId,
          decision: 'declined',
          declineReason: reason,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        consentForms?: ConsentFormItem[]
        notifications?: NotificationItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to decline consent form.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.consentForms)) setConsentForms(json.consentForms)
      if (Array.isArray(json.notifications)) setNotifications(json.notifications)
      notify('Consent declined & teacher/admin notified.')
      return { ok: true }
    } catch {
      const msg = 'Unable to reach DMHA Consent server.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const createConsentForm: SchoolState['createConsentForm'] = async (payload) => {
    try {
      const res = await fetch('/dmhs-api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...payload }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        createdCount?: number
        consentForms?: ConsentFormItem[]
        notifications?: NotificationItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to send consent form.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.consentForms)) setConsentForms(json.consentForms)
      if (Array.isArray(json.notifications)) setNotifications(json.notifications)
      notify(
        `Digital consent form sent to ${json.createdCount || 1} student(s) & their guardians!`,
      )
      return { ok: true, createdCount: json.createdCount }
    } catch {
      const msg = 'Unable to reach DMHA Consent server.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const remindConsentForm: SchoolState['remindConsentForm'] = async (payload) => {
    try {
      const res = await fetch('/dmhs-api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remind', ...payload }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        remindedCount?: number
        notifications?: NotificationItem[]
        parentAlerts?: ParentAlertLogItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to send reminder.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.notifications)) setNotifications(json.notifications)
      if (Array.isArray(json.parentAlerts)) setParentAlerts(json.parentAlerts)
      notify(`Consent signature reminder sent to ${json.remindedCount || 1} guardian(s)!`)
      return { ok: true, remindedCount: json.remindedCount }
    } catch {
      const msg = 'Unable to reach DMHA Consent server.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const deleteConsentForm: SchoolState['deleteConsentForm'] = async (payload) => {
    try {
      const res = await fetch('/dmhs-api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ...payload }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        consentForms?: ConsentFormItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to delete consent form.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.consentForms)) setConsentForms(json.consentForms)
      notify('Consent form removed from SQLite.')
      return { ok: true }
    } catch {
      const msg = 'Unable to reach DMHA Consent server.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const topUpCanteenWallet = (studentId: string, amount: number) => {
    void (async () => {
      const res = await callModuleApi('/dmhs-api/canteen', {
        action: 'top_up_wallet',
        studentId,
        amount,
      })
      if (res.ok) {
        const vno = String(res.json?.voucherNo || '')
        notify(
          `Canteen wallet topped up by ৳${amount.toLocaleString()}${vno ? ` · Auto-Voucher ${vno}` : ''}`,
        )
      }
    })()
  }

  const updateCanteenLimit = (studentId: string, limit: number) => {
    void callModuleApi(
      '/dmhs-api/canteen',
      {
        action: 'update_limit',
        studentId,
        dailyLimit: limit,
      },
      `Daily canteen spend limit updated to ৳${limit}`,
    )
  }

  const pushAudit = (action: string, target: string) => {
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        action,
        target,
        actor: `${ADMIN_PROFILE.name} (Admin)`,
        time: 'Just now',
      },
      ...prev,
    ])
  }

  const addTeacher = (payload: {
    name: string
    email: string
    phone: string
    subject: string
    department: string
    assignedClasses: string[]
    initialPassword?: string
  }) => {
    const id = `tch-${Date.now()}`
    const initials = getInitials(payload.name)
    const newTeacher: TeacherRecord = {
      id,
      name: payload.name.trim(),
      initials,
      email: payload.email.trim() || `${payload.name.toLowerCase().replace(/\s+/g, '.')}@dmha.edu.bd`,
      phone: payload.phone.trim() || '+880 1700-000000',
      subject: payload.subject,
      department: payload.department || `${payload.subject} Faculty`,
      assignedClasses: payload.assignedClasses.length > 0 ? payload.assignedClasses : ['Class 6A'],
      status: 'active',
    }
    setTeachers((prev) => [newTeacher, ...prev])
    void adminResetUserPassword({
      linkedEntityId: id,
      role: 'teacher',
      displayName: newTeacher.name,
      email: newTeacher.email,
      status: 'active',
      newPassword: payload.initialPassword?.trim() || 'dmha2026',
    })
    setChats((prev) => [
      {
        id: `ch-${id}`,
        participantName: newTeacher.name,
        participantRole: `${newTeacher.subject} Teacher`,
        initials,
        unread: 0,
        messages: [
          {
            id: `m-${id}`,
            sender: newTeacher.name,
            senderRole: 'teacher',
            text: `Hello! I am ${newTeacher.name}, teaching ${newTeacher.subject} (${newTeacher.assignedClasses.join(', ')}). Feel free to reach out anytime.`,
            time: 'Just now',
          },
        ],
      },
      ...prev,
    ])
    pushAudit('Added Teacher', `${newTeacher.name} · ${newTeacher.subject} (${newTeacher.assignedClasses.join(', ')})`)
    pushNotification({
      title: 'New Faculty Member Joined',
      text: `${newTeacher.name} (${newTeacher.subject}) has been added by Admin.`,
      type: 'notice',
      forRoles: ['admin', 'teacher', 'guardian'],
    })
    notify(`Teacher ${newTeacher.name} added with login account & password`)
  }

  const updateTeacherProfile: SchoolState['updateTeacherProfile'] = async (
    teacherId,
    updates,
    newPassword,
  ) => {
    const target = teachers.find((t) => t.id === teacherId)
    if (!target) return { ok: false, error: 'Teacher not found.' }
    const nextName = (updates.name ?? target.name).trim()
    const nextEmail = (updates.email ?? target.email).trim()
    const nextTeacher: TeacherRecord = {
      ...target,
      ...updates,
      name: nextName,
      initials: getInitials(nextName),
      email: nextEmail,
    }
    const authRes = await adminResetUserPassword({
      linkedEntityId: teacherId,
      role: 'teacher',
      displayName: nextTeacher.name,
      email: nextTeacher.email,
      status: nextTeacher.status,
      newPassword: newPassword?.trim() || undefined,
    })
    if (!authRes.ok) return authRes

    setTeachers((prev) => prev.map((t) => (t.id === teacherId ? nextTeacher : t)))
    setChats((prev) =>
      prev.map((c) =>
        c.id === `ch-${teacherId}`
          ? { ...c, participantName: nextTeacher.name, initials: nextTeacher.initials }
          : c,
      ),
    )
    pushAudit(
      newPassword?.trim() ? 'Updated Teacher Profile & Reset Password' : 'Updated Teacher Profile',
      `${nextTeacher.name} (${nextTeacher.email})`,
    )
    notify(
      newPassword?.trim()
        ? `${nextTeacher.name}’s profile & password updated in SQLite DB`
        : `${nextTeacher.name}’s profile saved`,
    )
    return { ok: true }
  }

  const toggleTeacherStatus = (teacherId: string) => {
    const target = teachers.find((t) => t.id === teacherId)
    if (!target) return
    const nextStatus: 'active' | 'suspended' = target.status === 'active' ? 'suspended' : 'active'
    setTeachers((prev) =>
      prev.map((t) => (t.id === teacherId ? { ...t, status: nextStatus } : t)),
    )
    pushAudit(nextStatus === 'suspended' ? 'Suspended Teacher' : 'Reactivated Teacher', target.name)
    notify(`${target.name} marked as ${nextStatus}`)
  }

  const updateTeacherClasses = (teacherId: string, classes: string[]) => {
    let targetName = ''
    setTeachers((prev) =>
      prev.map((t) => {
        if (t.id !== teacherId) return t
        targetName = t.name
        return { ...t, assignedClasses: classes }
      }),
    )
    if (targetName) {
      pushAudit('Updated Faculty Classes', `${targetName} → ${classes.join(', ') || 'Unassigned'}`)
      notify(`Updated classes for ${targetName}`)
    }
  }

  const removeTeacher = (teacherId: string) => {
    const target = teachers.find((t) => t.id === teacherId)
    if (!target) return
    setTeachers((prev) => prev.filter((t) => t.id !== teacherId))
    if (activeTeacherId === teacherId) {
      const fallback = teachers.find((t) => t.id !== teacherId)
      if (fallback) setActiveTeacherId(fallback.id)
    }
    pushAudit('Removed Teacher', `${target.name} (${target.subject})`)
    notify(`Removed teacher ${target.name}`)
  }

  const addGuardian = (payload: {
    name: string
    relation: string
    phone: string
    email: string
    linkedStudentId?: string
    initialPassword?: string
  }) => {
    const id = `grd-${Date.now()}`
    const initials = getInitials(payload.name)
    const linked = payload.linkedStudentId ? [payload.linkedStudentId] : []
    const newGuardian: GuardianRecord = {
      id,
      name: payload.name.trim(),
      initials,
      relation: payload.relation.trim() || 'Guardian',
      phone: payload.phone.trim() || '+880 1700-000000',
      email: payload.email.trim() || `${payload.name.toLowerCase().replace(/\s+/g, '.')}@family.edu.bd`,
      linkedStudentIds: linked,
      status: 'active',
      sharedDeviceMode: true,
      parentPin: '1234',
    }
    setGuardians((prev) => [newGuardian, ...prev])
    void adminResetUserPassword({
      linkedEntityId: id,
      role: 'guardian',
      displayName: newGuardian.name,
      email: newGuardian.email,
      status: 'active',
      newPassword: payload.initialPassword?.trim() || 'dmha2026',
    })
    if (payload.linkedStudentId) {
      const stuId = payload.linkedStudentId
      setStudents((prev) =>
        prev.map((s) =>
          s.id === stuId
            ? {
                ...s,
                guardianId: id,
                guardianName: newGuardian.name,
                guardianPhone: newGuardian.phone,
              }
            : s,
        ),
      )
      setPickupContacts((prev) => [
        {
          id: `pk-${Date.now()}`,
          studentId: stuId,
          name: newGuardian.name,
          relation: newGuardian.relation,
          phone: newGuardian.phone,
          idNumber: 'NID-VERIFIED',
          verified: true,
        },
        ...prev,
      ])
    }
    pushAudit('Added Guardian', `${newGuardian.name} (${newGuardian.relation})`)
    notify(`Guardian ${newGuardian.name} created with login account & password`)
  }

  const updateGuardianProfile: SchoolState['updateGuardianProfile'] = async (
    guardianId,
    updates,
    newPassword,
  ) => {
    const target = guardians.find((g) => g.id === guardianId)
    if (!target) return { ok: false, error: 'Guardian not found.' }
    const nextName = (updates.name ?? target.name).trim()
    const nextEmail = (updates.email ?? target.email).trim()
    const nextPhone = (updates.phone ?? target.phone).trim()
    const nextGuardian: GuardianRecord = {
      ...target,
      ...updates,
      name: nextName,
      initials: getInitials(nextName),
      email: nextEmail,
      phone: nextPhone,
    }
    const authRes = await adminResetUserPassword({
      linkedEntityId: guardianId,
      role: 'guardian',
      displayName: nextGuardian.name,
      email: nextGuardian.email,
      status: nextGuardian.status,
      newPassword: newPassword?.trim() || undefined,
    })
    if (!authRes.ok) return authRes

    setGuardians((prev) => prev.map((g) => (g.id === guardianId ? nextGuardian : g)))
    setStudents((prev) =>
      prev.map((s) =>
        s.guardianId === guardianId || nextGuardian.linkedStudentIds.includes(s.id)
          ? { ...s, guardianName: nextGuardian.name, guardianPhone: nextGuardian.phone }
          : s,
      ),
    )
    pushAudit(
      newPassword?.trim() ? 'Updated Guardian Profile & Reset Password' : 'Updated Guardian Profile',
      `${nextGuardian.name} (${nextGuardian.email})`,
    )
    notify(
      newPassword?.trim()
        ? `${nextGuardian.name}’s profile & password updated in SQLite DB`
        : `${nextGuardian.name}’s profile saved`,
    )
    return { ok: true }
  }

  const toggleGuardianStatus = (guardianId: string) => {
    const target = guardians.find((g) => g.id === guardianId)
    if (!target) return
    const nextStatus: 'active' | 'suspended' = target.status === 'active' ? 'suspended' : 'active'
    setGuardians((prev) =>
      prev.map((g) => (g.id === guardianId ? { ...g, status: nextStatus } : g)),
    )
    pushAudit(nextStatus === 'suspended' ? 'Suspended Guardian' : 'Reactivated Guardian', target.name)
    notify(`${target.name} marked as ${nextStatus}`)
  }

  const linkStudentToGuardian = (studentId: string, guardianId: string) => {
    const grd = guardians.find((g) => g.id === guardianId)
    const stu = students.find((s) => s.id === studentId)
    if (!grd || !stu) return

    setGuardians((prev) =>
      prev.map((g) => {
        if (g.id === guardianId) {
          return g.linkedStudentIds.includes(studentId)
            ? g
            : { ...g, linkedStudentIds: [...g.linkedStudentIds, studentId] }
        }
        return { ...g, linkedStudentIds: g.linkedStudentIds.filter((sid) => sid !== studentId) }
      }),
    )
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, guardianId: grd.id, guardianName: grd.name, guardianPhone: grd.phone }
          : s,
      ),
    )
    setPickupContacts((prev) => {
      const exists = prev.some((p) => p.studentId === studentId && p.name === grd.name)
      if (exists) return prev
      return [
        {
          id: `pk-${Date.now()}`,
          studentId,
          name: grd.name,
          relation: grd.relation,
          phone: grd.phone,
          idNumber: 'NID-VERIFIED',
          verified: true,
        },
        ...prev,
      ]
    })
    pushAudit('Linked Student ↔ Guardian', `${stu.name} → ${grd.name}`)
    notify(`Linked ${stu.name} to guardian ${grd.name}`)
  }

  const removeGuardian = (guardianId: string) => {
    const target = guardians.find((g) => g.id === guardianId)
    if (!target) return
    setGuardians((prev) => prev.filter((g) => g.id !== guardianId))
    if (activeGuardianId === guardianId) {
      const fallback = guardians.find((g) => g.id !== guardianId)
      if (fallback) setActiveGuardianId(fallback.id)
    }
    pushAudit('Removed Guardian', target.name)
    notify(`Removed guardian ${target.name}`)
  }

  const addStudent = (payload: {
    name: string
    className: string
    section: string
    roll: string
    guardianId: string
    house: HouseName
    bloodGroup: string
    busRoute: string
    initialPassword?: string
  }) => {
    const id = `stu-${Date.now()}`
    const initials = getInitials(payload.name)
    const grd = guardians.find((g) => g.id === payload.guardianId) || guardians[0]
    const mathTeacher = teachers.find((t) => t.subject.toLowerCase().includes('math'))?.name || 'Sakib Ahmed'
    const phyTeacher = teachers.find((t) => t.subject.toLowerCase().includes('phys'))?.name || 'Nadia Rahman'
    const engTeacher = teachers.find((t) => t.subject.toLowerCase().includes('eng'))?.name || 'Farhana Karim'

    const newStudent: StudentRecord = {
      id,
      name: payload.name.trim(),
      initials,
      className: payload.className,
      section: payload.section,
      roll: payload.roll.trim() || String(students.length + 10),
      guardianId: grd?.id,
      guardianName: grd?.name || GUARDIAN_PROFILE.name,
      guardianPhone: grd?.phone || GUARDIAN_PROFILE.phone,
      status: 'active',
      house: payload.house,
      todayStatus: 'present',
      gateCheckIn: '07:55 AM',
      attendanceRate: 100,
      presentDays: 1,
      totalDays: 1,
      gpa: '4.50',
      averageScore: 84,
      rank: `#${students.length + 1}`,
      bloodGroup: payload.bloodGroup || 'O+',
      busRoute: payload.busRoute || 'Unit - 1',
      subjects: [
        {
          id: `${id}-math`,
          name: 'Mathematics',
          teacher: mathTeacher,
          section: `${payload.className} · ${payload.section}`,
          progress: 50,
          latestScore: 84,
          previousScore: 80,
          grade: 'A+',
          color: 'violet',
          nextTopic: 'Core Algebra',
        },
        {
          id: `${id}-phy`,
          name: 'Physics',
          teacher: phyTeacher,
          section: `${payload.className} · ${payload.section}`,
          progress: 50,
          latestScore: 86,
          previousScore: 82,
          grade: 'A+',
          color: 'cyan',
          nextTopic: 'Forces & Motion',
        },
        {
          id: `${id}-eng`,
          name: 'English',
          teacher: engTeacher,
          section: `${payload.className} · ${payload.section}`,
          progress: 50,
          latestScore: 82,
          previousScore: 80,
          grade: 'A+',
          color: 'lime',
          nextTopic: 'Comprehension & Essay',
        },
      ],
      todayPeriods: [
        {
          id: `${id}-p1`,
          time: '08:00',
          end: '08:45',
          subject: 'Mathematics',
          topic: 'Core Algebra',
          teacher: mathTeacher,
          room: `Room ${payload.className.replace('Class ', '')}${payload.section.replace('Section ', '')}`,
          color: 'violet',
          status: 'present',
        },
        {
          id: `${id}-p2`,
          time: '08:50',
          end: '09:35',
          subject: 'Physics',
          topic: 'Forces & Motion',
          teacher: phyTeacher,
          room: 'Science Lab',
          color: 'cyan',
          status: 'present',
        },
        {
          id: `${id}-p3`,
          time: '09:55',
          end: '10:40',
          subject: 'English',
          topic: 'Comprehension & Essay',
          teacher: engTeacher,
          room: `Room ${payload.className.replace('Class ', '')}${payload.section.replace('Section ', '')}`,
          color: 'lime',
          status: 'present',
        },
      ],
    }

    setStudents((prev) => [newStudent, ...prev])
    if (grd) {
      setGuardians((prev) =>
        prev.map((g) =>
          g.id === grd.id
            ? { ...g, linkedStudentIds: [...g.linkedStudentIds, id] }
            : g,
        ),
      )
      setPickupContacts((prev) => [
        {
          id: `pk-${Date.now()}`,
          studentId: id,
          name: grd.name,
          relation: grd.relation,
          phone: grd.phone,
          idNumber: 'NID-VERIFIED',
          verified: true,
        },
        ...prev,
      ])
    }
    setCanteenWallets((prev) => [
      {
        studentId: id,
        balance: 500,
        dailyLimit: 250,
        allergyGuard: 'Verified Safe',
      },
      ...prev,
    ])
    setFees((prev) => [
      {
        id: `fee-${Date.now()}`,
        studentId: id,
        studentName: newStudent.name,
        title: 'Admission & June Term Tuition Fee',
        dueDate: 'Due 30 June 2026',
        amount: 4500,
        status: 'due',
      },
      ...prev,
    ])
    pushAudit('Enrolled Student', `${newStudent.name} (${newStudent.className} ${newStudent.section} · Roll #${newStudent.roll}) → Guardian: ${newStudent.guardianName}`)
    void adminResetUserPassword({
      linkedEntityId: id,
      role: 'student',
      displayName: newStudent.name,
      loginCode: `STU-${newStudent.roll}`,
      status: 'active',
      newPassword: payload.initialPassword?.trim() || 'dmha2026',
    })
    pushNotification({
      title: `New Student Enrolled · ${newStudent.name}`,
      text: `${newStudent.name} joined ${newStudent.className} ${newStudent.section} and is linked to ${newStudent.guardianName}.`,
      type: 'notice',
      forRoles: ['admin', 'teacher', 'guardian'],
    })
    notify(`Enrolled ${newStudent.name} · Synced to Roll Call, Guardian, Canteen & Fees`)
  }

  const updateStudentProfile: SchoolState['updateStudentProfile'] = async (
    studentId,
    updates,
    newPassword,
    customEmail,
  ) => {
    const target = students.find((s) => s.id === studentId)
    if (!target) return { ok: false, error: 'Student not found.' }
    const nextName = (updates.name ?? target.name).trim()
    const nextRoll = (updates.roll ?? target.roll).trim()
    const nextGuardian = updates.guardianId
      ? guardians.find((g) => g.id === updates.guardianId)
      : undefined
    const nextStudent: StudentRecord = {
      ...target,
      ...updates,
      name: nextName,
      initials: getInitials(nextName),
      roll: nextRoll,
      guardianId: nextGuardian ? nextGuardian.id : target.guardianId,
      guardianName: nextGuardian ? nextGuardian.name : target.guardianName,
      guardianPhone: nextGuardian ? nextGuardian.phone : target.guardianPhone,
    }
    const authRes = await adminResetUserPassword({
      linkedEntityId: studentId,
      role: 'student',
      displayName: nextStudent.name,
      email: customEmail?.trim() || undefined,
      loginCode: `STU-${nextRoll}`,
      status: nextStudent.status || 'active',
      newPassword: newPassword?.trim() || undefined,
    })
    if (!authRes.ok) return authRes

    setStudents((prev) => prev.map((s) => (s.id === studentId ? nextStudent : s)))
    if (nextGuardian) {
      setGuardians((prev) =>
        prev.map((g) =>
          g.id === nextGuardian.id
            ? { ...g, linkedStudentIds: Array.from(new Set([...g.linkedStudentIds, studentId])) }
            : { ...g, linkedStudentIds: g.linkedStudentIds.filter((sid) => sid !== studentId) },
        ),
      )
    }
    pushAudit(
      newPassword?.trim() ? 'Updated Student Profile & Reset Password' : 'Updated Student Profile',
      `${nextStudent.name} (${nextStudent.className} · Roll #${nextStudent.roll})`,
    )
    notify(
      newPassword?.trim()
        ? `${nextStudent.name}’s profile & password updated in SQLite DB`
        : `${nextStudent.name}’s profile saved`,
    )
    return { ok: true }
  }

  const toggleStudentStatus = (studentId: string) => {
    const target = students.find((s) => s.id === studentId)
    if (!target) return
    const nextStatus: 'active' | 'suspended' =
      (target.status || 'active') === 'active' ? 'suspended' : 'active'
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status: nextStatus } : s)),
    )
    pushAudit(nextStatus === 'suspended' ? 'Suspended Student' : 'Reactivated Student', target.name)
    notify(`${target.name} marked as ${nextStatus}`)
  }

  const removeStudent = (studentId: string) => {
    const target = students.find((s) => s.id === studentId)
    if (!target) return
    setStudents((prev) => prev.filter((s) => s.id !== studentId))
    setGuardians((prev) =>
      prev.map((g) => ({
        ...g,
        linkedStudentIds: g.linkedStudentIds.filter((sid) => sid !== studentId),
      })),
    )
    if (selectedChildId === studentId) {
      const fallback = students.find((s) => s.id !== studentId)
      if (fallback) setSelectedChildId(fallback.id)
    }
    pushAudit('Removed Student', `${target.name} (${target.className} ${target.section})`)
    notify(`Removed student ${target.name}`)
  }

  const impersonateUser = (targetRole: Role, userId: string) => {
    if (targetRole === 'guardian') {
      const grd = guardians.find((g) => g.id === userId)
      setActiveGuardianId(userId)
      if (grd && grd.linkedStudentIds.length > 0) {
        setSelectedChildId(grd.linkedStudentIds[0])
      }
      setRole('guardian')
      notify(`Viewing live Guardian Portal as ${grd?.name || 'Guardian'}`)
    } else if (targetRole === 'teacher') {
      const tch = teachers.find((t) => t.id === userId)
      setActiveTeacherId(userId)
      setRole('teacher')
      notify(`Viewing live Teacher Portal as ${tch?.name || 'Teacher'}`)
    } else if (targetRole === 'student') {
      const stu = students.find((s) => s.id === userId)
      setActiveStudentId(userId)
      setRole('student')
      notify(`Viewing live Student Portal as ${stu?.name || 'Student'}`)
    }
  }

  const createFeeInvoice = (payload: {
    target: string
    title: string
    category: FeeCategory
    amount: number
    dueDate: string
    status?: 'due' | 'paid'
  }) => {
    const cleanAmount = Math.max(0, Math.round(payload.amount))
    if (!cleanAmount) return
    const isPaid = payload.status === 'paid'
    const targets =
      payload.target === 'ALL'
        ? students.filter((s) => s.status !== 'suspended')
        : students.filter((s) => s.id === payload.target)

    if (targets.length === 0) return

    const created: FeeInvoice[] = targets.map((stu, idx) => ({
      id: `fee-${Date.now()}-${idx}`,
      studentId: stu.id,
      studentName: stu.name,
      title: payload.title.trim() || payload.category,
      category: payload.category,
      dueDate: payload.dueDate.trim() || 'Due 30 June 2026',
      amount: cleanAmount,
      status: isPaid ? 'paid' : 'due',
      paidAt: isPaid ? 'Today' : undefined,
      receiptNo: isPaid
        ? `DMHA-2026-${Math.floor(1000 + Math.random() * 8999)}`
        : undefined,
    }))

    setFees((prev) => [...created, ...prev])
    pushAudit(
      isPaid ? 'Recorded Paid Fee' : 'Issued Fee Invoice',
      `${payload.category}: "${payload.title}" (৳${cleanAmount.toLocaleString()}) → ${
        targets.length === 1 ? targets[0].name : `All ${targets.length} Active Students`
      }`,
    )
    pushNotification({
      title: `${payload.category} ${isPaid ? 'Receipt Issued' : 'Invoice Added'}`,
      text: `${payload.title} · ৳${cleanAmount.toLocaleString()} (${
        targets.length === 1 ? targets[0].name : `${targets.length} students`
      }).`,
      type: 'fee',
      forRoles: ['guardian', 'student', 'admin'],
    })
    notify(
      targets.length === 1
        ? `${payload.category} (৳${cleanAmount.toLocaleString()}) added for ${targets[0].name}`
        : `Bulk billed ${targets.length} students (৳${(cleanAmount * targets.length).toLocaleString()} total)`,
    )
  }

  const addExpense = (payload: {
    title: string
    category: ExpenseCategory
    vendor: string
    amount: number
    status: 'paid' | 'pending'
  }) => {
    const cleanAmount = Math.max(0, Math.round(payload.amount))
    if (!cleanAmount) return
    void (async () => {
      const res = await callModuleApi('/dmhs-api/quick-finance', {
        action: 'add_expense',
        ...payload,
        amount: cleanAmount,
      })
      if (res.ok) {
        const vno = String(res.json?.voucherNo || '')
        notify(
          `Expense recorded: ${payload.title.trim()} (৳${cleanAmount.toLocaleString()})${vno ? ` · Auto-Posted ${vno}` : ''}`,
        )
      }
    })()
  }

  const toggleExpenseStatus = (expenseId: string) => {
    void (async () => {
      const res = await callModuleApi('/dmhs-api/quick-finance', {
        action: 'toggle_expense_status',
        expenseId,
      })
      if (res.ok) {
        const vno = String(res.json?.voucherNo || '')
        notify(`Expense status updated${vno ? ` · Auto-Posted ${vno}` : ''}`)
      }
    })()
  }

  const deleteExpense = (expenseId: string) => {
    void callModuleApi(
      '/dmhs-api/quick-finance',
      { action: 'delete_expense', expenseId },
      'Removed expense entry from server',
    )
  }

  const addOtherIncome = (payload: {
    title: string
    category: OtherIncomeRecord['category']
    amount: number
  }) => {
    const cleanAmount = Math.max(0, Math.round(payload.amount))
    if (!cleanAmount) return
    void (async () => {
      const res = await callModuleApi('/dmhs-api/quick-finance', {
        action: 'add_other_income',
        ...payload,
        amount: cleanAmount,
      })
      if (res.ok) {
        const vno = String(res.json?.voucherNo || '')
        notify(
          `Income recorded: ৳${cleanAmount.toLocaleString()}${vno ? ` · Auto-Posted ${vno}` : ''}`,
        )
      }
    })()
  }

  const uploadExamSheet = (payload: {
    studentId: string
    subject: string
    examTitle: string
    marksObtained: number
    totalMarks: number
    captureMethod: ExamSheetItem['captureMethod']
    scanEnhanced: boolean
    fileType: 'image' | 'pdf'
    fileDataUrl: string
    teacherRemarks: string
  }) => {
    const stu = students.find((s) => s.id === payload.studentId)
    const activeTch = teachers.find((t) => t.id === activeTeacherId) || teachers[0]
    if (!stu) return
    const next: ExamSheetItem = {
      id: `ex-${Date.now()}`,
      studentId: stu.id,
      studentName: stu.name,
      className: `${stu.className} · ${stu.section}`,
      subject: payload.subject,
      examTitle: payload.examTitle.trim() || `${payload.subject} Assessment`,
      marksObtained: payload.marksObtained,
      totalMarks: payload.totalMarks || 50,
      captureMethod: payload.captureMethod,
      scanEnhanced: payload.scanEnhanced,
      fileType: payload.fileType,
      fileDataUrl: payload.fileDataUrl,
      teacherName: activeTch?.name || TEACHER_PROFILE.name,
      teacherRemarks: payload.teacherRemarks.trim() || 'Graded script uploaded for review.',
      uploadedAt: 'Just now',
      guardianReviewed: false,
      recheckRequested: false,
      adminVerified: role === 'admin',
    }
    setExamSheets((prev) => [next, ...prev])
    pushAudit(
      `Uploaded Exam Sheet (${payload.captureMethod})`,
      `${stu.name} · ${next.subject} (${next.marksObtained}/${next.totalMarks})`,
    )
    pushNotification({
      title: `Graded Exam Sheet Uploaded · ${next.subject}`,
      text: `${next.teacherName} uploaded ${stu.name}’s ${next.examTitle} (${next.marksObtained}/${next.totalMarks}) for review.`,
      type: 'result',
      forRoles: ['guardian', 'student', 'admin'],
    })
    notify(`Exam sheet published to ${stu.name}, Guardian & Admin`)
  }

  const reviewExamSheet = (
    sheetId: string,
    payload: {
      comment?: string
      requestRecheck?: boolean
      verification?: BiometricVerificationStamp
    },
  ) => {
    const target = examSheets.find((e) => e.id === sheetId)
    if (!target) return
    setExamSheets((prev) =>
      prev.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              guardianReviewed: true,
              guardianComment: payload.comment?.trim() ? payload.comment.trim() : s.guardianComment,
              guardianVerification: payload.verification || s.guardianVerification,
              recheckRequested: payload.requestRecheck ?? s.recheckRequested,
            }
          : s,
      ),
    )
    pushNotification({
      title: payload.requestRecheck
        ? `Script Recheck Requested · ${target.subject}`
        : `Exam Sheet Confirmed by Guardian`,
      text: `${target.studentName}’s ${target.examTitle}${
        payload.verification ? ` (${payload.verification.method} Verified)` : ''
      }${payload.comment ? `: "${payload.comment}"` : ' was confirmed.'}`,
      type: 'result',
      forRoles: ['teacher', 'admin'],
    })
    pushAudit(
      payload.requestRecheck ? 'Guardian Requested Script Recheck' : 'Guardian Confirmed Exam Sheet',
      `${target.studentName} · ${target.subject}${
        payload.verification ? ` (${payload.verification.method})` : ''
      }`,
    )
    notify(
      payload.requestRecheck
        ? 'Recheck request verified & sent to Teacher & Admin'
        : payload.verification
          ? `Exam sheet confirmed (${payload.verification.method})`
          : 'Exam sheet marked as reviewed',
    )
  }

  const verifyExamSheetByAdmin = (sheetId: string) => {
    const target = examSheets.find((e) => e.id === sheetId)
    if (!target) return
    setExamSheets((prev) =>
      prev.map((s) =>
        s.id === sheetId ? { ...s, adminVerified: true, recheckRequested: false } : s,
      ),
    )
    pushAudit('Verified Exam Script', `${target.studentName} · ${target.subject} (${target.examTitle})`)
    notify(`Admin verified ${target.studentName}’s ${target.subject} script`)
  }

  // ==================== ONLINE QUIZZES (CBT — SERVER-AUTHORITATIVE) ====================
  const createQuiz: SchoolState['createQuiz'] = async (payload) => {
    try {
      const res = await fetch('/dmhs-api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: payload.title.trim(),
          subject: payload.subject.trim(),
          className: payload.className.trim(),
          durationMins: Math.max(2, payload.durationMins),
          passPercentage: Math.min(100, Math.max(20, payload.passPercentage)),
          dueDate: payload.dueDate.trim() || 'Next Friday · 8:00 PM',
          questions: payload.questions,
          uploadMode: payload.uploadMode || 'manual',
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        quiz?: OnlineQuiz
        quizzes?: OnlineQuiz[]
        version?: number
      }
      if (!res.ok || !json.ok || !json.quiz) {
        const msg = json.error || 'Unable to publish quiz.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.quizzes)) {
        setQuizzes(json.quizzes)
      } else {
        setQuizzes((prev) => [json.quiz!, ...prev])
      }
      const newQuiz = json.quiz
      pushNotification({
        title: `New Online Quiz: ${newQuiz.subject} (${newQuiz.className})`,
        text: `${newQuiz.teacherName} published "${newQuiz.title}" (${newQuiz.questions.length} Qs · ${newQuiz.durationMins} mins).`,
        type: 'result',
        forRoles: ['student', 'guardian', 'admin'],
      })
      pushAudit(
        payload.uploadMode === 'bulk' ? 'Bulk Uploaded Online Quiz' : 'Published Online Quiz',
        `${newQuiz.title} (${newQuiz.className} · ${newQuiz.subject} · ${newQuiz.questions.length} Qs)`,
      )
      notify(`Online quiz "${newQuiz.title}" saved to SQLite & published for ${newQuiz.className}`)
      return { ok: true, quiz: newQuiz }
    } catch {
      const msg = 'Network error while publishing quiz to server.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const updateQuiz: SchoolState['updateQuiz'] = async (quizId, payload) => {
    try {
      const res = await fetch('/dmhs-api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          quizId,
          title: payload.title.trim(),
          subject: payload.subject.trim(),
          className: payload.className.trim(),
          durationMins: Math.max(2, payload.durationMins),
          passPercentage: Math.min(100, Math.max(20, payload.passPercentage)),
          dueDate: payload.dueDate.trim() || 'Next Friday · 8:00 PM',
          questions: payload.questions,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        quiz?: OnlineQuiz
        quizzes?: OnlineQuiz[]
        version?: number
      }
      if (!res.ok || !json.ok || !json.quiz) {
        const msg = json.error || 'Unable to update quiz.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.quizzes)) {
        setQuizzes(json.quizzes)
      }
      pushAudit('Updated Online Quiz', `${json.quiz.title} (${json.quiz.className})`)
      notify(`Quiz "${json.quiz.title}" updated in SQLite`)
      return { ok: true, quiz: json.quiz }
    } catch {
      const msg = 'Network error while updating quiz.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const toggleQuizStatus: SchoolState['toggleQuizStatus'] = async (quizId) => {
    try {
      const res = await fetch('/dmhs-api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_status', quizId }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        quiz?: OnlineQuiz
        quizzes?: OnlineQuiz[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to update quiz status.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.quizzes)) {
        setQuizzes(json.quizzes)
      }
      notify(
        json.quiz
          ? `Quiz "${json.quiz.title}" is now ${json.quiz.status === 'published' ? 'Live' : 'Closed'}`
          : 'Quiz availability updated',
      )
      return { ok: true }
    } catch {
      const msg = 'Network error while updating quiz availability.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const deleteQuiz: SchoolState['deleteQuiz'] = async (quizId) => {
    try {
      const res = await fetch('/dmhs-api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', quizId }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        quizzes?: OnlineQuiz[]
        quizAttempts?: QuizAttempt[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to delete quiz.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.quizzes)) {
        setQuizzes(json.quizzes)
      }
      if (Array.isArray(json.quizAttempts)) {
        setQuizAttempts(json.quizAttempts)
      }
      pushAudit('Deleted Online Quiz', `Quiz ID: ${quizId}`)
      notify('Quiz deleted permanently from SQLite')
      return { ok: true }
    } catch {
      const msg = 'Network error while deleting quiz.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const submitQuizAttempt: SchoolState['submitQuizAttempt'] = async ({
    quizId,
    studentId,
    answers,
    timeTakenSec,
  }) => {
    try {
      const res = await fetch('/dmhs-api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_attempt',
          quizId,
          studentId,
          answers,
          timeTakenSec,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        attempt?: QuizAttempt
        gradebookSyncedSubject?: string
        syncedGrade?: string
        syncedGpa?: string
        syncedRank?: string
        xpAwarded?: number
        quizAttempts?: QuizAttempt[]
        students?: StudentRecord[]
        studyQuestProfiles?: Record<string, StudyQuestProfile>
        notifications?: NotificationItem[]
        version?: number
      }
      if (!res.ok || !json.ok || !json.attempt) {
        const msg = json.error || 'Unable to submit quiz attempt.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.quizAttempts)) {
        setQuizAttempts(json.quizAttempts)
      } else {
        setQuizAttempts((prev) => [
          json.attempt!,
          ...prev.filter((a) => !(a.quizId === quizId && a.studentId === studentId)),
        ])
      }
      if (Array.isArray(json.students)) {
        setStudents(json.students)
      }
      if (json.studyQuestProfiles && typeof json.studyQuestProfiles === 'object') {
        setStudyQuestProfiles(json.studyQuestProfiles)
      }
      if (Array.isArray(json.notifications)) {
        setNotifications(json.notifications)
      }
      const attempt = json.attempt
      notify(
        `Quiz graded (${attempt.percentage}% · ${attempt.syncedGrade || ''}) & added to ${attempt.syncedSubject || 'Gradebook'} · GPA ${attempt.syncedGpa || ''} · Rank ${attempt.syncedRank || ''}!`,
      )
      return { ok: true, attempt }
    } catch {
      const msg = 'Network error while submitting quiz attempt.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const syncQuizResultsToGradebook: SchoolState['syncQuizResultsToGradebook'] = async (
    quizId,
    studentId,
  ) => {
    try {
      const res = await fetch('/dmhs-api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_to_gradebook',
          quizId,
          ...(studentId ? { studentId } : {}),
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        syncedCount?: number
        students?: StudentRecord[]
        quizAttempts?: QuizAttempt[]
        notifications?: NotificationItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to sync quiz results to Gradebook.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.students)) setStudents(json.students)
      if (Array.isArray(json.quizAttempts)) setQuizAttempts(json.quizAttempts)
      if (Array.isArray(json.notifications)) setNotifications(json.notifications)
      notify(`Synced ${json.syncedCount || 1} quiz result(s) to Student Gradebook & Leaderboard!`)
      return { ok: true, syncedCount: json.syncedCount }
    } catch {
      const msg = 'Network error while syncing quiz results.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const remindUnattemptedStudents: SchoolState['remindUnattemptedStudents'] = async (
    quizId,
    studentId,
  ) => {
    try {
      const res = await fetch('/dmhs-api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remind_not_attempted',
          quizId,
          ...(studentId ? { studentId } : {}),
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        remindedCount?: number
        notifications?: NotificationItem[]
        parentAlerts?: ParentAlertLogItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to send quiz reminders.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.notifications)) setNotifications(json.notifications)
      if (Array.isArray(json.parentAlerts)) setParentAlerts(json.parentAlerts)
      notify(`Quiz reminder sent to ${json.remindedCount || 1} pending student(s) & guardians!`)
      return { ok: true, remindedCount: json.remindedCount }
    } catch {
      const msg = 'Network error while sending reminders.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  // ==================== ADMISSIONS PIPELINE (CRM) ====================
  const submitAdmissionApplication: SchoolState['submitAdmissionApplication'] = (payload) => {
    const nextNum = 108 + admissions.length
    const app: AdmissionApplication = {
      id: `adm-${Date.now()}`,
      applicationCode: `DMHA-2026-${nextNum}`,
      applicantName: payload.applicantName.trim(),
      applyingClass: payload.applyingClass,
      targetSection: payload.targetSection || 'Section A',
      previousSchool: payload.previousSchool.trim() || 'Transfer / Home Study',
      guardianName: payload.guardianName.trim(),
      guardianRelation: payload.guardianRelation || 'Father',
      guardianPhone: payload.guardianPhone.trim(),
      guardianEmail: payload.guardianEmail.trim(),
      bloodGroup: payload.bloodGroup || 'O+',
      busRoute: payload.busRoute || 'Unit - 1',
      stage: 'applied',
      appliedAt: 'Just now',
      admissionFeeAmount: 25000,
      admissionFeePaid: false,
      notes: payload.notes.trim() || 'Online admission form submitted.',
    }
    setAdmissions((prev) => [app, ...prev])
    pushNotification({
      title: `New Admission Application · ${app.applicationCode}`,
      text: `${app.applicantName} applied for ${app.applyingClass} (Guardian: ${app.guardianName}).`,
      type: 'notice',
      forRoles: ['admin'],
    })
    pushAudit('New Admission Application', `${app.applicantName} (${app.applicationCode})`)
    notify(`Application ${app.applicationCode} saved to DMHA database`)
    return app
  }

  const updateAdmissionStage = (appId: string, stage: AdmissionStage) => {
    const target = admissions.find((a) => a.id === appId)
    if (!target) return
    setAdmissions((prev) => prev.map((a) => (a.id === appId ? { ...a, stage } : a)))
    pushAudit('Updated Admission Stage', `${target.applicantName} → ${stage.replace('_', ' ')}`)
    notify(`${target.applicantName} moved to ${stage.replace('_', ' ')}`)
  }

  const updateAdmissionTestInfo: SchoolState['updateAdmissionTestInfo'] = (appId, payload) => {
    setAdmissions((prev) =>
      prev.map((a) =>
        a.id === appId
          ? {
              ...a,
              testDate: payload.testDate !== undefined ? payload.testDate : a.testDate,
              testScore: payload.testScore !== undefined ? payload.testScore : a.testScore,
              notes: payload.notes !== undefined ? payload.notes : a.notes,
            }
          : a,
      ),
    )
    notify('Applicant evaluation updated')
  }

  const markAdmissionFeePaid = (appId: string) => {
    void (async () => {
      const res = await callModuleApi('/dmhs-api/admissions/ops', {
        action: 'mark_fee_paid',
        appId,
      })
      if (res.ok) {
        const vno = String(res.json?.voucherNo || '')
        notify(
          `Admission fee collected${vno ? ` · Auto-Posted Ledger ${vno}` : ''}`,
        )
      }
    })()
  }

  const enrollApplicant = (appId: string) => {
    void (async () => {
      const res = await callModuleApi('/dmhs-api/admissions/ops', {
        action: 'enroll_applicant',
        appId,
      })
      if (res.ok) {
        const creds = res.json?.createdCredentials as
          | { studentLoginCode?: string; guardianLoginCode?: string; defaultPassword?: string }
          | undefined
        notify(
          creds?.studentLoginCode
            ? `Enrolled! Logins created: ${creds.studentLoginCode} & ${creds.guardianLoginCode} (pass: ${creds.defaultPassword || 'dmha2026'})`
            : 'Applicant enrolled with Student, Guardian & SQLite logins created!',
        )
      }
    })()
  }

  // ==================== SMART QR ID CARDS (REAL CAMPUS ACTIONS) ====================
  const processServerQRScan: SchoolState['processServerQRScan'] = async (payload) => {
    try {
      const res = await fetch('/dmhs-api/qr-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as {
        ok?: boolean
        message?: string
        error?: string
        remainingBalance?: number
        qrScans?: QRScanLog[]
        teacherAttendance?: TeacherAttendanceLog[]
        students?: StudentRecord[]
        canteenWallets?: CanteenWallet[]
        canteenTransactions?: CanteenTransaction[]
        dismissalLogs?: DismissalLogItem[]
        libraryBooks?: LibraryBook[]
        libraryCirculation?: LibraryCirculationLog[]
        version?: number
      }
      if (typeof json.version === 'number') stateVersionRef.current = json.version
      if (Array.isArray(json.qrScans)) setQrScans(json.qrScans)
      if (Array.isArray(json.teacherAttendance)) setTeacherAttendance(json.teacherAttendance)
      if (Array.isArray(json.students)) setStudents(json.students)
      if (Array.isArray(json.canteenWallets)) setCanteenWallets(json.canteenWallets)
      if (Array.isArray(json.canteenTransactions)) setCanteenTransactions(json.canteenTransactions)
      if (Array.isArray(json.dismissalLogs)) setDismissalLogs(json.dismissalLogs)
      if (Array.isArray(json.libraryBooks)) setLibraryBooks(json.libraryBooks)
      if (Array.isArray(json.libraryCirculation)) setLibraryCirculation(json.libraryCirculation)

      if (!res.ok || !json.ok) {
        const errMsg = json.error || json.message || 'QR scan rejected by server.'
        notify(errMsg)
        return { ok: false, message: errMsg, remainingBalance: json.remainingBalance }
      }
      const okMsg = json.message || `Verified ${payload.holderName} at ${payload.checkpoint}`
      notify(okMsg)
      return { ok: true, message: okMsg, remainingBalance: json.remainingBalance }
    } catch {
      const msg = 'Network error while verifying QR scan on server.'
      notify(msg)
      return { ok: false, message: msg }
    }
  }

  const logQRCardScan: SchoolState['logQRCardScan'] = (payload) => {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const studentObj =
      payload.holderRole === 'student'
        ? students.find((s) => s.id === payload.holderId)
        : undefined

    // 1. REAL CANTEEN PURCHASE DEDUCTION FROM TOP-UP WALLET
    if (payload.checkpoint === 'Canteen Checkout' && payload.holderRole === 'student') {
      const amount = Math.max(1, Number(payload.canteenAmount || 120))
      const itemLabel = (payload.canteenItem || 'Canteen Snack Combo').trim()
      const wallet = canteenWallets.find((w) => w.studentId === payload.holderId)

      if (!wallet) {
        return { ok: false, message: `No Canteen Wallet linked to ${payload.holderName}.` }
      }
      if (amount > wallet.dailyLimit) {
        const flaggedScan: QRScanLog = {
          id: `qr-${Date.now()}`,
          cardCode: payload.cardCode,
          holderId: payload.holderId,
          holderName: payload.holderName,
          holderRole: 'student',
          checkpoint: 'Canteen Checkout',
          status: 'flagged',
          details: `Blocked ৳${amount} (${itemLabel}) — exceeds daily limit ৳${wallet.dailyLimit}`,
          scannedAt: `Today · ${timeNow}`,
        }
        setQrScans((prev) => [flaggedScan, ...prev])
        notify(`Purchase blocked: exceeds daily limit (৳${wallet.dailyLimit})`)
        return {
          ok: false,
          message: `Blocked: ৳${amount} exceeds Guardian's daily limit of ৳${wallet.dailyLimit}.`,
          remainingBalance: wallet.balance,
        }
      }
      if (amount > wallet.balance) {
        const flaggedScan: QRScanLog = {
          id: `qr-${Date.now()}`,
          cardCode: payload.cardCode,
          holderId: payload.holderId,
          holderName: payload.holderName,
          holderRole: 'student',
          checkpoint: 'Canteen Checkout',
          status: 'flagged',
          details: `Insufficient balance (৳${wallet.balance}) for ৳${amount} (${itemLabel})`,
          scannedAt: `Today · ${timeNow}`,
        }
        setQrScans((prev) => [flaggedScan, ...prev])
        pushNotification({
          title: `Low Canteen Balance · ${payload.holderName}`,
          text: `${payload.holderName} tried to purchase ${itemLabel} (৳${amount}), but wallet balance is ৳${wallet.balance}. Please top up.`,
          type: 'fee',
          forRoles: ['guardian'],
        })
        notify(`Insufficient wallet balance (৳${wallet.balance}) for ${payload.holderName}`)
        return {
          ok: false,
          message: `Insufficient Balance: Available ৳${wallet.balance.toLocaleString()}, required ৳${amount.toLocaleString()}.`,
          remainingBalance: wallet.balance,
        }
      }

      const nextBalance = wallet.balance - amount
      setCanteenWallets((prev) =>
        prev.map((w) => (w.studentId === payload.holderId ? { ...w, balance: nextBalance } : w)),
      )
      setCanteenTransactions((prev) => [
        {
          id: `ct-${Date.now()}`,
          studentId: payload.holderId,
          item: `${itemLabel} (QR POS)`,
          amount,
          time: `Today · ${timeNow}`,
          calories: 'Verified Canteen Purchase',
        },
        ...prev,
      ])

      const details = `${itemLabel} (-৳${amount.toLocaleString()}) · Balance: ৳${nextBalance.toLocaleString()}`
      setQrScans((prev) => [
        {
          id: `qr-${Date.now()}`,
          cardCode: payload.cardCode,
          holderId: payload.holderId,
          holderName: payload.holderName,
          holderRole: 'student',
          checkpoint: 'Canteen Checkout',
          status: 'verified',
          details,
          scannedAt: `Today · ${timeNow}`,
        },
        ...prev,
      ])
      pushNotification({
        title: `Canteen Purchase · ${payload.holderName} (-৳${amount})`,
        text: `Purchased ${itemLabel} using Smart QR ID. Remaining wallet balance: ৳${nextBalance.toLocaleString()}.`,
        type: 'fee',
        forRoles: ['guardian'],
      })
      pushAudit('Canteen QR Purchase', `${payload.holderName} · ${details}`)
      notify(`Deducted ৳${amount} from ${payload.holderName}’s wallet (Left: ৳${nextBalance})`)
      return {
        ok: true,
        message: `Paid ৳${amount.toLocaleString()} for ${itemLabel}. Remaining Balance: ৳${nextBalance.toLocaleString()}.`,
        remainingBalance: nextBalance,
      }
    }

    // 2. CAMPUS CHECK-IN (MARK PRESENT + GATE TIME)
    let details = `${studentObj?.busRoute || 'Unit - 1'} · Verified`
    if (payload.checkpoint === 'Main Gate Check-In' && payload.holderRole === 'student') {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === payload.holderId ? { ...s, todayStatus: 'present', gateCheckIn: timeNow } : s,
        ),
      )
      details = `${studentObj?.busRoute || 'Unit - 1'} Gate · Marked Present (${timeNow})`
    }

    // 3. CAMPUS CHECK-OUT (LOG OFFICIAL DISMISSAL / DEPARTURE)
    if (payload.checkpoint === 'Main Gate Check-Out' && payload.holderRole === 'student') {
      logGateDismissal({
        studentId: payload.holderId,
        pickedUpBy: `Smart ID Check-Out (${payload.cardCode})`,
        gate: `${studentObj?.busRoute || 'Unit - 1'} · Main Gate`,
      })
      details = `${studentObj?.busRoute || 'Unit - 1'} Gate · Checked Out (${timeNow})`
    }

    // 4. LIBRARY DESK BOOK BORROW VIA QR
    if (
      payload.checkpoint === 'Library Desk' &&
      payload.holderRole === 'student' &&
      payload.libraryBookId
    ) {
      const issued = issueLibraryBook(payload.libraryBookId, payload.cardCode)
      if (!issued.ok) {
        return { ok: false, message: issued.error || 'Could not issue selected library book.' }
      }
      const book = libraryBooks.find((b) => b.id === payload.libraryBookId)
      details = `Issued Book: ${book?.title || 'Library Title'} (14-Day Loan)`
    }

    // 5. BUS BOARDING
    if (payload.checkpoint === 'Bus Boarding') {
      details = `${studentObj?.busRoute || 'Unit - 1'} · Verified Bus Boarding (${timeNow})`
    }

    const newScan: QRScanLog = {
      id: `qr-${Date.now()}`,
      cardCode: payload.cardCode,
      holderId: payload.holderId,
      holderName: payload.holderName,
      holderRole: payload.holderRole,
      checkpoint: payload.checkpoint,
      status: 'verified',
      details,
      scannedAt: `Today · ${timeNow}`,
    }
    setQrScans((prev) => [newScan, ...prev])

    pushNotification({
      title: `Smart ID Scanned · ${payload.checkpoint}`,
      text: `${payload.holderName} (${payload.cardCode}) — ${details}`,
      type: 'pickup',
      forRoles: ['guardian', 'admin'],
    })
    notify(`QR Verified: ${payload.holderName} at ${payload.checkpoint}`)
    return { ok: true, message: `Verified ${payload.holderName} · ${details}` }
  }

  // ==================== MERGED FAMILY SHARED MODE (CHILD-SAFE PIN LOCK) ====================
  const toggleGuardianSharedMode = (guardianId: string, enabled?: boolean) => {
    const target = guardians.find((g) => g.id === guardianId)
    if (!target) return
    const nextVal = enabled !== undefined ? enabled : !(target.sharedDeviceMode !== false)
    setGuardians((prev) =>
      prev.map((g) =>
        g.id === guardianId
          ? { ...g, sharedDeviceMode: nextVal, parentPin: g.parentPin || '1234' }
          : g,
      ),
    )
    pushAudit(
      nextVal ? 'Enabled Merged Family Mode' : 'Disabled Merged Family Mode',
      `${target.name} (${nextVal ? 'Shared Phone ON' : 'Separate Student Login'})`,
    )
    notify(
      nextVal
        ? `Merged Family Mode enabled for ${target.name} (Parent PIN protected)`
        : `Switched ${target.name} to separate Student/Guardian logins`,
    )
  }

  const updateGuardianParentPin = (guardianId: string, newPin: string) => {
    const clean = newPin.replace(/\D/g, '').slice(0, 4)
    if (clean.length !== 4) return
    setGuardians((prev) =>
      prev.map((g) => (g.id === guardianId ? { ...g, parentPin: clean } : g)),
    )
    notify('4-digit Parent Exit PIN updated & saved to database')
  }

  const enterFamilyChildMode = (studentId: string) => {
    const child = students.find((s) => s.id === studentId)
    if (!child) return
    setFamilyLockGuardianId(activeGuardianId)
    setSelectedChildId(child.id)
    setActiveStudentId(child.id)
    setFamilyChildMode(true)
    setRole('student')
    notify(`Child Study Mode active for ${child.name} · Parent controls PIN-locked`)
  }

  const exitFamilyChildMode = (pin: string): boolean => {
    const lockGrd =
      guardians.find((g) => g.id === (familyLockGuardianId || activeGuardianId)) || guardians[0]
    const expectedPin = lockGrd?.parentPin || '1234'
    if (pin !== expectedPin) {
      return false
    }
    setFamilyChildMode(false)
    setFamilyLockGuardianId(null)
    setRole('guardian')
    notify(`Welcome back, ${lockGrd?.name || 'Guardian'} · Parent Portal unlocked`)
    return true
  }

  const forceExitFamilyChildMode = () => {
    setFamilyChildMode(false)
    setFamilyLockGuardianId(null)
  }

  // ==================== SMART LIBRARY (QR CHECKOUT) & DIGITAL LESSON HUB ====================
  const issueLibraryBook: SchoolState['issueLibraryBook'] = (bookId, studentIdOrCode) => {
    const book = libraryBooks.find((b) => b.id === bookId)
    if (!book) return { ok: false, error: 'Book not found.' }
    const raw = studentIdOrCode.trim().toUpperCase()
    const student = students.find(
      (s) =>
        s.id.toUpperCase() === raw ||
        `DMHA-ID-STU-${s.roll}`.toUpperCase() === raw ||
        s.roll.toUpperCase() === raw,
    )
    if (!student) {
      return { ok: false, error: `No student matched "${studentIdOrCode}". Try DMHA-ID-STU-14.` }
    }
    const due = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
    const dueLabel = due.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

    setLibraryBooks((prev) =>
      prev.map((b) =>
        b.id === bookId
          ? {
              ...b,
              status: 'issued',
              issuedToStudentId: student.id,
              issuedToName: student.name,
              issuedAt: 'Today',
              dueDate: dueLabel,
              overdueDays: 0,
            }
          : b,
      ),
    )
    logQRCardScan({
      cardCode: `DMHA-ID-STU-${student.roll}`,
      holderId: student.id,
      holderName: student.name,
      holderRole: 'student',
      checkpoint: 'Library Desk',
    })
    pushAudit('Issued Library Book via QR', `${book.title} → ${student.name} (Due ${dueLabel})`)
    notify(`Issued "${book.title}" to ${student.name} (Due ${dueLabel})`)
    return { ok: true }
  }

  const returnLibraryBook = (bookId: string, chargeFine = true) => {
    const book = libraryBooks.find((b) => b.id === bookId)
    if (!book || book.status !== 'issued') return
    const finePerDay = 50
    const overdueDays = book.overdueDays || 0
    const fineAmount = chargeFine && overdueDays > 0 ? overdueDays * finePerDay : 0

    if (fineAmount > 0 && book.issuedToStudentId) {
      createFeeInvoice({
        target: book.issuedToStudentId,
        title: `Library Overdue Fine (${overdueDays}d) — ${book.title}`,
        category: 'Lab & Library',
        amount: fineAmount,
        dueDate: 'Due Immediately',
        status: 'due',
      })
    }

    setLibraryBooks((prev) =>
      prev.map((b) =>
        b.id === bookId
          ? {
              ...b,
              status: 'available',
              issuedToStudentId: undefined,
              issuedToName: undefined,
              issuedAt: undefined,
              dueDate: undefined,
              overdueDays: 0,
            }
          : b,
      ),
    )
    pushAudit(
      'Returned Library Book',
      `${book.title}${fineAmount > 0 ? ` · Overdue Fine ৳${fineAmount} billed to Accounts` : ' · Returned on time'}`,
    )
    notify(
      fineAmount > 0
        ? `Returned "${book.title}" · Overdue fine ৳${fineAmount} synced to Accounts`
        : `Returned "${book.title}" to shelf ${book.shelf}`,
    )
  }

  const addLibraryBook: SchoolState['addLibraryBook'] = (payload) => {
    const newBook: LibraryBook = {
      id: `lib-${Date.now()}`,
      isbn: payload.isbn.trim() || `978-${Math.floor(1000000000 + Math.random() * 8999999999)}`,
      title: payload.title.trim(),
      author: payload.author.trim() || 'DMHA Press',
      subject: payload.subject.trim() || 'General',
      shelf: payload.shelf.trim() || 'Shelf A-01',
      status: 'available',
    }
    setLibraryBooks((prev) => [newBook, ...prev])
    pushAudit('Added Library Book', `${newBook.title} (${newBook.shelf})`)
    notify(`Added "${newBook.title}" to DMHA Library catalog`)
  }

  const addStudyResource: SchoolState['addStudyResource'] = (payload) => {
    const activeTeacher = teachers.find((t) => t.id === activeTeacherId)
    const author =
      role === 'admin' ? ADMIN_PROFILE.name : activeTeacher?.name || TEACHER_PROFILE.name
    const item: StudyResourceItem = {
      id: `res-${Date.now()}`,
      subject: payload.subject,
      className: payload.className,
      title: payload.title.trim(),
      type: payload.type,
      teacherName: author,
      summary: payload.summary.trim() || 'Official DMHA chapter material.',
      durationOrPages: payload.durationOrPages.trim() || '10 Pages · PDF',
      uploadedAt: 'Just now',
      downloads: 0,
    }
    setStudyResources((prev) => [item, ...prev])
    pushNotification({
      title: `New ${item.type}: ${item.subject}`,
      text: `${author} uploaded "${item.title}" for ${item.className}.`,
      type: 'notice',
      forRoles: ['student', 'guardian', 'admin'],
    })
    notify(`Published "${item.title}" to Digital Lesson Hub`)
  }

  const trackResourceDownload = (resourceId: string) => {
    const target = studyResources.find((r) => r.id === resourceId)
    setStudyResources((prev) =>
      prev.map((r) => (r.id === resourceId ? { ...r, downloads: r.downloads + 1 } : r)),
    )
    if (target) {
      notify(`Opened "${target.title}"`)
    }
  }

  // ==================== SMART TEACHER LEAVE & AUTO-SUBSTITUTION ====================
  const requestTeacherLeave: SchoolState['requestTeacherLeave'] = async (payload) => {
    try {
      const res = await fetch('/dmhs-api/substitutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request',
          ...payload,
          teacherId: activeTeacherId,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        teacherLeaves?: TeacherLeaveSubItem[]
        notifications?: NotificationItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to submit substitution request.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.teacherLeaves)) setTeacherLeaves(json.teacherLeaves)
      if (Array.isArray(json.notifications)) setNotifications(json.notifications)
      notify('Leave & substitution request saved to SQLite & notified Principal + Faculty!')
      return { ok: true }
    } catch {
      const msg = 'Unable to reach DMHA Substitution server.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const assignSubstituteTeacher: SchoolState['assignSubstituteTeacher'] = async (
    leaveId,
    substituteTeacherId,
  ) => {
    try {
      const res = await fetch('/dmhs-api/substitutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          leaveId,
          substituteTeacherId,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        message?: string
        teacherLeaves?: TeacherLeaveSubItem[]
        timetableSlots?: TimetableSlot[]
        students?: StudentRecord[]
        notifications?: NotificationItem[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to assign substitute teacher.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.teacherLeaves)) setTeacherLeaves(json.teacherLeaves)
      if (Array.isArray(json.timetableSlots)) setTimetableSlots(json.timetableSlots)
      if (Array.isArray(json.students)) setStudents(json.students)
      if (Array.isArray(json.notifications)) setNotifications(json.notifications)
      notify(json.message || 'Substitute assigned & added automatically to Teaching Timetable!')
      return { ok: true, message: json.message }
    } catch {
      const msg = 'Unable to reach DMHA Substitution server.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  const declineTeacherLeave: SchoolState['declineTeacherLeave'] = async (leaveId) => {
    try {
      const res = await fetch('/dmhs-api/substitutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', leaveId }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        teacherLeaves?: TeacherLeaveSubItem[]
        timetableSlots?: TimetableSlot[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        const msg = json.error || 'Unable to update leave request.'
        notify(msg)
        return { ok: false, error: msg }
      }
      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.teacherLeaves)) setTeacherLeaves(json.teacherLeaves)
      if (Array.isArray(json.timetableSlots)) setTimetableSlots(json.timetableSlots)
      notify('Leave request cancelled / declined.')
      return { ok: true }
    } catch {
      const msg = 'Unable to reach DMHA Substitution server.'
      notify(msg)
      return { ok: false, error: msg }
    }
  }

  // ==================== AUTOMATED WHATSAPP / SMS PARENT ALERT HUB ====================
  const dispatchParentAlert: SchoolState['dispatchParentAlert'] = (payload) => {
    const sender =
      role === 'admin'
        ? `${ADMIN_PROFILE.name} (Principal)`
        : teachers.find((t) => t.id === activeTeacherId)?.name || TEACHER_PROFILE.name
    const alert: ParentAlertLogItem = {
      id: `pal-${Date.now()}`,
      channel: payload.channel,
      category: payload.category,
      recipientName: payload.recipientName,
      recipientPhone: payload.recipientPhone,
      studentName: payload.studentName,
      message: payload.message.trim(),
      sentBy: sender,
      sentAt: `Today · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      status: 'delivered',
    }
    setParentAlerts((prev) => [alert, ...prev])
    void fetch('/dmhs-api/alerts/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: payload.channel,
        to: payload.recipientPhone,
        message: payload.message.trim(),
      }),
    }).catch(() => {})
    pushNotification({
      title: `${payload.channel} Alert · ${payload.category}`,
      text: payload.message.trim(),
      type: payload.category === 'Fee Reminder' ? 'fee' : payload.category === 'Absence Alert' ? 'attendance' : 'notice',
      forRoles: ['guardian', 'admin'],
    })
    pushAudit(
      `Dispatched ${payload.channel} Alert`,
      `${payload.category} → ${payload.recipientName} (${payload.studentName})`,
    )
    notify(`${payload.channel} alert delivered to ${payload.recipientName}`)
  }

  // ==================== FACULTY MANAGEMENT & ANTI-CHEAT CAMPUS WI-FI HR ====================
  const updateCampusWifiConfig = (updates: Partial<CampusWifiConfig>) => {
    const nextConfig: CampusWifiConfig = { ...campusWifiConfig, ...updates }
    setCampusWifiConfig(nextConfig)
    fetch('/dmhs-api/faculty-checkin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextConfig),
    })
      .then((r) => r.json())
      .then((json: { ok?: boolean; version?: number }) => {
        if (json.ok && typeof json.version === 'number') {
          skipNextServerSaveRef.current = true
          stateVersionRef.current = json.version
        }
      })
      .catch(() => {})
    pushAudit('Updated School Wi-Fi Allowlist', nextConfig.ssidLabel)
    notify('Official School Wi-Fi check-in rules saved to SQLite DB')
  }

  const performTeacherWifiPunch: SchoolState['performTeacherWifiPunch'] = async ({
    teacherId,
    action,
    simulateOffCampus,
    biometricVerified,
  }) => {
    const tch = teachers.find((t) => t.id === teacherId)
    if (!tch) return { ok: false, error: 'Teacher record not found.' }

    try {
      const res = await fetch('/dmhs-api/faculty-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: tch.id,
          teacherName: tch.name,
          action,
          simulateOffCampus: !!simulateOffCampus,
          biometricVerified: !!biometricVerified,
        }),
      })
      const json = (await res.json()) as {
        ok: boolean
        blocked?: boolean
        error?: string
        verifiedIp?: string
        wifiNetwork?: string
        timeLabel?: string
        dateLabel?: string
        isLate?: boolean
        hoursWorked?: string
        record?: TeacherAttendanceLog
        version?: number
      }

      if (!res.ok || !json.ok) {
        if (json.blocked) {
          pushAudit(
            'Blocked Off-Campus Teacher Punch',
            `${tch.name} attempted ${action} from external IP (${json.error || 'Non-Campus Wi-Fi'})`,
          )
          pushNotification({
            title: `Anti-Cheat Alert: Off-Campus ${action === 'checkin' ? 'Check-In' : 'Check-Out'} Blocked`,
            text: `${tch.name} attempted to punch outside official DMHA Campus Wi-Fi.`,
            type: 'attendance',
            forRoles: ['admin'],
          })
        }
        return {
          ok: false,
          blocked: json.blocked,
          error: json.error || 'Campus Wi-Fi check failed.',
        }
      }

      if (typeof json.version === 'number') {
        stateVersionRef.current = json.version
      }

      const timeStr =
        json.timeLabel || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const ipStr = json.verifiedIp || '127.0.0.1'
      const wifiLabel = json.wifiNetwork || campusWifiConfig.ssidLabel
      const serverRecord: TeacherAttendanceLog = json.record || {
        id: `tatt-${Date.now()}`,
        teacherId: tch.id,
        teacherName: tch.name,
        date:
          json.dateLabel ||
          `Today · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        checkInTime: action === 'checkin' ? timeStr : null,
        checkOutTime: action === 'checkout' ? timeStr : null,
        status:
          action === 'checkout' ? 'checked_out' : json.isLate ? 'late' : 'checked_in',
        verifiedIp: ipStr,
        wifiNetwork: wifiLabel,
        biometricVerified: !!biometricVerified,
        hoursWorked: json.hoursWorked,
      }

      setTeacherAttendance((prev) => {
        const exists = prev.some((r) => r.teacherId === tch.id)
        if (!exists) return [serverRecord, ...prev]
        return prev.map((r) => (r.teacherId === tch.id ? serverRecord : r))
      })

      pushNotification({
        title: `Faculty ${action === 'checkin' ? 'Checked In' : 'Checked Out'} · ${tch.name}`,
        text: `${tch.name} verified on ${wifiLabel} (${ipStr}) at ${timeStr}${json.hoursWorked ? ` · Worked ${json.hoursWorked}` : ''}.`,
        type: 'attendance',
        forRoles: ['admin', 'teacher'],
      })
      pushAudit(
        action === 'checkin' ? 'Teacher Campus Wi-Fi Check-In' : 'Teacher Campus Wi-Fi Check-Out',
        `${tch.name} · ${timeStr} · IP ${ipStr}${json.hoursWorked ? ` · ${json.hoursWorked}` : ''}`,
      )
      notify(
        action === 'checkin'
          ? `Checked In on School Wi-Fi (${ipStr}) at ${timeStr}`
          : `Checked Out on School Wi-Fi (${ipStr}) · Worked ${json.hoursWorked || '0h 01m'}`,
      )
      return { ok: true, verifiedIp: ipStr }
    } catch {
      return { ok: false, error: 'Unable to reach DMHA Campus Wi-Fi verification server.' }
    }
  }

  const updateTeacherSalaryPackage: SchoolState['updateTeacherSalaryPackage'] = (
    salaryId,
    updates,
  ) => {
    const net = Math.max(0, updates.baseSalary + updates.bonusAllowance - updates.lateDeduction)
    setTeacherSalaries((prev) =>
      prev.map((s) =>
        s.id === salaryId
          ? {
              ...s,
              baseSalary: updates.baseSalary,
              bonusAllowance: updates.bonusAllowance,
              lateDeduction: updates.lateDeduction,
              netSalary: net,
            }
          : s,
      ),
    )
    fetch('/dmhs-api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_package',
        salaryId,
        baseSalary: updates.baseSalary,
        bonusAllowance: updates.bonusAllowance,
        lateDeduction: updates.lateDeduction,
      }),
    })
      .then((r) => r.json())
      .then(
        (json: { ok?: boolean; teacherSalaries?: TeacherSalaryRecord[]; version?: number }) => {
          if (json.ok) {
            if (typeof json.version === 'number') {
              skipNextServerSaveRef.current = true
              stateVersionRef.current = json.version
            }
            if (Array.isArray(json.teacherSalaries)) setTeacherSalaries(json.teacherSalaries)
          }
        },
      )
      .catch(() => {})
    notify('Teacher salary package recalculated & saved to SQLite')
  }

  const disburseTeacherSalary = (salaryId: string) => {
    const target = teacherSalaries.find((s) => s.id === salaryId)
    if (!target || target.status === 'paid') return

    fetch('/dmhs-api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disburse_one', salaryId }),
    })
      .then((r) => r.json())
      .then(
        (json: {
          ok?: boolean
          error?: string
          disbursed?: Array<{
            salaryId: string
            teacherName: string
            month: string
            netSalary: number
            bankRef: string
          }>
          teacherSalaries?: TeacherSalaryRecord[]
          expenses?: ExpenseRecord[]
          accountingBook?: AccountingBookState
          version?: number
        }) => {
          if (!json.ok) {
            notify(json.error || 'Could not disburse salary')
            return
          }
          if (typeof json.version === 'number') {
            skipNextServerSaveRef.current = true
            stateVersionRef.current = json.version
          }
          if (Array.isArray(json.teacherSalaries)) setTeacherSalaries(json.teacherSalaries)
          if (Array.isArray(json.expenses)) setExpenses(json.expenses)
          if (json.accountingBook && typeof json.accountingBook === 'object') {
            setAccountingBook(json.accountingBook)
          }
          const item = json.disbursed?.[0]
          const ref = item?.bankRef || 'VERIFIED'
          pushNotification({
            title: `Salary Credited · ৳${target.netSalary.toLocaleString()}`,
            text: `${target.teacherName}’s ${target.month} net salary (৳${target.netSalary.toLocaleString()}, Ref: ${ref}) has been credited & recorded in SQLite Ledger.`,
            type: 'fee',
            forRoles: ['teacher', 'admin'],
          })
          notify(
            `Salary ৳${target.netSalary.toLocaleString()} credited to ${target.teacherName} (${ref}) & saved to SQLite Ledger!`,
          )
        },
      )
      .catch(() => {
        notify('Unable to reach DMHA Payroll Server.')
      })
  }

  const disburseAllPendingSalaries = (month?: string) => {
    const pending = teacherSalaries.filter(
      (s) => s.status === 'pending' && (!month || s.month.toLowerCase() === month.toLowerCase()),
    )
    if (pending.length === 0) {
      notify('All faculty salaries for this period are already paid')
      return
    }
    fetch('/dmhs-api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disburse_all', month }),
    })
      .then((r) => r.json())
      .then(
        (json: {
          ok?: boolean
          error?: string
          disbursed?: Array<{
            salaryId: string
            teacherName: string
            month: string
            netSalary: number
            bankRef: string
          }>
          teacherSalaries?: TeacherSalaryRecord[]
          expenses?: ExpenseRecord[]
          accountingBook?: AccountingBookState
          version?: number
        }) => {
          if (!json.ok) {
            notify(json.error || 'Bulk payroll disbursement failed')
            return
          }
          if (typeof json.version === 'number') {
            skipNextServerSaveRef.current = true
            stateVersionRef.current = json.version
          }
          if (Array.isArray(json.teacherSalaries)) setTeacherSalaries(json.teacherSalaries)
          if (Array.isArray(json.expenses)) setExpenses(json.expenses)
          if (json.accountingBook && typeof json.accountingBook === 'object') {
            setAccountingBook(json.accountingBook)
          }
          const count = json.disbursed?.length || pending.length
          const totalAmt = (json.disbursed || []).reduce((acc, x) => acc + x.netSalary, 0)
          pushNotification({
            title: `Monthly Payroll Completed · ${count} Teachers`,
            text: `Disbursed ৳${totalAmt.toLocaleString()} across ${count} faculty salary slip(s) and recorded in SQLite Payment Ledger.`,
            type: 'fee',
            forRoles: ['teacher', 'admin'],
          })
          notify(`Disbursed ${count} pending salaries (৳${totalAmt.toLocaleString()}) to SQLite Ledger!`)
        },
      )
      .catch(() => {
        notify('Unable to reach DMHA Payroll Server.')
      })
  }

  const generateMonthlyPayroll: SchoolState['generateMonthlyPayroll'] = async (month) => {
    try {
      const res = await fetch('/dmhs-api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_month', month }),
      })
      const json = (await res.json()) as {
        ok: boolean
        error?: string
        createdCount?: number
        teacherSalaries?: TeacherSalaryRecord[]
        version?: number
      }
      if (!res.ok || !json.ok) {
        return { ok: false, error: json.error || 'Could not generate payroll.' }
      }
      if (typeof json.version === 'number') {
        skipNextServerSaveRef.current = true
        stateVersionRef.current = json.version
      }
      if (Array.isArray(json.teacherSalaries)) setTeacherSalaries(json.teacherSalaries)
      notify(`Generated ${json.createdCount || 0} pending salary slip(s) for ${month}`)
      return { ok: true, createdCount: json.createdCount }
    } catch {
      return { ok: false, error: 'Unable to reach DMHA Payroll Server.' }
    }
  }

  const assignTeacherTraining: SchoolState['assignTeacherTraining'] = (payload) => {
    const item: TeacherTrainingItem = {
      id: `trn-${Date.now()}`,
      title: payload.title.trim(),
      category: payload.category,
      assignedTeacherIds:
        payload.assignedTeacherIds.length > 0
          ? payload.assignedTeacherIds
          : teachers.map((t) => t.id),
      completedTeacherIds: [],
      dueDate: payload.dueDate.trim() || '15 Dec 2026',
      mode: payload.mode,
      mandatory: payload.mandatory,
      assignedBy: `${ADMIN_PROFILE.name} (Principal)`,
      description: payload.description.trim() || 'Assigned faculty development program.',
    }
    setTeacherTrainings((prev) => [item, ...prev])
    pushNotification({
      title: `New Faculty Training Assigned`,
      text: `Principal ${ADMIN_PROFILE.name} assigned "${item.title}" (${item.mode} · Due ${item.dueDate}).`,
      type: 'notice',
      forRoles: ['teacher', 'admin'],
    })
    pushAudit(
      'Assigned Faculty Training',
      `"${item.title}" → ${item.assignedTeacherIds.length} teacher(s)`,
    )
    notify(`Training "${item.title}" assigned & teachers notified`)
  }

  const toggleTeacherTrainingCompletion = (trainingId: string, teacherId: string) => {
    const target = teacherTrainings.find((t) => t.id === trainingId)
    const tch = teachers.find((t) => t.id === teacherId)
    if (!target) return
    const alreadyDone = target.completedTeacherIds.includes(teacherId)
    setTeacherTrainings((prev) =>
      prev.map((tr) =>
        tr.id === trainingId
          ? {
              ...tr,
              completedTeacherIds: alreadyDone
                ? tr.completedTeacherIds.filter((id) => id !== teacherId)
                : [...tr.completedTeacherIds, teacherId],
            }
          : tr,
      ),
    )
    if (!alreadyDone && tch) {
      pushNotification({
        title: `Training Completed · ${tch.name}`,
        text: `${tch.name} completed "${target.title}".`,
        type: 'notice',
        forRoles: ['admin', 'teacher'],
      })
      notify(`Marked "${target.title}" completed!`)
    }
  }

  const sendNextClassReminder = (teacherId: string, classSummary: string) => {
    const tch = teachers.find((t) => t.id === teacherId)
    pushNotification({
      title: `Next Class Bell Alert · Starting in 10 mins`,
      text: `${tch?.name || 'Faculty'}: ${classSummary}`,
      type: 'notice',
      forRoles: ['teacher'],
    })
    notify(`Next-class reminder sent: ${classSummary}`)
  }

  // ==================== MASTER TIMETABLE & CLASH-FREE EXAM SCHEDULER ====================
  const getActiveSchoolWeekday = (): SchoolWeekday => {
    const map: Record<number, SchoolWeekday> = {
      0: 'Sun',
      1: 'Mon',
      2: 'Tue',
      3: 'Wed',
      4: 'Thu',
    }
    return map[new Date().getDay()] || 'Sun'
  }

  const pickSubjectColor = (subject: string): AccentColor => {
    const s = subject.toLowerCase()
    if (s.includes('math')) return 'violet'
    if (s.includes('phys') || s.includes('ict')) return 'cyan'
    if (s.includes('eng')) return 'orange'
    return 'lime'
  }

  const syncStudentsTodayPeriodsFromTimetable = (
    nextSlots: TimetableSlot[],
    affectedClassName?: string,
  ) => {
    const todayDay = getActiveSchoolWeekday()
    setStudents((prev) =>
      prev.map((stu) => {
        const stuClassLabel = `${stu.className} · ${stu.section}`
        if (
          affectedClassName &&
          stuClassLabel.toLowerCase() !== affectedClassName.toLowerCase()
        ) {
          return stu
        }
        const daySlots = nextSlots
          .filter(
            (slot) =>
              slot.day === todayDay &&
              slot.className.toLowerCase() === stuClassLabel.toLowerCase(),
          )
          .sort((a, b) => a.period - b.period)

        if (daySlots.length === 0 && !affectedClassName) return stu

        const nextTodayPeriods: PeriodSlot[] = daySlots.map((slot) => {
          const [startPart, endPart] = slot.timeLabel.split(/[–-]/).map((x) => x.trim())
          return {
            id: `tp-${slot.id}`,
            time: startPart || '08:15',
            end: endPart || '09:00',
            subject: slot.subject,
            topic: `Period ${slot.period} · ${slot.className}`,
            teacher: slot.teacherName,
            room: slot.room,
            color: pickSubjectColor(slot.subject),
            status: stu.todayStatus,
          }
        })
        return {
          ...stu,
          todayPeriods: nextTodayPeriods,
        }
      }),
    )
  }

  const upsertTimetableSlot: SchoolState['upsertTimetableSlot'] = (payload) => {
    const teacher = teachers.find((t) => t.id === payload.teacherId)
    if (!teacher) return { ok: false, clashError: 'Selected teacher not found.' }
    const cleanRoom = payload.room.trim() || 'Room 201'

    const teacherClash = timetableSlots.find(
      (s) =>
        s.id !== payload.id &&
        s.day === payload.day &&
        s.period === payload.period &&
        s.teacherId === payload.teacherId,
    )
    if (teacherClash) {
      return {
        ok: false,
        clashError: `Teacher Clash: ${teacher.name} is already teaching ${teacherClash.subject} in ${teacherClash.className} (${teacherClash.room}) on ${payload.day} Period ${payload.period}.`,
      }
    }

    const roomClash = timetableSlots.find(
      (s) =>
        s.id !== payload.id &&
        s.day === payload.day &&
        s.period === payload.period &&
        s.room.toLowerCase() === cleanRoom.toLowerCase(),
    )
    if (roomClash) {
      return {
        ok: false,
        clashError: `Room Clash: ${cleanRoom} is already booked by ${roomClash.className} (${roomClash.teacherName}) on ${payload.day} Period ${payload.period}.`,
      }
    }

    const classClash = timetableSlots.find(
      (s) =>
        s.id !== payload.id &&
        s.day === payload.day &&
        s.period === payload.period &&
        s.className === payload.className,
    )
    if (classClash) {
      return {
        ok: false,
        clashError: `Class Clash: ${payload.className} already has ${classClash.subject} scheduled in Period ${payload.period} on ${payload.day}.`,
      }
    }

    const nextSlot: TimetableSlot = {
      id: payload.id || `tt-${Date.now()}`,
      day: payload.day,
      period: payload.period,
      timeLabel: payload.timeLabel,
      className: payload.className,
      subject: payload.subject.trim() || teacher.subject,
      teacherId: teacher.id,
      teacherName: teacher.name,
      room: cleanRoom,
    }

    const nextSlots = payload.id
      ? timetableSlots.map((s) => (s.id === payload.id ? nextSlot : s))
      : [...timetableSlots, nextSlot]
    setTimetableSlots(nextSlots)

    // Sync Today's Routine across Student & Guardian Overviews when editing today's weekday
    if (nextSlot.day === getActiveSchoolWeekday()) {
      syncStudentsTodayPeriodsFromTimetable(nextSlots, nextSlot.className)
    }

    pushNotification({
      title: `Class Routine Updated · ${nextSlot.className}`,
      text: `${nextSlot.day} Period ${nextSlot.period} (${nextSlot.timeLabel}): ${nextSlot.subject} with ${nextSlot.teacherName} in ${nextSlot.room}.`,
      type: 'notice',
      forRoles: ['teacher', 'student', 'guardian'],
    })
    pushAudit(
      'Timetable Updated',
      `${nextSlot.day} P${nextSlot.period} · ${nextSlot.className} (${nextSlot.subject} · ${nextSlot.teacherName})`,
    )
    notify(
      `Scheduled ${nextSlot.subject} for ${nextSlot.className} (${nextSlot.day} P${nextSlot.period}) — synced to Teacher, Guardian & Student portals!`,
    )
    return { ok: true }
  }

  const deleteTimetableSlot = (slotId: string) => {
    const slot = timetableSlots.find((s) => s.id === slotId)
    const nextSlots = timetableSlots.filter((s) => s.id !== slotId)
    setTimetableSlots(nextSlots)
    if (slot) {
      if (slot.day === getActiveSchoolWeekday()) {
        syncStudentsTodayPeriodsFromTimetable(nextSlots, slot.className)
      }
      pushAudit('Timetable Slot Removed', `${slot.day} P${slot.period} · ${slot.className}`)
      notify(`Removed ${slot.subject} from ${slot.day} Period ${slot.period} (synced live)`)
    }
  }

  const addExamSchedule: SchoolState['addExamSchedule'] = (payload) => {
    const teacher = teachers.find((t) => t.id === payload.invigilatorId)
    if (!teacher) return { ok: false, clashError: 'Selected invigilator not found.' }
    const cleanRoom = payload.room.trim() || 'Exam Hall A'

    const invClash = examSchedules.find(
      (e) =>
        e.date.trim().toLowerCase() === payload.date.trim().toLowerCase() &&
        e.timeSlot.trim().toLowerCase() === payload.timeSlot.trim().toLowerCase() &&
        e.invigilatorId === payload.invigilatorId,
    )
    if (invClash) {
      return {
        ok: false,
        clashError: `Invigilator Clash: ${teacher.name} is already invigilating ${invClash.subject} (${invClash.room}) on ${payload.date} (${payload.timeSlot}).`,
      }
    }

    const roomClash = examSchedules.find(
      (e) =>
        e.date.trim().toLowerCase() === payload.date.trim().toLowerCase() &&
        e.timeSlot.trim().toLowerCase() === payload.timeSlot.trim().toLowerCase() &&
        e.room.trim().toLowerCase() === cleanRoom.toLowerCase(),
    )
    if (roomClash) {
      return {
        ok: false,
        clashError: `Exam Hall Clash: ${cleanRoom} is already reserved for ${roomClash.className} (${roomClash.subject}) on ${payload.date}.`,
      }
    }

    const created: ExamScheduleEntry = {
      id: `ex-${Date.now()}`,
      examName: payload.examName.trim() || 'Term Final Examination 2026',
      className: payload.className,
      subject: payload.subject.trim(),
      date: payload.date.trim(),
      timeSlot: payload.timeSlot.trim(),
      room: cleanRoom,
      invigilatorId: teacher.id,
      invigilatorName: teacher.name,
    }
    setExamSchedules((prev) => [created, ...prev])
    pushAudit('Exam Scheduled', `${created.className} · ${created.subject} on ${created.date}`)
    notify(`Exam scheduled: ${created.subject} (${created.date})`)
    return { ok: true }
  }

  const deleteExamSchedule = (examId: string) => {
    setExamSchedules((prev) => prev.filter((e) => e.id !== examId))
    notify('Exam schedule entry removed')
  }

  // ==================== OFFICIAL PRINTABLE DOCUMENTS & QR REGISTRY ====================
  const issueOfficialDocument: SchoolState['issueOfficialDocument'] = ({ docType, studentId }) => {
    const stu = students.find((s) => s.id === studentId)
    if (!stu) return null
    const code = `DMHA-DOC-2026-${Math.floor(1000 + Math.random() * 9000)}`
    const doc: IssuedDocumentLog = {
      id: `doc-${Date.now()}`,
      verifyCode: code,
      docType,
      studentId: stu.id,
      studentName: stu.name,
      className: `${stu.className} · ${stu.section}`,
      issuedBy: authUser?.displayName || 'Shahid (Principal)',
      issuedAt: new Date().toLocaleString([], {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }
    setIssuedDocuments((prev) => [doc, ...prev])
    pushAudit(`Issued ${docType}`, `${stu.name} (${code})`)
    notify(`Official ${docType} issued · Verification Code: ${code}`)
    return doc
  }

  // ==================== BULK CSV IMPORT & YEAR-END CLASS PROMOTION ====================
  const bulkImportStudents: SchoolState['bulkImportStudents'] = (rows) => {
    let createdGuardiansCount = 0
    const nextGuardians = [...guardians]
    const newStudents: StudentRecord[] = []
    const newWallets: CanteenWallet[] = []

    rows.forEach((row, idx) => {
      const cleanName = row.name.trim()
      if (!cleanName) return
      const cleanGuardianName = row.guardianName.trim() || `${cleanName.split(' ')[0]}'s Guardian`
      const cleanPhone = row.guardianPhone.trim() || '+880 1700-000000'
      const cleanEmail =
        row.guardianEmail?.trim().toLowerCase() ||
        `${cleanGuardianName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}.${Date.now().toString().slice(-3)}${idx}@guardian.dmha.edu`

      const stuId = `stu-imp-${Date.now()}-${idx}`
      const existingGuardian = nextGuardians.find(
        (g) =>
          g.name.toLowerCase() === cleanGuardianName.toLowerCase() ||
          g.phone.replace(/\D/g, '') === cleanPhone.replace(/\D/g, ''),
      )
      let matchedGuardian: GuardianRecord
      if (existingGuardian) {
        matchedGuardian = existingGuardian
        if (!matchedGuardian.linkedStudentIds.includes(stuId)) {
          matchedGuardian.linkedStudentIds = [...matchedGuardian.linkedStudentIds, stuId]
        }
      } else {
        matchedGuardian = {
          id: `grd-imp-${Date.now()}-${idx}`,
          name: cleanGuardianName,
          initials: cleanGuardianName
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase(),
          relation: 'Guardian',
          phone: cleanPhone,
          email: cleanEmail,
          linkedStudentIds: [stuId],
          status: 'active',
          sharedDeviceMode: true,
          parentPin: '1234',
          biometricRequired: true,
        }
        nextGuardians.push(matchedGuardian)
        createdGuardiansCount += 1
      }

      const initials = cleanName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
      const section = row.section.trim() || 'Section A'
      const className = row.className.trim() || 'Class 4'

      newStudents.push({
        id: stuId,
        name: cleanName,
        initials,
        className,
        section,
        roll: row.roll.trim() || String(20 + students.length + idx),
        guardianId: matchedGuardian.id,
        guardianName: matchedGuardian.name,
        guardianPhone: matchedGuardian.phone,
        status: 'active',
        house: row.house || 'Emerald',
        todayStatus: 'present',
        gateCheckIn: '07:55 AM',
        attendanceRate: 96,
        presentDays: 24,
        totalDays: 25,
        gpa: '4.60',
        averageScore: 86,
        rank: 'Top 20%',
        bloodGroup: row.bloodGroup?.trim() || 'O+',
        busRoute: row.busRoute?.trim() || 'Unit - 1',
        subjects: [
          {
            id: `${stuId}-phy`,
            name: 'Physics',
            teacher: 'Nadia Rahman',
            section,
            progress: 72,
            latestScore: 86,
            previousScore: 82,
            grade: 'A',
            color: 'violet',
            nextTopic: 'Forces & Motion',
          },
          {
            id: `${stuId}-mth`,
            name: 'Mathematics',
            teacher: 'Sakib Al Hasan',
            section,
            progress: 75,
            latestScore: 88,
            previousScore: 84,
            grade: 'A',
            color: 'cyan',
            nextTopic: 'Algebraic Equations',
          },
          {
            id: `${stuId}-eng`,
            name: 'English',
            teacher: 'Farhana Karim',
            section,
            progress: 78,
            latestScore: 84,
            previousScore: 81,
            grade: 'A',
            color: 'lime',
            nextTopic: 'Comprehension & Essay',
          },
        ],
        todayPeriods: [],
      })

      newWallets.push({
        studentId: stuId,
        balance: 1500,
        dailyLimit: 250,
        allergyGuard: 'None recorded',
      })
    })

    if (newStudents.length > 0) {
      setGuardians(nextGuardians)
      setStudents((prev) => [...newStudents, ...prev])
      setCanteenWallets((prev) => [...prev, ...newWallets])
      pushAudit(
        'Bulk CSV Student Import',
        `Imported ${newStudents.length} students & ${createdGuardiansCount} new guardian accounts`,
      )
      notify(`Imported ${newStudents.length} students into DMHA SQLite!`)
    }

    return { importedCount: newStudents.length, createdGuardiansCount }
  }

  const promoteClassCohort: SchoolState['promoteClassCohort'] = async ({
    fromClass,
    toClass,
    minPassScore,
    archiveAsAlumni,
    examId,
    enforceExamPass,
    overrideStudentIds,
  }) => {
    const res = await callModuleApi('/dmhs-api/promotion', {
      fromClass,
      toClass,
      minPassScore,
      archiveAsAlumni,
      examId,
      enforceExamPass,
      overrideStudentIds,
    })
    if (!res.ok) {
      return {
        ok: false,
        promotedCount: 0,
        retainedCount: 0,
        graduatedCount: 0,
        examBlockedCount: 0,
      }
    }
    const promotedCount = Number(res.json?.promotedCount || 0)
    const retainedCount = Number(res.json?.retainedCount || 0)
    const graduatedCount = Number(res.json?.graduatedCount || 0)
    const examBlockedCount = Number(res.json?.examBlockedCount || 0)
    const verifiedExamTitle = (res.json?.verifiedExamTitle as string | null | undefined) ?? null
    notify(
      archiveAsAlumni
        ? `Graduated ${graduatedCount} student(s) from ${fromClass} to DMHA Alumni`
        : `Promoted ${promotedCount} student(s) from ${fromClass} → ${toClass}${retainedCount > 0 ? ` (${retainedCount} retained)` : ''}`,
    )
    return {
      ok: true,
      promotedCount,
      retainedCount,
      graduatedCount,
      examBlockedCount,
      verifiedExamTitle,
    }
  }

  const getOrCreateQuestProfile = (
    profiles: Record<string, StudyQuestProfile>,
    studentId: string,
  ): StudyQuestProfile => {
    return (
      profiles[studentId] || {
        studentId,
        xp: 120,
        streakDays: 1,
        completedMissionIds: [],
        clearedBossIds: [],
        focusMinutesLogged: 0,
        unlockedBadges: ['First Quest'],
        guardianCheers: 0,
        lastStudyDate: new Date().toISOString().slice(0, 10),
      }
    )
  }

  const completeStudyMission: SchoolState['completeStudyMission'] = ({
    studentId,
    missionId,
    title,
    subject,
    xpReward,
    focusMinutes = 0,
  }) => {
    const stu = students.find((s) => s.id === studentId)
    const today = new Date().toISOString().slice(0, 10)
    let awardedMerit = false

    setStudyQuestProfiles((prev) => {
      const current = getOrCreateQuestProfile(prev, studentId)
      if (current.completedMissionIds.includes(missionId)) return prev
      const nextCompleted = [...current.completedMissionIds, missionId]
      const nextXp = current.xp + xpReward
      const nextStreak = current.lastStudyDate === today ? current.streakDays : current.streakDays + 1
      const nextMinutes = current.focusMinutesLogged + focusMinutes
      const badges = new Set(current.unlockedBadges)
      badges.add('First Quest')
      if (nextCompleted.length >= 3) badges.add('3-Mission Combo')
      if (nextStreak >= 5) badges.add('5-Day Streak Flame')
      if (nextMinutes >= 60) badges.add('Focus Champion')
      if (nextXp >= 600) badges.add('Knowledge Knight')
      if (nextCompleted.length % 3 === 0) awardedMerit = true

      return {
        ...prev,
        [studentId]: {
          ...current,
          xp: nextXp,
          streakDays: nextStreak,
          completedMissionIds: nextCompleted,
          focusMinutesLogged: nextMinutes,
          unlockedBadges: Array.from(badges),
          lastStudyDate: today,
        },
      }
    })

    if (stu && awardedMerit) {
      void awardMeritOrPastoral({
        studentId: stu.id,
        house: stu.house || 'Emerald',
        type: 'merit',
        points: 2,
        reason: `Smart Study Coach · 3-Mission Combo Bonus (${subject})`,
        studyQuestReward: true,
      })
    }

    notify(`Mission Complete! +${xpReward} XP earned for "${title}"`)
  }

  const logStudyFocusSession: SchoolState['logStudyFocusSession'] = ({
    studentId,
    subject,
    minutes,
    xpReward,
  }) => {
    const today = new Date().toISOString().slice(0, 10)
    setStudyQuestProfiles((prev) => {
      const current = getOrCreateQuestProfile(prev, studentId)
      const nextMinutes = current.focusMinutesLogged + minutes
      const nextStreak = current.lastStudyDate === today ? current.streakDays : current.streakDays + 1
      const badges = new Set(current.unlockedBadges)
      if (nextMinutes >= 60) badges.add('Focus Champion')
      if (nextStreak >= 5) badges.add('5-Day Streak Flame')
      return {
        ...prev,
        [studentId]: {
          ...current,
          xp: current.xp + xpReward,
          streakDays: nextStreak,
          focusMinutesLogged: nextMinutes,
          unlockedBadges: Array.from(badges),
          lastStudyDate: today,
        },
      }
    })
    notify(`Focus Quest Logged! +${minutes} mins on ${subject} (+${xpReward} XP)`)
  }

  const clearStudyBossBattle: SchoolState['clearStudyBossBattle'] = ({
    studentId,
    bossId,
    bossName,
    subject,
    xpReward,
  }) => {
    const stu = students.find((s) => s.id === studentId)
    const today = new Date().toISOString().slice(0, 10)
    let firstClear = false

    setStudyQuestProfiles((prev) => {
      const current = getOrCreateQuestProfile(prev, studentId)
      const alreadyCleared = current.clearedBossIds.includes(bossId)
      firstClear = !alreadyCleared
      const nextBosses = alreadyCleared ? current.clearedBossIds : [...current.clearedBossIds, bossId]
      const earnedXp = alreadyCleared ? Math.round(xpReward * 0.4) : xpReward
      const badges = new Set(current.unlockedBadges)
      badges.add('Boss Slayer')
      if (nextBosses.length >= 2) badges.add('Grand Conqueror')

      return {
        ...prev,
        [studentId]: {
          ...current,
          xp: current.xp + earnedXp,
          streakDays: current.lastStudyDate === today ? current.streakDays : current.streakDays + 1,
          clearedBossIds: nextBosses,
          unlockedBadges: Array.from(badges),
          lastStudyDate: today,
        },
      }
    })

    if (stu && firstClear) {
      void awardMeritOrPastoral({
        studentId: stu.id,
        house: stu.house || 'Emerald',
        type: 'merit',
        points: 3,
        reason: `Defeated ${bossName} (${subject} Study Boss Battle)`,
        studyQuestReward: true,
      })
    }

    notify(
      firstClear
        ? `VICTORY! Defeated ${bossName} — +${xpReward} XP & +3 House Merit unlocked!`
        : `Rematch Victory vs ${bossName}! +${Math.round(xpReward * 0.4)} Bonus XP`,
    )
  }

  const sendGuardianStudyCheer: SchoolState['sendGuardianStudyCheer'] = (studentId) => {
    const stu = students.find((s) => s.id === studentId)
    const guardian = guardians.find((g) => g.id === activeGuardianId)
    setStudyQuestProfiles((prev) => {
      const current = getOrCreateQuestProfile(prev, studentId)
      const badges = new Set(current.unlockedBadges)
      badges.add('Family Support Star')
      return {
        ...prev,
        [studentId]: {
          ...current,
          xp: current.xp + 15,
          guardianCheers: current.guardianCheers + 1,
          unlockedBadges: Array.from(badges),
        },
      }
    })
    if (stu) {
      setNotifications((prev) => [
        {
          id: `not-cheer-${Date.now()}`,
          title: `Parent Encouragement Boost · ${stu.name}`,
          text: `${guardian?.name || 'Your Guardian'} cheered you on in Smart Study Coach! +15 Bonus XP added to your Quest Profile.`,
          time: 'Just now',
          read: false,
          type: 'merit',
          forRoles: ['student', 'guardian'],
        },
        ...prev,
      ])
    }
    notify(`Sent +15 XP Encouragement Boost to ${stu?.name || 'student'}!`)
  }

  // ==================== CUSTOM STAFF ROLES, STAFF ACCOUNTS & CANTEEN MENU ====================
  const activeStaffMember =
    staffMembers.find((s) => s.id === activeStaffId) || staffMembers[0] || null
  const activeCustomRole =
    customRoles.find((r) => r.id === activeStaffMember?.customRoleId) || customRoles[0] || null

  const hasStaffPermission = (perm: StaffPermission): boolean => {
    if (role === 'admin') return true
    if (role !== 'staff') return false
    if (!activeStaffMember || activeStaffMember.status === 'suspended') return false
    return Boolean(activeCustomRole?.permissions.includes(perm))
  }

  const createCustomRole: SchoolState['createCustomRole'] = (payload) => {
    const cleanName = payload.name.trim()
    const slug =
      cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `role-${Date.now()}`
    const created: CustomRoleDefinition = {
      id: `role-${slug}-${Date.now().toString(36)}`,
      name: cleanName,
      slug,
      description: payload.description.trim() || `Custom DMHA staff workspace for ${cleanName}.`,
      accent: payload.accent,
      permissions: payload.permissions.length > 0 ? payload.permissions : ['notices'],
      createdAt: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    }
    setCustomRoles((prev) => [...prev, created])
    pushAudit('Created Custom Staff Role', `${created.name} (${created.permissions.join(', ')})`)
    notify(`Custom role "${created.name}" created with ${created.permissions.length} permissions!`)
    return created
  }

  const updateCustomRolePermissions: SchoolState['updateCustomRolePermissions'] = (
    roleId,
    permissions,
  ) => {
    const target = customRoles.find((r) => r.id === roleId)
    setCustomRoles((prev) =>
      prev.map((r) =>
        r.id === roleId
          ? { ...r, permissions: permissions.length > 0 ? permissions : ['notices'] }
          : r,
      ),
    )
    if (target) {
      pushAudit('Updated Custom Role Permissions', `${target.name} → ${permissions.join(', ')}`)
      notify(`Updated permissions for ${target.name} role`)
    }
  }

  const deleteCustomRole: SchoolState['deleteCustomRole'] = (roleId) => {
    const inUse = staffMembers.some((s) => s.customRoleId === roleId)
    if (inUse) {
      return {
        ok: false,
        error: 'Remove or reassign staff members using this role before deleting it.',
      }
    }
    const target = customRoles.find((r) => r.id === roleId)
    setCustomRoles((prev) => prev.filter((r) => r.id !== roleId))
    if (target) {
      pushAudit('Deleted Custom Staff Role', target.name)
      notify(`Deleted role "${target.name}"`)
    }
    return { ok: true }
  }

  const addStaffMember: SchoolState['addStaffMember'] = async (payload) => {
    const roleDef = customRoles.find((r) => r.id === payload.customRoleId)
    if (!roleDef) return { ok: false, error: 'Please select a valid custom staff role.' }
    const newId = `stf-${Date.now().toString(36)}`
    const cleanEmail = payload.email.trim().toLowerCase()
    const cleanName = payload.name.trim()
    const initials = getInitials(cleanName)
    const loginCode = `STF-${roleDef.slug.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 899)}`

    const authRes = await adminResetUserPassword({
      linkedEntityId: newId,
      role: 'staff',
      displayName: cleanName,
      email: cleanEmail,
      loginCode,
      status: 'active',
      newPassword: payload.initialPassword?.trim() || 'dmha2026',
    })
    if (!authRes.ok) {
      return { ok: false, error: authRes.error || 'Could not create SQLite login account.' }
    }

    const member: StaffMemberRecord = {
      id: newId,
      name: cleanName,
      initials,
      email: cleanEmail,
      phone: payload.phone.trim() || '+880 1711-000000',
      customRoleId: roleDef.id,
      department: payload.department.trim() || roleDef.name,
      status: 'active',
      createdAt: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    }
    setStaffMembers((prev) => [member, ...prev])
    pushAudit('Added Staff Account', `${member.name} (${roleDef.name} · ${member.email})`)
    notify(`Created ${roleDef.name} account for ${member.name} (${cleanEmail})`)
    return { ok: true }
  }

  const toggleStaffStatus = (staffId: string) => {
    const target = staffMembers.find((s) => s.id === staffId)
    if (!target) return
    const nextStatus = target.status === 'active' ? 'suspended' : 'active'
    setStaffMembers((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, status: nextStatus } : s)),
    )
    void adminResetUserPassword({
      linkedEntityId: target.id,
      role: 'staff',
      displayName: target.name,
      email: target.email,
      status: nextStatus,
    })
    pushAudit('Updated Staff Status', `${target.name} → ${nextStatus}`)
    notify(`${target.name} is now ${nextStatus}`)
  }

  const removeStaffMember = (staffId: string) => {
    const target = staffMembers.find((s) => s.id === staffId)
    setStaffMembers((prev) => prev.filter((s) => s.id !== staffId))
    if (target) {
      void adminResetUserPassword({
        linkedEntityId: target.id,
        role: 'staff',
        displayName: target.name,
        email: target.email,
        status: 'suspended',
      })
      pushAudit('Removed Staff Member', target.name)
      notify(`Removed staff account: ${target.name}`)
    }
  }

  const impersonateStaff = (staffId: string) => {
    const target = staffMembers.find((s) => s.id === staffId)
    if (!target) return
    const roleDef = customRoles.find((r) => r.id === target.customRoleId)
    setActiveStaffId(target.id)
    setRole('staff')
    notify(`Previewing ${roleDef?.name || 'Staff'} Workspace: ${target.name}`)
  }

  const addCanteenMenuItem: SchoolState['addCanteenMenuItem'] = (payload) => {
    const item: CanteenMenuItem = {
      id: `cm-${Date.now()}`,
      name: payload.name.trim(),
      category: payload.category,
      price: Math.max(10, Math.round(payload.price)),
      available: true,
      allergens: payload.allergens?.trim() || undefined,
    }
    setCanteenMenu((prev) => [item, ...prev])
    pushAudit('Canteen Menu Item Added', `${item.name} (৳${item.price})`)
    notify(`Added "${item.name}" (৳${item.price}) to DMHA Canteen Menu`)
  }

  const toggleCanteenMenuAvailability = (itemId: string) => {
    setCanteenMenu((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, available: !item.available } : item)),
    )
  }

  const updateCanteenMenuItemPrice = (itemId: string, price: number) => {
    const clamped = Math.max(10, Math.round(price))
    setCanteenMenu((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, price: clamped } : item)),
    )
    notify(`Updated menu price to ৳${clamped}`)
  }

  const deleteCanteenMenuItem = (itemId: string) => {
    setCanteenMenu((prev) => prev.filter((item) => item.id !== itemId))
    notify('Removed food item from Canteen Menu')
  }

  const resetDemoData = () => {
    setStudents(initialStudents)
    setTeachers(initialTeachers)
    setGuardians(initialGuardians)
    setAuditLogs(initialAuditLogs)
    setActiveGuardianId('grd-tariq')
    setActiveTeacherId('tch-nadia')
    setActiveStudentId('stu-araf')
    setSelectedChildId('stu-araf')
    setFeedback(initialFeedback)
    setAssignments(initialAssignments)
    setFees(initialFees)
    setLeaveRequests(initialLeaveRequests)
    setPtmRequests(initialPTMRequests)
    setNotices(initialNotices)
    setCampusUnits(initialCampusUnits)
    setUnitTransferRequests(initialUnitTransferRequests)
    setCampusClubs(initialCampusClubs)
    setClassMoments(initialClassMoments)
    setCalendarEvents(initialAcademicCalendarEvents)
    setPtmSlots(initialPtmSlots)
    setEarlyYearsCareLogs(initialEarlyYearsCareLogs)
    setClassFeeSchedules(initialClassFeeSchedules)
    setSiblingDiscountPct(10)
    setHelpDeskTickets(initialHelpDeskTickets)
    setCampusTasks(initialCampusTasks)
    setEmployeeDuties(initialEmployeeDuties)
    setRfidDevices(initialRfidDevices)
    setRfidPunches(initialRfidPunches)
    setStudentFines(initialStudentFines)
    setLiveMeetings(initialLiveMeetings)
    setStockItems(initialStockItems)
    setStockMovements(initialStockMovements)
    setQuestionBank(initialQuestionBank)
    setJobVacancies(initialJobVacancies)
    setJobApplications(initialJobApplications)
    setWebsiteConfig(initialSchoolWebsiteConfig)
    setAccountingBook(initialAccountingBook)
    setPayrollBook(initialPayrollBook)
    setExamBook(initialExamBook)
    setTransportBook(initialTransportBook)
    setLibraryCirculation([])
    setChats(initialChats)
    setNotifications(initialNotifications)
    setPickupContacts(initialPickupContacts)
    setDismissalLogs(initialDismissalLogs)
    setMedicalLogs(initialMedicalLogs)
    setHouseStandings(initialHouseStandings)
    setMerits(initialMerits)
    setStudentAchievements(initialStudentAchievements)
    setPastPapers(pastPapersVault)
    setConsentForms(initialConsentForms)
    setCanteenWallets(initialCanteenWallets)
    setCanteenTransactions(initialCanteenTransactions)
    setExpenses(initialExpenses)
    setOtherIncomes(initialOtherIncomes)
    setExamSheets(initialExamSheets)
    setQuizzes(initialQuizzes)
    setQuizAttempts(initialQuizAttempts)
    setAdmissions(initialAdmissions)
    setQrScans(initialQRScans)
    setLibraryBooks(initialLibraryBooks)
    setStudyResources(initialStudyResources)
    setTeacherLeaves(initialTeacherLeaves)
    setParentAlerts(initialParentAlerts)
    setCampusWifiConfig(initialCampusWifiConfig)
    setTeacherAttendance(initialTeacherAttendance)
    setTeacherSalaries(initialTeacherSalaries)
    setTeacherTrainings(initialTeacherTrainings)
    setTimetableSlots(initialTimetableSlots)
    setExamSchedules(initialExamSchedules)
    setAlumni(initialAlumni)
    setIssuedDocuments(initialIssuedDocuments)
    setStudyQuestProfiles(initialStudyQuestProfiles)
    setCustomRoles(initialCustomRoles)
    setStaffMembers(initialStaffMembers)
    setCanteenMenu(initialCanteenMenu)
    setActiveStaffId('stf-rafiqul')
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    fetch('/dmhs-api/state', { method: 'DELETE' })
      .then(() => refreshDbFromServer())
      .catch(() => {})
    notify('SQLite database & demo data re-seeded')
  }

  return (
    <SchoolContext.Provider
      value={{
        role,
        setRole,
        selectedChildId,
        setSelectedChildId,
        activeGuardianId,
        setActiveGuardianId,
        activeTeacherId,
        setActiveTeacherId,
        activeStudentId,
        setActiveStudentId,
        activeStaffId,
        setActiveStaffId,
        customRoles,
        staffMembers,
        canteenMenu,
        activeStaffMember,
        activeCustomRole,
        hasStaffPermission,
        students,
        teachers,
        guardians,
        auditLogs,
        feedback,
        semesterEvaluations,
        getSemesterEvaluationStatus,
        courseMaterials,
        semesterSyllabusConfig,
        assignments,
        fees,
        leaveRequests,
        ptmRequests,
        notices,
        campusUnits,
        unitTransferRequests,
        campusClubs,
        classMoments,
        calendarEvents,
        ptmSlots,
        earlyYearsCareLogs,
        classFeeSchedules,
        siblingDiscountPct,
        helpDeskTickets,
        campusTasks,
        employeeDuties,
        rfidDevices,
        rfidPunches,
        studentFines,
        liveMeetings,
        stockItems,
        stockMovements,
        questionBank,
        jobVacancies,
        jobApplications,
        websiteConfig,
        accountingBook,
        payrollBook,
        examBook,
        transportBook,
        libraryCirculation,
        runErpOps,
        runErpCampus,
        runAccountingAction,
        runPayrollAction,
        runExamAction,
        runMessageAction,
        runLibraryAction,
        runTransportAction,
        runLeaveAction,
        runTaskAction,
        chats,
        notifications,
        pickupContacts,
        dismissalLogs,
        medicalLogs,
        houseStandings,
        merits,
        studentAchievements,
        pastPapers,
        consentForms,
        canteenWallets,
        canteenTransactions,
        expenses,
        otherIncomes,
        examSheets,
        quizzes,
        quizAttempts,
        admissions,
        qrScans,
        libraryBooks,
        studyResources,
        teacherLeaves,
        parentAlerts,
        campusWifiConfig,
        teacherAttendance,
        teacherSalaries,
        teacherTrainings,
        timetableSlots,
        examSchedules,
        alumni,
        issuedDocuments,
        studyQuestProfiles,
        connectedDevices,
        realtimeConnected,
        authUser,
        authAccounts,
        biometricDevices,
        refreshBiometricDevices,
        toggleGuardianBiometricRequired,
        authLoading,
        isDeveloperMode,
        devSwitchAccount,
        devReturnToDeveloper,
        demoLoginAllowed,
        refreshAuthAccounts,
        changeOwnPassword,
        adminResetUserPassword,
        demoSwitcherEnabled,
        setDemoSwitcherEnabled,
        dbStatus,
        dbStats,
        loginWithCredentials,
        loginDemoRole,
        logout,
        refreshDbFromServer,
        toast,
        notify,
        createQuiz,
        updateQuiz,
        toggleQuizStatus,
        deleteQuiz,
        submitQuizAttempt,
        syncQuizResultsToGradebook,
        remindUnattemptedStudents,
        submitAdmissionApplication,
        updateAdmissionStage,
        updateAdmissionTestInfo,
        markAdmissionFeePaid,
        enrollApplicant,
        logQRCardScan,
        processServerQRScan,
        familyChildMode,
        familyLockGuardianId,
        toggleGuardianSharedMode,
        updateGuardianParentPin,
        enterFamilyChildMode,
        exitFamilyChildMode,
        forceExitFamilyChildMode,
        issueLibraryBook,
        returnLibraryBook,
        addLibraryBook,
        addStudyResource,
        trackResourceDownload,
        createCourseMaterial,
        updateCourseMaterial,
        toggleCourseMaterialPublish,
        duplicateCourseMaterialToClass,
        deleteCourseMaterial,
        trackCourseMaterialDownload,
        toggleCourseMaterialRevised,
        updateSemesterSyllabusConfig,
        requestTeacherLeave,
        assignSubstituteTeacher,
        declineTeacherLeave,
        dispatchParentAlert,
        updateCampusWifiConfig,
        performTeacherWifiPunch,
        disburseTeacherSalary,
        disburseAllPendingSalaries,
        generateMonthlyPayroll,
        updateTeacherSalaryPackage,
        assignTeacherTraining,
        toggleTeacherTrainingCompletion,
        sendNextClassReminder,
        upsertTimetableSlot,
        deleteTimetableSlot,
        addExamSchedule,
        deleteExamSchedule,
        issueOfficialDocument,
        bulkImportStudents,
        promoteClassCohort,
        uploadExamSheet,
        reviewExamSheet,
        verifyExamSheetByAdmin,
        createFeeInvoice,
        addExpense,
        toggleExpenseStatus,
        deleteExpense,
        addOtherIncome,
        addTeacher,
        updateTeacherProfile,
        toggleTeacherStatus,
        updateTeacherClasses,
        removeTeacher,
        addGuardian,
        updateGuardianProfile,
        toggleGuardianStatus,
        linkStudentToGuardian,
        removeGuardian,
        addStudent,
        updateStudentProfile,
        toggleStudentStatus,
        removeStudent,
        impersonateUser,
        updateStudentAttendance,
        saveRollCallAndNotify,
        addTeacherFeedback,
        submitFamilyFeedback,
        acknowledgeFeedback,
        submitSemesterEvaluations,
        updateSubjectScore,
        publishGradebookBatch,
        addGradebookSubject,
        uploadGradebookExamSheet,
        submitAssignment,
        markOfflineCopyReceived,
        toggleAssignmentStep,
        gradeAssignment,
        createAssignment,
        payFeeInvoice,
        submitLeaveRequest,
        updateLeaveStatus,
        addLeaveDiscussionMessage,
        bookPTM,
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
        createClassMoment,
        reactClassMoment,
        commentClassMoment,
        deleteClassMoment,
        createCalendarEvent,
        deleteCalendarEvent,
        createPtmSlots,
        bookPtmSlot,
        cancelPtmSlot,
        completePtmSlot,
        deletePtmSlot,
        logEarlyYearsCare,
        acknowledgeEarlyYearsCare,
        deleteEarlyYearsCare,
        saveClassFeeSchedules,
        generateMonthlyFeeInvoices,
        sendBulkFeeReminders,
        sendChatMessage,
        markNotificationRead,
        markAllNotificationsRead,
        addPickupContact,
        logGateDismissal,
        addMedicalLog,
        awardMeritOrPastoral,
        updatePastoralCase,
        acknowledgeMeritOrPastoral,
        deleteMeritOrPastoral,
        reassignStudentHouse,
        addStudentAchievement,
        addPastPaperItem,
        deletePastPaperItem,
        syncLeaderboardRanks,
        signConsentForm,
        declineConsentForm,
        createConsentForm,
        remindConsentForm,
        deleteConsentForm,
        topUpCanteenWallet,
        updateCanteenLimit,
        completeStudyMission,
        logStudyFocusSession,
        clearStudyBossBattle,
        sendGuardianStudyCheer,
        createCustomRole,
        updateCustomRolePermissions,
        deleteCustomRole,
        addStaffMember,
        toggleStaffStatus,
        removeStaffMember,
        impersonateStaff,
        addCanteenMenuItem,
        toggleCanteenMenuAvailability,
        updateCanteenMenuItemPrice,
        deleteCanteenMenuItem,
        resetDemoData,
      }}
    >
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool() {
  const ctx = useContext(SchoolContext)
  if (!ctx) throw new Error('useSchool must be used inside SchoolProvider')
  return ctx
}
