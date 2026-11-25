'use client'

import React from 'react'

/** Return local YYYY-MM-DD string (avoids UTC midnight shift bugs) */
export function getTodayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Shift an ISO YYYY-MM-DD date by N days (negative for past, positive for future) */
export function shiftIsoDate(iso: string, deltaDays: number): string {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return getTodayIso()
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Pretty human label like "Mon, 23 Nov 2026" */
export function formatPrettyDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Short label like "23 Nov" or "Today" / "Yesterday" */
export function formatShortDateChip(iso: string): string {
  const today = getTodayIso()
  if (iso === today) return 'Today'
  if (iso === shiftIsoDate(today, -1)) return 'Yesterday'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

/**
 * Normalize DMHA date/timestamp labels into YYYY-MM-DD so filters match seamlessly across:
 * - "2026-11-23" / "2026-11-23T08:40:12.000Z" / "2026-11-23 16:45"
 * - "Today · 04:40 PM" / "Today · 23 Nov 2026" / "Just now"
 * - "Yesterday · 01:15 PM" / "Tomorrow · 24 Nov 2026"
 * - "23 Nov 2026" / "18 June 2026" / "Jun 18, 2026" / "Nov 22"
 */
export function extractIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = String(raw).trim()
  if (!text) return null
  const today = getTodayIso()
  const lower = text.toLowerCase()

  // 1. Direct YYYY-MM-DD anywhere in string (ISO timestamps, SQLite dates, etc.)
  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (isoMatch) return isoMatch[1]

  // 2. Relative labels ("Today · ...", "Yesterday · ...", "Tomorrow · ...", "Just now")
  if (lower.startsWith('today') || lower === 'just now' || lower.includes('mins ago')) {
    return today
  }
  if (lower.startsWith('yesterday')) {
    return shiftIsoDate(today, -1)
  }
  if (lower.startsWith('tomorrow')) {
    return shiftIsoDate(today, 1)
  }

  // 3. "DD MMM YYYY" or "DD Month YYYY" (e.g. "23 Nov 2026", "18 June 2026", "Today · 23 Nov 2026")
  const dmy = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?\b/)
  if (dmy) {
    const day = Number(dmy[1])
    const mon = MONTH_MAP[dmy[2].toLowerCase()]
    const year = dmy[3] ? Number(dmy[3]) : new Date().getFullYear()
    if (mon && day >= 1 && day <= 31) {
      return `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  // 4. "MMM DD, YYYY" or "Month DD" (e.g. "Nov 22, 2026" or "Jun 18")
  const mdy = text.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/)
  if (mdy) {
    const mon = MONTH_MAP[mdy[1].toLowerCase()]
    const day = Number(mdy[2])
    const year = mdy[3] ? Number(mdy[3]) : new Date().getFullYear()
    if (mon && day >= 1 && day <= 31) {
      return `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  return null
}

/** Check whether a raw date/time label matches a selected filter ('ALL' or YYYY-MM-DD) */
export function matchesDateFilter(raw: string | null | undefined, selectedDate: string): boolean {
  if (!selectedDate || selectedDate === 'ALL') return true
  const iso = extractIsoDate(raw)
  return iso === selectedDate
}

/** Check whether a raw date/time label falls within [fromIso, toIso] (inclusive; empty bound = open) */
export function matchesDateRange(
  raw: string | null | undefined,
  fromIso: string,
  toIso: string,
): boolean {
  if (!fromIso && !toIso) return true
  const iso = extractIsoDate(raw)
  if (!iso) return false
  if (fromIso && iso < fromIso) return false
  if (toIso && iso > toIso) return false
  return true
}

/** Reusable compact Date Navigator & Filter Bar for daily registers & historical logs */
export function DateFilterBar({
  value,
  onChange,
  allowAll = true,
  allowFuture = false,
  label,
  savedDates = [],
  compact = false,
  rightSlot,
}: {
  /** Either 'ALL' (when allowAll) or 'YYYY-MM-DD' */
  value: string
  onChange: (next: string) => void
  allowAll?: boolean
  allowFuture?: boolean
  label?: string
  savedDates?: string[]
  compact?: boolean
  rightSlot?: React.ReactNode
}) {
  const today = getTodayIso()
  const isAll = value === 'ALL'
  const activeIso = isAll ? today : value
  const canGoNext = allowFuture || activeIso < today

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-white ${
        compact ? 'px-3 py-2' : 'px-4 py-3'
      } shadow-2xs`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {label && (
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            {label}
          </span>
        )}

        {allowAll && (
          <button
            type="button"
            onClick={() => onChange('ALL')}
            className={`rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition ${
              isAll
                ? 'bg-[#0f172a] text-emerald-300 shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Dates
          </button>
        )}

        <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <button
            type="button"
            title="Previous day"
            onClick={() => onChange(shiftIsoDate(activeIso, -1))}
            className="px-2.5 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-200/80"
          >
            ←
          </button>
          <input
            type="date"
            value={isAll ? '' : value}
            max={allowFuture ? undefined : today}
            onChange={(e) => {
              const v = e.target.value
              if (v) onChange(v)
              else if (allowAll) onChange('ALL')
            }}
            aria-label={label || 'Select date'}
            className="border-x border-slate-200 bg-white px-2.5 py-1 text-xs font-extrabold text-slate-900 outline-none focus:bg-emerald-50/40"
          />
          <button
            type="button"
            title="Next day"
            disabled={!canGoNext}
            onClick={() => onChange(shiftIsoDate(activeIso, 1))}
            className="px-2.5 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:opacity-30"
          >
            →
          </button>
        </div>

        <button
          type="button"
          onClick={() => onChange(today)}
          className={`rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition ${
            value === today
              ? 'bg-emerald-500 text-slate-950 shadow-2xs'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          Today
        </button>

        <button
          type="button"
          onClick={() => onChange(shiftIsoDate(today, -1))}
          className={`rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition ${
            value === shiftIsoDate(today, -1)
              ? 'bg-slate-900 text-emerald-300'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Yesterday
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {savedDates.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-0.5 text-[10px] font-bold text-slate-400">Saved:</span>
            {savedDates.slice(0, 6).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChange(d)}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold transition ${
                  value === d
                    ? 'bg-[#0f172a] text-emerald-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                {formatShortDateChip(d)}
              </button>
            ))}
          </div>
        )}
        {rightSlot}
      </div>
    </div>
  )
}

