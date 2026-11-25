import type {
  AccountLedgerItem,
  AccountingBookState,
  AccountingHead,
  AccountingVoucher,
} from '@/components/school/types'

export const ACCOUNTING_HEADS: AccountingHead[] = [
  'Fixed Asset',
  'Current Asset',
  'Current Liability',
  'Long Term Liability',
  'Income',
  'Expense',
  'Equity (Funds)',
]

export const HEAD_CODE_PREFIX: Record<AccountingHead, string> = {
  'Fixed Asset': '100',
  'Current Asset': '101',
  'Current Liability': '201',
  'Long Term Liability': '202',
  Income: '300',
  Expense: '400',
  'Equity (Funds)': '500',
}

export function isDebitNormalHead(head: AccountingHead): boolean {
  return head === 'Fixed Asset' || head === 'Current Asset' || head === 'Expense'
}

export function nextLedgerCode(head: AccountingHead, existing: AccountLedgerItem[]): string {
  const prefix = HEAD_CODE_PREFIX[head]
  const nums = existing
    .filter((l) => l.code.startsWith(prefix))
    .map((l) => Number.parseInt(l.code, 10))
    .filter((n) => Number.isFinite(n))
  const base = Number.parseInt(`${prefix}00`, 10)
  const max = nums.length > 0 ? Math.max(...nums) : base
  return String(max + 1)
}

