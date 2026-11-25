'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './icons'
import type { NotificationItem } from './types'

export type NotificationSoundPreset = 'chime' | 'bell' | 'pop'

export interface NotificationSoundPrefs {
  enabled: boolean
  preset: NotificationSoundPreset
  browserPush: boolean
}

const PREFS_STORAGE_KEY = 'dmhs_notif_sound_prefs_v1'
const CUSTOM_FLOAT_EVENT = 'dmhs:floating-notification'

let sharedAudioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx()
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => {})
  }
  return sharedAudioCtx
}

/** Unlock Web Audio cleanly on first user interaction so chimes always play reliably */
export function primeNotificationAudio(): void {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => {})
  }
}

/**
 * Play a crisp, pleasant synthesized Web Audio notification sound
 * tailored to the alert category and selected tone preset.
 */
export function playNotificationSound(
  type: NotificationItem['type'] = 'notice',
  preset: NotificationSoundPreset = 'chime',
): boolean {
  try {
    const ctx = getAudioContext()
    if (!ctx) return false
    const now = ctx.currentTime + 0.01

    type NoteSpec = { freq: number; start: number; dur: number; gain: number; wave: OscillatorType }
    let notes: NoteSpec[]

    if (preset === 'pop') {
      notes =
        type === 'attendance' || type === 'health' || type === 'pickup'
          ? [
              { freq: 660, start: 0, dur: 0.11, gain: 0.18, wave: 'triangle' },
              { freq: 880, start: 0.11, dur: 0.14, gain: 0.18, wave: 'triangle' },
            ]
          : [
              { freq: 523.25, start: 0, dur: 0.09, gain: 0.16, wave: 'sine' },
              { freq: 783.99, start: 0.08, dur: 0.14, gain: 0.17, wave: 'sine' },
            ]
    } else if (preset === 'bell') {
      notes =
        type === 'result' || type === 'merit'
          ? [
              { freq: 783.99, start: 0, dur: 0.22, gain: 0.16, wave: 'sine' },
              { freq: 1046.5, start: 0.12, dur: 0.36, gain: 0.18, wave: 'sine' },
              { freq: 1318.51, start: 0.24, dur: 0.45, gain: 0.14, wave: 'sine' },
            ]
          : [
              { freq: 987.77, start: 0, dur: 0.24, gain: 0.15, wave: 'sine' },
              { freq: 1318.51, start: 0.14, dur: 0.42, gain: 0.16, wave: 'sine' },
            ]
    } else {
      // Default 'chime': category-aware warm musical chimes
      if (type === 'result' || type === 'merit') {
        notes = [
          { freq: 523.25, start: 0, dur: 0.16, gain: 0.15, wave: 'sine' },
          { freq: 659.25, start: 0.1, dur: 0.18, gain: 0.16, wave: 'sine' },
          { freq: 783.99, start: 0.2, dur: 0.34, gain: 0.17, wave: 'triangle' },
        ]
      } else if (type === 'attendance' || type === 'health' || type === 'pickup') {
        notes = [
          { freq: 880, start: 0, dur: 0.14, gain: 0.17, wave: 'triangle' },
          { freq: 659.25, start: 0.13, dur: 0.14, gain: 0.15, wave: 'triangle' },
          { freq: 880, start: 0.26, dur: 0.24, gain: 0.17, wave: 'sine' },
        ]
      } else if (type === 'fee') {
        notes = [
          { freq: 783.99, start: 0, dur: 0.14, gain: 0.15, wave: 'sine' },
          { freq: 1174.66, start: 0.11, dur: 0.32, gain: 0.16, wave: 'sine' },
        ]
      } else {
        notes = [
          { freq: 659.25, start: 0, dur: 0.15, gain: 0.15, wave: 'sine' },
          { freq: 880, start: 0.12, dur: 0.28, gain: 0.16, wave: 'sine' },
        ]
      }
    }

    for (const n of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = n.wave
      osc.frequency.setValueAtTime(n.freq, now + n.start)

      gain.gain.setValueAtTime(0.0001, now + n.start)
      gain.gain.exponentialRampToValueAtTime(n.gain, now + n.start + 0.018)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + n.start)
      osc.stop(now + n.start + n.dur + 0.02)
    }
    return true
  } catch {
    return false
  }
}

