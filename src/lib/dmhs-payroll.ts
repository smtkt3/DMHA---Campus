import type {
  PayrollBookState,
  PayrollEmployeeProfile,
} from '@/components/school/types'

export const PAYROLL_MONTH_OPTIONS = [
  'October 2026',
  'November 2026',
  'December 2026',
  'January 2027',
]

export const initialPayrollBook: PayrollBookState = {
  employees: [
    {
      id: 'tch-nadia',
      employeeCode: 'TCH-001',
      name: 'Nadia Rahman',
      employeeType: 'teacher',
      designation: 'Senior Teacher (Physics)',
      department: 'Science & STEM',
      phone: '+880 1711-220101',
      email: 'nadia@dmha.edu',
      baseSalary: 48000,
      bankAccountLabel: 'EXIM Bank · ****4412',
      active: true,
    },
    {
      id: 'tch-sakib',
      employeeCode: 'TCH-002',
      name: 'Sakib Ahmed',
      employeeType: 'teacher',
      designation: 'Mathematics Coordinator',
      department: 'Science & STEM',
      phone: '+880 1711-220102',
      email: 'sakib@dmha.edu',
      baseSalary: 46000,
      bankAccountLabel: 'EXIM Bank · ****5129',
      active: true,
    },
    {
      id: 'tch-farhana',
      employeeCode: 'TCH-003',
      name: 'Farhana Karim',
      employeeType: 'teacher',
      designation: 'English Literature Teacher',
      department: 'Languages & Humanities',
      phone: '+880 1711-220103',
      email: 'farhana@dmha.edu',
      baseSalary: 44000,
      bankAccountLabel: 'Sonali Bank · ****8841',
      active: true,
    },
    {
      id: 'tch-rasheda',
      employeeCode: 'TCH-004',
      name: 'Rasheda Begum',
      employeeType: 'teacher',
      designation: 'Early Years Lead Teacher',
      department: 'Primary Wing (Unit - 2)',
      phone: '+880 1711-220104',
      email: 'rasheda@dmha.edu',
      baseSalary: 40000,
      bankAccountLabel: 'EXIM Bank · ****3019',
      active: true,
    },
    {
      id: 'stf-rafiqul',
      employeeCode: 'STF-ACC',
      name: 'Rafiqul Islam',
      employeeType: 'staff',
      designation: 'Senior Accounts Officer',
      department: 'Accounts & Finance',
      phone: '+880 1711-330201',
      email: 'accountant@dmha.edu',
      baseSalary: 38000,
      bankAccountLabel: 'EXIM Bank · ****7710',
      active: true,
    },
    {
      id: 'stf-salma',
      employeeCode: 'STF-CNT',
      name: 'Salma Akter',
      employeeType: 'staff',
      designation: 'Campus Canteen Manager',
      department: 'Canteen & Nutrition',
      phone: '+880 1711-330202',
      email: 'canteen@dmha.edu',
      baseSalary: 24000,
      bankAccountLabel: 'bKash Payroll · 01711-330202',
      active: true,
    },
    {
      id: 'stf-kamal',
      employeeCode: 'STF-SEC',
      name: 'Kamal Hossain',
      employeeType: 'staff',
      designation: 'Head Gate Security Officer',
      department: 'Campus Security',
      phone: '+880 1711-330203',
      email: 'security@dmha.edu',
      baseSalary: 22000,
      bankAccountLabel: 'Cash / Sonali Bank · ****1094',
      active: true,
    },
  ],
  adjustments: [
    {
      id: 'adj-1',
      employeeId: 'tch-nadia',
      kind: 'allowance',
      title: 'House Rent & Lab In-Charge Allowance',
      amount: 4500,
      month: 'Recurring',
      notes: 'Monthly recurring STEM lab coordinator allowance',
      active: true,
    },
    {
      id: 'adj-2',
      employeeId: 'tch-sakib',
      kind: 'allowance',
      title: 'House Rent & Olympiad Mentorship',
      amount: 3500,
      month: 'Recurring',
      active: true,
    },
    {
      id: 'adj-3',
      employeeId: 'stf-rafiqul',
      kind: 'allowance',
      title: 'Medical & Conveyance Allowance',
      amount: 3000,
      month: 'Recurring',
      active: true,
    },
    {
      id: 'adj-4',
      employeeId: 'tch-nadia',
      kind: 'bonus',
      title: '100% Punctuality & Term Excellence Bonus',
      amount: 2500,
      month: 'November 2026',
      active: true,
    },
    {
      id: 'adj-5',
      employeeId: 'tch-farhana',
      kind: 'deduction',
      title: 'Provident Fund (PF) Contribution',
      amount: 2200,
      month: 'Recurring',
      active: true,
    },
    {
      id: 'adj-6',
      employeeId: 'tch-nadia',
      kind: 'deduction',
      title: 'Provident Fund (PF) Contribution',
      amount: 2400,
      month: 'Recurring',
      active: true,
    },
    {
      id: 'adj-7',
      employeeId: 'stf-rafiqul',
      kind: 'deduction',
      title: 'Provident Fund (PF) Contribution',
      amount: 1900,
      month: 'Recurring',
      active: true,
    },
  ],
  attendance: [
    { id: 'patt-1', employeeId: 'tch-nadia', month: 'November 2026', presentDays: 30, lateDays: 0, absentDays: 0, paidLeaveDays: 0, overtimeHours: 4 },
    { id: 'patt-2', employeeId: 'tch-sakib', month: 'November 2026', presentDays: 29, lateDays: 1, absentDays: 0, paidLeaveDays: 1, overtimeHours: 2 },
    { id: 'patt-3', employeeId: 'tch-farhana', month: 'November 2026', presentDays: 27, lateDays: 3, absentDays: 0, paidLeaveDays: 0, overtimeHours: 0 },
    { id: 'patt-4', employeeId: 'tch-rasheda', month: 'November 2026', presentDays: 28, lateDays: 0, absentDays: 1, paidLeaveDays: 1, overtimeHours: 0 },
    { id: 'patt-5', employeeId: 'stf-rafiqul', month: 'November 2026', presentDays: 30, lateDays: 0, absentDays: 0, paidLeaveDays: 0, overtimeHours: 3 },
    { id: 'patt-6', employeeId: 'stf-salma', month: 'November 2026', presentDays: 29, lateDays: 1, absentDays: 0, paidLeaveDays: 0, overtimeHours: 0 },
    { id: 'patt-7', employeeId: 'stf-kamal', month: 'November 2026', presentDays: 30, lateDays: 0, absentDays: 0, paidLeaveDays: 0, overtimeHours: 5 },
  ],
  disbursements: [
    {
      id: 'pay-seed-1',
      slipNo: 'PAY-202611-001',
      month: 'November 2026',
      employeeId: 'tch-nadia',
      employeeName: 'Nadia Rahman',
      employeeType: 'teacher',
      designation: 'Senior Teacher (Physics)',
      baseSalary: 48000,
      totalAllowances: 4500,
      totalBonuses: 2500,
      totalDeductions: 2400,
      attendancePenalty: 0,
      netPayable: 52600,
      paymentLedgerId: 'ldg-10107',
      paymentLedgerName: 'EXIM BANK (Main Operating A/C)',
      linkedVoucherNo: 'DV-2026-201',
      paidAt: '2026-11-15',
      paidBy: 'Shahid (Principal)',
      status: 'paid',
    },
  ],
  settings: {
    workingDaysPerMonth: 30,
    latesPerAbsentDay: 3,
    defaultPfPercent: 5,
    defaultFestivalBonusPercent: 50,
    defaultPaymentLedgerId: 'ldg-10107',
    autoPostAccountingVoucher: true,
  },
}

