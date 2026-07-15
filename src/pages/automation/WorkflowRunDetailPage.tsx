import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, Clock, Loader2, SkipForward, XCircle, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { STEP_TYPE_ICONS, STEP_TYPE_LABELS } from "@/components/automation/workflow-builder/step-meta"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useCancelWorkflowRun,
  useWorkflowRun,
  useWorkflowRunRealtime,
  useWorkflowRunScheduledTask,
  useWorkflowRunSteps,
} from "@/hooks/useWorkflowRuns"
import { useWorkflow } from "@/hooks/useWorkflows"
import { formatDateTime, formatRelativeTime } from "@/lib/utils"
import type { WorkflowRunStatus, WorkflowRunStep, WorkflowStep } from "@/types/workflow"

type DisplayStatus = "completed" | "failed" | "skipped" | "current" | "waiting" | "pending"

interface StepTraceItem {
  step: WorkflowStep
  runStep: WorkflowRunStep | undefined
  displayStatus: DisplayStatus
}

/** Walks the run's own realized path (following the branch it actually took
 *  at each condition, the same way workflow-executor does) to find the
 *  frontier — the first step with no workflow_run_steps row yet. Everything
 *  from there on is "Pending" gray; the frontier itself is "Current"
 *  (spinning) or "Waiting" (resuming later) depending on the run's status,
 *  never both, since a run is only ever actively processing OR paused. */
function buildStepTrace(steps: WorkflowStep[], runSteps: WorkflowRunStep[], runStatus: WorkflowRunStatus): StepTraceItem[] {
  const runStepsByStepId = new Map(runSteps.map((rs) => [rs.step_id, rs]))
  const stepsById = new Map(steps.map((s) => [s.id, s]))

  let frontierId: string | null = null
  let current: WorkflowStep | undefined = steps[0]
  const visited = new Set<string>()
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    const runStep = runStepsByStepId.get(current.id)
    if (!runStep) {
      frontierId = current.id
      break
    }
    if (current.type === "condition") {
      const branchYes = Boolean((runStep.output as Record<string, unknown> | undefined)?.result)
      const nextId: string | null | undefined = branchYes ? current.yes_next_step_id : current.no_next_step_id
      current = nextId ? stepsById.get(nextId) : undefined
    } else {
      current = current.next_step_id ? stepsById.get(current.next_step_id) : undefined
    }
  }

  return steps.map((step) => {
    const runStep = runStepsByStepId.get(step.id)
    let displayStatus: DisplayStatus
    if (runStep) {
      if (runStep.status === "running") displayStatus = "current"
      else if (runStep.status === "pending") displayStatus = "pending"
      else displayStatus = runStep.status
    } else if (step.id === frontierId && runStatus === "waiting") {
      displayStatus = "waiting"
    } else if (step.id === frontierId && runStatus === "running") {
      displayStatus = "current"
    } else {
      displayStatus = "pending"
    }
    return { step, runStep, displayStatus }
  })
}

const STATUS_META: Record<DisplayStatus, { label: string; icon: LucideIcon; className: string; spin?: boolean }> = {
  completed: { label: "Completed", icon: CheckCircle2, className: "text-green-600" },
  failed: { label: "Failed", icon: XCircle, className: "text-red-600" },
  skipped: { label: "Skipped", icon: SkipForward, className: "text-slate-400" },
  current: { label: "Running", icon: Loader2, className: "text-blue-600", spin: true },
  waiting: { label: "Waiting", icon: Clock, className: "text-amber-600" },
  pending: { label: "Pending", icon: Circle, className: "text-slate-300" },
}

const RUN_STATUS_LABELS: Record<WorkflowRunStatus, string> = {
  running: "Running",
  waiting: "Waiting",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
}

const RUN_STATUS_CLASSES: Record<WorkflowRunStatus, string> = {
  running: "border-blue-200 bg-blue-50 text-blue-700",
  waiting: "border-amber-200 bg-amber-50 text-amber-700",
  completed: "border-green-200 bg-green-50 text-green-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
}

