'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icons'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function DesktopAppInstallButton({ compact = false }: { compact?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Register minimal PWA service worker so Chrome/Edge treats DMHA as an installable Desktop App
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) {
      setIsInstalled(true)
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const onInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return
    }
    setShowGuide(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Install DMHA as a standalone Windows / Mac Desktop App"
        className={
          compact
            ? 'hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-700 shadow-xs transition hover:border-emerald-400 hover:bg-emerald-50/50 xl:inline-flex'
            : 'inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-300 shadow-sm transition hover:bg-slate-800'
        }
      >
        <Icon name="download" size={14} className={compact ? 'text-emerald-600' : ''} />
        {isInstalled ? 'Desktop App Active' : 'Install Desktop App'}
      </button>

      {showGuide &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
            onClick={() => setShowGuide(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl sm:p-7"
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-600">
                    DMHA Office Desktop App (PWA)
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    Install on Office PC or Mac
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600">
                {isInstalled ? (
                  <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-800">
                    DMHA Smart Learning App is already running in standalone Desktop App mode!
                  </div>
                ) : (
                  <>
                    <p>
                      Run DMHA as a dedicated Windows/Mac office window (with taskbar icon, no
                      browser tabs, instant auto-updates, and full SQLite/Excel export tools):
                    </p>
                    <div className="rounded-2xl bg-slate-50 p-3.5">
                      <p className="font-extrabold text-slate-900">Google Chrome / Microsoft Edge:</p>
                      <p className="mt-1">
                        Click the <strong>Install icon</strong> in the right side of your address
                        bar (or Menu → <strong>Apps → Install DMHA OS</strong>).
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3.5">
                      <p className="font-extrabold text-slate-900">Mobile (iOS / Android):</p>
                      <p className="mt-1">
                        Tap <strong>Share → Add to Home Screen</strong> (iPhone) or{' '}
                        <strong>Install App</strong> (Android Chrome).
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="rounded-full bg-[#0f172a] px-5 py-2 text-xs font-extrabold text-white"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
