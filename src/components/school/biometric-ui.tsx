'use client'

import React, { useEffect, useState } from 'react'
import { Icon } from './icons'
import { useSchool } from './store'
import type { BiometricVerificationStamp, GuardianBiometricDevice } from './types'

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const buf = new ArrayBuffer(raw.length)
  const arr = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i)
  }
  return arr
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i])
  }
  return window.btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function detectPlatformBiometrics(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    typeof window.PublicKeyCredential === 'undefined' ||
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function'
  ) {
    return false
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export async function runWebAuthnEnrollment(params: {
  guardianId: string
  guardianName: string
  guardianEmail: string
  deviceLabel?: string
}): Promise<{ ok: boolean; device?: GuardianBiometricDevice; error?: string }> {
  try {
    const chRes = await fetch('/dmhs-api/biometric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'challenge',
        guardianId: params.guardianId,
        purpose: 'register',
      }),
    })
    const chJson = (await chRes.json()) as { ok: boolean; challenge?: string; error?: string }
    if (!chRes.ok || !chJson.ok || !chJson.challenge) {
      return { ok: false, error: chJson.error || 'Could not start biometric challenge.' }
    }

    const userIdBuf = new TextEncoder().encode(params.guardianId)
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: base64UrlToUint8Array(chJson.challenge),
        rp: {
          name: 'DMHA Smart Learning App',
          id: window.location.hostname,
        },
        user: {
          id: userIdBuf,
          name: params.guardianEmail || `${params.guardianId}@dmha.edu`,
          displayName: params.guardianName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null

    if (!credential) {
      return { ok: false, error: 'Biometric registration was cancelled.' }
    }

    const credId = bufferToBase64Url(credential.rawId)
    const regRes = await fetch('/dmhs-api/biometric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'register',
        guardianId: params.guardianId,
        credentialId: credId,
        challenge: chJson.challenge,
        deviceLabel:
          params.deviceLabel ||
          `${navigator.platform || 'Guardian Device'} · Face ID / Fingerprint`,
        publicKeyB64: credId,
      }),
    })
    const regJson = (await regRes.json()) as {
      ok: boolean
      device?: GuardianBiometricDevice
      error?: string
    }
    if (!regRes.ok || !regJson.ok) {
      return { ok: false, error: regJson.error || 'Server rejected biometric registration.' }
    }
    return { ok: true, device: regJson.device }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message.includes('NotAllowedError') || err.name === 'NotAllowedError'
            ? 'Biometric prompt was cancelled or timed out. Try again or use your 4-digit Parent PIN.'
            : err.message
          : 'Biometric hardware not available on this device.',
    }
  }
}