function JsonBlock({ label, value }: { label: string; value: Record<string, unknown> }) {
  if (!value || Object.keys(value).length === 0) return null
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <pre className="mt-0.5 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-600">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function StepTraceRow({ item }: { item: StepTraceItem }) {
  const { step, runStep, displayStatus } = item
  const StepIcon = STEP_TYPE_ICONS[step.type] ?? Circle
  const meta = STATUS_META[displayStatus]
  const StatusIcon = meta.icon

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <StepIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{STEP_TYPE_LABELS[step.type] ?? step.type}</p>
            {step.type === "condition" && runStep?.output && "result" in runStep.output && (
              <p className="text-xs text-slate-400">
                Branch taken: {(runStep.output as Record<string, unknown>).result ? "Yes" : "No"}
              </p>
            )}
            {runStep && runStep.attempts > 1 && (
              <p className="text-xs text-slate-400">Retried — {runStep.attempts} attempts</p>
            )}
          </div>
        </div>
        <div className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${meta.className}`}>
          <StatusIcon className={`h-3.5 w-3.5 ${meta.spin ? "animate-spin" : ""}`} />
          {meta.label}
        </div>
      </div>

      {runStep?.error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md bg-red-50 p-2 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{runStep.error}</span>
        </p>
      )}

      {runStep && (runStep.input || runStep.output) && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <JsonBlock label="Input" value={runStep.input} />
          <JsonBlock label="Output" value={runStep.output} />
        </div>
      )}
    </div>
  )
}

export default function WorkflowRunDetailPage() {
  const { workflowId, runId } = useParams<{ workflowId: string; runId: string }>()
  const { data: workflow, isLoading: workflowLoading } = useWorkflow(workflowId)
  const { data: run, isLoading: runLoading } = useWorkflowRun(runId)
  const { data: runSteps, isLoading: stepsLoading } = useWorkflowRunSteps(runId)
  const { data: scheduledTask } = useWorkflowRunScheduledTask(runId)
  const cancelRun = useCancelWorkflowRun()
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)

  useWorkflowRunRealtime(runId)

  async function handleCancel() {
    if (!run) return
    try {
      await cancelRun.mutateAsync(run.id)
      toast.success("Run cancelled")
    } catch (error) {
      toast.error("Failed to cancel run", { description: error instanceof Error ? error.message : undefined })
    } finally {
      setConfirmCancelOpen(false)
    }
  }

  if (workflowLoading || runLoading || stepsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!workflow || !run) {
    return <p className="py-10 text-center text-sm text-slate-400">Run not found.</p>
  }

  const steps = workflow.steps ?? []
  const trace = buildStepTrace(steps, runSteps ?? [], run.status)
  const canCancel = run.status === "running" || run.status === "waiting"

  return (
    <div>
      <Link
        to={`/workflows/${workflow.id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {workflow.name}
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Run</h1>
            <Badge variant="outline" className={RUN_STATUS_CLASSES[run.status]}>
              {RUN_STATUS_LABELS[run.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Started {formatDateTime(run.started_at)} ({formatRelativeTime(run.started_at)})
            {run.completed_at && ` · Finished ${formatDateTime(run.completed_at)}`}
          </p>
          {run.status === "waiting" && scheduledTask && (
            <p className="mt-1 text-sm text-amber-700">Resumes {formatDateTime(scheduledTask.resume_at)}</p>
          )}
        </div>
        {canCancel && (
          <Button variant="outline" onClick={() => setConfirmCancelOpen(true)} disabled={cancelRun.isPending}>
            Cancel Run
          </Button>
        )}
      </div>

      {run.error && (
        <p className="mt-4 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{run.error}</span>
        </p>
      )}

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Trigger Data</h2>
        </div>
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-600">
          {JSON.stringify(run.trigger_data ?? {}, null, 2)}
        </pre>
      </div>

      <div className="mt-4 space-y-2">
        {trace.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">This workflow has no steps.</p>
        ) : (
          trace.map((item) => <StepTraceRow key={item.step.id} item={item} />)
        )}
      </div>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this run?</AlertDialogTitle>
            <AlertDialogDescription>
              {run.status === "waiting"
                ? "This run is paused at a wait step — cancelling stops it from ever resuming."
                : "This stops the run where it currently stands. Steps already completed aren't undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep running</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancel}
            >
              Cancel Run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
