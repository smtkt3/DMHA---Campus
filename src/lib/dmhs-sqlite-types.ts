export interface DmhsSqlStatement {
  get: (...params: unknown[]) => unknown
  all: (...params: unknown[]) => unknown[]
  run: (...params: unknown[]) => { changes?: number | bigint; lastInsertRowid?: number | bigint }
}

export interface DmhsSqlDb {
  exec: (sql: string) => void
  prepare: (sql: string) => DmhsSqlStatement
  isCloudflare?: boolean
  getDatabaseSizeBytes?: () => number
}
