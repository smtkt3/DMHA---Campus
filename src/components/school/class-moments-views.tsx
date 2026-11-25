'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DateFilterBar, getTodayIso, matchesDateFilter } from './date-utils'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type { ClassMomentMedia, ClassMomentPost } from './types'
import { PageShell } from './ui'

interface QueuedCaptureFile {
  id: string
  file: File
  kind: 'image' | 'video'
  previewUrl: string
  filename: string
  sizeKb: number
}

function normalizeClassToken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/[·\-_\s]/g, '')
    .trim()
}

function parseClassOption(label: string): { className: string; section: string } {
  const cleaned = label.trim()
  if (cleaned.includes('·')) {
    const [cls, sec] = cleaned.split('·').map((s) => s.trim())
    return { className: cls || cleaned, section: sec || 'Section A' }
  }
  const compactMatch = cleaned.match(/^(Class\s+\d+|Pre-Play|Playgroup|Nursery|KG-\d)\s*([A-Z])$/i)
  if (compactMatch) {
    return {
      className: compactMatch[1].trim(),
      section: `Section ${compactMatch[2].toUpperCase()}`,
    }
  }
  return { className: cleaned, section: 'Section A' }
}

export function ClassMomentsView() {
  const {
    role,
    students,
    teachers,
    guardians,
    classMoments,
    activeTeacherId,
    activeGuardianId,
    activeStudentId,
    selectedChildId,
    createClassMoment,
    reactClassMoment,
    commentClassMoment,
    deleteClassMoment,
    notify,
  } = useSchool()

  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isGuardian = role === 'guardian'
  const isStudent = role === 'student'
  const canPost = isAdmin || isTeacher

  const activeTeacher = teachers.find((t) => t.id === activeTeacherId)
  const activeGuardian = guardians.find((g) => g.id === activeGuardianId)
  const activeStudent = students.find((s) => s.id === activeStudentId)

  const linkedChildIds = useMemo(() => {
    if (!isGuardian) return new Set<string>()
    const set = new Set<string>(activeGuardian?.linkedStudentIds || [])
    students.forEach((s) => {
      if (s.guardianId === activeGuardianId) set.add(s.id)
    })
    return set
  }, [isGuardian, activeGuardian, students, activeGuardianId])

  const selectedChild = isGuardian
    ? students.find((s) => s.id === selectedChildId && linkedChildIds.has(s.id)) ||
      students.find((s) => linkedChildIds.has(s.id)) ||
      students[0]
    : activeStudent || students[0]

  // Build available class-section targets for Teacher / Admin
  const availableClassTargets = useMemo(() => {
    const map = new Map<string, { className: string; section: string; label: string }>()
    students.forEach((s) => {
      if (s.status === 'suspended') return
      const label = `${s.className} · ${s.section}`
      const tok = normalizeClassToken(label)
      if (isTeacher) {
        const assigned = activeTeacher?.assignedClasses || []
        const allowed = assigned.some((cls) => {
          const aTok = normalizeClassToken(cls)
          return aTok === tok || aTok === normalizeClassToken(s.className)
        })
        if (!allowed) return
      }
      if (!map.has(tok)) {
        map.set(tok, { className: s.className, section: s.section, label })
      }
    })
    if (map.size === 0 && isTeacher && activeTeacher?.assignedClasses?.length) {
      activeTeacher.assignedClasses.forEach((cls) => {
        const parsed = parseClassOption(cls)
        const label = `${parsed.className} · ${parsed.section}`
        map.set(normalizeClassToken(label), { ...parsed, label })
      })
    }
    return Array.from(map.values())
  }, [students, isTeacher, activeTeacher])

  const [selectedTargetLabel, setSelectedTargetLabel] = useState<string>(
    () => availableClassTargets[0]?.label || 'Class 6 · Section A',
  )

  useEffect(() => {
    if (
      availableClassTargets.length > 0 &&
      !availableClassTargets.some((t) => t.label === selectedTargetLabel)
    ) {
      setSelectedTargetLabel(availableClassTargets[0].label)
    }
  }, [availableClassTargets, selectedTargetLabel])

  const activeTarget = useMemo(() => {
    return (
      availableClassTargets.find((t) => t.label === selectedTargetLabel) ||
      parseClassOption(selectedTargetLabel)
    )
  }, [availableClassTargets, selectedTargetLabel])

  // Live enrolled students & guardians preview for chosen class
  const targetRecipients = useMemo(() => {
    const targetTok = normalizeClassToken(`${activeTarget.className} ${activeTarget.section}`)
    const enrolled = students.filter(
      (s) =>
        s.status !== 'suspended' &&
        normalizeClassToken(`${s.className} ${s.section}`) === targetTok,
    )
    const stuIds = new Set(enrolled.map((s) => s.id))
    const guardianList = guardians.filter((g) => {
      if (enrolled.some((s) => s.guardianId === g.id)) return true
      return (g.linkedStudentIds || []).some((sid) => stuIds.has(sid))
    })
    return { enrolled, guardianList }
  }, [students, guardians, activeTarget])

  // Composer form state
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState(activeTeacher?.subject || 'Classroom Activity')
  const [caption, setCaption] = useState('')
  const [queuedFiles, setQueuedFiles] = useState<QueuedCaptureFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadStatusText, setUploadStatusText] = useState('')

  // Live Camera & Video Recorder state
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment')
  const [cameraError, setCameraError] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraCaptureInputRef = useRef<HTMLInputElement | null>(null)

  // Feed filters & modals
  const [search, setSearch] = useState('')
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all')
  const [classFilter, setClassFilter] = useState<string>('All Classes')
  const [dateFilter, setDateFilter] = useState<string>('')
  const [guardianChildOnly, setGuardianChildOnly] = useState<boolean>(true)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [lightboxMedia, setLightboxMedia] = useState<{
    media: ClassMomentMedia
    moment: ClassMomentPost
  } | null>(null)
  const [recipientsModalMoment, setRecipientsModalMoment] = useState<ClassMomentPost | null>(null)

  const stopCameraStream = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop())
      streamRef.current = null
    }
    setIsRecording(false)
    setRecordSeconds(0)
    setCameraOpen(false)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop())
      }
    }
  }, [])

  const startLiveCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    setCameraError('')
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Live webcam API is unavailable in this browser. Use "Upload Photos / Videos" or "Device Camera" below.',
      )
      return
    }
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop())
      }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        })
      } catch {
        // Retry video-only if microphone permission is denied or unavailable
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false,
        })
      }
      streamRef.current = stream
      setCameraFacing(facing)
      setCameraOpen(true)
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => undefined)
        }
      }, 60)
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? `Could not access camera (${err.message}). You can still upload photos or videos directly below.`
          : 'Camera permission denied. Use "Upload Photos / Videos" below.',
      )
    }
  }

  const handleSnapPhoto = () => {
    const vid = videoRef.current
    if (!vid || vid.videoWidth === 0) {
      notify('Camera feed is still initializing — try again in a second')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = vid.videoWidth
    canvas.height = vid.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const filename = `class-photo-${Date.now()}.jpg`
        const file = new File([blob], filename, { type: 'image/jpeg' })
        const previewUrl = URL.createObjectURL(blob)
        setQueuedFiles((prev) => [
          ...prev,
          {
            id: `qf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            file,
            kind: 'image',
            previewUrl,
            filename,
            sizeKb: Math.max(1, Math.round(blob.size / 1024)),
          },
        ])
        notify('Classroom photo captured! Ready to submit.')
      },
      'image/jpeg',
      0.9,
    )
  }

  const handleToggleRecordVideo = () => {
    if (isRecording) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      setIsRecording(false)
      return
    }

    if (!streamRef.current) {
      notify('Open the camera first to record a classroom video')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      notify('Video recording is not supported in this browser; upload a video file instead')
      return
    }

    recordedChunksRef.current = []
    const preferredTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || ''
    const recorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current)

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data)
    }
    recorder.onstop = () => {
      const actualMime = (recorder.mimeType || mimeType || 'video/webm').split(';')[0]
      const ext = actualMime.includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(recordedChunksRef.current, { type: actualMime })
      if (blob.size === 0) return
      const filename = `class-video-${Date.now()}.${ext}`
      const file = new File([blob], filename, { type: actualMime })
      const previewUrl = URL.createObjectURL(blob)
      setQueuedFiles((prev) => [
        ...prev,
        {
          id: `qf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          file,
          kind: 'video',
          previewUrl,
          filename,
          sizeKb: Math.max(1, Math.round(blob.size / 1024)),
        },
      ])
      setRecordSeconds(0)
      notify('Classroom video recorded! Ready to upload & send.')
    }

    recorderRef.current = recorder
    recorder.start(500)
    setIsRecording(true)
    setRecordSeconds(0)
    timerRef.current = window.setInterval(() => {
      setRecordSeconds((s) => s + 1)
    }, 1000)
  }

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const added: QueuedCaptureFile[] = []
    Array.from(files).forEach((file) => {
      const isVideo =
        file.type.startsWith('video/') || /\.(mp4|webm|mov|ogv)$/i.test(file.name)
      const isImage =
        file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)
      if (!isVideo && !isImage) {
        notify(`Skipped unsupported file: ${file.name}`)
        return
      }
      added.push({
        id: `qf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        kind: isVideo ? 'video' : 'image',
        previewUrl: URL.createObjectURL(file),
        filename: file.name,
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
      })
    })
    if (added.length > 0) {
      setQueuedFiles((prev) => [...prev, ...added].slice(0, 8))
    }
  }

  const removeQueuedFile = (id: string) => {
    setQueuedFiles((prev) => {
      const target = prev.find((f) => f.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }

  const handleSubmitMoment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      notify('Please enter a short activity title')
      return
    }
    if (queuedFiles.length === 0) {
      notify('Capture or upload at least one classroom photo or video first')
      return
    }
    if (targetRecipients.enrolled.length === 0) {
      notify(`No enrolled students found in ${activeTarget.className} · ${activeTarget.section}`)
      return
    }

    setUploading(true)
    try {
      const uploadedMedia: ClassMomentMedia[] = []
      for (let i = 0; i < queuedFiles.length; i++) {
        const item = queuedFiles[i]
        setUploadStatusText(`Uploading ${i + 1} of ${queuedFiles.length}: ${item.filename}...`)
        const formData = new FormData()
        formData.append('file', item.file)
        formData.append('folder', 'class-moments')

        const res = await fetch('/dmhs-api/uploads', {
          method: 'POST',
          body: formData,
        })
        const json = (await res.json()) as {
          ok?: boolean
          error?: string
          url?: string
          mime?: string
          sizeKb?: number
          mediaKind?: 'image' | 'video' | 'file'
        }
        if (!res.ok || !json.ok || !json.url) {
          throw new Error(json.error || `Failed to upload ${item.filename}`)
        }
        uploadedMedia.push({
          id: `med-${Date.now()}-${i}`,
          kind: json.mediaKind === 'video' ? 'video' : item.kind,
          url: json.url,
          mime: json.mime || item.file.type || (item.kind === 'video' ? 'video/mp4' : 'image/jpeg'),
          filename: item.filename,
          sizeKb: json.sizeKb || item.sizeKb,
        })
      }

      setUploadStatusText('Delivering privately to enrolled students’ guardians...')
      const result = await createClassMoment({
        className: activeTarget.className,
        section: activeTarget.section,
        subject: subject.trim() || activeTeacher?.subject || 'Classroom Activity',
        title: title.trim(),
        caption: caption.trim(),
        dateIso: getTodayIso(),
        media: uploadedMedia,
      })

      if (result.ok) {
        queuedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl))
        setQueuedFiles([])
        setTitle('')
        setCaption('')
        if (cameraOpen) stopCameraStream()
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadStatusText('')
    }
  }

  // Visible moments after role/child/date/media/search filtering
  const visibleMoments = useMemo(() => {
    const q = search.trim().toLowerCase()
    const childTok = selectedChild
      ? normalizeClassToken(`${selectedChild.className} ${selectedChild.section}`)
      : ''

    return classMoments
      .filter((m) => {
        if (isGuardian && guardianChildOnly && selectedChild) {
          return (
            m.recipientStudentIds.includes(selectedChild.id) ||
            normalizeClassToken(`${m.className} ${m.section}`) === childTok
          )
        }
        return true
      })
      .filter((m) => {
        if (classFilter === 'All Classes') return true
        return m.classLabel === classFilter
      })
      .filter((m) => {
        if (mediaFilter === 'all') return true
        return m.media.some((item) => item.kind === mediaFilter)
      })
      .filter((m) => {
        if (!dateFilter) return true
        return matchesDateFilter(m.dateIso || m.createdAt, dateFilter)
      })
      .filter((m) => {
        if (!q) return true
        return (
          m.title.toLowerCase().includes(q) ||
          m.caption.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.classLabel.toLowerCase().includes(q) ||
          m.teacherName.toLowerCase().includes(q)
        )
      })
  }, [
    classMoments,
    isGuardian,
    guardianChildOnly,
    selectedChild,
    classFilter,
    mediaFilter,
    dateFilter,
    search,
  ])

  const savedDates = useMemo(() => {
    const set = new Set<string>()
    classMoments.forEach((m) => {
      if (m.dateIso) set.add(m.dateIso)
    })
    return Array.from(set).sort((a, b) => b.localeCompare(a)).slice(0, 6)
  }, [classMoments])

  const feedClassOptions = useMemo(() => {
    const set = new Set<string>(['All Classes'])
    classMoments.forEach((m) => set.add(m.classLabel))
    return Array.from(set)
  }, [classMoments])

  const totalPhotos = visibleMoments.reduce(
    (sum, m) => sum + m.media.filter((x) => x.kind === 'image').length,
    0,
  )
  const totalVideos = visibleMoments.reduce(
    (sum, m) => sum + m.media.filter((x) => x.kind === 'video').length,
    0,
  )
  const unseenCount = isGuardian
    ? visibleMoments.filter((m) => !(m.seenByGuardianIds || []).includes(activeGuardianId)).length
    : 0

  const formatTimer = (secs: number) =>
    `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`

  const liveRecipientsModal = recipientsModalMoment
    ? classMoments.find((m) => m.id === recipientsModalMoment.id) || recipientsModalMoment
    : null

  return (
    <PageShell
      eyebrow={
        isGuardian
          ? 'Private Family Classroom Feed · Enrolled Class Only'
          : isStudent
            ? 'My Class Photo & Video Gallery'
            : 'Live Classroom Capture · Direct to Enrolled Guardians'
      }
      title={
        isGuardian
          ? 'Class Moments (Photos & Videos)'
          : isStudent
            ? 'Class Moments'
            : 'Class Moments · Live Photo & Video Sharing'
      }
      subtitle={
        canPost
          ? 'Capture live classroom photos or record short videos during class, upload, and deliver privately to the guardians of every student enrolled in that class.'
          : isGuardian
            ? 'Private classroom photos and videos shared directly by your child’s class teachers — visible strictly to guardians of students enrolled in that class.'
            : 'Photos and video highlights shared by your teachers during class.'
      }
    >
      {isGuardian && <ChildSwitcherBar />}

      {/* Top KPI Strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-card rounded-2xl p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Classroom Moments
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">{visibleMoments.length}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            Strictly scoped by class enrollment
          </p>
        </div>
        <div className="dmhs-card rounded-2xl p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
            Photos Shared
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{totalPhotos}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            Full-resolution classroom captures
          </p>
        </div>
        <div className="dmhs-card rounded-2xl p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
            Videos Shared
          </p>
          <p className="mt-1 text-2xl font-black text-indigo-700">{totalVideos}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            Streamable MP4 / WebM class clips
          </p>
        </div>
        <div className="dmhs-hero rounded-2xl p-4 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
            {isGuardian ? 'New Unseen Moments' : 'Privacy Enforcement'}
          </p>
          <p className="mt-1 text-2xl font-black">
            {isGuardian ? unseenCount : '100% Enrolled'}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-300">
            {isGuardian
              ? selectedChild
                ? `${selectedChild.name} · ${selectedChild.className} ${selectedChild.section}`
                : 'Guardian Family Feed'
              : 'Auto-routed to enrolled guardians only'}
          </p>
        </div>
      </div>

      {/* ============================================================
          TEACHER / ADMIN CAPTURE & UPLOAD STUDIO
         ============================================================ */}
      {canPost && (
        <form
          onSubmit={handleSubmitMoment}
          className="dmhs-card mb-7 rounded-[26px] border-2 border-emerald-500/20 bg-white p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">
                Classroom Camera &amp; Media Studio
              </p>
              <h3 className="mt-0.5 text-lg font-black text-slate-900">
                Take Photo / Video During Class &amp; Send to Guardians
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => (cameraOpen ? stopCameraStream() : startLiveCamera(cameraFacing))}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition ${
                  cameraOpen
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-[#0f172a] text-emerald-400 hover:bg-slate-800'
                }`}
              >
                <Icon name="video" size={14} />
                {cameraOpen ? 'Close Live Camera' : 'Open Live Camera'}
              </button>

              <button
                type="button"
                onClick={() => cameraCaptureInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-2 text-xs font-extrabold text-emerald-800 ring-1 ring-emerald-500/20 hover:bg-emerald-100"
              >
                <Icon name="spark" size={14} />
                Device Camera
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-200"
              >
                <Icon name="plus" size={14} />
                Upload Photos / Videos
              </button>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => {
                  handleFilesSelected(e.target.files)
                  e.target.value = ''
                }}
                className="hidden"
              />
              <input
                ref={cameraCaptureInputRef}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                onChange={(e) => {
                  handleFilesSelected(e.target.files)
                  e.target.value = ''
                }}
                className="hidden"
              />
            </div>
          </div>

          {/* Camera error helper */}
          {cameraError && (
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 ring-1 ring-amber-400/30">
              {cameraError}
            </div>
          )}

          {/* Live Camera Viewfinder */}
          {cameraOpen && (
            <div className="mt-4 overflow-hidden rounded-2xl bg-slate-950 p-3 text-white">
              <div className="relative aspect-video max-h-[360px] w-full overflow-hidden rounded-xl bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
                {isRecording && (
                  <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-1 text-xs font-black text-white shadow-lg">
                    <span className="size-2 animate-pulse rounded-full bg-white" />
                    REC {formatTimer(recordSeconds)}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSnapPhoto}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-300"
                  >
                    Snap Photo
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleRecordVideo}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black ${
                      isRecording
                        ? 'bg-rose-600 text-white hover:bg-rose-700'
                        : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    {isRecording ? `Stop & Save Video (${formatTimer(recordSeconds)})` : 'Record Video Clip'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    startLiveCamera(cameraFacing === 'environment' ? 'user' : 'environment')
                  }
                  className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/20"
                >
                  Flip Camera ({cameraFacing === 'environment' ? 'Rear' : 'Front'})
                </button>
              </div>
            </div>
          )}

          {/* Class, Subject & Activity Metadata */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block text-[11px] font-extrabold text-slate-600">
              Target Class &amp; Section *
              <select
                value={selectedTargetLabel}
                onChange={(e) => setSelectedTargetLabel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:border-emerald-500"
              >
                {availableClassTargets.map((t) => (
                  <option key={t.label} value={t.label}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[11px] font-extrabold text-slate-600">
              Subject / Activity
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Physics Lab, Art & Craft, Math"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:border-emerald-500"
              />
            </label>

            <label className="block text-[11px] font-extrabold text-slate-600">
              Moment Headline *
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Electromagnetism Circuit Demo in Class 6A"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          <label className="mt-3 block text-[11px] font-extrabold text-slate-600">
            Teacher Note for Guardians
            <textarea
              rows={2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Share what students explored today — delivered automatically to all guardians of students enrolled in this class..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
            />
          </label>

          {/* Auto-Resolved Enrolled Guardians Delivery Banner */}
          <div className="mt-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black text-emerald-950">
                Automatic Private Delivery → {targetRecipients.enrolled.length} enrolled student
                {targetRecipients.enrolled.length === 1 ? '' : 's'} ·{' '}
                {targetRecipients.guardianList.length} guardian
                {targetRecipients.guardianList.length === 1 ? '' : 's'} in {activeTarget.className} ·{' '}
                {activeTarget.section}
              </p>
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                Enrolled Class Only
              </span>
            </div>
            {targetRecipients.enrolled.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {targetRecipients.enrolled.map((stu) => (
                  <span
                    key={stu.id}
                    className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 ring-1 ring-emerald-500/15"
                  >
                    {stu.name} → <span className="text-emerald-700">{stu.guardianName}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[11px] font-bold text-rose-700">
                No active students enrolled in this class section.
              </p>
            )}
          </div>

          {/* Queued Photos & Videos Preview Grid */}
          {queuedFiles.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Ready to Upload ({queuedFiles.length} file{queuedFiles.length === 1 ? '' : 's'})
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {queuedFiles.map((qf) => (
                  <div
                    key={qf.id}
                    className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900"
                  >
                    {qf.kind === 'video' ? (
                      <video
                        src={qf.previewUrl}
                        controls
                        playsInline
                        className="h-36 w-full object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qf.previewUrl}
                        alt={qf.filename}
                        className="h-36 w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeQueuedFile(qf.id)}
                      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-slate-950/80 text-white hover:bg-rose-600"
                      title="Remove"
                    >
                      <Icon name="close" size={14} />
                    </button>
                    <div className="flex items-center justify-between bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600">
                      <span className="truncate">{qf.filename}</span>
                      <span className="shrink-0 text-slate-400">
                        {qf.kind.toUpperCase()} · {qf.sizeKb} KB
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Row */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-slate-500">
              {uploadStatusText ||
                'Supports live camera photos, WebM/MP4 class clips, and multi-file uploads (up to 60 MB for video).'}
            </p>
            <button
              type="submit"
              disabled={uploading || queuedFiles.length === 0 || targetRecipients.enrolled.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-6 py-3 text-xs font-black text-emerald-400 shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="send" size={14} />
              {uploading
                ? 'Uploading & Delivering...'
                : `Upload & Send to ${targetRecipients.guardianList.length} Guardian${targetRecipients.guardianList.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      )}

      {/* ============================================================
          FEED FILTERS BAR
         ============================================================ */}
      <div className="dmhs-card mb-6 space-y-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search classroom moments by title, subject, teacher, or class..."
            className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
          />

          {isGuardian && (
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setGuardianChildOnly(true)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold ${
                  guardianChildOnly ? 'bg-[#0f172a] text-emerald-400' : 'text-slate-600'
                }`}
              >
                {selectedChild ? `${selectedChild.name.split(' ')[0]}’s Class` : 'Selected Child'}
              </button>
              <button
                onClick={() => setGuardianChildOnly(false)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold ${
                  !guardianChildOnly ? 'bg-[#0f172a] text-emerald-400' : 'text-slate-600'
                }`}
              >
                All My Children
              </button>
            </div>
          )}

          {canPost && feedClassOptions.length > 1 && (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
            >
              {feedClassOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'image', 'video'] as const).map((mk) => (
              <button
                key={mk}
                onClick={() => setMediaFilter(mk)}
                className={`rounded-full px-3 py-1 text-[11px] font-extrabold transition ${
                  mediaFilter === mk
                    ? 'bg-[#0f172a] text-emerald-400'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mk === 'all' ? 'All Media' : mk === 'image' ? 'Photos Only' : 'Videos Only'}
              </button>
            ))}
          </div>

          <DateFilterBar
            value={dateFilter}
            onChange={setDateFilter}
            label="Class Date"
            allowAll
            savedDates={savedDates}
          />
        </div>
      </div>

      {/* ============================================================
          CLASS MOMENTS GALLERY FEED
         ============================================================ */}
      {visibleMoments.length === 0 ? (
        <div className="dmhs-card rounded-[26px] p-12 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Icon name="video" size={26} />
          </div>
          <h4 className="mt-4 text-base font-black text-slate-900">
            {canPost
              ? 'No classroom photos or videos shared yet'
              : 'No classroom moments for this class yet'}
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs font-semibold text-slate-500">
            {canPost
              ? 'Use "Open Live Camera", "Device Camera", or "Upload Photos / Videos" above to capture moments during class and send them directly to enrolled students’ guardians.'
              : 'Whenever your class teacher uploads a photo or video from class, it will appear right here automatically.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleMoments.map((moment) => {
            const likedByMe =
              isGuardian && (moment.likedByGuardianIds || []).includes(activeGuardianId)
            const seenByMe =
              isGuardian && (moment.seenByGuardianIds || []).includes(activeGuardianId)
            const canDelete = isAdmin || (isTeacher && moment.teacherId === activeTeacherId)
            const draft = commentDrafts[moment.id] || ''

            return (
              <article
                key={moment.id}
                className="dmhs-card overflow-hidden rounded-[26px] bg-white p-5 sm:p-6"
              >
                {/* Post Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-[#0f172a] px-3 py-1 text-[10px] font-black uppercase text-emerald-400">
                        {moment.classLabel}
                      </span>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-extrabold text-indigo-700">
                        {moment.subject}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                        Sent to {moment.recipientSummary}
                      </span>
                      {isGuardian && !seenByMe && (
                        <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-black text-slate-950">
                          NEW
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2.5 text-lg font-black text-slate-900">{moment.title}</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{moment.caption}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400">
                      {moment.dateIso} · {moment.createdAt}
                    </span>
                    <span className="text-[11px] font-extrabold text-slate-600">
                      Shared by {moment.teacherName}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {canPost && (
                        <button
                          onClick={() => setRecipientsModalMoment(moment)}
                          className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold text-slate-700 hover:bg-slate-200"
                        >
                          Delivery Roster ({(moment.seenByGuardianIds || []).length}/
                          {moment.recipientGuardianIds.length} seen)
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => deleteClassMoment(moment.id)}
                          className="rounded-lg bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold text-rose-700 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Media Gallery */}
                <div
                  className={`mt-4 grid gap-3 ${
                    moment.media.length === 1
                      ? 'grid-cols-1'
                      : moment.media.length === 2
                        ? 'sm:grid-cols-2'
                        : 'sm:grid-cols-2 lg:grid-cols-3'
                  }`}
                >
                  {moment.media.map((med) => (
                    <div
                      key={med.id}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950"
                    >
                      {med.kind === 'video' ? (
                        <video
                          src={med.url}
                          controls
                          playsInline
                          onPlay={() => {
                            if (isGuardian && !seenByMe) {
                              void reactClassMoment(moment.id, { markSeen: true })
                            }
                          }}
                          className={`w-full bg-black object-contain ${
                            moment.media.length === 1 ? 'max-h-[460px]' : 'h-60'
                          }`}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setLightboxMedia({ media: med, moment })
                            if (isGuardian && !seenByMe) {
                              void reactClassMoment(moment.id, { markSeen: true })
                            }
                          }}
                          className="block w-full text-left"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={med.url}
                            alt={`${moment.title} - ${med.filename}`}
                            className={`w-full object-cover transition duration-300 group-hover:scale-[1.02] ${
                              moment.media.length === 1 ? 'max-h-[460px]' : 'h-60'
                            }`}
                          />
                        </button>
                      )}
                      <div className="flex items-center justify-between bg-white px-3 py-2 text-[11px] font-bold text-slate-600">
                        <span className="truncate">
                          {med.kind === 'video' ? '🎬 Video' : '📷 Photo'} · {med.filename}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setLightboxMedia({ media: med, moment })
                              if (isGuardian && !seenByMe) {
                                void reactClassMoment(moment.id, { markSeen: true })
                              }
                            }}
                            className="text-emerald-700 hover:underline"
                          >
                            Full View
                          </button>
                          <a
                            href={med.url}
                            download={med.filename}
                            className="text-slate-500 hover:text-slate-900"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Guardian Actions & Engagement Row */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {isGuardian ? (
                      <>
                        <button
                          onClick={() =>
                            reactClassMoment(moment.id, { toggleLike: true, markSeen: true })
                          }
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                            likedByMe
                              ? 'bg-rose-500 text-white shadow-xs'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          <Icon name="heart" size={14} />
                          {likedByMe ? 'Loved ♥' : 'Love'} ({(moment.likedByGuardianIds || []).length})
                        </button>
                        <button
                          onClick={() => reactClassMoment(moment.id, { markSeen: true })}
                          disabled={seenByMe}
                          className={`rounded-xl px-3.5 py-2 text-xs font-extrabold ${
                            seenByMe
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {seenByMe ? '✓ Marked Seen' : '✓ Mark Seen'}
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                        <span className="text-rose-600">
                          ♥ {(moment.likedByGuardianIds || []).length} Guardian Love
                          {(moment.likedByGuardianIds || []).length === 1 ? '' : 's'}
                        </span>
                        <span className="text-emerald-700">
                          ✓ {(moment.seenByGuardianIds || []).length}/{moment.recipientGuardianIds.length}{' '}
                          Guardians Viewed
                        </span>
                      </div>
                    )}
                  </div>

                  <span className="text-[11px] font-bold text-slate-400">
                    {(moment.comments || []).length} comment
                    {(moment.comments || []).length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Comments Thread */}
                {((moment.comments || []).length > 0 || !isStudent) && (
                  <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3.5">
                    {(moment.comments || []).map((cm) => (
                      <div key={cm.id} className="rounded-xl bg-white px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900">
                            {cm.authorName}{' '}
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-slate-500">
                              {cm.authorRole}
                            </span>
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {cm.createdAt}
                          </span>
                        </div>
                        <p className="mt-1 font-medium text-slate-700">{cm.text}</p>
                      </div>
                    ))}

                    {!isStudent && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault()
                          if (!draft.trim()) return
                          const res = await commentClassMoment(moment.id, draft.trim())
                          if (res.ok) {
                            setCommentDrafts((prev) => ({ ...prev, [moment.id]: '' }))
                          }
                        }}
                        className="flex items-center gap-2 pt-1"
                      >
                        <input
                          value={draft}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({ ...prev, [moment.id]: e.target.value }))
                          }
                          placeholder={
                            isGuardian
                              ? 'Write an appreciation note or question for the teacher...'
                              : 'Reply to guardians...'
                          }
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-emerald-400 hover:bg-slate-800"
                        >
                          Send
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* ============================================================
          LIGHTBOX MODAL (FULL-SCREEN PHOTO / VIDEO VIEWER)
         ============================================================ */}
      {lightboxMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          onClick={() => setLightboxMedia(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl overflow-hidden rounded-[26px] bg-slate-900 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                  {lightboxMedia.moment.classLabel} · {lightboxMedia.moment.subject}
                </p>
                <h4 className="text-sm font-black">{lightboxMedia.moment.title}</h4>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxMedia.media.url}
                  download={lightboxMedia.media.filename}
                  className="rounded-full bg-emerald-400 px-3.5 py-1.5 text-xs font-black text-slate-950"
                >
                  Download
                </a>
                <button
                  onClick={() => setLightboxMedia(null)}
                  className="flex size-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>

            <div className="flex max-h-[75vh] items-center justify-center bg-black p-2">
              {lightboxMedia.media.kind === 'video' ? (
                <video
                  src={lightboxMedia.media.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[72vh] w-full object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lightboxMedia.media.url}
                  alt={lightboxMedia.moment.title}
                  className="max-h-[72vh] max-w-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          DELIVERY & SEEN RECEIPTS MODAL (TEACHER / ADMIN)
         ============================================================ */}
      {liveRecipientsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setRecipientsModalMoment(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                  Private Class Delivery Roster
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-900">
                  {liveRecipientsModal.title}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {liveRecipientsModal.classLabel} · {liveRecipientsModal.recipientSummary}
                </p>
              </div>
              <button
                onClick={() => setRecipientsModalMoment(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {liveRecipientsModal.recipientStudentIds.map((sid) => {
                const stu = students.find((s) => s.id === sid)
                const g = guardians.find(
                  (x) =>
                    x.id === stu?.guardianId ||
                    (x.linkedStudentIds || []).includes(sid),
                )
                const hasSeen = g
                  ? (liveRecipientsModal.seenByGuardianIds || []).includes(g.id)
                  : false
                const hasLiked = g
                  ? (liveRecipientsModal.likedByGuardianIds || []).includes(g.id)
                  : false

                return (
                  <div
                    key={sid}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-900">
                        {stu?.name || sid}{' '}
                        <span className="font-semibold text-slate-400">
                          (Roll #{stu?.roll || '—'})
                        </span>
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        Guardian: {g?.name || stu?.guardianName || 'Linked Guardian'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasLiked && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">
                          ♥ Loved
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          hasSeen
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {hasSeen ? 'Seen ✓' : 'Delivered'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
