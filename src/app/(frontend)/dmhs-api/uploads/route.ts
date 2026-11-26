import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { appendSecurityAudit, saveUploadedFileToDb } from '@/lib/dmhs-db'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import { isCloudflareSqlRuntime } from '@/lib/dmhs-sqlite-driver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/ogg': 'ogv',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'text/markdown': 'md',
}

function resolveMimeAndExt(rawMime: string, filename?: string): { mime: string; ext: string } | null {
  const cleanMime = String(rawMime || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (ALLOWED_MIME_EXT[cleanMime]) {
    return { mime: cleanMime, ext: ALLOWED_MIME_EXT[cleanMime] }
  }
  const lowerName = String(filename || '').toLowerCase()
  if (lowerName.endsWith('.mp4')) return { mime: 'video/mp4', ext: 'mp4' }
  if (lowerName.endsWith('.webm')) return { mime: 'video/webm', ext: 'webm' }
  if (lowerName.endsWith('.mov')) return { mime: 'video/quicktime', ext: 'mov' }
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }
  if (lowerName.endsWith('.png')) return { mime: 'image/png', ext: 'png' }
  if (lowerName.endsWith('.webp')) return { mime: 'image/webp', ext: 'webp' }
  return null
}

const STUDENT_ALLOWED_FOLDERS = new Set(['homework'])
const GUARDIAN_ALLOWED_FOLDERS = new Set(['homework', 'leaves', 'messages'])
const STAFF_ALLOWED_FOLDERS = new Set(['leaves', 'messages', 'documents', 'accounts', 'admissions', 'tasks'])
const SAFE_USER_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/csv',
])

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'teacher', 'staff', 'guardian', 'student'])
    if (!auth.ok) return auth.response
    const { session } = auth

    const contentType = request.headers.get('content-type') || ''
    let buffer: Buffer
    let mime: string
    let ext: string
    let safeFolder = 'exam-sheets'
    let originalFilename = 'upload'

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      const folderField = String(formData.get('folder') || 'class-moments')
      safeFolder = folderField.replace(/[^a-z0-9-_]/gi, '') || 'class-moments'

      if (!(file instanceof File)) {
        return NextResponse.json(
          { ok: false, error: 'A valid file field is required in multipart upload.' },
          { status: 400 },
        )
      }
      originalFilename = file.name || 'classroom-media'
      const resolved = resolveMimeAndExt(file.type, originalFilename)
      if (!resolved) {
        return NextResponse.json(
          {
            ok: false,
            error: `Unsupported file type (${file.type || originalFilename}). Allowed: MP4, WebM, MOV, JPG, PNG, WebP, GIF, PDF, PPTX, DOCX.`,
          },
          { status: 415 },
        )
      }
      mime = resolved.mime
      ext = resolved.ext
      const arrBuf = await file.arrayBuffer()
      buffer = Buffer.from(arrBuf)
    } else {
      const body = (await request.json()) as {
        dataUrl?: string
        filename?: string
        folder?: string
      }

      if (!body.dataUrl || !body.dataUrl.startsWith('data:')) {
        return NextResponse.json(
          { ok: false, error: 'Valid base64 dataUrl or multipart file is required.' },
          { status: 400 },
        )
      }

      originalFilename = body.filename || 'upload'
      const base64Match = body.dataUrl.match(/^data:([^;]+)(?:;[^,]+)*;base64,(.+)$/)
      const utf8SvgMatch = body.dataUrl.match(/^data:(image\/svg\+xml)(?:;charset=utf-8)?,(.+)$/i)

      if (!base64Match && !utf8SvgMatch) {
        return NextResponse.json({ ok: false, error: 'Unsupported dataUrl format.' }, { status: 400 })
      }

      const rawMime = (base64Match ? base64Match[1] : utf8SvgMatch![1]).toLowerCase()
      const resolved = resolveMimeAndExt(rawMime, originalFilename)
      if (!resolved) {
        return NextResponse.json(
          {
            ok: false,
            error: `Unsupported file type (${rawMime}). Allowed: MP4, WebM, MOV, JPG, PNG, WebP, GIF, SVG, PDF, PPTX, DOCX, XLSX, CSV, TXT.`,
          },
          { status: 415 },
        )
      }
      mime = resolved.mime
      ext = resolved.ext
      buffer = base64Match
        ? Buffer.from(base64Match[2], 'base64')
        : Buffer.from(decodeURIComponent(utf8SvgMatch![2]), 'utf8')
      safeFolder = (body.folder || 'exam-sheets').replace(/[^a-z0-9-_]/gi, '') || 'exam-sheets'
    }

    const isAdminOrTeacher = session.role === 'admin' || session.role === 'teacher'
    if (!isAdminOrTeacher) {
      const allowedFolders =
        session.role === 'student'
          ? STUDENT_ALLOWED_FOLDERS
          : session.role === 'guardian'
            ? GUARDIAN_ALLOWED_FOLDERS
            : STAFF_ALLOWED_FOLDERS
      if (!allowedFolders.has(safeFolder)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Access Denied: ${session.role} accounts may not upload into "${safeFolder}".`,
          },
          { status: 403 },
        )
      }
      if (!SAFE_USER_MIMES.has(mime)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Only images (JPG, PNG, WebP, GIF), PDF, Word, or text files are allowed for ${session.role} uploads.`,
          },
          { status: 415 },
        )
      }
    }

    const isVideo = mime.startsWith('video/')
    const isCf = isCloudflareSqlRuntime()
    const maxBytes = isCf
      ? 5 * 1024 * 1024
      : !isAdminOrTeacher
        ? 10 * 1024 * 1024
        : isVideo
          ? 60 * 1024 * 1024
          : 15 * 1024 * 1024
    if (buffer.byteLength > maxBytes) {
      return NextResponse.json(
        {
          ok: false,
          error: isCf
            ? 'File exceeds 5 MB upload limit on Cloudflare Free SQLite storage.'
            : !isAdminOrTeacher
              ? 'Attachment exceeds 10 MB maximum upload limit.'
              : isVideo
                ? 'Video exceeds 60 MB maximum upload limit.'
                : 'File exceeds 15 MB maximum upload limit.',
        },
        { status: 413 },
      )
    }

    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`

    if (isCf) {
      saveUploadedFileToDb({
        folder: safeFolder,
        filename: uniqueName,
        mime,
        buffer,
      })
    } else {
      // Persist file cleanly on server disk and serve dynamically via /dmhs-api/uploads/
      // so newly uploaded files work reliably in Next.js standalone production containers.
      const uploadRoot = process.env.DMHS_UPLOAD_DIR
        ? path.resolve(/*turbopackIgnore: true*/ process.env.DMHS_UPLOAD_DIR)
        : path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'uploads')
      const targetDir = path.join(/*turbopackIgnore: true*/ uploadRoot, safeFolder)
      if (!fs.existsSync(/*turbopackIgnore: true*/ targetDir)) {
        fs.mkdirSync(/*turbopackIgnore: true*/ targetDir, { recursive: true })
      }
      fs.writeFileSync(path.join(/*turbopackIgnore: true*/ targetDir, uniqueName), buffer)
    }

    const publicUrl = `/dmhs-api/uploads/${safeFolder}/${uniqueName}`
    appendSecurityAudit({
      action: 'file_uploaded',
      target: `${publicUrl} (${mime})`,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: getClientIpFromRequest(request),
    })

    return NextResponse.json({
      ok: true,
      storage: isCf
        ? 'cloudflare_do_sqlite'
        : process.env.S3_BUCKET
          ? 'cloud_ready_local_mirror'
          : 'local_disk',
      url: publicUrl,
      filename: originalFilename,
      sizeKb: Math.max(1, Math.round(buffer.byteLength / 1024)),
      mime,
      mediaKind: isVideo ? 'video' : mime.startsWith('image/') ? 'image' : 'file',
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'File upload failed' },
      { status: 500 },
    )
  }
}
