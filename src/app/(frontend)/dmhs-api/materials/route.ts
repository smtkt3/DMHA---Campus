import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SchoolWeekday = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu'

interface ServerAttachment {
  id: string
  name: string
  kind: 'slides' | 'pdf' | 'image' | 'doc' | 'link'
  url: string
  sizeLabel?: string
}

interface ServerSemesterConfig {
  termName: string
  totalWeeks: number
  updatedAt?: string
}

interface ServerCourseMaterial {
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
  attachments: ServerAttachment[]
  linkedHomeworkId?: string
  linkedQuizId?: string
  status: 'draft' | 'published'
  downloads: number
  revisedByStudentIds: string[]
  createdAt: string
  updatedAt: string
}

interface ServerTeacherRow {
  id: string
  name: string
  subject: string
  assignedClasses?: string[]
  status?: string
}

interface ServerStudentRow {
  id: string
  name: string
  className: string
  section: string
  guardianId?: string
}

interface ServerGuardianRow {
  id: string
  name: string
  linkedStudentIds?: string[]
}

const VALID_DAYS = new Set<SchoolWeekday>(['Sun', 'Mon', 'Tue', 'Wed', 'Thu'])
const VALID_ATTACH_KINDS = new Set(['slides', 'pdf', 'image', 'doc', 'link'])

const DEFAULT_SEMESTER_CONFIG: ServerSemesterConfig = {
  termName: 'Term Final 2026',
  totalWeeks: 14,
}

function normalizeClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function teacherAssignedToClass(targetClassSection: string, assignedClasses: string[]): boolean {
  if (!assignedClasses || assignedClasses.length === 0) return false
  const target = normalizeClassToken(targetClassSection)
  if (!target || target === 'all' || target === 'allclasses') return false
  return assignedClasses.some((cls) => normalizeClassToken(cls) === target)
}

function studentMatchesClassSection(
  student: Pick<ServerStudentRow, 'className' | 'section'>,
  classSection: string,
): boolean {
  const matToken = normalizeClassToken(classSection)
  if (!matToken) return false
  if (matToken === 'all' || matToken === 'allclasses') return true
  const full = normalizeClassToken(`${student.className} ${student.section}`)
  const secLetter = student.section.replace(/section/i, '').trim().toLowerCase()
  const compact = normalizeClassToken(`${student.className}${secLetter}`)
  const gradeOnly = normalizeClassToken(student.className)
  return matToken === full || matToken === compact || matToken === gradeOnly
}

function guardianOwnsStudent(
  guardianId: string,
  student: ServerStudentRow,
  guardians: ServerGuardianRow[],
): boolean {
  if (student.guardianId === guardianId) return true
  const g = guardians.find((item) => item.id === guardianId)
  return Boolean(g?.linkedStudentIds?.includes(student.id))
}

function sanitizeAttachments(raw: unknown): ServerAttachment[] {
  if (!Array.isArray(raw)) return []
  const now = Date.now()
  const out: ServerAttachment[] = []
  for (let idx = 0; idx < Math.min(12, raw.length); idx++) {
    const obj = raw[idx] as Record<string, unknown>
    const name = String(obj?.name || '').trim()
    const url = String(obj?.url || '').trim()
    if (!name || !url) continue
    const kindRaw = String(obj?.kind || 'pdf')
    const kind = (
      VALID_ATTACH_KINDS.has(kindRaw) ? kindRaw : 'pdf'
    ) as ServerAttachment['kind']
    const sizeLabel =
      typeof obj?.sizeLabel === 'string' && obj.sizeLabel.trim()
        ? obj.sizeLabel.trim()
        : undefined
    out.push({
      id: typeof obj?.id === 'string' && obj.id.trim() ? obj.id.trim() : `att-${now}-${idx}`,
      name,
      kind,
      url,
      ...(sizeLabel ? { sizeLabel } : {}),
    })
  }
  return out
}

