'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { DateFilterBar, extractIsoDate, formatPrettyDate, matchesDateFilter } from './date-utils'
import { Icon } from './icons'
import { useSchool } from './store'
import type { ParentAlertLogItem } from './types'
import { PageShell } from './ui'

function normClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

export function ParentAlertsHubView() {
  const {
    role,
    students,
    teachers,
    guardians,
    fees,
    parentAlerts,
    activeTeacherId,
    dispatchParentAlert,
  } = useSchool()

  const activeTeacher = teachers.find((t) => t.id === activeTeacherId)

  // Scope students strictly to assigned classes for Teachers; Admin sees all students
  const scopedStudents = useMemo(() => {
    if (role !== 'teacher') return students
    const assigned = (activeTeacher?.assignedClasses || []).map(normClassToken)
    if (assigned.length === 0) return []
    return students.filter((s) => {
      const fullTok = normClassToken(`${s.className} ${s.section}`)
      const secLetter = s.section.replace(/section/i, '').trim().toLowerCase()
      const compactTok = normClassToken(`${s.className}${secLetter}`)
      const gradeTok = normClassToken(s.className)
      return assigned.includes(fullTok) || assigned.includes(compactTok) || assigned.includes(gradeTok)
    })
  }, [role, students, activeTeacher])

  const [channel, setChannel] = useState<ParentAlertLogItem['channel']>('WhatsApp')
  const [category, setCategory] = useState<ParentAlertLogItem['category']>('Absence Alert')
  const [selectedStudentId, setSelectedStudentId] = useState<string>(scopedStudents[0]?.id || '')
  const [message, setMessage] = useState('')
  const [alertDateFilter, setAlertDateFilter] = useState<string>('ALL')

  useEffect(() => {
    if (scopedStudents.length > 0 && !scopedStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(scopedStudents[0].id)
    }
  }, [scopedStudents, selectedStudentId])

  const activeStudent =
    scopedStudents.find((s) => s.id === selectedStudentId) || scopedStudents[0] || students[0]
  const activeGuardian =
    guardians.find(
      (g) => g.id === activeStudent?.guardianId || g.linkedStudentIds.includes(activeStudent?.id),
    ) ||
    (activeStudent
      ? { id: 'grd-fallback', name: activeStudent.guardianName, phone: activeStudent.guardianPhone }
      : guardians[0])

  const scopedStudentIdSet = useMemo(
    () => new Set(scopedStudents.map((s) => s.id)),
    [scopedStudents],
  )
  const scopedStudentNameSet = useMemo(
    () => new Set(scopedStudents.map((s) => s.name.toLowerCase())),
    [scopedStudents],
  )
  const scopedClassTokens = useMemo(
    () => new Set((activeTeacher?.assignedClasses || []).map(normClassToken)),
    [activeTeacher],
  )

  const scopedParentAlerts = useMemo(() => {
    if (role !== 'teacher') return parentAlerts
    return parentAlerts.filter((log) => {
      const raw = log as unknown as Record<string, unknown>
      const sid = typeof raw.studentId === 'string' ? raw.studentId : ''
      if (sid && scopedStudentIdSet.has(sid)) return true
      const sName = String(log.studentName || '').toLowerCase()
      if (scopedStudentNameSet.has(sName)) return true
      // Match class-wide Class Moment alerts for teacher's assigned classes
      if (sName.includes('class ')) {
        const clsPart = sName.split('(')[0] || sName
        if (scopedClassTokens.has(normClassToken(clsPart))) return true
      }
      if (activeTeacher?.name && log.sentBy === activeTeacher.name && !sid) return true
      return false
    })
  }, [
    role,
    parentAlerts,
    scopedStudentIdSet,
    scopedStudentNameSet,
    scopedClassTokens,
    activeTeacher?.name,
  ])

  // Real-time auto-detected campus triggers (scoped to teacher's assigned classes)
  const absentOrLateStudents = scopedStudents.filter(
    (s) => s.todayStatus === 'absent' || s.todayStatus === 'late',
  )
  const overdueFeeInvoices = fees.filter(
    (f) => f.status === 'due' && (role !== 'teacher' || scopedStudentIdSet.has(f.studentId)),
  )
  const topScholar = [...scopedStudents].sort((a, b) => b.averageScore - a.averageScore)[0]

  const applyTemplate = (
    tplCategory: ParentAlertLogItem['category'],
    studentId?: string,
    customText?: string,
  ) => {
    const stu =
      scopedStudents.find((s) => s.id === (studentId || selectedStudentId)) || scopedStudents[0]
    if (!stu) return
    setSelectedStudentId(stu.id)
    setCategory(tplCategory)
    if (customText) {
      setMessage(customText)
      return
    }
    if (tplCategory === 'Absence Alert') {
      setMessage(
        `DMHA Safety Alert: ${stu.name} (${stu.className} ${stu.section}) is marked ${stu.todayStatus.toUpperCase()} today. Please update leave status in DMHA Smart Learning App.`,
      )
    } else if (tplCategory === 'Fee Reminder') {
      const due = fees
        .filter((f) => f.studentId === stu.id && f.status === 'due')
        .reduce((sum, f) => sum + f.amount, 0)
      setMessage(
        `DMHA Accounts Reminder: Outstanding fee balance for ${stu.name} is BDT ${(due || 4500).toLocaleString()}. Pay seamlessly inside the DMHA Smart Learning App.`,
      )
    } else if (tplCategory === 'Leaderboard') {
      setMessage(
        `DMHA Excellence Alert: Congratulations! ${stu.name} (${stu.className}) is shining on the live DMHA Class Leaderboard with ${stu.averageScore}% average (GPA ${stu.gpa})!`,
      )
    } else {
      setMessage(
        `DMHA Campus Broadcast (${stu.busRoute || 'Unit - 1'}): Afternoon dismissal gates are open on schedule. Please bring your QR Pickup Pass.`,
      )
    }
  }

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !activeStudent || !activeGuardian) return
    dispatchParentAlert({
      channel,
      category,
      recipientName: activeGuardian.name,
      recipientPhone: activeGuardian.phone,
      studentName: activeStudent.name,
      message,
    })
    setMessage('')
  }

  const cleanPhoneForWa = (phone: string) => phone.replace(/[^\d]/g, '')

  return (
    <PageShell
      eyebrow="Automated Parent Communications · WhatsApp & SMS"
      title="Smart Parent Alert Hub"
      subtitle="1-click automated templates for Morning Absence Alerts, Fee Due Reminders, Leaderboard Celebrations, and Bus/Emergency broadcasts — logged directly to SQLite."
    >
      {/* Smart One-Tap Anomaly Triggers */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">
            Live Attendance Trigger
          </p>
          <p className="mt-1 text-base font-black text-slate-900">
            {absentOrLateStudents.length} Absent / Late Today
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {absentOrLateStudents[0]
              ? `${absentOrLateStudents[0].name} (${absentOrLateStudents[0].todayStatus})`
              : 'All students checked in safely!'}
          </p>
          <button
            type="button"
            onClick={() =>
              applyTemplate('Absence Alert', absentOrLateStudents[0]?.id || students[0]?.id)
            }
            className="mt-3 rounded-full bg-rose-50 px-3.5 py-1.5 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
          >
            Load Absence Alert
          </button>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">
            Accounts Fee Trigger
          </p>
          <p className="mt-1 text-base font-black text-slate-900">
            {overdueFeeInvoices.length} Pending Fee Invoice(s)
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {overdueFeeInvoices[0]
              ? `${overdueFeeInvoices[0].studentName} · ৳${overdueFeeInvoices[0].amount.toLocaleString()}`
              : 'No unpaid invoices right now.'}
          </p>
          <button
            type="button"
            onClick={() =>
              applyTemplate('Fee Reminder', overdueFeeInvoices[0]?.studentId || students[0]?.id)
            }
            className="mt-3 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-extrabold text-amber-800 hover:bg-amber-100"
          >
            Load Fee Reminder
          </button>
        </div>

        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
            Leaderboard Celebration
          </p>
          <p className="mt-1 text-base font-black text-slate-900">
            Top Scholar: {topScholar?.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {topScholar?.averageScore}% Avg · Congratulate their guardian via WhatsApp!
          </p>
          <button
            type="button"
            onClick={() => applyTemplate('Leaderboard', topScholar?.id)}
            className="mt-3 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-100"
          >
            Load Congrats Message
          </button>
        </div>
      </div>

      {/* Composer + Delivery Audit Log */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[400px_1fr]">
        <form onSubmit={handleDispatch} className="dmhs-card h-fit p-5">
          <h3 className="text-sm font-black text-slate-900">Compose &amp; Dispatch Alert</h3>

          <div className="mt-4 flex gap-2">
            {(['WhatsApp', 'SMS'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition ${
                  channel === ch
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">
                Student / Guardian Recipient
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                {scopedStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.className}) → {s.guardianName}
                  </option>
                ))}
              </select>
              {activeGuardian && (
                <p className="mt-1 font-mono text-[11px] font-bold text-emerald-700">
                  To: {activeGuardian.name} · {activeGuardian.phone}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">
                Alert Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ParentAlertLogItem['category'])}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                <option value="Absence Alert">Absence Alert</option>
                <option value="Fee Reminder">Fee Reminder</option>
                <option value="Leaderboard">Leaderboard</option>
                <option value="Bus / Emergency">Bus / Emergency</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">Message *</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Click a smart trigger above or write a custom alert..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
              >
                <Icon name="send" size={14} />
                Send {channel} Alert
              </button>
              {activeGuardian && message.trim() && (
                <a
                  href={`https://wa.me/${cleanPhoneForWa(activeGuardian.phone)}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100"
                >
                  Open WhatsApp ↗
                </a>
              )}
            </div>
          </div>
        </form>

        {/* Delivery Log */}
        {(() => {
          const filteredAlerts = scopedParentAlerts.filter((log) =>
            matchesDateFilter(log.sentAt, alertDateFilter),
          )
          const savedAlertDates = Array.from(
            new Set(
              scopedParentAlerts
                .map((log) => extractIsoDate(log.sentAt))
                .filter((d): d is string => Boolean(d)),
            ),
          ).sort((a, b) => (a < b ? 1 : -1))
          return (
            <div className="dmhs-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-900">
                  Parent Alert Delivery Log ({filteredAlerts.length})
                </h3>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                  {role === 'teacher' ? 'Assigned Classes Scoped' : 'SQLite Audit Synced'}
                </span>
              </div>

              <div className="mt-3">
                <DateFilterBar
                  value={alertDateFilter}
                  onChange={setAlertDateFilter}
                  allowAll
                  compact
                  label="Alert Date"
                  savedDates={savedAlertDates}
                />
              </div>

              <div className="mt-4 space-y-3">
                {filteredAlerts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-xs font-semibold text-slate-400">
                    No parent alerts dispatched on{' '}
                    {alertDateFilter === 'ALL'
                      ? 'this filter'
                      : formatPrettyDate(alertDateFilter)}
                    .
                  </div>
                ) : (
                  filteredAlerts.map((log) => {
                    const raw = log as unknown as Record<string, unknown>
                    const matchedStu =
                      students.find((s) => s.id === String(raw.studentId || '')) ||
                      students.find((s) => s.name === log.studentName)
                    const displayRecipient =
                      log.recipientName?.trim() ||
                      matchedStu?.guardianName ||
                      'Linked Class Guardians'
                    const displayPhone =
                      log.recipientPhone?.trim() ||
                      String(raw.guardianPhone || '').trim() ||
                      matchedStu?.guardianPhone ||
                      'App Push Notification'
                    const displaySender = log.sentBy?.trim() || 'DMHA Smart Campus'

                    return (
                      <div
                        key={log.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                                log.channel === 'WhatsApp'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {log.channel}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                              {log.category}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">{log.sentAt}</span>
                        </div>
                        <p className="mt-2 text-xs font-black text-slate-900">
                          To: {displayRecipient} ({displayPhone}) · Re: {log.studentName}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{log.message}</p>
                        <p className="mt-2 text-[10px] font-bold text-emerald-700">
                          ✓ {log.status.toUpperCase()} · Dispatched by {displaySender}
                        </p>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </PageShell>
  )
}
