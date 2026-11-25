'use client'

import React, { useMemo, useState } from 'react'
import { DEFAULT_DMHS_GRADING_SCALE } from '@/lib/dmhs-exams'
import { DMHS_CLASS_SECTIONS } from './data'
import {
  ExamAttendanceSection,
  ExamDeclareSection,
  ExamMarkListSection,
  ExamMarksEntrySection,
} from './exam-level1-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type {
  AnswerScriptDispatch,
  DeclaredExamItem,
  ExamCommitteeMember,
  ExamGradeRule,
  ExamInvigilatorAssignment,
  QuestionPaperDispatch,
  StudentRecord,
} from './types'
import { PageShell } from './ui'

export type ExamSubTab =
  | 'declare'
  | 'attendance'
  | 'marks'
  | 'marklist'
  | 'admit'
  | 'seatplan'
  | 'invigilators'
  | 'papers'
  | 'settings'

const COMMON_SUBJECTS = [
  'Physics',
  'Mathematics',
  'English',
  'General Science',
  'Bangla',
  'ICT & Coding',
  'Social Studies',
]

const CLASS_CHIP_STYLES = [
  'border-emerald-200 bg-emerald-50 text-emerald-900',
  'border-sky-200 bg-sky-50 text-sky-900',
  'border-violet-200 bg-violet-50 text-violet-900',
  'border-amber-200 bg-amber-50 text-amber-900',
  'border-rose-200 bg-rose-50 text-rose-900',
  'border-teal-200 bg-teal-50 text-teal-900',
]

function getClassChipClass(classLabel: string): string {
  let hash = 0
  for (let i = 0; i < classLabel.length; i++) {
    hash = (hash * 31 + classLabel.charCodeAt(i)) % CLASS_CHIP_STYLES.length
  }
  return CLASS_CHIP_STYLES[Math.abs(hash) % CLASS_CHIP_STYLES.length]
}

