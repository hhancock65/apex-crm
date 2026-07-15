export const PARTNER_STATUSES = ["pending", "active", "suspended"] as const
export type PartnerStatus = (typeof PARTNER_STATUSES)[number]

export const PARTNER_BILLING_TYPES = ["wholesale", "revenue_share"] as const
export type PartnerBillingType = (typeof PARTNER_BILLING_TYPES)[number]

export interface Partner {
  id: string
  org_id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  status: PartnerStatus
  commission_rate: number
  billing_type: PartnerBillingType
  settings: Record<string, unknown>
  custom_logo_url: string | null
  primary_color: string | null
  company_name: string | null
  created_at: string
  updated_at: string
}

/** One row of get_partner_dashboard() — a partner's own client roster. */
export interface PartnerClientRow {
  org_id: string
  org_name: string
  org_clerk_id: string
  plan_id: string | null
  subscription_status: string | null
  monthly_rate: number
  link_status: "active" | "suspended"
  ai_employee_count: number
  calls_this_month: number
}

/** One row of get_platform_partners() — JHDM's partner roster. */
export interface PlatformPartnerRow {
  partner_id: string
  partner_name: string
  contact_name: string | null
  email: string | null
  status: PartnerStatus
  billing_type: PartnerBillingType
  commission_rate: number
  client_count: number
  partner_mrr: number
  created_at: string
}

/** One row of get_platform_organizations() — JHDM's org roster. */
export interface PlatformOrganizationRow {
  org_id: string
  org_name: string
  partner_name: string | null
  plan_id: string | null
  subscription_status: string | null
  ai_employee_count: number
  calls_count: number
  created_at: string
}

export interface WhiteLabel {
  custom_logo_url: string | null
  primary_color: string | null
  company_name: string | null
}
