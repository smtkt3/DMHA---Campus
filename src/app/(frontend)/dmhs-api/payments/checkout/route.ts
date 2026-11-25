import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { appendSecurityAudit, recordPaymentTransaction } from '@/lib/dmhs-db'
import { getClientIpFromRequest, requireAuthSession } from '@/lib/dmhs-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = await requireAuthSession(['guardian', 'student', 'admin'])
    if (!auth.ok) return auth.response
    const { session } = auth
    const ip = getClientIpFromRequest(request)

    const body = (await request.json()) as {
      invoiceId?: string
      studentName?: string
      guardianName?: string
      guardianEmail?: string
      guardianPhone?: string
      title?: string
      amount?: number
      method?: 'bKash' | 'Nagad' | 'Card (SSLCommerz)' | 'Stripe Card' | 'Bank Transfer'
    }

    const amount = Number(body.amount || 0)
    if (!body.invoiceId || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Valid invoiceId and positive amount are required.' },
        { status: 400 },
      )
    }

    const method = body.method || 'bKash'
    const tranId = `DMHA-${method.replace(/[^A-Z]/gi, '').slice(0, 5).toUpperCase()}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`

    // 1. Live SSLCommerz Gateway (supports bKash, Nagad, Rocket, Visa, Mastercard in BD)
    const sslStoreId = process.env.SSLCOMMERZ_STORE_ID?.trim()
    const sslStorePass = process.env.SSLCOMMERZ_STORE_PASSWD?.trim()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000'

    if (sslStoreId && sslStorePass && method !== 'Stripe Card') {
      const isSandbox = process.env.SSLCOMMERZ_IS_LIVE !== 'true'
      const endpoint = isSandbox
        ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
        : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'

      const form = new URLSearchParams({
        store_id: sslStoreId,
        store_passwd: sslStorePass,
        total_amount: String(amount),
        currency: 'BDT',
        tran_id: tranId,
        success_url: `${siteUrl}/?payment=success&tran_id=${tranId}`,
        fail_url: `${siteUrl}/?payment=failed&tran_id=${tranId}`,
        cancel_url: `${siteUrl}/?payment=cancelled&tran_id=${tranId}`,
        ipn_url: `${siteUrl}/dmhs-api/payments/webhook`,
        product_name: body.title || 'DMHA School Fee',
        product_category: 'Education',
        product_profile: 'non-physical-goods',
        cus_name: body.guardianName || body.studentName || 'DMHA Guardian',
        cus_email: body.guardianEmail || 'guardian@dmha.edu',
        cus_phone: body.guardianPhone || '+8801700000000',
        cus_add1: 'Dhaka',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
        shipping_method: 'NO',
      })

      const gwRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      })
      const gwJson = (await gwRes.json()) as {
        status?: string
        GatewayPageURL?: string
        failedreason?: string
      }

      if (gwJson.status === 'SUCCESS' && gwJson.GatewayPageURL) {
        recordPaymentTransaction({
          transactionId: tranId,
          invoiceId: body.invoiceId,
          studentName: body.studentName || 'Student',
          guardianName: body.guardianName || session.display_name,
          amount,
          method,
          provider: 'SSLCommerz',
          status: 'pending',
          verifiedBy: 'awaiting_ipn',
        })
        appendSecurityAudit({
          action: 'payment_checkout_sslcommerz',
          target: `${body.invoiceId} · BDT ${amount} (${tranId})`,
          actor: session.display_name,
          actorRole: session.role,
          ipAddress: ip,
        })
        return NextResponse.json({
          ok: true,
          mode: 'live_redirect',
          provider: 'SSLCommerz',
          transactionId: tranId,
          redirectUrl: gwJson.GatewayPageURL,
        })
      }

      return NextResponse.json(
        {
          ok: false,
          error: gwJson.failedreason || 'SSLCommerz gateway rejected session initialization.',
        },
        { status: 502 },
      )
    }

    // 2. Live Stripe Checkout (International Cards)
    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
    if (stripeKey && method === 'Stripe Card') {
      const form = new URLSearchParams({
        mode: 'payment',
        success_url: `${siteUrl}/?payment=success&tran_id=${tranId}`,
        cancel_url: `${siteUrl}/?payment=cancelled&tran_id=${tranId}`,
        client_reference_id: tranId,
        'metadata[tran_id]': tranId,
        'metadata[invoice_id]': body.invoiceId,
        'line_items[0][price_data][currency]': 'bdt',
        'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
        'line_items[0][price_data][product_data][name]': body.title || 'DMHA School Fee',
        'line_items[0][quantity]': '1',
      })

      const stRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      })
      const stJson = (await stRes.json()) as { url?: string; error?: { message?: string } }
      if (stRes.ok && stJson.url) {
        recordPaymentTransaction({
          transactionId: tranId,
          invoiceId: body.invoiceId,
          studentName: body.studentName || 'Student',
          guardianName: body.guardianName || session.display_name,
          amount,
          method,
          provider: 'Stripe',
          status: 'pending',
          verifiedBy: 'awaiting_stripe_webhook',
        })
        appendSecurityAudit({
          action: 'payment_checkout_stripe',
          target: `${body.invoiceId} · BDT ${amount} (${tranId})`,
          actor: session.display_name,
          actorRole: session.role,
          ipAddress: ip,
        })
        return NextResponse.json({
          ok: true,
          mode: 'live_redirect',
          provider: 'Stripe',
          transactionId: tranId,
          redirectUrl: stJson.url,
        })
      }
      return NextResponse.json(
        { ok: false, error: stJson.error?.message || 'Stripe checkout initialization failed.' },
        { status: 502 },
      )
    }

    // 3. Verified Server Sandbox Settlement (logged immutably to dmhs_payment_transactions)
    const ledgerRow = recordPaymentTransaction({
      transactionId: tranId,
      invoiceId: body.invoiceId,
      studentName: body.studentName || 'Student',
      guardianName: body.guardianName || session.display_name,
      amount,
      method,
      provider: `DMHA Sandbox (${method})`,
      status: 'settled',
      verifiedBy: `server_sandbox:${session.email}`,
    })

    appendSecurityAudit({
      action: 'payment_settled_sandbox',
      target: `${body.invoiceId} · BDT ${amount} (${tranId})`,
      actor: session.display_name,
      actorRole: session.role,
      ipAddress: ip,
    })

    return NextResponse.json({
      ok: true,
      mode: 'sandbox_settled',
      provider: ledgerRow.provider,
      transactionId: tranId,
      receiptNo: tranId,
      amount,
      method,
      settledAt: ledgerRow.settledAt,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Payment processing error' },
      { status: 500 },
    )
  }
}
