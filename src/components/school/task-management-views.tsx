'use client'

import React, { useMemo, useState } from 'react'
import { getTaskProgressPct, isTaskOverdue, scopeTasksForActor } from '@/lib/dmhs-tasks'
import { isImageAttachment, uploadDmhsAttachment } from '@/lib/dmhs-upload-client'
import { Icon } from './icons'
import { useSchool } from './store'
import type { CampusTaskItem } from './types'
import { PageShell } from './ui'

const DEPARTMENTS: CampusTaskItem['department'][] = [
  'Academics',
  'Administration',
  'Accounts',
  'Operations',
  'IT & Media',
]

const PRIORITIES: CampusTaskItem['priority'][] = ['Urgent', 'High', 'Medium', 'Low']

const STATUS_COLUMNS: Array<{
  key: CampusTaskItem['status']
  label: string
  shortLabel: string
  pillClass: string
  dotClass: string
}> = [
  {
    key: 'todo',
    label: 'To Do',
    shortLabel: 'To Do',
    pillClass: 'bg-slate-100 text-slate-700',
    dotClass: 'bg-slate-400',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    shortLabel: 'In Progress',
    pillClass: 'bg-sky-100 text-sky-800',
    dotClass: 'bg-sky-500',
  },
  {
    key: 'in_review',
    label: 'In Review',
    shortLabel: 'Review',
    pillClass: 'bg-amber-100 text-amber-900',
    dotClass: 'bg-amber-500',
  },
  {
    key: 'completed',
    label: 'Completed',
    shortLabel: 'Done',
    pillClass: 'bg-emerald-100 text-emerald-800',
    dotClass: 'bg-emerald-500',
  },
]

const TASK_TEMPLATES = [
  {
    label: '📋 Exam Prep',
    department: 'Academics' as const,
    priority: 'Urgent' as const,
    categoryTag: 'Exam Prep',
    title: 'Prepare Term Exam Question Papers & Room Seat Plan',
    notes: 'Verify syllabus coverage, proofread question sets, and confirm bench seating.',
    subtasks: [
      'Review final syllabus & marks distribution',
      'Upload proofread question packet to Exam Management',
      'Confirm room invigilator schedule & bench counts',
    ],
  },
  {
    label: '💰 Fee Reconciliation',
    department: 'Accounts' as const,
    priority: 'High' as const,
    categoryTag: 'Finance Audit',
    title: 'Reconcile Monthly Tuition, Bus & Online Gateway Vouchers',
    notes: 'Verify Trial Balance Dr === Cr and flag any overdue accounts for reminder dispatch.',
    subtasks: [
      'Cross-check bKash / SSLCommerz settlements against Credit Vouchers',
      'Verify Trial Balance & P&L statement',
      'Upload signed monthly reconciliation summary',
    ],
  },
  {
    label: '🔬 Lab / Stock Check',
    department: 'Operations' as const,
    priority: 'Medium' as const,
    categoryTag: 'Lab / Stock',
    title: 'Conduct Science Lab Equipment & Campus Stock Inventory Check',
    notes: 'Count apparatus, note damaged items, and update Campus Stock registers.',
    subtasks: [
      'Inspect lab apparatus & consumables',
      'Log missing or low-stock items in Stock Management',
      'Submit restock requisition if needed',
    ],
  },
  {
    label: '📢 Event & Circular',
    department: 'Administration' as const,
    priority: 'High' as const,
    categoryTag: 'School Event',
    title: 'Coordinate Upcoming School Event & Parent Circular',
    notes: 'Finalize venue timeline, student consent forms, and guardian notice.',
    subtasks: [
      'Draft event schedule & duty roster',
      'Publish parent circular in Notices & Consent Forms',
      'Confirm stage, sound, and student seating setup',
    ],
  },
]

