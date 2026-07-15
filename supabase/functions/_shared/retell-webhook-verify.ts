// Verifies Retell's `X-Retell-Signature` header: "v={timestamp_ms},d={hex_digest}",
// where digest = HMAC-SHA256(raw_body + timestamp_ms, retell_api_key) in hex.
// The signing key is the Retell API key itself — there is no separate
// "webhook secret" for these events (unlike the inbound-call webhook).
//
// Must be checked against the *raw* request body text, before JSON.parse —
// re-serializing can change whitespace/key order and break verification.

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export async function verifyRetellSignature(
  rawBody: string,
  signatureHeader: string | null,
  apiKey: string
): Promise<boolean> {
  if (!signatureHeader) return false

  const match = /^v=(\d+),d=([0-9a-f]+)$/.exec(signatureHeader.trim())
  if (!match) return false

  const [, timestampStr, digest] = match
  const timestamp = Number(timestampStr)
  if (!Number.isFinite(timestamp)) return false

  // Reject stale/replayed webhooks rather than just malformed ones.
  if (Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS) return false

  const expectedDigest = await hmacSha256Hex(apiKey, rawBody + timestampStr)
  return timingSafeEqual(expectedDigest, digest)
}
