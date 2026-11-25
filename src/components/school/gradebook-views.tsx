'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { downloadExcelCsv } from '@/lib/csv-export'
import { createSampleExamSheetSvg } from './data'
import { Icon } from './icons'
import { useSchool } from './store'
import type { ExamSheetItem, StudentRecord } from './types'
import { PageShell, ReportCardModal } from './ui'

const ASSESSMENT_LABELS = [
  'Term Final 2026',
  'Midterm Assessment',
  'Monthly Class Test',
  'Practical & Lab Evaluation',
] as const

const DMHS_GRADEBOOK_SUBJECTS = [
  'Physics',
  'Mathematics',
  'Elementary Math',
  'Chemistry',
  'General Science',
  'English',
  'English Language',
  'Bangla',
  'ICT & Robotics',
  'Bangladesh & Global Studies',
  'Social Studies',
  'Islamic & Moral Studies',
] as const

function normalizeClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function studentInAssignedClasses(
  stu: Pick<StudentRecord, 'className' | 'section'>,
  assignedClasses: string[],
): boolean {
  if (!assignedClasses.length) return false
  const full = normalizeClassToken(`${stu.className} ${stu.section}`)
  const secLetter = stu.section.replace(/section/i, '').trim().toLowerCase()
  const compact = normalizeClassToken(`${stu.className}${secLetter}`)
  const gradeOnly = normalizeClassToken(stu.className)
  return assignedClasses.some((cls) => {
    const tok = normalizeClassToken(cls)
    return Boolean(tok) && (tok === full || tok === compact || tok === gradeOnly)
  })
}

function scoreToGrade(score: number): string {
  if (score >= 80) return 'A+'
  if (score >= 70) return 'A'
  if (score >= 60) return 'A-'
  if (score >= 50) return 'B'
  if (score >= 40) return 'C'
  return 'F'
}

function gradeBadgeClasses(grade: string): string {
  if (grade === 'A+') return 'bg-emerald-100 text-emerald-800'
  if (grade === 'A') return 'bg-sky-100 text-sky-800'
  if (grade === 'A-') return 'bg-indigo-100 text-indigo-800'
  if (grade === 'B') return 'bg-amber-100 text-amber-800'
  if (grade === 'C') return 'bg-orange-100 text-orange-800'
  return 'bg-rose-100 text-rose-800'
}

function parseCsvLines(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return clean
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells: string[] = []
      let cur = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            cur += '"'
            i++
          } else if (ch === '"') {
            inQuotes = false
          } else {
            cur += ch
          }
        } else if (ch === '"') {
          inQuotes = true
        } else if (ch === ',') {
          cells.push(cur.trim())
          cur = ''
        } else {
          cur += ch
        }
      }
      cells.push(cur.trim())
      return cells
    })
}

interface ParsedMarkRow {
  studentId: string
  studentName: string
  roll: string
  subjectName: string
  currentScore: number | null
  newScore: number
  progress?: number
}

