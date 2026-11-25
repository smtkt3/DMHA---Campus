import { NextResponse } from 'next/server'
import { dispatchCampusAlert } from '@/lib/dmhs-messaging'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher'])
    if (!auth.ok) return auth.response
    const { session } = auth

    const body = (await request.json()) as {
      channel?: 'WhatsApp' | 'SMS'
      to?: string
      message?: string
    }

    const result = await dispatchCampusAlert({
      channel: body.channel || 'WhatsApp',
      to: body.to || '',
      message: body.message || '',
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: getClientIpFromRequest(request),
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || 'Alert dispatch failed.' },
        { status: result.provider === 'Validation' ? 400 : 502 },
      )
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Alert dispatch error' },
      { status: 500 },
    )
  }
}
