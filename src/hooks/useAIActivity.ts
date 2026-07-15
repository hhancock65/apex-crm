import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import { playNotificationChime } from "@/lib/notification-sound"
import { toDateInputValue } from "@/lib/utils"
import type { AiActionType, AiEmployeeAction, AiEmployeeActionWithEmployee } from "@/types/ai-action"

const ACTION_EMPLOYEE_SELECT =
  "*, ai_employee:ai_employees!ai_employee_actions_ai_employee_id_fkey(id, name, role)"

export interface AiActivityFilters {
  aiEmployeeId: string | "all"
  actionType: AiActionType | "all"
  dateFrom: string
  dateTo: string
  page: number
  pageSize: number
}

export function getDefaultAiActivityFilters(): AiActivityFilters {
  return {
    aiEmployeeId: "all",
    actionType: "all",
    dateFrom: toDateInputValue(new Date()),
    dateTo: "",
    page: 1,
    pageSize: 25,
  }
}

export const aiActivityKeys = {
  all: ["ai-activity"] as const,
  lists: () => [...aiActivityKeys.all, "list"] as const,
  list: (filters: AiActivityFilters) => [...aiActivityKeys.lists(), filters] as const,
  stats: (scope: "today" | "all") => [...aiActivityKeys.all, "stats", scope] as const,
}

/**
 * The paginated feed. `refetchInterval` is a 10s belt-and-suspenders
 * fallback — useAIActivityRealtime() is the primary "live" mechanism and
 * triggers an immediate refetch on every INSERT, so in practice this timer
 * rarely does the work; it just guarantees the feed self-heals if the
 * realtime socket ever silently drops.
 */
export function useAIActivityFeed(filters: AiActivityFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: aiActivityKeys.list(filters),
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
    queryFn: async () => {
      let query = supabase.from("ai_employee_actions").select(ACTION_EMPLOYEE_SELECT, { count: "exact" })

      if (filters.aiEmployeeId !== "all") query = query.eq("ai_employee_id", filters.aiEmployeeId)
      if (filters.actionType !== "all") query = query.eq("action_type", filters.actionType)
      if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom)
      if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59.999`)

      query = query.order("created_at", { ascending: false })

      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      return {
        actions: (data ?? []) as AiEmployeeActionWithEmployee[],
        total: count ?? 0,
      }
    },
  })
}

export interface AiActivityStats {
  totalActions: number
  callsAnswered: number
  appointmentsBooked: number
  leadsCaptured: number
}

export function useAIActivityStats(scope: "today" | "all") {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: aiActivityKeys.stats(scope),
    refetchInterval: 10_000,
    queryFn: async (): Promise<AiActivityStats> => {
      const todayStart = toDateInputValue(new Date())

      let totalQuery = supabase.from("ai_employee_actions").select("id", { count: "exact", head: true })
      let callsQuery = supabase
        .from("ai_employee_actions")
        .select("id", { count: "exact", head: true })
        .eq("action_type", "call_answered")
      let appointmentsQuery = supabase
        .from("ai_employee_actions")
        .select("id", { count: "exact", head: true })
        .eq("action_type", "appointment_booked")
      let leadsQuery = supabase
        .from("ai_employee_actions")
        .select("id", { count: "exact", head: true })
        .eq("action_type", "lead_created")

      if (scope === "today") {
        totalQuery = totalQuery.gte("created_at", todayStart)
        callsQuery = callsQuery.gte("created_at", todayStart)
        appointmentsQuery = appointmentsQuery.gte("created_at", todayStart)
        leadsQuery = leadsQuery.gte("created_at", todayStart)
      }

      const [totalResult, callsResult, appointmentsResult, leadsResult] = await Promise.all([
        totalQuery,
        callsQuery,
        appointmentsQuery,
        leadsQuery,
      ])

      for (const result of [totalResult, callsResult, appointmentsResult, leadsResult]) {
        if (result.error) throw result.error
      }

      return {
        totalActions: totalResult.count ?? 0,
        callsAnswered: callsResult.count ?? 0,
        appointmentsBooked: appointmentsResult.count ?? 0,
        leadsCaptured: leadsResult.count ?? 0,
      }
    },
  })
}

export interface UseAIActivityRealtimeOptions {
  enabled?: boolean
  soundEnabled?: boolean
  onInsert?: (action: AiEmployeeAction) => void
}

/**
 * Subscribes to INSERTs on ai_employee_actions via Supabase Realtime.
 * Realtime broadcasts are filtered through the table's own RLS policies —
 * this client only ever receives rows its org would satisfy, same as any
 * other query, so no manual org_id filter is needed here.
 *
 * The raw payload has no joined ai_employee — callers don't get a fully
 * enriched row back, just a signal to invalidate/refetch, which is what
 * actually keeps pagination/counts consistent. `onInsert` is for anything
 * that wants the raw row too (e.g. flashing a "new" highlight once it shows
 * up in the refetched list).
 */
export function useAIActivityRealtime({
  enabled = true,
  soundEnabled = false,
  onInsert,
}: UseAIActivityRealtimeOptions = {}) {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  const onInsertRef = useRef(onInsert)
  onInsertRef.current = onInsert
  const soundEnabledRef = useRef(soundEnabled)
  soundEnabledRef.current = soundEnabled

  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel("ai_employee_actions_inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_employee_actions" },
        (payload) => {
          const row = payload.new as AiEmployeeAction

          queryClient.invalidateQueries({ queryKey: aiActivityKeys.lists() })
          queryClient.invalidateQueries({ queryKey: aiActivityKeys.all })

          if (soundEnabledRef.current && row.action_type === "appointment_booked") {
            playNotificationChime()
          }

          onInsertRef.current?.(row)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, enabled])
}
