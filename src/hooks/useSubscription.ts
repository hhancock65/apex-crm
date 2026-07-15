import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { invokeWithRetry } from "@/lib/edge-functions"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { PlanFeatures, PlanId } from "@/lib/plans"
import type { Subscription } from "@/types/subscription"

export const subscriptionKeys = {
  orgFeatures: ["org-plan-features"] as const,
  current: ["subscription"] as const,
}

function useOrgPlanFeatures() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: subscriptionKeys.orgFeatures,
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("id, plan_features").single()
      if (error) throw error
      return data as { id: string; plan_features: Record<string, unknown> }
    },
  })
}

function useCurrentSubscriptionRow() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: subscriptionKeys.current,
    queryFn: async () => {
      const { data, error } = await supabase.from("subscriptions").select("*").maybeSingle()
      if (error) throw error
      return data as Subscription | null
    },
  })
}

/**
 * The single source of truth the rest of the app reads for "what plan is
 * this org on, and what can it do." Feature access comes directly from
 * organizations.plan_features (kept in sync by stripe-webhook) rather than
 * being re-derived from PLANS client-side — that column is the literal,
 * authoritative answer even if this app's own copy of the feature map ever
 * drifts from what a webhook computed at write time.
 */
export function useSubscription() {
  const orgQuery = useOrgPlanFeatures()
  const subQuery = useCurrentSubscriptionRow()

  const rawFeatures = (orgQuery.data?.plan_features ?? {}) as Partial<PlanFeatures> & { plan_id?: string }

  function hasFeature(feature: keyof PlanFeatures): boolean {
    return Boolean(rawFeatures[feature])
  }

  return {
    subscription: subQuery.data ?? null,
    planId: (subQuery.data?.plan_id as PlanId | undefined) ?? null,
    status: subQuery.data?.status ?? null,
    features: rawFeatures,
    hasFeature,
    isLoading: orgQuery.isLoading || subQuery.isLoading,
  }
}

/** Live-updates useSubscription's data once stripe-webhook processes a
 *  checkout or portal-driven change — otherwise a user redirected back from
 *  Stripe would have to manually refresh to see their new plan take effect.
 *  Mirrors useCampaignContacts' realtime hook (0013); no explicit org
 *  filter needed since RLS already scopes which rows these events can even
 *  contain, same as every other unfiltered realtime hook in this codebase. */
export function useSubscriptionRealtime() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel("subscription-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => {
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.current })
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "organizations" }, () => {
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.orgFeatures })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])
}

export function useCreateCheckoutSession() {
  const supabase = useSupabaseClient()

  return useMutation({
    mutationFn: (planId: PlanId) =>
      invokeWithRetry<{ url: string }>(supabase, "stripe-checkout", {
        plan_id: planId,
        origin: window.location.origin,
      }),
  })
}

export function useCreatePortalSession() {
  const supabase = useSupabaseClient()

  return useMutation({
    mutationFn: () =>
      invokeWithRetry<{ url: string }>(supabase, "stripe-portal", { origin: window.location.origin }),
  })
}
