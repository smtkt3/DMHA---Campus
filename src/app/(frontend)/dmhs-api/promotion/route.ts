import { NextResponse } from 'next/server'
import { appendSecurityAudit, loadPersistedState, savePersistedState } from '@/lib/dmhs-db'
import { computeExamTabulation, initialExamBook } from '@/lib/dmhs-exams'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'
import type { AlumniRecord, ExamBookState, StudentRecord } from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>

    const fromClass = String(body.fromClass || '').trim()
    const toClass = String(body.toClass || '').trim()
    const minPassScore = Math.max(0, Math.min(100, Number(body.minPassScore ?? 40)))
    const archiveAsAlumni = Boolean(body.archiveAsAlumni)
    const examId = String(body.examId || '').trim()
    const enforceExamPass = body.enforceExamPass !== false
    const overrideStudentIds = new Set<string>(
      Array.isArray(body.overrideStudentIds)
        ? (body.overrideStudentIds as unknown[]).map((x) => String(x))
        : [],
    )

    if (!fromClass || (!archiveAsAlumni && !toClass)) {
      return NextResponse.json(
        { ok: false, error: 'Source class and target class (or alumni graduation) are required.' },
        { status: 400 },
      )
    }

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const students: StudentRecord[] = Array.isArray(currentData.students)
      ? (currentData.students as StudentRecord[])
      : []
    const alumni: AlumniRecord[] = Array.isArray(currentData.alumni)
      ? (currentData.alumni as AlumniRecord[])
      : []
    const existingNotifs = Array.isArray(currentData.notifications)
      ? (currentData.notifications as Array<Record<string, unknown>>)
      : []
    const examBook: ExamBookState =
      currentData.examBook && typeof currentData.examBook === 'object'
        ? (currentData.examBook as ExamBookState)
        : initialExamBook

    // Resolve target published exam (explicit examId or latest published exam)
    const targetExam =
      (examId ? examBook.declaredExams.find((e) => e.id === examId) : undefined) ||
      examBook.declaredExams.find((e) => e.status === 'published') ||
      examBook.declaredExams[0]

    const tabMap = new Map<
      string,
      { averagePercent: number; gpa: number; grade: string; passed: boolean }
    >()
    if (targetExam) {
      const tab = computeExamTabulation(examBook, targetExam.id, 'All', 'All')
      tab.rows.forEach((row) => {
        tabMap.set(row.studentId, {
          averagePercent: row.averagePercent,
          gpa: row.gpa,
          grade: row.grade,
          passed: row.passed,
        })
      })
    }

    let promotedCount = 0
    let retainedCount = 0
    let graduatedCount = 0
    let examBlockedCount = 0
    const newAlumni: AlumniRecord[] = []
    const nextStudents: StudentRecord[] = []

    const todayDateLabel = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

    for (const stu of students) {
      if (stu.className !== fromClass || stu.status === 'suspended') {
        nextStudents.push(stu)
        continue
      }

      const examResult = tabMap.get(stu.id)
      const effectiveAvg = examResult ? examResult.averagePercent : stu.averageScore
      const failedInExam = enforceExamPass && examResult ? !examResult.passed : false
      const isOverridden = overrideStudentIds.has(stu.id)
      const eligible = isOverridden || (!failedInExam && effectiveAvg >= minPassScore)

      if (!eligible) {
        retainedCount += 1
        if (failedInExam) examBlockedCount += 1
        nextStudents.push(stu)
        continue
      }

      if (archiveAsAlumni) {
        graduatedCount += 1
        newAlumni.push({
          id: `alu-${Date.now()}-${stu.id}`,
          studentName: stu.name,
          graduatedClass: `${stu.className} · ${stu.section}`,
          roll: stu.roll,
          graduationYear: String(new Date().getFullYear()),
          finalAverage: effectiveAvg,
          guardianName: stu.guardianName,
          archivedAt: todayDateLabel,
        })
      } else {
        promotedCount += 1
        nextStudents.push({
          ...stu,
          className: toClass,
          averageScore: effectiveAvg,
          gpa: examResult ? examResult.gpa.toFixed(2) : stu.gpa,
        })
      }
    }

    const nextAlumni = [...newAlumni, ...alumni]
    const notif = {
      id: `notif-prom-${Date.now()}`,
      title: archiveAsAlumni
        ? `Class Graduated to Alumni · ${fromClass}`
        : `Year-End Promotion Complete · ${fromClass} → ${toClass}`,
      text: archiveAsAlumni
        ? `${graduatedCount} student(s) graduated from ${fromClass} to DMHA Alumni Archive (${retainedCount} retained${targetExam ? ` · Verified via ${targetExam.title}` : ''}).`
        : `${promotedCount} student(s) promoted from ${fromClass} → ${toClass} (${retainedCount} retained${examBlockedCount > 0 ? `, ${examBlockedCount} flagged by exam fail` : ''}).`,
      time: 'Just now',
      type: 'result',
      forRoles: ['admin', 'teacher', 'guardian'],
      read: false,
    }

    const saved = savePersistedState(
      {
        ...currentData,
        students: nextStudents,
        alumni: nextAlumni,
        notifications: [notif, ...existingNotifs].slice(0, 80),
      },
      session.display_name,
    )

    appendSecurityAudit({
      action: archiveAsAlumni ? 'class_graduated_alumni' : 'class_cohort_promoted',
      target: archiveAsAlumni
        ? `${fromClass} -> Alumni (${graduatedCount} graduated, ${retainedCount} retained)`
        : `${fromClass} -> ${toClass} (${promotedCount} promoted, ${retainedCount} retained, exam: ${targetExam?.title || 'Score Average'})`,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: ip,
    })

    broadcastDmhsEvent({
      type: 'state_updated',
      version: saved.version,
      updatedAt: saved.updatedAt,
      updatedBy: session.display_name,
      summary: archiveAsAlumni
        ? `Graduated ${graduatedCount} student(s) from ${fromClass}`
        : `Promoted ${promotedCount} student(s) ${fromClass} -> ${toClass}`,
    })

    return NextResponse.json({
      ok: true,
      promotedCount,
      retainedCount,
      graduatedCount,
      examBlockedCount,
      verifiedExamTitle: targetExam?.title || null,
      students: nextStudents,
      alumni: nextAlumni,
      version: saved.version,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Class promotion failed.' },
      { status: 500 },
    )
  }
}
