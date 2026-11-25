'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  consumeStudyFocusMaterial,
  extractChapterNumber,
  findLinkedHomeworksForMaterial,
  getSubjectTheme,
  normalizeChapterKey,
  setStudyFocusHomework,
} from '@/lib/dmhs-study-links'
import { DMHS_CLASS_TAGS } from './data'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type {
  CourseMaterialAttachment,
  CourseMaterialItem,
  HomeworkSubmissionMode,
  SchoolWeekday,
} from './types'
import { PageShell } from './ui'

const WEEKDAYS: SchoolWeekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']
const DAY_FULL: Record<SchoolWeekday, string> = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
}

const DMHS_SUBJECTS = [
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

function teacherAssignedToClass(targetClass: string, assigned: string[]): boolean {
  if (!assigned.length) return false
  const tok = normalizeClassToken(targetClass)
  return assigned.some((c) => normalizeClassToken(c) === tok)
}

function studentMatchesClass(
  stu: { className: string; section: string },
  classSection: string,
): boolean {
  const tok = normalizeClassToken(classSection)
  if (!tok) return false
  if (tok === 'all' || tok === 'allclasses') return true
  const full = normalizeClassToken(`${stu.className} ${stu.section}`)
  const secLetter = stu.section.replace(/section/i, '').trim().toLowerCase()
  const compact = normalizeClassToken(`${stu.className}${secLetter}`)
  const gradeOnly = normalizeClassToken(stu.className)
  return tok === full || tok === compact || tok === gradeOnly
}

function detectAttachmentKind(filename: string, mime: string): CourseMaterialAttachment['kind'] {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx') || mime.includes('presentation')) {
    return 'slides'
  }
  if (lower.endsWith('.pdf') || mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(lower)) return 'image'
  return 'doc'
}

function attachmentBadgeClasses(kind: CourseMaterialAttachment['kind']): string {
  if (kind === 'slides') return 'bg-orange-100 text-orange-800'
  if (kind === 'pdf') return 'bg-rose-100 text-rose-800'
  if (kind === 'image') return 'bg-sky-100 text-sky-800'
  if (kind === 'link') return 'bg-violet-100 text-violet-800'
  return 'bg-slate-100 text-slate-700'
}

