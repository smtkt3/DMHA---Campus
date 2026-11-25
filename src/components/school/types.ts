export type Role = 'guardian' | 'student' | 'teacher' | 'admin' | 'staff'

export type StaffPermission =
  | 'accounts'
  | 'payroll'
  | 'payment_ledger'
  | 'canteen_pos'
  | 'gate_security'
  | 'infirmary'
  | 'library'
  | 'admissions'
  | 'documents'
  | 'timetable'
  | 'notices'

export interface CustomRoleDefinition {
  id: string
  name: string
  slug: string
  description: string
  accent: 'emerald' | 'amber' | 'sky' | 'violet' | 'rose'
  permissions: StaffPermission[]
  createdAt: string
}

export interface StaffMemberRecord {
  id: string
  name: string
  initials: string
  email: string
  phone: string
  customRoleId: string
  department: string
  status: 'active' | 'suspended'
  createdAt: string
}

export interface CanteenMenuItem {
  id: string
  name: string
  category: 'Meals' | 'Snacks' | 'Drinks' | 'Healthy Bowls'
  price: number
  available: boolean
  allergens?: string
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave'

export type FeedbackCategory = 'praise' | 'academic' | 'behavior' | 'attention'

export type AccentColor = 'violet' | 'cyan' | 'lime' | 'orange'

export interface PeriodSlot {
  id: string
  time: string
  end: string
  subject: string
  topic: string
  teacher: string
  room: string
  color: AccentColor
  status?: AttendanceStatus
}

export interface SubjectProgress {
  id: string
  name: string
  teacher: string
  section: string
  progress: number
  latestScore: number
  previousScore: number
  grade: string
  color: AccentColor
  nextTopic: string
}

export interface StudentRecord {
  id: string
  name: string
  initials: string
  className: string
  section: string
  roll: string
  guardianId?: string
  guardianName: string
  guardianPhone: string
  status?: 'active' | 'suspended'
  house?: HouseName
  todayStatus: AttendanceStatus
  gateCheckIn: string | null
  attendanceRate: number
  presentDays: number
  totalDays: number
  gpa: string
  averageScore: number
  rank: string
  bloodGroup: string
  busRoute: string
  subjects: SubjectProgress[]
  todayPeriods: PeriodSlot[]
}

export interface TeacherRecord {
  id: string
  name: string
  initials: string
  email: string
  phone: string
  subject: string
  department: string
  assignedClasses: string[]
  status: 'active' | 'suspended'
}

export interface BiometricVerificationStamp {
  method: 'Biometric (Face/Fingerprint)' | 'Parent PIN'
  verifiedBy: string
  verifiedAt: string
  deviceLabel?: string
}

export interface GuardianBiometricDevice {
  id: string
  guardianId: string
  credentialId: string
  deviceLabel: string
  registeredAt: string
  lastVerifiedAt: string | null
  signCount: number
}

export interface GuardianRecord {
  id: string
  name: string
  initials: string
  relation: string
  phone: string
  email: string
  linkedStudentIds: string[]
  status: 'active' | 'suspended'
  sharedDeviceMode?: boolean
  parentPin?: string
  biometricRequired?: boolean
}

export interface AuditLogItem {
  id: string
  action: string
  target: string
  actor: string
  time: string
}

export interface TeacherFeedbackItem {
  id: string
  studentId: string
  studentName: string
  teacherName: string
  subject: string
  category: FeedbackCategory
  title: string
  message: string
  date: string
  acknowledgedByGuardian: boolean
  guardianReply?: string
  senderRole?: 'teacher' | 'guardian' | 'student' | 'admin'
  senderName?: string
  rating?: 1 | 2 | 3 | 4 | 5
  studentReply?: string
  teacherReply?: string
}

export interface SemesterEvaluationItem {
  id: string
  term: string
  studentId: string
  studentName: string
  classSection: string
  submittedByRole: 'student' | 'guardian'
  submittedByName: string
  teacherId: string
  teacherName: string
  subject: string
  rating: 1 | 2 | 3 | 4 | 5
  teachingClarity: 1 | 2 | 3 | 4 | 5
  supportiveness: 1 | 2 | 3 | 4 | 5
  comment: string
  createdAt: string
}

export interface SemesterEvaluationStatus {
  term: string
  requiredItems: Array<{
    subject: string
    teacherName: string
    teacherId: string
  }>
  completedSubjects: string[]
  remainingSubjects: string[]
  completedCount: number
  requiredCount: number
  isComplete: boolean
  averageGivenRating: number | null
}

export type HomeworkKind = 'Daily Homework' | 'Assignment' | 'Lab / Practical' | 'Project'
export type HomeworkSubmissionMode = 'offline' | 'online' | 'hybrid'

export interface AssignmentItem {
  id: string
  studentId: string
  className?: string
  kind?: HomeworkKind
  submissionMode?: HomeworkSubmissionMode
  offlineDropoffLocation?: string
  assignedDay?: SchoolWeekday
  assignedDate?: string
  title: string
  subject: string
  teacher: string
  dueDate: string
  submissionIso?: string
  submissionTime?: string
  estimatedMins?: number
  status: 'pending' | 'submitted' | 'graded' | 'overdue'
  score?: string
  teacherRemark?: string
  progress: number
  classSubmittedCount: number
  classTotalCount: number
  instructions?: string
  howToSteps?: string[]
  completedStepIndexes?: number[]
  whatToStudy?: string[]
  studyTip?: string
  submissionFormat?: string
  studentNote?: string
  submittedVia?: 'offline' | 'online'
  onlineResponseText?: string
  onlineAttachmentName?: string
  onlineAttachmentUrl?: string
  offlineReceivedInClass?: boolean
  chapterTitle?: string
  linkedMaterialId?: string
}

export type FeeCategory =
  | 'Admission Fee'
  | 'Tuition Fee'
  | 'Exam Fee'
  | 'Lab & Library'
  | 'Transport & Bus'
  | 'Uniform & Books'
  | 'Activity & CCA'
  | 'Other Fee'

export interface FeeInvoice {
  id: string
  studentId: string
  studentName: string
  title: string
  category?: FeeCategory
  dueDate: string
  amount: number
  status: 'paid' | 'due'
  paidAt?: string
  receiptNo?: string
}

export type ExpenseCategory =
  | 'Teacher Payroll'
  | 'Staff Salary'
  | 'Utilities & Internet'
  | 'Campus Maintenance'
  | 'Lab & Books'
  | 'Transport Fuel'
  | 'Events & Supplies'
  | 'Other Cost'

export interface ExpenseRecord {
  id: string
  title: string
  category: ExpenseCategory
  vendor: string
  amount: number
  date: string
  status: 'paid' | 'pending'
  approvedBy: string
  voucherNo?: string
}

export interface OtherIncomeRecord {
  id: string
  title: string
  category:
    | 'Admission Form Sales'
    | 'Uniform & Book Store'
    | 'Canteen Revenue'
    | 'Grant / Donation'
    | 'Other Income'
  amount: number
  date: string
  voucherNo?: string
}

export interface ExamSheetItem {
  id: string
  studentId: string
  studentName: string
  className: string
  subject: string
  examTitle: string
  marksObtained: number
  totalMarks: number
  captureMethod: 'Upload' | 'Scan' | 'Camera Photo'
  scanEnhanced: boolean
  fileType: 'image' | 'pdf'
  fileDataUrl: string
  teacherName: string
  teacherRemarks: string
  uploadedAt: string
  guardianReviewed: boolean
  guardianComment?: string
  guardianVerification?: BiometricVerificationStamp
  recheckRequested: boolean
  adminVerified: boolean
}

export interface LeaveDiscussionMessage {
  id: string
  sender: string
  senderRole: Role
  text: string
  time: string
}

export interface LeaveRequest {
  id: string
  studentId: string
  studentName: string
  guardianName: string
  dateRange: string
  reason: string
  leaveType?: 'Medical / Sick' | 'Family / Personal' | 'Emergency' | 'Competition / Academic'
  attachmentName?: string
  attachmentUrl?: string
  status: 'pending' | 'approved' | 'declined'
  submittedAt: string
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
  verification?: BiometricVerificationStamp
  messages?: LeaveDiscussionMessage[]
}

export interface PTMRequest {
  id: string
  studentId: string
  studentName: string
  guardianName: string
  teacherName: string
  subject: string
  slot: string
  topic: string
  status: 'confirmed' | 'pending'
}

export interface NoticeReadReceipt {
  userId: string
  name: string
  role: Role
  acknowledgedAt: string
}

export interface SchoolNotice {
  id: string
  title: string
  body: string
  category: 'academic' | 'event' | 'urgent' | 'transport' | 'unit'
  date: string
  eventDate?: string
  author: string
  authorId?: string
  authorRole?: Role
  audience: 'All' | 'Guardians' | 'Students' | 'Teachers' | 'Staff'
  targetUnit?: string
  targetClass?: string
  pinned?: boolean
  requireAcknowledgement?: boolean
  acknowledgedBy?: NoticeReadReceipt[]
  updatedAt?: string
}

export type UnitGateStatus = 'Open' | 'Dismissal Active' | 'Closed' | 'Restricted'

export interface CampusUnitRecord {
  id: string
  name: string
  code: string
  subtitle: string
  gradesCovered: string
  address: string
  gateHours: string
  gateStatus: UnitGateStatus
  coordinatorName: string
  coordinatorPhone: string
  facilities: string[]
  statusNote?: string
  accent: 'emerald' | 'sky' | 'violet' | 'amber'
  updatedAt?: string
}

export interface UnitTransferRequest {
  id: string
  studentId: string
  studentName: string
  classLabel: string
  fromUnit: string
  toUnit: string
  reason: string
  requestedBy: string
  requestedByRole: Role
  requestedAt: string
  status: 'pending' | 'approved' | 'declined'
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
}

export interface CampusClubItem {
  id: string
  name: string
  schedule: string
  mentor: string
  unitName: string
  category: 'STEM' | 'Debate & Arts' | 'Sports' | 'Leadership'
  memberIds: string[]
}

export interface ClassMomentMedia {
  id: string
  kind: 'image' | 'video'
  url: string
  mime: string
  filename: string
  sizeKb?: number
}

export interface ClassMomentComment {
  id: string
  authorId: string
  authorName: string
  authorRole: Role
  text: string
  createdAt: string
}

export interface ClassMomentPost {
  id: string
  title: string
  caption: string
  className: string
  section: string
  classLabel: string
  subject: string
  dateIso: string
  createdAt: string
  teacherId: string
  teacherName: string
  media: ClassMomentMedia[]
  recipientStudentIds: string[]
  recipientGuardianIds: string[]
  recipientSummary: string
  likedByGuardianIds: string[]
  seenByGuardianIds: string[]
  comments: ClassMomentComment[]
}

export interface AcademicCalendarEvent {
  id: string
  title: string
  dateIso: string
  endDateIso?: string
  category: 'holiday' | 'exam' | 'ptm' | 'event' | 'trip' | 'deadline'
  targetUnit: string
  description: string
  isSchoolClosed?: boolean
  createdBy: string
  createdAt: string
}

export interface PtmSlotItem {
  id: string
  teacherId: string
  teacherName: string
  teacherSubject: string
  dateIso: string
  startTime: string
  endTime: string
  mode: 'In-Person (Unit - 1)' | 'In-Person (Unit - 2)' | 'Video Call'
  roomOrLink: string
  status: 'open' | 'booked' | 'completed' | 'cancelled'
  studentId?: string
  studentName?: string
  classLabel?: string
  guardianId?: string
  guardianName?: string
  topic?: string
  outcomeNotes?: string
  bookedAt?: string
  completedAt?: string
}

export interface EarlyYearsCareLog {
  id: string
  studentId: string
  studentName: string
  classLabel: string
  dateIso: string
  mealStatus: 'Finished All' | 'Ate Most' | 'Ate Little' | 'Refused'
  mood: 'Happy & Active' | 'Calm & Focused' | 'Tired / Quiet' | 'Needs Extra Care'
  napOrActivity: string
  hygieneOrHealth: string
  teacherNote: string
  loggedBy: string
  loggedById?: string
  loggedAt: string
  guardianAcknowledged?: boolean
  guardianAcknowledgedAt?: string
  guardianReply?: string
}

export interface ClassFeeScheduleItem {
  className: string
  monthlyTuition: number
  activityFee: number
}

export interface ChatMessage {
  id: string
  sender: string
  senderRole: Role
  text: string
  time: string
  attachmentName?: string
  attachmentUrl?: string
}

export interface ChatThread {
  id: string
  participantName: string
  participantRole: string
  initials: string
  studentContext?: string
  studentId?: string
  guardianId?: string
  teacherId?: string
  unread: number
  messages: ChatMessage[]
}

export interface NotificationItem {
  id: string
  title: string
  text: string
  time: string
  type: 'attendance' | 'result' | 'feedback' | 'fee' | 'notice' | 'health' | 'pickup' | 'merit'
  forRoles: Role[]
  read: boolean
}

export type HouseName = 'Emerald' | 'Sapphire' | 'Crimson' | 'Gold'

export interface PickupContact {
  id: string
  studentId: string
  name: string
  relation: string
  phone: string
  idNumber: string
  verified: boolean
}

export interface DismissalLogItem {
  id: string
  studentId: string
  studentName: string
  pickedUpBy: string
  time: string
  gate: string
  verifiedBy: string
}

export interface MedicalLogItem {
  id: string
  studentId: string
  studentName: string
  date: string
  symptom: string
  actionTaken: string
  severity: 'routine' | 'attention' | 'urgent'
  loggedBy: string
  guardianNotified: boolean
}

export interface PastoralFollowUpNote {
  id: string
  authorName: string
  authorRole: Role
  note: string
  createdAt: string
}

export interface MeritLogItem {
  id: string
  studentId: string
  studentName: string
  classLabel?: string
  house: HouseName
  points: number
  type: 'merit' | 'pastoral'
  category?: 'Academic' | 'Sports' | 'Leadership' | 'Community' | 'Conduct'
  tier?: 'Level 1 Reminder' | 'Level 2 Counselor' | 'Level 3 Principal'
  pastoralStatus?: 'open' | 'follow_up' | 'resolved'
  actionPlan?: string
  followUpNotes?: PastoralFollowUpNote[]
  guardianAcknowledged?: boolean
  guardianAcknowledgedBy?: string
  guardianAcknowledgedAt?: string
  guardianReply?: string
  reason: string
  awardedBy: string
  awardedById?: string
  date: string
  dateIso?: string
}

export interface StudentAchievementItem {
  id: string
  studentId: string
  studentName: string
  house: HouseName
  title: string
  detail: string
  category: 'Science & STEM' | 'Debate & Arts' | 'Sports' | 'Community Service' | 'Academic Honor'
  awardedBy: string
  date: string
  dateIso: string
}

export interface ConsentFormItem {
  id: string
  campaignId?: string
  targetLabel?: string
  studentId: string
  studentName?: string
  classLabel?: string
  title: string
  eventDate: string
  deadlineDate?: string
  venue?: string
  feeAmount?: number
  category:
    | 'Field Trip'
    | 'Science & Lab'
    | 'Sports & CCA'
    | 'Medical & Health'
    | 'Media & Photo Release'
  details: string
  createdBy?: string
  createdByRole?: Role
  createdAt?: string
  status?: 'pending' | 'approved' | 'declined'
  signed: boolean
  signedBy?: string
  signedAt?: string
  declineReason?: string
  emergencyPhone?: string
  medicalNote?: string
  guardianComment?: string
  verification?: BiometricVerificationStamp
}

export interface CanteenTransaction {
  id: string
  studentId: string
  item: string
  amount: number
  time: string
  calories: string
}

export interface CanteenWallet {
  studentId: string
  balance: number
  dailyLimit: number
  allergyGuard: string
}

export interface PastPaperItem {
  id: string
  subject: string
  board: 'Cambridge IGCSE' | 'Edexcel IAL' | 'Cambridge Checkpoint' | 'DMHA Term Practice'
  year: string
  paperCode: string
  title: string
  hasMarkScheme: boolean
  summary?: string
  fileUrl?: string
  fileName?: string
  uploadedBy?: string
}

export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
  points: number
  explanation: string
}

