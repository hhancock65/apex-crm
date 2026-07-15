import { useQuery } from "@tanstack/react-query"

import type { DateRange } from "@/lib/date-range"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import { matchDealsToLeadSource, type ContactPhoneEmail } from "@/lib/deal-attribution"
import type { LeadSource } from "@/types/lead"

export interface SalesKpis {
  totalRevenue: number
  dealsClosed: number
  averageDealSize: number
  winRate: number
  averageSalesCycleDays: number | null
}

export interface FunnelStage {
  stageId: string
  name: string
  count: number
  value: number
}

export interface RevenueTrendPoint {
  monthLabel: string
  monthKey: string
  revenue: number
}

export interface SourceRevenue {
  source: LeadSource | "direct"
  revenue: number
  dealCount: number
}

export interface LeaderboardEntry {
  key: string
  name: string
  type: "human" | "ai"
  dealsClosed: number
  revenue: number
}

export interface SalesAnalytics {
  kpis: SalesKpis
  funnel: FunnelStage[]
  revenueTrend: RevenueTrendPoint[]
  topSources: SourceRevenue[]
  leaderboard: LeaderboardEntry[]
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

export function useSalesAnalytics(range: DateRange, pipelineId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["sales-analytics", range.start.toISOString(), range.end.toISOString(), pipelineId],
    enabled: Boolean(pipelineId),
    queryFn: async (): Promise<SalesAnalytics> => {
      const startIso = range.start.toISOString()
      const endIso = range.end.toISOString()
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
      twelveMonthsAgo.setDate(1)
      twelveMonthsAgo.setHours(0, 0, 0, 0)

      const [
        outcomeDealsResult,
        openDealsResult,
        stagesResult,
        revenueTrendResult,
        leadsResult,
        contactsResult,
        profilesResult,
        aiEmployeesResult,
        opportunityActionsResult,
      ] = await Promise.all([
        // Deals whose OUTCOME (won or lost) landed inside the selected range.
        supabase
          .from("deals")
          .select("id, contact_id, value, status, assigned_to, created_at, won_at, lost_at")
          .or(
            `and(status.eq.won,won_at.gte.${startIso},won_at.lte.${endIso}),and(status.eq.lost,lost_at.gte.${startIso},lost_at.lte.${endIso})`
          ),
        // Current open pipeline snapshot for the funnel — deliberately NOT
        // date-range filtered (a funnel is "where is the pipeline right
        // now," not "what was created in this window").
        supabase.from("deals").select("id, stage_id, value").eq("pipeline_id", pipelineId!).eq("status", "open"),
        supabase.from("pipeline_stages").select("id, name, position").eq("pipeline_id", pipelineId!).order("position", { ascending: true }),
        supabase.from("deals").select("value, won_at").eq("status", "won").gte("won_at", twelveMonthsAgo.toISOString()),
        supabase.from("leads").select("id, phone, email, source"),
        supabase.from("contacts").select("id, phone, email"),
        supabase.from("profiles").select("id, first_name, last_name"),
        supabase.from("ai_employees").select("id, name"),
        supabase.from("ai_employee_actions").select("ai_employee_id, related_to_id").eq("action_type", "opportunity_created"),
      ])

      for (const result of [
        outcomeDealsResult,
        openDealsResult,
        stagesResult,
        revenueTrendResult,
        leadsResult,
        contactsResult,
        profilesResult,
        aiEmployeesResult,
        opportunityActionsResult,
      ]) {
        if (result.error) throw result.error
      }

      const outcomeDeals = (outcomeDealsResult.data ?? []) as {
        id: string
        contact_id: string | null
        value: number
        status: "open" | "won" | "lost"
        assigned_to: string | null
        created_at: string
        won_at: string | null
        lost_at: string | null
      }[]
      const wonDeals = outcomeDeals.filter((d) => d.status === "won")
      const lostDeals = outcomeDeals.filter((d) => d.status === "lost")

      // --- KPIs ---
      const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0)
      const dealsClosed = wonDeals.length
      const averageDealSize = dealsClosed > 0 ? totalRevenue / dealsClosed : 0
      const decidedCount = wonDeals.length + lostDeals.length
      const winRate = decidedCount > 0 ? (wonDeals.length / decidedCount) * 100 : 0
      const cycleDays = wonDeals
        .filter((d) => d.won_at)
        .map((d) => (new Date(d.won_at!).getTime() - new Date(d.created_at).getTime()) / 86_400_000)
      const averageSalesCycleDays = cycleDays.length > 0 ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : null

      // --- Funnel (current open snapshot by stage, + won-in-range as the final bar) ---
      const stages = (stagesResult.data ?? []) as { id: string; name: string; position: number }[]
      const openDeals = (openDealsResult.data ?? []) as { id: string; stage_id: string; value: number }[]
      const stagePositionById = new Map(stages.map((s) => [s.id, s.position]))
      const funnel: FunnelStage[] = stages.map((stage) => {
        const atOrPast = openDeals.filter((d) => (stagePositionById.get(d.stage_id) ?? -1) >= stage.position)
        return { stageId: stage.id, name: stage.name, count: atOrPast.length, value: atOrPast.reduce((s, d) => s + d.value, 0) }
      })
      funnel.push({
        stageId: "__won__",
        name: "Closed Won",
        count: wonDeals.length,
        value: totalRevenue,
      })

      // --- Revenue trend (fixed last 12 months) ---
      const trendDeals = (revenueTrendResult.data ?? []) as { value: number; won_at: string }[]
      const monthBuckets = new Map<string, number>()
      for (let i = 0; i < 12; i++) {
        const d = new Date(twelveMonthsAgo)
        d.setMonth(d.getMonth() + i)
        monthBuckets.set(monthKey(d), 0)
      }
      for (const deal of trendDeals) {
        const key = monthKey(new Date(deal.won_at))
        if (monthBuckets.has(key)) monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + deal.value)
      }
      const revenueTrend: RevenueTrendPoint[] = Array.from(monthBuckets.entries()).map(([key, revenue]) => {
        const [y, m] = key.split("-").map(Number)
        return { monthKey: key, monthLabel: monthLabel(new Date(y, m - 1, 1)), revenue }
      })

