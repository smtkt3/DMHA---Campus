'use client'

import React, { useMemo, useState } from 'react'
import { isImageAttachment, uploadDmhsAttachment } from '@/lib/dmhs-upload-client'
import { AccountSecuritySettingsCard } from './account-security-card'
import { GuardianBiometricSettingsCard } from './biometric-ui'
import { ADMIN_PROFILE, GUARDIAN_PROFILE, TEACHER_PROFILE } from './data'
import { FamilyModeSettingsCard } from './family-mode-ui'
import { SecureFeeCheckoutModal } from './golive-views'
import { ChildSwitcherBar } from './guardian-views'
import { Icon, type IconName } from './icons'
import { DesktopAppInstallButton } from './pwa-install'
import { useSchool } from './store'
import type { FeeInvoice, Role } from './types'
import { FeeReceiptModal, PageShell, SectionTitle } from './ui'

export function PaymentsView() {
  const { role, students, selectedChildId, activeStudentId, fees, payFeeInvoice } = useSchool()
  const [receiptInvoice, setReceiptInvoice] = useState<FeeInvoice | null>(null)
  const [checkoutInvoice, setCheckoutInvoice] = useState<FeeInvoice | null>(null)
  const targetStudent =
    role === 'student'
      ? students.find((s) => s.id === activeStudentId) || students[0]
      : role === 'guardian'
        ? students.find((s) => s.id === selectedChildId) || students[0]
        : students[0]

  const visibleFees =
    role === 'admin' || role === 'teacher'
      ? fees
      : fees.filter((f) => f.studentId === targetStudent?.id)

  const dueInvoices = visibleFees.filter((f) => f.status === 'due')
  const totalDue = dueInvoices.reduce((sum, f) => sum + f.amount, 0)
  const totalPaid = visibleFees
    .filter((f) => f.status === 'paid')
    .reduce((sum, f) => sum + f.amount, 0)

  const nextDueLabel = dueInvoices[0]?.dueDate || 'All paid'

  return (
    <PageShell
      eyebrow="DMHA Finance & Billing · Auto-Synced Double-Entry Receipts"
      title={role === 'admin' || role === 'teacher' ? 'School Fee Collection' : 'School Fees & Receipts'}
      subtitle="Pay tuition, exam, transport, and library fees securely via bKash, Nagad, or Card with instant A4 digital receipts."
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      <div className="dmhs-hero relative overflow-hidden rounded-[28px] p-6 text-white shadow-lg">
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-300">
              {role === 'admin' || role === 'teacher' ? 'Total Collected' : 'Current Balance Due'}
            </p>
            <p className="mt-2 text-4xl font-black text-white">
              ৳{(role === 'admin' || role === 'teacher' ? totalPaid : totalDue).toLocaleString()}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-slate-300">
              {role === 'admin' || role === 'teacher'
                ? `৳${totalDue.toLocaleString()} pending across ${dueInvoices.length} unpaid invoice(s)`
                : totalDue > 0
                  ? `${dueInvoices.length} unpaid invoice(s) · Next: ${nextDueLabel} · Paid to date: ৳${totalPaid.toLocaleString()}`
                  : `All school fees are paid up to date! (Total paid: ৳${totalPaid.toLocaleString()})`}
            </p>
          </div>
          {dueInvoices[0] && (role === 'guardian' || role === 'student') && (
            <button
              type="button"
              onClick={() => setCheckoutInvoice(dueInvoices[0])}
              className="rounded-full bg-emerald-400 px-6 py-3 text-xs font-black text-slate-950 shadow-md transition hover:bg-emerald-300"
            >
              Pay ৳{dueInvoices[0].amount.toLocaleString()} Online
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <SectionTitle eyebrow="Invoice ledger" title="Tuition & campus fee history" />
        {visibleFees.map((inv) => (
          <div
            key={inv.id}
            className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex size-10 items-center justify-center rounded-xl ${
                  inv.status === 'paid'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                <Icon name="payment" size={18} />
              </span>
              <div>
                <p className="text-xs font-black text-slate-900">
                  {inv.title}{' '}
                  {(role === 'admin' || role === 'teacher') && (
                    <span className="font-semibold text-slate-400">· {inv.studentName}</span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  {inv.status === 'paid'
                    ? `Paid ${inv.paidAt} · Receipt ${inv.receiptNo}`
                    : `${inv.category || 'School Fee'} · ${inv.dueDate}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black text-slate-950">৳{inv.amount.toLocaleString()}</span>
              <button
                type="button"
                onClick={() => setReceiptInvoice(inv)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-black transition ${
                  inv.status === 'paid'
                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon name="print" size={12} />
                {inv.status === 'paid' ? 'Receipt PDF' : 'Challan PDF'}
              </button>
              {inv.status === 'due' && (role === 'guardian' || role === 'student') ? (
                <button
                  type="button"
                  onClick={() => setCheckoutInvoice(inv)}
                  className="rounded-full bg-[#0f172a] px-4 py-1.5 text-[11px] font-extrabold text-emerald-300 transition hover:bg-slate-800"
                >
                  Pay Online
                </button>
              ) : inv.status === 'due' ? (
                <button
                  type="button"
                  onClick={() => payFeeInvoice(inv.id)}
                  className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-[10px] font-black text-white hover:bg-emerald-700"
                >
                  Mark Paid &amp; Post Voucher
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {visibleFees.length === 0 && (
          <div className="dmhs-card rounded-2xl p-8 text-center text-xs font-bold text-slate-400">
            No fee invoices recorded yet.
          </div>
        )}
      </div>

      {checkoutInvoice && (
        <SecureFeeCheckoutModal
          invoice={checkoutInvoice}
          onSuccess={() => {
            payFeeInvoice(checkoutInvoice.id)
            setCheckoutInvoice(null)
          }}
          onClose={() => setCheckoutInvoice(null)}
        />
      )}

      {receiptInvoice && (
        <FeeReceiptModal
          invoice={receiptInvoice}
          guardianName={targetStudent?.guardianName || GUARDIAN_PROFILE.name}
          studentClass={
            targetStudent
              ? `${targetStudent.className} · ${targetStudent.section} · Roll ${targetStudent.roll}`
              : undefined
          }
          onClose={() => setReceiptInvoice(null)}
        />
      )}
    </PageShell>
  )
}

export function MessagesView() {
  const {
    role,
    chats,
    students,
    guardians,
    selectedChildId,
    activeGuardianId,
    activeTeacherId,
    teachers,
    runMessageAction,
  } = useSchool()
  const [activeId, setActiveId] = useState(chats[0]?.id || '')
  const [draft, setDraft] = useState('')
  const [attachmentName, setAttachmentName] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [uploadingMsgFile, setUploadingMsgFile] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatStudentId, setNewChatStudentId] = useState('')
  const [newChatTeacherId, setNewChatTeacherId] = useState(teachers[0]?.id || '')
  const [newChatText, setNewChatText] = useState('')
  const [newChatAttachment, setNewChatAttachment] = useState('')
  const [newChatAttachmentUrl, setNewChatAttachmentUrl] = useState('')
  const [uploadingNewChatFile, setUploadingNewChatFile] = useState(false)

  const activeChild =
    role === 'guardian'
      ? students.find((s) => s.id === selectedChildId) || students[0]
      : null
  const activeGuardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]
  const activeTeacher = teachers.find((t) => t.id === activeTeacherId) || teachers[0]

  const resolveThreadMeta = (thread: (typeof chats)[number]) => {
    const contextName = (thread.studentContext || '').replace(/^Regarding\s+/i, '').trim()
    const matchedStudent =
      students.find(
        (s) =>
          (thread.studentId && s.id === thread.studentId) ||
          (contextName &&
            (s.name.toLowerCase() === contextName.toLowerCase() ||
              contextName.toLowerCase().includes(s.name.toLowerCase()))),
      ) || students[0]
    const matchedGuardian =
      guardians.find(
        (g) =>
          (thread.guardianId && g.id === thread.guardianId) ||
          g.id === matchedStudent?.guardianId ||
          g.linkedStudentIds.includes(matchedStudent?.id || ''),
      ) || activeGuardian

    const guardianName = matchedGuardian?.name || matchedStudent?.guardianName || GUARDIAN_PROFILE.name
    const studentName = matchedStudent?.name || contextName || 'Student'
    const guardianInitials = guardianName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

    const isStaffView = role === 'teacher' || role === 'admin'
    const displayName = isStaffView
      ? `${guardianName} (Parent of ${studentName})`
      : thread.participantName
    const displayInitials = isStaffView ? guardianInitials : thread.initials
    const displaySubtitle = isStaffView
      ? `${matchedStudent ? `${matchedStudent.className} · ${matchedStudent.section} · Roll #${matchedStudent.roll}` : 'Guardian'}${role === 'admin' ? ` · Teacher: ${thread.participantName}` : ''}`
      : `${thread.participantRole}${thread.studentContext ? ` · ${thread.studentContext}` : ''}`

    return {
      guardianName,
      studentName,
      matchedStudent,
      displayName,
      displayInitials,
      displaySubtitle,
      isStaffView,
    }
  }

  // Strictly scoped threads (ZERO cross-family fallback leaks!)
  const visibleChats = useMemo(() => {
    if (role === 'guardian' && activeChild) {
      return chats.filter(
        (c) =>
          c.studentId === activeChild.id ||
          (c.studentContext || '').toLowerCase().includes(activeChild.name.toLowerCase()),
      )
    }
    if (role === 'teacher' && activeTeacher) {
      return chats.filter(
        (c) =>
          c.teacherId === activeTeacher.id ||
          c.participantName.toLowerCase() === activeTeacher.name.toLowerCase(),
      )
    }
    return chats
  }, [chats, role, activeChild, activeTeacher])

  const activeThread = visibleChats.find((c) => c.id === activeId) || visibleChats[0] || null
  const activeMeta = activeThread ? resolveThreadMeta(activeThread) : null

  const selectableStudentsForNewChat = useMemo(() => {
    if (role === 'guardian') {
      const linked = new Set(activeGuardian?.linkedStudentIds || [])
      return students.filter((s) => linked.has(s.id) || s.guardianId === activeGuardianId)
    }
    return students
  }, [role, students, activeGuardian, activeGuardianId])

  const handleOpenThread = (threadId: string) => {
    setActiveId(threadId)
    const t = visibleChats.find((x) => x.id === threadId)
    if (t && t.unread > 0) {
      void runMessageAction({ action: 'mark_read', threadId })
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!draft.trim() && !attachmentName) || !activeThread || uploadingMsgFile) return
    const res = await runMessageAction(
      {
        action: 'send_message',
        threadId: activeThread.id,
        text: draft,
        attachmentName: attachmentName || undefined,
        attachmentUrl: attachmentUrl || undefined,
      },
      'Message sent',
    )
    if (res.ok) {
      setDraft('')
      setAttachmentName('')
      setAttachmentUrl('')
    }
  }

  const handleStartNewChat = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetStuId =
      newChatStudentId ||
      (role === 'guardian' ? activeChild?.id : selectableStudentsForNewChat[0]?.id) ||
      ''
    const targetTchId =
      role === 'teacher' ? activeTeacherId : newChatTeacherId || teachers[0]?.id || ''
    if (!targetStuId || (!newChatText.trim() && !newChatAttachment) || uploadingNewChatFile) return
    const res = await runMessageAction(
      {
        action: 'start_thread',
        studentId: targetStuId,
        teacherId: targetTchId,
        text: newChatText,
        attachmentName: newChatAttachment || undefined,
        attachmentUrl: newChatAttachmentUrl || undefined,
      },
      'New private conversation started!',
    )
    if (res.ok) {
      if (res.threadId) setActiveId(res.threadId)
      setNewChatText('')
      setNewChatAttachment('')
      setNewChatAttachmentUrl('')
      setShowNewChat(false)
    }
  }

  return (
    <PageShell
      eyebrow="End-to-End Scoped Communication · SQLite Persisted"
      title="Guardian–Teacher Messaging"
      subtitle={
        role === 'teacher' || role === 'admin'
          ? 'Private, logged guardian–faculty threads with strict family isolation and attachment support.'
          : 'Message your child’s teachers privately with photo/document attachments and instant notifications.'
      }
      action={
        <button
          type="button"
          onClick={() => {
            setNewChatStudentId(
              role === 'guardian'
                ? activeChild?.id || selectableStudentsForNewChat[0]?.id || ''
                : selectableStudentsForNewChat[0]?.id || '',
            )
            setShowNewChat(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2.5 text-xs font-extrabold text-emerald-300 shadow-xs transition hover:bg-slate-800"
        >
          <Icon name="plus" size={14} />
          New Conversation
        </button>
      }
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-2">
          {visibleChats.map((thread) => {
            const meta = resolveThreadMeta(thread)
            const active = thread.id === activeThread?.id
            const last = thread.messages[thread.messages.length - 1]
            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => handleOpenThread(thread.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                  active
                    ? 'border-slate-900 bg-[#0f172a] text-white shadow-md'
                    : 'border-slate-200/80 bg-white hover:border-emerald-300'
                }`}
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                    active ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-50 text-emerald-800'
                  }`}
                >
                  {meta.displayInitials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-black">{meta.displayName}</p>
                    {thread.unread > 0 && (
                      <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                        {thread.unread}
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-0.5 truncate text-[10px] font-semibold ${
                      active ? 'text-emerald-300/90' : 'text-emerald-700/80'
                    }`}
                  >
                    {meta.displaySubtitle}
                  </p>
                  <p
                    className={`mt-0.5 truncate text-[10px] ${
                      active ? 'text-white/60' : 'text-slate-400'
                    }`}
                  >
                    {last?.text}
                  </p>
                </div>
              </button>
            )
          })}
          {visibleChats.length === 0 && (
            <div className="dmhs-card rounded-2xl p-6 text-center">
              <p className="text-xs font-black text-slate-800">No conversations yet</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                Click <strong>+ New Conversation</strong> above to start a private thread.
              </p>
            </div>
          )}
        </div>

        {activeThread && activeMeta ? (
          <div className="flex min-h-[460px] flex-col rounded-[26px] border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-black text-slate-900">{activeMeta.displayName}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  {activeMeta.displaySubtitle}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                Private Thread · Encrypted Session
              </span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {activeThread.messages.map((msg) => {
                const isMine = msg.senderRole === role
                const senderLabel =
                  msg.senderRole === 'guardian' && (role === 'teacher' || role === 'admin')
                    ? `${msg.sender} (Parent of ${activeMeta.studentName})`
                    : msg.sender
                return (
                  <div
                    key={msg.id}
                    className={`max-w-[82%] rounded-2xl p-3.5 text-xs ${
                      isMine
                        ? 'ml-auto bg-[#0f172a] text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <p
                      className={`text-[10px] font-extrabold ${
                        isMine ? 'text-emerald-300' : 'text-slate-500'
                      }`}
                    >
                      {senderLabel} · {msg.time}
                    </p>
                    <p className="mt-1 leading-relaxed">{msg.text}</p>
                    {msg.attachmentName && (
                      <div className="mt-2 space-y-1.5">
                        {msg.attachmentUrl && isImageAttachment(msg.attachmentUrl) && (
                          <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={msg.attachmentUrl}
                              alt={msg.attachmentName}
                              className="max-h-40 rounded-xl border border-white/15 object-cover"
                            />
                          </a>
                        )}
                        {msg.attachmentUrl ? (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                              isMine
                                ? 'bg-white/15 text-emerald-200 hover:bg-white/25'
                                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-emerald-50'
                            }`}
                          >
                            📎 {msg.attachmentName} · Open ↗
                          </a>
                        ) : (
                          <div
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                              isMine
                                ? 'bg-white/10 text-emerald-200'
                                : 'bg-white text-slate-700 ring-1 ring-slate-200'
                            }`}
                          >
                            📎 {msg.attachmentName}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <form onSubmit={handleSend} className="space-y-2 border-t border-slate-100 p-3.5">
              {(attachmentName || uploadingMsgFile) && (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
                  <span>
                    {uploadingMsgFile
                      ? 'Uploading file to DMHA server...'
                      : `📎 Uploaded: ${attachmentName}${attachmentUrl ? ' ✓' : ''}`}
                  </span>
                  {!uploadingMsgFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentName('')
                        setAttachmentUrl('')
                      }}
                      className="font-black text-rose-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm hover:bg-emerald-50">
                  📎
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      setUploadingMsgFile(true)
                      const up = await uploadDmhsAttachment(f, 'messages')
                      setUploadingMsgFile(false)
                      if (up.ok && up.url) {
                        setAttachmentName(up.filename || f.name)
                        setAttachmentUrl(up.url)
                      }
                    }}
                  />
                </label>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Write a message to ${activeMeta.displayName}...`}
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-400"
                >
                  <Icon name="send" size={14} />
                  Send
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="dmhs-card flex min-h-[360px] flex-col items-center justify-center rounded-[26px] p-10 text-center">
            <p className="text-sm font-black text-slate-900">Start a Private DMHA Conversation</p>
            <p className="mt-1 max-w-sm text-xs font-semibold text-slate-500">
              Select a thread on the left or click <strong>+ New Conversation</strong> to message a teacher or parent directly.
            </p>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewChat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setShowNewChat(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleStartNewChat}
            className="w-full max-w-md space-y-3.5 rounded-[26px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">New Private Conversation</h3>
              <button
                type="button"
                onClick={() => setShowNewChat(false)}
                className="rounded-full bg-slate-100 p-1.5 text-slate-500"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Regarding Student</label>
              <select
                value={newChatStudentId}
                onChange={(e) => setNewChatStudentId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                {selectableStudentsForNewChat.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.className} · {s.section})
                  </option>
                ))}
              </select>
            </div>
            {role !== 'teacher' && (
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Faculty Teacher</label>
                <select
                  value={newChatTeacherId}
                  onChange={(e) => setNewChatTeacherId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Message *</label>
              <textarea
                rows={3}
                required={!newChatAttachment}
                value={newChatText}
                onChange={(e) => setNewChatText(e.target.value)}
                placeholder="Write your message..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200">
                📎{' '}
                {uploadingNewChatFile
                  ? 'Uploading...'
                  : newChatAttachment
                    ? `${newChatAttachment}${newChatAttachmentUrl ? ' ✓' : ''}`
                    : 'Attach Photo / PDF'}
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setUploadingNewChatFile(true)
                    const up = await uploadDmhsAttachment(f, 'messages')
                    setUploadingNewChatFile(false)
                    if (up.ok && up.url) {
                      setNewChatAttachment(up.filename || f.name)
                      setNewChatAttachmentUrl(up.url)
                    }
                  }}
                />
              </label>
              <button
                type="submit"
                className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-black text-white hover:bg-emerald-700"
              >
                Send Message
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}

export { CampusServicesView } from './notices-units-views'

export function ProfileView() {
  const {
    role,
    setRole,
    students,
    teachers,
    guardians,
    activeGuardianId,
    activeTeacherId,
    activeStudentId,
    activeStaffMember,
    activeCustomRole,
    resetDemoData,
    authUser,
    authAccounts,
    logout,
    dbStatus,
    dbStats,
    refreshDbFromServer,
    demoSwitcherEnabled,
    setDemoSwitcherEnabled,
  } = useSchool()

  const activeGuardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]
  const activeTeacher = teachers.find((t) => t.id === activeTeacherId) || teachers[0]
  const activeStudent = students.find((s) => s.id === activeStudentId) || students[0]

  const isAdminSession = authUser?.role === 'admin'
  const isAdminView = role === 'admin'

  const currentLinkedId =
    role === 'guardian'
      ? activeGuardian?.id
      : role === 'teacher'
        ? activeTeacher?.id
        : role === 'student'
          ? activeStudent?.id
          : role === 'staff'
            ? activeStaffMember?.id
            : 'admin-shahid'

  const matchedRoleAccount =
    authAccounts.find((a) => a.linkedEntityId === currentLinkedId && a.role === role) ||
    (authUser?.role === role ? authUser : null)

  const identities: Record<Role, { name: string; subtitle: string; initials: string }> = {
    guardian: {
      name: activeGuardian?.name || GUARDIAN_PROFILE.name,
      subtitle: `${activeGuardian?.relation || GUARDIAN_PROFILE.relation} · ${activeGuardian?.linkedStudentIds.length || 2} Linked Children`,
      initials: activeGuardian?.initials || GUARDIAN_PROFILE.initials,
    },
    student: {
      name: activeStudent?.name || 'Araf Rahman',
      subtitle: `${activeStudent?.className || 'Class 6'} · ${activeStudent?.section || 'Section A'} · Roll #${activeStudent?.roll || '14'}`,
      initials: activeStudent?.initials || 'AR',
    },
    teacher: {
      name: activeTeacher?.name || TEACHER_PROFILE.name,
      subtitle: `${activeTeacher?.subject || 'Faculty'} · ${activeTeacher?.department || 'Academic Faculty'}`,
      initials: activeTeacher?.initials || TEACHER_PROFILE.initials,
    },
    admin: {
      name: ADMIN_PROFILE.name,
      subtitle: `${ADMIN_PROFILE.title} · ${ADMIN_PROFILE.schoolName}`,
      initials: ADMIN_PROFILE.initials,
    },
    staff: {
      name: activeStaffMember?.name || 'DMHA Staff',
      subtitle: `${activeCustomRole?.name || 'Staff'} · ${activeStaffMember?.department || 'DMHA Campus'}`,
      initials: activeStaffMember?.initials || 'ST',
    },
  }

  const current = identities[role]

  const roleCards: { id: Role; label: string; desc: string; icon: IconName }[] = [
    { id: 'guardian', label: 'Guardian', desc: 'Monitor kids, attendance, results & feedback', icon: 'shield' },
    { id: 'student', label: 'Student', desc: 'Subjects, homework, routine & report card', icon: 'book' },
    { id: 'teacher', label: 'Teacher', desc: 'Roll call, feedback composer & gradebook', icon: 'users' },
    { id: 'admin', label: 'School Admin', desc: 'Campus analytics, watchlist & broadcasts', icon: 'award' },
  ]

  return (
    <PageShell
      eyebrow="Settings & Account Security"
      title="Settings, Profile & Password"
      subtitle={
        isAdminView
          ? 'Manage your profile, security credentials, workspace preview, and live SQLite server diagnostics.'
          : role === 'guardian'
            ? 'Manage your contact details, password, biometric verification, and Family Shared Phone settings.'
            : 'Manage your DMHA account profile and update your login password securely.'
      }
    >
      <div className="dmhs-hero rounded-[26px] p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-emerald-400 text-xl font-black text-slate-950">
              {current.initials}
            </span>
            <div>
              <h3 className="text-xl font-black">{current.name}</h3>
              <p className="text-xs text-slate-300">{current.subtitle}</p>
              {matchedRoleAccount && (
                <p className="mt-1 font-mono text-[11px] text-emerald-300">
                  Account: {matchedRoleAccount.email} · ID: {matchedRoleAccount.loginCode}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DesktopAppInstallButton />
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-rose-500"
            >
              <Icon name="logout" size={14} />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Live SQLite Database Monitor — STRICTLY ADMIN ONLY */}
      {isAdminView && (
        <div className="dmhs-card mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Icon name="database" size={19} />
              </span>
              <div>
                <p className="text-xs font-black text-slate-900">
                  Real Server Database · {dbStats?.engine || 'SQLite 3 (Node Native WAL)'}
                </p>
                <p className="text-[11px] font-semibold text-slate-500">
                  File: <code className="font-mono text-slate-700">{dbStats?.dbFile || 'data/dmhs.sqlite'}</code> ·{' '}
                  {dbStats?.sizeKb || 0} KB · Snapshot v{dbStats?.stateVersion || 0}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold ${
                  dbStatus === 'synced'
                    ? 'bg-emerald-50 text-emerald-700'
                    : dbStatus === 'saving'
                      ? 'bg-sky-50 text-sky-700'
                      : 'bg-amber-50 text-amber-700'
                }`}
              >
                <span className="size-2 rounded-full bg-current" />
                {dbStatus === 'synced' ? 'Live Synced' : dbStatus === 'saving' ? 'Saving...' : dbStatus}
              </span>
              <button
                type="button"
                onClick={refreshDbFromServer}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
              >
                Pull Latest
              </button>
            </div>
          </div>

          {dbStats && (
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Users', val: dbStats.usersCount },
                { label: 'Sessions', val: dbStats.sessionsCount },
                { label: 'Quizzes', val: dbStats.quizzesCount },
                { label: 'Attempts', val: dbStats.quizAttemptsCount },
                { label: 'Admissions', val: dbStats.admissionsCount },
                { label: 'QR Scans', val: dbStats.qrScansCount },
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400">{m.label}</p>
                  <p className="mt-0.5 text-lg font-black text-slate-900">{m.val}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AccountSecuritySettingsCard />

      {role === 'guardian' && <GuardianBiometricSettingsCard />}

      {role === 'guardian' && <FamilyModeSettingsCard />}

      {/* Admin Portal Preview Switcher & Demo Reset — STRICTLY ADMIN ONLY */}
      {isAdminSession && (
        <>
          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-sm font-black">Admin Portal Preview Switcher</h3>
            <button
              type="button"
              onClick={() => setDemoSwitcherEnabled(!demoSwitcherEnabled)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600"
            >
              Header Role Switcher: <strong>{demoSwitcherEnabled ? 'ON' : 'OFF'}</strong>
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {roleCards.map((item) => (
              <button
                key={item.id}
                onClick={() => setRole(item.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  role === item.id
                    ? 'border-emerald-500 bg-white shadow-md'
                    : 'border-slate-200 bg-white/70 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon name={item.icon} />
                  {role === item.id && (
                    <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[9px] font-black text-slate-950">
                      ACTIVE
                    </span>
                  )}
                </div>
                <span className="mt-4 block text-sm font-black">{item.label}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{item.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {isAdminView && (
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-black">Reset Demo Data (Admin Only)</p>
            <p className="text-[11px] text-slate-500">
              Restore initial attendance, grades, feedback, and fee invoices.
            </p>
          </div>
          <button
            onClick={resetDemoData}
            className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-900 hover:bg-slate-200"
          >
            Reset
          </button>
        </div>
      )}
    </PageShell>
  )
}
