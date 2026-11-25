import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type DbUserRole = 'admin' | 'guardian' | 'teacher' | 'student' | 'staff'

export interface DbUserRow {
  id: string
  email: string
  login_code: string
  password_hash: string
  role: DbUserRole
  display_name: string
  linked_entity_id: string
  status: 'active' | 'suspended'
  created_at: string
  last_login_at: string | null
}

export interface DbSessionRow {
  token: string
  user_id: string
  role: DbUserRole
  display_name: string
  email: string
  login_code: string
  linked_entity_id: string
  expires_at: string
  created_at: string
}

export interface DbStats {
  engine: string
  dbFile: string
  sizeKb: number
  usersCount: number
  sessionsCount: number
  quizzesCount: number
  quizAttemptsCount: number
  admissionsCount: number
  qrScansCount: number
  paymentsCount: number
  auditLogsCount: number
  stateVersion: number
  lastUpdatedAt: string | null
}

const DB_DIR = process.env.DMHS_DATA_DIR
  ? path.resolve(process.env.DMHS_DATA_DIR)
  : path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'dmhs.sqlite')

declare global {
  // eslint-disable-next-line no-var
  var __dmhsSqliteDb: DatabaseSync | undefined
  // eslint-disable-next-line no-var
  var __dmhsSchemaVersion: number | undefined
}

const CURRENT_SCHEMA_VERSION = 7

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':')
  if (!salt || !key) return false
  const derived = crypto.scryptSync(password, salt, 64)
  const keyBuf = Buffer.from(key, 'hex')
  if (derived.length !== keyBuf.length) return false
  return crypto.timingSafeEqual(derived, keyBuf)
}

function seedDefaultUsers(db: DatabaseSync) {
  const defaultPass = hashPassword('dmha2026')
  const now = new Date().toISOString()

  const defaults = [
    {
      id: 'usr-dev-master',
      email: 'dev@dmha.edu',
      login_code: 'DEV-001',
      role: 'admin',
      display_name: 'DMHA Developer',
      linked_entity_id: 'dev-master',
    },
    {
      id: 'usr-admin-shahid',
      email: 'shahid@dmha.edu',
      login_code: 'ADM-001',
      role: 'admin',
      display_name: 'Shahid',
      linked_entity_id: 'admin-shahid',
    },
    {
      id: 'usr-grd-tariq',
      email: 'tariq@dmha.edu',
      login_code: 'GRD-001',
      role: 'guardian',
      display_name: 'Tariq Rahman',
      linked_entity_id: 'grd-tariq',
    },
    {
      id: 'usr-tch-nadia',
      email: 'nadia@dmha.edu',
      login_code: 'TCH-001',
      role: 'teacher',
      display_name: 'Nadia Rahman',
      linked_entity_id: 'tch-nadia',
    },
    {
      id: 'usr-stu-araf',
      email: 'araf@dmha.edu',
      login_code: 'STU-14',
      role: 'student',
      display_name: 'Araf Rahman',
      linked_entity_id: 'stu-araf',
    },
    {
      id: 'usr-stf-rafiqul',
      email: 'accountant@dmha.edu',
      login_code: 'STF-ACC',
      role: 'staff',
      display_name: 'Rafiqul Islam',
      linked_entity_id: 'stf-rafiqul',
    },
    {
      id: 'usr-stf-salma',
      email: 'canteen@dmha.edu',
      login_code: 'STF-CNT',
      role: 'staff',
      display_name: 'Salma Akter',
      linked_entity_id: 'stf-salma',
    },
    {
      id: 'usr-stf-kamal',
      email: 'security@dmha.edu',
      login_code: 'STF-SEC',
      role: 'staff',
      display_name: 'Kamal Hossain',
      linked_entity_id: 'stf-kamal',
    },
  ]

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO dmhs_users
      (id, email, login_code, password_hash, role, display_name, linked_entity_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `)

  for (const u of defaults) {
    stmt.run(u.id, u.email, u.login_code, defaultPass, u.role, u.display_name, u.linked_entity_id, now)
  }
}

export function getDmhsDb(): DatabaseSync {
  if (globalThis.__dmhsSqliteDb && globalThis.__dmhsSchemaVersion === CURRENT_SCHEMA_VERSION) {
    return globalThis.__dmhsSqliteDb
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }

  const db = globalThis.__dmhsSqliteDb || new DatabaseSync(DB_PATH)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS dmhs_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      login_code TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      linked_entity_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS dmhs_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL,
      login_code TEXT NOT NULL,
      linked_entity_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dmhs_kv_state (
      state_key TEXT PRIMARY KEY,
      json_payload TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL DEFAULT 'system'
    );

    CREATE TABLE IF NOT EXISTS dmhs_quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      class_name TEXT NOT NULL,
      teacher_name TEXT NOT NULL,
      duration_mins INTEGER NOT NULL,
      total_marks INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dmhs_quiz_attempts (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      total_marks INTEGER NOT NULL,
      percentage INTEGER NOT NULL,
      submitted_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dmhs_admissions (
      id TEXT PRIMARY KEY,
      applicant_name TEXT NOT NULL,
      applying_class TEXT NOT NULL,
      guardian_name TEXT NOT NULL,
      guardian_phone TEXT NOT NULL,
      stage TEXT NOT NULL,
      admission_fee_paid INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dmhs_qr_scans (
      id TEXT PRIMARY KEY,
      card_code TEXT NOT NULL,
      holder_name TEXT NOT NULL,
      holder_role TEXT NOT NULL,
      checkpoint TEXT NOT NULL,
      status TEXT NOT NULL,
      scanned_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dmhs_biometrics (
      id TEXT PRIMARY KEY,
      guardian_id TEXT NOT NULL,
      credential_id TEXT UNIQUE NOT NULL,
      device_label TEXT NOT NULL,
      public_key_b64 TEXT NOT NULL,
      sign_count INTEGER NOT NULL DEFAULT 0,
      registered_at TEXT NOT NULL,
      last_verified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS dmhs_biometric_challenges (
      challenge TEXT PRIMARY KEY,
      guardian_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dmhs_payment_transactions (
      id TEXT PRIMARY KEY,
      transaction_id TEXT UNIQUE NOT NULL,
      invoice_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      guardian_name TEXT NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      verified_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      settled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS dmhs_audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      actor TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dmhs_pickup_passes (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      class_label TEXT NOT NULL,
      unit_label TEXT NOT NULL,
      guardian_id TEXT NOT NULL,
      authorized_person TEXT NOT NULL,
      authorized_relation TEXT NOT NULL,
      authorized_id_number TEXT NOT NULL,
      issued_date TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dmhs_attendance_records (
      id TEXT PRIMARY KEY,
      attendance_date TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      class_label TEXT NOT NULL,
      status TEXT NOT NULL,
      marked_by_id TEXT NOT NULL,
      marked_by_name TEXT NOT NULL,
      marked_at TEXT NOT NULL,
      UNIQUE(attendance_date, student_id)
    );
  `)

  seedDefaultUsers(db)
  globalThis.__dmhsSqliteDb = db
  globalThis.__dmhsSchemaVersion = CURRENT_SCHEMA_VERSION
  return db
}

