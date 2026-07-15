import type { OrgRole } from "@/types/profile"

/**
 * Feature -> role permission matrix, shared by usePermissions() and
 * RolesPermissionsPage's matrix table so the two can never drift apart.
 *
 * "edit" implies canAccess + canEdit + canDelete. "view" implies canAccess
 * only. "none" implies nothing. This is a coarse, feature-level gate for
 * UI purposes — the real, row-level enforcement (e.g. a Sales Rep only
 * editing their own leads) lives in RLS (0023_team_roles_permissions.sql),
 * not here. A "edit" here for Sales Rep on "crm" doesn't mean org-wide edit
 * rights; it means the UI shows edit controls, and the database enforces
 * the row-level boundary underneath.
 */
export type Feature =
  | "crm"
  | "ai_employees"
  | "campaigns"
  | "workflows"
  | "analytics"
  | "billing"
  | "team"
  | "settings"

export type AccessLevel = "none" | "view" | "edit"

export const FEATURES: Feature[] = [
  "crm",
  "ai_employees",
  "campaigns",
  "workflows",
  "analytics",
  "billing",
  "team",
  "settings",
]

export const FEATURE_LABELS: Record<Feature, string> = {
  crm: "CRM",
  ai_employees: "AI Employees",
  campaigns: "Campaigns",
  workflows: "Workflows",
  analytics: "Analytics",
  billing: "Billing",
  team: "Team",
  settings: "Settings",
}

export const PERMISSION_MATRIX: Record<OrgRole, Record<Feature, AccessLevel>> = {
  owner: {
    crm: "edit",
    ai_employees: "edit",
    campaigns: "edit",
    workflows: "edit",
    analytics: "edit",
    billing: "edit",
    team: "edit",
    settings: "edit",
  },
  admin: {
    crm: "edit",
    ai_employees: "edit",
    campaigns: "edit",
    workflows: "edit",
    analytics: "edit",
    billing: "none",
    team: "edit",
    settings: "edit",
  },
  manager: {
    crm: "edit",
    ai_employees: "view",
    campaigns: "view",
    workflows: "view",
    analytics: "view",
    billing: "none",
    team: "none",
    settings: "none",
  },
  sales_rep: {
    crm: "edit",
    ai_employees: "view",
    campaigns: "view",
    workflows: "view",
    analytics: "none",
    billing: "none",
    team: "none",
    settings: "none",
  },
  viewer: {
    crm: "view",
    ai_employees: "view",
    campaigns: "view",
    workflows: "view",
    analytics: "view",
    billing: "none",
    team: "none",
    settings: "none",
  },
}

export function accessLevelFor(role: OrgRole | null | undefined, feature: Feature): AccessLevel {
  if (!role) return "none"
  return PERMISSION_MATRIX[role][feature]
}
