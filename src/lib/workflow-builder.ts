import type { WorkflowStep, WorkflowStepType, WorkflowTriggerType } from "@/types/workflow"

/**
 * Editable tree shape for the visual builder. Storage (`workflows.steps`) is
 * a flat array linked by next_step_id/yes_next_step_id/no_next_step_id — a
 * tree is dramatically simpler to render, drag-reorder, and edit than a
 * graph, so the builder works in this shape and flattens on save
 * (flattenSteps) / reconstructs on load (buildStepTree).
 *
 * Simplification, by design: a condition step is always the LAST item in
 * whatever list contains it. There's no "continue the parent list after the
 * fork" — everything after a condition lives inside its yes/no branch. This
 * avoids unreachable-step bugs (a trailing sibling after a fork would never
 * run, since the fork always branches) without needing a merge-back concept,
 * which real automation tools like ActiveCampaign don't offer in their
 * simple builders either.
 */
export interface BuilderStep {
  id: string
  type: WorkflowStepType
  config: Record<string, unknown>
  yesSteps?: BuilderStep[]
  noSteps?: BuilderStep[]
}

export function createStep(type: WorkflowStepType): BuilderStep {
  const step: BuilderStep = { id: crypto.randomUUID(), type, config: {} }
  if (type === "condition") {
    step.yesSteps = []
    step.noSteps = []
  }
  return step
}

export function flattenSteps(steps: BuilderStep[]): WorkflowStep[] {
  const flat: WorkflowStep[] = []

  steps.forEach((step, index) => {
    const nextId = index + 1 < steps.length ? steps[index + 1].id : null

    if (step.type === "condition") {
      const yesFlat = flattenSteps(step.yesSteps ?? [])
      const noFlat = flattenSteps(step.noSteps ?? [])
      flat.push({
        id: step.id,
        type: step.type,
        config: step.config,
        next_step_id: null,
        yes_next_step_id: yesFlat[0]?.id ?? null,
        no_next_step_id: noFlat[0]?.id ?? null,
      })
      flat.push(...yesFlat, ...noFlat)
    } else {
      flat.push({ id: step.id, type: step.type, config: step.config, next_step_id: nextId })
    }
  })

  return flat
}

function walkChain(id: string | null, byId: Map<string, WorkflowStep>, visited: Set<string>): BuilderStep[] {
  if (!id || visited.has(id)) return []
  const raw = byId.get(id)
  if (!raw) return []
  visited.add(id)

  if (raw.type === "condition") {
    return [
      {
        id: raw.id,
        type: raw.type,
        config: raw.config ?? {},
        yesSteps: walkChain(raw.yes_next_step_id ?? null, byId, visited),
        noSteps: walkChain(raw.no_next_step_id ?? null, byId, visited),
      },
    ]
  }

  return [{ id: raw.id, type: raw.type, config: raw.config ?? {} }, ...walkChain(raw.next_step_id ?? null, byId, visited)]
}

/** steps[0] is the entry point (same convention execute-workflow-run uses)
 *  — anything unreachable from it (orphaned by hand-edited data) is silently
 *  dropped rather than surfaced, since there's no tree position for it. */
export function buildStepTree(flat: WorkflowStep[] | null | undefined): BuilderStep[] {
  if (!flat || flat.length === 0) return []
  const byId = new Map(flat.map((step) => [step.id, step]))
  return walkChain(flat[0].id, byId, new Set())
}

export function countSteps(steps: BuilderStep[]): number {
  return steps.reduce((sum, step) => {
    if (step.type === "condition") {
      return sum + 1 + countSteps(step.yesSteps ?? []) + countSteps(step.noSteps ?? [])
    }
    return sum + 1
  }, 0)
}

export function findStepById(steps: BuilderStep[], id: string): BuilderStep | null {
  for (const step of steps) {
    if (step.id === id) return step
    if (step.type === "condition") {
      const found = findStepById(step.yesSteps ?? [], id) ?? findStepById(step.noSteps ?? [], id)
      if (found) return found
    }
  }
  return null
}

/** Used by the right-hand config panel, which lives outside the recursive
 *  step-list tree and only knows the selected step's id — everything else
 *  (add/remove/reorder) happens via local closures inside each list level. */
export function updateStepConfig(
  steps: BuilderStep[],
  id: string,
  config: Record<string, unknown>
): BuilderStep[] {
  return steps.map((step) => {
    if (step.id === id) return { ...step, config }
    if (step.type === "condition") {
      return {
        ...step,
        yesSteps: updateStepConfig(step.yesSteps ?? [], id, config),
        noSteps: updateStepConfig(step.noSteps ?? [], id, config),
      }
    }
    return step
  })
}

export interface UpdateRecordTarget {
  table: "leads" | "contacts" | "deals" | "appointments"
  recordIdField: string
  label: string
}

/** update_record steps need a table + a trigger_data key to find the record
 *  — inferred from the workflow's own trigger rather than asked of the user,
 *  since "which record" is really "the thing that triggered this workflow." */
export function getUpdateRecordTarget(triggerType: WorkflowTriggerType): UpdateRecordTarget | null {
  switch (triggerType) {
    case "new_lead":
    case "lead_status_change":
      return { table: "leads", recordIdField: "lead_id", label: "the lead" }
    case "new_contact":
      return { table: "contacts", recordIdField: "contact_id", label: "the contact" }
    case "new_deal":
    case "deal_stage_change":
      return { table: "deals", recordIdField: "deal_id", label: "the deal" }
    case "appointment_booked":
    case "appointment_cancelled":
    case "appointment_completed":
      return { table: "appointments", recordIdField: "appointment_id", label: "the appointment" }
    // manual/missed_call/call_completed all carry a contact_id in
    // trigger_data (see handle_workflow_trigger_event) — a per-contact
    // update is the obviously-correct target even though 'manual' has no
    // firing mechanism yet (no "Run now" button). Keep in sync with
    // supabase/functions/workflow-executor/index.ts's own copy of this
    // mapping (Deno can't import from src/).
    case "manual":
    case "missed_call":
    case "call_completed":
      return { table: "contacts", recordIdField: "contact_id", label: "the contact" }
    default:
      return null
  }
}
