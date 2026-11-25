import { NextResponse } from 'next/server'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import {
  initialJobApplications,
  initialJobVacancies,
  initialLiveMeetings,
  initialQuestionBank,
  initialSchoolWebsiteConfig,
  initialStockItems,
  initialStockMovements,
} from '@/components/school/data'
import type {
  JobApplicationRecord,
  JobVacancyItem,
  LiveMeetingItem,
  QuestionBankItem,
  SchoolWebsiteConfig,
  StockItemRecord,
  StockMovementLog,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>

    const meetings: LiveMeetingItem[] = Array.isArray(currentData.liveMeetings)
      ? (currentData.liveMeetings as LiveMeetingItem[])
      : initialLiveMeetings
    const stockItems: StockItemRecord[] = Array.isArray(currentData.stockItems)
      ? (currentData.stockItems as StockItemRecord[])
      : initialStockItems
    const stockMovements: StockMovementLog[] = Array.isArray(currentData.stockMovements)
      ? (currentData.stockMovements as StockMovementLog[])
      : initialStockMovements
    const questionBank: QuestionBankItem[] = Array.isArray(currentData.questionBank)
      ? (currentData.questionBank as QuestionBankItem[])
      : initialQuestionBank
    const vacancies: JobVacancyItem[] = Array.isArray(currentData.jobVacancies)
      ? (currentData.jobVacancies as JobVacancyItem[])
      : initialJobVacancies
    const jobApplications: JobApplicationRecord[] = Array.isArray(currentData.jobApplications)
      ? (currentData.jobApplications as JobApplicationRecord[])
      : initialJobApplications
    const websiteConfig: SchoolWebsiteConfig =
      currentData.websiteConfig && typeof currentData.websiteConfig === 'object'
        ? (currentData.websiteConfig as SchoolWebsiteConfig)
        : initialSchoolWebsiteConfig
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []

    // ==================== 1. LIVE MEETINGS ====================
    if (action === 'create_meeting') {
      const title = String(body.title || '').trim().slice(0, 140)
      if (!title) {
        return NextResponse.json({ ok: false, error: 'Meeting title is required.' }, { status: 400 })
      }
      const platform = (body.platform as LiveMeetingItem['platform']) || 'Jitsi Meet (Instant)'
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)
      const roomUrl =
        String(body.roomUrl || '').trim() || `https://meet.jit.si/DMHA-${slug}-${Date.now().toString().slice(-4)}`
      const newMeeting: LiveMeetingItem = {
        id: `mtg-${Date.now()}`,
        title,
        hostName: String(body.hostName || session.display_name).trim(),
        audience: (body.audience as LiveMeetingItem['audience']) || 'All Faculty',
        platform,
        roomUrl,
        dateIso: String(body.dateIso || new Date().toISOString().slice(0, 10)),
        startTime: String(body.startTime || '04:00 PM'),
        durationMin: Math.max(15, Math.min(180, Number(body.durationMin || 45))),
        status: 'scheduled',
        attendeeCount: 0,
      }
      const nextMeetings = [newMeeting, ...meetings]
      const notif = {
        id: `notif-mtg-${Date.now()}`,
        title: `Live Meeting Scheduled · ${newMeeting.title}`,
        text: `${newMeeting.hostName} scheduled a ${newMeeting.platform} session for ${newMeeting.audience} on ${newMeeting.dateIso} at ${newMeeting.startTime}.`,
        time: 'Just now',
        type: 'notice',
        forRoles: ['admin', 'teacher', 'guardian', 'student'],
        read: false,
      }
      const nextNotifs = [notif, ...existingNotifs].slice(0, 80)
      const saved = savePersistedState(
        { ...currentData, liveMeetings: nextMeetings, notifications: nextNotifs },
        session.display_name,
      )
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: notif.title })
      return NextResponse.json({ ok: true, liveMeetings: nextMeetings, notifications: nextNotifs, version: saved.version })
    }

    if (action === 'update_meeting_status') {
      const meetingId = String(body.meetingId || '')
      const status = body.status as LiveMeetingItem['status']
      const recordingUrl = String(body.recordingUrl || '').trim()
      const nextMeetings = meetings.map((m) =>
        m.id === meetingId
          ? {
              ...m,
              status,
              recordingUrl: recordingUrl || m.recordingUrl,
              attendeeCount: status === 'live' ? Math.max(m.attendeeCount, 1) : m.attendeeCount,
            }
          : m,
      )
      const saved = savePersistedState({ ...currentData, liveMeetings: nextMeetings }, session.display_name)
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: `Meeting status: ${status}` })
      return NextResponse.json({ ok: true, liveMeetings: nextMeetings, version: saved.version })
    }

    if (action === 'delete_meeting') {
      const meetingId = String(body.meetingId || '')
      const nextMeetings = meetings.filter((m) => m.id !== meetingId)
      const saved = savePersistedState({ ...currentData, liveMeetings: nextMeetings }, session.display_name)
      return NextResponse.json({ ok: true, liveMeetings: nextMeetings, version: saved.version })
    }

    // ==================== 2. STOCK MANAGEMENT ====================
    if (action === 'add_stock_item') {
      const name = String(body.name || '').trim().slice(0, 140)
      const sku = String(body.sku || `SKU-${Date.now().toString().slice(-5)}`).trim().toUpperCase()
      const quantity = Math.max(0, Math.round(Number(body.quantity || 0)))
      const minThreshold = Math.max(1, Math.round(Number(body.minThreshold || 5)))
      const unitCostBdt = Math.max(0, Math.round(Number(body.unitCostBdt || 0)))
      if (!name) {
        return NextResponse.json({ ok: false, error: 'Stock item name is required.' }, { status: 400 })
      }
      const newItem: StockItemRecord = {
        id: `stk-${Date.now()}`,
        sku,
        name,
        category: (body.category as StockItemRecord['category']) || 'Books & Stationery',
        campusUnit: String(body.campusUnit || 'Unit - 1'),
        quantity,
        unitLabel: String(body.unitLabel || 'Units').trim(),
        minThreshold,
        unitCostBdt,
        lastUpdated: new Date().toISOString().slice(0, 10),
      }
      const nextItems = [newItem, ...stockItems]
      const saved = savePersistedState({ ...currentData, stockItems: nextItems }, session.display_name)
      return NextResponse.json({ ok: true, stockItems: nextItems, version: saved.version })
    }

    if (action === 'record_stock_movement') {
      const itemId = String(body.itemId || '')
      const type = body.type === 'OUT' ? 'OUT' : 'IN'
      const qty = Math.round(Number(body.quantity || 0))
      const party = String(body.party || '').trim() || (type === 'IN' ? 'Vendor Purchase' : 'Campus Department')
      const note = String(body.note || '').trim().slice(0, 240)
      const target = stockItems.find((i) => i.id === itemId)
      if (!target || qty <= 0) {
        return NextResponse.json({ ok: false, error: 'Select a valid stock item and positive quantity.' }, { status: 400 })
      }
      if (type === 'OUT' && qty > target.quantity) {
        return NextResponse.json(
          { ok: false, error: `Insufficient stock: only ${target.quantity} ${target.unitLabel} available.` },
          { status: 409 },
        )
      }
      const nextItems = stockItems.map((i) =>
        i.id === itemId
          ? {
              ...i,
              quantity: type === 'IN' ? i.quantity + qty : i.quantity - qty,
              lastUpdated: new Date().toISOString().slice(0, 10),
            }
          : i,
      )
      const newLog: StockMovementLog = {
        id: `smv-${Date.now()}`,
        itemId: target.id,
        itemName: target.name,
        type,
        quantity: qty,
        party,
        note: note || (type === 'IN' ? 'Stock restocked' : 'Stock issued'),
        recordedBy: session.display_name,
        recordedAt: new Date().toISOString().slice(0, 10),
      }
      const nextMovements = [newLog, ...stockMovements].slice(0, 200)
      const saved = savePersistedState(
        { ...currentData, stockItems: nextItems, stockMovements: nextMovements },
        session.display_name,
      )
      appendSecurityAudit({
        action: `stock_${type.toLowerCase()}`,
        target: `${target.name} (${type === 'IN' ? '+' : '-'}${qty}) · ${party}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: `Stock ${type}: ${target.name} (${qty})` })
      return NextResponse.json({
        ok: true,
        stockItems: nextItems,
        stockMovements: nextMovements,
        version: saved.version,
      })
    }

    // ==================== 3. QUESTION BANK ====================
    if (action === 'add_question') {
      const prompt = String(body.prompt || '').trim().slice(0, 800)
      const correctAnswer = String(body.correctAnswer || '').trim().slice(0, 600)
      if (!prompt || !correctAnswer) {
        return NextResponse.json({ ok: false, error: 'Question prompt and answer/rubric are required.' }, { status: 400 })
      }
      const qType = (body.type as QuestionBankItem['type']) || 'MCQ'
      const rawOptions = Array.isArray(body.options)
        ? (body.options as string[]).map((o) => String(o).trim()).filter(Boolean)
        : undefined
      const newQ: QuestionBankItem = {
        id: `qb-${Date.now()}`,
        className: String(body.className || 'Class 6'),
        subject: String(body.subject || 'Physics'),
        chapter: String(body.chapter || 'General Revision').trim(),
        type: qType,
        difficulty: (body.difficulty as QuestionBankItem['difficulty']) || 'Medium',
        marks: Math.max(1, Math.min(25, Math.round(Number(body.marks || 2)))),
        prompt,
        options: qType === 'MCQ' && rawOptions?.length ? rawOptions : undefined,
        correctAnswer,
        createdBy: session.display_name,
        createdAt: new Date().toISOString().slice(0, 10),
      }
      const nextQ = [newQ, ...questionBank]
      const saved = savePersistedState({ ...currentData, questionBank: nextQ }, session.display_name)
      return NextResponse.json({ ok: true, questionBank: nextQ, version: saved.version })
    }

    if (action === 'delete_question') {
      const questionId = String(body.questionId || '')
      const nextQ = questionBank.filter((q) => q.id !== questionId)
      const saved = savePersistedState({ ...currentData, questionBank: nextQ }, session.display_name)
      return NextResponse.json({ ok: true, questionBank: nextQ, version: saved.version })
    }

    // ==================== 4. JOB VACANCIES & APPLICATIONS ====================
    if (action === 'create_vacancy') {
      const title = String(body.title || '').trim().slice(0, 140)
      if (!title) {
        return NextResponse.json({ ok: false, error: 'Job vacancy title is required.' }, { status: 400 })
      }
      const newVac: JobVacancyItem = {
        id: `vac-${Date.now()}`,
        title,
        department: String(body.department || 'Academic Faculty').trim(),
        campusUnit: String(body.campusUnit || 'Unit - 1'),
        employmentType: (body.employmentType as JobVacancyItem['employmentType']) || 'Full-Time',
        salaryRange: String(body.salaryRange || 'Negotiable').trim(),
        deadlineIso: String(body.deadlineIso || '2026-12-31'),
        status: 'open',
        requirements: String(body.requirements || '').trim().slice(0, 500),
      }
      const nextVacs = [newVac, ...vacancies]
      const saved = savePersistedState({ ...currentData, jobVacancies: nextVacs }, session.display_name)
      return NextResponse.json({ ok: true, jobVacancies: nextVacs, version: saved.version })
    }

    if (action === 'toggle_vacancy_status') {
      const vacancyId = String(body.vacancyId || '')
      const nextVacs: JobVacancyItem[] = vacancies.map((v) =>
        v.id === vacancyId ? { ...v, status: v.status === 'open' ? 'closed' : 'open' } : v,
      )
      const saved = savePersistedState({ ...currentData, jobVacancies: nextVacs }, session.display_name)
      return NextResponse.json({ ok: true, jobVacancies: nextVacs, version: saved.version })
    }

    if (action === 'update_application_stage') {
      const applicationId = String(body.applicationId || '')
      const stage = body.stage as JobApplicationRecord['stage']
      const adminNotes = String(body.adminNotes || '').trim().slice(0, 400)
      if (!['applied', 'shortlisted', 'demo_class', 'hired', 'rejected'].includes(stage)) {
        return NextResponse.json({ ok: false, error: 'Invalid applicant stage.' }, { status: 400 })
      }
      const nextApps = jobApplications.map((a) =>
        a.id === applicationId
          ? { ...a, stage, adminNotes: adminNotes || a.adminNotes }
          : a,
      )
      const saved = savePersistedState({ ...currentData, jobApplications: nextApps }, session.display_name)
      appendSecurityAudit({
        action: 'job_application_updated',
        target: `${applicationId} -> ${stage}`,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: `Job applicant updated (${stage})` })
      return NextResponse.json({ ok: true, jobApplications: nextApps, version: saved.version })
    }

    // ==================== 5. WEBSITE DESIGN CMS ====================
    if (action === 'save_website_config') {
      const incoming = (body.config || {}) as Partial<SchoolWebsiteConfig>
      const nextConfig: SchoolWebsiteConfig = {
        ...websiteConfig,
        schoolName: String(incoming.schoolName ?? websiteConfig.schoolName).trim().slice(0, 120),
        heroHeadline: String(incoming.heroHeadline ?? websiteConfig.heroHeadline).trim().slice(0, 200),
        heroSubheadline: String(incoming.heroSubheadline ?? websiteConfig.heroSubheadline).trim().slice(0, 320),
        announcementTicker: String(incoming.announcementTicker ?? websiteConfig.announcementTicker).trim().slice(0, 320),
        admissionsBannerActive:
          typeof incoming.admissionsBannerActive === 'boolean'
            ? incoming.admissionsBannerActive
            : websiteConfig.admissionsBannerActive,
        admissionsBannerText: String(incoming.admissionsBannerText ?? websiteConfig.admissionsBannerText).trim().slice(0, 140),
        principalName: String(incoming.principalName ?? websiteConfig.principalName).trim().slice(0, 100),
        principalMessage: String(incoming.principalMessage ?? websiteConfig.principalMessage).trim().slice(0, 500),
        hotlinePhone: String(incoming.hotlinePhone ?? websiteConfig.hotlinePhone).trim().slice(0, 60),
        contactEmail: String(incoming.contactEmail ?? websiteConfig.contactEmail).trim().slice(0, 100),
        campusAddress: String(incoming.campusAddress ?? websiteConfig.campusAddress).trim().slice(0, 200),
        accentTheme: incoming.accentTheme || websiteConfig.accentTheme,
        updatedAt: new Date().toISOString().slice(0, 10),
        updatedBy: session.display_name,
      }
      const saved = savePersistedState({ ...currentData, websiteConfig: nextConfig }, session.display_name)
      appendSecurityAudit({
        action: 'website_cms_updated',
        target: nextConfig.heroHeadline,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({ type: 'state_updated', version: saved.version, updatedAt: saved.updatedAt, updatedBy: session.display_name, summary: 'School Website CMS updated' })
      return NextResponse.json({ ok: true, websiteConfig: nextConfig, version: saved.version })
    }

    return NextResponse.json({ ok: false, error: `Unknown erp-campus action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'ERP campus request failed.' },
      { status: 500 },
    )
  }
}
