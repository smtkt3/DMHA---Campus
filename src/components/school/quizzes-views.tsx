'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DMHS_CLASSES, DMHS_CLASS_TAGS } from './data'
import { ChildSwitcherBar } from './guardian-views'
import { useSchool } from './store'
import type { OnlineQuiz, QuizAttempt, QuizQuestion } from './types'

type IconProps = { className?: string }
const Svg = ({ className = 'h-4 w-4', children }: IconProps & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
)

const AlertTriangle = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
)
const ArrowDown = ({ className }: IconProps) => (
  <Svg className={className}><path d="M12 5v14M19 12l-7 7-7-7" /></Svg>
)
const ArrowUp = ({ className }: IconProps) => (
  <Svg className={className}><path d="M12 19V5M5 12l7-7 7 7" /></Svg>
)
const Award = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </Svg>
)
const BookOpen = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </Svg>
)
const Check = ({ className }: IconProps) => (
  <Svg className={className}><path d="M20 6 9 17l-5-5" /></Svg>
)
const CheckCircle2 = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
)
const Clock = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Svg>
)
const Copy = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
)
const Download = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </Svg>
)
const Edit3 = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
)
const Eye = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)
const FileSpreadsheet = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h8M12 13v4" />
  </Svg>
)
const FileText = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </Svg>
)
const Lock = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Svg>
)
const Play = ({ className }: IconProps) => (
  <Svg className={className}><polygon points="6 3 20 12 6 21 6 3" /></Svg>
)
const Plus = ({ className }: IconProps) => (
  <Svg className={className}><path d="M12 5v14M5 12h14" /></Svg>
)
const Search = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
)
const ShieldCheck = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
)
const Sparkles = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m12 3-1.9 5.8L4 11l6.1 2.2L12 19l1.9-5.8L20 11l-6.1-2.2Z" />
  </Svg>
)
const Trash2 = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
)
const Trophy = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </Svg>
)
const Upload = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </Svg>
)
const Users = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
)
const X = ({ className }: IconProps) => (
  <Svg className={className}><path d="M18 6 6 18M6 6l12 12" /></Svg>
)
const XCircle = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6M9 9l6 6" />
  </Svg>
)

type DraftQuestion = Omit<QuizQuestion, 'id'>

const DMHS_SUBJECTS = [
  'Physics',
  'Mathematics',
  'Elementary Math',
  'English',
  'English Language',
  'General Science',
  'Chemistry',
  'Bangla',
  'ICT & Robotics',
  'Bangladesh & Global Studies',
  'Social Studies',
  'Islamic & Moral Studies',
] as const

const SAMPLE_CSV_CONTENT = `Question,Option A,Option B,Option C,Option D,Correct Answer,Points,Explanation
"What is the SI unit of electric current?","Volt","Ampere","Ohm","Watt","B",5,"Electric current is measured in Amperes (A)."
"Which formula represents Ohm's Law?","V = I × R","P = V × I","F = m × a","E = m × c²","A",5,"Voltage equals current multiplied by resistance (V = IR)."
"What is the boiling point of pure water at sea level?","80°C","90°C","100°C","120°C","C",5,"Pure water boils at 100°C under standard atmospheric pressure."
"Which planet is known as the Red Planet?","Venus","Jupiter","Saturn","Mars","D",5,"Iron oxide on Mars gives it its distinctive reddish color."`

const SAMPLE_JSON_CONTENT = JSON.stringify(
  {
    title: 'Chapter 4 Quick Mastery Check',
    subject: 'Physics',
    durationMins: 15,
    passPercentage: 60,
    dueDate: 'Next Thursday · 8:00 PM',
    questions: [
      {
        prompt: 'What is the SI unit of force?',
        options: ['Joule', 'Newton', 'Watt', 'Pascal'],
        correctIndex: 1,
        points: 5,
        explanation: 'Force is measured in Newtons (N), where 1 N = 1 kg·m/s².',
      },
      {
        prompt: 'Which instrument measures atmospheric pressure?',
        options: ['Thermometer', 'Ammeter', 'Barometer', 'Hygrometer'],
        correctIndex: 2,
        points: 5,
        explanation: 'A barometer measures atmospheric pressure.',
      },
    ],
  },
  null,
  2,
)

function normalizeClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function teacherAssignedToClass(targetClassName: string, assignedClasses: string[]): boolean {
  if (!assignedClasses.length) return false
  const targetToken = normalizeClassToken(targetClassName)
  if (!targetToken) return false
  return assignedClasses.some((cls) => normalizeClassToken(cls) === targetToken)
}

function studentMatchesQuizClass(
  student: { className: string; section: string },
  quizClassName: string,
): boolean {
  const quizToken = normalizeClassToken(quizClassName)
  if (!quizToken) return false
  if (quizToken === 'all' || quizToken === 'allclasses') return true
  const fullToken = normalizeClassToken(`${student.className} ${student.section}`)
  const sectionLetter = student.section.replace(/section/i, '').trim().toLowerCase()
  const compactToken = normalizeClassToken(`${student.className}${sectionLetter}`)
  const gradeOnlyToken = normalizeClassToken(student.className)
  return quizToken === fullToken || quizToken === compactToken || quizToken === gradeOnlyToken
}

function createBlankQuestion(): DraftQuestion {
  return {
    prompt: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    points: 5,
    explanation: '',
  }
}