export const initialAccountingBook: AccountingBookState = {
  groups: [
    { id: 'grp-lta', head: 'Fixed Asset', name: 'Long Term Asset', active: true },
    { id: 'grp-rec', head: 'Current Asset', name: 'Receivable', active: true },
    { id: 'grp-cash', head: 'Current Asset', name: 'Advance, Deposits & Prepayments', active: true },
    { id: 'grp-stl', head: 'Current Liability', name: 'Short Term Liability', active: true },
    { id: 'grp-ltl', head: 'Long Term Liability', name: 'Long Term Obligations', active: true },
    { id: 'grp-inc', head: 'Income', name: 'Receivable Amount', active: true },
    { id: 'grp-gen', head: 'Expense', name: 'General', active: true },
    { id: 'grp-sal', head: 'Expense', name: 'Salary, Wages & Allowances', active: true },
    { id: 'grp-cap', head: 'Equity (Funds)', name: 'Capital & Institutional Funds', active: true },
  ],
  subGroups: [
    { id: 'sub-mach', head: 'Fixed Asset', groupId: 'grp-lta', name: 'Machinery & Lab Assets', active: true },
    { id: 'sub-rec', head: 'Current Asset', groupId: 'grp-rec', name: 'Receivable Amount', active: true },
    { id: 'sub-cash', head: 'Current Asset', groupId: 'grp-cash', name: 'Cash in Hand and Bank', active: true },
    { id: 'sub-loan', head: 'Current Liability', groupId: 'grp-stl', name: 'Payables & Short-Term Dues', active: true },
    { id: 'sub-adm', head: 'Income', groupId: 'grp-inc', name: 'Admission Income', active: true },
    { id: 'sub-acad-inc', head: 'Income', groupId: 'grp-inc', name: 'Academic Income', active: true },
    { id: 'sub-acad-exp', head: 'Expense', groupId: 'grp-gen', name: 'Academic Expense', active: true },
    { id: 'sub-nonacad-exp', head: 'Expense', groupId: 'grp-gen', name: 'Non-Academic Expense', active: true },
    { id: 'sub-stf-sal', head: 'Expense', groupId: 'grp-sal', name: 'Full Time Staff', active: true },
    { id: 'sub-tch-sal', head: 'Expense', groupId: 'grp-sal', name: 'Full Time Teacher', active: true },
    { id: 'sub-fund', head: 'Equity (Funds)', groupId: 'grp-cap', name: 'School General Fund', active: true },
  ],
  ledgers: [
    { id: 'ldg-10001', code: '10001', head: 'Fixed Asset', groupId: 'grp-lta', subGroupId: 'sub-mach', name: 'Smart Boards, Lab & Classroom Equipment', openingBalance: 450000, active: true },
    { id: 'ldg-10101', code: '10101', head: 'Current Asset', groupId: 'grp-rec', subGroupId: 'sub-rec', name: 'Book Fee Receivable', openingBalance: 0, active: true },
    { id: 'ldg-10102', code: '10102', head: 'Current Asset', groupId: 'grp-rec', subGroupId: 'sub-rec', name: 'Admission Fee Receivable', openingBalance: 0, active: true },
    { id: 'ldg-10103', code: '10103', head: 'Current Asset', groupId: 'grp-rec', subGroupId: 'sub-rec', name: 'Tuition Fees & Student Receivables', openingBalance: 35000, active: true },
    { id: 'ldg-10107', code: '10107', head: 'Current Asset', groupId: 'grp-cash', subGroupId: 'sub-cash', name: 'EXIM BANK (Main Operating A/C)', openingBalance: 520000, isBank: true, bankId: 'bnk-exim', active: true },
    { id: 'ldg-10108', code: '10108', head: 'Current Asset', groupId: 'grp-cash', subGroupId: 'sub-cash', name: 'SONALI BANK PLC (Tuition Collection)', openingBalance: 310000, isBank: true, bankId: 'bnk-sonali', active: true },
    { id: 'ldg-10109', code: '10109', head: 'Current Asset', groupId: 'grp-cash', subGroupId: 'sub-cash', name: 'Cash in Hand (Head Office)', openingBalance: 85000, isCash: true, active: true },
    { id: 'ldg-10110', code: '10110', head: 'Current Asset', groupId: 'grp-cash', subGroupId: 'sub-cash', name: 'Petty Cash Fund', openingBalance: 25000, isCash: true, active: true },
    { id: 'ldg-20101', code: '20101', head: 'Current Liability', groupId: 'grp-stl', subGroupId: 'sub-loan', name: 'Vendor & Supplier Payables', openingBalance: 40000, isParty: true, active: true },
    { id: 'ldg-30001', code: '30001', head: 'Income', groupId: 'grp-inc', subGroupId: 'sub-adm', name: 'Admission Forms Fees', openingBalance: 0, active: true },
    { id: 'ldg-30002', code: '30002', head: 'Income', groupId: 'grp-inc', subGroupId: 'sub-adm', name: 'Admission Fees', openingBalance: 0, active: true },
    { id: 'ldg-30003', code: '30003', head: 'Income', groupId: 'grp-inc', subGroupId: 'sub-acad-inc', name: 'Previous Tuition Fees', openingBalance: 0, active: true },
    { id: 'ldg-30004', code: '30004', head: 'Income', groupId: 'grp-inc', subGroupId: 'sub-acad-inc', name: 'Books, Examination & Stationery Fees', openingBalance: 0, active: true },
    { id: 'ldg-30005', code: '30005', head: 'Income', groupId: 'grp-inc', subGroupId: 'sub-acad-inc', name: 'Certificates Fees', openingBalance: 0, active: true },
    { id: 'ldg-30006', code: '30006', head: 'Income', groupId: 'grp-inc', subGroupId: 'sub-acad-inc', name: 'Tuition Fees', openingBalance: 0, active: true },
    { id: 'ldg-40001', code: '40001', head: 'Expense', groupId: 'grp-gen', subGroupId: 'sub-acad-exp', name: 'Festival & Cultural Event Cost', openingBalance: 0, active: true },
    { id: 'ldg-40002', code: '40002', head: 'Expense', groupId: 'grp-gen', subGroupId: 'sub-acad-exp', name: 'Cleaning Equipment & Campus Hygiene', openingBalance: 0, active: true },
    { id: 'ldg-40003', code: '40003', head: 'Expense', groupId: 'grp-gen', subGroupId: 'sub-nonacad-exp', name: 'Electricity, Internet & Utilities', openingBalance: 0, active: true },
    { id: 'ldg-40004', code: '40004', head: 'Expense', groupId: 'grp-sal', subGroupId: 'sub-tch-sal', name: 'Full-Time Teacher Salaries', openingBalance: 0, active: true },
    { id: 'ldg-40005', code: '40005', head: 'Expense', groupId: 'grp-sal', subGroupId: 'sub-stf-sal', name: 'Full-Time Staff Salaries', openingBalance: 0, active: true },
    { id: 'ldg-50001', code: '50001', head: 'Equity (Funds)', groupId: 'grp-cap', subGroupId: 'sub-fund', name: 'DMHA School Capital & General Reserve', openingBalance: 1385000, active: true },
  ],
  banks: [
    {
      id: 'bnk-exim',
      name: 'EXIM BANK',
      branch: 'Panchlaish Branch',
      accountNumber: '0111-1100-482910',
      contactNo: '+880 1711-011111',
      email: 'panchlaish@eximbankbd.com',
      address: 'Panchlaish, Chattogram',
      openingBalance: 520000,
      ledgerId: 'ldg-10107',
      active: true,
    },
    {
      id: 'bnk-sonali',
      name: 'SONALI BANK PLC',
      branch: 'Panchlaish Chattogram',
      accountNumber: '0244-0100-889201',
      contactNo: '+880 1811-224466',
      email: 'panchlaish@sonalibank.com.bd',
      address: 'Panchlaish Commercial Area, Chattogram',
      openingBalance: 310000,
      ledgerId: 'ldg-10108',
      active: true,
    },
  ],
  parties: [
    {
      id: 'pty-1',
      name: 'Cambridge & Oxford Book House BD',
      partyType: 'Publisher / Books',
      contactNo: '+880 1711-902311',
      email: 'orders@bookhousebd.com',
      address: 'Nilkhet & Anderkilla Book Market',
      openingBalance: 25000,
      active: true,
    },
    {
      id: 'pty-2',
      name: 'Dhaka Tailors & School Uniforms Ltd.',
      partyType: 'Vendor / Supplier',
      contactNo: '+880 1819-441122',
      email: 'sales@dhakauniforms.com',
      address: 'Mirpur & Agrabad Supply Hub',
      openingBalance: 15000,
      active: true,
    },
    {
      id: 'pty-3',
      name: 'BPDB / DESCO Power & Fiber Broadband',
      partyType: 'Landlord / Utility',
      contactNo: '+880 1911-009911',
      address: 'Campus Utility Billing Desk',
      openingBalance: 0,
      active: true,
    },
  ],
  cheques: [
    {
      id: 'chq-1',
      chequeSerial: 'CHQ-2026-001',
      bankId: 'bnk-exim',
      bankName: 'EXIM BANK',
      accountNumber: '0111-1100-482910',
      chequeNumber: '4829101',
      issueDate: '2026-11-18',
      payeeName: 'Cambridge & Oxford Book House BD',
      amount: 42000,
      status: 'Cleared',
      active: true,
      notes: 'Winter term Cambridge Primary workbook batch payment',
    },
    {
      id: 'chq-2',
      chequeSerial: 'CHQ-2026-002',
      bankId: 'bnk-sonali',
      bankName: 'SONALI BANK PLC',
      accountNumber: '0244-0100-889201',
      chequeNumber: '8892045',
      issueDate: '2026-11-24',
      payeeName: 'Dhaka Tailors & School Uniforms Ltd.',
      amount: 28500,
      status: 'Active',
      active: true,
      notes: 'Winter blazer & house tie supply order',
    },
  ],
  pettyCashFunds: [
    {
      id: 'pcf-1',
      dateIso: '2026-11-01',
      amount: 25000,
      sourceLedgerId: 'ldg-10109',
      sourceLedgerName: 'Cash in Hand (Head Office)',
      reference: 'OPENING-NOV-2026',
      addedBy: 'Rafiqul Islam (Accountant)',
    },
  ],
  pettyCashRequisitions: [
    {
      id: 'pcr-1',
      reqNo: 'REQ-2026-001',
      applicantName: 'Nadia Rahman',
      department: 'Science & Physics Lab',
      purpose: 'Battery cells, copper wires & small light bulbs for Class 6A circuits lab',
      amount: 2400,
      dateIso: '2026-11-19',
      priority: 'Normal',
      status: 'approved',
      remarks: 'Approved & disbursed from Head Office Petty Cash',
      decidedBy: 'Shahid (Principal)',
      decidedAt: '2026-11-19',
      linkedVoucherId: 'vch-4',
    },
    {
      id: 'pcr-2',
      reqNo: 'REQ-2026-002',
      applicantName: 'Kamal Hossain',
      department: 'Campus Security & Gate',
      purpose: 'Replacement visitor lanyards, raincoats & megaphone batteries for Unit-1 Gate',
      amount: 1850,
      dateIso: '2026-11-24',
      priority: 'High',
      status: 'pending',
      remarks: 'Needed before Thursday dismissal rush',
    },
  ],
  vouchers: [
    {
      id: 'vch-1',
      voucherNo: 'CV-2026-354',
      type: 'credit',
      transactionFor: 'Fee',
      dateIso: '2026-11-05',
      accountLabel: 'Tuition Fees',
      partyOrReceiver: 'Rafiqul Islam (Accounts)',
      paymentMode: 'Bank',
      referenceNo: 'SONALI-NOV-BATCH1',
      narration: 'November 2026 Tuition Fees collection batch deposited to Sonali Bank PLC',
      totalAmount: 289065,
      lines: [
        { id: 'ln-1a', ledgerId: 'ldg-10108', ledgerCode: '10108', ledgerName: 'SONALI BANK PLC (Tuition Collection)', debit: 289065, credit: 0 },
        { id: 'ln-1b', ledgerId: 'ldg-30006', ledgerCode: '30006', ledgerName: 'Tuition Fees', debit: 0, credit: 289065 },
      ],
      createdBy: 'Rafiqul Islam',
      createdAt: '2026-11-05',
    },
    {
      id: 'vch-2',
      voucherNo: 'CV-2026-355',
      type: 'credit',
      transactionFor: 'Others',
      dateIso: '2026-11-12',
      accountLabel: 'Admission Fees',
      partyOrReceiver: 'Rafiqul Islam (Accounts)',
      paymentMode: 'Cash',
      referenceNo: 'ADM-2027-EARLY',
      narration: '2027 Admission Forms & Seat Confirmation fees received at Unit-1 Desk',
      totalAmount: 48500,
      lines: [
        { id: 'ln-2a', ledgerId: 'ldg-10109', ledgerCode: '10109', ledgerName: 'Cash in Hand (Head Office)', debit: 48500, credit: 0 },
        { id: 'ln-2b', ledgerId: 'ldg-30002', ledgerCode: '30002', ledgerName: 'Admission Fees', debit: 0, credit: 48500 },
      ],
      createdBy: 'Rafiqul Islam',
      createdAt: '2026-11-12',
    },
    {
      id: 'vch-3',
      voucherNo: 'DV-2026-201',
      type: 'debit',
      transactionFor: 'Salary',
      dateIso: '2026-11-15',
      accountLabel: 'Full-Time Teacher Salaries',
      partyOrReceiver: 'DMHA Teaching Faculty',
      paymentMode: 'Bank',
      referenceNo: 'EXIM-PAYROLL-NOV',
      narration: 'Monthly salary disbursement to full-time teachers via EXIM Bank',
      totalAmount: 168000,
      lines: [
        { id: 'ln-3a', ledgerId: 'ldg-40004', ledgerCode: '40004', ledgerName: 'Full-Time Teacher Salaries', debit: 168000, credit: 0 },
        { id: 'ln-3b', ledgerId: 'ldg-10107', ledgerCode: '10107', ledgerName: 'EXIM BANK (Main Operating A/C)', debit: 0, credit: 168000 },
      ],
      createdBy: 'Shahid (Principal)',
      createdAt: '2026-11-15',
    },
    {
      id: 'vch-4',
      voucherNo: 'DV-2026-202',
      type: 'debit',
      transactionFor: 'Expense',
      dateIso: '2026-11-19',
      accountLabel: 'Festival & Cultural Event Cost',
      partyOrReceiver: 'Nadia Rahman (REQ-2026-001)',
      paymentMode: 'Cash',
      referenceNo: 'REQ-2026-001',
      narration: 'Petty Cash disbursement for Class 6A Science Lab circuits supplies',
      totalAmount: 2400,
      lines: [
        { id: 'ln-4a', ledgerId: 'ldg-40001', ledgerCode: '40001', ledgerName: 'Festival & Cultural Event Cost', debit: 2400, credit: 0 },
        { id: 'ln-4b', ledgerId: 'ldg-10110', ledgerCode: '10110', ledgerName: 'Petty Cash Fund', debit: 0, credit: 2400 },
      ],
      createdBy: 'Shahid (Principal)',
      createdAt: '2026-11-19',
    },
    {
      id: 'vch-5',
      voucherNo: 'DV-2026-203',
      type: 'debit',
      transactionFor: 'Expense',
      dateIso: '2026-11-21',
      accountLabel: 'Electricity, Internet & Utilities',
      partyOrReceiver: 'BPDB / DESCO Power & Fiber Broadband',
      paymentMode: 'Bank',
      referenceNo: 'UTIL-NOV-2026',
      narration: 'Unit-1 & Unit-2 electricity and dedicated campus Wi-Fi fiber bills',
      totalAmount: 24800,
      lines: [
        { id: 'ln-5a', ledgerId: 'ldg-40003', ledgerCode: '40003', ledgerName: 'Electricity, Internet & Utilities', debit: 24800, credit: 0 },
        { id: 'ln-5b', ledgerId: 'ldg-10107', ledgerCode: '10107', ledgerName: 'EXIM BANK (Main Operating A/C)', debit: 0, credit: 24800 },
      ],
      createdBy: 'Rafiqul Islam',
      createdAt: '2026-11-21',
    },
    {
      id: 'vch-6',
      voucherNo: 'CT-2026-041',
      type: 'contra',
      transactionFor: 'Transfer',
      dateIso: '2026-11-22',
      accountLabel: 'EXIM BANK ← Cash in Hand',
      partyOrReceiver: 'Head Office Treasury Deposit',
      paymentMode: 'Bank',
      referenceNo: 'DEP-SLIP-8841',
      narration: 'Cash deposit from Head Office counter into EXIM Bank main operating account',
      totalAmount: 35000,
      lines: [
        { id: 'ln-6a', ledgerId: 'ldg-10107', ledgerCode: '10107', ledgerName: 'EXIM BANK (Main Operating A/C)', debit: 35000, credit: 0 },
        { id: 'ln-6b', ledgerId: 'ldg-10109', ledgerCode: '10109', ledgerName: 'Cash in Hand (Head Office)', debit: 0, credit: 35000 },
      ],
      createdBy: 'Rafiqul Islam',
      createdAt: '2026-11-22',
    },
    {
      id: 'vch-7',
      voucherNo: 'JV-2026-019',
      type: 'journal',
      transactionFor: 'Adjustment',
      dateIso: '2026-11-23',
      accountLabel: 'Books, Examination & Stationery Fees',
      partyOrReceiver: 'Accrual Recognition',
      paymentMode: 'Non-Cash',
      referenceNo: 'ACCR-WIN-2026',
      narration: 'Recognize Winter Term book & exam fee receivables for Class 4–6 students',
      totalAmount: 18500,
      lines: [
        { id: 'ln-7a', ledgerId: 'ldg-10101', ledgerCode: '10101', ledgerName: 'Book Fee Receivable', debit: 18500, credit: 0 },
        { id: 'ln-7b', ledgerId: 'ldg-30004', ledgerCode: '30004', ledgerName: 'Books, Examination & Stationery Fees', debit: 0, credit: 18500 },
      ],
      createdBy: 'Rafiqul Islam',
      createdAt: '2026-11-23',
    },
  ],
}

