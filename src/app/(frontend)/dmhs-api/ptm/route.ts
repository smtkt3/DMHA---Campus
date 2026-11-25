import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { dispatchCampusAlert } from '@/lib/dmhs-messaging'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import { initialPtmSlots } from '@/components/school/data'
import type {
  GuardianRecord,
  PtmSlotItem,
  StudentRecord,
  TeacherRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_MODES = new Set<PtmSlotItem['mode']>([
  'In-Person (Unit - 1)',
  'In-Person (Unit - 2)',
  'Video Call',
])

function formatNow(): string {
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `Today · ${t}`
}

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return -1
  return h * 60 + m
}

function fromMins(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function guardianOwnsStudent(
  guardianId: string,
  student: StudentRecord,
  guardians: GuardianRecord[],
): boolean {
  if (student.guardianId === guardianId) return true
  const g = guardians.find((x) => x.id === guardianId)
  return Boolean(g?.linkedStudentIds?.includes(student.id))
}

function scopePtmSlotsForSession(
  slots: PtmSlotItem[],
  session: { role: string; linked_entity_id: string },
): PtmSlotItem[] {
  if (session.role === 'admin') return slots
  if (session.role === 'teacher') {
    return slots.filter((s) => s.teacherId === session.linked_entity_id)
  }
  if (session.role === 'guardian') {
    return slots.map((s) => {
      if (s.status === 'open' || s.guardianId === session.linked_entity_id) return s
      // Redact other families' private booking details while keeping slot shown as unavailable
      return {
        ...s,
        studentId: undefined,
        studentName: undefined,
        classLabel: undefined,
        guardianId: undefined,
        guardianName: 'Booked by Another Family',
        topic: undefined,
        outcomeNotes: undefined,
      }
    })
  }
  return []
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'guardian'])
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
    const ptmSlots = Array.isArray(currentData.ptmSlots)
      ? (currentData.ptmSlots as PtmSlotItem[])
      : Array.isArray(initialPtmSlots)
        ? initialPtmSlots
        : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []

    // ==================== 1. PUBLISH BATCH 15-MIN PTM SLOTS (TEACHER / ADMIN) ====================
    if (action === 'create_slots') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can publish PTM slots.' },
          { status: 403 },
        )
      }

      const teacherId =
        session.role === 'teacher'
          ? session.linked_entity_id
          : String(body.teacherId || teachers[0]?.id || '').trim()
      const teacher = teachers.find((t) => t.id === teacherId)
      if (!teacher) {
        return NextResponse.json({ ok: false, error: 'Teacher profile not found.' }, { status: 404 })
      }

      const dateIso = String(body.dateIso || '').trim()
      const startTime = String(body.startTime || '09:00').trim()
      const endTime = String(body.endTime || '10:00').trim()
      const durationMins = Math.min(45, Math.max(10, Math.round(Number(body.durationMins) || 15)))
      const rawMode = String(body.mode || 'In-Person (Unit - 2)') as PtmSlotItem['mode']
      const mode: PtmSlotItem['mode'] = VALID_MODES.has(rawMode) ? rawMode : 'In-Person (Unit - 2)'
      const roomOrLink =
        String(body.roomOrLink || '').trim().slice(0, 140) ||
        (mode === 'Video Call' ? 'https://meet.dmha.edu/ptm-room' : `${mode} Consultation Room`)

      const startM = toMins(startTime)
      const endM = toMins(endTime)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso) || startM < 0 || endM <= startM) {
        return NextResponse.json(
          { ok: false, error: 'Valid date and start/end time range are required.' },
          { status: 400 },
        )
      }

      const created: PtmSlotItem[] = []
      for (let cursor = startM; cursor + durationMins <= endM && created.length < 16; cursor += durationMins) {
        const sStr = fromMins(cursor)
        const eStr = fromMins(cursor + durationMins)
        const duplicate = ptmSlots.some(
          (sl) =>
            sl.teacherId === teacher.id &&
            sl.dateIso === dateIso &&
            sl.startTime === sStr &&
            sl.status !== 'cancelled',
        )
        if (duplicate) continue
        created.push({
          id: `ptm-${Date.now()}-${created.length}`,
          teacherId: teacher.id,
          teacherName: teacher.name,
          teacherSubject: teacher.subject,
          dateIso,
          startTime: sStr,
          endTime: eStr,
          mode,
          roomOrLink,
          status: 'open',
        })
      }

      if (created.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'All slots in that time window already exist for this teacher.' },
          { status: 409 },
        )
      }

      const nextSlots = [...created, ...ptmSlots].sort((a, b) =>
        `${a.dateIso} ${a.startTime}`.localeCompare(`${b.dateIso} ${b.startTime}`),
      )

      const notif = {
        id: `notif-ptm-open-${Date.now()}`,
        title: `PTM Slots Open · ${teacher.name}`,
        text: `${teacher.name} (${teacher.subject}) opened ${created.length} PTM consultation slot(s) on ${dateIso} (${mode}). Book your 15-min slot now.`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['guardian', 'admin'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        { ...currentData, ptmSlots: nextSlots, notifications: nextNotifs },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'ptm_slots_published',
        target: `${teacher.name} · ${created.length} slot(s) on ${dateIso} (${startTime}–${endTime})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Published ${created.length} PTM slots for ${teacher.name}`,
      })

      return NextResponse.json({
        ok: true,
        createdCount: created.length,
        ptmSlots: scopePtmSlotsForSession(nextSlots, session),
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 2. GUARDIAN BOOK PTM SLOT (DOUBLE-BOOKING SAFE) ====================
    if (action === 'book_slot') {
      if (session.role !== 'guardian') {
        return NextResponse.json(
          { ok: false, error: 'Only a linked Guardian can book a PTM consultation slot.' },
          { status: 403 },
        )
      }
      const slotId = String(body.slotId || '').trim()
      const studentId = String(body.studentId || '').trim()
      const topic = String(body.topic || '').trim().slice(0, 240)

      const slot = ptmSlots.find((s) => s.id === slotId)
      if (!slot) {
        return NextResponse.json({ ok: false, error: 'PTM slot not found.' }, { status: 404 })
      }
      if (slot.status !== 'open') {
        return NextResponse.json(
          { ok: false, error: 'This PTM slot has already been booked. Please pick another open time.' },
          { status: 409 },
        )
      }

      const student = students.find((s) => s.id === studentId)
      if (!student || !guardianOwnsStudent(session.linked_entity_id, student, guardians)) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: You can only book PTM slots for your linked children.' },
          { status: 403 },
        )
      }

      // Prevent booking 2 slots for the same child with the same teacher on the same date
      const alreadyBookedSameDay = ptmSlots.some(
        (s) =>
          s.status === 'booked' &&
          s.teacherId === slot.teacherId &&
          s.dateIso === slot.dateIso &&
          s.studentId === student.id,
      )
      if (alreadyBookedSameDay) {
        return NextResponse.json(
          {
            ok: false,
            error: `You already have a booked PTM slot with ${slot.teacherName} for ${student.name} on ${slot.dateIso}.`,
          },
          { status: 409 },
        )
      }

      const guardianObj = guardians.find((g) => g.id === session.linked_entity_id)
      const guardianName = guardianObj?.name || session.display_name
      if (guardianObj?.phone) {
        void dispatchCampusAlert({
          channel: 'WhatsApp',
          to: guardianObj.phone,
          message: `DMHA PTM Confirmed: ${student.name} with ${slot.teacherName} (${slot.teacherSubject}) on ${slot.dateIso} at ${slot.startTime}–${slot.endTime} (${slot.mode} · ${slot.roomOrLink}).`,
          actor: guardianName,
          actorRole: session.role,
          ipAddress: ip,
        })
      }

      const nextSlots: PtmSlotItem[] = ptmSlots.map((s) =>
        s.id === slotId
          ? {
              ...s,
              status: 'booked',
              studentId: student.id,
              studentName: student.name,
              classLabel: `${student.className} · ${student.section}`,
              guardianId: session.linked_entity_id,
              guardianName,
              topic: topic || 'Academic progress & term feedback discussion',
              bookedAt: formatNow(),
            }
          : s,
      )

      const notif = {
        id: `notif-ptm-book-${Date.now()}`,
        title: `PTM Confirmed · ${slot.dateIso} (${slot.startTime})`,
        text: `${guardianName} booked a ${slot.mode} PTM with ${slot.teacherName} for ${student.name} (${slot.startTime}–${slot.endTime}).`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['teacher', 'admin', 'guardian'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        { ...currentData, ptmSlots: nextSlots, notifications: nextNotifs },
        guardianName,
      )

      appendSecurityAudit({
        action: 'ptm_slot_booked',
        target: `${guardianName} → ${slot.teacherName} (${slot.dateIso} ${slot.startTime}) for ${student.name}`,
        actor: guardianName,
        actorRole: 'guardian',
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: guardianName,
        summary: notif.title,
      })

      return NextResponse.json({
        ok: true,
        ptmSlots: scopePtmSlotsForSession(nextSlots, session),
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 3. CANCEL BOOKING (REOPEN SLOT) ====================
    if (action === 'cancel_booking') {
      const slotId = String(body.slotId || '').trim()
      const slot = ptmSlots.find((s) => s.id === slotId)
      if (!slot) {
        return NextResponse.json({ ok: false, error: 'PTM slot not found.' }, { status: 404 })
      }
      if (session.role === 'guardian' && slot.guardianId !== session.linked_entity_id) {
        return NextResponse.json(
          { ok: false, error: 'You can only cancel your own PTM booking.' },
          { status: 403 },
        )
      }
      if (session.role === 'teacher' && slot.teacherId !== session.linked_entity_id) {
        return NextResponse.json(
          { ok: false, error: 'Teachers can only manage their own PTM slots.' },
          { status: 403 },
        )
      }

      const nextSlots: PtmSlotItem[] = ptmSlots.map((s) =>
        s.id === slotId
          ? {
              ...s,
              status: 'open',
              studentId: undefined,
              studentName: undefined,
              classLabel: undefined,
              guardianId: undefined,
              guardianName: undefined,
              topic: undefined,
              bookedAt: undefined,
            }
          : s,
      )

      const saved = savePersistedState(
        { ...currentData, ptmSlots: nextSlots },
        session.display_name,
      )
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `PTM slot reopened (${slot.dateIso} ${slot.startTime})`,
      })
      return NextResponse.json({
        ok: true,
        ptmSlots: scopePtmSlotsForSession(nextSlots, session),
        version: saved.version,
      })
    }

    // ==================== 4. COMPLETE PTM & SAVE OUTCOME NOTES (TEACHER / ADMIN) ====================
    if (action === 'complete_slot') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can complete PTM appointments.' },
          { status: 403 },
        )
      }
      const slotId = String(body.slotId || '').trim()
      const outcomeNotes = String(body.outcomeNotes || '').trim().slice(0, 500)
      const slot = ptmSlots.find((s) => s.id === slotId)
      if (!slot) {
        return NextResponse.json({ ok: false, error: 'PTM slot not found.' }, { status: 404 })
      }
      if (session.role === 'teacher' && slot.teacherId !== session.linked_entity_id) {
        return NextResponse.json(
          { ok: false, error: 'Teachers can only complete their own PTM slots.' },
          { status: 403 },
        )
      }

      const nextSlots: PtmSlotItem[] = ptmSlots.map((s) =>
        s.id === slotId
          ? {
              ...s,
              status: 'completed',
              outcomeNotes: outcomeNotes || 'PTM consultation completed smoothly.',
              completedAt: formatNow(),
            }
          : s,
      )

      const notif = {
        id: `notif-ptm-done-${Date.now()}`,
        title: `PTM Summary Ready · ${slot.studentName || 'Student'}`,
        text: `${slot.teacherName} posted consultation outcome notes for ${slot.studentName || 'your child'}: "${outcomeNotes || 'Meeting completed.'}"`,
        time: 'Just now',
        type: 'result',
        forRoles: ['guardian', 'admin'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        { ...currentData, ptmSlots: nextSlots, notifications: nextNotifs },
        session.display_name,
      )

      const bookedGuardian = guardians.find((g) => g.id === slot.guardianId)
      if (bookedGuardian?.phone) {
        void dispatchCampusAlert({
          channel: 'WhatsApp',
          to: bookedGuardian.phone,
          message: `DMHA PTM Outcome (${slot.studentName || 'Student'}): ${slot.teacherName} noted: "${outcomeNotes || 'Meeting completed.'}"`,
          actor: session.display_name,
          actorRole: session.role,
          ipAddress: ip,
        })
      }

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: notif.title,
      })

      return NextResponse.json({
        ok: true,
        ptmSlots: scopePtmSlotsForSession(nextSlots, session),
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 5. DELETE OPEN SLOT (TEACHER / ADMIN) ====================
    if (action === 'delete_slot') {
      if (session.role !== 'teacher' && session.role !== 'admin') {
        return NextResponse.json({ ok: false, error: 'Permission denied.' }, { status: 403 })
      }
      const slotId = String(body.slotId || '').trim()
      const slot = ptmSlots.find((s) => s.id === slotId)
      if (!slot) {
        return NextResponse.json({ ok: false, error: 'Slot not found.' }, { status: 404 })
      }
      if (session.role === 'teacher' && slot.teacherId !== session.linked_entity_id) {
        return NextResponse.json({ ok: false, error: 'Cannot delete another teacher’s slot.' }, { status: 403 })
      }
      const nextSlots = ptmSlots.filter((s) => s.id !== slotId)
      const saved = savePersistedState(
        { ...currentData, ptmSlots: nextSlots },
        session.display_name,
      )
      return NextResponse.json({
        ok: true,
        ptmSlots: scopePtmSlotsForSession(nextSlots, session),
        version: saved.version,
      })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'PTM operation failed.' },
      { status: 500 },
    )
  }
}