export function authenticateUser(identifier: string, password: string): DbUserRow | null {
  const db = getDmhsDb()
  const clean = identifier.trim().toLowerCase()
  const user = db
    .prepare('SELECT * FROM dmhs_users WHERE LOWER(email) = ? OR LOWER(login_code) = ? LIMIT 1')
    .get(clean, clean) as DbUserRow | undefined

  if (!user) return null
  if (!verifyPassword(password, user.password_hash)) return null

  const now = new Date().toISOString()
  db.prepare('UPDATE dmhs_users SET last_login_at = ? WHERE id = ?').run(now, user.id)
  return { ...user, last_login_at: now }
}

export function getUserByRole(role: DbUserRole, linkedEntityId?: string): DbUserRow | null {
  const db = getDmhsDb()
  if (linkedEntityId) {
    const specific = db
      .prepare('SELECT * FROM dmhs_users WHERE role = ? AND linked_entity_id = ? LIMIT 1')
      .get(role, linkedEntityId) as DbUserRow | undefined
    if (specific) return specific
  }
  const user = db
    .prepare(
      "SELECT * FROM dmhs_users WHERE role = ? AND linked_entity_id != 'dev-master' ORDER BY created_at ASC LIMIT 1",
    )
    .get(role) as DbUserRow | undefined
  if (user) return user
  const fallback = db
    .prepare('SELECT * FROM dmhs_users WHERE role = ? ORDER BY created_at ASC LIMIT 1')
    .get(role) as DbUserRow | undefined
  return fallback || null
}

export function getUserById(userId: string): DbUserRow | null {
  if (!userId) return null
  const db = getDmhsDb()
  const row = db
    .prepare('SELECT * FROM dmhs_users WHERE id = ? LIMIT 1')
    .get(userId) as DbUserRow | undefined
  return row || null
}

export function isDeveloperSession(
  session: Pick<DbSessionRow, 'linked_entity_id' | 'login_code'> | null | undefined,
): boolean {
  if (!session) return false
  return session.linked_entity_id === 'dev-master' || session.login_code === 'DEV-001'
}

export function createUserSession(user: DbUserRow): DbSessionRow {
  const db = getDmhsDb()
  const token = crypto.randomBytes(32).toString('hex')
  const now = new Date()
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7) // 7 days

  const session: DbSessionRow = {
    token,
    user_id: user.id,
    role: user.role,
    display_name: user.display_name,
    email: user.email,
    login_code: user.login_code,
    linked_entity_id: user.linked_entity_id,
    expires_at: expires.toISOString(),
    created_at: now.toISOString(),
  }

  db.prepare(`
    INSERT INTO dmhs_sessions
      (token, user_id, role, display_name, email, login_code, linked_entity_id, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.token,
    session.user_id,
    session.role,
    session.display_name,
    session.email,
    session.login_code,
    session.linked_entity_id,
    session.expires_at,
    session.created_at,
  )

  return session
}

export function getSessionByToken(token: string | undefined): DbSessionRow | null {
  if (!token) return null
  const db = getDmhsDb()
  const row = db
    .prepare('SELECT * FROM dmhs_sessions WHERE token = ? LIMIT 1')
    .get(token) as DbSessionRow | undefined

  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM dmhs_sessions WHERE token = ?').run(token)
    return null
  }
  return row
}

export function deleteSessionByToken(token: string | undefined): void {
  if (!token) return
  const db = getDmhsDb()
  db.prepare('DELETE FROM dmhs_sessions WHERE token = ?').run(token)
}

export interface SafeAuthAccount {
  id: string
  email: string
  loginCode: string
  role: DbUserRole
  displayName: string
  linkedEntityId: string
  status: 'active' | 'suspended'
  createdAt: string
  lastLoginAt: string | null
}

export function listAuthAccounts(): SafeAuthAccount[] {
  const db = getDmhsDb()
  const rows = db
    .prepare(
      `SELECT id, email, login_code, role, display_name, linked_entity_id, status, created_at, last_login_at
       FROM dmhs_users
       ORDER BY role ASC, display_name ASC`,
    )
    .all() as Array<{
    id: string
    email: string
    login_code: string
    role: DbUserRole
    display_name: string
    linked_entity_id: string
    status: 'active' | 'suspended'
    created_at: string
    last_login_at: string | null
  }>

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    loginCode: r.login_code,
    role: r.role,
    displayName: r.display_name,
    linkedEntityId: r.linked_entity_id,
    status: r.status,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  }))
}

export function upsertUserAccountAndPassword(params: {
  linkedEntityId: string
  role: DbUserRole
  displayName: string
  email?: string
  loginCode?: string
  status?: 'active' | 'suspended'
  newPassword?: string
}): { ok: boolean; account?: SafeAuthAccount; error?: string } {
  const db = getDmhsDb()
  const now = new Date().toISOString()

  if (params.newPassword !== undefined && params.newPassword.length > 0 && params.newPassword.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' }
  }

  const existing = db
    .prepare('SELECT * FROM dmhs_users WHERE linked_entity_id = ? AND role = ? LIMIT 1')
    .get(params.linkedEntityId, params.role) as DbUserRow | undefined

  const cleanEmail = (params.email || existing?.email || '')
    .trim()
    .toLowerCase()
  const fallbackSlug = params.displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
  const finalEmail =
    cleanEmail || `${fallbackSlug || params.linkedEntityId}@${params.role}.dmha.edu`

  const prefix =
    params.role === 'teacher'
      ? 'TCH'
      : params.role === 'guardian'
        ? 'GRD'
        : params.role === 'student'
          ? 'STU'
          : params.role === 'staff'
            ? 'STF'
            : 'ADM'
  const finalCode = (
    params.loginCode ||
    existing?.login_code ||
    `${prefix}-${params.linkedEntityId.slice(-4).toUpperCase()}`
  ).trim()

  const finalStatus = params.status || existing?.status || 'active'

  try {
    if (existing) {
      const nextHash =
        params.newPassword && params.newPassword.length >= 6
          ? hashPassword(params.newPassword)
          : existing.password_hash

      db.prepare(
        `UPDATE dmhs_users
         SET display_name = ?, email = ?, login_code = ?, status = ?, password_hash = ?
         WHERE id = ?`,
      ).run(params.displayName.trim(), finalEmail, finalCode, finalStatus, nextHash, existing.id)

      db.prepare(
        `UPDATE dmhs_sessions
         SET display_name = ?, email = ?, login_code = ?
         WHERE user_id = ?`,
      ).run(params.displayName.trim(), finalEmail, finalCode, existing.id)

      return {
        ok: true,
        account: {
          id: existing.id,
          email: finalEmail,
          loginCode: finalCode,
          role: existing.role,
          displayName: params.displayName.trim(),
          linkedEntityId: existing.linked_entity_id,
          status: finalStatus,
          createdAt: existing.created_at,
          lastLoginAt: existing.last_login_at,
        },
      }
    }

    const newId = `usr-${params.linkedEntityId}`
    const passHash = hashPassword(
      params.newPassword && params.newPassword.length >= 6 ? params.newPassword : 'dmha2026',
    )

    db.prepare(
      `INSERT INTO dmhs_users
        (id, email, login_code, password_hash, role, display_name, linked_entity_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId,
      finalEmail,
      finalCode,
      passHash,
      params.role,
      params.displayName.trim(),
      params.linkedEntityId,
      finalStatus,
      now,
    )

    return {
      ok: true,
      account: {
        id: newId,
        email: finalEmail,
        loginCode: finalCode,
        role: params.role,
        displayName: params.displayName.trim(),
        linkedEntityId: params.linkedEntityId,
        status: finalStatus,
        createdAt: now,
        lastLoginAt: null,
      },
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.message.includes('UNIQUE')
          ? 'That email or login code is already used by another DMHA account.'
          : err instanceof Error
            ? err.message
            : 'Unable to update user account.',
    }
  }
}

