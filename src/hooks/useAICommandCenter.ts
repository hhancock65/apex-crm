import { useQuery } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import { toDateInputValue } from "@/lib/utils"

const REFETCH_INTERVAL_MS = 30_000

function dayRange(offsetDays: number) {
  const start = new Date()
  start.setDate(start.getDate() + offsetDays)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: toDateInputValue(start), end: toDateInputValue(end) }
}

export interface AICommandCenterMetrics {
  callsToday: number
  callsYesterday: number
  appointmentsToday: number
  appointmentsYesterday: number
  leadsToday: number
  leadsYesterday: number
}

/**
 * Today-vs-yesterday counts for the three trend cards, sourced from
 * ai_employee_actions (same source of truth as the AI Activity page) — 6
 * lean head-only count queries in parallel, not full row fetches.
 */
export function useAICommandCenterMetrics() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["ai-command-center", "metrics"],
    refetchInterval: REFETCH_INTERVAL_MS,
    queryFn: async (): Promise<AICommandCenterMetrics> => {
      const today = dayRange(0)
      const yesterday = dayRange(-1)

      const countFor = (actionType: string, range: { start: string; end: string }) =>
        supabase
          .from("ai_employee_actions")
          .select("id", { count: "exact", head: true })
          .eq("action_type", actionType)
          .gte("created_at", range.start)
          .lt("created_at", range.end)

      const [
        callsTodayResult,
        callsYesterdayResult,
        appointmentsTodayResult,
        appointmentsYesterdayResult,
        leadsTodayResult,
        leadsYesterdayResult,
      ] = await Promise.all([
        countFor("call_answered", today),
        countFor("call_answered", yesterday),
        countFor("appointment_booked", today),
        countFor("appointment_booked", yesterday),
        countFor("lead_created", today),
        countFor("lead_created", yesterday),
      ])

      for (const result of [
        callsTodayResult,
        callsYesterdayResult,
        appointmentsTodayResult,
        appointmentsYesterdayResult,
        leadsTodayResult,
        leadsYesterdayResult,
      ]) {
        if (result.error) throw result.error
      }

      return {
        callsToday: callsTodayResult.count ?? 0,
        callsYesterday: callsYesterdayResult.count ?? 0,
        appointmentsToday: appointmentsTodayResult.count ?? 0,
        appointmentsYesterday: appointmentsYesterdayResult.count ?? 0,
        leadsToday: leadsTodayResult.count ?? 0,
        leadsYesterday: leadsYesterdayResult.count ?? 0,
      }
    },
  })
}

export interface AIPerformanceThisMonth {
  callsAnswered: number
  leadsCaptured: number
  appointmentsBooked: number
  followUpsCompleted: number
  warmTransfers: number
  pipelineCreated: number
}

function startOfMonth(): string {
  const now = new Date()
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1))
}

/**
 * "Pipeline Created" is deliberately not "all deals created this month" —
 * that would misattribute human-created deals to the AI Workforce. It's the
 * sum of deals.value for deals an AI Employee actually opened, found via
 * ai_employee_actions(action_type='opportunity_created', related_to_type=
 * 'deal') this month. Nothing in the app inserts that action yet (no shipped
 * flow creates deals from AI actions), so this will legitimately read $0
 * until that integration exists — showing a fabricated number here would be
 * worse than an honest zero.
 */
export function useAIPerformanceThisMonth() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["ai-command-center", "performance-this-month"],
    refetchInterval: REFETCH_INTERVAL_MS,
    queryFn: async (): Promise<AIPerformanceThisMonth> => {
      const monthStart = startOfMonth()

      const countSince = (actionType: string) =>
        supabase
          .from("ai_employee_actions")
          .select("id", { count: "exact", head: true })
          .eq("action_type", actionType)
          .gte("created_at", monthStart)

      const [
        callsResult,
        leadsResult,
        appointmentsResult,
        followUpsResult,
        transfersResult,
        opportunityActionsResult,
      ] = await Promise.all([
        countSince("call_answered"),
        countSince("lead_created"),
        countSince("appointment_booked"),
        countSince("follow_up_sent"),
        countSince("call_transferred"),
        supabase
          .from("ai_employee_actions")
          .select("related_to_id")
          .eq("action_type", "opportunity_created")
          .eq("related_to_type", "deal")
          .gte("created_at", monthStart),
      ])

      for (const result of [
        callsResult,
        leadsResult,
        appointmentsResult,
        followUpsResult,
        transfersResult,
        opportunityActionsResult,
      ]) {
        if (result.error) throw result.error
      }

      const dealIds = (opportunityActionsResult.data ?? [])
        .map((row) => row.related_to_id as string | null)
        .filter((id): id is string => Boolean(id))

      let pipelineCreated = 0
      if (dealIds.length > 0) {
        const { data: deals, error: dealsError } = await supabase
          .from("deals")
          .select("value")
          .in("id", dealIds)
        if (dealsError) throw dealsError
        pipelineCreated = (deals ?? []).reduce((sum, deal) => sum + (deal.value as number), 0)
      }

      return {
        callsAnswered: callsResult.count ?? 0,
        leadsCaptured: leadsResult.count ?? 0,
        appointmentsBooked: appointmentsResult.count ?? 0,
        followUpsCompleted: followUpsResult.count ?? 0,
        warmTransfers: transfersResult.count ?? 0,
        pipelineCreated,
      }
    },
  })
}
