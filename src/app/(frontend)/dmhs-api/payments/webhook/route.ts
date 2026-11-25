import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { appendAutoCreditVoucher, loadAccountingBookSafe } from '@/lib/dmhs-auto-voucher'
import {
  appendSecurityAudit,
  loadPersistedState,
  savePersistedState,
  settlePaymentByTransactionId,
} from '@/lib/dmhs-db'
import { broadcastDmhsEvent } from '@/lib/dmhs-realtime'
import { getClientIpFromRequest } from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Idempotently posts a balanced Double-Entry Credit Voucher (Bank/MFS Dr, Fee Income Cr)
 * into accountingBook.vouchers whenever a payment gateway webhook settles an invoice.
 */
function syncGatewayVoucherToAccounting(
  tranId: string,
  invoiceId: string | undefined,
  providerLabel: string,
): string | undefined {
  if (!invoiceId) return undefined
  const state = loadPersistedState()
  if (!state.exists || !state.data) return undefined
  const currentData = state.data as Record<string, unknown>
  const fees = Array.isArray(currentData.fees)
    ? (currentData.fees as Array<Record<string, unknown>>)
    : []
  const inv = fees.find((f) => String(f.id) === invoiceId)
  if (!inv) return undefined
  const amount = Math.max(0, Math.round(Number(inv.amount || 0)))
  if (amount <= 0) return undefined

  const book = loadAccountingBookSafe(currentData)
  // Idempotency guard: never double-post if webhook retries the same transactionId
  const existingVoucher = book.vouchers.find((v) => v.referenceNo === tranId)
  if (existingVoucher) return existingVoucher.voucherNo

  const posted = appendAutoCreditVoucher(book, {
    amount,
    title: String(inv.title || 'Online Tuition Fee'),
    category: String(inv.category || 'Tuition Fee'),
    paymentMethod: providerLabel,
    receiptNo: tranId,
    partyName: String(inv.studentName || 'DMHA Student'),
    actorName: providerLabel,
  })
  savePersistedState(
    { ...currentData, accountingBook: posted.nextBook },
    providerLabel,
  )
  return posted.voucher.voucherNo
}

