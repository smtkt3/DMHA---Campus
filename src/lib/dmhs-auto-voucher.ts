import type { AccountingBookState, AccountingVoucher } from '@/components/school/types'
import { initialAccountingBook } from './dmhs-accounting'

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

  const debitLedger =
    (isCash
      ? book.ledgers.find((l) => l.id === 'ldg-10109' || l.isCash)
      : book.ledgers.find((l) => l.id === 'ldg-10108' || l.id === 'ldg-10107' || l.isBank)) ||
    book.ledgers.find((l) => l.isCash || l.isBank) ||
    book.ledgers[0]

  const catLower = (opts.category || '').toLowerCase()
  const creditLedger =
    (catLower.includes('admission')
      ? book.ledgers.find((l) => l.id === 'ldg-30002' || l.name.toLowerCase().includes('admission'))
      : catLower.includes('exam') ||
          catLower.includes('book') ||
          catLower.includes('lab') ||
          catLower.includes('library')
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
