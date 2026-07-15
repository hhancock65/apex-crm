import { useQuery } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"

export interface SmsTemplate {
  id: string
  name: string
  content: string
  category: string | null
}

/** Powers the Send SMS step's template picker in the workflow builder. */
export function useSmsTemplates() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_templates")
        .select("id, name, content, category")
        .order("name", { ascending: true })
      if (error) throw error
      return data as SmsTemplate[]
    },
    staleTime: 5 * 60_000,
  })
}
