'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from './icons'
import { useSchool } from './store'

export type NoteTag = 'General' | 'Physics' | 'Mathematics' | 'English' | 'PTM & Parent' | 'To-Do'
export type NoteTint = 'slate' | 'emerald' | 'indigo' | 'amber' | 'rose'

export interface NotebookEntry {
  id: string
  title: string
  content: string
  tag: NoteTag
  tint: NoteTint
  pinned: boolean
  updatedAt: string
}

const NOTEBOOK_STORAGE_KEY = 'dmhs-quick-notebook-v1'

const initialNotes: NotebookEntry[] = [
  {
    id: 'nb-1',
    title: 'Physics — Electromagnetic Induction Formulas',
    content:
      '• Faraday’s Law: ε = -N (dΦ / dt)\n• Transformer ratio: Vp / Vs = Np / Ns\n• Remember to include the negative sign (Lenz’s Law) in Q2 calculation steps.',
    tag: 'Physics',
    tint: 'emerald',
    pinned: true,
    updatedAt: 'Today · 09:50 AM',
  },
  {
    id: 'nb-2',
    title: 'Saturday PTM Questions for English Teacher',
    content:
      '1. Ask Farhana Ma’am for recommended formal essay structures.\n2. Confirm Cambridge IGCSE Paper 22 practice schedule.\n3. Review essay grading rubric together at home.',
    tag: 'PTM & Parent',
    tint: 'indigo',
    pinned: false,
    updatedAt: 'Yesterday · 04:15 PM',
  },
  {
    id: 'nb-3',
    title: 'Term Final Revision Checklist',
    content:
      '✓ Download Physics & Math 2025 May/June Past Papers\n✓ Sign Science Museum Field Trip Consent Form\n• Revise Quadratic Word Problems (Exercise 4.3)',
    tag: 'To-Do',
    tint: 'amber',
    pinned: false,
    updatedAt: '2 days ago',
  },
]

const TAGS: NoteTag[] = ['General', 'Physics', 'Mathematics', 'English', 'PTM & Parent', 'To-Do']

const TINT_STYLES: Record<NoteTint, { dot: string; card: string; badge: string }> = {
  slate: {
    dot: 'bg-slate-600',
    card: 'border-slate-200 bg-white',
    badge: 'bg-slate-100 text-slate-700',
  },
  emerald: {
    dot: 'bg-emerald-500',
    card: 'border-emerald-200/80 bg-emerald-50/40',
    badge: 'bg-emerald-100/80 text-emerald-800',
  },
  indigo: {
    dot: 'bg-indigo-500',
    card: 'border-indigo-200/80 bg-indigo-50/40',
    badge: 'bg-indigo-100/80 text-indigo-800',
  },
  amber: {
    dot: 'bg-amber-500',
    card: 'border-amber-200/80 bg-amber-50/40',
    badge: 'bg-amber-100/80 text-amber-800',
  },
  rose: {
    dot: 'bg-rose-500',
    card: 'border-rose-200/80 bg-rose-50/40',
    badge: 'bg-rose-100/80 text-rose-800',
  },
}

