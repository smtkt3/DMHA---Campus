import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
  upsertUserAccountAndPassword,
} from '@/lib/dmhs-db'
import { appendAutoCreditVoucher, loadAccountingBookSafe } from '@/lib/dmhs-auto-voucher'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'
import type {
  AdmissionApplication,
  CanteenWallet,
  FeeInvoice,
  GuardianRecord,
  HouseName,
  OtherIncomeRecord,
  StudentRecord,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'DM'
  )
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth

    if (
      session.role === 'staff' &&
      !staffHasServerPermission(session.linked_entity_id, 'admissions') &&
      !staffHasServerPermission(session.linked_entity_id, 'accounts')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Access Denied: Admissions or Accounts permission required.' },
        { status: 403 },
      )
    }

    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const admissions: AdmissionApplication[] = Array.isArray(currentData.admissions)
      ? (currentData.admissions as AdmissionApplication[])
      : []
    const students: StudentRecord[] = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const guardians: GuardianRecord[] = Array.isArray(currentData.guardians)
      ? (currentData.guardians as GuardianRecord[])
      : []
    const otherIncomes: OtherIncomeRecord[] = Array.isArray(currentData.otherIncomes)
      ? (currentData.otherIncomes as OtherIncomeRecord[])
      : []
    const canteenWallets: CanteenWallet[] = Array.isArray(currentData.canteenWallets)
      ? (currentData.canteenWallets as CanteenWallet[])
      : []
    const fees: FeeInvoice[] = Array.isArray(currentData.fees)
      ? (currentData.fees as FeeInvoice[])
      : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []
    const accountingBook = loadAccountingBookSafe(currentData)
    const todayLabel = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

    // 1. Collect Admission Fee -> Auto-posts Balanced Credit Voucher to Accounting Ledger
    if (action === 'mark_fee_paid') {
      const appId = String(body.appId || '')
      const target = admissions.find((a) => a.id === appId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Application not found.' }, { status: 404 })
      }
      if (target.admissionFeePaid) {
        return NextResponse.json({ ok: true, alreadyPaid: true, admissions, accountingBook })
      }

      const amount = Math.max(0, Math.round(Number(target.admissionFeeAmount || 0)))
      const posted = appendAutoCreditVoucher(accountingBook, {
        amount,
        title: `Admission Fee — ${target.applicantName} (${target.applicationCode})`,
        category: 'Admission Fee',
        paymentMethod: String(body.paymentMethod || 'Cash'),
        receiptNo: target.applicationCode,
        partyName: `${target.applicantName} (${target.guardianName})`,
        actorName: session.display_name,
      })

      const incomeRec: OtherIncomeRecord = {
        id: `inc-adm-${Date.now()}`,
        title: `Admission Fee — ${target.applicantName} (${target.applicationCode})`,
        category: 'Admission Form Sales',
        amount,
        date: todayLabel,
        voucherNo: posted.voucher.voucherNo,
      }

      const nextAdmissions = admissions.map((a) =>
        a.id === appId
          ? { ...a, admissionFeePaid: true, admissionVoucherNo: posted.voucher.voucherNo }
          : a,
      )

      const saved = savePersistedState(
        {
          ...currentData,
          admissions: nextAdmissions,
          otherIncomes: [incomeRec, ...otherIncomes],
          accountingBook: posted.nextBook,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'admission_fee_collected',
        target: `${target.applicantName} (${target.applicationCode}) · ৳${amount} · ${posted.voucher.voucherNo}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Admission fee collected for ${target.applicantName} (${posted.voucher.voucherNo})`,
      })

      return NextResponse.json({
        ok: true,
        voucherNo: posted.voucher.voucherNo,
        admissions: nextAdmissions,
        otherIncomes: [incomeRec, ...otherIncomes],
        accountingBook: posted.nextBook,
        version: saved.version,
      })
    }

    // 2. 1-Click Enroll Applicant -> Creates Student, Guardian, Canteen Wallet, Fee Invoice & REAL SQLite Login Credentials!
    if (action === 'enroll_applicant') {
      const appId = String(body.appId || '')
      const app = admissions.find((a) => a.id === appId)
      if (!app) {
        return NextResponse.json({ ok: false, error: 'Application not found.' }, { status: 404 })
      }
      if (app.stage === 'enrolled') {
        return NextResponse.json({
          ok: true,
          alreadyEnrolled: true,
          admissions,
          students,
          guardians,
        })
      }

      // 2a. Match or create Guardian + SQLite Auth Account
      const cleanPhone = (app.guardianPhone || '').replace(/\s+/g, '')
      const cleanEmail = (app.guardianEmail || '').trim().toLowerCase()
      let matchedGuardian = guardians.find(
        (g) =>
          (cleanPhone && (g.phone || '').replace(/\s+/g, '') === cleanPhone) ||
          (cleanEmail && (g.email || '').toLowerCase() === cleanEmail),
      )

      const studentId = `stu-${Date.now()}`
      const isNewGuardian = !matchedGuardian
      const guardianId = matchedGuardian ? matchedGuardian.id : `grd-${Date.now()}`
      let nextGuardians = guardians

      if (!matchedGuardian) {
        matchedGuardian = {
          id: guardianId,
          name: app.guardianName,
          initials: getInitials(app.guardianName),
          relation: app.guardianRelation || 'Parent',
          phone: app.guardianPhone || '+880 1700-000000',
          email:
            cleanEmail ||
            `${app.guardianName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@guardian.dmha.edu`,
          linkedStudentIds: [studentId],
          status: 'active',
        }
        nextGuardians = [matchedGuardian, ...guardians]
      } else {
        nextGuardians = guardians.map((g) =>
          g.id === guardianId && !g.linkedStudentIds.includes(studentId)
            ? { ...g, linkedStudentIds: [...g.linkedStudentIds, studentId] }
            : g,
        )
      }

      // Provision SQLite Guardian Auth Login
      const guardianAuth = upsertUserAccountAndPassword({
        linkedEntityId: guardianId,
        role: 'guardian',
        displayName: matchedGuardian.name,
        email: matchedGuardian.email,
        status: 'active',
        newPassword: isNewGuardian ? 'dmha2026' : undefined,
      })

      // 2b. Create Student Record + SQLite Student Auth Login
      const classCount = students.filter((s) => s.className === app.applyingClass).length
      const nextRoll = String(classCount + 11)
      const houses: HouseName[] = ['Emerald', 'Sapphire', 'Crimson', 'Gold']
      const assignedHouse = houses[students.length % houses.length]

      const baseScore = app.testScore || 85
      const scoreGrade = baseScore >= 80 ? 'A+' : baseScore >= 70 ? 'A' : baseScore >= 60 ? 'A-' : 'B'

      const newStudent: StudentRecord = {
        id: studentId,
        name: app.applicantName,
        initials: getInitials(app.applicantName),
        className: app.applyingClass,
        section: app.targetSection || 'Section A',
        roll: nextRoll,
        guardianId,
        guardianName: matchedGuardian.name,
        guardianPhone: matchedGuardian.phone,
        status: 'active',
        house: assignedHouse,
        todayStatus: 'present',
        gateCheckIn: '08:00 AM',
        attendanceRate: 100,
        presentDays: 1,
        totalDays: 1,
        gpa: '4.50',
        averageScore: baseScore,
        rank: 'New',
        bloodGroup: app.bloodGroup || 'O+',
        busRoute: app.busRoute || 'Unit - 1',
        subjects: [
          {
            id: `${studentId}-math`,
            name: 'Mathematics',
            teacher: 'Kamrul Hasan',
            section: app.targetSection || 'Section A',
            progress: 60,
            latestScore: baseScore,
            previousScore: baseScore,
            grade: scoreGrade,
            color: 'violet',
            nextTopic: 'Foundation Algebra & Geometry',
          },
          {
            id: `${studentId}-eng`,
            name: 'English',
            teacher: 'Farhana Karim',
            section: app.targetSection || 'Section A',
            progress: 65,
            latestScore: Math.min(100, baseScore + 2),
            previousScore: baseScore,
            grade: scoreGrade,
            color: 'cyan',
            nextTopic: 'Comprehension & Directed Writing',
          },
          {
            id: `${studentId}-sci`,
            name: 'Science',
            teacher: 'Nadia Rahman',
            section: app.targetSection || 'Section A',
            progress: 55,
            latestScore: Math.max(50, baseScore - 1),
            previousScore: baseScore,
            grade: scoreGrade,
            color: 'lime',
            nextTopic: 'Core Concepts & Lab Orientation',
          },
        ],
        todayPeriods: [
          {
            id: `${studentId}-p-0`,
            subject: 'English',
            teacher: 'Farhana Karim',
            room: 'Room 201',
            time: '08:15 AM',
            end: '09:00 AM',
            topic: 'Orientation & Reading',
            color: 'cyan',
            status: 'present',
          },
          {
            id: `${studentId}-p-1`,
            subject: 'Mathematics',
            teacher: 'Kamrul Hasan',
            room: 'Room 204',
            time: '09:05 AM',
            end: '09:50 AM',
            topic: 'Number Sense & Foundations',
            color: 'violet',
            status: 'present',
          },
        ],
      }

      const studentAuth = upsertUserAccountAndPassword({
        linkedEntityId: studentId,
        role: 'student',
        displayName: newStudent.name,
        email: `${newStudent.name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}.${nextRoll}@student.dmha.edu`,
        status: 'active',
        newPassword: 'dmha2026',
      })

      const newWallet: CanteenWallet = {
        studentId,
        balance: 500,
        dailyLimit: 250,
        allergyGuard: 'None reported',
      }

      const welcomeInvoice: FeeInvoice = {
        id: `fee-adm-${Date.now()}`,
        studentId,
        studentName: newStudent.name,
        title: `First Month Tuition — ${newStudent.className}`,
        category: 'Tuition Fee',
        amount: 6500,
        dueDate: '15th of Month',
        status: 'due',
      }

      const studentLoginCode = studentAuth.account?.loginCode || studentId.toUpperCase()
      const guardianLoginCode = guardianAuth.account?.loginCode || guardianId.toUpperCase()

      const nextAdmissions = admissions.map((a) =>
        a.id === appId
          ? {
              ...a,
              stage: 'enrolled' as const,
              enrolledStudentId: studentId,
              enrolledStudentLogin: studentLoginCode,
              enrolledGuardianLogin: guardianLoginCode,
            }
          : a,
      )

      const notif = {
        id: `notif-enr-${Date.now()}`,
        title: `New Student Enrolled · ${newStudent.name}`,
        text: `${newStudent.name} enrolled in ${newStudent.className} (Roll #${nextRoll}). Login IDs provisioned: ${studentLoginCode} & ${guardianLoginCode}.`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['admin', 'teacher'],
        read: false,
      }

      const saved = savePersistedState(
        {
          ...currentData,
          admissions: nextAdmissions,
          students: [newStudent, ...students],
          guardians: nextGuardians,
          canteenWallets: [newWallet, ...canteenWallets],
          fees: [welcomeInvoice, ...fees],
          notifications: [notif, ...existingNotifs].slice(0, 80),
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'applicant_enrolled',
        target: `${newStudent.name} -> ${newStudent.className} (${studentLoginCode} / ${guardianLoginCode})`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary: `Enrolled ${newStudent.name} (${studentLoginCode})`,
      })

      return NextResponse.json({
        ok: true,
        admissions: nextAdmissions,
        students: [newStudent, ...students],
        guardians: nextGuardians,
        canteenWallets: [newWallet, ...canteenWallets],
        fees: [welcomeInvoice, ...fees],
        createdCredentials: {
          studentLoginCode,
          guardianLoginCode,
          defaultPassword: 'dmha2026',
        },
        version: saved.version,
      })
    }

    return NextResponse.json(
      { ok: false, error: `Unknown admissions action: ${action}` },
      { status: 400 },
    )
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Admissions action failed.' },
      { status: 500 },
    )
  }
}