export interface LedgerBalanceRow {
  ledger: AccountLedgerItem
  openingDebit: number
  openingCredit: number
  periodDebit: number
  periodCredit: number
  closingDebit: number
  closingCredit: number
  netBalance: number
}

function inDateRange(dateIso: string, fromDate?: string, toDate?: string): boolean {
  if (fromDate && dateIso < fromDate) return false
  if (toDate && dateIso > toDate) return false
  return true
}

export function computeTrialBalance(
  book: AccountingBookState,
  fromDate?: string,
  toDate?: string,
): {
  rows: LedgerBalanceRow[]
  totalOpeningDebit: number
  totalOpeningCredit: number
  totalPeriodDebit: number
  totalPeriodCredit: number
  totalClosingDebit: number
  totalClosingCredit: number
  isBalanced: boolean
} {
  const rows: LedgerBalanceRow[] = book.ledgers.map((ledger) => {
    const debitNormal = isDebitNormalHead(ledger.head)
    let openingDr = debitNormal ? Math.max(0, ledger.openingBalance) : 0
    let openingCr = !debitNormal ? Math.max(0, ledger.openingBalance) : 0
    let periodDr = 0
    let periodCr = 0

    for (const v of book.vouchers) {
      for (const ln of v.lines) {
        if (ln.ledgerId !== ledger.id) continue
        if (fromDate && v.dateIso < fromDate) {
          openingDr += ln.debit
          openingCr += ln.credit
        } else if (inDateRange(v.dateIso, fromDate, toDate)) {
          periodDr += ln.debit
          periodCr += ln.credit
        }
      }
    }

    const totalDr = openingDr + periodDr
    const totalCr = openingCr + periodCr
    const netDrMinusCr = totalDr - totalCr
    const closingDebit = netDrMinusCr > 0 ? netDrMinusCr : 0
    const closingCredit = netDrMinusCr < 0 ? Math.abs(netDrMinusCr) : 0
    const netBalance = debitNormal ? netDrMinusCr : -netDrMinusCr

    return {
      ledger,
      openingDebit: openingDr,
      openingCredit: openingCr,
      periodDebit: periodDr,
      periodCredit: periodCr,
      closingDebit,
      closingCredit,
      netBalance,
    }
  })

  const totalOpeningDebit = rows.reduce((s, r) => s + r.openingDebit, 0)
  const totalOpeningCredit = rows.reduce((s, r) => s + r.openingCredit, 0)
  const totalPeriodDebit = rows.reduce((s, r) => s + r.periodDebit, 0)
  const totalPeriodCredit = rows.reduce((s, r) => s + r.periodCredit, 0)
  const totalClosingDebit = rows.reduce((s, r) => s + r.closingDebit, 0)
  const totalClosingCredit = rows.reduce((s, r) => s + r.closingCredit, 0)

  return {
    rows,
    totalOpeningDebit,
    totalOpeningCredit,
    totalPeriodDebit,
    totalPeriodCredit,
    totalClosingDebit,
    totalClosingCredit,
    isBalanced: Math.abs(totalClosingDebit - totalClosingCredit) < 0.01,
  }
}

