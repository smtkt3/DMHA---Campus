import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { DmhsSqlDb } from './dmhs-sqlite-types'

export type { DmhsSqlDb, DmhsSqlStatement } from './dmhs-sqlite-types'

export const DB_DIR = process.env.DMHS_DATA_DIR
  ? path.resolve(/*turbopackIgnore: true*/ process.env.DMHS_DATA_DIR)
  : path.join(/*turbopackIgnore: true*/ process.cwd(), 'data')

export const DB_PATH = path.join(/*turbopackIgnore: true*/ DB_DIR, 'dmhs.sqlite')

export function isCloudflareSqlRuntime(): boolean {
  return false
}

export function openDmhsSqlDb(): DmhsSqlDb {
  if (!fs.existsSync(/*turbopackIgnore: true*/ DB_DIR)) {
    fs.mkdirSync(/*turbopackIgnore: true*/ DB_DIR, { recursive: true })
  }
  const raw = new DatabaseSync(DB_PATH)
  const wrapped: DmhsSqlDb = {
    exec: (sql: string) => raw.exec(sql),
    prepare: (sql: string) => {
      const stmt = raw.prepare(sql)
      return {
        get: (...params: unknown[]) => stmt.get(...(params as never[])),
        all: (...params: unknown[]) => stmt.all(...(params as never[])),
        run: (...params: unknown[]) => stmt.run(...(params as never[])),
      }
    },
    isCloudflare: false,
    getDatabaseSizeBytes: () => {
      try {
        return fs.statSync(/*turbopackIgnore: true*/ DB_PATH).size
      } catch {
        return 0
      }
    },
  }
  return wrapped
}