// ==================== 5. ADMIT CARDS (INDIVIDUAL + BULK A4 PRINT) ====================
function PrintableAdmitCardSheet({
  exam,
  student,
  seatLabel,
  routineRows,
  instructions,
}: {
  exam: DeclaredExamItem
  student: StudentRecord
  seatLabel: string
  routineRows: Array<{ date: string; timeSlot: string; subject: string; room: string }>
  instructions: string
}) {
  const verifyCode = `DMHA-ADMIT-${exam.code}-${student.roll}`
  return (
    <div className="rounded-3xl border-2 border-slate-900 bg-white p-6 text-slate-900 shadow-sm print:break-after-page print:rounded-none print:shadow-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-slate-900 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#0f172a] text-xl font-black text-emerald-400">
            D
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">
              DMHA · Smart Learning Academy · Dhaka
            </p>
            <h4 className="text-lg font-black tracking-tight text-slate-950">
              OFFICIAL EXAMINATION ADMIT CARD
            </h4>
            <p className="text-xs font-bold text-slate-600">
              {exam.title} · {exam.termName} ({exam.academicYear})
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-right">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            Exam Code / Verification
          </p>
          <p className="font-mono text-xs font-black text-slate-900">{verifyCode}</p>
          <p className="text-[10px] font-bold text-emerald-700">
            {exam.startDateIso} → {exam.endDateIso}
          </p>
        </div>
      </div>

      {/* Student + Hall Seat Info */}
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_210px]">
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Candidate Name</p>
            <p className="mt-0.5 text-sm font-black text-slate-950">{student.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Class &amp; Roll No.</p>
            <p className="mt-0.5 text-sm font-black text-slate-950">
              {student.className} ({student.section}) · #{student.roll}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Guardian</p>
            <p className="mt-0.5 font-bold text-slate-800">{student.guardianName}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">House / Blood Group</p>
            <p className="mt-0.5 font-bold text-slate-800">
              {student.house || 'Emerald'} · {student.bloodGroup}
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border-2 border-emerald-600 bg-emerald-50/60 p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
            Assigned Examination Seat
          </p>
          <p className="my-2 text-sm font-black text-slate-950">{seatLabel}</p>
          <div className="mx-auto inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-mono text-[10px] font-black text-slate-700 ring-1 ring-emerald-200">
            <Icon name="qr" size={12} className="text-emerald-700" />
            VERIFIED HALL PASS
          </div>
        </div>
      </div>

      {/* Routine Table */}
      <div className="mt-4">
        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
          Examination Schedule &amp; Reporting Time
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Time Slot</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Venue</th>
                <th className="px-3 py-2 text-right">Invigilator Sign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routineRows.map((r, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2 font-bold text-slate-800">{r.date}</td>
                  <td className="px-3 py-2 text-slate-600">{r.timeSlot}</td>
                  <td className="px-3 py-2 font-black text-slate-900">{r.subject}</td>
                  <td className="px-3 py-2 text-slate-600">{r.room}</td>
                  <td className="px-3 py-2 text-right text-slate-300">____________</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instructions & Signatures */}
      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
        <strong className="font-black text-slate-800">Hall Instructions:</strong> {instructions}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-8 pt-2 text-center text-[11px]">
        <div>
          <div className="mx-auto w-44 border-t border-slate-400 pt-1.5 font-bold text-slate-700">
            Class Teacher Signature
          </div>
        </div>
        <div>
          <div className="mx-auto w-48 border-t border-slate-900 pt-1.5 font-black text-slate-950">
            Controller of Examinations · DMHA
          </div>
        </div>
      </div>
    </div>
  )
}

export function ExamAdmitCardsSection({
  exam,
  onJumpToSeatPlan,
}: {
  exam: DeclaredExamItem
  onJumpToSeatPlan?: () => void
}) {
  const { students, fees, examSchedules, examBook } = useSchool()
  const [classFilter, setClassFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [provisionalOverride, setProvisionalOverride] = useState(false)
  const [previewStudent, setPreviewStudent] = useState<StudentRecord | null>(null)
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false)

  const classList = useMemo(
    () => ['All', ...Array.from(new Set(students.map((s) => `${s.className} · ${s.section}`)))],
    [students],
  )

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students.filter((s) => {
      if (s.status === 'suspended') return false
      const cls = `${s.className} · ${s.section}`
      if (classFilter !== 'All' && cls !== classFilter) return false
      if (q && !`${s.name} ${s.roll} ${cls}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [students, classFilter, search])

  const seatByStudentId = useMemo(() => {
    const map = new Map<string, string>()
    examBook.seatAllocations
      .filter((a) => a.examId === exam.id)
      .forEach((a) => map.set(a.studentId, `${a.roomName} · ${a.benchLabel}-Seat ${a.seatNo}`))
    return map
  }, [examBook.seatAllocations, exam.id])

  const dueAmountByStudentId = useMemo(() => {
    const map = new Map<string, number>()
    fees
      .filter((f) => f.status === 'due')
      .forEach((f) => map.set(f.studentId, (map.get(f.studentId) || 0) + f.amount))
    return map
  }, [fees])

  const getRoutineForStudent = (stu: StudentRecord) => {
    const matching = examSchedules.filter(
      (es) =>
        es.className.toLowerCase().includes(stu.className.toLowerCase()) ||
        es.className.toLowerCase() === 'all',
    )
    if (matching.length > 0) {
      return matching.map((m) => ({
        date: m.date,
        timeSlot: m.timeSlot,
        subject: m.subject,
        room: m.room,
      }))
    }
    return [
      { date: exam.startDateIso, timeSlot: '09:00 AM – 11:00 AM', subject: 'English', room: 'Assigned Hall' },
      { date: exam.startDateIso, timeSlot: '11:30 AM – 01:30 PM', subject: 'Mathematics', room: 'Assigned Hall' },
      { date: exam.endDateIso, timeSlot: '09:00 AM – 11:00 AM', subject: 'Physics / General Science', room: 'Assigned Hall' },
    ]
  }

  const feeGateEnabled = examBook.settings.requireFeeClearanceForAdmit
  const eligibleStudents = filteredStudents.filter(
    (s) => !feeGateEnabled || provisionalOverride || (dueAmountByStudentId.get(s.id) || 0) === 0,
  )

  return (
    <div className="space-y-5">
      {/* Filter & Bulk Action Strip */}
      <div className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-[24px] p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800"
          >
            {classList.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All Classes' : c}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or roll..."
            className="w-52 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
          />
          <span
            className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
              feeGateEnabled ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            Fee Clearance Gate: {feeGateEnabled ? 'ACTIVE' : 'OFF'}
          </span>
          {feeGateEnabled && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700">
              <input
                type="checkbox"
                checked={provisionalOverride}
                onChange={(e) => setProvisionalOverride(e.target.checked)}
                className="accent-emerald-600"
              />
              Provisional Override
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {seatByStudentId.size === 0 && onJumpToSeatPlan && (
            <button
              type="button"
              onClick={onJumpToSeatPlan}
              className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-extrabold text-amber-800 hover:bg-amber-100"
            >
              Generate Seat Plan First →
            </button>
          )}
          <button
            type="button"
            disabled={eligibleStudents.length === 0}
            onClick={() => setBulkPrintOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-4 py-2.5 text-xs font-extrabold text-emerald-300 shadow-xs transition hover:bg-slate-800 disabled:opacity-40"
          >
            <Icon name="print" size={14} />
            Bulk Print Eligible ({eligibleStudents.length})
          </button>
        </div>
      </div>

      {/* Student Admit Card Roster */}
      <div className="dmhs-card overflow-x-auto rounded-[24px] p-4">
        <table className="w-full min-w-[740px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="py-2.5 pr-3">Roll</th>
              <th className="py-2.5 pr-3">Candidate &amp; Class</th>
              <th className="py-2.5 pr-3">Assigned Hall &amp; Bench</th>
              <th className="py-2.5 pr-3">Fee Clearance</th>
              <th className="py-2.5 text-right">Admit Card Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.map((stu) => {
              const due = dueAmountByStudentId.get(stu.id) || 0
              const seat = seatByStudentId.get(stu.id)
              const blocked = feeGateEnabled && due > 0 && !provisionalOverride
              return (
                <tr key={stu.id} className="hover:bg-slate-50/70">
                  <td className="py-3 pr-3 font-mono font-black text-slate-700">#{stu.roll}</td>
                  <td className="py-3 pr-3">
                    <p className="font-extrabold text-slate-900">{stu.name}</p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {stu.className} · {stu.section} · Guardian: {stu.guardianName}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    {seat ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800">
                        <Icon name="check" size={12} />
                        {seat}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                        Not Seated Yet
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {due === 0 ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                        Cleared ✓
                      </span>
                    ) : (
                      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-700">
                        ৳{due.toLocaleString()} Due
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => setPreviewStudent(stu)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-extrabold transition ${
                        blocked
                          ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                          : 'bg-[#0f172a] text-emerald-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon name="print" size={13} />
                      {blocked ? 'Fee Hold' : 'Preview & Print A4'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Single Student Printable Admit Card Modal */}
      {previewStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setPreviewStudent(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="dmhs-print-receipt max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between print:hidden">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  A4 Print Preview
                </p>
                <h3 className="text-sm font-black text-slate-900">
                  Admit Card · {previewStudent.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-700"
                >
                  <Icon name="print" size={14} />
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewStudent(null)}
                  className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>

            <PrintableAdmitCardSheet
              exam={exam}
              student={previewStudent}
              seatLabel={seatByStudentId.get(previewStudent.id) || 'Room Assigned at Gate'}
              routineRows={getRoutineForStudent(previewStudent)}
              instructions={exam.instructions || examBook.settings.admitCardInstructions}
            />
          </div>
        </div>
      )}

      {/* Bulk Printable Admit Cards Modal */}
      {bulkPrintOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setBulkPrintOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="dmhs-print-receipt max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-slate-100 p-5 shadow-2xl print:bg-white print:p-0"
          >
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow-xs print:hidden">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Bulk Admit Card Pack · {eligibleStudents.length} Candidate(s)
                </h3>
                <p className="text-[11px] font-semibold text-slate-500">
                  Each admit card automatically page-breaks onto its own A4 sheet when printed.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-700"
                >
                  <Icon name="print" size={14} />
                  Print All ({eligibleStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBulkPrintOpen(false)}
                  className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {eligibleStudents.map((stu) => (
                <PrintableAdmitCardSheet
                  key={stu.id}
                  exam={exam}
                  student={stu}
                  seatLabel={seatByStudentId.get(stu.id) || 'Room Assigned at Gate'}
                  routineRows={getRoutineForStudent(stu)}
                  instructions={exam.instructions || examBook.settings.admitCardInstructions}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== 6. EXAM SEAT PLAN & SEAT-WISE HALL ATTENDANCE ====================
export function ExamSeatPlanSection({ exam }: { exam: DeclaredExamItem }) {
  const { examBook, students, runExamAction } = useSchool()
  const [subMode, setSubMode] = useState<'bench_map' | 'hall_attendance'>('bench_map')
  const [selectedRoomId, setSelectedRoomId] = useState<string>(examBook.examRooms[0]?.id || 'ALL')
  const [interleave, setInterleave] = useState<boolean>(examBook.settings.mixedClassSeatInterleaving)

  // Add room form
  const [roomName, setRoomName] = useState('')
  const [campusUnit, setCampusUnit] = useState('Unit - 1')
  const [rows, setRows] = useState('3')
  const [benchesPerRow, setBenchesPerRow] = useState('3')
  const [seatsPerBench, setSeatsPerBench] = useState('2')

  const examSeats = useMemo(
    () => examBook.seatAllocations.filter((s) => s.examId === exam.id),
    [examBook.seatAllocations, exam.id],
  )

  const totalCapacity = examBook.examRooms.reduce((sum, r) => sum + r.capacity, 0)
  const activeStudentsCount = students.filter((s) => s.status !== 'suspended').length

  const activeRoom =
    examBook.examRooms.find((r) => r.id === selectedRoomId) || examBook.examRooms[0] || null

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomName.trim()) return
    const res = await runExamAction(
      {
        action: 'save_room',
        roomName,
        campusUnit,
        rows: Number(rows),
        benchesPerRow: Number(benchesPerRow),
        seatsPerBench: Number(seatsPerBench),
      },
      `Added exam hall: ${roomName}`,
    )
    if (res.ok) setRoomName('')
  }

  const handleGenerate = () =>
    void runExamAction(
      {
        action: 'generate_seat_plan',
        examId: exam.id,
        interleave,
      },
      `Generated Seat Plan (${interleave ? 'Mixed-Class Anti-Cheating' : 'Roll-Wise'})`,
    )

  const hallAttendanceMap = useMemo(() => {
    const map = new Map<string, string>()
    examBook.examAttendance
      .filter((a) => a.examId === exam.id)
      .forEach((a) => {
        if (!map.has(a.studentId)) map.set(a.studentId, a.status)
      })
    return map
  }, [examBook.examAttendance, exam.id])

  return (
    <div className="space-y-5">
      {/* Top Action Control Bar */}
      <div className="dmhs-card flex flex-wrap items-center justify-between gap-3 rounded-[24px] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubMode('bench_map')}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
              subMode === 'bench_map'
                ? 'bg-[#0f172a] text-emerald-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Visual Bench Seat Plan ({examSeats.length})
          </button>
          <button
            type="button"
            onClick={() => setSubMode('hall_attendance')}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
              subMode === 'hall_attendance'
                ? 'bg-[#0f172a] text-emerald-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Seat Plan &amp; Hall Attendance Sheet
          </button>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-800">
            Capacity: {examSeats.length} / {totalCapacity} seats ({activeStudentsCount} active students)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-700">
            <input
              type="checkbox"
              checked={interleave}
              onChange={(e) => setInterleave(e.target.checked)}
              className="accent-emerald-600"
            />
            Anti-Cheating Mixed-Class Interleaving
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-emerald-700"
          >
            <Icon name="spark" size={14} />
            Auto-Generate Seat Plan
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700 hover:border-emerald-400"
          >
            <Icon name="print" size={14} />
            Print Door Chart
          </button>
        </div>
      </div>

      {subMode === 'bench_map' ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Left: Halls & Room Configuration */}
          <div className="space-y-4">
            <div className="dmhs-card rounded-[24px] p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Examination Halls ({examBook.examRooms.length})
              </p>
              <div className="mt-3 space-y-2">
                {examBook.examRooms.map((rm) => {
                  const count = examSeats.filter((s) => s.roomId === rm.id).length
                  const isSel = activeRoom?.id === rm.id
                  return (
                    <div
                      key={rm.id}
                      onClick={() => setSelectedRoomId(rm.id)}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3 transition ${
                        isSel
                          ? 'border-emerald-500 bg-emerald-50/70 shadow-2xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-black text-slate-900">{rm.roomName}</p>
                        <p className="text-[10px] font-semibold text-slate-500">
                          {rm.campusUnit} · {rm.rows}×{rm.benchesPerRow} benches · {rm.seatsPerBench}/bench
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
                          {count}/{rm.capacity}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void runExamAction(
                              { action: 'delete_room', roomId: rm.id },
                              `Removed ${rm.roomName}`,
                            )
                          }}
                          className="text-[10px] font-bold text-rose-500 hover:underline"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <form onSubmit={handleAddRoom} className="dmhs-card space-y-3 rounded-[24px] p-4">
              <h4 className="text-xs font-black text-slate-900">Add Exam Room / Hall</h4>
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Room Name (e.g., Hall 304 · Main Wing)"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
              />
              <select
                value={campusUnit}
                onChange={(e) => setCampusUnit(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                <option value="Unit - 1">Unit - 1 (Main Campus)</option>
                <option value="Unit - 2">Unit - 2 (Junior Wing)</option>
              </select>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400">Rows</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={rows}
                    onChange={(e) => setRows(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400">Cols</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={benchesPerRow}
                    onChange={(e) => setBenchesPerRow(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400">Seats/B</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={seatsPerBench}
                    onChange={(e) => setSeatsPerBench(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
              </div>
              <p className="text-[11px] font-bold text-emerald-700">
                Computed Capacity: {Number(rows || 0) * Number(benchesPerRow || 0) * Number(seatsPerBench || 0)} seats
              </p>
              <button
                type="submit"
                className="w-full rounded-full bg-[#0f172a] py-2.5 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
              >
                + Save Exam Hall
              </button>
            </form>
          </div>

          {/* Right: Visual Interactive Room Bench Grid */}
          <div className="dmhs-card rounded-[24px] p-5">
            {activeRoom ? (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-slate-900">{activeRoom.roomName}</h3>
                    <p className="text-xs font-semibold text-slate-500">
                      {activeRoom.campusUnit} · {activeRoom.rows} Rows × {activeRoom.benchesPerRow} Benches ·{' '}
                      {activeRoom.seatsPerBench} Seats/Bench
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">
                    {examSeats.filter((s) => s.roomId === activeRoom.id).length} Seated
                  </span>
                </div>

                {/* Invigilator Desk / Whiteboard Header */}
                <div className="mb-5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-900 py-2.5 text-center text-[11px] font-black uppercase tracking-[.2em] text-emerald-300">
                  Whiteboard &amp; Chief Invigilator Desk (Front of Hall)
                </div>

                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, activeRoom.benchesPerRow))}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: activeRoom.rows * activeRoom.benchesPerRow }, (_, idx) => {
                    const benchLabel = `B${idx + 1}`
                    const benchSeats = examSeats.filter(
                      (s) => s.roomId === activeRoom.id && s.benchLabel === benchLabel,
                    )
                    return (
                      <div
                        key={benchLabel}
                        className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-white">
                            {benchLabel}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {benchSeats.length}/{activeRoom.seatsPerBench}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {Array.from({ length: activeRoom.seatsPerBench }, (_, sIdx) => {
                            const seatNo = sIdx + 1
                            const alloc = benchSeats.find((b) => b.seatNo === seatNo)
                            if (!alloc) {
                              return (
                                <div
                                  key={seatNo}
                                  className="rounded-xl border border-dashed border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-400"
                                >
                                  Seat {seatNo} · Vacant
                                </div>
                              )
                            }
                            return (
                              <div
                                key={seatNo}
                                className={`rounded-xl border px-2.5 py-1.5 text-[11px] ${getClassChipClass(alloc.classLabel)}`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate font-black">{alloc.studentName}</span>
                                  <span className="shrink-0 font-mono text-[10px] font-black">
                                    #{alloc.roll}
                                  </span>
                                </div>
                                <p className="text-[10px] font-bold opacity-80">
                                  S{seatNo} · {alloc.classLabel}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="py-12 text-center text-xs font-bold text-slate-400">
                Add at least one Exam Hall on the left to build the visual seat plan.
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Seat-Wise Hall Attendance & Door Sheet */
        <div className="dmhs-card overflow-x-auto rounded-[24px] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Seat Plan &amp; Hall Attendance Door Sheet · {exam.title}
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Printable invigilator clipboard sheet showing exact seat assignments, hall attendance status &amp; signature lines.
              </p>
            </div>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              <option value="ALL">All Halls ({examSeats.length} seats)</option>
              {examBook.examRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomName}
                </option>
              ))}
            </select>
          </div>

          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
                <th className="py-2.5 pr-3">Hall / Room</th>
                <th className="py-2.5 pr-3">Bench &amp; Seat</th>
                <th className="py-2.5 pr-3">Roll</th>
                <th className="py-2.5 pr-3">Candidate Name</th>
                <th className="py-2.5 pr-3">Class</th>
                <th className="py-2.5 pr-3">Hall Attendance</th>
                <th className="py-2.5 text-right">Candidate Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {examSeats
                .filter((s) => selectedRoomId === 'ALL' || s.roomId === selectedRoomId)
                .map((s) => {
                  const att = hallAttendanceMap.get(s.studentId)
                  return (
                    <tr key={s.id}>
                      <td className="py-2.5 pr-3 font-extrabold text-slate-800">{s.roomName}</td>
                      <td className="py-2.5 pr-3 font-mono font-black text-emerald-700">
                        {s.benchLabel}-S{s.seatNo}
                      </td>
                      <td className="py-2.5 pr-3 font-mono font-bold text-slate-700">#{s.roll}</td>
                      <td className="py-2.5 pr-3 font-bold text-slate-900">{s.studentName}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{s.classLabel}</td>
                      <td className="py-2.5 pr-3">
                        {att ? (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                              att === 'present'
                                ? 'bg-emerald-50 text-emerald-700'
                                : att === 'late'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {att}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400">Pending</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-slate-300">__________________</td>
                    </tr>
                  )
                })}
              {examSeats.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs font-bold text-slate-400">
                    No seats allocated yet. Click &ldquo;Auto-Generate Seat Plan&rdquo; above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ==================== 7. EXAM COMMITTEE & INVIGILATORS (WITH CONFLICT GUARD) ====================
const COMMITTEE_ROLES: ExamCommitteeMember['committeeRole'][] = [
  'Chief Controller',
  'Exam Secretary',
  'Question Moderation Lead',
  'Tabulation & Result Verification',
  'Hall Discipline Officer',
]

const SHIFT_OPTIONS = [
  'Morning (09:00 AM – 11:00 AM)',
  'Mid-Day (11:30 AM – 01:30 PM)',
  'Afternoon (02:00 PM – 04:00 PM)',
]

export function ExamCommitteeInvigilatorsSection({ exam }: { exam: DeclaredExamItem }) {
  const { examBook, teachers, runExamAction } = useSchool()
  const [panel, setPanel] = useState<'invigilators' | 'committee'>('invigilators')

  // Invigilator Form State
  const [dateIso, setDateIso] = useState(exam.startDateIso || new Date().toISOString().slice(0, 10))
  const [shiftLabel, setShiftLabel] = useState(SHIFT_OPTIONS[0])
  const [roomId, setRoomId] = useState(examBook.examRooms[0]?.id || '')
  const [subject, setSubject] = useState('Physics')
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '')
  const [dutyRole, setDutyRole] = useState<ExamInvigilatorAssignment['dutyRole']>('Chief Invigilator')
  const [conflictError, setConflictError] = useState<string | null>(null)

  // Committee Form State
  const [memberName, setMemberName] = useState('')
  const [designation, setDesignation] = useState('Senior Faculty')
  const [committeeRole, setCommitteeRole] =
    useState<ExamCommitteeMember['committeeRole']>('Exam Secretary')
  const [campusUnit, setCampusUnit] = useState('Unit - 1')

  const examInvigilators = useMemo(
    () => examBook.invigilators.filter((i) => i.examId === exam.id),
    [examBook.invigilators, exam.id],
  )
  const examCommittee = useMemo(
    () => examBook.committee.filter((c) => c.examId === exam.id),
    [examBook.committee, exam.id],
  )

  const handleAssignInvigilator = async (e: React.FormEvent) => {
    e.preventDefault()
    setConflictError(null)
    const res = await runExamAction(
      {
        action: 'assign_invigilator',
        examId: exam.id,
        dateIso,
        shiftLabel,
        roomId: roomId || examBook.examRooms[0]?.id,
        subject,
        teacherId: teacherId || teachers[0]?.id,
        dutyRole,
      },
      'Invigilator duty assigned!',
    )
    if (!res.ok) {
      setConflictError(res.error || 'Could not assign invigilator.')
    }
  }

  const handleAddCommittee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberName.trim()) return
    const res = await runExamAction(
      {
        action: 'add_committee_member',
        examId: exam.id,
        memberName,
        designation,
        committeeRole,
        campusUnit,
      },
      `Added ${memberName} to Exam Committee`,
    )
    if (res.ok) setMemberName('')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPanel('invigilators')}
          className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
            panel === 'invigilators'
              ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Exam Invigilator Roster ({examInvigilators.length})
        </button>
        <button
          type="button"
          onClick={() => setPanel('committee')}
          className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
            panel === 'committee'
              ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Exam Individual Committee ({examCommittee.length})
        </button>
      </div>

      {panel === 'invigilators' ? (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form onSubmit={handleAssignInvigilator} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">Assign Hall Invigilator</h3>
            <p className="text-[11px] font-semibold text-slate-500">
              Server conflict-guard blocks double-booking the same teacher on the same date &amp; shift.
            </p>
            {conflictError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                {conflictError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Exam Date</label>
                <input
                  type="date"
                  value={dateIso}
                  onChange={(e) => setDateIso(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
                >
                  {COMMON_SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="All Subjects">All Subjects</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Exam Shift</label>
              <select
                value={shiftLabel}
                onChange={(e) => setShiftLabel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                {SHIFT_OPTIONS.map((sh) => (
                  <option key={sh} value={sh}>
                    {sh}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Exam Hall</label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                {examBook.examRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomName} ({r.campusUnit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Faculty Invigilator</label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.subject})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Duty Role</label>
              <select
                value={dutyRole}
                onChange={(e) =>
                  setDutyRole(e.target.value as ExamInvigilatorAssignment['dutyRole'])
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                <option value="Chief Invigilator">Chief Invigilator</option>
                <option value="Assistant Invigilator">Assistant Invigilator</option>
                <option value="Reliever">Reliever</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-[#0f172a] py-2.5 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
            >
              + Assign Invigilator Duty
            </button>
          </form>

          <div className="dmhs-card overflow-x-auto rounded-[24px] p-4">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                  <th className="py-2.5 pr-3">Date &amp; Shift</th>
                  <th className="py-2.5 pr-3">Hall &amp; Subject</th>
                  <th className="py-2.5 pr-3">Invigilator</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {examInvigilators.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-3">
                      <p className="font-extrabold text-slate-900">{inv.dateIso}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{inv.shiftLabel}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-900">{inv.roomName}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{inv.subject}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <p className="font-extrabold text-slate-900">{inv.teacherName}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {inv.dutyRole}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1">
                        {(['assigned', 'on_duty', 'completed'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              void runExamAction(
                                { action: 'update_invigilator_status', id: inv.id, status: st },
                                `Duty status updated to ${st.replace('_', ' ')}`,
                              )
                            }
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                              inv.status === st
                                ? st === 'completed'
                                  ? 'bg-emerald-600 text-white'
                                  : st === 'on_duty'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-900 text-emerald-300'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {st.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          void runExamAction(
                            { action: 'delete_invigilator', id: inv.id },
                            'Removed invigilator duty',
                          )
                        }
                        className="text-[11px] font-bold text-rose-500 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {examInvigilators.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs font-bold text-slate-400">
                      No invigilators assigned to {exam.title} yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form onSubmit={handleAddCommittee} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">Add Exam Committee Member</h3>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">
                Quick-Fill Faculty (Optional)
              </label>
              <select
                value=""
                onChange={(e) => {
                  const t = teachers.find((x) => x.id === e.target.value)
                  if (t) {
                    setMemberName(t.name)
                    setDesignation(`${t.subject} Faculty · ${t.department}`)
                  }
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                <option value="">Select from DMHA Faculty...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.subject})
                  </option>
                ))}
              </select>
            </div>
            <input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Member Full Name *"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Designation (e.g., Principal / Coordinator)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <select
              value={committeeRole}
              onChange={(e) =>
                setCommitteeRole(e.target.value as ExamCommitteeMember['committeeRole'])
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              {COMMITTEE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={campusUnit}
              onChange={(e) => setCampusUnit(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              <option value="Unit - 1">Unit - 1</option>
              <option value="Unit - 2">Unit - 2</option>
              <option value="Both Units">Both Units (Campus-Wide)</option>
            </select>
            <button
              type="submit"
              className="w-full rounded-full bg-[#0f172a] py-2.5 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
            >
              + Appoint to Exam Committee
            </button>
          </form>

          <div className="grid gap-3 sm:grid-cols-2">
            {examCommittee.map((c) => (
              <div
                key={c.id}
                className="dmhs-card flex flex-col justify-between rounded-[22px] p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800">
                      {c.committeeRole}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void runExamAction(
                          { action: 'delete_committee_member', id: c.id },
                          `Removed ${c.memberName}`,
                        )
                      }
                      className="text-[11px] font-bold text-rose-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <h4 className="mt-2.5 text-sm font-black text-slate-900">{c.memberName}</h4>
                  <p className="text-xs font-semibold text-slate-500">{c.designation}</p>
                </div>
                <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Jurisdiction: {c.campusUnit}
                </p>
              </div>
            ))}
            {examCommittee.length === 0 && (
              <div className="dmhs-card col-span-2 rounded-[22px] p-10 text-center text-xs font-bold text-slate-400">
                No committee members appointed for {exam.title} yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== 8. QUESTION PAPER & ANSWER SCRIPT DISTRIBUTION ====================
const QP_STATUSES: QuestionPaperDispatch['status'][] = [
  'printed',
  'sealed',
  'dispatched',
  'opened_in_hall',
]

const AS_STATUSES: AnswerScriptDispatch['status'][] = [
  'collected',
  'assigned_to_examiner',
  'checking',
  'returned_verified',
]

export function ExamPaperDistributionSection({ exam }: { exam: DeclaredExamItem }) {
  const { examBook, teachers, runExamAction } = useSchool()
  const [panel, setPanel] = useState<'question' | 'answer'>('question')

  // Question Packet Form
  const [qpClass, setQpClass] = useState<string>(DMHS_CLASS_SECTIONS[0] || 'Class 6 · Section A')
  const [qpSubject, setQpSubject] = useState('Physics')
  const [qpDate, setQpDate] = useState(exam.startDateIso || new Date().toISOString().slice(0, 10))
  const [qpRoom, setQpRoom] = useState(examBook.examRooms[0]?.roomName || 'Hall 301')
  const [qpCopies, setQpCopies] = useState('25')
  const [qpHandedTo, setQpHandedTo] = useState(teachers[0]?.name || 'Chief Invigilator')

  // Answer Bundle Form
  const [asClass, setAsClass] = useState<string>(DMHS_CLASS_SECTIONS[0] || 'Class 6 · Section A')
  const [asSubject, setAsSubject] = useState('Physics')
  const [asCollected, setAsCollected] = useState('24')
  const [asExaminerId, setAsExaminerId] = useState(teachers[0]?.id || '')
  const [asDeadline, setAsDeadline] = useState(exam.endDateIso || new Date().toISOString().slice(0, 10))

  const qpList = useMemo(
    () => examBook.questionPapers.filter((q) => q.examId === exam.id),
    [examBook.questionPapers, exam.id],
  )
  const asList = useMemo(
    () => examBook.answerScripts.filter((a) => a.examId === exam.id),
    [examBook.answerScripts, exam.id],
  )

  const handleCreateQp = async (e: React.FormEvent) => {
    e.preventDefault()
    await runExamAction(
      {
        action: 'create_question_packet',
        examId: exam.id,
        classLabel: qpClass,
        subject: qpSubject,
        dateIso: qpDate,
        roomName: qpRoom,
        copiesPrinted: Number(qpCopies),
        handedTo: qpHandedTo,
      },
      `Sealed Question Packet for ${qpSubject} (${qpCopies} copies)`,
    )
  }

  const handleCreateAs = async (e: React.FormEvent) => {
    e.preventDefault()
    await runExamAction(
      {
        action: 'create_answer_bundle',
        examId: exam.id,
        classLabel: asClass,
        subject: asSubject,
        scriptsCollected: Number(asCollected),
        examinerId: asExaminerId || teachers[0]?.id,
        deadlineIso: asDeadline,
      },
      `Assigned ${asCollected} answer scripts for ${asSubject}`,
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPanel('question')}
          className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
            panel === 'question'
              ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Question Paper Distribution ({qpList.length})
        </button>
        <button
          type="button"
          onClick={() => setPanel('answer')}
          className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
            panel === 'answer'
              ? 'bg-[#0f172a] text-emerald-300 shadow-xs'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Answer Paper / Script Distribution ({asList.length})
        </button>
      </div>

      {panel === 'question' ? (
        <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
          <form onSubmit={handleCreateQp} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">Seal Question Paper Packet</h3>
            <select
              value={qpClass}
              onChange={(e) => setQpClass(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              {DMHS_CLASS_SECTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={qpSubject}
                onChange={(e) => setQpSubject(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
              >
                {COMMON_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={qpDate}
                onChange={(e) => setQpDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Target Hall</label>
                <select
                  value={qpRoom}
                  onChange={(e) => setQpRoom(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
                >
                  {examBook.examRooms.map((r) => (
                    <option key={r.id} value={r.roomName}>
                      {r.roomName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Copies</label>
                <input
                  type="number"
                  min={1}
                  value={qpCopies}
                  onChange={(e) => setQpCopies(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
                />
              </div>
            </div>
            <input
              value={qpHandedTo}
              onChange={(e) => setQpHandedTo(e.target.value)}
              placeholder="Handed Over To (Invigilator Name)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-[#0f172a] py-2.5 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
            >
              + Seal &amp; Log Question Packet
            </button>
          </form>

          <div className="space-y-3">
            {qpList.map((pkt) => (
              <div key={pkt.id} className="dmhs-card rounded-[22px] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-300">
                        {pkt.packetCode}
                      </span>
                      <span className="text-xs font-black text-slate-900">
                        {pkt.subject} · {pkt.classLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      {pkt.roomName} · {pkt.copiesPrinted} copies · Sealed by {pkt.sealedBy} · Custodian:{' '}
                      <strong className="text-slate-800">{pkt.handedTo}</strong>
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{pkt.dispatchedAt}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {QP_STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() =>
                        void runExamAction(
                          { action: 'update_question_packet_status', id: pkt.id, status: st },
                          `${pkt.packetCode} → ${st.replace(/_/g, ' ')}`,
                        )
                      }
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase transition ${
                        pkt.status === st
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {st.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {qpList.length === 0 && (
              <div className="dmhs-card rounded-[22px] p-10 text-center text-xs font-bold text-slate-400">
                No question paper packets logged for {exam.title} yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
          <form onSubmit={handleCreateAs} className="dmhs-card h-fit space-y-3 rounded-[24px] p-5">
            <h3 className="text-sm font-black text-slate-900">Dispatch Answer Script Bundle</h3>
            <select
              value={asClass}
              onChange={(e) => setAsClass(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            >
              {DMHS_CLASS_SECTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={asSubject}
                onChange={(e) => setAsSubject(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
              >
                {COMMON_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={asCollected}
                onChange={(e) => setAsCollected(e.target.value)}
                placeholder="Scripts #"
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Assigned Examiner</label>
              <select
                value={asExaminerId}
                onChange={(e) => setAsExaminerId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.subject})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Checking Deadline</label>
              <input
                type="date"
                value={asDeadline}
                onChange={(e) => setAsDeadline(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-[#0f172a] py-2.5 text-xs font-extrabold text-emerald-300 hover:bg-slate-800"
            >
              + Assign Scripts to Examiner
            </button>
          </form>

          <div className="space-y-3">
            {asList.map((b) => {
              const pct = b.scriptsCollected > 0 ? Math.round((b.scriptsChecked / b.scriptsCollected) * 100) : 0
              return (
                <div key={b.id} className="dmhs-card rounded-[22px] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-300">
                          {b.bundleCode}
                        </span>
                        <span className="text-xs font-black text-slate-900">
                          {b.subject} · {b.classLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        Examiner: <strong className="text-slate-800">{b.examinerName}</strong> · Handover:{' '}
                        {b.handoverDateIso} · Deadline: <strong className="text-amber-700">{b.deadlineIso}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                        {b.scriptsChecked} / {b.scriptsCollected} Checked ({pct}%)
                      </span>
                      {b.scriptsChecked < b.scriptsCollected && (
                        <button
                          type="button"
                          onClick={() =>
                            void runExamAction(
                              {
                                action: 'update_answer_bundle',
                                id: b.id,
                                status:
                                  b.scriptsChecked + 5 >= b.scriptsCollected
                                    ? 'returned_verified'
                                    : 'checking',
                                scriptsChecked: Math.min(b.scriptsCollected, b.scriptsChecked + 5),
                              },
                              `Logged checked scripts for ${b.bundleCode}`,
                            )
                          }
                          className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black text-emerald-300 hover:bg-slate-800"
                        >
                          +5 Checked
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {AS_STATUSES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          void runExamAction(
                            { action: 'update_answer_bundle', id: b.id, status: st },
                            `${b.bundleCode} → ${st.replace(/_/g, ' ')}`,
                          )
                        }
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase transition ${
                          b.status === st
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {st.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {asList.length === 0 && (
              <div className="dmhs-card rounded-[22px] p-10 text-center text-xs font-bold text-slate-400">
                No answer script bundles dispatched for {exam.title} yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== 9. EXAMINATION SETTINGS & GRADING SCALE ====================
export function ExamSettingsSection() {
  const { examBook, runExamAction } = useSchool()
  const [scale, setScale] = useState<ExamGradeRule[]>(examBook.settings.gradingScale)
  const [defaultMaxWritten, setDefaultMaxWritten] = useState(
    String(examBook.settings.defaultMaxWritten),
  )
  const [defaultMaxMcq, setDefaultMaxMcq] = useState(String(examBook.settings.defaultMaxMcq))
  const [defaultMaxPractical, setDefaultMaxPractical] = useState(
    String(examBook.settings.defaultMaxPractical),
  )
  const [passPercent, setPassPercent] = useState(String(examBook.settings.passPercent))
  const [requireFeeClearanceForAdmit, setRequireFeeClearanceForAdmit] = useState(
    examBook.settings.requireFeeClearanceForAdmit,
  )
  const [mixedClassSeatInterleaving, setMixedClassSeatInterleaving] = useState(
    examBook.settings.mixedClassSeatInterleaving,
  )
  const [admitCardInstructions, setAdmitCardInstructions] = useState(
    examBook.settings.admitCardInstructions,
  )

  const updateRow = (idx: number, field: keyof ExamGradeRule, value: string) => {
    setScale((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              [field]:
                field === 'minPercent' || field === 'maxPercent' || field === 'gpa'
                  ? Number(value)
                  : value,
            }
          : row,
      ),
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    await runExamAction(
      {
        action: 'save_exam_settings',
        gradingScale: scale,
        defaultMaxWritten: Number(defaultMaxWritten),
        defaultMaxMcq: Number(defaultMaxMcq),
        defaultMaxPractical: Number(defaultMaxPractical),
        passPercent: Number(passPercent),
        requireFeeClearanceForAdmit,
        mixedClassSeatInterleaving,
        admitCardInstructions,
      },
      'Examination settings & grading scale saved!',
    )
  }

  const defaultTotal =
    Number(defaultMaxWritten || 0) + Number(defaultMaxMcq || 0) + Number(defaultMaxPractical || 0)

  return (
    <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Grading Scale Table */}
      <div className="dmhs-card rounded-[24px] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900">
              DMHA Grading Scale (Bangladesh GPA 5.0 Standard)
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              Automatically applied across Marks Entry, Tabulation Sheets &amp; Published Report Cards.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setScale(DEFAULT_DMHS_GRADING_SCALE)}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-extrabold text-slate-600 hover:bg-slate-100"
          >
            Reset Default 5.0 Scale
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                <th className="py-2 pr-2">Grade</th>
                <th className="py-2 pr-2">Min %</th>
                <th className="py-2 pr-2">Max %</th>
                <th className="py-2 pr-2">GPA Point</th>
                <th className="py-2">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scale.map((row, idx) => (
                <tr key={idx}>
                  <td className="py-2 pr-2">
                    <input
                      value={row.grade}
                      onChange={(e) => updateRow(idx, 'grade', e.target.value)}
                      className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center font-black"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={row.minPercent}
                      onChange={(e) => updateRow(idx, 'minPercent', e.target.value)}
                      className="w-18 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-bold"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={row.maxPercent}
                      onChange={(e) => updateRow(idx, 'maxPercent', e.target.value)}
                      className="w-18 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-bold"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={5}
                      value={row.gpa}
                      onChange={(e) => updateRow(idx, 'gpa', e.target.value)}
                      className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-black text-emerald-700"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      value={row.remark}
                      onChange={(e) => updateRow(idx, 'remark', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-semibold"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Policies, Default Marks & Admit Instructions */}
      <div className="dmhs-card h-fit space-y-4 rounded-[24px] p-5">
        <h3 className="text-sm font-black text-slate-900">Marks Structure &amp; Exam Policies</h3>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Default Written</label>
            <input
              type="number"
              min={0}
              value={defaultMaxWritten}
              onChange={(e) => setDefaultMaxWritten(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Default MCQ</label>
            <input
              type="number"
              min={0}
              value={defaultMaxMcq}
              onChange={(e) => setDefaultMaxMcq(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Default Practical</label>
            <input
              type="number"
              min={0}
              value={defaultMaxPractical}
              onChange={(e) => setDefaultMaxPractical(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Pass Mark %</label>
            <input
              type="number"
              min={1}
              max={100}
              value={passPercent}
              onChange={(e) => setPassPercent(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
            />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
          Default Subject Full Marks: <strong className="text-emerald-700">{defaultTotal}</strong>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-slate-200 bg-white p-3">
          <input
            type="checkbox"
            checked={requireFeeClearanceForAdmit}
            onChange={(e) => setRequireFeeClearanceForAdmit(e.target.checked)}
            className="mt-0.5 accent-emerald-600"
          />
          <div>
            <p className="text-xs font-extrabold text-slate-900">Require Fee Clearance for Admit Card</p>
            <p className="text-[11px] font-semibold text-slate-500">
              Flags unpaid term invoices on Admit Card printing (Admin provisional override available).
            </p>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-slate-200 bg-white p-3">
          <input
            type="checkbox"
            checked={mixedClassSeatInterleaving}
            onChange={(e) => setMixedClassSeatInterleaving(e.target.checked)}
            className="mt-0.5 accent-emerald-600"
          />
          <div>
            <p className="text-xs font-extrabold text-slate-900">
              Anti-Cheating Mixed-Class Seat Interleaving
            </p>
            <p className="text-[11px] font-semibold text-slate-500">
              Auto seat planner alternates students from different classes on every bench.
            </p>
          </div>
        </label>

        <div>
          <label className="text-[10px] font-black uppercase text-slate-400">
            Official Admit Card &amp; Hall Instructions
          </label>
          <textarea
            rows={4}
            value={admitCardInstructions}
            onChange={(e) => setAdmitCardInstructions(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-700"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-[#0f172a] py-3 text-xs font-extrabold text-emerald-300 shadow-sm hover:bg-slate-800"
        >
          Save Examination Settings
        </button>
      </div>
    </form>
  )
}

// ==================== UNIFIED EXAM MANAGEMENT HUB (SIDEBAR-CONTROLLED) ====================
const SUBTAB_META: Record<ExamSubTab, { label: string; title: string; subtitle: string }> = {
  declare: {
    label: 'Exam Declare & Schedule',
    title: 'Exam Declaration & Lifecycle Control',
    subtitle: 'Declare term examinations, configure Written/MCQ/Practical ceilings, lock marks, and publish results.',
  },
  attendance: {
    label: 'Exam Attendance',
    title: 'Examination Hall Attendance',
    subtitle: 'Mark candidate presence, late entry, or absence by class and subject with linked hall seat badges.',
  },
  marks: {
    label: 'Marks Entry',
    title: 'Exam Marks Entry (Admin & Teacher)',
    subtitle: 'Enter Written, MCQ & Practical marks with real-time GPA 5.0 auto-grading and server range guards.',
  },
  marklist: {
    label: 'Exam Mark List',
    title: 'Master Tabulation & Merit Rank Sheet',
    subtitle: 'Automated GPA aggregation, merit rankings, pass-rate analytics, Excel CSV export & A4 tabulation print.',
  },
  admit: {
    label: 'Admit Cards',
    title: 'Official Examination Admit Cards',
    subtitle: 'Generate individual or bulk A4 printable admit cards with assigned hall seats, exam routine & fee gate.',
  },
  seatplan: {
    label: 'Seat Plan & Hall Sheet',
    title: 'Exam Seat Plan & Hall Attendance Sheet',
    subtitle: 'Configure halls, 1-click anti-cheating mixed-class seat interleaving, bench map & printable door sheets.',
  },
  invigilators: {
    label: 'Committee & Invigilators',
    title: 'Exam Committee & Invigilator Duty Roster',
    subtitle: 'Appoint Examination Committee roles and assign room invigilators with automatic shift conflict detection.',
  },
  papers: {
    label: 'Paper & Script Control',
    title: 'Question Paper & Answer Script Control',
    subtitle: 'Sealed question packet chain-of-custody and examiner answer script checking progress tracker.',
  },
  settings: {
    label: 'Examination Settings',
    title: 'Examination Setup & Grading Scale',
    subtitle: 'Manage Bangladesh GPA 5.0 grading rules, default mark splits, fee clearance gate & hall policies.',
  },
}

export function ExamManagementHub({
  activeSubTab,
  onSelectSubTab,
  onOpenTimetable,
}: {
  activeSubTab: ExamSubTab
  onSelectSubTab: (next: ExamSubTab) => void
  onOpenTimetable: () => void
}) {
  const { examBook, role } = useSchool()
  const [selectedExamId, setSelectedExamId] = useState<string>(
    examBook.declaredExams[0]?.id || '',
  )

  const activeExam = useMemo(
    () =>
      examBook.declaredExams.find((e) => e.id === selectedExamId) ||
      examBook.declaredExams[0] ||
      null,
    [examBook.declaredExams, selectedExamId],
  )

  const meta = SUBTAB_META[activeSubTab] || SUBTAB_META.declare
  const seatedCount = activeExam
    ? examBook.seatAllocations.filter((s) => s.examId === activeExam.id).length
    : 0
  const marksCount = activeExam
    ? examBook.examMarks.filter((m) => m.examId === activeExam.id).length
    : 0

  return (
    <PageShell
      eyebrow={`DMHA Examination Controller · ${role === 'teacher' ? 'Faculty Marks & Hall Desk' : 'Exam Management Suite'}`}
      title={meta.title}
      subtitle={meta.subtitle}
    >
      {/* Clean Single-Line Breadcrumb + Active Declared Exam Selector (matches Accounts & Finance!) */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onSelectSubTab(role === 'teacher' ? 'marks' : 'declare')}
            className="font-bold text-slate-400 hover:text-slate-800"
          >
            {role === 'teacher' ? 'Exams & Grading' : 'Examination Management'}
          </button>
          <span className="text-slate-300">/</span>
          <span className="rounded-full bg-[#0f172a] px-3 py-1 text-[11px] font-black text-emerald-300">
            {meta.label}
          </span>
          <button
            type="button"
            onClick={onOpenTimetable}
            className="ml-1 hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 hover:border-emerald-300 hover:text-emerald-700 md:inline-flex"
          >
            Schedule &amp; Timetable →
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
          {examBook.declaredExams.length > 0 && activeExam && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-400">Exam:</span>
                <select
                  aria-label="Active Declared Examination"
                  value={activeExam.id}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="max-w-[240px] truncate rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-extrabold text-slate-900"
                >
                  {examBook.declaredExams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.code})
                    </option>
                  ))}
                </select>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                  activeExam.status === 'published'
                    ? 'bg-emerald-100 text-emerald-800'
                    : activeExam.status === 'marks_locked'
                      ? 'bg-amber-100 text-amber-800'
                      : activeExam.status === 'declared'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-slate-100 text-slate-600'
                }`}
              >
                {activeExam.status.replace('_', ' ')}
              </span>
              <span className="hidden font-bold text-slate-500 sm:inline">
                {seatedCount} Seated · {marksCount} Marks
              </span>
            </>
          )}
        </div>
      </div>

      {/* Subsection Body */}
      {activeSubTab === 'declare' && (
        <ExamDeclareSection
          onSelectExam={(id) => {
            setSelectedExamId(id)
            onSelectSubTab('marks')
          }}
        />
      )}

      {activeSubTab === 'settings' && <ExamSettingsSection />}

      {activeSubTab !== 'declare' && activeSubTab !== 'settings' && !activeExam && (
        <div className="dmhs-card rounded-[24px] p-10 text-center">
          <p className="text-sm font-black text-slate-900">No Declared Examination Yet</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Declare an examination first to manage attendance, marks, admit cards, seat plans, or invigilators.
          </p>
          {role === 'admin' && (
            <button
              type="button"
              onClick={() => onSelectSubTab('declare')}
              className="mt-4 rounded-full bg-[#0f172a] px-5 py-2.5 text-xs font-extrabold text-emerald-300"
            >
              Go to Exam Declare →
            </button>
          )}
        </div>
      )}

      {activeExam && activeSubTab === 'attendance' && <ExamAttendanceSection exam={activeExam} />}
      {activeExam && activeSubTab === 'marks' && <ExamMarksEntrySection exam={activeExam} />}
      {activeExam && activeSubTab === 'marklist' && <ExamMarkListSection exam={activeExam} />}
      {activeExam && activeSubTab === 'admit' && (
        <ExamAdmitCardsSection
          exam={activeExam}
          onJumpToSeatPlan={() => onSelectSubTab('seatplan')}
        />
      )}
      {activeExam && activeSubTab === 'seatplan' && <ExamSeatPlanSection exam={activeExam} />}
      {activeExam && activeSubTab === 'invigilators' && (
        <ExamCommitteeInvigilatorsSection exam={activeExam} />
      )}
      {activeExam && activeSubTab === 'papers' && (
        <ExamPaperDistributionSection exam={activeExam} />
      )}
    </PageShell>
  )
}