function verifyStripeSignature(rawBody: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const [k, v] = p.split('=')
      return [k?.trim(), v?.trim()]
    }),
  )
  const timestamp = parts.t
  const v1 = parts.v1
  if (!timestamp || !v1) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'))
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIpFromRequest(request)
    const contentType = request.headers.get('content-type') || ''
    const rawBody = await request.text()

    // 1. Stripe Webhook Verification (HMAC-SHA256)
    const stripeSig = request.headers.get('stripe-signature')
    const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
    if (stripeSig) {
      if (!stripeSecret || !verifyStripeSignature(rawBody, stripeSig, stripeSecret)) {
        appendSecurityAudit({
          action: 'webhook_stripe_invalid_sig',
          target: 'stripe',
          actor: 'webhook',
          actorRole: 'system',
          ipAddress: ip,
        })
        return NextResponse.json({ ok: false, error: 'Invalid Stripe signature.' }, { status: 400 })
      }
      const event = JSON.parse(rawBody) as {
        type?: string
        data?: { object?: { client_reference_id?: string; metadata?: { tran_id?: string } } }
      }
      const tranId =
        event.data?.object?.metadata?.tran_id || event.data?.object?.client_reference_id
      if (event.type === 'checkout.session.completed' && tranId) {
        const settled = settlePaymentByTransactionId(tranId, 'stripe_webhook_verified')
        if (settled.ok) {
          syncGatewayVoucherToAccounting(tranId, settled.invoiceId, 'Stripe Webhook')
          appendSecurityAudit({
            action: 'payment_webhook_settled_stripe',
            target: tranId,
            actor: 'Stripe Webhook',
            actorRole: 'system',
            ipAddress: ip,
          })
          broadcastDmhsEvent({
            type: 'state_updated',
            version: Date.now(),
            updatedAt: new Date().toISOString(),
            updatedBy: 'Stripe Payment Webhook',
            summary: `Fee invoice verified via Stripe (${tranId})`,
          })
        }
      }
      return NextResponse.json({ ok: true, received: true })
    }

    // Parse form-urlencoded (SSLCommerz IPN) or JSON
    let payload: Record<string, string> = {}
    if (contentType.includes('application/x-www-form-urlencoded')) {
      payload = Object.fromEntries(new URLSearchParams(rawBody).entries())
    } else if (rawBody.trim()) {
      payload = JSON.parse(rawBody) as Record<string, string>
    }

    const tranId = (payload.tran_id || payload.transactionId || '').trim()
    const valId = (payload.val_id || '').trim()

    if (!tranId) {
      return NextResponse.json({ ok: false, error: 'tran_id is required.' }, { status: 400 })
    }

    // 2. Live SSLCommerz IPN Server-to-Server Validation
    const sslStoreId = process.env.SSLCOMMERZ_STORE_ID?.trim()
    const sslStorePass = process.env.SSLCOMMERZ_STORE_PASSWD?.trim()
    if (valId && sslStoreId && sslStorePass) {
      const isLive = process.env.SSLCOMMERZ_IS_LIVE === 'true'
      const validatorBase = isLive
        ? 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php'
        : 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'

      const checkUrl = `${validatorBase}?val_id=${encodeURIComponent(
        valId,
      )}&store_id=${encodeURIComponent(sslStoreId)}&store_passwd=${encodeURIComponent(
        sslStorePass,
      )}&format=json`

      const vRes = await fetch(checkUrl)
      const vJson = (await vRes.json()) as { status?: string; tran_id?: string }
      if (
        (vJson.status === 'VALID' || vJson.status === 'VALIDATED') &&
        vJson.tran_id === tranId
      ) {
        const settled = settlePaymentByTransactionId(tranId, 'sslcommerz_ipn_verified')
        const voucherNo = settled.ok
          ? syncGatewayVoucherToAccounting(tranId, settled.invoiceId, 'SSLCommerz / bKash')
          : undefined
        appendSecurityAudit({
          action: 'payment_webhook_settled_sslcommerz',
          target: `${tranId}${voucherNo ? ` · ${voucherNo}` : ''}`,
          actor: 'SSLCommerz IPN',
          actorRole: 'system',
          ipAddress: ip,
        })
        broadcastDmhsEvent({
          type: 'state_updated',
          version: Date.now(),
          updatedAt: new Date().toISOString(),
          updatedBy: 'SSLCommerz IPN',
          summary: `Fee invoice verified via SSLCommerz (${tranId})`,
        })
        return NextResponse.json({ ok: true, verified: true, settled: settled.ok, voucherNo })
      }

      return NextResponse.json(
        { ok: false, error: 'SSLCommerz IPN validation failed.' },
        { status: 400 },
      )
    }

    // 3. Sandbox / Shared-Secret Webhook Test
    const configuredSecret = process.env.DMHS_WEBHOOK_SECRET?.trim()
    const providedSecret = request.headers.get('x-dmhs-webhook-secret') || payload.secret || ''
    if (process.env.NODE_ENV === 'production' && (!configuredSecret || providedSecret !== configuredSecret)) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized webhook signature.' },
        { status: 401 },
      )
    }

    const settled = settlePaymentByTransactionId(tranId, 'sandbox_webhook_verified')
    if (!settled.ok) {
      return NextResponse.json(
        { ok: false, error: `Transaction ${tranId} not found in DMHA ledger.` },
        { status: 404 },
      )
    }
    const voucherNo = syncGatewayVoucherToAccounting(tranId, settled.invoiceId, 'bKash / Nagad')

    appendSecurityAudit({
      action: 'payment_webhook_settled_sandbox',
      target: `${tranId}${voucherNo ? ` · ${voucherNo}` : ''}`,
      actor: 'DMHA Webhook',
      actorRole: 'system',
      ipAddress: ip,
    })

    return NextResponse.json({ ok: true, verified: true, invoiceId: settled.invoiceId, voucherNo })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Webhook processing failed' },
      { status: 500 },
    )
  }
}