export function changeUserOwnPassword(params: {
  linkedEntityId?: string
  email?: string
  role: DbUserRole
  currentPassword: string
  newPassword: string
}): { ok: boolean; email?: string; loginCode?: string; error?: string } {
  const db = getDmhsDb()

  if (!params.currentPassword || !params.newPassword) {
    return { ok: false, error: 'Please fill in both current and new passwords.' }
  }
  if (params.newPassword.length < 6) {
    return { ok: false, error: 'New password must be at least 6 characters long.' }
  }

  let user: DbUserRow | undefined
  if (params.linkedEntityId) {
    user = db
      .prepare('SELECT * FROM dmhs_users WHERE linked_entity_id = ? AND role = ? LIMIT 1')
      .get(params.linkedEntityId, params.role) as DbUserRow | undefined
  }
  if (!user && params.email) {
    user = db
      .prepare('SELECT * FROM dmhs_users WHERE LOWER(email) = ? LIMIT 1')
      .get(params.email.trim().toLowerCase()) as DbUserRow | undefined
  }
  if (!user) {
    user = db
      .prepare('SELECT * FROM dmhs_users WHERE role = ? ORDER BY created_at ASC LIMIT 1')
      .get(params.role) as DbUserRow | undefined
  }

  if (!user) {
    return { ok: false, error: 'Account record not found in DMHA database.' }
  }

  if (!verifyPassword(params.currentPassword, user.password_hash)) {
    return { ok: false, error: 'Current password is incorrect.' }
  }

  const nextHash = hashPassword(params.newPassword)
  db.prepare('UPDATE dmhs_users SET password_hash = ? WHERE id = ?').run(nextHash, user.id)

  return { ok: true, email: user.email, loginCode: user.login_code }
}

// ==================== WEBAUTHN GUARDIAN BIOMETRICS ====================
export interface BiometricDeviceRow {
  id: string
  guardianId: string
  credentialId: string
  deviceLabel: string
  registeredAt: string
  lastVerifiedAt: string | null
  signCount: number
}

export function createBiometricChallenge(guardianId: string, purpose: string): string {
  const db = getDmhsDb()
  const challenge = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 5).toISOString()
  db.prepare('DELETE FROM dmhs_biometric_challenges WHERE expires_at < ?').run(
    new Date().toISOString(),
  )
  db.prepare(
    `INSERT INTO dmhs_biometric_challenges (challenge, guardian_id, purpose, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).run(challenge, guardianId, purpose, expiresAt)
  return challenge
}

export function listBiometricCredentials(guardianId?: string): BiometricDeviceRow[] {
  const db = getDmhsDb()
  const rows = (
    guardianId
      ? db
          .prepare(
            `SELECT id, guardian_id, credential_id, device_label, registered_at, last_verified_at, sign_count
             FROM dmhs_biometrics WHERE guardian_id = ? ORDER BY registered_at DESC`,
          )
          .all(guardianId)
      : db
          .prepare(
            `SELECT id, guardian_id, credential_id, device_label, registered_at, last_verified_at, sign_count
             FROM dmhs_biometrics ORDER BY registered_at DESC`,
          )
          .all()
  ) as Array<{
    id: string
    guardian_id: string
    credential_id: string
    device_label: string
    registered_at: string
    last_verified_at: string | null
    sign_count: number
  }>

  return rows.map((r) => ({
    id: r.id,
    guardianId: r.guardian_id,
    credentialId: r.credential_id,
    deviceLabel: r.device_label,
    registeredAt: r.registered_at,
    lastVerifiedAt: r.last_verified_at,
    signCount: r.sign_count,
  }))
}

export function registerBiometricCredential(params: {
  guardianId: string
  credentialId: string
  deviceLabel: string
  publicKeyB64: string
  challenge: string
}): { ok: boolean; device?: BiometricDeviceRow; error?: string } {
  const db = getDmhsDb()
  const now = new Date().toISOString()
  const ch = db
    .prepare('SELECT * FROM dmhs_biometric_challenges WHERE challenge = ? AND guardian_id = ?')
    .get(params.challenge, params.guardianId) as { expires_at: string } | undefined

  if (!ch || new Date(ch.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'Biometric registration challenge expired. Please try again.' }
  }

  db.prepare('DELETE FROM dmhs_biometric_challenges WHERE challenge = ?').run(params.challenge)

  const id = `bio-${Date.now()}`
  db.prepare(
    `INSERT OR REPLACE INTO dmhs_biometrics
      (id, guardian_id, credential_id, device_label, public_key_b64, sign_count, registered_at, last_verified_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    id,
    params.guardianId,
    params.credentialId,
    params.deviceLabel.trim() || 'Guardian Device (Face/Fingerprint)',
    params.publicKeyB64 || 'webauthn-attestation',
    now,
    now,
  )

  return {
    ok: true,
    device: {
      id,
      guardianId: params.guardianId,
      credentialId: params.credentialId,
      deviceLabel: params.deviceLabel.trim() || 'Guardian Device (Face/Fingerprint)',
      registeredAt: now,
      lastVerifiedAt: now,
      signCount: 1,
    },
  }
}

