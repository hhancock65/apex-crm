import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import { invokeWithRetry } from "@/lib/edge-functions"

export interface BusinessHoursDay {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
  open: string
  close: string
  closed: boolean
}

export const DEFAULT_BUSINESS_HOURS: BusinessHoursDay[] = [
  { day: "mon", open: "09:00", close: "17:00", closed: false },
  { day: "tue", open: "09:00", close: "17:00", closed: false },
  { day: "wed", open: "09:00", close: "17:00", closed: false },
  { day: "thu", open: "09:00", close: "17:00", closed: false },
  { day: "fri", open: "09:00", close: "17:00", closed: false },
  { day: "sat", open: "09:00", close: "17:00", closed: true },
  { day: "sun", open: "09:00", close: "17:00", closed: true },
]

export interface AiEmployeeDefaults {
  default_voice: string
  default_personality: string
  default_escalation_rules: string
}

/** Every event type that actually calls notifyOrgAdmins() or inserts a
 *  notifications row server-side — kept in sync with
 *  supabase/functions/_shared/notify-admins.ts call sites and
 *  record_usage() (0020/0023). Adding a new notification type elsewhere in
 *  the backend means adding it here too, or it can't be turned off. */
export const NOTIFICATION_TYPES: { key: string; label: string; description: string }[] = [
  { key: "workflow_failed", label: "Workflow failures", description: "A workflow run errored out and couldn't continue." },
  { key: "payment_failed", label: "Payment failures", description: "A subscription charge was declined." },
  { key: "usage_warning", label: "Usage warnings (80%)", description: "Usage crossed 80% of a plan's included allowance." },
  { key: "usage_exceeded", label: "Usage exceeded (100%)", description: "Usage crossed 100% of a plan's included allowance." },
  { key: "usage_overage", label: "Usage far over plan (200%+)", description: "Usage is more than double the included allowance." },
  { key: "usage_overage_invoiced", label: "Overage invoiced", description: "Overage charges were added to an upcoming invoice." },
]

export interface OrgSettings {
  phone: string
  address: string
  timezone: string
  business_hours: BusinessHoursDay[]
  logo_url: string | null
  ai_defaults: AiEmployeeDefaults
  notification_preferences: Record<string, boolean>
}

export interface OrganizationRow {
  id: string
  name: string
  settings: Partial<OrgSettings>
}

export const orgSettingsKeys = {
  current: ["org-settings"] as const,
}

export function useOrgSettings() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: orgSettingsKeys.current,
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("id, name, settings").single()
      if (error) throw error
      return data as OrganizationRow
    },
  })
}

export function useUpdateOrgSettings() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name?: string; settings: Partial<OrgSettings> }) => {
      const { data: current, error: fetchError } = await supabase.from("organizations").select("id, settings").single()
      if (fetchError) throw fetchError

      const mergedSettings = { ...(current.settings as Record<string, unknown>), ...input.settings }
      const { error } = await supabase
        .from("organizations")
        .update({ ...(input.name !== undefined ? { name: input.name } : {}), settings: mergedSettings })
        .eq("id", current.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgSettingsKeys.current }),
  })
}

export function useUploadOrgLogo() {
  const supabase = useSupabaseClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const { data: org, error: orgError } = await supabase.from("organizations").select("id").single()
      if (orgError) throw orgError

      const extension = file.name.split(".").pop() ?? "png"
      const path = `${org.id}/logo-${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage.from("org-assets").upload(path, file, {
        upsert: true,
        contentType: file.type,
      })
      if (uploadError) throw uploadError

      const { data: publicUrl } = supabase.storage.from("org-assets").getPublicUrl(path)
      return publicUrl.publicUrl
    },
  })
}

export function useDeleteOrganization() {
  const supabase = useSupabaseClient()

  return useMutation({
    mutationFn: (confirmationText: string) =>
      invokeWithRetry<{ success: true }>(supabase, "delete-organization", { confirmationText }),
  })
}
