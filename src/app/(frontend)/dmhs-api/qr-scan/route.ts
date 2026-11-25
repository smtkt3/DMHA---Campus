import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
  upsertDailyAttendanceRecords,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Checkpoint =
  | 'Main Gate Check-In'
  | 'Main Gate Check-Out'
  | 'Canteen Checkout'
  | 'Library Desk'
  | 'Bus Boarding'

const VALID_CHECKPOINTS = new Set<Checkpoint>([
  'Main Gate Check-In',
  'Main Gate Check-Out',
  'Canteen Checkout',
  'Library Desk',
  'Bus Boarding',
])

function parseMinutes(hhmm: string): number {
  const clean = hhmm.trim().toUpperCase()
  const ampm = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
  if (ampm) {
    let h = Number(ampm[1]) % 12
    const m = Number(ampm[2])
    if (ampm[3] === 'PM') h += 12
    return h * 60 + m
  }
  const plain = clean.match(/^(\d{1,2}):(\d{2})$/)
  if (plain) return Number(plain[1]) * 60 + Number(plain[2])
  return 8 * 60 + 15
}

function formatDuration(startTime: string | null, endTime: string): string {
  if (!startTime) return '0h 01m'
  const diff = Math.max(1, parseMinutes(endTime) - parseMinutes(startTime))
  const hrs = Math.floor(diff / 60)
  const mins = diff % 60
  return `${hrs}h ${String(mins).padStart(2, '0')}m`
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as {
      cardCode?: string
      holderId?: string
      holderName?: string
      holderRole?: 'student' | 'teacher'
      checkpoint?: Checkpoint
      canteenItem?: string
      canteenAmount?: number
      libraryBookId?: string
    }

    const cardCode = String(body.cardCode || '').trim().toUpperCase()
    const holderId = String(body.holderId || '').trim()
    const holderRole: 'student' | 'teacher' = body.holderRole === 'teacher' ? 'teacher' : 'student'
    const checkpoint = body.checkpoint as Checkpoint

    if (!cardCode || !holderId || !VALID_CHECKPOINTS.has(checkpoint)) {
      return NextResponse.json(
        { ok: false, error: 'Valid cardCode, holderId, and checkpoint are required.' },
        { status: 400 },
      )
    }

    // RBAC Check:
    // - Admin: full campus scanner authority
    // - Staff: must hold gate_security, canteen_pos, or library permission
    // - Teacher: may scan their OWN Faculty QR ID card for Gate Check-In/Out, Cafeteria, or Library
    if (session.role === 'staff') {
      const okStaff =
        staffHasServerPermission(session.linked_entity_id, 'gate_security') ||
        staffHasServerPermission(session.linked_entity_id, 'canteen_pos') ||
        staffHasServerPermission(session.linked_entity_id, 'library')
      if (!okStaff) {
        return NextResponse.json(
          { ok: false, error: 'Your staff role does not have QR checkpoint scanning permission.' },
          { status: 403 },
        )
      }
    } else if (session.role === 'teacher') {
      if (holderRole !== 'teacher' || holderId !== session.linked_entity_id) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Teachers can only tap their own Faculty QR ID Card. Student checkpoint scanning is handled by Gate Security, Canteen, Library, or Admin.',
          },
          { status: 403 },
        )
      }
    }

    const persisted = loadPersistedState()
    if (!persisted.exists || !persisted.data) {
      return NextResponse.json(
        { ok: false, error: 'School database state is not initialized.' },
        { status: 400 },
      )
    }

    const currentData = persisted.data
    const students = Array.isArray(currentData.students)
      ? (currentData.students as Array<Record<string, unknown>>)
      : []
    const teachers = Array.isArray(currentData.teachers)
      ? (currentData.teachers as Array<Record<string, unknown>>)
      : []
    const qrScans = Array.isArray(currentData.qrScans)
      ? (currentData.qrScans as Array<Record<string, unknown>>)
      : []
    const teacherAttendance = Array.isArray(currentData.teacherAttendance)
      ? (currentData.teacherAttendance as Array<Record<string, unknown>>)
      : []
    const canteenWallets = Array.isArray(currentData.canteenWallets)
      ? (currentData.canteenWallets as Array<Record<string, unknown>>)
      : []
    const canteenTransactions = Array.isArray(currentData.canteenTransactions)
      ? (currentData.canteenTransactions as Array<Record<string, unknown>>)
      : []
    const dismissalLogs = Array.isArray(currentData.dismissalLogs)
      ? (currentData.dismissalLogs as Array<Record<string, unknown>>)
      : []
    const libraryBooks = Array.isArray(currentData.libraryBooks)
      ? (currentData.libraryBooks as Array<Record<string, unknown>>)
      : []

    const nowDate = new Date()
    const todayIso = nowDate.toISOString().slice(0, 10)
    const timeNow = nowDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // ==================== FACULTY QR ID CARD SCAN ====================
    if (holderRole === 'teacher') {
      const teacher = teachers.find((t) => String(t.id) === holderId)
      if (!teacher) {
        return NextResponse.json({ ok: false, error: 'Faculty profile not found.' }, { status: 404 })
      }
      const teacherName = String(teacher.name || body.holderName || 'Faculty')
      const dept = String(teacher.department || 'Faculty')

      if (teacher.status === 'suspended') {
        const flagged = {
          id: `qr-${Date.now()}`,
          cardCode,
          holderId,
          holderName: teacherName,
          holderRole: 'teacher',
          checkpoint,
          status: 'flagged',
          details: 'Blocked — Faculty account is suspended by DMHA Administration',
          scannedAt: `Today · ${timeNow}`,
        }
        const nextQrScans = [flagged, ...qrScans]
        const saved = savePersistedState(
          { ...currentData, qrScans: nextQrScans },
          session.display_name,
        )
        appendSecurityAudit({
          action: 'faculty_qr_suspended_blocked',
          target: `${teacherName} (${cardCode}) at ${checkpoint}`,
          actor: session.display_name,
          actorRole: session.role,
          ipAddress: ip,
        })
        return NextResponse.json(
          {
            ok: false,
            error: `Access Flagged: ${teacherName}'s Faculty ID (${cardCode}) is currently suspended.`,
            qrScans: nextQrScans,
            version: saved.version,
          },
          { status: 403 },
        )
      }

      let nextTeacherAttendance = [...teacherAttendance]
      let details = `${dept} · Faculty Pass Verified (${timeNow})`
      let message = `Faculty Pass Verified: ${teacherName} at ${checkpoint} (${timeNow}).`

      const wifiCfg =
        currentData.campusWifiConfig && typeof currentData.campusWifiConfig === 'object'
          ? (currentData.campusWifiConfig as { lateCutoffTime?: string })
          : {}
      const lateCutoff = wifiCfg.lateCutoffTime || '08:15 AM'

      const todayLabel = `Today · ${nowDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      const isTodayTeacherRow = (a: Record<string, unknown>) =>
        String(a.teacherId) === holderId &&
        (String(a.date) === todayIso || String(a.date).startsWith('Today'))

      if (checkpoint === 'Main Gate Check-In') {
        const isLate = parseMinutes(timeNow) > parseMinutes(lateCutoff)
        const existingIdx = nextTeacherAttendance.findIndex(isTodayTeacherRow)
        const attRow = {
          id: existingIdx >= 0 ? String(nextTeacherAttendance[existingIdx].id) : `ta-${Date.now()}`,
          teacherId: holderId,
          teacherName,
          date: todayLabel,
          checkInTime: timeNow,
          checkOutTime: null,
          status: isLate ? 'late' : 'checked_in',
          verifiedIp: ip,
          wifiNetwork: `Smart QR Gate (${cardCode})`,
          biometricVerified: true,
        }
        const withoutDupes = nextTeacherAttendance.filter((a) => !isTodayTeacherRow(a))
        nextTeacherAttendance = [attRow, ...withoutDupes]
        details = `${dept} · Faculty Check-In ${isLate ? '(Late)' : '(On Time)'} · Synced to HR Attendance`
        message = `${teacherName} checked in via Faculty QR ID (${timeNow}) — HR Attendance synced.`
      } else if (checkpoint === 'Main Gate Check-Out') {
        const existingIdx = nextTeacherAttendance.findIndex(isTodayTeacherRow)
        const prevCheckIn =
          existingIdx >= 0 ? (nextTeacherAttendance[existingIdx].checkInTime as string | null) : null
        const hoursWorked = formatDuration(prevCheckIn, timeNow)
        const attRow = {
          id: existingIdx >= 0 ? String(nextTeacherAttendance[existingIdx].id) : `ta-${Date.now()}`,
          teacherId: holderId,
          teacherName,
          date: todayLabel,
          checkInTime: prevCheckIn || timeNow,
          checkOutTime: timeNow,
          status: 'checked_out',
          verifiedIp: ip,
          wifiNetwork: `Smart QR Gate (${cardCode})`,
          biometricVerified: true,
          hoursWorked,
        }
        const withoutDupes = nextTeacherAttendance.filter((a) => !isTodayTeacherRow(a))
        nextTeacherAttendance = [attRow, ...withoutDupes]
        details = `${dept} · Faculty Check-Out (${timeNow}) · Worked ${hoursWorked}`
        message = `${teacherName} checked out via Faculty QR ID (${timeNow} · ${hoursWorked}).`
      } else if (checkpoint === 'Canteen Checkout') {
        const itemLabel = (body.canteenItem || 'Faculty Cafeteria Meal').trim()
        details = `Faculty Staff Meal Pass · ${itemLabel} (Verified)`
        message = `Faculty Cafeteria Pass verified for ${teacherName} (${itemLabel}).`
      } else if (checkpoint === 'Library Desk') {
        details = `Faculty Library Desk Access · ${dept} (Verified)`
        message = `Faculty Library Pass verified for ${teacherName}.`
      }

      const scanRow = {
        id: `qr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        cardCode,
        holderId,
        holderName: teacherName,
        holderRole: 'teacher',
        checkpoint,
        status: 'verified',
        details,
        scannedAt: `Today · ${timeNow}`,
      }
      const nextQrScans = [scanRow, ...qrScans]

      const saved = savePersistedState(
        {
          ...currentData,
          qrScans: nextQrScans,
          teacherAttendance: nextTeacherAttendance,
        },
        session.display_name,
      )

      appendSecurityAudit({
        action: 'faculty_qr_scanned',
        target: `${teacherName} (${cardCode}) · ${checkpoint} — ${details}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })

      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
      })

      return NextResponse.json({
        ok: true,
        message,
        scan: scanRow,
        qrScans: nextQrScans,
        teacherAttendance: nextTeacherAttendance,
        version: saved.version,
      })
    }

    // ==================== STUDENT QR ID CARD SCAN ====================
    const student = students.find((s) => String(s.id) === holderId)
    if (!student) {
      return NextResponse.json({ ok: false, error: 'Student profile not found.' }, { status: 404 })
    }
    const studentName = String(student.name || body.holderName || 'Student')
    const busRoute = String(student.busRoute || 'Unit - 1')

    let nextStudents = [...students]
    let nextWallets = [...canteenWallets]
    let nextCanteenTx = [...canteenTransactions]
    let nextDismissals = [...dismissalLogs]
    let nextBooks = [...libraryBooks]
    let nextCirculation = Array.isArray(currentData.libraryCirculation)
      ? [...(currentData.libraryCirculation as Array<Record<string, unknown>>)]
      : []
    let details = `${busRoute} · Verified`
    let message = `Verified: ${studentName} (${cardCode}) at ${checkpoint}`
    let remainingBalance: number | undefined

    if (checkpoint === 'Canteen Checkout') {
      const amount = Math.max(1, Math.round(Number(body.canteenAmount) || 120))
      const itemLabel = (body.canteenItem || 'Canteen Snack Combo').trim()
      const wallet = nextWallets.find((w) => String(w.studentId) === holderId)
      if (!wallet) {
        return NextResponse.json(
          { ok: false, error: `No Canteen Wallet linked to ${studentName}.` },
          { status: 400 },
        )
      }
      const balance = Number(wallet.balance || 0)
      const dailyLimit = Number(wallet.dailyLimit || 250)
      if (amount > dailyLimit || amount > balance) {
        const reason =
          amount > dailyLimit
            ? `Blocked ৳${amount} (${itemLabel}) — exceeds daily limit ৳${dailyLimit}`
            : `Insufficient balance (৳${balance}) for ৳${amount} (${itemLabel})`
        const flagged = {
          id: `qr-${Date.now()}`,
          cardCode,
          holderId,
          holderName: studentName,
          holderRole: 'student',
          checkpoint,
          status: 'flagged',
          details: reason,
          scannedAt: `Today · ${timeNow}`,
        }
        const nextQrScans = [flagged, ...qrScans]
        const saved = savePersistedState(
          { ...currentData, qrScans: nextQrScans },
          session.display_name,
        )
        return NextResponse.json(
          {
            ok: false,
            error: reason,
            remainingBalance: balance,
            qrScans: nextQrScans,
            version: saved.version,
          },
          { status: 400 },
        )
      }
      const nextBal = balance - amount
      remainingBalance = nextBal
      nextWallets = nextWallets.map((w) =>
        String(w.studentId) === holderId ? { ...w, balance: nextBal } : w,
      )
      nextCanteenTx = [
        {
          id: `ct-${Date.now()}`,
          studentId: holderId,
          item: `${itemLabel} (QR POS)`,
          amount,
          time: `Today · ${timeNow}`,
          calories: 'Verified Canteen Purchase',
        },
        ...nextCanteenTx,
      ]
      details = `${itemLabel} (-৳${amount.toLocaleString()}) · Balance: ৳${nextBal.toLocaleString()}`
      message = `Paid ৳${amount.toLocaleString()} for ${itemLabel}. Remaining Balance: ৳${nextBal.toLocaleString()}.`
    } else if (checkpoint === 'Main Gate Check-In') {
      const todayIso = new Date().toISOString().slice(0, 10)
      upsertDailyAttendanceRecords([
        {
          attendanceDate: todayIso,
          studentId: holderId,
          studentName,
          classLabel: `${String(student.className || 'Class')} · ${String(student.section || 'Section A')}`,
          status: 'present',
          markedById: session.linked_entity_id,
          markedByName: `${session.display_name} (QR Gate)`,
        },
      ])
      nextStudents = nextStudents.map((s) =>
        String(s.id) === holderId ? { ...s, todayStatus: 'present', gateCheckIn: timeNow } : s,
      )
      details = `${busRoute} Gate · Marked Present & Synced to Attendance (${timeNow})`
      message = `${studentName} checked in at Main Gate (${timeNow}) & synced to Daily Attendance.`
    } else if (checkpoint === 'Main Gate Check-Out') {
      nextDismissals = [
        {
          id: `dsm-${Date.now()}`,
          studentId: holderId,
          studentName,
          pickedUpBy: `Smart ID Check-Out (${cardCode})`,
          gate: `${busRoute} · Main Gate`,
          time: `Today · ${timeNow}`,
          verified: true,
        },
        ...nextDismissals,
      ]
      details = `${busRoute} Gate · Checked Out (${timeNow})`
      message = `${studentName} checked out at Main Gate (${timeNow}).`
    } else if (checkpoint === 'Library Desk' && body.libraryBookId) {
      const book = nextBooks.find((b) => String(b.id) === body.libraryBookId)
      const totalCopies = Math.max(1, Number(book?.totalCopies ?? 1))
      const availCopies = Number(
        book?.availableCopies ?? (book?.status === 'available' ? totalCopies : 0),
      )
      if (!book || availCopies <= 0) {
        return NextResponse.json(
          { ok: false, error: 'Selected library book has no available copies.' },
          { status: 400 },
        )
      }
      const nextAvail = Math.max(0, availCopies - 1)
      const todayIso = new Date().toISOString().slice(0, 10)
      const dueDate = new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      const dueIso = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
      nextBooks = nextBooks.map((b) =>
        String(b.id) === body.libraryBookId
          ? {
              ...b,
              totalCopies,
              availableCopies: nextAvail,
              status: nextAvail === 0 ? 'issued' : 'available',
              issuedToStudentId: holderId,
              issuedToName: studentName,
              issuedAt: `Today · ${timeNow}`,
              dueDate,
              overdueDays: 0,
            }
          : b,
      )
      nextCirculation = [
        {
          id: `circ-qr-${Date.now()}`,
          bookId: String(book.id),
          bookTitle: String(book.title || 'Library Book'),
          studentId: holderId,
          studentName,
          className: String(student.className || 'Class 6'),
          issuedAt: todayIso,
          dueDate: dueIso,
          status: 'issued',
          issuedBy: `${session.display_name} (QR Desk)`,
        },
        ...nextCirculation,
      ]
      details = `Library Issued: "${String(book.title)}" (Due ${dueDate} · ${nextAvail}/${totalCopies} left)`
      message = `Issued "${String(book.title)}" to ${studentName} (Due ${dueDate}) & logged in Library Circulation.`
    }

    const scanRow = {
      id: `qr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      cardCode,
      holderId,
      holderName: studentName,
      holderRole: 'student',
      checkpoint,
      status: 'verified',
      details,
      scannedAt: `Today · ${timeNow}`,
    }
    const nextQrScans = [scanRow, ...qrScans]

    const saved = savePersistedState(
      {
        ...currentData,
        qrScans: nextQrScans,
        students: nextStudents,
        canteenWallets: nextWallets,
        canteenTransactions: nextCanteenTx,
        dismissalLogs: nextDismissals,
        libraryBooks: nextBooks,
        libraryCirculation: nextCirculation,
      },
      session.display_name,
    )

    appendSecurityAudit({
      action: 'student_qr_scanned',
      target: `${studentName} (${cardCode}) · ${checkpoint} — ${details}`,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: ip,
    })

    broadcastDmhsEvent({
      type: 'state_updated',
      version: saved.version,
      updatedAt: saved.updatedAt,
      updatedBy: session.display_name,
    })

    return NextResponse.json({
      ok: true,
      message,
      remainingBalance,
      scan: scanRow,
      qrScans: nextQrScans,
      students: nextStudents,
      canteenWallets: nextWallets,
      canteenTransactions: nextCanteenTx,
      dismissalLogs: nextDismissals,
      libraryBooks: nextBooks,
      libraryCirculation: nextCirculation,
      version: saved.version,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'QR scan processing failed.' },
      { status: 500 },
    )
  }
}
