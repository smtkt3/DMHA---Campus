'use client'

import React, { useMemo, useState } from 'react'
import { DateFilterBar, extractIsoDate, formatPrettyDate, matchesDateFilter } from './date-utils'
import { Icon, type IconName } from './icons'
import { useSchool } from './store'
import type { CanteenMenuItem, CustomRoleDefinition, StaffPermission } from './types'
import { PageShell } from './ui'

export const STAFF_PERMISSION_CATALOG: {
  key: StaffPermission
  label: string
  tabId: string
  desc: string
  icon: IconName
}[] = [
  {
    key: 'accounts',
    label: 'Accounts & Finance',
    tabId: 'accounts',
    desc: 'School tuition invoices, campus expenses, other incomes & P&L balance',
    icon: 'payment',
  },
  {
    key: 'payroll',
    label: 'Faculty Finance & Payroll',
    tabId: 'facultyfinance',
    desc: 'Manage teacher salaries, payslips, reimbursements, advances & extra-duty allowances',
    icon: 'payment',
  },
  {
    key: 'payment_ledger',
    label: 'Payment Reconciliation Ledger',
    tabId: 'security',
    desc: 'Inspect immutable SQLite payment transaction ledger & gateway receipts',
    icon: 'shield',
  },
  {
    key: 'canteen_pos',
    label: 'Canteen Menu & QR POS',
    tabId: 'canteenops',
    desc: 'Add/edit canteen food menu & prices and charge Student QR wallets',
    icon: 'clipboard',
  },
  {
    key: 'gate_security',
    label: 'Gate Security QR Scanners',
    tabId: 'safety',
    desc: 'Verify HMAC-signed Pickup QR Passes & log Main Gate check-in/check-out',
    icon: 'qr',
  },
  {
    key: 'infirmary',
    label: 'Campus Infirmary & Health',
    tabId: 'safety',
    desc: 'Log campus nurse visits, symptoms, first-aid actions & notify parents',
    icon: 'heart',
  },
  {
    key: 'library',
    label: 'Smart Library Manager',
    tabId: 'library',
    desc: 'Manage book catalog, issue/return via Student QR ID & overdue fines',
    icon: 'book',
  },
  {
    key: 'admissions',
    label: 'Admissions Pipeline CRM',
    tabId: 'admissions',
    desc: 'Review new student applicants, entrance test scores & enroll cohorts',
    icon: 'userplus',
  },
  {
    key: 'documents',
    label: 'Official Documents & Admit Cards',
    tabId: 'documents',
    desc: 'Generate & verify QR-sealed Report Cards, Admit Cards & Certificates',
    icon: 'print',
  },
  {
    key: 'timetable',
    label: 'Class & Exam Timetable (Read)',
    tabId: 'schedule',
    desc: 'Inspect school-wide class routine & upcoming exam room allocations',
    icon: 'calendar',
  },
  {
    key: 'notices',
    label: 'School Notices & Circulars',
    tabId: 'campus',
    desc: 'Read official DMHA circulars and campus unit announcements',
    icon: 'bell',
  },
]

const ROLE_PRESETS: {
  name: string
  description: string
  accent: CustomRoleDefinition['accent']
  permissions: StaffPermission[]
}[] = [
  {
    name: 'Accountant',
    description: 'Full financial accounting, tuition invoices, expenses, teacher payroll & payment ledger.',
    accent: 'emerald',
    permissions: ['accounts', 'payroll', 'payment_ledger', 'documents', 'notices'],
  },
  {
    name: 'Canteen Manager',
    description: 'Manage food menu, pricing, stock availability & cashless Student QR wallet checkout.',
    accent: 'amber',
    permissions: ['canteen_pos', 'notices'],
  },
  {
    name: 'Gate Security Officer',
    description: 'Verify HMAC-signed Guardian Pickup QR passes and Student Main Gate check-in/check-out.',
    accent: 'sky',
    permissions: ['gate_security', 'notices'],
  },
  {
    name: 'School Librarian',
    description: 'Manage DMHA Library catalog, issue/return books by Student QR ID & track overdue fines.',
    accent: 'violet',
    permissions: ['library', 'notices'],
  },
  {
    name: 'School Nurse',
    description: 'Operate Campus Infirmary, log medical incidents & send instant parent health alerts.',
    accent: 'rose',
    permissions: ['infirmary', 'notices'],
  },
  {
    name: 'Admissions Officer',
    description: 'Process 2027 admissions applications, entrance tests & student enrollment pipeline.',
    accent: 'sky',
    permissions: ['admissions', 'documents', 'notices'],
  },
]

