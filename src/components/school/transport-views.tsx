'use client'

import React, { useMemo, useState } from 'react'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type { BusBoardingLog } from './types'
import { PageShell } from './ui'

export function TransportManagementView() {
  const {
    role,
    students,
    selectedChildId,
    activeStudentId,
    transportBook,
    runTransportAction,
  } = useSchool()

  const isManager = role === 'admin' || role === 'staff' || role === 'teacher'
  const isAdmin = role === 'admin'
  const [subTab, setSubTab] = useState<'routes' | 'roster' | 'boarding'>('routes')

  // Add route form
  const [routeName, setRouteName] = useState('')
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('+880 1712-')
  const [attendantName, setAttendantName] = useState('')
  const [vehicleNo, setVehicleNo] = useState('Dhaka Metro-Ga 28-')
  const [capacity, setCapacity] = useState('26')
  const [monthlyFee, setMonthlyFee] = useState('2800')
  const [stopsText, setStopsText] = useState('Mirpur 10, Mirpur 11, Pallabi, DMHA Main Gate')

  // Boarding log controls
  const [boardDirection, setBoardDirection] =
    useState<BusBoardingLog['direction']>('Morning Pickup')
  const [billingMonth, setBillingMonth] = useState('December 2026')

  const activeChild =
    role === 'student'
      ? students.find((s) => s.id === activeStudentId) || students[0]
      : role === 'guardian'
        ? students.find((s) => s.id === selectedChildId) || students[0]
        : null

  const busRiders = useMemo(
    () =>
      students.filter(
        (s) =>
          s.status !== 'suspended' &&
          s.busRoute &&
          !s.busRoute.toLowerCase().includes('own') &&
          !s.busRoute.toLowerCase().includes('private'),
      ),
    [students],
  )

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!routeName.trim() || !driverName.trim()) return
    const res = await runTransportAction(
      {
        action: 'save_route',
        routeName,
        driverName,
        driverPhone,
        attendantName,
        vehicleNo,
        capacity: Number(capacity),
        monthlyFee: Number(monthlyFee),
        stopsText,
      },
      `Added bus route: ${routeName}`,
    )
    if (res.ok) {
      setRouteName('')
      setDriverName('')
      setAttendantName('')
    }
  }

  // Guardian / Student Personalized Bus Card View
  if (!isManager && activeChild) {
    const childRouteStr = (activeChild.busRoute || '').toLowerCase()
    const matchedRoute =
      transportBook.routes.find((r) => {
        const parts = r.routeName
          .toLowerCase()
          .split(/[·–\-/]+/)
          .map((p) => p.trim())
          .filter((p) => p.length >= 4)
        return (
          r.routeName.toLowerCase() === childRouteStr ||
          parts.some((p) => childRouteStr.includes(p)) ||
          r.stops.some((st) => childRouteStr.includes(st.split(' ')[0].toLowerCase()))
        )
      }) || transportBook.routes[0]

    const myLogs = transportBook.boardingLogs.filter((l) => l.studentId === activeChild.id)

    return (
      <PageShell
        eyebrow="DMHA Safe School Transport · Live Bus Tracking"
        title={`${activeChild.name}’s School Bus & Stops`}
        subtitle="Verified driver & attendant contacts, stop timetable, and real-time pickup/drop-off boarding logs."
      >
        {role === 'guardian' && <ChildSwitcherBar />}
        {matchedRoute && (
          <div className="dmhs-hero rounded-[28px] p-6 text-white shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] font-black uppercase text-emerald-300">
                  {matchedRoute.routeCode} · {matchedRoute.vehicleNo}
                </span>
                <h2 className="mt-2.5 text-2xl font-black">{matchedRoute.routeName}</h2>
                <p className="mt-1 text-xs text-slate-300">
                  Driver: <strong>{matchedRoute.driverName}</strong> ({matchedRoute.driverPhone}) · Attendant:{' '}
                  <strong>{matchedRoute.attendantName}</strong>
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                <p className="text-[10px] font-bold text-emerald-200">Morning / Afternoon</p>
                <p className="text-sm font-black">
                  {matchedRoute.morningStart} · {matchedRoute.afternoonStart}
                </p>
                <p className="text-[11px] text-slate-300">
                  Monthly Transport Fee: ৳{matchedRoute.monthlyFee.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {matchedRoute.stops.map((st, idx) => (
                <span
                  key={st}
                  className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white"
                >
                  {idx + 1}. {st}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="dmhs-card mt-5 rounded-[24px] p-5">
          <h3 className="text-sm font-black text-slate-900">Recent Bus Boarding Alerts</h3>
          <div className="mt-3 space-y-2.5">
            {myLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-xs"
              >
                <div>
                  <p className="font-black text-slate-900">
                    {log.direction} · {log.stopName}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    {log.timestamp} · Verified by {log.recordedBy}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase text-emerald-800">
                  {log.status} ✓
                </span>
              </div>
            ))}
            {myLogs.length === 0 && (
              <p className="py-6 text-center text-xs font-bold text-slate-400">
                No bus boarding scans recorded today yet.
              </p>
            )}
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      eyebrow="DMHA Campus Logistics · Fleet, Routes & Boarding"
      title="Transport & School Bus Management"
      subtitle="Manage Dhaka school bus routes, stops, drivers & attendants, student rosters, live boarding alerts, and 1-click monthly Transport Fee billing."
      action={
        isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              className="w-36 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold"
            />
            <button
              type="button"
              onClick={() =>
                void runTransportAction(
                  { action: 'bill_transport_fees', billingMonth },
                  `Generated monthly Transport Fee invoices for ${billingMonth}!`,
                )
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-700"
            >
              <Icon name="payment" size={14} />
              Bill Monthly Bus Fees
            </button>
          </div>
        ) : undefined
      }
    >
      {/* KPI Strip */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            Active Bus Routes
          </p>
          <p className="mt-1.5 text-3xl font-black">{transportBook.routes.length}</p>
          <p className="mt-1 text-[11px] text-slate-300">
            Total fleet seats: {transportBook.routes.reduce((s, r) => s + r.capacity, 0)}
          </p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Enrolled Bus Riders
          </p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">{busRiders.length}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Active students on school transport
          </p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Boarding Scans Logged
          </p>
          <p className="mt-1.5 text-3xl font-black text-emerald-700">
            {transportBook.boardingLogs.length}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Auto-notifies parents on pickup/drop
          </p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Est. Monthly Transport Rev
          </p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">
            ৳{(busRiders.length * 2800).toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Syncs to Accounts → Student Fees
          </p>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ['routes', `Routes & Drivers (${transportBook.routes.length})`],
            ['roster', `Student Bus Roster (${students.length})`],
            ['boarding', `Live Boarding Roll Call (${transportBook.boardingLogs.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
              subTab === id
                ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 1. ROUTES & DRIVERS */}
      {subTab === 'routes' && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {isAdmin && (
            <form onSubmit={handleAddRoute} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
              <h3 className="text-sm font-black text-slate-900">Add New Bus Route</h3>
              <input
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="Route Name (e.g., Route E · Mirpur – Pallabi) *"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Driver Name *"
                  required
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
                />
                <input
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="Driver Phone"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={attendantName}
                  onChange={(e) => setAttendantName(e.target.value)}
                  placeholder="Female Bus Attendant"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
                />
                <input
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="Vehicle Reg #"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400">Seat Cap.</label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400">Monthly Fee (৳)</label>
                  <input
                    type="number"
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400">
                  Pickup Stops (comma-separated)
                </label>
                <textarea
                  rows={2}
                  value={stopsText}
                  onChange={(e) => setStopsText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-full bg-[#0f172a] py-2.5 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
              >
                + Save School Bus Route
              </button>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {transportBook.routes.map((rt) => (
              <div key={rt.id} className="dmhs-card flex flex-col justify-between rounded-[22px] p-5">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-md bg-[#0f172a] px-2.5 py-0.5 font-mono text-[10px] font-black text-emerald-300">
                      {rt.routeCode}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
                      ৳{rt.monthlyFee.toLocaleString()}/mo · {rt.capacity} seats
                    </span>
                  </div>
                  <h4 className="mt-2.5 text-sm font-black text-slate-900">{rt.routeName}</h4>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    🚌 {rt.vehicleNo} · {rt.morningStart} / {rt.afternoonStart}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    Driver: <strong>{rt.driverName}</strong> ({rt.driverPhone})
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Attendant: <strong>{rt.attendantName}</strong>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {rt.stops.map((st) => (
                      <span
                        key={st}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                      >
                        {st}
                      </span>
                    ))}
                  </div>
                </div>
                {isAdmin && (
                  <div className="mt-4 flex justify-end border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        void runTransportAction(
                          { action: 'delete_route', routeId: rt.id },
                          `Removed ${rt.routeName}`,
                        )
                      }
                      className="text-[11px] font-bold text-rose-500 hover:underline"
                    >
                      Remove Route
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. STUDENT BUS ROSTER */}
      {subTab === 'roster' && (
        <div className="dmhs-card overflow-x-auto rounded-[24px] p-4">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                <th className="py-2.5 pr-3">Roll</th>
                <th className="py-2.5 pr-3">Student &amp; Class</th>
                <th className="py-2.5 pr-3">Guardian Phone</th>
                <th className="py-2.5 pr-3">Assigned Bus Route</th>
                {isAdmin && <th className="py-2.5 text-right">Reassign Route</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((stu) => (
                <tr key={stu.id}>
                  <td className="py-3 pr-3 font-mono font-bold text-slate-600">#{stu.roll}</td>
                  <td className="py-3 pr-3">
                    <p className="font-extrabold text-slate-900">{stu.name}</p>
                    <p className="text-[10px] font-semibold text-slate-500">
                      {stu.className} · {stu.section}
                    </p>
                  </td>
                  <td className="py-3 pr-3 font-semibold text-slate-600">{stu.guardianPhone}</td>
                  <td className="py-3 pr-3 font-bold text-emerald-800">{stu.busRoute}</td>
                  {isAdmin && (
                    <td className="py-3 text-right">
                      <select
                        value={stu.busRoute}
                        onChange={(e) =>
                          void runTransportAction(
                            {
                              action: 'assign_student_route',
                              studentId: stu.id,
                              routeName: e.target.value,
                            },
                            `Updated bus route for ${stu.name}`,
                          )
                        }
                        className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold"
                      >
                        <option value={stu.busRoute}>{stu.busRoute}</option>
                        {transportBook.routes.map((r) => (
                          <option key={r.id} value={r.routeName}>
                            {r.routeName}
                          </option>
                        ))}
                        <option value="Own / Private Transport">Own / Private Transport</option>
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. LIVE BUS BOARDING ROLL CALL */}
      {subTab === 'boarding' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="dmhs-card rounded-[24px] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900">Quick Bus Boarding Check-In</h3>
              <select
                value={boardDirection}
                onChange={(e) => setBoardDirection(e.target.value as BusBoardingLog['direction'])}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold"
              >
                <option value="Morning Pickup">Morning Pickup</option>
                <option value="Afternoon Drop-Off">Afternoon Drop-Off</option>
              </select>
            </div>
            <div className="space-y-2.5">
              {busRiders.map((stu) => {
                const rt =
                  transportBook.routes.find((r) =>
                    stu.busRoute.toLowerCase().includes(r.routeName.split('·')[0].trim().toLowerCase()),
                  ) || transportBook.routes[0]
                return (
                  <div
                    key={stu.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-extrabold text-slate-900">{stu.name}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{stu.busRoute}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          void runTransportAction(
                            {
                              action: 'log_boarding',
                              routeId: rt?.id,
                              studentId: stu.id,
                              direction: boardDirection,
                              stopName: rt?.stops[0] || 'Main Stop',
                              status: boardDirection === 'Morning Pickup' ? 'boarded' : 'dropped',
                            },
                            `Logged ${boardDirection} for ${stu.name} & alerted parent!`,
                          )
                        }
                        className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-black text-white hover:bg-emerald-700"
                      >
                        {boardDirection === 'Morning Pickup' ? 'Boarded ✓' : 'Dropped Safely ✓'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="dmhs-card rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">Live Boarding Audit Log</h3>
            <div className="mt-3 space-y-2.5">
              {transportBook.boardingLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-black text-slate-900">
                      {log.studentName}{' '}
                      <span className="font-semibold text-slate-400">· {log.classLabel}</span>
                    </p>
                    <p className="text-[10px] font-semibold text-slate-500">
                      {log.routeName} · {log.direction} ({log.stopName}) · {log.timestamp}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
