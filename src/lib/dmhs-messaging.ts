import crypto from 'node:crypto'
import { appendSecurityAudit } from '@/lib/dmhs-db'

export type AlertChannel = 'WhatsApp' | 'SMS'

export interface DispatchAlertResult {
  ok: boolean
  mode: 'live_provider' | 'sandbox_logged'
  provider: string
  providerId?: string
  error?: string
}

export function getMessagingGatewayStatus() {
  const twilioConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim(),
  )
  const bulksmsBdConfigured = Boolean(process.env.BULKSMS_BD_API_KEY?.trim())
  const sslWirelessConfigured = Boolean(
    process.env.SSL_WIRELESS_API_TOKEN?.trim() && process.env.SSL_WIRELESS_SID?.trim(),
  )
  return {
    twilioConfigured,
    bulksmsBdConfigured,
    sslWirelessConfigured,
    mode:
      twilioConfigured || bulksmsBdConfigured || sslWirelessConfigured
        ? ('live' as const)
        : ('sandbox' as const),
  }
}

/**
 * Env-driven campus alert dispatcher.
 * Reads credentials strictly from server-side process.env.* — zero secrets in browser code.
 * Priority: Twilio WhatsApp/SMS -> SSL Wireless BD (SMS) -> BulkSMS BD (SMS) -> Verified Sandbox Log.
 */
export async function dispatchCampusAlert(params: {
  channel: AlertChannel
  to: string
  message: string
  actor: string
  actorRole: string
  ipAddress: string
}): Promise<DispatchAlertResult> {
  const to = (params.to || '').replace(/[^\d+]/g, '')
  const message = (params.message || '').trim()
  const channel = params.channel || 'WhatsApp'

  if (!to || !message) {
    return {
      ok: false,
      mode: 'sandbox_logged',
      provider: 'Validation',
      error: 'Recipient phone number and message are required.',
    }
  }

  // 1. Live Twilio WhatsApp / SMS
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const twilioFrom =
    channel === 'WhatsApp'
      ? process.env.TWILIO_WHATSAPP_FROM?.trim()
      : process.env.TWILIO_SMS_FROM?.trim()

  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const form = new URLSearchParams({
        To: channel === 'WhatsApp' ? `whatsapp:${to}` : to,
        From:
          channel === 'WhatsApp' && !twilioFrom.startsWith('whatsapp:')
            ? `whatsapp:${twilioFrom}`
            : twilioFrom,
        Body: message,
      })
      const authHeader = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        },
      )
      const json = (await res.json()) as { sid?: string; message?: string }
      if (!res.ok) {
        return {
          ok: false,
          mode: 'live_provider',
          provider: `Twilio ${channel}`,
          error: json.message || 'Twilio dispatch failed.',
        }
      }
      appendSecurityAudit({
        action: `alert_dispatched_${channel.toLowerCase()}`,
        target: to,
        actor: params.actor,
        actorRole: params.actorRole,
        ipAddress: params.ipAddress,
      })
      return {
        ok: true,
        mode: 'live_provider',
        provider: `Twilio ${channel}`,
        providerId: json.sid,
      }
    } catch (err) {
      return {
        ok: false,
        mode: 'live_provider',
        provider: `Twilio ${channel}`,
        error: err instanceof Error ? err.message : 'Twilio network error',
      }
    }
  }

  // 2. Live SSL Wireless BD (Bangladesh SMS Gateway)
  const sslToken = process.env.SSL_WIRELESS_API_TOKEN?.trim()
  const sslSid = process.env.SSL_WIRELESS_SID?.trim()
  if (sslToken && sslSid) {
    try {
      const cleanBdNumber = to.replace(/^\+/, '')
      const csmsId = `DMHA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
      const res = await fetch('https://smsplus.sslwireless.com/api/v3/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          api_token: sslToken,
          sid: sslSid,
          msisdn: cleanBdNumber,
          sms: message,
          csms_id: csmsId,
        }),
      })
      if (!res.ok) {
        return {
          ok: false,
          mode: 'live_provider',
          provider: 'SSL Wireless BD',
          error: 'SSL Wireless BD gateway error.',
        }
      }
      appendSecurityAudit({
        action: 'alert_dispatched_sslwireless',
        target: to,
        actor: params.actor,
        actorRole: params.actorRole,
        ipAddress: params.ipAddress,
      })
      return {
        ok: true,
        mode: 'live_provider',
        provider: 'SSL Wireless BD',
        providerId: csmsId,
      }
    } catch (err) {
      return {
        ok: false,
        mode: 'live_provider',
        provider: 'SSL Wireless BD',
        error: err instanceof Error ? err.message : 'SSL Wireless network error',
      }
    }
  }

  // 3. Live BulkSMS BD (Bangladesh local SMS gateway)
  const bulkSmsKey = process.env.BULKSMS_BD_API_KEY?.trim()
  const bulkSmsSender = process.env.BULKSMS_BD_SENDER_ID?.trim()
  if (bulkSmsKey && bulkSmsSender) {
    try {
      const cleanBdNumber = to.replace(/^\+/, '')
      const url = `http://bulksmsbd.net/api/smsapi?api_key=${encodeURIComponent(
        bulkSmsKey,
      )}&type=text&number=${encodeURIComponent(cleanBdNumber)}&senderid=${encodeURIComponent(
        bulkSmsSender,
      )}&message=${encodeURIComponent(message)}`
      const res = await fetch(url)
      if (!res.ok) {
        return {
          ok: false,
          mode: 'live_provider',
          provider: 'BulkSMS BD',
          error: 'BulkSMS BD gateway error.',
        }
      }
      appendSecurityAudit({
        action: 'alert_dispatched_bulksms',
        target: to,
        actor: params.actor,
        actorRole: params.actorRole,
        ipAddress: params.ipAddress,
      })
      return {
        ok: true,
        mode: 'live_provider',
        provider: 'BulkSMS BD',
        providerId: `BD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      }
    } catch (err) {
      return {
        ok: false,
        mode: 'live_provider',
        provider: 'BulkSMS BD',
        error: err instanceof Error ? err.message : 'BulkSMS BD network error',
      }
    }
  }

  // 4. Verified Sandbox delivery (when provider env keys are not yet configured)
  appendSecurityAudit({
    action: `alert_sandbox_${channel.toLowerCase()}`,
    target: to,
    actor: params.actor,
    actorRole: params.actorRole,
    ipAddress: params.ipAddress,
  })
  return {
    ok: true,
    mode: 'sandbox_logged',
    provider: `DMHA Sandbox (${channel})`,
    providerId: `SIM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
  }
}
