import type { SupabaseClient } from "@supabase/supabase-js"
import { useQuery, type QueryClient } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"

export const currentOrgIdKey = ["current-org-id"] as const

async function fetchCurrentOrgId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .single()
  if (error) throw error
  return data.id as string
}

/**
 * Resolves the signed-in user's internal organizations.id. RLS on
 * `organizations` already restricts SELECT to the caller's own org (matched
 * against the Clerk org_id claim), so an unfiltered `.single()` is exactly
 * the right query — there is never more than one visible row.
 */
export function useCurrentOrgId() {
  const supabase = useSupabaseClient()
  return useQuery({
    queryKey: currentOrgIdKey,
    queryFn: () => fetchCurrentOrgId(supabase),
    staleTime: Infinity,
  })
}

/**
 * Non-hook accessor for use inside mutationFns, where relying on a separate
 * useQuery's (possibly stale/loading) state would create a race with the
 * user's submit click. Routes through the query cache so repeated calls
 * don't refetch once resolved.
 */
export function getCurrentOrgId(
  supabase: SupabaseClient,
  queryClient: QueryClient
): Promise<string> {
  return queryClient.fetchQuery({
    queryKey: currentOrgIdKey,
    queryFn: () => fetchCurrentOrgId(supabase),
    staleTime: Infinity,
  })
}
