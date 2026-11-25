import type { AccountingBookState, AccountingVoucher } from '@/components/school/types'

/**
 * Auto-posts a balanced Double-Entry Debit Voucher (Expense Dr / Cash or Bank Cr)
 * when Quick Costs / Expenses are paid, keeping Trial Balance & P&L 100% synchronized.
 */
export function appendAutoDebitVoucher(
  book: AccountingBookState,
  opts: {
    amount: number
    title: string
    category?: string
    vendor?: string
    paymentMethod?: string
    actorName: string
  },
): { nextBook: AccountingBookState; voucher: AccountingVoucher } {
  const amt = Math.max(0, Math.round(Number(opts.amount || 0)))
  const todayIso = new Date().toISOString().slice(0, 10)
  const isCash = (opts.paymentMethod || 'Cash').toLowerCase().includes('cash')

  const catLower = (opts.category || '').toLowerCase()
  const expenseLedger =
    (catLower.includes('salary') || catLower.includes('payroll')
      ? book.ledgers.find((l) => l.name.toLowerCase().includes('salary'))
      : catLower.includes('utility') || catLower.includes('electric') || catLower.includes('internet')
        ? book.ledgers.find((l) => l.name.toLowerCase().includes('utilit') || l.name.toLowerCase().includes('electric'))
        : catLower.includes('lab') || catLower.includes('library') || catLower.includes('stationery')
          ? book.ledgers.find((l) => l.name.toLowerCase().includes('stationery') || l.name.toLowerCase().includes('academic'))
          : catLower.includes('transport') || catLower.includes('bus') || catLower.includes('fuel')
            ? book.ledgers.find((l) => l.name.toLowerCase().includes('transport') || l.name.toLowerCase().includes('maintenance'))
            : book.ledgers.find((l) => l.head === 'Expense')) ||
    book.ledgers.find((l) => l.head === 'Expense') ||
    book.ledgers[0]

  const creditLedger =
    (isCash
      ? book.ledgers.find((l) => l.id === 'ldg-10109' || l.isCash)
      : book.ledgers.find((l) => l.id === 'ldg-10107' || l.isBank)) ||
    book.ledgers.find((l) => l.isCash || l.isBank) ||
    book.ledgers[0]

  const prefix = 'DV-2026-'
  const nums = book.vouchers
    .filter((v) => v.voucherNo.startsWith(prefix))
    .map((v) => Number.parseInt(v.voucherNo.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
  const nextNum = (nums.length > 0 ? Math.max(...nums) : 100) + 1
  const voucherNo = `${prefix}${String(nextNum).padStart(3, '0')}`

  const vId = `vch-exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const voucher: AccountingVoucher = {
    id: vId,
    voucherNo,
    type: 'debit',
    transactionFor: 'Expense',
    dateIso: todayIso,
    accountLabel: creditLedger.name,
    partyOrReceiver: opts.vendor || 'Campus Vendor',
    referenceNo: voucherNo,
    paymentMode: isCash ? 'Cash' : 'Bank',
    narration: `Auto-posted expense: ${opts.title} (${opts.category || 'Campus Cost'})`,
    totalAmount: amt,
    createdBy: opts.actorName,
    createdAt: todayIso,
    lines: [
      {
        id: `${vId}-dr`,
        ledgerId: expenseLedger.id,
        ledgerCode: expenseLedger.code,
        ledgerName: expenseLedger.name,
        debit: amt,
        credit: 0,
        note: `${opts.category || 'Expense'} · ${opts.title}`,
      },
      {
        id: `${vId}-cr`,
        ledgerId: creditLedger.id,
        ledgerCode: creditLedger.code,
        ledgerName: creditLedger.name,
        debit: 0,
        credit: amt,
        note: `Paid to ${opts.vendor || 'Campus Vendor'}`,
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
