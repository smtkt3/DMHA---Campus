import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import { initialAcademicCalendarEvents } from '@/components/school/data'
import type { AcademicCalendarEvent } from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = new Set<AcademicCalendarEvent['category']>([
  'holiday',
  'exam',
  'ptm',
  'event',
  'trip',
  'deadline',
])

function formatNow(): string {
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `Today · ${t}`
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '').trim()

    const persisted = loadPersistedState()
    const currentData = (persisted?.data || {}) as Record<string, unknown>
    const events = Array.isArray(currentData.calendarEvents)
      ? (currentData.calendarEvents as AcademicCalendarEvent[])
      : Array.isArray(initialAcademicCalendarEvents)
        ? initialAcademicCalendarEvents
        : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []

    if (action === 'create_event') {
      const title = String(body.title || '').trim().slice(0, 140)
      const dateIso = String(body.dateIso || '').trim().slice(0, 12)
      const endDateIso = String(body.endDateIso || '').trim().slice(0, 12) || undefined
      const rawCat = String(body.category || 'event') as AcademicCalendarEvent['category']
      const category: AcademicCalendarEvent['category'] = VALID_CATEGORIES.has(rawCat)
        ? rawCat
        : 'event'
      const targetUnit = String(body.targetUnit || 'All Units').trim().slice(0, 50) || 'All Units'
      const description = String(body.description || '').trim().slice(0, 500)
      const isSchoolClosed = Boolean(body.isSchoolClosed) || category === 'holiday'

      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
        return NextResponse.json(
          { ok: false, error: 'Event title and valid date (YYYY-MM-DD) are required.' },
          { status: 400 },
        )
      }

      if ((category === 'holiday' || isSchoolClosed) && session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Admins can declare School Holidays or Campus Closures.' },
          { status: 403 },
        )
      }

      const newEvent: AcademicCalendarEvent = {
        id: `cal-${Date.now()}`,
        title,
        dateIso,
        ...(endDateIso && /^\d{4}-\d{2}-\d{2}$/.test(endDateIso) ? { endDateIso } : {}),
        category,
        targetUnit,
        description: description || `${title} (${targetUnit})`,
        isSchoolClosed,
        createdBy: session.display_name,
        createdAt: formatNow(),
      }

      const nextEvents = [newEvent, ...events].sort((a, b) => a.dateIso.localeCompare(b.dateIso))
      const notif = {
        id: `notif-cal-${Date.now()}`,
        title: `${isSchoolClosed ? 'School Holiday' : 'Calendar Event'} · ${title}`,
        text: `${dateIso}${endDateIso ? ` – ${endDateIso}` : ''} (${targetUnit}) · ${newEvent.description}`,
        time: 'Just now',
        type: isSchoolClosed ? 'alert' : 'notice',
        forRoles: ['guardian', 'student', 'teacher', 'admin', 'staff'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        { ...currentData, calendarEvents: nextEvents, notifications: nextNotifs },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'calendar_event_created',
        target: `${title} (${dateIso} · ${category} · ${targetUnit})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Calendar updated: ${title}`,
      })

      return NextResponse.json({
        ok: true,
        event: newEvent,
        calendarEvents: nextEvents,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    if (action === 'delete_event') {
      const eventId = String(body.eventId || '').trim()
      const target = events.find((e) => e.id === eventId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Calendar event not found.' }, { status: 404 })
      }
      if (session.role !== 'admin' && target.createdBy !== session.display_name) {
        return NextResponse.json(
          { ok: false, error: 'Teachers can only delete calendar events they created.' },
          { status: 403 },
        )
      }
      const nextEvents = events.filter((e) => e.id !== eventId)
      const saved = savePersistedState(
        { ...currentData, calendarEvents: nextEvents },
        session.display_name,
      )
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Removed calendar event: ${target.title}`,
      })
      return NextResponse.json({ ok: true, calendarEvents: nextEvents, version: saved.version })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Calendar operation failed.' },
      { status: 500 },
    )
  }
}
