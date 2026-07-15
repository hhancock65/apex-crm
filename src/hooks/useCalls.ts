import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { AiEmployeeAction } from "@/types/ai-action"
import type {
  CallDirection,
  CallOutcome,
  CallSentiment,
  CallWithRelations,
} from "@/types/call"
import type { CallTranscript } from "@/types/call-transcript"

const CALL_RELATIONS_SELECT = `
  *,
  contact:contacts!calls_contact_id_fkey(id, first_name, last_name, email, phone),
  ai_employee:ai_employees!calls_ai_employee_id_fkey(id, name, role)
`

export type CallSortColumn = "started_at" | "duration_seconds"

export interface CallFilters {
  aiEmployeeId: string | "all"
  direction: CallDirection | "all"
  outcome: CallOutcome | "all"
  sentiment: CallSentiment | "all"
  dateFrom: string
  dateTo: string
  page: number
  pageSize: number
  sortBy: CallSortColumn
  sortDir: "asc" | "desc"
}

export const DEFAULT_CALL_FILTERS: CallFilters = {
  aiEmployeeId: "all",
  direction: "all",
  outcome: "all",
  sentiment: "all",
  dateFrom: "",
  dateTo: "",
  page: 1,
  pageSize: 25,
  sortBy: "started_at",
  sortDir: "desc",
}

export const callKeys = {
  all: ["calls"] as const,
  lists: () => [...callKeys.all, "list"] as const,
  list: (filters: CallFilters) => [...callKeys.lists(), filters] as const,
  details: () => [...callKeys.all, "detail"] as const,
  detail: (id: string) => [...callKeys.details(), id] as const,
}

export interface UseCallsOptions {
  refetchInterval?: number
}

export function useCalls(filters: CallFilters, options: UseCallsOptions = {}) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: callKeys.list(filters),
    placeholderData: keepPreviousData,
    refetchInterval: options.refetchInterval,
    queryFn: async () => {
      let query = supabase.from("calls").select(CALL_RELATIONS_SELECT, { count: "exact" })

      if (filters.aiEmployeeId !== "all") query = query.eq("ai_employee_id", filters.aiEmployeeId)
      if (filters.direction !== "all") query = query.eq("direction", filters.direction)
      if (filters.outcome !== "all") query = query.eq("outcome", filters.outcome)
      if (filters.sentiment !== "all") query = query.eq("sentiment", filters.sentiment)
      if (filters.dateFrom) query = query.gte("started_at", filters.dateFrom)
      if (filters.dateTo) query = query.lte("started_at", `${filters.dateTo}T23:59:59.999`)

      query = query.order(filters.sortBy, {
        ascending: filters.sortDir === "asc",
        nullsFirst: false,
      })

      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      return {
        calls: (data ?? []) as CallWithRelations[],
        total: count ?? 0,
      }
    },
  })
}

export function useCall(id: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: callKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const [callResult, transcriptResult, actionsResult] = await Promise.all([
        supabase.from("calls").select(CALL_RELATIONS_SELECT).eq("id", id!).single(),
        supabase.from("call_transcripts").select("*").eq("call_id", id!).maybeSingle(),
        supabase
          .from("ai_employee_actions")
          .select("*")
          .eq("related_to_type", "call")
          .eq("related_to_id", id!)
          .order("created_at", { ascending: true }),
      ])

      if (callResult.error) throw callResult.error
      if (transcriptResult.error) throw transcriptResult.error
      if (actionsResult.error) throw actionsResult.error

      return {
        call: callResult.data as CallWithRelations,
        transcript: transcriptResult.data as CallTranscript | null,
        actions: (actionsResult.data ?? []) as AiEmployeeAction[],
      }
    },
  })
}

export function useLinkCallToContact() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ callId, contactId }: { callId: string; contactId: string }) => {
      const { data, error } = await supabase
        .from("calls")
        .update({ contact_id: contactId })
        .eq("id", callId)
        .select(CALL_RELATIONS_SELECT)
        .single()
      if (error) throw error
      return data as CallWithRelations
    },
    onSuccess: (call) => {
      queryClient.invalidateQueries({ queryKey: callKeys.lists() })
      queryClient.invalidateQueries({ queryKey: callKeys.detail(call.id) })
    },
  })
}