export interface OnlineQuiz {
  id: string
  title: string
  subject: string
  className: string
  teacherName: string
  durationMins: number
  passPercentage: number
  dueDate: string
  status: 'published' | 'closed'
  createdAt: string
  questions: QuizQuestion[]
}

export interface QuizAttempt {
  id: string
  quizId: string
  studentId: string
  studentName: string
  answers: number[]
  score: number
  totalMarks: number
  percentage: number
  passed: boolean
  timeTakenSec: number
  submittedAt: string
  gradebookSynced?: boolean
  syncedSubject?: string
  syncedGrade?: string
  syncedAverageScore?: number
  syncedGpa?: string
  syncedRank?: string
  xpAwarded?: number
}

export type AdmissionStage =
  | 'applied'
  | 'test_scheduled'
  | 'interview'
  | 'approved'
  | 'enrolled'
  | 'waitlisted'

export interface AdmissionApplication {
  id: string
  applicationCode: string
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
  stage: AdmissionStage
  appliedAt: string
  testDate?: string
  testScore?: number
  admissionFeeAmount: number
  admissionFeePaid: boolean
  notes: string
  enrolledStudentId?: string
  enrolledStudentLogin?: string
  enrolledGuardianLogin?: string
  admissionVoucherNo?: string
}

export interface QRScanLog {
  id: string
  cardCode: string
  holderId: string
  holderName: string
  holderRole: 'student' | 'teacher'
  checkpoint:
    | 'Main Gate Check-In'
    | 'Main Gate Check-Out'
    | 'Canteen Checkout'
    | 'Library Desk'
    | 'Bus Boarding'
  status: 'verified' | 'flagged'
  details?: string
  scannedAt: string
}

