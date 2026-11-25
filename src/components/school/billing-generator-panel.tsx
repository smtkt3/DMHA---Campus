'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from './icons'
import { useSchool } from './store'
import type { ClassFeeScheduleItem, StudentRecord } from './types'

export function MonthlyBillingGeneratorPanel() {
  const {
    students,
    guardians,
    fees,
    classFeeSchedules,
    siblingDiscountPct,
    saveClassFeeSchedules,
    generateMonthlyFeeInvoices,
    sendBulkFeeReminders,
  } = useSchool()

  const [billingMonth, setBillingMonth] = useState('December 2026')
  const [dueDate, setDueDate] = useState('Due 10 Dec 2026')
  const [targetClass, setTargetClass] = useState('All Classes')
  const [includeActivityFee, setIncludeActivityFee] = useState(true)
  const [discountPct, setDiscountPct] = useState<number>(siblingDiscountPct)
  const [editableSchedules, setEditableSchedules] =
    useState<ClassFeeScheduleItem[]>(classFeeSchedules)
  const [generating, setGenerating] = useState(false)
  const [savingSched, setSavingSched] = useState(false)
  const [reminding, setReminding] = useState(false)
  const [lastSummary, setLastSummary] = useState('')

  useEffect(() => {
    setEditableSchedules(classFeeSchedules)
  }, [classFeeSchedules])

  useEffect(() => {
    setDiscountPct(siblingDiscountPct)
  }, [siblingDiscountPct])

  // Live preview of exact per-student invoices & auto-detected sibling discounts
  const previewRows = useMemo(() => {
    const active = students.filter((s) => s.status !== 'suspended')
    const familyGroups = new Map<string, StudentRecord[]>()
    active.forEach((stu) => {
      const g = guardians.find((x) => x.id === stu.guardianId || x.linkedStudentIds.includes(stu.id))
      const key = g?.id || `phone:${stu.guardianPhone.replace(/[^\d]/g, '') || stu.id}`
      const arr = familyGroups.get(key) || []
      arr.push(stu)
      familyGroups.set(key, arr)
    })

    const siblingIds = new Set<string>()
    familyGroups.forEach((members) => {
      if (members.length >= 2) {
        const ordered = [...members].sort((a, b) => b.className.localeCompare(a.className))
        ordered.slice(1).forEach((sib) => siblingIds.add(sib.id))
      }
    })

    const eligible =
      targetClass === 'All Classes'
        ? active
        : active.filter((s) => s.className.toLowerCase() === targetClass.toLowerCase())

    return eligible.map((stu) => {
      const sched = editableSchedules.find(
        (sc) => sc.className.toLowerCase() === stu.className.toLowerCase(),
      ) || { className: stu.className, monthlyTuition: 4200, activityFee: 500 }

      const gross = sched.monthlyTuition + (includeActivityFee ? sched.activityFee : 0)
      const isSibling = siblingIds.has(stu.id) && discountPct > 0
      const discountAmt = isSibling ? Math.round((sched.monthlyTuition * discountPct) / 100) : 0
      const net = Math.max(0, gross - discountAmt)
      const alreadyExists = fees.some(
        (f) => f.studentId === stu.id && f.title.toLowerCase().includes(billingMonth.toLowerCase()),
      )
      return { stu, gross, isSibling, discountAmt, net, alreadyExists }
    })
  }, [students, guardians, fees, editableSchedules, targetClass, includeActivityFee, discountPct, billingMonth])

  const toCreate = previewRows.filter((r) => !r.alreadyExists)
  const totalNetNew = toCreate.reduce((s, r) => s + r.net, 0)
  const totalSibDiscounts = toCreate.filter((r) => r.isSibling).length
  const totalSavedBySiblings = toCreate.reduce((s, r) => s + r.discountAmt, 0)

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    const res = await generateMonthlyFeeInvoices({
      billingMonth: billingMonth.trim(),
      dueDate: dueDate.trim(),
      targetClass,
      siblingDiscountPct: discountPct,
      includeActivityFee,
    })
    setGenerating(false)
    if (res.ok) {
      setLastSummary(
        `Generated ${res.createdCount} invoice(s) totaling ৳${(res.totalBilled || 0).toLocaleString()} · ${res.siblingDiscountsApplied || 0} automatic ${discountPct}% sibling discount(s) (-৳${(res.totalDiscountBdt || 0).toLocaleString()}) · ${res.skippedDuplicates || 0} duplicate(s) skipped.`,
      )
    }
  }

  const handleSaveSchedule = async () => {
    setSavingSched(true)
    await saveClassFeeSchedules(editableSchedules, discountPct)
    setSavingSched(false)
  }

  return (
    <div className="space-y-6">
      {/* Top Auto-Generator Form */}
      <form
        onSubmit={handleGenerate}
        className="dmhs-card rounded-[24px] border-2 border-emerald-500/20 bg-white p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
              1-Click Automated School Billing Engine
            </p>
            <h3 className="mt-0.5 text-lg font-black text-slate-900">
              Monthly Tuition Auto-Generator &amp; Sibling Discounts
            </h3>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              Automatically calculates class-wise monthly tuition, applies sibling discounts for
              multi-child families (e.g. 2nd+ enrolled sibling), and skips duplicate invoices.
            </p>
          </div>
          <button
            type="button"
            disabled={reminding}
            onClick={async () => {
              setReminding(true)
              await sendBulkFeeReminders()
              setReminding(false)
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-4 py-2 text-xs font-extrabold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
          >
            <Icon name="send" size={13} />
            {reminding ? 'Sending...' : 'Send Bulk Fee Due Reminders'}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-[11px] font-extrabold text-slate-600">
            Billing Month *
            <input
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              required
              placeholder="e.g., December 2026"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
            />
          </label>
          <label className="block text-[11px] font-extrabold text-slate-600">
            Due Date *
            <input
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              placeholder="Due 10 Dec 2026"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
            />
          </label>
          <label className="block text-[11px] font-extrabold text-slate-600">
            Target Class
            <select
              value={targetClass}
              onChange={(e) => setTargetClass(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
            >
              <option value="All Classes">All Active Classes (Pre-Play – Class 6)</option>
              {editableSchedules.map((sc) => (
                <option key={sc.className} value={sc.className}>
                  {sc.className}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] font-extrabold text-slate-600">
            Sibling Discount (%)
            <input
              type="number"
              min={0}
              max={50}
              value={discountPct}
              onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="inline-flex cursor-pointer items-center gap-2 font-bold text-slate-700">
              <input
                type="checkbox"
                checked={includeActivityFee}
                onChange={(e) => setIncludeActivityFee(e.target.checked)}
                className="size-4 accent-emerald-600"
              />
              Include Monthly Activity / Lab Fee
            </label>
            <span className="font-extrabold text-slate-900">
              Ready: <span className="text-emerald-700">{toCreate.length} new</span> · Total:{' '}
              <span className="text-emerald-700">৳{totalNetNew.toLocaleString()}</span>
            </span>
            {totalSibDiscounts > 0 && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                {totalSibDiscounts} Sibling Discount (-৳{totalSavedBySiblings.toLocaleString()})
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={generating || toCreate.length === 0}
            className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-xs font-black text-emerald-400 hover:bg-slate-800 disabled:opacity-50"
          >
            {generating
              ? 'Generating Invoices...'
              : `Generate ${toCreate.length} Monthly Invoice${toCreate.length === 1 ? '' : 's'}`}
          </button>
        </div>

        {lastSummary && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900">
            ✓ {lastSummary}
          </div>
        )}
      </form>

      {/* Two-Column: Live Billing Preview + Editable Class Fee Table */}
      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="dmhs-card rounded-[24px] p-5">
          <h4 className="text-sm font-black text-slate-900">
            Live Batch Preview ({billingMonth} · {previewRows.length} Active Students)
          </h4>
          <div className="mt-3 space-y-2">
            {previewRows.map((row) => (
              <div
                key={row.stu.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs"
              >
                <div>
                  <p className="font-black text-slate-900">
                    {row.stu.name}{' '}
                    <span className="font-semibold text-slate-400">
                      ({row.stu.className} · {row.stu.section})
                    </span>
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Guardian: {row.stu.guardianName}
                    {row.isSibling && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                        -{discountPct}% Sibling Discount (-৳{row.discountAmt})
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  {row.alreadyExists ? (
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black text-slate-600">
                      Already Billed
                    </span>
                  ) : (
                    <p className="text-sm font-black text-slate-900">
                      ৳{row.net.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="dmhs-card rounded-[24px] p-5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-black text-slate-900">
              Class Fee Structure (Pre-Play – Class 6)
            </h4>
            <button
              type="button"
              disabled={savingSched}
              onClick={handleSaveSchedule}
              className="rounded-xl bg-[#0f172a] px-3.5 py-1.5 text-[11px] font-extrabold text-emerald-400 hover:bg-slate-800"
            >
              {savingSched ? 'Saving...' : 'Save Rates'}
            </button>
          </div>
          <div className="mt-3 max-h-[380px] space-y-2 overflow-y-auto pr-1">
            {editableSchedules.map((sc, idx) => (
              <div
                key={sc.className}
                className="grid grid-cols-[90px_1fr_1fr] items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"
              >
                <span className="font-black text-slate-800">{sc.className}</span>
                <label className="text-[10px] font-bold text-slate-500">
                  Tuition (৳)
                  <input
                    type="number"
                    value={sc.monthlyTuition}
                    onChange={(e) =>
                      setEditableSchedules((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? { ...item, monthlyTuition: Number(e.target.value) || 0 }
                            : item,
                        ),
                      )
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                  />
                </label>
                <label className="text-[10px] font-bold text-slate-500">
                  Activity (৳)
                  <input
                    type="number"
                    value={sc.activityFee}
                    onChange={(e) =>
                      setEditableSchedules((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? { ...item, activityFee: Number(e.target.value) || 0 }
                            : item,
                        ),
                      )
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
