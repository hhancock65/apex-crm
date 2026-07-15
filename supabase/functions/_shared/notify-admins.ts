// Shared by any Edge Function that needs to alert an org's decision-makers —
// workflow-executor (workflow run failures) and stripe-webhook (payment
// failures) both need "notify every owner/admin" and nothing else in this
// codebase does yet. Extracted here once a second real consumer showed up,
// same DRY-at-second-use convention as asString/asNumber (_shared/parse-args.ts).

import type { createServiceRoleClient } from "./supabase-admin.ts"

type ServiceClient = ReturnType<typeof createServiceRoleClient>

export interface AdminNotification {
  type: string
  title: string
  message: string
  relatedToType?: string
  relatedToId?: string
}

export async function notifyOrgAdmins(
  supabase: ServiceClient,
  orgId: string,
  notification: AdminNotification
): Promise<void> {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .single()
  if (orgError) {
    console.error("notifyOrgAdmins: failed to look up organization settings", orgError)
    return
  }

  // SettingsPage's notification preferences (organizations.settings.notification_preferences,
  // see src/pages/admin/SettingsPage.tsx) — a type explicitly opted out of is
  // skipped entirely. Unset/missing defaults to enabled, so orgs created
  // before this existed keep getting every notification they always did.
  const preferences = (org?.settings as { notification_preferences?: Record<string, boolean> } | null)
    ?.notification_preferences
  if (preferences && preferences[notification.type] === false) {
    return
  }

  const { data: admins, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("org_id", orgId)
    .in("role", ["owner", "admin"])

  if (error) {
    console.error("notifyOrgAdmins: failed to look up org admins", error)
    return
  }
  if (!admins || admins.length === 0) return

  const rows = (admins as { id: string }[]).map((admin) => ({
    org_id: orgId,
    user_id: admin.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    related_to_type: notification.relatedToType ?? null,
    related_to_id: notification.relatedToId ?? null,
  }))

  const { error: insertError } = await supabase.from("notifications").insert(rows)
  if (insertError) console.error("notifyOrgAdmins: failed to insert notifications", insertError)
}
