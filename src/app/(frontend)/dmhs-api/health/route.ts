import { NextResponse } from 'next/server'
import { getDmhsDb } from '@/lib/dmhs-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDmhsDb()
    db.prepare('SELECT 1 AS ok').get()
    return NextResponse.json({
      ok: true,
      status: 'healthy',
      service: 'dmha-smart-learning-app',
      runtime: db.isCloudflare ? 'cloudflare-workers-do' : 'nodejs',
      node: process.version,
      db: db.isCloudflare ? 'cloudflare-do-sqlite' : 'sqlite-wal',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        status: 'degraded',
        error: err instanceof Error ? err.message : 'Database healthcheck failed',
      },
      { status: 503 },
    )
  }
}