export interface AuthUserSession {
  id: string
  role: Role
  displayName: string
  email: string
  loginCode: string
  linkedEntityId: string
}

export interface AuthAccountSummary {
  id: string
  email: string
  loginCode: string
  role: Role
  displayName: string
  linkedEntityId: string
  status: 'active' | 'suspended'
  createdAt: string
  lastLoginAt: string | null
}

export interface DbSyncStats {
  engine: string
  dbFile: string
  sizeKb: number
  usersCount: number
  sessionsCount: number
  quizzesCount: number
  quizAttemptsCount: number
  admissionsCount: number
  qrScansCount: number
  paymentsCount?: number
  auditLogsCount?: number
  stateVersion: number
  lastUpdatedAt: string | null
}

export interface LibraryBook {
  id: string
  isbn: string
  title: string
  author: string
  subject: string
  shelf: string
  category?: string
  totalCopies?: number
  availableCopies?: number
  finePerDay?: number
  status: 'available' | 'issued'
  issuedToStudentId?: string
  issuedToName?: string
  issuedAt?: string
  dueDate?: string
  overdueDays?: number
  reservedByStudentId?: string
  reservedByName?: string
}

export interface LibraryCirculationLog {
  id: string
  bookId: string
  bookTitle: string
  isbn: string
  studentId: string
  studentName: string
  action: 'issued' | 'returned' | 'reserved' | 'fine_posted'
  dateIso: string
  dueDate?: string
  fineAmount?: number
  actor: string
}