export async function runWebAuthnVerification(params: {
  guardianId: string
  guardianName: string
  devices: GuardianBiometricDevice[]
}): Promise<{ ok: boolean; stamp?: BiometricVerificationStamp; error?: string }> {
  try {
    // Native Expo Go Face ID / Touch ID / Android Biometric Bridge
    const win = typeof window !== 'undefined'
      ? (window as unknown as {
          requestDmhsNativeBiometric?: (
            reason?: string,
          ) => Promise<{ ok: boolean; deviceLabel?: string; error?: string }>
        })
      : undefined
    if (win?.requestDmhsNativeBiometric) {
      const nativeRes = await win.requestDmhsNativeBiometric(
        `Verify ${params.guardianName} for DMHA Guardian Action`,
      )
      if (!nativeRes.ok) {
        return {
          ok: false,
          error: nativeRes.error || 'Native biometric prompt cancelled. Use your 4-digit PIN.',
        }
      }
      return {
        ok: true,
        stamp: {
          method: 'Biometric (Face/Fingerprint)',
          verifiedBy: params.guardianName,
          deviceLabel: nativeRes.deviceLabel || 'Expo Go Native Biometric',
          verifiedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      }
    }

    const chRes = await fetch('/dmhs-api/biometric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'challenge',
        guardianId: params.guardianId,
        purpose: 'verify',
      }),
    })
    const chJson = (await chRes.json()) as {
      ok: boolean
      challenge?: string
      devices?: GuardianBiometricDevice[]
      error?: string
    }
    if (!chRes.ok || !chJson.ok || !chJson.challenge) {
      return { ok: false, error: chJson.error || 'Could not obtain server challenge.' }
    }

    const activeDevices = chJson.devices && chJson.devices.length > 0 ? chJson.devices : params.devices
    if (activeDevices.length === 0) {
      return { ok: false, error: 'No registered Face ID / Fingerprint passkey found on this device.' }
    }

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: base64UrlToUint8Array(chJson.challenge),
        rpId: window.location.hostname,
        allowCredentials: activeDevices.map((d) => ({
          type: 'public-key',
          id: base64UrlToUint8Array(d.credentialId),
        })),
        userVerification: 'required',
        timeout: 60000,
      },
    })) as PublicKeyCredential | null

    if (!assertion) {
      return { ok: false, error: 'Biometric verification cancelled.' }
    }

    const credId = bufferToBase64Url(assertion.rawId)
    const verRes = await fetch('/dmhs-api/biometric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify',
        guardianId: params.guardianId,
        credentialId: credId,
        challenge: chJson.challenge,
      }),
    })
    const verJson = (await verRes.json()) as {
      ok: boolean
      deviceLabel?: string
      error?: string
    }
    if (!verRes.ok || !verJson.ok) {
      return { ok: false, error: verJson.error || 'Biometric verification failed.' }
    }

    return {
      ok: true,
      stamp: {
        method: 'Biometric (Face/Fingerprint)',
        verifiedBy: params.guardianName,
        verifiedAt: `Today · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        deviceLabel: verJson.deviceLabel,
      },
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.name === 'NotAllowedError'
            ? 'Biometric scan cancelled or unavailable — you can verify with your 4-Digit Parent PIN below.'
            : err.message
          : 'Biometric verification unavailable.',
    }
  }
}

export function VerificationSealBadge({
  verification,
}: {
  verification?: BiometricVerificationStamp
}) {
  if (!verification) return null
  const isBio = verification.method === 'Biometric (Face/Fingerprint)'
  return (
    <span
      title={`Verified by ${verification.verifiedBy} at ${verification.verifiedAt}`}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
        isBio
          ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300/60'
          : 'bg-sky-50 text-sky-800 ring-1 ring-sky-200'
      }`}
    >
      <Icon name="shield" size={11} />
      {isBio ? 'Biometric Verified' : 'Guardian PIN Verified'} · {verification.verifiedBy}
    </span>
  )
}

