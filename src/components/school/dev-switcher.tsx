'use client'

import React, { useMemo, useState } from 'react'
import { Icon } from './icons'
import { useSchool } from './store'
import type { AuthAccountSummary, Role } from './types'

const ROLE_ORDER: Role[] = ['admin', 'teacher', 'guardian', 'student', 'staff']

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Developer & Admin',
  teacher: 'Teachers',
  guardian: 'Guardians / Parents',
  student: 'Students',
  staff: 'Custom Staff Roles',
}

const ROLE_BADGE_CLASSES: Record<Role, string> = {
  admin: 'bg-emerald-100 text-emerald-800',
  teacher: 'bg-sky-100 text-sky-800',
  guardian: 'bg-violet-100 text-violet-800',
  student: 'bg-amber-100 text-amber-900',
  staff: 'bg-rose-100 text-rose-800',
}

export function DeveloperAccountSwitcher({
  onAccountSwitched,
}: {
  onAccountSwitched?: () => void
}) {
  const {
    isDeveloperMode,
    authUser,
    authAccounts,
    refreshAuthAccounts,
    devSwitchAccount,
    devReturnToDeveloper,
  } = useSchool()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const isCurrentlyDevMaster =
    authUser?.linkedEntityId === 'dev-master' || authUser?.loginCode === 'DEV-001'

  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return authAccounts.filter((acc) => {
      if (roleFilter !== 'all' && acc.role !== roleFilter) return false
      if (!q) return true
      const hay = `${acc.displayName} ${acc.email} ${acc.loginCode} ${acc.role}`.toLowerCase()
      return hay.includes(q)
    })
  }, [authAccounts, query, roleFilter])

  const grouped = useMemo(() => {
    const map = new Map<Role, AuthAccountSummary[]>()
    for (const r of ROLE_ORDER) map.set(r, [])
    for (const acc of filteredAccounts) {
      const list = map.get(acc.role) || []
      list.push(acc)
      map.set(acc.role, list)
    }
    return ROLE_ORDER.map((r) => ({ role: r, items: map.get(r) || [] })).filter(
      (g) => g.items.length > 0,
    )
  }, [filteredAccounts])

  if (!isDeveloperMode || !authUser) return null

  const handleOpenModal = () => {
    setOpen(true)
    void refreshAuthAccounts()
  }

  const handleSwitch = async (acc: AuthAccountSummary) => {
    setSwitchingId(acc.id)
    const res = await devSwitchAccount({ targetUserId: acc.id })
    setSwitchingId(null)
    if (res.ok) {
      setOpen(false)
      onAccountSwitched?.()
    }
  }

  const handleReturnDev = async () => {
    setSwitchingId('dev-return')
    const res = await devReturnToDeveloper()
    setSwitchingId(null)
    if (res.ok) {
      setOpen(false)
      onAccountSwitched?.()
    }
  }

  return (
    <>
      {/* Persistent Developer Master Control Strip (visible ONLY to verified DEV-001 sessions) */}
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-400/25 bg-[#090f1d] px-4 py-2 text-xs text-white shadow-md print:hidden">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">
            <Icon name="key" size={11} />
            DEV MASTER · DEV-001
          </span>
          <span className="text-[11px] font-semibold text-slate-300">
            Active Session:{' '}
            <strong className="text-white">{authUser.displayName}</strong>{' '}
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
              {authUser.role.toUpperCase()} · {authUser.loginCode}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1 text-[11px] font-black text-slate-950 transition hover:bg-emerald-400"
          >
            <Icon name="users" size={13} />
            Switch Any Account ({authAccounts.length})
          </button>

          {!isCurrentlyDevMaster && (
            <button
              type="button"
              disabled={switchingId === 'dev-return'}
              onClick={() => void handleReturnDev()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              <Icon name="shield" size={12} />
              {switchingId === 'dev-return' ? 'Returning…' : 'Return to DEV-001'}
            </button>
          )}
        </div>
      </div>

      {/* All-Accounts Developer Switcher Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-[#0f172a] p-5 text-white">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">
                  Developer Master Switcher · Real SQLite Sessions
                </span>
                <h2 className="mt-2 text-lg font-black">
                  Access Any DMHA Account ({authAccounts.length} Total)
                </h2>
                <p className="mt-0.5 text-xs text-slate-300">
                  Switches your real server session cookie into the selected user so every role
                  permission, privacy rule, and API behaves identically to that user.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Search & Role Filter Pills */}
            <div className="space-y-2.5 border-b border-slate-100 bg-slate-50/80 p-4">
              <div className="relative">
                <Icon
                  name="search"
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, email, login code (e.g., TCH-001, araf@dmha.edu, accountant)..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-semibold outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRoleFilter('all')}
                  className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                    roleFilter === 'all'
                      ? 'bg-[#0f172a] text-emerald-300'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All ({authAccounts.length})
                </button>
                {ROLE_ORDER.map((r) => {
                  const count = authAccounts.filter((a) => a.role === r).length
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleFilter(r)}
                      className={`rounded-full px-3 py-1 text-[11px] font-extrabold capitalize ${
                        roleFilter === r
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {r} ({count})
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Grouped Accounts List */}
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {grouped.length === 0 ? (
                <p className="py-10 text-center text-xs font-bold text-slate-400">
                  No accounts match “{query}”.
                </p>
              ) : (
                grouped.map((group) => (
                  <div key={group.role}>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {ROLE_LABELS[group.role]} ({group.items.length})
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.items.map((acc) => {
                        const isActive = acc.id === authUser.id
                        const isBusy = switchingId === acc.id
                        return (
                          <div
                            key={acc.id}
                            className={`flex items-center justify-between gap-2 rounded-2xl border p-3 transition ${
                              isActive
                                ? 'border-emerald-400 bg-emerald-50/70 ring-1 ring-emerald-200'
                                : 'border-slate-200/80 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-xs font-black text-slate-900">
                                  {acc.displayName}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${ROLE_BADGE_CLASSES[acc.role]}`}
                                >
                                  {acc.loginCode}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                {acc.email}
                              </p>
                            </div>

                            {isActive ? (
                              <span className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white">
                                Active
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={Boolean(switchingId)}
                                onClick={() => void handleSwitch(acc)}
                                className="shrink-0 rounded-xl bg-[#0f172a] px-3 py-1.5 text-[11px] font-black text-emerald-300 transition hover:bg-slate-800 disabled:opacity-50"
                              >
                                {isBusy ? 'Switching…' : 'Open →'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
