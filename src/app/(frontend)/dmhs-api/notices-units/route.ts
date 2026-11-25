import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import {
  initialCampusClubs,
  initialCampusUnits,
  initialNotices,
} from '@/components/school/data'
import type {
  CampusClubItem,
  CampusUnitRecord,
  CustomRoleDefinition,
  Role,
  SchoolNotice,
  StaffMemberRecord,
  StaffPermission,
  StudentRecord,
  UnitGateStatus,
  UnitTransferRequest,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_NOTICE_CATEGORIES = new Set<SchoolNotice['category']>([
  'academic',
  'event',
  'urgent',
  'transport',
  'unit',
])

const VALID_AUDIENCES = new Set<SchoolNotice['audience']>([
  'All',
  'Guardians',
  'Students',
  'Teachers',
  'Staff',
])

const VALID_GATE_STATUSES = new Set<UnitGateStatus>([
  'Open',
  'Dismissal Active',
  'Closed',
  'Restricted',
])

const VALID_ACCENTS = new Set<CampusUnitRecord['accent']>([
  'emerald',
  'sky',
  'violet',
  'amber',
])

const VALID_CLUB_CATEGORIES = new Set<CampusClubItem['category']>([
  'STEM',
  'Debate & Arts',
  'Sports',
  'Leadership',
])

function getTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatNowLabel(): string {
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `Today · ${t}`
}

function staffHasPermission(
  session: { role: string; linked_entity_id: string },
  staffMembers: StaffMemberRecord[],
  customRoles: CustomRoleDefinition[],
  permission: StaffPermission,
): boolean {
  if (session.role === 'admin') return true
  if (session.role !== 'staff') return false
  const member = staffMembers.find((m) => m.id === session.linked_entity_id)
  if (!member || member.status === 'suspended') return false
  const roleDef = customRoles.find((r) => r.id === member.customRoleId)
  return Boolean(roleDef?.permissions?.includes(permission))
}

function guardianOwnsStudent(
  guardianId: string,
  student: StudentRecord,
  guardians: Array<{ id: string; linkedStudentIds?: string[] }>,
): boolean {
  if (student.guardianId === guardianId) return true
  const g = guardians.find((x) => x.id === guardianId)
  return Boolean(g?.linkedStudentIds?.includes(student.id))
}

function audienceToRoles(audience: SchoolNotice['audience']): Role[] {
  switch (audience) {
    case 'Guardians':
      return ['guardian', 'admin']
    case 'Students':
      return ['student', 'admin']
    case 'Teachers':
      return ['teacher', 'admin']
    case 'Staff':
      return ['staff', 'admin']
    default:
      return ['guardian', 'student', 'teacher', 'admin', 'staff']
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'guardian', 'student', 'staff'])
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
    const guardians = Array.isArray(currentData.guardians)
      ? (currentData.guardians as Array<{ id: string; name: string; linkedStudentIds?: string[] }>)
      : []
    const staffMembers = Array.isArray(currentData.staffMembers)
      ? (currentData.staffMembers as StaffMemberRecord[])
      : []
    const customRoles = Array.isArray(currentData.customRoles)
      ? (currentData.customRoles as CustomRoleDefinition[])
      : []
    const notices = Array.isArray(currentData.notices)
      ? (currentData.notices as SchoolNotice[])
      : initialNotices
    const campusUnits =
      Array.isArray(currentData.campusUnits) && currentData.campusUnits.length > 0
        ? (currentData.campusUnits as CampusUnitRecord[])
        : initialCampusUnits
    const unitTransferRequests = Array.isArray(currentData.unitTransferRequests)
      ? (currentData.unitTransferRequests as UnitTransferRequest[])
      : []
    const campusClubs =
      Array.isArray(currentData.campusClubs) && currentData.campusClubs.length > 0
        ? (currentData.campusClubs as CampusClubItem[])
        : initialCampusClubs
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []

    const canPublishNotice =
      session.role === 'admin' ||
      session.role === 'teacher' ||
      staffHasPermission(session, staffMembers, customRoles, 'notices')

    const canManageGate =
      session.role === 'admin' ||
      staffHasPermission(session, staffMembers, customRoles, 'gate_security')

    // ==================== 1. CREATE NOTICE ====================
    if (action === 'create_notice') {
      if (!canPublishNotice) {
        return NextResponse.json(
          { ok: false, error: 'Only Admins, Teachers, or authorized Notices Staff can publish school notices.' },
          { status: 403 },
        )
      }

      const title = String(body.title || '').trim().slice(0, 140)
      const noticeBody = String(body.body || '').trim().slice(0, 2000)
      const rawCat = String(body.category || 'academic') as SchoolNotice['category']
      const category: SchoolNotice['category'] = VALID_NOTICE_CATEGORIES.has(rawCat)
        ? rawCat
        : 'academic'
      const rawAud = String(body.audience || 'All') as SchoolNotice['audience']
      const audience: SchoolNotice['audience'] = VALID_AUDIENCES.has(rawAud) ? rawAud : 'All'
      const targetUnit = String(body.targetUnit || 'All Units').trim().slice(0, 60) || 'All Units'
      const targetClass = String(body.targetClass || 'All Classes').trim().slice(0, 60) || 'All Classes'
      const eventDate = String(body.eventDate || getTodayIso()).trim().slice(0, 20)
      const pinned = Boolean(body.pinned) && session.role === 'admin'
      const requireAcknowledgement = Boolean(body.requireAcknowledgement)

      if (!title || !noticeBody) {
        return NextResponse.json(
          { ok: false, error: 'Notice title and message body are required.' },
          { status: 400 },
        )
      }

      const newNotice: SchoolNotice = {
        id: `nt-${Date.now()}`,
        title,
        body: noticeBody,
        category,
        date: formatNowLabel(),
        eventDate,
        author:
          session.role === 'admin'
            ? `${session.display_name} (Admin Office)`
            : session.display_name,
        authorId: session.user_id,
        authorRole: session.role as Role,
        audience,
        targetUnit,
        targetClass,
        pinned,
        requireAcknowledgement,
        acknowledgedBy: [],
      }

      const nextNotices = [newNotice, ...notices]
      const notif = {
        id: `notif-nt-${Date.now()}`,
        title: `${category === 'urgent' ? 'URGENT · ' : ''}Notice: ${title}`,
        text: `${newNotice.author} (${targetUnit}) · ${noticeBody.slice(0, 140)}${noticeBody.length > 140 ? '…' : ''}`,
        time: 'Just now',
        type: category === 'urgent' ? 'alert' : 'notice',
        forRoles: audienceToRoles(audience),
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        {
          ...currentData,
          notices: nextNotices,
          notifications: nextNotifs,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'notice_published',
        target: `"${title}" [${category}] → ${audience} · ${targetUnit}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `School notice published: "${title}"`,
      })

      return NextResponse.json({
        ok: true,
        notice: newNotice,
        notices: nextNotices,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 2. UPDATE NOTICE ====================
    if (action === 'update_notice') {
      if (!canPublishNotice) {
        return NextResponse.json({ ok: false, error: 'Permission denied.' }, { status: 403 })
      }
      const noticeId = String(body.noticeId || '').trim()
      const target = notices.find((n) => n.id === noticeId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Notice not found.' }, { status: 404 })
      }
      if (session.role !== 'admin' && target.authorId !== session.user_id) {
        return NextResponse.json(
          { ok: false, error: 'You can only edit notices that you published.' },
          { status: 403 },
        )
      }

      const title = String(body.title ?? target.title).trim().slice(0, 140)
      const noticeBody = String(body.body ?? target.body).trim().slice(0, 2000)
      if (!title || !noticeBody) {
        return NextResponse.json(
          { ok: false, error: 'Title and message body cannot be empty.' },
          { status: 400 },
        )
      }
      const rawCat = String(body.category ?? target.category) as SchoolNotice['category']
      const category = VALID_NOTICE_CATEGORIES.has(rawCat) ? rawCat : target.category
      const rawAud = String(body.audience ?? target.audience) as SchoolNotice['audience']
      const audience = VALID_AUDIENCES.has(rawAud) ? rawAud : target.audience
      const targetUnit = String(body.targetUnit ?? target.targetUnit ?? 'All Units').trim().slice(0, 60)
      const targetClass = String(body.targetClass ?? target.targetClass ?? 'All Classes').trim().slice(0, 60)
      const eventDate = String(body.eventDate ?? target.eventDate ?? getTodayIso()).trim().slice(0, 20)
      const pinned =
        session.role === 'admin' && typeof body.pinned === 'boolean'
          ? body.pinned
          : Boolean(target.pinned)
      const requireAcknowledgement =
        typeof body.requireAcknowledgement === 'boolean'
          ? body.requireAcknowledgement
          : Boolean(target.requireAcknowledgement)

      const nextNotices = notices.map((n) =>
        n.id === noticeId
          ? {
              ...n,
              title,
              body: noticeBody,
              category,
              audience,
              targetUnit,
              targetClass,
              eventDate,
              pinned,
              requireAcknowledgement,
              updatedAt: formatNowLabel(),
            }
          : n,
      )

      const saved = savePersistedState(
        { ...currentData, notices: nextNotices },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'notice_updated',
        target: `"${title}" (${noticeId})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Updated notice "${title}"`,
      })

      return NextResponse.json({ ok: true, notices: nextNotices, version: saved.version })
    }

    // ==================== 3. PIN / UNPIN NOTICE ====================
    if (action === 'toggle_pin_notice') {
      if (session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Admins can pin or unpin official notices.' },
          { status: 403 },
        )
      }
      const noticeId = String(body.noticeId || '').trim()
      const target = notices.find((n) => n.id === noticeId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Notice not found.' }, { status: 404 })
      }
      const nextPinned = !target.pinned
      const nextNotices = notices.map((n) =>
        n.id === noticeId ? { ...n, pinned: nextPinned } : n,
      )
      const saved = savePersistedState(
        { ...currentData, notices: nextNotices },
        session.display_name,
      )
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `${nextPinned ? 'Pinned' : 'Unpinned'} notice "${target.title}"`,
      })
      return NextResponse.json({
        ok: true,
        pinned: nextPinned,
        notices: nextNotices,
        version: saved.version,
      })
    }

    // ==================== 4. DELETE NOTICE ====================
    if (action === 'delete_notice') {
      if (!canPublishNotice) {
        return NextResponse.json({ ok: false, error: 'Permission denied.' }, { status: 403 })
      }
      const noticeId = String(body.noticeId || '').trim()
      const target = notices.find((n) => n.id === noticeId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Notice not found.' }, { status: 404 })
      }
      if (session.role !== 'admin' && target.authorId !== session.user_id) {
        return NextResponse.json(
          { ok: false, error: 'You can only delete notices that you published.' },
          { status: 403 },
        )
      }
      const nextNotices = notices.filter((n) => n.id !== noticeId)
      const saved = savePersistedState(
        { ...currentData, notices: nextNotices },
        session.display_name,
      )
      appendSecurityAudit({
        action: 'notice_deleted',
        target: `"${target.title}" (${noticeId})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Deleted notice "${target.title}"`,
      })
      return NextResponse.json({ ok: true, notices: nextNotices, version: saved.version })
    }

    // ==================== 5. ACKNOWLEDGE / READ RECEIPT ====================
    if (action === 'acknowledge_notice') {
      const noticeId = String(body.noticeId || '').trim()
      const target = notices.find((n) => n.id === noticeId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Notice not found.' }, { status: 404 })
      }
      const existingReceipts = Array.isArray(target.acknowledgedBy) ? target.acknowledgedBy : []
      const alreadyAck = existingReceipts.some((r) => r.userId === session.user_id)
      const nextReceipts = alreadyAck
        ? existingReceipts
        : [
            {
              userId: session.user_id,
              name: session.display_name,
              role: session.role as Role,
              acknowledgedAt: formatNowLabel(),
            },
            ...existingReceipts,
          ]
      const nextNotices = notices.map((n) =>
        n.id === noticeId ? { ...n, acknowledgedBy: nextReceipts } : n,
      )
      const saved = savePersistedState(
        { ...currentData, notices: nextNotices },
        session.display_name,
      )
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `${session.display_name} acknowledged notice "${target.title}"`,
      })
      return NextResponse.json({
        ok: true,
        alreadyAcknowledged: alreadyAck,
        notices: nextNotices,
        version: saved.version,
      })
    }

    // ==================== 6. CREATE / UPDATE CAMPUS UNIT ====================
    if (action === 'save_unit') {
      if (session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Admins can create or edit Campus Units.' },
          { status: 403 },
        )
      }
      const unitId = String(body.id || '').trim()
      const name = String(body.name || '').trim().slice(0, 50)
      const code = String(body.code || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'UN').trim().slice(0, 8)
      const subtitle = String(body.subtitle || '').trim().slice(0, 120)
      const gradesCovered = String(body.gradesCovered || '').trim().slice(0, 160)
      const address = String(body.address || '').trim().slice(0, 180)
      const gateHours = String(body.gateHours || '07:45 AM – 02:30 PM').trim().slice(0, 60)
      const rawStatus = String(body.gateStatus || 'Open') as UnitGateStatus
      const gateStatus: UnitGateStatus = VALID_GATE_STATUSES.has(rawStatus) ? rawStatus : 'Open'
      const coordinatorName = String(body.coordinatorName || '').trim().slice(0, 80)
      const coordinatorPhone = String(body.coordinatorPhone || '').trim().slice(0, 40)
      const statusNote = String(body.statusNote || '').trim().slice(0, 220)
      const rawAccent = String(body.accent || 'emerald') as CampusUnitRecord['accent']
      const accent: CampusUnitRecord['accent'] = VALID_ACCENTS.has(rawAccent) ? rawAccent : 'emerald'
      const facilities = Array.isArray(body.facilities)
        ? body.facilities.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 10)
        : String(body.facilities || '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 10)

      if (!name) {
        return NextResponse.json({ ok: false, error: 'Campus Unit name is required.' }, { status: 400 })
      }

      const existingUnit = unitId ? campusUnits.find((u) => u.id === unitId) : undefined
      const duplicateName = campusUnits.some(
        (u) => u.id !== existingUnit?.id && u.name.toLowerCase() === name.toLowerCase(),
      )
      if (duplicateName) {
        return NextResponse.json(
          { ok: false, error: `A Campus Unit named "${name}" already exists.` },
          { status: 409 },
        )
      }

      let nextStudents = students
      let nextNotices = notices
      let nextUnits: CampusUnitRecord[]
      let savedUnit: CampusUnitRecord

      if (existingUnit) {
        savedUnit = {
          ...existingUnit,
          name,
          code,
          subtitle: subtitle || existingUnit.subtitle,
          gradesCovered: gradesCovered || existingUnit.gradesCovered,
          address: address || existingUnit.address,
          gateHours,
          gateStatus,
          coordinatorName: coordinatorName || existingUnit.coordinatorName,
          coordinatorPhone: coordinatorPhone || existingUnit.coordinatorPhone,
          facilities: facilities.length > 0 ? facilities : existingUnit.facilities,
          statusNote,
          accent,
          updatedAt: formatNowLabel(),
        }
        nextUnits = campusUnits.map((u) => (u.id === existingUnit.id ? savedUnit : u))
        if (existingUnit.name !== name) {
          nextStudents = students.map((s) =>
            s.busRoute === existingUnit.name ? { ...s, busRoute: name } : s,
          )
          nextNotices = notices.map((n) =>
            n.targetUnit === existingUnit.name ? { ...n, targetUnit: name } : n,
          )
        }
      } else {
        savedUnit = {
          id: `unit-${Date.now()}`,
          name,
          code,
          subtitle: subtitle || 'DMHA Campus Wing',
          gradesCovered: gradesCovered || 'Pre-Play to Class 6',
          address: address || `DMHA Campus · ${name}`,
          gateHours,
          gateStatus,
          coordinatorName: coordinatorName || 'Campus Coordinator',
          coordinatorPhone: coordinatorPhone || '+880 1711-000000',
          facilities: facilities.length > 0 ? facilities : ['Main Security Gate', 'QR Pickup Lane'],
          statusNote,
          accent,
          updatedAt: formatNowLabel(),
        }
        nextUnits = [...campusUnits, savedUnit]
      }

      const saved = savePersistedState(
        {
          ...currentData,
          campusUnits: nextUnits,
          students: nextStudents,
          notices: nextNotices,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: existingUnit ? 'campus_unit_updated' : 'campus_unit_created',
        target: `${savedUnit.name} (${savedUnit.gateStatus}) · Coordinator: ${savedUnit.coordinatorName}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `${existingUnit ? 'Updated' : 'Created'} Campus Unit ${savedUnit.name}`,
      })

      return NextResponse.json({
        ok: true,
        unit: savedUnit,
        campusUnits: nextUnits,
        students: nextStudents,
        notices: nextNotices,
        version: saved.version,
      })
    }

    // ==================== 7. LIVE GATE STATUS SWITCH ====================
    if (action === 'set_unit_gate_status') {
      if (!canManageGate) {
        return NextResponse.json(
          { ok: false, error: 'Only Admins or Gate Security Staff can change Campus Unit gate status.' },
          { status: 403 },
        )
      }
      const unitId = String(body.unitId || '').trim()
      const rawStatus = String(body.gateStatus || '') as UnitGateStatus
      if (!VALID_GATE_STATUSES.has(rawStatus)) {
        return NextResponse.json({ ok: false, error: 'Invalid gate status.' }, { status: 400 })
      }
      const targetUnit = campusUnits.find((u) => u.id === unitId)
      if (!targetUnit) {
        return NextResponse.json({ ok: false, error: 'Campus Unit not found.' }, { status: 404 })
      }
      const statusNote =
        typeof body.statusNote === 'string' && body.statusNote.trim()
          ? body.statusNote.trim().slice(0, 220)
          : targetUnit.statusNote

      const nextUnits = campusUnits.map((u) =>
        u.id === unitId
          ? { ...u, gateStatus: rawStatus, statusNote, updatedAt: formatNowLabel() }
          : u,
      )

      const notif = {
        id: `notif-gate-${Date.now()}`,
        title: `${targetUnit.name} Gate Status: ${rawStatus}`,
        text: `${session.display_name} updated ${targetUnit.name} to "${rawStatus}". ${statusNote || ''}`.trim(),
        time: 'Just now',
        type: rawStatus === 'Restricted' ? 'alert' : 'notice',
        forRoles: ['guardian', 'student', 'teacher', 'admin', 'staff'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        {
          ...currentData,
          campusUnits: nextUnits,
          notifications: nextNotifs,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'campus_unit_gate_status',
        target: `${targetUnit.name} → ${rawStatus}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `${targetUnit.name} gate status set to ${rawStatus}`,
      })

      return NextResponse.json({
        ok: true,
        campusUnits: nextUnits,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 8. DELETE CAMPUS UNIT ====================
    if (action === 'delete_unit') {
      if (session.role !== 'admin') {
        return NextResponse.json({ ok: false, error: 'Only Admins can delete Campus Units.' }, { status: 403 })
      }
      const unitId = String(body.unitId || '').trim()
      const targetUnit = campusUnits.find((u) => u.id === unitId)
      if (!targetUnit) {
        return NextResponse.json({ ok: false, error: 'Campus Unit not found.' }, { status: 404 })
      }
      if (campusUnits.length <= 2) {
        return NextResponse.json(
          { ok: false, error: 'DMHA requires at least Unit - 1 and Unit - 2 to remain active.' },
          { status: 400 },
        )
      }
      const assignedCount = students.filter((s) => (s.busRoute || 'Unit - 1') === targetUnit.name).length
      if (assignedCount > 0) {
        return NextResponse.json(
          { ok: false, error: `Reassign ${assignedCount} student(s) out of ${targetUnit.name} before deleting.` },
          { status: 400 },
        )
      }
      const nextUnits = campusUnits.filter((u) => u.id !== unitId)
      const saved = savePersistedState(
        { ...currentData, campusUnits: nextUnits },
        session.display_name,
      )
      return NextResponse.json({ ok: true, campusUnits: nextUnits, version: saved.version })
    }

    // ==================== 9. ADMIN DIRECT REASSIGN STUDENT UNIT ====================
    if (action === 'reassign_student_unit') {
      if (session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Admins can directly reassign a student’s Campus Unit.' },
          { status: 403 },
        )
      }
      const studentId = String(body.studentId || '').trim()
      const targetUnitName = String(body.targetUnit || '').trim()
      const student = students.find((s) => s.id === studentId)
      if (!student) {
        return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
      }
      const unitObj = campusUnits.find((u) => u.name === targetUnitName)
      if (!unitObj) {
        return NextResponse.json({ ok: false, error: 'Selected Campus Unit does not exist.' }, { status: 400 })
      }
      const oldUnit = student.busRoute || 'Unit - 1'
      const nextStudents = students.map((s) =>
        s.id === studentId ? { ...s, busRoute: unitObj.name } : s,
      )
      const notif = {
        id: `notif-unitmove-${Date.now()}`,
        title: `Campus Unit Updated · ${student.name}`,
        text: `${student.name} has been assigned to ${unitObj.name} (was ${oldUnit}). QR Pickup Pass and gate dismissal now reflect ${unitObj.name}.`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['guardian', 'student', 'teacher', 'admin'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)
      const saved = savePersistedState(
        {
          ...currentData,
          students: nextStudents,
          notifications: nextNotifs,
        },
        session.display_name,
      )
      appendSecurityAudit({
        action: 'student_unit_reassigned',
        target: `${student.name}: ${oldUnit} → ${unitObj.name}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Moved ${student.name} to ${unitObj.name}`,
      })
      return NextResponse.json({
        ok: true,
        students: nextStudents,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 10. REQUEST CAMPUS UNIT TRANSFER ====================
    if (action === 'request_unit_transfer') {
      if (!['guardian', 'student', 'admin'].includes(session.role)) {
        return NextResponse.json(
          { ok: false, error: 'Only Guardians, Students, or Admins can submit a Campus Unit transfer request.' },
          { status: 403 },
        )
      }
      const studentId =
        session.role === 'student'
          ? session.linked_entity_id
          : String(body.studentId || '').trim()
      const toUnit = String(body.toUnit || '').trim()
      const reason = String(body.reason || '').trim().slice(0, 300)

      const student = students.find((s) => s.id === studentId)
      if (!student) {
        return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
      }
      if (
        session.role === 'guardian' &&
        !guardianOwnsStudent(session.linked_entity_id, student, guardians)
      ) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: You can only request a Campus Unit transfer for your linked child.' },
          { status: 403 },
        )
      }
      if (!campusUnits.some((u) => u.name === toUnit)) {
        return NextResponse.json({ ok: false, error: 'Destination Campus Unit not found.' }, { status: 400 })
      }
      const fromUnit = student.busRoute || 'Unit - 1'
      if (fromUnit === toUnit) {
        return NextResponse.json(
          { ok: false, error: `${student.name} is already assigned to ${toUnit}.` },
          { status: 400 },
        )
      }
      if (!reason) {
        return NextResponse.json(
          { ok: false, error: 'Please provide a brief reason for the Campus Unit transfer.' },
          { status: 400 },
        )
      }

      const newReq: UnitTransferRequest = {
        id: `utr-${Date.now()}`,
        studentId: student.id,
        studentName: student.name,
        classLabel: `${student.className} · ${student.section}`,
        fromUnit,
        toUnit,
        reason,
        requestedBy: session.display_name,
        requestedByRole: session.role as Role,
        requestedAt: formatNowLabel(),
        status: 'pending',
      }

      const nextReqs = [newReq, ...unitTransferRequests]
      const notif = {
        id: `notif-utr-${Date.now()}`,
        title: `Campus Unit Transfer Request · ${student.name}`,
        text: `${session.display_name} requested moving ${student.name} (${fromUnit} → ${toUnit}): "${reason}"`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['admin', 'guardian'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        {
          ...currentData,
          unitTransferRequests: nextReqs,
          notifications: nextNotifs,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'unit_transfer_requested',
        target: `${student.name} (${fromUnit} → ${toUnit})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Campus Unit transfer requested for ${student.name}`,
      })

      return NextResponse.json({
        ok: true,
        request: newReq,
        unitTransferRequests: nextReqs,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 11. REVIEW CAMPUS UNIT TRANSFER (ADMIN) ====================
    if (action === 'review_unit_transfer') {
      if (session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Admins can approve or decline Campus Unit transfer requests.' },
          { status: 403 },
        )
      }
      const requestId = String(body.requestId || '').trim()
      const decision = body.decision === 'declined' ? 'declined' : 'approved'
      const reviewNote = String(body.reviewNote || '').trim().slice(0, 220)

      const targetReq = unitTransferRequests.find((r) => r.id === requestId)
      if (!targetReq) {
        return NextResponse.json({ ok: false, error: 'Transfer request not found.' }, { status: 404 })
      }

      const nextReqs: UnitTransferRequest[] = unitTransferRequests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: decision,
              reviewedBy: session.display_name,
              reviewedAt: formatNowLabel(),
              reviewNote: reviewNote || undefined,
            }
          : r,
      )

      let nextStudents = students
      if (decision === 'approved') {
        nextStudents = students.map((s) =>
          s.id === targetReq.studentId ? { ...s, busRoute: targetReq.toUnit } : s,
        )
      }

      const notif = {
        id: `notif-utr-rev-${Date.now()}`,
        title: `Campus Unit Transfer ${decision === 'approved' ? 'Approved ✓' : 'Declined'}`,
        text:
          decision === 'approved'
            ? `${targetReq.studentName} has been moved from ${targetReq.fromUnit} to ${targetReq.toUnit}. All QR gate passes are updated.`
            : `Transfer request for ${targetReq.studentName} (${targetReq.fromUnit} → ${targetReq.toUnit}) was declined.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
        time: 'Just now',
        type: decision === 'approved' ? 'notice' : 'alert',
        forRoles: ['guardian', 'student', 'teacher', 'admin'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        {
          ...currentData,
          unitTransferRequests: nextReqs,
          students: nextStudents,
          notifications: nextNotifs,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: `unit_transfer_${decision}`,
        target: `${targetReq.studentName} (${targetReq.fromUnit} → ${targetReq.toUnit})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Campus Unit transfer ${decision} for ${targetReq.studentName}`,
      })

      return NextResponse.json({
        ok: true,
        unitTransferRequests: nextReqs,
        students: nextStudents,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 12. CLUB MEMBERSHIP TOGGLE (PERSISTED) ====================
    if (action === 'toggle_club_membership') {
      const clubId = String(body.clubId || '').trim()
      const studentId =
        session.role === 'student'
          ? session.linked_entity_id
          : String(body.studentId || '').trim()
      const club = campusClubs.find((c) => c.id === clubId)
      const student = students.find((s) => s.id === studentId)
      if (!club || !student) {
        return NextResponse.json({ ok: false, error: 'Club or student not found.' }, { status: 404 })
      }
      if (
        session.role === 'guardian' &&
        !guardianOwnsStudent(session.linked_entity_id, student, guardians)
      ) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: You can only manage club memberships for your linked child.' },
          { status: 403 },
        )
      }
      const isMember = club.memberIds.includes(student.id)
      const nextClubs = campusClubs.map((c) =>
        c.id === clubId
          ? {
              ...c,
              memberIds: isMember
                ? c.memberIds.filter((id) => id !== student.id)
                : [...c.memberIds, student.id],
            }
          : c,
      )
      const saved = savePersistedState(
        { ...currentData, campusClubs: nextClubs },
        session.display_name,
      )
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `${student.name} ${isMember ? 'left' : 'joined'} ${club.name}`,
      })
      return NextResponse.json({
        ok: true,
        joined: !isMember,
        campusClubs: nextClubs,
        version: saved.version,
      })
    }

    // ==================== 13. ADD NEW CCA CLUB (ADMIN / TEACHER) ====================
    if (action === 'add_club') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json(
          { ok: false, error: 'Only Admins or Teachers can create new school clubs.' },
          { status: 403 },
        )
      }
      const name = String(body.name || '').trim().slice(0, 100)
      const schedule = String(body.schedule || '').trim().slice(0, 100)
      const mentor = String(body.mentor || session.display_name).trim().slice(0, 80)
      const unitName = String(body.unitName || 'All Units').trim().slice(0, 50)
      const rawCat = String(body.category || 'STEM') as CampusClubItem['category']
      const category: CampusClubItem['category'] = VALID_CLUB_CATEGORIES.has(rawCat)
        ? rawCat
        : 'STEM'
      if (!name || !schedule) {
        return NextResponse.json(
          { ok: false, error: 'Club name and schedule are required.' },
          { status: 400 },
        )
      }
      const newClub: CampusClubItem = {
        id: `cl-${Date.now()}`,
        name,
        schedule,
        mentor,
        unitName,
        category,
        memberIds: [],
      }
      const nextClubs = [newClub, ...campusClubs]
      const saved = savePersistedState(
        { ...currentData, campusClubs: nextClubs },
        session.display_name,
      )
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Added new CCA club: ${name}`,
      })
      return NextResponse.json({
        ok: true,
        club: newClub,
        campusClubs: nextClubs,
        version: saved.version,
      })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Notices & Units operation failed.' },
      { status: 500 },
    )
  }
}
