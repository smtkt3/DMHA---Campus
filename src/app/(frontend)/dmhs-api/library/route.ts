import { NextResponse } from 'next/server'
import { appendSecurityAudit, loadPersistedState, savePersistedState } from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'
import type {
  FeeInvoice,
  LibraryBook,
  LibraryCirculationLog,
  StudentFineRecord,
  StudentRecord,
  StudyResourceItem,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'staff', 'guardian', 'student'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    const isLibraryManager =
      session.role === 'admin' ||
      session.role === 'teacher' ||
      (session.role === 'staff' && staffHasServerPermission(session.linked_entity_id, 'library'))

    if (!isLibraryManager && action !== 'reserve_book') {
      return NextResponse.json(
        { ok: false, error: 'Access Denied: Library Manager permission required.' },
        { status: 403 },
      )
    }

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const books: LibraryBook[] = Array.isArray(currentData.libraryBooks)
      ? (currentData.libraryBooks as LibraryBook[])
      : []
    const circulation: LibraryCirculationLog[] = Array.isArray(currentData.libraryCirculation)
      ? (currentData.libraryCirculation as LibraryCirculationLog[])
      : []
    const resources: StudyResourceItem[] = Array.isArray(currentData.studyResources)
      ? (currentData.studyResources as StudyResourceItem[])
      : []
    const students: StudentRecord[] = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const fees: FeeInvoice[] = Array.isArray(currentData.fees)
      ? (currentData.fees as FeeInvoice[])
      : []
    const fines: StudentFineRecord[] = Array.isArray(currentData.studentFines)
      ? (currentData.studentFines as StudentFineRecord[])
      : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []

    const todayIso = new Date().toISOString().slice(0, 10)

    const commit = (
      patch: Record<string, unknown>,
      summary: string,
      auditAction: string,
      auditTarget: string,
    ) => {
      const saved = savePersistedState({ ...currentData, ...patch }, session.display_name)
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
        summary,
      })
      return NextResponse.json({ ok: true, ...patch, version: saved.version })
    }

    if (action === 'add_book') {
      const title = String(body.title || '').trim().slice(0, 140)
      const author = String(body.author || '').trim().slice(0, 100)
      const subject = String(body.subject || 'General').trim()
      const isbn = String(body.isbn || `978-984-${Math.floor(100000 + Math.random() * 899999)}`).trim()
      const shelf = String(body.shelf || 'Shelf A-01').trim()
      const totalCopies = Math.max(1, Math.min(100, Math.round(Number(body.totalCopies || 3))))
      const finePerDay = Math.max(0, Math.round(Number(body.finePerDay ?? 20)))
      if (!title || !author) {
        return NextResponse.json({ ok: false, error: 'Book title and author are required.' }, { status: 400 })
      }
      const newBook: LibraryBook = {
        id: `bk-${Date.now()}`,
        isbn,
        title,
        author,
        subject,
        shelf,
        category: String(body.category || subject),
        totalCopies,
        availableCopies: totalCopies,
        finePerDay,
        status: 'available',
      }
      return commit(
        { libraryBooks: [newBook, ...books] },
        `Cataloged book: ${title} (${totalCopies} copies)`,
        'library_book_added',
        `${title} (${isbn})`,
      )
    }

    if (action === 'issue_book') {
      const bookId = String(body.bookId || '')
      const studentQuery = String(body.studentQuery || body.studentId || '').trim()
      const book = books.find((b) => b.id === bookId)
      if (!book) return NextResponse.json({ ok: false, error: 'Book not found.' }, { status: 404 })

      const total = book.totalCopies ?? 1
      const avail = book.availableCopies ?? (book.status === 'available' ? total : 0)
      if (avail <= 0) {
        return NextResponse.json(
          { ok: false, error: `All ${total} copy(ies) of "${book.title}" are currently issued.` },
          { status: 409 },
        )
      }

      const q = studentQuery.toLowerCase()
      const stu = students.find(
        (s) =>
          s.id.toLowerCase() === q ||
          `dmha-id-stu-${s.roll}`.toLowerCase() === q ||
          s.roll.toLowerCase() === q ||
          s.name.toLowerCase().includes(q),
      )
      if (!stu) {
        return NextResponse.json(
          { ok: false, error: `No student matched "${studentQuery}". Use Student Name, Roll #, or QR ID.` },
          { status: 404 },
        )
      }

      const dueDt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      const dueDate = dueDt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      const nextAvail = Math.max(0, avail - 1)

      const nextBooks = books.map((b) =>
        b.id === bookId
          ? {
              ...b,
              totalCopies: total,
              availableCopies: nextAvail,
              status: nextAvail === 0 ? ('issued' as const) : ('available' as const),
              issuedToStudentId: stu.id,
              issuedToName: `${stu.name} (${stu.className})`,
              issuedAt: todayIso,
              dueDate,
              overdueDays: 0,
              reservedByStudentId: b.reservedByStudentId === stu.id ? undefined : b.reservedByStudentId,
              reservedByName: b.reservedByStudentId === stu.id ? undefined : b.reservedByName,
            }
          : b,
      )
      const log: LibraryCirculationLog = {
        id: `lcirc-${Date.now()}`,
        bookId: book.id,
        bookTitle: book.title,
        isbn: book.isbn,
        studentId: stu.id,
        studentName: stu.name,
        action: 'issued',
        dateIso: todayIso,
        dueDate,
        actor: session.display_name,
      }
      const notif = {
        id: `notif-lib-${Date.now()}`,
        title: `Library Book Issued · ${stu.name}`,
        text: `"${book.title}" issued to ${stu.name}. Return due by ${dueDate}.`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['guardian', 'student'],
        read: false,
      }
      return commit(
        {
          libraryBooks: nextBooks,
          libraryCirculation: [log, ...circulation].slice(0, 120),
          notifications: [notif, ...existingNotifs].slice(0, 80),
        },
        `Issued "${book.title}" to ${stu.name}`,
        'library_book_issued',
        `${book.title} -> ${stu.name}`,
      )
    }

    if (action === 'return_book') {
      const bookId = String(body.bookId || '')
      const book = books.find((b) => b.id === bookId)
      if (!book) return NextResponse.json({ ok: false, error: 'Book not found.' }, { status: 404 })
      const total = book.totalCopies ?? 1
      const currentAvail = book.availableCopies ?? (book.status === 'available' ? total : 0)
      const nextAvail = Math.min(total, currentAvail + 1)

      const nextBooks = books.map((b) =>
        b.id === bookId
          ? {
              ...b,
              totalCopies: total,
              availableCopies: nextAvail,
              status: 'available' as const,
              issuedToStudentId: undefined,
              issuedToName: undefined,
              issuedAt: undefined,
              dueDate: undefined,
              overdueDays: 0,
            }
          : b,
      )
      const log: LibraryCirculationLog = {
        id: `lcirc-${Date.now()}`,
        bookId: book.id,
        bookTitle: book.title,
        isbn: book.isbn,
        studentId: book.issuedToStudentId || 'unknown',
        studentName: book.issuedToName || 'Borrower',
        action: 'returned',
        dateIso: todayIso,
        actor: session.display_name,
      }
      return commit(
        {
          libraryBooks: nextBooks,
          libraryCirculation: [log, ...circulation].slice(0, 120),
        },
        `Returned "${book.title}" to shelf (${nextAvail}/${total} available)`,
        'library_book_returned',
        book.title,
      )
    }

    if (action === 'reserve_book') {
      const bookId = String(body.bookId || '')
      const stuId = String(body.studentId || session.linked_entity_id)
      const book = books.find((b) => b.id === bookId)
      const stu = students.find((s) => s.id === stuId)
      if (!book || !stu) {
        return NextResponse.json({ ok: false, error: 'Book and student are required.' }, { status: 400 })
      }
      const nextBooks = books.map((b) =>
        b.id === bookId
          ? { ...b, reservedByStudentId: stu.id, reservedByName: `${stu.name} (${stu.className})` }
          : b,
      )
      const log: LibraryCirculationLog = {
        id: `lcirc-${Date.now()}`,
        bookId: book.id,
        bookTitle: book.title,
        isbn: book.isbn,
        studentId: stu.id,
        studentName: stu.name,
        action: 'reserved',
        dateIso: todayIso,
        actor: session.display_name,
      }
      return commit(
        {
          libraryBooks: nextBooks,
          libraryCirculation: [log, ...circulation].slice(0, 120),
        },
        `Reserved "${book.title}" for ${stu.name}`,
        'library_book_reserved',
        `${book.title} <- ${stu.name}`,
      )
    }

    if (action === 'post_overdue_fine') {
      const bookId = String(body.bookId || '')
      const book = books.find((b) => b.id === bookId)
      if (!book || !book.issuedToStudentId) {
        return NextResponse.json({ ok: false, error: 'Issued book with borrower is required.' }, { status: 400 })
      }
      const stu = students.find((s) => s.id === book.issuedToStudentId)
      const overdueDays = Math.max(1, Number(body.overdueDays ?? book.overdueDays ?? 3))
      const rate = book.finePerDay ?? 20
      const fineAmount = overdueDays * rate
      const invId = `fee-lib-${Date.now()}`

      const newInvoice: FeeInvoice = {
        id: invId,
        studentId: book.issuedToStudentId,
        studentName: stu?.name || book.issuedToName || 'Student',
        title: `Library Overdue Fine · ${book.title.slice(0, 45)} (${overdueDays}d)`,
        category: 'Lab & Library',
        amount: fineAmount,
        dueDate: 'Due within 7 days',
        status: 'due',
      }
      const newFine: StudentFineRecord = {
        id: `fine-lib-${Date.now()}`,
        studentId: book.issuedToStudentId,
        studentName: stu?.name || book.issuedToName || 'Student',
        classLabel: stu ? `${stu.className} · ${stu.section}` : 'DMHA',
        category: 'Library Book Overdue',
        reason: `Overdue book "${book.title}" (${overdueDays} days @ ৳${rate}/day)`,
        amount: fineAmount,
        issuedAt: todayIso,
        issuedBy: session.display_name,
        status: 'invoiced',
        linkedInvoiceId: invId,
      }
      const log: LibraryCirculationLog = {
        id: `lcirc-${Date.now()}`,
        bookId: book.id,
        bookTitle: book.title,
        isbn: book.isbn,
        studentId: book.issuedToStudentId,
        studentName: stu?.name || book.issuedToName || 'Student',
        action: 'fine_posted',
        dateIso: todayIso,
        fineAmount,
        actor: session.display_name,
      }
      const notif = {
        id: `notif-lib-fine-${Date.now()}`,
        title: `Library Overdue Fine Posted · ৳${fineAmount}`,
        text: `৳${fineAmount} overdue fine for "${book.title}" (${overdueDays}d) has been added to ${stu?.name || 'Student'}’s Fee Ledger.`,
        time: 'Just now',
        type: 'fee',
        forRoles: ['guardian', 'student', 'admin'],
        read: false,
      }
      return commit(
        {
          fees: [newInvoice, ...fees],
          studentFines: [newFine, ...fines],
          libraryCirculation: [log, ...circulation].slice(0, 120),
          notifications: [notif, ...existingNotifs].slice(0, 80),
        },
        `Posted ৳${fineAmount} Library Fine to Fee Ledger`,
        'library_overdue_fine_posted',
        `${stu?.name || book.issuedToStudentId} · ৳${fineAmount}`,
      )
    }

    if (action === 'add_resource') {
      const title = String(body.title || '').trim()
      const subject = String(body.subject || 'Physics').trim()
      const className = String(body.className || 'Class 6').trim()
      const type = (body.type as StudyResourceItem['type']) || 'PDF Notes'
      if (!title) return NextResponse.json({ ok: false, error: 'Resource title required.' }, { status: 400 })
      const item: StudyResourceItem = {
        id: `res-${Date.now()}`,
        subject,
        className,
        title,
        type,
        teacherName: session.display_name,
        summary: String(body.summary || 'Digital lesson resource uploaded via DMHA Library.').trim(),
        durationOrPages: String(body.durationOrPages || '10 Pages · PDF').trim(),
        uploadedAt: 'Just now',
        downloads: 0,
      }
      return commit(
        { studyResources: [item, ...resources] },
        `Published lesson resource: ${title}`,
        'library_resource_added',
        title,
      )
    }

    return NextResponse.json({ ok: false, error: `Unknown library action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Library operation failed.' },
      { status: 500 },
    )
  }
}
