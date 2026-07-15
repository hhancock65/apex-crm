import type { ContactSummary } from "@/types/contact"
import type { ProfileSummary } from "@/types/profile"

export const DEAL_STATUSES = ["open", "won", "lost"] as const
export type DealStatus = (typeof DEAL_STATUSES)[number]

export interface Deal {
  id: string
  org_id: string
  pipeline_id: string
  stage_id: string
  contact_id: string | null
  company_id: string | null
  title: string
  value: number
  probability: number | null
  expected_close_date: string | null
  assigned_to: string | null
  status: DealStatus
  notes: string | null
  won_at: string | null
  lost_at: string | null
  lost_reason: string | null
  created_at: string
  updated_at: string
}

export interface DealStageSummary {
  id: string
  name: string
  color: string | null
  // Only present when the embedding query selects them — narrower embeds
  // (e.g. the Contact detail page's Deals tab) omit these.
  position?: number
  win_probability?: number | null
}

export interface DealWithStage extends Deal {
  stage: DealStageSummary | null
}

/** @deprecated use ContactSummary from "@/types/contact" — kept as an alias so existing imports don't break. */
export type DealContactSummary = ContactSummary

export interface DealCompanySummary {
  id: string
  name: string
}

export interface DealWithRelations extends Deal {
  stage: DealStageSummary | null
  contact: DealContactSummary | null
  company: DealCompanySummary | null
  assigned_profile: ProfileSummary | null
}

export type CreateDealInput = Pick<
  Deal,
  | "pipeline_id"
  | "stage_id"
  | "contact_id"
  | "company_id"
  | "title"
  | "value"
  | "probability"
  | "expected_close_date"
  | "assigned_to"
  | "notes"
>

export type UpdateDealInput = Partial<
  Pick<
    Deal,
    | "title"
    | "contact_id"
    | "company_id"
    | "value"
    | "probability"
    | "expected_close_date"
    | "assigned_to"
    | "notes"
    | "stage_id"
  >
>

export function dealContactName(
  contact: Pick<DealContactSummary, "first_name" | "last_name"> | null
): string {
  if (!contact) return "No contact"
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "No contact"
}
