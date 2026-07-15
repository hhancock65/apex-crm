// Supabase Edge Function: resume-scheduled-workflows
//
// Invoked every minute by pg_cron (trigger_workflow_resume_scan(), migration
// 0017) via pg_net — same shared-secret pattern and same secret as
// workflow-executor (X-Workflow-Trigger-Secret, keyed with
// WORKFLOW_TRIGGER_SECRET; this is the same trust boundary as every other
// "Postgres calling our own Edge Functions" hop in this codebase, not a new
// one). No Apex user session, all DB access via the service-role client.
//
// A workflow-executor invocation that hits a 'wait' step can't reliably
// sleep past its own response (see workflow-executor's header comment), so
// it instead writes a scheduled_tasks row and ends. This function is the
// other half: once a minute, find every scheduled_tasks row whose resume_at
// has arrived, claim it, and call workflow-executor again with
// { workflow_run_id, resume_step_id } to pick the run back up.
//
// Claiming (pending -> processing via a conditional UPDATE, checking the
// affected row came back) exists so that if this function is ever invoked
// twice in close succession — pg_cron overlap, a manual re-trigger while a
// previous tick is still finishing — the same due task can't be resumed
// twice. A cancelled run's still-pending scheduled_tasks are marked
// 'cancelled' here rather than resumed, so "Cancel Run" actually stops a
// paused run from ever waking back up.

import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { createServiceRoleClient } from "../_shared/supabase-admin.ts"

type ServiceClient = ReturnType<typeof createServiceRoleClient>

const BATCH_LIMIT = 100

interface DueTask {
  id: string
  workflow_run_id: string
  resume_step_id: string
}

async function claimTask(supabase: ServiceClient, taskId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("scheduled_tasks")
    .update({ status: "processing" })
    .eq("id", taskId)
    .eq("status", "pending")
    .select("id")

  if (error) {
    console.error(`resume-scheduled-workflows: failed to claim task ${taskId}`, error)
    return false
  }
  return Boolean(data && data.length > 0)
}

async function resumeTask(
  supabase: ServiceClient,
  task: DueTask,
  functionsBaseUrl: string,
  secret: string
): Promise<"resumed" | "cancelled" | "skipped"> {
  if (!(await claimTask(supabase, task.id))) return "skipped"

  const { data: run } = await supabase
    .from("workflow_runs")
    .select("id, status")
    .eq("id", task.workflow_run_id)
    .maybeSingle()

  if (!run || run.status !== "waiting") {
    // Cancelled, or otherwise no longer waiting — don't resurrect it.
    await supabase.from("scheduled_tasks").update({ status: "cancelled" }).eq("id", task.id)
    return "cancelled"
  }

  await supabase.from("scheduled_tasks").update({ status: "completed" }).eq("id", task.id)

  try {
    const response = await fetch(`${functionsBaseUrl}/workflow-executor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workflow-Trigger-Secret": secret },
      body: JSON.stringify({ workflow_run_id: task.workflow_run_id, resume_step_id: task.resume_step_id }),
    })
    if (!response.ok) {
      console.error(`resume-scheduled-workflows: workflow-executor responded ${response.status} for run ${task.workflow_run_id}`)
    }
  } catch (error) {
    console.error(`resume-scheduled-workflows: failed to invoke workflow-executor for run ${task.workflow_run_id}`, error)
  }

  return "resumed"
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const expectedSecret = Deno.env.get("WORKFLOW_TRIGGER_SECRET")
  if (!expectedSecret) {
    console.error("resume-scheduled-workflows: WORKFLOW_TRIGGER_SECRET is not configured")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }
  if (req.headers.get("X-Workflow-Trigger-Secret") !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  const functionsBaseUrl = Deno.env.get("SUPABASE_URL")
    ? `${Deno.env.get("SUPABASE_URL")}/functions/v1`
    : undefined
  if (!functionsBaseUrl) {
    console.error("resume-scheduled-workflows: SUPABASE_URL is not configured")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  const supabase = createServiceRoleClient()

  const { data: dueTasks, error: dueTasksError } = await supabase
    .from("scheduled_tasks")
    .select("id, workflow_run_id, resume_step_id")
    .eq("status", "pending")
    .lte("resume_at", new Date().toISOString())
    .order("resume_at", { ascending: true })
    .limit(BATCH_LIMIT)

  if (dueTasksError) {
    console.error("resume-scheduled-workflows: failed to load due tasks", dueTasksError)
    return jsonResponse({ error: "Failed to load due tasks" }, 500)
  }

  const outcomes = { resumed: 0, cancelled: 0, skipped: 0 }
  for (const task of (dueTasks ?? []) as DueTask[]) {
    const outcome = await resumeTask(supabase, task, functionsBaseUrl, expectedSecret)
    outcomes[outcome] += 1
  }

  return jsonResponse({ success: true, processed: dueTasks?.length ?? 0, ...outcomes })
})
