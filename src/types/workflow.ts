export const WORKFLOW_TRIGGER_TYPES = [
  "new_lead",
  "lead_status_change",
  "new_contact",
  "new_deal",
  "deal_stage_change",
  "appointment_booked",
  "appointment_cancelled",
  "appointment_completed",
  "missed_call",
  "call_completed",
  "manual",
  "scheduled",
  "form_submission",
] as const
export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGER_TYPES)[number]

export const WORKFLOW_TRIGGER_LABELS: Record<WorkflowTriggerType, string> = {
  new_lead: "New lead",
  lead_status_change: "Lead status change",
  new_contact: "New contact",
  new_deal: "New deal",
  deal_stage_change: "Deal stage change",
  appointment_booked: "Appointment booked",
  appointment_cancelled: "Appointment cancelled",
  appointment_completed: "Appointment completed",
  missed_call: "Missed call",
  call_completed: "Call completed",
  manual: "Manual",
  scheduled: "Scheduled",
  form_submission: "Form submission",
}

/** manual/scheduled/form_submission are modeled in the trigger_type enum
 *  for forward-compatibility but nothing fires them yet in this foundation
 *  release (no "Run now" button, no pg_cron, no public form endpoint) — the
 *  UI flags this rather than implying they work. */
export const UNWIRED_TRIGGER_TYPES: readonly WorkflowTriggerType[] = ["manual", "scheduled", "form_submission"]

export const WORKFLOW_STATUSES = ["active", "paused", "draft"] as const
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number]

export const WORKFLOW_STEP_TYPES = [
  "wait",
  "send_sms",
  "send_email",
  "ai_call",
  "create_task",
  "update_record",
  "condition",
  "notification",
  "webhook",
] as const
export type WorkflowStepType = (typeof WORKFLOW_STEP_TYPES)[number]

export interface WorkflowStepCondition {
  field: string
  operator: "eq" | "neq" | "gt" | "lt" | "exists" | "contains" | "is_empty" | "is_not_empty"
  value?: unknown
}

/**
 * The shape a 'wait' step's `config` follows — not a change to WorkflowStep
 * itself (config stays a generic jsonb bag), just documenting the two modes
 * StepConfigPanel's WaitConfig form and (eventually) the executor expect:
 *   - "duration": wait a fixed length of time from when this step runs.
 *   - "relative_to_trigger_field": wait until (trigger_data[field] -
 *     offset_minutes) — e.g. field: "start_time", offset_minutes: 1440 for
 *     "24 hours before the appointment". Needs a real timestamp field on
 *     the triggering event (appointment_booked/appointment_completed's
 *     start_time, today) to be meaningful.
 * Both modes are executed for real by workflow-executor (see its
 * computeResumeAt) — a wait step schedules a scheduled_tasks row and the
 * run pauses (status 'waiting') until a once-a-minute cron tick resumes it.
 */
export type WorkflowWaitConfig =
  | { mode: "duration"; duration_value?: number; duration_unit?: "minutes" | "hours" | "days" }
  | { mode: "relative_to_trigger_field"; field?: string; offset_minutes?: number }

export interface WorkflowStep {
  id: string
  type: WorkflowStepType
  config: Record<string, unknown>
  next_step_id: string | null
  // Only meaningful for type 'condition' — the yes/no fork, in place of
  // next_step_id (which condition steps leave null). See src/lib/workflow-builder.ts.
  yes_next_step_id?: string | null
  no_next_step_id?: string | null
  condition?: WorkflowStepCondition
}

export interface Workflow {
  id: string
  org_id: string
  name: string
  description: string | null
  trigger_type: WorkflowTriggerType
  trigger_config: Record<string, unknown>
  steps: WorkflowStep[]
  status: WorkflowStatus
  total_runs: number
  last_run_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CreateWorkflowInput = Pick<Workflow, "name" | "description" | "trigger_type"> &
  Partial<Pick<Workflow, "trigger_config" | "steps">>

export type UpdateWorkflowInput = Partial<
  Pick<Workflow, "name" | "description" | "status" | "trigger_type" | "trigger_config" | "steps">
>

// 'waiting' = paused at a 'wait' step, scheduled to resume later (see
// scheduled_tasks, migration 0017) — distinct from 'running' (workflow-
// executor is actively processing steps in this invocation right now) so
// the UI can show "resumes at 3:00pm" instead of a misleading spinner.
export const WORKFLOW_RUN_STATUSES = ["running", "waiting", "completed", "failed", "cancelled"] as const
export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUSES)[number]

export interface WorkflowRun {
  id: string
  org_id: string
  workflow_id: string
  trigger_data: Record<string, unknown>
  status: WorkflowRunStatus
  current_step_id: string | null
  steps_completed: number
  error: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export const WORKFLOW_RUN_STEP_STATUSES = ["pending", "running", "completed", "failed", "skipped"] as const
export type WorkflowRunStepStatus = (typeof WORKFLOW_RUN_STEP_STATUSES)[number]

export interface WorkflowRunStep {
  id: string
  workflow_run_id: string
  step_id: string
  status: WorkflowRunStepStatus
  input: Record<string, unknown>
  output: Record<string, unknown>
  error: string | null
  attempts: number
  started_at: string | null
  completed_at: string | null
}

export interface ScheduledTask {
  id: string
  workflow_run_id: string
  resume_step_id: string
  resume_at: string
  status: "pending" | "processing" | "completed" | "cancelled"
  created_at: string
}