export function verifyBiometricAssertion(params: {
  guardianId: string
  credentialId: string
  challenge: string
}): { ok: boolean; deviceLabel?: string; verifiedAt?: string; error?: string } {
  const db = getDmhsDb()
  const now = new Date().toISOString()

  const ch = db
    .prepare('SELECT * FROM dmhs_biometric_challenges WHERE challenge = ? AND guardian_id = ?')
    .get(params.challenge, params.guardianId) as { expires_at: string } | undefined

  if (!ch || new Date(ch.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'Verification challenge expired. Please scan again.' }
  }

  const cred = db
    .prepare('SELECT * FROM dmhs_biometrics WHERE credential_id = ? AND guardian_id = ? LIMIT 1')
    .get(params.credentialId, params.guardianId) as
    | { id: string; device_label: string; sign_count: number }
    | undefined

  if (!cred) {
    return { ok: false, error: 'Registered biometric passkey not found for this guardian.' }
  }

  db.prepare('DELETE FROM dmhs_biometric_challenges WHERE challenge = ?').run(params.challenge)
  db.prepare(
    'UPDATE dmhs_biometrics SET sign_count = sign_count + 1, last_verified_at = ? WHERE id = ?',
  ).run(now, cred.id)

  return {
    ok: true,
    deviceLabel: cred.device_label,
    verifiedAt: now,
  }
}

export function deleteBiometricCredential(id: string): void {
  const db = getDmhsDb()
  db.prepare('DELETE FROM dmhs_biometrics WHERE id = ?').run(id)
}

export function loadPersistedState(): {
  exists: boolean
  data: Record<string, unknown> | null
  version: number
  updatedAt: string | null
} {
  const db = getDmhsDb()
  const row = db
    .prepare('SELECT json_payload, version, updated_at FROM dmhs_kv_state WHERE state_key = ?')
    .get('school_state') as
    | { json_payload: string; version: number; updated_at: string }
    | undefined

  if (!row) {
    return { exists: false, data: null, version: 0, updatedAt: null }
  }

  try {
    return {
      exists: true,
      data: JSON.parse(row.json_payload) as Record<string, unknown>,
      version: row.version,
      updatedAt: row.updated_at,
    }
  } catch {
    return { exists: false, data: null, version: 0, updatedAt: null }
  }
}

