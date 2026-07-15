import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { AiEmployeeAction } from "@/types/ai-action"
import type {
  AiConversationWithRelations,
  ConversationChannel,
  ConversationStatus,
} from "@/types/conversation"

const CONVERSATION_RELATIONS_SELECT = `
  *,
  contact:contacts!ai_conversations_contact_id_fkey(id, first_name, last_name, email, phone),
  ai_employee:ai_employees!ai_conversations_ai_employee_id_fkey(id, name, role)
`

export type ConversationSortColumn = "started_at"

export interface ConversationFilters {
  aiEmployeeId: string | "all"
  channel: ConversationChannel | "all"
  status: ConversationStatus | "all"
  dateFrom: string
  dateTo: string
  page: number
  pageSize: number
  sortDir: "asc" | "desc"
}

export const DEFAULT_CONVERSATION_FILTERS: ConversationFilters = {
  aiEmployeeId: "all",
  channel: "all",
  status: "all",
  dateFrom: "",
  dateTo: "",
  page: 1,
  pageSize: 25,
  sortDir: "desc",
}

export const conversationKeys = {
  all: ["conversations"] as const,
  lists: () => [...conversationKeys.all, "list"] as const,
  list: (filters: ConversationFilters) => [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, "detail"] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
}

export function useConversations(filters: ConversationFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: conversationKeys.list(filters),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("ai_conversations")
        .select(CONVERSATION_RELATIONS_SELECT, { count: "exact" })

      if (filters.aiEmployeeId !== "all") query = query.eq("ai_employee_id", filters.aiEmployeeId)
      if (filters.channel !== "all") query = query.eq("channel", filters.channel)
      if (filters.status !== "all") query = query.eq("status", filters.status)
      if (filters.dateFrom) query = query.gte("started_at", filters.dateFrom)
      if (filters.dateTo) query = query.lte("started_at", `${filters.dateTo}T23:59:59.999`)

      query = query.order("started_at", { ascending: filters.sortDir === "asc" })

      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      return {
        conversations: (data ?? []) as AiConversationWithRelations[],
        total: count ?? 0,
      }
    },
  })
}

export function useConversation(id: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: conversationKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select(CONVERSATION_RELATIONS_SELECT)
        .eq("id", id!)
        .single()
      if (error) throw error
      return data as AiConversationWithRelations
    },
  })
}

/** All conversations with one contact — used by ContactConversationsTab. Small enough per-contact to skip pagination. */
export function useContactConversations(contactId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["contact-conversations", contactId],
    enabled: Boolean(contactId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select(CONVERSATION_RELATIONS_SELECT)
        .eq("contact_id", contactId!)
        .order("started_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as AiConversationWithRelations[]
    },
  })
}

/** All AI actions involving one contact (via ai_employee_actions.contact_id) — used by ContactConversationsTab. */
export function useContactAiActions(contactId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["contact-ai-actions", contactId],
    enabled: Boolean(contactId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_employee_actions")
        .select("*, ai_employee:ai_employees!ai_employee_actions_ai_employee_id_fkey(id, name, role)")
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as (AiEmployeeAction & {
        ai_employee: { id: string; name: string; role: string } | null
      })[]
    },
  })
}
