import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ServerWifiConfig {
  ssidLabel: string
  allowedIps: string[]
  strictWifiOnly: boolean
  lateCutoffTime: string
}

interface ServerAttendanceRow {
  id: string
  teacherId: string
  teacherName: string
  date: string
  checkInTime: string | null
  checkOutTime: string | null
  status: 'checked_in' | 'checked_out' | 'late' | 'absent'
  verifiedIp: string
  wifiNetwork: string
  biometricVerified: boolean
  hoursWorked?: string
}

const DEFAULT_WIFI_CONFIG: ServerWifiConfig = {
  ssidLabel: 'DMHA-Campus-5G (Official School Router)',
  allowedIps: ['127.0.0.1', '::1', '192.168.*', '10.*'],
  strictWifiOnly: true,
  lateCutoffTime: '08:15 AM',
}

function getServerWifiConfig(): ServerWifiConfig {
  const persisted = loadPersistedState()
  const raw =
    persisted.exists && persisted.data && typeof persisted.data.campusWifiConfig === 'object'
      ? (persisted.data.campusWifiConfig as Partial<ServerWifiConfig>)
      : null
  return {
    ssidLabel:
      typeof raw?.ssidLabel === 'string' && raw.ssidLabel.trim()
        ? raw.ssidLabel.trim()
        : DEFAULT_WIFI_CONFIG.ssidLabel,
    allowedIps:
      Array.isArray(raw?.allowedIps) && raw.allowedIps.length > 0
        ? raw.allowedIps.map((x) => String(x).trim()).filter(Boolean)
        : DEFAULT_WIFI_CONFIG.allowedIps,
    strictWifiOnly:
      typeof raw?.strictWifiOnly === 'boolean'
        ? raw.strictWifiOnly
        : DEFAULT_WIFI_CONFIG.strictWifiOnly,
    lateCutoffTime:
      typeof raw?.lateCutoffTime === 'string' && raw.lateCutoffTime.trim()
        ? raw.lateCutoffTime.trim()
        : DEFAULT_WIFI_CONFIG.lateCutoffTime,
  }
}

function ipMatchesAllowlist(ip: string, allowlist: string[]): boolean {
  const cleanIp = ip.trim().toLowerCase()
  return allowlist.some((pattern) => {
    const p = pattern.trim().toLowerCase()
    if (!p) return false
    if (p === '*' || p === cleanIp) return true
    if (p.endsWith('*')) {
      return cleanIp.startsWith(p.slice(0, -1))
    }
    if (cleanIp === '::1' && p === '127.0.0.1') return true
    if (cleanIp === '127.0.0.1' && p === '::1') return true
    return false
  })
}

function parseTimeToMinutes(label: string): number | null {
  const m = label.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!m) return null
  let hh = Number(m[1])
  const mm = Number(m[2])
  const meridiem = m[3]?.toUpperCase()
  if (meridiem === 'PM' && hh < 12) hh += 12
  if (meridiem === 'AM' && hh === 12) hh = 0
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh > 23 || mm > 59) return null
  return hh * 60 + mm
}

function computeHoursWorked(checkInLabel: string | null, checkOutDate: Date): string {
  const outMins = checkOutDate.getHours() * 60 + checkOutDate.getMinutes()
  const inMins = checkInLabel ? parseTimeToMinutes(checkInLabel) : null
  if (inMins === null) return '0h 01m'
  const diff = Math.max(1, outMins - inMins)
  const hrs = Math.floor(diff / 60)
  const mins = diff % 60
  return hrs > 0 ? `${hrs}h ${String(mins).padStart(2, '0')}m` : `${mins}m`
}

function formatTodayDateLabel(now: Date): string {
  return `Today · ${now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`
}

