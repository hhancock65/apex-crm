import { useQuery } from "@tanstack/react-query"

import { AI_ACTION_ICONS, AI_ACTION_LABELS } from "@/components/ai-workforce/ai-action-meta"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import { formatRelativeTime } from "@/lib/utils"
import { CALL_OUTCOMES, type CallOutcome } from "@/types/call"

const OUTCOME_LABELS: Record<CallOutcome, string> = {
  qualified: "Qualified",
  unqualified: "Unqualified",
  appointment_booked: "Appointment Booked",
  transfer: "Transferred",
  voicemail: "Voicemail",
  info_request: "Info Request",
  spam: "Spam",
}

const OUTCOME_BAR_COLOR: Record<CallOutcome, string> = {
  qualified: "bg-green-500",
  unqualified: "bg-slate-400",
  appointment_booked: "bg-teal-500",
  transfer: "bg-blue-500",
  voicemail: "bg-slate-400",
  info_request: "bg-purple-500",
  spam: "bg-red-500",
}

interface AiEmployeeOverviewTabProps {
  employeeId: string
}

export function AiEmployeeOverviewTab({ employeeId }: AiEmployeeOverviewTabProps) {
  const supabase = useSupabaseClient()

  const { data: recentActions, isLoading: actionsLoading } = useQuery({
    queryKey: ["ai-employees", "actions", employeeId, "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_employee_actions")
        .select("*")
        .eq("ai_employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    },
  })

  const { data: outcomeCounts, isLoading: outcomesLoading } = useQuery({
    queryKey: ["ai-employees", "call-outcomes", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("outcome")
        .eq("ai_employee_id", employeeId)
        .not("outcome", "is", null)
      if (error) throw error

      const rows = (data ?? []) as { outcome: CallOutcome }[]
      const counts = new Map<CallOutcome, number>()
      for (const row of rows) counts.set(row.outcome, (counts.get(row.outcome) ?? 0) + 1)
      return { counts, total: rows.length }
    },
  })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
        {actionsLoading ? (
          <p className="mt-3 text-sm text-slate-400">Loading…</p>
        ) : !recentActions || recentActions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No activity yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recentActions.map((action) => {
              const Icon = AI_ACTION_ICONS[action.action_type as keyof typeof AI_ACTION_ICONS]
              return (
                <li key={action.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="text-sm font-medium text-slate-800">
                        {AI_ACTION_LABELS[action.action_type as keyof typeof AI_ACTION_LABELS]}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatRelativeTime(action.created_at)}
                      </span>
                    </div>
                    {action.description && (
                      <p className="mt-0.5 text-sm text-slate-600">{action.description}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">Call Outcomes</h3>
        {outcomesLoading ? (
          <p className="mt-3 text-sm text-slate-400">Loading…</p>
        ) : !outcomeCounts || outcomeCounts.total === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No completed calls yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {CALL_OUTCOMES.filter((outcome) => (outcomeCounts.counts.get(outcome) ?? 0) > 0).map(
              (outcome) => {
                const count = outcomeCounts.counts.get(outcome) ?? 0
                const percentage = (count / outcomeCounts.total) * 100
                return (
                  <div key={outcome}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{OUTCOME_LABELS[outcome]}</span>
                      <span className="text-slate-500">
                        {count} · {Math.round(percentage)}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${OUTCOME_BAR_COLOR[outcome]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              }
            )}
          </div>
        )}
      </div>
    </div>
  )
}
