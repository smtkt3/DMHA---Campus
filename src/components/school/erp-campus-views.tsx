'use client'

import React, { useState } from 'react'
import { Icon } from './icons'
import { useSchool } from './store'
import type {
  JobApplicationRecord,
  JobVacancyItem,
  LiveMeetingItem,
  QuestionBankItem,
  SchoolWebsiteConfig,
  StockItemRecord,
} from './types'
import { PageShell } from './ui'

// ==================== 6. LIVE MEETING ====================
export function LiveMeetingsView() {
  const { liveMeetings, runErpCampus } = useSchool()
  const [title, setTitle] = useState('')
  const [audience, setAudience] = useState<LiveMeetingItem['audience']>('All Faculty')
  const [platform, setPlatform] = useState<LiveMeetingItem['platform']>('Jitsi Meet (Instant)')
  const [roomUrl, setRoomUrl] = useState('')
  const [dateIso, setDateIso] = useState('2026-11-26')
  const [startTime, setStartTime] = useState('04:00 PM')
  const [durationMin, setDurationMin] = useState('45')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const res = await runErpCampus(
      {
        action: 'create_meeting',
        title,
        audience,
        platform,
        roomUrl,
        dateIso,
        startTime,
        durationMin: Number(durationMin),
      },
      'Live meeting scheduled & link generated!',
    )
    if (res.ok) {
      setTitle('')
      setRoomUrl('')
    }
  }

  return (
    <PageShell
      eyebrow="Virtual Campus · Zoom, Google Meet & Instant Jitsi"
      title="Live Meeting & Online Class Hub"
      subtitle="Host instant faculty briefings, parent webinars, and online revision clinics with 1-click Join Room links and recording archive."
    >
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={handleCreate} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
          <h3 className="text-sm font-black text-slate-900">Schedule Live Meeting</h3>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session title (e.g., Term-2 Faculty Coordination)"
            required
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as LiveMeetingItem['audience'])}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
            >
              <option>All Faculty</option>
              <option>All Guardians</option>
              <option>Class 6A</option>
              <option>Class 5B</option>
              <option>Class 4A</option>
              <option>Admin & Staff</option>
            </select>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as LiveMeetingItem['platform'])}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
            >
              <option>Jitsi Meet (Instant)</option>
              <option>Google Meet</option>
              <option>Zoom</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="date"
              value={dateIso}
              onChange={(e) => setDateIso(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold"
            />
            <input
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="04:00 PM"
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
            />
            <input
              type="number"
              min={15}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              placeholder="Min"
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
            />
          </div>
          <input
            value={roomUrl}
            onChange={(e) => setRoomUrl(e.target.value)}
            placeholder="Custom Meet/Zoom URL (leave blank for instant Jitsi link)"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300 hover:bg-slate-800"
          >
            Create Live Room
          </button>
        </form>

        <div className="space-y-3">
          {liveMeetings.map((m) => (
            <div key={m.id} className="dmhs-card rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        m.status === 'live'
                          ? 'bg-rose-600 text-white'
                          : m.status === 'scheduled'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {m.status === 'live' ? '● LIVE NOW' : m.status}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700">
                      {m.audience}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {m.platform} · {m.dateIso} · {m.startTime} ({m.durationMin}m)
                    </span>
                  </div>
                  <h4 className="mt-1.5 text-sm font-black text-slate-900">{m.title}</h4>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                    Host: {m.hostName} · Room:{' '}
                    <span className="font-mono text-emerald-700">{m.roomUrl}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={m.roomUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[11px] font-black text-white hover:bg-emerald-700"
                  >
                    <Icon name="video" size={13} />
                    Join Room
                  </a>
                  {m.status === 'scheduled' && (
                    <button
                      type="button"
                      onClick={() =>
                        void runErpCampus(
                          { action: 'update_meeting_status', meetingId: m.id, status: 'live' },
                          'Meeting is now LIVE!',
                        )
                      }
                      className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700"
                    >
                      Go Live
                    </button>
                  )}
                  {m.status === 'live' && (
                    <button
                      type="button"
                      onClick={() =>
                        void runErpCampus(
                          { action: 'update_meeting_status', meetingId: m.id, status: 'ended' },
                          'Meeting marked Ended',
                        )
                      }
                      className="rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-700"
                    >
                      End Session
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void runErpCampus(
                        { action: 'delete_meeting', meetingId: m.id },
                        'Meeting removed',
                      )
                    }
                    className="rounded-xl bg-slate-50 px-2.5 py-2 text-[10px] font-bold text-slate-400 hover:text-rose-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  )
}

// ==================== 7. STOCK MANAGEMENT ====================
export function StockManagementView() {
  const { stockItems, stockMovements, campusUnits, runErpCampus } = useSchool()
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState<StockItemRecord['category']>('Books & Stationery')
  const [campusUnit, setCampusUnit] = useState(campusUnits[0]?.name || 'Unit - 1')
  const [quantity, setQuantity] = useState('20')
  const [minThreshold, setMinThreshold] = useState('10')
  const [unitCostBdt, setUnitCostBdt] = useState('500')

  const [moveItemId, setMoveItemId] = useState(stockItems[0]?.id || 'stk-1')
  const [moveType, setMoveType] = useState<'IN' | 'OUT'>('IN')
  const [moveQty, setMoveQty] = useState('5')
  const [moveParty, setMoveParty] = useState('')

  const totalValue = stockItems.reduce((sum, i) => sum + i.quantity * i.unitCostBdt, 0)
  const lowStockCount = stockItems.filter((i) => i.quantity <= i.minThreshold).length

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const res = await runErpCampus(
      {
        action: 'add_stock_item',
        name,
        sku,
        category,
        campusUnit,
        quantity: Number(quantity),
        minThreshold: Number(minThreshold),
        unitCostBdt: Number(unitCostBdt),
      },
      'New inventory item added to Stock Ledger!',
    )
    if (res.ok) {
      setName('')
      setSku('')
    }
  }

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await runErpCampus(
      {
        action: 'record_stock_movement',
        itemId: moveItemId,
        type: moveType,
        quantity: Number(moveQty),
        party: moveParty,
      },
      `Stock ${moveType} recorded!`,
    )
    if (res.ok) setMoveParty('')
  }

  return (
    <PageShell
      eyebrow="Campus Stores & Inventory · Asset Control"
      title="Stock Management"
      subtitle="Track uniforms, exercise books, science lab kits, IT equipment, and consumables with low-stock alerts and Stock-In / Stock-Out audit trail."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-300">
            Total Inventory Valuation
          </p>
          <p className="mt-1 text-3xl font-black">৳{totalValue.toLocaleString()}</p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
            Tracked SKUs
          </p>
          <p className="mt-1 text-3xl font-black text-slate-900">{stockItems.length}</p>
        </div>
        <div className="dmhs-card rounded-[22px] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-rose-500">
            Low-Stock Alerts
          </p>
          <p className="mt-1 text-3xl font-black text-rose-600">{lowStockCount}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[370px_1fr]">
        <div className="space-y-5">
          <form onSubmit={handleMovement} className="dmhs-card space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">Record Stock IN / OUT</h3>
            <select
              value={moveItemId}
              onChange={(e) => setMoveItemId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              {stockItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (Avail: {i.quantity})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={moveType}
                onChange={(e) => setMoveType(e.target.value as 'IN' | 'OUT')}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                <option value="IN">Stock IN (+ Restock)</option>
                <option value="OUT">Stock OUT (- Issue)</option>
              </select>
              <input
                type="number"
                min={1}
                value={moveQty}
                onChange={(e) => setMoveQty(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black"
              />
            </div>
            <input
              value={moveParty}
              onChange={(e) => setMoveParty(e.target.value)}
              placeholder={moveType === 'IN' ? 'Supplier / Vendor name' : 'Issued to Department / Student'}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white hover:bg-emerald-700"
            >
              Save Stock Movement
            </button>
          </form>

          <form onSubmit={handleAddItem} className="dmhs-card space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">Add New Stock SKU</h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name (e.g., Whiteboard Markers Box)"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU (optional)"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as StockItemRecord['category'])}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold"
              >
                <option>Uniforms</option>
                <option>Books & Stationery</option>
                <option>Science Lab</option>
                <option>IT & AV Equipment</option>
                <option>Furniture</option>
                <option>Cleaning & First Aid</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Qty"
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
              />
              <input
                type="number"
                min={1}
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
                placeholder="Min Alert"
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
              />
              <input
                type="number"
                min={0}
                value={unitCostBdt}
                onChange={(e) => setUnitCostBdt(e.target.value)}
                placeholder="Unit ৳"
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
              />
            </div>
            <select
              value={campusUnit}
              onChange={(e) => setCampusUnit(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              {campusUnits.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full rounded-xl bg-[#0f172a] py-2 text-xs font-black text-emerald-300"
            >
              + Add Stock Item
            </button>
          </form>
        </div>

        <div className="space-y-5">
          <div className="dmhs-card rounded-[24px] p-5">
            <h3 className="mb-3 text-sm font-black text-slate-900">Current Stock Inventory</h3>
            <div className="space-y-2.5">
              {stockItems.map((i) => {
                const isLow = i.quantity <= i.minThreshold
                return (
                  <div
                    key={i.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 ${
                      isLow ? 'border-rose-200 bg-rose-50/40' : 'border-slate-100 bg-slate-50/60'
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-black text-slate-400">
                          {i.sku}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-indigo-700 ring-1 ring-slate-200">
                          {i.category}
                        </span>
                        {isLow && (
                          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                            LOW STOCK
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-black text-slate-900">{i.name}</p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {i.campusUnit} · Unit Cost ৳{i.unitCostBdt.toLocaleString()} · Min Alert{' '}
                        {i.minThreshold}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900">
                        {i.quantity} <span className="text-xs font-bold text-slate-400">{i.unitLabel}</span>
                      </p>
                      <p className="text-[10px] font-bold text-emerald-700">
                        Value ৳{(i.quantity * i.unitCostBdt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="dmhs-card rounded-[24px] p-5">
            <h3 className="mb-3 text-sm font-black text-slate-900">Recent Stock Movements</h3>
            <div className="space-y-2">
              {stockMovements.slice(0, 8).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <span
                      className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-black ${
                        m.type === 'IN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {m.type === 'IN' ? `+${m.quantity} IN` : `-${m.quantity} OUT`}
                    </span>
                    <strong className="text-slate-900">{m.itemName}</strong>
                    <span className="ml-2 text-slate-500">· {m.party}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">{m.recordedAt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

// ==================== 8. QUESTION BANK & EXAM PAPER BUILDER ====================
export function QuestionBankView() {
  const { questionBank, runErpCampus } = useSchool()
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showPaper, setShowPaper] = useState(false)

  const [className, setClassName] = useState('Class 6')
  const [subject, setSubject] = useState('Physics')
  const [chapter, setChapter] = useState('')
  const [qType, setQType] = useState<QuestionBankItem['type']>('MCQ')
  const [difficulty, setDifficulty] = useState<QuestionBankItem['difficulty']>('Medium')
  const [marks, setMarks] = useState('2')
  const [prompt, setPrompt] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState('')

  const subjects = ['All', ...Array.from(new Set(questionBank.map((q) => q.subject)))]
  const visible =
    subjectFilter === 'All'
      ? questionBank
      : questionBank.filter((q) => q.subject === subjectFilter)

  const selectedQuestions = questionBank.filter((q) => selectedIds.includes(q.id))
  const totalPaperMarks = selectedQuestions.reduce((sum, q) => sum + q.marks, 0)

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || !correctAnswer.trim()) return
    const res = await runErpCampus(
      {
        action: 'add_question',
        className,
        subject,
        chapter: chapter || 'General Revision',
        type: qType,
        difficulty,
        marks: Number(marks),
        prompt,
        options:
          qType === 'MCQ'
            ? optionsText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        correctAnswer,
      },
      'Question added to DMHA Question Bank!',
    )
    if (res.ok) {
      setPrompt('')
      setOptionsText('')
      setCorrectAnswer('')
    }
  }

  return (
    <PageShell
      eyebrow="Academic Examination Repository · Paper Builder"
      title="Question Bank"
      subtitle="Build a structured repository of MCQ, Short, and Creative exam questions and assemble printable A4 DMHA question papers in 1 click."
      action={
        <button
          type="button"
          disabled={selectedQuestions.length === 0}
          onClick={() => setShowPaper((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 disabled:opacity-40"
        >
          <Icon name="print" size={14} />
          {showPaper
            ? 'Back to Question Bank'
            : `Build Exam Paper (${selectedQuestions.length} Qs · ${totalPaperMarks} Marks)`}
        </button>
      }
    >
      {showPaper ? (
        <div className="dmhs-card mx-auto max-w-3xl rounded-[26px] p-8">
          <div className="border-b-2 border-slate-900 pb-4 text-center">
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-emerald-700">
              DMHA · English Medium School · Unit - 1 &amp; Unit - 2
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Winter Term Assessment Question Paper
            </h2>
            <p className="mt-1 text-xs font-bold text-slate-600">
              Total Questions: {selectedQuestions.length} · Full Marks: {totalPaperMarks} · Time: 60 Minutes
            </p>
          </div>
          <ol className="mt-6 space-y-5 text-sm">
            {selectedQuestions.map((q, idx) => (
              <li key={q.id} className="border-b border-slate-100 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-slate-900">
                    {idx + 1}. {q.prompt}
                  </p>
                  <span className="shrink-0 font-mono text-xs font-black text-slate-600">
                    [{q.marks} Marks]
                  </span>
                </div>
                {q.options && q.options.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5 pl-4 text-xs font-semibold text-slate-700">
                    {q.options.map((opt, i) => (
                      <span key={opt}>
                        ({String.fromCharCode(97 + i)}) {opt}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
          <div className="dmhs-no-print mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-black text-emerald-300"
            >
              Print / Save Question Paper PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form onSubmit={handleAdd} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">Add Question to Bank</h3>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
              >
                {['Pre-Play', 'Play', 'Nursery', 'KG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6'].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  ),
                )}
              </select>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                required
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              />
            </div>
            <input
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="Chapter / Topic (e.g., Chapter 3: Optics)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={qType}
                onChange={(e) => setQType(e.target.value as QuestionBankItem['type'])}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold"
              >
                <option>MCQ</option>
                <option>Short Answer</option>
                <option>Structured / Creative</option>
              </select>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as QuestionBankItem['difficulty'])}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold"
              >
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
              <input
                type="number"
                min={1}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                placeholder="Marks"
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-black"
              />
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              required
              placeholder="Write question prompt..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            {qType === 'MCQ' && (
              <input
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="MCQ options separated by commas (A, B, C, D)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
              />
            )}
            <input
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              required
              placeholder="Answer key / marking rubric..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300"
            >
              + Save Question
            </button>
          </form>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {subjects.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSubjectFilter(sub)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold ${
                    subjectFilter === sub
                      ? 'bg-[#0f172a] text-emerald-300'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>

            {visible.map((q) => {
              const checked = selectedIds.includes(q.id)
              return (
                <div
                  key={q.id}
                  className={`dmhs-card rounded-2xl p-4 ${checked ? 'ring-2 ring-emerald-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(q.id)}
                        className="mt-1 size-4 accent-emerald-600"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black text-indigo-700">
                            {q.className} · {q.subject}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {q.type}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                            {q.marks} Marks
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {q.difficulty} · {q.chapter}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs font-black text-slate-900">{q.prompt}</p>
                        {q.options && (
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            Options: {q.options.join(' · ')}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] font-bold text-emerald-700">
                          Answer Key: {q.correctAnswer}
                        </p>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        void runErpCampus(
                          { action: 'delete_question', questionId: q.id },
                          'Question deleted',
                        )
                      }
                      className="text-[10px] font-bold text-rose-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </PageShell>
  )
}

// ==================== 9. JOB APPLICATIONS (CAREERS HR) ====================
export function JobApplicationsView() {
  const { jobVacancies, jobApplications, campusUnits, runErpCampus } = useSchool()
  const [subTab, setSubTab] = useState<'applicants' | 'vacancies'>('applicants')
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('Academic Faculty')
  const [campusUnit, setCampusUnit] = useState(campusUnits[0]?.name || 'Unit - 1')
  const [salaryRange, setSalaryRange] = useState('৳32,000 – ৳42,000 / month')
  const [deadlineIso, setDeadlineIso] = useState('2026-12-30')
  const [requirements, setRequirements] = useState('')

  const handleAddVacancy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const res = await runErpCampus(
      {
        action: 'create_vacancy',
        title,
        department,
        campusUnit,
        salaryRange,
        deadlineIso,
        requirements,
      },
      'Job vacancy published to DMHA Careers Portal!',
    )
    if (res.ok) {
      setTitle('')
      setRequirements('')
    }
  }

  return (
    <PageShell
      eyebrow="Faculty & Staff Recruitment · Careers CRM"
      title="Job Applications & Vacancies"
      subtitle="Publish open teaching/staff roles to the public DMHA Careers Portal and move candidates from Application → Shortlisted → Demo Class → Hired."
      action={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSubTab('applicants')}
            className={`rounded-full px-4 py-2 text-xs font-extrabold ${
              subTab === 'applicants'
                ? 'bg-[#0f172a] text-emerald-300'
                : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            Applicants ({jobApplications.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('vacancies')}
            className={`rounded-full px-4 py-2 text-xs font-extrabold ${
              subTab === 'vacancies'
                ? 'bg-[#0f172a] text-emerald-300'
                : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            Open Vacancies ({jobVacancies.filter((v) => v.status === 'open').length})
          </button>
        </div>
      }
    >
      {subTab === 'applicants' ? (
        <div className="space-y-3">
          {jobApplications.map((app) => (
            <div key={app.id} className="dmhs-card rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black text-indigo-700">
                      {app.vacancyTitle}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      Applied {app.appliedAt} · Exp: {app.experienceYears} · Expected: {app.expectedSalary}
                    </span>
                  </div>
                  <h4 className="mt-1.5 text-base font-black text-slate-900">{app.applicantName}</h4>
                  <p className="text-xs font-bold text-slate-600">
                    {app.qualification} · {app.phone} · {app.email}
                  </p>
                  {app.coverNote && <p className="mt-1.5 text-xs text-slate-500">{app.coverNote}</p>}
                  {app.adminNotes && (
                    <p className="mt-1 text-[11px] font-bold text-emerald-700">
                      HR Note: {app.adminNotes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { key: 'applied', label: 'Applied' },
                      { key: 'shortlisted', label: 'Shortlist' },
                      { key: 'demo_class', label: 'Demo Class' },
                      { key: 'hired', label: 'Hired' },
                      { key: 'rejected', label: 'Reject' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() =>
                        void runErpCampus(
                          {
                            action: 'update_application_stage',
                            applicationId: app.id,
                            stage: st.key as JobApplicationRecord['stage'],
                          },
                          `${app.applicantName} moved to ${st.label}`,
                        )
                      }
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                        app.stage === st.key
                          ? st.key === 'hired'
                            ? 'bg-emerald-600 text-white'
                            : st.key === 'rejected'
                              ? 'bg-rose-600 text-white'
                              : 'bg-[#0f172a] text-emerald-300'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form onSubmit={handleAddVacancy} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">Publish Job Vacancy</h3>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Role title (e.g., Science Lab Teacher)"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Department"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              />
              <select
                value={campusUnit}
                onChange={(e) => setCampusUnit(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
              >
                {campusUnits.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                placeholder="Salary range"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              />
              <input
                type="date"
                value={deadlineIso}
                onChange={(e) => setDeadlineIso(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              />
            </div>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              placeholder="Qualifications & experience requirements..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300"
            >
              Publish Vacancy
            </button>
          </form>

          <div className="space-y-3">
            {jobVacancies.map((v: JobVacancyItem) => (
              <div
                key={v.id}
                className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        v.status === 'open'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {v.status}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {v.campusUnit} · {v.employmentType} · Deadline {v.deadlineIso}
                    </span>
                  </div>
                  <h4 className="mt-1 text-sm font-black text-slate-900">{v.title}</h4>
                  <p className="text-xs font-bold text-emerald-700">{v.salaryRange}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{v.requirements}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void runErpCampus(
                      { action: 'toggle_vacancy_status', vacancyId: v.id },
                      'Vacancy visibility updated!',
                    )
                  }
                  className="rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-200"
                >
                  {v.status === 'open' ? 'Close Role' : 'Reopen Role'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  )
}

// ==================== 10. WEBSITE DESIGN CMS ====================
export function WebsiteDesignView() {
  const { websiteConfig, runErpCampus } = useSchool()
  const [draft, setDraft] = useState<SchoolWebsiteConfig>(websiteConfig)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await runErpCampus(
      { action: 'save_website_config', config: draft },
      'Public DMHA Website & Portal branding published live!',
    )
    setSaving(false)
  }

  return (
    <PageShell
      eyebrow="Public Campus Portal · Live CMS"
      title="Website Design & Portal CMS"
      subtitle="Customize the public DMHA landing headline, announcement ticker, 2027 admissions banner, Principal's message, and hotline — synced instantly to the public portal."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <form onSubmit={handleSave} className="dmhs-card space-y-4 rounded-[24px] p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">School Name</label>
              <input
                value={draft.schoolName}
                onChange={(e) => setDraft({ ...draft, schoolName: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Accent Theme</label>
              <select
                value={draft.accentTheme}
                onChange={(e) =>
                  setDraft({ ...draft, accentTheme: e.target.value as SchoolWebsiteConfig['accentTheme'] })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                <option value="emerald">DMHA Emerald &amp; Navy (Official)</option>
                <option value="indigo">Royal Indigo &amp; Slate</option>
                <option value="amber">Heritage Gold &amp; Navy</option>
                <option value="rose">Crimson House &amp; Charcoal</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Hero Headline</label>
            <input
              value={draft.heroHeadline}
              onChange={(e) => setDraft({ ...draft, heroHeadline: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Hero Subheadline</label>
            <textarea
              value={draft.heroSubheadline}
              onChange={(e) => setDraft({ ...draft, heroSubheadline: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">
              Live Announcement Ticker
            </label>
            <input
              value={draft.announcementTicker}
              onChange={(e) => setDraft({ ...draft, announcementTicker: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3.5">
            <label className="flex items-center gap-2 text-xs font-black text-slate-800">
              <input
                type="checkbox"
                checked={draft.admissionsBannerActive}
                onChange={(e) => setDraft({ ...draft, admissionsBannerActive: e.target.checked })}
                className="size-4 accent-emerald-600"
              />
              Show Admissions Banner on Public Portal
            </label>
            <input
              value={draft.admissionsBannerText}
              onChange={(e) => setDraft({ ...draft, admissionsBannerText: e.target.value })}
              className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Principal Name</label>
              <input
                value={draft.principalName}
                onChange={(e) => setDraft({ ...draft, principalName: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Campus Hotline</label>
              <input
                value={draft.hotlinePhone}
                onChange={(e) => setDraft({ ...draft, hotlinePhone: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">
              Principal&apos;s Welcome Message
            </label>
            <textarea
              value={draft.principalMessage}
              onChange={(e) => setDraft({ ...draft, principalMessage: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={draft.contactEmail}
              onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
              placeholder="Contact email"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold"
            />
            <input
              value={draft.campusAddress}
              onChange={(e) => setDraft({ ...draft, campusAddress: e.target.value })}
              placeholder="Campus address"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-[#0f172a] py-3 text-xs font-black text-emerald-300 hover:bg-slate-800"
          >
            {saving ? 'Publishing...' : 'Publish Live to Public DMHA Website & Login Portal'}
          </button>
        </form>

        {/* Live Website Preview Card */}
        <div className="dmhs-hero h-fit rounded-[28px] p-6 text-white shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">
            Live Public Portal Preview
          </p>
          {draft.admissionsBannerActive && (
            <div className="mt-3 inline-flex rounded-full bg-emerald-400/20 px-3 py-1 text-[11px] font-black text-emerald-300">
              ✦ {draft.admissionsBannerText}
            </div>
          )}
          <h3 className="mt-3 text-xl font-black leading-snug">{draft.heroHeadline}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">{draft.heroSubheadline}</p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-[11px] text-amber-200">
            <strong>Notice Ticker:</strong> {draft.announcementTicker}
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-black uppercase text-emerald-300">
              Message from {draft.principalName}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-200">
              &ldquo;{draft.principalMessage}&rdquo;
            </p>
          </div>
          <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-slate-400">
            <p>Hotline: {draft.hotlinePhone} · {draft.contactEmail}</p>
            <p className="mt-0.5">{draft.campusAddress}</p>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

// ==================== 11. UNIFIED REPORT MANAGER ====================
export function ReportManagerView() {
  const {
    students,
    fees,
    studentFines,
    employeeDuties,
    stockItems,
    admissions,
    jobApplications,
    notify,
  } = useSchool()

  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    notify(`Exported ${filename}!`)
  }

  const dueFees = fees.filter((f) => f.status === 'due')
  const lowStock = stockItems.filter((i) => i.quantity <= i.minThreshold)

  const reports = [
    {
      title: 'Daily Student Attendance & GPA Register',
      desc: `${students.length} active students across Pre-Play – Class 6 with today’s status, gate check-in, and attendance rate.`,
      badge: `${students.filter((s) => s.todayStatus === 'present').length}/${students.length} Present`,
      onExport: () =>
        downloadCsv(
          'DMHA-Attendance-Report.csv',
          ['Student', 'Class', 'Section', 'Roll', 'Today Status', 'Gate Check-In', 'Attendance %', 'GPA'],
          students.map((s) => [
            s.name,
            s.className,
            s.section,
            s.roll,
            s.todayStatus,
            s.gateCheckIn || 'Not Checked In',
            s.attendanceRate,
            s.gpa,
          ]),
        ),
    },
    {
      title: 'Fee Defaulters & Pending Tuition Report',
      desc: `${dueFees.length} unpaid invoice(s) totaling ৳${dueFees.reduce((s, f) => s + f.amount, 0).toLocaleString()}.`,
      badge: `${dueFees.length} Due Invoices`,
      onExport: () =>
        downloadCsv(
          'DMHA-Fee-Defaulters-Report.csv',
          ['Invoice ID', 'Student', 'Title', 'Category', 'Amount (BDT)', 'Due Date', 'Status'],
          dueFees.map((f) => [f.id, f.studentName, f.title, f.category || 'Tuition', f.amount, f.dueDate, f.status]),
        ),
    },
    {
      title: 'Fine Management & Penalty Ledger',
      desc: `${studentFines.length} recorded fine(s) including unpaid, invoiced, paid, and principal-waived entries.`,
      badge: `${studentFines.length} Fine Records`,
      onExport: () =>
        downloadCsv(
          'DMHA-Fine-Ledger-Report.csv',
          ['Student', 'Class', 'Category', 'Amount (BDT)', 'Status', 'Issued Date', 'Reason'],
          studentFines.map((f) => [f.studentName, f.classLabel, f.category, f.amount, f.status, f.issuedAt, f.reason]),
        ),
    },
    {
      title: 'Employee Duty & Shift Audit Sheet',
      desc: `${employeeDuties.length} assigned gate, assembly, exam invigilation, and bus escort shifts across Unit - 1 & Unit - 2.`,
      badge: `${employeeDuties.length} Shifts`,
      onExport: () =>
        downloadCsv(
          'DMHA-Employee-Duty-Report.csv',
          ['Employee', 'Role', 'Duty Type', 'Campus Unit', 'Date', 'Shift Time', 'Status'],
          employeeDuties.map((d) => [d.employeeName, d.employeeRole, d.dutyType, d.campusUnit, d.dateIso, d.shiftTime, d.status]),
        ),
    },
    {
      title: 'Stock Inventory & Low-Stock Reorder Audit',
      desc: `${stockItems.length} SKUs tracked (${lowStock.length} below minimum threshold) with full BDT valuation.`,
      badge: `${lowStock.length} Low Stock`,
      onExport: () =>
        downloadCsv(
          'DMHA-Stock-Inventory-Report.csv',
          ['SKU', 'Item Name', 'Category', 'Unit', 'Qty', 'Min Threshold', 'Unit Cost (BDT)', 'Total Value (BDT)'],
          stockItems.map((i) => [i.sku, i.name, i.category, i.campusUnit, i.quantity, i.minThreshold, i.unitCostBdt, i.quantity * i.unitCostBdt]),
        ),
    },
    {
      title: '2027 Admissions & Recruitment Pipeline Report',
      desc: `${admissions.length} student admission inquiries and ${jobApplications.length} teacher/staff job applications.`,
      badge: `${admissions.length + jobApplications.length} Applicants`,
      onExport: () =>
        downloadCsv(
          'DMHA-Admissions-and-Careers-Report.csv',
          ['Type', 'Applicant Name', 'Target Class / Vacancy', 'Phone', 'Stage'],
          [
            ...admissions.map((a) => ['Admission', a.applicantName, a.applyingClass, a.guardianPhone, a.stage]),
            ...jobApplications.map((j) => ['Job Application', j.applicantName, j.vacancyTitle, j.phone, j.stage]),
          ],
        ),
    },
  ]

  return (
    <PageShell
      eyebrow="Executive Analytics · CSV & A4 Print Exports"
      title="Report Manager"
      subtitle="Generate institutional CSV spreadsheets and A4 print reports across attendance, tuition defaulters, fines, duty rosters, stock inventory, and admissions."
      action={
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300"
        >
          <Icon name="print" size={14} />
          Print Executive Summary A4
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((rep) => (
          <div key={rep.title} className="dmhs-card flex flex-col justify-between rounded-[24px] p-5">
            <div>
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">
                {rep.badge}
              </span>
              <h3 className="mt-3 text-sm font-black text-slate-900">{rep.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{rep.desc}</p>
            </div>
            <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-3.5">
              <button
                type="button"
                onClick={rep.onExport}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300 hover:bg-slate-800"
              >
                <Icon name="download" size={13} />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-200"
              >
                Print
              </button>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
