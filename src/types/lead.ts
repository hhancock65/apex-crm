import type { ProfileSummary } from "@/types/profile"

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_SOURCES = [
  "website",
  "phone",
  "referral",
  "ai_employee",
  "campaign",
  "manual",
  "other",
] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export interface Lead {
  id: string
  org_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  company: string | null
  source: LeadSource
  status: LeadStatus
  assigned_to: string | null
  notes: string | null
  score: number | null
  created_at: string
  updated_at: string
}

export interface LeadWithAssignee extends Lead {
  assigned_profile: ProfileSummary | null
}

export type CreateLeadInput = Pick<
  Lead,
  "first_name" | "last_name" | "email" | "phone" | "company" | "source" | "notes"
>

export type UpdateLeadInput = Partial<
  Pick<
    Lead,
    | "first_name"
    | "last_name"
    | "email"
    | "phone"
    | "company"
    | "source"
    | "status"
    | "assigned_to"
    | "notes"
    | "score"
  >
>

export function leadFullName(lead: Pick<Lead, "first_name" | "last_name">): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "(No name)"
}
