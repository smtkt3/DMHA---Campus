'use client'

import React, { useEffect, useState } from 'react'
import { runWebAuthnVerification } from './biometric-ui'
import { Icon } from './icons'
import { useSchool } from './store'

export function ParentPinUnlockModal({
  open,
  guardianName,
  studentName,
  onVerify,
  onClose,
}: {
  open: boolean
  guardianName: string
  studentName: string
  onVerify: (pin: string) => boolean
  onClose: () => void
}) {
  const { guardians, activeGuardianId, biometricDevices, forceExitFamilyChildMode, setRole, notify } =
    useSchool()
  const activeGuardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]
  const myBioDevices = biometricDevices.filter((d) => d.guardianId === activeGuardian?.id)

  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [bioScanning, setBioScanning] = useState(false)

  const handleBiometricUnlock = async () => {
    if (!activeGuardian) return
    setError('')
    setBioScanning(true)
    const res = await runWebAuthnVerification({
      guardianId: activeGuardian.id,
      guardianName: activeGuardian.name,
      devices: myBioDevices,
    })
    setBioScanning(false)
    if (!res.ok) {
      setError(res.error || 'Biometric scan failed — use your 4-digit Parent PIN below.')
      return
    }
    forceExitFamilyChildMode()
    setRole('guardian')
    notify(`Biometric unlocked! Welcome back, ${activeGuardian.name}`)
    onClose()
  }

  useEffect(() => {
    if (open) {
      setPin('')
      setError('')
    }
  }, [open])

  const submitPin = (candidate: string) => {
    const ok = onVerify(candidate)
    if (ok) {
      setPin('')
      setError('')
      onClose()
    } else {
      setError('Incorrect 4-digit Parent PIN. Please try again.')
      setPin('')
    }
  }

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return
    setError('')
    const next = pin + d
    setPin(next)
    if (next.length === 4) {
      window.setTimeout(() => submitPin(next), 120)
    }
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pin])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-2xl sm:p-7"
      >
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#0f172a] text-emerald-400 shadow-lg">
          <Icon name="lock" size={24} />
        </div>

        <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-600">
          Parent Security Guardrail
        </p>
        <h3 className="mt-1 text-xl font-black text-slate-900">Return to Parent Portal</h3>
        <p className="mt-1 text-xs font-medium text-slate-500">
          Enter <strong>{guardianName}</strong>’s 4-digit PIN to exit{' '}
          <strong>{studentName}</strong>’s Study Mode.
        </p>

        {myBioDevices.length > 0 && (
          <button
            type="button"
            disabled={bioScanning}
            onClick={handleBiometricUnlock}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            <Icon name="shield" size={14} />
            {bioScanning ? 'Scanning Face ID / Fingerprint...' : 'Unlock with Face ID / Fingerprint'}
          </button>
        )}

        {/* 4 Masked PIN Dots */}
        <div className="mt-6 flex items-center justify-center gap-3">
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < pin.length
            return (
              <span
                key={idx}
                className={`flex size-12 items-center justify-center rounded-2xl border-2 text-lg font-black transition ${
                  filled
                    ? 'border-emerald-500 bg-emerald-50 text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-300'
                }`}
              >
                {filled ? '●' : ''}
              </span>
            )
          })}
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
            {error}
          </p>
        )}

        {/* Touch & Mouse Friendly Keypad */}
        <div className="mt-6 grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-base font-black text-slate-900 shadow-2xs transition hover:border-emerald-400 hover:bg-emerald-50/50 active:scale-95"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            className="flex h-12 items-center justify-center rounded-2xl bg-slate-100 text-xs font-extrabold text-slate-500 hover:bg-slate-200"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-base font-black text-slate-900 shadow-2xs transition hover:border-emerald-400 hover:bg-emerald-50/50 active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setPin((prev) => prev.slice(0, -1))}
            className="flex h-12 items-center justify-center rounded-2xl bg-slate-100 text-xs font-extrabold text-slate-600 hover:bg-slate-200"
          >
            ⌫
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-[11px] font-semibold text-slate-400">
          <span>
            Default PIN: <strong className="font-mono text-slate-600">1234</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-extrabold text-slate-600 hover:text-slate-900"
          >
            Stay in Study Mode
          </button>
        </div>
      </div>
    </div>
  )
}

export function FamilyModeSettingsCard() {
  const {
    guardians,
    students,
    activeGuardianId,
    selectedChildId,
    toggleGuardianSharedMode,
    updateGuardianParentPin,
    enterFamilyChildMode,
  } = useSchool()

  const activeGuardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]
  const myChildren = students.filter((s) =>
    activeGuardian ? activeGuardian.linkedStudentIds.includes(s.id) : false,
  )
  const targetChild =
    myChildren.find((c) => c.id === selectedChildId) || myChildren[0] || students[0]

  const isEnabled = activeGuardian?.sharedDeviceMode !== false
  const currentPin = activeGuardian?.parentPin || '1234'

  const [pinDraft, setPinDraft] = useState(currentPin)
  const [editingPin, setEditingPin] = useState(false)

  if (!activeGuardian) return null

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{4}$/.test(pinDraft)) return
    updateGuardianParentPin(activeGuardian.id, pinDraft)
    setEditingPin(false)
  }

  return (
    <div className="dmhs-card mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Icon name="shield" size={20} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-slate-900">
                Merged Guardian + Student Mode (Shared Phone)
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                  isEnabled
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isEnabled ? 'Merged ON' : 'Separate Logins'}
              </span>
            </div>
            <p className="mt-1 max-w-xl text-xs font-medium leading-relaxed text-slate-500">
              Students without personal phones can use your device in a child-safe Study Workspace
              (Quizzes, Subjects, Homework, Exam Sheets &amp; QR ID). Fees, Consent Forms, Leave
              &amp; Chats stay locked behind your 4-digit Parent PIN.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleGuardianSharedMode(activeGuardian.id, !isEnabled)}
          className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
            isEnabled
              ? 'bg-[#0f172a] text-emerald-300 hover:bg-slate-800'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {isEnabled ? 'Disable Shared Mode' : 'Enable Shared Mode'}
        </button>
      </div>

      {isEnabled && (
        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          {/* PIN Manager */}
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                4-Digit Parent Exit PIN
              </span>
              {!editingPin && (
                <button
                  type="button"
                  onClick={() => {
                    setPinDraft(currentPin)
                    setEditingPin(true)
                  }}
                  className="text-[11px] font-extrabold text-emerald-700 hover:underline"
                >
                  Change PIN
                </button>
              )}
            </div>
            {editingPin ? (
              <form onSubmit={handleSavePin} className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="4 digits"
                  className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm font-black tracking-[.3em] outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={pinDraft.length !== 4}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPin(false)}
                  className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <p className="mt-1.5 font-mono text-lg font-black tracking-[.28em] text-slate-900">
                {currentPin}
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-400">
              Required to exit Child Study Mode back to Parent Controls.
            </p>
          </div>

          {/* 1-Tap Launch Study Mode */}
          <div className="flex flex-col justify-between rounded-2xl bg-[#0f172a] p-4 text-white">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                Ready to Hand Over Device
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Launch <strong>{targetChild?.name}</strong>’s distraction-free Study Workspace
                without logging out.
              </p>
            </div>
            {targetChild && (
              <button
                type="button"
                onClick={() => enterFamilyChildMode(targetChild.id)}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-300"
              >
                <Icon name="book" size={14} />
                Hand Phone to {targetChild.name.split(' ')[0]} (Study Mode)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