function sanitizeObjectives(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 12)
  }
  if (typeof raw === 'string') {
    return raw
      .split('\n')
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 12)
  }
  return []
}

function parseChapterNumber(rawNum: unknown, chapterTitle: string): number | undefined {
  const n = Number(rawNum)
  if (Number.isFinite(n) && n >= 1 && n <= 99) return Math.round(n)
  const m = chapterTitle.match(/(?:chapter|ch\.?|unit|module)\s*(\d+)/i)
  if (m) return Math.max(1, Math.min(99, Number.parseInt(m[1], 10)))
  return undefined
}

function syncMaterialLinkIntoAssignments(
  currentData: Record<string, unknown>,
  materialId: string,
  chapterTitle: string,
  linkedHomeworkId: string | undefined,
): Array<Record<string, unknown>> | undefined {
  if (!linkedHomeworkId || !Array.isArray(currentData.assignments)) return undefined
  const assignments = currentData.assignments as Array<Record<string, unknown>>
  const seed = assignments.find((a) => String(a.id) === linkedHomeworkId)
  if (!seed) return undefined
  return assignments.map((a) => {
    const sameTask =
      String(a.id) === linkedHomeworkId ||
      (String(a.title) === String(seed.title) &&
        String(a.subject) === String(seed.subject) &&
        String(a.dueDate) === String(seed.dueDate))
    if (!sameTask) return a
    return {
      ...a,
      linkedMaterialId: materialId,
      chapterTitle: String(a.chapterTitle || '').trim() || chapterTitle,
    }
  })
}

function teacherOwnsMaterial(
  mat: ServerCourseMaterial,
  teacher: ServerTeacherRow,
): boolean {
  return (
    mat.teacherId === teacher.id ||
    mat.teacherName.trim().toLowerCase() === teacher.name.trim().toLowerCase()
  )
}