/** Date-range bar (All / Today / Last 7 Days / This Month + From/To date pickers) */
export function DateRangeBar({
  fromDate,
  toDate,
  onChange,
  label = 'Filter Period',
  rightSlot,
}: {
  fromDate: string
  toDate: string
  onChange: (from: string, to: string) => void
  label?: string
  rightSlot?: React.ReactNode
}) {
  const today = getTodayIso()
  const weekAgo = shiftIsoDate(today, -6)
  const monthStart = `${today.slice(0, 7)}-01`

  const isAll = !fromDate && !toDate
  const isToday = fromDate === today && toDate === today
  const is7d = fromDate === weekAgo && toDate === today
  const isMonth = fromDate === monthStart && toDate === today

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-2xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onChange('', '')}
          className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold transition ${
            isAll ? 'bg-[#0f172a] text-emerald-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Time
        </button>
        <button
          type="button"
          onClick={() => onChange(today, today)}
          className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold transition ${
            isToday ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => onChange(weekAgo, today)}
          className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold transition ${
            is7d ? 'bg-[#0f172a] text-emerald-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Last 7 Days
        </button>
        <button
          type="button"
          onClick={() => onChange(monthStart, today)}
          className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold transition ${
            isMonth ? 'bg-[#0f172a] text-emerald-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          This Month
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
          From
          <input
            type="date"
            value={fromDate}
            max={toDate || today}
            onChange={(e) => onChange(e.target.value, toDate)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-extrabold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
          />
        </label>
        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
          To
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            max={today}
            onChange={(e) => onChange(fromDate, e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-extrabold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
          />
        </label>
        {rightSlot}
      </div>
    </div>
  )
}
