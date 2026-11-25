import { NextResponse } from 'next/server'
import { appendSecurityAudit, loadPersistedState, savePersistedState } from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest } from '@/lib/dmhs-security'
import { initialJobApplications, initialJobVacancies } from '@/components/school/data'
import type { JobApplicationRecord, JobVacancyItem } from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const state = loadPersistedState()
  const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
  const vacancies: JobVacancyItem[] = Array.isArray(currentData.jobVacancies)
    ? (currentData.jobVacancies as JobVacancyItem[])
    : initialJobVacancies
  return NextResponse.json({
    ok: true,
    vacancies: vacancies.filter((v) => v.status === 'open'),
  })
}

export async function POST(request: Request) {
  try {
    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const vacancyId = String(body.vacancyId || '').trim()
    const applicantName = String(body.applicantName || '').trim().slice(0, 120)
    const email = String(body.email || '').trim().slice(0, 120)
    const phone = String(body.phone || '').trim().slice(0, 40)
    const qualification = String(body.qualification || '').trim().slice(0, 180)
    const experienceYears = String(body.experienceYears || '1 Year').trim().slice(0, 40)
    const expectedSalary = String(body.expectedSalary || 'Negotiable').trim().slice(0, 60)
    const coverNote = String(body.coverNote || '').trim().slice(0, 600)

    if (!applicantName || !email || !phone || !qualification) {
      return NextResponse.json(
        { ok: false, error: 'Name, email, phone, and academic qualification are required.' },
        { status: 400 },
      )
    }

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const vacancies: JobVacancyItem[] = Array.isArray(currentData.jobVacancies)
      ? (currentData.jobVacancies as JobVacancyItem[])
      : initialJobVacancies
    const apps: JobApplicationRecord[] = Array.isArray(currentData.jobApplications)
      ? (currentData.jobApplications as JobApplicationRecord[])
      : initialJobApplications
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []

    const matchedVac = vacancies.find((v) => v.id === vacancyId && v.status === 'open') || vacancies[0]
    const newApp: JobApplicationRecord = {
      id: `app-job-${Date.now()}`,
      vacancyId: matchedVac?.id || 'general',
      vacancyTitle: matchedVac?.title || 'General Teaching / Staff Application',
      applicantName,
      email,
      phone,
      qualification,
      experienceYears,
      expectedSalary,
      coverNote,
      stage: 'applied',
      appliedAt: new Date().toISOString().slice(0, 10),
    }

    const nextApps = [newApp, ...apps]
    const notif = {
      id: `notif-job-${Date.now()}`,
      title: `New Job Application · ${applicantName}`,
      text: `${applicantName} applied for ${newApp.vacancyTitle} (${qualification}, ${experienceYears}).`,
      time: 'Just now',
      type: 'notice',
      forRoles: ['admin'],
      read: false,
    }
    const nextNotifs = [notif, ...existingNotifs].slice(0, 80)

    const saved = savePersistedState(
      { ...currentData, jobApplications: nextApps, notifications: nextNotifs },
      `Public Career Portal (${applicantName})`,
    )
    appendSecurityAudit({
      action: 'public_job_application_submitted',
      target: `${applicantName} -> ${newApp.vacancyTitle}`,
      actor: applicantName,
      actorRole: 'public',
      ipAddress: ip,
    })
    broadcastDmhsEvent({
      type: 'state_updated',
      version: saved.version,
      updatedAt: saved.updatedAt,
      updatedBy: applicantName,
      summary: notif.title,
    })

    return NextResponse.json({ ok: true, applicationId: newApp.id, vacancyTitle: newApp.vacancyTitle })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Application submission failed.' },
      { status: 500 },
    )
  }
}