/**
 * RFC-4180 compliant single-line/multi-line CSV parser (handles quoted commas & escaped quotes).
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    const next = clean[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n') {
      row.push(cell.trim())
      if (row.some((c) => c.length > 0)) {
        rows.push(row)
      }
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  row.push(cell.trim())
  if (row.some((c) => c.length > 0)) {
    rows.push(row)
  }
  return rows
}

function resolveCorrectIndex(rawAnswer: string, options: string[]): number {
  const clean = String(rawAnswer || '').trim().toUpperCase()
  if (!clean) return 0
  if (clean === 'A' || clean === 'OPTION A' || clean === '1') return 0
  if (clean === 'B' || clean === 'OPTION B' || clean === '2') return 1
  if (clean === 'C' || clean === 'OPTION C' || clean === '3') return Math.min(2, options.length - 1)
  if (clean === 'D' || clean === 'OPTION D' || clean === '4') return Math.min(3, options.length - 1)
  if (/^[0-3]$/.test(clean)) return Math.min(Number(clean), options.length - 1)

  const matchedIdx = options.findIndex((o) => o.trim().toLowerCase() === rawAnswer.trim().toLowerCase())
  return matchedIdx >= 0 ? matchedIdx : 0
}

interface ParsedImportResult {
  questions: DraftQuestion[]
  warnings: string[]
  meta?: {
    title?: string
    subject?: string
    durationMins?: number
    passPercentage?: number
    dueDate?: string
  }
}

function parseUploadedQuizContent(rawText: string, fileName?: string): ParsedImportResult {
  const trimmed = rawText.trim()
  if (!trimmed) {
    return { questions: [], warnings: ['File or pasted text is empty.'] }
  }

  const looksLikeJson =
    (fileName && fileName.toLowerCase().endsWith('.json')) ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[')

  if (looksLikeJson) {
    try {
      const parsed = JSON.parse(trimmed) as
        | {
            title?: string
            subject?: string
            durationMins?: number
            passPercentage?: number
            dueDate?: string
            questions?: Array<Record<string, unknown>>
          }
        | Array<Record<string, unknown>>

      const rawList = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.questions)
          ? parsed.questions
          : []

      const warnings: string[] = []
      const questions: DraftQuestion[] = []

      rawList.forEach((item, idx) => {
        const prompt = String(item?.prompt || item?.question || '').trim()
        const opts = Array.isArray(item?.options)
          ? item.options.map((o) => String(o ?? '').trim()).filter(Boolean)
          : [item?.optionA, item?.optionB, item?.optionC, item?.optionD]
              .map((o) => String(o ?? '').trim())
              .filter(Boolean)

        if (!prompt || opts.length < 2) {
          warnings.push(`Row ${idx + 1} skipped: missing prompt or fewer than 2 options.`)
          return
        }

        const paddedOpts = opts.slice(0, 4)
        while (paddedOpts.length < 4) paddedOpts.push('')
        const validOpts = paddedOpts.filter(Boolean)

        let correctIndex = 0
        if (typeof item?.correctIndex === 'number') {
          correctIndex = Math.min(Math.max(0, Math.round(item.correctIndex)), validOpts.length - 1)
        } else if (item?.correctAnswer !== undefined || item?.answer !== undefined) {
          correctIndex = resolveCorrectIndex(String(item.correctAnswer ?? item.answer), validOpts)
        }

        const points = Math.min(100, Math.max(1, Math.round(Number(item?.points) || 5)))
        const explanation =
          String(item?.explanation || '').trim() ||
          `The correct answer is "${validOpts[correctIndex]}".`

        questions.push({
          prompt,
          options: validOpts,
          correctIndex,
          points,
          explanation,
        })
      })

      const meta = !Array.isArray(parsed)
        ? {
            title: typeof parsed.title === 'string' ? parsed.title : undefined,
            subject: typeof parsed.subject === 'string' ? parsed.subject : undefined,
            durationMins:
              typeof parsed.durationMins === 'number' ? parsed.durationMins : undefined,
            passPercentage:
              typeof parsed.passPercentage === 'number' ? parsed.passPercentage : undefined,
            dueDate: typeof parsed.dueDate === 'string' ? parsed.dueDate : undefined,
          }
        : undefined

      if (questions.length === 0 && warnings.length === 0) {
        warnings.push('No valid questions found in JSON. Expected a "questions" array.')
      }
      return { questions, warnings, meta }
    } catch {
      return {
        questions: [],
        warnings: ['Invalid JSON syntax. Please check commas, quotes, and brackets.'],
      }
    }
  }

  // CSV / TSV parsing
  const rows = parseCsvRows(trimmed)
  if (rows.length === 0) {
    return { questions: [], warnings: ['No rows detected in CSV content.'] }
  }

  const firstRowJoined = rows[0].join(' ').toLowerCase()
  const hasHeader =
    firstRowJoined.includes('question') ||
    firstRowJoined.includes('prompt') ||
    firstRowJoined.includes('option a')

  const dataRows = hasHeader ? rows.slice(1) : rows
  const warnings: string[] = []
  const questions: DraftQuestion[] = []

  dataRows.forEach((cols, idx) => {
    const rowNum = hasHeader ? idx + 2 : idx + 1
    const prompt = (cols[0] || '').trim()
    const rawOpts = [cols[1] || '', cols[2] || '', cols[3] || '', cols[4] || '']
      .map((c) => c.trim())
      .filter(Boolean)

    if (!prompt) {
      warnings.push(`Line ${rowNum} skipped: empty question prompt.`)
      return
    }
    if (rawOpts.length < 2) {
      warnings.push(`Line ${rowNum} skipped: needs at least 2 answer options (columns B & C).`)
      return
    }

    const correctIndex = resolveCorrectIndex(cols[5] || 'A', rawOpts)
    const points = Math.min(100, Math.max(1, Math.round(Number(cols[6]) || 5)))
    const explanation =
      (cols[7] || '').trim() || `The correct answer is "${rawOpts[correctIndex]}".`

    questions.push({
      prompt,
      options: rawOpts,
      correctIndex,
      points,
      explanation,
    })
  })

  if (questions.length === 0 && warnings.length === 0) {
    warnings.push(
      'No valid questions found. Use columns: Question, Option A, Option B, Option C, Option D, Correct Answer (A-D), Points, Explanation.',
    )
  }

  return { questions, warnings }
}

function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function OnlineQuizzesView() {
  const {
    role,
    quizzes,
    quizAttempts,
    students,
    teachers,
    activeTeacherId,
    activeStudentId,
    selectedChildId,
    createQuiz,
    updateQuiz,
    toggleQuizStatus,
    deleteQuiz,
    submitQuizAttempt,
    syncQuizResultsToGradebook,
    remindUnattemptedStudents,
    notify,
  } = useSchool()

  const activeTeacher = useMemo(
    () => teachers.find((t) => t.id === activeTeacherId) || teachers[0] || null,
    [teachers, activeTeacherId],
  )
  const teacherAssignedClasses = useMemo(
    () => activeTeacher?.assignedClasses || [],
    [activeTeacher],
  )

  const targetStudentId = role === 'student' ? activeStudentId : selectedChildId
  const targetStudent = useMemo(
    () => students.find((s) => s.id === targetStudentId) || students[0],
    [students, targetStudentId],
  )

  const isCreator = role === 'teacher' || role === 'admin'
  const isTeacher = role === 'teacher'
  const isAdmin = role === 'admin'

  // Available target classes in modal dropdown:
  // Teachers: STRICTLY their assignedClasses only!
  // Admins: All DMHA section tags + grade-wide classes.
  const allowedClassOptions = useMemo(() => {
    if (isAdmin) {
      return [...DMHS_CLASS_TAGS, ...DMHS_CLASSES.filter((c) => !DMHS_CLASS_TAGS.includes(c as never))]
    }
    return teacherAssignedClasses
  }, [isAdmin, teacherAssignedClasses])

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'closed'>('all')

  // Active CBT Runner state
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [answers, setAnswers] = useState<number[]>([])
  const [currentQIdx, setCurrentQIdx] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [submittingAttempt, setSubmittingAttempt] = useState(false)
  const [reviewAttempt, setReviewAttempt] = useState<{
    quiz: OnlineQuiz
    attempt: QuizAttempt
  } | null>(null)

  // Results & Participation Tracker modal for Teacher / Admin
  const [resultsModalQuizId, setResultsModalQuizId] = useState<string | null>(null)
  const [resultsRosterTab, setResultsRosterTab] = useState<'all' | 'attempted' | 'not_attempted'>('all')
  const [resultsSearch, setResultsSearch] = useState('')
  const [syncingGradebookKey, setSyncingGradebookKey] = useState<string | null>(null)
  const [remindingKey, setRemindingKey] = useState<string | null>(null)
  const [resultsBanner, setResultsBanner] = useState<{ ok: boolean; text: string } | null>(null)

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busyQuizId, setBusyQuizId] = useState<string | null>(null)

  // Create / Upload / Edit Quiz Modal State
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null)
  const [builderMode, setBuilderMode] = useState<'manual' | 'upload'>('manual')
  const [savingQuiz, setSavingQuiz] = useState(false)
  const [builderError, setBuilderError] = useState('')

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState<string>(activeTeacher?.subject || 'Physics')
  const [className, setClassName] = useState<string>(allowedClassOptions[0] || '')
  const [durationMins, setDurationMins] = useState(15)
  const [passPercentage, setPassPercentage] = useState(60)
  const [dueDate, setDueDate] = useState('Next Friday · 8:00 PM')
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([createBlankQuestion()])

  // Bulk Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [pasteInput, setPasteInput] = useState('')
  const [parsedUpload, setParsedUpload] = useState<ParsedImportResult | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  // Keep default class synced when switching teacher/role
  useEffect(() => {
    if (!showBuilder && allowedClassOptions.length > 0) {
      setClassName(allowedClassOptions[0])
    }
  }, [allowedClassOptions, showBuilder])

  // Role-scoped visible quizzes
  const roleScopedQuizzes = useMemo(() => {
    if (isAdmin) return quizzes

    if (isTeacher) {
      if (!activeTeacher) return []
      return quizzes.filter((q) => {
        if (teacherAssignedToClass(q.className, teacherAssignedClasses)) return true
        if (q.teacherName.trim().toLowerCase() === activeTeacher.name.trim().toLowerCase()) {
          return true
        }
        return false
      })
    }

    // Student or Guardian: ONLY published quizzes matching active child's class/section
    if (!targetStudent) return []
    return quizzes.filter(
      (q) => q.status === 'published' && studentMatchesQuizClass(targetStudent, q.className),
    )
  }, [isAdmin, isTeacher, activeTeacher, teacherAssignedClasses, quizzes, targetStudent])

  // Filtered quizzes for display
  const displayedQuizzes = useMemo(() => {
    return roleScopedQuizzes.filter((q) => {
      if (isCreator && statusFilter !== 'all' && q.status !== statusFilter) return false
      if (isCreator && selectedClassFilter !== 'ALL') {
        if (normalizeClassToken(q.className) !== normalizeClassToken(selectedClassFilter)) {
          return false
        }
      }
      if (searchQuery.trim()) {
        const needle = searchQuery.trim().toLowerCase()
        const hay = `${q.title} ${q.subject} ${q.className} ${q.teacherName}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [roleScopedQuizzes, isCreator, statusFilter, selectedClassFilter, searchQuery])

  // Role-scoped attempts for KPI metrics
  const visibleAttempts = useMemo(() => {
    if (isAdmin) return quizAttempts
    if (isTeacher) {
      const allowedIds = new Set(roleScopedQuizzes.map((q) => q.id))
      return quizAttempts.filter((a) => allowedIds.has(a.quizId))
    }
    return quizAttempts.filter((a) => a.studentId === targetStudent?.id)
  }, [isAdmin, isTeacher, roleScopedQuizzes, quizAttempts, targetStudent])

  const activeQuiz = useMemo(
    () => quizzes.find((q) => q.id === activeQuizId) || null,
    [quizzes, activeQuizId],
  )

  const resultsModalQuiz = useMemo(
    () => quizzes.find((q) => q.id === resultsModalQuizId) || null,
    [quizzes, resultsModalQuizId],
  )

  // Live countdown timer for CBT runner
  useEffect(() => {
    if (!activeQuiz || secondsLeft <= 0) return
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeQuiz, secondsLeft])

  // Auto-submit when timer hits zero
  useEffect(() => {
    if (activeQuiz && secondsLeft === 0 && !submittingAttempt) {
      void handleFinishQuiz()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, activeQuiz])

  const openCreateModal = (mode: 'manual' | 'upload') => {
    setEditingQuizId(null)
    setBuilderMode(mode)
    setBuilderError('')
    setTitle('')
    setSubject(
      activeTeacher?.subject && DMHS_SUBJECTS.includes(activeTeacher.subject as never)
        ? activeTeacher.subject
        : 'Physics',
    )
    setClassName(allowedClassOptions[0] || '')
    setDurationMins(15)
    setPassPercentage(60)
    setDueDate('Next Friday · 8:00 PM')
    setDraftQuestions([createBlankQuestion()])
    setUploadedFileName('')
    setPasteInput('')
    setParsedUpload(null)
    setShowBuilder(true)
  }

  const openEditModal = (quiz: OnlineQuiz) => {
    setEditingQuizId(quiz.id)
    setBuilderMode('manual')
    setBuilderError('')
    setTitle(quiz.title)
    setSubject(quiz.subject)
    // If teacher is editing a legacy quiz whose class isn't in dropdown, default to first assigned class if needed
    const matchingClass =
      allowedClassOptions.find(
        (cls) => normalizeClassToken(cls) === normalizeClassToken(quiz.className),
      ) || allowedClassOptions[0] || quiz.className
    setClassName(matchingClass)
    setDurationMins(quiz.durationMins)
    setPassPercentage(quiz.passPercentage)
    setDueDate(quiz.dueDate)
    setDraftQuestions(
      quiz.questions.map((q) => {
        const opts = [...q.options]
        while (opts.length < 4) opts.push('')
        return {
          prompt: q.prompt,
          options: opts.slice(0, 4),
          correctIndex: q.correctIndex,
          points: q.points,
          explanation: q.explanation,
        }
      }),
    )
    setShowBuilder(true)
  }

  const startQuiz = (quiz: OnlineQuiz, isPreview = false) => {
    setPreviewMode(isPreview)
    setActiveQuizId(quiz.id)
    setAnswers(new Array(quiz.questions.length).fill(-1))
    setCurrentQIdx(0)
    setSecondsLeft(quiz.durationMins * 60)
  }

  const handleFinishQuiz = async () => {
    if (!activeQuiz || submittingAttempt) return
    const totalSec = activeQuiz.durationMins * 60
    const timeTakenSec = Math.max(1, totalSec - secondsLeft)

    // Teacher/Admin preview grades locally without altering student gradebooks
    if (previewMode || isCreator) {
      let score = 0
      let totalMarks = 0
      activeQuiz.questions.forEach((q, idx) => {
        totalMarks += q.points
        if (answers[idx] === q.correctIndex) score += q.points
      })
      const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0
      const previewAttempt: QuizAttempt = {
        id: `preview-${Date.now()}`,
        quizId: activeQuiz.id,
        studentId: 'preview',
        studentName: `${isAdmin ? 'Admin' : activeTeacher?.name || 'Teacher'} (Preview)`,
        answers,
        score,
        totalMarks,
        percentage,
        passed: percentage >= activeQuiz.passPercentage,
        timeTakenSec,
        submittedAt: 'Preview Run (Not Recorded)',
      }
      setActiveQuizId(null)
      setPreviewMode(false)
      setReviewAttempt({ quiz: activeQuiz, attempt: previewAttempt })
      notify(`Preview finished: ${score}/${totalMarks} (${percentage}%)`)
      return
    }

    if (!targetStudent) return
    setSubmittingAttempt(true)
    const result = await submitQuizAttempt({
      quizId: activeQuiz.id,
      studentId: targetStudent.id,
      answers,
      timeTakenSec,
    })
    setSubmittingAttempt(false)

    if (result.ok && result.attempt) {
      const finishedQuiz = activeQuiz
      setActiveQuizId(null)
      setReviewAttempt({ quiz: finishedQuiz, attempt: result.attempt })
    }
  }

  const handleFileUpload = (file: File | null) => {
    if (!file) return
    setUploadedFileName(file.name)
    setBuilderError('')
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      setPasteInput(text)
      const parsed = parseUploadedQuizContent(text, file.name)
      setParsedUpload(parsed)
      if (parsed.meta?.title && !title.trim()) setTitle(parsed.meta.title)
      if (parsed.meta?.subject) setSubject(parsed.meta.subject)
      if (parsed.meta?.durationMins) setDurationMins(parsed.meta.durationMins)
      if (parsed.meta?.passPercentage) setPassPercentage(parsed.meta.passPercentage)
      if (parsed.meta?.dueDate) setDueDate(parsed.meta.dueDate)
    }
    reader.readAsText(file)
  }

  const handleParsePasted = () => {
    setBuilderError('')
    const parsed = parseUploadedQuizContent(pasteInput, uploadedFileName || undefined)
    setParsedUpload(parsed)
    if (parsed.meta?.title && !title.trim()) setTitle(parsed.meta.title)
    if (parsed.meta?.subject) setSubject(parsed.meta.subject)
    if (parsed.meta?.durationMins) setDurationMins(parsed.meta.durationMins)
    if (parsed.meta?.passPercentage) setPassPercentage(parsed.meta.passPercentage)
    if (parsed.meta?.dueDate) setDueDate(parsed.meta.dueDate)
  }

  const loadParsedIntoBuilder = () => {
    if (!parsedUpload || parsedUpload.questions.length === 0) return
    const normalized = parsedUpload.questions.map((q) => {
      const opts = [...q.options]
      while (opts.length < 4) opts.push('')
      return { ...q, options: opts.slice(0, 4) }
    })
    setDraftQuestions(normalized)
    setBuilderMode('manual')
    notify(`Loaded ${normalized.length} parsed questions into the Quiz Builder for review`)
  }

  const publishQuizPayload = async (
    questionsToSubmit: DraftQuestion[],
    uploadMode: 'manual' | 'bulk',
  ) => {
    setBuilderError('')
    if (!title.trim()) {
      setBuilderError('Please enter a Quiz Title.')
      return
    }
    if (!className.trim()) {
      setBuilderError('Please select a target class.')
      return
    }
    if (isTeacher && !teacherAssignedToClass(className, teacherAssignedClasses)) {
      setBuilderError(
        `Access Denied: You can only publish quizzes to your assigned classes (${teacherAssignedClasses.join(', ') || 'None'}).`,
      )
      return
    }

    const cleaned: DraftQuestion[] = []
    for (let i = 0; i < questionsToSubmit.length; i++) {
      const q = questionsToSubmit[i]
      const prompt = q.prompt.trim()
      const validOpts = q.options.map((o) => o.trim()).filter(Boolean)
      if (!prompt) {
        setBuilderError(`Question #${i + 1} is missing a question prompt.`)
        return
      }
      if (validOpts.length < 2) {
        setBuilderError(`Question #${i + 1} needs at least 2 non-empty answer options.`)
        return
      }
      const safeCorrectIdx =
        q.correctIndex >= 0 && q.correctIndex < validOpts.length ? q.correctIndex : 0
      cleaned.push({
        prompt,
        options: validOpts,
        correctIndex: safeCorrectIdx,
        points: Math.max(1, Math.min(100, Number(q.points) || 5)),
        explanation:
          q.explanation.trim() || `The correct answer is "${validOpts[safeCorrectIdx]}".`,
      })
    }

    if (cleaned.length === 0) {
      setBuilderError('Add or upload at least 1 valid question before publishing.')
      return
    }

    setSavingQuiz(true)
    const res = editingQuizId
      ? await updateQuiz(editingQuizId, {
          title,
          subject,
          className,
          durationMins,
          passPercentage,
          dueDate,
          questions: cleaned,
        })
      : await createQuiz({
          title,
          subject,
          className,
          durationMins,
          passPercentage,
          dueDate,
          questions: cleaned,
          uploadMode,
        })
    setSavingQuiz(false)

    if (!res.ok) {
      setBuilderError(res.error || 'Server rejected quiz submission.')
      return
    }

    setShowBuilder(false)
    setEditingQuizId(null)
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await publishQuizPayload(draftQuestions, 'manual')
  }

  const handleBulkDirectPublish = async () => {
    if (!parsedUpload || parsedUpload.questions.length === 0) {
      setBuilderError('Please upload a CSV/JSON file or parse questions first.')
      return
    }
    await publishQuizPayload(parsedUpload.questions, 'bulk')
  }

  const handleToggleStatus = async (quizId: string) => {
    setBusyQuizId(quizId)
    await toggleQuizStatus(quizId)
    setBusyQuizId(null)
  }

  const handleDeleteQuiz = async (quizId: string) => {
    setBusyQuizId(quizId)
    await deleteQuiz(quizId)
    setBusyQuizId(null)
    setConfirmDeleteId(null)
  }

  const getEligibleStudentsForQuiz = (quiz: OnlineQuiz) =>
    students
      .filter((s) => s.status !== 'suspended' && studentMatchesQuizClass(s, quiz.className))
      .sort((a, b) => Number(a.roll || 0) - Number(b.roll || 0))

  const exportQuizResultsCsv = (quiz: OnlineQuiz) => {
    const eligible = getEligibleStudentsForQuiz(quiz)
    const attempts = quizAttempts.filter((a) => a.quizId === quiz.id)
    const attemptByStudent = new Map(attempts.map((a) => [a.studentId, a]))
    const header =
      'Roll,Student Name,Class & Section,Participation Status,Score,Total Marks,Percentage,Grade,Gradebook Synced,Updated GPA,Class Rank,Submitted At'
    const lines = eligible.map((stu) => {
      const a = attemptByStudent.get(stu.id)
      if (!a) {
        return `"${stu.roll}","${stu.name.replace(/"/g, '""')}","${stu.className} · ${stu.section}","NOT ATTEMPTED","","","","","Pending","${stu.gpa}","${stu.rank}","—"`
      }
      return `"${stu.roll}","${stu.name.replace(/"/g, '""')}","${stu.className} · ${stu.section}","ATTEMPTED",${a.score},${a.totalMarks},${a.percentage}%,"${a.syncedGrade || (a.percentage >= 80 ? 'A+' : a.percentage >= 70 ? 'A' : a.percentage >= 60 ? 'A-' : a.percentage >= 50 ? 'B' : a.percentage >= 40 ? 'C' : 'F')}","${a.gradebookSynced ? `Yes (${a.syncedSubject || quiz.subject})` : 'Ready to Sync'}","${a.syncedGpa || stu.gpa}","${a.syncedRank || stu.rank}","${a.submittedAt}"`
    })
    const csv = [header, ...lines].join('\n')
    triggerFileDownload(
      `DMHA-Quiz-Participation-${quiz.title.replace(/[^a-z0-9]+/gi, '-')}.csv`,
      csv,
      'text/csv;charset=utf-8;',
    )
    notify(`Exported full participation roster (${eligible.length} students) to CSV`)
  }

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= draftQuestions.length) return
    setDraftQuestions((prev) => {
      const copy = [...prev]
      const temp = copy[idx]
      copy[idx] = copy[nextIdx]
      copy[nextIdx] = temp
      return copy
    })
  }

  const duplicateQuestion = (idx: number) => {
    setDraftQuestions((prev) => {
      const copy = [...prev]
      const item = copy[idx]
      copy.splice(idx + 1, 0, { ...item, options: [...item.options] })
      return copy
    })
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // KPI metrics
  const publishedCount = roleScopedQuizzes.filter((q) => q.status === 'published').length
  const totalQuestionsBank = roleScopedQuizzes.reduce((acc, q) => acc + q.questions.length, 0)
  const avgScore =
    visibleAttempts.length > 0
      ? Math.round(
          visibleAttempts.reduce((sum, a) => sum + a.percentage, 0) / visibleAttempts.length,
        )
      : 0

  // ==================== FULL-SCREEN TIMED CBT QUIZ RUNNER ====================
  if (activeQuiz) {
    const q = activeQuiz.questions[currentQIdx]
    const answeredCount = answers.filter((a) => a >= 0).length
    const isUrgent = secondsLeft <= 60

    return (
      <div className="space-y-6">
        <div className="dmhs-hero relative overflow-hidden rounded-3xl p-6 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  {previewMode ? 'Faculty Live Preview' : 'Live CBT Assessment'}
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/85">
                  {activeQuiz.className} · {activeQuiz.subject}
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-bold">{activeQuiz.title}</h2>
              <p className="mt-0.5 text-sm text-white/70">
                {activeQuiz.teacherName} · Pass Mark: {activeQuiz.passPercentage}% · Question{' '}
                {currentQIdx + 1} of {activeQuiz.questions.length}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-2 rounded-2xl px-4 py-3 font-mono text-lg font-bold ${
                  isUrgent
                    ? 'animate-pulse bg-rose-500 text-white'
                    : 'bg-white/10 text-emerald-300 ring-1 ring-white/15'
                }`}
              >
                <Clock className="h-5 w-5" />
                {formatTimer(secondsLeft)}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveQuizId(null)
                  setPreviewMode(false)
                }}
                className="rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/20"
              >
                Exit
              </button>
            </div>
          </div>

          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${(answeredCount / Math.max(1, activeQuiz.questions.length)) * 100}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-white/70">
            <span>
              {answeredCount} of {activeQuiz.questions.length} answered
            </span>
            <span>{activeQuiz.questions.reduce((s, item) => s + item.points, 0)} Total Marks</span>
          </div>
        </div>

        {/* Question Palette */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Question Navigator
          </div>
          <div className="flex flex-wrap gap-2">
            {activeQuiz.questions.map((item, idx) => {
              const isAnswered = answers[idx] >= 0
              const isCurrent = idx === currentQIdx
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentQIdx(idx)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition ${
                    isCurrent
                      ? 'bg-[#0F172A] text-white shadow'
                      : isAnswered
                        ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </div>

        {/* Active Question Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              Question {currentQIdx + 1} · {q.points} Marks
            </span>
            <span className="text-xs font-medium text-slate-400">Select one correct option</span>
          </div>

          <h3 className="mt-4 text-lg font-bold text-slate-900 sm:text-xl">{q.prompt}</h3>

          <div className="mt-6 grid gap-3">
            {q.options.map((opt, oIdx) => {
              const selected = answers[currentQIdx] === oIdx
              const letter = String.fromCharCode(65 + oIdx)
              return (
                <button
                  key={oIdx}
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => prev.map((val, idx) => (idx === currentQIdx ? oIdx : val)))
                  }
                  className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                      selected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{opt}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              disabled={currentQIdx === 0}
              onClick={() => setCurrentQIdx((p) => Math.max(0, p - 1))}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>

            <div className="flex items-center gap-2.5">
              {currentQIdx < activeQuiz.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentQIdx((p) => p + 1)}
                  className="rounded-xl bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Next Question →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submittingAttempt}
                  onClick={() => void handleFinishQuiz()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submittingAttempt
                    ? 'Server Grading…'
                    : previewMode
                      ? 'Finish Preview'
                      : 'Submit & Auto-Grade'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {role === 'guardian' && <ChildSwitcherBar />}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
            Online CBT · Instant Server Grading & Bulk Upload
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Online Quizzes & Mastery Checks
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isTeacher
              ? `Create manually or bulk-upload CSV/JSON quizzes exclusively for your assigned classes (${teacherAssignedClasses.join(', ') || 'None'}).`
              : isAdmin
                ? 'Manage school-wide timed CBT quizzes, bulk-upload question banks, and inspect live class analytics.'
                : role === 'student'
                  ? `Complete live timed quizzes for ${targetStudent?.className} · ${targetStudent?.section} — scores auto-sync to your Gradebook.`
                  : `Inspect ${targetStudent?.name}’s (${targetStudent?.className} · ${targetStudent?.section}) quiz attempts, explanations, and scores.`}
          </p>
        </div>

        {isCreator && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => openCreateModal('upload')}
              disabled={isTeacher && teacherAssignedClasses.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Upload Quiz (CSV / JSON)
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('manual')}
              disabled={isTeacher && teacherAssignedClasses.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#0F172A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Create Quiz
            </button>
          </div>
        )}
      </div>

      {/* Teacher Assigned-Class RBAC Security Banner */}
      {isTeacher && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold">
                Assigned-Class Quiz Access · {activeTeacher?.name}
              </div>
              <div className="text-emerald-800/80">
                Server RBAC enforced: you can create, upload, edit, close, or delete quizzes only
                for your assigned classes.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {teacherAssignedClasses.length > 0 ? (
              teacherAssignedClasses.map((cls) => (
                <span
                  key={cls}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 shadow-xs ring-1 ring-emerald-200"
                >
                  <Lock className="h-3 w-3 text-emerald-600" />
                  {cls}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                No classes assigned yet — contact Admin
              </span>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-hero rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold text-white/70">
            <span>{isCreator ? 'Live Quizzes' : 'Available Quizzes'}</span>
            <Sparkles className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-bold">{publishedCount}</div>
          <div className="mt-1 text-xs text-emerald-300">
            {isTeacher
              ? `Across ${teacherAssignedClasses.length} assigned classes`
              : isAdmin
                ? `${roleScopedQuizzes.length} total school-wide`
                : `${targetStudent?.className} · ${targetStudent?.section}`}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{isCreator ? 'Recorded Attempts' : 'Completed'}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{visibleAttempts.length}</div>
          <div className="mt-1 text-xs text-slate-500">Server-graded & stored in SQLite</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Average Score</span>
            <Trophy className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {visibleAttempts.length > 0 ? `${avgScore}%` : '—'}
          </div>
          <div className="mt-1 text-xs text-emerald-700">Auto-synced to Gradebook</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Question Bank</span>
            <BookOpen className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{totalQuestionsBank}</div>
          <div className="mt-1 text-xs text-slate-500">MCQs with instant explanations</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search quizzes by title, subject, or class..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        {isCreator && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Class Filter Pills (Teachers only see assigned classes) */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setSelectedClassFilter('ALL')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  selectedClassFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isTeacher ? `All Assigned (${roleScopedQuizzes.length})` : 'All Classes'}
              </button>
              {isTeacher ? (
                teacherAssignedClasses.map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setSelectedClassFilter(cls)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      selectedClassFilter === cls
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cls}
                  </button>
                ))
              ) : (
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">Filter Class…</option>
                  {allowedClassOptions.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              {(['all', 'published', 'closed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition ${
                    statusFilter === st
                      ? 'bg-[#0F172A] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'published' ? 'Live' : st}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quiz Cards Grid */}
      {displayedQuizzes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">No Quizzes Match Your View</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {isCreator
              ? 'Create a quiz manually or bulk-upload a CSV/JSON file to publish immediately for your class.'
              : `No live quizzes are currently published for ${targetStudent?.className} · ${targetStudent?.section}.`}
          </p>
          {isCreator && (
            <div className="mt-5 flex justify-center gap-2.5">
              <button
                type="button"
                onClick={() => openCreateModal('upload')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload CSV / JSON
              </button>
              <button
                type="button"
                onClick={() => openCreateModal('manual')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F172A] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Quiz
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {displayedQuizzes.map((quiz) => {
            const totalMarks = quiz.questions.reduce((s, q) => s + q.points, 0)
            const myAttempt = quizAttempts.find(
              (a) => a.quizId === quiz.id && a.studentId === targetStudent?.id,
            )
            const allQuizAttempts = quizAttempts.filter((a) => a.quizId === quiz.id)
            const eligibleStudents = getEligibleStudentsForQuiz(quiz)
            const attemptedIdSet = new Set(allQuizAttempts.map((a) => a.studentId))
            const attemptedCount = eligibleStudents.filter((s) => attemptedIdSet.has(s.id)).length
            const notAttemptedCount = Math.max(0, eligibleStudents.length - attemptedCount)
            const completionPct =
              eligibleStudents.length > 0
                ? Math.round((attemptedCount / eligibleStudents.length) * 100)
                : 0
            const quizAvg =
              allQuizAttempts.length > 0
                ? Math.round(
                    allQuizAttempts.reduce((s, a) => s + a.percentage, 0) / allQuizAttempts.length,
                  )
                : null
            const isBusy = busyQuizId === quiz.id

            return (
              <div
                key={quiz.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs transition hover:border-emerald-300/80 hover:shadow-md"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {quiz.subject}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {quiz.className}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                        quiz.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {quiz.status === 'published' ? 'Live Now' : 'Closed'}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-slate-900">{quiz.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    By {quiz.teacherName} · Due: <strong className="text-slate-700">{quiz.dueDate}</strong>
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center">
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">Questions</div>
                      <div className="mt-0.5 text-sm font-bold text-slate-900">
                        {quiz.questions.length} Qs
                      </div>
                    </div>
                    <div className="border-x border-slate-200/80">
                      <div className="text-[11px] font-medium text-slate-500">Duration</div>
                      <div className="mt-0.5 text-sm font-bold text-slate-900">
                        {quiz.durationMins} mins
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">Total / Pass</div>
                      <div className="mt-0.5 text-sm font-bold text-slate-900">
                        {totalMarks}m · {quiz.passPercentage}%
                      </div>
                    </div>
                  </div>

                  {/* Student/Guardian Attempt Badge */}
                  {!isCreator && myAttempt && (
                    <div
                      className={`mt-4 flex items-center justify-between rounded-2xl border p-3.5 ${
                        myAttempt.passed
                          ? 'border-emerald-200 bg-emerald-50/70'
                          : 'border-amber-200 bg-amber-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Award
                          className={`h-5 w-5 ${
                            myAttempt.passed ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            Score: {myAttempt.score}/{myAttempt.totalMarks} ({myAttempt.percentage}%)
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Submitted {myAttempt.submittedAt} · {formatTimer(myAttempt.timeTakenSec)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReviewAttempt({ quiz, attempt: myAttempt })}
                        className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xs ring-1 ring-slate-200 hover:bg-slate-50"
                      >
                        Review Answers
                      </button>
                    </div>
                  )}

                  {/* Teacher / Admin Live Attempted vs Not Attempted Summary */}
                  {isCreator && (
                    <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setResultsBanner(null)
                              setResultsRosterTab('attempted')
                              setResultsModalQuizId(quiz.id)
                            }}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-200"
                          >
                            ✓ {attemptedCount}/{eligibleStudents.length} Attempted
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResultsBanner(null)
                              setResultsRosterTab('not_attempted')
                              setResultsModalQuizId(quiz.id)
                            }}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              notAttemptedCount > 0
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {notAttemptedCount > 0
                              ? `⏳ ${notAttemptedCount} Not Attempted`
                              : 'All Completed ✓'}
                          </button>
                        </div>
                        <span className="font-bold text-emerald-700">
                          {quizAvg !== null ? `Avg: ${quizAvg}%` : 'Awaiting submissions'}
                        </span>
                      </div>
                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                  {role === 'student' && (
                    <button
                      type="button"
                      disabled={quiz.status !== 'published'}
                      onClick={() => startQuiz(quiz, false)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:bg-slate-300"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      {myAttempt ? 'Retake Timed Quiz' : 'Start Live Quiz'}
                    </button>
                  )}

                  {role === 'guardian' && (
                    <div className="flex w-full items-center justify-between text-xs text-slate-500">
                      <span>
                        {myAttempt
                          ? `${targetStudent?.name} completed this quiz (${myAttempt.percentage}%)`
                          : `Pending completion by ${targetStudent?.name}`}
                      </span>
                      {myAttempt && (
                        <button
                          type="button"
                          onClick={() => setReviewAttempt({ quiz, attempt: myAttempt })}
                          className="font-bold text-emerald-700 hover:underline"
                        >
                          Inspect Sheet →
                        </button>
                      )}
                    </div>
                  )}

                  {isCreator && (
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setResultsBanner(null)
                            setResultsRosterTab('all')
                            setResultsSearch('')
                            setResultsModalQuizId(quiz.id)
                          }}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <Trophy className="h-3.5 w-3.5 text-amber-400" />
                          Who Attempted ({attemptedCount}/{eligibleStudents.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => startQuiz(quiz, true)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(quiz)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleToggleStatus(quiz.id)}
                          className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {quiz.status === 'published' ? 'Close' : 'Re-Open'}
                        </button>

                        {confirmDeleteId === quiz.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleDeleteQuiz(quiz.id)}
                              className="rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-xl bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(quiz.id)}
                            title="Delete Quiz"
                            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ==================== ANSWER REVIEW MODAL ==================== */}
      {reviewAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    reviewAttempt.attempt.passed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {reviewAttempt.attempt.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {reviewAttempt.attempt.passed ? 'Passed · Gradebook Synced' : 'Needs Improvement'}
                </span>
                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  {reviewAttempt.quiz.title}
                </h2>
                <p className="text-sm text-slate-500">
                  {reviewAttempt.attempt.studentName} · Score:{' '}
                  <strong>
                    {reviewAttempt.attempt.score}/{reviewAttempt.attempt.totalMarks} (
                    {reviewAttempt.attempt.percentage}%)
                  </strong>{' '}
                  · Time: {formatTimer(reviewAttempt.attempt.timeTakenSec)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewAttempt(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Added to Student Gradebook &amp; System:{' '}
                  <strong>
                    {reviewAttempt.attempt.syncedSubject || reviewAttempt.quiz.subject} ·{' '}
                    {reviewAttempt.attempt.percentage}% (
                    {reviewAttempt.attempt.syncedGrade ||
                      (reviewAttempt.attempt.percentage >= 80
                        ? 'A+'
                        : reviewAttempt.attempt.percentage >= 70
                          ? 'A'
                          : reviewAttempt.attempt.percentage >= 60
                            ? 'A-'
                            : reviewAttempt.attempt.percentage >= 50
                              ? 'B'
                              : reviewAttempt.attempt.percentage >= 40
                                ? 'C'
                                : 'F')}
                    )
                  </strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                {reviewAttempt.attempt.syncedGpa && (
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-emerald-800 ring-1 ring-emerald-200">
                    GPA {reviewAttempt.attempt.syncedGpa}
                  </span>
                )}
                {reviewAttempt.attempt.syncedRank && (
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-slate-800 ring-1 ring-emerald-200">
                    Rank {reviewAttempt.attempt.syncedRank}
                  </span>
                )}
                {reviewAttempt.attempt.xpAwarded && (
                  <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-white">
                    +{reviewAttempt.attempt.xpAwarded} Study XP
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {reviewAttempt.quiz.questions.map((q, idx) => {
                const chosen = reviewAttempt.attempt.answers[idx]
                const isCorrect = chosen === q.correctIndex
                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border p-4 ${
                      isCorrect
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-rose-200 bg-rose-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">
                        {idx + 1}. {q.prompt}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          isCorrect
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isCorrect ? `+${q.points} pts` : '0 pts'}
                      </span>
                    </div>
                    <div className="mt-2.5 space-y-1.5 text-xs">
                      <p className="text-slate-700">
                        Your Answer:{' '}
                        <strong className={isCorrect ? 'text-emerald-700' : 'text-rose-700'}>
                          {chosen >= 0 && q.options[chosen] ? q.options[chosen] : 'Unanswered'}
                        </strong>
                      </p>
                      {!isCorrect && (
                        <p className="text-emerald-800">
                          Correct Answer: <strong>{q.options[q.correctIndex]}</strong>
                        </p>
                      )}
                      <p className="rounded-xl bg-white/80 p-2.5 text-slate-600">
                        <strong>Explanation:</strong> {q.explanation}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== CLASS PARTICIPATION & RESULTS MODAL (WHO ATTEMPTED vs NOT ATTEMPTED) ==================== */}
      {resultsModalQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                  {resultsModalQuiz.className} · {resultsModalQuiz.subject}
                </span>
                <h2 className="mt-2 text-xl font-bold text-slate-900">{resultsModalQuiz.title}</h2>
                <p className="text-xs text-slate-500">
                  Full class participation tracker (Attempted vs. Not Attempted) &amp; live SQLite
                  Gradebook / Leaderboard sync
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportQuizResultsCsv(resultsModalQuiz)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Roster CSV
                </button>
                <button
                  type="button"
                  onClick={() => setResultsModalQuizId(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {(() => {
              const eligible = getEligibleStudentsForQuiz(resultsModalQuiz)
              const attemptsForQuiz = quizAttempts.filter((a) => a.quizId === resultsModalQuiz.id)
              const attemptByStudentId = new Map(attemptsForQuiz.map((a) => [a.studentId, a]))

              const attemptedRows = eligible
                .filter((s) => attemptByStudentId.has(s.id))
                .map((stu) => ({ stu, att: attemptByStudentId.get(stu.id)! }))
                .sort((a, b) => b.att.percentage - a.att.percentage)

              // Also include any legacy attempt whose student wasn't in class filter
              const eligibleIdSet = new Set(eligible.map((s) => s.id))
              const extraAttempts = attemptsForQuiz.filter((a) => !eligibleIdSet.has(a.studentId))

              const notAttemptedStudents = eligible.filter((s) => !attemptByStudentId.has(s.id))
              const passCount = attemptedRows.filter((r) => r.att.passed).length
              const avgPct =
                attemptedRows.length > 0
                  ? Math.round(
                      attemptedRows.reduce((s, r) => s + r.att.percentage, 0) / attemptedRows.length,
                    )
                  : null

              const q = resultsSearch.trim().toLowerCase()
              const filteredAttempted = attemptedRows.filter(
                (r) =>
                  !q ||
                  `${r.stu.name} ${r.stu.roll} ${r.stu.className} ${r.stu.section}`
                    .toLowerCase()
                    .includes(q),
              )
              const filteredNotAttempted = notAttemptedStudents.filter(
                (s) =>
                  !q ||
                  `${s.name} ${s.roll} ${s.className} ${s.section} ${s.guardianName}`
                    .toLowerCase()
                    .includes(q),
              )

              return (
                <div className="mt-4 space-y-4">
                  {/* 4 Participation & Analytics KPIs */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-3 text-center">
                      <div className="text-[11px] font-semibold text-slate-500">Eligible Class</div>
                      <div className="text-lg font-black text-slate-900">{eligible.length}</div>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                      <div className="text-[11px] font-semibold text-emerald-700">Attempted ✓</div>
                      <div className="text-lg font-black text-emerald-800">
                        {attemptedRows.length + extraAttempts.length}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-amber-50 p-3 text-center">
                      <div className="text-[11px] font-semibold text-amber-700">Not Attempted</div>
                      <div className="text-lg font-black text-amber-800">
                        {notAttemptedStudents.length}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-sky-50 p-3 text-center">
                      <div className="text-[11px] font-semibold text-sky-700">Avg · Pass Rate</div>
                      <div className="text-lg font-black text-sky-800">
                        {avgPct !== null
                          ? `${avgPct}% · ${Math.round((passCount / attemptedRows.length) * 100)}%`
                          : '—'}
                      </div>
                    </div>
                  </div>

                  {resultsBanner && (
                    <div
                      className={`rounded-2xl border px-4 py-2.5 text-xs font-bold ${
                        resultsBanner.ok
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}
                    >
                      {resultsBanner.text}
                    </div>
                  )}

                  {/* Bulk Gradebook Sync & Remind Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          ['all', `All Students (${eligible.length})`],
                          ['attempted', `✓ Attempted (${attemptedRows.length})`],
                          ['not_attempted', `⏳ Not Attempted (${notAttemptedStudents.length})`],
                        ] as const
                      ).map(([tabKey, label]) => (
                        <button
                          key={tabKey}
                          type="button"
                          onClick={() => setResultsRosterTab(tabKey)}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold transition ${
                            resultsRosterTab === tabKey
                              ? 'bg-[#0F172A] text-emerald-300'
                              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {attemptedRows.length > 0 && (
                        <button
                          type="button"
                          disabled={syncingGradebookKey !== null}
                          onClick={async () => {
                            setSyncingGradebookKey('ALL')
                            setResultsBanner(null)
                            const res = await syncQuizResultsToGradebook(resultsModalQuiz.id)
                            setSyncingGradebookKey(null)
                            setResultsBanner({
                              ok: res.ok,
                              text: res.ok
                                ? `Synced ${res.syncedCount} quiz result(s) to Student Gradebook, GPA & Class Leaderboard!`
                                : res.error || 'Could not sync quiz results.',
                            })
                          }}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {syncingGradebookKey === 'ALL'
                            ? 'Syncing...'
                            : 'Sync All to Gradebook & System'}
                        </button>
                      )}
                      {notAttemptedStudents.length > 0 && (
                        <button
                          type="button"
                          disabled={remindingKey !== null}
                          onClick={async () => {
                            setRemindingKey('ALL')
                            setResultsBanner(null)
                            const res = await remindUnattemptedStudents(resultsModalQuiz.id)
                            setRemindingKey(null)
                            setResultsBanner({
                              ok: res.ok,
                              text: res.ok
                                ? `Sent reminder to ${res.remindedCount} student(s) & guardians who have not attempted yet.`
                                : res.error || 'Could not send reminders.',
                            })
                          }}
                          className="rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                        >
                          {remindingKey === 'ALL'
                            ? 'Sending...'
                            : `Remind All Not Attempted (${notAttemptedStudents.length})`}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Student Search */}
                  <input
                    value={resultsSearch}
                    onChange={(e) => setResultsSearch(e.target.value)}
                    placeholder="Search student by name, roll, or guardian..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                  />

                  {/* ATTEMPTED STUDENTS SECTION */}
                  {(resultsRosterTab === 'all' || resultsRosterTab === 'attempted') && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                          ✓ Attempted Students ({filteredAttempted.length})
                        </p>
                        <span className="text-[10px] font-semibold text-slate-400">
                          Auto-graded &amp; synced to Gradebook, GPA &amp; Leaderboard
                        </span>
                      </div>

                      {filteredAttempted.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 py-6 text-center text-xs font-semibold text-slate-400">
                          No matching students have attempted this quiz yet.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 rounded-2xl border border-emerald-200/70 bg-white">
                          {filteredAttempted.map(({ stu, att }, idx) => {
                            const letterGrade =
                              att.syncedGrade ||
                              (att.percentage >= 80
                                ? 'A+'
                                : att.percentage >= 70
                                  ? 'A'
                                  : att.percentage >= 60
                                    ? 'A-'
                                    : att.percentage >= 50
                                      ? 'B'
                                      : att.percentage >= 40
                                        ? 'C'
                                        : 'F')
                            return (
                              <div
                                key={att.id}
                                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-xs font-black text-emerald-800">
                                    #{idx + 1}
                                  </span>
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-bold text-slate-900">
                                        {stu.name}
                                      </span>
                                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                        Roll #{stu.roll} · {stu.className} {stu.section}
                                      </span>
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                      <span>
                                        {att.submittedAt} · {formatTimer(att.timeTakenSec)}
                                      </span>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                          att.gradebookSynced
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-amber-50 text-amber-700'
                                        }`}
                                      >
                                        {att.gradebookSynced
                                          ? `✓ Added to Gradebook (${att.syncedSubject || resultsModalQuiz.subject} · GPA ${att.syncedGpa || stu.gpa} · Rank ${att.syncedRank || stu.rank})`
                                          : 'Pending Gradebook Sync'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-right">
                                    <div className="text-sm font-black text-slate-900">
                                      {att.score}/{att.totalMarks} ({att.percentage}% ·{' '}
                                      <span className="text-emerald-700">{letterGrade}</span>)
                                    </div>
                                    <span
                                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        att.passed
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-rose-100 text-rose-700'
                                      }`}
                                    >
                                      {att.passed ? 'Passed' : 'Below Pass Mark'}
                                    </span>
                                  </div>

                                  {!att.gradebookSynced && (
                                    <button
                                      type="button"
                                      disabled={syncingGradebookKey !== null}
                                      onClick={async () => {
                                        setSyncingGradebookKey(stu.id)
                                        const res = await syncQuizResultsToGradebook(
                                          resultsModalQuiz.id,
                                          stu.id,
                                        )
                                        setSyncingGradebookKey(null)
                                        setResultsBanner({
                                          ok: res.ok,
                                          text: res.ok
                                            ? `Synced ${stu.name}'s score to Gradebook & Leaderboard!`
                                            : res.error || 'Sync failed.',
                                        })
                                      }}
                                      className="rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                                    >
                                      Sync Grade
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResultsModalQuizId(null)
                                      setReviewAttempt({ quiz: resultsModalQuiz, attempt: att })
                                    }}
                                    className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    View Sheet
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* NOT ATTEMPTED STUDENTS SECTION */}
                  {(resultsRosterTab === 'all' || resultsRosterTab === 'not_attempted') && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
                          ⏳ Not Attempted Yet ({filteredNotAttempted.length})
                        </p>
                        <span className="text-[10px] font-semibold text-slate-400">
                          Eligible students in {resultsModalQuiz.className} with no submission
                        </span>
                      </div>

                      {filteredNotAttempted.length === 0 ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 py-5 text-center text-xs font-bold text-emerald-700">
                          🎉 Every eligible student in {resultsModalQuiz.className} has attempted
                          this quiz!
                        </div>
                      ) : (
                        <div className="divide-y divide-amber-100 rounded-2xl border border-amber-200/80 bg-amber-50/25">
                          {filteredNotAttempted.map((stu) => (
                            <div
                              key={stu.id}
                              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                            >
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-xs font-black text-amber-800">
                                  {stu.initials}
                                </span>
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-bold text-slate-900">
                                      {stu.name}
                                    </span>
                                    <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                                      Roll #{stu.roll} · {stu.className} {stu.section}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-[11px] text-slate-500">
                                    Guardian: {stu.guardianName} ({stu.guardianPhone})
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase text-rose-700">
                                  Not Attempted
                                </span>
                                <button
                                  type="button"
                                  disabled={remindingKey !== null}
                                  onClick={async () => {
                                    setRemindingKey(stu.id)
                                    setResultsBanner(null)
                                    const res = await remindUnattemptedStudents(
                                      resultsModalQuiz.id,
                                      stu.id,
                                    )
                                    setRemindingKey(null)
                                    setResultsBanner({
                                      ok: res.ok,
                                      text: res.ok
                                        ? `Reminder sent to ${stu.name} & Guardian (${stu.guardianName})!`
                                        : res.error || 'Could not send reminder.',
                                    })
                                  }}
                                  className="rounded-xl bg-[#0F172A] px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-slate-800 disabled:opacity-50"
                                >
                                  {remindingKey === stu.id ? 'Sending...' : 'Send Reminder'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ==================== CREATE / BULK UPLOAD / EDIT QUIZ MODAL ==================== */}
      {showBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingQuizId
                    ? 'Edit Online Quiz'
                    : builderMode === 'upload'
                      ? 'Bulk Upload Online Quiz (CSV / JSON)'
                      : 'Create New Online Quiz'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {isTeacher
                    ? `Restricted to your assigned classes: ${teacherAssignedClasses.join(', ') || 'None'}`
                    : 'Admin access: publish to any DMHA class & section.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBuilder(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs (Create Mode only) */}
            {!editingQuizId && (
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setBuilderMode('manual')
                    setBuilderError('')
                  }}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                    builderMode === 'manual'
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Manual Quiz Builder ({draftQuestions.length} Qs)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBuilderMode('upload')
                    setBuilderError('')
                  }}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                    builderMode === 'upload'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Bulk Upload (CSV / Excel / JSON)
                </button>
              </div>
            )}

            {/* Shared Quiz Metadata Fields */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Quiz Title *</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Chapter 4: Electricity & Circuits Quick Mastery Check"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Subject *</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                >
                  {DMHS_SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Target Class *</span>
                  {isTeacher && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                      <Lock className="h-3 w-3" /> Assigned Only
                    </span>
                  )}
                </label>
                <select
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-emerald-500"
                >
                  {allowedClassOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Duration (mins)</label>
                  <input
                    type="number"
                    min={2}
                    max={180}
                    value={durationMins}
                    onChange={(e) => setDurationMins(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Pass Mark (%)</label>
                  <input
                    type="number"
                    min={20}
                    max={100}
                    value={passPercentage}
                    onChange={(e) => setPassPercentage(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Due Date / Deadline</label>
                <input
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="e.g., Next Friday · 8:00 PM"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {builderError && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{builderError}</span>
              </div>
            )}

            {/* ==================== TAB 1: MANUAL BUILDER ==================== */}
            {builderMode === 'manual' && (
              <form onSubmit={(e) => void handleManualSubmit(e)} className="mt-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-2.5 text-xs">
                  <div className="font-semibold text-slate-600">
                    Questions: <strong className="text-slate-900">{draftQuestions.length}</strong> ·
                    Total Marks:{' '}
                    <strong className="text-emerald-700">
                      {draftQuestions.reduce((s, q) => s + (Number(q.points) || 0), 0)}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftQuestions((prev) => [...prev, createBlankQuestion()])}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Question
                  </button>
                </div>

                <div className="space-y-4">
                  {draftQuestions.map((dq, qIdx) => (
                    <div
                      key={qIdx}
                      className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0F172A] text-[11px] text-white">
                            {qIdx + 1}
                          </span>
                          Question #{qIdx + 1}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                            Marks:
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={dq.points}
                              onChange={(e) =>
                                setDraftQuestions((prev) =>
                                  prev.map((item, i) =>
                                    i === qIdx
                                      ? { ...item, points: Math.max(1, Number(e.target.value) || 1) }
                                      : item,
                                  ),
                                )
                              }
                              className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs font-bold text-slate-800"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => moveQuestion(qIdx, -1)}
                            disabled={qIdx === 0}
                            title="Move up"
                            className="rounded-lg p-1 text-slate-500 hover:bg-white disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveQuestion(qIdx, 1)}
                            disabled={qIdx === draftQuestions.length - 1}
                            title="Move down"
                            className="rounded-lg p-1 text-slate-500 hover:bg-white disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateQuestion(qIdx)}
                            title="Duplicate question"
                            className="rounded-lg p-1 text-slate-500 hover:bg-white"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          {draftQuestions.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraftQuestions((prev) => prev.filter((_, i) => i !== qIdx))
                              }
                              title="Remove question"
                              className="rounded-lg p-1 text-rose-500 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <input
                        required
                        value={dq.prompt}
                        onChange={(e) =>
                          setDraftQuestions((prev) =>
                            prev.map((item, i) =>
                              i === qIdx ? { ...item, prompt: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Type the multiple-choice question prompt..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
                      />

                      <div className="grid gap-2 sm:grid-cols-2">
                        {dq.options.map((opt, oIdx) => {
                          const isCorrect = dq.correctIndex === oIdx
                          return (
                            <div
                              key={oIdx}
                              className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition ${
                                isCorrect
                                  ? 'border-emerald-400 bg-emerald-50/70'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`correct-${qIdx}`}
                                checked={isCorrect}
                                onChange={() =>
                                  setDraftQuestions((prev) =>
                                    prev.map((item, i) =>
                                      i === qIdx ? { ...item, correctIndex: oIdx } : item,
                                    ),
                                  )
                                }
                                title="Mark as correct answer"
                                className="h-4 w-4 accent-emerald-600"
                              />
                              <span className="text-[11px] font-bold text-slate-500">
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <input
                                required={oIdx < 2}
                                value={opt}
                                onChange={(e) =>
                                  setDraftQuestions((prev) =>
                                    prev.map((item, i) =>
                                      i === qIdx
                                        ? {
                                            ...item,
                                            options: item.options.map((o, oi) =>
                                              oi === oIdx ? e.target.value : o,
                                            ),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder={`Option ${String.fromCharCode(65 + oIdx)}${oIdx >= 2 ? ' (optional)' : ''}`}
                                className="w-full bg-transparent py-1 text-xs text-slate-800 outline-none"
                              />
                            </div>
                          )
                        })}
                      </div>

                      <input
                        value={dq.explanation}
                        onChange={(e) =>
                          setDraftQuestions((prev) =>
                            prev.map((item, i) =>
                              i === qIdx ? { ...item, explanation: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Answer explanation shown to students after auto-grading (optional)"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBuilder(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingQuiz}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {savingQuiz
                      ? 'Saving to SQLite…'
                      : editingQuizId
                        ? 'Save Quiz Changes'
                        : `Publish Quiz to ${className}`}
                  </button>
                </div>
              </form>
            )}

            {/* ==================== TAB 2: BULK UPLOAD (CSV / JSON) ==================== */}
            {builderMode === 'upload' && !editingQuizId && (
              <div className="mt-5 space-y-4">
                {/* Download Sample Templates */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3">
                  <div className="flex items-center gap-2.5 text-xs text-emerald-900">
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-700" />
                    <span>
                      Upload an Excel-saved <strong>.CSV</strong> or <strong>.JSON</strong> quiz
                      file (up to 100 MCQs at once).
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        triggerFileDownload(
                          'DMHA-Quiz-Template.csv',
                          SAMPLE_CSV_CONTENT,
                          'text/csv;charset=utf-8;',
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-xs ring-1 ring-emerald-200 hover:bg-emerald-100/50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Sample CSV
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        triggerFileDownload(
                          'DMHA-Quiz-Template.json',
                          SAMPLE_JSON_CONTENT,
                          'application/json;charset=utf-8;',
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Sample JSON
                    </button>
                  </div>
                </div>

                {/* Drag-and-Drop / Click File Picker */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDraggingFile(true)
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDraggingFile(false)
                    const file = e.dataTransfer.files?.[0] || null
                    handleFileUpload(file)
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    isDraggingFile
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-300 bg-slate-50/70 hover:border-emerald-400 hover:bg-emerald-50/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json,.txt"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files?.[0] || null)}
                  />
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="mt-2.5 text-sm font-bold text-slate-800">
                    {uploadedFileName
                      ? `Loaded File: ${uploadedFileName}`
                      : 'Drop your CSV or JSON quiz file here, or click to browse'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Columns: Question, Option A, Option B, Option C, Option D, Correct Answer (A/B/C/D),
                    Points, Explanation
                  </p>
                </div>

                {/* Quick Paste CSV/JSON */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Or Paste CSV / JSON Questions Directly
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPasteInput(SAMPLE_CSV_CONTENT)
                        setParsedUpload(parseUploadedQuizContent(SAMPLE_CSV_CONTENT, 'sample.csv'))
                        if (!title.trim()) setTitle('Science & Physics Quick Quiz (Uploaded)')
                      }}
                      className="text-xs font-bold text-emerald-700 hover:underline"
                    >
                      Load Sample 4 Questions
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    placeholder={`Question,Option A,Option B,Option C,Option D,Correct Answer,Points,Explanation\n"What is 7 × 8?","54","56","58","64","B",5,"7 multiplied by 8 equals 56."`}
                    className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-3 font-mono text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleParsePasted}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F172A] px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                      Parse & Preview Questions
                    </button>
                  </div>
                </div>

                {/* Live Parsed Preview */}
                {parsedUpload && (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                        <Check className="h-4 w-4 text-emerald-600" />
                        Parsed {parsedUpload.questions.length} Valid{' '}
                        {parsedUpload.questions.length === 1 ? 'Question' : 'Questions'} (
                        {parsedUpload.questions.reduce((s, q) => s + q.points, 0)} Total Marks)
                      </div>
                      {parsedUpload.questions.length > 0 && (
                        <button
                          type="button"
                          onClick={loadParsedIntoBuilder}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                        >
                          Edit Questions in Builder →
                        </button>
                      )}
                    </div>

                    {parsedUpload.warnings.length > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        <div className="font-bold">Parser Notices:</div>
                        <ul className="mt-1 list-disc pl-4">
                          {parsedUpload.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {parsedUpload.questions.length > 0 && (
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {parsedUpload.questions.map((pq, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-slate-200/80 bg-white p-3 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-slate-900">
                                {idx + 1}. {pq.prompt}
                              </span>
                              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                {pq.points} pts
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {pq.options.map((opt, oi) => (
                                <span
                                  key={oi}
                                  className={`rounded-lg px-2 py-0.5 text-[11px] ${
                                    oi === pq.correctIndex
                                      ? 'bg-emerald-100 font-bold text-emerald-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {String.fromCharCode(65 + oi)}: {opt}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBuilder(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingQuiz || !parsedUpload || parsedUpload.questions.length === 0}
                    onClick={() => void handleBulkDirectPublish()}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    {savingQuiz
                      ? 'Uploading & Publishing…'
                      : `Upload & Publish (${parsedUpload?.questions.length || 0} Qs) to ${className}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
