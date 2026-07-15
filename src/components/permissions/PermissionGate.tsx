import { ShieldAlert } from "lucide-react"
import type { ReactNode } from "react"

import { usePermissions } from "@/hooks/usePermissions"
import type { Feature } from "@/lib/permissions"
import { ORG_ROLE_LABELS, type OrgRole } from "@/types/profile"

interface PermissionGateProps {
  /** Show children only if the caller's role is one of these. */
  requiredRole?: OrgRole | OrgRole[]
  /** Show children only if the caller has at least this access level on `feature` ("view" if omitted). */
  requiredPermission?: { feature: Feature; level?: "view" | "edit" }
  children: ReactNode
  /** Custom fallback for inline/compact spots (e.g. gating just a button) instead of the default message. */
  fallback?: ReactNode
}

/** Wraps any UI element and shows "You don't have access" (or a custom
 *  fallback) instead of `children` when the signed-in user's role doesn't
 *  satisfy requiredRole/requiredPermission. This is a UX layer, not the
 *  security boundary — RLS enforces the real row-level rules regardless of
 *  what this component renders. */
export function PermissionGate({ requiredRole, requiredPermission, children, fallback }: PermissionGateProps) {
  const { role, isLoading, canAccess, canEdit } = usePermissions()

  if (isLoading) return null

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!role || !allowed.includes(role)) {
      return fallback !== undefined ? <>{fallback}</> : <NoAccessMessage requiredRole={allowed} />
    }
  }

  if (requiredPermission) {
    const hasAccess =
      requiredPermission.level === "edit" ? canEdit(requiredPermission.feature) : canAccess(requiredPermission.feature)
    if (!hasAccess) {
      return fallback !== undefined ? <>{fallback}</> : <NoAccessMessage />
    }
  }

  return <>{children}</>
}

function NoAccessMessage({ requiredRole }: { requiredRole?: OrgRole[] }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white py-10 text-center">
      <ShieldAlert className="h-8 w-8 text-slate-300" />
      <p className="text-sm font-semibold text-slate-700">You don't have access to this</p>
      {requiredRole && requiredRole.length > 0 && (
        <p className="text-xs text-slate-400">
          Requires {requiredRole.map((r) => ORG_ROLE_LABELS[r]).join(" or ")} access.
        </p>
      )}
    </div>
  )
}
