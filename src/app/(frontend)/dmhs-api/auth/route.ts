import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  authenticateUser,
  createUserSession,
  deleteSessionByToken,
  getDbStats,
  getSessionByToken,
  getUserById,
  getUserByRole,
  isDeveloperSession,
  listAuthAccounts,
} from '@/lib/dmhs-db'
import {
  checkRateLimit,
  DEV_MASTER_COOKIE_NAME,
  getClientIpFromRequest,
  getSessionCookieOptions,
  isDemoLoginAllowed,
  resetRateLimit,
  SESSION_COOKIE_NAME,
} from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatSessionUser(session: {
  user_id: string
  role: string
  display_name: string
  email: string
  login_code: string
  linked_entity_id: string
}) {
  return {
    id: session.user_id,
    role: session.role,
    displayName: session.display_name,
    email: session.email,
    loginCode: session.login_code,
    linkedEntityId: session.linked_entity_id,
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
    const devOriginToken = cookieStore.get(DEV_MASTER_COOKIE_NAME)?.value
    const session = getSessionByToken(token)
    const devOriginSession = getSessionByToken(devOriginToken)
    const hasDevMasterOrigin = Boolean(
      (devOriginSession && isDeveloperSession(devOriginSession)) ||
        (session && isDeveloperSession(session)),
    )
    const stats = session?.role === 'admin' || hasDevMasterOrigin ? getDbStats() : undefined
    const demoLoginAllowed = isDemoLoginAllowed()

    if (!session) {
      return NextResponse.json({
        ok: true,
        authenticated: false,
        isDeveloperMode: false,
        user: null,
        demoLoginAllowed,
      })
    }

    return NextResponse.json({
      ok: true,
      authenticated: true,
      isDeveloperMode: hasDevMasterOrigin,
      demoLoginAllowed,
      user: formatSessionUser(session),
      ...(stats ? { stats } : {}),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Session check failed' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIpFromRequest(request)
    const cookieStore = await cookies()
    const body = (await request.json()) as {
      mode?: 'credentials' | 'demo' | 'dev_impersonate' | 'dev_return'
      identifier?: string
      password?: string
      role?: 'admin' | 'guardian' | 'teacher' | 'student' | 'staff'
      linkedEntityId?: string
      targetUserId?: string
    }

    // ==================== DEVELOPER MASTER: SWITCH INTO ANY ACCOUNT ====================
    if (body.mode === 'dev_impersonate') {
      const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value
      const devOriginToken = cookieStore.get(DEV_MASTER_COOKIE_NAME)?.value
      const currentSession = getSessionByToken(currentToken)
      const devOriginSession = getSessionByToken(devOriginToken)

      const verifiedDevSession =
        devOriginSession && isDeveloperSession(devOriginSession)
          ? devOriginSession
          : currentSession && isDeveloperSession(currentSession)
            ? currentSession
            : null

      if (!verifiedDevSession) {
        appendSecurityAudit({
          action: 'dev_impersonate_unauthorized',
          target: body.targetUserId || body.linkedEntityId || 'unknown',
          actor: currentSession?.display_name || 'anonymous',
          actorRole: currentSession?.role || 'guest',
          ipAddress: ip,
        })
        return NextResponse.json(
          { ok: false, error: 'Forbidden: Only an authenticated Developer (DEV-001) session can switch accounts.' },
          { status: 403 },
        )
      }

      let targetUser = body.targetUserId ? getUserById(body.targetUserId) : null
      if (!targetUser && body.role) {
        targetUser = getUserByRole(body.role, body.linkedEntityId)
      }
      if (!targetUser) {
        return NextResponse.json(
          { ok: false, error: 'Target DMHA account not found in SQLite.' },
          { status: 404 },
        )
      }

      const nextSession = createUserSession(targetUser)
      appendSecurityAudit({
        action: 'dev_account_switched',
        target: `${targetUser.display_name} (${targetUser.role} · ${targetUser.login_code})`,
        actor: verifiedDevSession.display_name,
        actorRole: 'admin',
        ipAddress: ip,
      })

      const response = NextResponse.json({
        ok: true,
        authenticated: true,
        isDeveloperMode: true,
        demoLoginAllowed: isDemoLoginAllowed(),
        user: formatSessionUser(nextSession),
        accounts: listAuthAccounts(),
        stats: getDbStats(),
      })

      response.cookies.set(SESSION_COOKIE_NAME, nextSession.token, getSessionCookieOptions())
      response.cookies.set(
        DEV_MASTER_COOKIE_NAME,
        verifiedDevSession.token,
        getSessionCookieOptions(),
      )
      return response
    }

    // ==================== DEVELOPER MASTER: RETURN TO DEV-001 ====================
    if (body.mode === 'dev_return') {
      const devOriginToken = cookieStore.get(DEV_MASTER_COOKIE_NAME)?.value
      const devOriginSession = getSessionByToken(devOriginToken)
      if (!devOriginSession || !isDeveloperSession(devOriginSession)) {
        return NextResponse.json(
          { ok: false, error: 'No active Developer master session found.' },
          { status: 403 },
        )
      }

      const response = NextResponse.json({
        ok: true,
        authenticated: true,
        isDeveloperMode: true,
        demoLoginAllowed: isDemoLoginAllowed(),
        user: formatSessionUser(devOriginSession),
        accounts: listAuthAccounts(),
        stats: getDbStats(),
      })
      response.cookies.set(SESSION_COOKIE_NAME, devOriginSession.token, getSessionCookieOptions())
      return response
    }

    // ==================== STANDARD CREDENTIALS OR 1-CLICK DEMO LOGIN ====================
    let user = null
    if (body.mode === 'demo' && body.role) {
      if (!isDemoLoginAllowed()) {
        appendSecurityAudit({
          action: 'demo_login_blocked',
          target: body.role,
          actor: 'anonymous',
          actorRole: 'guest',
          ipAddress: ip,
        })
        return NextResponse.json(
          {
            ok: false,
            error:
              '1-Click Demo Login is disabled in production mode. Please sign in with your official DMHA Email/ID and Password.',
          },
          { status: 403 },
        )
      }
      user = getUserByRole(body.role, body.linkedEntityId)
    } else {
      const identifier = (body.identifier || '').trim()
      const password = body.password || ''
      if (!identifier || !password) {
        return NextResponse.json(
          { ok: false, error: 'Please enter both Email/ID and Password.' },
          { status: 400 },
        )
      }

      const bucketKey = `login:${ip}:${identifier.toLowerCase()}`
      const rate = checkRateLimit(bucketKey, 8, 15 * 60 * 1000)
      if (!rate.allowed) {
        appendSecurityAudit({
          action: 'login_rate_limited',
          target: identifier,
          actor: identifier,
          actorRole: 'guest',
          ipAddress: ip,
        })
        return NextResponse.json(
          {
            ok: false,
            error: `Too many failed sign-in attempts. Please wait ${rate.retryAfterSec}s before trying again.`,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(rate.retryAfterSec) },
          },
        )
      }

      user = authenticateUser(identifier, password)
      if (!user) {
        appendSecurityAudit({
          action: 'login_failed',
          target: identifier,
          actor: identifier,
          actorRole: 'guest',
          ipAddress: ip,
        })
        return NextResponse.json(
          {
            ok: false,
            error:
              'Invalid DMHA credentials. Check your Email/ID and password (demo pass: dmha2026).',
          },
          { status: 401 },
        )
      }

      resetRateLimit(bucketKey)
    }

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Account not found.' }, { status: 404 })
    }

    if (user.status === 'suspended') {
      appendSecurityAudit({
        action: 'login_suspended_blocked',
        target: user.email,
        actor: user.display_name,
        actorRole: user.role,
        ipAddress: ip,
      })
      return NextResponse.json(
        { ok: false, error: 'This account is suspended by DMHA Administration.' },
        { status: 403 },
      )
    }

    const session = createUserSession(user)
    const isDevLogin = isDeveloperSession(session)

    appendSecurityAudit({
      action: isDevLogin
        ? 'login_developer_master'
        : body.mode === 'demo'
          ? 'login_demo_success'
          : 'login_success',
      target: user.email,
      actor: user.display_name,
      actorRole: user.role,
      ipAddress: ip,
    })

    const stats = user.role === 'admin' || isDevLogin ? getDbStats() : undefined
    const response = NextResponse.json({
      ok: true,
      authenticated: true,
      isDeveloperMode: isDevLogin,
      demoLoginAllowed: isDemoLoginAllowed(),
      user: formatSessionUser(session),
      ...(stats ? { stats } : {}),
    })

    response.cookies.set(SESSION_COOKIE_NAME, session.token, getSessionCookieOptions())
    if (isDevLogin) {
      response.cookies.set(DEV_MASTER_COOKIE_NAME, session.token, getSessionCookieOptions())
    } else {
      response.cookies.set(DEV_MASTER_COOKIE_NAME, '', getSessionCookieOptions(0))
    }

    return response
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Sign-in failed' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const ip = getClientIpFromRequest(request)
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
    const devOriginToken = cookieStore.get(DEV_MASTER_COOKIE_NAME)?.value
    const session = getSessionByToken(token)
    if (session) {
      appendSecurityAudit({
        action: 'logout',
        target: session.email,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
    }
    deleteSessionByToken(token)
    if (devOriginToken && devOriginToken !== token) {
      deleteSessionByToken(devOriginToken)
    }
    const response = NextResponse.json({ ok: true, authenticated: false, isDeveloperMode: false })
    response.cookies.set(SESSION_COOKIE_NAME, '', getSessionCookieOptions(0))
    response.cookies.set(DEV_MASTER_COOKIE_NAME, '', getSessionCookieOptions(0))
    return response
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Sign-out failed' },
      { status: 500 },
    )
  }
}
