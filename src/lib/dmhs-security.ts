import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { type DbSessionRow, getSessionByToken, loadPersistedState } from './dmhs-db'

export type AllowedRole = 'admin' | 'guardian' | 'teacher' | 'student' | 'staff'

const DEFAULT_STAFF_PERMS: Record<string, string[]> = {
  'stf-rafiqul': ['accounts', 'payroll', 'payment_ledger', 'documents', 'notices'],
  'stf-salma': ['canteen_pos', 'notices'],
  'stf-kamal': ['gate_security', 'notices'],
}

export function staffHasServerPermission(linkedEntityId: string, permission: string): boolean {
  const persisted = loadPersistedState()
  if (persisted.exists && persisted.data) {
    const staffList = Array.isArray(persisted.data.staffMembers)
      ? (persisted.data.staffMembers as Array<{ id: string; customRoleId: string; status?: string }>)
      : []
    const roleList = Array.isArray(persisted.data.customRoles)
      ? (persisted.data.customRoles as Array<{ id: string; permissions?: string[] }>)
      : []
    const member = staffList.find((m) => m.id === linkedEntityId)
    if (member) {
      if (member.status === 'suspended') return false
      const customRole = roleList.find((r) => r.id === member.customRoleId)
      if (customRole && Array.isArray(customRole.permissions)) {
        return customRole.permissions.includes(permission)
      }
    }
  }
  return (DEFAULT_STAFF_PERMS[linkedEntityId] || []).includes(permission)
}

export const SESSION_COOKIE_NAME = 'dmhs_session'
export const DEV_MASTER_COOKIE_NAME = 'dmhs_dev_origin'

declare global {
  // eslint-disable-next-line no-var
  var __dmhsRateLimits: Map<string, { count: number; resetAt: number }> | undefined
}

function getRateMap() {
  if (!globalThis.__dmhsRateLimits) {
    globalThis.__dmhsRateLimits = new Map()
  }
  return globalThis.__dmhsRateLimits
}

export function getClientIpFromRequest(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first.replace(/^::ffff:/, '')
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim().replace(/^::ffff:/, '')
  return '127.0.0.1'
}

export function checkRateLimit(
  bucketKey: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const map = getRateMap()
  const now = Date.now()
  const current = map.get(bucketKey)

  if (!current || current.resetAt <= now) {
    map.set(bucketKey, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, retryAfterSec: 0 }
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  current.count += 1
  return { allowed: true, remaining: maxRequests - current.count, retryAfterSec: 0 }
}

export function resetRateLimit(bucketKey: string): void {
  getRateMap().delete(bucketKey)
}

export function isDemoLoginAllowed(): boolean {
  if (process.env.DMHS_ALLOW_DEMO_LOGIN === 'false') return false
  if (process.env.DMHS_ALLOW_DEMO_LOGIN === 'true') return true
  return process.env.NODE_ENV !== 'production'
}

export function getSessionCookieOptions(maxAgeSec = 60 * 60 * 24 * 7) {
  const isProd = process.env.NODE_ENV === 'production'
  const secure = isProd && process.env.DMHS_ALLOW_HTTP_COOKIE !== 'true'
  // Hugging Face Spaces embeds apps inside a cross-site iframe on huggingface.co.
  // Enable SameSite=None when running over HTTPS in HF Spaces or when explicitly configured.
  const wantsNone =
    process.env.DMHS_COOKIE_SAMESITE?.toLowerCase() === 'none' || Boolean(process.env.SPACE_ID)
  const sameSite: 'lax' | 'none' = secure && wantsNone ? 'none' : 'lax'
  return {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    maxAge: maxAgeSec,
  }
}

export async function requireAuthSession(
  allowedRoles?: AllowedRole[],
): Promise<
  { ok: true; session: DbSessionRow } | { ok: false; response: NextResponse }
> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const session = getSessionByToken(token)

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Authentication required. Please sign in to DMHA.' },
        { status: 401 },
      ),
    }
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: `Forbidden: ${session.role} role is not authorized for this operation.`,
        },
        { status: 403 },
      ),
    }
  }

  return { ok: true, session }
}