const ACCENT_STYLES: Record<CustomRoleDefinition['accent'], string> = {
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-50 text-amber-900 border-amber-200',
  sky: 'bg-sky-50 text-sky-800 border-sky-200',
  violet: 'bg-violet-50 text-violet-800 border-violet-200',
  rose: 'bg-rose-50 text-rose-800 border-rose-200',
}

// ============================================================================
// 1. ADMIN CUSTOM ROLES & STAFF ACCOUNTS MANAGER
// ============================================================================
export function AdminRolesAndStaffView({ onOpenPortal }: { onOpenPortal: () => void }) {
  const {
    customRoles = [],
    staffMembers = [],
    authAccounts = [],
    createCustomRole,
    updateCustomRolePermissions,
    deleteCustomRole,
    addStaffMember,
    toggleStaffStatus,
    removeStaffMember,
    impersonateStaff,
  } = useSchool()

  const [subTab, setSubTab] = useState<'roles' | 'staff'>('roles')

  // Create Role Form
  const [roleName, setRoleName] = useState('')
  const [roleDesc, setRoleDesc] = useState('')
  const [roleAccent, setRoleAccent] = useState<CustomRoleDefinition['accent']>('emerald')
  const [rolePerms, setRolePerms] = useState<StaffPermission[]>(['notices'])
  const [roleError, setRoleError] = useState('')

  // Create Staff Account Form
  const [staffName, setStaffName] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [staffPhone, setStaffPhone] = useState('+880 1711-')
  const [staffRoleId, setStaffRoleId] = useState(customRoles[0]?.id || 'role-accountant')
  const [staffDept, setStaffDept] = useState('')
  const [staffPassword, setStaffPassword] = useState('dmha2026')
  const [staffBusy, setStaffBusy] = useState(false)
  const [staffError, setStaffError] = useState('')

  const toggleDraftPerm = (key: StaffPermission) => {
    setRolePerms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]))
  }

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault()
    setRoleError('')
    if (!roleName.trim()) {
      setRoleError('Please enter a role name (e.g., Accountant, Canteen Manager, Gate Security).')
      return
    }
    if (rolePerms.length === 0) {
      setRoleError('Select at least one workspace permission for this role.')
      return
    }
    const created = createCustomRole({
      name: roleName.trim(),
      description: roleDesc.trim(),
      accent: roleAccent,
      permissions: rolePerms,
    })
    setStaffRoleId(created.id)
    setRoleName('')
    setRoleDesc('')
    setRolePerms(['notices'])
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setStaffError('')
    if (!staffName.trim() || !staffEmail.trim()) {
      setStaffError('Name and login email are required.')
      return
    }
    setStaffBusy(true)
    const res = await addStaffMember({
      name: staffName.trim(),
      email: staffEmail.trim(),
      phone: staffPhone.trim(),
      customRoleId: staffRoleId || customRoles[0]?.id || 'role-accountant',
      department: staffDept.trim(),
      initialPassword: staffPassword.trim() || 'dmha2026',
    })
    setStaffBusy(false)
    if (!res.ok) {
      setStaffError(res.error || 'Could not create staff login account.')
      return
    }
    setStaffName('')
    setStaffEmail('')
    setStaffDept('')
    setStaffPhone('+880 1711-')
  }

  return (
    <PageShell
      eyebrow="DMHA Role-Based Access Control (RBAC)"
      title="Custom Staff Roles & Dedicated Portals"
      subtitle="Create custom school roles (Accountant, Canteen Manager, Gate Security, Librarian, Nurse, etc.) with exact module permissions — each staff login automatically sees ONLY their own workspace."
    >
      {/* Hero KPI Row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="dmhs-hero rounded-[22px] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-300">
            Custom Staff Roles
          </p>
          <p className="mt-1.5 text-3xl font-black">{customRoles.length}</p>
          <p className="mt-1 text-[11px] text-slate-300">
            Each role gets its own private sidebar &amp; API guard
          </p>
        </div>
        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
            Active Staff Accounts
          </p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">
            {staffMembers.filter((s) => s.status === 'active').length}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-700">
            Real SQLite salted-scrypt login credentials
          </p>
        </div>
        <div className="dmhs-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">
            Zero Cross-Role Leakage
          </p>
          <p className="mt-1.5 text-lg font-black text-slate-900">Strict Portal Isolation</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Guardian, Teacher &amp; Staff only see their own portal
          </p>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab('roles')}
          className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
            subTab === 'roles'
              ? 'bg-[#0f172a] text-emerald-300'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Custom Roles &amp; Permissions ({customRoles.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('staff')}
          className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
            subTab === 'staff'
              ? 'bg-[#0f172a] text-emerald-300'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Staff Login Accounts ({staffMembers.length})
        </button>
      </div>

      {/* TAB 1: CUSTOM ROLES BUILDER */}
      {subTab === 'roles' && (
        <div className="grid gap-6 lg:grid-cols-[1.05fr_1.15fr]">
          {/* Create Role Form */}
          <form onSubmit={handleCreateRole} className="dmhs-card h-fit p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">
              Create New Role
            </p>
            <h3 className="mt-0.5 text-base font-black text-slate-900">
              Build Any School Role &amp; Assign Responsibilities
            </h3>

            {/* 1-Click Preset Templates */}
            <div className="mt-4">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                1-Click Starter Presets
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ROLE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setRoleName(preset.name)
                      setRoleDesc(preset.description)
                      setRoleAccent(preset.accent)
                      setRolePerms([...preset.permissions])
                      setRoleError('')
                    }}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-extrabold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Role Name *
                </label>
                <input
                  required
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g., Accountant, Canteen Manager, Security"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Badge Accent
                </label>
                <select
                  value={roleAccent}
                  onChange={(e) => setRoleAccent(e.target.value as CustomRoleDefinition['accent'])}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                >
                  <option value="emerald">Emerald (Finance / Ops)</option>
                  <option value="amber">Amber (Canteen / Hospitality)</option>
                  <option value="sky">Sky (Security / Admissions)</option>
                  <option value="violet">Violet (Library / Academics)</option>
                  <option value="rose">Rose (Nurse / Medical)</option>
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-[10px] font-extrabold uppercase text-slate-400">
                Responsibility Summary
              </label>
              <input
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                placeholder="Brief summary of what this role manages..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Allowed Modules &amp; Permissions ({rolePerms.length} selected)
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {STAFF_PERMISSION_CATALOG.map((perm) => {
                  const checked = rolePerms.includes(perm.key)
                  return (
                    <label
                      key={perm.key}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                        checked
                          ? 'border-emerald-400 bg-emerald-50/70'
                          : 'border-slate-200/80 bg-slate-50/60 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDraftPerm(perm.key)}
                        className="mt-0.5 size-4 rounded accent-emerald-600"
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-slate-900">{perm.label}</p>
                        <p className="text-[10px] leading-snug text-slate-500">{perm.desc}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {roleError && (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {roleError}
              </p>
            )}

            <button
              type="submit"
              className="mt-4 w-full rounded-full bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300 transition hover:bg-emerald-600 hover:text-white"
            >
              + Create Custom Role
            </button>
          </form>

          {/* Existing Roles List with Live Permission Toggles */}
          <div className="space-y-4">
            {customRoles.map((r) => {
              const assignedStaff = staffMembers.filter((s) => s.customRoleId === r.id)
              return (
                <div key={r.id} className="dmhs-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-0.5 text-[10px] font-black uppercase ${ACCENT_STYLES[r.accent]}`}
                        >
                          {r.name}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          {assignedStaff.length} staff member{assignedStaff.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{r.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {assignedStaff[0] && (
                        <button
                          type="button"
                          onClick={() => {
                            impersonateStaff(assignedStaff[0].id)
                            onOpenPortal()
                          }}
                          className="rounded-full bg-[#0f172a] px-3.5 py-1.5 text-[11px] font-black text-emerald-300 hover:bg-emerald-600 hover:text-white"
                        >
                          Preview Portal →
                        </button>
                      )}
                      {assignedStaff.length === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const res = deleteCustomRole(r.id)
                            if (!res.ok && res.error) setRoleError(res.error)
                          }}
                          className="rounded-full bg-rose-50 px-3 py-1.5 text-[11px] font-extrabold text-rose-600 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live Permission Chips */}
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {STAFF_PERMISSION_CATALOG.map((p) => {
                      const active = r.permissions.includes(p.key)
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? r.permissions.filter((x) => x !== p.key)
                              : [...r.permissions, p.key]
                            updateCustomRolePermissions(r.id, next)
                          }}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold transition ${
                            active
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                          }`}
                        >
                          {active ? '✓ ' : '+ '}
                          {p.label}
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

      {/* TAB 2: STAFF ACCOUNTS DIRECTORY */}
      {subTab === 'staff' && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Add New Staff Account Form */}
          <form onSubmit={handleAddStaff} className="dmhs-card h-fit p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">
              Create SQLite Staff Login
            </p>
            <h3 className="mt-0.5 text-base font-black text-slate-900">Add Staff Member</h3>
            <p className="mt-1 text-xs text-slate-500">
              Creates a real DMHA login account. When they sign in, they will see ONLY their assigned role’s portal.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Full Name *
                </label>
                <input
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="e.g., Tanvir Rahman"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Assigned Custom Role *
                </label>
                <select
                  value={staffRoleId}
                  onChange={(e) => setStaffRoleId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                >
                  {customRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.permissions.length} permissions)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Login Email *
                </label>
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="e.g., library@dmha.edu"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400">
                    Phone
                  </label>
                  <input
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400">
                    Initial Password
                  </label>
                  <input
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-400">
                  Department / Desk
                </label>
                <input
                  value={staffDept}
                  onChange={(e) => setStaffDept(e.target.value)}
                  placeholder="e.g., Accounts Office / Unit - 1 Gate"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                />
              </div>

              {staffError && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                  {staffError}
                </p>
              )}

              <button
                type="submit"
                disabled={staffBusy}
                className="w-full rounded-full bg-emerald-600 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {staffBusy ? 'Creating Login...' : '+ Create Staff Account'}
              </button>
            </div>
          </form>

          {/* Staff Directory List */}
          <div className="space-y-3">
            {staffMembers.map((stf) => {
              const roleDef = customRoles.find((r) => r.id === stf.customRoleId)
              const acc = authAccounts.find((a) => a.linkedEntityId === stf.id)
              return (
                <div
                  key={stf.id}
                  className="dmhs-card flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#0f172a] text-sm font-black text-emerald-300">
                      {stf.initials}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900">{stf.name}</h4>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            roleDef ? ACCENT_STYLES[roleDef.accent] : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {roleDef?.name || 'Staff'}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                            stf.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {stf.status}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] font-bold text-slate-600">
                        Login: {stf.email} {acc ? `· ID: ${acc.loginCode}` : ''}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                        {stf.department} · {stf.phone}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        impersonateStaff(stf.id)
                        onOpenPortal()
                      }}
                      className="rounded-full bg-[#0f172a] px-3.5 py-1.5 text-[11px] font-black text-emerald-300 hover:bg-emerald-600 hover:text-white"
                    >
                      Open Portal →
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStaffStatus(stf.id)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                    >
                      {stf.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStaffMember(stf.id)}
                      className="rounded-full bg-rose-50 px-3 py-1.5 text-[11px] font-extrabold text-rose-600 hover:bg-rose-100"
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

// ============================================================================
// 2. DEDICATED STAFF WORKSPACE HOME (Dynamically tailored to their permissions!)
// ============================================================================
export function StaffOverview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const {
    activeStaffMember,
    activeCustomRole,
    fees = [],
    teacherSalaries = [],
    canteenMenu = [],
    canteenTransactions = [],
    dismissalLogs = [],
    qrScans = [],
    libraryBooks = [],
    admissions = [],
  } = useSchool()

  const perms = activeCustomRole?.permissions || []
  const has = (p: StaffPermission) => perms.includes(p)

  const totalDueFees = fees.filter((f) => f.status === 'due').reduce((s, f) => s + f.amount, 0)
  const pendingPayroll = teacherSalaries.filter((s) => s.status === 'pending').length
  const availableMenuCount = canteenMenu.filter((m) => m.available).length
  const canteenSalesTotal = canteenTransactions.reduce((s, t) => s + t.amount, 0)
  const gateScansCount = qrScans.filter((q) => q.checkpoint.includes('Gate')).length

  const grantedCards = STAFF_PERMISSION_CATALOG.filter((p) => has(p.key))

  return (
    <PageShell
      eyebrow={`DMHA Dedicated Staff Portal · ${activeCustomRole?.name || 'Staff'}`}
      title={`${activeCustomRole?.name || 'Staff'} Command Desk`}
      subtitle={`Signed in as ${activeStaffMember?.name || 'Staff'} (${activeStaffMember?.department || 'DMHA Campus'}). Your interface is customized exclusively to your assigned responsibilities.`}
    >
      {/* Hero Banner */}
      <div className="dmhs-hero rounded-[28px] p-6 text-white shadow-xl sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-emerald-300 ring-1 ring-emerald-400/30">
              <Icon name="shield" size={12} />
              {activeCustomRole?.name || 'Staff'} Workspace · Private Role Access
            </span>
            <h2 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
              Welcome, {activeStaffMember?.name || 'DMHA Staff'}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
              {activeCustomRole?.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {has('accounts') && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p className="text-[9px] font-extrabold uppercase text-amber-300">Fees Pending</p>
                <p className="mt-1 text-xl font-black">৳{totalDueFees.toLocaleString()}</p>
              </div>
            )}
            {has('payroll') && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p className="text-[9px] font-extrabold uppercase text-emerald-300">Pending Salaries</p>
                <p className="mt-1 text-xl font-black">{pendingPayroll}</p>
              </div>
            )}
            {has('canteen_pos') && (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                  <p className="text-[9px] font-extrabold uppercase text-amber-300">Active Food Items</p>
                  <p className="mt-1 text-xl font-black">{availableMenuCount}/{canteenMenu.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                  <p className="text-[9px] font-extrabold uppercase text-emerald-300">Canteen Sales</p>
                  <p className="mt-1 text-xl font-black">৳{canteenSalesTotal.toLocaleString()}</p>
                </div>
              </>
            )}
            {has('gate_security') && (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                  <p className="text-[9px] font-extrabold uppercase text-emerald-300">Gate QR Scans</p>
                  <p className="mt-1 text-xl font-black">{gateScansCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                  <p className="text-[9px] font-extrabold uppercase text-sky-300">Dismissals Logged</p>
                  <p className="mt-1 text-xl font-black">{dismissalLogs.length}</p>
                </div>
              </>
            )}
            {has('library') && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p className="text-[9px] font-extrabold uppercase text-violet-300">Library Books</p>
                <p className="mt-1 text-xl font-black">{libraryBooks.length}</p>
              </div>
            )}
            {has('admissions') && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p className="text-[9px] font-extrabold uppercase text-sky-300">Applicants</p>
                <p className="mt-1 text-xl font-black">{admissions.length}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assigned Responsibility Launchpad */}
      <div className="mt-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">
          Your Assigned Responsibilities ({grantedCards.length} Modules)
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grantedCards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => onNavigate(card.tabId)}
              className="dmhs-card group flex flex-col justify-between p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-400"
            >
              <div>
                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#0f172a] text-emerald-300 transition group-hover:bg-emerald-600 group-hover:text-white">
                  <Icon name={card.icon} size={20} />
                </span>
                <h3 className="mt-4 text-base font-black text-slate-900">{card.label}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{card.desc}</p>
              </div>
              <p className="mt-4 text-xs font-black text-emerald-700">Open Workspace →</p>
            </button>
          ))}
        </div>
      </div>
    </PageShell>
  )
}

// ============================================================================
// 3. DEDICATED CANTEEN POS & LIVE FOOD MENU MANAGER
// ============================================================================
export function CanteenOpsView() {
  const {
    students = [],
    canteenMenu = [],
    canteenWallets = [],
    canteenTransactions = [],
    logQRCardScan,
    addCanteenMenuItem,
    toggleCanteenMenuAvailability,
    updateCanteenMenuItemPrice,
    deleteCanteenMenuItem,
  } = useSchool()

  const [scanInput, setScanInput] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || 'stu-araf')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [posMessage, setPosMessage] = useState<{ ok: boolean; msg: string } | null>(null)
  const [salesDateFilter, setSalesDateFilter] = useState<string>('ALL')

  // Add Menu Item Form
  const [itemName, setItemName] = useState('')
  const [itemCategory, setItemCategory] = useState<CanteenMenuItem['category']>('Meals')
  const [itemPrice, setItemPrice] = useState('100')
  const [itemAllergens, setItemAllergens] = useState('')

  const activeStudent = students.find((s) => s.id === selectedStudentId) || students[0]
  const activeWallet = canteenWallets.find((w) => w.studentId === activeStudent?.id)

  const cartEntries = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = canteenMenu.find((m) => m.id === id)
        return item ? { item, qty } : null
      })
      .filter(Boolean) as { item: CanteenMenuItem; qty: number }[]
  }, [cart, canteenMenu])

  const cartTotal = cartEntries.reduce((sum, e) => sum + e.item.price * e.qty, 0)

  const handleScanLookup = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = scanInput.trim().toUpperCase()
    if (!raw) return
    const matched = students.find(
      (s) =>
        `DMHA-ID-STU-${s.roll}`.toUpperCase() === raw ||
        s.roll.toUpperCase() === raw ||
        s.name.toLowerCase().includes(raw.toLowerCase()),
    )
    if (matched) {
      setSelectedStudentId(matched.id)
      setPosMessage({ ok: true, msg: `Student QR Verified: ${matched.name} (${matched.className} · Roll #${matched.roll})` })
      setScanInput('')
    } else {
      setPosMessage({ ok: false, msg: `No student found for QR/Roll "${raw}".` })
    }
  }

  const handleCheckout = () => {
    if (!activeStudent || cartEntries.length === 0) return
    const summaryLabel = cartEntries
      .map((e) => (e.qty > 1 ? `${e.qty}× ${e.item.name}` : e.item.name))
      .join(', ')
    const res = logQRCardScan({
      cardCode: `DMHA-ID-STU-${activeStudent.roll}`,
      holderId: activeStudent.id,
      holderName: activeStudent.name,
      holderRole: 'student',
      checkpoint: 'Canteen Checkout',
      canteenItem: summaryLabel,
      canteenAmount: cartTotal,
    })
    setPosMessage({ ok: res.ok, msg: res.message })
    if (res.ok) {
      setCart({})
    }
  }

  const handleAddMenu = (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemName.trim()) return
    addCanteenMenuItem({
      name: itemName.trim(),
      category: itemCategory,
      price: Number(itemPrice) || 50,
      allergens: itemAllergens.trim() || undefined,
    })
    setItemName('')
    setItemPrice('100')
    setItemAllergens('')
  }

  return (
    <PageShell
      eyebrow="DMHA Cashless Cafeteria · Student QR POS & Menu Manager"
      title="Canteen POS & Live Food Menu"
      subtitle="Scan any Student Smart QR ID card to deduct purchases directly from their parent-topped wallet, check Allergy Guard alerts, and manage today’s food menu."
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT: CASHLESS QR CHECKOUT POS */}
        <div className="space-y-5">
          <div className="dmhs-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">
                  Cashless QR Counter
                </p>
                <h3 className="text-base font-black text-slate-900">
                  Scan Student Smart Card &amp; Ring Up Order
                </h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-800">
                AUTO-DEDUCT WALLET
              </span>
            </div>

            {/* USB QR Scanner Input + Quick Student Selector */}
            <form onSubmit={handleScanLookup} className="mt-4 flex flex-wrap gap-2">
              <input
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Scan Student QR (e.g. DMHA-ID-STU-14) or Roll #..."
                className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs font-bold outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-black text-emerald-300"
              >
                Lookup QR
              </button>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Roll #{s.roll})
                  </option>
                ))}
              </select>
            </form>

            {/* Active Student Wallet & Allergy Guard Banner */}
            {activeStudent && (
              <div className="mt-4 rounded-2xl bg-[#0f172a] p-4 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                      DMHA-ID-STU-{activeStudent.roll} · {activeStudent.className} {activeStudent.section}
                    </p>
                    <h4 className="mt-0.5 text-lg font-black">{activeStudent.name}</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400">
                      Wallet Balance
                    </p>
                    <p className="text-2xl font-black text-emerald-400">
                      ৳{(activeWallet?.balance ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Daily Limit: ৳{activeWallet?.dailyLimit ?? 250}
                    </p>
                  </div>
                </div>
                {activeWallet?.allergyGuard && (
                  <div className="mt-3 rounded-xl bg-amber-400/15 px-3 py-2 text-xs font-bold text-amber-200 ring-1 ring-amber-400/30">
                    ⚠️ Allergy Guard: {activeWallet.allergyGuard}
                  </div>
                )}
              </div>
            )}

            {/* Tap-to-Add Food Menu Grid */}
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {canteenMenu
                .filter((m) => m.available)
                .map((item) => {
                  const qty = cart[item.id] || 0
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-2 rounded-2xl border p-3 transition ${
                        qty > 0
                          ? 'border-emerald-400 bg-emerald-50/70'
                          : 'border-slate-200/80 bg-slate-50/60'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-[9px] font-black uppercase text-slate-400">
                          {item.category}
                        </span>
                        <p className="truncate text-xs font-black text-slate-900">{item.name}</p>
                        <p className="text-xs font-extrabold text-emerald-700">৳{item.price}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {qty > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setCart((prev) => ({ ...prev, [item.id]: Math.max(0, qty - 1) }))
                            }
                            className="flex size-7 items-center justify-center rounded-lg bg-white text-xs font-black text-slate-700 ring-1 ring-slate-200"
                          >
                            −
                          </button>
                        )}
                        {qty > 0 && (
                          <span className="w-5 text-center text-xs font-black text-slate-900">
                            {qty}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCart((prev) => ({ ...prev, [item.id]: qty + 1 }))}
                          className="flex size-7 items-center justify-center rounded-lg bg-[#0f172a] text-xs font-black text-emerald-300 hover:bg-emerald-600 hover:text-white"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Checkout Action Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase text-slate-400">Order Total</p>
                <p className="text-xl font-black text-slate-900">৳{cartTotal.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                {cartTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart({})}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-600"
                  >
                    Clear Tray
                  </button>
                )}
                <button
                  type="button"
                  disabled={cartTotal <= 0}
                  onClick={handleCheckout}
                  className="rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  Charge ৳{cartTotal} from Student Wallet
                </button>
              </div>
            </div>

            {posMessage && (
              <div
                className={`mt-3 rounded-2xl px-4 py-3 text-xs font-bold ${
                  posMessage.ok
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {posMessage.msg}
              </div>
            )}
          </div>

          {/* Recent Canteen Sales */}
          {(() => {
            const filteredCanteenTx = canteenTransactions.filter((tx) =>
              matchesDateFilter(tx.time, salesDateFilter),
            )
            const filteredSalesTotal = filteredCanteenTx.reduce((s, t) => s + t.amount, 0)
            const savedCanteenDates = Array.from(
              new Set(
                canteenTransactions
                  .map((tx) => extractIsoDate(tx.time))
                  .filter((d): d is string => Boolean(d)),
              ),
            ).sort((a, b) => (a < b ? 1 : -1))
            return (
              <div className="dmhs-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-slate-900">
                    Canteen Wallet Deductions ({filteredCanteenTx.length})
                  </h3>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
                    Sales: ৳{filteredSalesTotal.toLocaleString()}
                  </span>
                </div>
                <div className="mt-3">
                  <DateFilterBar
                    value={salesDateFilter}
                    onChange={setSalesDateFilter}
                    allowAll
                    compact
                    label="Sales Date"
                    savedDates={savedCanteenDates}
                  />
                </div>
                <div className="mt-3 space-y-2">
                  {filteredCanteenTx.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs font-semibold text-slate-400">
                      No canteen transactions recorded for{' '}
                      {salesDateFilter === 'ALL'
                        ? 'this filter'
                        : formatPrettyDate(salesDateFilter)}
                      .
                    </div>
                  ) : (
                    (salesDateFilter === 'ALL'
                      ? filteredCanteenTx.slice(0, 10)
                      : filteredCanteenTx
                    ).map((tx) => {
                      const stu = students.find((s) => s.id === tx.studentId)
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs"
                        >
                          <div>
                            <p className="font-black text-slate-900">
                              {tx.item}{' '}
                              <span className="font-semibold text-slate-400">
                                · {stu?.name || tx.studentId}
                              </span>
                            </p>
                            <p className="text-[10px] font-bold text-slate-400">{tx.time}</p>
                          </div>
                          <span className="font-black text-emerald-700">৳{tx.amount}</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })()}
        </div>

        {/* RIGHT: LIVE CANTEEN MENU MANAGER */}
        <div className="space-y-5">
          <form onSubmit={handleAddMenu} className="dmhs-card p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-amber-700">
              Menu Manager
            </p>
            <h3 className="mt-0.5 text-base font-black text-slate-900">
              + Add New Food / Drink Item
            </h3>
            <div className="mt-4 space-y-3">
              <input
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Food item name (e.g., Grilled Cheese Toast & Juice)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold outline-none focus:border-emerald-500"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={itemCategory}
                  onChange={(e) =>
                    setItemCategory(e.target.value as CanteenMenuItem['category'])
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                >
                  <option value="Meals">Meals</option>
                  <option value="Healthy Bowls">Healthy Bowls</option>
                  <option value="Snacks">Snacks</option>
                  <option value="Drinks">Drinks</option>
                </select>
                <input
                  type="number"
                  min={10}
                  required
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  placeholder="Price (৳)"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black outline-none focus:border-emerald-500"
                />
              </div>
              <input
                value={itemAllergens}
                onChange={(e) => setItemAllergens(e.target.value)}
                placeholder="Allergens (optional, e.g., Dairy, Gluten, Nuts)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="w-full rounded-full bg-[#0f172a] py-2.5 text-xs font-black text-emerald-300 hover:bg-emerald-600 hover:text-white"
              >
                + Add to Canteen Menu
              </button>
            </div>
          </form>

          <div className="dmhs-card p-6">
            <h3 className="text-sm font-black text-slate-900">
              Current Menu Catalog ({canteenMenu.length} Items)
            </h3>
            <div className="mt-3 space-y-2.5">
              {canteenMenu.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase text-slate-600">
                        {item.category}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                          item.available
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {item.available ? 'In Stock' : 'Sold Out'}
                      </span>
                    </div>
                    <p className="mt-1 font-black text-slate-900">{item.name}</p>
                    {item.allergens && (
                      <p className="text-[10px] font-semibold text-amber-700">
                        Allergens: {item.allergens}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateCanteenMenuItemPrice(item.id, item.price + 10)}
                      title="Increase price by ৳10"
                      className="rounded-lg bg-white px-2 py-1 font-black text-slate-800 ring-1 ring-slate-200 hover:bg-emerald-50"
                    >
                      ৳{item.price}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCanteenMenuAvailability(item.id)}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-extrabold text-slate-700"
                    >
                      {item.available ? 'Mark Sold Out' : 'Restock'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCanteenMenuItem(item.id)}
                      className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-extrabold text-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
