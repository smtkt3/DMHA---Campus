'use client'

import React, { useMemo, useState } from 'react'
import { uploadDmhsAttachment } from '@/lib/dmhs-upload-client'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type { LeaveRequest, TeacherLeaveSubItem } from './types'
import { PageShell } from './ui'

export function LeaveManagementView() {
  const {
    role,
    students,
    teachers,
    guardians,
    selectedChildId,
    activeGuardianId,
    activeTeacherId,
    leaveRequests,
    teacherLeaves,
    runLeaveAction,
  } = useSchool()

  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isGuardian = role === 'guardian'

  const [subTab, setSubTab] = useState<'student' | 'faculty' | 'apply'>(
    isTeacher ? 'faculty' : 'student',
  )

  // Apply Form State
  const activeGuardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]
  const activeChild = students.find((s) => s.id === selectedChildId) || students[0]
  const [applyTarget, setApplyTarget] = useState<'student' | 'faculty'>(
    isTeacher ? 'faculty' : 'student',
  )
  const [stuId, setStuId] = useState(activeChild?.id || students[0]?.id || '')
  const [tchId, setTchId] = useState(activeTeacherId || teachers[0]?.id || '')
  const [dateRange, setDateRange] = useState('26 Nov – 27 Nov 2026')
  const [dateIso, setDateIso] = useState(new Date().toISOString().slice(0, 10))
  const [stuLeaveType, setStuLeaveType] =
    useState<NonNullable<LeaveRequest['leaveType']>>('Medical / Sick')
  const [tchLeaveType, setTchLeaveType] =
    useState<NonNullable<TeacherLeaveSubItem['leaveType']>>('Casual Leave')
  const [reason, setReason] = useState('')
  const [attachmentName, setAttachmentName] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [uploadingLeaveFile, setUploadingLeaveFile] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const visibleStudentLeaves = useMemo(() => {
    if (isGuardian) {
      const linked = new Set(activeGuardian?.linkedStudentIds || [])
      return leaveRequests.filter((l) => linked.has(l.studentId))
    }
    return leaveRequests
  }, [leaveRequests, isGuardian, activeGuardian])

  const visibleFacultyLeaves = useMemo(() => {
    if (isTeacher) {
      return teacherLeaves.filter((t) => t.teacherId === activeTeacherId)
    }
    return teacherLeaves
  }, [teacherLeaves, isTeacher, activeTeacherId])

  const pendingStudentCount = visibleStudentLeaves.filter((l) => l.status === 'pending').length
  const pendingFacultyCount = visibleFacultyLeaves.filter((l) => l.status === 'pending').length

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim() || uploadingLeaveFile) return
    if (applyTarget === 'student' || isGuardian) {
      const res = await runLeaveAction(
        {
          action: 'submit_student_leave',
          studentId: isGuardian ? activeChild?.id || stuId : stuId,
          dateRange,
          leaveType: stuLeaveType,
          reason,
          attachmentName: attachmentName || undefined,
          attachmentUrl: attachmentUrl || undefined,
        },
        'Student leave application submitted!',
      )
      if (res.ok) {
        setReason('')
        setAttachmentName('')
        setAttachmentUrl('')
        setSubTab('student')
      }
    } else {
      const res = await runLeaveAction(
        {
          action: 'submit_faculty_leave',
          teacherId: isTeacher ? activeTeacherId : tchId,
          dateIso,
          leaveType: tchLeaveType,
          reason,
          attachmentName: attachmentName || undefined,
          attachmentUrl: attachmentUrl || undefined,
        },
        'Faculty leave application submitted for Principal approval!',
      )
      if (res.ok) {
        setReason('')
        setAttachmentName('')
        setAttachmentUrl('')
        setSubTab('faculty')
      }
    }
  }

  return (
    <PageShell
      eyebrow="DMHA Attendance & HR · Unified Leave Approval Center"
      title="Leave Management & Quota Hub"
      subtitle="Manage student medical/personal leave approvals (with automatic excused attendance sync) and faculty annual leave balances in one place."
      action={
        <button
          type="button"
          onClick={() => setSubTab('apply')}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2.5 text-xs font-extrabold text-emerald-300 shadow-xs hover:bg-slate-800"
        >
          <Icon name="plus" size={14} />
          Apply for Leave
        </button>
      }
    >
      {isGuardian && <ChildSwitcherBar />}

      {/* KPI Strip */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            Pending Leave Approvals
          </p>
          <p className="mt-1.5 text-3xl font-black">
            {isGuardian ? pendingStudentCount : pendingStudentCount + pendingFacultyCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-300">
            Approving student leave auto-marks Excused
          </p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Student Leave Applications
          </p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">{visibleStudentLeaves.length}</p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-700">
            {visibleStudentLeaves.filter((l) => l.status === 'approved').length} approved
          </p>
        </div>
        {!isGuardian && (
          <>
            <div className="dmhs-card rounded-[22px] p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Faculty Leave Requests
              </p>
              <p className="mt-1.5 text-3xl font-black text-slate-900">
                {visibleFacultyLeaves.length}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-amber-700">
                {pendingFacultyCount} awaiting Principal decision
              </p>
            </div>
            <div className="dmhs-card rounded-[22px] p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Annual Faculty Leave Policy
              </p>
              <p className="mt-1.5 text-xl font-black text-emerald-700">12 CL · 10 SL · 10 EL</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                Casual / Sick / Earned days per year
              </p>
            </div>
          </>
        )}
      </div>

      {/* Sub-Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab('student')}
          className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
            subTab === 'student'
              ? 'bg-[#0f172a] text-emerald-300'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Student Leave Requests ({visibleStudentLeaves.length})
        </button>
        {!isGuardian && (
          <button
            type="button"
            onClick={() => setSubTab('faculty')}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
              subTab === 'faculty'
                ? 'bg-[#0f172a] text-emerald-300'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            Faculty Leaves &amp; Quotas ({visibleFacultyLeaves.length})
          </button>
        )}
        <button
          type="button"
          onClick={() => setSubTab('apply')}
          className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
            subTab === 'apply'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          + Submit Leave Request
        </button>
      </div>

      {/* 1. STUDENT LEAVES */}
      {subTab === 'student' && (
        <div className="space-y-3">
          {visibleStudentLeaves.map((lv) => (
            <div
              key={lv.id}
              className="dmhs-card flex flex-wrap items-center justify-between gap-4 rounded-[22px] p-5"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-slate-900">{lv.studentName}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                    {lv.leaveType || 'Medical / Personal'}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                      lv.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : lv.status === 'declined'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {lv.status}
                  </span>
                </div>
                <p className="mt-1 text-xs font-bold text-slate-700">
                  Dates: {lv.dateRange} · Guardian: {lv.guardianName}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-600">“{lv.reason}”</p>
                {lv.attachmentName && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
                      📎 Medical / Support Note: {lv.attachmentName}
                    </span>
                    {lv.attachmentUrl && (
                      <a
                        href={lv.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-black text-emerald-300 hover:bg-slate-800"
                      >
                        View / Download ↗
                      </a>
                    )}
                  </div>
                )}
              </div>

              {(isAdmin || isTeacher) && lv.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void runLeaveAction(
                        { action: 'decide_student_leave', leaveId: lv.id, status: 'approved' },
                        `Approved leave for ${lv.studentName} & auto-marked Excused!`,
                      )
                    }
                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                  >
                    Approve &amp; Mark Excused ✓
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void runLeaveAction(
                        { action: 'decide_student_leave', leaveId: lv.id, status: 'declined' },
                        `Declined leave for ${lv.studentName}`,
                      )
                    }
                    className="rounded-full bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-100"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
          {visibleStudentLeaves.length === 0 && (
            <div className="dmhs-card rounded-2xl p-10 text-center text-xs font-bold text-slate-400">
              No student leave applications recorded.
            </div>
          )}
        </div>
      )}

      {/* 2. FACULTY LEAVES & QUOTAS */}
      {subTab === 'faculty' && !isGuardian && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(isTeacher ? teachers.filter((t) => t.id === activeTeacherId) : teachers).map((t) => {
              const taken = teacherLeaves.filter(
                (l) => l.teacherId === t.id && l.status === 'substituted',
              ).length
              return (
                <div key={t.id} className="dmhs-card rounded-2xl p-4">
                  <p className="text-xs font-black text-slate-900">{t.name}</p>
                  <p className="text-[10px] font-semibold text-slate-500">{t.subject}</p>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-500">Used: {taken}d</span>
                    <span className="text-emerald-700">Balance: {Math.max(0, 32 - taken)}d / 32d</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="space-y-3">
            {visibleFacultyLeaves.map((tl) => (
              <div
                key={tl.id}
                className="dmhs-card flex flex-wrap items-center justify-between gap-4 rounded-[22px] p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-slate-900">{tl.teacherName}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                      {tl.leaveType || 'Casual Leave'} · {tl.date}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        tl.status === 'substituted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tl.status === 'declined'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {tl.status === 'substituted' ? 'Approved' : tl.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    {tl.periodSlot} ({tl.classSection}) — “{tl.reason}”
                  </p>
                  {tl.attachmentName && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-emerald-700">
                        📎 Supporting File: {tl.attachmentName}
                      </span>
                      {tl.attachmentUrl && (
                        <a
                          href={tl.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-black text-emerald-300 hover:bg-slate-800"
                        >
                          Open / Download ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
                {isAdmin && tl.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void runLeaveAction(
                          { action: 'decide_faculty_leave', id: tl.id, status: 'substituted' },
                          `Approved leave for ${tl.teacherName}`,
                        )
                      }
                      className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white"
                    >
                      Approve Leave ✓
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void runLeaveAction(
                          { action: 'decide_faculty_leave', id: tl.id, status: 'declined' },
                          `Declined leave for ${tl.teacherName}`,
                        )
                      }
                      className="rounded-full bg-rose-50 px-4 py-2 text-xs font-black text-rose-700"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. APPLY FOR LEAVE FORM */}
      {subTab === 'apply' && (
        <form onSubmit={handleApplySubmit} className="dmhs-card max-w-xl space-y-4 rounded-[24px] p-6">
          <h3 className="text-base font-black text-slate-900">Submit Leave Application</h3>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setApplyTarget('student')}
                className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold ${
                  applyTarget === 'student'
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                Student Leave
              </button>
              <button
                type="button"
                onClick={() => setApplyTarget('faculty')}
                className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold ${
                  applyTarget === 'faculty'
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                Faculty Leave
              </button>
            </div>
          )}

          {applyTarget === 'student' || isGuardian ? (
            <>
              {!isGuardian && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Student</label>
                  <select
                    value={stuId}
                    onChange={(e) => setStuId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.className})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Leave Category</label>
                  <select
                    value={stuLeaveType}
                    onChange={(e) =>
                      setStuLeaveType(e.target.value as NonNullable<LeaveRequest['leaveType']>)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                  >
                    <option value="Medical / Sick">Medical / Sick</option>
                    <option value="Family / Personal">Family / Personal</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Competition / Academic">Competition / Academic</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Date Range</label>
                  <input
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {isAdmin && (
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Faculty</label>
                  <select
                    value={tchId}
                    onChange={(e) => setTchId(e.target.value)}
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
                <label className="text-[10px] font-black uppercase text-slate-400">Leave Type</label>
                <select
                  value={tchLeaveType}
                  onChange={(e) =>
                    setTchLeaveType(e.target.value as NonNullable<TeacherLeaveSubItem['leaveType']>)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                >
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Earned Leave">Earned Leave</option>
                  <option value="Official / Training">Official / Training</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Leave Date</label>
                <input
                  type="date"
                  value={dateIso}
                  onChange={(e) => setDateIso(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Reason *</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly explain the reason for leave..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">
                📎{' '}
                {uploadingLeaveFile
                  ? 'Uploading document...'
                  : attachmentName
                    ? `${attachmentName}${attachmentUrl ? ' ✓' : ''}`
                    : 'Attach Medical Note / Document'}
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setUploadingLeaveFile(true)
                    setUploadError('')
                    const up = await uploadDmhsAttachment(f, 'leaves')
                    setUploadingLeaveFile(false)
                    if (up.ok && up.url) {
                      setAttachmentName(up.filename || f.name)
                      setAttachmentUrl(up.url)
                    } else {
                      setUploadError(up.error || 'Upload failed')
                    }
                  }}
                />
              </label>
              {uploadError && (
                <span className="text-[11px] font-bold text-rose-600">{uploadError}</span>
              )}
            </div>
            <button
              type="submit"
              disabled={uploadingLeaveFile}
              className="rounded-full bg-emerald-600 px-6 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {uploadingLeaveFile ? 'Uploading...' : 'Submit Leave Application'}
            </button>
          </div>
        </form>
      )}
    </PageShell>
  )
}
