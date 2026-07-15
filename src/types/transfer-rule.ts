import type { ProfileSummary } from "@/types/profile"

export const TRANSFER_CONDITION_TYPES = [
  "caller_requests_human",
  "value_threshold",
  "angry_caller",
  "emergency",
  "low_confidence",
] as const
export type TransferConditionType = (typeof TRANSFER_CONDITION_TYPES)[number]

export const TRANSFER_CONDITION_LABELS: Record<TransferConditionType, string> = {
  caller_requests_human: "Caller requests a human",
  value_threshold: "Estimated value above $X",
  angry_caller: "Caller seems angry or frustrated",
  emergency: "Emergency detected",
  low_confidence: "AI confidence is low",
}

export interface TransferRule {
  id: string
  org_id: string
  ai_employee_id: string
  condition_type: TransferConditionType
  condition_value: string | null
  action: string
  target_user_id: string | null
  target_phone: string | null
  position: number
  created_at: string
}

export interface TransferRuleWithTarget extends TransferRule {
  target_user: ProfileSummary | null
}

export type TransferRuleInput = Pick<
  TransferRule,
  "condition_type" | "condition_value" | "target_user_id" | "target_phone" | "position"
>
