'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  consumeStudyFocusHomework,
  findLinkedMaterialForHomework,
  setStudyFocusMaterial,
} from '@/lib/dmhs-study-links'
import { isImageAttachment, uploadDmhsAttachment } from '@/lib/dmhs-upload-client'
import { DMHS_CLASS_SECTIONS } from './data'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type {
  AssignmentItem,
  HomeworkKind,
  HomeworkSubmissionMode,
  SchoolWeekday,
} from './types'
import { PageShell } from './ui'

const WEEKDAYS: SchoolWeekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']

const DAY_LABELS: Record<SchoolWeekday, string> = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
}

const KIND_OPTIONS: HomeworkKind[] = [
  'Daily Homework',
  'Assignment',
  'Lab / Practical',
  'Project',
]

const SUBJECT_OPTIONS = [
  'Physics',
  'Mathematics',
  'Elementary Math',
  'Chemistry',
  'English',
  'English Language',
  'Bangla',
  'ICT & Robotics',
  'General Science',
]

const QUICK_GRADES = ['20 / 20', '19 / 20', '18 / 20', '16 / 20', 'A+ (Excellent)']
const QUICK_REMARKS = [
  'Fantastic neat work and clear steps!',
  'Great effort — keep up this momentum!',
  'Well done! Double-check units next time.',
  'Good attempt — let’s review the last question together.',
]

interface SubjectVisual {
  emoji: string
  pillBg: string
  softBg: string
  ring: string
  bar: string
}

function getSubjectVisual(subject: string): SubjectVisual {
  const s = subject.toLowerCase()
  if (s.includes('phys')) {
    return {
      emoji: '⚡',
      pillBg: 'bg-indigo-600 text-white',
      softBg: 'bg-indigo-50 text-indigo-800',
      ring: 'border-indigo-200',
      bar: 'bg-indigo-500',
    }
  }
  if (s.includes('math')) {
    return {
      emoji: '📐',
      pillBg: 'bg-sky-600 text-white',
      softBg: 'bg-sky-50 text-sky-800',
      ring: 'border-sky-200',
      bar: 'bg-sky-500',
    }
  }
  if (s.includes('eng')) {
    return {
      emoji: '📘',
      pillBg: 'bg-violet-600 text-white',
      softBg: 'bg-violet-50 text-violet-800',
      ring: 'border-violet-200',
      bar: 'bg-violet-500',
    }
  }
  if (s.includes('chem') || s.includes('sci')) {
    return {
      emoji: '🧪',
      pillBg: 'bg-teal-600 text-white',
      softBg: 'bg-teal-50 text-teal-800',
      ring: 'border-teal-200',
      bar: 'bg-teal-500',
    }
  }
  if (s.includes('ict') || s.includes('cod') || s.includes('rob')) {
    return {
      emoji: '💻',
      pillBg: 'bg-cyan-600 text-white',
      softBg: 'bg-cyan-50 text-cyan-800',
      ring: 'border-cyan-200',
      bar: 'bg-cyan-500',
    }
  }
  if (s.includes('bang')) {
    return {
      emoji: '✍️',
      pillBg: 'bg-emerald-600 text-white',
      softBg: 'bg-emerald-50 text-emerald-800',
      ring: 'border-emerald-200',
      bar: 'bg-emerald-500',
    }
  }
  return {
    emoji: '📚',
    pillBg: 'bg-slate-800 text-white',
    softBg: 'bg-slate-100 text-slate-700',
    ring: 'border-slate-200',
    bar: 'bg-emerald-500',
  }
}

function resolveSubmissionMode(item: AssignmentItem): HomeworkSubmissionMode {
  if (item.submissionMode) return item.submissionMode
  const fmt = (item.submissionFormat || '').toLowerCase()
  const sub = item.subject.toLowerCase()
  if (fmt.includes('+ marked online') || fmt.includes('or photo') || fmt.includes('either')) {
    return 'hybrid'
  }
  if (
    fmt.includes('online') ||
    fmt.includes('digital') ||
    fmt.includes('portal') ||
    fmt.includes('upload') ||
    fmt.includes('flowchart') ||
    sub.includes('ict')
  ) {
    return 'online'
  }
  return 'offline'
}

type UrgencyLevel = 'catch_up' | 'due_today' | 'due_tomorrow' | 'upcoming' | 'done'

interface EnrichedHomework extends AssignmentItem {
  resolvedKind: HomeworkKind
  resolvedMode: HomeworkSubmissionMode
  resolvedDropoff: string
  resolvedDay: SchoolWeekday
  resolvedAssignedDate: string
  resolvedInstructions: string
  resolvedSteps: string[]
  resolvedCompletedSteps: number[]
  resolvedWhatToStudy: string[]
  resolvedStudyTip: string
  resolvedFormat: string
  resolvedEstMins: number
  urgency: UrgencyLevel
  friendlyDueLabel: string
  daysDiff: number | null
  visual: SubjectVisual
}

function getTodayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function diffDaysFromToday(iso?: string): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const todayStr = getTodayIso()
  const a = new Date(`${todayStr}T00:00:00`)
  const b = new Date(`${iso}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function enrichHomework(item: AssignmentItem, idx: number): EnrichedHomework {
  const resolvedKind: HomeworkKind = item.kind || (idx % 2 === 0 ? 'Daily Homework' : 'Assignment')
  const resolvedMode = resolveSubmissionMode(item)
  const resolvedFormat =
    item.submissionFormat ||
    (resolvedMode === 'online' ? 'Online Digital Submission / Photo' : `${item.subject} Homework Copy`)
  const resolvedDropoff =
    item.offlineDropoffLocation ||
    `Bring your ${resolvedFormat} to ${item.teacher}’s ${item.subject} class`
  const resolvedDay: SchoolWeekday = item.assignedDay || WEEKDAYS[idx % WEEKDAYS.length]
  const resolvedAssignedDate = item.assignedDate || `${resolvedDay} Diary`
  const resolvedInstructions =
    item.instructions ||
    `Complete "${item.title}" neatly in your ${item.subject} copy. Show clear headings and steps — you’ve got this!`
  const resolvedSteps =
    item.howToSteps && item.howToSteps.length > 0
      ? item.howToSteps
      : [
          `Skim ${item.teacher}’s class notes and textbook pages on ${item.subject}.`,
          `Work through the questions neatly one step at a time.`,
          resolvedMode === 'offline'
            ? `Pack your ${resolvedFormat} in your school bag & tap “Done in Copy”.`
            : `Do a quick 2-minute check and submit your work online.`,
        ]
  const resolvedCompletedSteps =
    item.status === 'submitted' || item.status === 'graded'
      ? resolvedSteps.map((_, i) => i)
      : item.completedStepIndexes || []
  const resolvedWhatToStudy =
    item.whatToStudy && item.whatToStudy.length > 0
      ? item.whatToStudy
      : [
          `${item.subject} textbook chapter & class notebook examples`,
          `${item.teacher}’s Digital Library revision sheet`,
        ]
  const resolvedStudyTip =
    item.studyTip ||
    `A quick 3-minute look at your class notes first makes ${item.subject} homework feel twice as easy!`
  const resolvedEstMins = item.estimatedMins || 20

  const daysDiff = diffDaysFromToday(item.submissionIso)
  const lowerDue = item.dueDate.toLowerCase()

  let urgency: UrgencyLevel = 'upcoming'
  let friendlyDueLabel = item.dueDate

  if (item.status === 'graded') {
    urgency = 'done'
    friendlyDueLabel = item.score ? `Graded · ${item.score} ★` : 'Graded ★'
  } else if (item.status === 'submitted') {
    urgency = 'done'
    friendlyDueLabel = item.offlineReceivedInClass
      ? 'Copy Collected ✓'
      : item.submittedVia === 'offline' || resolvedMode === 'offline'
        ? 'Done in Copy 📓'
        : 'Submitted Online ✓'
  } else if (
    item.status === 'overdue' ||
    (daysDiff !== null && daysDiff < 0) ||
    lowerDue.includes('overdue')
  ) {
    urgency = 'catch_up'
    friendlyDueLabel = 'Finish First · Catch Up'
  } else if (daysDiff === 0 || lowerDue.includes('today')) {
    urgency = 'due_today'
    friendlyDueLabel = item.submissionTime ? `Due Today · ${item.submissionTime}` : 'Due Today'
  } else if (daysDiff === 1 || lowerDue.includes('tomorrow')) {
    urgency = 'due_tomorrow'
    friendlyDueLabel = item.submissionTime ? `Due Tomorrow · ${item.submissionTime}` : 'Due Tomorrow'
  } else if (daysDiff !== null && daysDiff > 1) {
    urgency = 'upcoming'
    friendlyDueLabel = `Due in ${daysDiff} days`
  }

  return {
    ...item,
    resolvedKind,
    resolvedMode,
    resolvedDropoff,
    resolvedDay,
    resolvedAssignedDate,
    resolvedInstructions,
    resolvedSteps,
    resolvedCompletedSteps,
    resolvedWhatToStudy,
    resolvedStudyTip,
    resolvedFormat,
    resolvedEstMins,
    urgency,
    friendlyDueLabel,
    daysDiff,
    visual: getSubjectVisual(item.subject),
  }
}

function formatTimer(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function ModePill({ mode, compact = false }: { mode: HomeworkSubmissionMode; compact?: boolean }) {
  if (mode === 'offline') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-900 ring-1 ring-amber-200/80">
        📓 {compact ? 'Offline Copy' : 'Offline · Bring Copy to Class'}
      </span>
    )
  }
  if (mode === 'online') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-black text-sky-800 ring-1 ring-sky-200/80">
        🌐 {compact ? 'Online' : 'Online · Submit in App'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-black text-teal-800 ring-1 ring-teal-200/80">
      🔄 {compact ? 'Offline or Online' : 'Flexible · Copy or Online'}
    </span>
  )
}

export function AssignmentsView({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const {
    role,
    students,
    selectedChildId,
    activeStudentId,
    assignments,
    courseMaterials,
    trackCourseMaterialDownload,
    submitAssignment,
    markOfflineCopyReceived,
    toggleAssignmentStep,
    gradeAssignment,
    createAssignment,
  } = useSchool()

  const targetStudent =
    role === 'student'
      ? students.find((s) => s.id === activeStudentId) || students[0]
      : role === 'guardian'
        ? students.find((s) => s.id === selectedChildId) || students[0]
        : null

  const isStaff = role === 'teacher' || role === 'admin'
  const firstName = targetStudent?.name.split(' ')[0] || 'Student'

  // Filters & Active Selection
  const [selectedDay, setSelectedDay] = useState<'ALL' | SchoolWeekday>('ALL')
  const [viewFilter, setViewFilter] = useState<'todo' | 'needs_grading' | 'done' | 'all'>(
    isStaff ? 'all' : 'todo',
  )
  const [modeFilter, setModeFilter] = useState<'ALL' | 'offline' | 'online'>('ALL')
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submissionNote, setSubmissionNote] = useState('')
  const [onlineResponse, setOnlineResponse] = useState('')
  const [onlineFileName, setOnlineFileName] = useState('')
  const [onlineFileUrl, setOnlineFileUrl] = useState('')
  const [uploadingHwFile, setUploadingHwFile] = useState(false)
  const [hwUploadError, setHwUploadError] = useState('')
  const [hybridChoice, setHybridChoice] = useState<'offline' | 'online'>('offline')
  const [justSubmittedId, setJustSubmittedId] = useState<string | null>(null)
  const [showStudyGuide, setShowStudyGuide] = useState(true)

  // Bite-Sized Focus Sprint Timer
  const [timerSeconds, setTimerSeconds] = useState(15 * 60)
  const [timerRunning, setTimerRunning] = useState(false)

  useEffect(() => {
    if (!timerRunning) return
    const id = window.setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [timerRunning])

  useEffect(() => {
    setViewFilter(isStaff ? 'all' : 'todo')
  }, [isStaff])

  // Teacher Grading Inputs
  const [gradeScore, setGradeScore] = useState('19 / 20')
  const [gradeRemark, setGradeRemark] = useState('')

  // Teacher Publish Homework Modal State (Defaults to Offline Physical Copy!)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSubmissionMode, setNewSubmissionMode] = useState<HomeworkSubmissionMode>('offline')
  const [newDropoffLocation, setNewDropoffLocation] = useState(
    'Bring physical copy to next class period',
  )
  const [newClassName, setNewClassName] = useState<string>('Class 6 · Section A')
  const [newKind, setNewKind] = useState<HomeworkKind>('Daily Homework')
  const [newDay, setNewDay] = useState<SchoolWeekday>('Sun')
  const [newSubject, setNewSubject] = useState<string>('Physics')
  const [newLinkedMaterialId, setNewLinkedMaterialId] = useState<string>('')
  const [newChapterTitle, setNewChapterTitle] = useState<string>('')
  const [newTitle, setNewTitle] = useState('')
  const [newSubmissionIso, setNewSubmissionIso] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [newSubmissionTime, setNewSubmissionTime] = useState('08:30 AM')
  const [newEstMins, setNewEstMins] = useState(15)
  const [newFormat, setNewFormat] = useState('Homework Exercise Copy')
  const [newInstructions, setNewInstructions] = useState('')
  const [newStepsText, setNewStepsText] = useState(
    'Skim today’s class notes for 3 minutes\nAnswer Q1–Q4 neatly in your exercise copy\nPack your copy in your school bag & tap Done',
  )
  const [newStudyText, setNewStudyText] = useState(
    'Today’s class notebook solved examples\nTextbook chapter summary box',
  )
  const [newStudyTip, setNewStudyTip] = useState('')

  const rawVisible = useMemo(() => {
    if (isStaff) return assignments
    if (!targetStudent) return []
    return assignments.filter((a) => a.studentId === targetStudent.id)
  }, [assignments, isStaff, targetStudent])

  const enrichedAll = useMemo(() => {
    const priorityOrder: Record<UrgencyLevel, number> = {
      catch_up: 0,
      due_today: 1,
      due_tomorrow: 2,
      upcoming: 3,
      done: 4,
    }
    return rawVisible
      .map((item, idx) => enrichHomework(item, idx))
      .sort((a, b) => priorityOrder[a.urgency] - priorityOrder[b.urgency])
  }, [rawVisible])

  const availableSubjects = useMemo(
    () => Array.from(new Set(enrichedAll.map((a) => a.subject))).sort(),
    [enrichedAll],
  )

  const todoItems = useMemo(
    () => enrichedAll.filter((x) => x.urgency !== 'done'),
    [enrichedAll],
  )
  const catchUpItems = useMemo(
    () => enrichedAll.filter((x) => x.urgency === 'catch_up'),
    [enrichedAll],
  )
  const dueSoonItems = useMemo(
    () => enrichedAll.filter((x) => x.urgency === 'due_today' || x.urgency === 'due_tomorrow'),
    [enrichedAll],
  )
  const offlineCount = useMemo(
    () => enrichedAll.filter((x) => x.resolvedMode === 'offline' || x.resolvedMode === 'hybrid').length,
    [enrichedAll],
  )
  const onlineCount = useMemo(
    () => enrichedAll.filter((x) => x.resolvedMode === 'online' || x.resolvedMode === 'hybrid').length,
    [enrichedAll],
  )
  const needsGradingItems = useMemo(
    () => enrichedAll.filter((x) => x.status === 'submitted'),
    [enrichedAll],
  )
  const doneItems = useMemo(
    () => enrichedAll.filter((x) => x.urgency === 'done'),
    [enrichedAll],
  )
  const completionPct =
    enrichedAll.length > 0 ? Math.round((doneItems.length / enrichedAll.length) * 100) : 100
  const earnedStars = doneItems.length * 25

  useEffect(() => {
    if (!isStaff && viewFilter === 'todo' && todoItems.length === 0 && doneItems.length > 0) {
      setViewFilter('all')
    }
  }, [isStaff, viewFilter, todoItems.length, doneItems.length])

  const filteredList = useMemo(() => {
    return enrichedAll.filter((item) => {
      if (selectedDay !== 'ALL' && item.resolvedDay !== selectedDay) return false
      if (subjectFilter !== 'ALL' && item.subject !== subjectFilter) return false
      if (modeFilter === 'offline' && item.resolvedMode === 'online') return false
      if (modeFilter === 'online' && item.resolvedMode === 'offline') return false
      if (viewFilter === 'todo' && item.urgency === 'done') return false
      if (viewFilter === 'needs_grading' && item.status !== 'submitted') return false
      if (viewFilter === 'done' && item.urgency !== 'done') return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const hay =
          `${item.title} ${item.subject} ${item.teacher} ${item.resolvedInstructions} ${item.resolvedFormat}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [enrichedAll, selectedDay, subjectFilter, modeFilter, viewFilter, searchQuery])

  // Consume deep-link handoff from Course Materials ("Open HW →")
  useEffect(() => {
    const focusHwId = consumeStudyFocusHomework()
    if (!focusHwId) return
    setViewFilter('all')
    setSelectedDay('ALL')
    setSubjectFilter('ALL')
    setModeFilter('ALL')
    setSearchQuery('')
    const exact = enrichedAll.find((x) => x.id === focusHwId)
    if (exact) {
      setSelectedId(exact.id)
      return
    }
    const seed = assignments.find((a) => a.id === focusHwId)
    if (seed) {
      const sibling = enrichedAll.find(
        (x) => x.title === seed.title && x.subject === seed.subject,
      )
      if (sibling) setSelectedId(sibling.id)
    }
  }, [enrichedAll, assignments])

  useEffect(() => {
    if (filteredList.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !filteredList.some((x) => x.id === selectedId)) {
      setSelectedId(filteredList[0].id)
    }
  }, [filteredList, selectedId])

  const selectedItem =
    filteredList.find((x) => x.id === selectedId) || filteredList[0] || null

  const linkedMaterialForSelected = useMemo(
    () => (selectedItem ? findLinkedMaterialForHomework(selectedItem, courseMaterials) : null),
    [selectedItem, courseMaterials],
  )

  const nextBestTask = todoItems[0] || null

  const applyTemplate = (preset: 'offline_copy' | 'online_digital' | 'offline_lab') => {
    if (preset === 'offline_copy') {
      setNewSubmissionMode('offline')
      setNewKind('Daily Homework')
      setNewEstMins(15)
      setNewFormat('Homework Exercise Copy')
      setNewDropoffLocation('Hand in physical exercise copy at start of class')
      setNewStepsText(
        'Review today’s class examples for 3 minutes\nSolve 4 quick practice questions neatly in your copy\nPack your homework copy in your school bag & tap Done',
      )
      setNewStudyTip('Write clearly in your notebook — no computer needed for this homework!')
    } else if (preset === 'online_digital') {
      setNewSubmissionMode('online')
      setNewKind('Assignment')
      setNewEstMins(20)
      setNewFormat('Online Text Answer or Photo/PDF Upload')
      setNewDropoffLocation('')
      setNewStepsText(
        'Read the chapter summary & key definitions\nWrite your response or snap a clear photo of your work\nUpload and tap Submit Online',
      )
      setNewStudyTip('A clear phone photo of neat notebook pages works great for online upload!')
    } else {
      setNewSubmissionMode('hybrid')
      setNewKind('Lab / Practical')
      setNewEstMins(25)
      setNewFormat('Science Lab Notebook (Bring to Class) or Photo Upload')
      setNewDropoffLocation('Bring Science Lab Copy to Lab 204 or upload photo here')
      setNewStepsText(
        'Review the diagram & apparatus list from class\nDraw a clean labelled diagram in pencil\nWrite 3 short observations and conclusion\nBring your lab copy to class or snap a photo online',
      )
      setNewStudyTip('Keep diagrams large and labelled with a ruler for bonus points!')
    }
  }

  const handlePublishHomework = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    const formattedDate = newSubmissionIso
      ? new Date(`${newSubmissionIso}T00:00:00`).toLocaleDateString('en-GB', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
        })
      : 'Next Class'
    const steps = newStepsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const studyItems = newStudyText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    createAssignment({
      className: newClassName,
      kind: newKind,
      submissionMode: newSubmissionMode,
      offlineDropoffLocation:
        newSubmissionMode === 'online' ? undefined : newDropoffLocation.trim(),
      assignedDay: newDay,
      title: newTitle.trim(),
      subject: newSubject,
      dueDate: `Due ${formattedDate} · ${newSubmissionTime}`,
      submissionIso: newSubmissionIso,
      submissionTime: newSubmissionTime,
      estimatedMins: newEstMins,
      submissionFormat: newFormat,
      instructions: newInstructions.trim(),
      howToSteps: steps,
      whatToStudy: studyItems,
      studyTip: newStudyTip.trim(),
      chapterTitle: newChapterTitle.trim() || undefined,
      linkedMaterialId: newLinkedMaterialId || undefined,
    })

    setNewTitle('')
    setNewInstructions('')
    setNewStudyTip('')
    setNewLinkedMaterialId('')
    setNewChapterTitle('')
    setShowCreateModal(false)
  }

  const handleStartFocus = (item: EnrichedHomework) => {
    setSelectedDay('ALL')
    setSubjectFilter('ALL')
    setModeFilter('ALL')
    setViewFilter('todo')
    setSelectedId(item.id)
    setTimerSeconds(Math.min(25, Math.max(10, item.resolvedEstMins)) * 60)
    setTimerRunning(true)
  }

  const stepFeedbackMessage = (doneCount: number, total: number, isDoneStatus: boolean, mode: HomeworkSubmissionMode) => {
    if (isDoneStatus) return 'Awesome work! This homework is all done.'
    if (total === 0) return 'Ready whenever you are!'
    if (doneCount === 0) return 'Tap Step 1 to get started — the first step is always the easiest!'
    if (doneCount < total)
      return `Nice progress! Just ${total - doneCount} quick step${total - doneCount > 1 ? 's' : ''} left to finish.`
    return mode === 'offline'
      ? 'All steps done! Pack your copy in your bag & tap “Done in Copy” below for +25 Stars!'
      : 'All steps checked! Tap submit below to claim +25 Stars!'
  }

  const activeSubmissionVia: 'offline' | 'online' =
    selectedItem?.resolvedMode === 'offline'
      ? 'offline'
      : selectedItem?.resolvedMode === 'online'
        ? 'online'
        : hybridChoice

  return (
    <PageShell
      eyebrow={
        isStaff
          ? 'DMHA Classroom & Learning · Offline & Online Homework Manager'
          : role === 'guardian'
            ? `Homework Companion · ${targetStudent?.name} (${targetStudent?.className})`
            : `My Study Plan · ${targetStudent?.className || 'DMHA'}`
      }
      title={
        isStaff
          ? 'Homework Manager'
          : role === 'guardian'
            ? `${firstName}’s Homework Tracker`
            : `Hey ${firstName}, Ready to Level Up?`
      }
      subtitle={
        isStaff
          ? 'Assign physical notebook (offline), digital (online), or flexible homework with friendly checklists and 1-click grading.'
          : 'Clear offline copy & online homework checklists, quick focus sprints, and backpack reminders so every task feels easy.'
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          {isStaff && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Icon name="plus" size={14} />
              Assign New Homework
            </button>
          )}
          {onNavigate && !isStaff && (
            <button
              type="button"
              onClick={() => onNavigate('coach')}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-600 hover:text-white"
            >
              <Icon name="spark" size={13} />
              Need Help? Ask Study Coach
            </button>
          )}
        </div>
      }
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      {/* ==================== 1. WARM, MOTIVATING HERO ==================== */}
      {!isStaff ? (
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0f172a] via-[#134e4a] to-[#059669] p-6 text-white shadow-lg sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold text-emerald-200 backdrop-blur-xs">
                  ✨ {earnedStars} Homework Stars Earned
                </span>
                {nextBestTask && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/20 px-3 py-1 text-[11px] font-bold text-amber-200">
                    ⏱ Next task takes ~{nextBestTask.resolvedEstMins} mins
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white/90">
                  📓 {offlineCount} Offline Copy · 🌐 {onlineCount} Online
                </span>
              </div>

              <h2 className="mt-3 text-2xl font-black leading-snug tracking-tight sm:text-3xl">
                {todoItems.length === 0
                  ? `You did it, ${firstName}! Every homework is done 🎉`
                  : catchUpItems.length > 0
                    ? `Let’s knock out ${catchUpItems.length} quick catch-up${catchUpItems.length > 1 ? 's' : ''} first — you’ve got this!`
                    : `Just ${todoItems.length} bite-sized task${todoItems.length > 1 ? 's' : ''} left today`}
              </h2>

              <p className="mt-1.5 max-w-xl text-xs font-medium text-emerald-50/85 sm:text-sm">
                {todoItems.length === 0
                  ? 'All caught up — both offline copies and online tasks are complete!'
                  : nextBestTask
                    ? `Start with ${nextBestTask.visual.emoji} ${nextBestTask.subject}: “${nextBestTask.title}” (${nextBestTask.resolvedMode === 'offline' ? 'Offline Copy' : nextBestTask.resolvedMode === 'online' ? 'Online' : 'Copy or Online'}) — finish 1 step at a time!`
                    : 'Pick any card below to follow your step-by-step checklist.'}
              </p>

              {/* Cheerful Progress Bar */}
              <div className="mt-4 max-w-lg">
                <div className="flex items-center justify-between text-[11px] font-extrabold">
                  <span className="text-emerald-200">
                    Progress: {doneItems.length} of {enrichedAll.length} done ({completionPct}%)
                  </span>
                  <span className="text-white/80">
                    {todoItems.length > 0 ? `${todoItems.length} to go` : '100% Complete ★'}
                  </span>
                </div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-white/15 p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-300 transition-all duration-500"
                    style={{ width: `${Math.max(8, completionPct)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right Action Card: One-Click Momentum Starter */}
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[235px]">
              {nextBestTask ? (
                <button
                  type="button"
                  onClick={() => handleStartFocus(nextBestTask)}
                  className="group flex items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 text-left text-slate-900 shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-50"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      Recommended First
                    </p>
                    <p className="mt-0.5 text-sm font-black text-slate-950">
                      Start {nextBestTask.subject} Sprint →
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      ~{nextBestTask.resolvedEstMins} mins ·{' '}
                      {nextBestTask.resolvedMode === 'offline'
                        ? '📓 Copy'
                        : nextBestTask.resolvedMode === 'online'
                          ? '🌐 Online'
                          : '🔄 Copy/Online'}
                    </p>
                  </div>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-lg text-white transition group-hover:scale-105">
                    {nextBestTask.visual.emoji}
                  </span>
                </button>
              ) : (
                <div className="rounded-2xl bg-white/15 px-5 py-4 text-center backdrop-blur-xs">
                  <p className="text-2xl">🏆</p>
                  <p className="mt-1 text-sm font-black text-white">Homework Champion!</p>
                  <p className="text-[11px] font-semibold text-emerald-100">
                    {doneItems.length} completed · {earnedStars} Stars
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/10 px-2.5 py-2 backdrop-blur-xs">
                  <p className="text-base font-black text-white">{todoItems.length}</p>
                  <p className="text-[10px] font-bold text-emerald-100">To Do</p>
                </div>
                <div className="rounded-xl bg-white/10 px-2.5 py-2 backdrop-blur-xs">
                  <p className="text-base font-black text-amber-200">{dueSoonItems.length + catchUpItems.length}</p>
                  <p className="text-[10px] font-bold text-emerald-100">Priority</p>
                </div>
                <div className="rounded-xl bg-white/10 px-2.5 py-2 backdrop-blur-xs">
                  <p className="text-base font-black text-emerald-300">{doneItems.length}</p>
                  <p className="text-[10px] font-bold text-emerald-100">Done</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== FACULTY / ADMIN CLEAN KPI BAR ==================== */
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="dmhs-hero rounded-[22px] p-5 text-white">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
              Active Homework Tasks
            </p>
            <p className="mt-1.5 text-3xl font-black">{enrichedAll.length}</p>
            <p className="mt-1 text-[11px] text-slate-300">
              📓 {offlineCount} Offline Copy · 🌐 {onlineCount} Online
            </p>
          </div>
          <div className="dmhs-card rounded-[22px] p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Ready to Grade / Collect
            </p>
            <p className="mt-1.5 text-3xl font-black text-amber-600">{needsGradingItems.length}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              Submitted online or ready in copy
            </p>
          </div>
          <div className="dmhs-card rounded-[22px] p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Completion Rate
            </p>
            <p className="mt-1.5 text-3xl font-black text-emerald-600">{completionPct}%</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              {doneItems.length} of {enrichedAll.length} done or graded
            </p>
          </div>
          <div className="dmhs-card rounded-[22px] p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Needs Gentle Nudge
            </p>
            <p className="mt-1.5 text-3xl font-black text-slate-900">{catchUpItems.length}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              Past initial due date
            </p>
          </div>
        </div>
      )}

      {/* ==================== 2. SINGLE CLEAN, CALM FILTER BAR ==================== */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs">
        {/* Left: Status Tabs + Offline/Online Mode Filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(isStaff
            ? ([
                ['all', `All (${enrichedAll.length})`],
                ['needs_grading', `Needs Grading (${needsGradingItems.length})`],
                ['todo', `Pending (${todoItems.length})`],
                ['done', `Completed (${doneItems.length})`],
              ] as const)
            : ([
                ['todo', `To Do (${todoItems.length})`],
                ['done', `Completed (${doneItems.length})`],
                ['all', `All (${enrichedAll.length})`],
              ] as const)
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewFilter(key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                viewFilter === key
                  ? 'bg-[#0f172a] text-emerald-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}

          <span className="mx-1 hidden h-4 w-px bg-slate-200 sm:inline-block" />

          {/* Offline vs Online Quick Toggle */}
          {(
            [
              ['ALL', 'All Modes'],
              ['offline', `📓 Offline (${offlineCount})`],
              ['online', `🌐 Online (${onlineCount})`],
            ] as const
          ).map(([mKey, mLabel]) => (
            <button
              key={mKey}
              type="button"
              onClick={() => setModeFilter(mKey)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold transition ${
                modeFilter === mKey
                  ? mKey === 'offline'
                    ? 'bg-amber-500 text-slate-950'
                    : mKey === 'online'
                      ? 'bg-sky-600 text-white'
                      : 'bg-emerald-600 text-white'
                  : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
              }`}
            >
              {mLabel}
            </button>
          ))}
        </div>

        {/* Right: Compact Day + Subject + Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setSelectedDay('ALL')}
              className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold transition ${
                selectedDay === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
              }`}
            >
              All Days
            </button>
            {WEEKDAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`rounded-full px-2 py-1 text-[11px] font-bold transition ${
                  selectedDay === day ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            aria-label="Filter by subject"
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Subjects</option>
            {availableSubjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topic..."
            className="w-36 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 sm:w-40"
          />
        </div>
      </div>

      {/* ==================== 3. CLEAN MASTER-DETAIL WORKSPACE ==================== */}
      <div className="mt-5 grid gap-6 lg:grid-cols-[0.95fr_1.25fr] lg:items-start">
        {/* LEFT: Friendly, Airy Homework Cards */}
        <div className="space-y-3">
          {filteredList.length === 0 ? (
            <div className="dmhs-card rounded-[24px] p-10 text-center">
              <p className="text-3xl">🌟</p>
              <p className="mt-2 text-base font-black text-slate-900">
                {viewFilter === 'todo' ? 'All homework is finished!' : 'No homework matches this filter'}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Try clearing your mode, day, or subject filter to see your full homework diary.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedDay('ALL')
                  setViewFilter('all')
                  setModeFilter('ALL')
                  setSubjectFilter('ALL')
                  setSearchQuery('')
                }}
                className="mt-4 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300"
              >
                Show All Homework
              </button>
            </div>
          ) : (
            filteredList.map((item) => {
              const isSelected = selectedItem?.id === item.id
              const stuName = students.find((s) => s.id === item.studentId)?.name
              const stepsDone = item.resolvedCompletedSteps.length
              const stepsTotal = item.resolvedSteps.length

              const statusChip =
                item.urgency === 'done'
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : item.urgency === 'catch_up'
                    ? 'bg-orange-50 text-orange-800 ring-1 ring-orange-200'
                    : item.urgency === 'due_today'
                      ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                      : 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id)
                    setSubmissionNote(item.studentNote || '')
                    setOnlineResponse(item.onlineResponseText || '')
                    setOnlineFileName(item.onlineAttachmentName || '')
                    setOnlineFileUrl(item.onlineAttachmentUrl || '')
                    setHwUploadError('')
                    setHybridChoice(item.resolvedMode === 'online' ? 'online' : 'offline')
                    setJustSubmittedId(null)
                    setTimerRunning(false)
                    setTimerSeconds(Math.min(25, Math.max(10, item.resolvedEstMins)) * 60)
                  }}
                  className={`group w-full rounded-[22px] border p-4 text-left transition ${
                    isSelected
                      ? 'border-emerald-500 bg-white shadow-md ring-2 ring-emerald-500/15'
                      : 'border-slate-200/80 bg-white hover:border-emerald-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-base ${item.visual.softBg}`}
                      >
                        {item.visual.emoji}
                      </span>
                      <div>
                        <p className="text-[11px] font-black text-slate-900">
                          {item.subject}
                          <span className="ml-1.5 font-semibold text-slate-400">
                            · {item.resolvedDay} · ~{item.resolvedEstMins} min
                          </span>
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400">
                          {item.teacher}
                          {isStaff && stuName ? ` · Student: ${stuName}` : ''}
                        </p>
                      </div>
                    </div>

                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusChip}`}>
                      {item.friendlyDueLabel}
                    </span>
                  </div>

                  <h4 className="mt-2.5 text-[15px] font-black leading-snug text-slate-900 group-hover:text-emerald-800">
                    {item.title}
                  </h4>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <ModePill mode={item.resolvedMode} compact />
                    {(() => {
                      const matchedMat = findLinkedMaterialForHomework(item, courseMaterials)
                      const chapLabel = item.chapterTitle || matchedMat?.chapterTitle
                      return chapLabel ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 ring-1 ring-emerald-200/80">
                          📖 {chapLabel}
                        </span>
                      ) : null
                    })()}
                    <span className="truncate text-[10px] font-semibold text-slate-400">
                      {item.resolvedFormat}
                    </span>
                  </div>

                  {/* Clean Step Progress Segments */}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex flex-1 items-center gap-1.5">
                      {item.resolvedSteps.map((_, sIdx) => {
                        const checked = item.resolvedCompletedSteps.includes(sIdx)
                        return (
                          <span
                            key={sIdx}
                            className={`h-2 flex-1 rounded-full transition-all ${
                              checked ? 'bg-emerald-500' : 'bg-slate-100'
                            }`}
                          />
                        )
                      })}
                    </div>
                    <span className="shrink-0 text-[11px] font-extrabold text-slate-500">
                      {item.urgency === 'done'
                        ? 'Done ✓'
                        : `${stepsDone}/${stepsTotal} steps`}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* RIGHT: Friendly Step-by-Step Guided Workspace */}
        {selectedItem && (
          <div className="dmhs-card sticky top-5 overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-0 shadow-sm">
            {/* Warm Subject Header */}
            <div className="border-b border-slate-100 bg-slate-50/70 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${selectedItem.visual.pillBg}`}
                  >
                    <span>{selectedItem.visual.emoji}</span>
                    {selectedItem.subject}
                  </span>
                  <ModePill mode={selectedItem.resolvedMode} />
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200/80">
                    ⏱ ~{selectedItem.resolvedEstMins} mins
                  </span>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-black ${
                    selectedItem.urgency === 'done'
                      ? 'bg-emerald-600 text-white'
                      : selectedItem.urgency === 'catch_up'
                        ? 'bg-orange-500 text-white'
                        : selectedItem.urgency === 'due_today'
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-sky-600 text-white'
                  }`}
                >
                  {selectedItem.friendlyDueLabel}
                </span>
              </div>

              <h3 className="mt-3 text-xl font-black leading-snug text-slate-950">
                {selectedItem.title}
              </h3>

              <p className="mt-1.5 text-xs leading-relaxed font-medium text-slate-600 sm:text-[13px]">
                {selectedItem.resolvedInstructions}
              </p>

              {/* Compact 3-pill Meta Row */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-600">
                <span className="rounded-xl bg-white px-3 py-1.5 ring-1 ring-slate-200/70">
                  📅 {selectedItem.dueDate}
                </span>
                <span className="rounded-xl bg-white px-3 py-1.5 ring-1 ring-slate-200/70">
                  👩‍🏫 {selectedItem.teacher}
                </span>
                <span className="rounded-xl bg-white px-3 py-1.5 ring-1 ring-slate-200/70">
                  {selectedItem.resolvedMode === 'online' ? '🌐' : '📓'} {selectedItem.resolvedFormat}
                </span>
              </div>

              {/* OFFLINE BACKPACK REMINDER BANNER (Crystal-Clear Physical Hand-In!) */}
              {(selectedItem.resolvedMode === 'offline' || selectedItem.resolvedMode === 'hybrid') && (
                <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-xs font-bold text-amber-950">
                  <span className="text-base">🎒</span>
                  <div>
                    <p className="font-black">
                      {selectedItem.resolvedMode === 'offline'
                        ? 'Offline Physical Copy Homework — No File Upload Needed!'
                        : 'Flexible Homework — Bring Physical Copy OR Submit Online'}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-amber-800">
                      {selectedItem.resolvedDropoff}
                    </p>
                  </div>
                </div>
              )}

              {/* Encouraging Catch-Up Nudge */}
              {!isStaff && selectedItem.urgency === 'catch_up' && (
                <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs font-bold text-orange-900">
                  <span className="text-base">🚀</span>
                  <span>
                    Quick win: knock out these {selectedItem.resolvedSteps.length} short steps now (~{selectedItem.resolvedEstMins} mins) and you’ll be 100% caught up with {selectedItem.teacher}!
                  </span>
                </div>
              )}

              {/* Built-In Student Focus Sprint Timer */}
              {!isStaff && selectedItem.urgency !== 'done' && (
                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-lg">
                      ⏱️
                    </span>
                    <div>
                      <p className="text-[11px] font-black text-slate-900">Focus Sprint Timer</p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {timerRunning
                          ? 'You’re in the zone! Keep checking off steps below.'
                          : 'Work for just a short sprint — makes starting effortless!'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl bg-slate-900 px-3 py-1.5 font-mono text-sm font-black text-emerald-300">
                      {formatTimer(timerSeconds)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTimerRunning((r) => !r)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                        timerRunning
                          ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {timerRunning ? 'Pause' : 'Start Sprint'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTimerRunning(false)
                        setTimerSeconds(Math.min(25, Math.max(10, selectedItem.resolvedEstMins)) * 60)
                      }}
                      className="rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Main Guided Body */}
            <div className="space-y-5 p-5 sm:p-6">
              {/* STEP 1: ACTION-FIRST INTERACTIVE CHECKLIST */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      Your Step-by-Step Checklist
                    </h4>
                    <p className="text-xs font-semibold text-emerald-700">
                      {stepFeedbackMessage(
                        selectedItem.resolvedCompletedSteps.length,
                        selectedItem.resolvedSteps.length,
                        selectedItem.urgency === 'done',
                        selectedItem.resolvedMode,
                      )}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                    {selectedItem.resolvedCompletedSteps.length}/{selectedItem.resolvedSteps.length} Done
                  </span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {selectedItem.resolvedSteps.map((step, idx) => {
                    const checked = selectedItem.resolvedCompletedSteps.includes(idx)
                    const locked =
                      selectedItem.status === 'submitted' || selectedItem.status === 'graded'
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={locked}
                        onClick={() => toggleAssignmentStep(selectedItem.id, idx)}
                        className={`flex w-full items-start gap-3.5 rounded-2xl border p-3.5 text-left transition ${
                          locked ? 'cursor-default' : 'cursor-pointer hover:border-emerald-400'
                        } ${
                          checked
                            ? 'border-emerald-200 bg-emerald-50/70'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black transition ${
                            checked
                              ? 'bg-emerald-600 text-white'
                              : 'border-2 border-slate-300 bg-slate-50 text-slate-400'
                          }`}
                        >
                          {checked ? '✓' : idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-[13px] font-bold leading-snug ${
                              checked ? 'text-slate-400 line-through' : 'text-slate-900'
                            }`}
                          >
                            {step}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* STEP 2: LINKED CHAPTER COURSE MATERIAL & TEACHER'S TIP */}
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowStudyGuide((v) => !v)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span className="flex size-7 items-center justify-center rounded-xl bg-emerald-600 text-xs text-white">
                      📚
                    </span>
                    <div>
                      <span className="block text-xs font-black text-emerald-950">
                        Chapter Notes &amp; Study Pack
                        {linkedMaterialForSelected
                          ? ` · ${linkedMaterialForSelected.chapterTitle}`
                          : selectedItem.chapterTitle
                            ? ` · ${selectedItem.chapterTitle}`
                            : ''}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700">
                        {linkedMaterialForSelected
                          ? `Linked to Course Materials (${linkedMaterialForSelected.topicTitle})`
                          : `Quick Review & Tip from ${selectedItem.teacher}`}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700">
                      {showStudyGuide ? '▾' : '▸'}
                    </span>
                  </button>

                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => {
                        setStudyFocusMaterial({
                          materialId: linkedMaterialForSelected?.id,
                          subject: selectedItem.subject,
                          chapterTitle:
                            linkedMaterialForSelected?.chapterTitle || selectedItem.chapterTitle,
                        })
                        onNavigate('materials')
                      }}
                      className="rounded-full bg-[#0f172a] px-3.5 py-1.5 text-[11px] font-black text-emerald-300 shadow-2xs transition hover:bg-slate-800"
                    >
                      Open Chapter Notes →
                    </button>
                  )}
                </div>

                {showStudyGuide && (
                  <div className="mt-3 space-y-2.5">
                    {linkedMaterialForSelected && (
                      <div className="rounded-xl border border-emerald-200/80 bg-white p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-black text-slate-900">
                            📖 {linkedMaterialForSelected.chapterTitle} —{' '}
                            {linkedMaterialForSelected.topicTitle}
                          </p>
                          {linkedMaterialForSelected.textbookRef && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              {linkedMaterialForSelected.textbookRef}
                            </span>
                          )}
                        </div>
                        {linkedMaterialForSelected.classNotes && (
                          <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[11px] leading-relaxed font-medium text-slate-600">
                            {linkedMaterialForSelected.classNotes}
                          </p>
                        )}
                        {linkedMaterialForSelected.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {linkedMaterialForSelected.attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() =>
                                  void trackCourseMaterialDownload(linkedMaterialForSelected.id)
                                }
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                              >
                                <Icon name="download" size={11} />
                                {att.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-xl bg-white/90 px-3.5 py-2.5 text-xs font-semibold text-emerald-950">
                      <strong>Teacher’s Tip:</strong>{' '}
                      {linkedMaterialForSelected?.examTips || selectedItem.resolvedStudyTip}
                    </div>
                    <ul className="space-y-1 pl-1">
                      {selectedItem.resolvedWhatToStudy.map((topic, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs font-semibold text-slate-700"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-600" />
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* TEACHER GRADE & PRAISE CARD */}
              {selectedItem.status === 'graded' && (
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-emerald-900">
                      🏆 Feedback from {selectedItem.teacher}
                    </span>
                    <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white">
                      {selectedItem.score || 'A+'}
                    </span>
                  </div>
                  {selectedItem.teacherRemark && (
                    <p className="mt-2 text-xs font-bold text-emerald-950">
                      “{selectedItem.teacherRemark}”
                    </p>
                  )}
                </div>
              )}

              {/* STEP 3: TAILORED OFFLINE / ONLINE HAND-IN (STUDENT & GUARDIAN) OR TEACHER GRADING */}
              {!isStaff ? (
                selectedItem.status === 'pending' || selectedItem.status === 'overdue' ? (
                  <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
                    {/* Hybrid Choice Switcher */}
                    {selectedItem.resolvedMode === 'hybrid' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-extrabold text-slate-600">
                          How are you handing this in?
                        </span>
                        <button
                          type="button"
                          onClick={() => setHybridChoice('offline')}
                          className={`rounded-full px-3 py-1 text-[11px] font-black transition ${
                            hybridChoice === 'offline'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-white text-slate-600 ring-1 ring-slate-200'
                          }`}
                        >
                          📓 Done in Physical Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => setHybridChoice('online')}
                          className={`rounded-full px-3 py-1 text-[11px] font-black transition ${
                            hybridChoice === 'online'
                              ? 'bg-sky-600 text-white'
                              : 'bg-white text-slate-600 ring-1 ring-slate-200'
                          }`}
                        >
                          🌐 Submit Online Here
                        </button>
                      </div>
                    )}

                    {activeSubmissionVia === 'offline' ? (
                      <>
                        <div>
                          <p className="text-xs font-black text-slate-900">
                            📓 Finished in your physical copy? Let {selectedItem.teacher} know!
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                            Write your answers neatly in your <strong>{selectedItem.resolvedFormat}</strong>, pack it in your school bag, and tap below to mark ready for class.
                          </p>
                        </div>
                        <input
                          value={submissionNote}
                          onChange={(e) => setSubmissionNote(e.target.value)}
                          placeholder="Optional note (e.g., Done in Maths copy & packed in school bag!)"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-[11px] font-semibold text-amber-800">
                            🎒 Offline Copy · Hand in during class
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setTimerRunning(false)
                              submitAssignment(selectedItem.id, submissionNote, {
                                submittedVia: 'offline',
                              })
                              setSubmissionNote('')
                              setJustSubmittedId(selectedItem.id)
                            }}
                            className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-sm transition hover:bg-amber-400"
                          >
                            <Icon name="check" size={14} />
                            Done in Copy — Packed for Class 📓
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-xs font-black text-slate-900">
                            🌐 Submit Your Work Online (+25 Stars ✨)
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                            Type a short answer or attach a photo/PDF of your work below.
                          </p>
                        </div>
                        <textarea
                          rows={2}
                          value={onlineResponse}
                          onChange={(e) => setOnlineResponse(e.target.value)}
                          placeholder="Type your answer, summary, or link here (optional if attaching a photo/PDF)..."
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-sky-200 bg-white px-3.5 py-1.5 text-[11px] font-extrabold text-sky-800 hover:bg-sky-50">
                            <span>📎 Attach Photo / PDF</span>
                            <input
                              type="file"
                              accept="image/*,.pdf,.doc,.docx"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                setUploadingHwFile(true)
                                setHwUploadError('')
                                const up = await uploadDmhsAttachment(file, 'homework')
                                setUploadingHwFile(false)
                                if (up.ok && up.url) {
                                  setOnlineFileName(up.filename || file.name)
                                  setOnlineFileUrl(up.url)
                                } else {
                                  setHwUploadError(up.error || 'Upload failed')
                                }
                              }}
                            />
                          </label>
                          {uploadingHwFile && (
                            <span className="text-[11px] font-bold text-sky-700">
                              Uploading file...
                            </span>
                          )}
                          {hwUploadError && (
                            <span className="text-[11px] font-bold text-rose-600">
                              {hwUploadError}
                            </span>
                          )}
                          {onlineFileName && !uploadingHwFile && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold text-sky-900">
                              📄 {onlineFileName} {onlineFileUrl ? '✓' : ''}
                              <button
                                type="button"
                                onClick={() => {
                                  setOnlineFileName('')
                                  setOnlineFileUrl('')
                                }}
                                className="font-black text-sky-700 hover:text-rose-600"
                              >
                                ×
                              </button>
                            </span>
                          )}
                        </div>
                        <input
                          value={submissionNote}
                          onChange={(e) => setSubmissionNote(e.target.value)}
                          placeholder={`Optional quick note for ${selectedItem.teacher}...`}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-[11px] font-semibold text-slate-500">
                            Sends straight to {selectedItem.teacher} &amp; notifies {role === 'guardian' ? firstName : 'your parent'}
                          </span>
                          <button
                            type="button"
                            disabled={uploadingHwFile}
                            onClick={() => {
                              setTimerRunning(false)
                              submitAssignment(selectedItem.id, submissionNote, {
                                submittedVia: 'online',
                                onlineResponseText: onlineResponse,
                                onlineAttachmentName: onlineFileName,
                                onlineAttachmentUrl: onlineFileUrl || undefined,
                              })
                              setSubmissionNote('')
                              setOnlineResponse('')
                              setOnlineFileName('')
                              setOnlineFileUrl('')
                              setJustSubmittedId(selectedItem.id)
                            }}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Icon name="check" size={14} />
                            {uploadingHwFile ? 'Uploading...' : 'Submit Online Now 🌐'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-xs font-bold text-emerald-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-base">
                          {selectedItem.offlineReceivedInClass
                            ? '✅'
                            : selectedItem.submittedVia === 'offline' ||
                                selectedItem.resolvedMode === 'offline'
                              ? '📓'
                              : '🎉'}
                        </span>
                        <span>
                          {selectedItem.offlineReceivedInClass
                            ? `Physical copy collected in class by ${selectedItem.teacher}!`
                            : justSubmittedId === selectedItem.id
                              ? selectedItem.submittedVia === 'offline'
                                ? `Awesome! Marked done in copy (+25 Stars) — don’t forget to bring it to ${selectedItem.subject} class!`
                                : `Woohoo! Submitted online — +25 Stars earned and ${selectedItem.teacher} notified!`
                              : selectedItem.submittedVia === 'offline' ||
                                  selectedItem.resolvedMode === 'offline'
                                ? 'Marked done in physical copy — bring to class for teacher check!'
                                : 'Submitted online! Waiting for teacher feedback.'}
                        </span>
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-emerald-700">
                        +25 Stars ★
                      </span>
                    </div>
                    {(selectedItem.onlineAttachmentName || selectedItem.onlineResponseText || selectedItem.studentNote) && (
                      <div className="rounded-xl bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-700">
                        {selectedItem.onlineAttachmentName && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>
                              📎 Attached: <strong>{selectedItem.onlineAttachmentName}</strong>
                            </span>
                            {selectedItem.onlineAttachmentUrl && (
                              <a
                                href={selectedItem.onlineAttachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2.5 py-0.5 text-[10px] font-black text-white hover:bg-sky-700"
                              >
                                {isImageAttachment(selectedItem.onlineAttachmentUrl)
                                  ? 'View Photo ↗'
                                  : 'Download File ↗'}
                              </a>
                            )}
                          </div>
                        )}
                        {selectedItem.onlineResponseText && (
                          <p>💬 Online Answer: {selectedItem.onlineResponseText}</p>
                        )}
                        {selectedItem.studentNote && (
                          <p>📝 Note: “{selectedItem.studentNote}”</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* FAST 1-CLICK TEACHER GRADING + OFFLINE COPY CHECK-IN */
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-black text-slate-900">
                        Faculty Desk · Collect Copy &amp; Grade
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        Class Progress: {selectedItem.classSubmittedCount}/{selectedItem.classTotalCount} students ·{' '}
                        {selectedItem.resolvedMode === 'offline'
                          ? 'Offline Physical Copy'
                          : selectedItem.resolvedMode === 'online'
                            ? 'Online Submission'
                            : 'Hybrid (Copy or Online)'}
                      </p>
                    </div>

                    {/* 1-Click Teacher Offline Copy Received Button */}
                    {(selectedItem.resolvedMode === 'offline' || selectedItem.resolvedMode === 'hybrid') && (
                      selectedItem.offlineReceivedInClass ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800">
                          📓 Physical Copy Collected ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markOfflineCopyReceived(selectedItem.id)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-1.5 text-[11px] font-black text-slate-950 shadow-2xs transition hover:bg-amber-400"
                        >
                          📓 Mark Physical Copy Received in Class
                        </button>
                      )
                    )}
                  </div>

                  {/* Display Student Online Submission / Note if Present */}
                  {(selectedItem.onlineAttachmentName || selectedItem.onlineResponseText || selectedItem.studentNote) && (
                    <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3.5 py-2.5 text-[11px] font-semibold text-emerald-950">
                      {selectedItem.onlineAttachmentName && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            📎 Uploaded File: <strong>{selectedItem.onlineAttachmentName}</strong>
                          </span>
                          {selectedItem.onlineAttachmentUrl && (
                            <a
                              href={selectedItem.onlineAttachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-black text-emerald-300 hover:bg-slate-800"
                            >
                              Open / Download ↗
                            </a>
                          )}
                        </div>
                      )}
                      {selectedItem.onlineResponseText && (
                        <p>🌐 Online Answer: {selectedItem.onlineResponseText}</p>
                      )}
                      {selectedItem.studentNote && (
                        <p>📝 Student/Parent Note: “{selectedItem.studentNote}”</p>
                      )}
                    </div>
                  )}

                  {/* 1-Click Preset Grade Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_GRADES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGradeScore(g)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold transition ${
                          gradeScore === g
                            ? 'bg-[#0f172a] text-emerald-300'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>

                  {/* 1-Click Positive Remark Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_REMARKS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setGradeRemark(r)}
                        className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200 hover:border-emerald-400 hover:text-emerald-700"
                      >
                        + {r}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[130px_1fr_auto]">
                    <input
                      value={gradeScore}
                      onChange={(e) => setGradeScore(e.target.value)}
                      placeholder="19 / 20"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-900 outline-none focus:border-emerald-500"
                    />
                    <input
                      value={gradeRemark}
                      onChange={(e) => setGradeRemark(e.target.value)}
                      placeholder="Write a warm, motivating remark for the student..."
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        gradeAssignment(selectedItem.id, gradeScore, gradeRemark)
                        setGradeRemark('')
                      }}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xs transition hover:bg-emerald-700"
                    >
                      Save Grade ★
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================== 4. CLEAN MODAL FOR TEACHER: ASSIGN NEW HOMEWORK ==================== */}
      {isStaff && showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setShowCreateModal(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handlePublishHomework}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  Offline &amp; Online Homework Publisher
                </p>
                <h3 className="text-lg font-black text-slate-950">Assign New Homework</h3>
                <p className="text-xs font-semibold text-slate-500">
                  Choose whether students bring a physical notebook to class, submit online, or either.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* PROMINENT 3-CARD SUBMISSION MODE SELECTOR */}
            <div className="mt-4">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                How Should Students Submit?
              </label>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    [
                      'offline',
                      '📓 Offline (Physical Copy)',
                      'Write in notebook & bring to class',
                    ],
                    [
                      'online',
                      '🌐 Online (App / Upload)',
                      'Type answer or upload photo/PDF',
                    ],
                    [
                      'hybrid',
                      '🔄 Flexible (Copy or Online)',
                      'Student picks copy or online',
                    ],
                  ] as const
                ).map(([modeVal, title, desc]) => (
                  <button
                    key={modeVal}
                    type="button"
                    onClick={() => {
                      setNewSubmissionMode(modeVal)
                      if (modeVal === 'offline') {
                        setNewFormat(`${newSubject} Homework Exercise Copy`)
                        setNewDropoffLocation(`Bring physical copy to ${newSubject} class`)
                      } else if (modeVal === 'online') {
                        setNewFormat('Online Answer or Photo / PDF Upload')
                      } else {
                        setNewFormat(`${newSubject} Copy (Bring to Class) or Photo Upload`)
                        setNewDropoffLocation(`Bring copy to ${newSubject} class or upload here`)
                      }
                    }}
                    className={`rounded-2xl border-2 p-3 text-left transition ${
                      newSubmissionMode === modeVal
                        ? modeVal === 'offline'
                          ? 'border-amber-500 bg-amber-50/70'
                          : modeVal === 'online'
                            ? 'border-sky-500 bg-sky-50/70'
                            : 'border-teal-500 bg-teal-50/70'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-xs font-black text-slate-900">{title}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 1-Click Friendly Templates */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold text-slate-500">Quick Templates:</span>
              <button
                type="button"
                onClick={() => applyTemplate('offline_copy')}
                className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-extrabold text-amber-900 hover:bg-amber-100"
              >
                📓 15m Daily Copy (Offline)
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('online_digital')}
                className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-extrabold text-sky-800 hover:bg-sky-100"
              >
                🌐 Online Worksheet / Upload
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('offline_lab')}
                className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-extrabold text-teal-800 hover:bg-teal-100"
              >
                🧪 Lab Notebook (Copy or Photo)
              </button>
            </div>

            {/* LINK TO COURSE MATERIAL CHAPTER (AUTO-FILLS SUBJECT, CHAPTER & STUDY NOTES!) */}
            <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-800">
                📚 Link to Course Material Chapter (Optional — Connects Notes &amp; Slides!)
                <select
                  value={newLinkedMaterialId}
                  onChange={(e) => {
                    const matId = e.target.value
                    setNewLinkedMaterialId(matId)
                    const mat = courseMaterials.find((m) => m.id === matId)
                    if (mat) {
                      setNewSubject(mat.subject)
                      setNewChapterTitle(mat.chapterTitle)
                      if (!newTitle.trim()) {
                        setNewTitle(`${mat.chapterTitle}: ${mat.topicTitle} Practice`)
                      }
                      const studyLines = [
                        `${mat.chapterTitle} — ${mat.topicTitle}`,
                        ...(mat.textbookRef ? [mat.textbookRef] : []),
                        ...mat.learningObjectives.slice(0, 2),
                      ]
                      setNewStudyText(studyLines.join('\n'))
                      if (mat.examTips) setNewStudyTip(mat.examTips)
                    }
                  }}
                  className="mt-1.5 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none"
                >
                  <option value="">No specific chapter linked (or pick a chapter below)…</option>
                  {courseMaterials.map((mat) => (
                    <option key={mat.id} value={mat.id}>
                      {mat.subject} · {mat.chapterTitle} — {mat.topicTitle} ({mat.classSection})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Class</label>
                <select
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                >
                  {DMHS_CLASS_SECTIONS.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Subject</label>
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                >
                  {SUBJECT_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">
                  Chapter / Unit
                </label>
                <input
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder="e.g., Chapter 6: Induction"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Homework Title *
              </label>
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Chapter 6 Simple Circuit Sketch & 4 Practice Questions"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Type</label>
                <select
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as HomeworkKind)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Diary Day</label>
                <select
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value as SchoolWeekday)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {DAY_LABELS[d]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Due Date *</label>
                <input
                  type="date"
                  required
                  value={newSubmissionIso}
                  onChange={(e) => setNewSubmissionIso(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Est. Mins</label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={newEstMins}
                  onChange={(e) => setNewEstMins(Number(e.target.value) || 15)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">
                  {newSubmissionMode === 'online' ? 'Online Submission Format' : 'Physical Copy / Material'}
                </label>
                <input
                  value={newFormat}
                  onChange={(e) => setNewFormat(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">
                  {newSubmissionMode === 'online' ? 'Due Time' : 'Where to Hand In Copy'}
                </label>
                {newSubmissionMode === 'online' ? (
                  <input
                    value={newSubmissionTime}
                    onChange={(e) => setNewSubmissionTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                  />
                ) : (
                  <input
                    value={newDropoffLocation}
                    onChange={(e) => setNewDropoffLocation(e.target.value)}
                    placeholder="e.g., Physics Lab 204 or Class 6A Morning Desk"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                  />
                )}
              </div>
            </div>

            <div className="mt-3">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Friendly Instructions
              </label>
              <textarea
                rows={2}
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                placeholder="Keep it clear and encouraging..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium"
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">
                  Student Checklist Steps (1 per line)
                </label>
                <textarea
                  rows={3}
                  value={newStepsText}
                  onChange={(e) => setNewStepsText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">
                  Quick Review Pages (1 per line)
                </label>
                <textarea
                  rows={3}
                  value={newStudyText}
                  onChange={(e) => setNewStudyText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-[10px] font-black uppercase text-slate-400">
                Encouraging Teacher’s Tip
              </label>
              <input
                value={newStudyTip}
                onChange={(e) => setNewStudyTip(e.target.value)}
                placeholder="e.g., Try Q1 first — it takes just 2 minutes!"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
              >
                Publish {newSubmissionMode === 'offline' ? 'Offline' : newSubmissionMode === 'online' ? 'Online' : 'Flexible'} Homework
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
