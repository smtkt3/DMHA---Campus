'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { CURRENT_SEMESTER_TERM } from './data'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type { FeedbackCategory, SemesterEvaluationItem, TeacherFeedbackItem } from './types'
import { FeedbackBadge, PageShell, SectionTitle } from './ui'

type StarVal = 1 | 2 | 3 | 4 | 5

const STAR_LABELS: Record<StarVal, string> = {
  5: '5★ Excellent',
  4: '4★ Very Good',
  3: '3★ Good',
  2: '2★ Fair',
  1: '1★ Needs Improvement',
}

function normalizeClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function studentInAssignedClasses(
  stu: { className: string; section: string },
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

export function StarRatingDisplay({
  value,
  size = 14,
  showLabel = false,
}: {
  value: number
  size?: number
  showLabel?: boolean
}) {
  const rounded = Math.round(value)
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={star <= rounded ? '#f59e0b' : 'none'}
            stroke={star <= rounded ? '#f59e0b' : '#cbd5e1'}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}
      </span>
      {showLabel && (
        <span className="text-[11px] font-black text-amber-700">{value.toFixed(1)} / 5</span>
      )}
    </span>
  )
}

export function StarRatingPicker({
  value,
  onChange,
  compact = false,
  label,
}: {
  value: StarVal | 0
  onChange: (val: StarVal) => void
  compact?: boolean
  label?: string
}) {
  const [hovered, setHovered] = useState<number>(0)
  const displayVal = hovered || value

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-[11px] font-bold text-slate-500">{label}</span>}
      <div
        className="inline-flex items-center gap-1"
        onMouseLeave={() => setHovered(0)}
        role="radiogroup"
        aria-label={label || 'Star Rating (1 to 5)'}
      >
        {([1, 2, 3, 4, 5] as StarVal[]).map((star) => {
          const active = star <= displayVal
          return (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHovered(star)}
              onClick={() => onChange(star)}
              title={STAR_LABELS[star]}
              aria-label={STAR_LABELS[star]}
              className={`rounded-lg transition ${
                compact ? 'p-0.5' : 'p-1 hover:scale-110'
              }`}
            >
              <svg
                width={compact ? 16 : 22}
                height={compact ? 16 : 22}
                viewBox="0 0 24 24"
                fill={active ? '#f59e0b' : 'none'}
                stroke={active ? '#d97706' : '#94a3b8'}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          )
        })}
      </div>
      {!compact && value > 0 && (
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-black text-amber-800 ring-1 ring-amber-200">
          {STAR_LABELS[value as StarVal]}
        </span>
      )}
    </div>
  )
}

interface DraftEvalRow {
  rating: StarVal | 0
  teachingClarity: StarVal
  supportiveness: StarVal
  comment: string
}