export interface ComputedEmployeePayroll {
  employee: PayrollEmployeeProfile
  month: string
  baseSalary: number
  allowances: number
  bonuses: number
  deductions: number
  presentDays: number
  lateDays: number
  absentDays: number
  paidLeaveDays: number
  overtimeHours: number
  effectivePenaltyDays: number
  attendancePenalty: number
  grossPay: number
  netPayable: number
  disbursement: PayrollBookState['disbursements'][number] | null
}

export function computeEmployeeMonthlyPayroll(
  book: PayrollBookState,
  employee: PayrollEmployeeProfile,
  month: string,
): ComputedEmployeePayroll {
  const empAdj = book.adjustments.filter(
    (a) =>
      a.active &&
      a.employeeId === employee.id &&
      (a.month === 'Recurring' || a.month === month),
  )
  const allowances = empAdj
    .filter((a) => a.kind === 'allowance')
    .reduce((s, a) => s + a.amount, 0)
  const bonuses = empAdj
    .filter((a) => a.kind === 'bonus')
    .reduce((s, a) => s + a.amount, 0)
  const deductions = empAdj
    .filter((a) => a.kind === 'deduction')
    .reduce((s, a) => s + a.amount, 0)

  const att = book.attendance.find((a) => a.employeeId === employee.id && a.month === month)
  const workingDays = Math.max(1, book.settings.workingDaysPerMonth || 30)
  const presentDays = att ? att.presentDays : workingDays
  const lateDays = att ? att.lateDays : 0
  const absentDays = att ? att.absentDays : 0
  const paidLeaveDays = att ? att.paidLeaveDays : 0
  const overtimeHours = att ? att.overtimeHours : 0

  const latesRule = Math.max(1, book.settings.latesPerAbsentDay || 3)
  const latePenaltyDays = Math.floor(lateDays / latesRule)
  const effectivePenaltyDays = absentDays + latePenaltyDays
  const perDayRate = employee.baseSalary / workingDays
  const attendancePenalty = Math.round(perDayRate * effectivePenaltyDays)

  const grossPay = employee.baseSalary + allowances + bonuses
  const netPayable = Math.max(0, Math.round(grossPay - deductions - attendancePenalty))
  const disbursement =
    book.disbursements.find((d) => d.employeeId === employee.id && d.month === month) || null

  return {
    employee,
    month,
    baseSalary: employee.baseSalary,
    allowances,
    bonuses,
    deductions,
    presentDays,
    lateDays,
    absentDays,
    paidLeaveDays,
    overtimeHours,
    effectivePenaltyDays,
    attendancePenalty,
    grossPay,
    netPayable,
    disbursement,
  }
}

export function computeMonthlyPayrollSheet(book: PayrollBookState, month: string) {
  const activeEmployees = book.employees.filter((e) => e.active)
  const rows = activeEmployees.map((emp) => computeEmployeeMonthlyPayroll(book, emp, month))
  const totalNetPayroll = rows.reduce((s, r) => s + r.netPayable, 0)
  const totalPaidAmount = rows
    .filter((r) => r.disbursement)
    .reduce((s, r) => s + (r.disbursement?.netPayable ?? r.netPayable), 0)
  const pendingCount = rows.filter((r) => !r.disbursement).length
  const paidCount = rows.filter((r) => Boolean(r.disbursement)).length

  return {
    rows,
    activeCount: activeEmployees.length,
    pendingCount,
    paidCount,
    totalNetPayroll,
    totalPaidAmount,
    totalPendingAmount: Math.max(0, totalNetPayroll - totalPaidAmount),
    workingDays: book.settings.workingDaysPerMonth || 30,
  }
}
