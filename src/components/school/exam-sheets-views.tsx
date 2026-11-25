'use client'

import React, { useEffect, useRef, useState } from 'react'
import { GuardianBiometricGateModal, VerificationSealBadge } from './biometric-ui'
import { createSampleExamSheetSvg } from './data'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type { ExamSheetItem } from './types'
import { PageShell, SectionTitle } from './ui'

export function ExamSheetsView() {
  const {
    role,
    students,
    selectedChildId,
    activeStudentId,
    examSheets,
    uploadExamSheet,
    reviewExamSheet,
    verifyExamSheetByAdmin,
    notify,
  } = useSchool()

  const canUpload = role === 'teacher' || role === 'admin'

  // Upload / Scan / Camera Form State
  const [studentId, setStudentId] = useState(students[0]?.id || '')
  const [subject, setSubject] = useState('Physics')
  const [examTitle, setExamTitle] = useState('Term Final Written Paper 1')
  const [marksObtained, setMarksObtained] = useState('44')
  const [totalMarks, setTotalMarks] = useState('50')
  const [teacherRemarks, setTeacherRemarks] = useState('')
  const [captureMethod, setCaptureMethod] = useState<ExamSheetItem['captureMethod']>('Scan')
  const [scanEnhanced, setScanEnhanced] = useState(true)
  const [fileType, setFileType] = useState<'image' | 'pdf'>('image')
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [uploadingSheet, setUploadingSheet] = useState(false)

  // Camera modal state
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [pendingBiometricReview, setPendingBiometricReview] = useState<{
    sheetId: string
    examTitle: string
    studentName: string
    comment: string
    requestRecheck: boolean
  } | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null)

  // Viewer modal state
  const [activeSheet, setActiveSheet] = useState<ExamSheetItem | null>(null)
  const [zoom, setZoom] = useState(100)
  const [reviewComment, setReviewComment] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'unreviewed' | 'recheck'>('all')

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  useEffect(() => {
    if (!cameraOpen) {
      stopCamera()
      return
    }
    let active = true
    setCameraError('')
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          if (!active) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch(() => {
          if (active) {
            setCameraError(
              'Live webcam unavailable on this device. Use "Capture via Device Camera / File" below or generate a sample scanned sheet.',
            )
          }
        })
    } else {
      setCameraError('Browser camera API unavailable. Use file upload or mobile camera capture.')
    }
    return () => {
      active = false
      stopCamera()
    }
  }, [cameraOpen])

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    method: ExamSheetItem['captureMethod'],
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isPdf = file.type === 'application/pdf'
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPreviewUrl(reader.result)
        setFileType(isPdf ? 'pdf' : 'image')
        setCaptureMethod(method)
        setScanEnhanced(method === 'Scan')
        notify(`${method} ready: ${file.name}`)
      }
    }
    reader.readAsDataURL(file)
  }

  const snapFromLiveCamera = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.88))
    setFileType('image')
    setCaptureMethod('Camera Photo')
    setCameraOpen(false)
    notify('Exam sheet photo captured!')
  }

  const loadSampleScan = () => {
    const stu = students.find((s) => s.id === studentId) || students[0]
    const svgUrl = createSampleExamSheetSvg({
      studentName: stu?.name || 'Student',
      subject,
      examTitle: examTitle || `${subject} Exam`,
      score: `${marksObtained || '44'}/${totalMarks || '50'}`,
      teacher: 'DMHA Examiner',
    })
    setPreviewUrl(svgUrl)
    setFileType('image')
    setCaptureMethod('Scan')
    setScanEnhanced(true)
    notify('High-contrast scanned answer sheet ready')
  }

  const handlePublishSheet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (uploadingSheet) return
    const stu = students.find((s) => s.id === studentId) || students[0]
    let finalUrl =
      previewUrl ||
      createSampleExamSheetSvg({
        studentName: stu?.name || 'Student',
        subject,
        examTitle: examTitle || `${subject} Exam`,
        score: `${marksObtained || '44'}/${totalMarks || '50'}`,
        teacher: 'DMHA Examiner',
      })

    // Persist uploaded/scanned/camera binary files to disk via /dmhs-api/uploads instead of bloating state JSON
    if (finalUrl.startsWith('data:')) {
      setUploadingSheet(true)
      try {
        const upRes = await fetch('/dmhs-api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl: finalUrl,
            folder: 'exam-sheets',
            filename: `${subject.toLowerCase().replace(/\s+/g, '-')}-${stu?.roll || 'sheet'}`,
          }),
        })
        if (upRes.ok) {
          const upJson = (await upRes.json()) as { ok: boolean; url?: string }
          if (upJson.ok && upJson.url) {
            finalUrl = upJson.url
          }
        }
      } catch {
        // Fallback to inline preview URL if upload endpoint is temporarily unavailable
      } finally {
        setUploadingSheet(false)
      }
    }

    uploadExamSheet({
      studentId: stu.id,
      subject,
      examTitle,
      marksObtained: Number(marksObtained) || 0,
      totalMarks: Number(totalMarks) || 50,
      captureMethod,
      scanEnhanced,
      fileType,
      fileDataUrl: finalUrl,
      teacherRemarks,
    })
    setPreviewUrl('')
    setTeacherRemarks('')
  }

  // Filter sheets according to role
  const roleScopedSheets =
    role === 'guardian'
      ? examSheets.filter((s) => s.studentId === selectedChildId)
      : role === 'student'
        ? examSheets.filter((s) => s.studentId === activeStudentId)
        : examSheets

  const visibleSheets = roleScopedSheets.filter((s) => {
    if (filterMode === 'unreviewed') return !s.guardianReviewed
    if (filterMode === 'recheck') return s.recheckRequested
    return true
  })

  return (
    <PageShell
      eyebrow="Transparent evaluation · Digital answer scripts"
      title="Exam Answer Sheets & Script Review"
      subtitle={
        canUpload
          ? 'Upload PDF/images, scan handwritten scripts with document enhancement, or take a live photo — instantly visible to Student, Guardian & Admin.'
          : 'Inspect graded exam answer sheets, review teacher markings, and submit recheck questions directly to the examiner.'
      }
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      {/* TEACHER / ADMIN CAPTURE & UPLOAD WORKSPACE */}
      {canUpload && (
        <section className="dmhs-card mb-8 rounded-[26px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-700">
                Examiner Capture Desk
              </p>
              <h3 className="mt-0.5 text-lg font-black text-slate-900">
                Upload, Scan, or Take Picture of Exam Sheet
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-slate-800"
              >
                <Icon name="sheet" size={14} />
                Upload File (Img / PDF)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCaptureMethod('Scan')
                  setScanEnhanced(true)
                  uploadInputRef.current?.click()
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-400"
              >
                <Icon name="clipboard" size={14} />
                Scan Document
              </button>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-800 transition hover:bg-slate-50"
              >
                <Icon name="video" size={14} />
                Take Picture (Camera)
              </button>
            </div>
          </div>

          {/* Hidden File & Mobile Camera Inputs */}
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => handleFileChange(e, captureMethod === 'Scan' ? 'Scan' : 'Upload')}
          />
          <input
            ref={cameraFileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFileChange(e, 'Camera Photo')}
          />

          <form onSubmit={handlePublishSheet} className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Student
                  <select
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900 outline-none"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.className} {s.section} · Roll #{s.roll})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Subject
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900 outline-none"
                  >
                    <option>Physics</option>
                    <option>Mathematics</option>
                    <option>Chemistry</option>
                    <option>English</option>
                    <option>Bangla</option>
                    <option>ICT & Robotics</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_100px_100px]">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Exam Title
                  <input
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="e.g., Mid-Term Paper 2"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none"
                  />
                </label>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Marks
                  <input
                    type="number"
                    min={0}
                    value={marksObtained}
                    onChange={(e) => setMarksObtained(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-xs font-black text-slate-900 outline-none"
                  />
                </label>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Out Of
                  <input
                    type="number"
                    min={1}
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-xs font-black text-slate-900 outline-none"
                  />
                </label>
              </div>

              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Examiner Remarks for Student & Guardian
                <textarea
                  rows={2}
                  value={teacherRemarks}
                  onChange={(e) => setTeacherRemarks(e.target.value)}
                  placeholder="Highlight strengths, lost marks, or topics to revise..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={scanEnhanced}
                    onChange={(e) => setScanEnhanced(e.target.checked)}
                    className="size-4 accent-emerald-600"
                  />
                  Apply High-Contrast Document Scan Filter
                </label>
                <button
                  type="button"
                  onClick={loadSampleScan}
                  className="text-xs font-extrabold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                >
                  Load Sample Scanned Script
                </button>
              </div>

              <button
                type="submit"
                disabled={uploadingSheet}
                className="mt-2 w-full rounded-xl bg-[#0f172a] py-3 text-xs font-extrabold text-emerald-400 shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                {uploadingSheet
                  ? 'Uploading Exam Script to DMHA Server Storage...'
                  : 'Publish Graded Exam Sheet to Student, Guardian & Admin'}
              </button>
            </div>

            {/* Live Script Preview Dropzone */}
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
              {previewUrl ? (
                <div className="w-full">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-extrabold text-slate-600">
                    <span>Preview · {captureMethod}</span>
                    <button
                      type="button"
                      onClick={() => setPreviewUrl('')}
                      className="text-rose-600 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  {fileType === 'pdf' ? (
                    <div className="rounded-xl bg-white p-6 text-xs font-bold text-slate-700 shadow-xs">
                      PDF Document Attached — Ready to Publish
                    </div>
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Exam sheet preview"
                      className="mx-auto max-h-60 rounded-xl border border-slate-200 object-contain shadow-xs"
                      style={
                        scanEnhanced
                          ? { filter: 'contrast(1.3) grayscale(0.85) brightness(1.05)' }
                          : undefined
                      }
                    />
                  )}
                </div>
              ) : (
                <div className="py-6">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-xs">
                    <Icon name="sheet" size={22} />
                  </span>
                  <p className="mt-3 text-xs font-black text-slate-800">
                    No script attached yet
                  </p>
                  <p className="mt-1 max-w-xs text-[11px] text-slate-500">
                    Click <strong>Upload File</strong>, <strong>Scan Document</strong>, or{' '}
                    <strong>Take Picture</strong> above — or publish directly to attach an
                    auto-generated sample scan.
                  </p>
                </div>
              )}
            </div>
          </form>
        </section>
      )}

      {/* FILTER BAR & SCRIPT GALLERY */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle
          eyebrow={role === 'admin' ? 'School-wide archive' : 'Graded scripts'}
          title={`Published Exam Sheets (${visibleSheets.length})`}
        />
        <div className="flex gap-1.5">
          {(
            [
              ['all', 'All Scripts'],
              ['unreviewed', 'Pending Review'],
              ['recheck', 'Recheck Requests'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilterMode(id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                filterMode === id
                  ? 'bg-[#0f172a] text-white'
                  : 'border border-slate-200 bg-white text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visibleSheets.length === 0 ? (
        <div className="dmhs-card rounded-2xl p-10 text-center text-xs font-bold text-slate-400">
          No exam answer sheets match this filter yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSheets.map((sheet) => {
            const pct = Math.round((sheet.marksObtained / sheet.totalMarks) * 100)
            return (
              <article
                key={sheet.id}
                className="dmhs-card flex flex-col overflow-hidden rounded-[24px] transition hover:-translate-y-0.5"
              >
                <button
                  onClick={() => {
                    setActiveSheet(sheet)
                    setZoom(100)
                    setReviewComment(sheet.guardianComment || '')
                  }}
                  className="relative h-48 w-full overflow-hidden border-b border-slate-100 bg-slate-100 text-left"
                >
                  {sheet.fileType === 'pdf' ? (
                    <div className="flex h-full items-center justify-center text-xs font-black text-slate-500">
                      PDF Script — Click to Open
                    </div>
                  ) : (
                    <img
                      src={sheet.fileDataUrl}
                      alt={`${sheet.studentName} ${sheet.subject} script`}
                      className="size-full object-cover object-top"
                      style={
                        sheet.scanEnhanced
                          ? { filter: 'contrast(1.25) brightness(1.03)' }
                          : undefined
                      }
                    />
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-[#0f172a]/90 px-2.5 py-1 text-[10px] font-black text-emerald-400 backdrop-blur">
                    {sheet.marksObtained}/{sheet.totalMarks} ({pct}%)
                  </span>
                  <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-slate-700 shadow-xs">
                    {sheet.captureMethod}
                  </span>
                </button>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700">
                      {sheet.subject}
                    </span>
                    {sheet.recheckRequested && (
                      <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-700">
                        Recheck Requested
                      </span>
                    )}
                    {sheet.adminVerified && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                        Admin Verified ✓
                      </span>
                    )}
                  </div>

                  <h4 className="mt-2 text-sm font-black text-slate-900">{sheet.examTitle}</h4>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                    {sheet.studentName} · {sheet.className}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-600">{sheet.teacherRemarks}</p>

                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] font-bold text-slate-400">
                    <span>
                      {sheet.guardianReviewed ? 'Guardian Reviewed ✓' : 'Awaiting Guardian Review'}
                    </span>
                    <button
                      onClick={() => {
                        setActiveSheet(sheet)
                        setZoom(100)
                        setReviewComment(sheet.guardianComment || '')
                      }}
                      className="font-extrabold text-slate-900 hover:text-emerald-700"
                    >
                      Inspect Script →
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* LIVE CAMERA SNAPSHOT MODAL */}
      {cameraOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setCameraOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-[26px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Take Exam Sheet Picture</h3>
              <button
                onClick={() => setCameraOpen(false)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {cameraError ? (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs font-semibold text-amber-800">
                {cameraError}
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl bg-slate-950">
                <video ref={videoRef} autoPlay playsInline className="h-64 w-full object-cover" />
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {!cameraError && (
                <button
                  onClick={snapFromLiveCamera}
                  className="flex-1 rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950"
                >
                  Capture Photo Now
                </button>
              )}
              <button
                onClick={() => {
                  setCameraOpen(false)
                  cameraFileInputRef.current?.click()
                }}
                className="flex-1 rounded-xl bg-[#0f172a] py-3 text-xs font-extrabold text-white"
              >
                Use Device Camera / File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZOOMABLE EXAM SCRIPT VIEWER & REVIEW MODAL */}
      {activeSheet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setActiveSheet(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-emerald-700">
                  DMHA Graded Answer Script · {activeSheet.captureMethod}
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  {activeSheet.studentName} — {activeSheet.subject}: {activeSheet.examTitle} (
                  {activeSheet.marksObtained}/{activeSheet.totalMarks})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom((z) => (z >= 150 ? 100 : z + 25))}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700"
                >
                  Zoom {zoom}%
                </button>
                <button
                  onClick={() => window.print()}
                  className="rounded-full bg-[#0f172a] px-3.5 py-1.5 text-xs font-extrabold text-emerald-400"
                >
                  Print / Save PDF
                </button>
                <button
                  onClick={() => setActiveSheet(null)}
                  className="flex size-9 items-center justify-center rounded-full bg-slate-100"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>

            <div className="grid flex-1 overflow-y-auto lg:grid-cols-[1.3fr_.7fr]">
              <div className="overflow-auto bg-slate-100 p-5">
                {activeSheet.fileType === 'pdf' ? (
                  <iframe
                    src={activeSheet.fileDataUrl}
                    title="Exam Sheet PDF"
                    className="h-[540px] w-full rounded-xl bg-white"
                  />
                ) : (
                  <img
                    src={activeSheet.fileDataUrl}
                    alt="Graded Exam Answer Sheet"
                    style={{
                      width: `${zoom}%`,
                      maxWidth: 'none',
                      filter: activeSheet.scanEnhanced
                        ? 'contrast(1.25) brightness(1.03)'
                        : undefined,
                    }}
                    className="mx-auto rounded-xl border border-slate-200 bg-white shadow-md"
                  />
                )}
              </div>

              <div className="flex flex-col justify-between border-l border-slate-200 p-5">
                <div className="space-y-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Examiner Remarks ({activeSheet.teacherName})
                    </p>
                    <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-700">
                      {activeSheet.teacherRemarks}
                    </p>
                  </div>

                  {activeSheet.guardianVerification && (
                    <div className="pt-1">
                      <VerificationSealBadge verification={activeSheet.guardianVerification} />
                    </div>
                  )}

                  {activeSheet.guardianComment && (
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                        Guardian Note
                      </p>
                      <p className="mt-1 text-xs font-semibold text-emerald-900">
                        {activeSheet.guardianComment}
                      </p>
                    </div>
                  )}

                  {(role === 'guardian' || role === 'student') && (
                    <div className="space-y-2.5">
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Review Comment or Recheck Question
                        <textarea
                          rows={3}
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Write a note to the teacher or ask about a specific question..."
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold outline-none"
                        />
                      </label>
                      <button
                        onClick={() => {
                          if (role === 'guardian') {
                            setPendingBiometricReview({
                              sheetId: activeSheet.id,
                              examTitle: `${activeSheet.subject} — ${activeSheet.examTitle}`,
                              studentName: activeSheet.studentName,
                              comment: reviewComment,
                              requestRecheck: false,
                            })
                            return
                          }
                          reviewExamSheet(activeSheet.id, {
                            comment: reviewComment,
                            requestRecheck: false,
                          })
                          setActiveSheet(null)
                        }}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-slate-950"
                      >
                        <Icon name="shield" size={14} />
                        {role === 'guardian'
                          ? 'Verify Biometric & Confirm Script ✓'
                          : 'Mark Script Reviewed ✓'}
                      </button>
                      <button
                        onClick={() => {
                          if (role === 'guardian') {
                            setPendingBiometricReview({
                              sheetId: activeSheet.id,
                              examTitle: `${activeSheet.subject} — ${activeSheet.examTitle}`,
                              studentName: activeSheet.studentName,
                              comment: reviewComment || 'Please recheck question totaling.',
                              requestRecheck: true,
                            })
                            return
                          }
                          reviewExamSheet(activeSheet.id, {
                            comment: reviewComment || 'Please recheck question totaling.',
                            requestRecheck: true,
                          })
                          setActiveSheet(null)
                        }}
                        className="w-full rounded-xl bg-rose-50 py-2.5 text-xs font-extrabold text-rose-700"
                      >
                        {role === 'guardian'
                          ? 'Verify Biometric & Request Recheck'
                          : 'Request Examiner Recheck'}
                      </button>
                    </div>
                  )}

                  {role === 'admin' && (
                    <button
                      onClick={() => {
                        verifyExamSheetByAdmin(activeSheet.id)
                        setActiveSheet(null)
                      }}
                      className="w-full rounded-xl bg-[#0f172a] py-3 text-xs font-extrabold text-emerald-400"
                    >
                      Verify & Approve Exam Script ✓
                    </button>
                  )}
                </div>

                <p className="mt-6 text-[10px] font-bold text-slate-400">
                  Uploaded {activeSheet.uploadedAt} · Visible to Student, Guardian, Teacher & Admin
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <GuardianBiometricGateModal
        open={!!pendingBiometricReview}
        actionTitle={
          pendingBiometricReview?.requestRecheck
            ? 'Confirm Script Recheck Request'
            : 'Confirm Exam Result Sheet Review'
        }
        actionDescription={
          pendingBiometricReview
            ? `Guardian confirmation for ${pendingBiometricReview.studentName}’s ${pendingBiometricReview.examTitle}.`
            : ''
        }
        onVerified={(stamp) => {
          if (pendingBiometricReview) {
            reviewExamSheet(pendingBiometricReview.sheetId, {
              comment: pendingBiometricReview.comment,
              requestRecheck: pendingBiometricReview.requestRecheck,
              verification: stamp,
            })
          }
          setPendingBiometricReview(null)
          setActiveSheet(null)
        }}
        onClose={() => setPendingBiometricReview(null)}
      />
    </PageShell>
  )
}
