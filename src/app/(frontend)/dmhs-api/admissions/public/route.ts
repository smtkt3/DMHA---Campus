import { NextResponse } from 'next/server'
import { appendPublicAdmissionToDb, appendSecurityAudit } from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { checkRateLimit, getClientIpFromRequest } from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const ip = getClientIpFromRequest(request)
    const rate = checkRateLimit(`public-admission:${ip}`, 10, 60 * 60 * 1000)
    if (!rate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Too many admission submissions from this network. Try again in ${rate.retryAfterSec}s.`,
        },
        { status: 429 },
      )
    }

    const body = (await request.json()) as {
      applicantName?: string
      applyingClass?: string
      targetSection?: string
      dob?: string
      previousSchool?: string
      guardianName?: string
      guardianRelation?: string
      guardianPhone?: string
      guardianEmail?: string
      bloodGroup?: string
      busRoute?: string
      notes?: string
    }

    const applicantName = (body.applicantName || '').trim().slice(0, 100)
    const applyingClass = (body.applyingClass || 'Pre-Play').trim().slice(0, 60)
    const targetSection = (body.targetSection || 'Section A').trim().slice(0, 30)
    const guardianName = (body.guardianName || '').trim().slice(0, 100)
    const guardianRelation = (body.guardianRelation || 'Guardian').trim().slice(0, 40)
    const guardianPhone = (body.guardianPhone || '').trim().slice(0, 30)
    const guardianEmail = (body.guardianEmail || '').trim().slice(0, 120)
    const bloodGroup = (body.bloodGroup || 'O+').trim().slice(0, 10)
    const busRoute = (body.busRoute || 'Unit - 1').trim().slice(0, 40)

    if (!applicantName || !guardianName || !guardianPhone) {
      return NextResponse.json(
        { ok: false, error: 'Applicant name, guardian name, and phone number are required.' },
        { status: 400 },
      )
    }

    const saved = appendPublicAdmissionToDb({
      applicantName,
      applyingClass,
      targetSection,
      dob: (body.dob || '').trim().slice(0, 30),
      previousSchool: (body.previousSchool || '').trim().slice(0, 120),
      guardianName,
      guardianRelation,
      guardianPhone,
      guardianEmail,
      bloodGroup,
      busRoute,
      notes: (body.notes || '').trim().slice(0, 300),
    })

    appendSecurityAudit({
      action: 'public_admission_submitted',
      target: `${saved.applicationCode} · ${applicantName}`,
      actor: guardianName,
      actorRole: 'public_applicant',
      ipAddress: ip,
    })

    broadcastDmhsEvent({
      type: 'state_updated',
      version: Date.now(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'Online Admissions Form',
      summary: `New admission application: ${applicantName} (${saved.applicationCode})`,
    })

    return NextResponse.json({
      ok: true,
      applicationCode: saved.applicationCode,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to submit admission form.' },
      { status: 500 },
    )
  }
}
