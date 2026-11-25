import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  getDbStats,
  getSessionByToken,
  isDeveloperSession,
  listAuthAccounts,
  upsertUserAccountAndPassword,
} from '@/lib/dmhs-db'
import {
  DEV_MASTER_COOKIE_NAME,
  getClientIpFromRequest,
  requireAuthSession,
} from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireAuthSession()
    if (!auth.ok) return auth.response
    const { session } = auth

    const cookieStore = await cookies()
    const devToken = cookieStore.get(DEV_MASTER_COOKIE_NAME)?.value
    const devSession = getSessionByToken(devToken)
    const isDevMaster = Boolean(
      isDeveloperSession(session) || (devSession && isDeveloperSession(devSession)),
    )

    const allAccounts = listAuthAccounts()
    const accounts =
      session.role === 'admin' || isDevMaster
        ? allAccounts
        : allAccounts.filter(
            (a) => a.id === session.user_id || a.linkedEntityId === session.linked_entity_id,
          )
    const stats = session.role === 'admin' || isDevMaster ? getDbStats() : undefined
    return NextResponse.json({ ok: true, accounts, isDeveloperMode: isDevMaster, ...(stats ? { stats } : {}) })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to list accounts' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuthSession(['admin'])
    if (!auth.ok) return auth.response
    const { session } = auth

    const body = (await request.json()) as {
      linkedEntityId?: string
      role?: 'admin' | 'guardian' | 'teacher' | 'student' | 'staff'
      displayName?: string
      email?: string
      loginCode?: string
      status?: 'active' | 'suspended'
      newPassword?: string
    }

    if (!body.linkedEntityId || !body.role || !body.displayName) {
      return NextResponse.json(
        { ok: false, error: 'linkedEntityId, role, and displayName are required.' },
        { status: 400 },
      )
    }

    const result = upsertUserAccountAndPassword({
      linkedEntityId: body.linkedEntityId,
      role: body.role,
      displayName: body.displayName,
      email: body.email,
      loginCode: body.loginCode,
      status: body.status,
      newPassword: body.newPassword,
    })

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
    }

    appendSecurityAudit({
      action: body.newPassword ? 'admin_account_password_reset' : 'admin_account_updated',
      target: `${body.displayName} (${body.role})`,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: getClientIpFromRequest(request),
    })

    const accounts = listAuthAccounts()
    const stats = getDbStats()
    return NextResponse.json({ ok: true, account: result.account, accounts, stats })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to update account' },
      { status: 500 },
    )
  }
}
