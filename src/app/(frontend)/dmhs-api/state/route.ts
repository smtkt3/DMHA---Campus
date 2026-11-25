import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  getDbStats,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { initialExamBook } from '@/lib/dmhs-exams'
import { scopeTasksForActor } from '@/lib/dmhs-tasks'
import { initialTransportBook } from '@/lib/dmhs-transport'
import { initialCampusTasks } from '@/components/school/data'
import { scopeChatsForActor } from '@/app/(frontend)/dmhs-api/messages/route'
import type {
  CampusTaskItem,
  ChatThread,
  GuardianRecord,
  Role,
  StaffMemberRecord,
  StudentRecord,
  TeacherRecord,
} from '@/components/school/types'
import { broadcastDmhsEvent, getConnectedDevicesCount } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function asRecArray(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val) ? (val as Array<Record<string, unknown>>) : []
}

function normCls(v: unknown): string {
  return String(v || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function filterByStudentIds(
  arr: unknown,
  allowedIds: Set<string>,
): Array<Record<string, unknown>> {
  return asRecArray(arr).filter((item) => {
    const sid = String(item.studentId || '')
    return sid !== '' && allowedIds.has(sid)
  })
}

function mergeScopedArray(
  existingVal: unknown,
  incomingVal: unknown,
  belongsToActor: (item: Record<string, unknown>) => boolean,
): Array<Record<string, unknown>> {
  const existing = asRecArray(existingVal)
  const incoming = asRecArray(incomingVal)
  const preservedOthers = existing.filter((item) => !belongsToActor(item))
  const actorOwnedIncoming = incoming.filter((item) => belongsToActor(item))
  return [...actorOwnedIncoming, ...preservedOthers]
}

function filterFamilyNotifications(
  rawNotifications: unknown,
  targetRole: 'guardian' | 'student',
  allowedIds: Set<string>,
  studentsList: Array<{ id: string; name?: string; className?: string; section?: string }>,
): Array<Record<string, unknown>> {
  const otherStudents = studentsList.filter((s) => !allowedIds.has(s.id))
  const enrolledClassTokens = studentsList
    .filter((s) => allowedIds.has(s.id))
    .map((s) => `${s.className || ''} · ${s.section || ''}`.toLowerCase())

  return asRecArray(rawNotifications).filter((n) => {
    const forRoles = Array.isArray(n.forRoles) ? (n.forRoles as string[]) : []
    if (!forRoles.includes(targetRole)) return false
    const text = `${String(n.title || '')} ${String(n.text || '')}`.toLowerCase()
    if (text.includes('class moment') && enrolledClassTokens.length > 0) {
      if (!enrolledClassTokens.some((tok) => tok && text.includes(tok))) return false
    }
    const mentionsOther = otherStudents.some((other) => {
      const full = String(other.name || '').toLowerCase()
      return full.length >= 4 && text.includes(full)
    })
    return !mentionsOther
  })
}

function redactOtherGuardians(
  rawGuardians: unknown,
  allowedGuardianId: string,
): Array<Record<string, unknown>> {
  return asRecArray(rawGuardians).map((g) => {
    if (String(g.id || '') === allowedGuardianId) return g
    return {
      ...g,
      phone: undefined,
      email: undefined,
      address: undefined,
      nid: undefined,
      emergencyPhone: undefined,
    }
  })
}

function resolveActorStudentIds(
  stateData: Record<string, unknown>,
  role: string,
  linkedId: string,
): { allowedIds: Set<string>; guardianId: string } {
  const studentsList = asRecArray(stateData.students) as Array<{
    id: string
    guardianId?: string
  }>
  if (role === 'student') {
    const stu = studentsList.find((s) => s.id === linkedId)
    return {
      allowedIds: new Set(linkedId ? [linkedId] : []),
      guardianId: String(stu?.guardianId || ''),
    }
  }
  if (role === 'guardian') {
    const guardiansList = asRecArray(stateData.guardians) as Array<{
      id: string
      linkedStudentIds?: string[]
    }>
    const activeG = guardiansList.find((g) => g.id === linkedId)
    const allowedIds = new Set<string>(activeG?.linkedStudentIds || [])
    studentsList.forEach((s) => {
      if (s.guardianId === linkedId) allowedIds.add(s.id)
    })
    return { allowedIds, guardianId: linkedId }
  }
  return { allowedIds: new Set<string>(), guardianId: '' }
}

export async function GET() {
  try {
    const auth = await requireAuthSession()
    if (!auth.ok) return auth.response

    const state = loadPersistedState()
    const isAdmin = auth.session.role === 'admin'
    const stats = isAdmin ? getDbStats() : undefined

    // Strict Confidentiality & Zero-Leak Payload Scoping:
    // Every non-admin session receives only records authorized for their role/family/class.
    let scopedData = state.data
    if (isAdmin && scopedData && typeof scopedData === 'object') {
      if (!scopedData.examBook || !scopedData.transportBook) {
        scopedData = {
          ...scopedData,
          ...(scopedData.examBook ? {} : { examBook: initialExamBook }),
          ...(scopedData.transportBook ? {} : { transportBook: initialTransportBook }),
        }
      }
    }
    if (!isAdmin && state.data && typeof state.data === 'object') {
      const role = auth.session.role
      const linkedId = auth.session.linked_entity_id
      const rawEvals = asRecArray(state.data.semesterEvaluations)
      const rawFeedback = asRecArray(state.data.feedback)
      const rawMaterials = asRecArray(state.data.courseMaterials)
      const rawMoments = asRecArray(state.data.classMoments)
      const rawMerits = asRecArray(state.data.merits)
      const rawPtmSlots = asRecArray(state.data.ptmSlots)
      const rawCareLogs = asRecArray(state.data.earlyYearsCareLogs)
      const rawNotifications = asRecArray(state.data.notifications)

      if (role === 'teacher' || role === 'staff') {
        const canAccounts =
          role === 'staff' && staffHasServerPermission(linkedId, 'accounts')
        const canPayroll =
          role === 'staff' && staffHasServerPermission(linkedId, 'payroll')
        const canAdmissions =
          role === 'staff' && staffHasServerPermission(linkedId, 'admissions')

        const teachersList = asRecArray(state.data.teachers) as Array<{
          id: string
          name?: string
          assignedClasses?: string[]
        }>
        const activeTch = teachersList.find((t) => t.id === linkedId)
        const assignedTokens = (activeTch?.assignedClasses || []).map(normCls)
        const studentsListForTch = asRecArray(state.data.students) as Array<{
          id: string
          className?: string
          section?: string
        }>
        const assignedStudentIds = new Set<string>(
          studentsListForTch
            .filter((s) => {
              const fullTok = normCls(`${s.className || ''} ${s.section || ''}`)
              const secLetter = String(s.section || '').replace(/section/i, '').trim().toLowerCase()
              const compactTok = normCls(`${s.className || ''}${secLetter}`)
              const gradeTok = normCls(s.className)
              return (
                assignedTokens.includes(fullTok) ||
                assignedTokens.includes(compactTok) ||
                assignedTokens.includes(gradeTok)
              )
            })
            .map((s) => s.id),
        )
        const scopedMoments =
          role === 'teacher'
            ? rawMoments.filter((m) => {
                if (String(m.teacherId) === linkedId) return true
                const fullTok = normCls(`${m.className || ''} ${m.section || ''}`)
                const gradeTok = normCls(m.className)
                return assignedTokens.includes(fullTok) || assignedTokens.includes(gradeTok)
              })
            : []
        const scopedTeacherMerits =
          role === 'teacher'
            ? rawMerits.filter(
                (m) =>
                  m.type !== 'pastoral' ||
                  assignedStudentIds.has(String(m.studentId)) ||
                  String(m.awardedById || '') === auth.session.user_id ||
                  (activeTch?.name && String(m.awardedBy || '') === activeTch.name),
              )
            : rawMerits.filter((m) => m.type !== 'pastoral')
        scopedData = {
          ...state.data,
          semesterEvaluations: [],
          classMoments: scopedMoments,
          merits: scopedTeacherMerits,
          ptmSlots:
            role === 'teacher'
              ? rawPtmSlots.filter((sl) => String(sl.teacherId) === linkedId)
              : [],
          earlyYearsCareLogs:
            role === 'teacher'
              ? rawCareLogs.filter(
                  (c) =>
                    assignedStudentIds.has(String(c.studentId)) ||
                    String(c.loggedById || '') === auth.session.user_id ||
                    (activeTch?.name && String(c.loggedBy || '') === activeTch.name),
                )
              : [],
          admissions: canAdmissions ? state.data.admissions : [],
          expenses: canAccounts ? state.data.expenses : [],
          otherIncomes: canAccounts ? state.data.otherIncomes : [],
          teacherSalaries: canPayroll ? state.data.teacherSalaries : [],
          notifications: rawNotifications.filter((n) => {
            const forRoles = Array.isArray(n.forRoles) ? (n.forRoles as string[]) : []
            return role === 'teacher' ? forRoles.includes('teacher') : forRoles.includes('admin') || forRoles.includes('staff')
          }),
          teacherReimbursements: undefined,
          teacherAdvances: undefined,
          teacherAllowances: undefined,
          teacherPayoutProfiles: undefined,
          feedback: rawFeedback.map((fb) => {
            const { rating: _hiddenRating, ...rest } = fb
            return rest
          }),
        }
      } else if (role === 'student') {
        const studentsList = asRecArray(state.data.students) as Array<{
          id: string
          name?: string
          guardianId?: string
          className?: string
          section?: string
        }>
        const { allowedIds, guardianId } = resolveActorStudentIds(state.data, 'student', linkedId)
        const activeStu = studentsList.find((s) => s.id === linkedId)
        const stuFullTok = activeStu ? normCls(`${activeStu.className || ''} ${activeStu.section || ''}`) : ''
        const scopedMoments = activeStu
          ? rawMoments.filter((m) => {
              const recStus = Array.isArray(m.recipientStudentIds) ? (m.recipientStudentIds as string[]) : []
              if (recStus.includes(activeStu.id)) return true
              return stuFullTok !== '' && normCls(`${m.className || ''} ${m.section || ''}`) === stuFullTok
            })
          : []
        scopedData = {
          ...state.data,
          semesterEvaluations: rawEvals.filter((e) => String(e.studentId) === linkedId),
          courseMaterials: rawMaterials.filter((m) => m.status === 'published'),
          classMoments: scopedMoments,
          merits: rawMerits.filter(
            (m) => m.type !== 'pastoral' || String(m.studentId) === linkedId,
          ),
          ptmSlots: [],
          earlyYearsCareLogs: rawCareLogs.filter((c) => String(c.studentId) === linkedId),
          // Hardened student privacy scoping on the wire
          fees: [],
          leaveRequests: filterByStudentIds(state.data.leaveRequests, allowedIds),
          ptmRequests: [],
          unitTransferRequests: filterByStudentIds(state.data.unitTransferRequests, allowedIds),
          consentForms: filterByStudentIds(state.data.consentForms, allowedIds),
          dismissalLogs: filterByStudentIds(state.data.dismissalLogs, allowedIds),
          medicalLogs: filterByStudentIds(state.data.medicalLogs, allowedIds),
          pickupContacts: filterByStudentIds(state.data.pickupContacts, allowedIds),
          canteenWallets: filterByStudentIds(state.data.canteenWallets, allowedIds),
          canteenTransactions: filterByStudentIds(state.data.canteenTransactions, allowedIds),
          examSheets: filterByStudentIds(state.data.examSheets, allowedIds),
          qrScans: filterByStudentIds(state.data.qrScans, allowedIds),
          parentAlerts: [],
          issuedDocuments: filterByStudentIds(state.data.issuedDocuments, allowedIds),
          admissions: [],
          expenses: [],
          otherIncomes: [],
          teacherSalaries: [],
          teacherLeaves: [],
          teacherAttendance: [],
          teacherTrainings: [],
          staffMembers: [],
          guardians: redactOtherGuardians(state.data.guardians, guardianId),
          notifications: filterFamilyNotifications(
            rawNotifications,
            'student',
            allowedIds,
            studentsList,
          ),
          teacherReimbursements: undefined,
          teacherAdvances: undefined,
          teacherAllowances: undefined,
          teacherPayoutProfiles: undefined,
        }
      } else if (role === 'guardian') {
        const studentsList = asRecArray(state.data.students) as Array<{
          id: string
          name?: string
          guardianId?: string
          className?: string
          section?: string
        }>
        const { allowedIds: linkedSet } = resolveActorStudentIds(state.data, 'guardian', linkedId)
        const linkedClassTokens = new Set<string>()
        studentsList.forEach((s) => {
          if (linkedSet.has(s.id)) {
            linkedClassTokens.add(normCls(`${s.className || ''} ${s.section || ''}`))
          }
        })
        const scopedMoments = rawMoments.filter((m) => {
          const recGrds = Array.isArray(m.recipientGuardianIds)
            ? (m.recipientGuardianIds as string[])
            : []
          if (recGrds.includes(linkedId)) return true
          const recStus = Array.isArray(m.recipientStudentIds)
            ? (m.recipientStudentIds as string[])
            : []
          if (recStus.some((sid) => linkedSet.has(sid))) return true
          return linkedClassTokens.has(normCls(`${m.className || ''} ${m.section || ''}`))
        })
        scopedData = {
          ...state.data,
          semesterEvaluations: rawEvals.filter((e) => linkedSet.has(String(e.studentId))),
          courseMaterials: rawMaterials.filter((m) => m.status === 'published'),
          classMoments: scopedMoments,
          merits: rawMerits.filter(
            (m) => m.type !== 'pastoral' || linkedSet.has(String(m.studentId)),
          ),
          ptmSlots: rawPtmSlots.map((sl) =>
            sl.status === 'open' || String(sl.guardianId || '') === linkedId
              ? sl
              : {
                  ...sl,
                  studentId: undefined,
                  studentName: undefined,
                  classLabel: undefined,
                  guardianId: undefined,
                  guardianName: 'Booked by Another Family',
                  topic: undefined,
                  outcomeNotes: undefined,
                },
          ),
          earlyYearsCareLogs: rawCareLogs.filter((c) => linkedSet.has(String(c.studentId))),
          // Hardened guardian family privacy scoping on the wire
          fees: filterByStudentIds(state.data.fees, linkedSet),
          leaveRequests: filterByStudentIds(state.data.leaveRequests, linkedSet),
          ptmRequests: filterByStudentIds(state.data.ptmRequests, linkedSet),
          unitTransferRequests: filterByStudentIds(state.data.unitTransferRequests, linkedSet),
          consentForms: filterByStudentIds(state.data.consentForms, linkedSet),
          dismissalLogs: filterByStudentIds(state.data.dismissalLogs, linkedSet),
          medicalLogs: filterByStudentIds(state.data.medicalLogs, linkedSet),
          pickupContacts: filterByStudentIds(state.data.pickupContacts, linkedSet),
          canteenWallets: filterByStudentIds(state.data.canteenWallets, linkedSet),
          canteenTransactions: filterByStudentIds(state.data.canteenTransactions, linkedSet),
          examSheets: filterByStudentIds(state.data.examSheets, linkedSet),
          qrScans: filterByStudentIds(state.data.qrScans, linkedSet),
          parentAlerts: filterByStudentIds(state.data.parentAlerts, linkedSet),
          issuedDocuments: filterByStudentIds(state.data.issuedDocuments, linkedSet),
          admissions: [],
          expenses: [],
          otherIncomes: [],
          teacherSalaries: [],
          teacherLeaves: [],
          teacherAttendance: [],
          teacherTrainings: [],
          staffMembers: [],
          guardians: redactOtherGuardians(state.data.guardians, linkedId),
          notifications: filterFamilyNotifications(
            rawNotifications,
            'guardian',
            linkedSet,
            studentsList,
          ),
          teacherReimbursements: undefined,
          teacherAdvances: undefined,
          teacherAllowances: undefined,
          teacherPayoutProfiles: undefined,
        }
      }
      // Strictly Admin-only ERP collections are never leaked to non-admin sessions
      // (Accounts-permitted staff such as Accountant STF-ACC retain access to accountingBook)
      const allowAccountsBook =
        auth.session.role === 'staff' &&
        staffHasServerPermission(auth.session.linked_entity_id, 'accounts')
      const allowPayrollBook =
        auth.session.role === 'staff' &&
        (staffHasServerPermission(auth.session.linked_entity_id, 'accounts') ||
          staffHasServerPermission(auth.session.linked_entity_id, 'payroll'))
      const allowFullExamBook =
        auth.session.role === 'staff' &&
        staffHasServerPermission(auth.session.linked_entity_id, 'timetable')
      const baseExamBook = (
        state.data.examBook && typeof state.data.examBook === 'object'
          ? state.data.examBook
          : initialExamBook
      ) as Record<string, unknown>
      let scopedExamBook: unknown = baseExamBook
      if (!allowFullExamBook) {
        const eb = baseExamBook
        if (auth.session.role === 'teacher') {
          scopedExamBook = {
            ...eb,
            questionPapers: [],
            answerScripts: asRecArray(eb.answerScripts).filter(
              (a) => String(a.examinerId || '') === auth.session.linked_entity_id,
            ),
          }
        } else {
          // Guardian / Student / Non-timetable Staff: zero internal exam leaks
          const { allowedIds } = resolveActorStudentIds(
            state.data,
            auth.session.role,
            auth.session.linked_entity_id,
          )
          const publishedIds = new Set(
            asRecArray(eb.declaredExams)
              .filter((e) => e.status === 'published')
              .map((e) => String(e.id || '')),
          )
          scopedExamBook = {
            ...eb,
            declaredExams: asRecArray(eb.declaredExams).filter((e) => e.status !== 'draft'),
            examAttendance: filterByStudentIds(eb.examAttendance, allowedIds),
            examMarks: filterByStudentIds(eb.examMarks, allowedIds).filter((m) =>
              publishedIds.has(String(m.examId || '')),
            ),
            seatAllocations: filterByStudentIds(eb.seatAllocations, allowedIds),
            committee: [],
            invigilators: [],
            questionPapers: [],
            answerScripts: [],
          }
        }
      }
      const scopedChats = scopeChatsForActor(
        asRecArray(state.data.chats) as unknown as ChatThread[],
        auth.session.role as Role,
        auth.session.linked_entity_id,
        asRecArray(state.data.students) as unknown as StudentRecord[],
        asRecArray(state.data.guardians) as unknown as GuardianRecord[],
        asRecArray(state.data.teachers) as unknown as TeacherRecord[],
      )
      const baseTransportBook = (
        state.data.transportBook && typeof state.data.transportBook === 'object'
          ? state.data.transportBook
          : initialTransportBook
      ) as Record<string, unknown>
      const scopedTransportBook =
        auth.session.role === 'teacher' || auth.session.role === 'staff'
          ? baseTransportBook
          : {
              routes: Array.isArray(baseTransportBook.routes) ? baseTransportBook.routes : initialTransportBook.routes,
              boardingLogs: filterByStudentIds(
                baseTransportBook.boardingLogs,
                resolveActorStudentIds(
                  state.data,
                  auth.session.role,
                  auth.session.linked_entity_id,
                ).allowedIds,
              ),
            }
      scopedData = {
        ...scopedData,
        chats: scopedChats,
        transportBook: scopedTransportBook,
        helpDeskTickets: [],
        campusTasks: scopeTasksForActor(
          Array.isArray(state.data.campusTasks)
            ? (state.data.campusTasks as CampusTaskItem[])
            : initialCampusTasks,
          auth.session.role as Role,
          auth.session.linked_entity_id,
          asRecArray(state.data.teachers) as unknown as TeacherRecord[],
          asRecArray(state.data.staffMembers) as unknown as StaffMemberRecord[],
        ),
        employeeDuties: [],
        rfidDevices: [],
        rfidPunches: [],
        studentFines: [],
        stockItems: [],
        stockMovements: [],
        questionBank: [],
        jobVacancies: [],
        jobApplications: [],
        ...(allowAccountsBook ? {} : { accountingBook: undefined }),
        ...(allowPayrollBook ? {} : { payrollBook: undefined }),
        ...(scopedExamBook !== undefined ? { examBook: scopedExamBook } : {}),
      }
    }

    return NextResponse.json({
      ok: true,
      exists: state.exists,
      data: scopedData,
      version: state.version,
      updatedAt: state.updatedAt,
      ...(isAdmin ? { connectedDevices: getConnectedDevicesCount(), stats } : {}),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Database read failed' },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuthSession()
    if (!auth.ok) return auth.response
    const { session } = auth

    const body = (await request.json()) as {
      data?: Record<string, unknown>
      updatedBy?: string
      clientId?: string
      summary?: string
      expectedVersion?: number
    }
    if (!body?.data || typeof body.data !== 'object') {
      return NextResponse.json({ ok: false, error: 'Missing state payload' }, { status: 400 })
    }

    // Always preserve server-authoritative Teacher Finance collections (mutated exclusively via /dmhs-api/teacher-finance)
    // and protect Admin-owned system configuration, custom roles & faculty payroll from unauthorized writes
    const existing = loadPersistedState()
    let payloadToSave: Record<string, unknown> = existing.exists && existing.data
      ? {
          ...body.data,
          ...(existing.data.teacherReimbursements !== undefined
            ? { teacherReimbursements: existing.data.teacherReimbursements }
            : {}),
          ...(existing.data.teacherAdvances !== undefined
            ? { teacherAdvances: existing.data.teacherAdvances }
            : {}),
          ...(existing.data.teacherAllowances !== undefined
            ? { teacherAllowances: existing.data.teacherAllowances }
            : {}),
          ...(existing.data.teacherPayoutProfiles !== undefined
            ? { teacherPayoutProfiles: existing.data.teacherPayoutProfiles }
            : {}),
          ...(existing.data.classMoments !== undefined
            ? { classMoments: existing.data.classMoments }
            : {}),
          ...(existing.data.calendarEvents !== undefined
            ? { calendarEvents: existing.data.calendarEvents }
            : {}),
          ...(existing.data.ptmSlots !== undefined
            ? { ptmSlots: existing.data.ptmSlots }
            : {}),
          ...(existing.data.earlyYearsCareLogs !== undefined
            ? { earlyYearsCareLogs: existing.data.earlyYearsCareLogs }
            : {}),
          ...(existing.data.classFeeSchedules !== undefined
            ? { classFeeSchedules: existing.data.classFeeSchedules }
            : {}),
          ...(existing.data.siblingDiscountPct !== undefined
            ? { siblingDiscountPct: existing.data.siblingDiscountPct }
            : {}),
          ...(existing.data.helpDeskTickets !== undefined
            ? { helpDeskTickets: existing.data.helpDeskTickets }
            : {}),
          ...(existing.data.campusTasks !== undefined
            ? { campusTasks: existing.data.campusTasks }
            : {}),
          ...(existing.data.employeeDuties !== undefined
            ? { employeeDuties: existing.data.employeeDuties }
            : {}),
          ...(existing.data.rfidDevices !== undefined
            ? { rfidDevices: existing.data.rfidDevices }
            : {}),
          ...(existing.data.rfidPunches !== undefined
            ? { rfidPunches: existing.data.rfidPunches }
            : {}),
          ...(existing.data.studentFines !== undefined
            ? { studentFines: existing.data.studentFines }
            : {}),
          ...(existing.data.liveMeetings !== undefined
            ? { liveMeetings: existing.data.liveMeetings }
            : {}),
          ...(existing.data.stockItems !== undefined
            ? { stockItems: existing.data.stockItems }
            : {}),
          ...(existing.data.stockMovements !== undefined
            ? { stockMovements: existing.data.stockMovements }
            : {}),
          ...(existing.data.questionBank !== undefined
            ? { questionBank: existing.data.questionBank }
            : {}),
          ...(existing.data.jobVacancies !== undefined
            ? { jobVacancies: existing.data.jobVacancies }
            : {}),
          ...(existing.data.jobApplications !== undefined
            ? { jobApplications: existing.data.jobApplications }
            : {}),
          ...(existing.data.websiteConfig !== undefined
            ? { websiteConfig: existing.data.websiteConfig }
            : {}),
          ...(existing.data.accountingBook !== undefined
            ? { accountingBook: existing.data.accountingBook }
            : {}),
          ...(existing.data.payrollBook !== undefined
            ? { payrollBook: existing.data.payrollBook }
            : {}),
          ...(existing.data.examBook !== undefined
            ? { examBook: existing.data.examBook }
            : {}),
          ...(existing.data.chats !== undefined
            ? { chats: existing.data.chats }
            : {}),
          ...(existing.data.libraryCirculation !== undefined
            ? { libraryCirculation: existing.data.libraryCirculation }
            : {}),
          ...(existing.data.transportBook !== undefined
            ? { transportBook: existing.data.transportBook }
            : {}),
          ...(existing.data.assignments !== undefined
            ? { assignments: existing.data.assignments }
            : {}),
          ...(existing.data.canteenWallets !== undefined
            ? {
                // Keep existing wallet balances server-authoritative; allow Admin to append starter wallets for newly added/CSV-imported students
                canteenWallets: (() => {
                  const prevWallets = asRecArray(existing.data.canteenWallets)
                  if (session.role !== 'admin' || !Array.isArray(body.data.canteenWallets)) {
                    return prevWallets
                  }
                  const existingIds = new Set(prevWallets.map((w) => String(w.studentId || '')))
                  const brandNewWallets = asRecArray(body.data.canteenWallets).filter(
                    (w) => w.studentId && !existingIds.has(String(w.studentId)),
                  )
                  return [...prevWallets, ...brandNewWallets]
                })(),
              }
            : {}),
          ...(existing.data.canteenTransactions !== undefined
            ? { canteenTransactions: existing.data.canteenTransactions }
            : {}),
          ...(existing.data.expenses !== undefined
            ? { expenses: existing.data.expenses }
            : {}),
          ...(existing.data.otherIncomes !== undefined
            ? { otherIncomes: existing.data.otherIncomes }
            : {}),
        }
      : body.data

    if (session.role !== 'admin') {
      const canManagePayroll =
        session.role === 'staff' &&
        staffHasServerPermission(session.linked_entity_id, 'payroll')
      const canManageAccounts =
        session.role === 'staff' &&
        staffHasServerPermission(session.linked_entity_id, 'accounts')
      const canManageAdmissions =
        session.role === 'staff' &&
        staffHasServerPermission(session.linked_entity_id, 'admissions')

      if (existing.exists && existing.data) {
        payloadToSave = {
          ...payloadToSave,
          campusWifiConfig: existing.data.campusWifiConfig ?? body.data.campusWifiConfig,
          customRoles: existing.data.customRoles ?? body.data.customRoles,
          staffMembers: existing.data.staffMembers ?? body.data.staffMembers,
          quizzes: existing.data.quizzes ?? body.data.quizzes,
          quizAttempts: existing.data.quizAttempts ?? body.data.quizAttempts,
          merits: existing.data.merits ?? body.data.merits,
          houseStandings: existing.data.houseStandings ?? body.data.houseStandings,
          studentAchievements: existing.data.studentAchievements ?? body.data.studentAchievements,
          pastPapers: existing.data.pastPapers ?? body.data.pastPapers,
          feedback: existing.data.feedback ?? body.data.feedback,
          semesterEvaluations: existing.data.semesterEvaluations ?? body.data.semesterEvaluations,
          courseMaterials: existing.data.courseMaterials ?? body.data.courseMaterials,
          semesterSyllabusConfig:
            existing.data.semesterSyllabusConfig ?? body.data.semesterSyllabusConfig,
          teacherSalaries: canManagePayroll
            ? body.data.teacherSalaries
            : existing.data.teacherSalaries ?? body.data.teacherSalaries,
          admissions: canManageAdmissions
            ? body.data.admissions
            : existing.data.admissions ?? body.data.admissions,
        }

        // Preserve notifications from other roles so filtered clients never delete other roles' notifications
        if (Array.isArray(existing.data.notifications) && Array.isArray(body.data.notifications)) {
          const existingNotifs = asRecArray(existing.data.notifications)
          const incomingNotifs = asRecArray(body.data.notifications)
          const incomingById = new Map<string, Record<string, unknown>>()
          incomingNotifs.forEach((n) => {
            if (n.id) incomingById.set(String(n.id), n)
          })
          const existingIds = new Set(existingNotifs.map((n) => String(n.id || '')))
          const newlyAdded = incomingNotifs.filter((n) => n.id && !existingIds.has(String(n.id)))
          const updatedExisting = existingNotifs.map((n) => {
            const match = n.id ? incomingById.get(String(n.id)) : undefined
            return match ? { ...n, read: match.read } : n
          })
          payloadToSave.notifications = [...newlyAdded, ...updatedExisting].slice(0, 200)
        }

        // For Guardian & Student sessions: strictly merge family-scoped arrays so filtered payloads
        // can NEVER overwrite or delete other families' or school-wide records.
        if (session.role === 'guardian' || session.role === 'student') {
          const { allowedIds, guardianId } = resolveActorStudentIds(
            existing.data,
            session.role,
            session.linked_entity_id,
          )
          const ownStu = (item: Record<string, unknown>) =>
            allowedIds.has(String(item.studentId || ''))

          payloadToSave = {
            ...payloadToSave,
            fees:
              session.role === 'guardian'
                ? mergeScopedArray(existing.data.fees, body.data.fees, ownStu)
                : existing.data.fees ?? body.data.fees,
            leaveRequests: mergeScopedArray(
              existing.data.leaveRequests,
              body.data.leaveRequests,
              ownStu,
            ),
            ptmRequests:
              session.role === 'guardian'
                ? mergeScopedArray(existing.data.ptmRequests, body.data.ptmRequests, ownStu)
                : existing.data.ptmRequests ?? body.data.ptmRequests,
            unitTransferRequests: mergeScopedArray(
              existing.data.unitTransferRequests,
              body.data.unitTransferRequests,
              ownStu,
            ),
            consentForms: mergeScopedArray(
              existing.data.consentForms,
              body.data.consentForms,
              ownStu,
            ),
            dismissalLogs: mergeScopedArray(
              existing.data.dismissalLogs,
              body.data.dismissalLogs,
              ownStu,
            ),
            medicalLogs: mergeScopedArray(
              existing.data.medicalLogs,
              body.data.medicalLogs,
              ownStu,
            ),
            pickupContacts: mergeScopedArray(
              existing.data.pickupContacts,
              body.data.pickupContacts,
              ownStu,
            ),
            canteenWallets: mergeScopedArray(
              existing.data.canteenWallets,
              body.data.canteenWallets,
              ownStu,
            ),
            canteenTransactions: mergeScopedArray(
              existing.data.canteenTransactions,
              body.data.canteenTransactions,
              ownStu,
            ),
            examSheets: mergeScopedArray(existing.data.examSheets, body.data.examSheets, ownStu),
            qrScans: mergeScopedArray(existing.data.qrScans, body.data.qrScans, ownStu),
            parentAlerts: existing.data.parentAlerts ?? body.data.parentAlerts,
            issuedDocuments: existing.data.issuedDocuments ?? body.data.issuedDocuments,
            teacherLeaves: existing.data.teacherLeaves ?? body.data.teacherLeaves,
            teacherAttendance: existing.data.teacherAttendance ?? body.data.teacherAttendance,
            teacherTrainings: existing.data.teacherTrainings ?? body.data.teacherTrainings,
            guardians: asRecArray(existing.data.guardians).map((eg) => {
              if (session.role === 'guardian' && String(eg.id || '') === guardianId) {
                const inc = asRecArray(body.data?.guardians).find(
                  (ig) => String(ig.id || '') === guardianId,
                )
                return inc ? { ...eg, ...inc, linkedStudentIds: eg.linkedStudentIds } : eg
              }
              return eg
            }),
          }
        }
      }
    }

    const actorLabel = `${session.display_name} (${session.role})`
    const saved = savePersistedState(
      payloadToSave,
      body.updatedBy || actorLabel,
      typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
    )

    if (saved.conflict) {
      return NextResponse.json(
        {
          ok: false,
          conflict: true,
          currentVersion: saved.version,
          updatedAt: saved.updatedAt,
          error: 'Newer state exists on the server. Auto-syncing latest data.',
        },
        { status: 409 },
      )
    }

    const isAdmin = session.role === 'admin'
    const stats = isAdmin ? getDbStats() : undefined

    // Broadcast live SSE push to all connected Desktop & Mobile screens
    broadcastDmhsEvent({
      type: 'state_updated',
      version: saved.version,
      updatedAt: saved.updatedAt,
      updatedBy: body.updatedBy || actorLabel,
      sourceClientId: body.clientId,
      summary: body.summary,
    })

    return NextResponse.json({
      ok: true,
      version: saved.version,
      updatedAt: saved.updatedAt,
      ...(isAdmin ? { connectedDevices: getConnectedDevicesCount(), stats } : {}),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Database write failed' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuthSession(['admin'])
    if (!auth.ok) return auth.response
    const { session } = auth

    resetPersistedState()
    appendSecurityAudit({
      action: 'database_state_reset',
      target: 'school_state',
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: getClientIpFromRequest(request),
    })

    const stats = getDbStats()
    return NextResponse.json({ ok: true, stats })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Database reset failed' },
      { status: 500 },
    )
  }
}
