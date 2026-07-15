import {
  CALL_OUTCOMES,
  type CallOutcome,
  type CallSentiment,
  type CallStatus,
  type RetellCall,
  type RetellCallAnalysis,
  type RetellUserSentiment,
} from "./types.ts"

const TRANSFER_REASONS = new Set(["call_transfer", "transfer_bridged"])
const VOICEMAIL_REASONS = new Set(["voicemail_reached", "machine_detected"])
const MISSED_REASONS = new Set(["dial_no_answer", "registered_call_timeout"])
const FAILURE_REASONS = new Set([
  "dial_failed",
  "dial_busy",
  "error_llm_websocket_lost_connection",
  "error_no_audio_received",
  "error_llm_error",
  "error_frontend_error",
  "error_unknown",
  "concurrency_limit_reached",
  "no_valid_payment",
  "scam_detected",
])

/**
 * Retell's own `call_status` only distinguishes registered/ongoing/ended/error/
 * not_connected — the more specific outcome (voicemail, transferred, failed...)
 * has to be read off `disconnection_reason`, whose full value set isn't
 * exhaustively documented. Unrecognized reasons on an otherwise-ended call
 * fall back to "completed" rather than being misclassified as a failure.
 */
export function deriveCallStatus(
  retellCallStatus: RetellCall["call_status"],
  disconnectionReason: string | undefined
): CallStatus {
  if (retellCallStatus === "error") return "failed"
  if (retellCallStatus === "not_connected") return "missed"
  if (retellCallStatus === "registered" || retellCallStatus === "ongoing") return "active"

  const reason = disconnectionReason ?? ""
  if (VOICEMAIL_REASONS.has(reason)) return "voicemail"
  if (TRANSFER_REASONS.has(reason)) return "transferred"
  if (FAILURE_REASONS.has(reason)) return "failed"
  if (MISSED_REASONS.has(reason)) return "missed"
  return "completed"
}

/**
 * Best-effort mapping — Retell has no single canonical "outcome" field of its
 * own. Prefers a custom Post-Call Analysis field named `outcome` if the org
 * configured one that matches our vocabulary exactly; otherwise falls back to
 * disconnection reason, then call_successful. Returns null (left for a human
 * to fill in) when nothing suggests a clear answer.
 */
export function deriveCallOutcome(
  disconnectionReason: string | undefined,
  analysis: RetellCallAnalysis | undefined
): CallOutcome | null {
  const reason = disconnectionReason ?? ""

  if (VOICEMAIL_REASONS.has(reason) || analysis?.in_voicemail) return "voicemail"
  if (TRANSFER_REASONS.has(reason)) return "transfer"

  const customOutcome = analysis?.custom_analysis_data?.outcome
  if (typeof customOutcome === "string" && CALL_OUTCOMES.includes(customOutcome as CallOutcome)) {
    return customOutcome as CallOutcome
  }

  if (analysis?.call_successful === true) return "qualified"
  if (analysis?.call_successful === false) return "unqualified"
  return null
}

export function mapSentiment(userSentiment: RetellUserSentiment | undefined): CallSentiment | null {
  switch (userSentiment) {
    case "Positive":
      return "positive"
    case "Negative":
      return "negative"
    case "Neutral":
      return "neutral"
    default:
      return null
  }
}

/** The external party's number, regardless of who dialed whom. */
export function getExternalPhoneNumber(call: RetellCall): string | null {
  if (call.direction === "outbound") return call.to_number ?? null
  return call.from_number ?? null
}

export function computeDurationSeconds(
  startMs: number | undefined,
  endMs: number | undefined
): number | null {
  if (!startMs || !endMs || endMs <= startMs) return null
  return Math.round((endMs - startMs) / 1000)
}
