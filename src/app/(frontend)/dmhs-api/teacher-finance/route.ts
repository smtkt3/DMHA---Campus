import { NextResponse } from 'next/server'
import { loadAccountingBookSafe } from '@/lib/dmhs-auto-voucher'
import { appendAutoDebitVoucher } from '@/lib/dmhs-debit-voucher'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'
import type {
  AllowanceDutyType,
  ReimbursementCategory,
  TeacherAllowanceClaimItem,
  TeacherPayoutProfile,
  TeacherReimbursementItem,
  TeacherSalaryAdvanceItem,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const VALID_REIMB_CATS = new Set<ReimbursementCategory>([
  'Classroom Supplies',
  'Science Lab Consumables',
  'Exam Printing & Copies',
  'Field Trip & Transport',
  'Training & Workshop',
  'Teaching Aids & Books',
])

const VALID_DUTY_TYPES = new Set<AllowanceDutyType>([
  'Exam Invigilation Duty',
  'Extra / Substitution Class',
  'After-School Coaching / Club',
  'Exam Paper Moderation',
  'Campus Event / Sports Duty',
])

interface TeacherLite {
  id: string
  name: string
  subject?: string
  department?: string
}

function buildSeedFinanceData(teachers: TeacherLite[]) {
  const today = getTodayIso()
  const t1 = teachers[0] || { id: 'tch-nadia', name: 'Nadia Rahman' }
  const t2 = teachers[1] || { id: 'tch-sakib', name: 'Sakib Hasan' }

  const reimbursements: TeacherReimbursementItem[] = [
    {
      id: 'reimb-seed-1',
      teacherId: t1.id,
      teacherName: t1.name,
      category: 'Science Lab Consumables',
      title: 'Optical Prism & Circuit Wires for Class 6 Physics Lab',
      amount: 1450,
      expenseDate: shiftIso(today, -3),
      receiptRef: 'INV-SCI-8841',
      notes: 'Purchased from New Market Scientific Store for Unit 3 practical demo.',
      status: 'approved',
      adminNote: 'Verified by Principal Shahid — queued for bank transfer.',
      submittedAt: shiftIso(today, -3),
    },
    {
      id: 'reimb-seed-2',
      teacherId: t1.id,
      teacherName: t1.name,
      category: 'Classroom Supplies',
      title: 'Whiteboard Markers, Graph Charts & Geometry Kit',
      amount: 680,
      expenseDate: shiftIso(today, -12),
      receiptRef: 'INV-STA-3210',
      notes: 'Used across Class 6A & 6B sessions.',
      status: 'paid',
      adminNote: 'Paid with November disbursement.',
      submittedAt: shiftIso(today, -12),
      paidAt: shiftIso(today, -8),
    },
    {
      id: 'reimb-seed-3',
      teacherId: t2.id,
      teacherName: t2.name,
      category: 'Exam Printing & Copies',
      title: 'Class 5 & 6 Mathematics Practice Worksheet Prints',
      amount: 920,
      expenseDate: shiftIso(today, -2),
      receiptRef: 'PRT-4092',
      notes: '120 double-sided revision booklets.',
      status: 'pending',
      submittedAt: shiftIso(today, -2),
    },
  ]

  const advances: TeacherSalaryAdvanceItem[] = [
    {
      id: 'adv-seed-1',
      teacherId: t1.id,
      teacherName: t1.name,
      amount: 12000,
      repaymentMonths: 3,
      monthlyInstallment: 4000,
      paidInstallments: 2,
      reason: 'Personal laptop repair for digital lesson preparation',
      requestDate: shiftIso(today, -62),
      status: 'disbursed',
      adminNote: 'Approved · ৳4,000/month auto-deducted for 3 months.',
      disbursedAt: shiftIso(today, -60),
    },
  ]

  const allowances: TeacherAllowanceClaimItem[] = [
    {
      id: 'alw-seed-1',
      teacherId: t1.id,
      teacherName: t1.name,
      dutyType: 'Exam Invigilation Duty',
      dutyDate: shiftIso(today, -4),
      hoursOrSessions: '2 Exam Sessions (4 hrs)',
      amount: 1600,
      notes: 'Mid-Term Science & Math Hall Invigilation (Room 204).',
      status: 'paid',
      adminNote: 'Credited via Payroll.',
      submittedAt: shiftIso(today, -4),
      paidAt: shiftIso(today, -1),
    },
    {
      id: 'alw-seed-2',
      teacherId: t1.id,
      teacherName: t1.name,
      dutyType: 'Extra / Substitution Class',
      dutyDate: shiftIso(today, -1),
      hoursOrSessions: '2 Extra Periods',
      amount: 1000,
      notes: 'Covered Class 5B Math & Science revision periods.',
      status: 'pending',
      submittedAt: shiftIso(today, -1),
    },
    {
      id: 'alw-seed-3',
      teacherId: t2.id,
      teacherName: t2.name,
      dutyType: 'After-School Coaching / Club',
      dutyDate: shiftIso(today, -2),
      hoursOrSessions: '3 hrs Math Olympiad Prep',
      amount: 1500,
      notes: 'Prepared Class 6 team for Inter-School Math Olympiad.',
      status: 'approved',
      adminNote: 'Approved by Admin.',
      submittedAt: shiftIso(today, -2),
    },
  ]

  const payoutProfiles: TeacherPayoutProfile[] = teachers.map((t, idx) => ({
    teacherId: t.id,
    teacherName: t.name,
    bankName: idx % 2 === 0 ? 'BRAC Bank PLC · Dhanmondi Branch' : 'City Bank PLC · Gulshan Branch',
    accountTitle: t.name,
    accountNumber: `1504-2048-${String(1100 + idx * 137)}`,
    routingNumber: idx % 2 === 0 ? '060261188' : '225261724',
    mfsProvider: idx % 2 === 0 ? 'bKash' : 'Nagad',
    mfsNumber: `01712-900${String(111 + idx * 111).slice(0, 3)}`,
    preferredMethod: 'Bank Transfer',
    tinNumber: `TIN-BD-482910${String(340 + idx * 19)}`,
    pfEmployeePercent: 5,
    pfSchoolMatchPercent: 5,
    pfAccumulatedBdt: 96000 + idx * 18500,
    updatedAt: today,
  }))

  return { reimbursements, advances, allowances, payoutProfiles }
}

function canManageAllFinance(role: string, linkedEntityId: string): boolean {
  if (role === 'admin') return true
  if (role === 'staff') {
    return (
      staffHasServerPermission(linkedEntityId, 'payroll') ||
      staffHasServerPermission(linkedEntityId, 'accounts')
    )
  }
  return false
}

function loadAndEnsureFinanceState(currentData: Record<string, unknown>) {
  const teachers: TeacherLite[] = Array.isArray(currentData.teachers)
    ? (currentData.teachers as TeacherLite[])
    : []
  const seeded = buildSeedFinanceData(teachers)

  const hasReimb = Array.isArray(currentData.teacherReimbursements)
  const hasAdv = Array.isArray(currentData.teacherAdvances)
  const hasAlw = Array.isArray(currentData.teacherAllowances)
  const hasProfiles = Array.isArray(currentData.teacherPayoutProfiles)

  const reimbursements = hasReimb
    ? (currentData.teacherReimbursements as TeacherReimbursementItem[])
    : seeded.reimbursements
  const advances = hasAdv
    ? (currentData.teacherAdvances as TeacherSalaryAdvanceItem[])
    : seeded.advances
  const allowances = hasAlw
    ? (currentData.teacherAllowances as TeacherAllowanceClaimItem[])
    : seeded.allowances
  const payoutProfiles = hasProfiles
    ? (currentData.teacherPayoutProfiles as TeacherPayoutProfile[])
    : seeded.payoutProfiles

  return {
    teachers,
    reimbursements,
    advances,
    allowances,
    payoutProfiles,
    needsSeedSave: !(hasReimb && hasAdv && hasAlw && hasProfiles),
  }
}

export async function GET() {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth

    const isFinanceAdmin = canManageAllFinance(session.role, session.linked_entity_id)
    if (session.role === 'staff' && !isFinanceAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Your staff role does not have Faculty Finance / Payroll permission.' },
        { status: 403 },
      )
    }

    const persisted = loadPersistedState()
    if (!persisted.exists || !persisted.data) {
      return NextResponse.json({ ok: false, error: 'School state not initialized.' }, { status: 400 })
    }

    const currentData = persisted.data
    const fin = loadAndEnsureFinanceState(currentData)

    if (fin.needsSeedSave) {
      savePersistedState(
        {
          ...currentData,
          teacherReimbursements: fin.reimbursements,
          teacherAdvances: fin.advances,
          teacherAllowances: fin.allowances,
          teacherPayoutProfiles: fin.payoutProfiles,
        },
        'system (seed-teacher-finance)',
      )
    }

    const myId = session.linked_entity_id
    return NextResponse.json({
      ok: true,
      canManageAll: isFinanceAdmin,
      reimbursements: isFinanceAdmin
        ? fin.reimbursements
        : fin.reimbursements.filter((r) => r.teacherId === myId),
      advances: isFinanceAdmin
        ? fin.advances
        : fin.advances.filter((a) => a.teacherId === myId),
      allowances: isFinanceAdmin
        ? fin.allowances
        : fin.allowances.filter((a) => a.teacherId === myId),
      payoutProfiles: isFinanceAdmin
        ? fin.payoutProfiles
        : fin.payoutProfiles.filter((p) => p.teacherId === myId),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to load faculty finance.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const isFinanceAdmin = canManageAllFinance(session.role, session.linked_entity_id)
    if (session.role === 'staff' && !isFinanceAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: payroll or accounts permission required.' },
        { status: 403 },
      )
    }

    const body = (await request.json()) as Record<string, unknown>
    const kind = String(body.kind || '')

    const persisted = loadPersistedState()
    if (!persisted.exists || !persisted.data) {
      return NextResponse.json({ ok: false, error: 'School state not initialized.' }, { status: 400 })
    }
    const currentData = persisted.data
    const fin = loadAndEnsureFinanceState(currentData)
    const today = getTodayIso()

    // Determine target teacher (Teachers can ONLY submit for themselves!)
    const requestedTeacherId = String(body.teacherId || '').trim()
    const targetTeacherId =
      session.role === 'teacher'
        ? session.linked_entity_id
        : requestedTeacherId || fin.teachers[0]?.id || 'tch-nadia'

    if (session.role === 'teacher' && requestedTeacherId && requestedTeacherId !== session.linked_entity_id) {
      return NextResponse.json(
        { ok: false, error: 'Teachers can only submit finance records for their own account.' },
        { status: 403 },
      )
    }

    const teacherObj = fin.teachers.find((t) => t.id === targetTeacherId)
    const teacherName = teacherObj?.name || session.display_name

    let nextReimb = [...fin.reimbursements]
    let nextAdv = [...fin.advances]
    let nextAlw = [...fin.allowances]
    let nextProfiles = [...fin.payoutProfiles]
    let auditAction = 'teacher_finance_updated'
    let auditTarget = ''
    let message = 'Finance entry saved.'

    if (kind === 'reimbursement') {
      const category = String(body.category || '') as ReimbursementCategory
      const title = String(body.title || '').trim()
      const amount = Math.round(Number(body.amount) || 0)
      const expenseDate =
        typeof body.expenseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.expenseDate)
          ? body.expenseDate
          : today
      const receiptRef = String(body.receiptRef || '').trim() || `REC-${Date.now().toString().slice(-5)}`
      const receiptUrl = typeof body.receiptUrl === 'string' && body.receiptUrl.trim() ? body.receiptUrl.trim() : undefined
      const notes = String(body.notes || '').trim()

      if (!VALID_REIMB_CATS.has(category) || !title || amount <= 0 || amount > 500000) {
        return NextResponse.json(
          { ok: false, error: 'Valid category, title, and positive amount (৳1–৳500,000) are required.' },
          { status: 400 },
        )
      }

      const item: TeacherReimbursementItem = {
        id: `reimb-${Date.now()}`,
        teacherId: targetTeacherId,
        teacherName,
        category,
        title: title.slice(0, 140),
        amount,
        expenseDate,
        receiptRef: receiptRef.slice(0, 60),
        receiptUrl,
        notes: notes.slice(0, 400),
        status: 'pending',
        submittedAt: today,
      }
      nextReimb = [item, ...nextReimb]
      auditAction = 'teacher_reimbursement_submitted'
      auditTarget = `${teacherName} · ${category} · ৳${amount} (${title})`
      message = `Reimbursement claim (৳${amount.toLocaleString()}) submitted for Admin/Accounts review.`
    } else if (kind === 'advance') {
      const amount = Math.round(Number(body.amount) || 0)
      const repaymentMonths = Math.min(12, Math.max(1, Math.round(Number(body.repaymentMonths) || 1)))
      const reason = String(body.reason || '').trim()
      if (!reason || amount < 500 || amount > 200000) {
        return NextResponse.json(
          { ok: false, error: 'Provide a reason and valid advance amount (৳500–৳200,000).' },
          { status: 400 },
        )
      }
      const monthlyInstallment = Math.ceil(amount / repaymentMonths)
      const item: TeacherSalaryAdvanceItem = {
        id: `adv-${Date.now()}`,
        teacherId: targetTeacherId,
        teacherName,
        amount,
        repaymentMonths,
        monthlyInstallment,
        paidInstallments: 0,
        reason: reason.slice(0, 300),
        requestDate: today,
        status: 'pending',
      }
      nextAdv = [item, ...nextAdv]
      auditAction = 'teacher_salary_advance_requested'
      auditTarget = `${teacherName} · ৳${amount} over ${repaymentMonths} mo`
      message = `Salary advance request (৳${amount.toLocaleString()} · ৳${monthlyInstallment.toLocaleString()}/mo) submitted.`
    } else if (kind === 'allowance') {
      const dutyType = String(body.dutyType || '') as AllowanceDutyType
      const dutyDate =
        typeof body.dutyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dutyDate)
          ? body.dutyDate
          : today
      const hoursOrSessions = String(body.hoursOrSessions || '').trim() || '1 Session'
      const amount = Math.round(Number(body.amount) || 0)
      const notes = String(body.notes || '').trim()

      if (!VALID_DUTY_TYPES.has(dutyType) || amount <= 0 || amount > 100000) {
        return NextResponse.json(
          { ok: false, error: 'Valid duty type and positive allowance amount are required.' },
          { status: 400 },
        )
      }

      const item: TeacherAllowanceClaimItem = {
        id: `alw-${Date.now()}`,
        teacherId: targetTeacherId,
        teacherName,
        dutyType,
        dutyDate,
        hoursOrSessions: hoursOrSessions.slice(0, 60),
        amount,
        notes: notes.slice(0, 300),
        status: 'pending',
        submittedAt: today,
      }
      nextAlw = [item, ...nextAlw]
      auditAction = 'teacher_allowance_claimed'
      auditTarget = `${teacherName} · ${dutyType} · ৳${amount} (${dutyDate})`
      message = `${dutyType} allowance claim (৳${amount.toLocaleString()}) logged in SQLite.`
    } else if (kind === 'payout_profile') {
      const existing = nextProfiles.find((p) => p.teacherId === targetTeacherId)
      const updated: TeacherPayoutProfile = {
        teacherId: targetTeacherId,
        teacherName,
        bankName: String(body.bankName || existing?.bankName || '').trim().slice(0, 120),
        accountTitle: String(body.accountTitle || existing?.accountTitle || teacherName)
          .trim()
          .slice(0, 100),
        accountNumber: String(body.accountNumber || existing?.accountNumber || '').trim().slice(0, 50),
        routingNumber: String(body.routingNumber || existing?.routingNumber || '').trim().slice(0, 30),
        mfsProvider: (['bKash', 'Nagad', 'Rocket', 'None'].includes(String(body.mfsProvider))
          ? String(body.mfsProvider)
          : existing?.mfsProvider || 'bKash') as TeacherPayoutProfile['mfsProvider'],
        mfsNumber: String(body.mfsNumber || existing?.mfsNumber || '').trim().slice(0, 30),
        preferredMethod:
          body.preferredMethod === 'MFS (bKash/Nagad)' ? 'MFS (bKash/Nagad)' : 'Bank Transfer',
        tinNumber: String(body.tinNumber || existing?.tinNumber || '').trim().slice(0, 50),
        pfEmployeePercent: existing?.pfEmployeePercent ?? 5,
        pfSchoolMatchPercent: existing?.pfSchoolMatchPercent ?? 5,
        pfAccumulatedBdt: existing?.pfAccumulatedBdt ?? 96000,
        updatedAt: today,
      }
      nextProfiles = existing
        ? nextProfiles.map((p) => (p.teacherId === targetTeacherId ? updated : p))
        : [updated, ...nextProfiles]
      auditAction = 'teacher_payout_profile_updated'
      auditTarget = `${teacherName} · ${updated.preferredMethod} (${updated.bankName || updated.mfsProvider})`
      message = 'Bank, MFS & TIN payout profile saved to SQLite.'
    } else {
      return NextResponse.json({ ok: false, error: 'Unsupported finance submission kind.' }, { status: 400 })
    }

    const saved = savePersistedState(
      {
        ...currentData,
        teacherReimbursements: nextReimb,
        teacherAdvances: nextAdv,
        teacherAllowances: nextAlw,
        teacherPayoutProfiles: nextProfiles,
      },
      `${session.display_name} (${session.role})`,
    )

    appendSecurityAudit({
      action: auditAction,
      target: auditTarget,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: ip,
    })

    broadcastDmhsEvent({
      type: 'state_updated',
      version: saved.version,
      updatedAt: saved.updatedAt,
      updatedBy: session.display_name,
      summary: message,
    })

    const myId = session.linked_entity_id
    return NextResponse.json({
      ok: true,
      message,
      version: saved.version,
      reimbursements: isFinanceAdmin ? nextReimb : nextReimb.filter((r) => r.teacherId === myId),
      advances: isFinanceAdmin ? nextAdv : nextAdv.filter((a) => a.teacherId === myId),
      allowances: isFinanceAdmin ? nextAlw : nextAlw.filter((a) => a.teacherId === myId),
      payoutProfiles: isFinanceAdmin
        ? nextProfiles
        : nextProfiles.filter((p) => p.teacherId === myId),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to save finance record.' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    if (!canManageAllFinance(session.role, session.linked_entity_id)) {
      return NextResponse.json(
        { ok: false, error: 'Only Admin or Payroll/Accounts staff can approve or disburse faculty finance.' },
        { status: 403 },
      )
    }

    const body = (await request.json()) as {
      kind?: 'reimbursement' | 'advance' | 'allowance'
      id?: string
      action?: 'approve' | 'pay' | 'decline' | 'record_installment'
      adminNote?: string
    }

    const kind = body.kind
    const id = String(body.id || '').trim()
    const action = body.action
    const adminNote = String(body.adminNote || '').trim().slice(0, 240)

    if (!kind || !id || !action) {
      return NextResponse.json(
        { ok: false, error: 'kind, id, and action are required.' },
        { status: 400 },
      )
    }

    const persisted = loadPersistedState()
    if (!persisted.exists || !persisted.data) {
      return NextResponse.json({ ok: false, error: 'School state not initialized.' }, { status: 400 })
    }
    const currentData = persisted.data
    const fin = loadAndEnsureFinanceState(currentData)
    const today = getTodayIso()

    let nextReimb = [...fin.reimbursements]
    let nextAdv = [...fin.advances]
    let nextAlw = [...fin.allowances]
    let nextExpenses = Array.isArray(currentData.expenses)
      ? [...(currentData.expenses as Array<Record<string, unknown>>)]
      : []
    let nextAccountingBook = loadAccountingBookSafe(currentData)
    let postedVoucherNo: string | undefined

    let message = 'Updated.'
    let auditTarget = ''

    if (kind === 'reimbursement') {
      const target = nextReimb.find((r) => r.id === id)
      if (!target) return NextResponse.json({ ok: false, error: 'Claim not found.' }, { status: 404 })
      const nextStatus: TeacherReimbursementItem['status'] =
        action === 'approve' ? 'approved' : action === 'pay' ? 'paid' : 'declined'
      nextReimb = nextReimb.map((r) =>
        r.id === id
          ? {
              ...r,
              status: nextStatus,
              adminNote:
                adminNote ||
                (nextStatus === 'paid'
                  ? `Reimbursed by ${session.display_name}`
                  : nextStatus === 'approved'
                    ? `Approved by ${session.display_name}`
                    : `Declined by ${session.display_name}`),
              paidAt: nextStatus === 'paid' ? today : r.paidAt,
            }
          : r,
      )
      if (nextStatus === 'paid' && target.status !== 'paid') {
        const posted = appendAutoDebitVoucher(nextAccountingBook, {
          amount: target.amount,
          title: `Faculty Reimbursement · ${target.teacherName} (${target.title})`,
          category: target.category === 'Science Lab Consumables' ? 'Lab & Books' : 'Events & Supplies',
          vendor: target.teacherName,
          paymentMethod: 'Bank',
          actorName: session.display_name,
        })
        nextAccountingBook = posted.nextBook
        postedVoucherNo = posted.voucher.voucherNo
        nextExpenses = [
          {
            id: `exp-reimb-${Date.now()}`,
            title: `Faculty Reimbursement · ${target.teacherName} (${target.title})`,
            category: target.category === 'Science Lab Consumables' ? 'Lab & Books' : 'Events & Supplies',
            vendor: target.teacherName,
            amount: target.amount,
            date: today,
            status: 'paid',
            approvedBy: session.display_name,
            voucherNo: postedVoucherNo,
          },
          ...nextExpenses,
        ]
      }
      auditTarget = `Reimbursement ${target.teacherName} ৳${target.amount} -> ${nextStatus}`
      message =
        nextStatus === 'paid'
          ? `Marked reimbursement (৳${target.amount.toLocaleString()}) as Paid & logged in School Accounts.`
          : `Reimbursement ${nextStatus} for ${target.teacherName}.`
    } else if (kind === 'advance') {
      const target = nextAdv.find((a) => a.id === id)
      if (!target) return NextResponse.json({ ok: false, error: 'Advance request not found.' }, { status: 404 })
      if (action === 'record_installment') {
        const nextPaid = Math.min(target.repaymentMonths, target.paidInstallments + 1)
        const fullyPaid = nextPaid >= target.repaymentMonths
        nextAdv = nextAdv.map((a) =>
          a.id === id
            ? {
                ...a,
                paidInstallments: nextPaid,
                status: fullyPaid ? 'repaid' : 'disbursed',
                adminNote:
                  adminNote ||
                  (fullyPaid
                    ? `Fully repaid (${nextPaid}/${a.repaymentMonths})`
                    : `Installment ${nextPaid}/${a.repaymentMonths} recorded`),
              }
            : a,
        )
        auditTarget = `Advance installment ${target.teacherName} (${nextPaid}/${target.repaymentMonths})`
        message = `Recorded installment ${nextPaid}/${target.repaymentMonths} for ${target.teacherName}.`
      } else {
        const nextStatus: TeacherSalaryAdvanceItem['status'] =
          action === 'approve' ? 'approved' : action === 'pay' ? 'disbursed' : 'declined'
        nextAdv = nextAdv.map((a) =>
          a.id === id
            ? {
                ...a,
                status: nextStatus,
                adminNote: adminNote || `${nextStatus.toUpperCase()} by ${session.display_name}`,
                disbursedAt: nextStatus === 'disbursed' ? today : a.disbursedAt,
              }
            : a,
        )
        if (nextStatus === 'disbursed' && target.status !== 'disbursed') {
          const posted = appendAutoDebitVoucher(nextAccountingBook, {
            amount: target.amount,
            title: `Faculty Salary Advance · ${target.teacherName}`,
            category: 'Teacher Payroll',
            vendor: target.teacherName,
            paymentMethod: 'Bank',
            actorName: session.display_name,
          })
          nextAccountingBook = posted.nextBook
          postedVoucherNo = posted.voucher.voucherNo
        }
        auditTarget = `Salary Advance ${target.teacherName} ৳${target.amount} -> ${nextStatus}`
        message = `Salary advance (৳${target.amount.toLocaleString()}) marked ${nextStatus}${postedVoucherNo ? ` · Auto-Voucher ${postedVoucherNo}` : ''}.`
      }
    } else if (kind === 'allowance') {
      const target = nextAlw.find((a) => a.id === id)
      if (!target) return NextResponse.json({ ok: false, error: 'Allowance claim not found.' }, { status: 404 })
      const nextStatus: TeacherAllowanceClaimItem['status'] =
        action === 'approve' ? 'approved' : action === 'pay' ? 'paid' : 'declined'
      nextAlw = nextAlw.map((a) =>
        a.id === id
          ? {
              ...a,
              status: nextStatus,
              adminNote: adminNote || `${nextStatus.toUpperCase()} by ${session.display_name}`,
              paidAt: nextStatus === 'paid' ? today : a.paidAt,
            }
          : a,
      )
      if (nextStatus === 'paid' && target.status !== 'paid') {
        const posted = appendAutoDebitVoucher(nextAccountingBook, {
          amount: target.amount,
          title: `Faculty Allowance · ${target.teacherName} (${target.dutyType})`,
          category: 'Teacher Payroll',
          vendor: target.teacherName,
          paymentMethod: 'Bank',
          actorName: session.display_name,
        })
        nextAccountingBook = posted.nextBook
        postedVoucherNo = posted.voucher.voucherNo
        nextExpenses = [
          {
            id: `exp-alw-${Date.now()}`,
            title: `Faculty Allowance · ${target.teacherName} (${target.dutyType})`,
            category: 'Teacher Payroll',
            vendor: target.teacherName,
            amount: target.amount,
            date: today,
            status: 'paid',
            approvedBy: session.display_name,
            voucherNo: postedVoucherNo,
          },
          ...nextExpenses,
        ]
      }
      auditTarget = `Allowance ${target.teacherName} ${target.dutyType} ৳${target.amount} -> ${nextStatus}`
      message =
        nextStatus === 'paid'
          ? `Disbursed ${target.dutyType} (৳${target.amount.toLocaleString()}) & auto-posted to Accounting (${postedVoucherNo || 'Ledger'}).`
          : `Allowance claim ${nextStatus} for ${target.teacherName}.`
    }

    const saved = savePersistedState(
      {
        ...currentData,
        teacherReimbursements: nextReimb,
        teacherAdvances: nextAdv,
        teacherAllowances: nextAlw,
        expenses: nextExpenses,
        accountingBook: nextAccountingBook,
      },
      `${session.display_name} (${session.role})`,
    )

    appendSecurityAudit({
      action: `teacher_finance_${kind}_${action}`,
      target: auditTarget,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: ip,
    })

    broadcastDmhsEvent({
      type: 'state_updated',
      version: saved.version,
      updatedAt: saved.updatedAt,
      updatedBy: session.display_name,
      summary: message,
    })

    return NextResponse.json({
      ok: true,
      message,
      voucherNo: postedVoucherNo,
      version: saved.version,
      reimbursements: nextReimb,
      advances: nextAdv,
      allowances: nextAlw,
      expenses: nextExpenses,
      accountingBook: nextAccountingBook,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to update finance record.' },
      { status: 500 },
    )
  }
}
