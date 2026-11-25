'use client'

import React, { useState } from 'react'
import { DMHS_CLASSES } from './data'
import { Icon } from './icons'
import { useSchool } from './store'
import type { GuardianRecord, HouseName, StudentRecord, TeacherRecord } from './types'

export type EditableEntity =
  | { kind: 'student'; record: StudentRecord }
  | { kind: 'guardian'; record: GuardianRecord }
  | { kind: 'teacher'; record: TeacherRecord }

export function AdminEditProfilePasswordModal({
  target,
  onClose,
}: {
  target: EditableEntity
  onClose: () => void
}) {
  const {
    guardians,
    campusUnits,
    authAccounts,
    updateStudentProfile,
    updateGuardianProfile,
    updateTeacherProfile,
  } = useSchool()

  const authAcc = authAccounts.find(
    (a) => a.linkedEntityId === target.record.id && a.role === target.kind,
  )

  // Shared editable fields
  const [name, setName] = useState(target.record.name)
  const [email, setEmail] = useState(
    target.kind === 'student'
      ? authAcc?.email || ''
      : target.record.email || authAcc?.email || '',
  )
  const [phone, setPhone] = useState(
    target.kind === 'student' ? target.record.guardianPhone : target.record.phone,
  )

  // Student-specific
  const [className, setClassName] = useState(
    target.kind === 'student' ? target.record.className : 'Class 6',
  )
  const [section, setSection] = useState(
    target.kind === 'student' ? target.record.section : 'Section A',
  )
  const [roll, setRoll] = useState(target.kind === 'student' ? target.record.roll : '')
  const [house, setHouse] = useState<HouseName>(
    target.kind === 'student' ? target.record.house || 'Emerald' : 'Emerald',
  )
  const [bloodGroup, setBloodGroup] = useState(
    target.kind === 'student' ? target.record.bloodGroup : 'O+',
  )
  const [busRoute, setBusRoute] = useState(
    target.kind === 'student' ? target.record.busRoute || 'Unit - 1' : 'Unit - 1',
  )
  const [guardianId, setGuardianId] = useState(
    target.kind === 'student' ? target.record.guardianId || guardians[0]?.id || '' : '',
  )

  // Guardian-specific
  const [relation, setRelation] = useState(
    target.kind === 'guardian' ? target.record.relation : 'Father',
  )
  const [sharedDeviceMode, setSharedDeviceMode] = useState(
    target.kind === 'guardian' ? target.record.sharedDeviceMode !== false : true,
  )
  const [parentPin, setParentPin] = useState(
    target.kind === 'guardian' ? target.record.parentPin || '1234' : '1234',
  )

  // Teacher-specific
  const [subject, setSubject] = useState(
    target.kind === 'teacher' ? target.record.subject : '',
  )
  const [department, setDepartment] = useState(
    target.kind === 'teacher' ? target.record.department : '',
  )
  const [classesText, setClassesText] = useState(
    target.kind === 'teacher' ? target.record.assignedClasses.join(', ') : '',
  )

  // Admin Forgotten Password Reset field
  const [newPassword, setNewPassword] = useState('')
  const [copiedPass, setCopiedPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const generateTempPassword = () => {
    const code = `DMHA-${Math.floor(1000 + Math.random() * 9000)}`
    setNewPassword(code)
    setCopiedPass(false)
  }

  const handleCopyPassword = async () => {
    if (!newPassword) return
    try {
      await navigator.clipboard.writeText(newPassword)
      setCopiedPass(true)
      window.setTimeout(() => setCopiedPass(false), 2000)
    } catch {
      // ignore clipboard restrictions
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Full name is required.')
      return
    }
    if (newPassword.trim() && newPassword.trim().length < 6) {
      setError('New password must be at least 6 characters long.')
      return
    }

    setSaving(true)
    let res: { ok: boolean; error?: string } = { ok: true }

    if (target.kind === 'student') {
      res = await updateStudentProfile(
        target.record.id,
        {
          name,
          className,
          section,
          roll,
          house,
          bloodGroup,
          busRoute,
          guardianId: guardianId || undefined,
        },
        newPassword.trim() || undefined,
        email.trim() || undefined,
      )
    } else if (target.kind === 'guardian') {
      res = await updateGuardianProfile(
        target.record.id,
        {
          name,
          relation,
          phone,
          email,
          sharedDeviceMode,
          parentPin: /^\d{4}$/.test(parentPin) ? parentPin : '1234',
        },
        newPassword.trim() || undefined,
      )
    } else {
      const assignedClasses = classesText
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
      res = await updateTeacherProfile(
        target.record.id,
        {
          name,
          email,
          phone,
          subject,
          department,
          assignedClasses: assignedClasses.length > 0 ? assignedClasses : target.record.assignedClasses,
        },
        newPassword.trim() || undefined,
      )
    }

    setSaving(false)
    if (!res.ok) {
      setError(res.error || 'Unable to save profile changes.')
      return
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-600">
              Admin Profile &amp; Password Control · {target.kind}
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-900">
              Edit {target.record.name}
            </h3>
            {authAcc && (
              <p className="mt-0.5 font-mono text-[11px] font-bold text-slate-400">
                Login ID: {authAcc.loginCode} · {authAcc.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          {/* Core Identity Fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">Full Name *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">
                Login Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@dmha.edu"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {target.kind === 'student' && (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">Class</label>
                  <select
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-bold"
                  >
                    {DMHS_CLASSES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">Section</label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-bold"
                  >
                    <option>Section A</option>
                    <option>Section B</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">Roll #</label>
                  <input
                    value={roll}
                    onChange={(e) => setRoll(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">House</label>
                  <select
                    value={house}
                    onChange={(e) => setHouse(e.target.value as HouseName)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                  >
                    <option value="Emerald">Emerald House</option>
                    <option value="Sapphire">Sapphire House</option>
                    <option value="Crimson">Crimson House</option>
                    <option value="Gold">Gold House</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Blood Group
                  </label>
                  <input
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Linked Guardian
                  </label>
                  <select
                    value={guardianId}
                    onChange={(e) => setGuardianId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                  >
                    {guardians.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.relation})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Campus Unit
                  </label>
                  <select
                    value={busRoute}
                    onChange={(e) => setBusRoute(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                  >
                    {campusUnits.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {target.kind === 'guardian' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Relationship
                  </label>
                  <input
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Phone Number
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={sharedDeviceMode}
                    onChange={(e) => setSharedDeviceMode(e.target.checked)}
                  />
                  Merged Family Mode (Shared Phone)
                </label>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    4-Digit Parent Exit PIN
                  </label>
                  <input
                    maxLength={4}
                    value={parentPin}
                    onChange={(e) => setParentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs font-black tracking-[.25em] outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {target.kind === 'teacher' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">Subject</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Department
                  </label>
                  <input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">Phone</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Assigned Classes
                  </label>
                  <input
                    value={classesText}
                    onChange={(e) => setClassesText(e.target.value)}
                    placeholder="Class 5A, Class 6A"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* Reset Forgotten Password Section */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon name="key" size={16} className="text-amber-700" />
                <p className="text-xs font-black text-amber-950">
                  Reset Forgotten Password (Admin Override)
                </p>
              </div>
              <button
                type="button"
                onClick={generateTempPassword}
                className="rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-amber-800 shadow-2xs hover:bg-amber-100"
              >
                Generate Temp Password
              </button>
            </div>
            <p className="mt-1 text-[11px] text-amber-900/75">
              Leave blank to keep their current password. Type a new password (min 6 chars) to reset
              it immediately in SQLite DB.
            </p>
            <div className="mt-2.5 flex gap-2">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (optional)"
                className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3.5 py-2 font-mono text-xs font-black text-slate-900 outline-none focus:border-emerald-500"
              />
              {newPassword && (
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="shrink-0 rounded-xl bg-[#0f172a] px-3 py-2 text-[11px] font-extrabold text-emerald-300"
                >
                  {copiedPass ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-100 px-4 py-2.5 text-xs font-extrabold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-black text-emerald-300 shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {saving
                ? 'Saving to SQLite...'
                : newPassword.trim()
                  ? 'Save Profile & Reset Password'
                  : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
