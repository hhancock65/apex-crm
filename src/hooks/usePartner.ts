import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { invokeWithRetry } from "@/lib/edge-functions"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { PartnerClientRow } from "@/types/partner"

export const partnerKeys = {
  isPartner: ["is-active-partner"] as const,
  dashboard: ["partner-dashboard"] as const,
}

/** Whether the CURRENT Clerk-active org is an active (approved) partner —
 *  gates the "Partner Dashboard" nav item/route. Postgres's
 *  get_user_partner_id() returns null for a pending/suspended partner or a
 *  non-partner org alike, so this is a plain boolean from the caller's
 *  point of view. */
export function useIsActivePartner() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: partnerKeys.isPartner,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_partner_id")
      if (error) throw error
      return Boolean(data)
    },
    staleTime: 60_000,
  })
}

/** A partner's own client roster + per-client stats — the same result set
 *  powers both PartnerDashboardPage's table and its summary cards (the
 *  page reduces this array for totals rather than a second round trip). */
export function usePartnerDashboard() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: partnerKeys.dashboard,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_partner_dashboard")
      if (error) throw error
      // Postgres bigint columns (ai_employee_count, calls_this_month) come
      // back from PostgREST as strings to avoid JS number-precision loss —
      // coerce them here so the rest of the app can treat this as a plain
      // number, matching every other count in this codebase.
      return (data ?? []).map((row: PartnerClientRow) => ({
        ...row,
        ai_employee_count: Number(row.ai_employee_count),
        calls_this_month: Number(row.calls_this_month),
      })) as PartnerClientRow[]
    },
  })
}

export interface RegisterPartnerInput {
  name: string
  contact_name?: string
  email?: string
  phone?: string
  website?: string
}

export function useRegisterPartner() {
  const supabase = useSupabaseClient()

  return useMutation({
    mutationFn: (input: RegisterPartnerInput) =>
      invokeWithRetry<{ success: true; partner_id: string; status: string }>(
        supabase,
        "partner-register",
        input as unknown as Record<string, unknown>
      ),
  })
}

export interface CreateClientOrganizationInput {
  name: string
  monthly_rate?: number
}

export function useCreateClientOrganization() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateClientOrganizationInput) =>
      invokeWithRetry<{ success: true; org_id: string; clerk_org_id: string }>(
        supabase,
        "create-client-organization",
        input as unknown as Record<string, unknown>
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.dashboard })
    },
  })
}