export interface StudyResourceItem {
  id: string
  subject: string
  className: string
  title: string
  type: 'PDF Notes' | 'Video Lesson' | 'Revision Sheet'
  teacherName: string
  summary: string
  durationOrPages: string
  uploadedAt: string
  downloads: number
}

export interface CourseMaterialAttachment {
  id: string
  name: string
  kind: 'slides' | 'pdf' | 'image' | 'doc' | 'link'
  url: string
  sizeLabel?: string
}

export interface SemesterSyllabusConfig {
  termName: string
  totalWeeks: number
  updatedAt?: string
}

export interface CourseMaterialItem {
  id: string
  termName: string
  weekNumber: number
  weekLabel: string
  dayOfWeek: SchoolWeekday
  lessonDate: string
  periodTime?: string
  classSection: string
  subject: string
  teacherId: string
  teacherName: string
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
  downloads: number
  revisedByStudentIds: string[]
  createdAt: string
  updatedAt: string
}

export interface TeacherLeaveSubItem {
  id: string
  teacherId: string
  teacherName: string
  subject: string
  date: string
  dateIso?: string
  day?: SchoolWeekday
  period?: number
  room?: string
  periodSlot: string
  classSection: string
  reason: string
  status: 'pending' | 'substituted' | 'declined'
  preferredSubstituteId?: string
  preferredSubstituteName?: string
  substituteTeacherId?: string
  substituteTeacherName?: string
  leaveType?: 'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Official / Training'
  attachmentName?: string
  attachmentUrl?: string
  decidedBy?: string
  requestedAt: string
}