export function FeedbackAndEvaluationView({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void
}) {
  const {
    role,
    students,
    teachers,
    selectedChildId,
    activeStudentId,
    activeTeacherId,
    feedback,
    semesterEvaluations,
    getSemesterEvaluationStatus,
    addTeacherFeedback,
    submitFamilyFeedback,
    acknowledgeFeedback,
    submitSemesterEvaluations,
    ptmRequests,
    bookPTM,
  } = useSchool()

  if (role === 'teacher') {
    return (
      <TeacherFeedbackHub
        students={students}
        teachers={teachers}
        activeTeacherId={activeTeacherId}
        feedback={feedback}
        addTeacherFeedback={addTeacherFeedback}
        acknowledgeFeedback={acknowledgeFeedback}
      />
    )
  }

  if (role === 'admin') {
    return (
      <AdminFeedbackOversight
        students={students}
        teachers={teachers}
        feedback={feedback}
        semesterEvaluations={semesterEvaluations}
        getSemesterEvaluationStatus={getSemesterEvaluationStatus}
        acknowledgeFeedback={acknowledgeFeedback}
      />
    )
  }

  // ==================== STUDENT & GUARDIAN UNIFIED VIEW ====================
  const isStudent = role === 'student'
  const activeStuId = isStudent ? activeStudentId : selectedChildId
  const child = students.find((s) => s.id === activeStuId) || students[0]
  const activeTeachers = teachers.filter((t) => t.status === 'active')

  const evalStatus = getSemesterEvaluationStatus(child.id, CURRENT_SEMESTER_TERM)

  const [subTab, setSubTab] = useState<'evaluate' | 'feed' | 'send'>(
    evalStatus.isComplete ? 'feed' : 'evaluate',
  )
  const [filter, setFilter] = useState<'all' | FeedbackCategory>('all')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null)

  // End-of-Semester 5★-to-1★ Evaluation Drafts keyed by subject
  const [evalDrafts, setEvalDrafts] = useState<Record<string, DraftEvalRow>>({})
  const [submittingEval, setSubmittingEval] = useState(false)
  const [evalError, setEvalError] = useState('')

  // Populate evaluation drafts from already-saved SQLite records when switching child
  useEffect(() => {
    const next: Record<string, DraftEvalRow> = {}
    for (const req of evalStatus.requiredItems) {
      const saved = semesterEvaluations.find(
        (e) =>
          e.studentId === child.id &&
          e.term === CURRENT_SEMESTER_TERM &&
          e.subject.toLowerCase() === req.subject.toLowerCase(),
      )
      next[req.subject] = {
        rating: saved ? saved.rating : 0,
        teachingClarity: saved ? saved.teachingClarity : 5,
        supportiveness: saved ? saved.supportiveness : 5,
        comment: saved ? saved.comment : '',
      }
    }
    setEvalDrafts(next)
    setEvalError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child.id, semesterEvaluations.length])

  // Direct Student/Guardian Feedback Composer state
  const [fbTargetTeacher, setFbTargetTeacher] = useState(
    child.subjects[0]?.teacher || activeTeachers[0]?.name || 'Nadia Rahman',
  )
  const [fbSubject, setFbSubject] = useState(child.subjects[0]?.name || 'General')
  const [fbCategory, setFbCategory] = useState<FeedbackCategory>('praise')
  const [fbRating, setFbRating] = useState<StarVal>(5)
  const [fbTitle, setFbTitle] = useState('')
  const [fbMessage, setFbMessage] = useState('')
  const [sendingFb, setSendingFb] = useState(false)

  // Guardian PTM booking state
  const [ptmTeacher, setPtmTeacher] = useState(
    activeTeachers[0]?.name || child.subjects[0]?.teacher || 'Nadia Rahman',
  )
  const [ptmSlot, setPtmSlot] = useState('Saturday · 11:00 AM (Campus / Video)')
  const [ptmTopic, setPtmTopic] = useState('')

  const items = feedback
    .filter((f) => f.studentId === child.id)
    .filter((f) => (filter === 'all' ? true : f.category === filter))
  const childPTMs = ptmRequests.filter((p) => p.studentId === child.id)

  const ratedDraftCount = evalStatus.requiredItems.filter(
    (req) => (evalDrafts[req.subject]?.rating || 0) >= 1,
  ).length

  const handleSubmitAllEvaluations = async () => {
    setEvalError('')
    const missing = evalStatus.requiredItems.filter(
      (req) => !(evalDrafts[req.subject]?.rating && evalDrafts[req.subject].rating >= 1),
    )
    if (missing.length > 0) {
      setEvalError(
        `Please select a 1★ to 5★ rating for all remaining subjects (${missing.map((m) => m.subject).join(', ')}) to unlock the Admit Card.`,
      )
      return
    }

    setSubmittingEval(true)
    const res = await submitSemesterEvaluations({
      studentId: child.id,
      term: CURRENT_SEMESTER_TERM,
      evaluations: evalStatus.requiredItems.map((req) => {
        const d = evalDrafts[req.subject]
        return {
          subject: req.subject,
          teacherName: req.teacherName,
          teacherId: req.teacherId,
          rating: d.rating as StarVal,
          teachingClarity: d.teachingClarity,
          supportiveness: d.supportiveness,
          comment: d.comment,
        }
      }),
    })
    setSubmittingEval(false)
    if (!res.ok) {
      setEvalError(res.error || 'Could not submit semester evaluation.')
    }
  }

  const handleRateAllPreset = (stars: StarVal) => {
    setEvalDrafts((prev) => {
      const copy = { ...prev }
      for (const req of evalStatus.requiredItems) {
        copy[req.subject] = {
          rating: stars,
          teachingClarity: stars,
          supportiveness: stars,
          comment: prev[req.subject]?.comment || '',
        }
      }
      return copy
    })
  }

  const handleSendFamilyFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fbTitle.trim() || !fbMessage.trim()) return
    setSendingFb(true)
    const res = await submitFamilyFeedback({
      studentId: child.id,
      teacherName: fbTargetTeacher,
      subject: fbSubject,
      category: fbCategory,
      title: fbTitle,
      message: fbMessage,
      rating: fbRating,
    })
    setSendingFb(false)
    if (res.ok) {
      setFbTitle('')
      setFbMessage('')
      setSubTab('feed')
    }
  }

  const handleReply = async (itemId: string) => {
    setSavingReplyId(itemId)
    await acknowledgeFeedback(itemId, replyDrafts[itemId])
    setSavingReplyId(null)
    setReplyDrafts((prev) => ({ ...prev, [itemId]: '' }))
  }

  const handleBookPTM = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ptmTopic.trim()) return
    const sub = child.subjects.find((s) => s.teacher === ptmTeacher)?.name || 'General'
    bookPTM({
      studentId: child.id,
      teacherName: ptmTeacher,
      subject: sub,
      slot: ptmSlot,
      topic: ptmTopic,
    })
    setPtmTopic('')
  }

  return (
    <PageShell
      eyebrow={
        isStudent
          ? `Student Voice & End-of-Semester Rating · ${child.className} ${child.section}`
          : `Guardian Partnership & Semester Evaluation · ${child.name}`
      }
      title={
        isStudent
          ? 'Student Feedback & Semester Evaluation'
          : `Feedback & Semester Rating for ${child.name}`
      }
      subtitle="Rate teachers (5★ to 1★) before downloading your Term Final Exam Admit Card, reply to classroom remarks, or send direct feedback to faculty."
      action={
        onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('documents')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black shadow-sm transition ${
              evalStatus.isComplete
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <Icon name="print" size={14} />
            {evalStatus.isComplete ? 'Download Admit Card →' : 'Admit Card (Evaluation Required)'}
          </button>
        )
      }
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      {/* End-of-Semester Evaluation Gate Progress Hero */}
      <div className="dmhs-hero mb-6 rounded-[28px] p-5 text-white shadow-xl sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                  evalStatus.isComplete
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-amber-400 text-slate-950'
                }`}
              >
                <Icon name={evalStatus.isComplete ? 'check' : 'lock'} size={12} />
                {evalStatus.isComplete
                  ? 'Admit Card Evaluation Cleared'
                  : 'Required Before Admit Card Download'}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-200">
                {CURRENT_SEMESTER_TERM}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/20 px-2.5 py-1 text-[10px] font-bold text-sky-200 ring-1 ring-sky-400/30">
                <Icon name="shield" size={11} />
                Confidential · Admin-Only Visibility
              </span>
            </div>
            <h2 className="mt-2 text-lg font-black sm:text-xl">
              {evalStatus.isComplete
                ? `All ${evalStatus.requiredCount}/${evalStatus.requiredCount} Subjects Evaluated for ${child.name}!`
                : `Complete 5★ to 1★ End-of-Semester Evaluation (${evalStatus.completedCount}/${evalStatus.requiredCount} Done)`}
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              {evalStatus.isComplete
                ? `Average rating submitted: ${evalStatus.averageGivenRating ?? 5.0}★ / 5.0. Your Term Final Exam Admit Card download is now unlocked.`
                : `Remaining subjects: ${evalStatus.remainingSubjects.join(', ')}. Both Students and Guardians can complete this 1-minute evaluation.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!evalStatus.isComplete ? (
              <button
                type="button"
                onClick={() => setSubTab('evaluate')}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-xs font-black text-slate-950 shadow-sm hover:bg-emerald-300"
              >
                <Icon name="star" size={14} />
                Evaluate Teachers Now
              </button>
            ) : (
              onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('documents')}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-xs font-black text-slate-950 shadow-sm hover:bg-emerald-300"
                >
                  <Icon name="download" size={14} />
                  Open Admit Card PDF →
                </button>
              )
            )}
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all"
            style={{
              width: `${Math.round(
                (evalStatus.completedCount / Math.max(1, evalStatus.requiredCount)) * 100,
              )}%`,
            }}
          />
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setSubTab('evaluate')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            subTab === 'evaluate'
              ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Icon name="star" size={14} />
          End-of-Semester Rating (5★–1★)
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
              evalStatus.isComplete
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-amber-400 text-slate-950'
            }`}
          >
            {evalStatus.completedCount}/{evalStatus.requiredCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('feed')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            subTab === 'feed'
              ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Icon name="message" size={14} />
          Feedback &amp; Replies ({items.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('send')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            subTab === 'send'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Icon name="send" size={14} />
          {isStudent ? 'Send Student Feedback' : 'Send Guardian Feedback'}
        </button>
      </div>

      {/* ==================== TAB 1: END-OF-SEMESTER 5★ TO 1★ EVALUATION ==================== */}
      {subTab === 'evaluate' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Rate Every Subject Teacher ({CURRENT_SEMESTER_TERM})
              </h3>
              <p className="text-xs text-slate-500">
                Choose from <strong>5★ (Excellent)</strong> down to{' '}
                <strong>1★ (Needs Improvement)</strong> for each teacher.{' '}
                <strong className="text-emerald-700">
                  Strictly confidential — only Principal / Admin can view these ratings &amp;
                  comments (hidden from teachers to prevent any conflict before final exams).
                </strong>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-bold text-slate-400">Quick Fill:</span>
              {([5, 4, 3] as StarVal[]).map((stars) => (
                <button
                  key={stars}
                  type="button"
                  onClick={() => handleRateAllPreset(stars)}
                  className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-extrabold text-amber-800 hover:bg-amber-100"
                >
                  All {stars}★
                </button>
              ))}
            </div>
          </div>

          {evalError && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
              <Icon name="alert" size={15} className="shrink-0 text-rose-600" />
              <span>{evalError}</span>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {evalStatus.requiredItems.map((req) => {
              const draft = evalDrafts[req.subject] || {
                rating: 0,
                teachingClarity: 5,
                supportiveness: 5,
                comment: '',
              }
              const isSaved = evalStatus.completedSubjects.includes(req.subject)

              return (
                <div
                  key={req.subject}
                  className={`rounded-3xl border bg-white p-5 shadow-2xs transition ${
                    isSaved
                      ? 'border-emerald-200 ring-1 ring-emerald-100'
                      : draft.rating > 0
                        ? 'border-amber-300'
                        : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">
                        {req.subject}
                      </span>
                      <h4 className="mt-2 text-base font-black text-slate-900">
                        {req.teacherName}
                      </h4>
                      <p className="text-[11px] font-medium text-slate-400">
                        {child.className} · {child.section}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                        isSaved
                          ? 'bg-emerald-100 text-emerald-800'
                          : draft.rating > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isSaved ? 'Submitted ✓' : draft.rating > 0 ? 'Ready' : 'Pending'}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
                    <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Overall Semester Rating (5★ to 1★) *
                    </p>
                    <StarRatingPicker
                      value={draft.rating}
                      onChange={(val) =>
                        setEvalDrafts((prev) => ({
                          ...prev,
                          [req.subject]: {
                            ...(prev[req.subject] || draft),
                            rating: val,
                            teachingClarity: prev[req.subject]?.rating ? prev[req.subject].teachingClarity : val,
                            supportiveness: prev[req.subject]?.rating ? prev[req.subject].supportiveness : val,
                          },
                        }))
                      }
                    />

                    <div className="mt-3 grid gap-2 border-t border-slate-200/70 pt-3 sm:grid-cols-2">
                      <StarRatingPicker
                        compact
                        label="Clarity:"
                        value={draft.teachingClarity}
                        onChange={(val) =>
                          setEvalDrafts((prev) => ({
                            ...prev,
                            [req.subject]: { ...(prev[req.subject] || draft), teachingClarity: val },
                          }))
                        }
                      />
                      <StarRatingPicker
                        compact
                        label="Support:"
                        value={draft.supportiveness}
                        onChange={(val) =>
                          setEvalDrafts((prev) => ({
                            ...prev,
                            [req.subject]: { ...(prev[req.subject] || draft), supportiveness: val },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={draft.comment}
                    onChange={(e) =>
                      setEvalDrafts((prev) => ({
                        ...prev,
                        [req.subject]: { ...(prev[req.subject] || draft), comment: e.target.value },
                      }))
                    }
                    placeholder={`Optional comment for ${req.teacherName} (${req.subject})...`}
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs font-semibold text-slate-600">
              Selected:{' '}
              <strong className="text-slate-900">
                {ratedDraftCount} of {evalStatus.requiredCount}
              </strong>{' '}
              subjects rated · Saved securely in SQLite
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {evalStatus.isComplete && onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('documents')}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-xs font-black text-emerald-800 hover:bg-emerald-100"
                >
                  <Icon name="print" size={14} />
                  Go to Exam Admit Card →
                </button>
              )}
              <button
                type="button"
                disabled={submittingEval}
                onClick={() => void handleSubmitAllEvaluations()}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <Icon name="check" size={14} />
                {submittingEval
                  ? 'Submitting to SQLite…'
                  : evalStatus.isComplete
                    ? 'Update Semester Evaluation'
                    : 'Submit All Ratings & Unlock Admit Card'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: FEEDBACK FEED, REPLIES & PTM ==================== */}
      {subTab === 'feed' && (
        <div>
          <div className="mb-5 flex flex-wrap gap-2">
            {(
              [
                ['all', 'All Feedback'],
                ['praise', 'Praise'],
                ['academic', 'Academic'],
                ['behavior', 'Conduct'],
                ['attention', 'Needs Attention'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
                  filter === key
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={isStudent ? 'space-y-3.5' : 'grid gap-6 lg:grid-cols-[1.25fr_.75fr]'}>
            <div className="space-y-3.5">
              {items.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs font-bold text-slate-400">
                  No feedback entries match this filter yet.
                </div>
              ) : (
                items.map((item) => {
                  const isFromFamily =
                    item.senderRole === 'student' || item.senderRole === 'guardian'
                  return (
                    <article
                      key={item.id}
                      className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <FeedbackBadge category={item.category} />
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                              item.senderRole === 'student'
                                ? 'bg-sky-100 text-sky-800'
                                : item.senderRole === 'guardian'
                                  ? 'bg-violet-100 text-violet-800'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.senderRole === 'student'
                              ? `Student → ${item.teacherName}`
                              : item.senderRole === 'guardian'
                                ? `Guardian → ${item.teacherName}`
                                : `Teacher · ${item.teacherName}`}
                          </span>
                          <span className="text-xs font-extrabold text-slate-500">
                            {item.subject}
                          </span>
                          {item.rating && <StarRatingDisplay value={item.rating} size={13} />}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">{item.date}</span>
                      </div>

                      <h3 className="mt-3 text-base font-black text-slate-900">{item.title}</h3>
                      <p className="mt-1.5 text-xs leading-6 text-slate-600">{item.message}</p>

                      {item.guardianReply && (
                        <div className="mt-3 rounded-xl bg-violet-50/70 p-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">
                            Guardian Reply
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-800">
                            {item.guardianReply}
                          </p>
                        </div>
                      )}

                      {item.studentReply && (
                        <div className="mt-3 rounded-xl bg-sky-50/70 p-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700">
                            Student Reply ({item.studentName})
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-800">
                            {item.studentReply}
                          </p>
                        </div>
                      )}

                      {item.teacherReply && (
                        <div className="mt-3 rounded-xl bg-emerald-50/70 p-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                            School / Teacher Response ({item.teacherName})
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-800">
                            {item.teacherReply}
                          </p>
                        </div>
                      )}

                      {!isFromFamily && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                          <input
                            value={replyDrafts[item.id] || ''}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            placeholder={
                              isStudent
                                ? 'Write your reply or question back to the teacher...'
                                : 'Write a quick note back to the teacher...'
                            }
                            className="min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                          />
                          <button
                            type="button"
                            disabled={savingReplyId === item.id}
                            onClick={() => void handleReply(item.id)}
                            className="rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 hover:bg-slate-800 disabled:opacity-50"
                          >
                            {savingReplyId === item.id
                              ? 'Saving…'
                              : replyDrafts[item.id]?.trim()
                                ? 'Send Reply'
                                : isStudent
                                  ? 'Mark Noted'
                                  : 'Acknowledge'}
                          </button>
                        </div>
                      )}
                    </article>
                  )
                })
              )}
            </div>

            {!isStudent && (
              <aside>
                <SectionTitle eyebrow="1-on-1 meeting" title="Book Parent-Teacher Meeting" />
                <form
                  onSubmit={handleBookPTM}
                  className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-2xs"
                >
                  <label className="block text-[11px] font-extrabold text-slate-600">
                    Select Teacher
                    <select
                      value={ptmTeacher}
                      onChange={(e) => setPtmTeacher(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none"
                    >
                      {activeTeachers.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name} ({t.subject})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-3 block text-[11px] font-extrabold text-slate-600">
                    Preferred Slot
                    <select
                      value={ptmSlot}
                      onChange={(e) => setPtmSlot(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none"
                    >
                      <option>Saturday · 10:00 AM (Campus)</option>
                      <option>Saturday · 11:00 AM (Campus / Video)</option>
                      <option>Sunday · 02:30 PM (Online Video)</option>
                    </select>
                  </label>

                  <label className="mt-3 block text-[11px] font-extrabold text-slate-600">
                    Discussion Topic
                    <textarea
                      rows={2}
                      required
                      value={ptmTopic}
                      onChange={(e) => setPtmTopic(e.target.value)}
                      placeholder="e.g., Math revision strategy before term exams..."
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </label>

                  <button
                    type="submit"
                    className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-700"
                  >
                    Request PTM Slot
                  </button>

                  {childPTMs.length > 0 && (
                    <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Scheduled PTMs ({childPTMs.length})
                      </p>
                      {childPTMs.map((p) => (
                        <div key={p.id} className="rounded-xl bg-slate-50 p-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-slate-800">{p.teacherName}</span>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              {p.status}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">{p.slot}</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-700">
                            {p.topic}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </form>
              </aside>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: SEND DIRECT STUDENT / GUARDIAN FEEDBACK ==================== */}
      {subTab === 'send' && (
        <form
          onSubmit={(e) => void handleSendFamilyFeedback(e)}
          className="mx-auto max-w-2xl rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-xs"
        >
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900">
              {isStudent
                ? 'Send Feedback or Question to Teacher / School'
                : `Send Guardian Feedback for ${child.name}`}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Share appreciation, academic questions, teaching suggestions, or campus concerns —
              synced live to the selected Teacher and Principal’s Office.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-700">
              Send To (Teacher / Office)
              <select
                value={fbTargetTeacher}
                onChange={(e) => {
                  const nextName = e.target.value
                  setFbTargetTeacher(nextName)
                  const matchedSub = child.subjects.find((s) => s.teacher === nextName)
                  if (matchedSub) setFbSubject(matchedSub.name)
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:border-emerald-500"
              >
                {child.subjects.map((sub) => (
                  <option key={sub.id} value={sub.teacher}>
                    {sub.teacher} ({sub.name})
                  </option>
                ))}
                <option value="Principal & Academic Office">
                  Principal Shahid &amp; Academic Office
                </option>
              </select>
            </label>

            <label className="block text-xs font-bold text-slate-700">
              Subject / Topic Area
              <select
                value={fbSubject}
                onChange={(e) => setFbSubject(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:border-emerald-500"
              >
                {child.subjects.map((sub) => (
                  <option key={sub.id} value={sub.name}>
                    {sub.name}
                  </option>
                ))}
                <option value="Campus & Facilities">Campus &amp; Facilities</option>
                <option value="Homework & Workload">Homework &amp; Workload</option>
                <option value="General">General</option>
              </select>
            </label>
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold text-slate-700">Category</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ['praise', 'Praise'],
                  ['academic', 'Academic'],
                  ['behavior', 'Conduct / Care'],
                  ['attention', 'Suggestion / Issue'],
                ] as const
              ).map(([cat, label]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFbCategory(cat)}
                  className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition ${
                    fbCategory === cat
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
            <p className="mb-1.5 text-xs font-bold text-slate-700">
              Experience Rating (5★ to 1★ · Confidential, Admin-Only)
            </p>
            <StarRatingPicker value={fbRating} onChange={setFbRating} />
          </div>

          <label className="mt-4 block text-xs font-bold text-slate-700">
            Headline *
            <input
              required
              value={fbTitle}
              onChange={(e) => setFbTitle(e.target.value)}
              placeholder="e.g., Extra practice sheet request for Fractions / Thank you for great lab!"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
            />
          </label>

          <label className="mt-3 block text-xs font-bold text-slate-700">
            Detailed Feedback *
            <textarea
              required
              rows={4}
              value={fbMessage}
              onChange={(e) => setFbMessage(e.target.value)}
              placeholder="Write your feedback clearly so the teacher or school can respond quickly..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 p-3.5 text-xs font-semibold outline-none focus:border-emerald-500"
            />
          </label>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSubTab('feed')}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sendingFb}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <Icon name="send" size={14} />
              {sendingFb ? 'Sending…' : 'Submit Feedback to SQLite'}
            </button>
          </div>
        </form>
      )}
    </PageShell>
  )
}

/* ==================== TEACHER CLASSROOM FEEDBACK (CONFIDENTIALITY-ENFORCED) ==================== */
function TeacherFeedbackHub({
  students,
  teachers,
  activeTeacherId,
  feedback,
  addTeacherFeedback,
  acknowledgeFeedback,
}: {
  students: ReturnType<typeof useSchool>['students']
  teachers: ReturnType<typeof useSchool>['teachers']
  activeTeacherId: string
  feedback: TeacherFeedbackItem[]
  addTeacherFeedback: ReturnType<typeof useSchool>['addTeacherFeedback']
  acknowledgeFeedback: ReturnType<typeof useSchool>['acknowledgeFeedback']
}) {
  const activeTeacher = teachers.find((t) => t.id === activeTeacherId) || teachers[0] || null
  const assignedClasses = useMemo(
    () => activeTeacher?.assignedClasses || [],
    [activeTeacher],
  )
  const assignedStudents = useMemo(
    () => students.filter((s) => studentInAssignedClasses(s, assignedClasses)),
    [students, assignedClasses],
  )

  const [studentId, setStudentId] = useState(assignedStudents[0]?.id || '')
  const [subject, setSubject] = useState(activeTeacher?.subject || 'Physics')
  const [category, setCategory] = useState<FeedbackCategory>('praise')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [posting, setPosting] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replyingId, setReplyingId] = useState<string | null>(null)

  useEffect(() => {
    if (assignedStudents.length > 0 && !assignedStudents.some((s) => s.id === studentId)) {
      setStudentId(assignedStudents[0].id)
    }
  }, [assignedStudents, studentId])

  const assignedStudentIds = useMemo(
    () => new Set(assignedStudents.map((s) => s.id)),
    [assignedStudents],
  )

  const scopedFeedback = useMemo(
    () =>
      feedback.filter(
        (f) =>
          assignedStudentIds.has(f.studentId) ||
          (activeTeacher &&
            f.teacherName.trim().toLowerCase() === activeTeacher.name.trim().toLowerCase()),
      ),
    [feedback, assignedStudentIds, activeTeacher],
  )

  const quickPresets: {
    label: string
    category: FeedbackCategory
    title: string
    message: string
  }[] = [
    {
      label: 'Great class focus',
      category: 'praise',
      title: 'Excellent focus & participation today',
      message:
        'Actively participated in class discussion, answered analytical questions clearly, and helped peers stay on track.',
    },
    {
      label: 'Homework incomplete',
      category: 'attention',
      title: 'Homework submitted incomplete',
      message:
        'Today’s assigned worksheet was partially incomplete. Please help review the remaining questions at home before next period.',
    },
    {
      label: 'Quiz score improved',
      category: 'academic',
      title: 'Strong upward trend in class quiz',
      message:
        'Showed clear conceptual improvement on today’s short assessment compared to last week. Keep up the steady revision!',
    },
    {
      label: 'Exemplary conduct',
      category: 'behavior',
      title: 'Respectful & collaborative classroom conduct',
      message:
        'Demonstrated leadership, courtesy, and responsibility throughout the school day.',
    },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId || !title.trim() || !message.trim()) return
    setPosting(true)
    const res = await addTeacherFeedback({ studentId, subject, category, title, message })
    setPosting(false)
    if (res.ok) {
      setTitle('')
      setMessage('')
    }
  }

  return (
    <PageShell
      eyebrow={`Faculty Communication · ${activeTeacher?.name || 'Faculty'}`}
      title="Student Feedback & Classroom Notes"
      subtitle="Post classroom observations strictly for your assigned classes and respond to parent/student notes."
    >
      {/* Assigned-Class Security Banner */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Icon name="shield" size={16} />
          </div>
          <div>
            <div className="font-black">Assigned-Class Feedback Access · {activeTeacher?.name}</div>
            <div className="text-emerald-800/80">
              Server RBAC enforced: post remarks &amp; replies only for students in your assigned
              classes ({assignedStudents.length} students). End-of-semester 5★–1★ evaluations are
              confidentially managed by Admin only.
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

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-[26px] border border-slate-200/80 bg-white p-6 shadow-2xs"
        >
          <h3 className="text-base font-black text-slate-900">Post Remark to Student &amp; Parent</h3>

          <div className="mt-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              3-Second Quick Chips
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickPresets.map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => {
                    setCategory(preset.category)
                    setTitle(preset.title)
                    setMessage(preset.message)
                  }}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-extrabold text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] font-extrabold text-slate-600">
              Student (Assigned Only)
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none"
              >
                {assignedStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.className} {s.section})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[11px] font-extrabold text-slate-600">
              Subject
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none"
              >
                <option>Physics</option>
                <option>Mathematics</option>
                <option>Elementary Math</option>
                <option>Chemistry</option>
                <option>General Science</option>
                <option>English</option>
                <option>Bangla</option>
                <option>ICT &amp; Robotics</option>
                <option>General Conduct</option>
              </select>
            </label>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ['praise', 'Praise'],
                ['academic', 'Academic'],
                ['behavior', 'Conduct'],
                ['attention', 'Attention'],
              ] as const
            ).map(([cat, label]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-xl border px-2.5 py-2 text-xs font-extrabold ${
                  category === cat
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Remark headline..."
            className="mt-3 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
          />
          <textarea
            required
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Detailed classroom observation..."
            className="mt-3 w-full rounded-xl border border-slate-200 p-3.5 text-xs font-semibold outline-none focus:border-emerald-500"
          />

          <button
            type="submit"
            disabled={posting || assignedStudents.length === 0}
            className="mt-4 w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300 shadow-xs hover:bg-slate-800 disabled:opacity-50"
          >
            {posting ? 'Saving to SQLite…' : 'Send Feedback to Student & Guardian'}
          </button>
        </form>

        <div className="space-y-3">
          {scopedFeedback.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <FeedbackBadge category={item.category} />
                  <span className="text-xs font-black text-slate-800">
                    {item.studentName} · {item.subject}
                  </span>
                  {item.senderRole && item.senderRole !== 'teacher' && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black uppercase text-sky-800">
                      From {item.senderRole}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-400">{item.date}</span>
              </div>
              <p className="mt-2 text-sm font-black text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p>

              {item.guardianReply && (
                <p className="mt-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900">
                  <strong>Guardian Reply:</strong> {item.guardianReply}
                </p>
              )}
              {item.studentReply && (
                <p className="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  <strong>Student Reply:</strong> {item.studentReply}
                </p>
              )}
              {item.teacherReply && (
                <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  <strong>Your Response:</strong> {item.teacherReply}
                </p>
              )}

              {(item.senderRole === 'student' || item.senderRole === 'guardian') && (
                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                  <input
                    value={replyDrafts[item.id] || ''}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="Reply back to family/student..."
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-emerald-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    disabled={replyingId === item.id}
                    onClick={async () => {
                      setReplyingId(item.id)
                      await acknowledgeFeedback(item.id, replyDrafts[item.id])
                      setReplyingId(null)
                      setReplyDrafts((prev) => ({ ...prev, [item.id]: '' }))
                    }}
                    className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Reply
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  )
}

/* ==================== ADMIN FEEDBACK & FACULTY 5★ ANALYTICS ==================== */
function AdminFeedbackOversight({
  students,
  teachers,
  feedback,
  semesterEvaluations,
  getSemesterEvaluationStatus,
  acknowledgeFeedback,
}: {
  students: ReturnType<typeof useSchool>['students']
  teachers: ReturnType<typeof useSchool>['teachers']
  feedback: TeacherFeedbackItem[]
  semesterEvaluations: SemesterEvaluationItem[]
  getSemesterEvaluationStatus: ReturnType<typeof useSchool>['getSemesterEvaluationStatus']
  acknowledgeFeedback: ReturnType<typeof useSchool>['acknowledgeFeedback']
}) {
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})

  const schoolAvg =
    semesterEvaluations.length > 0
      ? (
          semesterEvaluations.reduce((s, e) => s + e.rating, 0) / semesterEvaluations.length
        ).toFixed(2)
      : '—'

  const studentStatuses = students.map((stu) => ({
    student: stu,
    status: getSemesterEvaluationStatus(stu.id, CURRENT_SEMESTER_TERM),
  }))
  const clearedCount = studentStatuses.filter((s) => s.status.isComplete).length

  const teacherStats = teachers.map((t) => {
    const rows = semesterEvaluations.filter(
      (e) =>
        e.teacherId === t.id ||
        e.teacherName.trim().toLowerCase() === t.name.trim().toLowerCase(),
    )
    const avg = rows.length
      ? Number((rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(2))
      : null
    return { teacher: t, count: rows.length, avg }
  })

  return (
    <PageShell
      eyebrow={`Principal Governance · ${CURRENT_SEMESTER_TERM}`}
      title="School Feedback & Faculty 5★ Evaluation Console"
      subtitle="Monitor faculty star ratings (5★ to 1★), track student Admit Card evaluation clearance, and respond to student/guardian feedback."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-hero rounded-2xl p-5 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
            School Faculty Rating
          </p>
          <p className="mt-2 text-3xl font-black">{schoolAvg} ★</p>
          <p className="mt-1 text-xs text-slate-300">
            {semesterEvaluations.length} end-of-semester ratings
          </p>
        </div>
        <div className="dmhs-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Admit Card Eval Cleared
          </p>
          <p className="mt-2 text-3xl font-black text-emerald-700">
            {clearedCount}/{students.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Students ready for hall tickets</p>
        </div>
        <div className="dmhs-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Feedback Threads
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">{feedback.length}</p>
          <p className="mt-1 text-xs text-slate-500">Teacher, Student &amp; Guardian</p>
        </div>
        <div className="dmhs-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Admit Gate Policy
          </p>
          <p className="mt-2 text-lg font-black text-emerald-700">Enforced (5★–1★)</p>
          <p className="mt-1 text-xs text-slate-500">Required prior to admit download</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Icon name="shield" size={16} />
          </div>
          <div>
            <div className="font-black">Confidential Admin-Only Access · Hidden from Teachers</div>
            <div className="text-emerald-800/80">
              All 5★ to 1★ pre-exam teacher evaluations and comments are strictly restricted to
              Admin so faculty cannot view individual ratings before final exams.
            </div>
          </div>
        </div>
        <span className="rounded-full bg-[#0f172a] px-3 py-1 text-[10px] font-black uppercase text-emerald-300">
          Zero Teacher Exposure
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Faculty Star Performance */}
        <div className="dmhs-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-black text-slate-900">Faculty End-of-Semester Ratings</h3>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-800">
              Admin Only
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {teacherStats.map(({ teacher, count, avg }) => (
              <div key={teacher.id} className="flex items-center justify-between px-5 py-3.5 text-xs">
                <div>
                  <p className="font-black text-slate-900">{teacher.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {teacher.subject} · {teacher.assignedClasses.join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  {avg !== null ? (
                    <StarRatingDisplay value={avg} size={14} showLabel />
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400">No ratings yet</span>
                  )}
                  <p className="mt-0.5 text-[10px] text-slate-400">{count} evaluations</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Admit Card Evaluation Clearance */}
        <div className="dmhs-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-black text-slate-900">
              Student Admit Card Evaluation Status
            </h3>
          </div>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {studentStatuses.map(({ student, status }) => (
              <div
                key={student.id}
                className="flex items-center justify-between px-5 py-3 text-xs"
              >
                <div>
                  <p className="font-black text-slate-900">{student.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {student.className} · {student.section}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                    status.isComplete
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {status.isComplete
                    ? `Cleared (${status.completedCount}/${status.requiredCount})`
                    : `Pending (${status.completedCount}/${status.requiredCount})`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admin-Only Detailed 5★–1★ End-of-Semester Evaluation Submissions */}
      <div className="mt-6 space-y-3">
        <SectionTitle
          eyebrow="Confidential · Admin-Only Vault"
          title={`End-of-Semester 5★–1★ Evaluation Submissions (${semesterEvaluations.length})`}
        />
        {semesterEvaluations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs font-bold text-slate-400">
            No end-of-semester evaluations submitted yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {semesterEvaluations.map((ev) => (
              <div
                key={ev.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRatingDisplay value={ev.rating} size={14} showLabel />
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                      {ev.teacherName} · {ev.subject}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{ev.createdAt}</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-700">{ev.comment}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>
                    Submitted by <strong>{ev.submittedByName}</strong> ({ev.submittedByRole}) ·{' '}
                    {ev.studentName} ({ev.classSection})
                  </span>
                  <span className="font-bold text-amber-700">
                    Clarity {ev.teachingClarity}★ · Support {ev.supportiveness}★
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All School Feedback Threads */}
      <div className="mt-6 space-y-3">
        <SectionTitle eyebrow="School-wide inbox" title="Recent Student, Guardian & Teacher Feedback" />
        {feedback.slice(0, 12).map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <FeedbackBadge category={item.category} />
                <span className="text-xs font-black text-slate-800">
                  {item.studentName} · {item.subject} · {item.teacherName}
                </span>
                {item.rating && <StarRatingDisplay value={item.rating} size={13} />}
              </div>
              <span className="text-[10px] font-bold text-slate-400">{item.date}</span>
            </div>
            <p className="mt-2 text-sm font-black text-slate-900">{item.title}</p>
            <p className="mt-1 text-xs text-slate-600">{item.message}</p>
            {item.teacherReply && (
              <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <strong>School Reply:</strong> {item.teacherReply}
              </p>
            )}
            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
              <input
                value={replyDrafts[item.id] || ''}
                onChange={(e) =>
                  setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
                placeholder="Write Principal / Admin response..."
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-emerald-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={async () => {
                  await acknowledgeFeedback(item.id, replyDrafts[item.id])
                  setReplyDrafts((prev) => ({ ...prev, [item.id]: '' }))
                }}
                className="rounded-xl bg-[#0f172a] px-3.5 py-1.5 text-xs font-bold text-emerald-300"
              >
                Reply
              </button>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
