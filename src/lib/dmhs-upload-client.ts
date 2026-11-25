'use client'

export interface UploadedAttachmentResult {
  ok: boolean
  url?: string
  filename?: string
  sizeKb?: number
  mediaKind?: 'image' | 'video' | 'file'
  error?: string
}

/**
 * Uploads a real binary file (photo, PDF, DOCX, TXT) to /dmhs-api/uploads
 * and returns its persisted public URL (/uploads/<folder>/<unique>).
 */
export async function uploadDmhsAttachment(
  file: File,
  folder: 'homework' | 'messages' | 'leaves' | 'documents' | 'tasks',
): Promise<UploadedAttachmentResult> {
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', folder)
    const res = await fetch('/dmhs-api/uploads', {
      method: 'POST',
      body: fd,
    })
    const json = (await res.json()) as UploadedAttachmentResult
    if (!res.ok || !json.ok || !json.url) {
      return { ok: false, error: json.error || 'File upload failed.' }
    }
    return {
      ok: true,
      url: json.url,
      filename: json.filename || file.name,
      sizeKb: json.sizeKb,
      mediaKind: json.mediaKind,
    }
  } catch {
    return { ok: false, error: 'Network error while uploading file.' }
  }
}

export function isImageAttachment(nameOrUrl?: string): boolean {
  if (!nameOrUrl) return false
  return /\.(png|jpe?g|webp|gif)$/i.test(nameOrUrl)
}
