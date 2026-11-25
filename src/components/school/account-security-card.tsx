'use client'

import React, { useState } from 'react'
import { Icon } from './icons'
import { useSchool } from './store'

export function AccountSecuritySettingsCard() {
  const {
    role,
    authUser,
    authAccounts,
    teachers,
    guardians,
    students,
    activeTeacherId,
    activeGuardianId,
    activeStudentId,
    activeStaffMember,
    changeOwnPassword,
    updateTeacherProfile,
    updateGuardianProfile,
  } = useSchool()

  const activeTeacher = teachers.find((t) => t.id === activeTeacherId) || teachers[0]
  const activeGuardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]
  const activeStudent = students.find((s) => s.id === activeStudentId) || students[0]

  const currentLinkedId =
    role === 'teacher'
      ? activeTeacher?.id
      : role === 'guardian'
        ? activeGuardian?.id
        : role === 'student'
          ? activeStudent?.id
          : role === 'staff'
            ? activeStaffMember?.id
            : 'admin-shahid'

  const matchedAccount =
    authAccounts.find((a) => a.linkedEntityId === currentLinkedId && a.role === role) ||
    authAccounts.find((a) => a.role === role)

  // Change own password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null,
  )

  // Quick self-profile edit for Guardian & Teacher
  const [editingContact, setEditingContact] = useState(false)
  const [contactPhone, setContactPhone] = useState(
    role === 'teacher' ? activeTeacher?.phone || '' : activeGuardian?.phone || '',
  )
  const [contactEmail, setContactEmail] = useState(
    role === 'teacher' ? activeTeacher?.email || '' : activeGuardian?.email || '',
  )

  const strength =
    newPassword.length >= 10 && /[0-9]/.test(newPassword) && /[A-Za-z]/.test(newPassword)
      ? { label: 'Strong', color: 'text-emerald-700 bg-emerald-50' }
      : newPassword.length >= 6
        ? { label: 'Good', color: 'text-sky-700 bg-sky-50' }
        : newPassword.length > 0
          ? { label: 'Too short (min 6)', color: 'text-rose-700 bg-rose-50' }
          : null

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordFeedback(null)

    if (newPassword.length < 6) {
      setPasswordFeedback({ ok: false, msg: 'New password must be at least 6 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ ok: false, msg: 'New password and confirmation do not match.' })
      return
    }

    setSavingPassword(true)
    const res = await changeOwnPassword({ currentPassword, newPassword })
    setSavingPassword(false)

    if (!res.ok) {
      setPasswordFeedback({ ok: false, msg: res.error || 'Could not update password.' })
      return
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordFeedback({
      ok: true,
      msg: `Password updated securely in SQLite DB for ${matchedAccount?.email || authUser?.email || role}. Use your new password on next sign-in.`,
    })
  }

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (role === 'teacher' && activeTeacher) {
      await updateTeacherProfile(activeTeacher.id, {
        phone: contactPhone,
        email: contactEmail,
      })
    } else if (role === 'guardian' && activeGuardian) {
      await updateGuardianProfile(activeGuardian.id, {
        phone: contactPhone,
        email: contactEmail,
      })
    }
    setEditingContact(false)
  }

  return (
    <div className="dmhs-card mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f172a] text-emerald-400">
            <Icon name="key" size={19} />
          </span>
          <div>
            <h3 className="text-sm font-black text-slate-900">
              Account Settings &amp; Change Password
            </h3>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              Update your own DMHA login password anytime. Encrypted with salted scrypt in SQLite.
            </p>
          </div>
        </div>

        {matchedAccount && (
          <div className="rounded-2xl bg-slate-50 px-3.5 py-2 text-right">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Login Account
            </p>
            <p className="font-mono text-xs font-black text-slate-800">{matchedAccount.email}</p>
            <p className="font-mono text-[10px] font-bold text-emerald-700">
              ID: {matchedAccount.loginCode}
            </p>
          </div>
        )}
      </div>

      {/* Guardian / Teacher Editable Contact Details */}
      {(role === 'guardian' || role === 'teacher') && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              My Contact Info ({role === 'teacher' ? 'Faculty Profile' : 'Guardian Profile'})
            </p>
            {!editingContact && (
              <button
                type="button"
                onClick={() => {
                  setContactPhone(
                    role === 'teacher' ? activeTeacher?.phone || '' : activeGuardian?.phone || '',
                  )
                  setContactEmail(
                    role === 'teacher' ? activeTeacher?.email || '' : activeGuardian?.email || '',
                  )
                  setEditingContact(true)
                }}
                className="text-xs font-extrabold text-emerald-700 hover:underline"
              >
                Edit Contact
              </button>
            )}
          </div>

          {editingContact ? (
            <form onSubmit={handleSaveContact} className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Phone number"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
              />
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Email address"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300"
                >
                  Save Contact
                </button>
                <button
                  type="button"
                  onClick={() => setEditingContact(false)}
                  className="rounded-xl bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-1.5 text-xs font-bold text-slate-700">
              Phone: {role === 'teacher' ? activeTeacher?.phone : activeGuardian?.phone} · Email:{' '}
              {role === 'teacher' ? activeTeacher?.email : activeGuardian?.email}
            </p>
          )}
        </div>
      )}

      {/* Self-Service Change Password Form */}
      <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">
              Current Password *
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="e.g., dmha2026"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600">New Password *</label>
              {strength && (
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${strength.color}`}>
                  {strength.label}
                </span>
              )}
            </div>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">
              Confirm New Password *
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {passwordFeedback && (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs font-bold ${
              passwordFeedback.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {passwordFeedback.msg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-500">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show passwords
          </label>

          <button
            type="submit"
            disabled={savingPassword}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Icon name="lock" size={14} />
            {savingPassword ? 'Updating Password...' : 'Update My Password'}
          </button>
        </div>
      </form>
    </div>
  )
}
