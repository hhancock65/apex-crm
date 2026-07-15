import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { AI_ACTION_ICONS, AI_ACTION_LABELS } from "@/components/ai-workforce/ai-action-meta"
import { Pagination } from "@/components/ui/pagination"
import { useAiEmployeeActions } from "@/hooks/useAiEmployees"
import { cn, formatDateTime } from "@/lib/utils"

const PAGE_SIZE = 25

const RELATED_PATHS: Record<string, string> = {
  lead: "/leads",
  contact: "/contacts",
  deal: "/deals",
}

export function AiEmployeeActionsTab({ employeeId }: { employeeId: string }) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching } = useAiEmployeeActions(employeeId, {
    page,
    pageSize: PAGE_SIZE,
  })

  const actions = data?.actions ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-slate-400">Loading actions…</p>
  }

  if (actions.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No actions logged yet.</p>
  }

  return (
    <div>
      <ul className={cn("space-y-4", isFetching && "opacity-60")}>
        {actions.map((action) => {
          const Icon = AI_ACTION_ICONS[action.action_type]
          const basePath = action.related_to_type ? RELATED_PATHS[action.related_to_type] : undefined
          const clickable = Boolean(basePath && action.related_to_id)

          return (
            <li key={action.id} className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="text-sm font-medium text-slate-800">
                    {AI_ACTION_LABELS[action.action_type]}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDateTime(action.created_at)}
                  </span>
                </div>
                {action.description && (
                  <p className="mt-0.5 text-sm text-slate-600">{action.description}</p>
                )}
                {clickable && (
                  <button
                    type="button"
                    onClick={() => navigate(`${basePath}/${action.related_to_id}`)}
                    className="mt-0.5 text-xs font-medium text-apex-teal hover:underline"
                  >
                    View {action.related_to_type} →
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
