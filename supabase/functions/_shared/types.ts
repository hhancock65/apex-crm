export interface EscalationRule {
  condition: string
  action: string
}

export interface AiEmployeeRow {
  id: string
  org_id: string
  name: string
  role: string
  description: string | null
  voice: string | null
  language: string
  personality: string | null
  status: string
  retell_agent_id: string | null
  phone_number: string | null
  responsibilities: string[]
  knowledge_config: Record<string, unknown>
  escalation_rules: EscalationRule[]
  settings: Record<string, unknown>
}

export interface OrganizationRow {
  id: string
  name: string
  settings: Record<string, unknown>
}

// --- Stripe subscription billing (migration 0018) ---

export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "trialing"

export interface SubscriptionRow {
  id: string
  org_id: string
  stripe_customer_id: string
  stripe_subscription_id: string | null
  plan_id: string
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at: string | null
}

// --- Campaigns (migration 0013) ---

export type CampaignType = "reactivation" | "nurture" | "outbound" | "follow_up"
export type CampaignStatus = "draft" | "active" | "paused" | "completed"
export type CampaignContactStatus =
  | "pending"
  | "in_progress"
  | "contacted"
  | "responded"
  | "converted"
  | "skipped"
  | "failed"

export interface CampaignRow {
  id: string
  org_id: string
  name: string
  type: CampaignType
  ai_employee_id: string | null
  target_filter: Record<string, unknown>
  message_templates: Record<string, unknown>
  schedule_config: Record<string, unknown>
  status: CampaignStatus
  stats: Record<string, unknown>
  total_contacts: number
  contacts_processed: number
  contacts_responded: number
  appointments_booked: number
}

export interface CampaignContactRow {
  id: string
  campaign_id: string
  contact_id: string
  status: CampaignContactStatus
  attempts: number
  last_attempt_at: string | null
  outcome: string | null
}

// --- Warm transfer / escalation (migration 0010) ---

export type TransferConditionType =
  | "caller_requests_human"
  | "value_threshold"
  | "angry_caller"
  | "emergency"
  | "low_confidence"

export interface TransferRuleRow {
  id: string
  condition_type: TransferConditionType
  condition_value: string | null
  target_user_id: string | null
  target_phone: string | null
  position: number
}

// --- Retell webhook payload shapes (call_started / call_ended / call_analyzed) ---
// https://docs.retellai.com/features/webhook

export interface RetellTranscriptWord {
  word: string
  start: number
  end: number
}

export interface RetellTranscriptTurn {
  role: "agent" | "user" | "transfer_target"
  content: string
  words?: RetellTranscriptWord[]
}

export type RetellUserSentiment = "Positive" | "Negative" | "Neutral" | "Unknown"

export interface RetellCallAnalysis {
  call_summary?: string
  user_sentiment?: RetellUserSentiment
  call_successful?: boolean
  in_voicemail?: boolean
  custom_analysis_data?: Record<string, unknown>
}

export interface RetellCall {
  call_id: string
  agent_id: string
  from_number?: string
  to_number?: string
  direction?: "inbound" | "outbound"
  call_status?: "registered" | "not_connected" | "ongoing" | "ended" | "error"
  disconnection_reason?: string
  start_timestamp?: number
  end_timestamp?: number
  recording_url?: string
  transcript?: string
  transcript_object?: RetellTranscriptTurn[]
  call_analysis?: RetellCallAnalysis
  /** Echoed back verbatim from whatever was passed at call-creation time —
   *  process-campaign-batch sets { campaign_id, campaign_contact_id } here
   *  on outbound campaign calls so retell-call-webhook can resolve the
   *  campaign_contacts row a call_analyzed event belongs to. */
  metadata?: Record<string, unknown>
}

export interface RetellCallWebhookPayload {
  event: "call_started" | "call_ended" | "call_analyzed"
  call: RetellCall
}

// --- Apex's own `calls` row vocabulary (mirrors src/types/call.ts on the app side) ---

export type CallStatus = "active" | "completed" | "missed" | "transferred" | "voicemail" | "failed"

export type CallOutcome =
  | "qualified"
  | "unqualified"
  | "appointment_booked"
  | "transfer"
  | "voicemail"
  | "info_request"
  | "spam"

export const CALL_OUTCOMES: readonly CallOutcome[] = [
  "qualified",
  "unqualified",
  "appointment_booked",
  "transfer",
  "voicemail",
  "info_request",
  "spam",
]

export type CallSentiment = "positive" | "neutral" | "negative"

// --- Retell "custom function" tool definitions (function calling) ---
// https://docs.retellai.com/build/tools/custom-function

export interface RetellCustomToolParameterSchema {
  type: "object"
  properties: Record<string, { type: string; description: string }>
  required: string[]
}

export interface RetellCustomTool {
  type: "custom"
  name: string
  description: string
  url: string
  speak_during_execution: boolean
  speak_after_execution: boolean
  parameters: RetellCustomToolParameterSchema
}

// --- Retell "custom function" tool-call webhook payload (mid-call) ---
// Retell POSTs this to a tool's `url` when the agent decides to invoke it.

export interface RetellFunctionCallPayload {
  call: RetellCall
  name: string
  args: Record<string, unknown>
}

// --- Retell's native "transfer_call" tool ---
// https://docs.retellai.com/build/transfer-call — a genuinely different tool
// type from RetellCustomTool: Retell's own telephony layer performs the SIP
// transfer directly, so there's no `url` — we never see this invocation at
// all. `transfer_destination.type: "dynamic"` plus a `number` parameter lets
// the LLM supply the destination at call time (here, the target_phone
// warm_transfer just resolved and returned). NOTE: unlike everything else in
// this codebase, this shape can't be exercised end-to-end from outside the
// Retell dashboard/an active call — verify the exact field names against
// Retell's current docs before relying on it, since it's a platform-native
// feature we don't control or get to unit-test.
export interface RetellTransferCallTool {
  type: "transfer_call"
  name: string
  description: string
  transfer_destination: { type: "dynamic" }
  parameters: RetellCustomToolParameterSchema
}

export type RetellAgentTool = RetellCustomTool | RetellTransferCallTool
