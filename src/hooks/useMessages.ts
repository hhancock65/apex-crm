import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { AiEmployeeActionWithEmployee } from "@/types/ai-action"
import type { ContactSummary } from "@/types/contact"

const MESSAGE_ACTION_TYPES = ["sms_sent", "email_sent"] as const

const MESSAGE_ACTION_SELECT = `
  *,
  ai_employee:ai_employees!ai_employee_actions_ai_employee_id_fkey(id, name, role),
  contact:contacts!ai_employee_actions_contact_id_fkey(id, first_name, last_name, email, phone)
`

export interface MessageActionWithRelations extends AiEmployeeActionWithEmployee {
  contact: ContactSummary | null
}

export type MessageChannel = "sms" | "email"

export interface MessageFilters {
  channel: MessageChannel | "all"
  aiEmployeeId: string | "all"
  dateFrom: string
  dateTo: string
  page: number
  pageSize: number
}

export function getDefaultMessageFilters(): MessageFilters {
  return {
    channel: "all",
    aiEmployeeId: "all",
    dateFrom: "",
    dateTo: "",
    page: 1,
    pageSize: 25,
  }
}

export const messageKeys = {
  all: ["messages"] as const,
  lists: () => [...messageKeys.all, "list"] as const,
  list: (filters: MessageFilters) => [...messageKeys.lists(), filters] as const,
}

/** Drives MessagesPage — a log of every AI-sent SMS/email with its status,
 *  sourced from ai_employee_actions (sms_sent/email_sent), whose `result`
 *  column (success/pending/failed) is exactly the "status" the page needs.
 *  Full message content/threads live in ai_conversations and are shown on
 *  the existing Conversations page — this is deliberately the lighter
 *  "did it send" log, not a duplicate thread viewer. */
export function useMessages(filters: MessageFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: messageKeys.list(filters),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    queryFn: async () => {
      let query = supabase.from("ai_employee_actions").select(MESSAGE_ACTION_SELECT, { count: "exact" })

      if (filters.channel === "sms") query = query.eq("action_type", "sms_sent")
      else if (filters.channel === "email") query = query.eq("action_type", "email_sent")
      else query = query.in("action_type", MESSAGE_ACTION_TYPES)

      if (filters.aiEmployeeId !== "all") query = query.eq("ai_employee_id", filters.aiEmployeeId)
      if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom)
      if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59.999`)

      query = query.order("created_at", { ascending: false })

      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      return {
        messages: (data ?? []) as MessageActionWithRelations[],
        total: count ?? 0,
      }
    },
  })
}
