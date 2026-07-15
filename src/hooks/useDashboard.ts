import { useQuery } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import { toDateInputValue } from "@/lib/utils"
import type { ActivityWithAuthor } from "@/types/activity"
import { LEAD_SOURCES, type LeadSource } from "@/types/lead"

const ACTIVITY_AUTHOR_SELECT =
  "*, author:profiles!activities_performed_by_fkey(id, first_name, last_name, email)"

export interface DashboardMetrics {
  totalActiveLeads: number
  leadsDelta30d: number
  openDealsCount: number
  openDealsValue: number
  appointmentsToday: number
  tasksOverdue: number
  tasksDueToday: number
}

/**
 * The 4 top-row metric cards, fetched as lean count/aggregate-only queries
 * (Supabase `head: true` for pure counts) run concurrently via Promise.all —
 * none of these need full row payloads, just numbers.
 */
export function useDashboardMetrics() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["dashboard", "metrics"],
    queryFn: async (): Promise<DashboardMetrics> => {
      const now = new Date()
      const todayStart = toDateInputValue(now)
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const todayEnd = toDateInputValue(tomorrow)

      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const sixtyDaysAgo = new Date(now)
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      const [
        totalActiveLeadsResult,
        leadsLast30Result,
        leadsPrev30Result,
        openDealsResult,
        appointmentsTodayResult,
        tasksDueResult,
      ] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).neq("status", "converted"),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .neq("status", "converted")
          .gte("created_at", thirtyDaysAgo.toISOString()),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .neq("status", "converted")
          .gte("created_at", sixtyDaysAgo.toISOString())
          .lt("created_at", thirtyDaysAgo.toISOString()),
        supabase.from("deals").select("value").eq("status", "open"),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .gte("start_time", todayStart)
          .lt("start_time", todayEnd),
        supabase
          .from("tasks")
          .select("due_date")
          .in("status", ["pending", "in_progress"])
          .not("due_date", "is", null)
          .lt("due_date", todayEnd),
      ])

      for (const result of [
        totalActiveLeadsResult,
        leadsLast30Result,
        leadsPrev30Result,
        openDealsResult,
        appointmentsTodayResult,
        tasksDueResult,
      ]) {
        if (result.error) throw result.error
      }

      const openDeals = (openDealsResult.data ?? []) as { value: number }[]
      const openDealsValue = openDeals.reduce((sum, deal) => sum + deal.value, 0)

      const todayStartDate = new Date(`${todayStart}T00:00:00`)
      const taskRows = (tasksDueResult.data ?? []) as { due_date: string }[]
      const tasksOverdue = taskRows.filter((t) => new Date(t.due_date) < todayStartDate).length
      const tasksDueToday = taskRows.length - tasksOverdue

      return {
        totalActiveLeads: totalActiveLeadsResult.count ?? 0,
        leadsDelta30d: (leadsLast30Result.count ?? 0) - (leadsPrev30Result.count ?? 0),
        openDealsCount: openDeals.length,
        openDealsValue,
        appointmentsToday: appointmentsTodayResult.count ?? 0,
        tasksOverdue,
        tasksDueToday,
      }
    },
    staleTime: 60_000,
  })
}

export interface LeadSourceBreakdown {
  source: LeadSource
  count: number
  percentage: number
}

/** Lean single-column fetch — grouped client-side since it's just a count-by-source rollup. */
export function useLeadSourceBreakdown() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["dashboard", "lead-sources"],
    queryFn: async (): Promise<LeadSourceBreakdown[]> => {
      const { data, error } = await supabase.from("leads").select("source")
      if (error) throw error

      const rows = (data ?? []) as { source: LeadSource }[]
      const total = rows.length

      const counts = new Map<LeadSource, number>()
      for (const row of rows) {
        counts.set(row.source, (counts.get(row.source) ?? 0) + 1)
      }

      return LEAD_SOURCES.map((source) => {
        const count = counts.get(source) ?? 0
        return {
          source,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        }
      }).filter((entry) => entry.count > 0)
    },
    staleTime: 60_000,
  })
}

export interface StageDealAggregate {
  count: number
  totalValue: number
}

/** Lean {stage_id, value} fetch for one pipeline — grouped client-side for the mini bar chart. */
export function useDealValuesByStage(pipelineId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["dashboard", "deal-values-by-stage", pipelineId],
    enabled: Boolean(pipelineId),
    queryFn: async (): Promise<Record<string, StageDealAggregate>> => {
      const { data, error } = await supabase
        .from("deals")
        .select("stage_id, value")
        .eq("pipeline_id", pipelineId!)
        .eq("status", "open")
      if (error) throw error

      const rows = (data ?? []) as { stage_id: string; value: number }[]
      const byStage: Record<string, StageDealAggregate> = {}
      for (const row of rows) {
        const existing = byStage[row.stage_id] ?? { count: 0, totalValue: 0 }
        existing.count += 1
        existing.totalValue += row.value
        byStage[row.stage_id] = existing
      }
      return byStage
    },
    staleTime: 60_000,
  })
}

/** Last N activities org-wide (not scoped to a single record) — powers the dashboard's Recent Activity feed. */
export function useRecentActivities(limit = 20) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["dashboard", "recent-activities", limit],
    queryFn: async (): Promise<ActivityWithAuthor[]> => {
      const { data, error } = await supabase
        .from("activities")
        .select(ACTIVITY_AUTHOR_SELECT)
        .order("created_at", { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as ActivityWithAuthor[]
    },
    staleTime: 30_000,
  })
}
