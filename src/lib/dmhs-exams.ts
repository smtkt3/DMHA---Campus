import type {
  ExamBookState,
  ExamGradeRule,
  ExamMarkEntryRecord,
} from '@/components/school/types'

export const DEFAULT_DMHS_GRADING_SCALE: ExamGradeRule[] = [
  { grade: 'A+', minPercent: 80, maxPercent: 100, gpa: 5.0, remark: 'Outstanding' },
  { grade: 'A', minPercent: 70, maxPercent: 79, gpa: 4.0, remark: 'Excellent' },
  { grade: 'A-', minPercent: 60, maxPercent: 69, gpa: 3.5, remark: 'Very Good' },
  { grade: 'B', minPercent: 50, maxPercent: 59, gpa: 3.0, remark: 'Good' },
  { grade: 'C', minPercent: 40, maxPercent: 49, gpa: 2.0, remark: 'Satisfactory' },
  { grade: 'D', minPercent: 33, maxPercent: 39, gpa: 1.0, remark: 'Pass' },
  { grade: 'F', minPercent: 0, maxPercent: 32, gpa: 0.0, remark: 'Needs Improvement' },
]

export function evaluateGrade(
  percentage: number,
  scale: ExamGradeRule[] = DEFAULT_DMHS_GRADING_SCALE,
  passPercent = 33,
): { grade: string; gpa: number; passed: boolean; remark: string } {
  const pct = Math.max(0, Math.min(100, Math.round(percentage)))
  const ordered = [...scale].sort((a, b) => b.minPercent - a.minPercent)
  const matched =
    ordered.find((r) => pct >= r.minPercent && pct <= r.maxPercent) ||
    ordered[ordered.length - 1]
  const passed = pct >= passPercent && matched.grade !== 'F'
  return {
    grade: passed ? matched.grade : 'F',
    gpa: passed ? matched.gpa : 0,
    passed,
    remark: matched.remark,
  }
}

