const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01"

export class TwilioApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "TwilioApiError"
    this.status = status
    this.details = details
  }
}

function getTwilioConfig(): { accountSid: string; authToken: string; fromNumber: string } {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER")
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      "Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER secret (set via `supabase secrets set`)"
    )
  }
  return { accountSid, authToken, fromNumber }
}

export interface SendSmsResult {
  sid: string
}

/**
 * No retry-on-failure here, unlike _shared/retell-client.ts — this is called
 * mid-call (send_sms tool) as well as from a webhook handler that shouldn't
 * hold Retell's tool-call timeout hostage to Twilio's availability. A single
 * fast attempt that fails cleanly (and gets logged as a 'failed'
 * ai_employee_actions row) is better than retrying into a multi-second
 * delay on a live phone call.
 */
export async function sendSmsViaTwilio(toPhone: string, body: string): Promise<SendSmsResult> {
  const { accountSid, authToken, fromNumber } = getTwilioConfig()

  const params = new URLSearchParams({ To: toPhone, From: fromNumber, Body: body })
  const response = await fetch(`${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  const text = await response.text()
  const json = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const message =
      typeof json?.message === "string" ? json.message : `Twilio API error (${response.status})`
    throw new TwilioApiError(message, response.status, json)
  }

  return { sid: json.sid as string }
}