export function GradebookView() {
  const {
    role,
    students,
    teachers,
    examSheets,
    activeTeacherId,
    publishGradebookBatch,
    addGradebookSubject,
    uploadGradebookExamSheet,
    notify,
  } = useSchool()

  const isTeacher = role === 'teacher'
  const activeTeacher = useMemo(
    () => teachers.find((t) => t.id === activeTeacherId) || teachers[0] || null,
    [teachers, activeTeacherId],
  )
  const assignedClasses = useMemo(() => activeTeacher?.assignedClasses || [], [activeTeacher])

  // Strictly scope visible & editable students by role
  const scopedStudents = useMemo(() => {
    if (!isTeacher) return students
    return students.filter((s) => studentInAssignedClasses(s, assignedClasses))
  }, [isTeacher, students, assignedClasses])

  const classSections = useMemo(
    () =>
      Array.from(new Set(scopedStudents.map((s) => `${s.className} · ${s.section}`))).sort(),
    [scopedStudents],
  )

  const [mode, setMode] = useState<'class_grid' | 'student_sheet' | 'csv_import'>('class_grid')
  const [selectedClassSection, setSelectedClassSection] = useState<string>(classSections[0] || '')
  const [assessmentLabel, setAssessmentLabel] = useState<string>(ASSESSMENT_LABELS[0])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (classSections.length > 0 && !classSections.includes(selectedClassSection)) {
      setSelectedClassSection(classSections[0])
    }
  }, [classSections, selectedClassSection])

  const classStudents = useMemo(() => {
    return scopedStudents
      .filter((s) => `${s.className} · ${s.section}` === selectedClassSection)
      .filter((s) => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.trim().toLowerCase()
        return s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q)
      })
      .sort((a, b) => Number(a.roll) - Number(b.roll))
  }, [scopedStudents, selectedClassSection, searchQuery])

  const classSubjects = useMemo(() => {
    const set = new Set<string>()
    scopedStudents
      .filter((s) => `${s.className} · ${s.section}` === selectedClassSection)
      .forEach((s) => s.subjects.forEach((sub) => set.add(sub.name)))
    return Array.from(set)
  }, [scopedStudents, selectedClassSection])

  const [selectedSubject, setSelectedSubject] = useState<string>(
    activeTeacher?.subject || classSubjects[0] || 'Physics',
  )

  const getSubjectOwnerInClass = (subjectName: string): string | null => {
    const peers = scopedStudents.filter(
      (s) => `${s.className} · ${s.section}` === selectedClassSection,
    )
    for (const peer of peers) {
      const match = peer.subjects.find(
        (sub) => sub.name.toLowerCase() === subjectName.toLowerCase(),
      )
      if (match?.teacher?.trim()) return match.teacher.trim()
    }
    return null
  }

  const canTeacherEditOwner = (ownerName: string | null | undefined): boolean => {
    if (!isTeacher) return true
    if (!ownerName || !ownerName.trim()) return true
    if (!activeTeacher) return false
    return ownerName.trim().toLowerCase() === activeTeacher.name.trim().toLowerCase()
  }

  useEffect(() => {
    if (classSubjects.length === 0) return
    if (!classSubjects.includes(selectedSubject)) {
      // Prefer a subject taught by the signed-in teacher first
      const myOwnedSubject = isTeacher
        ? classSubjects.find((s) => canTeacherEditOwner(getSubjectOwnerInClass(s)))
        : null
      setSelectedSubject(myOwnedSubject || classSubjects[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classSubjects, selectedSubject, isTeacher, activeTeacher?.name])

  const selectedSubjectOwner = getSubjectOwnerInClass(selectedSubject)
  const canEditSelectedSubject = canTeacherEditOwner(selectedSubjectOwner)

  // Bulk Class Grid Drafts keyed by `${studentId}::${subjectName}`
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({})
  const [progressDrafts, setProgressDrafts] = useState<Record<string, string>>({})
  const [topicDrafts, setTopicDrafts] = useState<Record<string, string>>({})
  const [savingBatch, setSavingBatch] = useState(false)

  // Individual Student Editor state
  const [selectedStudentId, setSelectedStudentId] = useState<string>(scopedStudents[0]?.id || '')
  useEffect(() => {
    if (scopedStudents.length > 0 && !scopedStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(scopedStudents[0].id)
    }
  }, [scopedStudents, selectedStudentId])

  const activeStudent = useMemo(
    () => scopedStudents.find((s) => s.id === selectedStudentId) || scopedStudents[0] || null,
    [scopedStudents, selectedStudentId],
  )

  // Report card preview modal
  const [previewReportStudent, setPreviewReportStudent] = useState<StudentRecord | null>(null)

  // Exam Sheet Upload Modal (for Guardian Review right from Gradebook)
  const sheetFileInputRef = useRef<HTMLInputElement | null>(null)
  const [sheetModalTarget, setSheetModalTarget] = useState<{
    student: StudentRecord
    subjectName: string
    subjectId?: string
    currentScore: number
  } | null>(null)
  const [sheetExamTitle, setSheetExamTitle] = useState('')
  const [sheetMarksObtained, setSheetMarksObtained] = useState('45')
  const [sheetTotalMarks, setSheetTotalMarks] = useState('50')
  const [sheetCaptureMethod, setSheetCaptureMethod] =
    useState<ExamSheetItem['captureMethod']>('Scan')
  const [sheetFileType, setSheetFileType] = useState<'image' | 'pdf'>('image')
  const [sheetFileUrl, setSheetFileUrl] = useState('')
  const [sheetRemarks, setSheetRemarks] = useState('')
  const [sheetSyncGrade, setSheetSyncGrade] = useState(true)
  const [sheetUploading, setSheetUploading] = useState(false)
  const [sheetError, setSheetError] = useState('')

  const openExamSheetUploader = (
    stu: StudentRecord,
    subjectName: string,
    subjectId: string | undefined,
    currentScore: number,
  ) => {
    setSheetModalTarget({ student: stu, subjectName, subjectId, currentScore })
    setSheetExamTitle(`${assessmentLabel} · ${subjectName} Written Script`)
    setSheetMarksObtained(String(currentScore))
    setSheetTotalMarks('100')
    setSheetCaptureMethod('Scan')
    setSheetFileType('image')
    setSheetFileUrl('')
    setSheetRemarks(`Graded ${subjectName} script uploaded for Guardian review.`)
    setSheetSyncGrade(true)
    setSheetError('')
  }

  const handleSheetFileSelected = async (file: File | null) => {
    if (!file) return
    setSheetError('')
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    setSheetFileType(isPdf ? 'pdf' : 'image')
    setSheetCaptureMethod('Upload')

    // Upload real file to durable /dmhs-api/uploads disk storage first
    try {
      const formData = new FormData()
      formData.append('file', file)
      const upRes = await fetch('/dmhs-api/uploads', { method: 'POST', body: formData })
      const upJson = (await upRes.json()) as { ok?: boolean; url?: string }
      if (upRes.ok && upJson.ok && upJson.url) {
        setSheetFileUrl(upJson.url)
        notify(`Uploaded "${file.name}" to server storage — ready to publish`)
        return
      }
    } catch {
      // Fallback to Data URL preview if disk upload unavailable
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSheetFileUrl(reader.result)
        notify(`Loaded "${file.name}" — ready to publish`)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleGenerateSampleSheet = () => {
    if (!sheetModalTarget) return
    const marks = Math.max(0, Number(sheetMarksObtained) || sheetModalTarget.currentScore)
    const total = Math.max(1, Number(sheetTotalMarks) || 100)
    const svgUrl = createSampleExamSheetSvg({
      studentName: sheetModalTarget.student.name,
      subject: sheetModalTarget.subjectName,
      examTitle: sheetExamTitle || `${sheetModalTarget.subjectName} Exam Script`,
      score: `${marks}/${total}`,
      teacher: activeTeacher?.name || 'Faculty',
    })
    setSheetFileType('image')
    setSheetCaptureMethod('Scan')
    setSheetFileUrl(svgUrl)
    setSheetError('')
  }

  const handlePublishExamSheet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sheetModalTarget) return
    if (!sheetFileUrl) {
      setSheetError('Please upload an exam sheet image/PDF or generate a sample scanned sheet.')
      return
    }
    const obtained = Math.max(0, Math.round(Number(sheetMarksObtained) || 0))
    const total = Math.max(1, Math.round(Number(sheetTotalMarks) || 100))
    if (obtained > total) {
      setSheetError('Marks obtained cannot exceed total marks.')
      return
    }

    setSheetUploading(true)
    setSheetError('')
    const res = await uploadGradebookExamSheet({
      studentId: sheetModalTarget.student.id,
      subject: sheetModalTarget.subjectName,
      subjectId: sheetModalTarget.subjectId,
      examTitle: sheetExamTitle,
      marksObtained: obtained,
      totalMarks: total,
      captureMethod: sheetCaptureMethod,
      scanEnhanced: sheetCaptureMethod === 'Scan',
      fileType: sheetFileType,
      fileDataUrl: sheetFileUrl,
      teacherRemarks: sheetRemarks,
      syncToGradebook: sheetSyncGrade,
    })
    setSheetUploading(false)
    if (!res.ok) {
      setSheetError(res.error || 'Could not upload exam sheet.')
      return
    }
    setSheetModalTarget(null)
  }

  // Add Subject modal/inline state
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [newSubName, setNewSubName] = useState<string>(DMHS_GRADEBOOK_SUBJECTS[0])
  const [newSubScore, setNewSubScore] = useState<number>(80)
  const [newSubTopic, setNewSubTopic] = useState<string>('Term Revision & Core Concepts')
  const [newSubScope, setNewSubScope] = useState<'student' | 'class'>('class')
  const [addingSubject, setAddingSubject] = useState(false)

  // Bulk CSV Marks Import state
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [csvPaste, setCsvPaste] = useState('')
  const [csvFileName, setCsvFileName] = useState('')
  const [parsedCsvRows, setParsedCsvRows] = useState<ParsedMarkRow[]>([])
  const [csvWarnings, setCsvWarnings] = useState<string[]>([])

  // Compute pending changes in Class Grid
  const pendingClassGridEntries = useMemo(() => {
    const entries: Array<{
      studentId: string
      subjectId?: string
      subjectName: string
      score: number
      progress?: number
    }> = []

    for (const stu of classStudents) {
      const sub = stu.subjects.find(
        (item) => item.name.toLowerCase() === selectedSubject.toLowerCase(),
      )
      const key = `${stu.id}::${selectedSubject}`
      const rawScoreStr = scoreDrafts[key]
      const rawProgStr = progressDrafts[key]
      if (rawScoreStr === undefined && rawProgStr === undefined) continue

      const parsedScore =
        rawScoreStr !== undefined && rawScoreStr.trim() !== ''
          ? Math.max(0, Math.min(100, Math.round(Number(rawScoreStr))))
          : (sub?.latestScore ?? 0)
      const parsedProg =
        rawProgStr !== undefined && rawProgStr.trim() !== ''
          ? Math.max(0, Math.min(100, Math.round(Number(rawProgStr))))
          : undefined

      if (!Number.isFinite(parsedScore)) continue
      const scoreChanged = sub ? parsedScore !== sub.latestScore : rawScoreStr !== undefined
      const progChanged =
        parsedProg !== undefined && (!sub || parsedProg !== sub.progress)

      if (scoreChanged || progChanged) {
        entries.push({
          studentId: stu.id,
          subjectId: sub?.id,
          subjectName: sub?.name || selectedSubject,
          score: parsedScore,
          ...(parsedProg !== undefined ? { progress: parsedProg } : {}),
        })
      }
    }
    return entries
  }, [classStudents, selectedSubject, scoreDrafts, progressDrafts])

  // Compute pending changes in Student Sheet
  const pendingStudentEntries = useMemo(() => {
    if (!activeStudent) return []
    const entries: Array<{
      studentId: string
      subjectId: string
      subjectName: string
      score: number
      progress?: number
      nextTopic?: string
    }> = []

    for (const sub of activeStudent.subjects) {
      const key = `${activeStudent.id}::${sub.id}`
      const rawScore = scoreDrafts[key]
      const rawProg = progressDrafts[key]
      const rawTopic = topicDrafts[key]
      if (rawScore === undefined && rawProg === undefined && rawTopic === undefined) continue

      const score =
        rawScore !== undefined && rawScore.trim() !== ''
          ? Math.max(0, Math.min(100, Math.round(Number(rawScore))))
          : sub.latestScore
      const progress =
        rawProg !== undefined && rawProg.trim() !== ''
          ? Math.max(0, Math.min(100, Math.round(Number(rawProg))))
          : sub.progress
      const nextTopic = rawTopic !== undefined ? rawTopic.trim() : sub.nextTopic

      if (
        score !== sub.latestScore ||
        progress !== sub.progress ||
        nextTopic !== sub.nextTopic
      ) {
        entries.push({
          studentId: activeStudent.id,
          subjectId: sub.id,
          subjectName: sub.name,
          score,
          progress,
          nextTopic,
        })
      }
    }
    return entries
  }, [activeStudent, scoreDrafts, progressDrafts, topicDrafts])

  // Live Analytics for current class + subject
  const subjectStats = useMemo(() => {
    const scores: number[] = []
    const dist: Record<string, number> = { 'A+': 0, A: 0, 'A-': 0, B: 0, C: 0, F: 0 }
    let highest: { name: string; score: number } | null = null

    for (const stu of classStudents) {
      const sub = stu.subjects.find(
        (item) => item.name.toLowerCase() === selectedSubject.toLowerCase(),
      )
      const key = `${stu.id}::${selectedSubject}`
      const draftStr = scoreDrafts[key]
      const val =
        draftStr !== undefined && draftStr.trim() !== '' && Number.isFinite(Number(draftStr))
          ? Math.max(0, Math.min(100, Math.round(Number(draftStr))))
          : sub?.latestScore
      if (val === undefined) continue
      scores.push(val)
      const g = scoreToGrade(val)
      dist[g] = (dist[g] || 0) + 1
      if (!highest || val > highest.score) highest = { name: stu.name, score: val }
    }

    const avg =
      scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0
    const passCount = scores.filter((v) => v >= 40).length
    const passRate = scores.length > 0 ? Math.round((passCount / scores.length) * 100) : 0
    return { avg, passRate, count: scores.length, highest, dist }
  }, [classStudents, selectedSubject, scoreDrafts])

  const handleSaveClassGrid = async () => {
    if (pendingClassGridEntries.length === 0) return
    setSavingBatch(true)
    const res = await publishGradebookBatch({
      assessmentLabel,
      entries: pendingClassGridEntries,
    })
    setSavingBatch(false)
    if (res.ok) {
      setScoreDrafts({})
      setProgressDrafts({})
    }
  }

  const handleSaveStudentSheet = async () => {
    if (pendingStudentEntries.length === 0) return
    setSavingBatch(true)
    const res = await publishGradebookBatch({
      assessmentLabel,
      entries: pendingStudentEntries,
    })
    setSavingBatch(false)
    if (res.ok) {
      setScoreDrafts({})
      setProgressDrafts({})
      setTopicDrafts({})
    }
  }

  const handleAddSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubName.trim()) return
    setAddingSubject(true)
    const res = await addGradebookSubject({
      subjectName: newSubName,
      teacherName: activeTeacher?.name || 'Faculty',
      initialScore: newSubScore,
      nextTopic: newSubTopic,
      ...(newSubScope === 'student' && activeStudent
        ? { studentId: activeStudent.id }
        : { classSection: selectedClassSection }),
    })
    setAddingSubject(false)
    if (res.ok) {
      setShowAddSubject(false)
      setSelectedSubject(newSubName)
    }
  }

  const handleExportClassMarksheet = () => {
    const subs = classSubjects
    const headers = [
      'Roll #',
      'Student Name',
      'Class',
      'Section',
      ...subs.map((s) => `${s} (%)`),
      'Average (%)',
      'GPA',
      'Live Rank',
    ]
    const rows = classStudents.map((stu) => [
      stu.roll,
      stu.name,
      stu.className,
      stu.section,
      ...subs.map((subName) => {
        const match = stu.subjects.find((s) => s.name === subName)
        return match ? match.latestScore : '-'
      }),
      stu.averageScore,
      stu.gpa,
      stu.rank,
    ])
    downloadExcelCsv(
      `DMHA-Gradebook-${selectedClassSection.replace(/[^a-z0-9]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
    )
    notify(`Exported ${classStudents.length} students' full marksheet to CSV`)
  }

  const handleDownloadCsvTemplate = () => {
    const headers = ['Roll', 'Student ID', 'Student Name', 'Subject', 'Score', 'Progress']
    const rows = classStudents.map((stu) => {
      const sub = stu.subjects.find(
        (item) => item.name.toLowerCase() === selectedSubject.toLowerCase(),
      )
      return [
        stu.roll,
        stu.id,
        stu.name,
        selectedSubject,
        sub?.latestScore ?? 80,
        sub?.progress ?? 80,
      ]
    })
    downloadExcelCsv(
      `DMHA-Marks-Template-${selectedClassSection.replace(/[^a-z0-9]+/gi, '-')}-${selectedSubject.replace(/[^a-z0-9]+/gi, '-')}.csv`,
      headers,
      rows,
    )
    notify(`Downloaded pre-filled ${selectedSubject} marks template`)
  }

  const parseMarksCsvText = (raw: string) => {
    const rows = parseCsvLines(raw)
    if (rows.length === 0) {
      setParsedCsvRows([])
      setCsvWarnings(['CSV content is empty.'])
      return
    }

    const firstLower = rows[0].join(' ').toLowerCase()
    const hasHeader =
      firstLower.includes('roll') ||
      firstLower.includes('student') ||
      firstLower.includes('score')
    const dataRows = hasHeader ? rows.slice(1) : rows

    const parsed: ParsedMarkRow[] = []
    const warns: string[] = []

    dataRows.forEach((cols, idx) => {
      const lineNo = hasHeader ? idx + 2 : idx + 1
      // Support 6-col template (Roll, Student ID, Student Name, Subject, Score, Progress)
      // OR compact 3-col (Roll/Name, Subject, Score) OR 2-col (Roll/Name, Score)
      let stu: StudentRecord | undefined
      let subjectName = selectedSubject
      let scoreRaw = ''
      let progRaw = ''

      if (cols.length >= 5) {
        const [rollCol, idCol, nameCol, subCol, scCol, prCol] = cols
        stu =
          scopedStudents.find((s) => s.id === idCol) ||
          classStudents.find((s) => s.roll === rollCol) ||
          scopedStudents.find((s) => s.name.toLowerCase() === nameCol.toLowerCase())
        subjectName = subCol || selectedSubject
        scoreRaw = scCol || ''
        progRaw = prCol || ''
      } else if (cols.length === 3) {
        const [idOrRoll, subCol, scCol] = cols
        stu =
          scopedStudents.find((s) => s.id === idOrRoll) ||
          classStudents.find((s) => s.roll === idOrRoll) ||
          scopedStudents.find((s) => s.name.toLowerCase() === idOrRoll.toLowerCase())
        subjectName = subCol || selectedSubject
        scoreRaw = scCol || ''
      } else if (cols.length === 2) {
        const [idOrRoll, scCol] = cols
        stu =
          scopedStudents.find((s) => s.id === idOrRoll) ||
          classStudents.find((s) => s.roll === idOrRoll) ||
          scopedStudents.find((s) => s.name.toLowerCase() === idOrRoll.toLowerCase())
        scoreRaw = scCol || ''
      }

      if (!stu) {
        warns.push(
          `Line ${lineNo}: student "${cols[1] || cols[0]}" not found in your assigned classes.`,
        )
        return
      }
      const numScore = Math.round(Number(scoreRaw))
      if (!Number.isFinite(numScore) || numScore < 0 || numScore > 100) {
        warns.push(`Line ${lineNo}: invalid score "${scoreRaw}" (must be 0–100).`)
        return
      }

      const existingSub = stu.subjects.find(
        (s) => s.name.toLowerCase() === subjectName.toLowerCase(),
      )
      const ownerForSub = existingSub?.teacher || getSubjectOwnerInClass(subjectName)
      if (!canTeacherEditOwner(ownerForSub)) {
        warns.push(
          `Line ${lineNo} blocked: "${subjectName}" is taught by ${ownerForSub}. You can only upload marks for subjects you teach.`,
        )
        return
      }
      const numProg = progRaw.trim() !== '' ? Math.round(Number(progRaw)) : undefined

      parsed.push({
        studentId: stu.id,
        studentName: stu.name,
        roll: stu.roll,
        subjectName: existingSub?.name || subjectName,
        currentScore: existingSub ? existingSub.latestScore : null,
        newScore: numScore,
        ...(numProg !== undefined && Number.isFinite(numProg)
          ? { progress: Math.max(0, Math.min(100, numProg)) }
          : {}),
      })
    })

    setParsedCsvRows(parsed)
    setCsvWarnings(warns)
  }

  const handleLoadSampleCsv = () => {
    const lines = [
      'Roll,Student ID,Student Name,Subject,Score,Progress',
      ...classStudents.map((stu, i) => {
        const sub = stu.subjects.find(
          (item) => item.name.toLowerCase() === selectedSubject.toLowerCase(),
        )
        const bumped = Math.min(99, (sub?.latestScore ?? 82) + (i % 2 === 0 ? 2 : 1))
        return `${stu.roll},${stu.id},"${stu.name}","${selectedSubject}",${bumped},${Math.min(100, (sub?.progress ?? 80) + 4)}`
      }),
    ].join('\n')
    setCsvFileName(`sample-${selectedSubject.toLowerCase()}.csv`)
    setCsvPaste(lines)
    parseMarksCsvText(lines)
  }

  const handlePublishCsvMarks = async () => {
    if (parsedCsvRows.length === 0) return
    setSavingBatch(true)
    const res = await publishGradebookBatch({
      assessmentLabel: `${assessmentLabel} (CSV Upload)`,
      entries: parsedCsvRows.map((r) => ({
        studentId: r.studentId,
        subjectName: r.subjectName,
        score: r.newScore,
        progress: r.progress,
      })),
    })
    setSavingBatch(false)
    if (res.ok) {
      setParsedCsvRows([])
      setCsvPaste('')
      setCsvFileName('')
      setMode('class_grid')
    }
  }

  return (
    <PageShell
      eyebrow={`Assessments & Marks · ${isTeacher ? activeTeacher?.name || 'Faculty' : 'School Registrar'}`}
      title="Interactive Gradebook & Marksheet Engine"
      subtitle="Enter class marks in bulk, upload Excel/CSV mark sheets, edit individual report cards, and auto-sync GPA, Report Cards & Class Leaderboard in SQLite."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddSubject((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100"
          >
            <Icon name="plus" size={14} />
            Add Subject
          </button>
          <button
            type="button"
            onClick={handleExportClassMarksheet}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 shadow-2xs hover:border-emerald-400"
          >
            <Icon name="download" size={14} className="text-emerald-600" />
            Export Marksheet CSV
          </button>
        </div>
      }
    >
      {/* Teacher Assigned-Class RBAC Security Banner */}
      {isTeacher && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Icon name="shield" size={16} />
            </div>
            <div>
              <div className="font-black">
                Assigned-Class Gradebook Access · {activeTeacher?.name}
              </div>
              <div className="text-emerald-800/80">
                Server RBAC enforced: you can only edit grades &amp; upload exam sheets for{' '}
                <strong>subjects you teach</strong> within your assigned classes (
                {scopedStudents.length} students). Other teachers’ subjects are strictly read-only.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {assignedClasses.map((cls) => (
              <span
                key={cls}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200"
              >
                <Icon name="lock" size={11} className="text-emerald-600" />
                {cls}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add Subject Inline Panel */}
      {showAddSubject && (
        <form
          onSubmit={(e) => void handleAddSubjectSubmit(e)}
          className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50/40 p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-900">Add Subject to Gradebook</h3>
            <button
              type="button"
              onClick={() => setShowAddSubject(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-bold text-slate-700">
              Subject
              <select
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none"
              >
                {DMHS_GRADEBOOK_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">
              Apply To
              <select
                value={newSubScope}
                onChange={(e) => setNewSubScope(e.target.value as 'student' | 'class')}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="class">Entire Class ({selectedClassSection})</option>
                {activeStudent && (
                  <option value="student">Only {activeStudent.name}</option>
                )}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">
              Starting Score (%)
              <input
                type="number"
                min={0}
                max={100}
                value={newSubScore}
                onChange={(e) => setNewSubScore(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none"
              />
            </label>
            <label className="text-xs font-bold text-slate-700">
              Next Syllabus Topic
              <input
                value={newSubTopic}
                onChange={(e) => setNewSubTopic(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={addingSubject}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {addingSubject ? 'Adding…' : 'Add Subject to SQLite'}
            </button>
          </div>
        </form>
      )}

      {/* KPI & Live Grade Distribution Strip */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="dmhs-hero rounded-2xl p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            {selectedSubject} · Class Average
          </p>
          <p className="mt-1.5 text-3xl font-black">{subjectStats.avg}%</p>
          <p className="mt-1 text-xs text-slate-300">
            {selectedClassSection} · {subjectStats.count} students
          </p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Highest Scorer
          </p>
          <p className="mt-1.5 truncate text-lg font-black text-slate-900">
            {subjectStats.highest ? `${subjectStats.highest.score}%` : '—'}
          </p>
          <p className="mt-0.5 truncate text-xs font-semibold text-emerald-700">
            {subjectStats.highest?.name || 'No scores yet'}
          </p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Subject Pass Rate (≥40%)
          </p>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{subjectStats.passRate}%</p>
          <p className="mt-0.5 text-xs text-slate-500">Auto-synced to Report Cards</p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Grade Distribution
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(['A+', 'A', 'A-', 'B', 'C', 'F'] as const).map((g) => (
              <span
                key={g}
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${gradeBadgeClasses(g)}`}
              >
                {g}: {subjectStats.dist[g] || 0}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Mode Switcher + Term Selector */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xs">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMode('class_grid')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              mode === 'class_grid'
                ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon name="sheet" size={14} />
            Class Marks Sheet
          </button>
          <button
            type="button"
            onClick={() => setMode('student_sheet')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              mode === 'student_sheet'
                ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon name="exam" size={14} />
            Student Report Editor
          </button>
          <button
            type="button"
            onClick={() => setMode('csv_import')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              mode === 'csv_import'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon name="download" size={14} />
            Bulk CSV Marks Upload
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400">Assessment:</span>
          <select
            value={assessmentLabel}
            onChange={(e) => setAssessmentLabel(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
          >
            {ASSESSMENT_LABELS.map((lbl) => (
              <option key={lbl} value={lbl}>
                {lbl}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ==================== TAB 1: CLASS MARKS SHEET (BULK GRID) ==================== */}
      {mode === 'class_grid' && (
        <div className="space-y-4">
          {/* Class Section + Subject Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {classSections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSelectedClassSection(sec)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                    selectedClassSection === sec
                      ? 'bg-[#0f172a] text-emerald-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>

            <div className="relative min-w-[200px]">
              <Icon
                name="search"
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter student name or roll..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Subject Pills (Teacher's own subjects editable; other teachers' locked read-only) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {classSubjects.map((sub) => {
              const owner = getSubjectOwnerInClass(sub)
              const editable = canTeacherEditOwner(owner)
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSelectedSubject(sub)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                    selectedSubject === sub
                      ? editable
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-amber-600 text-white shadow-2xs'
                      : editable
                        ? 'border border-emerald-200 bg-white text-slate-800 hover:bg-emerald-50/60'
                        : 'border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {isTeacher && !editable ? (
                    <Icon name="lock" size={11} />
                  ) : (
                    isTeacher && (
                      <span
                        className={`size-1.5 rounded-full ${
                          selectedSubject === sub ? 'bg-white' : 'bg-emerald-500'
                        }`}
                      />
                    )
                  )}
                  <span>{sub}</span>
                  {isTeacher && !editable && owner && (
                    <span className="text-[10px] opacity-80">· {owner.split(' ')[0]}</span>
                  )}
                </button>
              )
            })}
          </div>

          {isTeacher && !canEditSelectedSubject && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950">
              <div className="flex items-center gap-2">
                <Icon name="lock" size={15} className="shrink-0 text-amber-700" />
                <span>
                  <strong>Read-Only Subject:</strong> <strong>{selectedSubject}</strong> is taught
                  by <strong>{selectedSubjectOwner}</strong>. One teacher cannot modify another
                  teacher’s grades or upload their exam sheets.
                </span>
              </div>
              <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-900">
                Server Locked
              </span>
            </div>
          )}

          {/* Bulk Editable Marks Table */}
          <div className="dmhs-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {selectedClassSection} · {selectedSubject} Marks Sheet
                </h3>
                <p className="text-[11px] font-medium text-slate-500">
                  Edit scores or progress for multiple students below, then click Save &amp; Publish
                  All Changes.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {pendingClassGridEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setScoreDrafts({})
                      setProgressDrafts({})
                    }}
                    className="rounded-full border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Discard ({pendingClassGridEntries.length})
                  </button>
                )}
                <button
                  type="button"
                  disabled={
                    savingBatch || !canEditSelectedSubject || pendingClassGridEntries.length === 0
                  }
                  onClick={() => void handleSaveClassGrid()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-45"
                >
                  <Icon name="check" size={14} />
                  {!canEditSelectedSubject
                    ? `Locked (${selectedSubjectOwner || 'Other Teacher'})`
                    : savingBatch
                      ? 'Publishing to SQLite…'
                      : `Save & Publish Changes (${pendingClassGridEntries.length})`}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Roll</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Prev</th>
                    <th className="px-4 py-3">Score (0–100)</th>
                    <th className="px-4 py-3">Live Grade</th>
                    <th className="px-4 py-3">Syllabus %</th>
                    <th className="px-4 py-3">Overall Avg / Rank</th>
                    <th className="px-5 py-3 text-right">Exam Sheet &amp; Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classStudents.map((stu) => {
                    const sub = stu.subjects.find(
                      (item) => item.name.toLowerCase() === selectedSubject.toLowerCase(),
                    )
                    const rowOwner = sub?.teacher || selectedSubjectOwner
                    const rowEditable = canTeacherEditOwner(rowOwner)
                    const latestSheet = examSheets.find(
                      (sh) =>
                        sh.studentId === stu.id &&
                        sh.subject.toLowerCase() === selectedSubject.toLowerCase(),
                    )
                    const key = `${stu.id}::${selectedSubject}`
                    const scoreVal = scoreDrafts[key] ?? String(sub?.latestScore ?? '')
                    const progVal = progressDrafts[key] ?? String(sub?.progress ?? 75)
                    const numericScore =
                      scoreVal.trim() !== '' && Number.isFinite(Number(scoreVal))
                        ? Math.max(0, Math.min(100, Math.round(Number(scoreVal))))
                        : null
                    const liveGrade = numericScore !== null ? scoreToGrade(numericScore) : '—'
                    const delta =
                      numericScore !== null && sub
                        ? numericScore - sub.previousScore
                        : 0
                    const isModified =
                      rowEditable &&
                      ((scoreDrafts[key] !== undefined &&
                        numericScore !== sub?.latestScore) ||
                        (progressDrafts[key] !== undefined &&
                          Number(progVal) !== sub?.progress))

                    return (
                      <tr
                        key={stu.id}
                        className={isModified ? 'bg-emerald-50/50' : 'hover:bg-slate-50/60'}
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-500">
                          #{stu.roll}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#0f172a] text-[10px] font-black text-emerald-300">
                              {stu.initials}
                            </span>
                            <div>
                              <p className="font-black text-slate-900">{stu.name}</p>
                              <p className="text-[10px] text-slate-400">
                                {sub ? `Teacher: ${sub.teacher}` : 'New subject score'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-500">
                          {sub ? `${sub.previousScore}%` : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            disabled={!rowEditable}
                            aria-label={`${stu.name} ${selectedSubject} score`}
                            value={scoreVal}
                            onChange={(e) =>
                              setScoreDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            className={`w-20 rounded-xl border px-3 py-2 text-center text-xs font-black outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
                              isModified
                                ? 'border-emerald-500 bg-white ring-2 ring-emerald-200'
                                : 'border-slate-200 bg-slate-50 focus:border-emerald-500 focus:bg-white'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                                liveGrade !== '—'
                                  ? gradeBadgeClasses(liveGrade)
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {liveGrade}
                            </span>
                            {sub && (
                              <span
                                className={`text-[10px] font-bold ${
                                  delta > 0
                                    ? 'text-emerald-600'
                                    : delta < 0
                                      ? 'text-rose-600'
                                      : 'text-slate-400'
                                }`}
                              >
                                {delta > 0 ? `+${delta}%` : `${delta}%`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            disabled={!rowEditable}
                            aria-label={`${stu.name} ${selectedSubject} progress`}
                            value={progVal}
                            onChange={(e) =>
                              setProgressDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            className="w-16 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-black text-slate-900">{stu.averageScore}%</span>
                          <span className="ml-1.5 text-[10px] font-bold text-slate-400">
                            GPA {stu.gpa} · {stu.rank}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {latestSheet && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                  latestSheet.guardianReviewed
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-sky-100 text-sky-800'
                                }`}
                                title={`${latestSheet.examTitle} (${latestSheet.marksObtained}/${latestSheet.totalMarks})`}
                              >
                                {latestSheet.guardianReviewed
                                  ? 'Guardian Reviewed ✓'
                                  : 'Sheet Sent'}
                              </span>
                            )}
                            {rowEditable && (
                              <button
                                type="button"
                                onClick={() =>
                                  openExamSheetUploader(
                                    stu,
                                    selectedSubject,
                                    sub?.id,
                                    numericScore ?? sub?.latestScore ?? 85,
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-full bg-[#0f172a] px-2.5 py-1 text-[10px] font-black text-emerald-300 transition hover:bg-slate-800"
                              >
                                <Icon name="sheet" size={11} />
                                Upload Sheet
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setPreviewReportStudent(stu)}
                              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-extrabold text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50"
                            >
                              Report
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: INDIVIDUAL STUDENT REPORT EDITOR ==================== */}
      {mode === 'student_sheet' && activeStudent && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {scopedStudents.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStudentId(s.id)}
                className={`rounded-full px-3.5 py-2 text-xs font-extrabold transition ${
                  s.id === activeStudent.id
                    ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s.name} ({s.className} {s.section}) · {s.averageScore}%
              </button>
            ))}
          </div>

          <div className="dmhs-hero flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 text-white">
            <div className="flex items-center gap-3.5">
              <span className="flex size-13 items-center justify-center rounded-2xl bg-emerald-400 text-lg font-black text-slate-950">
                {activeStudent.initials}
              </span>
              <div>
                <h3 className="text-lg font-black">{activeStudent.name}</h3>
                <p className="text-xs text-slate-300">
                  {activeStudent.className} · {activeStudent.section} · Roll #{activeStudent.roll} ·{' '}
                  {activeStudent.rank}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl bg-white/10 px-4 py-2 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-300">Average</p>
                <p className="text-lg font-black text-emerald-300">{activeStudent.averageScore}%</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-2 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-300">GPA</p>
                <p className="text-lg font-black">{activeStudent.gpa}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReportStudent(activeStudent)}
                className="rounded-full bg-emerald-400 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-300"
              >
                Preview Report Card
              </button>
            </div>
          </div>

          <div className="dmhs-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <h4 className="text-sm font-black text-slate-900">
                All Subjects for {activeStudent.name} ({activeStudent.subjects.length})
              </h4>
              <button
                type="button"
                disabled={savingBatch || pendingStudentEntries.length === 0}
                onClick={() => void handleSaveStudentSheet()}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-45"
              >
                <Icon name="check" size={14} />
                {savingBatch
                  ? 'Saving…'
                  : `Publish All Changes (${pendingStudentEntries.length})`}
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {activeStudent.subjects.map((sub) => {
                const subEditable = canTeacherEditOwner(sub.teacher)
                const key = `${activeStudent.id}::${sub.id}`
                const scVal = scoreDrafts[key] ?? String(sub.latestScore)
                const prVal = progressDrafts[key] ?? String(sub.progress)
                const tpVal = topicDrafts[key] ?? sub.nextTopic
                const numSc = Math.max(0, Math.min(100, Math.round(Number(scVal) || 0)))
                const liveG = scoreToGrade(numSc)
                const dirty =
                  subEditable &&
                  (numSc !== sub.latestScore ||
                    Number(prVal) !== sub.progress ||
                    tpVal !== sub.nextTopic)

                return (
                  <div
                    key={sub.id}
                    className={`grid items-center gap-3 px-5 py-4 md:grid-cols-[1.2fr_.65fr_.65fr_1.3fr_auto] ${
                      dirty ? 'bg-emerald-50/40' : !subEditable ? 'bg-slate-50/50' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-black text-slate-900">{sub.name}</p>
                        {!subEditable && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-900">
                            <Icon name="lock" size={10} />
                            {sub.teacher}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {sub.teacher} · Prev: {sub.previousScore}%
                      </p>
                    </div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">
                      Score (%)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        disabled={!subEditable}
                        value={scVal}
                        onChange={(e) =>
                          setScoreDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs font-black text-slate-900 outline-none focus:border-emerald-500 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </label>
                    <label className="text-[10px] font-bold uppercase text-slate-400">
                      Progress (%)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        disabled={!subEditable}
                        value={prVal}
                        onChange={(e) =>
                          setProgressDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </label>
                    <label className="text-[10px] font-bold uppercase text-slate-400">
                      Next Syllabus Topic
                      <input
                        disabled={!subEditable}
                        value={tpVal}
                        onChange={(e) =>
                          setTopicDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </label>
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className={`inline-flex justify-center rounded-full px-3 py-1 text-xs font-black ${gradeBadgeClasses(liveG)}`}
                      >
                        {liveG}
                      </span>
                      {subEditable && (
                        <button
                          type="button"
                          onClick={() =>
                            openExamSheetUploader(activeStudent, sub.name, sub.id, numSc)
                          }
                          className="inline-flex items-center gap-1 rounded-full bg-[#0f172a] px-2.5 py-1 text-[10px] font-black text-emerald-300 hover:bg-slate-800"
                        >
                          <Icon name="sheet" size={11} />
                          Upload Sheet
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: BULK CSV MARKS UPLOAD ==================== */}
      {mode === 'csv_import' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950">
            <div>
              <p className="font-black">
                Upload Excel / CSV Marks for {selectedClassSection} · {selectedSubject}
              </p>
              <p className="mt-0.5 text-emerald-900/80">
                Download the pre-filled template, update scores in Excel/Sheets, and upload back to
                publish all marks in 1 click.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-black text-emerald-800 shadow-2xs ring-1 ring-emerald-200 hover:bg-emerald-50"
              >
                <Icon name="download" size={14} />
                Download {selectedSubject} CSV Template
              </button>
              <button
                type="button"
                onClick={handleLoadSampleCsv}
                className="rounded-xl bg-[#0f172a] px-3.5 py-2 text-xs font-black text-emerald-300 hover:bg-slate-800"
              >
                Load Sample Marks CSV
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="dmhs-card space-y-3 p-5">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50/30"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setCsvFileName(file.name)
                    const reader = new FileReader()
                    reader.onload = () => {
                      const txt = String(reader.result || '')
                      setCsvPaste(txt)
                      parseMarksCsvText(txt)
                    }
                    reader.readAsText(file)
                  }}
                />
                <p className="text-sm font-black text-slate-800">
                  {csvFileName ? `Loaded: ${csvFileName}` : 'Click to Upload .CSV Marksheet'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Columns: Roll, Student ID, Student Name, Subject, Score (0–100), Progress
                </p>
              </div>

              <textarea
                rows={6}
                value={csvPaste}
                onChange={(e) => setCsvPaste(e.target.value)}
                placeholder="Or paste CSV rows here..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs outline-none focus:border-emerald-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => parseMarksCsvText(csvPaste)}
                className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300 hover:bg-slate-800"
              >
                Parse &amp; Preview CSV Marks
              </button>
            </div>

            <div className="dmhs-card flex flex-col justify-between p-5">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Parsed Marks Diff Preview ({parsedCsvRows.length} Ready)
                </h4>

                {csvWarnings.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    {csvWarnings.map((w, i) => (
                      <p key={i}>• {w}</p>
                    ))}
                  </div>
                )}

                {parsedCsvRows.length === 0 ? (
                  <p className="mt-8 text-center text-xs font-semibold text-slate-400">
                    Upload a CSV or click “Load Sample Marks CSV” to preview score updates.
                  </p>
                ) : (
                  <div className="mt-3 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                    {parsedCsvRows.map((r, i) => (
                      <div
                        key={`${r.studentId}-${r.subjectName}-${i}`}
                        className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                      >
                        <div>
                          <p className="font-black text-slate-900">
                            #{r.roll} {r.studentName}
                          </p>
                          <p className="text-[10px] text-slate-500">{r.subjectName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">
                            {r.currentScore !== null ? `${r.currentScore}%` : 'New'} →
                          </span>
                          <span className="font-black text-emerald-700">{r.newScore}%</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${gradeBadgeClasses(scoreToGrade(r.newScore))}`}
                          >
                            {scoreToGrade(r.newScore)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={savingBatch || parsedCsvRows.length === 0}
                onClick={() => void handlePublishCsvMarks()}
                className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-45"
              >
                {savingBatch
                  ? 'Publishing to SQLite…'
                  : `Publish ${parsedCsvRows.length} Uploaded Marks to SQLite`}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewReportStudent && (
        <ReportCardModal
          student={previewReportStudent}
          onClose={() => setPreviewReportStudent(null)}
        />
      )}

      {/* ==================== UPLOAD EXAM SHEET FOR GUARDIAN REVIEW MODAL ==================== */}
      {sheetModalTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setSheetModalTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  Direct to Guardian Exam Sheets Portal
                </span>
                <h3 className="mt-2 text-xl font-black text-slate-900">
                  Upload Graded Exam Sheet for Guardian Review
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {sheetModalTarget.student.name} ({sheetModalTarget.student.className} ·{' '}
                  {sheetModalTarget.student.section}) · Subject:{' '}
                  <strong className="text-slate-800">{sheetModalTarget.subjectName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSheetModalTarget(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={(e) => void handlePublishExamSheet(e)} className="mt-5 space-y-4">
              {sheetError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
                  {sheetError}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700 sm:col-span-2">
                  Exam Title *
                  <input
                    required
                    value={sheetExamTitle}
                    onChange={(e) => setSheetExamTitle(e.target.value)}
                    placeholder="e.g., Term Final Written Paper 1"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="text-xs font-bold text-slate-700">
                  Marks Obtained *
                  <input
                    type="number"
                    min={0}
                    required
                    value={sheetMarksObtained}
                    onChange={(e) => setSheetMarksObtained(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-black outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="text-xs font-bold text-slate-700">
                  Total Marks *
                  <input
                    type="number"
                    min={1}
                    required
                    value={sheetTotalMarks}
                    onChange={(e) => setSheetTotalMarks(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-black outline-none focus:border-emerald-500"
                  />
                </label>
              </div>

              {/* File Upload or Sample Scanned Sheet */}
              <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-4">
                <input
                  ref={sheetFileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => void handleSheetFileSelected(e.target.files?.[0] || null)}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-slate-800">
                      Graded Answer Script (Image or PDF)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Guardian will inspect this sheet and confirm or request recheck.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => sheetFileInputRef.current?.click()}
                      className="rounded-xl bg-[#0f172a] px-3.5 py-2 text-xs font-black text-emerald-300 hover:bg-slate-800"
                    >
                      Choose Image / PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateSampleSheet}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100"
                    >
                      Generate Sample Scanned Sheet
                    </button>
                  </div>
                </div>

                {sheetFileUrl && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                    {sheetFileType === 'pdf' ? (
                      <div className="flex items-center justify-between px-3 py-4 text-xs font-bold text-slate-700">
                        <span>PDF Answer Sheet Ready for Guardian Review</span>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                          Attached ✓
                        </span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sheetFileUrl}
                        alt="Graded exam sheet preview"
                        className="max-h-56 w-full rounded-lg object-contain"
                      />
                    )}
                  </div>
                )}
              </div>

              <label className="block text-xs font-bold text-slate-700">
                Teacher Remarks for Guardian
                <textarea
                  rows={2}
                  value={sheetRemarks}
                  onChange={(e) => setSheetRemarks(e.target.value)}
                  placeholder="Write notes on strengths, step marks, or areas to revise..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs font-semibold outline-none focus:border-emerald-500"
                />
              </label>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-emerald-50/70 px-3.5 py-2.5 text-xs font-bold text-emerald-950">
                <input
                  type="checkbox"
                  checked={sheetSyncGrade}
                  onChange={(e) => setSheetSyncGrade(e.target.checked)}
                  className="size-4 accent-emerald-600"
                />
                Also auto-update {sheetModalTarget.student.name}’s {sheetModalTarget.subjectName}{' '}
                Gradebook score (
                {Math.min(
                  100,
                  Math.round(
                    ((Number(sheetMarksObtained) || 0) /
                      Math.max(1, Number(sheetTotalMarks) || 100)) *
                      100,
                  ),
                )}
                %) &amp; live GPA
              </label>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setSheetModalTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sheetUploading || !sheetFileUrl}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-45"
                >
                  <Icon name="send" size={14} />
                  {sheetUploading
                    ? 'Uploading to SQLite…'
                    : 'Publish Exam Sheet for Guardian Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  )
}