export interface ParentAlertLogItem {
  id: string
  channel: 'WhatsApp' | 'SMS'
  category: 'Absence Alert' | 'Fee Reminder' | 'Leaderboard' | 'Bus / Emergency'
  recipientName: string
  recipientPhone: string
  studentName: string
  message: string
  sentBy: string
  sentAt: string
  status: 'delivered' | 'queued'
}

export interface CampusWifiConfig {
  ssidLabel: string
  allowedIps: string[]
  strictWifiOnly: boolean
  lateCutoffTime: string
}

export interface TeacherAttendanceLog {
  id: string
  teacherId: string
  teacherName: string
  date: string
  checkInTime: string | null
  checkOutTime: string | null
  status: 'checked_in' | 'checked_out' | 'late' | 'absent'
  verifiedIp: string
  wifiNetwork: string
  biometricVerified: boolean
  hoursWorked?: string
}

export interface TeacherSalaryRecord {
  id: string
  teacherId: string
  teacherName: string
  subject: string
  month: string
  baseSalary: number
  bonusAllowance: number
  lateDeduction: number
  netSalary: number
  status: 'paid' | 'pending'
  paidAt?: string
  bankRef?: string
}

export type ReimbursementCategory =
  | 'Classroom Supplies'
  | 'Science Lab Consumables'
  | 'Exam Printing & Copies'
  | 'Field Trip & Transport'
  | 'Training & Workshop'
  | 'Teaching Aids & Books'

export interface TeacherReimbursementItem {
  id: string
  teacherId: string
  teacherName: string
  category: ReimbursementCategory
  title: string
  amount: number
  expenseDate: string
  receiptRef: string
  receiptUrl?: string
  notes?: string
  status: 'pending' | 'approved' | 'paid' | 'declined'
  adminNote?: string
  submittedAt: string
  paidAt?: string
}

export interface TeacherSalaryAdvanceItem {
  id: string
  teacherId: string
  teacherName: string
  amount: number
  repaymentMonths: number
  monthlyInstallment: number
  paidInstallments: number
  reason: string
  requestDate: string
  status: 'pending' | 'approved' | 'disbursed' | 'repaid' | 'declined'
  adminNote?: string
  disbursedAt?: string
}

export type AllowanceDutyType =
  | 'Exam Invigilation Duty'
  | 'Extra / Substitution Class'
  | 'After-School Coaching / Club'
  | 'Exam Paper Moderation'
  | 'Campus Event / Sports Duty'

export interface TeacherAllowanceClaimItem {
  id: string
  teacherId: string
  teacherName: string
  dutyType: AllowanceDutyType
  dutyDate: string
  hoursOrSessions: string
  amount: number
  notes: string
  status: 'pending' | 'approved' | 'paid' | 'declined'
  adminNote?: string
  submittedAt: string
  paidAt?: string
}

export interface TeacherPayoutProfile {
  teacherId: string
  teacherName: string
  bankName: string
  accountTitle: string
  accountNumber: string
  routingNumber: string
  mfsProvider: 'bKash' | 'Nagad' | 'Rocket' | 'None'
  mfsNumber: string
  preferredMethod: 'Bank Transfer' | 'MFS (bKash/Nagad)'
  tinNumber: string
  pfEmployeePercent: number
  pfSchoolMatchPercent: number
  pfAccumulatedBdt: number
  updatedAt: string
}

export interface TeacherTrainingItem {
  id: string
  title: string
  category: 'Cambridge Curriculum' | 'Smart EdTech' | 'Safeguarding & First Aid' | 'Leadership'
  assignedTeacherIds: string[]
  completedTeacherIds: string[]
  dueDate: string
  mode: 'On-Campus Workshop' | 'Online Module' | 'External Seminar'
  mandatory: boolean
  assignedBy: string
  description: string
}

export type SchoolWeekday = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu'

export interface TimetableSlot {
  id: string
  day: SchoolWeekday
  period: number
  timeLabel: string
  className: string
  subject: string
  teacherId: string
  teacherName: string
  room: string
  isSubstitute?: boolean
  substituteDate?: string
  originalTeacherId?: string
  originalTeacherName?: string
  leaveRequestId?: string
}

export interface ExamScheduleEntry {
  id: string
  examName: string
  className: string
  subject: string
  date: string
  timeSlot: string
  room: string
  invigilatorId: string
  invigilatorName: string
}

export interface AlumniRecord {
  id: string
  studentName: string
  graduatedClass: string
  roll: string
  graduationYear: string
  finalAverage: number
  guardianName: string
  archivedAt: string
}

export interface IssuedDocumentLog {
  id: string
  verifyCode: string
  docType:
    | 'Report Card'
    | 'Admit Card'
    | 'Transfer Certificate'
    | 'Bonafide Certificate'
    | 'Character Certificate'
  studentId: string
  studentName: string
  className: string
  issuedBy: string
  issuedAt: string
}

export interface StudyQuestProfile {
  studentId: string
  xp: number
  streakDays: number
  completedMissionIds: string[]
  clearedBossIds: string[]
  focusMinutesLogged: number
  unlockedBadges: string[]
  guardianCheers: number
  lastStudyDate: string
}

// ==================== CLIENT ERP ADMIN MODULES ====================