      // --- Top sources (won deals only, matched to any lead by phone/email) ---
      const contacts = (contactsResult.data ?? []) as ContactPhoneEmail[]
      const contactsById = new Map(contacts.map((c) => [c.id, c]))
      const leads = (leadsResult.data ?? []) as { id: string; phone: string | null; email: string | null; source: LeadSource }[]
      const sourceByDealId = matchDealsToLeadSource(wonDeals, contactsById, leads)
      const sourceTotals = new Map<LeadSource | "direct", { revenue: number; dealCount: number }>()
      for (const deal of wonDeals) {
        const source = sourceByDealId.get(deal.id) ?? "direct"
        const existing = sourceTotals.get(source) ?? { revenue: 0, dealCount: 0 }
        existing.revenue += deal.value
        existing.dealCount += 1
        sourceTotals.set(source, existing)
      }
      const topSources: SourceRevenue[] = Array.from(sourceTotals.entries())
        .map(([source, agg]) => ({ source, ...agg }))
        .sort((a, b) => b.revenue - a.revenue)

      // --- Leaderboard (won deals, attributed to the AI Employee that
      // created the opportunity if there's a hard link, else the assigned
      // human rep, else "Unassigned") ---
      const profiles = (profilesResult.data ?? []) as { id: string; first_name: string | null; last_name: string | null }[]
      const profileById = new Map(profiles.map((p) => [p.id, p]))
      const aiEmployees = (aiEmployeesResult.data ?? []) as { id: string; name: string }[]
      const aiEmployeeById = new Map(aiEmployees.map((e) => [e.id, e]))
      const opportunityActions = (opportunityActionsResult.data ?? []) as { ai_employee_id: string; related_to_id: string }[]
      const aiEmployeeIdByDealId = new Map(opportunityActions.map((a) => [a.related_to_id, a.ai_employee_id]))

      const leaderboardTotals = new Map<string, LeaderboardEntry>()
      for (const deal of wonDeals) {
        const aiEmployeeId = aiEmployeeIdByDealId.get(deal.id)
        let key: string
        let name: string
        let type: "human" | "ai"
        if (aiEmployeeId && aiEmployeeById.has(aiEmployeeId)) {
          key = `ai:${aiEmployeeId}`
          name = aiEmployeeById.get(aiEmployeeId)!.name
          type = "ai"
        } else if (deal.assigned_to && profileById.has(deal.assigned_to)) {
          const profile = profileById.get(deal.assigned_to)!
          key = `human:${deal.assigned_to}`
          name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unnamed"
          type = "human"
        } else {
          key = "unassigned"
          name = "Unassigned"
          type = "human"
        }

        const existing = leaderboardTotals.get(key) ?? { key, name, type, dealsClosed: 0, revenue: 0 }
        existing.dealsClosed += 1
        existing.revenue += deal.value
        leaderboardTotals.set(key, existing)
      }
      const leaderboard = Array.from(leaderboardTotals.values()).sort((a, b) => b.revenue - a.revenue)

      return {
        kpis: { totalRevenue, dealsClosed, averageDealSize, winRate, averageSalesCycleDays },
        funnel,
        revenueTrend,
        topSources,
        leaderboard,
      }
    },
    staleTime: 60_000,
  })
}
