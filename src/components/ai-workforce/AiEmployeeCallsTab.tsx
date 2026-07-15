import { useState } from "react"

import { CallOutcomeBadge } from "@/components/ai-workforce/CallOutcomeBadge"
import { CallSentimentIcon } from "@/components/ai-workforce/CallSentimentIcon"
import { Pagination } from "@/components/ui/pagination"
import { useAiEmployeeCalls } from "@/hooks/useAiEmployees"
import { cn, formatDateTime } from "@/lib/utils"
import { contactFullName } from "@/types/contact"
import { formatCallDuration } from "@/types/call"

const PAGE_SIZE = 25

export function AiEmployeeCallsTab({ employeeId }: { employeeId: string }) {
  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching } = useAiEmployeeCalls(employeeId, {
    page,
    pageSize: PAGE_SIZE,
  })

  const calls = data?.calls ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-slate-400">Loading calls…</p>
  }

  if (calls.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No calls yet.</p>
  }

  return (
    <div>
      <ul className={cn("divide-y divide-slate-100", isFetching && "opacity-60")}>
        {calls.map((call) => (
          <li key={call.id} className="flex items-start justify-between gap-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <CallSentimentIcon sentiment={call.sentiment} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {call.contact ? contactFullName(call.contact) : call.caller_phone ?? "Unknown caller"}
                </p>
                {call.summary && (
                  <p className="mt-0.5 truncate text-sm text-slate-500">{call.summary}</p>
                )}
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatDateTime(call.started_at)} · {formatCallDuration(call.duration_seconds)}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <CallOutcomeBadge outcome={call.outcome} />
            </div>
          </li>
        ))}
      </ul>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