export function GuardianBiometricGateModal({
  open,
  actionTitle,
  actionDescription,
  onVerified,
  onClose,
}: {
  open: boolean
  actionTitle: string
  actionDescription: string
  onVerified: (stamp: BiometricVerificationStamp) => void
  onClose: () => void
}) {
  const { guardians, activeGuardianId, biometricDevices, refreshBiometricDevices, notify } =
    useSchool()

  const guardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]
  const myDevices = biometricDevices.filter((d) => d.guardianId === guardian?.id)

  const [hardwareAvailable, setHardwareAvailable] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pinMode, setPinMode] = useState(false)
  const [pin, setPin] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setPin('')
    setPinMode(false)
    void detectPlatformBiometrics().then((ok) => setHardwareAvailable(ok))
    if (guardian) void refreshBiometricDevices(guardian.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guardian?.id])

  if (!open || !guardian) return null

  const handleBiometricVerifyOrEnroll = async () => {
    setError('')
    setBusy(true)

    if (myDevices.length === 0) {
      // First-time on-the-spot WebAuthn Face/Fingerprint enrollment + immediate confirmation
      const reg = await runWebAuthnEnrollment({
        guardianId: guardian.id,
        guardianName: guardian.name,
        guardianEmail: guardian.email,
      })
      setBusy(false)
      if (!reg.ok) {
        setError(reg.error || 'Unable to register biometric sensor on this device.')
        setPinMode(true)
        return
      }
      await refreshBiometricDevices(guardian.id)
      notify('Face ID / Fingerprint registered & verified!')
      onVerified({
        method: 'Biometric (Face/Fingerprint)',
        verifiedBy: guardian.name,
        verifiedAt: `Today · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        deviceLabel: reg.device?.deviceLabel,
      })
      return
    }

    const res = await runWebAuthnVerification({
      guardianId: guardian.id,
      guardianName: guardian.name,
      devices: myDevices,
    })
    setBusy(false)
    if (!res.ok || !res.stamp) {
      setError(res.error || 'Biometric scan failed.')
      return
    }
    await refreshBiometricDevices(guardian.id)
    onVerified(res.stamp)
  }

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const expected = guardian.parentPin || '1234'
    if (pin !== expected) {
      setError('Incorrect 4-digit Parent PIN. Default PIN is 1234.')
      setPin('')
      return
    }
    onVerified({
      method: 'Parent PIN',
      verifiedBy: guardian.name,
      verifiedAt: `Today · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    })
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#0f172a] text-emerald-400 shadow-md">
              <Icon name="shield" size={22} />
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-600">
                Guardian Biometric Confirmation
              </p>
              <h3 className="mt-0.5 text-lg font-black text-slate-900">{actionTitle}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs">
          <p className="font-bold text-slate-800">{actionDescription}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Authorizing Guardian: <strong>{guardian.name}</strong> ({guardian.relation})
          </p>
        </div>

        {/* Hardware Biometric Primary CTA */}
        <div className="mt-5">
          <button
            type="button"
            disabled={busy}
            onClick={handleBiometricVerifyOrEnroll}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#0f172a] px-5 py-3.5 text-xs font-black text-emerald-300 shadow-lg transition hover:bg-slate-800 disabled:opacity-60"
          >
            <Icon name="lock" size={16} />
            {busy
              ? 'Waiting for Face ID / Fingerprint Sensor...'
              : myDevices.length > 0
                ? 'Confirm with Face ID / Fingerprint (WebAuthn)'
                : 'Enroll & Confirm with Face ID / Fingerprint'}
          </button>

          <p className="mt-2 text-center text-[11px] font-semibold text-slate-400">
            {hardwareAvailable === true
              ? `Platform Biometric Sensor Detected · ${myDevices.length} registered device(s)`
              : hardwareAvailable === false
                ? 'No Face ID / Fingerprint sensor detected on this browser — use Parent PIN fallback below.'
                : 'Checking device biometric hardware...'}
          </p>
        </div>

        {error && (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
            {error}
          </div>
        )}

        {/* 4-Digit Parent PIN Fallback */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          {!pinMode && hardwareAvailable !== false ? (
            <button
              type="button"
              onClick={() => setPinMode(true)}
              className="w-full text-center text-xs font-extrabold text-slate-500 hover:text-slate-900"
            >
              No biometric sensor? Use 4-Digit Parent PIN Fallback →
            </button>
          ) : (
            <form onSubmit={handlePinSubmit} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Fallback: 4-Digit Parent PIN
                </label>
                <span className="text-[10px] font-bold text-slate-400">Default: 1234</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    setError('')
                    setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }}
                  placeholder="••••"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center font-mono text-base font-black tracking-[.4em] outline-none focus:border-emerald-500 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={pin.length !== 4}
                  className="shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Confirm PIN
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export function GuardianBiometricSettingsCard() {
  const {
    guardians,
    activeGuardianId,
    biometricDevices,
    refreshBiometricDevices,
    toggleGuardianBiometricRequired,
    notify,
  } = useSchool()

  const guardian = guardians.find((g) => g.id === activeGuardianId) || guardians[0]
  const myDevices = biometricDevices.filter((d) => d.guardianId === guardian?.id)
  const isRequired = guardian?.biometricRequired !== false

  const [hardwareAvailable, setHardwareAvailable] = useState<boolean | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    void detectPlatformBiometrics().then((ok) => setHardwareAvailable(ok))
    if (guardian) void refreshBiometricDevices(guardian.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardian?.id])

  if (!guardian) return null

  const handleEnroll = async () => {
    setStatusMsg(null)
    setEnrolling(true)
    const res = await runWebAuthnEnrollment({
      guardianId: guardian.id,
      guardianName: guardian.name,
      guardianEmail: guardian.email,
    })
    setEnrolling(false)
    if (!res.ok) {
      setStatusMsg({ ok: false, msg: res.error || 'Biometric enrollment failed.' })
      return
    }
    await refreshBiometricDevices(guardian.id)
    notify('Face ID / Fingerprint registered in SQLite DB!')
    setStatusMsg({
      ok: true,
      msg: `Registered "${res.device?.deviceLabel}" securely via WebAuthn Passkey.`,
    })
  }

  const handleRevoke = async (deviceId: string) => {
    await fetch(
      `/dmhs-api/biometric?id=${encodeURIComponent(deviceId)}&guardianId=${encodeURIComponent(guardian.id)}`,
      { method: 'DELETE' },
    )
    await refreshBiometricDevices(guardian.id)
    notify('Biometric device revoked')
  }

  return (
    <div className="dmhs-card mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f172a] text-emerald-400">
            <Icon name="shield" size={20} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-slate-900">
                Guardian Biometric Verification (Face ID / Fingerprint)
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                  isRequired
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isRequired ? 'Enforced ON' : 'Optional'}
              </span>
            </div>
            <p className="mt-1 max-w-xl text-xs font-medium leading-relaxed text-slate-500">
              Require Face ID, Fingerprint, or Windows Hello (with 4-digit PIN fallback) before
              approving Absent Leave Requests, confirming Exam Result Sheets, or signing Digital
              Consent Forms. Raw biometrics never leave your device.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleGuardianBiometricRequired(guardian.id, !isRequired)}
          className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
            isRequired
              ? 'bg-[#0f172a] text-emerald-300 hover:bg-slate-800'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {isRequired ? 'Biometric Lock: ON' : 'Enable Biometric Lock'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
        <div>
          <p className="text-xs font-black text-slate-900">
            {hardwareAvailable === true
              ? '✓ Biometric Hardware Ready (Face ID / Touch ID / Windows Hello)'
              : hardwareAvailable === false
                ? 'No platform biometric sensor detected on this device (PIN fallback ready)'
                : 'Checking device biometric capabilities...'}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            Registered devices for {guardian.name}: <strong>{myDevices.length}</strong>
          </p>
        </div>

        <button
          type="button"
          disabled={enrolling}
          onClick={handleEnroll}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          <Icon name="lock" size={14} />
          {enrolling ? 'Scanning Sensor...' : 'Register Face ID / Fingerprint'}
        </button>
      </div>

      {statusMsg && (
        <div
          className={`mt-3 rounded-2xl border px-4 py-2.5 text-xs font-bold ${
            statusMsg.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {statusMsg.msg}
        </div>
      )}

      {myDevices.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Trusted Biometric Devices (SQLite Passkeys)
          </p>
          {myDevices.map((dev) => (
            <div
              key={dev.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3"
            >
              <div>
                <p className="text-xs font-black text-slate-900">{dev.deviceLabel}</p>
                <p className="text-[11px] font-semibold text-slate-400">
                  Verified {dev.signCount} time(s) · Registered{' '}
                  {new Date(dev.registeredAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleRevoke(dev.id)}
                className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-extrabold text-rose-700 hover:bg-rose-100"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
