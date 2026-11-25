'use client'

import React, { useState } from 'react'
import { ADMIN_PROFILE } from './data'
import { Icon } from './icons'
import { useSchool } from './store'
import type { SchoolNotice, StudentRecord } from './types'
import { AttendanceBadge, PageShell, SectionTitle } from './ui'

export function AdminOverview({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const {
    students,
    teachers,
    guardians,
    fees,
    notices,
    campusUnits,
    unitTransferRequests,
    leaveRequests,
    publishNotice,
    updateLeaveStatus,
    bookPTM,
    impersonateUser,
  } = useSchool()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<SchoolNotice['category']>('academic')
  const [audience, setAudience] = useState<SchoolNotice['audience']>('All')
  const [targetUnit, setTargetUnit] = useState('All Units')
  const [pinned, setPinned] = useState(false)
  const [triggeredIds, setTriggeredIds] = useState<Record<string, boolean>>({})
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null)

  const presentCount = students.filter((s) => s.todayStatus === 'present').length
  const attendancePct = Math.round((presentCount / students.length) * 100)
  const paidTotal = fees
    .filter((f) => f.status === 'paid')
    .reduce((sum, f) => sum + f.amount, 0)
  const dueTotal = fees
    .filter((f) => f.status === 'due')
    .reduce((sum, f) => sum + f.amount, 0)

  const riskEvaluations = students
    .map((s) => {
      const reasons: string[] = []
      if (s.attendanceRate < 85) reasons.push(`Attendance ${s.attendanceRate}% (< 85%)`)
      if (s.averageScore < 75) reasons.push(`Avg ${s.averageScore}% (< 75%)`)
      if (s.todayStatus === 'absent') reasons.push('Absent Today')
      if (s.todayStatus === 'late') reasons.push('Late Arrival Today')
      const dropped = s.subjects.find((sub) => sub.latestScore - sub.previousScore <= -5)
      if (dropped) {
        reasons.push(
          `${dropped.name} dropped ${dropped.latestScore - dropped.previousScore}%`,
        )
      }
      return { student: s, reasons }
    })
    .filter((r) => r.reasons.length > 0)

  const handleTriggerPTM = (studentId: string, reasons: string[]) => {
    bookPTM({
      studentId,
      teacherName: 'Nadia Rahman (Class Teacher)',
      subject: 'Academic & Attendance Review',
      slot: 'Saturday · 10:00 AM (Priority PTM)',
      topic: `Auto-flagged by Principal Office: ${reasons.join(' · ')}`,
    })
    setTriggeredIds((prev) => ({ ...prev, [studentId]: true }))
  }

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    const res = await publishNotice({
      title: title.trim(),
      body: body.trim(),
      category,
      audience,
      targetUnit,
      pinned,
      requireAcknowledgement: true,
    })
    if (res.ok) {
      setTitle('')
      setBody('')
      setPinned(false)
    }
  }

  return (
    <PageShell
      eyebrow={ADMIN_PROFILE.schoolName}
      title="Principal & Admin Command Center"
      subtitle={`Managing ${students.length} students, ${guardians.length} guardians, and ${teachers.length} teachers in real time.`}
      action={
        onNavigate && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('accounts')}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-xs font-black text-slate-950 shadow-xs transition hover:bg-emerald-400"
            >
              <Icon name="payment" size={16} />
              Accounts & Finance
            </button>
            <button
              onClick={() => onNavigate('directory')}
              className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-5 py-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Icon name="users" size={16} />
              Manage People
            </button>
          </div>
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => onNavigate?.('directory')}
          className="dmhs-hero rounded-[24px] p-5 text-left text-white transition hover:-translate-y-0.5"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
            Campus Attendance Today
          </p>
          <p className="mt-2 text-3xl font-black text-emerald-400">{attendancePct}%</p>
          <p className="mt-1 text-xs text-slate-300">
            {presentCount} of {students.length} present · Manage →
          </p>
        </button>
        <button
          onClick={() => onNavigate?.('scripts')}
          className="dmhs-card rounded-[24px] p-5 text-left transition hover:-translate-y-0.5 hover:border-rose-300"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Auto At-Risk Alerts
          </p>
          <p className="mt-2 text-3xl font-black text-rose-600">{riskEvaluations.length}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Flagged · Review Scripts →</p>
        </button>
        <button
          onClick={() => onNavigate?.('accounts')}
          className="dmhs-card rounded-[24px] p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-300"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Fees Collected
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">৳{paidTotal.toLocaleString()}</p>
          <p className="mt-1 text-xs font-bold text-emerald-700">
            ৳{dueTotal.toLocaleString()} due · Accounts →
          </p>
        </button>
        <button
          onClick={() => onNavigate?.('campus')}
          className="dmhs-card rounded-[24px] p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-300"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Notices &amp; Units
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">{notices.length}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {campusUnits.length} units ·{' '}
            {unitTransferRequests.filter((r) => r.status === 'pending').length} transfer req →
          </p>
        </button>
      </div>

      {/* Auto At-Risk Early-Warning Engine */}
      <section className="mt-7 rounded-[26px] border border-[#ff6846]/25 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <Icon name="alert" size={20} />
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#c53219]">
                Automated Early-Warning Engine
              </p>
              <h3 className="text-base font-black">
                {riskEvaluations.length} Student(s) Flagged for Guardian Intervention
              </h3>
            </div>
          </div>
          <span className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-extrabold text-black/55">
            Rules: Attendance &lt;85% · Avg &lt;75% · Absent/Late · Subject Drop ≥5%
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          {riskEvaluations.map(({ student, reasons }) => {
            const done = triggeredIds[student.id]
            return (
              <div
                key={student.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f4f5f8] p-4"
              >
                <div>
                  <p className="text-xs font-black">
                    {student.name}{' '}
                    <span className="font-bold text-black/45">
                      ({student.className} {student.section} · Guardian: {student.guardianName})
                    </span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {reasons.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-[#ffe4de] px-2.5 py-0.5 text-[10px] font-extrabold text-[#c53219]"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  disabled={done}
                  onClick={() => handleTriggerPTM(student.id, reasons)}
                  className={`rounded-xl px-4 py-2.5 text-[11px] font-extrabold transition ${
                    done
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-[#0f172a] text-emerald-300 hover:opacity-90'
                  }`}
                >
                  {done ? 'Priority PTM & Alert Sent ✓' : '1-Click Guardian PTM & Alert'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section>
          <SectionTitle
            eyebrow="Early-warning intelligence"
            title="Student Attendance & Risk Monitor"
          />
          <div className="overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f4f5f8] text-[10px] font-extrabold uppercase tracking-wider text-black/40">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Today</th>
                  <th className="px-4 py-3">Term %</th>
                  <th className="px-4 py-3">Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((stu) => (
                  <tr
                    key={stu.id}
                    onClick={() => setSelectedStudent(stu)}
                    className="cursor-pointer transition hover:bg-emerald-50/50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-900">{stu.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {stu.className} {stu.section} · Guardian: {stu.guardianName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <AttendanceBadge status={stu.todayStatus} />
                    </td>
                    <td className="px-4 py-3 font-extrabold">{stu.attendanceRate}%</td>
                    <td className="px-4 py-3 font-extrabold">{stu.averageScore}% →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {leaveRequests.filter((l) => l.status === 'pending').length > 0 && (
            <div className="mt-6">
              <SectionTitle eyebrow="Approval queue" title="Pending Guardian Leave Requests" />
              <div className="space-y-2.5">
                {leaveRequests
                  .filter((l) => l.status === 'pending')
                  .map((lv) => (
                    <div
                      key={lv.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm"
                    >
                      <div>
                        <p className="text-xs font-black">
                          {lv.studentName} · {lv.dateRange}
                        </p>
                        <p className="text-[11px] text-black/50">
                          {lv.guardianName}: {lv.reason}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateLeaveStatus(lv.id, 'approved')}
                          className="rounded-xl bg-emerald-400 px-3.5 py-2 text-[11px] font-black text-black"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateLeaveStatus(lv.id, 'declined')}
                          className="rounded-xl bg-black/6 px-3.5 py-2 text-[11px] font-black text-black/60"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionTitle eyebrow="School broadcast" title="Publish Official Notice" />
          <form
            onSubmit={handlePublish}
            className="rounded-[24px] border border-black/5 bg-white p-5 shadow-sm"
          >
            <div className="grid grid-cols-3 gap-2.5">
              <label className="block text-[11px] font-extrabold text-black/60">
                Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SchoolNotice['category'])}
                  className="mt-1.5 w-full rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
                >
                  <option value="academic">Academic</option>
                  <option value="event">Event</option>
                  <option value="urgent">Urgent Alert</option>
                  <option value="unit">Campus Unit</option>
                  <option value="transport">Transport</option>
                </select>
              </label>
              <label className="block text-[11px] font-extrabold text-black/60">
                Audience
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as SchoolNotice['audience'])}
                  className="mt-1.5 w-full rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
                >
                  <option value="All">All (Campus-Wide)</option>
                  <option value="Guardians">Guardians Only</option>
                  <option value="Teachers">Teachers Only</option>
                  <option value="Students">Students Only</option>
                  <option value="Staff">Staff Only</option>
                </select>
              </label>
              <label className="block text-[11px] font-extrabold text-black/60">
                Campus Unit
                <select
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value)}
                  className="mt-1.5 w-full rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
                >
                  <option value="All Units">All Units</option>
                  {campusUnits.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-[11px] font-extrabold text-black/65">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="size-3.5 accent-emerald-600"
              />
              Pin official circular to top of notice board
            </label>

            <label className="mt-3 block text-[11px] font-extrabold text-black/60">
              Notice Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Term Exam Schedule Published"
                className="mt-1.5 w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-bold outline-none"
              />
            </label>

            <label className="mt-3 block text-[11px] font-extrabold text-black/60">
              Announcement Message
              <textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write the official school notice..."
                className="mt-1.5 w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-semibold outline-none"
              />
            </label>

            <button
              type="submit"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f172a] py-3 text-xs font-extrabold text-emerald-300"
            >
              <Icon name="send" size={14} />
              Broadcast Notice Now
            </button>
          </form>
        </section>
      </div>

      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setSelectedStudent(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-700">
                  DMHA Student Dossier
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">{selectedStudent.name}</h3>
                <p className="text-xs font-semibold text-slate-500">
                  {selectedStudent.className} · {selectedStudent.section} · Roll #{selectedStudent.roll}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold text-slate-400">Attendance</p>
                <p className="mt-1 text-lg font-black">{selectedStudent.attendanceRate}%</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold text-slate-400">GPA</p>
                <p className="mt-1 text-lg font-black text-emerald-700">{selectedStudent.gpa}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold text-slate-400">Average</p>
                <p className="mt-1 text-lg font-black">{selectedStudent.averageScore}%</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 text-xs">
              <p className="font-bold text-slate-700">
                Guardian: <strong>{selectedStudent.guardianName}</strong> ({selectedStudent.guardianPhone})
              </p>
              <p className="mt-1 text-slate-500">Campus Unit: {selectedStudent.busRoute || 'Unit - 1'}</p>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  impersonateUser('student', selectedStudent.id)
                  onNavigate?.('home')
                  setSelectedStudent(null)
                }}
                className="rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-400"
              >
                Open Student Portal →
              </button>
              <button
                onClick={() => {
                  onNavigate?.('directory')
                  setSelectedStudent(null)
                }}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-700"
              >
                Edit in People & Access
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
