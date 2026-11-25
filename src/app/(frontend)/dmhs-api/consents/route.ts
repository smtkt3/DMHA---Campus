import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import type { BiometricVerificationStamp, ConsentFormItem } from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = new Set<ConsentFormItem['category']>([
  'Field Trip',
  'Science & Lab',
  'Sports & CCA',
  'Medical & Health',
  'Media & Photo Release',
])

function normalizeClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

interface StudentRow {
  id: string
  name: string
  className: string
  section: string
  roll: string
  guardianId?: string
  guardianName: string
  guardianPhone: string
  status?: string
}

interface TeacherRow {
  id: string
  name: string
  assignedClasses?: string[]
  status?: string
}

interface GuardianRow {
  id: string
  name: string
  phone: string
  linkedStudentIds?: string[]
}

function studentMatchesTarget(student: StudentRow, target: string): boolean {
  const token = normalizeClassToken(target)
  if (!token || token === 'all' || token === 'allstudents') return true
  const full = normalizeClassToken(`${student.className} ${student.section}`)
  const secLetter = student.section.replace(/section/i, '').trim().toLowerCase()
  const compact = normalizeClassToken(`${student.className}${secLetter}`)
  const gradeOnly = normalizeClassToken(student.className)
  return token === full || token === compact || token === gradeOnly
}

function studentInAssignedClasses(student: StudentRow, assigned: string[]): boolean {
  if (!assigned || assigned.length === 0) return false
  return assigned.some((cls) => studentMatchesTarget(student, cls))
}

function guardianOwnsStudent(
  guardianId: string,
  student: StudentRow,
  guardians: GuardianRow[],
): boolean {
  if (student.guardianId === guardianId) return true
  const g = guardians.find((x) => x.id === guardianId)
  return Boolean(g?.linkedStudentIds?.includes(student.id))
}

function getTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'guardian', 'student'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as {
      action?: 'create' | 'respond' | 'remind' | 'delete'
      // create fields
      targetType?: 'all' | 'class' | 'student'
      targetValue?: string
      studentId?: string
      title?: string
      eventDate?: string
      deadlineDate?: string
      venue?: string
      feeAmount?: number
      category?: ConsentFormItem['category']
      details?: string
      // respond fields
      formId?: string
      decision?: 'approved' | 'declined'
      declineReason?: string
      emergencyPhone?: string
      medicalNote?: string
      guardianComment?: string
      verification?: BiometricVerificationStamp
      // remind / delete fields
      campaignId?: string
    }

    const action = body.action
    if (!action) {
      return NextResponse.json({ ok: false, error: 'Action is required.' }, { status: 400 })
    }

    const persisted = loadPersistedState()
    if (!persisted.exists || !persisted.data) {
      return NextResponse.json({ ok: false, error: 'School state not initialized.' }, { status: 400 })
    }

    const currentData = persisted.data
    const students: StudentRow[] = Array.isArray(currentData.students)
      ? (currentData.students as StudentRow[])
      : []
    const teachers: TeacherRow[] = Array.isArray(currentData.teachers)
      ? (currentData.teachers as TeacherRow[])
      : []
    const guardians: GuardianRow[] = Array.isArray(currentData.guardians)
      ? (currentData.guardians as GuardianRow[])
      : []
    const consentForms: ConsentFormItem[] = Array.isArray(currentData.consentForms)
      ? (currentData.consentForms as ConsentFormItem[])
      : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []
    const existingAlerts = Array.isArray(currentData.parentAlerts)
      ? (currentData.parentAlerts as Array<Record<string, unknown>>)
      : []

    const activeStudents = students.filter((s) => s.status !== 'suspended')

    // ==================== 1. CREATE CONSENT FORM (ADMIN / TEACHER) ====================
    if (action === 'create') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can issue Digital Consent Forms.' },
          { status: 403 },
        )
      }

      const title = String(body.title || '').trim().slice(0, 140)
      const details = String(body.details || '').trim().slice(0, 600)
      const eventDate = String(body.eventDate || '').trim() || getTodayIso()
      const deadlineDate = String(body.deadlineDate || '').trim() || undefined
      const venue = String(body.venue || '').trim().slice(0, 120) || undefined
      const feeAmount =
        typeof body.feeAmount === 'number' && Number.isFinite(body.feeAmount) && body.feeAmount > 0
          ? Math.round(body.feeAmount)
          : 0
      const category = (VALID_CATEGORIES.has(body.category as ConsentFormItem['category'])
        ? body.category
        : 'Field Trip') as ConsentFormItem['category']

      if (!title || !details) {
        return NextResponse.json(
          { ok: false, error: 'Consent title and itinerary/terms details are required.' },
          { status: 400 },
        )
      }

      const activeTeacher =
        session.role === 'teacher'
          ? teachers.find((t) => t.id === session.linked_entity_id) || null
          : null
      const assignedClasses = activeTeacher?.assignedClasses || []

      const targetType = body.targetType || (body.studentId ? 'student' : 'class')
      const targetValue = String(body.targetValue || body.studentId || '').trim()

      let targets: StudentRow[] = []
      let targetLabel = 'All Students'

      if (targetType === 'student') {
        const stu = activeStudents.find((s) => s.id === targetValue)
        if (!stu) {
          return NextResponse.json({ ok: false, error: 'Selected student not found.' }, { status: 404 })
        }
        if (session.role === 'teacher' && !studentInAssignedClasses(stu, assignedClasses)) {
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: ${stu.name} (${stu.className} · ${stu.section}) is outside your assigned classes.`,
            },
            { status: 403 },
          )
        }
        targets = [stu]
        targetLabel = `${stu.name} (${stu.className} · ${stu.section})`
      } else if (targetType === 'class' && targetValue && targetValue !== 'ALL') {
        targets = activeStudents.filter((s) => studentMatchesTarget(s, targetValue))
        if (session.role === 'teacher') {
          targets = targets.filter((s) => studentInAssignedClasses(s, assignedClasses))
        }
        targetLabel = targetValue
      } else {
        if (session.role === 'teacher') {
          targets = activeStudents.filter((s) => studentInAssignedClasses(s, assignedClasses))
          targetLabel = `All Assigned (${assignedClasses.join(', ')})`
        } else {
          targets = activeStudents
          targetLabel = 'All DMHA Students'
        }
      }

      if (targets.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'No eligible active students match the selected class/target.' },
          { status: 400 },
        )
      }

      const campaignId = `cmp-${Date.now()}`
      const createdAt = getTodayIso()
      const createdForms: ConsentFormItem[] = targets.map((stu, idx) => ({
        id: `cf-${Date.now()}-${idx}`,
        campaignId,
        targetLabel,
        studentId: stu.id,
        studentName: stu.name,
        classLabel: `${stu.className} · ${stu.section}`,
        title,
        eventDate,
        deadlineDate,
        venue,
        feeAmount: feeAmount > 0 ? feeAmount : undefined,
        category,
        details,
        createdBy: session.display_name,
        createdByRole: session.role,
        createdAt,
        status: 'pending',
        signed: false,
      }))

      const nextConsentForms = [...createdForms, ...consentForms]
      const notif = {
        id: `notif-cf-${Date.now()}`,
        title: `Action Required: Digital Consent Form (${category})`,
        text: `${session.display_name} sent "${title}" (${eventDate}${venue ? ` · ${venue}` : ''}) to ${targetLabel} (${targets.length} student${targets.length === 1 ? '' : 's'}). Guardians please review and e-sign.`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['guardian', 'student', 'teacher', 'admin'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        {
          ...currentData,
          consentForms: nextConsentForms,
          notifications: nextNotifs,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'consent_form_issued',
        target: `"${title}" (${category}) → ${targetLabel} (${targets.length} student(s))`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Digital Consent Form "${title}" sent to ${targets.length} student(s)`,
      })

      return NextResponse.json({
        ok: true,
        createdCount: createdForms.length,
        campaignId,
        consentForms: nextConsentForms,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 2. GUARDIAN APPROVE (E-SIGN) OR DECLINE ====================
    if (action === 'respond') {
      if (session.role !== 'guardian') {
        return NextResponse.json(
          { ok: false, error: 'Only a linked Guardian can approve (e-sign) or decline a consent form.' },
          { status: 403 },
        )
      }

      const formId = String(body.formId || '').trim()
      const decision = body.decision === 'declined' ? 'declined' : 'approved'
      const targetForm = consentForms.find((f) => f.id === formId)
      if (!targetForm) {
        return NextResponse.json({ ok: false, error: 'Consent form not found.' }, { status: 404 })
      }

      const student = students.find((s) => s.id === targetForm.studentId)
      if (!student || !guardianOwnsStudent(session.linked_entity_id, student, guardians)) {
        appendSecurityAudit({
          action: 'consent_unauthorized_guardian_blocked',
          target: `${session.display_name} attempted to respond to consent "${targetForm.title}" for ${targetForm.studentId}`,
          actor: session.display_name,
          actorRole: 'guardian',
          ipAddress: ip,
        })
        return NextResponse.json(
          { ok: false, error: 'Access Denied: You are not the linked guardian for this student.' },
          { status: 403 },
        )
      }

      const guardianObj = guardians.find((g) => g.id === session.linked_entity_id)
      const signerName = guardianObj?.name || session.display_name
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const emergencyPhone = String(body.emergencyPhone || guardianObj?.phone || student.guardianPhone || '').trim().slice(0, 40)
      const medicalNote = String(body.medicalNote || '').trim().slice(0, 240)
      const guardianComment = String(body.guardianComment || '').trim().slice(0, 300)
      const declineReason = String(body.declineReason || '').trim().slice(0, 300)

      if (decision === 'declined' && !declineReason) {
        return NextResponse.json(
          { ok: false, error: 'Please provide a brief reason when declining consent.' },
          { status: 400 },
        )
      }

      const verification: BiometricVerificationStamp | undefined =
        body.verification ||
        (decision === 'approved'
          ? {
              method: 'Parent PIN',
              verifiedBy: signerName,
              verifiedAt: `Today · ${nowTime}`,
            }
          : undefined)

      const nextConsentForms: ConsentFormItem[] = consentForms.map((cf) => {
        if (cf.id !== formId) return cf
        if (decision === 'approved') {
          return {
            ...cf,
            studentName: cf.studentName || student.name,
            classLabel: cf.classLabel || `${student.className} · ${student.section}`,
            status: 'approved',
            signed: true,
            signedBy: signerName,
            signedAt: verification
              ? `Today · ${nowTime} (${verification.method})`
              : `Today · ${nowTime}`,
            declineReason: undefined,
            emergencyPhone: emergencyPhone || undefined,
            medicalNote: medicalNote || undefined,
            guardianComment: guardianComment || undefined,
            verification,
          }
        }
        return {
          ...cf,
          studentName: cf.studentName || student.name,
          classLabel: cf.classLabel || `${student.className} · ${student.section}`,
          status: 'declined',
          signed: false,
          signedBy: signerName,
          signedAt: `Today · ${nowTime}`,
          declineReason,
          guardianComment: guardianComment || undefined,
          verification: undefined,
        }
      })

      const notif = {
        id: `notif-cfresp-${Date.now()}`,
        title:
          decision === 'approved'
            ? `Consent E-Signed: ${student.name} ✓`
            : `Consent Declined: ${student.name}`,
        text:
          decision === 'approved'
            ? `${signerName} approved & e-signed "${targetForm.title}" for ${student.name} (${student.className} · ${student.section})${medicalNote ? ` · Medical note: ${medicalNote}` : ''}.`
            : `${signerName} declined "${targetForm.title}" for ${student.name}. Reason: ${declineReason}`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['teacher', 'admin', 'student'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        {
          ...currentData,
          consentForms: nextConsentForms,
          notifications: nextNotifs,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: decision === 'approved' ? 'consent_form_esigned' : 'consent_form_declined',
        target: `${signerName} ${decision} "${targetForm.title}" for ${student.name}`,
        actor: signerName,
        actorRole: 'guardian',
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: signerName,
        summary: `${signerName} ${decision} consent "${targetForm.title}" for ${student.name}`,
      })

      return NextResponse.json({
        ok: true,
        decision,
        consentForms: nextConsentForms,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 3. REMIND PENDING GUARDIANS (ADMIN / TEACHER / STUDENT) ====================
    if (action === 'remind') {
      const formId = String(body.formId || '').trim()
      const campaignId = String(body.campaignId || '').trim()

      let pendingTargets: ConsentFormItem[] = []
      if (session.role === 'student') {
        const form = consentForms.find(
          (f) => f.id === formId && f.studentId === session.linked_entity_id,
        )
        if (!form) {
          return NextResponse.json({ ok: false, error: 'Consent form not found.' }, { status: 404 })
        }
        if (form.signed || form.status === 'approved') {
          return NextResponse.json({ ok: false, error: 'Consent is already signed.' }, { status: 400 })
        }
        pendingTargets = [form]
      } else if (session.role === 'admin' || session.role === 'teacher') {
        pendingTargets = consentForms.filter((f) => {
          const isPending = !f.signed && f.status !== 'declined'
          if (!isPending) return false
          if (formId) return f.id === formId
          if (campaignId) return f.campaignId === campaignId
          return false
        })
      } else {
        return NextResponse.json({ ok: false, error: 'Unauthorized role.' }, { status: 403 })
      }

      if (pendingTargets.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'No pending guardians left to remind for this consent form.' },
          { status: 400 },
        )
      }

      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const firstTitle = pendingTargets[0].title

      const newNotif = {
        id: `notif-cfrem-${Date.now()}`,
        title: `Consent Reminder: ${firstTitle}`,
        text:
          session.role === 'student'
            ? `${session.display_name} reminded their guardian to review and e-sign "${firstTitle}" (${pendingTargets[0].eventDate}).`
            : `${session.display_name} sent a signature reminder for "${firstTitle}" to ${pendingTargets.length} pending guardian(s).`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['guardian'],
        read: false,
      }

      const newAlerts = pendingTargets.map((f, i) => {
        const stu = students.find((s) => s.id === f.studentId)
        return {
          id: `alert-cfrem-${Date.now()}-${i}`,
          channel: 'WhatsApp',
          category: 'Bus / Emergency',
          recipientName: stu?.guardianName || 'Guardian',
          recipientPhone: stu?.guardianPhone || '+880 1700-000000',
          studentName: stu?.name || f.studentName || 'Student',
          message: `DMHA Consent Reminder: Please review & e-sign "${f.title}" (${f.eventDate}) for ${stu?.name || f.studentName || 'your child'} inside the DMHA App.`,
          sentBy: session.display_name,
          sentAt: `Today · ${nowTime}`,
          status: 'delivered',
        }
      })

      const nextNotifs = [newNotif, ...existingNotifs].slice(0, 80)
      const nextAlerts = [...newAlerts, ...existingAlerts].slice(0, 100)

      const saved = savePersistedState(
        {
          ...currentData,
          notifications: nextNotifs,
          parentAlerts: nextAlerts,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'consent_reminder_sent',
        target: `"${firstTitle}" · reminded ${pendingTargets.length} guardian(s)`,
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
        remindedCount: pendingTargets.length,
        notifications: nextNotifs,
        parentAlerts: nextAlerts,
        version: saved.version,
      })
    }

    // ==================== 4. DELETE CONSENT FORM / CAMPAIGN (ADMIN / AUTHOR TEACHER) ====================
    if (action === 'delete') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json(
          { ok: false, error: 'Only Admin or Teachers can delete consent forms.' },
          { status: 403 },
        )
      }

      const formId = String(body.formId || '').trim()
      const campaignId = String(body.campaignId || '').trim()
      const matching = consentForms.filter((f) =>
        campaignId ? f.campaignId === campaignId : f.id === formId,
      )
      if (matching.length === 0) {
        return NextResponse.json({ ok: false, error: 'Consent form not found.' }, { status: 404 })
      }
      if (
        session.role === 'teacher' &&
        matching.some((m) => m.createdBy && m.createdBy !== session.display_name)
      ) {
        return NextResponse.json(
          { ok: false, error: 'Teachers can only remove consent forms they created.' },
          { status: 403 },
        )
      }

      const removeIds = new Set(matching.map((m) => m.id))
      const nextConsentForms = consentForms.filter((f) => !removeIds.has(f.id))

      const saved = savePersistedState(
        {
          ...currentData,
          consentForms: nextConsentForms,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'consent_form_deleted',
        target: `"${matching[0].title}" (${matching.length} record(s) removed)`,
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
        deletedCount: matching.length,
        consentForms: nextConsentForms,
        version: saved.version,
      })
    }

    return NextResponse.json({ ok: false, error: 'Unsupported action.' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Consent form operation failed.' },
      { status: 500 },
    )
  }
}
