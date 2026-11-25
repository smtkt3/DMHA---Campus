import { NextResponse } from 'next/server'
import { appendSecurityAudit, loadPersistedState, savePersistedState } from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import { initialTransportBook } from '@/lib/dmhs-transport'
import type {
  BusBoardingLog,
  BusRouteRecord,
  FeeInvoice,
  StudentRecord,
  TransportBookState,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function loadTransportBook(currentData: Record<string, unknown>): TransportBookState {
  const raw = currentData.transportBook as Partial<TransportBookState> | undefined
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.routes)) {
    return structuredClone(initialTransportBook)
  }
  return {
    routes: raw.routes,
    boardingLogs: Array.isArray(raw.boardingLogs)
      ? raw.boardingLogs
      : initialTransportBook.boardingLogs,
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'staff', 'teacher'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    // Only Admin can edit routes or generate transport bills; Staff/Teacher can log boarding
    const adminOnlyActions = new Set(['save_route', 'delete_route', 'assign_student_route', 'bill_transport_fees'])
    if (session.role !== 'admin' && adminOnlyActions.has(action)) {
      return NextResponse.json(
        { ok: false, error: 'Only School Admin can configure transport routes or billing.' },
        { status: 403 },
      )
    }

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const book = loadTransportBook(currentData)
    const students: StudentRecord[] = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const fees: FeeInvoice[] = Array.isArray(currentData.fees)
      ? (currentData.fees as FeeInvoice[])
      : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []

    const commit = (
      nextBook: TransportBookState,
      summary: string,
      auditAction: string,
      auditTarget: string,
      extra: Record<string, unknown> = {},
    ) => {
      const saved = savePersistedState(
        { ...currentData, transportBook: nextBook, ...extra },
        session.display_name,
      )
      appendSecurityAudit({
        action: auditAction,
        target: auditTarget,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary,
      })
      return NextResponse.json({
        ok: true,
        transportBook: nextBook,
        ...extra,
        version: saved.version,
      })
    }

    if (action === 'save_route') {
      const routeName = String(body.routeName || '').trim().slice(0, 100)
      const driverName = String(body.driverName || '').trim()
      const driverPhone = String(body.driverPhone || '+880 1700-000000').trim()
      const attendantName = String(body.attendantName || 'Bus Attendant').trim()
      const vehicleNo = String(body.vehicleNo || 'Dhaka Metro-Ga 28-0000').trim()
      const capacity = Math.max(8, Math.min(60, Math.round(Number(body.capacity || 26))))
      const monthlyFee = Math.max(0, Math.round(Number(body.monthlyFee || 2800)))
      const stops = Array.isArray(body.stops)
        ? (body.stops as string[]).map((s) => s.trim()).filter(Boolean)
        : String(body.stopsText || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
      if (!routeName || !driverName) {
        return NextResponse.json(
          { ok: false, error: 'Route name and driver name are required.' },
          { status: 400 },
        )
      }
      const route: BusRouteRecord = {
        id: `bus-rt-${Date.now()}`,
        routeCode: `RT-${String(book.routes.length + 1).padStart(2, '0')}`,
        routeName,
        driverName,
        driverPhone,
        attendantName,
        vehicleNo,
        capacity,
        monthlyFee,
        morningStart: String(body.morningStart || '07:00 AM'),
        afternoonStart: String(body.afternoonStart || '02:15 PM'),
        stops: stops.length > 0 ? stops : ['Main Stop', 'DMHA Main Gate'],
        active: true,
      }
      return commit(
        { ...book, routes: [...book.routes, route] },
        `Added bus route: ${routeName}`,
        'transport_route_added',
        `${route.routeCode} · ${routeName}`,
      )
    }

    if (action === 'delete_route') {
      const routeId = String(body.routeId || '')
      return commit(
        { ...book, routes: book.routes.filter((r) => r.id !== routeId) },
        'Removed bus route',
        'transport_route_deleted',
        routeId,
      )
    }

    if (action === 'assign_student_route') {
      const studentId = String(body.studentId || '')
      const routeName = String(body.routeName || '').trim()
      const stu = students.find((s) => s.id === studentId)
      if (!stu || !routeName) {
        return NextResponse.json({ ok: false, error: 'Student and bus route are required.' }, { status: 400 })
      }
      const nextStudents = students.map((s) =>
        s.id === studentId ? { ...s, busRoute: routeName } : s,
      )
      return commit(
        book,
        `Assigned ${stu.name} to ${routeName}`,
        'transport_student_assigned',
        `${stu.name} -> ${routeName}`,
        { students: nextStudents },
      )
    }

    if (action === 'log_boarding') {
      const routeId = String(body.routeId || '')
      const studentId = String(body.studentId || '')
      const direction = (body.direction as BusBoardingLog['direction']) || 'Morning Pickup'
      const status = (body.status as BusBoardingLog['status']) || 'boarded'
      const stopName = String(body.stopName || 'Scheduled Stop').trim()
      const route = book.routes.find((r) => r.id === routeId) || book.routes[0]
      const stu = students.find((s) => s.id === studentId)
      if (!route || !stu) {
        return NextResponse.json({ ok: false, error: 'Valid route and student are required.' }, { status: 400 })
      }
      const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      const log: BusBoardingLog = {
        id: `bl-${Date.now()}`,
        routeId: route.id,
        routeName: route.routeName,
        studentId: stu.id,
        studentName: stu.name,
        classLabel: `${stu.className} · ${stu.section}`,
        direction,
        stopName,
        timestamp: `Today · ${nowTime}`,
        status,
        recordedBy: session.display_name,
      }
      const notif = {
        id: `notif-bus-${Date.now()}`,
        title: `School Bus Alert · ${stu.name}`,
        text: `${stu.name} marked ${status.toUpperCase()} on ${route.routeName} (${direction} · ${stopName} at ${nowTime}).`,
        time: 'Just now',
        type: 'pickup',
        forRoles: ['guardian', 'admin'],
        read: false,
      }
      return commit(
        { ...book, boardingLogs: [log, ...book.boardingLogs].slice(0, 120) },
        `${stu.name} marked ${status} (${route.routeCode})`,
        'transport_boarding_logged',
        `${stu.name} · ${direction} · ${status}`,
        { notifications: [notif, ...existingNotifs].slice(0, 80) },
      )
    }

    if (action === 'bill_transport_fees') {
      const billingMonth = String(body.billingMonth || 'December 2026').trim()
      const created: FeeInvoice[] = []
      for (const stu of students) {
        if (stu.status === 'suspended' || !stu.busRoute || stu.busRoute.toLowerCase().includes('own') || stu.busRoute.toLowerCase().includes('private')) {
          continue
        }
        const matchedRoute =
          book.routes.find((r) =>
            stu.busRoute.toLowerCase().includes(r.routeName.split('·')[0].trim().toLowerCase()) ||
            r.routeName.toLowerCase() === stu.busRoute.toLowerCase(),
          ) || book.routes[0]
        if (!matchedRoute || matchedRoute.monthlyFee <= 0) continue
        const invTitle = `Transport & Bus Fee (${billingMonth}) — ${matchedRoute.routeCode}`
        const duplicate = fees.some(
          (f) => f.studentId === stu.id && f.title.toLowerCase() === invTitle.toLowerCase(),
        )
        if (duplicate) continue
        created.push({
          id: `fee-bus-${Date.now()}-${stu.id}`,
          studentId: stu.id,
          studentName: stu.name,
          title: invTitle,
          category: 'Transport & Bus',
          amount: matchedRoute.monthlyFee,
          dueDate: `Due 10 ${billingMonth}`,
          status: 'due',
        })
      }
      if (created.length === 0) {
        return NextResponse.json(
          { ok: false, error: `All bus riders are already billed for ${billingMonth}.` },
          { status: 409 },
        )
      }
      return commit(
        book,
        `Generated ${created.length} Transport Fee invoices for ${billingMonth}`,
        'transport_fees_billed',
        `${billingMonth} (${created.length} riders)`,
        { fees: [...created, ...fees] },
      )
    }

    return NextResponse.json({ ok: false, error: `Unknown transport action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Transport action failed.' },
      { status: 500 },
    )
  }
}