export interface LedgerStatementEntry {
  dateIso: string
  voucherId: string
  voucherNo: string
  voucherType: AccountingVoucher['type']
  particular: string
  code: string
  narration: string
  debit: number
  credit: number
  runningBalance: number
}

export function computeLedgerStatement(
  book: AccountingBookState,
  ledgerId: string,
  fromDate?: string,
  toDate?: string,
): {
  ledger: AccountLedgerItem | null
  openingBalance: number
  entries: LedgerStatementEntry[]
  totalDebit: number
  totalCredit: number
  closingBalance: number
} {
  const ledger = book.ledgers.find((l) => l.id === ledgerId) || null
  if (!ledger) {
    return { ledger: null, openingBalance: 0, entries: [], totalDebit: 0, totalCredit: 0, closingBalance: 0 }
  }
  const debitNormal = isDebitNormalHead(ledger.head)
  let running = ledger.openingBalance

  const sortedVouchers = [...book.vouchers].sort((a, b) =>
    a.dateIso.localeCompare(b.dateIso) || a.voucherNo.localeCompare(b.voucherNo),
  )

  const entries: LedgerStatementEntry[] = []
  for (const v of sortedVouchers) {
    const myLines = v.lines.filter((ln) => ln.ledgerId === ledgerId)
    if (myLines.length === 0) continue

    const counterNames = v.lines
      .filter((ln) => ln.ledgerId !== ledgerId)
      .map((ln) => ln.ledgerName)
      .join(', ')

    for (const ln of myLines) {
      const delta = debitNormal ? ln.debit - ln.credit : ln.credit - ln.debit
      if (fromDate && v.dateIso < fromDate) {
        running += delta
        continue
      }
      if (!inDateRange(v.dateIso, fromDate, toDate)) continue
      running += delta
      entries.push({
        dateIso: v.dateIso,
        voucherId: v.id,
        voucherNo: v.voucherNo,
        voucherType: v.type,
        particular: counterNames || v.accountLabel,
        code: ledger.code,
        narration: v.narration,
        debit: ln.debit,
        credit: ln.credit,
        runningBalance: running,
      })
    }
  }

  const openingBalance =
    entries.length > 0
      ? running -
        entries.reduce(
          (s, e) => s + (debitNormal ? e.debit - e.credit : e.credit - e.debit),
          0,
        )
      : running

  return {
    ledger,
    openingBalance,
    entries,
    totalDebit: entries.reduce((s, e) => s + e.debit, 0),
    totalCredit: entries.reduce((s, e) => s + e.credit, 0),
    closingBalance: running,
  }
}

