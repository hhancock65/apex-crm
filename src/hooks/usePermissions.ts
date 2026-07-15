import { useCurrentProfile } from "@/hooks/useCurrentProfile"
import { accessLevelFor, type Feature } from "@/lib/permissions"
import type { OrgRole } from "@/types/profile"

/**
 * Reads role from Supabase profiles.role (via useCurrentProfile), not from
 * Clerk organization membership metadata as the original spec literally
 * said. Deliberate deviation, not an oversight: RLS (the actual security
 * boundary — 0023_team_roles_permissions.sql) can only evaluate SQL, so
 * get_user_role() has to read Postgres regardless of what the frontend
 * does. Making the frontend read a SEPARATE source (Clerk metadata) would
 * mean two systems of record for the same permission model that could drift
 * — e.g. a role change updating one but not the other. Keeping
 * profiles.role authoritative for both keeps exactly one source of truth.
 */
export function usePermissions() {
  const { data: profile, isLoading } = useCurrentProfile()
  const role = (profile?.role ?? null) as OrgRole | null

  return {
    role,
    isLoading,
    isOwner: role === "owner",
    isAdmin: role === "admin" || role === "owner",
    canAccess: (feature: Feature) => accessLevelFor(role, feature) !== "none",
    canEdit: (feature: Feature) => accessLevelFor(role, feature) === "edit",
    canDelete: (feature: Feature) => accessLevelFor(role, feature) === "edit",
  }
}
