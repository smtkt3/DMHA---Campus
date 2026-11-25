'use client'

import React, { useMemo, useState } from 'react'
import { DMHS_CLASSES } from './data'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type { StudyResourceItem } from './types'
import { PageShell } from './ui'

export function LibraryAndLessonsView() {
  const {
    role,
    students,
    selectedChildId,
    activeStudentId,
    libraryBooks,
    libraryCirculation,
    studyResources,
    runLibraryAction,
    trackResourceDownload,
    hasStaffPermission,
  } = useSchool()

  const activeChild =
    role === 'guardian'
      ? students.find((s) => s.id === selectedChildId) || students[0]
      : role === 'student'
        ? students.find((s) => s.id === activeStudentId) || students[0]
        : null

  const canManage = role === 'admin' || role === 'teacher' || hasStaffPermission('library')
  const [activeTab, setActiveTab] = useState<'catalog' | 'circulation' | 'overdue' | 'lessons'>(
    'catalog',
  )
  const [search, setSearch] = useState('')
  const [issueModalBookId, setIssueModalBookId] = useState<string | null>(null)
  const [qrOrStudentInput, setQrOrStudentInput] = useState('DMHA-ID-STU-14')
  const [issueError, setIssueError] = useState('')

  // Add Book modal
  const [showAddBook, setShowAddBook] = useState(false)
  const [bookTitle, setBookTitle] = useState('')
  const [bookAuthor, setBookAuthor] = useState('')
  const [bookSubject, setBookSubject] = useState('Physics')
  const [bookIsbn, setBookIsbn] = useState('')
  const [bookShelf, setBookShelf] = useState('Shelf A-05')
  const [bookCopies, setBookCopies] = useState('3')
  const [bookFinePerDay, setBookFinePerDay] = useState('20')

  // Upload Lesson Resource modal
  const [showAddResource, setShowAddResource] = useState(false)
  const [resTitle, setResTitle] = useState('')
  const [resSubject, setResSubject] = useState('Physics')
  const [resClass, setResClass] = useState('Class 6')
  const [resType, setResType] = useState<StudyResourceItem['type']>('PDF Notes')
  const [resDuration, setResDuration] = useState('12 Pages · PDF')
  const [resSummary, setResSummary] = useState('')

  const q = search.toLowerCase()
  const filteredBooks = useMemo(() => {
    return libraryBooks.filter((b) => {
      const searchable = canManage
        ? `${b.title} ${b.author} ${b.subject} ${b.isbn} ${b.issuedToName || ''}`
        : `${b.title} ${b.author} ${b.subject} ${b.isbn}`
      if (!searchable.toLowerCase().includes(q)) return false
      return true
    })
  }, [libraryBooks, canManage, q])

  const filteredResources = useMemo(() => {
    return studyResources.filter((r) => {
      const matchesSearch = `${r.title} ${r.subject} ${r.className} ${r.teacherName} ${r.type}`
        .toLowerCase()
        .includes(q)
      if (!matchesSearch) return false
      if (!canManage && activeChild) {
        return (
          r.className.toLowerCase() === 'all classes' ||
          r.className.toLowerCase().includes(activeChild.className.toLowerCase())
        )
      }
      return true
    })
  }, [studyResources, q, canManage, activeChild])

  const totalCopiesCount = libraryBooks.reduce((s, b) => s + (b.totalCopies ?? 1), 0)
  const availCopiesCount = libraryBooks.reduce(
    (s, b) => s + (b.availableCopies ?? (b.status === 'available' ? (b.totalCopies ?? 1) : 0)),
    0,
  )
  const issuedBooks = libraryBooks.filter((b) => b.issuedToStudentId)
  const overdueBooks = libraryBooks.filter((b) => b.issuedToStudentId && (b.overdueDays || 0) > 0)

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!issueModalBookId) return
    setIssueError('')
    const res = await runLibraryAction(
      { action: 'issue_book', bookId: issueModalBookId, studentQuery: qrOrStudentInput },
      'Book issued and circulation logged!',
    )
    if (!res.ok) {
      setIssueError(res.error || 'Could not issue book.')
      return
    }
    setIssueModalBookId(null)
  }

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookTitle.trim() || !bookAuthor.trim()) return
    const res = await runLibraryAction(
      {
        action: 'add_book',
        title: bookTitle,
        author: bookAuthor,
        subject: bookSubject,
        isbn: bookIsbn,
        shelf: bookShelf,
        totalCopies: Number(bookCopies),
        finePerDay: Number(bookFinePerDay),
      },
      `Cataloged "${bookTitle}" (${bookCopies} copies)`,
    )
    if (res.ok) {
      setBookTitle('')
      setBookAuthor('')
      setBookIsbn('')
      setShowAddBook(false)
    }
  }

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resTitle.trim()) return
    const res = await runLibraryAction(
      {
        action: 'add_resource',
        title: resTitle,
        subject: resSubject,
        className: resClass,
        type: resType,
        durationOrPages: resDuration,
        summary: resSummary,
      },
      `Published resource "${resTitle}"`,
    )
    if (res.ok) {
      setResTitle('')
      setResSummary('')
      setShowAddResource(false)
    }
  }

  return (
    <PageShell
      eyebrow="DMHA Smart Library Suite · SQLite Inventory, Circulation & Auto-Fines"
      title="Library Management & Digital Lesson Hub"
      subtitle="Multi-copy book cataloging, QR Student ID issue/return, reservations, overdue fine posting to Accounts, and downloadable study notes."
      action={
        canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddBook(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2.5 text-xs font-extrabold text-emerald-300 shadow-xs hover:bg-slate-800"
            >
              <Icon name="plus" size={14} />
              Catalog New Book
            </button>
            <button
              type="button"
              onClick={() => setShowAddResource(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-800 hover:border-emerald-400"
            >
              <Icon name="book" size={14} className="text-emerald-600" />
              Add Lesson Note
            </button>
          </div>
        ) : undefined
      }
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      {/* KPI Summary Strip */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            Catalog &amp; Multi-Copy Stock
          </p>
          <p className="mt-1.5 text-3xl font-black">{libraryBooks.length} Titles</p>
          <p className="mt-1 text-[11px] text-slate-300">
            {availCopiesCount} / {totalCopiesCount} copies available on shelf
          </p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Currently Issued
          </p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">{issuedBooks.length}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            {libraryCirculation.length} total circulation log entries
          </p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Overdue Books
          </p>
          <p className="mt-1.5 text-3xl font-black text-rose-600">{overdueBooks.length}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            1-click fine posting to Student Fees
          </p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Digital Study Resources
          </p>
          <p className="mt-1.5 text-3xl font-black text-emerald-700">{filteredResources.length}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            PDF notes, revision sheets &amp; video lessons
          </p>
        </div>
      </div>

      {/* Navigation & Search Strip */}
      <div className="dmhs-card mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3.5">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['catalog', `Book Catalog (${filteredBooks.length})`],
              ...(canManage
                ? ([
                    ['circulation', `Circulation Log (${libraryCirculation.length})`],
                    ['overdue', `Overdue & Auto-Fines (${overdueBooks.length})`],
                  ] as const)
                : []),
              ['lessons', `Digital Lessons (${filteredResources.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`rounded-full px-4 py-1.5 text-xs font-extrabold transition ${
                activeTab === id
                  ? 'bg-[#0f172a] text-emerald-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, ISBN, author, shelf..."
          className="w-56 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
        />
      </div>

      {/* 1. BOOK CATALOG & MULTI-COPY STOCK */}
      {activeTab === 'catalog' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBooks.map((book) => {
            const total = book.totalCopies ?? 1
            const avail = book.availableCopies ?? (book.status === 'available' ? total : 0)
            const isMyBook = activeChild && book.issuedToStudentId === activeChild.id
            return (
              <div key={book.id} className="dmhs-card flex flex-col justify-between rounded-[22px] p-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-700">
                      {book.subject} · {book.shelf}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                        avail > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {avail}/{total} Available
                    </span>
                  </div>
                  <h4 className="mt-2.5 text-sm font-black text-slate-900">{book.title}</h4>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">
                    {book.author} · ISBN: <span className="font-mono">{book.isbn}</span>
                  </p>
                  {book.issuedToName && (canManage || isMyBook) && (
                    <div className="mt-2.5 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-700">
                      Issued to: <strong>{book.issuedToName}</strong> · Due {book.dueDate}
                      {(book.overdueDays || 0) > 0 && (
                        <span className="ml-1.5 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">
                          {book.overdueDays}d Overdue
                        </span>
                      )}
                    </div>
                  )}
                  {book.reservedByName && (
                    <p className="mt-1.5 text-[10px] font-extrabold text-indigo-700">
                      📌 Reserved by {book.reservedByName}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {canManage ? (
                    <>
                      {avail > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIssueModalBookId(book.id)
                            setIssueError('')
                          }}
                          className="rounded-full bg-[#0f172a] px-3.5 py-1.5 text-[11px] font-extrabold text-emerald-300 hover:bg-slate-800"
                        >
                          Issue via QR / Roll
                        </button>
                      )}
                      {book.issuedToStudentId && (
                        <button
                          type="button"
                          onClick={() =>
                            void runLibraryAction(
                              { action: 'return_book', bookId: book.id },
                              `Returned "${book.title}" to shelf!`,
                            )
                          }
                          className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-[11px] font-black text-white hover:bg-emerald-700"
                        >
                          Return Copy ✓
                        </button>
                      )}
                    </>
                  ) : activeChild ? (
                    <button
                      type="button"
                      disabled={book.reservedByStudentId === activeChild.id}
                      onClick={() =>
                        void runLibraryAction(
                          { action: 'reserve_book', bookId: book.id, studentId: activeChild.id },
                          `Reserved "${book.title}" for ${activeChild.name}!`,
                        )
                      }
                      className="rounded-full bg-emerald-50 px-3.5 py-1.5 text-[11px] font-extrabold text-emerald-800 hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                    >
                      {book.reservedByStudentId === activeChild.id
                        ? 'Reserved for You ✓'
                        : 'Reserve Book'}
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 2. CIRCULATION HISTORY LOG */}
      {activeTab === 'circulation' && canManage && (
        <div className="dmhs-card overflow-x-auto rounded-[24px] p-4">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                <th className="py-2.5 pr-3">Date</th>
                <th className="py-2.5 pr-3">Action</th>
                <th className="py-2.5 pr-3">Book &amp; ISBN</th>
                <th className="py-2.5 pr-3">Student</th>
                <th className="py-2.5 text-right">Handled By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {libraryCirculation.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 pr-3 font-mono font-bold text-slate-600">{log.dateIso}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        log.action === 'returned'
                          ? 'bg-emerald-50 text-emerald-700'
                          : log.action === 'fine_posted'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-sky-50 text-sky-700'
                      }`}
                    >
                      {log.action.replace('_', ' ')}
                      {log.fineAmount ? ` · ৳${log.fineAmount}` : ''}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 font-bold text-slate-900">
                    {log.bookTitle} <span className="font-mono text-[10px] text-slate-400">({log.isbn})</span>
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-slate-700">{log.studentName}</td>
                  <td className="py-2.5 text-right text-slate-500">{log.actor}</td>
                </tr>
              ))}
              {libraryCirculation.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs font-bold text-slate-400">
                    Issue or return a book to begin recording permanent SQLite circulation logs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. OVERDUE BOOKS & 1-CLICK FINE POSTING TO ACCOUNTS */}
      {activeTab === 'overdue' && canManage && (
        <div className="space-y-3">
          {issuedBooks.map((book) => {
            const days = Math.max(1, book.overdueDays || 3)
            const rate = book.finePerDay ?? 20
            const fineAmt = days * rate
            return (
              <div
                key={book.id}
                className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
              >
                <div>
                  <p className="text-sm font-black text-slate-900">{book.title}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    Borrower: <strong>{book.issuedToName}</strong> · Due {book.dueDate} · Rate: ৳{rate}/day
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
                    Est. Fine: ৳{fineAmt} ({days}d)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void runLibraryAction(
                        { action: 'post_overdue_fine', bookId: book.id, overdueDays: days },
                        `Posted ৳${fineAmt} Library Fine to Fee Ledger!`,
                      )
                    }
                    className="rounded-full bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-700"
                  >
                    Post ৳{fineAmt} Fine to Fees →
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void runLibraryAction(
                        { action: 'return_book', bookId: book.id },
                        `Returned "${book.title}"`,
                      )
                    }
                    className="rounded-full bg-emerald-600 px-3.5 py-2 text-xs font-black text-white"
                  >
                    Mark Returned
                  </button>
                </div>
              </div>
            )
          })}
          {issuedBooks.length === 0 && (
            <div className="dmhs-card rounded-2xl p-10 text-center text-xs font-bold text-slate-400">
              No books currently issued or overdue.
            </div>
          )}
        </div>
      )}

      {/* 4. DIGITAL LESSON RESOURCES */}
      {activeTab === 'lessons' && (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredResources.map((res) => (
            <div key={res.id} className="dmhs-card flex flex-col justify-between rounded-[22px] p-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                    {res.subject} · {res.className}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">{res.type}</span>
                </div>
                <h4 className="mt-2.5 text-sm font-black text-slate-900">{res.title}</h4>
                <p className="mt-1 text-xs font-medium text-slate-600">{res.summary}</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] font-bold text-slate-500">
                <span>
                  {res.teacherName} · {res.durationOrPages}
                </span>
                <button
                  type="button"
                  onClick={() => trackResourceDownload(res.id)}
                  className="rounded-full bg-[#0f172a] px-3.5 py-1.5 text-[10px] font-black text-emerald-300"
                >
                  Download ({res.downloads})
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ISSUE BOOK MODAL */}
      {issueModalBookId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setIssueModalBookId(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleIssueSubmit}
            className="w-full max-w-md space-y-3 rounded-[24px] bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-black text-slate-900">Issue Book via Student QR / Roll</h3>
            {issueError && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {issueError}
              </p>
            )}
            <input
              value={qrOrStudentInput}
              onChange={(e) => setQrOrStudentInput(e.target.value)}
              placeholder="Scan DMHA-ID-STU-14, Roll #, or Student Name"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIssueModalBookId(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-black text-white"
              >
                Confirm Issue (14 Days)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD BOOK MODAL */}
      {showAddBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setShowAddBook(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddBook}
            className="w-full max-w-md space-y-3 rounded-[24px] bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-black text-slate-900">Catalog New Book (Multi-Copy)</h3>
            <input
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              placeholder="Book Title *"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <input
              value={bookAuthor}
              onChange={(e) => setBookAuthor(e.target.value)}
              placeholder="Author *"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={bookSubject}
                onChange={(e) => setBookSubject(e.target.value)}
                placeholder="Subject"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              />
              <input
                value={bookShelf}
                onChange={(e) => setBookShelf(e.target.value)}
                placeholder="Shelf"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={bookIsbn}
                onChange={(e) => setBookIsbn(e.target.value)}
                placeholder="ISBN (auto)"
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold"
              />
              <input
                type="number"
                min={1}
                value={bookCopies}
                onChange={(e) => setBookCopies(e.target.value)}
                placeholder="Copies"
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
              />
              <input
                type="number"
                min={0}
                value={bookFinePerDay}
                onChange={(e) => setBookFinePerDay(e.target.value)}
                placeholder="৳/day fine"
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddBook(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-black text-emerald-300"
              >
                Save to Catalog
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD LESSON RESOURCE MODAL */}
      {showAddResource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setShowAddResource(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddResource}
            className="w-full max-w-md space-y-3 rounded-[24px] bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-black text-slate-900">Publish Digital Lesson Resource</h3>
            <input
              value={resTitle}
              onChange={(e) => setResTitle(e.target.value)}
              placeholder="Lesson Title *"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={resSubject}
                onChange={(e) => setResSubject(e.target.value)}
                placeholder="Subject"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              />
              <select
                value={resClass}
                onChange={(e) => setResClass(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                <option value="All Classes">All Classes</option>
                {DMHS_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={resType}
                onChange={(e) => setResType(e.target.value as StudyResourceItem['type'])}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                <option value="PDF Notes">PDF Notes</option>
                <option value="Video Lesson">Video Lesson</option>
                <option value="Revision Sheet">Revision Sheet</option>
              </select>
              <input
                value={resDuration}
                onChange={(e) => setResDuration(e.target.value)}
                placeholder="e.g., 12 Pages · PDF"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
              />
            </div>
            <textarea
              rows={2}
              value={resSummary}
              onChange={(e) => setResSummary(e.target.value)}
              placeholder="Brief summary..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddResource(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-black text-white"
              >
                Publish Resource
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