export function computeFinancialStatements(
  book: AccountingBookState,
  fromDate?: string,
  toDate?: string,
) {
  const tb = computeTrialBalance(book, fromDate, toDate)
  const incomeRows = tb.rows.filter((r) => r.ledger.head === 'Income' && r.netBalance !== 0)
  const expenseRows = tb.rows.filter((r) => r.ledger.head === 'Expense' && r.netBalance !== 0)
  const totalIncome = incomeRows.reduce((s, r) => s + r.netBalance, 0)
  const totalExpense = expenseRows.reduce((s, r) => s + r.netBalance, 0)
  const netSurplus = totalIncome - totalExpense

  const fixedAssets = tb.rows.filter((r) => r.ledger.head === 'Fixed Asset' && r.netBalance !== 0)
  const currentAssets = tb.rows.filter((r) => r.ledger.head === 'Current Asset' && r.netBalance !== 0)
  const currentLiabilities = tb.rows.filter((r) => r.ledger.head === 'Current Liability' && r.netBalance !== 0)
  const longTermLiabilities = tb.rows.filter((r) => r.ledger.head === 'Long Term Liability' && r.netBalance !== 0)
  const equityRows = tb.rows.filter((r) => r.ledger.head === 'Equity (Funds)' && r.netBalance !== 0)

  const totalAssets =
    fixedAssets.reduce((s, r) => s + r.netBalance, 0) +
    currentAssets.reduce((s, r) => s + r.netBalance, 0)
  const totalLiabilities =
    currentLiabilities.reduce((s, r) => s + r.netBalance, 0) +
    longTermLiabilities.reduce((s, r) => s + r.netBalance, 0)
  const totalEquity = equityRows.reduce((s, r) => s + r.netBalance, 0) + netSurplus

  const cashAndBankTotal = tb.rows
    .filter((r) => r.ledger.isBank || r.ledger.isCash)
    .reduce((s, r) => s + r.netBalance, 0)

  return {
    tb,
    incomeRows,
    expenseRows,
    totalIncome,
    totalExpense,
    netSurplus,
    fixedAssets,
    currentAssets,
    currentLiabilities,
    longTermLiabilities,
    equityRows,
    totalAssets,
    totalLiabilities,
    totalEquity,
    cashAndBankTotal,
    balanceSheetBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  }
}

