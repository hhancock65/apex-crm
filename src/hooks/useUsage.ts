import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { UsageRecord } from "@/types/usage"

export const usageKeys = {
  current: ["usage", "current"] as const,
  history: (limit: number) => ["usage", "history", limit] as const,
}

/** The org's current billing period, if one exists yet — created by
 *  stripe-webhook (ensure_usage_period) once a subscription's period is
 *  known, or lazily by record_usage() the first time any usage happens
 *  without one. `undefined` (not an error) for an org that's never had
 *  either happen. */
export function useCurrentUsage() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: usageKeys.current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usage_records")
        .select("*")
        .lte("period_start", new Date().toISOString().slice(0, 10))
        .gte("period_end", new Date().toISOString().slice(0, 10))
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as UsageRecord | null
    },
  })
}

/** Most recent `limit` periods (current period included, if any), oldest
 *  first — the shape a trend chart wants. */
export function useUsageHistory(limit = 6) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: usageKeys.history(limit),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usage_records")
        .select("*")
        .order("period_start", { ascending: false })
        .limit(limit)
      if (error) throw error
      return ((data ?? []) as UsageRecord[]).slice().reverse()
    },
  })
}

/** Live-updates as record_usage() increments the current period — a call
 *  concluding or an SMS sending should move the progress bars without a
 *  manual refresh. Mirrors useSubscriptionRealtime (no explicit org
 *  filter; RLS already scopes which rows these events can contain). */
export function useUsageRealtime() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel("usage-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "usage_records" }, () => {
        queryClient.invalidateQueries({ queryKey: ["usage"] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])
}
