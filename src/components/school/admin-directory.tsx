'use client'

import React, { useState } from 'react'
import { downloadExcelCsv } from '@/lib/csv-export'
import { AdminEditProfilePasswordModal, type EditableEntity } from './admin-profile-modal'
import { DMHS_CLASSES, DMHS_CLASS_TAGS } from './data'
import { Icon } from './icons'
import { useSchool } from './store'
import type { HouseName } from './types'
import { PageShell, SectionTitle } from './ui'

export function AdminDirectoryView({ onOpenPortal }: { onOpenPortal: () => void }) {
  const {
    students,
    teachers,
    guardians,
    campusUnits,
    auditLogs,
    addTeacher,
    toggleTeacherStatus,
    updateTeacherClasses,
    removeTeacher,
    addGuardian,
    toggleGuardianStatus,
    toggleGuardianSharedMode,
    linkStudentToGuardian,
    removeGuardian,
    addStudent,
    toggleStudentStatus,
    removeStudent,
    impersonateUser,
  } = useSchool()

  const [sectionTab, setSectionTab] = useState<'students' | 'guardians' | 'teachers' | 'audit'>(
    'students',
  )
  const [search, setSearch] = useState('')
  const [editingEntity, setEditingEntity] = useState<EditableEntity | null>(null)

  // Add Student state
  const [stuName, setStuName] = useState('')
  const [stuClass, setStuClass] = useState('Class 6')
  const [stuSection, setStuSection] = useState('Section A')
  const [stuRoll, setStuRoll] = useState('')
  const [stuGuardianId, setStuGuardianId] = useState(guardians[0]?.id || '')
  const [stuHouse, setStuHouse] = useState<HouseName>('Emerald')
  const [stuBlood, setStuBlood] = useState('O+')
  const [stuBus, setStuBus] = useState('Unit - 1')
  const [stuPassword, setStuPassword] = useState('')

  // Add Guardian state
  const [grdName, setGrdName] = useState('')
  const [grdRelation, setGrdRelation] = useState('Father')
  const [grdPhone, setGrdPhone] = useState('')
  const [grdEmail, setGrdEmail] = useState('')
  const [grdLinkStudentId, setGrdLinkStudentId] = useState('')
  const [grdPassword, setGrdPassword] = useState('')

  // Add Teacher state
  const [tchName, setTchName] = useState('')
  const [tchSubject, setTchSubject] = useState('Chemistry')
  const [tchDepartment, setTchDepartment] = useState('Science Faculty')
  const [tchEmail, setTchEmail] = useState('')
  const [tchPhone, setTchPhone] = useState('')
  const [tchClassesText, setTchClassesText] = useState('Class 5A, Class 6A')
  const [tchPassword, setTchPassword] = useState('')

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault()
    if (!stuName.trim()) return
    addStudent({
      name: stuName,
      className: stuClass,
      section: stuSection,
      roll: stuRoll,
      guardianId: stuGuardianId || guardians[0]?.id || '',
      house: stuHouse,
      bloodGroup: stuBlood,
      busRoute: stuBus,
      initialPassword: stuPassword.trim() || undefined,
    })
    setStuName('')
    setStuRoll('')
    setStuPassword('')
  }

  const handleAddGuardian = (e: React.FormEvent) => {
    e.preventDefault()
    if (!grdName.trim()) return
    addGuardian({
      name: grdName,
      relation: grdRelation,
      phone: grdPhone,
      email: grdEmail,
      linkedStudentId: grdLinkStudentId || undefined,
      initialPassword: grdPassword.trim() || undefined,
    })
    setGrdName('')
    setGrdPhone('')
    setGrdEmail('')
    setGrdLinkStudentId('')
    setGrdPassword('')
  }

  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tchName.trim()) return
    const classes = tchClassesText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    addTeacher({
      name: tchName,
      subject: tchSubject,
      department: tchDepartment,
      email: tchEmail,
      phone: tchPhone,
      assignedClasses: classes,
      initialPassword: tchPassword.trim() || undefined,
    })
    setTchName('')
    setTchEmail('')
    setTchPhone('')
    setTchPassword('')
  }

  const q = search.toLowerCase()
  const filteredStudents = students.filter((s) =>
    `${s.name} ${s.className} ${s.section} ${s.roll} ${s.guardianName}`.toLowerCase().includes(q),
  )
  const filteredGuardians = guardians.filter((g) =>
    `${g.name} ${g.phone} ${g.email} ${g.relation}`.toLowerCase().includes(q),
  )
  const filteredTeachers = teachers.filter((t) =>
    `${t.name} ${t.subject} ${t.department} ${t.assignedClasses.join(' ')}`
      .toLowerCase()
      .includes(q),
  )

  return (
    <PageShell
      eyebrow="Master control · Role & directory engine"
      title="People & Access Control"
      subtitle="Add, link, suspend, or impersonate Students, Guardians, and Teachers. Every change automatically syncs across Roll Call, Guardian Portal, Fees, Canteen, and Messaging."
      action={
        <button
          type="button"
          onClick={() =>
            downloadExcelCsv(
              `DMHA-Student-Roster-Attendance-${new Date().toISOString().slice(0, 10)}.csv`,
              [
                'Roll #',
                'Student Name',
                'Class',
                'Section',
                'House',
                'Today Attendance',
                'Gate Check-In',
                'Attendance Rate (%)',
                'GPA',
                'Guardian Name',
                'Guardian Phone',
                'Blood Group',
                'Campus Unit',
                'Status',
              ],
              students.map((s) => [
                s.roll,
                s.name,
                s.className,
                s.section,
                s.house || 'Emerald',
                s.todayStatus.toUpperCase(),
                s.gateCheckIn || '-',
                s.attendanceRate,
                s.gpa,
                s.guardianName,
                s.guardianPhone,
                s.bloodGroup,
                s.busRoute,
                s.status || 'active',
              ]),
            )
          }
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 shadow-xs transition hover:border-emerald-400 hover:bg-emerald-50/50"
        >
          <Icon name="sheet" size={15} className="text-emerald-600" />
          Export Roster &amp; Attendance CSV
        </button>
      }
    >
      {/* KPI Strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-[#0f172a] p-4 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/45">
            Enrolled Students
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-300">{students.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">
            Linked Guardians
          </p>
          <p className="mt-1 text-2xl font-black">{guardians.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">
            Active Faculty
          </p>
          <p className="mt-1 text-2xl font-black">
            {teachers.filter((t) => t.status === 'active').length}/{teachers.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">
            Audit Entries
          </p>
          <p className="mt-1 text-2xl font-black">{auditLogs.length}</p>
        </div>
      </div>

      {/* Sub-Tabs + Search */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['students', `Students (${students.length})`],
              ['guardians', `Guardians (${guardians.length})`],
              ['teachers', `Teachers (${teachers.length})`],
              ['audit', `Audit Log (${auditLogs.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSectionTab(id)}
              className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
                sectionTab === id
                  ? 'bg-[#0f172a] text-emerald-300'
                  : 'bg-white text-black/55 hover:bg-black/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {sectionTab !== 'audit' && (
          <label className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
            <Icon name="search" size={15} className="text-black/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${sectionTab}...`}
              className="w-44 bg-transparent text-xs font-bold outline-none placeholder:text-black/30"
            />
          </label>
        )}
      </div>

      {/* STUDENTS TAB */}
      {sectionTab === 'students' && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={handleAddStudent}
            className="h-fit rounded-[24px] border border-black/5 bg-white p-5 shadow-sm"
          >
            <h3 className="text-sm font-black">+ Enroll New Student</h3>
            <p className="mt-0.5 text-[11px] text-black/45">
              Auto-creates timetable, subjects, canteen wallet, fee invoice & guardian link.
            </p>
            <div className="mt-4 space-y-2.5">
              <input
                value={stuName}
                onChange={(e) => setStuName(e.target.value)}
                placeholder="Student full name *"
                className="w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-bold outline-none"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={stuClass}
                  onChange={(e) => setStuClass(e.target.value)}
                  className="rounded-xl bg-[#f4f5f8] px-2.5 py-2.5 text-xs font-bold outline-none"
                >
                  {DMHS_CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={stuSection}
                  onChange={(e) => setStuSection(e.target.value)}
                  className="rounded-xl bg-[#f4f5f8] px-2.5 py-2.5 text-xs font-bold outline-none"
                >
                  <option>Section A</option>
                  <option>Section B</option>
                </select>
                <input
                  value={stuRoll}
                  onChange={(e) => setStuRoll(e.target.value)}
                  placeholder="Roll #"
                  className="rounded-xl bg-[#f4f5f8] px-2.5 py-2.5 text-xs font-bold outline-none"
                />
              </div>

              <label className="block text-[10px] font-extrabold uppercase text-black/45">
                Assign Guardian
                <select
                  value={stuGuardianId}
                  onChange={(e) => setStuGuardianId(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold text-black outline-none"
                >
                  {guardians.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.relation})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={stuHouse}
                  onChange={(e) => setStuHouse(e.target.value as HouseName)}
                  className="rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
                >
                  <option value="Emerald">Emerald House</option>
                  <option value="Sapphire">Sapphire House</option>
                  <option value="Crimson">Crimson House</option>
                  <option value="Gold">Gold House</option>
                </select>
                <input
                  value={stuBlood}
                  onChange={(e) => setStuBlood(e.target.value)}
                  placeholder="Blood group (e.g. O+)"
                  className="rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
                />
              </div>

              <select
                value={stuBus}
                onChange={(e) => setStuBus(e.target.value)}
                className="w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-bold outline-none"
              >
                {campusUnits.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={stuPassword}
                onChange={(e) => setStuPassword(e.target.value)}
                placeholder="Initial password (default: dmha2026)"
                className="w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 font-mono text-xs font-bold outline-none"
              />

              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-emerald-400 py-3 text-xs font-black text-black transition hover:brightness-95"
              >
                Enroll Student & Sync All Modules
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {filteredStudents.map((stu) => {
              const isSuspended = stu.status === 'suspended'
              return (
                <div
                  key={stu.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm ${
                    isSuspended ? 'border-[#ff6846]/40 opacity-75' : 'border-black/5'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-[#0f172a] text-xs font-black text-emerald-300">
                        {stu.initials}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black">{stu.name}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                              isSuspended
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            {isSuspended ? 'Suspended' : 'Active'}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-black/50">
                          {stu.className} · {stu.section} · Roll #{stu.roll} · Guardian:{' '}
                          <strong>{stu.guardianName}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        aria-label={`Reassign guardian for ${stu.name}`}
                        value={stu.guardianId || ''}
                        onChange={(e) => linkStudentToGuardian(stu.id, e.target.value)}
                        className="rounded-xl bg-[#f4f5f8] px-2.5 py-1.5 text-[10px] font-extrabold outline-none"
                      >
                        <option value="" disabled>
                          Link Guardian...
                        </option>
                        {guardians.map((g) => (
                          <option key={g.id} value={g.id}>
                            Guardian: {g.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setEditingEntity({ kind: 'student', record: stu })}
                        className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold text-amber-800 hover:bg-amber-100"
                      >
                        <Icon name="key" size={12} />
                        Edit Profile &amp; Password
                      </button>
                      <button
                        onClick={() => {
                          impersonateUser('student', stu.id)
                          onOpenPortal()
                        }}
                        className="rounded-xl bg-[#0f172a] px-3 py-1.5 text-[10px] font-extrabold text-emerald-300"
                      >
                        Open Portal
                      </button>
                      <button
                        onClick={() => toggleStudentStatus(stu.id)}
                        className="rounded-xl bg-black/6 px-3 py-1.5 text-[10px] font-extrabold text-black/70"
                      >
                        {isSuspended ? 'Activate' : 'Suspend'}
                      </button>
                      <button
                        onClick={() => removeStudent(stu.id)}
                        className="rounded-xl bg-[#ffe4de] px-3 py-1.5 text-[10px] font-extrabold text-[#c53219]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* GUARDIANS TAB */}
      {sectionTab === 'guardians' && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={handleAddGuardian}
            className="h-fit rounded-[24px] border border-black/5 bg-white p-5 shadow-sm"
          >
            <h3 className="text-sm font-black">+ Register New Guardian</h3>
            <p className="mt-0.5 text-[11px] text-black/45">
              Creates Guardian Portal access & auto-adds them to Pickup Gate authorization.
            </p>
            <div className="mt-4 space-y-2.5">
              <input
                value={grdName}
                onChange={(e) => setGrdName(e.target.value)}
                placeholder="Guardian full name *"
                className="w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-bold outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={grdRelation}
                  onChange={(e) => setGrdRelation(e.target.value)}
                  className="rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
                >
                  <option>Father</option>
                  <option>Mother</option>
                  <option>Legal Guardian</option>
                </select>
                <input
                  value={grdPhone}
                  onChange={(e) => setGrdPhone(e.target.value)}
                  placeholder="Phone number"
                  className="rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
                />
              </div>
              <input
                value={grdEmail}
                onChange={(e) => setGrdEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-bold outline-none"
              />
              <input
                type="text"
                value={grdPassword}
                onChange={(e) => setGrdPassword(e.target.value)}
                placeholder="Initial password (default: dmha2026)"
                className="w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 font-mono text-xs font-bold outline-none"
              />
              <label className="block text-[10px] font-extrabold uppercase text-black/45">
                Link Existing Student (Optional)
                <select
                  value={grdLinkStudentId}
                  onChange={(e) => setGrdLinkStudentId(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold text-black outline-none"
                >
                  <option value="">None yet — link later</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.className} {s.section})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-emerald-400 py-3 text-xs font-black text-black transition hover:brightness-95"
              >
                Add Guardian Account
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {filteredGuardians.map((grd) => {
              const linkedKids = students.filter((s) => grd.linkedStudentIds.includes(s.id))
              const isSuspended = grd.status === 'suspended'
              return (
                <div
                  key={grd.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm ${
                    isSuspended ? 'border-[#ff6846]/40 opacity-75' : 'border-black/5'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eee5ff] text-xs font-black text-[#6935c3]">
                        {grd.initials}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black">{grd.name}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                              isSuspended
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            {grd.status}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-black/50">
                          {grd.relation} · {grd.phone} · {grd.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingEntity({ kind: 'guardian', record: grd })}
                        className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold text-amber-800 hover:bg-amber-100"
                      >
                        <Icon name="key" size={12} />
                        Edit Profile &amp; Password
                      </button>
                      <button
                        onClick={() => {
                          impersonateUser('guardian', grd.id)
                          onOpenPortal()
                        }}
                        className="rounded-xl bg-[#0f172a] px-3 py-1.5 text-[10px] font-extrabold text-emerald-300"
                      >
                        Open Guardian Portal
                      </button>
                      <button
                        onClick={() => toggleGuardianSharedMode(grd.id)}
                        className={`rounded-xl px-3 py-1.5 text-[10px] font-extrabold ${
                          grd.sharedDeviceMode !== false
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {grd.sharedDeviceMode !== false ? 'Shared Phone: ON' : 'Separate Login'}
                      </button>
                      <button
                        onClick={() => toggleGuardianStatus(grd.id)}
                        className="rounded-xl bg-black/6 px-3 py-1.5 text-[10px] font-extrabold text-black/70"
                      >
                        {isSuspended ? 'Activate' : 'Suspend'}
                      </button>
                      <button
                        onClick={() => removeGuardian(grd.id)}
                        className="rounded-xl bg-[#ffe4de] px-3 py-1.5 text-[10px] font-extrabold text-[#c53219]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-black/5 pt-2.5">
                    <span className="text-[10px] font-extrabold uppercase text-black/35">
                      Linked Children:
                    </span>
                    {linkedKids.length === 0 ? (
                      <span className="text-[10px] font-bold text-black/40">None linked yet</span>
                    ) : (
                      linkedKids.map((kid) => (
                        <span
                          key={kid.id}
                          className="rounded-full bg-[#f4f5f8] px-2.5 py-0.5 text-[10px] font-black"
                        >
                          {kid.name} ({kid.className} {kid.section})
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TEACHERS TAB */}
      {sectionTab === 'teachers' && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={handleAddTeacher}
            className="h-fit rounded-[24px] border border-black/5 bg-white p-5 shadow-sm"
          >
            <h3 className="text-sm font-black">+ Add Faculty / Teacher</h3>
            <p className="mt-0.5 text-[11px] text-black/45">
              Automatically creates teacher account, PTM availability & parent messaging thread.
            </p>
            <div className="mt-4 space-y-2.5">
              <input
                value={tchName}
                onChange={(e) => setTchName(e.target.value)}
                placeholder="Teacher full name *"
                className="w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-bold outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={tchSubject}
                  onChange={(e) => setTchSubject(e.target.value)}
                  placeholder="Subject"
                  className="rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
                />
                <input
                  value={tchDepartment}
                  onChange={(e) => setTchDepartment(e.target.value)}
                  placeholder="Department"
                  className="rounded-xl bg-[#f4f5f8] px-3 py-2.5 text-xs font-bold outline-none"
                />
              </div>
              <input
                value={tchEmail}
                onChange={(e) => setTchEmail(e.target.value)}
                placeholder="School email"
                className="w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-bold outline-none"
              />
              <input
                value={tchPhone}
                onChange={(e) => setTchPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-bold outline-none"
              />
              <input
                value={tchClassesText}
                onChange={(e) => setTchClassesText(e.target.value)}
                placeholder="Assigned classes (comma separated)"
                className="w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 text-xs font-bold outline-none"
              />
              <input
                type="text"
                value={tchPassword}
                onChange={(e) => setTchPassword(e.target.value)}
                placeholder="Initial password (default: dmha2026)"
                className="w-full rounded-xl bg-[#f4f5f8] px-3.5 py-2.5 font-mono text-xs font-bold outline-none"
              />
              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-emerald-400 py-3 text-xs font-black text-black transition hover:brightness-95"
              >
                Add Teacher & Sync Messaging
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {filteredTeachers.map((tch) => {
              const isSuspended = tch.status === 'suspended'
              return (
                <div
                  key={tch.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm ${
                    isSuspended ? 'border-[#ff6846]/40 opacity-75' : 'border-black/5'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-[#dff9ff] text-xs font-black text-[#08798d]">
                        {tch.initials}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black">{tch.name}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                              isSuspended
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            {tch.status}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-black/50">
                          {tch.subject} · {tch.department} · {tch.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingEntity({ kind: 'teacher', record: tch })}
                        className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold text-amber-800 hover:bg-amber-100"
                      >
                        <Icon name="key" size={12} />
                        Edit Profile &amp; Password
                      </button>
                      <button
                        onClick={() => {
                          impersonateUser('teacher', tch.id)
                          onOpenPortal()
                        }}
                        className="rounded-xl bg-[#0f172a] px-3 py-1.5 text-[10px] font-extrabold text-emerald-300"
                      >
                        Open Faculty Desk
                      </button>
                      <button
                        onClick={() => toggleTeacherStatus(tch.id)}
                        className="rounded-xl bg-black/6 px-3 py-1.5 text-[10px] font-extrabold text-black/70"
                      >
                        {isSuspended ? 'Activate' : 'Suspend'}
                      </button>
                      <button
                        onClick={() => removeTeacher(tch.id)}
                        className="rounded-xl bg-[#ffe4de] px-3 py-1.5 text-[10px] font-extrabold text-[#c53219]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-black/5 pt-2.5">
                    <span className="text-[10px] font-extrabold uppercase text-black/35">
                      Assigned Sections:
                    </span>
                    {DMHS_CLASS_TAGS.map((cls) => {
                      const assigned = tch.assignedClasses.includes(cls)
                      return (
                        <button
                          key={cls}
                          onClick={() =>
                            updateTeacherClasses(
                              tch.id,
                              assigned
                                ? tch.assignedClasses.filter((c) => c !== cls)
                                : [...tch.assignedClasses, cls],
                            )
                          }
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold transition ${
                            assigned
                              ? 'bg-[#0f172a] text-emerald-300'
                              : 'bg-[#f4f5f8] text-black/40 hover:text-black'
                          }`}
                        >
                          {assigned ? `✓ ${cls}` : `+ ${cls}`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AUDIT LOG TAB */}
      {sectionTab === 'audit' && (
        <section>
          <SectionTitle eyebrow="Security & governance" title="Live Admin Audit Trail" />
          <div className="space-y-2.5">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="text-xs font-black">{log.action}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-black/55">{log.target}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-extrabold text-black/45">{log.actor}</p>
                  <p className="text-[10px] font-bold text-black/30">{log.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {editingEntity && (
        <AdminEditProfilePasswordModal
          target={editingEntity}
          onClose={() => setEditingEntity(null)}
        />
      )}
    </PageShell>
  )
}