export function loadSoundPrefs(): NotificationSoundPrefs {
  if (typeof window === 'undefined') {
    return { enabled: true, preset: 'chime', browserPush: false }
  }
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY)
    if (!raw) return { enabled: true, preset: 'chime', browserPush: false }
    const parsed = JSON.parse(raw) as Partial<NotificationSoundPrefs>
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      preset:
        parsed.preset === 'bell' || parsed.preset === 'pop' || parsed.preset === 'chime'
          ? parsed.preset
          : 'chime',
      browserPush: Boolean(parsed.browserPush),
    }
  } catch {
    return { enabled: true, preset: 'chime', browserPush: false }
  }
}

export function saveSoundPrefs(prefs: NotificationSoundPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore storage errors
  }
}

/** Dispatch an immediate floating notification banner + sound from anywhere in the app */
export function dispatchFloatingNotification(item: Omit<NotificationItem, 'id' | 'time' | 'read'> & { id?: string; time?: string }) {
  if (typeof window === 'undefined') return
  const full: NotificationItem = {
    id: item.id || `flt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: item.title,
    text: item.text,
    time: item.time || 'Just now',
    type: item.type,
    forRoles: item.forRoles,
    read: false,
  }
  window.dispatchEvent(new CustomEvent<NotificationItem>(CUSTOM_FLOAT_EVENT, { detail: full }))
}

interface FloatingBannerEntry {
  key: string
  item: NotificationItem
  createdAt: number
}

const TYPE_META: Record<
  NotificationItem['type'],
  { label: string; icon: IconName; badgeBg: string; accentBar: string }
> = {
  attendance: {
    label: 'Attendance Alert',
    icon: 'shield',
    badgeBg: 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/30',
    accentBar: 'bg-rose-400',
  },
  health: {
    label: 'Infirmary Alert',
    icon: 'heart',
    badgeBg: 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/30',
    accentBar: 'bg-rose-400',
  },
  pickup: {
    label: 'Safe Gate Pickup',
    icon: 'shield',
    badgeBg: 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/30',
    accentBar: 'bg-sky-400',
  },
  result: {
    label: 'Grade & Quiz Update',
    icon: 'exam',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30',
    accentBar: 'bg-emerald-400',
  },
  merit: {
    label: 'House Merit',
    icon: 'award',
    badgeBg: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30',
    accentBar: 'bg-amber-400',
  },
  feedback: {
    label: 'Teacher Feedback',
    icon: 'star',
    badgeBg: 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/30',
    accentBar: 'bg-violet-400',
  },
  fee: {
    label: 'Finance & Fee',
    icon: 'payment',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30',
    accentBar: 'bg-emerald-400',
  },
  notice: {
    label: 'Campus Notice',
    icon: 'bell',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/30',
    accentBar: 'bg-cyan-400',
  },
}

const AUTO_DISMISS_MS = 6500

export function FloatingNotificationCenter({
  notifications,
  scopeKey,
  soundPrefs,
  onSelectNotification,
  onMarkRead,
}: {
  notifications: NotificationItem[]
  /** Changes on role / account switch so switching accounts seeds seen IDs without spamming old history */
  scopeKey: string
  soundPrefs: NotificationSoundPrefs
  onSelectNotification: (item: NotificationItem) => void
  onMarkRead: (id: string) => void
}) {
  const [banners, setBanners] = useState<FloatingBannerEntry[]>([])
  const seenIdsRef = useRef<Set<string>>(new Set())
  const initializedScopeRef = useRef<string | null>(null)
  const timersRef = useRef<Map<string, number>>(new Map())
  const soundPrefsRef = useRef(soundPrefs)
  soundPrefsRef.current = soundPrefs

  // Unlock Web Audio on the very first user gesture anywhere in the app
  useEffect(() => {
    const unlock = () => primeNotificationAudio()
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const dismissBanner = useCallback((key: string) => {
    const existingTimer = timersRef.current.get(key)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
      timersRef.current.delete(key)
    }
    setBanners((prev) => prev.filter((b) => b.key !== key))
  }, [])

  const scheduleAutoDismiss = useCallback(
    (key: string) => {
      const existingTimer = timersRef.current.get(key)
      if (existingTimer) window.clearTimeout(existingTimer)
      const timerId = window.setTimeout(() => {
        timersRef.current.delete(key)
        setBanners((prev) => prev.filter((b) => b.key !== key))
      }, AUTO_DISMISS_MS)
      timersRef.current.set(key, timerId)
    },
    [],
  )

  const pauseAutoDismiss = useCallback((key: string) => {
    const existingTimer = timersRef.current.get(key)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
      timersRef.current.delete(key)
    }
  }, [])

  const enqueueBanner = useCallback(
    (item: NotificationItem) => {
      const entryKey = `${item.id}-${Date.now()}`
      setBanners((prev) => {
        const deduped = prev.filter((b) => b.item.id !== item.id)
        return [{ key: entryKey, item, createdAt: Date.now() }, ...deduped].slice(0, 4)
      })
      scheduleAutoDismiss(entryKey)

      const prefs = soundPrefsRef.current
      if (prefs.enabled) {
        playNotificationSound(item.type, prefs.preset)
      }

      // Optional native OS desktop notification when permitted and tab is backgrounded (or enabled)
      if (
        prefs.browserPush &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted' &&
        document.visibilityState === 'hidden'
      ) {
        try {
          const osNotif = new window.Notification(item.title, {
            body: item.text,
            tag: item.id,
          })
          osNotif.onclick = () => {
            window.focus()
            onSelectNotification(item)
            osNotif.close()
          }
        } catch {
          // ignore OS notification error
        }
      }
    },
    [onSelectNotification, scheduleAutoDismiss],
  )

  // Watch live notifications list (triggers automatically on local actions AND real-time SSE updates!)
  useEffect(() => {
    if (initializedScopeRef.current !== scopeKey) {
      initializedScopeRef.current = scopeKey
      seenIdsRef.current = new Set(notifications.map((n) => n.id))
      return
    }

    const fresh = notifications.filter((n) => !n.read && !seenIdsRef.current.has(n.id))
    notifications.forEach((n) => seenIdsRef.current.add(n.id))

    if (fresh.length > 0) {
      // Float up to 2 most recent new alerts at once to keep stack tidy
      fresh
        .slice(0, 2)
        .reverse()
        .forEach((item) => enqueueBanner(item))
    }
  }, [notifications, scopeKey, enqueueBanner])

  // Listen for explicit custom floating notifications (e.g. Test Alert or instant broadcast)
  useEffect(() => {
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent<NotificationItem>).detail
      if (!detail) return
      seenIdsRef.current.add(detail.id)
      enqueueBanner(detail)
    }
    window.addEventListener(CUSTOM_FLOAT_EVENT, handler)
    return () => window.removeEventListener(CUSTOM_FLOAT_EVENT, handler)
  }, [enqueueBanner])

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      timers.clear()
    }
  }, [])

  if (banners.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-label="Floating app notifications"
      className="pointer-events-none fixed right-3 top-20 z-[70] flex w-[min(94vw,385px)] flex-col gap-2.5 sm:right-5"
    >
      {banners.length > 1 && (
        <div className="pointer-events-auto flex justify-end">
          <button
            type="button"
            onClick={() => {
              banners.forEach((b) => dismissBanner(b.key))
            }}
            className="rounded-full bg-[#0f172a]/90 px-3 py-1 text-[10px] font-extrabold text-slate-300 shadow-md ring-1 ring-white/10 backdrop-blur transition hover:bg-[#0f172a] hover:text-emerald-300"
          >
            Dismiss all ({banners.length})
          </button>
        </div>
      )}

      {banners.map(({ key, item }) => {
        const meta = TYPE_META[item.type] || TYPE_META.notice
        return (
          <div
            key={key}
            role="status"
            onMouseEnter={() => pauseAutoDismiss(key)}
            onMouseLeave={() => scheduleAutoDismiss(key)}
            className="dmhs-float-card pointer-events-auto relative overflow-hidden rounded-2xl border border-white/12 bg-[#0f172a]/95 text-white shadow-[0_18px_45px_rgba(15,23,42,0.38)] backdrop-blur-md"
          >
            <div className="flex items-start gap-3 p-3.5 pr-3">
              <span
                className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${meta.badgeBg}`}
              >
                <Icon name={meta.icon} size={18} />
              </span>

              <button
                type="button"
                onClick={() => {
                  dismissBanner(key)
                  onMarkRead(item.id)
                  onSelectNotification(item)
                }}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-emerald-300">
                    {meta.label}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">· {item.time}</span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs font-black text-white">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-300">
                  {item.text}
                </p>
                <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-400">
                  Tap to open →
                </span>
              </button>

              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => {
                  onMarkRead(item.id)
                  dismissBanner(key)
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            {/* Animated auto-dismiss countdown bar (pauses on hover) */}
            <div className="h-1 w-full bg-white/10">
              <div className={`dmhs-float-bar h-full w-full ${meta.accentBar}`} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
