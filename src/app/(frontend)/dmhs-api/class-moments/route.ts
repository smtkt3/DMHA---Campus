import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import type {
  ClassMomentComment,
  ClassMomentMedia,
  ClassMomentPost,
  GuardianRecord,
  Role,
  StudentRecord,
  TeacherRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function studentMatchesClassSection(
  student: StudentRecord,
  className: string,
  section: string,
): boolean {
  const targetFull = normalizeClassToken(`${className} ${section}`)
  const stuFull = normalizeClassToken(`${student.className} ${student.section}`)
  if (targetFull && targetFull === stuFull) return true
  const secLetter = section.replace(/section/i, '').trim().toLowerCase()
  const stuSecLetter = student.section.replace(/section/i, '').trim().toLowerCase()
  return (
    normalizeClassToken(student.className) === normalizeClassToken(className) &&
    (!secLetter || secLetter === 'all' || secLetter === stuSecLetter)
  )
}

function teacherAssignedToClass(
  teacher: TeacherRecord | undefined,
  className: string,
  section: string,
): boolean {
  if (!teacher || !Array.isArray(teacher.assignedClasses) || teacher.assignedClasses.length === 0) {
    return false
  }
  const targetFull = normalizeClassToken(`${className} ${section}`)
  const targetGrade = normalizeClassToken(className)
  return teacher.assignedClasses.some((cls) => {
    const tok = normalizeClassToken(cls)
    return tok === targetFull || tok === targetGrade
  })
}

function resolveGuardianIdsForStudents(
  enrolledStudents: StudentRecord[],
  guardians: GuardianRecord[],
): string[] {
  const set = new Set<string>()
  const stuIds = new Set(enrolledStudents.map((s) => s.id))
  enrolledStudents.forEach((s) => {
    if (s.guardianId) set.add(s.guardianId)
  })
  guardians.forEach((g) => {
    const linked = Array.isArray(g.linkedStudentIds) ? g.linkedStudentIds : []
    if (linked.some((sid) => stuIds.has(sid))) {
      set.add(g.id)
    }
  })
  return Array.from(set)
}

function guardianCanAccessMoment(
  guardianId: string,
  moment: ClassMomentPost,
  students: StudentRecord[],
  guardians: GuardianRecord[],
): boolean {
  if (Array.isArray(moment.recipientGuardianIds) && moment.recipientGuardianIds.includes(guardianId)) {
    return true
  }
  const g = guardians.find((x) => x.id === guardianId)
  const linkedIds = new Set<string>(g?.linkedStudentIds || [])
  students.forEach((s) => {
    if (s.guardianId === guardianId) linkedIds.add(s.id)
  })
  const enrolledInMomentClass = students.some(
    (s) =>
      linkedIds.has(s.id) &&
      (moment.recipientStudentIds?.includes(s.id) ||
        studentMatchesClassSection(s, moment.className, moment.section)),
  )
  return enrolledInMomentClass
}

function scopeMomentsForSession(
  moments: ClassMomentPost[],
  session: { role: string; linked_entity_id: string; user_id: string },
  students: StudentRecord[],
  teachers: TeacherRecord[],
  guardians: GuardianRecord[],
): ClassMomentPost[] {
  if (session.role === 'admin') return moments
  if (session.role === 'guardian') {
    return moments.filter((m) =>
      guardianCanAccessMoment(session.linked_entity_id, m, students, guardians),
    )
  }
  if (session.role === 'student') {
    const stu = students.find((s) => s.id === session.linked_entity_id)
    if (!stu) return []
    return moments.filter(
      (m) =>
        m.recipientStudentIds?.includes(stu.id) ||
        studentMatchesClassSection(stu, m.className, m.section),
    )
  }
  if (session.role === 'teacher') {
    const tch = teachers.find((t) => t.id === session.linked_entity_id)
    return moments.filter(
      (m) =>
        m.teacherId === session.linked_entity_id ||
        teacherAssignedToClass(tch, m.className, m.section),
    )
  }
  return []
}

function getTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatNowLabel(): string {
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `Today · ${t}`
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'guardian', 'student'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '').trim()

    const persisted = loadPersistedState()
    const currentData = (persisted?.data || {}) as Record<string, unknown>

    const students = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const teachers = Array.isArray(currentData.teachers)
      ? (currentData.teachers as TeacherRecord[])
      : []
    const guardians = Array.isArray(currentData.guardians)
      ? (currentData.guardians as GuardianRecord[])
      : []
    const classMoments = Array.isArray(currentData.classMoments)
      ? (currentData.classMoments as ClassMomentPost[])
      : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []
    const existingParentAlerts = Array.isArray(currentData.parentAlerts)
      ? (currentData.parentAlerts as Array<Record<string, unknown>>)
      : []

    // ==================== 1. CREATE CLASS MOMENT (TEACHER / ADMIN) ====================
    if (action === 'create') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers or Admins can upload and submit classroom photos/videos.' },
          { status: 403 },
        )
      }

      const className = String(body.className || '').trim().slice(0, 40)
      const section = String(body.section || 'Section A').trim().slice(0, 30)
      const subject = String(body.subject || 'Classroom Activity').trim().slice(0, 60)
      const title = String(body.title || '').trim().slice(0, 140)
      const caption = String(body.caption || '').trim().slice(0, 1000)
      const dateIso = String(body.dateIso || getTodayIso()).trim().slice(0, 12) || getTodayIso()
      const rawMedia = Array.isArray(body.media) ? (body.media as Partial<ClassMomentMedia>[]) : []

      if (!className || !title) {
        return NextResponse.json(
          { ok: false, error: 'Class and activity title are required.' },
          { status: 400 },
        )
      }

      const sanitizedMedia: ClassMomentMedia[] = rawMedia
        .filter((m) => m && typeof m.url === 'string' && m.url.trim().length > 0)
        .slice(0, 8)
        .map((m, idx) => ({
          id: String(m.id || `med-${Date.now()}-${idx}`),
          kind: m.kind === 'video' ? 'video' : 'image',
          url: String(m.url).trim(),
          mime: String(m.mime || (m.kind === 'video' ? 'video/mp4' : 'image/jpeg')).slice(0, 60),
          filename: String(m.filename || `class-media-${idx + 1}`).slice(0, 120),
          sizeKb: typeof m.sizeKb === 'number' ? m.sizeKb : undefined,
        }))

      if (sanitizedMedia.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Please capture or upload at least one classroom photo or video.' },
          { status: 400 },
        )
      }

      // Enforce Teacher Assigned Classes RBAC
      const activeTeacher = teachers.find((t) => t.id === session.linked_entity_id)
      if (session.role === 'teacher' && !teacherAssignedToClass(activeTeacher, className, section)) {
        appendSecurityAudit({
          action: 'class_moment_unauthorized_class_blocked',
          target: `${session.display_name} attempted to post media to unassigned class ${className} · ${section}`,
          actor: session.display_name,
          actorRole: 'teacher',
          ipAddress: ip,
        })
        return NextResponse.json(
          {
            ok: false,
            error: `Access Denied: ${className} · ${section} is outside your assigned classes.`,
          },
          { status: 403 },
        )
      }

      // Resolve all active students enrolled in that exact class & section
      const enrolledStudents = students.filter(
        (s) => s.status !== 'suspended' && studentMatchesClassSection(s, className, section),
      )

      if (enrolledStudents.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `No enrolled students found in ${className} · ${section}. Select a class with enrolled students.`,
          },
          { status: 400 },
        )
      }

      const recipientStudentIds = enrolledStudents.map((s) => s.id)
      const recipientGuardianIds = resolveGuardianIdsForStudents(enrolledStudents, guardians)
      const classLabel = `${className} · ${section}`
      const photoCount = sanitizedMedia.filter((m) => m.kind === 'image').length
      const videoCount = sanitizedMedia.filter((m) => m.kind === 'video').length
      const mediaSummary = [
        photoCount > 0 ? `${photoCount} photo${photoCount > 1 ? 's' : ''}` : '',
        videoCount > 0 ? `${videoCount} video${videoCount > 1 ? 's' : ''}` : '',
      ]
        .filter(Boolean)
        .join(' & ')

      const newMoment: ClassMomentPost = {
        id: `cm-${Date.now()}`,
        title,
        caption: caption || `Shared from ${classLabel} (${subject}).`,
        className,
        section,
        classLabel,
        subject,
        dateIso,
        createdAt: formatNowLabel(),
        teacherId: activeTeacher?.id || session.linked_entity_id || session.user_id,
        teacherName: activeTeacher?.name || session.display_name,
        media: sanitizedMedia,
        recipientStudentIds,
        recipientGuardianIds,
        recipientSummary: `${enrolledStudents.length} student${enrolledStudents.length === 1 ? '' : 's'} · ${recipientGuardianIds.length} guardian${recipientGuardianIds.length === 1 ? '' : 's'}`,
        likedByGuardianIds: [],
        seenByGuardianIds: [],
        comments: [],
      }

      const nextMoments = [newMoment, ...classMoments]
      const notif = {
        id: `notif-cm-${Date.now()}`,
        title: `New Class Moment · ${classLabel}`,
        text: `${newMoment.teacherName} shared ${mediaSummary} ("${title}") with guardians of ${enrolledStudents.length} enrolled student(s) in ${classLabel}.`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['guardian', 'student', 'admin'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      // Also log in Parent Alert Hub so guardians/admin have delivery confirmation
      const alertLog = {
        id: `pa-cm-${Date.now()}`,
        studentId: enrolledStudents[0].id,
        studentName: `${classLabel} (${enrolledStudents.length} students)`,
        recipientName: `${classLabel} Guardians (${recipientGuardianIds.length})`,
        recipientPhone: `${recipientGuardianIds.length} linked guardians`,
        guardianPhone: `${recipientGuardianIds.length} linked guardians`,
        channel: 'App + Push',
        category: 'Class Moment',
        message: `${newMoment.teacherName} uploaded ${mediaSummary} from ${subject} (${classLabel}): "${title}". Delivered privately to enrolled students' guardians.`,
        sentAt: formatNowLabel(),
        sentBy: newMoment.teacherName,
        status: 'delivered',
      }
      const nextParentAlerts = [alertLog, ...existingParentAlerts].slice(0, 120)

      const saved = savePersistedState(
        {
          ...currentData,
          classMoments: nextMoments,
          notifications: nextNotifs,
          parentAlerts: nextParentAlerts,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'class_moment_shared',
        target: `"${title}" (${mediaSummary}) → ${classLabel} (${enrolledStudents.length} students, ${recipientGuardianIds.length} guardians)`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Shared class moment "${title}" to ${classLabel} guardians`,
      })

      return NextResponse.json({
        ok: true,
        moment: newMoment,
        deliveredToGuardians: recipientGuardianIds.length,
        deliveredToStudents: recipientStudentIds.length,
        classMoments: scopeMomentsForSession(nextMoments, session, students, teachers, guardians),
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 2. GUARDIAN REACT (LIKE / MARK SEEN) ====================
    if (action === 'react') {
      if (session.role !== 'guardian') {
        return NextResponse.json(
          { ok: false, error: 'Only enrolled Guardians can react or mark class moments seen.' },
          { status: 403 },
        )
      }
      const momentId = String(body.momentId || '').trim()
      const target = classMoments.find((m) => m.id === momentId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Class moment not found.' }, { status: 404 })
      }
      if (!guardianCanAccessMoment(session.linked_entity_id, target, students, guardians)) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: Your child is not enrolled in this class.' },
          { status: 403 },
        )
      }

      const gid = session.linked_entity_id
      const toggleLike = Boolean(body.toggleLike)
      const markSeen = body.markSeen !== false

      const nextMoments = classMoments.map((m) => {
        if (m.id !== momentId) return m
        const seenSet = new Set(m.seenByGuardianIds || [])
        if (markSeen) seenSet.add(gid)
        const likeSet = new Set(m.likedByGuardianIds || [])
        if (toggleLike) {
          if (likeSet.has(gid)) likeSet.delete(gid)
          else likeSet.add(gid)
        }
        return {
          ...m,
          seenByGuardianIds: Array.from(seenSet),
          likedByGuardianIds: Array.from(likeSet),
        }
      })

      const saved = savePersistedState(
        { ...currentData, classMoments: nextMoments },
        session.display_name,
      )

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Guardian reaction on "${target.title}"`,
      })

      return NextResponse.json({
        ok: true,
        classMoments: scopeMomentsForSession(nextMoments, session, students, teachers, guardians),
        version: saved.version,
      })
    }

    // ==================== 3. COMMENT ON CLASS MOMENT ====================
    if (action === 'comment') {
      const momentId = String(body.momentId || '').trim()
      const text = String(body.text || '').trim().slice(0, 400)
      if (!text) {
        return NextResponse.json({ ok: false, error: 'Comment cannot be empty.' }, { status: 400 })
      }
      const target = classMoments.find((m) => m.id === momentId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Class moment not found.' }, { status: 404 })
      }

      if (session.role === 'student') {
        return NextResponse.json(
          { ok: false, error: 'Only Guardians, Teachers, or Admins can comment on class moments.' },
          { status: 403 },
        )
      }
      if (
        session.role === 'guardian' &&
        !guardianCanAccessMoment(session.linked_entity_id, target, students, guardians)
      ) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: Your child is not enrolled in this class.' },
          { status: 403 },
        )
      }
      if (
        session.role === 'teacher' &&
        target.teacherId !== session.linked_entity_id &&
        !teacherAssignedToClass(
          teachers.find((t) => t.id === session.linked_entity_id),
          target.className,
          target.section,
        )
      ) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: Class moment is outside your assigned classes.' },
          { status: 403 },
        )
      }

      const newComment: ClassMomentComment = {
        id: `cmc-${Date.now()}`,
        authorId: session.user_id,
        authorName: session.display_name,
        authorRole: session.role as Role,
        text,
        createdAt: formatNowLabel(),
      }

      const nextMoments = classMoments.map((m) => {
        if (m.id !== momentId) return m
        const seenSet = new Set(m.seenByGuardianIds || [])
        if (session.role === 'guardian') seenSet.add(session.linked_entity_id)
        return {
          ...m,
          seenByGuardianIds: Array.from(seenSet),
          comments: [...(m.comments || []), newComment],
        }
      })

      const saved = savePersistedState(
        { ...currentData, classMoments: nextMoments },
        session.display_name,
      )

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `New comment on "${target.title}"`,
      })

      return NextResponse.json({
        ok: true,
        comment: newComment,
        classMoments: scopeMomentsForSession(nextMoments, session, students, teachers, guardians),
        version: saved.version,
      })
    }

    // ==================== 4. DELETE CLASS MOMENT (ADMIN / AUTHOR TEACHER) ====================
    if (action === 'delete') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json(
          { ok: false, error: 'Only Admins or the posting Teacher can delete a class moment.' },
          { status: 403 },
        )
      }
      const momentId = String(body.momentId || '').trim()
      const target = classMoments.find((m) => m.id === momentId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Class moment not found.' }, { status: 404 })
      }
      if (session.role === 'teacher' && target.teacherId !== session.linked_entity_id) {
        return NextResponse.json(
          { ok: false, error: 'Teachers can only delete class moments they uploaded.' },
          { status: 403 },
        )
      }

      const nextMoments = classMoments.filter((m) => m.id !== momentId)
      const saved = savePersistedState(
        { ...currentData, classMoments: nextMoments },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'class_moment_deleted',
        target: `"${target.title}" (${target.classLabel})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Deleted class moment "${target.title}"`,
      })

      return NextResponse.json({
        ok: true,
        classMoments: scopeMomentsForSession(nextMoments, session, students, teachers, guardians),
        version: saved.version,
      })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Class moments operation failed.' },
      { status: 500 },
    )
  }
}
