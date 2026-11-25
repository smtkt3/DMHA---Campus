import type { AssignmentItem, CourseMaterialItem } from '@/components/school/types'

export const DMHS_FOCUS_MATERIAL_KEY = 'dmhs_focus_material_v1'
export const DMHS_FOCUS_HOMEWORK_KEY = 'dmhs_focus_homework_v1'

export interface SubjectTheme {
  emoji: string
  badgeBg: string
  badgeText: string
  ring: string
  barBg: string
  softBg: string
}

export function getSubjectTheme(subject: string): SubjectTheme {
  const s = String(subject || '').toLowerCase()
  if (s.includes('phys')) {
    return {
      emoji: '⚡',
      badgeBg: 'bg-indigo-50',
      badgeText: 'text-indigo-800',
      ring: 'ring-indigo-200',
      barBg: 'bg-indigo-600',
      softBg: 'bg-indigo-50/70',
    }
  }
  if (s.includes('math')) {
    return {
      emoji: '📐',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-800',
      ring: 'ring-emerald-200',
      barBg: 'bg-emerald-600',
      softBg: 'bg-emerald-50/70',
    }
  }
  if (s.includes('eng')) {
    return {
      emoji: '📖',
      badgeBg: 'bg-sky-50',
      badgeText: 'text-sky-800',
      ring: 'ring-sky-200',
      barBg: 'bg-sky-600',
      softBg: 'bg-sky-50/70',
    }
  }
  if (s.includes('chem')) {
    return {
      emoji: '🧪',
      badgeBg: 'bg-teal-50',
      badgeText: 'text-teal-800',
      ring: 'ring-teal-200',
      barBg: 'bg-teal-600',
      softBg: 'bg-teal-50/70',
    }
  }
  if (s.includes('ict') || s.includes('robot') || s.includes('comp')) {
    return {
      emoji: '💻',
      badgeBg: 'bg-violet-50',
      badgeText: 'text-violet-800',
      ring: 'ring-violet-200',
      barBg: 'bg-violet-600',
      softBg: 'bg-violet-50/70',
    }
  }
  if (s.includes('bangla') || s.includes('beng')) {
    return {
      emoji: '✒️',
      badgeBg: 'bg-rose-50',
      badgeText: 'text-rose-800',
      ring: 'ring-rose-200',
      barBg: 'bg-rose-600',
      softBg: 'bg-rose-50/70',
    }
  }
  if (s.includes('sci') || s.includes('bio')) {
    return {
      emoji: '🔬',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-900',
      ring: 'ring-amber-200',
      barBg: 'bg-amber-500',
      softBg: 'bg-amber-50/70',
    }
  }
  return {
    emoji: '📚',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    ring: 'ring-slate-200',
    barBg: 'bg-slate-700',
    softBg: 'bg-slate-50',
  }
}

export function extractChapterNumber(chapterTitle: string, explicitNum?: number): number {
  if (typeof explicitNum === 'number' && Number.isFinite(explicitNum) && explicitNum > 0) {
    return explicitNum
  }
  const match = String(chapterTitle || '').match(/(?:chapter|ch\.?|unit|module)\s*(\d+)/i)
  if (match) return Number.parseInt(match[1], 10)
  return 999
}

export function normalizeChapterKey(chapterTitle: string): string {
  return String(chapterTitle || 'General Chapter')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normSubj(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+language$/i, '')
    .replace(/^elementary\s+/i, '')
}

/**
 * Finds all unique homework tasks linked to a specific Course Material lesson.
 * Deduplicates across classmates so Teachers see 1 task per homework assignment,
 * while Students/Guardians see their specific child's assignment record.
 */
export function findLinkedHomeworksForMaterial(
  material: CourseMaterialItem,
  assignments: AssignmentItem[],
  preferredStudentId?: string,
): AssignmentItem[] {
  const matChap = normalizeChapterKey(material.chapterTitle)
  const matSubj = normSubj(material.subject)

  const matches = assignments.filter((hw) => {
    if (preferredStudentId && hw.studentId !== preferredStudentId) return false
    if (hw.linkedMaterialId && hw.linkedMaterialId === material.id) return true
    if (material.linkedHomeworkId && hw.id === material.linkedHomeworkId) return true
    // Also match sibling classmate copies of the linkedHomeworkId
    if (material.linkedHomeworkId) {
      const seed = assignments.find((a) => a.id === material.linkedHomeworkId)
      if (seed && hw.title === seed.title && hw.subject === seed.subject) return true
    }
    if (
      hw.chapterTitle &&
      normSubj(hw.subject) === matSubj &&
      normalizeChapterKey(hw.chapterTitle) === matChap
    ) {
      return true
    }
    return false
  })

  if (preferredStudentId) return matches
  // Deduplicate by title + subject + dueDate for Teacher/Admin overview
  const seen = new Set<string>()
  return matches.filter((hw) => {
    const key = `${hw.title.toLowerCase()}|${hw.subject.toLowerCase()}|${hw.dueDate}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Finds the best matching Course Material lesson for a given Homework item.
 */
export function findLinkedMaterialForHomework(
  homework: AssignmentItem,
  materials: CourseMaterialItem[],
): CourseMaterialItem | null {
  const published = materials.filter((m) => m.status === 'published')
  const pool = published.length > 0 ? published : materials

  // 1. Direct linkedMaterialId match
  if (homework.linkedMaterialId) {
    const exact = pool.find((m) => m.id === homework.linkedMaterialId)
    if (exact) return exact
  }
  // 2. Direct reverse linkedHomeworkId match
  const rev = pool.find((m) => m.linkedHomeworkId === homework.id)
  if (rev) return rev

  // 3. Same subject + same chapter title
  const hwSubj = normSubj(homework.subject)
  if (homework.chapterTitle) {
    const hwChap = normalizeChapterKey(homework.chapterTitle)
    const byChap = pool.find(
      (m) => normSubj(m.subject) === hwSubj && normalizeChapterKey(m.chapterTitle) === hwChap,
    )
    if (byChap) return byChap
  }

  // 4. Keyword overlap in title / whatToStudy within the same subject
  const sameSubject = pool.filter((m) => normSubj(m.subject) === hwSubj)
  if (sameSubject.length === 0) return null

  const hwHay = `${homework.title} ${(homework.whatToStudy || []).join(' ')}`.toLowerCase()
  const scored = sameSubject
    .map((m) => {
      const words = `${m.chapterTitle} ${m.topicTitle}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4)
      const score = words.reduce((acc, w) => acc + (hwHay.includes(w) ? 1 : 0), 0)
      return { m, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored[0]?.score > 0 ? scored[0].m : sameSubject[0]
}

export function setStudyFocusMaterial(payload: {
  materialId?: string
  subject?: string
  chapterTitle?: string
}) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(DMHS_FOCUS_MATERIAL_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage quota errors
  }
}

export function consumeStudyFocusMaterial(): {
  materialId?: string
  subject?: string
  chapterTitle?: string
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(DMHS_FOCUS_MATERIAL_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(DMHS_FOCUS_MATERIAL_KEY)
    return JSON.parse(raw) as { materialId?: string; subject?: string; chapterTitle?: string }
  } catch {
    return null
  }
}

export function setStudyFocusHomework(homeworkId: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(DMHS_FOCUS_HOMEWORK_KEY, homeworkId)
  } catch {
    // ignore
  }
}

export function consumeStudyFocusHomework(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(DMHS_FOCUS_HOMEWORK_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(DMHS_FOCUS_HOMEWORK_KEY)
    return raw
  } catch {
    return null
  }
}