export function CourseMaterialsView({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void
}) {
  const {
    role,
    students,
    teachers,
    activeTeacherId,
    activeStudentId,
    selectedChildId,
    timetableSlots,
    assignments,
    quizzes,
    courseMaterials,
    semesterSyllabusConfig,
    createCourseMaterial,
    updateCourseMaterial,
    toggleCourseMaterialPublish,
    duplicateCourseMaterialToClass,
    deleteCourseMaterial,
    trackCourseMaterialDownload,
    toggleCourseMaterialRevised,
    updateSemesterSyllabusConfig,
    createAssignment,
    notify,
  } = useSchool()

  const isTeacher = role === 'teacher'
  const isAdmin = role === 'admin'
  const isCreator = isTeacher || isAdmin

  const activeTeacher = useMemo(
    () => teachers.find((t) => t.id === activeTeacherId) || teachers[0] || null,
    [teachers, activeTeacherId],
  )
  const assignedClasses = useMemo(() => activeTeacher?.assignedClasses || [], [activeTeacher])

  const targetStudentId = role === 'student' ? activeStudentId : selectedChildId
  const targetStudent = useMemo(
    () => students.find((s) => s.id === targetStudentId) || students[0] || null,
    [students, targetStudentId],
  )

  const allowedClassOptions = useMemo(() => {
    if (isAdmin) return [...DMHS_CLASS_TAGS]
    return assignedClasses
  }, [isAdmin, assignedClasses])

  // Role-scoped materials
  const roleScopedMaterials = useMemo(() => {
    if (isAdmin) return courseMaterials
    if (isTeacher) {
      if (!activeTeacher) return []
      return courseMaterials.filter(
        (m) =>
          m.teacherId === activeTeacher.id ||
          m.teacherName.trim().toLowerCase() === activeTeacher.name.trim().toLowerCase() ||
          (m.status === 'published' && teacherAssignedToClass(m.classSection, assignedClasses)),
      )
    }
    if (!targetStudent) return []
    return courseMaterials.filter(
      (m) => m.status === 'published' && studentMatchesClass(targetStudent, m.classSection),
    )
  }, [isAdmin, isTeacher, activeTeacher, assignedClasses, courseMaterials, targetStudent])

  // Filters & view mode (Default: Subject & Chapter-Wise Study Hub!)
  const [viewMode, setViewMode] = useState<'subjects_chapters' | 'timeline' | 'weekly_grid'>(
    'subjects_chapters',
  )
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL')
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({})
  const [classFilter, setClassFilter] = useState<string>('ALL')
  const [weekFilter, setWeekFilter] = useState<number | 'ALL'>('ALL')
  const [dayFilter, setDayFilter] = useState<SchoolWeekday | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Quick "Assign Homework from Chapter" modal state (Teacher / Admin)
  const [hwModalMaterial, setHwModalMaterial] = useState<CourseMaterialItem | null>(null)
  const [hwTitle, setHwTitle] = useState('')
  const [hwMode, setHwMode] = useState<HomeworkSubmissionMode>('offline')
  const [hwDueDate, setHwDueDate] = useState('Due Tomorrow · 08:30 AM')
  const [hwEstMins, setHwEstMins] = useState(20)
  const [hwDropoff, setHwDropoff] = useState('Hand in physical exercise copy in class')
  const [hwInstructions, setHwInstructions] = useState('')

  // Admin flexible semester config editor
  const [editingConfig, setEditingConfig] = useState(false)
  const [cfgTermName, setCfgTermName] = useState(semesterSyllabusConfig.termName)
  const [cfgTotalWeeks, setCfgTotalWeeks] = useState(semesterSyllabusConfig.totalWeeks)
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    setCfgTermName(semesterSyllabusConfig.termName)
    setCfgTotalWeeks(semesterSyllabusConfig.totalWeeks)
  }, [semesterSyllabusConfig.termName, semesterSyllabusConfig.totalWeeks])

  // Reader modal state
  const [readingItem, setReadingItem] = useState<CourseMaterialItem | null>(null)
  const [copyMenuId, setCopyMenuId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Create / Edit Lesson Modal state
  const [showComposer, setShowComposer] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingLesson, setSavingLesson] = useState(false)
  const [composerError, setComposerError] = useState('')

  const [weekNumber, setWeekNumber] = useState<number>(1)
  const [weekLabel, setWeekLabel] = useState<string>('Week 1')
  const [dayOfWeek, setDayOfWeek] = useState<SchoolWeekday>('Sun')
  const [lessonDate, setLessonDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [periodTime, setPeriodTime] = useState<string>('08:30 AM – 09:15 AM')
  const [classSection, setClassSection] = useState<string>(allowedClassOptions[0] || '')
  const [subject, setSubject] = useState<string>(activeTeacher?.subject || 'Physics')
  const [chapterNumber, setChapterNumber] = useState<number>(1)
  const [chapterTitle, setChapterTitle] = useState<string>('')
  const [topicTitle, setTopicTitle] = useState<string>('')
  const [objectivesText, setObjectivesText] = useState<string>('')
  const [classNotes, setClassNotes] = useState<string>('')
  const [examTips, setExamTips] = useState<string>('')
  const [textbookRef, setTextbookRef] = useState<string>('')
  const [attachments, setAttachments] = useState<CourseMaterialAttachment[]>([])
  const [linkedHomeworkId, setLinkedHomeworkId] = useState<string>('')
  const [linkedQuizId, setLinkedQuizId] = useState<string>('')
  const [lessonStatus, setLessonStatus] = useState<'draft' | 'published'>('published')

  // File & link upload helpers
  const attachFileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  // Teacher's own timetable slots for 1-click auto-fill
  const myRoutineSlots = useMemo(() => {
    if (!activeTeacher) return timetableSlots.slice(0, 12)
    if (isAdmin) return timetableSlots
    return timetableSlots.filter(
      (s) =>
        s.teacherId === activeTeacher.id ||
        s.teacherName.trim().toLowerCase() === activeTeacher.name.trim().toLowerCase(),
    )
  }, [timetableSlots, activeTeacher, isAdmin])

  // Consume deep-link handoff from Homework ("Open Full Chapter Notes →")
  useEffect(() => {
    const focus = consumeStudyFocusMaterial()
    if (!focus) return
    setViewMode('subjects_chapters')
    if (focus.subject) setSubjectFilter(focus.subject)
    if (focus.materialId) {
      const target = roleScopedMaterials.find((m) => m.id === focus.materialId)
      if (target) {
        setSubjectFilter(target.subject)
        setReadingItem(target)
      }
    }
  }, [roleScopedMaterials])

  const filteredMaterials = useMemo(() => {
    return roleScopedMaterials
      .filter((m) => {
        if (subjectFilter !== 'ALL' && m.subject !== subjectFilter) return false
        if (isCreator && classFilter !== 'ALL') {
          if (normalizeClassToken(m.classSection) !== normalizeClassToken(classFilter)) return false
        }
        if (weekFilter !== 'ALL' && m.weekNumber !== weekFilter) return false
        if (dayFilter !== 'ALL' && m.dayOfWeek !== dayFilter) return false
        if (isCreator && statusFilter !== 'all' && m.status !== statusFilter) return false
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase()
          const hay =
            `${m.topicTitle} ${m.chapterTitle} ${m.subject} ${m.classSection} ${m.classNotes} ${m.weekLabel}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        const chA = extractChapterNumber(a.chapterTitle, a.chapterNumber)
        const chB = extractChapterNumber(b.chapterTitle, b.chapterNumber)
        if (chA !== chB) return chA - chB
        if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber
        return WEEKDAYS.indexOf(a.dayOfWeek) - WEEKDAYS.indexOf(b.dayOfWeek)
      })
  }, [
    roleScopedMaterials,
    subjectFilter,
    isCreator,
    classFilter,
    weekFilter,
    dayFilter,
    statusFilter,
    searchQuery,
  ])

  // Subject-Wise Summary Shelf (chapters, lessons, files, linked homework, revision %)
  const subjectCatalog = useMemo(() => {
    const map = new Map<
      string,
      {
        subject: string
        items: CourseMaterialItem[]
        chapterKeys: Set<string>
        filesCount: number
        revisedCount: number
        homeworkIds: Set<string>
        pendingHwCount: number
      }
    >()
    const baseItems = roleScopedMaterials.filter((m) => {
      if (isCreator && classFilter !== 'ALL') {
        if (normalizeClassToken(m.classSection) !== normalizeClassToken(classFilter)) return false
      }
      if (isCreator && statusFilter !== 'all' && m.status !== statusFilter) return false
      return true
    })
    for (const item of baseItems) {
      let bucket = map.get(item.subject)
      if (!bucket) {
        bucket = {
          subject: item.subject,
          items: [],
          chapterKeys: new Set<string>(),
          filesCount: 0,
          revisedCount: 0,
          homeworkIds: new Set<string>(),
          pendingHwCount: 0,
        }
        map.set(item.subject, bucket)
      }
      bucket.items.push(item)
      bucket.chapterKeys.add(normalizeChapterKey(item.chapterTitle))
      bucket.filesCount += item.attachments?.length || 0
      if (targetStudent && item.revisedByStudentIds?.includes(targetStudent.id)) {
        bucket.revisedCount += 1
      }
      const linkedHws = findLinkedHomeworksForMaterial(
        item,
        assignments,
        isCreator ? undefined : targetStudent?.id,
      )
      for (const hw of linkedHws) {
        if (!bucket.homeworkIds.has(hw.id)) {
          bucket.homeworkIds.add(hw.id)
          if (hw.status === 'pending' || hw.status === 'overdue') {
            bucket.pendingHwCount += 1
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.subject.localeCompare(b.subject))
  }, [roleScopedMaterials, isCreator, classFilter, statusFilter, targetStudent, assignments])

  // Nested Subject -> Ordered Chapters -> Lessons tree
  const groupedBySubjectAndChapter = useMemo(() => {
    const subjMap = new Map<
      string,
      Map<
        string,
        {
          key: string
          chapterNumber: number
          chapterTitle: string
          items: CourseMaterialItem[]
        }
      >
    >()
    for (const item of filteredMaterials) {
      let chapMap = subjMap.get(item.subject)
      if (!chapMap) {
        chapMap = new Map()
        subjMap.set(item.subject, chapMap)
      }
      const cKey = normalizeChapterKey(item.chapterTitle)
      const existing = chapMap.get(cKey)
      const cNum = extractChapterNumber(item.chapterTitle, item.chapterNumber)
      if (existing) {
        existing.items.push(item)
        existing.chapterNumber = Math.min(existing.chapterNumber, cNum)
      } else {
        chapMap.set(cKey, {
          key: `${item.subject}::${cKey}`,
          chapterNumber: cNum,
          chapterTitle: item.chapterTitle || 'Chapter 1: Core Module',
          items: [item],
        })
      }
    }
    return Array.from(subjMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([subj, cMap]) => ({
        subject: subj,
        chapters: Array.from(cMap.values()).sort((a, b) =>
          a.chapterNumber !== b.chapterNumber
            ? a.chapterNumber - b.chapterNumber
            : a.chapterTitle.localeCompare(b.chapterTitle),
        ),
      }))
  }, [filteredMaterials])

  // Existing chapter suggestions for the composer datalist
  const existingChaptersForSubject = useMemo(() => {
    const set = new Set<string>()
    roleScopedMaterials
      .filter((m) => m.subject === subject && m.chapterTitle)
      .forEach((m) => set.add(m.chapterTitle))
    return Array.from(set).sort()
  }, [roleScopedMaterials, subject])

  const openAssignHomeworkFromMaterial = (mat: CourseMaterialItem) => {
    setHwModalMaterial(mat)
    setHwTitle(`${mat.chapterTitle}: ${mat.topicTitle} Practice`)
    setHwMode('offline')
    setHwDueDate('Due Next Class · 08:30 AM')
    setHwEstMins(20)
    setHwDropoff(`Bring ${mat.subject} exercise copy to ${mat.classSection} class`)
    setHwInstructions(
      `Review "${mat.topicTitle}" (${mat.chapterTitle}) notes and complete the practice exercises neatly.`,
    )
  }

  const handleSubmitChapterHomework = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hwModalMaterial || !hwTitle.trim()) return
    const steps =
      hwModalMaterial.learningObjectives.length > 0
        ? [
            `Read "${hwModalMaterial.topicTitle}" notes & slides in Course Materials`,
            ...hwModalMaterial.learningObjectives.slice(0, 2).map((o) => `Practice: ${o}`),
            hwMode === 'offline'
              ? 'Pack your exercise copy in your bag & tap Done'
              : 'Upload your work or submit online',
          ]
        : [
            `Read "${hwModalMaterial.topicTitle}" in Course Materials`,
            'Complete all assigned questions neatly',
            hwMode === 'offline'
              ? 'Bring your exercise copy to class'
              : 'Submit your answer online',
          ]

    createAssignment({
      title: hwTitle.trim(),
      subject: hwModalMaterial.subject,
      className: hwModalMaterial.classSection,
      kind: 'Daily Homework',
      submissionMode: hwMode,
      offlineDropoffLocation: hwMode === 'online' ? undefined : hwDropoff.trim(),
      assignedDay: hwModalMaterial.dayOfWeek,
      dueDate: hwDueDate.trim() || 'Due Next Class',
      estimatedMins: hwEstMins,
      instructions: hwInstructions.trim(),
      howToSteps: steps,
      whatToStudy: [
        `${hwModalMaterial.chapterTitle} — ${hwModalMaterial.topicTitle}`,
        ...(hwModalMaterial.textbookRef ? [hwModalMaterial.textbookRef] : []),
        ...hwModalMaterial.learningObjectives.slice(0, 2),
      ],
      studyTip: hwModalMaterial.examTips,
      chapterTitle: hwModalMaterial.chapterTitle,
      linkedMaterialId: hwModalMaterial.id,
    })
    setHwModalMaterial(null)
  }

  const handleJumpToHomework = (homeworkId: string) => {
    setStudyFocusHomework(homeworkId)
    setReadingItem(null)
    onNavigate?.('assignments')
  }

  // Dynamic list of active weeks (adapts automatically to whatever weeks exist — never fixed!)
  const dynamicWeeksPresent = useMemo(() => {
    const set = new Set<number>()
    roleScopedMaterials.forEach((m) => set.add(m.weekNumber))
    return Array.from(set).sort((a, b) => a - b)
  }, [roleScopedMaterials])

  const groupedByWeek = useMemo(() => {
    const map = new Map<number, { label: string; items: CourseMaterialItem[] }>()
    for (const item of filteredMaterials) {
      const existing = map.get(item.weekNumber)
      if (existing) {
        existing.items.push(item)
      } else {
        map.set(item.weekNumber, {
          label: item.weekLabel || `Week ${item.weekNumber}`,
          items: [item],
        })
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [filteredMaterials])

  const canTeacherModifyItem = (item: CourseMaterialItem): boolean => {
    if (isAdmin) return true
    if (!isTeacher || !activeTeacher) return false
    return (
      item.teacherId === activeTeacher.id ||
      item.teacherName.trim().toLowerCase() === activeTeacher.name.trim().toLowerCase()
    )
  }

  const openCreateModal = (
    presetWeek?: number,
    presetDay?: SchoolWeekday,
    presetSubject?: string,
    presetChapterTitle?: string,
    presetChapterNum?: number,
  ) => {
    const nextSuggestedWeek =
      presetWeek ??
      (dynamicWeeksPresent.length > 0
        ? Math.min(52, dynamicWeeksPresent[dynamicWeeksPresent.length - 1])
        : 1)
    setEditingId(null)
    setComposerError('')
    setWeekNumber(nextSuggestedWeek)
    setWeekLabel(`Week ${nextSuggestedWeek}`)
    setDayOfWeek(presetDay || 'Sun')
    setLessonDate(new Date().toISOString().slice(0, 10))
    setPeriodTime('08:30 AM – 09:15 AM')
    setClassSection(
      classFilter !== 'ALL' && allowedClassOptions.includes(classFilter as never)
        ? classFilter
        : allowedClassOptions[0] || '',
    )
    const targetSubj =
      presetSubject ||
      (subjectFilter !== 'ALL' ? subjectFilter : '') ||
      (activeTeacher?.subject && DMHS_SUBJECTS.includes(activeTeacher.subject as never)
        ? activeTeacher.subject
        : 'Physics')
    setSubject(targetSubj)
    setChapterNumber(
      presetChapterNum ||
        (presetChapterTitle ? extractChapterNumber(presetChapterTitle) : 1),
    )
    setChapterTitle(presetChapterTitle || '')
    setTopicTitle('')
    setObjectivesText('')
    setClassNotes('')
    setExamTips('')
    setTextbookRef('')
    setAttachments([])
    setLinkedHomeworkId('')
    setLinkedQuizId('')
    setLessonStatus('published')
    setLinkTitle('')
    setLinkUrl('')
    setShowComposer(true)
  }

  const openEditModal = (item: CourseMaterialItem) => {
    setEditingId(item.id)
    setComposerError('')
    setWeekNumber(item.weekNumber)
    setWeekLabel(item.weekLabel || `Week ${item.weekNumber}`)
    setDayOfWeek(item.dayOfWeek)
    setLessonDate(item.lessonDate)
    setPeriodTime(item.periodTime || '')
    const matchedClass =
      allowedClassOptions.find(
        (c) => normalizeClassToken(c) === normalizeClassToken(item.classSection),
      ) ||
      allowedClassOptions[0] ||
      item.classSection
    setClassSection(matchedClass)
    setSubject(item.subject)
    setChapterNumber(extractChapterNumber(item.chapterTitle, item.chapterNumber) === 999 ? 1 : extractChapterNumber(item.chapterTitle, item.chapterNumber))
    setChapterTitle(item.chapterTitle)
    setTopicTitle(item.topicTitle)
    setObjectivesText(item.learningObjectives.join('\n'))
    setClassNotes(item.classNotes)
    setExamTips(item.examTips || '')
    setTextbookRef(item.textbookRef || '')
    setAttachments(item.attachments || [])
    setLinkedHomeworkId(item.linkedHomeworkId || '')
    setLinkedQuizId(item.linkedQuizId || '')
    setLessonStatus(item.status)
    setLinkTitle('')
    setLinkUrl('')
    setShowComposer(true)
  }

  const handleAutoFillFromRoutine = (slotId: string) => {
    const slot = myRoutineSlots.find((s) => s.id === slotId)
    if (!slot) return
    setDayOfWeek(slot.day)
    setPeriodTime(slot.timeLabel)
    const matchedClass = allowedClassOptions.find(
      (c) => normalizeClassToken(c) === normalizeClassToken(slot.className),
    )
    if (matchedClass) setClassSection(matchedClass)
    if (slot.subject) setSubject(slot.subject)
    notify(`Auto-filled from routine: ${slot.day} · ${slot.timeLabel} · ${slot.className} (${slot.subject})`)
  }

  const handleAttachFile = async (file: File | null) => {
    if (!file) return
    setUploadingFile(true)
    setComposerError('')
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = String(reader.result || '')
      const kind = detectAttachmentKind(file.name, file.type)
      const sizeKb = Math.max(1, Math.round(file.size / 1024))
      const sizeLabel = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`

      try {
        const res = await fetch('/dmhs-api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl,
            filename: file.name,
            folder: 'course-materials',
          }),
        })
        const json = (await res.json()) as { ok?: boolean; url?: string; error?: string }
        if (res.ok && json.ok && json.url) {
          setAttachments((prev) => [
            ...prev,
            {
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              name: file.name,
              kind,
              url: json.url!,
              sizeLabel,
            },
          ])
          notify(`Uploaded "${file.name}" to DMHA server storage`)
        } else {
          setComposerError(json.error || 'Unsupported file format or size limit exceeded.')
        }
      } catch {
        setComposerError('Network error while uploading file.')
      } finally {
        setUploadingFile(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleAddExternalLink = () => {
    const cleanUrl = linkUrl.trim()
    const cleanTitle = linkTitle.trim() || 'Interactive Study Link'
    if (!cleanUrl) return
    const normalizedUrl = /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl}`
    setAttachments((prev) => [
      ...prev,
      {
        id: `link-${Date.now()}`,
        name: cleanTitle,
        kind: 'link',
        url: normalizedUrl,
        sizeLabel: 'External Resource',
      },
    ])
    setLinkTitle('')
    setLinkUrl('')
  }

  const handleSaveLesson = async (e: React.FormEvent, overrideStatus?: 'draft' | 'published') => {
    e.preventDefault()
    setComposerError('')
    if (!topicTitle.trim()) {
      setComposerError('Lesson Topic Title is required.')
      return
    }
    if (!classSection.trim()) {
      setComposerError('Please select a target class section.')
      return
    }

    const finalStatus = overrideStatus ?? lessonStatus
    const objectives = objectivesText
      .split('\n')
      .map((l) => l.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)

    const payload = {
      termName: semesterSyllabusConfig.termName,
      weekNumber: Math.max(1, Math.min(52, Math.round(weekNumber || 1))),
      weekLabel: weekLabel.trim() || `Week ${weekNumber}`,
      dayOfWeek,
      lessonDate,
      periodTime: periodTime.trim() || undefined,
      classSection,
      subject,
      chapterNumber: Math.max(1, Math.min(99, Math.round(chapterNumber || 1))),
      chapterTitle: chapterTitle.trim() || `Chapter ${chapterNumber || 1}: Core Module`,
      topicTitle: topicTitle.trim(),
      learningObjectives: objectives,
      classNotes: classNotes.trim(),
      examTips: examTips.trim() || undefined,
      textbookRef: textbookRef.trim() || undefined,
      attachments,
      linkedHomeworkId: linkedHomeworkId || undefined,
      linkedQuizId: linkedQuizId || undefined,
      status: finalStatus,
    }

    setSavingLesson(true)
    const res = editingId
      ? await updateCourseMaterial(editingId, payload)
      : await createCourseMaterial(payload)
    setSavingLesson(false)

    if (!res.ok) {
      setComposerError(res.error || 'Could not save course material.')
      return
    }
    setShowComposer(false)
    setEditingId(null)
  }

  const handleSaveSemesterConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingConfig(true)
    const res = await updateSemesterSyllabusConfig({
      termName: cfgTermName,
      totalWeeks: cfgTotalWeeks,
    })
    setSavingConfig(false)
    if (res.ok) setEditingConfig(false)
  }

  // KPI summary stats
  const publishedCount = roleScopedMaterials.filter((m) => m.status === 'published').length
  const draftCount = roleScopedMaterials.filter((m) => m.status === 'draft').length
  const totalFilesCount = roleScopedMaterials.reduce(
    (sum, m) => sum + (m.attachments?.length || 0),
    0,
  )
  const totalDownloads = roleScopedMaterials.reduce((sum, m) => sum + (m.downloads || 0), 0)
  const studentRevisedCount = targetStudent
    ? roleScopedMaterials.filter((m) => m.revisedByStudentIds?.includes(targetStudent.id)).length
    : 0

  return (
    <PageShell
      eyebrow={`${semesterSyllabusConfig.termName} · Flexible ${semesterSyllabusConfig.totalWeeks}-Week Semester Plan`}
      title={
        isCreator
          ? 'Course Materials, Class Notes & Semester Syllabus'
          : `Course Materials & Study Notes${targetStudent ? ` · ${targetStudent.className} ${targetStudent.section}` : ''}`
      }
      subtitle={
        isTeacher
          ? `Plan every day’s topic, write structured class notes, and upload slides or PDFs across your assigned classes (${assignedClasses.join(', ') || 'None'}).`
          : isAdmin
            ? 'Configure flexible semester duration, oversee lesson plans, and review uploaded slides & notes across all DMHA classes.'
            : 'Access every published lecture’s class notes, slides, PDF handouts, and mark topics as Revised ✓ for exam preparation.'
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setEditingConfig((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:border-emerald-400"
            >
              <Icon name="calendar" size={14} className="text-emerald-600" />
              Semester Weeks ({semesterSyllabusConfig.totalWeeks}w)
            </button>
          )}
          {isCreator && (
            <button
              type="button"
              disabled={isTeacher && assignedClasses.length === 0}
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-black text-emerald-300 shadow-sm transition hover:bg-slate-800 disabled:opacity-45"
            >
              <Icon name="plus" size={14} />
              Add Class Topic &amp; Materials
            </button>
          )}
        </div>
      }
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      {/* Admin Flexible Semester Weeks Config Bar */}
      {isAdmin && editingConfig && (
        <form
          onSubmit={(e) => void handleSaveSemesterConfig(e)}
          className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs"
        >
          <label className="min-w-[200px] flex-1 font-bold text-slate-700">
            Active Semester / Term Name
            <input
              required
              value={cfgTermName}
              onChange={(e) => setCfgTermName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none"
            />
          </label>
          <label className="w-44 font-bold text-slate-700">
            Semester Weeks (Flexible: 1–52)
            <input
              type="number"
              min={1}
              max={52}
              required
              value={cfgTotalWeeks}
              onChange={(e) => setCfgTotalWeeks(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={savingConfig}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {savingConfig ? 'Saving…' : 'Save Semester Config'}
          </button>
        </form>
      )}

      {/* Teacher Assigned-Class Security Banner */}
      {isTeacher && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Icon name="shield" size={16} />
            </div>
            <div>
              <div className="font-black">
                Assigned-Class Course Materials · {activeTeacher?.name}
              </div>
              <div className="text-emerald-800/80">
                Create lessons across any number of semester weeks (flexible schedule), save private
                Drafts, or Publish slides &amp; notes strictly to your assigned classes.
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

      {/* KPI Strip */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-hero rounded-2xl p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            {isCreator ? 'Planned Semester Lessons' : 'Published Class Lessons'}
          </p>
          <p className="mt-1.5 text-3xl font-black">{roleScopedMaterials.length}</p>
          <p className="mt-1 text-xs text-slate-300">
            {isCreator
              ? `${publishedCount} Published · ${draftCount} Drafts`
              : `Across ${dynamicWeeksPresent.length} active week(s)`}
          </p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Slides, PDFs &amp; Links
          </p>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{totalFilesCount}</p>
          <p className="mt-0.5 text-xs text-slate-500">Uploaded decks, handouts &amp; diagrams</p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            {isCreator ? 'Student Downloads' : 'My Revision Progress'}
          </p>
          <p className="mt-1.5 text-2xl font-black text-emerald-700">
            {isCreator
              ? totalDownloads
              : `${studentRevisedCount}/${roleScopedMaterials.length}`}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {isCreator ? 'Total slide & note accesses' : 'Lessons marked Revised ✓'}
          </p>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Subjects &amp; Chapters
          </p>
          <p className="mt-1.5 text-2xl font-black text-slate-900">
            {subjectCatalog.length} Subj ·{' '}
            {subjectCatalog.reduce((sum, s) => sum + s.chapterKeys.size, 0)} Ch.
          </p>
          <p className="mt-0.5 text-xs text-emerald-700">
            {subjectCatalog.reduce((sum, s) => sum + s.homeworkIds.size, 0)} linked homework task(s)
          </p>
        </div>
      </div>

      {/* SUBJECT-WISE QUICK CARDS SHELF */}
      {subjectCatalog.length > 0 && (
        <div className="mb-5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Browse by Subject ({subjectCatalog.length})
            </p>
            {subjectFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSubjectFilter('ALL')}
                className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-extrabold text-slate-700 hover:bg-slate-200"
              >
                Show All Subjects ×
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {subjectCatalog.map((entry) => {
              const theme = getSubjectTheme(entry.subject)
              const active = subjectFilter === entry.subject
              const revisedPct =
                entry.items.length > 0
                  ? Math.round((entry.revisedCount / entry.items.length) * 100)
                  : 0
              return (
                <button
                  key={entry.subject}
                  type="button"
                  onClick={() => {
                    setSubjectFilter(active ? 'ALL' : entry.subject)
                    setViewMode('subjects_chapters')
                  }}
                  className={`group rounded-2xl border p-3.5 text-left transition ${
                    active
                      ? 'border-slate-900 bg-[#0f172a] text-white shadow-md'
                      : 'border-slate-200/80 bg-white hover:border-emerald-400 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-base ${
                        active ? 'bg-white/10' : theme.softBg
                      }`}
                    >
                      {theme.emoji}
                    </span>
                    {entry.homeworkIds.size > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          active
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : entry.pendingHwCount > 0
                              ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                              : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        }`}
                      >
                        📝 {entry.homeworkIds.size} HW
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-2.5 truncate text-xs font-black ${
                      active ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {entry.subject}
                  </p>
                  <p
                    className={`mt-0.5 text-[10px] font-bold ${
                      active ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {entry.chapterKeys.size} {entry.chapterKeys.size === 1 ? 'Chapter' : 'Chapters'}{' '}
                    · {entry.items.length} {entry.items.length === 1 ? 'Topic' : 'Topics'}
                    {entry.filesCount > 0 ? ` · ${entry.filesCount} Files` : ''}
                  </p>
                  {!isCreator && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className={active ? 'text-emerald-300' : 'text-emerald-700'}>
                          {revisedPct}% Revised
                        </span>
                        <span className={active ? 'text-slate-400' : 'text-slate-400'}>
                          {entry.revisedCount}/{entry.items.length}
                        </span>
                      </div>
                      <div
                        className={`mt-1 h-1.5 w-full overflow-hidden rounded-full ${
                          active ? 'bg-white/15' : 'bg-slate-100'
                        }`}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${
                            active ? 'bg-emerald-400' : theme.barBg
                          }`}
                          style={{ width: `${revisedPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter & View Switcher Bar */}
      <div className="mb-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Icon
              name="search"
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subject, chapter, topic, or class notes..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode('subjects_chapters')}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                  viewMode === 'subjects_chapters'
                    ? 'bg-[#0f172a] text-emerald-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📚 Subjects &amp; Chapters
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                  viewMode === 'timeline'
                    ? 'bg-[#0f172a] text-emerald-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🗓️ Semester Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode('weekly_grid')}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                  viewMode === 'weekly_grid'
                    ? 'bg-[#0f172a] text-emerald-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📅 Sun–Thu Grid
              </button>
            </div>

            {isCreator && (
              <div className="flex rounded-xl bg-slate-100 p-1">
                {(['all', 'published', 'draft'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold capitalize ${
                      statusFilter === st
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Class & Dynamic Week Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {isCreator && (
              <>
                <button
                  type="button"
                  onClick={() => setClassFilter('ALL')}
                  className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                    classFilter === 'ALL'
                      ? 'bg-[#0f172a] text-emerald-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isTeacher ? 'All Assigned Classes' : 'All Classes'}
                </button>
                {allowedClassOptions.map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setClassFilter(cls)}
                    className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                      classFilter === cls
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setWeekFilter('ALL')}
              className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                weekFilter === 'ALL'
                  ? 'bg-[#0f172a] text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Weeks
            </button>
            {dynamicWeeksPresent.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeekFilter(w)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                  weekFilter === w
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                W{w}
              </button>
            ))}
            {viewMode === 'timeline' && (
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value as SchoolWeekday | 'ALL')}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 outline-none"
              >
                <option value="ALL">All Days (Sun–Thu)</option>
                {WEEKDAYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_FULL[d]}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ==================== VIEW 0 (DEFAULT): SUBJECT & CHAPTER-WISE STUDY HUB ==================== */}
      {viewMode === 'subjects_chapters' && (
        <div className="space-y-7">
          {groupedBySubjectAndChapter.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="text-sm font-black text-slate-800">No Chapters Match This Filter</p>
              <p className="mt-1 text-xs text-slate-500">
                {isCreator
                  ? 'Click "Add Class Topic & Materials" to create subject & chapter study notes.'
                  : 'Try clearing your subject, week, or search filter to see all chapters.'}
              </p>
              {subjectFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    setSubjectFilter('ALL')
                    setWeekFilter('ALL')
                    setSearchQuery('')
                  }}
                  className="mt-4 rounded-full bg-[#0f172a] px-5 py-2 text-xs font-black text-emerald-300"
                >
                  Show All Subjects
                </button>
              )}
            </div>
          ) : (
            groupedBySubjectAndChapter.map((subjGroup) => {
              const theme = getSubjectTheme(subjGroup.subject)
              const totalTopics = subjGroup.chapters.reduce((s, c) => s + c.items.length, 0)
              return (
                <section key={subjGroup.subject} className="space-y-3.5">
                  {/* Subject Section Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0f172a] px-5 py-3.5 text-white shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-xl">
                        {theme.emoji}
                      </span>
                      <div>
                        <h3 className="text-base font-black tracking-tight">{subjGroup.subject}</h3>
                        <p className="text-[11px] font-semibold text-emerald-300/90">
                          {subjGroup.chapters.length}{' '}
                          {subjGroup.chapters.length === 1 ? 'Chapter' : 'Chapters'} · {totalTopics}{' '}
                          {totalTopics === 1 ? 'Lesson Topic' : 'Lesson Topics'}
                        </p>
                      </div>
                    </div>
                    {isCreator && (
                      <button
                        type="button"
                        onClick={() =>
                          openCreateModal(
                            undefined,
                            undefined,
                            subjGroup.subject,
                            `Chapter ${subjGroup.chapters.length + 1}: `,
                            subjGroup.chapters.length + 1,
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-[11px] font-black text-slate-950 transition hover:bg-emerald-400"
                      >
                        <Icon name="plus" size={12} />
                        Add {subjGroup.subject} Chapter
                      </button>
                    )}
                  </div>

                  {/* Chapter-Wise Accordion Cards */}
                  <div className="space-y-3">
                    {subjGroup.chapters.map((chap) => {
                      const isCollapsed = Boolean(collapsedChapters[chap.key])
                      const chapRevisedCount = targetStudent
                        ? chap.items.filter((m) =>
                            m.revisedByStudentIds?.includes(targetStudent.id),
                          ).length
                        : 0
                      const chapFilesCount = chap.items.reduce(
                        (s, m) => s + (m.attachments?.length || 0),
                        0,
                      )
                      const chapHomeworks = (() => {
                        const map = new Map<string, (typeof assignments)[number]>()
                        for (const m of chap.items) {
                          findLinkedHomeworksForMaterial(
                            m,
                            assignments,
                            isCreator ? undefined : targetStudent?.id,
                          ).forEach((hw) => map.set(hw.id, hw))
                        }
                        return Array.from(map.values())
                      })()
                      const chapPendingHw = chapHomeworks.filter(
                        (h) => h.status === 'pending' || h.status === 'overdue',
                      ).length

                      return (
                        <div
                          key={chap.key}
                          className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-2xs"
                        >
                          {/* Chapter Header */}
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedChapters((prev) => ({
                                  ...prev,
                                  [chap.key]: !prev[chap.key],
                                }))
                              }
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              <span
                                className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${theme.badgeBg} ${theme.badgeText} ring-1 ${theme.ring}`}
                              >
                                {chap.chapterNumber < 999 ? `Ch ${chap.chapterNumber}` : 'Unit'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="truncate text-sm font-black text-slate-900">
                                    {chap.chapterTitle}
                                  </h4>
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-slate-600 ring-1 ring-slate-200">
                                    {chap.items.length}{' '}
                                    {chap.items.length === 1 ? 'Topic' : 'Topics'}
                                    {chapFilesCount > 0 ? ` · ${chapFilesCount} Files` : ''}
                                  </span>
                                  {chapHomeworks.length > 0 && (
                                    <span
                                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                                        chapPendingHw > 0
                                          ? 'bg-amber-100 text-amber-900'
                                          : 'bg-emerald-100 text-emerald-800'
                                      }`}
                                    >
                                      {chapPendingHw > 0
                                        ? `📝 ${chapPendingHw} Homework To Do`
                                        : `✅ ${chapHomeworks.length} Homework Done`}
                                    </span>
                                  )}
                                  {!isCreator && targetStudent && (
                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                      {chapRevisedCount}/{chap.items.length} Revised ✓
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs font-black text-slate-400">
                                {isCollapsed ? '▸' : '▾'}
                              </span>
                            </button>

                            {isCreator && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openCreateModal(
                                      chap.items[0]?.weekNumber,
                                      undefined,
                                      subjGroup.subject,
                                      chap.chapterTitle,
                                      chap.chapterNumber < 999 ? chap.chapterNumber : 1,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-extrabold text-slate-700 hover:border-emerald-400 hover:text-emerald-800"
                                >
                                  <Icon name="plus" size={11} />
                                  Add Topic
                                </button>
                                {chap.items[0] && (
                                  <button
                                    type="button"
                                    onClick={() => openAssignHomeworkFromMaterial(chap.items[0])}
                                    className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-black text-white hover:bg-emerald-700"
                                  >
                                    📝 Assign Homework
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Chapter Lesson Cards */}
                          {!isCollapsed && (
                            <div className="grid gap-4 p-4 md:grid-cols-2">
                              {chap.items.map((item) => {
                                const editable = canTeacherModifyItem(item)
                                const isRevised =
                                  targetStudent &&
                                  item.revisedByStudentIds?.includes(targetStudent.id)
                                const linkedHws = findLinkedHomeworksForMaterial(
                                  item,
                                  assignments,
                                  isCreator ? undefined : targetStudent?.id,
                                )

                                return (
                                  <article
                                    key={item.id}
                                    className={`flex flex-col justify-between rounded-2xl border p-4 transition hover:border-emerald-300 hover:shadow-sm ${
                                      item.status === 'draft'
                                        ? 'border-amber-200 bg-amber-50/25'
                                        : 'border-slate-200/80 bg-white'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
                                            {item.weekLabel} · {DAY_FULL[item.dayOfWeek]}
                                          </span>
                                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                                            {item.classSection}
                                          </span>
                                        </div>
                                        <span
                                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                            item.status === 'published'
                                              ? 'bg-emerald-50 text-emerald-700'
                                              : 'bg-amber-200 text-amber-950'
                                          }`}
                                        >
                                          {item.status === 'published' ? 'Published' : 'Draft'}
                                        </span>
                                      </div>

                                      <h5 className="mt-2.5 text-sm font-black text-slate-900">
                                        {item.topicTitle}
                                      </h5>
                                      {item.textbookRef && (
                                        <p className="mt-0.5 text-[11px] font-bold text-emerald-700">
                                          📖 {item.textbookRef}
                                        </p>
                                      )}
                                      <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                                        {item.classNotes || 'Click Read Notes & Slides to study.'}
                                      </p>

                                      {/* Attached Slides / PDFs / Links */}
                                      {item.attachments.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                          {item.attachments.map((att) => (
                                            <a
                                              key={att.id}
                                              href={att.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              onClick={() =>
                                                void trackCourseMaterialDownload(item.id)
                                              }
                                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-extrabold transition hover:opacity-85 ${attachmentBadgeClasses(att.kind)}`}
                                            >
                                              <Icon name="download" size={11} />
                                              <span className="max-w-[170px] truncate">
                                                {att.name}
                                              </span>
                                            </a>
                                          ))}
                                        </div>
                                      )}

                                      {/* CONNECTED HOMEWORK BRIDGE STRIP */}
                                      {linkedHws.length > 0 ? (
                                        <div className="mt-3 space-y-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50/55 p-2.5">
                                          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                                            Connected Homework ({linkedHws.length})
                                          </p>
                                          {linkedHws.map((hw) => {
                                            const hwDone =
                                              hw.status === 'submitted' || hw.status === 'graded'
                                            const modeBadge =
                                              hw.submissionMode === 'online'
                                                ? '🌐 Online'
                                                : hw.submissionMode === 'hybrid'
                                                  ? '🔄 Copy/Online'
                                                  : '📓 Offline Copy'
                                            return (
                                              <div
                                                key={hw.id}
                                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2 text-[11px] shadow-2xs"
                                              >
                                                <div className="min-w-0 flex-1">
                                                  <p className="truncate font-black text-slate-900">
                                                    {hw.title}
                                                  </p>
                                                  <p className="text-[10px] font-semibold text-slate-500">
                                                    {modeBadge} · {hw.dueDate}
                                                  </p>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                  <span
                                                    className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                                                      hwDone
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-amber-100 text-amber-900'
                                                    }`}
                                                  >
                                                    {hw.status === 'graded'
                                                      ? hw.score || 'Graded'
                                                      : hw.status === 'submitted'
                                                        ? 'Done ✓'
                                                        : 'To Do'}
                                                  </span>
                                                  {onNavigate && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleJumpToHomework(hw.id)}
                                                      className="rounded-full bg-[#0f172a] px-2.5 py-1 text-[10px] font-black text-emerald-300 hover:bg-slate-800"
                                                    >
                                                      Open HW →
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      ) : (
                                        isCreator && (
                                          <button
                                            type="button"
                                            onClick={() => openAssignHomeworkFromMaterial(item)}
                                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 px-3 py-2 text-[11px] font-extrabold text-emerald-800 transition hover:bg-emerald-50"
                                          >
                                            📝 + Assign Homework Linked to This Topic
                                          </button>
                                        )
                                      )}
                                    </div>

                                    {/* Card Footer Actions */}
                                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setReadingItem(item)}
                                          className="inline-flex items-center gap-1 rounded-full bg-[#0f172a] px-3 py-1.5 text-[11px] font-black text-emerald-300 hover:bg-slate-800"
                                        >
                                          <Icon name="book" size={12} />
                                          Read Notes
                                        </button>
                                        {!isCreator && targetStudent && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              void toggleCourseMaterialRevised(
                                                item.id,
                                                targetStudent.id,
                                              )
                                            }
                                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black transition ${
                                              isRevised
                                                ? 'bg-emerald-600 text-white'
                                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                            }`}
                                          >
                                            <Icon name="check" size={11} />
                                            {isRevised ? 'Revised ✓' : 'Mark Revised'}
                                          </button>
                                        )}
                                      </div>

                                      {editable && (
                                        <div className="flex flex-wrap items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => openEditModal(item)}
                                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            disabled={busyId === item.id}
                                            onClick={async () => {
                                              setBusyId(item.id)
                                              await toggleCourseMaterialPublish(item.id)
                                              setBusyId(null)
                                            }}
                                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                                          >
                                            {item.status === 'published' ? 'Unpublish' : 'Publish'}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </article>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })
          )}
        </div>
      )}

      {/* ==================== VIEW 1: SEMESTER WEEK-BY-WEEK TIMELINE ==================== */}
      {viewMode === 'timeline' && (
        <div className="space-y-6">
          {groupedByWeek.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="text-sm font-black text-slate-800">No Course Materials Match This View</p>
              <p className="mt-1 text-xs text-slate-500">
                {isCreator
                  ? 'Click "Add Class Topic & Materials" to plan any week, write class notes, and upload slides or PDFs.'
                  : 'Your teachers have not published course materials matching this filter yet.'}
              </p>
              {isCreator && (
                <button
                  type="button"
                  onClick={() => openCreateModal()}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700"
                >
                  <Icon name="plus" size={14} />
                  Add First Semester Lesson
                </button>
              )}
            </div>
          ) : (
            groupedByWeek.map(([wkNum, group]) => (
              <section key={wkNum} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-[#0f172a] text-xs font-black text-emerald-300">
                      W{wkNum}
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">{group.label}</h3>
                      <p className="text-[11px] text-slate-500">
                        {group.items.length} planned{' '}
                        {group.items.length === 1 ? 'lesson' : 'lessons'}
                      </p>
                    </div>
                  </div>
                  {isCreator && (
                    <button
                      type="button"
                      onClick={() => openCreateModal(wkNum)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-800 hover:bg-emerald-100"
                    >
                      <Icon name="plus" size={12} />
                      Add to {group.label}
                    </button>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {group.items.map((item) => {
                    const editable = canTeacherModifyItem(item)
                    const isRevised =
                      targetStudent && item.revisedByStudentIds?.includes(targetStudent.id)
                    const otherAssignedTargets = allowedClassOptions.filter(
                      (c) => normalizeClassToken(c) !== normalizeClassToken(item.classSection),
                    )

                    return (
                      <article
                        key={item.id}
                        className={`flex flex-col justify-between rounded-3xl border bg-white p-5 shadow-2xs transition hover:border-emerald-300 hover:shadow-md ${
                          item.status === 'draft'
                            ? 'border-amber-200 bg-amber-50/20'
                            : 'border-slate-200/80'
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
                                {DAY_FULL[item.dayOfWeek]} · {item.lessonDate}
                              </span>
                              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                                {item.classSection} · {item.subject}
                              </span>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                                item.status === 'published'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-200 text-amber-950'
                              }`}
                            >
                              {item.status === 'published' ? 'Published' : 'Teacher Draft'}
                            </span>
                          </div>

                          <p className="mt-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            {item.chapterTitle}
                            {item.periodTime ? ` · ${item.periodTime}` : ''}
                          </p>
                          <h4 className="mt-0.5 text-base font-black text-slate-900">
                            {item.topicTitle}
                          </h4>
                          <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                            {item.classNotes || 'Click Read Notes & Slides to view details.'}
                          </p>

                          {/* Attached Slides / PDFs / Links Pills */}
                          {item.attachments.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {item.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={att.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => void trackCourseMaterialDownload(item.id)}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-extrabold transition hover:opacity-85 ${attachmentBadgeClasses(att.kind)}`}
                                >
                                  <Icon name="download" size={11} />
                                  <span className="max-w-[160px] truncate">{att.name}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setReadingItem(item)}
                              className="inline-flex items-center gap-1 rounded-full bg-[#0f172a] px-3.5 py-1.5 text-[11px] font-black text-emerald-300 hover:bg-slate-800"
                            >
                              <Icon name="book" size={12} />
                              Read Notes &amp; Slides
                            </button>

                            {!isCreator && targetStudent && (
                              <button
                                type="button"
                                onClick={() =>
                                  void toggleCourseMaterialRevised(item.id, targetStudent.id)
                                }
                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black transition ${
                                  isRevised
                                    ? 'bg-emerald-600 text-white'
                                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <Icon name="check" size={12} />
                                {isRevised ? 'Revised ✓' : 'Mark Revised'}
                              </button>
                            )}
                          </div>

                          {editable && (
                            <div className="relative flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={async () => {
                                  setBusyId(item.id)
                                  await toggleCourseMaterialPublish(item.id)
                                  setBusyId(null)
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                              >
                                {item.status === 'published' ? 'Unpublish' : 'Publish'}
                              </button>

                              {otherAssignedTargets.length > 0 && (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCopyMenuId((p) => (p === item.id ? null : item.id))
                                    }
                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                                  >
                                    Copy to…
                                  </button>
                                  {copyMenuId === item.id && (
                                    <div className="absolute right-0 bottom-8 z-20 min-w-[140px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                      <p className="px-2 py-1 text-[10px] font-black uppercase text-slate-400">
                                        Copy to Class
                                      </p>
                                      {otherAssignedTargets.map((cls) => (
                                        <button
                                          key={cls}
                                          type="button"
                                          onClick={async () => {
                                            setCopyMenuId(null)
                                            setBusyId(item.id)
                                            await duplicateCourseMaterialToClass(item.id, cls)
                                            setBusyId(null)
                                          }}
                                          className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                                        >
                                          → {cls}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {confirmDeleteId === item.id ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setBusyId(item.id)
                                    await deleteCourseMaterial(item.id)
                                    setBusyId(null)
                                    setConfirmDeleteId(null)
                                  }}
                                  className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-black text-white"
                                >
                                  Confirm
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  className="rounded-lg px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {/* ==================== VIEW 2: SUN–THU WEEKLY CALENDAR GRID ==================== */}
      {viewMode === 'weekly_grid' && (
        <div className="grid gap-3 md:grid-cols-5">
          {WEEKDAYS.map((day) => {
            const dayItems = filteredMaterials.filter((m) => m.dayOfWeek === day)
            return (
              <div
                key={day}
                className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <p className="text-xs font-black text-slate-900">{DAY_FULL[day]}</p>
                    <p className="text-[10px] font-bold text-slate-400">
                      {dayItems.length} {dayItems.length === 1 ? 'topic' : 'topics'}
                    </p>
                  </div>
                  {isCreator && (
                    <button
                      type="button"
                      onClick={() =>
                        openCreateModal(typeof weekFilter === 'number' ? weekFilter : 1, day)
                      }
                      title={`Add lesson on ${DAY_FULL[day]}`}
                      className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      <Icon name="plus" size={13} />
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-2.5">
                  {dayItems.length === 0 ? (
                    <p className="py-6 text-center text-[11px] font-medium text-slate-400">
                      No class materials scheduled
                    </p>
                  ) : (
                    dayItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setReadingItem(item)}
                        className="block w-full rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50/30"
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px] font-black">
                          <span className="text-emerald-700">
                            {item.weekLabel} · {item.classSection}
                          </span>
                          {item.status === 'draft' && (
                            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[9px] text-amber-950">
                              Draft
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-black text-slate-900">{item.topicTitle}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                          {item.subject}
                          {item.attachments.length > 0
                            ? ` · ${item.attachments.length} file(s)`
                            : ''}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ==================== FULL NOTES & SLIDES READER MODAL ==================== */}
      {readingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setReadingItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
                    {readingItem.weekLabel} · {DAY_FULL[readingItem.dayOfWeek]} ({readingItem.lessonDate})
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                    {readingItem.classSection} · {readingItem.subject}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  {readingItem.chapterTitle}
                </p>
                <h2 className="mt-0.5 text-xl font-black text-slate-900">
                  {readingItem.topicTitle}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  By <strong>{readingItem.teacherName}</strong>
                  {readingItem.periodTime ? ` · ${readingItem.periodTime}` : ''} ·{' '}
                  {readingItem.downloads} downloads
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReadingItem(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {readingItem.learningObjectives.length > 0 && (
                <div className="rounded-2xl bg-emerald-50/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                    Learning Objectives
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs font-semibold text-emerald-950">
                    {readingItem.learningObjectives.map((obj, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Icon name="check" size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Structured Class Notes
                </p>
                <div className="mt-2 whitespace-pre-line rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs leading-6 text-slate-800">
                  {readingItem.classNotes || 'No written notes added for this class.'}
                </div>
              </div>

              {(readingItem.examTips || readingItem.textbookRef) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {readingItem.examTips && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950">
                      <p className="text-[10px] font-black uppercase text-amber-800">Exam Tip</p>
                      <p className="mt-1 font-semibold">{readingItem.examTips}</p>
                    </div>
                  )}
                  {readingItem.textbookRef && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-800">
                      <p className="text-[10px] font-black uppercase text-slate-400">
                        Textbook Reference
                      </p>
                      <p className="mt-1 font-semibold">{readingItem.textbookRef}</p>
                    </div>
                  )}
                </div>
              )}

              {readingItem.attachments.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Uploaded Slides, Handouts &amp; Links ({readingItem.attachments.length})
                  </p>
                  <div className="mt-2 space-y-2">
                    {readingItem.attachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => void trackCourseMaterialDownload(readingItem.id)}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs transition hover:border-emerald-400 hover:bg-emerald-50/30"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${attachmentBadgeClasses(att.kind)}`}
                          >
                            {att.kind}
                          </span>
                          <div>
                            <p className="font-black text-slate-900">{att.name}</p>
                            {att.sizeLabel && (
                              <p className="text-[10px] text-slate-400">{att.sizeLabel}</p>
                            )}
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 font-black text-emerald-700">
                          <Icon name="download" size={13} />
                          Open
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected Homework / Quiz Shortcuts */}
              {(() => {
                const modalLinkedHws = findLinkedHomeworksForMaterial(
                  readingItem,
                  assignments,
                  isCreator ? undefined : targetStudent?.id,
                )
                return (
                  <div className="space-y-2.5 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Connected Chapter Homework ({modalLinkedHws.length})
                      </p>
                      {isCreator && (
                        <button
                          type="button"
                          onClick={() => {
                            const mat = readingItem
                            setReadingItem(null)
                            openAssignHomeworkFromMaterial(mat)
                          }}
                          className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-black text-white hover:bg-emerald-700"
                        >
                          + Assign Homework for This Topic
                        </button>
                      )}
                    </div>
                    {modalLinkedHws.length > 0 ? (
                      <div className="space-y-2">
                        {modalLinkedHws.map((hw) => (
                          <div
                            key={hw.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-xs"
                          >
                            <div>
                              <p className="font-black text-slate-900">{hw.title}</p>
                              <p className="text-[11px] font-semibold text-slate-600">
                                {hw.submissionMode === 'online'
                                  ? '🌐 Online'
                                  : hw.submissionMode === 'hybrid'
                                    ? '🔄 Copy or Online'
                                    : '📓 Offline Physical Copy'}{' '}
                                · {hw.dueDate}
                              </p>
                            </div>
                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => handleJumpToHomework(hw.id)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-black text-emerald-300 hover:bg-slate-800"
                              >
                                <Icon name="sheet" size={13} />
                                Open in Homework →
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-semibold text-slate-400">
                        No homework linked to this topic yet.
                      </p>
                    )}

                    {readingItem.linkedQuizId && onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          setReadingItem(null)
                          onNavigate('quizzes')
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-black text-emerald-300 hover:bg-slate-800"
                      >
                        <Icon name="play" size={13} />
                        Take Linked Online Quiz →
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
              >
                <Icon name="print" size={14} />
                Print Study Notes
              </button>
              <button
                type="button"
                onClick={() => setReadingItem(null)}
                className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-black text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CREATE / EDIT COURSE MATERIAL MODAL ==================== */}
      {showComposer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setShowComposer(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {editingId ? 'Edit Semester Lesson & Materials' : 'Add Class Topic, Notes & Slides'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Flexible semester schedule — assign any week, day, class, notes, and slides.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* 1-Click Auto-Fill from Teacher's Routine */}
            {myRoutineSlots.length > 0 && !editingId && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                <label className="block text-[11px] font-black text-emerald-900">
                  Quick Fill from My Weekly Class Routine (Optional)
                  <select
                    defaultValue=""
                    onChange={(e) => handleAutoFillFromRoutine(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="">Select a scheduled period to auto-fill day, time & class…</option>
                    {myRoutineSlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {DAY_FULL[slot.day]} · {slot.timeLabel} · {slot.className} ·{' '}
                        {slot.subject} ({slot.room})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {composerError && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
                {composerError}
              </div>
            )}

            <form onSubmit={(e) => void handleSaveLesson(e)} className="mt-4 space-y-4">
              {/* Flexible Week, Day, Date & Class Row */}
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-bold text-slate-700">
                  Week # (Flexible: 1–52) *
                  <input
                    type="number"
                    min={1}
                    max={52}
                    required
                    value={weekNumber}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(52, Number(e.target.value) || 1))
                      setWeekNumber(n)
                      if (!weekLabel || /^Week \d+$/i.test(weekLabel.trim())) {
                        setWeekLabel(`Week ${n}`)
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-black outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="text-xs font-bold text-slate-700">
                  Week / Unit Label
                  <input
                    value={weekLabel}
                    onChange={(e) => setWeekLabel(e.target.value)}
                    placeholder="e.g., Week 5 or Revision Week"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="text-xs font-bold text-slate-700">
                  Day of Week *
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value as SchoolWeekday)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                  >
                    {WEEKDAYS.map((d) => (
                      <option key={d} value={d}>
                        {DAY_FULL[d]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-bold text-slate-700">
                  Lesson Date *
                  <input
                    type="date"
                    required
                    value={lessonDate}
                    onChange={(e) => setLessonDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="text-xs font-bold text-slate-700">
                  Target Class {isTeacher ? '(Assigned Only)' : ''} *
                  <select
                    value={classSection}
                    onChange={(e) => setClassSection(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                  >
                    {allowedClassOptions.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-bold text-slate-700">
                  Subject *
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                  >
                    {DMHS_SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Chapter #, Chapter Title & Topic */}
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="text-xs font-bold text-slate-700">
                  Chapter #
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={chapterNumber}
                    onChange={(e) => setChapterNumber(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-black outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="text-xs font-bold text-slate-700 sm:col-span-3">
                  Chapter / Module Name (groups topics chapter-wise) *
                  <input
                    list="dmhs-chapter-suggestions"
                    value={chapterTitle}
                    onChange={(e) => {
                      const val = e.target.value
                      setChapterTitle(val)
                      const parsed = extractChapterNumber(val)
                      if (parsed < 999) setChapterNumber(parsed)
                    }}
                    placeholder="e.g., Chapter 5: Magnetism & Electromagnets"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                  <datalist id="dmhs-chapter-suggestions">
                    {existingChaptersForSubject.map((ch) => (
                      <option key={ch} value={ch} />
                    ))}
                  </datalist>
                </label>
                <label className="text-xs font-bold text-slate-700 sm:col-span-4">
                  Class Topic Title *
                  <input
                    required
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    placeholder="e.g., Magnetic Fields, Electromagnets & Compass Experiment"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </label>
              </div>

              {/* Learning Objectives & Full Structured Class Notes */}
              <label className="block text-xs font-bold text-slate-700">
                Learning Objectives (one bullet per line)
                <textarea
                  rows={2}
                  value={objectivesText}
                  onChange={(e) => setObjectivesText(e.target.value)}
                  placeholder={`Define magnetic field lines\nBuild a simple electromagnet with a coil and battery`}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs font-semibold outline-none focus:border-emerald-500"
                />
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Class Notes, Formulas &amp; Worked Examples
                <textarea
                  rows={5}
                  value={classNotes}
                  onChange={(e) => setClassNotes(e.target.value)}
                  placeholder="Write detailed class notes, key definitions, formulas, and worked examples for students to study..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs leading-5 font-medium outline-none focus:border-emerald-500"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-bold text-slate-700">
                  Period Time
                  <input
                    value={periodTime}
                    onChange={(e) => setPeriodTime(e.target.value)}
                    placeholder="08:30 AM – 09:15 AM"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="text-xs font-bold text-slate-700">
                  Textbook Reference
                  <input
                    value={textbookRef}
                    onChange={(e) => setTextbookRef(e.target.value)}
                    placeholder="e.g., Science Book · Pages 72–77"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="text-xs font-bold text-slate-700">
                  Exam Tip (Optional)
                  <input
                    value={examTips}
                    onChange={(e) => setExamTips(e.target.value)}
                    placeholder="e.g., Remember N→S field arrows"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </label>
              </div>

              {/* Slides, PDFs & External Links Uploader */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-slate-900">
                      Upload Slides, PDFs, Diagrams or Add Study Links
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Supports PPTX, PPT, PDF, DOCX, XLSX, PNG, JPG, TXT (up to 15 MB each).
                    </p>
                  </div>
                  <input
                    ref={attachFileInputRef}
                    type="file"
                    accept=".pptx,.ppt,.pdf,.docx,.doc,.xlsx,.csv,.txt,.md,image/*"
                    className="hidden"
                    onChange={(e) => void handleAttachFile(e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    disabled={uploadingFile}
                    onClick={() => attachFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f172a] px-3.5 py-2 text-xs font-black text-emerald-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Icon name="plus" size={13} />
                    {uploadingFile ? 'Uploading…' : 'Upload Slide / PDF / Image'}
                  </button>
                </div>

                {/* Add External Video / Slides Link */}
                <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                  <input
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Link label (e.g., YouTube Lab Video)"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none"
                  />
                  <input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddExternalLink}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100"
                  >
                    + Add Link
                  </button>
                </div>

                {attachments.length > 0 && (
                  <div className="space-y-1.5">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${attachmentBadgeClasses(att.kind)}`}
                          >
                            {att.kind}
                          </span>
                          <span className="font-bold text-slate-800">{att.name}</span>
                          {att.sizeLabel && (
                            <span className="text-[10px] text-slate-400">({att.sizeLabel})</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                          }
                          className="text-xs font-bold text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional Connected Homework & Quiz Links */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700">
                  Link Related Homework (Optional)
                  <select
                    value={linkedHomeworkId}
                    onChange={(e) => setLinkedHomeworkId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none"
                  >
                    <option value="">None</option>
                    {assignments.slice(0, 15).map((hw) => (
                      <option key={hw.id} value={hw.id}>
                        {hw.subject} — {hw.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-bold text-slate-700">
                  Link Related Online Quiz (Optional)
                  <select
                    value={linkedQuizId}
                    onChange={(e) => setLinkedQuizId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none"
                  >
                    <option value="">None</option>
                    {quizzes.slice(0, 15).map((qz) => (
                      <option key={qz.id} value={qz.id}>
                        {qz.className} · {qz.subject} — {qz.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Footer Actions: Save as Draft OR Publish */}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowComposer(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingLesson}
                  onClick={(e) => void handleSaveLesson(e, 'draft')}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  Save Private Draft
                </button>
                <button
                  type="button"
                  disabled={savingLesson}
                  onClick={(e) => void handleSaveLesson(e, 'published')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Icon name="check" size={14} />
                  {savingLesson
                    ? 'Saving to SQLite…'
                    : editingId
                      ? 'Save & Publish Lesson'
                      : `Publish to ${classSection}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== 1-CLICK ASSIGN HOMEWORK FROM CHAPTER MODAL ==================== */}
      {isCreator && hwModalMaterial && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setHwModalMaterial(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmitChapterHomework}
            className="max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  Auto-Linked Chapter Homework
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  Assign Homework from Chapter
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {hwModalMaterial.subject} · {hwModalMaterial.classSection} ·{' '}
                  <strong>{hwModalMaterial.chapterTitle}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHwModalMaterial(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ['offline', '📓 Offline Copy', 'Bring notebook to class'],
                  ['online', '🌐 Online Upload', 'Type or upload photo/PDF'],
                  ['hybrid', '🔄 Flexible', 'Copy or Online'],
                ] as const
              ).map(([mVal, label, sub]) => (
                <button
                  key={mVal}
                  type="button"
                  onClick={() => setHwMode(mVal)}
                  className={`rounded-2xl border-2 p-2.5 text-left transition ${
                    hwMode === mVal
                      ? 'border-emerald-600 bg-emerald-50/70'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <p className="text-xs font-black text-slate-900">{label}</p>
                  <p className="text-[10px] font-semibold text-slate-500">{sub}</p>
                </button>
              ))}
            </div>

            <label className="block text-xs font-bold text-slate-700">
              Homework Title *
              <input
                required
                value={hwTitle}
                onChange={(e) => setHwTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-slate-700">
                Due Date Label *
                <input
                  required
                  value={hwDueDate}
                  onChange={(e) => setHwDueDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Estimated Time (mins)
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={hwEstMins}
                  onChange={(e) => setHwEstMins(Math.max(5, Number(e.target.value) || 15))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black outline-none"
                />
              </label>
            </div>

            {hwMode !== 'online' && (
              <label className="block text-xs font-bold text-slate-700">
                Physical Copy Drop-off Note
                <input
                  value={hwDropoff}
                  onChange={(e) => setHwDropoff(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2 text-xs font-semibold outline-none"
                />
              </label>
            )}

            <label className="block text-xs font-bold text-slate-700">
              Instructions for Students
              <textarea
                rows={3}
                value={hwInstructions}
                onChange={(e) => setHwInstructions(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium outline-none"
              />
            </label>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5 text-[11px] font-bold text-emerald-900">
              🔗 Students will automatically see <strong>{hwModalMaterial.topicTitle}</strong> notes
              &amp; slides inside this Homework task, and this Homework will appear right under{' '}
              <strong>{hwModalMaterial.chapterTitle}</strong>.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setHwModalMaterial(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-black text-emerald-300 hover:bg-slate-800"
              >
                Publish Linked Homework ✓
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
