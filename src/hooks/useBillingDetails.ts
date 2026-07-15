import { useQuery } from "@tanstack/react-query"

import { invokeWithRetry } from "@/lib/edge-functions"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { BillingDetails } from "@/types/billing"

/** Payment method + invoice history, fetched live from Stripe via
 *  stripe-billing-details — this data doesn't live in Supabase at all, so
 *  there's no table to query directly the way useSubscription/useUsage do. */
export function useBillingDetails(enabled: boolean) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["billing-details"],
    enabled,
    staleTime: 60_000,
    queryFn: () => invokeWithRetry<BillingDetails>(supabase, "stripe-billing-details", {}),
  })
}
