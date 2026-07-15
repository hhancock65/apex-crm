import type { AiEmployeeSummary } from "@/types/ai-employee"

export const AI_ACTION_TYPES = [
  "call_answered",
  "call_transferred",
  "lead_created",
  "lead_qualified",
  "lead_reactivated",
  "appointment_booked",
  "appointment_rescheduled",
  "appointment_cancelled",
  "sms_sent",
  "email_sent",
  "follow_up_sent",
  "contact_created",
  "contact_updated",
  "opportunity_created",
] as const
export type AiActionType = (typeof AI_ACTION_TYPES)[number]

export const AI_ACTION_RESULTS = ["success", "pending", "failed"] as const
export type AiActionResult = (typeof AI_ACTION_RESULTS)[number]

export interface AiEmployeeAction {
  id: string
  org_id: string
  ai_employee_id: string
  action_type: AiActionType
  result: AiActionResult
  description: string | null
  related_to_type: string | null
  related_to_id: string | null
  contact_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AiEmployeeActionWithEmployee extends AiEmployeeAction {
  ai_employee: AiEmployeeSummary | null
}
