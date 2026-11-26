import { DurableObject } from 'cloudflare:workers'
// @ts-expect-error generated at build time by @opennextjs/cloudflare
import openNextWorker from '../.open-next/worker.js'

interface CfEnv extends Record<string, unknown> {
  DMHA_DB: DurableObjectNamespace
  DMHS_ALLOW_DEMO_LOGIN?: string
  DMHS_ALLOW_HTTP_COOKIE?: string
  DMHS_COOKIE_SAMESITE?: string
  NEXT_PUBLIC_SITE_URL?: string
}

function mirrorEnvToProcess(env: CfEnv) {
  if (typeof process === 'undefined' || !process.env) return
  for (const key of [
    'DMHS_ALLOW_DEMO_LOGIN',
    'DMHS_ALLOW_HTTP_COOKIE',
    'DMHS_COOKIE_SAMESITE',
    'NEXT_PUBLIC_SITE_URL',
    'DMHS_WEBHOOK_SECRET',
    'DMHS_PICKUP_SECRET',
  ]) {
    const val = env[key]
    if (typeof val === 'string' && val.length > 0) {
      process.env[key] = val
    }
  }
}

export class DmhaCampusDO extends DurableObject<CfEnv> {
  async fetch(request: Request): Promise<Response> {
    ;(globalThis as Record<string, unknown>).__dmhsCloudflareSql = this.ctx.storage.sql
    mirrorEnvToProcess(this.env)

    const doCtx = {
      waitUntil: (promise: Promise<unknown>) => this.ctx.waitUntil(promise),
      passThroughOnException: () => {},
      props: {},
    } as unknown as ExecutionContext

    return openNextWorker.fetch(request, this.env, doCtx)
  }
}

export default {
  async fetch(request: Request, env: CfEnv, ctx: ExecutionContext): Promise<Response> {
    mirrorEnvToProcess(env)
    const url = new URL(request.url)

    // Route all DMHA backend API calls through the single persistent SQLite Durable Object
    if (url.pathname.startsWith('/dmhs-api/')) {
      const id = env.DMHA_DB.idFromName('dmha-campus-main')
      const stub = env.DMHA_DB.get(id)
      return stub.fetch(request)
    }

    return openNextWorker.fetch(request, env, ctx)
  },
}