function priorityBadgeClass(priority: CampusTaskItem['priority']): string {
  if (priority === 'Urgent') return 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'
  if (priority === 'High') return 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
  if (priority === 'Medium') return 'bg-sky-50 text-sky-800 ring-1 ring-sky-200'
  return 'bg-slate-100 text-slate-600'
}

function dueBadgeInfo(task: CampusTaskItem): { label: string; cls: string } {
  if (task.status === 'completed') {
    return { label: `Done ${task.completedAt || task.dueDate}`, cls: 'text-emerald-700' }
  }
  if (!task.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
    return { label: `Due ${task.dueDate || 'TBD'}`, cls: 'text-slate-500' }
  }
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  if (task.dueDate < todayIso) {
    return { label: `Overdue · ${task.dueDate}`, cls: 'text-rose-600 font-black' }
  }
  if (task.dueDate === todayIso) {
    return { label: 'Due Today', cls: 'text-amber-700 font-black' }
  }
  const diffDays = Math.ceil(
    (new Date(`${task.dueDate}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) /
      86400000,
  )
  if (diffDays === 1) return { label: 'Due Tomorrow', cls: 'text-amber-700 font-bold' }
  return { label: `Due in ${diffDays}d (${task.dueDate})`, cls: 'text-slate-500 font-semibold' }
}

export function TaskManagementView() {
  const {
    role,
    campusTasks,
    teachers,
    staffMembers,
    activeTeacherId,
    activeStaffMember,
    runTaskAction,
  } = useSchool()

  const isAdmin = role === 'admin'
  const linkedEntityId =
    role === 'teacher' ? activeTeacherId : role === 'staff' ? activeStaffMember?.id || '' : 'admin'

  // Strict client mirror of server privacy scoping (Admin sees all; Teacher/Staff see strictly their own)
  const visibleTasks = useMemo(
    () => scopeTasksForActor(campusTasks, role, linkedEntityId, teachers, staffMembers),
    [campusTasks, role, linkedEntityId, teachers, staffMembers],
  )

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [searchQuery, setSearchQuery] = useState('')
  const [deptFilter, setDeptFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL')
  const [onlyOverdue, setOnlyOverdue] = useState(false)

  // Task Detail Drawer / Modal State
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const activeTask = useMemo(
    () => visibleTasks.find((t) => t.id === activeTaskId) || null,
    [visibleTasks, activeTaskId],
  )
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [commentText, setCommentText] = useState('')
  const [commentFileName, setCommentFileName] = useState('')
  const [commentFileUrl, setCommentFileUrl] = useState('')
  const [uploadingCommentFile, setUploadingCommentFile] = useState(false)

  // Admin "+ Assign New Task" Modal State
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState<CampusTaskItem['department']>('Academics')
  const [categoryTag, setCategoryTag] = useState('Academic Ops')
  const [selectedAssigneeKey, setSelectedAssigneeKey] = useState(
    teachers[0] ? `teacher:${teachers[0].id}` : staffMembers[0] ? `staff:${staffMembers[0].id}` : '',
  )
  const [priority, setPriority] = useState<CampusTaskItem['priority']>('High')
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().slice(0, 10)
  })
  const [notes, setNotes] = useState('')
  const [subtasksText, setSubtasksText] = useState('')
  const [briefFileName, setBriefFileName] = useState('')
  const [briefFileUrl, setBriefFileUrl] = useState('')
  const [uploadingBriefFile, setUploadingBriefFile] = useState(false)

  const assigneeDirectory = useMemo(
    () => [
      ...teachers.map((t) => ({
        key: `teacher:${t.id}`,
        id: t.id,
        name: t.name,
        role: 'teacher' as const,
        label: `${t.name} · ${t.subject} Teacher`,
      })),
      ...staffMembers.map((s) => ({
        key: `staff:${s.id}`,
        id: s.id,
        name: s.name,
        role: 'staff' as const,
        label: `${s.name} · ${s.department} Staff`,
      })),
    ],
    [teachers, staffMembers],
  )

  const filteredTasks = useMemo(() => {
    const prioRank: Record<CampusTaskItem['priority'], number> = {
      Urgent: 0,
      High: 1,
      Medium: 2,
      Low: 3,
    }
    return visibleTasks
      .filter((t) => {
        if (deptFilter !== 'ALL' && t.department !== deptFilter) return false
        if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false
        if (isAdmin && assigneeFilter !== 'ALL' && t.assigneeName !== assigneeFilter) return false
        if (onlyOverdue && !isTaskOverdue(t)) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const hay =
            `${t.title} ${t.assigneeName} ${t.department} ${t.notes || ''} ${t.categoryTag || ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (prioRank[a.priority] !== prioRank[b.priority]) {
          return prioRank[a.priority] - prioRank[b.priority]
        }
        return (a.dueDate || '').localeCompare(b.dueDate || '')
      })
  }, [visibleTasks, deptFilter, priorityFilter, isAdmin, assigneeFilter, onlyOverdue, searchQuery])

  // KPI Metrics
  const activeCount = visibleTasks.filter(
    (t) => t.status === 'todo' || t.status === 'in_progress',
  ).length
  const reviewCount = visibleTasks.filter((t) => t.status === 'in_review').length
  const completedCount = visibleTasks.filter((t) => t.status === 'completed').length
  const urgentOrOverdueCount = visibleTasks.filter(
    (t) => t.status !== 'completed' && (t.priority === 'Urgent' || isTaskOverdue(t)),
  ).length
  const completionRate =
    visibleTasks.length > 0 ? Math.round((completedCount / visibleTasks.length) * 100) : 100

  // Admin per-assignee active workload pills
  const workloadByAssignee = useMemo(() => {
    const map = new Map<string, { name: string; active: number; total: number }>()
    visibleTasks.forEach((t) => {
      const cur = map.get(t.assigneeName) || { name: t.assigneeName, active: 0, total: 0 }
      cur.total += 1
      if (t.status !== 'completed') cur.active += 1
      map.set(t.assigneeName, cur)
    })
    return Array.from(map.values()).sort((a, b) => b.active - a.active)
  }, [visibleTasks])

  const applyTemplate = (tpl: (typeof TASK_TEMPLATES)[number]) => {
    setTitle(tpl.title)
    setDepartment(tpl.department)
    setPriority(tpl.priority)
    setCategoryTag(tpl.categoryTag)
    setNotes(tpl.notes)
    setSubtasksText(tpl.subtasks.join('\n'))
  }

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || uploadingBriefFile) return
    const target =
      assigneeDirectory.find((a) => a.key === selectedAssigneeKey) || assigneeDirectory[0]
    if (!target) return
    const subtasks = subtasksText
      .split('\n')
      .map((s) => s.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)

    const res = await runTaskAction(
      {
        action: 'create_task',
        title: title.trim(),
        department,
        categoryTag: categoryTag.trim() || undefined,
        assigneeId: target.id,
        assigneeName: target.name,
        assigneeRole: target.role,
        priority,
        dueDate,
        notes: notes.trim(),
        subtasks,
        attachmentName: briefFileName || undefined,
        attachmentUrl: briefFileUrl || undefined,
      },
      `Task assigned to ${target.name}!`,
    )
    if (res.ok) {
      setTitle('')
      setNotes('')
      setSubtasksText('')
      setBriefFileName('')
      setBriefFileUrl('')
      setShowAssignModal(false)
    }
  }

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTask || !newSubtaskTitle.trim()) return
    const res = await runTaskAction({
      action: 'add_subtask',
      taskId: activeTask.id,
      title: newSubtaskTitle.trim(),
    })
    if (res.ok) setNewSubtaskTitle('')
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTask || (!commentText.trim() && !commentFileName) || uploadingCommentFile) return
    const res = await runTaskAction(
      {
        action: 'add_comment',
        taskId: activeTask.id,
        text: commentText.trim(),
        attachmentName: commentFileName || undefined,
        attachmentUrl: commentFileUrl || undefined,
      },
      'Progress update posted!',
    )
    if (res.ok) {
      setCommentText('')
      setCommentFileName('')
      setCommentFileUrl('')
    }
  }

  return (
    <PageShell
      eyebrow={
        isAdmin
          ? 'Principal Office · Faculty & Staff Task Command Center'
          : 'Principal Delegation Desk · My Assigned Tasks'
      }
      title={isAdmin ? 'Task Management & Delegation Board' : 'My Assigned Tasks'}
      subtitle={
        isAdmin
          ? 'Assign checklist-driven tasks to teachers and staff, track live progress, review submitted proof, and keep every campus deadline on schedule.'
          : 'View tasks assigned to you by the Principal Office, check off milestones, upload work proof, and submit directly for Admin review.'
      }
      action={
        isAdmin ? (
          <button
            type="button"
            onClick={() => setShowAssignModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-black text-emerald-300 shadow-sm transition hover:bg-slate-800"
          >
            <Icon name="plus" size={14} />
            Assign New Task
          </button>
        ) : undefined
      }
    >
      {/* EXECUTIVE KPI STRIP */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            {isAdmin ? 'Active Campus Tasks' : 'My Active Tasks'}
          </p>
          <p className="mt-1.5 text-3xl font-black">{activeCount}</p>
          <p className="mt-1 text-[11px] text-slate-300">
            {visibleTasks.filter((t) => t.status === 'todo').length} To Do ·{' '}
            {visibleTasks.filter((t) => t.status === 'in_progress').length} In Progress
          </p>
        </div>

        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Urgent / Overdue
          </p>
          <p
            className={`mt-1.5 text-3xl font-black ${
              urgentOrOverdueCount > 0 ? 'text-rose-600' : 'text-emerald-700'
            }`}
          >
            {urgentOrOverdueCount}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            {urgentOrOverdueCount > 0 ? 'Needs immediate focus' : 'All deadlines on track ✓'}
          </p>
        </div>

        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            {isAdmin ? 'Awaiting Admin Review' : 'Submitted for Review'}
          </p>
          <p className="mt-1.5 text-3xl font-black text-amber-600">{reviewCount}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            {isAdmin ? 'Ready for Principal sign-off' : 'Waiting for Principal approval'}
          </p>
        </div>

        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Completion Rate
          </p>
          <p className="mt-1.5 text-3xl font-black text-emerald-700">{completionRate}%</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            {completedCount} of {visibleTasks.length} completed ✓
          </p>
        </div>
      </div>

      {/* ADMIN ASSIGNEE WORKLOAD STRIP */}
      {isAdmin && workloadByAssignee.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Team Workload:
          </span>
          <button
            type="button"
            onClick={() => setAssigneeFilter('ALL')}
            className={`rounded-full px-3 py-1 text-[11px] font-extrabold transition ${
              assigneeFilter === 'ALL'
                ? 'bg-[#0f172a] text-emerald-300'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            All Team ({visibleTasks.length})
          </button>
          {workloadByAssignee.map((w) => (
            <button
              key={w.name}
              type="button"
              onClick={() => setAssigneeFilter(assigneeFilter === w.name ? 'ALL' : w.name)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold transition ${
                assigneeFilter === w.name
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:border-emerald-300'
              }`}
            >
              <span>{w.name}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  assigneeFilter === w.name
                    ? 'bg-white/20 text-white'
                    : w.active > 0
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {w.active} open
              </span>
            </button>
          ))}
        </div>
      )}

      {/* FILTER & VIEW MODE TOOLBAR */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="relative min-w-[200px] flex-1">
          <Icon
            name="search"
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search task title, assignee, or notes..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="ALL">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="ALL">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyOverdue((v) => !v)}
            className={`rounded-xl px-3 py-2 text-xs font-extrabold transition ${
              onlyOverdue
                ? 'bg-rose-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Overdue Only
          </button>

          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                viewMode === 'kanban'
                  ? 'bg-[#0f172a] text-emerald-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📋 Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                viewMode === 'list'
                  ? 'bg-[#0f172a] text-emerald-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚡ List
            </button>
          </div>
        </div>
      </div>

      {/* EMPTY STATE FOR TEACHERS/STAFF WITH ZERO ASSIGNED TASKS */}
      {visibleTasks.length === 0 ? (
        <div className="dmhs-card rounded-[28px] p-12 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
            🎉
          </span>
          <h3 className="mt-3 text-base font-black text-slate-900">
            {isAdmin ? 'No Campus Tasks Created Yet' : 'You’re All Caught Up!'}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs font-semibold text-slate-500">
            {isAdmin
              ? 'Click "+ Assign New Task" above to delegate exam prep, accounts audits, or lab checks to your faculty and staff.'
              : 'No tasks are currently assigned to you by the Principal Office. When Admin assigns a task, it will appear right here with live alerts.'}
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        /* ==================== 4-COLUMN WORKFLOW KANBAN BOARD ==================== */
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_COLUMNS.map((col) => {
            const colItems = filteredTasks.filter((t) => t.status === col.key)
            return (
              <div
                key={col.key}
                className="flex flex-col rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-3.5"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${col.dotClass}`} />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      {col.label}
                    </h3>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${col.pillClass}`}>
                    {colItems.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {colItems.map((t) => {
                    const pct = getTaskProgressPct(t)
                    const due = dueBadgeInfo(t)
                    const subTotal = t.subtasks?.length || 0
                    const subDone = (t.subtasks || []).filter((s) => s.done).length
                    const commentsCount = t.comments?.length || 0

                    return (
                      <div
                        key={t.id}
                        className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition hover:border-emerald-400 hover:shadow-md"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">
                            {t.department}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${priorityBadgeClass(t.priority)}`}
                          >
                            {t.priority}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTaskId(t.id)}
                          className="mt-2.5 block w-full text-left"
                        >
                          <p className="text-[13px] font-black leading-snug text-slate-900 group-hover:text-emerald-800">
                            {t.title}
                          </p>
                          {t.notes && (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                              {t.notes}
                            </p>
                          )}
                        </button>

                        {/* Subtask Progress Bar */}
                        {subTotal > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className="text-slate-500">
                                Checklist {subDone}/{subTotal}
                              </span>
                              <span className="text-emerald-700">{pct}%</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                          <span className="font-bold text-slate-600">
                            👤 {isAdmin ? t.assigneeName : `From ${t.createdBy}`}
                          </span>
                          <span className={due.cls}>{due.label}</span>
                        </div>

                        {(commentsCount > 0 || t.attachmentName) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                            {commentsCount > 0 && <span>💬 {commentsCount}</span>}
                            {t.attachmentName && <span>📎 File</span>}
                          </div>
                        )}

                        {/* 1-Click Workflow Actions */}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                          <button
                            type="button"
                            onClick={() => setActiveTaskId(t.id)}
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold text-slate-700 hover:bg-slate-200"
                          >
                            Open Details
                          </button>

                          {col.key === 'todo' && (
                            <button
                              type="button"
                              onClick={() =>
                                void runTaskAction(
                                  { action: 'update_status', taskId: t.id, status: 'in_progress' },
                                  'Started task — moved to In Progress!',
                                )
                              }
                              className="rounded-lg bg-sky-600 px-2.5 py-1 text-[10px] font-black text-white hover:bg-sky-700"
                            >
                              Start →
                            </button>
                          )}

                          {col.key === 'in_progress' && (
                            <button
                              type="button"
                              onClick={() =>
                                void runTaskAction(
                                  {
                                    action: 'update_status',
                                    taskId: t.id,
                                    status: isAdmin ? 'completed' : 'in_review',
                                  },
                                  isAdmin
                                    ? 'Task marked Completed!'
                                    : 'Submitted to Principal for Review ✓',
                                )
                              }
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white hover:bg-emerald-700"
                            >
                              {isAdmin ? 'Complete ✓' : 'Submit Review ✓'}
                            </button>
                          )}

                          {col.key === 'in_review' && isAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                void runTaskAction(
                                  { action: 'update_status', taskId: t.id, status: 'completed' },
                                  `Approved & completed "${t.title}"!`,
                                )
                              }
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white hover:bg-emerald-700"
                            >
                              Approve ✓
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {colItems.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-[11px] font-semibold text-slate-400">
                      No tasks in {col.shortLabel}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ==================== COMPACT HIGH-EFFICIENCY LIST VIEW ==================== */
        <div className="dmhs-card overflow-hidden rounded-[24px]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Task &amp; Checklist</th>
                  <th className="px-4 py-3">{isAdmin ? 'Assignee' : 'Assigned By'}</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((t) => {
                  const pct = getTaskProgressPct(t)
                  const due = dueBadgeInfo(t)
                  const colMeta = STATUS_COLUMNS.find((c) => c.key === t.status) || STATUS_COLUMNS[0]
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setActiveTaskId(t.id)}
                          className="text-left"
                        >
                          <p className="font-black text-slate-900 hover:text-emerald-700">
                            {t.title}
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                            {t.department} · Progress {pct}%
                            {t.comments?.length ? ` · 💬 ${t.comments.length}` : ''}
                          </p>
                        </button>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-700">
                        {isAdmin ? t.assigneeName : t.createdBy}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${priorityBadgeClass(t.priority)}`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-[11px] ${due.cls}`}>{due.label}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${colMeta.pillClass}`}
                        >
                          {colMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveTaskId(t.id)}
                          className="rounded-full bg-[#0f172a] px-3 py-1 text-[10px] font-black text-emerald-300 hover:bg-slate-800"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TASK DETAIL, CHECKLIST & PROOF COMMENTS MODAL ==================== */}
      {activeTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setActiveTaskId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-700">
                    {activeTask.department}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${priorityBadgeClass(activeTask.priority)}`}
                  >
                    {activeTask.priority}
                  </span>
                  <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-black text-emerald-300 uppercase">
                    {activeTask.status.replace('_', ' ')}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-black text-slate-950">{activeTask.title}</h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  Assigned to <strong>{activeTask.assigneeName}</strong> by{' '}
                  <strong>{activeTask.createdBy}</strong> · Due {activeTask.dueDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTaskId(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              {/* Briefing Notes & Attached Briefing Document */}
              {(activeTask.notes || activeTask.attachmentName) && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Task Briefing
                  </p>
                  {activeTask.notes && (
                    <p className="mt-1.5 leading-relaxed font-medium text-slate-700">
                      {activeTask.notes}
                    </p>
                  )}
                  {activeTask.attachmentName && (
                    <div className="mt-2.5">
                      {activeTask.attachmentUrl ? (
                        <a
                          href={activeTask.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-3 py-1 text-[11px] font-black text-emerald-300 hover:bg-slate-800"
                        >
                          📎 {activeTask.attachmentName} · Download ↗
                        </a>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-600">
                          📎 {activeTask.attachmentName}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Subtasks Checklist */}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-slate-900">
                    Action Checklist ({(activeTask.subtasks || []).filter((s) => s.done).length}/
                    {(activeTask.subtasks || []).length})
                  </p>
                  <span className="text-xs font-black text-emerald-700">
                    {getTaskProgressPct(activeTask)}% Complete
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${getTaskProgressPct(activeTask)}%` }}
                  />
                </div>

                <div className="mt-3 space-y-2">
                  {(activeTask.subtasks || []).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() =>
                        void runTaskAction({
                          action: 'toggle_subtask',
                          taskId: activeTask.id,
                          subtaskId: st.id,
                        })
                      }
                      className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-xs transition ${
                        st.done
                          ? 'border-emerald-200 bg-emerald-50/70'
                          : 'border-slate-200 bg-white hover:border-emerald-400'
                      }`}
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                          st.done
                            ? 'bg-emerald-600 text-white'
                            : 'border-2 border-slate-300 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span
                        className={`font-bold ${
                          st.done ? 'text-slate-400 line-through' : 'text-slate-800'
                        }`}
                      >
                        {st.title}
                      </span>
                    </button>
                  ))}
                </div>

                <form onSubmit={handleAddSubtask} className="mt-2.5 flex gap-2">
                  <input
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="+ Add a checklist step..."
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-black text-emerald-300 hover:bg-slate-800"
                  >
                    Add
                  </button>
                </form>
              </div>

              {/* Activity & Proof Upload Thread */}
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-black text-slate-900">
                  Progress Updates &amp; Proof ({activeTask.comments?.length || 0})
                </p>
                <div className="mt-3 max-h-52 space-y-2.5 overflow-y-auto">
                  {(activeTask.comments || []).map((c) => {
                    const isMine = c.senderRole === role
                    return (
                      <div
                        key={c.id}
                        className={`rounded-xl p-3 text-xs ${
                          isMine ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <p
                          className={`text-[10px] font-extrabold ${
                            isMine ? 'text-emerald-300' : 'text-slate-500'
                          }`}
                        >
                          {c.sender} · {c.time}
                        </p>
                        <p className="mt-1 leading-relaxed">{c.text}</p>
                        {c.attachmentName && (
                          <div className="mt-1.5 space-y-1">
                            {c.attachmentUrl && isImageAttachment(c.attachmentUrl) && (
                              <a href={c.attachmentUrl} target="_blank" rel="noreferrer">
                                <img
                                  src={c.attachmentUrl}
                                  alt={c.attachmentName}
                                  className="max-h-32 rounded-lg border border-white/15 object-cover"
                                />
                              </a>
                            )}
                            {c.attachmentUrl ? (
                              <a
                                href={c.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black ${
                                  isMine
                                    ? 'bg-white/15 text-emerald-200'
                                    : 'bg-white text-emerald-800 ring-1 ring-slate-200'
                                }`}
                              >
                                📎 {c.attachmentName} · Open ↗
                              </a>
                            ) : (
                              <span className="text-[10px] font-bold">📎 {c.attachmentName}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {(activeTask.comments || []).length === 0 && (
                    <p className="text-xs font-semibold text-slate-400">
                      No progress updates yet. Post an update or attach completed proof below.
                    </p>
                  )}
                </div>

                <form onSubmit={handlePostComment} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {commentFileName && (
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
                      <span>📎 {commentFileName} ✓</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCommentFileName('')
                          setCommentFileUrl('')
                        }}
                        className="font-black text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm hover:bg-emerald-50">
                      📎
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.xlsx,.csv,.txt"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          setUploadingCommentFile(true)
                          const up = await uploadDmhsAttachment(f, 'tasks')
                          setUploadingCommentFile(false)
                          if (up.ok && up.url) {
                            setCommentFileName(up.filename || f.name)
                            setCommentFileUrl(up.url)
                          }
                        }}
                      />
                    </label>
                    <input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={
                        uploadingCommentFile
                          ? 'Uploading proof...'
                          : 'Write progress note or attach completed proof...'
                      }
                      className="flex-1 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <button
                      type="submit"
                      disabled={uploadingCommentFile}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Post
                    </button>
                  </div>
                </form>
              </div>

              {/* Status Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap gap-2">
                  {activeTask.status !== 'in_progress' && activeTask.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() =>
                        void runTaskAction(
                          { action: 'update_status', taskId: activeTask.id, status: 'in_progress' },
                          'Moved to In Progress',
                        )
                      }
                      className="rounded-full bg-sky-600 px-4 py-2 text-xs font-black text-white hover:bg-sky-700"
                    >
                      Move to In Progress
                    </button>
                  )}
                  {!isAdmin && activeTask.status !== 'in_review' && activeTask.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() =>
                        void runTaskAction(
                          { action: 'update_status', taskId: activeTask.id, status: 'in_review' },
                          'Submitted to Principal Office for Review ✓',
                        )
                      }
                      className="rounded-full bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-400"
                    >
                      Submit for Principal Review ✓
                    </button>
                  )}
                  {activeTask.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() =>
                        void runTaskAction(
                          { action: 'update_status', taskId: activeTask.id, status: 'completed' },
                          isAdmin ? 'Approved & Marked Completed ✓' : 'Task Marked Completed ✓',
                        )
                      }
                      className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                    >
                      {isAdmin ? 'Approve & Complete ✓' : 'Mark Completed ✓'}
                    </button>
                  )}
                  {isAdmin && (activeTask.status === 'in_review' || activeTask.status === 'completed') && (
                    <button
                      type="button"
                      onClick={() =>
                        void runTaskAction(
                          { action: 'update_status', taskId: activeTask.id, status: 'in_progress' },
                          'Sent back to In Progress for revision',
                        )
                      }
                      className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-black text-amber-900"
                    >
                      Request Revision
                    </button>
                  )}
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await runTaskAction(
                        { action: 'delete_task', taskId: activeTask.id },
                        'Task deleted',
                      )
                      if (res.ok) setActiveTaskId(null)
                    }}
                    className="rounded-full bg-rose-50 px-3.5 py-2 text-xs font-black text-rose-700 hover:bg-rose-100"
                  >
                    Delete Task
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ADMIN: ASSIGN NEW TASK MODAL ==================== */}
      {isAdmin && showAssignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setShowAssignModal(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAssignSubmit}
            className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  Principal Delegation · Instant Faculty &amp; Staff Sync
                </p>
                <h3 className="text-lg font-black text-slate-950">Assign New Campus Task</h3>
                <p className="text-xs font-semibold text-slate-500">
                  Appears instantly in the assigned Teacher’s or Staff member’s portal with live alert.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* 1-Click Smart Delegation Templates */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-slate-500">Quick Templates:</span>
              {TASK_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-extrabold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
                >
                  {tpl.label}
                </button>
              ))}
            </div>

            <label className="block text-xs font-bold text-slate-700">
              Task Title *
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Finalize Class 6 Science Practical Schedule & Invigilator List"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-slate-700">
                Assign To (Teacher or Staff) *
                <select
                  value={selectedAssigneeKey}
                  onChange={(e) => setSelectedAssigneeKey(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none"
                >
                  {assigneeDirectory.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Department
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as CampusTaskItem['department'])}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-bold text-slate-700">
                Priority
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as CampusTaskItem['priority'])}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Deadline Date *
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Tag (Optional)
                <input
                  value={categoryTag}
                  onChange={(e) => setCategoryTag(e.target.value)}
                  placeholder="e.g., Exam Prep"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none"
                />
              </label>
            </div>

            <label className="block text-xs font-bold text-slate-700">
              Action Checklist Subtasks (one step per line)
              <textarea
                rows={3}
                value={subtasksText}
                onChange={(e) => setSubtasksText(e.target.value)}
                placeholder={`Verify student list\nPrepare summary report\nUpload signed copy for Principal review`}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
              />
            </label>

            <label className="block text-xs font-bold text-slate-700">
              Briefing Instructions
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any key details, links, or expectations..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">
                📎{' '}
                {uploadingBriefFile
                  ? 'Uploading...'
                  : briefFileName
                    ? `${briefFileName} ✓`
                    : 'Attach Briefing PDF / Image'}
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xlsx"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setUploadingBriefFile(true)
                    const up = await uploadDmhsAttachment(f, 'tasks')
                    setUploadingBriefFile(false)
                    if (up.ok && up.url) {
                      setBriefFileName(up.filename || f.name)
                      setBriefFileUrl(up.url)
                    }
                  }}
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingBriefFile}
                  className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-black text-emerald-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Assign Task Now ✓
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
