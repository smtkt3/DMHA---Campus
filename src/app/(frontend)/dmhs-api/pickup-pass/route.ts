import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  getOrCreateDailyPickupPass,
  rotatePickupPass,
  verifyPickupPassToken,
} from '@/lib/dmhs-db'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireAuthSession(['guardian', 'teacher', 'admin', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth
    if (
      session.role === 'staff' &&
      !staffHasServerPermission(session.linked_entity_id, 'gate_security')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Your staff role does not have Gate Security QR access.' },
        { status: 403 },
      )
    }

    const url = new URL(request.url)
    const studentId = (url.searchParams.get('studentId') || '').trim()
    const studentName = (url.searchParams.get('studentName') || 'Student').trim()
    const classLabel = (url.searchParams.get('classLabel') || 'Class 6 · Section A').trim()
    const unitLabel = (url.searchParams.get('unitLabel') || 'Unit - 1').trim()
    const authorizedPerson = (
      url.searchParams.get('authorizedPerson') ||
      session.display_name ||
      'Authorized Guardian'
    ).trim()
    const authorizedRelation = (url.searchParams.get('authorizedRelation') || 'Parent').trim()
    const authorizedIdNumber = (
      url.searchParams.get('authorizedIdNumber') || 'DMHA-GUARDIAN-VERIFIED'
    ).trim()

    if (!studentId) {
      return NextResponse.json({ ok: false, error: 'studentId is required.' }, { status: 400 })
    }

    const pass = getOrCreateDailyPickupPass({
      studentId,
      studentName,
      classLabel,
      unitLabel,
      guardianId: session.linked_entity_id || session.user_id,
      authorizedPerson,
      authorizedRelation,
      authorizedIdNumber,
    })

    return NextResponse.json({ ok: true, pass })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to load pickup pass.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as {
      action?: 'rotate' | 'verify'
      token?: string
      studentId?: string
      studentName?: string
      classLabel?: string
      unitLabel?: string
      authorizedPerson?: string
      authorizedRelation?: string
      authorizedIdNumber?: string
    }

    if (body.action === 'rotate') {
      const auth = await requireAuthSession(['guardian', 'admin'])
      if (!auth.ok) return auth.response
      const { session } = auth

      if (!body.studentId) {
        return NextResponse.json({ ok: false, error: 'studentId is required.' }, { status: 400 })
      }

      const pass = rotatePickupPass({
        studentId: body.studentId,
        studentName: body.studentName || 'Student',
        classLabel: body.classLabel || 'Class 6',
        unitLabel: body.unitLabel || 'Unit - 1',
        guardianId: session.linked_entity_id || session.user_id,
        authorizedPerson: body.authorizedPerson || session.display_name,
        authorizedRelation: body.authorizedRelation || 'Parent',
        authorizedIdNumber: body.authorizedIdNumber || 'DMHA-GUARDIAN-VERIFIED',
      })

      appendSecurityAudit({
        action: 'pickup_pass_rotated',
        target: `${pass.studentName} (${pass.id}) · ${pass.authorizedPerson}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      return NextResponse.json({ ok: true, pass })
    }

    if (body.action === 'verify') {
      const auth = await requireAuthSession(['teacher', 'admin', 'staff'])
      if (!auth.ok) return auth.response
      const { session } = auth
      if (
        session.role === 'staff' &&
        !staffHasServerPermission(session.linked_entity_id, 'gate_security')
      ) {
        return NextResponse.json(
          { ok: false, error: 'Your staff role does not have Gate Security QR verification permission.' },
          { status: 403 },
        )
      }

      if (!body.token || !body.token.trim()) {
        return NextResponse.json({ ok: false, error: 'Scanned QR token is required.' }, { status: 400 })
      }

      const result = verifyPickupPassToken(body.token)
      if (!result.valid) {
        appendSecurityAudit({
          action: 'pickup_pass_rejected',
          target: `${body.token.slice(0, 32)} · ${result.reason}`,
          actor: session.display_name,
          actorRole: session.role,
          ipAddress: ip,
        })
        return NextResponse.json(
          { ok: false, valid: false, reason: result.reason },
          { status: 403 },
        )
      }

      appendSecurityAudit({
        action: 'pickup_pass_verified',
        target: `${result.pass.studentName} (${result.pass.unitLabel}) · ${result.pass.authorizedPerson}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      return NextResponse.json({ ok: true, valid: true, pass: result.pass })
    }

    return NextResponse.json({ ok: false, error: 'Invalid pickup-pass action.' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Pickup pass operation failed.' },
      { status: 500 },
    )
  }
}
