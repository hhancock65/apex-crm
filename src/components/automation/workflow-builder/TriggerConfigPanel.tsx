import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAllPipelineStages } from "@/hooks/usePipelines"
import { LEAD_STATUSES, type LeadStatus } from "@/types/lead"
import { WORKFLOW_TRIGGER_LABELS, type WorkflowTriggerType } from "@/types/workflow"

const BUILDER_TRIGGER_TYPES: WorkflowTriggerType[] = [
  "new_lead",
  "lead_status_change",
  "new_deal",
  "deal_stage_change",
  "appointment_booked",
  "appointment_cancelled",
  "appointment_completed",
  "missed_call",
  "call_completed",
  "manual",
]

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
}

interface TriggerConfigPanelProps {
  triggerType: WorkflowTriggerType
  triggerConfig: Record<string, unknown>
  onTriggerTypeChange: (type: WorkflowTriggerType) => void
  onTriggerConfigChange: (config: Record<string, unknown>) => void
}

export function TriggerConfigPanel({
  triggerType,
  triggerConfig,
  onTriggerTypeChange,
  onTriggerConfigChange,
}: TriggerConfigPanelProps) {
  const { data: stages } = useAllPipelineStages()

  function setConfig(key: string, value: string) {
    onTriggerConfigChange(value ? { ...triggerConfig, [key]: value } : omit(triggerConfig, key))
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">When this happens…</h2>

      <div className="mt-3 space-y-1.5">
        <Label htmlFor="trigger-type">Trigger</Label>
        <Select value={triggerType} onValueChange={(value) => onTriggerTypeChange(value as WorkflowTriggerType)}>
          <SelectTrigger id="trigger-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUILDER_TRIGGER_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {WORKFLOW_TRIGGER_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {triggerType === "manual" && (
          <p className="text-xs text-amber-700">
            Manual triggers don't have a "Run now" action yet — this workflow won't fire until that
            ships.
          </p>
        )}
      </div>

      {triggerType === "lead_status_change" && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
          <div className="space-y-1.5">
            <Label>From status (optional)</Label>
            <Select
              value={(triggerConfig.from_status as string | undefined) ?? "any"}
              onValueChange={(value) => setConfig("from_status", value === "any" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any status</SelectItem>
                {LEAD_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {LEAD_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>To status (optional)</Label>
            <Select
              value={(triggerConfig.to_status as string | undefined) ?? "any"}
              onValueChange={(value) => setConfig("to_status", value === "any" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any status</SelectItem>
                {LEAD_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {LEAD_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {triggerType === "deal_stage_change" && (
        <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
          <Label>To stage (optional)</Label>
          <Select
            value={(triggerConfig.to_stage_id as string | undefined) ?? "any"}
            onValueChange={(value) => setConfig("to_stage_id", value === "any" ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any stage</SelectItem>
              {stages?.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name} ({stage.pipeline?.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const next = { ...obj }
  delete next[key]
  return next
}
