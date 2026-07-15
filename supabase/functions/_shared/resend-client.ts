const RESEND_API_BASE = "https://api.resend.com"

export class ResendApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "ResendApiError"
    this.status = status
    this.details = details
  }
}

function getResendConfig(): { apiKey: string; fromAddress: string } {
  const apiKey = Deno.env.get("RESEND_API_KEY")
  const fromAddress = Deno.env.get("RESEND_FROM_EMAIL")
  if (!apiKey || !fromAddress) {
    throw new Error(
      "Missing RESEND_API_KEY or RESEND_FROM_EMAIL secret (set via `supabase secrets set`) — " +
        "RESEND_FROM_EMAIL must be an address on a domain verified in your Resend account."
    )
  }
  return { apiKey, fromAddress }
}

export interface SendEmailResult {
  id: string
}

/** No retry-on-failure — same reasoning as _shared/twilio-client.ts. */
export async function sendEmailViaResend(
  toEmail: string,
  subject: string,
  bodyText: string
): Promise<SendEmailResult> {
  const { apiKey, fromAddress } = getResendConfig()

  const response = await fetch(`${RESEND_API_BASE}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromAddress, to: toEmail, subject, text: bodyText }),
  })

  const text = await response.text()
  const json = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const message =
      typeof json?.message === "string" ? json.message : `Resend API error (${response.status})`
    throw new ResendApiError(message, response.status, json)
  }

  return { id: json.id as string }
}
