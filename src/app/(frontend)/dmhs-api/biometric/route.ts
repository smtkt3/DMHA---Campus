import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  createBiometricChallenge,
  deleteBiometricCredential,
  listBiometricCredentials,
  registerBiometricCredential,
  verifyBiometricAssertion,
} from '@/lib/dmhs-db'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireAuthSession(['guardian', 'admin'])
    if (!auth.ok) return auth.response
    const { session } = auth

    const url = new URL(request.url)
    const requestedGuardianId = url.searchParams.get('guardianId') || undefined
    const effectiveGuardianId =
      session.role === 'admin' ? requestedGuardianId : session.linked_entity_id

    const devices = listBiometricCredentials(effectiveGuardianId)
    return NextResponse.json({ ok: true, devices })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to load biometrics' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['guardian', 'admin'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as {
      action?: 'challenge' | 'register' | 'verify'
      guardianId?: string
      purpose?: string
      credentialId?: string
      deviceLabel?: string
      publicKeyB64?: string
      challenge?: string
    }

    if (!body.guardianId) {
      return NextResponse.json({ ok: false, error: 'guardianId is required' }, { status: 400 })
    }

    if (session.role !== 'admin' && session.linked_entity_id !== body.guardianId) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: cannot access another guardian biometric passkey.' },
        { status: 403 },
      )
    }

    if (body.action === 'challenge') {
      const challenge = createBiometricChallenge(body.guardianId, body.purpose || 'verify')
      const devices = listBiometricCredentials(body.guardianId)
      return NextResponse.json({ ok: true, challenge, devices })
    }

    if (body.action === 'register') {
      if (!body.credentialId || !body.challenge) {
        return NextResponse.json(
          { ok: false, error: 'credentialId and challenge are required' },
          { status: 400 },
        )
      }
      const res = registerBiometricCredential({
        guardianId: body.guardianId,
        credentialId: body.credentialId,
        deviceLabel: body.deviceLabel || 'Guardian Biometric Device',
        publicKeyB64: body.publicKeyB64 || 'webauthn-key',
        challenge: body.challenge,
      })
      if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.error }, { status: 400 })
      }
      appendSecurityAudit({
        action: 'biometric_registered',
        target: `${body.guardianId} · ${body.deviceLabel || 'Passkey'}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      return NextResponse.json({
        ok: true,
        device: res.device,
        devices: listBiometricCredentials(body.guardianId),
      })
    }

    if (body.action === 'verify') {
      if (!body.credentialId || !body.challenge) {
        return NextResponse.json(
          { ok: false, error: 'credentialId and challenge are required' },
          { status: 400 },
        )
      }
      const res = verifyBiometricAssertion({
        guardianId: body.guardianId,
        credentialId: body.credentialId,
        challenge: body.challenge,
      })
      if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.error }, { status: 401 })
      }
      appendSecurityAudit({
        action: 'biometric_verified',
        target: `${body.guardianId} · ${res.deviceLabel || 'Passkey'}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      return NextResponse.json({
        ok: true,
        deviceLabel: res.deviceLabel,
        verifiedAt: res.verifiedAt,
        devices: listBiometricCredentials(body.guardianId),
      })
    }

    return NextResponse.json({ ok: false, error: 'Invalid biometric action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Biometric operation failed' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuthSession(['guardian', 'admin'])
    if (!auth.ok) return auth.response
    const { session } = auth

    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const guardianId = url.searchParams.get('guardianId') || undefined
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Credential id is required' }, { status: 400 })
    }

    if (session.role !== 'admin') {
      const ownDevices = listBiometricCredentials(session.linked_entity_id)
      if (!ownDevices.some((d) => d.id === id)) {
        return NextResponse.json(
          { ok: false, error: 'Forbidden: cannot revoke another guardian device.' },
          { status: 403 },
        )
      }
    }

    deleteBiometricCredential(id)
    appendSecurityAudit({
      action: 'biometric_revoked',
      target: id,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: getClientIpFromRequest(request),
    })

    const effectiveGuardianId = session.role === 'admin' ? guardianId : session.linked_entity_id
    return NextResponse.json({ ok: true, devices: listBiometricCredentials(effectiveGuardianId) })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to revoke device' },
      { status: 500 },
    )
  }
}
