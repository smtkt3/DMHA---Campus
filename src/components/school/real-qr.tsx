'use client'

import QRCode from 'qrcode'
import React, { useEffect, useState } from 'react'

export function RealQrCode({
  value,
  size = 132,
  label,
  className = '',
}: {
  value: string
  size?: number
  label?: string
  className?: string
}) {
  const [dataUrl, setDataUrl] = useState<string>('')

  useEffect(() => {
    let active = true
    if (!value) {
      setDataUrl('')
      return
    }
    QRCode.toDataURL(value, {
      width: Math.max(240, size * 2),
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setDataUrl(url)
      })
      .catch(() => {
        if (active) setDataUrl('')
      })
    return () => {
      active = false
    }
  }, [value, size])

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-xl bg-slate-100 text-[10px] font-bold text-slate-400 ${className}`}
      >
        QR...
      </div>
    )
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={label || `Scannable QR code for ${value}`}
      className={`rounded-xl bg-white ${className}`}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  )
}

export async function downloadQrPng(value: string, filename: string): Promise<void> {
  const dataUrl = await QRCode.toDataURL(value, {
    width: 600,
    margin: 3,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  })
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
