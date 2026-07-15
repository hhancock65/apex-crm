// Canonical Apex pricing tiers. Duplicated at
// supabase/functions/_shared/plans.ts (Vite can't import from
// supabase/functions/, same reason campaign-scripts.ts is duplicated across
// that boundary) — keep both in sync if pricing or features change.

export const PLAN_IDS = ["apex_crm", "apex_ai_crm", "apex_ai_workforce", "apex_scale"] as const
export type PlanId = (typeof PLAN_IDS)[number]

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value)
}

export interface PlanFeatures {
  crm_core: boolean
  ai_employee_center: boolean
  conversations: boolean
  ai_builder: boolean
  automation: boolean
  campaigns: boolean
  multi_location: boolean
  advanced_integrations: boolean
  priority_support: boolean
}

const NO_FEATURES: PlanFeatures = {
  crm_core: false,
  ai_employee_center: false,
  conversations: false,
  ai_builder: false,
  automation: false,
  campaigns: false,
  multi_location: false,
  advanced_integrations: false,
  priority_support: false,
}

/** Monthly allowance included at each tier before usage-based overage
 *  kicks in (migration 0019). apex_crm gets zero across the board — it's
 *  CRM Core only, no AI Employee features, so there's nothing to include an
 *  allowance for. */
export interface UsageAllowance {
  aiMinutes: number
  sms: number
  calls: number
}

export const USAGE_ALLOWANCES: Record<PlanId, UsageAllowance> = {
  apex_crm: { aiMinutes: 0, sms: 0, calls: 0 },
  apex_ai_crm: { aiMinutes: 500, sms: 500, calls: 100 },
  apex_ai_workforce: { aiMinutes: 2000, sms: 2000, calls: 500 },
  apex_scale: { aiMinutes: 5000, sms: 5000, calls: 1500 },
}

/** Per-unit overage price once a period's included allowance is exhausted.
 *  Mirrored in supabase/functions/_shared/plans.ts and the record_usage()/
 *  check_usage_limits() SQL functions (migration 0019) — keep all three in
 *  sync if pricing changes. */
export const OVERAGE_RATES = {
  aiMinute: 0.15,
  sms: 0.03,
  call: 0.25,
}

export interface PlanDefinition {
  id: PlanId
  name: string
  priceMonthly: number
  tagline: string
  featureList: string[]
  features: PlanFeatures
  usageAllowance: UsageAllowance
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  apex_crm: {
    id: "apex_crm",
    name: "Apex CRM",
    priceMonthly: 99,
    tagline: "CRM Core",
    featureList: [
      "Contacts, leads & deals",
      "Pipeline management",
      "Tasks & calendar",
      "Appointment scheduling",
    ],
    features: { ...NO_FEATURES, crm_core: true },
    usageAllowance: USAGE_ALLOWANCES.apex_crm,
  },
  apex_ai_crm: {
    id: "apex_ai_crm",
    name: "Apex AI CRM",
    priceMonthly: 299,
    tagline: "CRM + AI Employee Center + Conversations",
    featureList: [
      "Everything in Apex CRM",
      "AI Employee Center",
      "AI-powered conversations",
      "Call transcripts & summaries",
    ],
    features: { ...NO_FEATURES, crm_core: true, ai_employee_center: true, conversations: true },
    usageAllowance: USAGE_ALLOWANCES.apex_ai_crm,
  },
  apex_ai_workforce: {
    id: "apex_ai_workforce",
    name: "Apex AI Workforce",
    priceMonthly: 599,
    tagline: "Full platform + AI Builder + Automation + Campaigns",
    featureList: [
      "Everything in Apex AI CRM",
      "AI Employee Builder",
      "Workflow automation",
      "Outbound campaigns",
    ],
    features: {
      ...NO_FEATURES,
      crm_core: true,
      ai_employee_center: true,
      conversations: true,
      ai_builder: true,
      automation: true,
      campaigns: true,
    },
    usageAllowance: USAGE_ALLOWANCES.apex_ai_workforce,
  },
  apex_scale: {
    id: "apex_scale",
    name: "Apex Scale",
    priceMonthly: 999,
    tagline: "Multi-location + advanced integrations + priority support",
    featureList: [
      "Everything in Apex AI Workforce",
      "Multi-location support",
      "Advanced integrations",
      "Priority support",
    ],
    features: {
      crm_core: true,
      ai_employee_center: true,
      conversations: true,
      ai_builder: true,
      automation: true,
      campaigns: true,
      multi_location: true,
      advanced_integrations: true,
      priority_support: true,
    },
    usageAllowance: USAGE_ALLOWANCES.apex_scale,
  },
}

export const PLAN_ORDER: PlanId[] = ["apex_crm", "apex_ai_crm", "apex_ai_workforce", "apex_scale"]

/** The cheapest plan that includes a given feature — used by the upgrade
 *  prompt FeatureGate shows when an org's current plan doesn't include the
 *  feature it's wrapping. */
export function cheapestPlanFor(feature: keyof PlanFeatures): PlanDefinition | undefined {
  return PLAN_ORDER.map((id) => PLANS[id]).find((plan) => plan.features[feature])
}
