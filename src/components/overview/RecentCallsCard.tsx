import { useNavigate } from "react-router-dom"

import { CallOutcomeBadge } from "@/components/ai-workforce/CallOutcomeBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCallDuration, type CallWithRelations } from "@/types/call"
import { contactFullName } from "@/types/contact"
import { formatDateTime } from "@/lib/utils"

interface RecentCallsCardProps {
  calls: CallWithRelations[]
  isLoading: boolean
}

export function RecentCallsCard({ calls, isLoading }: RecentCallsCardProps) {
  const navigate = useNavigate()

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">Recent Calls</h2>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : calls.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No calls yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {calls.map((call) => (
              <li key={call.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/calls/${call.id}`)}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {call.contact ? contactFullName(call.contact) : call.caller_phone ?? "Unknown"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {call.ai_employee?.name ?? "—"} · {formatCallDuration(call.duration_seconds)} ·{" "}
                      {formatDateTime(call.started_at)}
                    </p>
                  </div>
                  <CallOutcomeBadge outcome={call.outcome} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
