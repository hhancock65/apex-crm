import { useQuery } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { CompanySummary } from "@/types/company"

/** All companies in the caller's org — for company pickers. RLS on `companies` already scopes this. */
export function useCompanies() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["companies", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name", { ascending: true })
      if (error) throw error
      return data as CompanySummary[]
    },
    staleTime: 60_000,
  })
}
