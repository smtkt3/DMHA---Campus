import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import {
  initialHouseStandings,
  initialMerits,
  initialStudentAchievements,
  pastPapersVault,
} from '@/components/school/data'
import type {
  GuardianRecord,
  HouseName,
  MeritLogItem,
  PastPaperItem,
  PastoralFollowUpNote,
  Role,
  StudentAchievementItem,
  StudentRecord,
  TeacherRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_HOUSES = new Set<HouseName>(['Emerald', 'Sapphire', 'Crimson', 'Gold'])
const VALID_TIERS = new Set<NonNullable<MeritLogItem['tier']>>([
  'Level 1 Reminder',
  'Level 2 Counselor',
  'Level 3 Principal',
])
const VALID_CATEGORIES = new Set<NonNullable<MeritLogItem['category']>>([
  'Academic',
  'Sports',
  'Leadership',
  'Community',
  'Conduct',
])
const VALID_ACH_CATEGORIES = new Set<StudentAchievementItem['category']>([
  'Science & STEM',
  'Debate & Arts',
  'Sports',
  'Community Service',
  'Academic Honor',
])
const VALID_BOARDS = new Set<PastPaperItem['board']>([
  'Cambridge IGCSE',
  'Edexcel IAL',
  'Cambridge Checkpoint',
  'DMHA Term Practice',
])

function normalizeClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function studentInTeacherClasses(student: StudentRecord, assignedClasses?: string[]): boolean {
  if (!assignedClasses || assignedClasses.length === 0) return false
  const fullTok = normalizeClassToken(`${student.className} ${student.section}`)
  const secLetter = student.section.replace(/section/i, '').trim().toLowerCase()
  const compactTok = normalizeClassToken(`${student.className}${secLetter}`)
  const gradeTok = normalizeClassToken(student.className)
  return assignedClasses.some((cls) => {
    const t = normalizeClassToken(cls)
    return t === fullTok || t === compactTok || t === gradeTok
  })
}

function guardianOwnsStudent(
  guardianId: string,
  student: StudentRecord,
  guardians: GuardianRecord[],
): boolean {
  if (student.guardianId === guardianId) return true
  const g = guardians.find((x) => x.id === guardianId)
  return Boolean(g?.linkedStudentIds?.includes(student.id))
}

function getTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatNowLabel(): string {
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `Today · ${t}`
}

function normalizeStandings(raw: unknown): Record<HouseName, number> {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    Emerald: Number(obj.Emerald ?? initialHouseStandings.Emerald),
    Sapphire: Number(obj.Sapphire ?? initialHouseStandings.Sapphire),
    Crimson: Number(obj.Crimson ?? initialHouseStandings.Crimson),
    Gold: Number(obj.Gold ?? initialHouseStandings.Gold),
  }
}

