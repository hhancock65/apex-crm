import { useMemo } from "react"
import { Link } from "react-router-dom"

import { AI_ACTION_ICONS, AI_ACTION_LABELS } from "@/components/ai-workforce/ai-action-meta"
import { AiEmployeeAvatar } from "@/components/ai-workforce/AiEmployeeAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAIActivityFeed, useAIActivityRealtime } from "@/hooks/useAIActivity"
import { cn, formatRelativeTime } from "@/lib/utils"

interface LiveAIActivityWidgetProps {
  /** How many recent actions to show. Defaults to 5 for the Dashboard; the AI Command Center passes 10. */
  limit?: number
}

export function LiveAIActivityWidget({ limit = 5 }: LiveAIActivityWidgetProps) {
  const filters = useMemo(
    () => ({
      aiEmployeeId: "all" as const,
      actionType: "all" as const,
      dateFrom: "",
      dateTo: "",
      page: 1,
      pageSize: limit,
    }),
    [limit]
  )

  const { data, isLoading } = useAIActivityFeed(filters)

  // Sound stays off here — a background widget shouldn't chime; that's
  // opt-in behavior scoped to the full AI Activity page.
  useAIActivityRealtime()

  const actions = data?.actions ?? []

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-apex-teal opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-apex-teal" />
          </span>
          <h2 className="text-sm font-semibold text-slate-800">Live AI Activity</h2>
        </div>
        <Link to="/ai-activity" className="text-xs font-medium text-apex-teal hover:underline">
          View all →
        </Link>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: Math.min(limit, 5) }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <Skeleton className="h-3.5 flex-1" />
              </div>
            ))}
          </div>
        ) : actions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No AI activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {actions.map((action) => {
              const Icon = AI_ACTION_ICONS[action.action_type]
              return (
                <li key={action.id} className="flex items-center gap-3">
                  {action.ai_employee ? (
                    <AiEmployeeAvatar role={action.ai_employee.role} />
                  ) : (
                    <div className="h-7 w-7 shrink-0 rounded-full bg-slate-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("truncate text-sm font-medium text-slate-800")}>
                        {action.ai_employee?.name ?? "Unknown"}
                      </span>
                      <Icon className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="truncate text-sm text-slate-500">
                        {AI_ACTION_LABELS[action.action_type]}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatRelativeTime(action.created_at)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
