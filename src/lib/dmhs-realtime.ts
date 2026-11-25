export interface DmhsSseClient {
  id: string
  role: string
  controller: ReadableStreamDefaultController<Uint8Array>
}

export interface DmhsRealtimeEvent {
  type: 'connected' | 'presence' | 'state_updated'
  version?: number
  updatedAt?: string
  updatedBy?: string
  sourceClientId?: string
  summary?: string
  connectedCount: number
}

declare global {
  // eslint-disable-next-line no-var
  var __dmhsSseClients: Map<string, DmhsSseClient> | undefined
}

const encoder = new TextEncoder()

function getClientMap(): Map<string, DmhsSseClient> {
  if (!globalThis.__dmhsSseClients) {
    globalThis.__dmhsSseClients = new Map()
  }
  return globalThis.__dmhsSseClients
}

export function getConnectedDevicesCount(): number {
  return Math.max(1, getClientMap().size)
}

export function registerSseClient(client: DmhsSseClient): number {
  const map = getClientMap()
  map.set(client.id, client)
  const count = map.size
  broadcastDmhsEvent({
    type: 'presence',
    sourceClientId: client.id,
    connectedCount: count,
  })
  return count
}

export function unregisterSseClient(clientId: string): void {
  const map = getClientMap()
  if (map.delete(clientId)) {
    broadcastDmhsEvent({
      type: 'presence',
      sourceClientId: clientId,
      connectedCount: Math.max(1, map.size),
    })
  }
}

export function broadcastDmhsEvent(event: Omit<DmhsRealtimeEvent, 'connectedCount'> & { connectedCount?: number }): void {
  const map = getClientMap()
  const payload: DmhsRealtimeEvent = {
    ...event,
    connectedCount: event.connectedCount ?? Math.max(1, map.size),
  }
  const frame = encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
  const deadIds: string[] = []

  for (const [id, client] of map.entries()) {
    try {
      client.controller.enqueue(frame)
    } catch {
      deadIds.push(id)
    }
  }

  for (const deadId of deadIds) {
    map.delete(deadId)
  }
}
