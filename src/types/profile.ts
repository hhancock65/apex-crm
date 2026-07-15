export type OrgRole = "owner" | "admin" | "manager" | "sales_rep" | "viewer"

export const ORG_ROLES: OrgRole[] = ["owner", "admin", "manager", "sales_rep", "viewer"]

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  sales_rep: "Sales Rep",
  viewer: "Viewer",
}

export interface ProfileSummary {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  role?: OrgRole
}

export function profileDisplayName(
  profile: ProfileSummary | null | undefined
): string {
  if (!profile) return "Unassigned"
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ")
  return name || profile.email || "Unassigned"
}
