import type { AiEmployeeSummary } from "@/types/ai-employee"
import type { ContactSummary } from "@/types/contact"

export const CALL_DIRECTIONS = ["inbound", "outbound"] as const
export type CallDirection = (typeof CALL_DIRECTIONS)[number]

export const CALL_STATUSES = [
  "active",
  "completed",
  "missed",
  "transferred",
  "voicemail",
  "failed",
] as const
export type CallStatus = (typeof CALL_STATUSES)[number]

export const CALL_SENTIMENTS = ["positive", "neutral", "negative"] as const
export type CallSentiment = (typeof CALL_SENTIMENTS)[number]

export const CALL_OUTCOMES = [
  "qualified",
  "unqualified",
  "appointment_booked",
  "transfer",
  "voicemail",
  "info_request",
  "spam",
] as const
export type CallOutcome = (typeof CALL_OUTCOMES)[number]

export interface Call {
  id: string
  org_id: string
  ai_employee_id: string | null
  retell_call_id: string | null
  contact_id: string | null
  caller_phone: string | null
  direction: CallDirection
  status: CallStatus
  duration_seconds: number | null
  summary: string | null
  sentiment: CallSentiment | null
  outcome: CallOutcome | null
  recording_url: string | null
  started_at: string
  ended_at: string | null
  created_at: string
}

export interface CallWithContact extends Call {
  contact: ContactSummary | null
}

/** @deprecated use AiEmployeeSummary from "@/types/ai-employee" — kept as an alias so existing imports don't break. */
export type CallAiEmployeeSummary = AiEmployeeSummary

export interface CallWithRelations extends Call {
  contact: ContactSummary | null
  ai_employee: CallAiEmployeeSummary | null
}

export function formatCallDuration(seconds: number | null): string {
  if (seconds === null) return "—"
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}
