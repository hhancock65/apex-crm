import { useQuery } from "@tanstack/react-query"

import { previousPeriod, type DateRange } from "@/lib/date-range"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { CallOutcome, CallSentiment } from "@/types/call"

export interface AIPerformanceKpis {
  totalCalls: number
  leadsCaptured: number
  appointmentsBooked: number
  pipelineCreated: number
  followUpsCompleted: number
  /** Avg seconds between a missed call ending and its automatic follow-up
   *  SMS being sent — the only "response time" signal this schema actually
   *  captures (no generic first-response timestamp exists). `null` when
   *  there's nothing to measure in the range, shown as "Not enough data"
   *  rather than a fabricated number. */
  avgResponseTimeSeconds: number | null
}

export interface EmployeePerformanceRow {
  employeeId: string
  name: string
  calls: number
  leads: number
  appointments: number
  conversionRate: number
  avgCallDurationSeconds: number | null
}

export interface OutcomeBreakdownEntry {
  outcome: CallOutcome | "none"
  count: number
}

export interface SentimentBreakdownEntry {
  sentiment: CallSentiment | "none"
  count: number
}

export interface HourlyCallVolume {
  hour: number
  count: number
}

export interface AIPerformanceAnalytics {
  kpis: AIPerformanceKpis
  previousKpis: AIPerformanceKpis
  perEmployee: EmployeePerformanceRow[]
  outcomeBreakdown: OutcomeBreakdownEntry[]
  sentimentBreakdown: SentimentBreakdownEntry[]
  busiestHours: HourlyCallVolume[]
}

interface CallRow {
  id: string
  ai_employee_id: string | null
  status: string
  outcome: CallOutcome | null
  sentiment: CallSentiment | null
  duration_seconds: number | null
  started_at: string
  ended_at: string | null
}

interface ActionRow {
  ai_employee_id: string
  action_type: string
  related_to_type: string | null
  related_to_id: string | null
  created_at: string
}

async function fetchKpis(
  supabase: ReturnType<typeof useSupabaseClient>,
  startIso: string,
  endIso: string
): Promise<{ kpis: AIPerformanceKpis; calls: CallRow[]; actions: ActionRow[] }> {
  const [callsResult, leadsResult, appointmentsResult, followUpsResult, opportunityActionsResult, actionsResult] =
    await Promise.all([
      supabase
        .from("calls")
        .select("id, ai_employee_id, status, outcome, sentiment, duration_seconds, started_at, ended_at")
        .not("ai_employee_id", "is", null)
        .gte("started_at", startIso)
        .lte("started_at", endIso),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("source", "ai_employee")
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("created_by_ai", true)
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabase
        .from("ai_employee_actions")
        .select("id", { count: "exact", head: true })
        .eq("action_type", "follow_up_sent")
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      // related_to_id is a plain uuid, not a real foreign key (it's
      // polymorphic — see migration 0002's comment on this column) — so
      // PostgREST can't do an embedded join here. Two-step lookup instead:
      // the deal ids an AI Employee directly created via opportunity_created,
      // then those deals' values.
      supabase
        .from("ai_employee_actions")
        .select("related_to_id")
        .eq("action_type", "opportunity_created")
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabase
        .from("ai_employee_actions")
        .select("ai_employee_id, action_type, related_to_type, related_to_id, created_at")
        .gte("created_at", startIso)
        .lte("created_at", endIso),
    ])

  for (const result of [callsResult, leadsResult, appointmentsResult, followUpsResult, opportunityActionsResult, actionsResult]) {
    if (result.error) throw result.error
  }

  const calls = (callsResult.data ?? []) as CallRow[]
  const actions = (actionsResult.data ?? []) as ActionRow[]

  // pipeline created ($) — sum of deal value for deals with a hard
  // opportunity_created link created in range.
  let pipelineCreated = 0
  const opportunityDealIds = ((opportunityActionsResult.data ?? []) as { related_to_id: string | null }[])
    .map((row) => row.related_to_id)
    .filter((id): id is string => id !== null)
  if (opportunityDealIds.length > 0) {
    const { data: opportunityDeals, error: dealsError } = await supabase
      .from("deals")
      .select("value")
      .in("id", opportunityDealIds)
    if (dealsError) throw dealsError
    pipelineCreated = ((opportunityDeals ?? []) as { value: number }[]).reduce((sum, d) => sum + d.value, 0)
  }

  const missedCalls = calls.filter((c) => c.status === "missed" && c.ended_at)
  const smsAfterMissedCall = actions.filter((a) => a.action_type === "sms_sent" && a.related_to_type === "call")
  const responseTimes: number[] = []
  for (const call of missedCalls) {
    const followUp = smsAfterMissedCall.find((a) => a.related_to_id === call.id)
    if (followUp) {
      const seconds = (new Date(followUp.created_at).getTime() - new Date(call.ended_at!).getTime()) / 1000
      if (seconds >= 0) responseTimes.push(seconds)
    }
  }
  const avgResponseTimeSeconds =
    responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : null

  const kpis: AIPerformanceKpis = {
    totalCalls: calls.length,
    leadsCaptured: leadsResult.count ?? 0,
    appointmentsBooked: appointmentsResult.count ?? 0,
    pipelineCreated,
    followUpsCompleted: followUpsResult.count ?? 0,
    avgResponseTimeSeconds,
  }

  return { kpis, calls, actions }
}