export function computePettyCashSummary(book: AccountingBookState) {
  const totalFund = book.pettyCashFunds.reduce((s, f) => s + f.amount, 0)
  const approved = book.pettyCashRequisitions
    .filter((r) => r.status === 'approved')
    .reduce((s, r) => s + r.amount, 0)
  const pending = book.pettyCashRequisitions
    .filter((r) => r.status === 'pending')
    .reduce((s, r) => s + r.amount, 0)
  const balance = Math.max(0, totalFund - approved)
  return { totalFund, approved, pending, balance }
}

export function getLedgerPath(book: AccountingBookState, ledger: AccountLedgerItem): string {
  const grp = book.groups.find((g) => g.id === ledger.groupId)?.name || 'General'
  const sub = book.subGroups.find((s) => s.id === ledger.subGroupId)?.name || 'General'
  return `${ledger.head} › ${grp} › ${sub}`
}

export function loadAccountingBookSafe(
  currentData: Record<string, unknown>,
): AccountingBookState {
  const raw = currentData.accountingBook as Partial<AccountingBookState> | undefined
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.ledgers)) {
    return structuredClone(initialAccountingBook)
  }
  return {
    groups: Array.isArray(raw.groups) ? raw.groups : initialAccountingBook.groups,
    subGroups: Array.isArray(raw.subGroups) ? raw.subGroups : initialAccountingBook.subGroups,
    ledgers: raw.ledgers,
    banks: Array.isArray(raw.banks) ? raw.banks : initialAccountingBook.banks,
    parties: Array.isArray(raw.parties) ? raw.parties : initialAccountingBook.parties,
    cheques: Array.isArray(raw.cheques) ? raw.cheques : initialAccountingBook.cheques,
    pettyCashFunds: Array.isArray(raw.pettyCashFunds)
      ? raw.pettyCashFunds
      : initialAccountingBook.pettyCashFunds,
    pettyCashRequisitions: Array.isArray(raw.pettyCashRequisitions)
      ? raw.pettyCashRequisitions
      : initialAccountingBook.pettyCashRequisitions,
    vouchers: Array.isArray(raw.vouchers) ? raw.vouchers : initialAccountingBook.vouchers,
  }
}