export interface HelpDeskTicket {
  id: string
  ticketNo: string
  subject: string
  category: 'Billing & Fees' | 'IT & Portal' | 'Transport & Gate' | 'Academics' | 'Campus Facility'
  priority: 'Low' | 'Normal' | 'High' | 'Urgent'
  status: 'open' | 'in_progress' | 'resolved'
  requesterName: string
  requesterRole: Role | 'parent'
  requesterUserId?: string
  description: string
  assignedTo?: string
  adminReply?: string
  createdAt: string
  updatedAt: string
}

export interface CampusTaskSubtask {
  id: string
  title: string
  done: boolean
}

export interface CampusTaskComment {
  id: string
  sender: string
  senderRole: Role
  text: string
  time: string
  attachmentName?: string
  attachmentUrl?: string
}

export interface CampusTaskItem {
  id: string
  title: string
  department: 'Administration' | 'Academics' | 'Accounts' | 'Operations' | 'IT & Media'
  categoryTag?: string
  assigneeName: string
  assigneeId?: string
  assigneeRole?: 'teacher' | 'staff' | 'admin'
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  dueDate: string
  status: 'todo' | 'in_progress' | 'in_review' | 'completed'
  notes?: string
  subtasks?: CampusTaskSubtask[]
  comments?: CampusTaskComment[]
  attachmentName?: string
  attachmentUrl?: string
  createdBy: string
  createdAt: string
  updatedAt?: string
  completedAt?: string
}

export interface EmployeeDutyShift {
  id: string
  employeeName: string
  employeeRole: string
  dutyType:
    | 'Morning Gate Duty'
    | 'Assembly Supervision'
    | 'Break & Corridor Patrol'
    | 'Exam Hall Invigilation'
    | 'Dismissal & Bus Escort'
    | 'Reception & Help Desk'
  campusUnit: string
  dateIso: string
  shiftTime: string
  status: 'scheduled' | 'on_duty' | 'completed' | 'absent'
  notes?: string
}

export interface RfidDeviceRecord {
  id: string
  name: string
  model: string
  campusUnit: string
  location: string
  ipAddress: string
  mode: 'Fingerprint + RFID' | 'RFID Card Gate' | 'Face + Fingerprint'
  status: 'online' | 'offline'
  lastSyncAt: string
  totalPunchesToday: number
}

export interface RfidPunchLog {
  id: string
  deviceId: string
  deviceName: string
  personType: 'student' | 'teacher' | 'staff'
  personId: string
  personName: string
  cardUid: string
  method: 'Fingerprint' | 'RFID Card' | 'Face ID'
  direction: 'IN' | 'OUT'
  punchedAt: string
  dateIso: string
  syncedToAttendance: boolean
}

export interface StudentFineRecord {
  id: string
  studentId: string
  studentName: string
  classLabel: string
  category:
    | 'Late Tuition Fee'
    | 'Library Book Overdue'
    | 'Unexcused Absence'
    | 'Uniform / ID Violation'
    | 'Lab / Property Damage'
  amount: number
  reason: string
  status: 'unpaid' | 'invoiced' | 'paid' | 'waived'
  issuedBy: string
  issuedAt: string
  waivedReason?: string
  linkedInvoiceId?: string
}

export interface LiveMeetingItem {
  id: string
  title: string
  hostName: string
  audience: 'All Faculty' | 'All Guardians' | 'Class 6A' | 'Class 5B' | 'Class 4A' | 'Admin & Staff'
  platform: 'Google Meet' | 'Zoom' | 'Jitsi Meet (Instant)'
  roomUrl: string
  dateIso: string
  startTime: string
  durationMin: number
  status: 'scheduled' | 'live' | 'ended'
  recordingUrl?: string
  attendeeCount: number
}

export interface StockItemRecord {
  id: string
  sku: string
  name: string
  category: 'Uniforms' | 'Books & Stationery' | 'Science Lab' | 'IT & AV Equipment' | 'Furniture' | 'Cleaning & First Aid'
  campusUnit: string
  quantity: number
  unitLabel: string
  minThreshold: number
  unitCostBdt: number
  lastUpdated: string
}

export interface StockMovementLog {
  id: string
  itemId: string
  itemName: string
  type: 'IN' | 'OUT'
  quantity: number
  party: string
  note: string
  recordedBy: string
  recordedAt: string
}

export interface QuestionBankItem {
  id: string
  className: string
  subject: string
  chapter: string
  type: 'MCQ' | 'Short Answer' | 'Structured / Creative'
  difficulty: 'Easy' | 'Medium' | 'Hard'
  marks: number
  prompt: string
  options?: string[]
  correctAnswer: string
  createdBy: string
  createdAt: string
}

export interface JobVacancyItem {
  id: string
  title: string
  department: string
  campusUnit: string
  employmentType: 'Full-Time' | 'Part-Time' | 'Contract'
  salaryRange: string
  deadlineIso: string
  status: 'open' | 'closed'
  requirements: string
}

export interface JobApplicationRecord {
  id: string
  vacancyId: string
  vacancyTitle: string
  applicantName: string
  email: string
  phone: string
  qualification: string
  experienceYears: string
  expectedSalary: string
  coverNote: string
  stage: 'applied' | 'shortlisted' | 'demo_class' | 'hired' | 'rejected'
  appliedAt: string
  adminNotes?: string
}