export async function GET() {
  try {
    const auth = await requireAuthSession()
    if (!auth.ok) return auth.response
    const { session } = auth

    const persisted = loadPersistedState()
    const data = persisted.exists && persisted.data ? persisted.data : {}
    const allMaterials: ServerCourseMaterial[] = Array.isArray(data.courseMaterials)
      ? (data.courseMaterials as ServerCourseMaterial[])
      : []
    const semesterConfig: ServerSemesterConfig =
      data.semesterSyllabusConfig && typeof data.semesterSyllabusConfig === 'object'
        ? (data.semesterSyllabusConfig as ServerSemesterConfig)
        : DEFAULT_SEMESTER_CONFIG
    const teachers: ServerTeacherRow[] = Array.isArray(data.teachers)
      ? (data.teachers as ServerTeacherRow[])
      : []
    const students: ServerStudentRow[] = Array.isArray(data.students)
      ? (data.students as ServerStudentRow[])
      : []
    const guardians: ServerGuardianRow[] = Array.isArray(data.guardians)
      ? (data.guardians as ServerGuardianRow[])
      : []

    if (session.role === 'admin') {
      return NextResponse.json({
        ok: true,
        role: 'admin',
        semesterConfig,
        assignedClasses: ['ALL'],
        materials: allMaterials,
      })
    }

    if (session.role === 'teacher') {
      const teacher = teachers.find((t) => t.id === session.linked_entity_id) || null
      const assignedClasses = teacher?.assignedClasses || []
      const visible = teacher
        ? allMaterials.filter(
            (m) =>
              teacherOwnsMaterial(m, teacher) ||
              (m.status === 'published' && teacherAssignedToClass(m.classSection, assignedClasses)),
          )
        : []
      return NextResponse.json({
        ok: true,
        role: 'teacher',
        semesterConfig,
        assignedClasses,
        materials: visible,
      })
    }

    if (session.role === 'student') {
      const me = students.find((s) => s.id === session.linked_entity_id) || null
      const visible = me
        ? allMaterials.filter(
            (m) => m.status === 'published' && studentMatchesClassSection(me, m.classSection),
          )
        : []
      return NextResponse.json({
        ok: true,
        role: 'student',
        semesterConfig,
        materials: visible,
      })
    }

    if (session.role === 'guardian') {
      const myKids = students.filter((s) =>
        guardianOwnsStudent(session.linked_entity_id, s, guardians),
      )
      const visible = allMaterials.filter(
        (m) =>
          m.status === 'published' &&
          myKids.some((kid) => studentMatchesClassSection(kid, m.classSection)),
      )
      return NextResponse.json({
        ok: true,
        role: 'guardian',
        semesterConfig,
        materials: visible,
      })
    }

    return NextResponse.json({
      ok: true,
      role: session.role,
      semesterConfig,
      materials: [],
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to load course materials.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession()
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || 'create')

    const persisted = loadPersistedState()
    if (!persisted.exists || !persisted.data) {
      return NextResponse.json(
        { ok: false, error: 'School state is not initialized in SQLite.' },
        { status: 400 },
      )
    }

    const currentData = persisted.data
    const materials: ServerCourseMaterial[] = Array.isArray(currentData.courseMaterials)
      ? (currentData.courseMaterials as ServerCourseMaterial[])
      : []
    const semesterConfig: ServerSemesterConfig =
      currentData.semesterSyllabusConfig && typeof currentData.semesterSyllabusConfig === 'object'
        ? (currentData.semesterSyllabusConfig as ServerSemesterConfig)
        : DEFAULT_SEMESTER_CONFIG
    const teachers: ServerTeacherRow[] = Array.isArray(currentData.teachers)
      ? (currentData.teachers as ServerTeacherRow[])
      : []
    const students: ServerStudentRow[] = Array.isArray(currentData.students)
      ? (currentData.students as ServerStudentRow[])
      : []
    const guardians: ServerGuardianRow[] = Array.isArray(currentData.guardians)
      ? (currentData.guardians as ServerGuardianRow[])
      : []

    const activeTeacher =
      session.role === 'teacher'
        ? teachers.find((t) => t.id === session.linked_entity_id) || null
        : null

    // ==================== 1. ADMIN: UPDATE FLEXIBLE SEMESTER CONFIG ====================
    if (action === 'update_semester_config') {
      if (session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Admin can configure the school semester length & term name.' },
          { status: 403 },
        )
      }
      const termName = String(body.termName || semesterConfig.termName).trim() || 'Term Final 2026'
      const rawWeeks = Math.round(Number(body.totalWeeks) || semesterConfig.totalWeeks)
      const totalWeeks = Math.max(1, Math.min(52, rawWeeks))
      const nextConfig: ServerSemesterConfig = {
        termName,
        totalWeeks,
        updatedAt: new Date().toISOString(),
      }
      const saved = savePersistedState(
        {
          ...currentData,
          semesterSyllabusConfig: nextConfig,
        },
        session.display_name,
      )
      appendSecurityAudit({
        action: 'semester_config_updated',
        target: `${termName} · ${totalWeeks} weeks`,
        actor: session.display_name,
        actorRole: 'admin',
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
      })
      return NextResponse.json({
        ok: true,
        semesterConfig: nextConfig,
        version: saved.version,
      })
    }

    // ==================== 2. CREATE COURSE MATERIAL / LESSON ====================
    if (action === 'create') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can create course materials.' },
          { status: 403 },
        )
      }
      if (session.role === 'teacher' && (!activeTeacher || activeTeacher.status === 'suspended')) {
        return NextResponse.json(
          { ok: false, error: 'Active faculty profile not found or suspended.' },
          { status: 403 },
        )
      }

      const classSection = String(body.classSection || '').trim()
      const subject = String(body.subject || '').trim()
      const chapterTitle = String(body.chapterTitle || '').trim() || 'Chapter 1: Core Module'
      const chapterNumber = parseChapterNumber(body.chapterNumber, chapterTitle)
      const topicTitle = String(body.topicTitle || '').trim()
      const weekNumber = Math.max(1, Math.min(52, Math.round(Number(body.weekNumber) || 1)))
      const weekLabel = String(body.weekLabel || '').trim() || `Week ${weekNumber}`
      const dayRaw = String(body.dayOfWeek || 'Sun') as SchoolWeekday
      const dayOfWeek: SchoolWeekday = VALID_DAYS.has(dayRaw) ? dayRaw : 'Sun'
      const lessonDate = String(body.lessonDate || '').trim() || new Date().toISOString().slice(0, 10)
      const periodTime = typeof body.periodTime === 'string' ? body.periodTime.trim() : undefined
      const classNotes = String(body.classNotes || '').trim()
      const examTips = typeof body.examTips === 'string' ? body.examTips.trim() : undefined
      const textbookRef = typeof body.textbookRef === 'string' ? body.textbookRef.trim() : undefined
      const linkedHomeworkId =
        typeof body.linkedHomeworkId === 'string' && body.linkedHomeworkId.trim()
          ? body.linkedHomeworkId.trim()
          : undefined
      const linkedQuizId =
        typeof body.linkedQuizId === 'string' && body.linkedQuizId.trim()
          ? body.linkedQuizId.trim()
          : undefined
      const status: 'draft' | 'published' = body.status === 'draft' ? 'draft' : 'published'
      const termName = String(body.termName || semesterConfig.termName).trim() || semesterConfig.termName

      if (!classSection || !subject || !topicTitle) {
        return NextResponse.json(
          { ok: false, error: 'Target class, subject, and lesson topic title are required.' },
          { status: 400 },
        )
      }

      const assignedClasses = activeTeacher?.assignedClasses || []
      if (session.role === 'teacher' && !teacherAssignedToClass(classSection, assignedClasses)) {
        appendSecurityAudit({
          action: 'materials_unauthorized_class_blocked',
          target: `${activeTeacher!.name} attempted to create course material "${topicTitle}" for unassigned class "${classSection}"`,
          actor: activeTeacher!.name,
          actorRole: 'teacher',
          ipAddress: ip,
        })
        return NextResponse.json(
          {
            ok: false,
            error: `Access Denied: You are not assigned to "${classSection}". Teachers can only create course materials for their assigned classes (${assignedClasses.join(', ') || 'None'}).`,
          },
          { status: 403 },
        )
      }

      const actorName = activeTeacher?.name || session.display_name
      const actorId = activeTeacher?.id || session.linked_entity_id
      const nowLabel = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })

      const newItem: ServerCourseMaterial = {
        id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        termName,
        weekNumber,
        weekLabel,
        dayOfWeek,
        lessonDate,
        ...(periodTime ? { periodTime } : {}),
        classSection,
        subject,
        teacherId: actorId,
        teacherName: actorName,
        ...(chapterNumber ? { chapterNumber } : {}),
        chapterTitle,
        topicTitle,
        learningObjectives: sanitizeObjectives(body.learningObjectives),
        classNotes,
        ...(examTips ? { examTips } : {}),
        ...(textbookRef ? { textbookRef } : {}),
        attachments: sanitizeAttachments(body.attachments),
        ...(linkedHomeworkId ? { linkedHomeworkId } : {}),
        ...(linkedQuizId ? { linkedQuizId } : {}),
        status,
        downloads: 0,
        revisedByStudentIds: [],
        createdAt: nowLabel,
        updatedAt: nowLabel,
      }

      // Auto-expand semester totalWeeks if teacher plans beyond current default week count
      const nextConfig: ServerSemesterConfig =
        weekNumber > semesterConfig.totalWeeks
          ? { ...semesterConfig, totalWeeks: weekNumber }
          : semesterConfig

      const nextMaterials = [newItem, ...materials]
      const syncedAssignments = syncMaterialLinkIntoAssignments(
        currentData,
        newItem.id,
        newItem.chapterTitle,
        linkedHomeworkId,
      )
      const saved = savePersistedState(
        {
          ...currentData,
          courseMaterials: nextMaterials,
          semesterSyllabusConfig: nextConfig,
          ...(syncedAssignments ? { assignments: syncedAssignments } : {}),
        },
        actorName,
      )

      appendSecurityAudit({
        action: status === 'published' ? 'course_material_published' : 'course_material_draft_saved',
        target: `${weekLabel} (${dayOfWeek}) · ${classSection} · ${subject} — "${topicTitle}" (${newItem.attachments.length} file(s))`,
        actor: actorName,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: actorName,
      })

      return NextResponse.json({
        ok: true,
        material: newItem,
        materials: nextMaterials,
        ...(syncedAssignments ? { assignments: syncedAssignments } : {}),
        semesterConfig: nextConfig,
        version: saved.version,
      })
    }

    // ==================== 3. UPDATE EXISTING COURSE MATERIAL ====================
    if (action === 'update') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can edit course materials.' },
          { status: 403 },
        )
      }
      const materialId = String(body.materialId || '').trim()
      const existing = materials.find((m) => m.id === materialId)
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'Course material not found.' }, { status: 404 })
      }

      const nextClassSection = String(body.classSection ?? existing.classSection).trim()
      if (session.role === 'teacher') {
        if (!activeTeacher || !teacherOwnsMaterial(existing, activeTeacher)) {
          return NextResponse.json(
            { ok: false, error: `Access Denied: This lesson belongs to ${existing.teacherName}.` },
            { status: 403 },
          )
        }
        if (!teacherAssignedToClass(nextClassSection, activeTeacher.assignedClasses || [])) {
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: "${nextClassSection}" is not in your assigned classes.`,
            },
            { status: 403 },
          )
        }
      }

      const weekNumber = Math.max(
        1,
        Math.min(52, Math.round(Number(body.weekNumber ?? existing.weekNumber) || 1)),
      )
      const weekLabel = String(body.weekLabel ?? existing.weekLabel).trim() || `Week ${weekNumber}`
      const dayRaw = String(body.dayOfWeek ?? existing.dayOfWeek) as SchoolWeekday
      const dayOfWeek: SchoolWeekday = VALID_DAYS.has(dayRaw) ? dayRaw : existing.dayOfWeek

      const nextChapterTitle =
        String(body.chapterTitle ?? existing.chapterTitle).trim() || existing.chapterTitle
      const nextChapterNum = parseChapterNumber(
        body.chapterNumber ?? existing.chapterNumber,
        nextChapterTitle,
      )

      const updatedItem: ServerCourseMaterial = {
        ...existing,
        termName: String(body.termName ?? existing.termName).trim() || existing.termName,
        weekNumber,
        weekLabel,
        dayOfWeek,
        lessonDate: String(body.lessonDate ?? existing.lessonDate).trim() || existing.lessonDate,
        periodTime:
          body.periodTime !== undefined ? String(body.periodTime || '').trim() || undefined : existing.periodTime,
        classSection: nextClassSection,
        subject: String(body.subject ?? existing.subject).trim() || existing.subject,
        ...(nextChapterNum ? { chapterNumber: nextChapterNum } : {}),
        chapterTitle: nextChapterTitle,
        topicTitle: String(body.topicTitle ?? existing.topicTitle).trim() || existing.topicTitle,
        learningObjectives:
          body.learningObjectives !== undefined
            ? sanitizeObjectives(body.learningObjectives)
            : existing.learningObjectives,
        classNotes: body.classNotes !== undefined ? String(body.classNotes || '').trim() : existing.classNotes,
        examTips:
          body.examTips !== undefined ? String(body.examTips || '').trim() || undefined : existing.examTips,
        textbookRef:
          body.textbookRef !== undefined
            ? String(body.textbookRef || '').trim() || undefined
            : existing.textbookRef,
        attachments:
          body.attachments !== undefined
            ? sanitizeAttachments(body.attachments)
            : existing.attachments,
        linkedHomeworkId:
          body.linkedHomeworkId !== undefined
            ? String(body.linkedHomeworkId || '').trim() || undefined
            : existing.linkedHomeworkId,
        linkedQuizId:
          body.linkedQuizId !== undefined
            ? String(body.linkedQuizId || '').trim() || undefined
            : existing.linkedQuizId,
        status:
          body.status === 'draft' || body.status === 'published' ? body.status : existing.status,
        updatedAt: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      }

      const nextConfig: ServerSemesterConfig =
        weekNumber > semesterConfig.totalWeeks
          ? { ...semesterConfig, totalWeeks: weekNumber }
          : semesterConfig
      const nextMaterials = materials.map((m) => (m.id === materialId ? updatedItem : m))
      const syncedAssignments = syncMaterialLinkIntoAssignments(
        currentData,
        updatedItem.id,
        updatedItem.chapterTitle,
        updatedItem.linkedHomeworkId,
      )

      const saved = savePersistedState(
        {
          ...currentData,
          courseMaterials: nextMaterials,
          semesterSyllabusConfig: nextConfig,
          ...(syncedAssignments ? { assignments: syncedAssignments } : {}),
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'course_material_updated',
        target: `${updatedItem.weekLabel} · ${updatedItem.classSection} · "${updatedItem.topicTitle}"`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
      })

      return NextResponse.json({
        ok: true,
        material: updatedItem,
        materials: nextMaterials,
        ...(syncedAssignments ? { assignments: syncedAssignments } : {}),
        semesterConfig: nextConfig,
        version: saved.version,
      })
    }

    // ==================== 4. TOGGLE PUBLISH / DRAFT ====================
    if (action === 'toggle_publish') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 403 })
      }
      const materialId = String(body.materialId || '').trim()
      const existing = materials.find((m) => m.id === materialId)
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'Course material not found.' }, { status: 404 })
      }
      if (session.role === 'teacher' && (!activeTeacher || !teacherOwnsMaterial(existing, activeTeacher))) {
        return NextResponse.json(
          { ok: false, error: `Access Denied: Only ${existing.teacherName} or Admin can change publish status.` },
          { status: 403 },
        )
      }

      const nextStatus: 'draft' | 'published' =
        existing.status === 'published' ? 'draft' : 'published'
      const updated = { ...existing, status: nextStatus }
      const nextMaterials = materials.map((m) => (m.id === materialId ? updated : m))

      const saved = savePersistedState(
        {
          ...currentData,
          courseMaterials: nextMaterials,
        },
        session.display_name,
      )

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
      })

      return NextResponse.json({
        ok: true,
        material: updated,
        materials: nextMaterials,
        version: saved.version,
      })
    }

    // ==================== 5. DUPLICATE TO ANOTHER ASSIGNED CLASS SECTION ====================
    if (action === 'duplicate_to_class') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 403 })
      }
      const materialId = String(body.materialId || '').trim()
      const targetClassSection = String(body.targetClassSection || '').trim()
      const existing = materials.find((m) => m.id === materialId)
      if (!existing || !targetClassSection) {
        return NextResponse.json(
          { ok: false, error: 'Material and target class section are required.' },
          { status: 400 },
        )
      }

      if (session.role === 'teacher') {
        if (!activeTeacher || !teacherOwnsMaterial(existing, activeTeacher)) {
          return NextResponse.json(
            { ok: false, error: `Access Denied: You can only duplicate your own course materials.` },
            { status: 403 },
          )
        }
        if (!teacherAssignedToClass(targetClassSection, activeTeacher.assignedClasses || [])) {
          appendSecurityAudit({
            action: 'materials_unauthorized_class_blocked',
            target: `${activeTeacher.name} attempted to duplicate "${existing.topicTitle}" into unassigned class "${targetClassSection}"`,
            actor: activeTeacher.name,
            actorRole: 'teacher',
            ipAddress: ip,
          })
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: "${targetClassSection}" is not in your assigned classes.`,
            },
            { status: 403 },
          )
        }
      }

      const nowLabel = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      const cloned: ServerCourseMaterial = {
        ...existing,
        id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        classSection: targetClassSection,
        downloads: 0,
        revisedByStudentIds: [],
        createdAt: nowLabel,
        updatedAt: nowLabel,
      }
      const nextMaterials = [cloned, ...materials]
      const saved = savePersistedState(
        {
          ...currentData,
          courseMaterials: nextMaterials,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'course_material_duplicated',
        target: `Copied "${existing.topicTitle}" (${existing.classSection} → ${targetClassSection})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
      })

      return NextResponse.json({
        ok: true,
        material: cloned,
        materials: nextMaterials,
        version: saved.version,
      })
    }

    // ==================== 6. DELETE MATERIAL ====================
    if (action === 'delete') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 403 })
      }
      const materialId = String(body.materialId || '').trim()
      const existing = materials.find((m) => m.id === materialId)
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'Course material not found.' }, { status: 404 })
      }
      if (session.role === 'teacher' && (!activeTeacher || !teacherOwnsMaterial(existing, activeTeacher))) {
        return NextResponse.json(
          { ok: false, error: `Access Denied: Only ${existing.teacherName} or Admin can delete this lesson.` },
          { status: 403 },
        )
      }

      const nextMaterials = materials.filter((m) => m.id !== materialId)
      const saved = savePersistedState(
        {
          ...currentData,
          courseMaterials: nextMaterials,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'course_material_deleted',
        target: `${existing.weekLabel} · ${existing.classSection} · "${existing.topicTitle}"`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
      })

      return NextResponse.json({
        ok: true,
        deletedId: materialId,
        materials: nextMaterials,
        version: saved.version,
      })
    }

    // ==================== 7. TRACK FILE DOWNLOAD ====================
    if (action === 'track_download') {
      const materialId = String(body.materialId || '').trim()
      const existing = materials.find((m) => m.id === materialId)
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'Material not found.' }, { status: 404 })
      }
      const nextMaterials = materials.map((m) =>
        m.id === materialId ? { ...m, downloads: (m.downloads || 0) + 1 } : m,
      )
      const saved = savePersistedState(
        {
          ...currentData,
          courseMaterials: nextMaterials,
        },
        session.display_name,
      )
      return NextResponse.json({
        ok: true,
        materials: session.role === 'admin' ? nextMaterials : undefined,
        downloads: (existing.downloads || 0) + 1,
        version: saved.version,
      })
    }

    // ==================== 8. STUDENT / GUARDIAN MARK LESSON REVISED ====================
    if (action === 'toggle_revised') {
      const materialId = String(body.materialId || '').trim()
      const studentId = String(body.studentId || '').trim()
      const existing = materials.find((m) => m.id === materialId)
      const student = students.find((s) => s.id === studentId)
      if (!existing || !student) {
        return NextResponse.json({ ok: false, error: 'Material or student not found.' }, { status: 404 })
      }
      if (session.role === 'student' && student.id !== session.linked_entity_id) {
        return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 403 })
      }
      if (
        session.role === 'guardian' &&
        !guardianOwnsStudent(session.linked_entity_id, student, guardians)
      ) {
        return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 403 })
      }

      const cur = new Set(existing.revisedByStudentIds || [])
      if (cur.has(student.id)) cur.delete(student.id)
      else cur.add(student.id)

      const nextMaterials = materials.map((m) =>
        m.id === materialId ? { ...m, revisedByStudentIds: Array.from(cur) } : m,
      )
      const saved = savePersistedState(
        {
          ...currentData,
          courseMaterials: nextMaterials,
        },
        session.display_name,
      )
      return NextResponse.json({
        ok: true,
        revised: cur.has(student.id),
        revisedByStudentIds: Array.from(cur),
        version: saved.version,
      })
    }

    return NextResponse.json({ ok: false, error: `Unsupported action "${action}".` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Course material operation failed.' },
      { status: 500 },
    )
  }
}
