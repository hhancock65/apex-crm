import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { CreateWorkflowDialog } from "@/components/automation/CreateWorkflowDialog"
import { TemplatesDialog } from "@/components/automation/TemplatesDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getDefaultWorkflowFilters, useUpdateWorkflow, useWorkflows } from "@/hooks/useWorkflows"
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils"
import {
  WORKFLOW_STATUSES,
  WORKFLOW_TRIGGER_LABELS,
  type Workflow,
  type WorkflowStatus,
} from "@/types/workflow"

const STATUS_LABELS: Record<WorkflowStatus, string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
}

const STATUS_BADGE_CLASSES: Record<WorkflowStatus, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  paused: "border-slate-200 bg-slate-50 text-slate-600",
  draft: "border-amber-200 bg-amber-50 text-amber-700",
}

function WorkflowStatusToggle({ workflow }: { workflow: Workflow }) {
  const updateWorkflow = useUpdateWorkflow()

  async function toggle() {
    const nextStatus: WorkflowStatus = workflow.status === "active" ? "paused" : "active"
    try {
      await updateWorkflow.mutateAsync({ id: workflow.id, updates: { status: nextStatus } })
    } catch (error) {
      toast.error("Failed to update workflow status", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        toggle()
      }}
      disabled={updateWorkflow.isPending}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50",
        STATUS_BADGE_CLASSES[workflow.status]
      )}
    >
      {STATUS_LABELS[workflow.status]}
    </button>
  )
}

export default function WorkflowsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(getDefaultWorkflowFilters)
  const [createOpen, setCreateOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const { data, isLoading, error } = useWorkflows(filters)

  const workflows = data?.workflows ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize))

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Workflows</h1>
          <p className="mt-1 text-sm text-slate-500">
            Multi-step automations that fire off CRM and AI Workforce events.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
            Browse Templates
          </Button>
          <Button onClick={() => setCreateOpen(true)}>Create Workflow</Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Select
          value={filters.status}
          onValueChange={(value) => updateFilter("status", value as WorkflowStatus | "all")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {WORKFLOW_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading workflows…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">
            Failed to load workflows: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        ) : workflows.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            No workflows yet. Create one to automate follow-ups, tasks, and notifications.
          </p>
        ) : (
          workflows.map((workflow) => (
            <div
              key={workflow.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/workflows/${workflow.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate(`/workflows/${workflow.id}`)
              }}
              className="flex cursor-pointer items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{workflow.name}</span>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 font-normal text-slate-600">
                    {WORKFLOW_TRIGGER_LABELS[workflow.trigger_type]}
                  </Badge>
                </div>
                {workflow.description && (
                  <p className="mt-0.5 truncate text-sm text-slate-500">{workflow.description}</p>
                )}
              </div>

              <div className="hidden shrink-0 text-right text-xs text-slate-500 sm:block">
                <div>{workflow.total_runs} total runs</div>
                <div className="text-slate-400" title={workflow.last_run_at ? formatDateTime(workflow.last_run_at) : undefined}>
                  {workflow.last_run_at ? `Last run ${formatRelativeTime(workflow.last_run_at)}` : "Never run"}
                </div>
              </div>

              <div className="shrink-0">
                <WorkflowStatusToggle workflow={workflow} />
              </div>
            </div>
          ))
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination
            page={filters.page}
            pageCount={pageCount}
            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
          />
        </div>
      )}

      <CreateWorkflowDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
    </div>
  )
}
