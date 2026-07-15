import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { PartnerStatus, PlatformOrganizationRow, PlatformPartnerRow } from "@/types/partner"

export const jhdmKeys = {
  isAdmin: ["is-jhdm-admin"] as const,
  partners: ["jhdm-platform-partners"] as const,
  organizations: ["jhdm-platform-organizations"] as const,
}

/** Gates JHDMAdminPage's nav item and route. The real enforcement is
 *  server-side (get_platform_partners/get_platform_organizations both
 *  re-check is_jhdm_admin() themselves and raise if it's false) — this is
 *  purely a UI convenience, safe to expose since it only ever answers "is
 *  the CALLER a JHDM admin," not anyone else's status. */
export function useIsJhdmAdmin() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: jhdmKeys.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_jhdm_admin")
      if (error) throw error
      return Boolean(data)
    },
    staleTime: 60_000,
  })
}

export function usePlatformPartners(enabled: boolean) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: jhdmKeys.partners,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_platform_partners")
      if (error) throw error
      return (data ?? []).map((row: PlatformPartnerRow) => ({
        ...row,
        client_count: Number(row.client_count),
        partner_mrr: Number(row.partner_mrr),
      })) as PlatformPartnerRow[]
    },
  })
}

export function usePlatformOrganizations(enabled: boolean) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: jhdmKeys.organizations,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_platform_organizations")
      if (error) throw error
      return (data ?? []).map((row: PlatformOrganizationRow) => ({
        ...row,
        ai_employee_count: Number(row.ai_employee_count),
        calls_count: Number(row.calls_count),
      })) as PlatformOrganizationRow[]
    },
  })
}

export function useUpdatePartnerStatus() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ partnerId, status }: { partnerId: string; status: PartnerStatus }) => {
      const { error } = await supabase.from("partners").update({ status }).eq("id", partnerId)
      if (error) throw error
      return { partnerId, status }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jhdmKeys.partners })
    },
  })
}
