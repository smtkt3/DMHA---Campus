import type { DmhsSqlDb } from './dmhs-sqlite-types'

export type { DmhsSqlDb, DmhsSqlStatement } from './dmhs-sqlite-types'

interface CloudflareSqlCursor {
  toArray: () => unknown[]
  rowsWritten?: number
}

export interface CloudflareSqlStorage {
  exec: (query: string, ...bindings: unknown[]) => CloudflareSqlCursor
  databaseSize?: number
}

declare global {
  // eslint-disable-next-line no-var
  var __dmhsCloudflareSql: CloudflareSqlStorage | undefined
}

export const DB_DIR = '/cloudflare-do'
export const DB_PATH = 'cloudflare://DMHA_DB/dmha-campus-main'

export function isCloudflareSqlRuntime(): boolean {
  return true
}

function getActiveSql(): CloudflareSqlStorage {
  const sql = globalThis.__dmhsCloudflareSql
  if (!sql) {
    throw new Error(
      'Cloudflare Durable Object SQLite storage is unavailable on this route. Ensure /dmhs-api/* is routed through DmhaCampusDO.',
    )
  }
  return sql
}

function sanitizeBindings(params: unknown[]): unknown[] {
  return params.map((p) => {
    if (p === undefined) return null
    if (typeof p === 'boolean') return p ? 1 : 0
    return p
  })
}

export function openDmhsSqlDb(): DmhsSqlDb {
  return {
    isCloudflare: true,
    exec: (sql: string) => {
      const cleaned = sql
        .split(/\r?\n/)
        .filter((line) => !/^\s*PRAGMA\b/i.test(line))
        .join('\n')
        .trim()
      if (!cleaned) return
      getActiveSql().exec(cleaned)
    },
    prepare: (sql: string) => ({
      get: (...params: unknown[]) => {
        const rows = getActiveSql().exec(sql, ...sanitizeBindings(params)).toArray()
        return rows.length > 0 ? rows[0] : undefined
      },
      all: (...params: unknown[]) => {
        return getActiveSql().exec(sql, ...sanitizeBindings(params)).toArray()
      },
      run: (...params: unknown[]) => {
        const cursor = getActiveSql().exec(sql, ...sanitizeBindings(params))
        return { changes: cursor.rowsWritten ?? 0 }
      },
    }),
    getDatabaseSizeBytes: () => {
      try {
        return Number(getActiveSql().databaseSize || 0)
      } catch {
        return 0
      }
    },
  }
}