export interface SchoolWebsiteConfig {
  schoolName: string
  heroHeadline: string
  heroSubheadline: string
  announcementTicker: string
  admissionsBannerActive: boolean
  admissionsBannerText: string
  principalName: string
  principalMessage: string
  hotlinePhone: string
  contactEmail: string
  campusAddress: string
  accentTheme: 'emerald' | 'indigo' | 'amber' | 'rose'
  updatedAt: string
  updatedBy: string
}

// ==================== DOUBLE-ENTRY ACCOUNTING ENGINE ====================

export type AccountingHead =
  | 'Fixed Asset'
  | 'Current Asset'
  | 'Current Liability'
  | 'Long Term Liability'
  | 'Income'
  | 'Expense'
  | 'Equity (Funds)'

export interface AccountGroupItem {
  id: string
  head: AccountingHead
  name: string
  active: boolean
}

export interface AccountSubGroupItem {
  id: string
  head: AccountingHead
  groupId: string
  name: string
  active: boolean
}

export interface AccountLedgerItem {
  id: string
  code: string
  head: AccountingHead
  groupId: string
  subGroupId: string
  name: string
  openingBalance: number
  isBank?: boolean
  isParty?: boolean
  isCash?: boolean
  bankId?: string
  active: boolean
}

export interface SchoolBankRecord {
  id: string
  name: string
  branch: string
  accountNumber: string
  contactNo: string
  email?: string
  address?: string
  openingBalance: number
  ledgerId: string
  active: boolean
}

export interface AccountingPartyRecord {
  id: string
  name: string
  partyType: 'Vendor / Supplier' | 'Contractor' | 'Publisher / Books' | 'Landlord / Utility' | 'Donor / Sponsor'
  contactNo: string
  email?: string
  address?: string
  openingBalance: number
  active: boolean
}

export interface ChequeRegisterItem {
  id: string
  chequeSerial: string
  bankId: string
  bankName: string
  accountNumber: string
  chequeNumber: string
  issueDate: string
  payeeName: string
  amount: number
  status: 'Active' | 'Cleared' | 'Bounced' | 'Cancelled'
  active: boolean
  notes?: string
  linkedVoucherId?: string
}

export interface PettyCashFundEntry {
  id: string
  dateIso: string
  amount: number
  sourceLedgerId: string
  sourceLedgerName: string
  reference: string
  addedBy: string
}

export interface PettyCashRequisition {
  id: string
  reqNo: string
  applicantName: string
  department: string
  purpose: string
  amount: number
  dateIso: string
  priority: 'Low' | 'Normal' | 'High' | 'Urgent'
  status: 'pending' | 'approved' | 'rejected'
  remarks?: string
  decidedBy?: string
  decidedAt?: string
  linkedVoucherId?: string
}

export type VoucherType = 'credit' | 'debit' | 'journal' | 'contra'

export interface VoucherEntryLine {
  id: string
  ledgerId: string
  ledgerCode: string
  ledgerName: string
  debit: number
  credit: number
  note?: string
}

export interface AccountingVoucher {
  id: string
  voucherNo: string
  type: VoucherType
  transactionFor: 'Fee' | 'Salary' | 'Expense' | 'Transfer' | 'Adjustment' | 'Others'
  dateIso: string
  accountLabel: string
  partyOrReceiver: string
  paymentMode?: 'Cash' | 'Bank' | 'Cheque' | 'bKash / Nagad' | 'Non-Cash'
  referenceNo?: string
  narration: string
  totalAmount: number
  lines: VoucherEntryLine[]
  createdBy: string
  createdAt: string
}

export interface AccountingBookState {
  groups: AccountGroupItem[]
  subGroups: AccountSubGroupItem[]
  ledgers: AccountLedgerItem[]
  banks: SchoolBankRecord[]
  parties: AccountingPartyRecord[]
  cheques: ChequeRegisterItem[]
  pettyCashFunds: PettyCashFundEntry[]
  pettyCashRequisitions: PettyCashRequisition[]
  vouchers: AccountingVoucher[]
}

// ==================== PAYROLL MANAGEMENT SUITE ====================

export interface PayrollEmployeeProfile {
  id: string
  employeeCode: string
  name: string
  employeeType: 'teacher' | 'staff'
  designation: string
  department: string
  phone?: string
  email?: string
  baseSalary: number
  bankAccountLabel?: string
  active: boolean
}

export interface PayrollAdjustmentItem {
  id: string
  employeeId: string
  kind: 'allowance' | 'bonus' | 'deduction'
  title: string
  amount: number
  month: string // 'Recurring' or e.g. 'November 2026'
  notes?: string
  active: boolean
}

export interface PayrollAttendanceMonthRecord {
  id: string
  employeeId: string
  month: string
  presentDays: number
  lateDays: number
  absentDays: number
  paidLeaveDays: number
  overtimeHours: number
}

export interface PayrollDisbursementRecord {
  id: string
  slipNo: string
  month: string
  employeeId: string
  employeeName: string
  employeeType: 'teacher' | 'staff'
  designation: string
  baseSalary: number
  totalAllowances: number
  totalBonuses: number
  totalDeductions: number
  attendancePenalty: number
  netPayable: number
  paymentLedgerId: string
  paymentLedgerName: string
  linkedVoucherNo?: string
  paidAt: string
  paidBy: string
  status: 'paid'
}

export interface PayrollGlobalSettings {
  workingDaysPerMonth: number
  latesPerAbsentDay: number
  defaultPfPercent: number
  defaultFestivalBonusPercent: number
  defaultPaymentLedgerId: string
  autoPostAccountingVoucher: boolean
}

