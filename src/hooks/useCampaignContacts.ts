import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { campaignKeys } from "@/hooks/useCampaigns"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { CampaignContactStatus, CampaignContactWithContact } from "@/types/campaign"

const CAMPAIGN_CONTACT_SELECT = `
  *,
  contact:contacts!campaign_contacts_contact_id_fkey(id, first_name, last_name, phone, email)
`

export interface CampaignContactFilters {
  status: CampaignContactStatus | "all"
  page: number
  pageSize: number
}

export function getDefaultCampaignContactFilters(): CampaignContactFilters {
  return { status: "all", page: 1, pageSize: 25 }
}

export const campaignContactKeys = {
  all: ["campaign-contacts"] as const,
  list: (campaignId: string, filters: CampaignContactFilters) =>
    [...campaignContactKeys.all, campaignId, filters] as const,
}

export function useCampaignContacts(campaignId: string | undefined, filters: CampaignContactFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: campaignContactKeys.list(campaignId ?? "", filters),
    enabled: Boolean(campaignId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("campaign_contacts")
        .select(CAMPAIGN_CONTACT_SELECT, { count: "exact" })
        .eq("campaign_id", campaignId!)

      if (filters.status !== "all") query = query.eq("status", filters.status)

      query = query.order("created_at", { ascending: true })

      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      return {
        contacts: (data ?? []) as CampaignContactWithContact[],
        total: count ?? 0,
      }
    },
  })
}

/** Realtime updates as the campaign runs — process-campaign-batch and
 *  retell-call-webhook both write to campaign_contacts/campaigns from
 *  outside the browser, so polling or manual refresh would otherwise be the
 *  only way to see progress. Same INSERT/UPDATE subscription idiom as
 *  useAIActivityRealtime/useNotificationsRealtime. */
export function useCampaignRealtime(campaignId: string | undefined) {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!campaignId) return

    const channel = supabase
      .channel(`campaign_${campaignId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_contacts", filter: `campaign_id=eq.${campaignId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: campaignContactKeys.all })
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "campaigns", filter: `id=eq.${campaignId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: campaignKeys.detail(campaignId) })
          queryClient.invalidateQueries({ queryKey: campaignKeys.lists() })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, campaignId])
}
