'use client'

import React, { useState } from 'react'
import { Icon } from './icons'
import { useSchool } from './store'
import type {
  CampusTaskItem,
  EmployeeDutyShift,
  HelpDeskTicket,
  RfidDeviceRecord,
  RfidPunchLog,
  StudentFineRecord,
} from './types'
import { PageShell } from './ui'

// ==================== 1. HELP DESK ====================
export function HelpDeskView() {
  const { helpDeskTickets, runErpOps } = useSchool()
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<HelpDeskTicket['category']>('Campus Facility')
  const [priority, setPriority] = useState<HelpDeskTicket['priority']>('Normal')
  const [requesterName, setRequesterName] = useState('')
  const [description, setDescription] = useState('')
  const [replies, setReplies] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const openCount = helpDeskTickets.filter((t) => t.status === 'open').length
  const progressCount = helpDeskTickets.filter((t) => t.status === 'in_progress').length
  const resolvedCount = helpDeskTickets.filter((t) => t.status === 'resolved').length
  const visible =
    filter === 'all' ? helpDeskTickets : helpDeskTickets.filter((t) => t.status === filter)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) return
    setSaving(true)
    const res = await runErpOps(
      {
        action: 'create_ticket',
        subject,
        category,
        priority,
        requesterName: requesterName.trim() || 'Campus Reception',
        description,
      },
      'Help Desk support ticket created!',
    )
    setSaving(false)
    if (res.ok) {
      setSubject('')
      setRequesterName('')
      setDescription('')
    }
  }

  return (
    <PageShell
      eyebrow="Admin Support Center · SLA Tracking"
      title="Help Desk & Support Tickets"
      subtitle="Track, assign, and resolve parent billing queries, classroom IT requests, transport issues, and campus maintenance tickets."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-300">
            Total Tickets
          </p>
          <p className="mt-1 text-3xl font-black">{helpDeskTickets.length}</p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-rose-500">
            Open Queue
          </p>
          <p className="mt-1 text-3xl font-black text-rose-600">{openCount}</p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-amber-600">
            In Progress
          </p>
          <p className="mt-1 text-3xl font-black text-amber-600">{progressCount}</p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-600">
            Resolved
          </p>
          <p className="mt-1 text-3xl font-black text-emerald-700">{resolvedCount}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={handleCreate} className="dmhs-card h-fit rounded-[24px] p-5 space-y-3.5">
          <h3 className="text-sm font-black text-slate-900">Log New Support Ticket</h3>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ticket subject (e.g., Smart Board calibration in 5B)"
            required
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as HelpDeskTicket['category'])}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              <option>Billing & Fees</option>
              <option>IT & Portal</option>
              <option>Transport & Gate</option>
              <option>Academics</option>
              <option>Campus Facility</option>
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as HelpDeskTicket['priority'])}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              <option>Low</option>
              <option>Normal</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </div>
          <input
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            placeholder="Requester name (Guardian / Teacher / Staff)"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
            placeholder="Describe the issue or request..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Logging Ticket...' : 'Create Support Ticket'}
          </button>
        </form>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['all', 'open', 'in_progress', 'resolved'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilter(st)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold capitalize ${
                  filter === st
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {visible.map((t) => (
            <div key={t.id} className="dmhs-card rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-black text-slate-400">
                      {t.ticketNo}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700">
                      {t.category}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                        t.priority === 'Urgent' || t.priority === 'High'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>
                  <h4 className="mt-1 text-sm font-black text-slate-900">{t.subject}</h4>
                  <p className="mt-1 text-xs text-slate-600">{t.description}</p>
                  <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                    Requester: {t.requesterName} ({t.requesterRole}) · Logged {t.createdAt}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                    t.status === 'resolved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : t.status === 'in_progress'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {t.status.replace('_', ' ')}
                </span>
              </div>

              {t.adminReply && (
                <div className="mt-3 rounded-xl bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-900">
                  <strong>Resolution Note:</strong> {t.adminReply}
                </div>
              )}

              {t.status !== 'resolved' && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <input
                    value={replies[t.id] || ''}
                    onChange={(e) => setReplies((p) => ({ ...p, [t.id]: e.target.value }))}
                    placeholder="Type admin resolution / response note..."
                    className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void runErpOps(
                        {
                          action: 'update_ticket',
                          ticketId: t.id,
                          status: 'in_progress',
                          adminReply: replies[t.id] || undefined,
                        },
                        `Ticket ${t.ticketNo} marked In Progress`,
                      )
                    }
                    className="rounded-xl bg-amber-100 px-3 py-1.5 text-[11px] font-black text-amber-800"
                  >
                    In Progress
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void runErpOps(
                        {
                          action: 'update_ticket',
                          ticketId: t.id,
                          status: 'resolved',
                          adminReply: replies[t.id] || 'Resolved by DMHA Admin Desk.',
                        },
                        `Ticket ${t.ticketNo} resolved!`,
                      )
                    }
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white"
                  >
                    Mark Resolved
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  )
}

// ==================== 2. TASK MANAGEMENT (Upgraded Dedicated Hub) ====================
export { TaskManagementView } from './task-management-views'

// ==================== 3. EMPLOYEE DUTY ROSTER ====================
export function EmployeeDutyView() {
  const { employeeDuties, teachers, staffMembers, campusUnits, runErpOps } = useSchool()
  const [employeeName, setEmployeeName] = useState(teachers[0]?.name || 'Nadia Rahman')
  const [dutyType, setDutyType] = useState<EmployeeDutyShift['dutyType']>('Morning Gate Duty')
  const [campusUnit, setCampusUnit] = useState(campusUnits[0]?.name || 'Unit - 1')
  const [dateIso, setDateIso] = useState('2026-11-25')
  const [shiftTime, setShiftTime] = useState('07:30 AM – 08:30 AM')
  const [notes, setNotes] = useState('')

  const people = [
    ...teachers.map((t) => ({ name: t.name, role: `${t.subject} Teacher` })),
    ...staffMembers.map((s) => ({ name: s.name, role: s.department })),
  ]

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    const match = people.find((p) => p.name === employeeName)
    const res = await runErpOps(
      {
        action: 'create_duty',
        employeeName,
        employeeRole: match?.role || 'Faculty / Staff',
        dutyType,
        campusUnit,
        dateIso,
        shiftTime,
        notes,
      },
      `Duty shift assigned to ${employeeName}!`,
    )
    if (res.ok) setNotes('')
  }

  return (
    <PageShell
      eyebrow="Campus Security & Supervision · Shift Roster"
      title="Employee Duty Roster"
      subtitle="Schedule morning gate shifts, assembly supervision, exam invigilation, corridor patrol, and dismissal escort duties across Unit - 1 & Unit - 2."
    >
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={handleAssign} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
          <h3 className="text-sm font-black text-slate-900">Assign Duty Shift</h3>
          <select
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold"
          >
            {people.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} — {p.role}
              </option>
            ))}
          </select>
          <select
            value={dutyType}
            onChange={(e) => setDutyType(e.target.value as EmployeeDutyShift['dutyType'])}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold"
          >
            <option>Morning Gate Duty</option>
            <option>Assembly Supervision</option>
            <option>Break & Corridor Patrol</option>
            <option>Exam Hall Invigilation</option>
            <option>Dismissal & Bus Escort</option>
            <option>Reception & Help Desk</option>
          </select>
          <div className="grid grid-cols-2 gap-2.5">
            <select
              value={campusUnit}
              onChange={(e) => setCampusUnit(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              {campusUnits.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateIso}
              onChange={(e) => setDateIso(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            />
          </div>
          <input
            value={shiftTime}
            onChange={(e) => setShiftTime(e.target.value)}
            placeholder="Shift time (e.g., 07:30 AM – 08:30 AM)"
            required
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Duty instructions / room / gate note..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300 hover:bg-slate-800"
          >
            Schedule Duty Shift
          </button>
        </form>

        <div className="space-y-3">
          {employeeDuties.map((d) => (
            <div
              key={d.id}
              className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black text-indigo-700">
                    {d.dutyType}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-600">
                    {d.campusUnit}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    {d.dateIso} · {d.shiftTime}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-black text-slate-900">
                  {d.employeeName}{' '}
                  <span className="text-xs font-semibold text-slate-400">({d.employeeRole})</span>
                </p>
                {d.notes && <p className="mt-0.5 text-xs text-slate-500">{d.notes}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(['scheduled', 'on_duty', 'completed', 'absent'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() =>
                      void runErpOps(
                        { action: 'update_duty_status', dutyId: d.id, status: st },
                        `Duty marked ${st.replace('_', ' ')}`,
                      )
                    }
                    className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                      d.status === st
                        ? st === 'completed'
                          ? 'bg-emerald-600 text-white'
                          : st === 'on_duty'
                            ? 'bg-sky-600 text-white'
                            : st === 'absent'
                              ? 'bg-rose-600 text-white'
                              : 'bg-[#0f172a] text-emerald-300'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  )
}

// ==================== 4. FINGERPRINT & RFID ATTENDANCE ====================
export function FingerRfidAttendanceView() {
  const { rfidDevices, rfidPunches, students, teachers, campusUnits, runErpOps } = useSchool()
  const [deviceName, setDeviceName] = useState('')
  const [deviceIp, setDeviceIp] = useState('192.168.1.210')
  const [deviceUnit, setDeviceUnit] = useState(campusUnits[0]?.name || 'Unit - 1')
  const [deviceMode, setDeviceMode] = useState<RfidDeviceRecord['mode']>('Fingerprint + RFID')

  const [punchDeviceId, setPunchDeviceId] = useState(rfidDevices[0]?.id || 'dev-zk-1')
  const [personType, setPersonType] = useState<'student' | 'teacher'>('student')
  const [personId, setPersonId] = useState(students[0]?.id || 'stu-araf')
  const [method, setMethod] = useState<RfidPunchLog['method']>('RFID Card')
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN')

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deviceName.trim() || !deviceIp.trim()) return
    const res = await runErpOps(
      {
        action: 'register_rfid_device',
        name: deviceName,
        ipAddress: deviceIp,
        campusUnit: deviceUnit,
        mode: deviceMode,
      },
      'Biometric / RFID device registered!',
    )
    if (res.ok) setDeviceName('')
  }

  const handleRecordPunch = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetName =
      personType === 'student'
        ? students.find((s) => s.id === personId)?.name || ''
        : teachers.find((t) => t.id === personId)?.name || ''
    if (!targetName) return
    await runErpOps(
      {
        action: 'record_rfid_punch',
        deviceId: punchDeviceId,
        personType,
        personId,
        personName: targetName,
        cardUid: `${method === 'Fingerprint' ? 'FP' : 'RF'}-${personId.toUpperCase()}`,
        method,
        direction,
      },
      `${method} ${direction} punch synced to Daily Roll Call for ${targetName}!`,
    )
  }

  return (
    <PageShell
      eyebrow="Biometric Hardware Sync · ZKTeco & RFID"
      title="Fingerprint & RF Attendance Hub"
      subtitle="Connect ZKTeco / Hikvision fingerprint & RFID turnstiles across Unit - 1 & Unit - 2 and auto-sync gate punches into Daily Roll Call."
    >
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {rfidDevices.map((dev) => (
          <div key={dev.id} className="dmhs-card rounded-[22px] p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {dev.status.toUpperCase()}
              </span>
              <span className="font-mono text-[10px] font-bold text-slate-400">{dev.ipAddress}</span>
            </div>
            <h3 className="mt-2 text-sm font-black text-slate-900">{dev.name}</h3>
            <p className="text-[11px] font-semibold text-slate-500">
              {dev.model} · {dev.campusUnit}
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
              <span className="font-bold text-slate-500">{dev.mode}</span>
              <span className="font-black text-emerald-700">{dev.totalPunchesToday} punches today</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <form onSubmit={handleRecordPunch} className="dmhs-card space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">
              Live Fingerprint / RFID Punch Sync
            </h3>
            <p className="text-[11px] text-slate-500">
              Recording a student <strong>IN</strong> punch automatically updates Daily Roll Call to{' '}
              <strong>Present</strong> and logs gate check-in time.
            </p>
            <select
              value={punchDeviceId}
              onChange={(e) => setPunchDeviceId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              {rfidDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={personType}
                onChange={(e) => {
                  const next = e.target.value as 'student' | 'teacher'
                  setPersonType(next)
                  setPersonId(next === 'student' ? students[0]?.id || '' : teachers[0]?.id || '')
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT')}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                <option value="IN">Gate IN</option>
                <option value="OUT">Gate OUT</option>
              </select>
            </div>
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              {personType === 'student'
                ? students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.className} · {s.section})
                    </option>
                  ))
                : teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject})
                    </option>
                  ))}
            </select>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as RfidPunchLog['method'])}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              <option>RFID Card</option>
              <option>Fingerprint</option>
              <option>Face ID</option>
            </select>
            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white hover:bg-emerald-700"
            >
              Tap Card / Sync Biometric Punch
            </button>
          </form>

          <form onSubmit={handleRegisterDevice} className="dmhs-card space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">Register New Biometric Terminal</h3>
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Terminal label (e.g., ZKTeco Unit-2 Library)"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={deviceIp}
                onChange={(e) => setDeviceIp(e.target.value)}
                placeholder="192.168.1.210"
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold"
              />
              <select
                value={deviceUnit}
                onChange={(e) => setDeviceUnit(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                {campusUnits.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={deviceMode}
              onChange={(e) => setDeviceMode(e.target.value as RfidDeviceRecord['mode'])}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              <option>Fingerprint + RFID</option>
              <option>RFID Card Gate</option>
              <option>Face + Fingerprint</option>
            </select>
            <button
              type="submit"
              className="w-full rounded-xl bg-[#0f172a] py-2 text-xs font-black text-emerald-300"
            >
              + Connect Terminal
            </button>
          </form>
        </div>

        <div className="dmhs-card rounded-[24px] p-5">
          <h3 className="mb-3 text-sm font-black text-slate-900">
            Live Biometric &amp; RFID Punch Feed ({rfidPunches.length})
          </h3>
          <div className="space-y-2.5">
            {rfidPunches.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                        p.direction === 'IN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.direction}
                    </span>
                    <p className="text-xs font-black text-slate-900">{p.personName}</p>
                    <span className="font-mono text-[10px] font-bold text-slate-400">
                      {p.cardUid}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                    {p.deviceName} · {p.method} · {p.personType.toUpperCase()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900">{p.punchedAt}</p>
                  <p className="text-[10px] font-bold text-emerald-600">
                    {p.syncedToAttendance ? '✓ Synced to Attendance' : 'Pending'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  )
}

// ==================== 5. FINE MANAGEMENT ====================
export function FineManagementView() {
  const { studentFines, students, runErpOps } = useSchool()
  const [studentId, setStudentId] = useState(students[0]?.id || 'stu-araf')
  const [category, setCategory] = useState<StudentFineRecord['category']>('Late Tuition Fee')
  const [amount, setAmount] = useState('200')
  const [reason, setReason] = useState('')
  const [postToInvoice, setPostToInvoice] = useState(true)

  const unpaidTotal = studentFines
    .filter((f) => f.status === 'unpaid' || f.status === 'invoiced')
    .reduce((sum, f) => sum + f.amount, 0)

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    const res = await runErpOps(
      {
        action: 'issue_fine',
        studentId,
        category,
        amount: Number(amount),
        reason,
        postToInvoice,
      },
      postToInvoice
        ? 'Fine issued and posted directly to student Fee Billing!'
        : 'Fine recorded in Fine Ledger!',
    )
    if (res.ok) setReason('')
  }

  return (
    <PageShell
      eyebrow="Accounts & Discipline · Penalty Ledger"
      title="Fine Management"
      subtitle="Issue late tuition surcharges, library overdue penalties, or property damage fines — waive with principal approval or push directly into School Fees."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-300">
            Outstanding Fines
          </p>
          <p className="mt-1 text-3xl font-black">৳{unpaidTotal.toLocaleString()}</p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
            Total Fine Records
          </p>
          <p className="mt-1 text-3xl font-black text-slate-900">{studentFines.length}</p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-600">
            Waived / Settled
          </p>
          <p className="mt-1 text-3xl font-black text-emerald-700">
            {studentFines.filter((f) => f.status === 'paid' || f.status === 'waived').length}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={handleIssue} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
          <h3 className="text-sm font-black text-slate-900">Issue Student Fine</h3>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.className} · {s.section})
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2.5">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as StudentFineRecord['category'])}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
            >
              <option>Late Tuition Fee</option>
              <option>Library Book Overdue</option>
              <option>Unexcused Absence</option>
              <option>Uniform / ID Violation</option>
              <option>Lab / Property Damage</option>
            </select>
            <input
              type="number"
              min={10}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (BDT)"
              required
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black"
            />
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            placeholder="Reason / remark for fine..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
          />
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={postToInvoice}
              onChange={(e) => setPostToInvoice(e.target.checked)}
              className="size-4 accent-emerald-600"
            />
            Auto-post as payable invoice in School Fees
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300 hover:bg-slate-800"
          >
            Issue Fine
          </button>
        </form>

        <div className="space-y-3">
          {studentFines.map((f) => (
            <div
              key={f.id}
              className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-700">
                    {f.category}
                  </span>
                  <span className="text-xs font-black text-slate-900">
                    {f.studentName} <span className="text-slate-400">({f.classLabel})</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{f.reason}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                  Issued {f.issuedAt} by {f.issuedBy}
                  {f.waivedReason ? ` · Waived: ${f.waivedReason}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-slate-900">
                  ৳{f.amount.toLocaleString()}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                    f.status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : f.status === 'waived'
                        ? 'bg-slate-100 text-slate-600'
                        : f.status === 'invoiced'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {f.status}
                </span>
                {(f.status === 'unpaid' || f.status === 'invoiced') && (
                  <>
                    {f.status === 'unpaid' && (
                      <button
                        type="button"
                        onClick={() =>
                          void runErpOps(
                            { action: 'resolve_fine', fineId: f.id, resolution: 'invoiced' },
                            `Fine posted to ${f.studentName}’s School Fees!`,
                          )
                        }
                        className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700"
                      >
                        Post to Fees
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void runErpOps(
                          { action: 'resolve_fine', fineId: f.id, resolution: 'paid' },
                          'Fine marked Paid!',
                        )
                      }
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white"
                    >
                      Mark Paid
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void runErpOps(
                          {
                            action: 'resolve_fine',
                            fineId: f.id,
                            resolution: 'waived',
                            waivedReason: 'Approved waiver by Principal / Admin',
                          },
                          'Fine waived!',
                        )
                      }
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600"
                    >
                      Waive
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  )
}
