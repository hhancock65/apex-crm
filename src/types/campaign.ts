export const CAMPAIGN_TYPES = ["reactivation", "nurture", "outbound", "follow_up"] as const
export type CampaignType = (typeof CAMPAIGN_TYPES)[number]

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  reactivation: "Reactivation",
  nurture: "Nurture",
  outbound: "Outbound",
  follow_up: "Follow-Up",
}

export const CAMPAIGN_TYPE_DESCRIPTIONS: Record<CampaignType, string> = {
  reactivation: "Re-engage old leads who've gone quiet",
  nurture: "Keep warm leads moving toward a decision",
  outbound: "Reach new prospects who haven't talked to you yet",
  follow_up: "Check in after a completed service",
}

export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed"] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const CAMPAIGN_CONTACT_STATUSES = [
  "pending",
  "in_progress",
  "contacted",
  "responded",
  "converted",
  "skipped",
  "failed",
] as const
export type CampaignContactStatus = (typeof CAMPAIGN_CONTACT_STATUSES)[number]

export interface CampaignTargetFilter {
  tags?: string[]
  last_activity_before?: string
  last_activity_after?: string
  lead_status?: string[]
  deal_status?: string[]
}

export interface CampaignMessageTemplates {
  mode: "template" | "custom"
  instructions?: string
}

export interface CampaignScheduleConfig {
  start_date?: string
  max_calls_per_day?: number
  time_window_start?: string
  time_window_end?: string
  days_of_week?: number[]
}

export interface Campaign {
  id: string
  org_id: string
  name: string
  type: CampaignType
  ai_employee_id: string | null
  target_filter: CampaignTargetFilter
  message_templates: CampaignMessageTemplates
  schedule_config: CampaignScheduleConfig
  status: CampaignStatus
  stats: Record<string, unknown>
  total_contacts: number
  contacts_processed: number
  contacts_responded: number
  appointments_booked: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CampaignWithEmployee extends Campaign {
  ai_employee: { id: string; name: string; role: string } | null
}

export type CreateCampaignInput = Pick<
  Campaign,
  "name" | "type" | "ai_employee_id" | "target_filter" | "message_templates" | "schedule_config"
>

export type UpdateCampaignInput = Partial<
  Pick<
    Campaign,
    "name" | "status" | "ai_employee_id" | "target_filter" | "message_templates" | "schedule_config"
  >
>

export interface CampaignContact {
  id: string
  campaign_id: string
  contact_id: string
  status: CampaignContactStatus
  attempts: number
  last_attempt_at: string | null
  outcome: string | null
  created_at: string
  updated_at: string
}

export interface CampaignContactWithContact extends CampaignContact {
  contact: {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    email: string | null
  } | null
}