export const initialExamBook: ExamBookState = {
  declaredExams: [
    {
      id: 'exm-winter-2026',
      code: 'EXM-2026-WIN',
      title: 'Winter Term Final Assessment 2026',
      termName: 'Winter Term 2026',
      academicYear: '2026',
      targetClasses: ['Class 6 · Section A', 'Class 5 · Section B', 'Class 4 · Section A', 'Class 3 · Section A'],
      startDateIso: '2026-12-06',
      endDateIso: '2026-12-15',
      status: 'declared',
      maxWritten: 70,
      maxMcq: 20,
      maxPractical: 10,
      passPercent: 33,
      instructions:
        'Report to your assigned Exam Hall 20 minutes before start time with your printed DMHA Admit Card and Campus QR ID.',
      declaredBy: 'Shahid (Principal)',
      declaredAt: '2026-11-18',
    },
    {
      id: 'exm-ct2-2026',
      code: 'EXM-2026-CT2',
      title: 'Class Test 2 — November Evaluation',
      termName: 'Winter Term 2026',
      academicYear: '2026',
      targetClasses: ['Class 6 · Section A', 'Class 5 · Section B'],
      startDateIso: '2026-11-12',
      endDateIso: '2026-11-16',
      status: 'published',
      maxWritten: 30,
      maxMcq: 15,
      maxPractical: 5,
      passPercent: 33,
      instructions: '45-minute in-class written + MCQ evaluation.',
      declaredBy: 'Shahid (Principal)',
      declaredAt: '2026-11-05',
    },
  ],
  examAttendance: [
    {
      id: 'eatt-1',
      examId: 'exm-winter-2026',
      classLabel: 'Class 6 · Section A',
      subject: 'Physics',
      dateIso: '2026-12-06',
      studentId: 'stu-araf',
      studentName: 'Araf Rahman',
      roll: '14',
      status: 'present',
      seatLabel: 'Room 301 · B1-S1',
      markedBy: 'Nadia Rahman',
      markedAt: '2026-11-24',
    },
    {
      id: 'eatt-2',
      examId: 'exm-winter-2026',
      classLabel: 'Class 6 · Section A',
      subject: 'Physics',
      dateIso: '2026-12-06',
      studentId: 'stu-nusrat',
      studentName: 'Nusrat Jahan',
      roll: '01',
      status: 'present',
      seatLabel: 'Room 301 · B2-S1',
      markedBy: 'Nadia Rahman',
      markedAt: '2026-11-24',
    },
    {
      id: 'eatt-3',
      examId: 'exm-winter-2026',
      classLabel: 'Class 6 · Section A',
      subject: 'Physics',
      dateIso: '2026-12-06',
      studentId: 'stu-tahmid',
      studentName: 'Tahmid Anwar',
      roll: '09',
      status: 'late',
      seatLabel: 'Room 301 · B3-S1',
      markedBy: 'Nadia Rahman',
      markedAt: '2026-11-24',
    },
  ],
  examMarks: [
    {
      id: 'emrk-1',
      examId: 'exm-winter-2026',
      classLabel: 'Class 6 · Section A',
      subject: 'Physics',
      studentId: 'stu-nusrat',
      studentName: 'Nusrat Jahan',
      roll: '01',
      written: 66,
      mcq: 19,
      practical: 10,
      total: 95,
      maxTotal: 100,
      percentage: 95,
      grade: 'A+',
      gpa: 5.0,
      passed: true,
      remarks: 'Top script — spotless circuit diagrams',
      submittedBy: 'Nadia Rahman',
      submittedRole: 'teacher',
      verifiedByAdmin: true,
      updatedAt: '2026-11-24',
    },
    {
      id: 'emrk-2',
      examId: 'exm-winter-2026',
      classLabel: 'Class 6 · Section A',
      subject: 'Physics',
      studentId: 'stu-araf',
      studentName: 'Araf Rahman',
      roll: '14',
      written: 61,
      mcq: 18,
      practical: 9,
      total: 88,
      maxTotal: 100,
      percentage: 88,
      grade: 'A+',
      gpa: 5.0,
      passed: true,
      remarks: 'Strong Ohm’s law derivation',
      submittedBy: 'Nadia Rahman',
      submittedRole: 'teacher',
      verifiedByAdmin: true,
      updatedAt: '2026-11-24',
    },
    {
      id: 'emrk-3',
      examId: 'exm-winter-2026',
      classLabel: 'Class 6 · Section A',
      subject: 'Physics',
      studentId: 'stu-tahmid',
      studentName: 'Tahmid Anwar',
      roll: '09',
      written: 48,
      mcq: 14,
      practical: 8,
      total: 70,
      maxTotal: 100,
      percentage: 70,
      grade: 'A',
      gpa: 4.0,
      passed: true,
      remarks: 'Good improvement in numericals',
      submittedBy: 'Nadia Rahman',
      submittedRole: 'teacher',
      verifiedByAdmin: false,
      updatedAt: '2026-11-24',
    },
    {
      id: 'emrk-4',
      examId: 'exm-winter-2026',
      classLabel: 'Class 5 · Section B',
      subject: 'Mathematics',
      studentId: 'stu-zara',
      studentName: 'Zara Rahman',
      roll: '04',
      written: 62,
      mcq: 18,
      practical: 9,
      total: 89,
      maxTotal: 100,
      percentage: 89,
      grade: 'A+',
      gpa: 5.0,
      passed: true,
      remarks: 'Excellent fractions & geometry accuracy',
      submittedBy: 'Sakib Ahmed',
      submittedRole: 'teacher',
      verifiedByAdmin: true,
      updatedAt: '2026-11-24',
    },
  ],
  examRooms: [
    { id: 'rm-301', roomName: 'Hall 301 (Main Wing)', campusUnit: 'Unit - 1', rows: 3, benchesPerRow: 3, seatsPerBench: 2, capacity: 18 },
    { id: 'rm-302', roomName: 'Hall 302 (Science Wing)', campusUnit: 'Unit - 1', rows: 3, benchesPerRow: 2, seatsPerBench: 2, capacity: 12 },
    { id: 'rm-201', roomName: 'Hall A (Early Years)', campusUnit: 'Unit - 2', rows: 2, benchesPerRow: 3, seatsPerBench: 2, capacity: 12 },
  ],
  seatAllocations: [
    { id: 'st-1', examId: 'exm-winter-2026', roomId: 'rm-301', roomName: 'Hall 301 (Main Wing)', campusUnit: 'Unit - 1', benchLabel: 'B1', seatNo: 1, studentId: 'stu-araf', studentName: 'Araf Rahman', classLabel: 'Class 6 · Section A', roll: '14' },
    { id: 'st-2', examId: 'exm-winter-2026', roomId: 'rm-301', roomName: 'Hall 301 (Main Wing)', campusUnit: 'Unit - 1', benchLabel: 'B1', seatNo: 2, studentId: 'stu-zara', studentName: 'Zara Rahman', classLabel: 'Class 5 · Section B', roll: '04' },
    { id: 'st-3', examId: 'exm-winter-2026', roomId: 'rm-301', roomName: 'Hall 301 (Main Wing)', campusUnit: 'Unit - 1', benchLabel: 'B2', seatNo: 1, studentId: 'stu-nusrat', studentName: 'Nusrat Jahan', classLabel: 'Class 6 · Section A', roll: '01' },
    { id: 'st-4', examId: 'exm-winter-2026', roomId: 'rm-301', roomName: 'Hall 301 (Main Wing)', campusUnit: 'Unit - 1', benchLabel: 'B2', seatNo: 2, studentId: 'stu-ayaan', studentName: 'Ayaan Chowdhury', classLabel: 'Class 4 · Section A', roll: '07' },
    { id: 'st-5', examId: 'exm-winter-2026', roomId: 'rm-301', roomName: 'Hall 301 (Main Wing)', campusUnit: 'Unit - 1', benchLabel: 'B3', seatNo: 1, studentId: 'stu-tahmid', studentName: 'Tahmid Anwar', classLabel: 'Class 6 · Section A', roll: '09' },
  ],
  committee: [
    { id: 'com-1', examId: 'exm-winter-2026', memberName: 'Shahid (Principal)', designation: 'Principal & Director', committeeRole: 'Chief Controller', campusUnit: 'Unit - 1 & Unit - 2' },
    { id: 'com-2', examId: 'exm-winter-2026', memberName: 'Nadia Rahman', memberId: 'tch-nadia', designation: 'Senior Teacher (Physics)', committeeRole: 'Exam Secretary', campusUnit: 'Unit - 1' },
    { id: 'com-3', examId: 'exm-winter-2026', memberName: 'Sakib Ahmed', memberId: 'tch-sakib', designation: 'Mathematics Coordinator', committeeRole: 'Tabulation & Result Verification', campusUnit: 'Unit - 1' },
    { id: 'com-4', examId: 'exm-winter-2026', memberName: 'Rasheda Begum', memberId: 'tch-rasheda', designation: 'Early Years Lead', committeeRole: 'Hall Discipline Officer', campusUnit: 'Unit - 2' },
  ],
  invigilators: [
    {
      id: 'inv-1',
      examId: 'exm-winter-2026',
      dateIso: '2026-12-06',
      shiftLabel: 'Morning (09:00 AM – 11:00 AM)',
      roomId: 'rm-301',
      roomName: 'Hall 301 (Main Wing)',
      subject: 'Physics & Elementary Math',
      teacherId: 'tch-nadia',
      teacherName: 'Nadia Rahman',
      dutyRole: 'Chief Invigilator',
      status: 'assigned',
    },
    {
      id: 'inv-2',
      examId: 'exm-winter-2026',
      dateIso: '2026-12-06',
      shiftLabel: 'Morning (09:00 AM – 11:00 AM)',
      roomId: 'rm-302',
      roomName: 'Hall 302 (Science Wing)',
      subject: 'General Science',
      teacherId: 'tch-farhana',
      teacherName: 'Farhana Karim',
      dutyRole: 'Chief Invigilator',
      status: 'assigned',
    },
  ],
  questionPapers: [
    {
      id: 'qp-1',
      packetCode: 'QP-WIN26-PHY-301',
      examId: 'exm-winter-2026',
      classLabel: 'Class 6 · Section A',
      subject: 'Physics',
      dateIso: '2026-12-06',
      roomName: 'Hall 301 (Main Wing)',
      copiesPrinted: 25,
      sealedBy: 'Shahid (Principal)',
      handedTo: 'Nadia Rahman (Chief Invigilator)',
      dispatchedAt: '2026-12-06 08:30 AM',
      status: 'sealed',
    },
    {
      id: 'qp-2',
      packetCode: 'QP-WIN26-MTH-301',
      examId: 'exm-winter-2026',
      classLabel: 'Class 5 · Section B',
      subject: 'Mathematics',
      dateIso: '2026-12-06',
      roomName: 'Hall 301 (Main Wing)',
      copiesPrinted: 20,
      sealedBy: 'Shahid (Principal)',
      handedTo: 'Sakib Ahmed',
      dispatchedAt: '2026-12-06 08:30 AM',
      status: 'printed',
    },
  ],
  answerScripts: [
    {
      id: 'as-1',
      bundleCode: 'ANS-WIN26-PHY-6A',
      examId: 'exm-winter-2026',
      classLabel: 'Class 6 · Section A',
      subject: 'Physics',
      scriptsCollected: 4,
      examinerId: 'tch-nadia',
      examinerName: 'Nadia Rahman',
      handoverDateIso: '2026-12-06',
      deadlineIso: '2026-12-10',
      scriptsChecked: 3,
      status: 'checking',
    },
    {
      id: 'as-2',
      bundleCode: 'ANS-WIN26-MTH-5B',
      examId: 'exm-winter-2026',
      classLabel: 'Class 5 · Section B',
      subject: 'Mathematics',
      scriptsCollected: 3,
      examinerId: 'tch-sakib',
      examinerName: 'Sakib Ahmed',
      handoverDateIso: '2026-12-06',
      deadlineIso: '2026-12-10',
      scriptsChecked: 3,
      status: 'returned_verified',
    },
  ],
  settings: {
    gradingScale: DEFAULT_DMHS_GRADING_SCALE,
    defaultMaxWritten: 70,
    defaultMaxMcq: 20,
    defaultMaxPractical: 10,
    passPercent: 33,
    requireFeeClearanceForAdmit: false,
    mixedClassSeatInterleaving: true,
    admitCardInstructions:
      '1. Bring printed Admit Card & DMHA QR ID Card daily. 2. Electronic devices are strictly prohibited inside exam halls. 3. Enter your assigned room 20 minutes before the bell.',
  },
}

