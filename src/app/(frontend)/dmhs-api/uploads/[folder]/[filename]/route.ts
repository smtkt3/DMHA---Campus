import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
}

function getUploadBaseDir(): string {
  return process.env.DMHS_UPLOAD_DIR
    ? path.resolve(/*turbopackIgnore: true*/ process.env.DMHS_UPLOAD_DIR)
    : path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'uploads')
}

function resolveSafeFilePath(folder: string, filename: string): string | null {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(folder)) return null
  if (!/^[a-zA-Z0-9._-]{1,180}$/.test(filename) || filename.includes('..')) return null

  const baseDir = getUploadBaseDir()
  const resolved = path.resolve(/*turbopackIgnore: true*/ baseDir, folder, filename)
  const safeRoot = `${path.resolve(/*turbopackIgnore: true*/ baseDir)}${path.sep}`
  if (!resolved.startsWith(safeRoot)) return null
  return resolved
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return EXT_TO_MIME[ext] || 'application/octet-stream'
}

export async function GET(
  request: Request,
  context: { params: Promise<{ folder: string; filename: string }> },
) {
  try {
    const { folder, filename } = await context.params
    const filePath = resolveSafeFilePath(folder, filename)
    if (!filePath || !fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      return NextResponse.json({ ok: false, error: 'Uploaded file not found.' }, { status: 404 })
    }

    const stat = fs.statSync(/*turbopackIgnore: true*/ filePath)
    if (!stat.isFile()) {
      return NextResponse.json({ ok: false, error: 'Uploaded file not found.' }, { status: 404 })
    }

    const mime = getMimeType(filename)
    const rangeHeader = request.headers.get('range')
    const baseHeaders: Record<string, string> = {
      'Content-Type': mime,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    }
    if (mime === 'image/svg+xml') {
      baseHeaders['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    }

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
      if (match) {
        const start = match[1] ? Number.parseInt(match[1], 10) : 0
        const end = match[2] ? Math.min(Number.parseInt(match[2], 10), stat.size - 1) : stat.size - 1
        if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stat.size) {
          return new NextResponse(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${stat.size}` },
          })
        }
        const chunkLen = end - start + 1
        const fd = fs.openSync(/*turbopackIgnore: true*/ filePath, 'r')
        try {
          const buf = Buffer.alloc(chunkLen)
          fs.readSync(fd, buf, 0, chunkLen, start)
          return new NextResponse(buf, {
            status: 206,
            headers: {
              ...baseHeaders,
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Content-Length': String(chunkLen),
            },
          })
        } finally {
          fs.closeSync(fd)
        }
      }
    }

    const data = fs.readFileSync(/*turbopackIgnore: true*/ filePath)
    return new NextResponse(data, {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Length': String(data.byteLength),
      },
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to serve uploaded file.' },
      { status: 500 },
    )
  }
}

export async function HEAD(
  _request: Request,
  context: { params: Promise<{ folder: string; filename: string }> },
) {
  const { folder, filename } = await context.params
  const filePath = resolveSafeFilePath(folder, filename)
  if (!filePath || !fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
    return new NextResponse(null, { status: 404 })
  }
  const stat = fs.statSync(/*turbopackIgnore: true*/ filePath)
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': getMimeType(filename),
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
