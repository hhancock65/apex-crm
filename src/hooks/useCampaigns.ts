import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getCurrentOrgId } from "@/hooks/useCurrentOrgId"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import { invokeWithRetry } from "@/lib/edge-functions"
import type {
  Campaign,
  CampaignStatus,
  CampaignTargetFilter,
  CampaignWithEmployee,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "@/types/campaign"

const CAMPAIGN_EMPLOYEE_SELECT = `
  *,
  ai_employee:ai_employees!campaigns_ai_employee_id_fkey(id, name, role)
`

export interface CampaignFilters {
  status: CampaignStatus | "all"
}

export function getDefaultCampaignFilters(): CampaignFilters {
  return { status: "all" }
}

export const campaignKeys = {
  all: ["campaigns"] as const,
  lists: () => [...campaignKeys.all, "list"] as const,
  list: (filters: CampaignFilters) => [...campaignKeys.lists(), filters] as const,
  details: () => [...campaignKeys.all, "detail"] as const,
  detail: (id: string) => [...campaignKeys.details(), id] as const,
}

export function useCampaigns(filters: CampaignFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: campaignKeys.list(filters),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from("campaigns").select(CAMPAIGN_EMPLOYEE_SELECT)
      if (filters.status !== "all") query = query.eq("status", filters.status)
      query = query.order("created_at", { ascending: false })

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as CampaignWithEmployee[]
    },
  })
}

export function useCampaign(id: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: campaignKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select(CAMPAIGN_EMPLOYEE_SELECT)
        .eq("id", id!)
        .single()
      if (error) throw error
      return data as CampaignWithEmployee
    },
  })
}

/** Powers the wizard's live "estimated count" preview — the exact same
 *  Postgres function (resolve_campaign_audience) launch-campaign calls to
 *  actually enroll contacts, so the preview is never out of sync with
 *  reality. */
export function useCampaignAudienceCount(targetFilter: CampaignTargetFilter) {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ["campaign-audience-count", targetFilter],
    queryFn: async () => {
      const orgId = await getCurrentOrgId(supabase, queryClient)
      const { data, error } = await supabase.rpc("resolve_campaign_audience", {
        p_org_id: orgId,
        p_target_filter: targetFilter,
      })
      if (error) throw error
      return (data ?? []).length as number
    },
  })
}

export function useCreateCampaign() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      const { data, error } = await supabase
        .from("campaigns")
        .insert({ ...input, org_id: orgId, status: "draft" })
        .select("*")
        .single()
      if (error) throw error
      return data as Campaign
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() })
    },
  })
}

export function useUpdateCampaign() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateCampaignInput }) => {
      const { data, error } = await supabase
        .from("campaigns")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single()
      if (error) throw error
      return data as Campaign
    },
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() })
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(campaign.id) })
    },
  })
}

export interface LaunchCampaignResult {
  success: true
  total_contacts: number
}

/** Seeds campaign_contacts from the audience filter and flips the campaign
 *  to 'active' — see supabase/functions/launch-campaign. Only valid for a
 *  'draft' campaign; resuming a paused one is a plain useUpdateCampaign
 *  status flip, not this. */
export function useLaunchCampaign() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (campaignId: string) =>
      invokeWithRetry<LaunchCampaignResult>(supabase, "launch-campaign", { campaign_id: campaignId }),
    onSuccess: (_result, campaignId) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() })
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(campaignId) })
    },
  })
}