export interface TabulationRow {
  studentId: string
  studentName: string
  roll: string
  classLabel: string
  subjectsCount: number
  totalObtained: number
  totalMax: number
  averagePercent: number
  gpa: number
  grade: string
  passed: boolean
  meritRank: number
  entries: ExamMarkEntryRecord[]
}

export function computeExamTabulation(
  book: ExamBookState,
  examId: string,
  classFilter = 'All',
  subjectFilter = 'All',
): {
  rows: TabulationRow[]
  passRate: number
  averagePercent: number
  highestPercent: number
} {
  const marks = book.examMarks.filter((m) => {
    if (m.examId !== examId) return false
    if (classFilter !== 'All' && m.classLabel !== classFilter) return false
    if (subjectFilter !== 'All' && m.subject !== subjectFilter) return false
    return true
  })

  const byStudent = new Map<string, ExamMarkEntryRecord[]>()
  for (const m of marks) {
    const arr = byStudent.get(m.studentId) || []
    arr.push(m)
    byStudent.set(m.studentId, arr)
  }

  const rawRows = Array.from(byStudent.values()).map((entries) => {
    const first = entries[0]
    const totalObtained = entries.reduce((s, e) => s + e.total, 0)
    const totalMax = entries.reduce((s, e) => s + e.maxTotal, 0)
    const averagePercent = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0
    const allPassed = entries.every((e) => e.passed)
    const avgGpa =
      entries.length > 0
        ? Math.round((entries.reduce((s, e) => s + e.gpa, 0) / entries.length) * 100) / 100
        : 0
    const graded = evaluateGrade(
      averagePercent,
      book.settings.gradingScale,
      book.settings.passPercent,
    )
    return {
      studentId: first.studentId,
      studentName: first.studentName,
      roll: first.roll,
      classLabel: first.classLabel,
      subjectsCount: entries.length,
      totalObtained,
      totalMax,
      averagePercent,
      gpa: allPassed ? avgGpa : 0,
      grade: allPassed ? graded.grade : 'F',
      passed: allPassed,
      meritRank: 0,
      entries,
    }
  })

  rawRows.sort((a, b) => b.totalObtained - a.totalObtained || b.gpa - a.gpa)
  const rows = rawRows.map((r, idx) => ({ ...r, meritRank: idx + 1 }))
  const passCount = rows.filter((r) => r.passed).length
  const passRate = rows.length > 0 ? Math.round((passCount / rows.length) * 100) : 0
  const averagePercent =
    rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.averagePercent, 0) / rows.length) : 0
  const highestPercent = rows.length > 0 ? Math.max(...rows.map((r) => r.averagePercent)) : 0

  return { rows, passRate, averagePercent, highestPercent }
}