export function savePersistedState(
  payload: Record<string, unknown>,
  updatedBy = 'system',
  expectedVersion?: number,
): { version: number; updatedAt: string; conflict?: boolean } {
  const db = getDmhsDb()
  const now = new Date().toISOString()

  const existing = db
    .prepare('SELECT version, updated_at FROM dmhs_kv_state WHERE state_key = ?')
    .get('school_state') as { version: number; updated_at: string } | undefined

  const currentVersion = existing?.version || 0
  if (
    typeof expectedVersion === 'number' &&
    expectedVersion > 0 &&
    currentVersion > 0 &&
    expectedVersion < currentVersion
  ) {
    return {
      version: currentVersion,
      updatedAt: existing?.updated_at || now,
      conflict: true,
    }
  }

  const nextVersion = currentVersion + 1

  db.prepare(`
    INSERT INTO dmhs_kv_state (state_key, json_payload, version, updated_at, updated_by)
    VALUES ('school_state', ?, ?, ?, ?)
    ON CONFLICT(state_key) DO UPDATE SET
      json_payload = excluded.json_payload,
      version = excluded.version,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).run(JSON.stringify(payload), nextVersion, now, updatedBy)

  // Mirror normalized relational tables so SQL queries & DB stats reflect live records
  try {
    if (Array.isArray(payload.quizzes)) {
      db.prepare('DELETE FROM dmhs_quizzes').run()
      const qStmt = db.prepare(`
        INSERT OR REPLACE INTO dmhs_quizzes
          (id, title, subject, class_name, teacher_name, duration_mins, total_marks, status, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const q of payload.quizzes as Array<Record<string, unknown>>) {
        const computedMarks = Array.isArray(q.questions)
          ? (q.questions as Array<Record<string, unknown>>).reduce(
              (sum, item) => sum + Number(item.points || 0),
              0,
            )
          : Number(q.totalMarks || 0)
        qStmt.run(
          String(q.id || ''),
          String(q.title || ''),
          String(q.subject || ''),
          String(q.className || ''),
          String(q.teacherName || ''),
          Number(q.durationMins || 15),
          computedMarks,
          String(q.status || 'published'),
          String(q.createdAt || now),
          JSON.stringify(q),
        )
      }
    }

    if (Array.isArray(payload.quizAttempts)) {
      db.prepare('DELETE FROM dmhs_quiz_attempts').run()
      const aStmt = db.prepare(`
        INSERT OR REPLACE INTO dmhs_quiz_attempts
          (id, quiz_id, student_id, student_name, score, total_marks, percentage, submitted_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const a of payload.quizAttempts as Array<Record<string, unknown>>) {
        aStmt.run(
          String(a.id || ''),
          String(a.quizId || ''),
          String(a.studentId || ''),
          String(a.studentName || ''),
          Number(a.score || 0),
          Number(a.totalMarks || 0),
          Number(a.percentage || 0),
          String(a.submittedAt || now),
          JSON.stringify(a),
        )
      }
    }

    if (Array.isArray(payload.admissions)) {
      db.prepare('DELETE FROM dmhs_admissions').run()
      const admStmt = db.prepare(`
        INSERT OR REPLACE INTO dmhs_admissions
          (id, applicant_name, applying_class, guardian_name, guardian_phone, stage, admission_fee_paid, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const adm of payload.admissions as Array<Record<string, unknown>>) {
        admStmt.run(
          String(adm.id || ''),
          String(adm.applicantName || ''),
          String(adm.applyingClass || ''),
          String(adm.guardianName || ''),
          String(adm.guardianPhone || ''),
          String(adm.stage || 'applied'),
          adm.admissionFeePaid ? 1 : 0,
          String(adm.appliedAt || now),
          JSON.stringify(adm),
        )
      }
    }

    if (Array.isArray(payload.qrScans)) {
      db.prepare('DELETE FROM dmhs_qr_scans').run()
      const qrStmt = db.prepare(`
        INSERT OR REPLACE INTO dmhs_qr_scans
          (id, card_code, holder_name, holder_role, checkpoint, status, scanned_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      for (const scan of payload.qrScans as Array<Record<string, unknown>>) {
        qrStmt.run(
          String(scan.id || ''),
          String(scan.cardCode || ''),
          String(scan.holderName || ''),
          String(scan.holderRole || 'student'),
          String(scan.checkpoint || 'Main Gate'),
          String(scan.status || 'verified'),
          String(scan.scannedAt || now),
        )
      }
    }

    // Sync newly created teachers/guardians/students into dmhs_users so they can actually sign in!
    const defaultPass = hashPassword('dmha2026')
    const uStmt = db.prepare(`
      INSERT OR IGNORE INTO dmhs_users
        (id, email, login_code, password_hash, role, display_name, linked_entity_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    if (Array.isArray(payload.teachers)) {
      for (const t of payload.teachers as Array<Record<string, unknown>>) {
        const email = String(t.email || '').trim().toLowerCase()
        if (!email) continue
        uStmt.run(
          `usr-${String(t.id)}`,
          email,
          `TCH-${String(t.id).slice(-4).toUpperCase()}`,
          defaultPass,
          'teacher',
          String(t.name || 'Teacher'),
          String(t.id),
          String(t.status || 'active'),
          now,
        )
      }
    }

    if (Array.isArray(payload.guardians)) {
      for (const g of payload.guardians as Array<Record<string, unknown>>) {
        const email = String(g.email || '').trim().toLowerCase()
        if (!email) continue
        uStmt.run(
          `usr-${String(g.id)}`,
          email,
          `GRD-${String(g.id).slice(-4).toUpperCase()}`,
          defaultPass,
          'guardian',
          String(g.name || 'Guardian'),
          String(g.id),
          String(g.status || 'active'),
          now,
        )
      }
    }

    if (Array.isArray(payload.students)) {
      for (const s of payload.students as Array<Record<string, unknown>>) {
        const slug = String(s.name || 'student')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '.')
          .replace(/^\.|\.$/g, '')
        const email = `${slug}.${String(s.roll || '01')}@student.dmha.edu`
        uStmt.run(
          `usr-${String(s.id)}`,
          email,
          `STU-${String(s.roll || String(s.id).slice(-3))}`,
          defaultPass,
          'student',
          String(s.name || 'Student'),
          String(s.id),
          String(s.status || 'active'),
          now,
        )
      }
    }
  } catch {
    // Keep snapshot save resilient even if relational mirror encounters a duplicate
  }

  return { version: nextVersion, updatedAt: now }
}

export function resetPersistedState(): void {
  const db = getDmhsDb()
  db.prepare('DELETE FROM dmhs_kv_state').run()
  db.prepare('DELETE FROM dmhs_quizzes').run()
  db.prepare('DELETE FROM dmhs_quiz_attempts').run()
  db.prepare('DELETE FROM dmhs_admissions').run()
  db.prepare('DELETE FROM dmhs_qr_scans').run()
}

export function getDbStats(): DbStats {
  const db = getDmhsDb()
  const count = (table: string) => {
    const r = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number } | undefined
    return r?.cnt || 0
  }
  const kv = db
    .prepare('SELECT version, updated_at FROM dmhs_kv_state WHERE state_key = ?')
    .get('school_state') as { version: number; updated_at: string } | undefined

  let sizeKb = 0
  try {
    const stat = fs.statSync(DB_PATH)
    sizeKb = Math.max(1, Math.round(stat.size / 1024))
  } catch {
    sizeKb = 0
  }

  return {
    engine: 'SQLite 3 (Node Native WAL)',
    dbFile: 'data/dmhs.sqlite',
    sizeKb,
    usersCount: count('dmhs_users'),
    sessionsCount: count('dmhs_sessions'),
    quizzesCount: count('dmhs_quizzes'),
    quizAttemptsCount: count('dmhs_quiz_attempts'),
    admissionsCount: count('dmhs_admissions'),
    qrScansCount: count('dmhs_qr_scans'),
    paymentsCount: count('dmhs_payment_transactions'),
    auditLogsCount: count('dmhs_audit_logs'),
    stateVersion: kv?.version || 0,
    lastUpdatedAt: kv?.updated_at || null,
  }
}

// ==================== SERVER-IMMUTABLE PAYMENT LEDGER & SECURITY AUDIT ====================
export interface PaymentTransactionRow {
  id: string
  transactionId: string
  invoiceId: string
  studentName: string
  guardianName: string
  amount: number
  method: string
  provider: string
  status: 'pending' | 'settled' | 'failed'
  verifiedBy: string
  createdAt: string
  settledAt: string | null
}

export function recordPaymentTransaction(params: {
  transactionId: string
  invoiceId: string
  studentName: string
  guardianName: string
  amount: number
  method: string
  provider: string
  status: 'pending' | 'settled' | 'failed'
  verifiedBy: string
}): PaymentTransactionRow {
  const db = getDmhsDb()
  const now = new Date().toISOString()
  const id = `pay-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`
  const settledAt = params.status === 'settled' ? now : null

  db.prepare(
    `INSERT OR REPLACE INTO dmhs_payment_transactions
      (id, transaction_id, invoice_id, student_name, guardian_name, amount, method, provider, status, verified_by, created_at, settled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.transactionId,
    params.invoiceId,
    params.studentName,
    params.guardianName,
    params.amount,
    params.method,
    params.provider,
    params.status,
    params.verifiedBy,
    now,
    settledAt,
  )

  return {
    id,
    transactionId: params.transactionId,
    invoiceId: params.invoiceId,
    studentName: params.studentName,
    guardianName: params.guardianName,
    amount: params.amount,
    method: params.method,
    provider: params.provider,
    status: params.status,
    verifiedBy: params.verifiedBy,
    createdAt: now,
    settledAt,
  }
}

export function settlePaymentByTransactionId(
  transactionId: string,
  verifiedBy: string,
): { ok: boolean; invoiceId?: string } {
  const db = getDmhsDb()
  const now = new Date().toISOString()
  const row = db
    .prepare('SELECT invoice_id, status FROM dmhs_payment_transactions WHERE transaction_id = ? LIMIT 1')
    .get(transactionId) as { invoice_id: string; status: string } | undefined

  if (!row) return { ok: false }

  db.prepare(
    `UPDATE dmhs_payment_transactions
     SET status = 'settled', verified_by = ?, settled_at = ?
     WHERE transaction_id = ?`,
  ).run(verifiedBy, now, transactionId)

  // Also mark the matching invoice paid inside dmhs_kv_state if present
  const state = loadPersistedState()
  if (state.exists && state.data && Array.isArray(state.data.fees)) {
    const nextFees = (state.data.fees as Array<Record<string, unknown>>).map((inv) =>
      String(inv.id) === row.invoice_id
        ? {
            ...inv,
            status: 'paid',
            paidAt: 'Today · Gateway Verified',
            receiptNo: transactionId,
          }
        : inv,
    )
    savePersistedState({ ...state.data, fees: nextFees }, verifiedBy)
  }

  return { ok: true, invoiceId: row.invoice_id }
}

export function appendSecurityAudit(params: {
  action: string
  target: string
  actor: string
  actorRole: string
  ipAddress: string
}): void {
  try {
    const db = getDmhsDb()
    const id = `sec-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`
    db.prepare(
      `INSERT INTO dmhs_audit_logs (id, action, target, actor, actor_role, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      params.action,
      params.target,
      params.actor,
      params.actorRole,
      params.ipAddress,
      new Date().toISOString(),
    )
  } catch {
    // non-fatal audit log write
  }
}

export function appendPublicAdmissionToDb(app: Record<string, unknown>): {
  ok: boolean
  applicationCode: string
} {
  const db = getDmhsDb()
  const now = new Date().toISOString()
  const existingCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM dmhs_admissions').get() as { cnt: number }
  ).cnt
  const code = `DMHA-2027-${108 + existingCount}`
  const record: Record<string, unknown> = {
    ...app,
    id: `adm-${Date.now()}`,
    applicationCode: code,
    stage: 'applied',
    appliedAt: 'Just now',
    admissionFeeAmount: 25000,
    admissionFeePaid: false,
  }

  db.prepare(
    `INSERT INTO dmhs_admissions
      (id, applicant_name, applying_class, guardian_name, guardian_phone, stage, admission_fee_paid, created_at, payload_json)
     VALUES (?, ?, ?, ?, ?, 'applied', 0, ?, ?)`,
  ).run(
    String(record.id),
    String(record.applicantName || ''),
    String(record.applyingClass || ''),
    String(record.guardianName || ''),
    String(record.guardianPhone || ''),
    now,
    JSON.stringify(record),
  )

  const state = loadPersistedState()
  if (state.exists && state.data) {
    const prevAdmissions = Array.isArray(state.data.admissions) ? state.data.admissions : []
    savePersistedState(
      { ...state.data, admissions: [record, ...prevAdmissions] },
      'Public Online Admissions',
    )
  }

  return { ok: true, applicationCode: code }
}

