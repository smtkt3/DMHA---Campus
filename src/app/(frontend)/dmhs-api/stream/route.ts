import { registerSseClient, unregisterSseClient } from '@/lib/dmhs-realtime'
import { requireAuthSession } from '@/lib/dmhs-security'
import { isCloudflareSqlRuntime } from '@/lib/dmhs-sqlite-driver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireAuthSession()
  if (!auth.ok) return auth.response
  const { session } = auth

  const url = new URL(request.url)
  const clientId =
    url.searchParams.get('clientId') || `cli-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const role = session.role

  const encoder = new TextEncoder()

  // On Cloudflare Durable Objects free tier, return a short clean SSE handshake
  // with a gentle retry hint so long-lived idle sockets don't burn DO GB-seconds.
  if (isCloudflareSqlRuntime()) {
    const body =
      `retry: 20000\n` +
      `data: ${JSON.stringify({
        type: 'connected',
        sourceClientId: clientId,
        connectedCount: 1,
        mode: 'cloudflare-edge',
      })}\n\n`
    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    })
  }

  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const count = registerSseClient({ id: clientId, role, controller })
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'connected',
              sourceClientId: clientId,
              connectedCount: count,
            })}\n\n`,
          ),
        )
      } catch {
        // ignore initial enqueue errors
      }

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          if (heartbeat) clearInterval(heartbeat)
          unregisterSseClient(clientId)
        }
      }, 20000)

      request.signal.addEventListener('abort', () => {
        if (heartbeat) clearInterval(heartbeat)
        unregisterSseClient(clientId)
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      unregisterSseClient(clientId)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
