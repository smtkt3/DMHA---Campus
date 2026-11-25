import { NextResponse } from 'next/server'
import {
  computePettyCashSummary,
  initialAccountingBook,
  nextLedgerCode,
} from '@/lib/dmhs-accounting'
import { appendSecurityAudit, loadPersistedState, savePersistedState } from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import {
  getClientIpFromRequest,
  requireAuthSession,
  staffHasServerPermission,
} from '@/lib/dmhs-security'
import type {
  AccountGroupItem,
  AccountLedgerItem,
  AccountSubGroupItem,
  AccountingBookState,
  AccountingHead,
  AccountingPartyRecord,
  AccountingVoucher,
  ChequeRegisterItem,
  PettyCashFundEntry,
  PettyCashRequisition,
  SchoolBankRecord,
  VoucherEntryLine,
  VoucherType,
} from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function loadBook(currentData: Record<string, unknown>): AccountingBookState {
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

function nextVoucherNumber(type: VoucherType, existing: AccountingVoucher[]): string {
  const prefixMap: Record<VoucherType, string> = {
    credit: 'CV',
    debit: 'DV',
    journal: 'JV',
    contra: 'CT',
  }
  const prefix = `${prefixMap[type]}-2026-`
  const nums = existing
    .filter((v) => v.voucherNo.startsWith(prefix))
    .map((v) => Number.parseInt(v.voucherNo.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
  const nextNum = (nums.length > 0 ? Math.max(...nums) : 100) + 1
  return `${prefix}${String(nextNum).padStart(3, '0')}`
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['admin', 'staff'])
    if (!auth.ok) return auth.response
    const { session } = auth

    if (
      session.role === 'staff' &&
      !staffHasServerPermission(session.linked_entity_id, 'accounts')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Access Denied: Accounts Management permission is required.' },
        { status: 403 },
      )
    }

    const ip = getClientIpFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    const state = loadPersistedState()
    const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
    const book = loadBook(currentData)
    const todayIso = new Date().toISOString().slice(0, 10)

    const persistBook = (nextBook: AccountingBookState, summary: string, auditAction: string, auditTarget: string) => {
      const saved = savePersistedState(
        { ...currentData, accountingBook: nextBook },
        session.display_name,
      )
      appendSecurityAudit({
        action: auditAction,
        target: auditTarget,
        actor: session.display_name,
        actorRole: session.role,
        ipAddress: ip,
      })
      broadcastDmhsEvent({
        type: 'state_updated',
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: session.display_name,
        summary,
      })
      return NextResponse.json({ ok: true, accountingBook: nextBook, version: saved.version })
    }

    // ==================== 1. ACCOUNTS GROUP ====================
    if (action === 'save_group') {
      const head = body.head as AccountingHead
      const name = String(body.name || '').trim().slice(0, 100)
      const active = body.active !== false
      const id = String(body.id || '').trim()
      if (!head || !name) {
        return NextResponse.json({ ok: false, error: 'Account Head and Group Name are required.' }, { status: 400 })
      }
      const nextGroups: AccountGroupItem[] = id
        ? book.groups.map((g) => (g.id === id ? { ...g, head, name, active } : g))
        : [...book.groups, { id: `grp-${Date.now()}`, head, name, active }]
      return persistBook({ ...book, groups: nextGroups }, `Saved account group: ${name}`, 'accounting_group_saved', `${head} > ${name}`)
    }

    if (action === 'delete_group') {
      const id = String(body.id || '')
      if (book.subGroups.some((s) => s.groupId === id) || book.ledgers.some((l) => l.groupId === id)) {
        return NextResponse.json(
          { ok: false, error: 'Cannot delete group while sub-groups or ledgers exist under it.' },
          { status: 409 },
        )
      }
      return persistBook(
        { ...book, groups: book.groups.filter((g) => g.id !== id) },
        'Account group deleted',
        'accounting_group_deleted',
        id,
      )
    }

    // ==================== 2. ACCOUNTS SUB-GROUP ====================
    if (action === 'save_subgroup') {
      const head = body.head as AccountingHead
      const groupId = String(body.groupId || '').trim()
      const name = String(body.name || '').trim().slice(0, 100)
      const active = body.active !== false
      const id = String(body.id || '').trim()
      if (!head || !groupId || !name) {
        return NextResponse.json({ ok: false, error: 'Head, Group, and Sub-Group Name are required.' }, { status: 400 })
      }
      const nextSubs: AccountSubGroupItem[] = id
        ? book.subGroups.map((s) => (s.id === id ? { ...s, head, groupId, name, active } : s))
        : [...book.subGroups, { id: `sub-${Date.now()}`, head, groupId, name, active }]
      return persistBook({ ...book, subGroups: nextSubs }, `Saved sub-group: ${name}`, 'accounting_subgroup_saved', name)
    }

    if (action === 'delete_subgroup') {
      const id = String(body.id || '')
      if (book.ledgers.some((l) => l.subGroupId === id)) {
        return NextResponse.json(
          { ok: false, error: 'Cannot delete sub-group while ledgers are linked to it.' },
          { status: 409 },
        )
      }
      return persistBook(
        { ...book, subGroups: book.subGroups.filter((s) => s.id !== id) },
        'Account sub-group deleted',
        'accounting_subgroup_deleted',
        id,
      )
    }

    // ==================== 3. ACCOUNTS LEDGER (CHART OF ACCOUNTS) ====================
    if (action === 'save_ledger') {
      const subGroupId = String(body.subGroupId || '').trim()
      const sub = book.subGroups.find((s) => s.id === subGroupId)
      const name = String(body.name || '').trim().slice(0, 120)
      const openingBalance = Math.max(0, Number(body.openingBalance || 0))
      const isBank = Boolean(body.isBank)
      const isParty = Boolean(body.isParty)
      const isCash = Boolean(body.isCash)
      const active = body.active !== false
      const id = String(body.id || '').trim()

      if (!sub || !name) {
        return NextResponse.json(
          { ok: false, error: 'Select a valid Parent Sub-Group and enter Ledger Name.' },
          { status: 400 },
        )
      }
      const nextLedgers: AccountLedgerItem[] = id
        ? book.ledgers.map((l) =>
            l.id === id
              ? {
                  ...l,
                  head: sub.head,
                  groupId: sub.groupId,
                  subGroupId: sub.id,
                  name,
                  openingBalance,
                  isBank,
                  isParty,
                  isCash,
                  active,
                }
              : l,
          )
        : [
            ...book.ledgers,
            {
              id: `ldg-${Date.now()}`,
              code: nextLedgerCode(sub.head, book.ledgers),
              head: sub.head,
              groupId: sub.groupId,
              subGroupId: sub.id,
              name,
              openingBalance,
              isBank,
              isParty,
              isCash,
              active,
            },
          ]
      return persistBook({ ...book, ledgers: nextLedgers }, `Saved ledger: ${name}`, 'accounting_ledger_saved', name)
    }

    if (action === 'delete_ledger') {
      const id = String(body.id || '')
      const usedInVoucher = book.vouchers.some((v) => v.lines.some((ln) => ln.ledgerId === id))
      if (usedInVoucher) {
        return NextResponse.json(
          { ok: false, error: 'Cannot delete ledger with posted vouchers. Mark it Inactive instead.' },
          { status: 409 },
        )
      }
      return persistBook(
        { ...book, ledgers: book.ledgers.filter((l) => l.id !== id) },
        'Account ledger deleted',
        'accounting_ledger_deleted',
        id,
      )
    }

    // ==================== 4. BANK DIRECTORY ====================
    if (action === 'save_bank') {
      const name = String(body.name || '').trim().slice(0, 100)
      const branch = String(body.branch || '').trim().slice(0, 100)
      const accountNumber = String(body.accountNumber || '').trim().slice(0, 60)
      const contactNo = String(body.contactNo || '').trim().slice(0, 40)
      const email = String(body.email || '').trim().slice(0, 100)
      const address = String(body.address || '').trim().slice(0, 200)
      const openingBalance = Math.max(0, Number(body.openingBalance || 0))
      const active = body.active !== false
      const id = String(body.id || '').trim()
      if (!name || !contactNo || !accountNumber) {
        return NextResponse.json(
          { ok: false, error: 'Bank Name, Account Number, and Contact No are required.' },
          { status: 400 },
        )
      }

      let nextLedgers = book.ledgers
      let nextBanks: SchoolBankRecord[]
      if (id) {
        const existingBank = book.banks.find((b) => b.id === id)
        nextBanks = book.banks.map((b) =>
          b.id === id
            ? { ...b, name, branch, accountNumber, contactNo, email, address, openingBalance, active }
            : b,
        )
        if (existingBank) {
          nextLedgers = book.ledgers.map((l) =>
            l.id === existingBank.ledgerId
              ? { ...l, name: `${name} (${branch || 'Bank A/C'})`, openingBalance, active }
              : l,
          )
        }
      } else {
        const bankId = `bnk-${Date.now()}`
        const ledgerId = `ldg-bnk-${Date.now()}`
        const cashSub = book.subGroups.find((s) => s.id === 'sub-cash') || book.subGroups[0]
        const newLedger: AccountLedgerItem = {
          id: ledgerId,
          code: nextLedgerCode('Current Asset', book.ledgers),
          head: 'Current Asset',
          groupId: cashSub?.groupId || 'grp-cash',
          subGroupId: cashSub?.id || 'sub-cash',
          name: `${name} (${branch || 'Bank A/C'})`,
          openingBalance,
          isBank: true,
          bankId,
          active,
        }
        nextLedgers = [...book.ledgers, newLedger]
        nextBanks = [
          ...book.banks,
          { id: bankId, name, branch, accountNumber, contactNo, email, address, openingBalance, ledgerId, active },
        ]
      }
      return persistBook({ ...book, banks: nextBanks, ledgers: nextLedgers }, `Saved bank: ${name}`, 'accounting_bank_saved', name)
    }

    if (action === 'delete_bank') {
      const id = String(body.id || '')
      if (book.cheques.some((c) => c.bankId === id)) {
        return NextResponse.json(
          { ok: false, error: 'Cannot delete bank with cheques in the Cheque Register.' },
          { status: 409 },
        )
      }
      return persistBook(
        { ...book, banks: book.banks.filter((b) => b.id !== id) },
        'Bank removed',
        'accounting_bank_deleted',
        id,
      )
    }

    // ==================== 5. PARTY / VENDOR DIRECTORY ====================
    if (action === 'save_party') {
      const name = String(body.name || '').trim().slice(0, 120)
      const partyType = (body.partyType as AccountingPartyRecord['partyType']) || 'Vendor / Supplier'
      const contactNo = String(body.contactNo || '').trim().slice(0, 40)
      const email = String(body.email || '').trim().slice(0, 100)
      const address = String(body.address || '').trim().slice(0, 200)
      const openingBalance = Math.max(0, Number(body.openingBalance || 0))
      const active = body.active !== false
      const id = String(body.id || '').trim()
      if (!name || !contactNo) {
        return NextResponse.json({ ok: false, error: 'Party Name and Contact No are required.' }, { status: 400 })
      }
      const nextParties: AccountingPartyRecord[] = id
        ? book.parties.map((p) =>
            p.id === id ? { ...p, name, partyType, contactNo, email, address, openingBalance, active } : p,
          )
        : [
            ...book.parties,
            { id: `pty-${Date.now()}`, name, partyType, contactNo, email, address, openingBalance, active },
          ]
      return persistBook({ ...book, parties: nextParties }, `Saved party: ${name}`, 'accounting_party_saved', name)
    }

    if (action === 'delete_party') {
      const id = String(body.id || '')
      return persistBook(
        { ...book, parties: book.parties.filter((p) => p.id !== id) },
        'Party removed',
        'accounting_party_deleted',
        id,
      )
    }

    // ==================== 6. CHEQUE REGISTER ====================
    if (action === 'save_cheque') {
      const bankId = String(body.bankId || '').trim()
      const bank = book.banks.find((b) => b.id === bankId)
      const chequeNumber = String(body.chequeNumber || '').trim()
      const issueDate = String(body.issueDate || todayIso)
      const payeeName = String(body.payeeName || '').trim().slice(0, 120)
      const amount = Number(body.amount || 0)
      const status = (body.status as ChequeRegisterItem['status']) || 'Active'
      const notes = String(body.notes || '').trim().slice(0, 240)

      if (!bank || !chequeNumber || !payeeName || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { ok: false, error: 'Bank, Cheque Number, Payee, and positive Amount are required.' },
          { status: 400 },
        )
      }
      if (chequeNumber.includes('.')) {
        return NextResponse.json(
          { ok: false, error: 'Cheque number must not contain dots (.).' },
          { status: 400 },
        )
      }
      if (book.cheques.some((c) => c.bankId === bankId && c.chequeNumber === chequeNumber)) {
        return NextResponse.json(
          { ok: false, error: `Cheque #${chequeNumber} is already registered for ${bank.name}.` },
          { status: 409 },
        )
      }
      const serial = `CHQ-2026-${String(book.cheques.length + 1).padStart(3, '0')}`
      const newCheque: ChequeRegisterItem = {
        id: `chq-${Date.now()}`,
        chequeSerial: serial,
        bankId: bank.id,
        bankName: bank.name,
        accountNumber: bank.accountNumber,
        chequeNumber,
        issueDate,
        payeeName,
        amount: Math.round(amount),
        status,
        active: status === 'Active',
        notes,
      }
      return persistBook(
        { ...book, cheques: [newCheque, ...book.cheques] },
        `Cheque #${chequeNumber} registered (৳${Math.round(amount).toLocaleString()})`,
        'accounting_cheque_created',
        `${bank.name} #${chequeNumber} · ৳${Math.round(amount)}`,
      )
    }

    if (action === 'update_cheque_status') {
      const chequeId = String(body.chequeId || '')
      const status = body.status as ChequeRegisterItem['status']
      const postDebitLedgerId = String(body.postDebitLedgerId || '').trim()
      const target = book.cheques.find((c) => c.id === chequeId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Cheque record not found.' }, { status: 404 })
      }
      let nextVouchers = book.vouchers
      let linkedVoucherId = target.linkedVoucherId

      // Optionally post a balanced Debit Voucher automatically when cheque clears
      if (status === 'Cleared' && !linkedVoucherId && postDebitLedgerId) {
        const bank = book.banks.find((b) => b.id === target.bankId)
        const bankLedger = book.ledgers.find((l) => l.id === bank?.ledgerId)
        const debitLedger = book.ledgers.find((l) => l.id === postDebitLedgerId)
        if (bankLedger && debitLedger) {
          const vNo = nextVoucherNumber('debit', book.vouchers)
          linkedVoucherId = `vch-chq-${Date.now()}`
          const autoVoucher: AccountingVoucher = {
            id: linkedVoucherId,
            voucherNo: vNo,
            type: 'debit',
            transactionFor: 'Expense',
            dateIso: todayIso,
            accountLabel: debitLedger.name,
            partyOrReceiver: target.payeeName,
            paymentMode: 'Cheque',
            referenceNo: `CHQ#${target.chequeNumber}`,
            narration: `Cheque #${target.chequeNumber} cleared via ${target.bankName} — ${target.notes || target.payeeName}`,
            totalAmount: target.amount,
            lines: [
              { id: `ln-${Date.now()}-1`, ledgerId: debitLedger.id, ledgerCode: debitLedger.code, ledgerName: debitLedger.name, debit: target.amount, credit: 0 },
              { id: `ln-${Date.now()}-2`, ledgerId: bankLedger.id, ledgerCode: bankLedger.code, ledgerName: bankLedger.name, debit: 0, credit: target.amount },
            ],
            createdBy: session.display_name,
            createdAt: todayIso,
          }
          nextVouchers = [autoVoucher, ...book.vouchers]
        }
      }

      const nextCheques = book.cheques.map((c) =>
        c.id === chequeId ? { ...c, status, active: status === 'Active', linkedVoucherId } : c,
      )
      return persistBook(
        { ...book, cheques: nextCheques, vouchers: nextVouchers },
        `Cheque #${target.chequeNumber} marked ${status}`,
        'accounting_cheque_updated',
        `${target.chequeNumber} -> ${status}`,
      )
    }

    if (action === 'delete_cheque') {
      const chequeId = String(body.chequeId || '')
      return persistBook(
        { ...book, cheques: book.cheques.filter((c) => c.id !== chequeId) },
        'Cheque deleted',
        'accounting_cheque_deleted',
        chequeId,
      )
    }

    // ==================== 7. PETTY CASH & REQUISITION ====================
    if (action === 'add_petty_fund') {
      const amount = Math.round(Number(body.amount || 0))
      const sourceLedgerId = String(body.sourceLedgerId || 'ldg-10109')
      const reference = String(body.reference || `TOPUP-${todayIso}`).trim()
      const sourceLedger = book.ledgers.find((l) => l.id === sourceLedgerId)
      const pettyLedger = book.ledgers.find((l) => l.id === 'ldg-10110')
      if (!Number.isFinite(amount) || amount <= 0 || !sourceLedger || !pettyLedger) {
        return NextResponse.json({ ok: false, error: 'Valid positive amount and funding account required.' }, { status: 400 })
      }
      if (sourceLedger.id === pettyLedger.id) {
        return NextResponse.json({ ok: false, error: 'Source account cannot be Petty Cash itself.' }, { status: 400 })
      }
      const newFund: PettyCashFundEntry = {
        id: `pcf-${Date.now()}`,
        dateIso: todayIso,
        amount,
        sourceLedgerId: sourceLedger.id,
        sourceLedgerName: sourceLedger.name,
        reference,
        addedBy: session.display_name,
      }
      // Auto-post balanced Contra Voucher (Dr Petty Cash / Cr Source Cash or Bank)
      const contraVoucher: AccountingVoucher = {
        id: `vch-pcf-${Date.now()}`,
        voucherNo: nextVoucherNumber('contra', book.vouchers),
        type: 'contra',
        transactionFor: 'Transfer',
        dateIso: todayIso,
        accountLabel: `Petty Cash ← ${sourceLedger.name}`,
        partyOrReceiver: session.display_name,
        paymentMode: sourceLedger.isBank ? 'Bank' : 'Cash',
        referenceNo: reference,
        narration: `Petty Cash fund replenishment from ${sourceLedger.name}`,
        totalAmount: amount,
        lines: [
          { id: `ln-${Date.now()}-1`, ledgerId: pettyLedger.id, ledgerCode: pettyLedger.code, ledgerName: pettyLedger.name, debit: amount, credit: 0 },
          { id: `ln-${Date.now()}-2`, ledgerId: sourceLedger.id, ledgerCode: sourceLedger.code, ledgerName: sourceLedger.name, debit: 0, credit: amount },
        ],
        createdBy: session.display_name,
        createdAt: todayIso,
      }
      return persistBook(
        {
          ...book,
          pettyCashFunds: [newFund, ...book.pettyCashFunds],
          vouchers: [contraVoucher, ...book.vouchers],
        },
        `Added ৳${amount.toLocaleString()} to Petty Cash Fund & posted Contra Voucher ${contraVoucher.voucherNo}`,
        'petty_cash_fund_added',
        `+৳${amount} from ${sourceLedger.name}`,
      )
    }

    if (action === 'create_requisition') {
      const applicantName = String(body.applicantName || '').trim().slice(0, 100)
      const department = String(body.department || 'Administration').trim()
      const purpose = String(body.purpose || '').trim().slice(0, 300)
      const amount = Math.round(Number(body.amount || 0))
      const dateIso = String(body.dateIso || todayIso)
      const priority = (body.priority as PettyCashRequisition['priority']) || 'Normal'
      const remarks = String(body.remarks || '').trim().slice(0, 240)
      if (!applicantName || !purpose || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { ok: false, error: 'Applicant Name, Purpose, and positive BDT Amount are required.' },
          { status: 400 },
        )
      }
      const reqNo = `REQ-2026-${String(book.pettyCashRequisitions.length + 1).padStart(3, '0')}`
      const newReq: PettyCashRequisition = {
        id: `pcr-${Date.now()}`,
        reqNo,
        applicantName,
        department,
        purpose,
        amount,
        dateIso,
        priority,
        status: 'pending',
        remarks,
      }
      return persistBook(
        { ...book, pettyCashRequisitions: [newReq, ...book.pettyCashRequisitions] },
        `Petty Cash Requisition ${reqNo} submitted!`,
        'petty_cash_requisition_created',
        `${reqNo} · ${applicantName} · ৳${amount}`,
      )
    }

    if (action === 'decide_requisition') {
      const reqId = String(body.reqId || '')
      const decision = body.decision === 'approved' ? 'approved' : 'rejected'
      const expenseLedgerId = String(body.expenseLedgerId || 'ldg-40002')
      const target = book.pettyCashRequisitions.find((r) => r.id === reqId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Requisition not found.' }, { status: 404 })
      }
      if (target.status !== 'pending') {
        return NextResponse.json({ ok: false, error: 'Requisition has already been decided.' }, { status: 409 })
      }

      let nextVouchers = book.vouchers
      let linkedVoucherId: string | undefined
      if (decision === 'approved') {
        const summary = computePettyCashSummary(book)
        if (target.amount > summary.balance) {
          return NextResponse.json(
            {
              ok: false,
              error: `Insufficient Petty Cash balance (Available: ৳${summary.balance.toLocaleString()}, Requested: ৳${target.amount.toLocaleString()}). Top up Petty Cash Fund first.`,
            },
            { status: 409 },
          )
        }
        const pettyLedger = book.ledgers.find((l) => l.id === 'ldg-10110')
        const expLedger =
          book.ledgers.find((l) => l.id === expenseLedgerId) ||
          book.ledgers.find((l) => l.head === 'Expense')
        if (pettyLedger && expLedger) {
          linkedVoucherId = `vch-pcr-${Date.now()}`
          const debitVoucher: AccountingVoucher = {
            id: linkedVoucherId,
            voucherNo: nextVoucherNumber('debit', book.vouchers),
            type: 'debit',
            transactionFor: 'Expense',
            dateIso: todayIso,
            accountLabel: expLedger.name,
            partyOrReceiver: `${target.applicantName} (${target.reqNo})`,
            paymentMode: 'Cash',
            referenceNo: target.reqNo,
            narration: `Petty Cash Requisition ${target.reqNo} (${target.department}): ${target.purpose}`,
            totalAmount: target.amount,
            lines: [
              { id: `ln-${Date.now()}-1`, ledgerId: expLedger.id, ledgerCode: expLedger.code, ledgerName: expLedger.name, debit: target.amount, credit: 0 },
              { id: `ln-${Date.now()}-2`, ledgerId: pettyLedger.id, ledgerCode: pettyLedger.code, ledgerName: pettyLedger.name, debit: 0, credit: target.amount },
            ],
            createdBy: session.display_name,
            createdAt: todayIso,
          }
          nextVouchers = [debitVoucher, ...book.vouchers]
        }
      }

      const nextReqs = book.pettyCashRequisitions.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: decision as PettyCashRequisition['status'],
              decidedBy: session.display_name,
              decidedAt: todayIso,
              linkedVoucherId,
            }
          : r,
      )
      return persistBook(
        { ...book, pettyCashRequisitions: nextReqs, vouchers: nextVouchers },
        decision === 'approved'
          ? `Approved ${target.reqNo} & posted Debit Voucher!`
          : `Rejected requisition ${target.reqNo}`,
        `petty_cash_requisition_${decision}`,
        `${target.reqNo} · ৳${target.amount}`,
      )
    }

    // ==================== 8. DOUBLE-ENTRY VOUCHERS (CREDIT, DEBIT, JOURNAL, CONTRA) ====================
    if (action === 'create_voucher') {
      const type = body.type as VoucherType
      if (!['credit', 'debit', 'journal', 'contra'].includes(type)) {
        return NextResponse.json({ ok: false, error: 'Invalid voucher type.' }, { status: 400 })
      }
      const dateIso = String(body.dateIso || todayIso)
      const transactionFor = (body.transactionFor as AccountingVoucher['transactionFor']) || 'Others'
      const partyOrReceiver = String(body.partyOrReceiver || session.display_name).trim().slice(0, 120)
      const paymentMode = (body.paymentMode as AccountingVoucher['paymentMode']) || (type === 'journal' ? 'Non-Cash' : 'Cash')
      const referenceNo = String(body.referenceNo || '').trim().slice(0, 60)
      const narration = String(body.narration || '').trim().slice(0, 400)

      const rawLines = Array.isArray(body.lines)
        ? (body.lines as Array<{ ledgerId?: string; debit?: number; credit?: number; note?: string }>)
        : []

      if (rawLines.length < 2) {
        return NextResponse.json(
          { ok: false, error: 'A double-entry voucher requires at least 2 balanced account lines (Debit & Credit).' },
          { status: 400 },
        )
      }

      const validatedLines: VoucherEntryLine[] = []
      for (let i = 0; i < rawLines.length; i++) {
        const rl = rawLines[i]
        const ledger = book.ledgers.find((l) => l.id === rl.ledgerId)
        if (!ledger) {
          return NextResponse.json({ ok: false, error: `Line ${i + 1}: Invalid ledger selected.` }, { status: 400 })
        }
        const debit = Math.max(0, Number(rl.debit || 0))
        const credit = Math.max(0, Number(rl.credit || 0))
        if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
          return NextResponse.json(
            { ok: false, error: `Line ${i + 1} (${ledger.name}): Enter either a positive Debit OR a positive Credit.` },
            { status: 400 },
          )
        }
        if (type === 'contra' && !ledger.isBank && !ledger.isCash) {
          return NextResponse.json(
            { ok: false, error: `Contra vouchers only allow Cash or Bank ledgers (${ledger.name} is neither).` },
            { status: 400 },
          )
        }
        validatedLines.push({
          id: `ln-${Date.now()}-${i}`,
          ledgerId: ledger.id,
          ledgerCode: ledger.code,
          ledgerName: ledger.name,
          debit: Math.round(debit * 100) / 100,
          credit: Math.round(credit * 100) / 100,
          note: rl.note ? String(rl.note).trim().slice(0, 140) : undefined,
        })
      }

      const totalDebit = Math.round(validatedLines.reduce((s, l) => s + l.debit, 0) * 100) / 100
      const totalCredit = Math.round(validatedLines.reduce((s, l) => s + l.credit, 0) * 100) / 100
      if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.009) {
        return NextResponse.json(
          {
            ok: false,
            error: `Voucher is unbalanced: Total Debit (৳${totalDebit.toLocaleString()}) must equal Total Credit (৳${totalCredit.toLocaleString()}).`,
          },
          { status: 400 },
        )
      }

      if (type === 'contra') {
        const distinctLedgers = new Set(validatedLines.map((l) => l.ledgerId))
        if (distinctLedgers.size < 2) {
          return NextResponse.json(
            { ok: false, error: 'Contra transfer requires two different Cash/Bank accounts.' },
            { status: 400 },
          )
        }
      }

      const voucherNo = nextVoucherNumber(type, book.vouchers)
      const primaryAccountLabel =
        type === 'credit'
          ? validatedLines.find((l) => l.credit > 0)?.ledgerName || validatedLines[0].ledgerName
          : type === 'debit'
            ? validatedLines.find((l) => l.debit > 0)?.ledgerName || validatedLines[0].ledgerName
            : type === 'contra'
              ? `${validatedLines.find((l) => l.debit > 0)?.ledgerName || ''} ← ${validatedLines.find((l) => l.credit > 0)?.ledgerName || ''}`
              : validatedLines[0].ledgerName

      const newVoucher: AccountingVoucher = {
        id: `vch-${Date.now()}`,
        voucherNo,
        type,
        transactionFor,
        dateIso,
        accountLabel: primaryAccountLabel,
        partyOrReceiver,
        paymentMode,
        referenceNo,
        narration: narration || `${type.toUpperCase()} voucher posted via DMHA Accounts`,
        totalAmount: totalDebit,
        lines: validatedLines,
        createdBy: session.display_name,
        createdAt: todayIso,
      }

      return persistBook(
        { ...book, vouchers: [newVoucher, ...book.vouchers] },
        `Posted ${voucherNo} (৳${totalDebit.toLocaleString()}) — Trial Balance stays balanced!`,
        `accounting_voucher_${type}`,
        `${voucherNo} · ৳${totalDebit} · ${primaryAccountLabel}`,
      )
    }

    if (action === 'delete_voucher') {
      const voucherId = String(body.voucherId || '')
      const target = book.vouchers.find((v) => v.id === voucherId)
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Voucher not found.' }, { status: 404 })
      }
      return persistBook(
        { ...book, vouchers: book.vouchers.filter((v) => v.id !== voucherId) },
        `Voided voucher ${target.voucherNo}`,
        'accounting_voucher_deleted',
        `${target.voucherNo} · ৳${target.totalAmount}`,
      )
    }

    return NextResponse.json({ ok: false, error: `Unknown accounting action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Accounting operation failed.' },
      { status: 500 },
    )
  }
}