export async function GET(request: Request) {
  const auth = await requireAuthSession(['teacher', 'admin'])
  if (!auth.ok) return auth.response

  // Always enforce the server-persisted Campus Wi-Fi config (never trust client query params)
  const wifiConfig = getServerWifiConfig()
  const detectedIp = getClientIpFromRequest(request)
  const onSchoolWifi = ipMatchesAllowlist(detectedIp, wifiConfig.allowedIps)

  return NextResponse.json({
    ok: true,
    detectedIp,
    onSchoolWifi,
    strictWifiOnly: wifiConfig.strictWifiOnly,
    lateCutoffTime: wifiConfig.lateCutoffTime,
    networkLabel: onSchoolWifi
      ? `${wifiConfig.ssidLabel} (Verified LAN/Wi-Fi)`
      : 'External / Mobile Network',
    serverTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  })
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuthSession(['admin'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as Partial<ServerWifiConfig>
    const current = getServerWifiConfig()
    const nextConfig: ServerWifiConfig = {
      ssidLabel:
        typeof body.ssidLabel === 'string' && body.ssidLabel.trim()
          ? body.ssidLabel.trim().slice(0, 100)
          : current.ssidLabel,
      allowedIps:
        Array.isArray(body.allowedIps) && body.allowedIps.length > 0
          ? body.allowedIps
              .map((x) => String(x).trim())
              .filter(Boolean)
              .slice(0, 24)
          : current.allowedIps,
      strictWifiOnly:
        typeof body.strictWifiOnly === 'boolean' ? body.strictWifiOnly : current.strictWifiOnly,
      lateCutoffTime:
        typeof body.lateCutoffTime === 'string' && body.lateCutoffTime.trim()
          ? body.lateCutoffTime.trim().slice(0, 20)
          : current.lateCutoffTime,
    }

    const persisted = loadPersistedState()
    let nextVersion = persisted.version
    if (persisted.exists && persisted.data) {
      const saved = savePersistedState(
        {
          ...persisted.data,
          campusWifiConfig: nextConfig,
        },
        `${session.display_name} (admin)`,
      )
      nextVersion = saved.version
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: `${session.display_name} (admin)`,
        summary: 'Updated official School Wi-Fi allowlist',
      })
    }

    appendSecurityAudit({
      action: 'campus_wifi_config_updated',
      target: `${nextConfig.ssidLabel} · strict=${nextConfig.strictWifiOnly} · cutoff=${nextConfig.lateCutoffTime} · IPs=${nextConfig.allowedIps.join(',')}`,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: ip,
    })

    return NextResponse.json({ ok: true, config: nextConfig, version: nextVersion })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to save Wi-Fi config' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['teacher', 'admin'])
    if (!auth.ok) return auth.response
    const { session } = auth

    const body = (await request.json()) as {
      teacherId?: string
      teacherName?: string
      action?: 'checkin' | 'checkout'
      simulateOffCampus?: boolean
      biometricVerified?: boolean
    }

    if (!body.teacherId || (body.action !== 'checkin' && body.action !== 'checkout')) {
      return NextResponse.json(
        { ok: false, error: 'teacherId and action (checkin | checkout) are required.' },
        { status: 400 },
      )
    }

    const realIp = getClientIpFromRequest(request)

    // Anti-impersonation guard: Teachers can ONLY punch for their own account!
    if (session.role === 'teacher' && body.teacherId !== session.linked_entity_id) {
      appendSecurityAudit({
        action: 'faculty_punch_impersonation_blocked',
        target: `${session.linked_entity_id} attempted punch for ${body.teacherId}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: realIp,
      })
      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          error: 'Security Block: Teachers can only check in or check out for their own account.',
        },
        { status: 403 },
      )
    }

    // Authoritative server-stored Campus Wi-Fi rules (client cannot override!)
    const wifiConfig = getServerWifiConfig()
    const allowSimulate = Boolean(body.simulateOffCampus)
    const effectiveIp = allowSimulate ? '45.125.220.89 (External 4G/Home)' : realIp
    const isAllowed = !allowSimulate && ipMatchesAllowlist(realIp, wifiConfig.allowedIps)

    if (wifiConfig.strictWifiOnly && !isAllowed) {
      appendSecurityAudit({
        action: `faculty_${body.action}_wifi_blocked`,
        target: `${body.teacherName || body.teacherId} (${effectiveIp})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: realIp,
      })
      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          detectedIp: effectiveIp,
          error: `Anti-Cheat Block: Detected IP (${effectiveIp}) is NOT on official School Wi-Fi (${wifiConfig.ssidLabel}). Teachers can only ${body.action === 'checkin' ? 'Check In' : 'Check Out'} inside DMHA campus Wi-Fi.`,
        },
        { status: 403 },
      )
    }

    const now = new Date()
    const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const todayLabel = formatTodayDateLabel(now)
    const cutoffMins = parseTimeToMinutes(wifiConfig.lateCutoffTime) ?? 8 * 60 + 15
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const isLate = body.action === 'checkin' && nowMins > cutoffMins

    // Atomically commit the verified punch into SQLite dmhs_kv_state!
    const persisted = loadPersistedState()
    const existingLogs =
      persisted.exists && persisted.data && Array.isArray(persisted.data.teacherAttendance)
        ? (persisted.data.teacherAttendance as ServerAttendanceRow[])
        : []

    const existingForTeacher = existingLogs.find((r) => r.teacherId === body.teacherId)
    const hoursWorked =
      body.action === 'checkout'
        ? computeHoursWorked(existingForTeacher?.checkInTime || null, now)
        : undefined

    const savedRecord: ServerAttendanceRow = existingForTeacher
      ? body.action === 'checkin'
        ? {
            ...existingForTeacher,
            teacherName: body.teacherName || existingForTeacher.teacherName,
            date: todayLabel,
            checkInTime: timeLabel,
            checkOutTime: null,
            status: isLate ? 'late' : 'checked_in',
            verifiedIp: effectiveIp,
            wifiNetwork: wifiConfig.ssidLabel,
            biometricVerified: !!body.biometricVerified,
            hoursWorked: undefined,
          }
        : {
            ...existingForTeacher,
            teacherName: body.teacherName || existingForTeacher.teacherName,
            date: todayLabel,
            checkInTime: existingForTeacher.checkInTime || timeLabel,
            checkOutTime: timeLabel,
            status: 'checked_out',
            verifiedIp: effectiveIp,
            wifiNetwork: wifiConfig.ssidLabel,
            hoursWorked,
          }
      : {
          id: `tatt-${Date.now()}`,
          teacherId: body.teacherId,
          teacherName: body.teacherName || session.display_name,
          date: todayLabel,
          checkInTime: timeLabel,
          checkOutTime: body.action === 'checkout' ? timeLabel : null,
          status:
            body.action === 'checkout' ? 'checked_out' : isLate ? 'late' : 'checked_in',
          verifiedIp: effectiveIp,
          wifiNetwork: wifiConfig.ssidLabel,
          biometricVerified: !!body.biometricVerified,
          hoursWorked,
        }

    let nextVersion = persisted.version
    if (persisted.exists && persisted.data) {
      const nextLogs = existingForTeacher
        ? existingLogs.map((r) => (r.teacherId === body.teacherId ? savedRecord : r))
        : [savedRecord, ...existingLogs]
      const saved = savePersistedState(
        {
          ...persisted.data,
          teacherAttendance: nextLogs,
        },
        `${session.display_name} (${session.role})`,
      )
      nextVersion = saved.version
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: `${session.display_name} (${session.role})`,
        summary: `Faculty ${body.action} · ${savedRecord.teacherName}`,
      })
    }

    appendSecurityAudit({
      action: `faculty_${body.action}_verified`,
      target: `${savedRecord.teacherName} · ${timeLabel} · ${effectiveIp}${hoursWorked ? ` · ${hoursWorked}` : ''}`,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: realIp,
    })

    return NextResponse.json({
      ok: true,
      blocked: false,
      teacherId: body.teacherId,
      action: body.action,
      verifiedIp: effectiveIp,
      wifiNetwork: wifiConfig.ssidLabel,
      timeLabel,
      dateLabel: todayLabel,
      isLate,
      hoursWorked,
      biometricVerified: !!body.biometricVerified,
      record: savedRecord,
      version: nextVersion,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Check-in verification failed' },
      { status: 500 },
    )
  }
}