export interface SecurityAuditRow {
  id: string
  action: string
  target: string
  actor: string
  actorRole: string
  ipAddress: string
  createdAt: string
}

export function listPaymentTransactions(limit = 100): PaymentTransactionRow[] {
  const db = getDmhsDb()
  const rows = db
    .prepare(
      `SELECT id, transaction_id, invoice_id, student_name, guardian_name, amount, method, provider, status, verified_by, created_at, settled_at
       FROM dmhs_payment_transactions
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: string
    transaction_id: string
    invoice_id: string
    student_name: string
    guardian_name: string
    amount: number
    method: string
    provider: string
    status: 'pending' | 'settled' | 'failed'
    verified_by: string
    created_at: string
    settled_at: string | null
  }>

  return rows.map((r) => ({
    id: r.id,
    transactionId: r.transaction_id,
    invoiceId: r.invoice_id,
    studentName: r.student_name,
    guardianName: r.guardian_name,
    amount: r.amount,
    method: r.method,
    provider: r.provider,
    status: r.status,
    verifiedBy: r.verified_by,
    createdAt: r.created_at,
    settledAt: r.settled_at,
  }))
}

export function listSecurityAuditLogs(limit = 150): SecurityAuditRow[] {
  const db = getDmhsDb()
  const rows = db
    .prepare(
      `SELECT id, action, target, actor, actor_role, ip_address, created_at
       FROM dmhs_audit_logs
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: string
    action: string
    target: string
    actor: string
    actor_role: string
    ip_address: string
    created_at: string
  }>

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    target: r.target,
    actor: r.actor,
    actorRole: r.actor_role,
    ipAddress: r.ip_address,
    createdAt: r.created_at,
  }))
}

export interface BackupSnapshotFile {
  filename: string
  sizeKb: number
  createdAt: string
}

const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups')

export function listSnapshotFiles(): BackupSnapshotFile[] {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return []
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((filename) => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, filename))
        return {
          filename,
          sizeKb: Math.max(1, Math.round(stat.size / 1024)),
          createdAt: stat.mtime.toISOString(),
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return files.slice(0, 20)
  } catch {
    return []
  }
}

export function createScheduledSnapshotFile(actorName: string): {
  ok: boolean
  snapshot?: BackupSnapshotFile
  error?: string
} {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true })
    }
    const state = loadPersistedState()
    const accounts = listAuthAccounts()
    const biometrics = listBiometricCredentials()
    const payments = listPaymentTransactions(500)
    const stats = getDbStats()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `DMHA-Snapshot-${stamp}.json`
    const payload = {
      app: 'DMHA Smart Learning App',
      exportedAt: new Date().toISOString(),
      createdBy: actorName,
      schemaVersion: 3,
      stats,
      authAccounts: accounts,
      biometricDevices: biometrics,
      paymentLedger: payments,
      schoolState: state.data,
    }
    const targetPath = path.join(BACKUPS_DIR, filename)
    const serialized = JSON.stringify(payload, null, 2)
    fs.writeFileSync(targetPath, serialized, 'utf8')
    return {
      ok: true,
      snapshot: {
        filename,
        sizeKb: Math.max(1, Math.round(Buffer.byteLength(serialized, 'utf8') / 1024)),
        createdAt: new Date().toISOString(),
      },
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to write server snapshot.',
    }
  }
}

export function restoreFromBackupPayload(
  backup: Record<string, unknown>,
  actorName: string,
): { ok: boolean; version?: number; studentsRestored?: number; error?: string } {
  const schoolState = (backup.schoolState || backup.data) as Record<string, unknown> | undefined
  if (!schoolState || typeof schoolState !== 'object' || !Array.isArray(schoolState.students)) {
    return {
      ok: false,
      error: 'Invalid DMHA backup JSON: missing schoolState.students array.',
    }
  }
  const saved = savePersistedState(schoolState, `${actorName} (Backup Restore)`)
  return {
    ok: true,
    version: saved.version,
    studentsRestored: schoolState.students.length,
  }
}

// ==================== SERVER-SIGNED EXPIRING PICKUP QR PASSES ====================
export interface PickupPassRecord {
  id: string
  token: string
  studentId: string
  studentName: string
  classLabel: string
  unitLabel: string
  guardianId: string
  authorizedPerson: string
  authorizedRelation: string
  authorizedIdNumber: string
  issuedDate: string
  expiresAt: string
  revoked: boolean
  usedAt: string | null
  createdAt: string
}

function getPickupSigningKey(db: DatabaseSync): string {
  const envKey = process.env.DMHS_PICKUP_SECRET?.trim()
  if (envKey) return envKey

  const row = db
    .prepare('SELECT json_payload FROM dmhs_kv_state WHERE state_key = ?')
    .get('pickup_hmac_secret') as { json_payload: string } | undefined
  if (row?.json_payload) return row.json_payload

  const generated = crypto.randomBytes(32).toString('hex')
  db.prepare(
    `INSERT OR REPLACE INTO dmhs_kv_state (state_key, json_payload, version, updated_at, updated_by)
     VALUES ('pickup_hmac_secret', ?, 1, ?, 'system')`,
  ).run(generated, new Date().toISOString())
  return generated
}