export function QuickNotebookWidget() {
  const { notify } = useSchool()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState<NotebookEntry[]>(initialNotes)
  const [activeId, setActiveId] = useState<string>(initialNotes[0].id)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState<'All' | NoteTag>('All')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(NOTEBOOK_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as NotebookEntry[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotes(parsed)
          setActiveId(parsed[0].id)
        }
      }
    } catch {
      // ignore storage errors
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(NOTEBOOK_STORAGE_KEY, JSON.stringify(notes))
    } catch {
      // ignore storage errors
    }
  }, [hydrated, notes])

  const filteredNotes = useMemo(() => {
    const q = search.toLowerCase()
    return [...notes]
      .filter((n) => (filterTag === 'All' ? true : n.tag === filterTag))
      .filter((n) => `${n.title} ${n.content} ${n.tag}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned))
  }, [notes, search, filterTag])

  const activeNote = notes.find((n) => n.id === activeId) || filteredNotes[0] || null

  const createNote = () => {
    const fresh: NotebookEntry = {
      id: `nb-${Date.now()}`,
      title: 'Untitled Note',
      content: '',
      tag: filterTag === 'All' ? 'General' : filterTag,
      tint: 'emerald',
      pinned: false,
      updatedAt: 'Just now',
    }
    setNotes((prev) => [fresh, ...prev])
    setActiveId(fresh.id)
    notify('New notebook page created')
  }

  const updateActive = (patch: Partial<NotebookEntry>) => {
    if (!activeNote) return
    setNotes((prev) =>
      prev.map((n) => (n.id === activeNote.id ? { ...n, ...patch, updatedAt: 'Just now' } : n)),
    )
  }

  const deleteActive = () => {
    if (!activeNote) return
    const remaining = notes.filter((n) => n.id !== activeNote.id)
    setNotes(remaining)
    setActiveId(remaining[0]?.id || '')
    notify('Note deleted')
  }

  const wordCount = activeNote?.content.trim()
    ? activeNote.content.trim().split(/\s+/).length
    : 0

  return (
    <>
      {/* Floating Bottom-Right Circular Plus FAB for Notebook */}
      <button
        aria-label={open ? 'Close DMHA Floating Notebook' : 'Open DMHA Floating Notebook'}
        title={open ? 'Close Notebook' : 'DMHA Quick Notebook'}
        onClick={() => setOpen((prev) => !prev)}
        className="group fixed bottom-24 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-[#0f172a] text-emerald-400 shadow-[0_14px_34px_rgba(15,23,42,.36)] ring-2 ring-emerald-400/40 transition duration-200 hover:scale-105 hover:bg-slate-800 hover:ring-emerald-400 lg:bottom-7 lg:right-7"
      >
        <span
          className={`transition-transform duration-200 ${open ? 'rotate-45 text-white' : 'group-hover:rotate-90'}`}
        >
          <Icon name="plus" size={24} />
        </span>
        {!open && notes.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-slate-950 ring-2 ring-white">
            {notes.length}
          </span>
        )}
      </button>

      {/* Floating Bottom-Right DMHA Digital Notebook Window */}
      {open && (
        <aside
          aria-label="DMHA Floating Notebook"
          className={`dmhs-fade fixed bottom-40 right-3 left-3 z-50 flex flex-col overflow-hidden rounded-[26px] border border-slate-200/90 bg-[#f8fafc] shadow-[0_24px_64px_rgba(15,23,42,.26)] sm:left-auto sm:right-5 lg:bottom-24 lg:right-7 ${
            expanded
              ? 'h-[min(78vh,620px)] sm:w-[min(94vw,760px)]'
              : 'h-[min(66vh,520px)] sm:w-[420px]'
          }`}
        >
          {/* Floating Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-[#0f172a] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
                <Icon name="book" size={16} />
              </span>
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[.15em] text-emerald-300">
                  DMHA Floating Note
                </p>
                <h2 className="text-sm font-black leading-tight">Quick Notebook</h2>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={createNote}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-black text-slate-950 transition hover:bg-emerald-300"
              >
                <Icon name="plus" size={13} />
                New
              </button>
              <button
                onClick={() => setExpanded((prev) => !prev)}
                className="hidden rounded-full bg-white/10 px-2.5 py-1.5 text-[10px] font-extrabold text-white transition hover:bg-white/20 sm:inline-block"
              >
                {expanded ? 'Compact' : 'Expand'}
              </button>
              <button
                aria-label="Close notebook"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          </div>

          {/* Floating Body */}
          <div className={`grid min-h-0 flex-1 ${expanded ? 'md:grid-cols-[240px_1fr]' : 'grid-rows-[auto_1fr]'}`}>
            {/* Notes Strip / Sidebar */}
            <div
              className={`flex min-h-0 flex-col bg-white/90 p-3 ${
                expanded
                  ? 'border-b border-slate-200 md:border-b-0 md:border-r'
                  : 'border-b border-slate-200'
              }`}
            >
              {expanded && (
                <>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                    <Icon name="search" size={13} className="text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search notes..."
                      className="w-full bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400"
                    />
                  </label>
                  <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
                    {(['All', ...TAGS] as const).map((tg) => (
                      <button
                        key={tg}
                        onClick={() => setFilterTag(tg)}
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold transition ${
                          filterTag === tg
                            ? 'bg-[#0f172a] text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {tg}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div
                className={
                  expanded
                    ? 'mt-2.5 flex-1 space-y-1.5 overflow-y-auto pr-0.5'
                    : 'flex gap-2 overflow-x-auto pb-0.5'
                }
              >
                {filteredNotes.map((note) => {
                  const selected = activeNote?.id === note.id
                  const style = TINT_STYLES[note.tint]
                  return (
                    <button
                      key={note.id}
                      onClick={() => setActiveId(note.id)}
                      className={`${
                        expanded ? 'w-full' : 'min-w-[140px] max-w-[160px] shrink-0'
                      } rounded-xl border p-2.5 text-left transition ${
                        selected
                          ? 'border-[#0f172a] bg-[#0f172a] text-white shadow-xs'
                          : `${style.card} hover:border-slate-300`
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${
                            selected ? 'bg-white/15 text-emerald-300' : style.badge
                          }`}
                        >
                          {note.tag}
                        </span>
                        {note.pinned && (
                          <span className="text-[9px] text-amber-400">★</span>
                        )}
                      </div>
                      <p
                        className={`mt-1 truncate text-[11px] font-black ${
                          selected ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {note.title || 'Untitled Note'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Editor Pane */}
            {activeNote ? (
              <div className="flex min-h-0 flex-col bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Note category"
                      value={activeNote.tag}
                      onChange={(e) => updateActive({ tag: e.target.value as NoteTag })}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-extrabold text-slate-800 outline-none"
                    >
                      {TAGS.map((tg) => (
                        <option key={tg} value={tg}>
                          {tg}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      {(['slate', 'emerald', 'indigo', 'amber', 'rose'] as NoteTint[]).map(
                        (tint) => (
                          <button
                            key={tint}
                            aria-label={`Set ${tint} color`}
                            onClick={() => updateActive({ tint })}
                            className={`size-3.5 rounded-full transition ${TINT_STYLES[tint].dot} ${
                              activeNote.tint === tint
                                ? 'ring-2 ring-slate-900 ring-offset-1'
                                : 'opacity-55 hover:opacity-100'
                            }`}
                          />
                        ),
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateActive({ pinned: !activeNote.pinned })}
                      className={`rounded-lg px-2 py-1 text-[10px] font-extrabold ${
                        activeNote.pinned
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {activeNote.pinned ? 'Pinned ★' : 'Pin'}
                    </button>
                    <button
                      onClick={deleteActive}
                      className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-extrabold text-rose-600 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <input
                  value={activeNote.title}
                  onChange={(e) => updateActive({ title: e.target.value })}
                  placeholder="Note title..."
                  className="mt-3 w-full bg-transparent text-base font-black text-slate-900 outline-none placeholder:text-slate-300"
                />

                <textarea
                  value={activeNote.content}
                  onChange={(e) => updateActive({ content: e.target.value })}
                  placeholder="Write quick notes, formulas, PTM questions, or reminders..."
                  className="mt-2 flex-1 resize-none bg-transparent text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-300"
                />

                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[10px] font-bold text-slate-400">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Auto-saved · {activeNote.updatedAt}
                  </span>
                  <span>{wordCount} words</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center bg-white p-6 text-center">
                <p className="text-xs font-black text-slate-800">No notes yet</p>
                <button
                  onClick={createNote}
                  className="mt-2.5 rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950"
                >
                  + Create Note
                </button>
              </div>
            )}
          </div>
        </aside>
      )}
    </>
  )
}