function scopeMeritsForSession(
  merits: MeritLogItem[],
  session: { role: string; linked_entity_id: string },
  students: StudentRecord[],
  guardians: GuardianRecord[],
): MeritLogItem[] {
  if (session.role === 'admin' || session.role === 'teacher') return merits
  if (session.role === 'student') {
    return merits.filter(
      (m) => m.type === 'merit' || m.studentId === session.linked_entity_id,
    )
  }
  if (session.role === 'guardian') {
    const g = guardians.find((x) => x.id === session.linked_entity_id)
    const linkedIds = new Set<string>(g?.linkedStudentIds || [])
    students.forEach((s) => {
      if (s.guardianId === session.linked_entity_id) linkedIds.add(s.id)
    })
    return merits.filter((m) => m.type === 'merit' || linkedIds.has(m.studentId))
  }
  return merits.filter((m) => m.type === 'merit')
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'guardian', 'student'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '').trim()

    const persisted = loadPersistedState()
    const currentData = (persisted?.data || {}) as Record<string, unknown>

    const students = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const teachers = Array.isArray(currentData.teachers)
      ? (currentData.teachers as TeacherRecord[])
      : []
    const guardians = Array.isArray(currentData.guardians)
      ? (currentData.guardians as GuardianRecord[])
      : []
    const merits = Array.isArray(currentData.merits)
      ? (currentData.merits as MeritLogItem[])
      : initialMerits
    const houseStandings = normalizeStandings(currentData.houseStandings)
    const studentAchievements = Array.isArray(currentData.studentAchievements)
      ? (currentData.studentAchievements as StudentAchievementItem[])
      : Array.isArray(initialStudentAchievements)
        ? initialStudentAchievements
        : []
    const pastPapers = Array.isArray(currentData.pastPapers)
      ? (currentData.pastPapers as PastPaperItem[])
      : Array.isArray(pastPapersVault)
        ? pastPapersVault
        : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []
    const existingParentAlerts = Array.isArray(currentData.parentAlerts)
      ? (currentData.parentAlerts as Array<Record<string, unknown>>)
      : []

    const activeTeacher =
      session.role === 'teacher'
        ? teachers.find((t) => t.id === session.linked_entity_id)
        : undefined

    // ==================== 1. AWARD MERIT OR LOG PASTORAL CASE ====================
    if (action === 'award_entry') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can award House Merits or log Pastoral cases.' },
          { status: 403 },
        )
      }

      const studentId = String(body.studentId || '').trim()
      const type: 'merit' | 'pastoral' = body.type === 'pastoral' ? 'pastoral' : 'merit'
      const rawPoints = Math.round(Number(body.points) || 0)
      const reason = String(body.reason || '').trim().slice(0, 400)
      const actionPlan = String(body.actionPlan || '').trim().slice(0, 320)
      const rawCat = String(body.category || (type === 'pastoral' ? 'Conduct' : 'Academic')) as NonNullable<
        MeritLogItem['category']
      >
      const category = VALID_CATEGORIES.has(rawCat) ? rawCat : type === 'pastoral' ? 'Conduct' : 'Academic'
      const rawTier = String(body.tier || 'Level 1 Reminder') as NonNullable<MeritLogItem['tier']>
      const tier = type === 'pastoral' && VALID_TIERS.has(rawTier) ? rawTier : undefined

      if (!studentId || !reason) {
        return NextResponse.json(
          { ok: false, error: 'Student and reason are required.' },
          { status: 400 },
        )
      }
      if (rawPoints < 0 || rawPoints > 50 || (type === 'merit' && rawPoints < 1)) {
        return NextResponse.json(
          { ok: false, error: 'Points must be between 1 and 50 (or 0–50 for pastoral cases).' },
          { status: 400 },
        )
      }

      const student = students.find((s) => s.id === studentId)
      if (!student) {
        return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
      }

      if (session.role === 'teacher') {
        if (!activeTeacher || activeTeacher.status === 'suspended') {
          return NextResponse.json({ ok: false, error: 'Active faculty account required.' }, { status: 403 })
        }
        if (!studentInTeacherClasses(student, activeTeacher.assignedClasses)) {
          appendSecurityAudit({
            action: 'house_pastoral_unauthorized_student_blocked',
            target: `${activeTeacher.name} attempted to log ${type} for ${student.name} (${student.className} · ${student.section})`,
            actor: activeTeacher.name,
            actorRole: 'teacher',
            ipAddress: ip,
          })
          return NextResponse.json(
            {
              ok: false,
              error: `Access Denied: ${student.name} (${student.className} · ${student.section}) is outside your assigned classes.`,
            },
            { status: 403 },
          )
        }
      }

      const houseCandidate = String(body.house || student.house || 'Emerald') as HouseName
      const house: HouseName = VALID_HOUSES.has(houseCandidate) ? houseCandidate : 'Emerald'
      const signedPoints = type === 'merit' ? Math.abs(rawPoints) : -Math.abs(rawPoints)
      const actorName = activeTeacher?.name || session.display_name

      const newEntry: MeritLogItem = {
        id: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: student.id,
        studentName: student.name,
        classLabel: `${student.className} · ${student.section}`,
        house,
        points: signedPoints,
        type,
        category,
        ...(tier ? { tier } : {}),
        ...(type === 'pastoral'
          ? {
              pastoralStatus: 'open',
              actionPlan: actionPlan || undefined,
              followUpNotes: [],
              guardianAcknowledged: false,
            }
          : {}),
        reason,
        awardedBy: actorName,
        awardedById: session.user_id,
        date: formatNowLabel(),
        dateIso: getTodayIso(),
      }

      const nextMerits = [newEntry, ...merits]
      const nextHouseStandings: Record<HouseName, number> = {
        ...houseStandings,
        [house]: Math.max(0, houseStandings[house] + signedPoints),
      }

      const notif = {
        id: `notif-hp-${Date.now()}`,
        title:
          type === 'merit'
            ? `+${Math.abs(signedPoints)} ${house} House Merit · ${student.name}`
            : `Pastoral Care (${tier}) · ${student.name}`,
        text:
          type === 'merit'
            ? `${actorName} awarded +${Math.abs(signedPoints)} ${house} House points to ${student.name}: "${reason}"`
            : `${actorName} logged a ${tier} pastoral note for ${student.name}: "${reason}". Guardian acknowledgement requested.`,
        time: 'Just now',
        type: type === 'pastoral' ? 'alert' : 'result',
        forRoles: ['guardian', 'student', 'admin'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const alertLog = {
        id: `pa-hp-${Date.now()}`,
        studentId: student.id,
        studentName: student.name,
        recipientName: student.guardianName || 'Linked Guardian',
        recipientPhone: student.guardianPhone || 'App Push',
        guardianPhone: student.guardianPhone,
        channel: 'App + Push',
        category: type === 'merit' ? 'House Merit' : 'Pastoral Care',
        message: notif.text,
        sentAt: formatNowLabel(),
        sentBy: actorName,
        status: 'delivered',
      }
      const nextParentAlerts = [alertLog, ...existingParentAlerts].slice(0, 120)

      const saved = savePersistedState(
        {
          ...currentData,
          merits: nextMerits,
          houseStandings: nextHouseStandings,
          notifications: nextNotifs,
          parentAlerts: nextParentAlerts,
        },
        actorName,
      )

      appendSecurityAudit({
        action: type === 'merit' ? 'house_merit_awarded' : 'pastoral_case_opened',
        target: `${student.name} (${house} ${signedPoints >= 0 ? '+' : ''}${signedPoints} pts${tier ? ` · ${tier}` : ''}): ${reason}`,
        actor: actorName,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: actorName,
        summary: notif.title,
      })

      return NextResponse.json({
        ok: true,
        entry: newEntry,
        merits: scopeMeritsForSession(nextMerits, session, students, guardians),
        houseStandings: nextHouseStandings,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 2. UPDATE PASTORAL CASE (STATUS / TIER / FOLLOW-UP NOTE) ====================
    if (action === 'update_pastoral_case') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json(
          { ok: false, error: 'Only Admins or Teachers can update pastoral care cases.' },
          { status: 403 },
        )
      }
      const entryId = String(body.entryId || '').trim()
      const target = merits.find((m) => m.id === entryId && m.type === 'pastoral')
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Pastoral case not found.' }, { status: 404 })
      }
      const student = students.find((s) => s.id === target.studentId)
      if (
        session.role === 'teacher' &&
        student &&
        !studentInTeacherClasses(student, activeTeacher?.assignedClasses)
      ) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: Student is outside your assigned classes.' },
          { status: 403 },
        )
      }

      const rawStatus = String(body.pastoralStatus || target.pastoralStatus || 'open')
      const pastoralStatus: 'open' | 'follow_up' | 'resolved' =
        rawStatus === 'resolved' ? 'resolved' : rawStatus === 'follow_up' ? 'follow_up' : 'open'
      const rawTier = String(body.tier || target.tier || 'Level 1 Reminder') as NonNullable<
        MeritLogItem['tier']
      >
      const tier = VALID_TIERS.has(rawTier) ? rawTier : target.tier
      const noteText = String(body.followUpNote || '').trim().slice(0, 400)
      const actionPlan =
        typeof body.actionPlan === 'string' && body.actionPlan.trim()
          ? body.actionPlan.trim().slice(0, 320)
          : target.actionPlan

      const newNoteObj: PastoralFollowUpNote | null = noteText
        ? {
            id: `pfn-${Date.now()}`,
            authorName: activeTeacher?.name || session.display_name,
            authorRole: session.role as Role,
            note: noteText,
            createdAt: formatNowLabel(),
          }
        : null

      const nextMerits = merits.map((m) =>
        m.id === entryId
          ? {
              ...m,
              pastoralStatus,
              tier,
              actionPlan,
              followUpNotes: newNoteObj
                ? [...(m.followUpNotes || []), newNoteObj]
                : m.followUpNotes || [],
            }
          : m,
      )

      const notif = {
        id: `notif-pc-${Date.now()}`,
        title: `Pastoral Case ${pastoralStatus === 'resolved' ? 'Resolved ✓' : 'Updated'} · ${target.studentName}`,
        text: `${session.display_name} updated ${target.studentName}’s pastoral case (${tier} · ${pastoralStatus.replace('_', ' ')})${noteText ? `: "${noteText}"` : '.'}`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['guardian', 'admin', 'teacher'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        { ...currentData, merits: nextMerits, notifications: nextNotifs },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'pastoral_case_updated',
        target: `${target.studentName} → ${pastoralStatus} (${tier})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: notif.title,
      })

      return NextResponse.json({
        ok: true,
        merits: scopeMeritsForSession(nextMerits, session, students, guardians),
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 3. GUARDIAN ACKNOWLEDGE & REPLY ====================
    if (action === 'acknowledge_entry') {
      if (session.role !== 'guardian') {
        return NextResponse.json(
          { ok: false, error: 'Only a linked Guardian can acknowledge student conduct or merit records.' },
          { status: 403 },
        )
      }
      const entryId = String(body.entryId || '').trim()
      const guardianReply = String(body.guardianReply || '').trim().slice(0, 320)
      const target = merits.find((m) => m.id === entryId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Entry not found.' }, { status: 404 })
      }
      const student = students.find((s) => s.id === target.studentId)
      if (!student || !guardianOwnsStudent(session.linked_entity_id, student, guardians)) {
        return NextResponse.json(
          { ok: false, error: 'Access Denied: You are not the linked guardian for this student.' },
          { status: 403 },
        )
      }

      const nextMerits = merits.map((m) =>
        m.id === entryId
          ? {
              ...m,
              guardianAcknowledged: true,
              guardianAcknowledgedBy: session.display_name,
              guardianAcknowledgedAt: formatNowLabel(),
              guardianReply: guardianReply || m.guardianReply,
            }
          : m,
      )

      const notif = {
        id: `notif-gack-${Date.now()}`,
        title: `Guardian Acknowledged · ${student.name}`,
        text: `${session.display_name} acknowledged ${target.type === 'pastoral' ? 'pastoral care note' : 'house merit'} for ${student.name}${guardianReply ? `: "${guardianReply}"` : '.'}`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['teacher', 'admin'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        { ...currentData, merits: nextMerits, notifications: nextNotifs },
        session.display_name,
      )

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: notif.title,
      })

      return NextResponse.json({
        ok: true,
        merits: scopeMeritsForSession(nextMerits, session, students, guardians),
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 4. DELETE / REVERT MERIT OR PASTORAL ENTRY ====================
    if (action === 'delete_entry') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json({ ok: false, error: 'Permission denied.' }, { status: 403 })
      }
      const entryId = String(body.entryId || '').trim()
      const target = merits.find((m) => m.id === entryId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Entry not found.' }, { status: 404 })
      }
      if (
        session.role === 'teacher' &&
        target.awardedById !== session.user_id &&
        target.awardedBy !== activeTeacher?.name
      ) {
        return NextResponse.json(
          { ok: false, error: 'Teachers can only delete entries they created.' },
          { status: 403 },
        )
      }

      const nextMerits = merits.filter((m) => m.id !== entryId)
      const nextHouseStandings: Record<HouseName, number> = {
        ...houseStandings,
        [target.house]: Math.max(0, houseStandings[target.house] - target.points),
      }

      const saved = savePersistedState(
        {
          ...currentData,
          merits: nextMerits,
          houseStandings: nextHouseStandings,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'house_merit_reverted',
        target: `Removed "${target.reason}" (${target.studentName}, ${target.house} ${target.points} pts)`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Reverted house/pastoral entry for ${target.studentName}`,
      })

      return NextResponse.json({
        ok: true,
        merits: scopeMeritsForSession(nextMerits, session, students, guardians),
        houseStandings: nextHouseStandings,
        version: saved.version,
      })
    }

    // ==================== 5. REASSIGN STUDENT HOUSE (ADMIN ONLY) ====================
    if (action === 'reassign_student_house') {
      if (session.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: 'Only Admins can reassign a student’s House.' },
          { status: 403 },
        )
      }
      const studentId = String(body.studentId || '').trim()
      const targetHouse = String(body.house || '') as HouseName
      if (!VALID_HOUSES.has(targetHouse)) {
        return NextResponse.json({ ok: false, error: 'Invalid House name.' }, { status: 400 })
      }
      const student = students.find((s) => s.id === studentId)
      if (!student) {
        return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 })
      }
      const oldHouse = student.house || 'Emerald'
      const nextStudents = students.map((s) =>
        s.id === studentId ? { ...s, house: targetHouse } : s,
      )
      const saved = savePersistedState(
        { ...currentData, students: nextStudents },
        session.display_name,
      )
      appendSecurityAudit({
        action: 'student_house_reassigned',
        target: `${student.name}: ${oldHouse} → ${targetHouse}`,
        actor: session.display_name,
        actorRole: 'admin',
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Assigned ${student.name} to ${targetHouse} House`,
      })
      return NextResponse.json({ ok: true, students: nextStudents, version: saved.version })
    }

    // ==================== 6. AWARD VERIFIED STUDENT ACHIEVEMENT / CCA BADGE ====================
    if (action === 'add_achievement') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can award verified CCA achievements.' },
          { status: 403 },
        )
      }
      const studentId = String(body.studentId || '').trim()
      const title = String(body.title || '').trim().slice(0, 120)
      const detail = String(body.detail || '').trim().slice(0, 260)
      const rawCat = String(body.category || 'Academic Honor') as StudentAchievementItem['category']
      const category = VALID_ACH_CATEGORIES.has(rawCat) ? rawCat : 'Academic Honor'
      const bonusPoints = Math.min(25, Math.max(0, Math.round(Number(body.bonusPoints) || 0)))

      const student = students.find((s) => s.id === studentId)
      if (!student || !title) {
        return NextResponse.json(
          { ok: false, error: 'Valid student and achievement title are required.' },
          { status: 400 },
        )
      }
      if (
        session.role === 'teacher' &&
        !studentInTeacherClasses(student, activeTeacher?.assignedClasses)
      ) {
        return NextResponse.json(
          { ok: false, error: `Access Denied: ${student.name} is outside your assigned classes.` },
          { status: 403 },
        )
      }

      const house: HouseName = VALID_HOUSES.has(student.house as HouseName)
        ? (student.house as HouseName)
        : 'Emerald'
      const actorName = activeTeacher?.name || session.display_name

      const newAch: StudentAchievementItem = {
        id: `ach-${Date.now()}`,
        studentId: student.id,
        studentName: student.name,
        house,
        title,
        detail: detail || `Verified ${category} distinction · ${house} House`,
        category,
        awardedBy: actorName,
        date: formatNowLabel(),
        dateIso: getTodayIso(),
      }

      const nextAchievements = [newAch, ...studentAchievements]
      let nextMerits = merits
      let nextHouseStandings = houseStandings
      if (bonusPoints > 0) {
        const bonusEntry: MeritLogItem = {
          id: `mr-ach-${Date.now()}`,
          studentId: student.id,
          studentName: student.name,
          classLabel: `${student.className} · ${student.section}`,
          house,
          points: bonusPoints,
          type: 'merit',
          category: 'Leadership',
          reason: `Achievement Award: ${title}`,
          awardedBy: actorName,
          awardedById: session.user_id,
          date: formatNowLabel(),
          dateIso: getTodayIso(),
        }
        nextMerits = [bonusEntry, ...merits]
        nextHouseStandings = {
          ...houseStandings,
          [house]: houseStandings[house] + bonusPoints,
        }
      }

      const notif = {
        id: `notif-ach-${Date.now()}`,
        title: `Verified Achievement · ${student.name}`,
        text: `${actorName} awarded "${title}" (${category}) to ${student.name}${bonusPoints > 0 ? ` (+${bonusPoints} ${house} House pts)` : ''}!`,
        time: 'Just now',
        type: 'result',
        forRoles: ['guardian', 'student', 'admin'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

      const saved = savePersistedState(
        {
          ...currentData,
          studentAchievements: nextAchievements,
          merits: nextMerits,
          houseStandings: nextHouseStandings,
          notifications: nextNotifs,
        },
        actorName,
      )

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: actorName,
        summary: notif.title,
      })

      return NextResponse.json({
        ok: true,
        achievement: newAch,
        studentAchievements: nextAchievements,
        merits: scopeMeritsForSession(nextMerits, session, students, guardians),
        houseStandings: nextHouseStandings,
        notifications: nextNotifs,
        version: saved.version,
      })
    }

    // ==================== 7. ADD / DELETE PRACTICE SHEET / PAST PAPER ====================
    if (action === 'add_past_paper') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json(
          { ok: false, error: 'Only Teachers and Admins can publish practice sheets or past papers.' },
          { status: 403 },
        )
      }
      const title = String(body.title || '').trim().slice(0, 140)
      const subject = String(body.subject || 'Physics').trim().slice(0, 60)
      const rawBoard = String(body.board || 'DMHA Term Practice') as PastPaperItem['board']
      const board = VALID_BOARDS.has(rawBoard) ? rawBoard : 'DMHA Term Practice'
      const year = String(body.year || '2026').trim().slice(0, 20)
      const paperCode = String(body.paperCode || `DMHA-${Date.now().toString().slice(-4)}`).trim().slice(0, 30)
      const summary = String(body.summary || '').trim().slice(0, 600)
      const fileUrl = typeof body.fileUrl === 'string' && body.fileUrl.trim() ? body.fileUrl.trim() : undefined
      const fileName = typeof body.fileName === 'string' && body.fileName.trim() ? body.fileName.trim() : undefined

      if (!title) {
        return NextResponse.json({ ok: false, error: 'Practice paper title is required.' }, { status: 400 })
      }

      const newPaper: PastPaperItem = {
        id: `pp-${Date.now()}`,
        title,
        subject,
        board,
        year,
        paperCode,
        hasMarkScheme: Boolean(body.hasMarkScheme !== false),
        summary: summary || undefined,
        fileUrl,
        fileName,
        uploadedBy: activeTeacher?.name || session.display_name,
      }

      const nextPapers = [newPaper, ...pastPapers]
      const saved = savePersistedState(
        { ...currentData, pastPapers: nextPapers },
        session.display_name,
      )
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Added practice paper: ${title}`,
      })
      return NextResponse.json({ ok: true, paper: newPaper, pastPapers: nextPapers, version: saved.version })
    }

    if (action === 'delete_past_paper') {
      if (session.role !== 'admin' && session.role !== 'teacher') {
        return NextResponse.json({ ok: false, error: 'Permission denied.' }, { status: 403 })
      }
      const paperId = String(body.paperId || '').trim()
      const nextPapers = pastPapers.filter((p) => p.id !== paperId)
      const saved = savePersistedState(
        { ...currentData, pastPapers: nextPapers },
        session.display_name,
      )
      return NextResponse.json({ ok: true, pastPapers: nextPapers, version: saved.version })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'House & Pastoral operation failed.' },
      { status: 500 },
    )
  }
}
