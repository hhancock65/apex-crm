import { ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { AddStepButton } from "@/components/automation/workflow-builder/AddStepButton"
import { StepConfigPanel } from "@/components/automation/workflow-builder/StepConfigPanel"
import { StepListEditor } from "@/components/automation/workflow-builder/StepListEditor"
import { TriggerConfigPanel } from "@/components/automation/workflow-builder/TriggerConfigPanel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useUpdateWorkflow, useWorkflow } from "@/hooks/useWorkflows"
import { useWorkflowRuns } from "@/hooks/useWorkflowRuns"
import {
  buildStepTree,
  createStep,
  findStepById,
  flattenSteps,
  updateStepConfig,
  type BuilderStep,
} from "@/lib/workflow-builder"
import { formatDateTime } from "@/lib/utils"
import {
  WORKFLOW_STATUSES,
  type WorkflowRunStatus,
  type WorkflowStatus,
  type WorkflowTriggerType,
} from "@/types/workflow"

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

const STATUS_LABELS: Record<WorkflowStatus, string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
}

export default function WorkflowBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const { data: workflow, isLoading } = useWorkflow(id)
  const { data: runs } = useWorkflowRuns(id)
  const updateWorkflow = useUpdateWorkflow()

  const [seeded, setSeeded] = useState(false)
  const [name, setName] = useState("")
  const [status, setStatus] = useState<WorkflowStatus>("draft")
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>("new_lead")
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({})
  const [steps, setSteps] = useState<BuilderStep[]>([])
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  useEffect(() => {
    if (workflow && !seeded) {
      setName(workflow.name)
      setStatus(workflow.status)
      setTriggerType(workflow.trigger_type)
      setTriggerConfig(workflow.trigger_config ?? {})
      setSteps(buildStepTree(workflow.steps))
      setSeeded(true)
    }
  }, [workflow, seeded])

  const selectedStep = selectedStepId ? findStepById(steps, selectedStepId) : null

  function handleTriggerTypeChange(next: WorkflowTriggerType) {
    setTriggerType(next)
    setTriggerConfig({})
  }

  function addFirstStep(type: Parameters<typeof createStep>[0]) {
    const step = createStep(type)
    setSteps([step])
    setSelectedStepId(step.id)
  }

  async function handleSave() {
    if (!workflow) return

    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    if (steps.length === 0) {
      toast.error("Add at least one step before saving")
      return
    }

    try {
      await updateWorkflow.mutateAsync({
        id: workflow.id,
        updates: {
          name: name.trim(),
          status,
          trigger_type: triggerType,
          trigger_config: triggerConfig,
          steps: flattenSteps(steps),
        },
      })
      toast.success("Workflow saved")
    } catch (error) {
      toast.error("Failed to save workflow", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!workflow) {
    return <p className="py-10 text-center text-sm text-slate-400">Workflow not found.</p>
  }

  return (
    <div>
      <Link
        to="/workflows"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Workflows
      </Link>

      {/* Top bar */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workflow name"
            className="h-auto border-none p-0 text-2xl font-bold tracking-tight text-slate-900 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(value) => setStatus(value as WorkflowStatus)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKFLOW_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={updateWorkflow.isPending}>
            {updateWorkflow.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Builder layout */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_320px] lg:items-start">
        {/* Left: trigger */}
        <TriggerConfigPanel
          triggerType={triggerType}
          triggerConfig={triggerConfig}
          onTriggerTypeChange={handleTriggerTypeChange}
          onTriggerConfigChange={setTriggerConfig}
        />

        {/* Center: step list */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Steps</h2>
          <div className="mt-3">
            {steps.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-6 text-center">
                <p className="text-sm text-slate-400">No steps yet.</p>
                <div className="mx-auto mt-3 max-w-[200px]">
                  <AddStepButton onAdd={addFirstStep} />
                </div>
              </div>
            ) : (
              <StepListEditor
                steps={steps}
                onChange={setSteps}
                selectedId={selectedStepId}
                onSelect={setSelectedStepId}
              />
            )}
          </div>
        </div>

        {/* Right: step config */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-4">
          {selectedStep ? (
            <StepConfigPanel
              step={selectedStep}
              triggerType={triggerType}
              onChange={(config) => setSteps((prev) => updateStepConfig(prev, selectedStep.id, config))}
            />
          ) : (
            <p className="text-sm text-slate-400">Select a step to configure it.</p>
          )}
        </div>
      </div>

      {/* Recent runs */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Recent Runs</h2>
        <div className="mt-3 space-y-2">
          {!runs || runs.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              This workflow hasn't run yet — it fires the next time its trigger event happens.
            </p>
          ) : (
            runs.slice(0, 10).map((run) => (
              <Link
                key={run.id}
                to={`/workflows/${workflow.id}/runs/${run.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={RUN_STATUS_CLASSES[run.status]}>
                      {RUN_STATUS_LABELS[run.status]}
                    </Badge>
                    <span className="text-xs text-slate-500">{run.steps_completed} steps completed</span>
                  </div>
                  {run.error && <p className="mt-1 truncate text-xs text-destructive">{run.error}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">{formatDateTime(run.started_at)}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