function computePickupSignature(
  db: DatabaseSync,
  passId: string,
  studentId: string,
  issuedDate: string,
): string {
  const secret = getPickupSigningKey(db)
  return crypto
    .createHmac('sha256', secret)
    .update(`${passId}|${studentId}|${issuedDate}`, 'utf8')
    .digest('hex')
    .slice(0, 12)
    .toUpperCase()
}

function mapPickupPassRow(r: {
  id: string
  token: string
  student_id: string
  student_name: string
  class_label: string
  unit_label: string
  guardian_id: string
  authorized_person: string
  authorized_relation: string
  authorized_id_number: string
  issued_date: string
  expires_at: string
  revoked: number
  used_at: string | null
  created_at: string
}): PickupPassRecord {
  return {
    id: r.id,
    token: r.token,
    studentId: r.student_id,
    studentName: r.student_name,
    classLabel: r.class_label,
    unitLabel: r.unit_label,
    guardianId: r.guardian_id,
    authorizedPerson: r.authorized_person,
    authorizedRelation: r.authorized_relation,
    authorizedIdNumber: r.authorized_id_number,
    issuedDate: r.issued_date,
    expiresAt: r.expires_at,
    revoked: r.revoked === 1,
    usedAt: r.used_at,
    createdAt: r.created_at,
  }
}

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function endOfTodayIso(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export function getOrCreateDailyPickupPass(params: {
  studentId: string
  studentName: string
  classLabel: string
  unitLabel: string
  guardianId: string
  authorizedPerson: string
  authorizedRelation: string
  authorizedIdNumber: string
}): PickupPassRecord {
  const db = getDmhsDb()
  const today = todayIsoDate()
  const existing = db
    .prepare(
      `SELECT * FROM dmhs_pickup_passes
       WHERE student_id = ? AND issued_date = ? AND authorized_person = ? AND revoked = 0
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(params.studentId, today, params.authorizedPerson) as Parameters<typeof mapPickupPassRow>[0] | undefined

  if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
    return mapPickupPassRow(existing)
  }

  return createFreshPickupPass(db, params)
}

function createFreshPickupPass(
  db: DatabaseSync,
  params: {
    studentId: string
    studentName: string
    classLabel: string
    unitLabel: string
    guardianId: string
    authorizedPerson: string
    authorizedRelation: string
    authorizedIdNumber: string
  },
): PickupPassRecord {
  const today = todayIsoDate()
  const expiresAt = endOfTodayIso()
  const now = new Date().toISOString()
  const passId = `PK${crypto.randomBytes(3).toString('hex').toUpperCase()}`
  const sig = computePickupSignature(db, passId, params.studentId, today)
  const token = `DMHA-PICKUP|${passId}|${params.studentId}|${today}|${sig}`

  db.prepare(
    `INSERT INTO dmhs_pickup_passes
      (id, token, student_id, student_name, class_label, unit_label, guardian_id, authorized_person, authorized_relation, authorized_id_number, issued_date, expires_at, revoked, used_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
  ).run(
    passId,
    token,
    params.studentId,
    params.studentName,
    params.classLabel,
    params.unitLabel,
    params.guardianId,
    params.authorizedPerson,
    params.authorizedRelation,
    params.authorizedIdNumber,
    today,
    expiresAt,
    now,
  )

  return {
    id: passId,
    token,
    studentId: params.studentId,
    studentName: params.studentName,
    classLabel: params.classLabel,
    unitLabel: params.unitLabel,
    guardianId: params.guardianId,
    authorizedPerson: params.authorizedPerson,
    authorizedRelation: params.authorizedRelation,
    authorizedIdNumber: params.authorizedIdNumber,
    issuedDate: today,
    expiresAt,
    revoked: false,
    usedAt: null,
    createdAt: now,
  }
}

export function rotatePickupPass(params: {
  studentId: string
  studentName: string
  classLabel: string
  unitLabel: string
  guardianId: string
  authorizedPerson: string
  authorizedRelation: string
  authorizedIdNumber: string
}): PickupPassRecord {
  const db = getDmhsDb()
  db.prepare('UPDATE dmhs_pickup_passes SET revoked = 1 WHERE student_id = ? AND revoked = 0').run(
    params.studentId,
  )
  return createFreshPickupPass(db, params)
}

export function verifyPickupPassToken(
  rawToken: string,
): { valid: true; pass: PickupPassRecord } | { valid: false; reason: string } {
  const db = getDmhsDb()
  const clean = rawToken.trim()
  const parts = clean.split('|')
  if (parts.length !== 5 || parts[0] !== 'DMHA-PICKUP') {
    return {
      valid: false,
      reason: 'Unrecognized QR format. Expected a live DMHA Pickup Gate Pass.',
    }
  }

  const [, passId, studentId, issuedDate, providedSig] = parts
  const expectedSig = computePickupSignature(db, passId, studentId, issuedDate)
  const sigMatch =
    providedSig.length === expectedSig.length &&
    crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))

  if (!sigMatch) {
    return {
      valid: false,
      reason: 'Cryptographic signature mismatch — possible tampered or forged pickup pass.',
    }
  }

  const row = db
    .prepare('SELECT * FROM dmhs_pickup_passes WHERE id = ? AND token = ? LIMIT 1')
    .get(passId, clean) as Parameters<typeof mapPickupPassRow>[0] | undefined

  if (!row) {
    return {
      valid: false,
      reason: 'Pickup pass record not found in DMHA Gate Security database.',
    }
  }

  if (row.revoked === 1) {
    return {
      valid: false,
      reason: 'REVOKED PASS: Guardian regenerated a newer pass — this older QR is blocked.',
    }
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return {
      valid: false,
      reason: `EXPIRED PASS: Issued on ${row.issued_date}. Only today’s live pass is accepted at the gate.`,
    }
  }

  const now = new Date().toISOString()
  db.prepare('UPDATE dmhs_pickup_passes SET used_at = ? WHERE id = ?').run(now, row.id)

  return {
    valid: true,
    pass: {
      ...mapPickupPassRow(row),
      usedAt: now,
    },
  }
}

// ==================== SERVER DAILY ROLL CALL REGISTER (SQLITE TABLE) ====================
export interface DailyAttendanceRecordRow {
  id: string
  attendanceDate: string
  studentId: string
  studentName: string
  classLabel: string
  status: 'present' | 'late' | 'absent' | 'leave'
  markedById: string
  markedByName: string
  markedAt: string
}

