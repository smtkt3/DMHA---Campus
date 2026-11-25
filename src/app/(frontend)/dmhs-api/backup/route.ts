import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  createScheduledSnapshotFile,
  getDbStats,
  listAuthAccounts,
  listBiometricCredentials,
  listSnapshotFiles,
  loadPersistedState,
  restoreFromBackupPayload,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireAuthSession(['admin'])
    if (!auth.ok) return auth.response
    const { session } = auth

    const state = loadPersistedState()
    const accounts = listAuthAccounts()
    const biometrics = listBiometricCredentials()
    const stats = getDbStats()

    appendSecurityAudit({
      action: 'sqlite_backup_exported',
      target: 'DMHA-SQLite-Backup.json',
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: getClientIpFromRequest(request),
    })

    const backupPayload = {
      app: 'DMHA Smart Learning App',
      exportedAt: new Date().toISOString(),
      schemaVersion: 3,
      stats,
      authAccounts: accounts,
      biometricDevices: biometrics,
      schoolState: state.data,
    }

    const filename = `DMHA-SQLite-Backup-${new Date().toISOString().slice(0, 10)}.json`
    return new NextResponse(JSON.stringify(backupPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Backup export failed' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as {
      backup?: Record<string, unknown>
      schoolState?: Record<string, unknown>
      data?: Record<string, unknown>
    }
    const payload =
      body?.backup && typeof body.backup === 'object'
        ? body.backup
        : body && typeof body === 'object'
          ? (body as Record<string, unknown>)
          : null

    if (!payload) {
      return NextResponse.json(
        { ok: false, error: 'Missing valid DMHA backup JSON payload.' },
        { status: 400 },
      )
    }

    const stateObj = (payload.schoolState || payload.data) as { students?: unknown[] } | undefined
    if (!stateObj || !Array.isArray(stateObj.students)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid backup format: expected a DMHA JSON snapshot with schoolState.students.',
        },
        { status: 400 },
      )
    }

    // Automatically write a pre-restore safety snapshot to disk before mutating live SQLite state
    const safety = createScheduledSnapshotFile(`Auto Pre-Restore (${session.display_name})`)

    const restored = restoreFromBackupPayload(payload, session.display_name)
    if (!restored.ok) {
      return NextResponse.json({ ok: false, error: restored.error }, { status: 400 })
    }

    appendSecurityAudit({
      action: 'sqlite_backup_restored',
      target: `v${restored.version} (${restored.studentsRestored} students)${
        safety.snapshot?.filename ? ` · Safety: ${safety.snapshot.filename}` : ''
      }`,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: ip,
    })

    broadcastDmhsEvent({
      type: 'state_updated',
      version: restored.version || Date.now(),
      updatedAt: new Date().toISOString(),
      updatedBy: `${session.display_name} (Backup Restore)`,
      summary: 'Campus database restored from backup snapshot',
    })

    return NextResponse.json({
      ok: true,
      version: restored.version,
      studentsRestored: restored.studentsRestored,
      safetySnapshot: safety.snapshot?.filename || null,
      snapshots: listSnapshotFiles(),
      stats: getDbStats(),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Backup restore failed' },
      { status: 500 },
    )
  }
}
