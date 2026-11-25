import { NextResponse } from 'next/server'
import { appendSecurityAudit, changeUserOwnPassword } from '@/lib/dmhs-db'
import { checkRateLimit, getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession()
    if (!auth.ok) return auth.response
    const { session } = auth

    const ip = getClientIpFromRequest(request)
    const rate = checkRateLimit(`pwd:${session.user_id}`, 10, 15 * 60 * 1000)
    if (!rate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Too many password update attempts. Please wait ${rate.retryAfterSec}s.`,
        },
        { status: 429 },
      )
    }

    const body = (await request.json()) as {
      linkedEntityId?: string
      role?: 'admin' | 'guardian' | 'teacher' | 'student'
      currentPassword?: string
      newPassword?: string
    }

    // Strict ownership enforcement: non-admin users can only update their own account password
    const targetRole = session.role === 'admin' && body.role ? body.role : session.role
    const targetEntityId =
      session.role === 'admin'
        ? targetRole === session.role
          ? body.linkedEntityId || session.linked_entity_id
          : body.linkedEntityId
        : session.linked_entity_id

    const result = changeUserOwnPassword({
      linkedEntityId: targetEntityId,
      email: targetRole === session.role ? session.email : undefined,
      role: targetRole,
      currentPassword: body.currentPassword || '',
      newPassword: body.newPassword || '',
    })

    if (!result.ok) {
      appendSecurityAudit({
        action: 'password_change_failed',
        target: session.email,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
    }

    appendSecurityAudit({
      action: 'password_changed',
      target: result.email || session.email,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: ip,
    })

    return NextResponse.json({
      ok: true,
      email: result.email,
      loginCode: result.loginCode,
      message: 'Password updated securely in DMHA SQLite database.',
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Password update failed' },
      { status: 500 },
    )
  }
}
