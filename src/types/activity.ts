import type { ProfileSummary } from "@/types/profile"

export const ACTIVITY_TYPES = [
  "call",
  "email",
  "sms",
  "note",
  "task_created",
  "task_completed",
  "deal_created",
  "deal_won",
  "deal_lost",
  "appointment_booked",
  "lead_created",
  "contact_created",
  "ai_action",
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export type RelatedEntityType =
  | "lead"
  | "contact"
  | "company"
  | "deal"
  | "task"
  | "appointment"

export interface Activity {
  id: string
  org_id: string
  type: ActivityType
  description: string | null
  performed_by: string | null
  performed_by_ai: boolean
  ai_employee_id: string | null
  related_to_type: RelatedEntityType | null
  related_to_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ActivityWithAuthor extends Activity {
  author: ProfileSummary | null
}
