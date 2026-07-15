import { useUser } from "@clerk/clerk-react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { useQuery, type QueryClient } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { ProfileSummary } from "@/types/profile"

async function fetchCurrentProfile(
  supabase: SupabaseClient,
  clerkUserId: string
): Promise<ProfileSummary> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role")
    .eq("clerk_user_id", clerkUserId)
    .single()
  if (error) throw error
  return data as ProfileSummary
}

/** The signed-in user's `profiles` row — the internal id used for assigned_to / created_by / performed_by columns. */
export function useCurrentProfile() {
  const supabase = useSupabaseClient()
  const { user } = useUser()
  const clerkUserId = user?.id

  return useQuery({
    queryKey: ["current-profile", clerkUserId],
    queryFn: () => fetchCurrentProfile(supabase, clerkUserId!),
    enabled: Boolean(clerkUserId),
    staleTime: Infinity,
  })
}

export function getCurrentProfile(
  supabase: SupabaseClient,
  queryClient: QueryClient,
  clerkUserId: string
): Promise<ProfileSummary> {
  return queryClient.fetchQuery({
    queryKey: ["current-profile", clerkUserId],
    queryFn: () => fetchCurrentProfile(supabase, clerkUserId),
    staleTime: Infinity,
  })
}