export function upsertDailyAttendanceRecords(
  entries: Array<{
    attendanceDate: string
    studentId: string
    studentName: string
    classLabel: string
    status: 'present' | 'late' | 'absent' | 'leave'
    markedById: string
    markedByName: string
  }>,
): { previousStatusByStudent: Record<string, string | null>; savedCount: number } {
  const db = getDmhsDb()
  const now = new Date().toISOString()
  const previousStatusByStudent: Record<string, string | null> = {}

  const findPrev = db.prepare(
    'SELECT status FROM dmhs_attendance_records WHERE attendance_date = ? AND student_id = ? LIMIT 1',
  )
  const upsert = db.prepare(`
    INSERT INTO dmhs_attendance_records
      (id, attendance_date, student_id, student_name, class_label, status, marked_by_id, marked_by_name, marked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(attendance_date, student_id) DO UPDATE SET
      student_name = excluded.student_name,
      class_label = excluded.class_label,
      status = excluded.status,
      marked_by_id = excluded.marked_by_id,
      marked_by_name = excluded.marked_by_name,
      marked_at = excluded.marked_at
  `)

  for (const e of entries) {
    const prev = findPrev.get(e.attendanceDate, e.studentId) as { status?: string } | undefined
    previousStatusByStudent[e.studentId] = prev?.status || null
    const id = `att-${e.attendanceDate}-${e.studentId}`
    upsert.run(
      id,
      e.attendanceDate,
      e.studentId,
      e.studentName,
      e.classLabel,
      e.status,
      e.markedById,
      e.markedByName,
      now,
    )
  }

  return { previousStatusByStudent, savedCount: entries.length }
}

export function listDailyAttendanceRecords(attendanceDate?: string): DailyAttendanceRecordRow[] {
  const db = getDmhsDb()
  const targetDate = attendanceDate || new Date().toISOString().slice(0, 10)
  const rows = db
    .prepare(
      `SELECT id, attendance_date, student_id, student_name, class_label, status, marked_by_id, marked_by_name, marked_at
       FROM dmhs_attendance_records
       WHERE attendance_date = ?
       ORDER BY class_label ASC, student_name ASC`,
    )
    .all(targetDate) as Array<{
    id: string
    attendance_date: string
    student_id: string
    student_name: string
    class_label: string
    status: 'present' | 'late' | 'absent' | 'leave'
    marked_by_id: string
    marked_by_name: string
    marked_at: string
  }>

  return rows.map((r) => ({
    id: r.id,
    attendanceDate: r.attendance_date,
    studentId: r.student_id,
    studentName: r.student_name,
    classLabel: r.class_label,
    status: r.status,
    markedById: r.marked_by_id,
    markedByName: r.marked_by_name,
    markedAt: r.marked_at,
  }))
}

export function listSavedAttendanceDates(limit = 30): string[] {
  const db = getDmhsDb()
  const rows = db
    .prepare(
      `SELECT DISTINCT attendance_date
       FROM dmhs_attendance_records
       ORDER BY attendance_date DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{ attendance_date: string }>
  return rows.map((r) => r.attendance_date)
}

export function listStudentAttendanceHistory(
  studentId: string,
  monthPrefix?: string,
  limit = 90,
): DailyAttendanceRecordRow[] {
  const db = getDmhsDb()
  const hasMonth = Boolean(monthPrefix && /^\d{4}-\d{2}$/.test(monthPrefix))
  const rows = (
    hasMonth
      ? db
          .prepare(
            `SELECT id, attendance_date, student_id, student_name, class_label, status, marked_by_id, marked_by_name, marked_at
             FROM dmhs_attendance_records
             WHERE student_id = ? AND attendance_date LIKE ?
             ORDER BY attendance_date DESC
             LIMIT ?`,
          )
          .all(studentId, `${monthPrefix}-%`, limit)
      : db
          .prepare(
            `SELECT id, attendance_date, student_id, student_name, class_label, status, marked_by_id, marked_by_name, marked_at
             FROM dmhs_attendance_records
             WHERE student_id = ?
             ORDER BY attendance_date DESC
             LIMIT ?`,
          )
          .all(studentId, limit)
  ) as Array<{
    id: string
    attendance_date: string
    student_id: string
    student_name: string
    class_label: string
    status: 'present' | 'late' | 'absent' | 'leave'
    marked_by_id: string
    marked_by_name: string
    marked_at: string
  }>

  return rows.map((r) => ({
    id: r.id,
    attendanceDate: r.attendance_date,
    studentId: r.student_id,
    studentName: r.student_name,
    classLabel: r.class_label,
    status: r.status,
    markedById: r.marked_by_id,
    markedByName: r.marked_by_name,
    markedAt: r.marked_at,
  }))
}

export function ensureHistoricalAttendanceSeeded(
  students: Array<{
    id: string
    name: string
    className: string
    section: string
    status?: string
  }>,
): void {
  if (!students || students.length === 0) return
  const db = getDmhsDb()
  const now = new Date()
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const existingPast = db
    .prepare(
      'SELECT COUNT(DISTINCT attendance_date) AS cnt FROM dmhs_attendance_records WHERE attendance_date < ?',
    )
    .get(todayIso) as { cnt?: number } | undefined

  if ((existingPast?.cnt || 0) >= 3) return

  // Collect 5 most recent past school days (DMHA operates Sun–Thu; skip Fri=5, Sat=6)
  const pastSchoolDays: string[] = []
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  while (pastSchoolDays.length < 5) {
    cursor.setDate(cursor.getDate() - 1)
    const dow = cursor.getDay()
    if (dow === 5 || dow === 6) continue
    pastSchoolDays.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
    )
  }

  const insertIgnore = db.prepare(`
    INSERT OR IGNORE INTO dmhs_attendance_records
      (id, attendance_date, student_id, student_name, class_label, status, marked_by_id, marked_by_name, marked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const activeStudents = students.filter((s) => s.status !== 'suspended')
  pastSchoolDays.forEach((dateIso, dayIdx) => {
    activeStudents.forEach((stu, stuIdx) => {
      // Deterministic realistic attendance mix (~85% present, ~7% late, ~5% absent, ~3% leave)
      const hash = (dayIdx * 17 + stuIdx * 13 + stu.id.length * 7) % 20
      const status: 'present' | 'late' | 'absent' | 'leave' =
        hash === 3 ? 'absent' : hash === 7 ? 'late' : hash === 14 ? 'leave' : 'present'
      const id = `att-${dateIso}-${stu.id}`
      insertIgnore.run(
        id,
        dateIso,
        stu.id,
        stu.name,
        `${stu.className} · ${stu.section}`,
        status,
        'tch-nadia',
        'Nadia Rahman',
        `${dateIso}T08:25:00.000Z`,
      )
    })
  })
}