export function useAIPerformanceAnalytics(range: DateRange) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["ai-performance-analytics", range.start.toISOString(), range.end.toISOString()],
    queryFn: async (): Promise<AIPerformanceAnalytics> => {
      const startIso = range.start.toISOString()
      const endIso = range.end.toISOString()
      const prev = previousPeriod(range)

      const [{ kpis, calls, actions }, { kpis: previousKpis }, employeesResult] = await Promise.all([
        fetchKpis(supabase, startIso, endIso),
        fetchKpis(supabase, prev.start.toISOString(), prev.end.toISOString()),
        supabase.from("ai_employees").select("id, name"),
      ])
      if (employeesResult.error) throw employeesResult.error

      const employees = (employeesResult.data ?? []) as { id: string; name: string }[]

      const callsByEmployee = new Map<string, CallRow[]>()
      for (const call of calls) {
        if (!call.ai_employee_id) continue
        const list = callsByEmployee.get(call.ai_employee_id) ?? []
        list.push(call)
        callsByEmployee.set(call.ai_employee_id, list)
      }
      const leadsCountByEmployee = new Map<string, number>()
      const appointmentsCountByEmployee = new Map<string, number>()
      for (const action of actions) {
        if (action.action_type === "lead_created") {
          leadsCountByEmployee.set(action.ai_employee_id, (leadsCountByEmployee.get(action.ai_employee_id) ?? 0) + 1)
        } else if (action.action_type === "appointment_booked") {
          appointmentsCountByEmployee.set(
            action.ai_employee_id,
            (appointmentsCountByEmployee.get(action.ai_employee_id) ?? 0) + 1
          )
        }
      }

      const perEmployee: EmployeePerformanceRow[] = employees
        .map((employee) => {
          const employeeCalls = callsByEmployee.get(employee.id) ?? []
          const appointments = appointmentsCountByEmployee.get(employee.id) ?? 0
          const durations = employeeCalls.map((c) => c.duration_seconds).filter((d): d is number => d !== null)
          return {
            employeeId: employee.id,
            name: employee.name,
            calls: employeeCalls.length,
            leads: leadsCountByEmployee.get(employee.id) ?? 0,
            appointments,
            conversionRate: employeeCalls.length > 0 ? (appointments / employeeCalls.length) * 100 : 0,
            avgCallDurationSeconds:
              durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
          }
        })
        .filter((row) => row.calls > 0 || row.leads > 0 || row.appointments > 0)
        .sort((a, b) => b.calls - a.calls)

      const outcomeCounts = new Map<CallOutcome | "none", number>()
      for (const call of calls) {
        const key = call.outcome ?? "none"
        outcomeCounts.set(key, (outcomeCounts.get(key) ?? 0) + 1)
      }
      const outcomeBreakdown = Array.from(outcomeCounts.entries())
        .map(([outcome, count]) => ({ outcome, count }))
        .filter((e) => e.outcome !== "none")
        .sort((a, b) => b.count - a.count)

      const sentimentCounts = new Map<CallSentiment | "none", number>()
      for (const call of calls) {
        const key = call.sentiment ?? "none"
        sentimentCounts.set(key, (sentimentCounts.get(key) ?? 0) + 1)
      }
      const sentimentBreakdown = Array.from(sentimentCounts.entries())
        .map(([sentiment, count]) => ({ sentiment, count }))
        .filter((e) => e.sentiment !== "none")

      const hourCounts = new Array<number>(24).fill(0)
      for (const call of calls) {
        hourCounts[new Date(call.started_at).getUTCHours()] += 1
      }
      const busiestHours: HourlyCallVolume[] = hourCounts.map((count, hour) => ({ hour, count }))

      return { kpis, previousKpis, perEmployee, outcomeBreakdown, sentimentBreakdown, busiestHours }
    },
    staleTime: 60_000,
  })
}