export interface PayrollBookState {
  employees: PayrollEmployeeProfile[]
  adjustments: PayrollAdjustmentItem[]
  attendance: PayrollAttendanceMonthRecord[]
  disbursements: PayrollDisbursementRecord[]
  settings: PayrollGlobalSettings
}

// ==================== FULL EXAMINATION MANAGEMENT SUITE ====================

export type ExamLifecycleStatus = 'draft' | 'declared' | 'marks_locked' | 'published'

export interface DeclaredExamItem {
  id: string
  code: string
  title: string
  termName: string
  academicYear: string
  targetClasses: string[]
  startDateIso: string
  endDateIso: string
  status: ExamLifecycleStatus
  maxWritten: number
  maxMcq: number
  maxPractical: number
  passPercent: number
  instructions?: string
  declaredBy: string
  declaredAt: string
}

export interface ExamAttendanceRecord {
  id: string
  examId: string
  classLabel: string
  subject: string
  dateIso: string
  studentId: string
  studentName: string
  roll: string
  status: 'present' | 'absent' | 'late' | 'expelled'
  seatLabel?: string
  markedBy: string
  markedAt: string
}

export interface ExamMarkEntryRecord {
  id: string
  examId: string
  classLabel: string
  subject: string
  studentId: string
  studentName: string
  roll: string
  written: number
  mcq: number
  practical: number
  total: number
  maxTotal: number
  percentage: number
  grade: string
  gpa: number
  passed: boolean
  remarks?: string
  submittedBy: string
  submittedRole: Role
  verifiedByAdmin?: boolean
  updatedAt: string
}

export interface ExamRoomConfig {
  id: string
  roomName: string
  campusUnit: string
  rows: number
  benchesPerRow: number
  seatsPerBench: number
  capacity: number
}

export interface ExamSeatAllocation {
  id: string
  examId: string
  roomId: string
  roomName: string
  campusUnit: string
  benchLabel: string
  seatNo: number
  studentId: string
  studentName: string
  classLabel: string
  roll: string
}

export interface ExamCommitteeMember {
  id: string
  examId: string
  memberName: string
  memberId?: string
  designation: string
  committeeRole:
    | 'Chief Controller'
    | 'Exam Secretary'
    | 'Question Moderation Lead'
    | 'Tabulation & Result Verification'
    | 'Hall Discipline Officer'
  campusUnit: string
}

export interface ExamInvigilatorAssignment {
  id: string
  examId: string
  dateIso: string
  shiftLabel: string
  roomId: string
  roomName: string
  subject: string
  teacherId: string
  teacherName: string
  dutyRole: 'Chief Invigilator' | 'Assistant Invigilator' | 'Reliever'
  status: 'assigned' | 'on_duty' | 'completed'
}

export interface QuestionPaperDispatch {
  id: string
  packetCode: string
  examId: string
  classLabel: string
  subject: string
  dateIso: string
  roomName: string
  copiesPrinted: number
  sealedBy: string
  handedTo: string
  dispatchedAt: string
  status: 'printed' | 'sealed' | 'dispatched' | 'opened_in_hall'
}

export interface AnswerScriptDispatch {
  id: string
  bundleCode: string
  examId: string
  classLabel: string
  subject: string
  scriptsCollected: number
  examinerId: string
  examinerName: string
  handoverDateIso: string
  deadlineIso: string
  scriptsChecked: number
  status: 'collected' | 'assigned_to_examiner' | 'checking' | 'returned_verified'
}

export interface ExamGradeRule {
  grade: string
  minPercent: number
  maxPercent: number
  gpa: number
  remark: string
}

export interface ExamGlobalSettings {
  gradingScale: ExamGradeRule[]
  defaultMaxWritten: number
  defaultMaxMcq: number
  defaultMaxPractical: number
  passPercent: number
  requireFeeClearanceForAdmit: boolean
  mixedClassSeatInterleaving: boolean
  admitCardInstructions: string
}

export interface ExamBookState {
  declaredExams: DeclaredExamItem[]
  examAttendance: ExamAttendanceRecord[]
  examMarks: ExamMarkEntryRecord[]
  examRooms: ExamRoomConfig[]
  seatAllocations: ExamSeatAllocation[]
  committee: ExamCommitteeMember[]
  invigilators: ExamInvigilatorAssignment[]
  questionPapers: QuestionPaperDispatch[]
  answerScripts: AnswerScriptDispatch[]
  settings: ExamGlobalSettings
}

// ==================== TRANSPORT & SCHOOL BUS MANAGEMENT ====================

export interface BusRouteRecord {
  id: string
  routeCode: string
  routeName: string
  driverName: string
  driverPhone: string
  attendantName: string
  vehicleNo: string
  capacity: number
  monthlyFee: number
  morningStart: string
  afternoonStart: string
  stops: string[]
  active: boolean
}

export interface BusBoardingLog {
  id: string
  routeId: string
  routeName: string
  studentId: string
  studentName: string
  classLabel: string
  direction: 'Morning Pickup' | 'Afternoon Drop-Off'
  stopName: string
  timestamp: string
  status: 'boarded' | 'dropped' | 'absent'
  recordedBy: string
}

export interface TransportBookState {
  routes: BusRouteRecord[]
  boardingLogs: BusBoardingLog[]
}
