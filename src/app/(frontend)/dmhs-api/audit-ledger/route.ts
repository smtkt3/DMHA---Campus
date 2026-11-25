import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  createScheduledSnapshotFile,
  getDbStats,
  listPaymentTransactions,
  listSecurityAuditLogs,
  listSnapshotFiles,
  restoreFromBackupPayload,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireAuthSession(['admin', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth
    if (
      session.role === 'staff' &&
      !staffHasServerPermission(session.linked_entity_id, 'payment_ledger')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Your staff role does not have Payment Ledger permission.' },
        { status: 403 },
      )
    }

    const payments = listPaymentTransactions(150)
    const securityLogs = session.role === 'admin' ? listSecurityAuditLogs(200) : []
    const snapshots = session.role === 'admin' ? listSnapshotFiles() : []
    const stats = session.role === 'admin' ? getDbStats() : undefined

    return NextResponse.json({
      ok: true,
      payments,
      securityLogs,
      snapshots,
      ...(stats ? { stats } : {}),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to load audit ledger' },
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
      action?: 'snapshot' | 'restore'
      backup?: Record<string, unknown>
    }

    if (body.action === 'snapshot') {
      const created = createScheduledSnapshotFile(session.display_name)
      if (!created.ok) {
        return NextResponse.json({ ok: false, error: created.error }, { status: 500 })
      }
      appendSecurityAudit({
        action: 'disk_snapshot_created',
        target: created.snapshot?.filename || 'snapshot.json',
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      return NextResponse.json({
        ok: true,
        snapshot: created.snapshot,
        snapshots: listSnapshotFiles(),
        securityLogs: listSecurityAuditLogs(200),
      })
    }

    if (body.action === 'restore') {
      if (!body.backup || typeof body.backup !== 'object') {
        return NextResponse.json(
          { ok: false, error: 'Missing backup JSON object.' },
          { status: 400 },
        )
      }
      // Always capture an automatic pre-restore safety snapshot before overwriting SQLite state
      const safety = createScheduledSnapshotFile(`Auto Pre-Restore (${session.display_name})`)
      const restored = restoreFromBackupPayload(body.backup, session.display_name)
      if (!restored.ok) {
        return NextResponse.json({ ok: false, error: restored.error }, { status: 400 })
      }
      appendSecurityAudit({
        action: 'backup_restored',
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
        securityLogs: listSecurityAuditLogs(200),
      })
    }

    return NextResponse.json({ ok: false, error: 'Invalid audit-ledger action.' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Audit ledger operation failed' },
      { status: 500 },
    )
  }
}