export function appendAutoCreditVoucher(
  book: AccountingBookState,
  opts: {
    amount: number
    title: string
    category?: string
    paymentMethod?: string
    receiptNo?: string
    partyName?: string
    actorName: string
  },
): { nextBook: AccountingBookState; voucher: AccountingVoucher } {
  const amt = Math.max(0, Math.round(Number(opts.amount || 0)))
  const todayIso = new Date().toISOString().slice(0, 10)
  const isCash = (opts.paymentMethod || '').toLowerCase().includes('cash')

  // Debit Ledger: Cash in Hand or Sonali/EXIM Bank Collection A/C
  const debitLedger =
    (isCash
      ? book.ledgers.find((l) => l.id === 'ldg-10109' || l.isCash)
      : book.ledgers.find((l) => l.id === 'ldg-10108' || l.id === 'ldg-10107' || l.isBank)) ||
    book.ledgers.find((l) => l.isCash || l.isBank) ||
    book.ledgers[0]

  // Credit Ledger: Appropriate Income Account
  const catLower = (opts.category || '').toLowerCase()
  const creditLedger =
    (catLower.includes('admission')
      ? book.ledgers.find((l) => l.id === 'ldg-30002' || l.name.toLowerCase().includes('admission'))
      : catLower.includes('exam') || catLower.includes('book') || catLower.includes('lab') || catLower.includes('library')
        ? book.ledgers.find((l) => l.id === 'ldg-30004' || l.name.toLowerCase().includes('examination'))
        : book.ledgers.find((l) => l.id === 'ldg-30006' || l.name.toLowerCase().includes('tuition'))) ||
    book.ledgers.find((l) => l.head === 'Income') ||
    book.ledgers[book.ledgers.length - 1]

  const prefix = 'CV-2026-'
  const nums = book.vouchers
    .filter((v) => v.voucherNo.startsWith(prefix))
    .map((v) => Number.parseInt(v.voucherNo.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
  const nextNum = (nums.length > 0 ? Math.max(...nums) : 100) + 1
  const voucherNo = `${prefix}${String(nextNum).padStart(3, '0')}`

  const methodMode: NonNullable<AccountingVoucher['paymentMode']> = isCash
    ? 'Cash'
    : (opts.paymentMethod || '').toLowerCase().includes('bkash') ||
        (opts.paymentMethod || '').toLowerCase().includes('nagad')
      ? 'bKash / Nagad'
      : 'Bank'

  const vId = `vch-auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const voucher: AccountingVoucher = {
    id: vId,
    voucherNo,
    type: 'credit',
    transactionFor: 'Fee',
    dateIso: todayIso,
    accountLabel: debitLedger.name,
    partyOrReceiver: opts.partyName || 'DMHA Student',
    referenceNo: opts.receiptNo || voucherNo,
    paymentMode: methodMode,
    narration: `Auto-posted receipt: ${opts.title}${opts.partyName ? ` (${opts.partyName})` : ''}`,
    totalAmount: amt,
    createdBy: opts.actorName,
    createdAt: todayIso,
    lines: [
      {
        id: `${vId}-dr`,
        ledgerId: debitLedger.id,
        ledgerCode: debitLedger.code,
        ledgerName: debitLedger.name,
        debit: amt,
        credit: 0,
        note: `${methodMode} received · ${opts.partyName || 'Student Fee'}`,
      },
      {
        id: `${vId}-cr`,
        ledgerId: creditLedger.id,
        ledgerCode: creditLedger.code,
        ledgerName: creditLedger.name,
        debit: 0,
        credit: amt,
        note: `${opts.category || 'School Fee'} · ${opts.title}`,
      },
    ],
  }

  return {
    voucher,
    nextBook: {
      ...book,
      vouchers: [voucher, ...book.vouchers],
    },
  }
}
