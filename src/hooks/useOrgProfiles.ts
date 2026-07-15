import { useQuery } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { ProfileSummary } from "@/types/profile"

/** All profiles in the caller's org — for assignee pickers. RLS on `profiles` already scopes this to org members. */
export function useOrgProfiles() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["org-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .order("first_name", { ascending: true })
      if (error) throw error
      return data as ProfileSummary[]
    },
    staleTime: 5 * 60_000,
  })
}
