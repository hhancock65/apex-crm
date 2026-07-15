// Supabase Edge Function: workflow-executor
//
// The real step-by-step runner for workflows (renamed and substantially
// expanded from the 0011-era "execute-workflow-run" foundation, which only
// implemented DB-write step types and stubbed wait/ai_call/webhook).
//
// Invoked two ways, both via the shared-secret pattern (X-Workflow-Trigger-
// Secret, keyed with WORKFLOW_TRIGGER_SECRET) — no Apex user session, no
// Retell involved, all DB access via the service-role client:
//   1. handle_workflow_trigger_event() (migration 0017) fires this the
//      moment a workflow_runs row is created, body: { workflow_run_id }.
//   2. resume-scheduled-workflows fires this when a 'wait' step's resume_at
//      arrives, body: { workflow_run_id, resume_step_id }.
//
// Every step type in WORKFLOW_STEP_TYPES is now genuinely implemented:
//   - send_sms / send_email / create_task / update_record / notification /
//     condition: unchanged in spirit from the foundation pass.
//   - ai_call: places a real outbound call via Retell's createPhoneCall.
//   - webhook: POSTs (or GET/PUT/etc.) to an external HTTPS URL, with basic
//     hostname-literal SSRF filtering (see isBlockedWebhookHost) — NOT
//     DNS-rebinding-safe; a hostname that only resolves to a private IP at
//     request time would sail through. Real SSRF protection for arbitrary
//     user-supplied URLs needs an egress allowlist/proxy, outside what a
//     single Edge Function can do.
//   - wait: CANNOT reliably "sleep" inside a serverless function past the
//     response (Deno Deploy gives no guarantee that a setTimeout survives
//     after the response is sent). Instead it writes a scheduled_tasks row
//     (resume_at, resume_step_id) and this invocation ends with
//     workflow_runs.status = 'waiting'. A once-a-minute pg_cron tick
//     (resume-scheduled-workflows) wakes it back up by calling this
//     function again with resume_step_id set. Effective minimum wait
//     latency is therefore ~1 minute (cron granularity), not instant — a
//     deliberate, documented tradeoff over an actually-unreliable
//     setTimeout-after-response hack.
//
// Retries: send_sms/send_email/ai_call/webhook are retried up to 3 times
// with exponential backoff (1s, 2s, ...) on failure — these are the step
// types that make real network calls and can fail transiently. The other
// step types are pure DB writes; retrying an identical failure there just
// delays reporting what's almost always a real config bug, so they're not
// retried. After the final failed attempt, the run is marked 'failed' and
// every org owner/admin gets a notification.
//
// Concurrency: the very first thing this function does is an atomic
// compare-and-swap claim (UPDATE ... WHERE status = <expected> RETURNING) —
// a redelivered trigger, an overlapping resume tick, or any other duplicate
// invocation for the same run loses the race harmlessly instead of
// double-running steps. Different runs never share any state, so they're
// inherently safe to process concurrently.

import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { EMAIL_TEMPLATES, renderTemplate } from "../_shared/message-templates.ts"
import { notifyOrgAdmins } from "../_shared/notify-admins.ts"
import { asNumber, asString } from "../_shared/parse-args.ts"
import { createPhoneCall, RetellApiError } from "../_shared/retell-client.ts"
import { ResendApiError, sendEmailViaResend } from "../_shared/resend-client.ts"
import { createServiceRoleClient } from "../_shared/supabase-admin.ts"
import { sendSmsViaTwilio, TwilioApiError } from "../_shared/twilio-client.ts"
import { checkUsageLimits, recordUsage } from "../_shared/usage.ts"

type ServiceClient = ReturnType<typeof createServiceRoleClient>

const MAX_STEPS = 50
const MAX_ATTEMPTS = 3
const RETRYABLE_STEP_TYPES = new Set(["send_sms", "send_email", "ai_call", "webhook"])

interface StepCondition {
  field: string
  operator: "eq" | "neq" | "gt" | "lt" | "exists" | "contains" | "is_empty" | "is_not_empty"
  value?: unknown
}

interface WorkflowStep {
  id: string
  type: string
  config: Record<string, unknown>
  next_step_id: string | null
  // Only meaningful for type 'condition' — the visual builder (Workflow
  // Builder) encodes its yes/no fork as these two pointers instead of
  // next_step_id, which condition steps otherwise leave null.
  yes_next_step_id?: string | null
  no_next_step_id?: string | null
  condition?: StepCondition
}

interface StepResult {
  status: "completed" | "failed" | "skipped"
  output: Record<string, unknown>
  error?: string
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
      obj
    )
}

/** UI-authored condition values are always plain strings (a text <Input>),
 *  while hand-authored/template step JSON may use real booleans/numbers —
 *  compare loosely so both work rather than silently failing on type
 *  mismatch, which is what a strict `===` did before this pass. */
function looseEquals(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true
  if (typeof actual === "boolean") return actual === (expected === true || expected === "true")
  if (typeof actual === "number") return actual === Number(expected)
  return String(actual ?? "") === String(expected ?? "")
}

function compareNumeric(actual: unknown, expected: unknown, cmp: (a: number, b: number) => boolean): boolean {
  const a = typeof actual === "number" ? actual : Number(actual)
  const b = typeof expected === "number" ? expected : Number(expected)
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  return cmp(a, b)
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** `context` is trigger_data spread at the root (so bare fields like
 *  "status" keep working exactly as before) plus contact/deal/lead
 *  sub-objects — see buildConditionContext. */
function evaluateCondition(condition: StepCondition | undefined, context: Record<string, unknown>): boolean {
  if (!condition) return true
  const actual = getByPath(context, condition.field)
  switch (condition.operator) {
    case "exists":
      return actual !== undefined && actual !== null
    case "is_empty":
      return isEmptyValue(actual)
    case "is_not_empty":
      return !isEmptyValue(actual)
    case "eq":
      return looseEquals(actual, condition.value)
    case "neq":
      return !looseEquals(actual, condition.value)
    case "gt":
      return compareNumeric(actual, condition.value, (a, b) => a > b)
    case "lt":
      return compareNumeric(actual, condition.value, (a, b) => a < b)
    case "contains":
      if (typeof actual === "string") return actual.includes(String(condition.value ?? ""))
      if (Array.isArray(actual)) return actual.some((item) => looseEquals(item, condition.value))
      return false
    default:
      return true
  }
}

/** Best-effort: finds a contact from whatever entity id trigger_data
 *  happens to carry (contact_id directly, or a lead/appointment/deal that
 *  points at one). Returns null rather than throwing — most step types
 *  degrade to 'skipped' rather than 'failed' when no contact resolves. */
async function resolveContactId(
  supabase: ServiceClient,
  orgId: string,
  triggerData: Record<string, unknown>
): Promise<string | null> {
  const directContactId = asString(triggerData.contact_id)
  if (directContactId) return directContactId

  const leadId = asString(triggerData.lead_id)
  if (leadId) {
    const { data: lead } = await supabase.from("leads").select("phone").eq("id", leadId).maybeSingle()
    if (lead?.phone) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("org_id", orgId)
        .eq("phone", lead.phone)
        .maybeSingle()
      if (contact) return contact.id
    }
  }

  const appointmentId = asString(triggerData.appointment_id)
  if (appointmentId) {
    const { data: appointment } = await supabase
      .from("appointments")
      .select("contact_id")
      .eq("id", appointmentId)
      .maybeSingle()
    if (appointment?.contact_id) return appointment.contact_id
  }

  const dealId = asString(triggerData.deal_id)
  if (dealId) {
    const { data: deal } = await supabase.from("deals").select("contact_id").eq("id", dealId).maybeSingle()
    if (deal?.contact_id) return deal.contact_id
  }

  return null
}

/** Widens condition steps beyond trigger_data alone — "Can reference:
 *  trigger data, contact fields, deal fields, lead fields" per spec.
 *  trigger_data is spread at the root (backward compatible with every
 *  condition step already authored, e.g. template steps referencing bare
 *  "status" or "call_answered"); contact/deal/lead are namespaced
 *  sub-objects so a condition can reference e.g. "contact.tags" or
 *  "deal.value" without colliding with trigger_data's own keys. Computed
 *  once per run (not per condition step) to avoid N redundant lookups. */
async function buildConditionContext(
  supabase: ServiceClient,
  orgId: string,
  triggerData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = { ...triggerData }

  const contactId = await resolveContactId(supabase, orgId, triggerData)
  if (contactId) {
    const { data } = await supabase.from("contacts").select("*").eq("id", contactId).maybeSingle()
    if (data) context.contact = data
  }

  const dealId = asString(triggerData.deal_id)
  if (dealId) {
    const { data } = await supabase.from("deals").select("*").eq("id", dealId).maybeSingle()
    if (data) context.deal = data
  }

  const leadId = asString(triggerData.lead_id)
  if (leadId) {
    const { data } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle()
    if (data) context.lead = data
  }

  return context
}

async function executeCreateTask(
  supabase: ServiceClient,
  orgId: string,
  config: Record<string, unknown>,
  triggerData: Record<string, unknown>
): Promise<StepResult> {
  const title = asString(config.title)
  if (!title) return { status: "failed", output: {}, error: "create_task requires config.title" }

  const contactId = await resolveContactId(supabase, orgId, triggerData)
  const dueInHours = typeof config.due_in_hours === "number" ? config.due_in_hours : undefined

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      org_id: orgId,
      title,
      description: asString(config.description) ?? null,
      assigned_to: asString(config.assigned_to) ?? null,
      related_to_type: contactId ? "contact" : null,
      related_to_id: contactId,
      priority: asString(config.priority) ?? "medium",
      due_date: dueInHours !== undefined ? new Date(Date.now() + dueInHours * 3_600_000).toISOString() : null,
    })
    .select("id")
    .single()

  if (error || !task) return { status: "failed", output: {}, error: error?.message ?? "Failed to create task" }
  return { status: "completed", output: { task_id: task.id } }
}

// Deno-side mirror of src/lib/workflow-builder.ts's getUpdateRecordTarget —
// duplicated because Deno can't import from src/, same reason WorkflowStep
// itself is duplicated in this file. Keep both in sync if this changes.
// This is also the source of truth for which tables update_record may ever
// touch — an allowlist, not "whatever config says", since config is jsonb a
// user edits.
type UpdateRecordTable = "leads" | "contacts" | "deals" | "appointments"

interface UpdateRecordTarget {
  table: UpdateRecordTable
  recordIdField: string
}

function getUpdateRecordTarget(triggerType: string): UpdateRecordTarget | null {
  switch (triggerType) {
    case "new_lead":
    case "lead_status_change":
      return { table: "leads", recordIdField: "lead_id" }
    case "new_contact":
      return { table: "contacts", recordIdField: "contact_id" }
    case "new_deal":
    case "deal_stage_change":
      return { table: "deals", recordIdField: "deal_id" }
    case "appointment_booked":
    case "appointment_cancelled":
    case "appointment_completed":
      return { table: "appointments", recordIdField: "appointment_id" }
    // manual/missed_call/call_completed all carry a contact_id in
    // trigger_data (see handle_workflow_trigger_event) — a per-contact
    // update is the obviously-correct target for these even though
    // 'manual' has no firing mechanism yet (no "Run now" button).
    case "manual":
    case "missed_call":
    case "call_completed":
      return { table: "contacts", recordIdField: "contact_id" }
    default:
      return null
  }
}

async function executeUpdateRecord(
  supabase: ServiceClient,
  orgId: string,
  triggerType: string,
  config: Record<string, unknown>,
  triggerData: Record<string, unknown>
): Promise<StepResult> {
  const field = asString(config.field)
  if (!field) return { status: "failed", output: {}, error: "update_record requires config.field" }

  const target = getUpdateRecordTarget(triggerType)
  if (!target) {
    return { status: "failed", output: {}, error: `update_record isn't supported for trigger type '${triggerType}'` }
  }

  const recordId = asString(triggerData[target.recordIdField])
  if (!recordId) {
    return { status: "skipped", output: { reason: `trigger_data has no ${target.recordIdField}` } }
  }

  // Defense in depth: never let step config overwrite identity/tenant
  // columns, even though recordId already came from our own trigger's
  // trigger_data for this exact org.
  const safeUpdates: Record<string, unknown> = { [field]: config.value ?? null }
  delete safeUpdates.id
  delete safeUpdates.org_id

  const { error } = await supabase.from(target.table).update(safeUpdates).eq("id", recordId).eq("org_id", orgId)
  if (error) return { status: "failed", output: {}, error: error.message }
  return { status: "completed", output: { table: target.table, record_id: recordId, field, value: config.value } }
}

async function executeNotification(
  supabase: ServiceClient,
  orgId: string,
  config: Record<string, unknown>
): Promise<StepResult> {
  const userId = asString(config.user_id)
  const title = asString(config.title)
  if (!userId || !title) {
    return { status: "failed", output: {}, error: "notification requires config.user_id and config.title" }
  }

  const { error } = await supabase.from("notifications").insert({
    org_id: orgId,
    user_id: userId,
    type: "workflow",
    title,
    message: asString(config.message) ?? null,
  })
  if (error) return { status: "failed", output: {}, error: error.message }
  return { status: "completed", output: { user_id: userId } }
}

interface ResolvedContact {
  id: string
  name: string
  phone: string | null
  email: string | null
}

async function loadContact(supabase: ServiceClient, contactId: string): Promise<ResolvedContact | null> {
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, phone, email")
    .eq("id", contactId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    name: [data.first_name, data.last_name].filter(Boolean).join(" ") || "there",
    phone: data.phone,
    email: data.email,
  }
}

/**
 * Deliberately NOT reusing _shared/messaging.ts's sendSmsAndLog here — that
 * helper logs to ai_employee_actions, whose ai_employee_id column is NOT
 * NULL. A workflow-driven send has no AI Employee behind it, so forcing one
 * in would mean inventing a fake attribution. This logs to `activities`
 * instead (optional AI attribution there), which is the honest fit.
 */
async function executeSendSms(
  supabase: ServiceClient,
  orgId: string,
  config: Record<string, unknown>,
  triggerData: Record<string, unknown>
): Promise<StepResult> {
  const templateName = asString(config.template_name)
  const messageText = asString(config.message_text)
  const explicitPhone = asString(config.to_phone)

  const contactId = await resolveContactId(supabase, orgId, triggerData)
  const contact = contactId ? await loadContact(supabase, contactId) : null
  const phone = explicitPhone ?? contact?.phone ?? undefined

  if (!phone) {
    return { status: "skipped", output: { reason: "No phone number available for this step." } }
  }

  const usageCheck = await checkUsageLimits(supabase, orgId, "sms")
  if (!usageCheck.allowed) {
    return {
      status: "skipped",
      output: { reason: "Usage is more than 2x the plan's included SMS allowance and auto-pause is enabled." },
    }
  }

  let content: string
  if (templateName) {
    const { data: template, error: templateError } = await supabase
      .from("sms_templates")
      .select("content")
      .eq("org_id", orgId)
      .eq("name", templateName)
      .maybeSingle()
    if (templateError) return { status: "failed", output: {}, error: templateError.message }
    if (!template) return { status: "failed", output: {}, error: `Unknown SMS template: ${templateName}` }

    const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle()
    content = renderTemplate(template.content, {
      contact_name: contact?.name ?? "there",
      business_name: org?.name ?? "our business",
    })
  } else if (messageText) {
    content = messageText
  } else {
    return { status: "failed", output: {}, error: "send_sms requires config.template_name or config.message_text" }
  }

  try {
    const result = await sendSmsViaTwilio(phone, content)
    await recordUsage(supabase, orgId, { sms: 1 })
    if (contactId) {
      await supabase.from("activities").insert({
        org_id: orgId,
        type: "sms",
        description: `Workflow sent SMS: ${content.slice(0, 100)}`,
        related_to_type: "contact",
        related_to_id: contactId,
      })
    }
    return { status: "completed", output: { message_id: result.sid, to: phone } }
  } catch (error) {
    const message = error instanceof TwilioApiError || error instanceof Error ? error.message : "Failed to send SMS"
    return { status: "failed", output: {}, error: message }
  }
}

async function executeSendEmail(
  supabase: ServiceClient,
  orgId: string,
  config: Record<string, unknown>,
  triggerData: Record<string, unknown>
): Promise<StepResult> {
  const templateName = asString(config.template_name)
  const subjectArg = asString(config.subject)
  const bodyArg = asString(config.body_text)
  const explicitEmail = asString(config.to_email)

  const contactId = await resolveContactId(supabase, orgId, triggerData)
  const contact = contactId ? await loadContact(supabase, contactId) : null
  const email = explicitEmail ?? contact?.email ?? undefined

  if (!email) {
    return { status: "skipped", output: { reason: "No email address available for this step." } }
  }

  let subject: string
  let body: string
  if (templateName) {
    const template = EMAIL_TEMPLATES[templateName]
    if (!template) return { status: "failed", output: {}, error: `Unknown email template: ${templateName}` }

    const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle()
    const vars = { contact_name: contact?.name ?? "there", business_name: org?.name ?? "our business" }
    subject = renderTemplate(template.subject, vars)
    body = renderTemplate(template.body, vars)
  } else if (subjectArg && bodyArg) {
    subject = subjectArg
    body = bodyArg
  } else {
    return {
      status: "failed",
      output: {},
      error: "send_email requires config.template_name or both config.subject and config.body_text",
    }
  }

  try {
    const result = await sendEmailViaResend(email, subject, body)
    if (contactId) {
      await supabase.from("activities").insert({
        org_id: orgId,
        type: "email",
        description: `Workflow sent email: ${subject}`,
        related_to_type: "contact",
        related_to_id: contactId,
      })
    }
    return { status: "completed", output: { message_id: result.id, to: email } }
  } catch (error) {
    const message = error instanceof ResendApiError || error instanceof Error ? error.message : "Failed to send email"
    return { status: "failed", output: {}, error: message }
  }
}

async function executeAiCall(
  supabase: ServiceClient,
  orgId: string,
  runId: string,
  stepId: string,
  config: Record<string, unknown>,
  triggerData: Record<string, unknown>
): Promise<StepResult> {
  const employeeId = asString(config.ai_employee_id)
  if (!employeeId) {
    return {
      status: "failed",
      output: {},
      error: "ai_call requires config.ai_employee_id — select an AI Employee for this step.",
    }
  }

  const { data: employee } = await supabase
    .from("ai_employees")
    .select("id, phone_number, retell_agent_id")
    .eq("id", employeeId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (!employee?.phone_number || !employee?.retell_agent_id) {
    return {
      status: "failed",
      output: {},
      error: "The selected AI Employee isn't fully configured for outbound calling (missing phone number or Retell agent).",
    }
  }

  const contactId = await resolveContactId(supabase, orgId, triggerData)
  const contact = contactId ? await loadContact(supabase, contactId) : null
  if (!contact?.phone) {
    return { status: "skipped", output: { reason: "No phone number available for this step." } }
  }

  const usageCheck = await checkUsageLimits(supabase, orgId, "calls")
  if (!usageCheck.allowed) {
    return {
      status: "skipped",
      output: { reason: "Usage is more than 2x the plan's included call allowance and auto-pause is enabled." },
    }
  }

  const instructions = asString(config.instructions)

  try {
    const result = await createPhoneCall({
      fromNumber: employee.phone_number,
      toNumber: contact.phone,
      overrideAgentId: employee.retell_agent_id,
      dynamicVariables: {
        contact_name: contact.name,
        ...(instructions ? { workflow_instructions: instructions } : {}),
      },
      // Tagged for traceability only (shows up against the call in Retell's
      // own dashboard) — nothing reads metadata.workflow_run_id back out of
      // retell-call-webhook the way campaign_contact_id is for campaigns.
      // Feeding this call's outcome back into THIS run's condition data
      // (a real 'call_answered' field) needs a step-output data pipe the
      // engine doesn't have — see the honesty notes on the workflow
      // templates that reference call_answered/interested.
      metadata: { workflow_run_id: runId, workflow_step_id: stepId },
    })
    return { status: "completed", output: { retell_call_id: result.call_id, to: contact.phone } }
  } catch (error) {
    const message = error instanceof RetellApiError || error instanceof Error ? error.message : "Failed to place call"
    return { status: "failed", output: {}, error: message }
  }
}

const BLOCKED_WEBHOOK_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?fc00:/i,
  /^\[?fe80:/i,
]

function isBlockedWebhookHost(hostname: string): boolean {
  return BLOCKED_WEBHOOK_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname))
}

/**
 * Basic hostname-literal filtering only — blocks obvious localhost/private-IP
 * literals written into the URL itself. This is NOT DNS-rebinding-safe: a
 * public-looking hostname that resolves to a private IP at request time
 * would sail through. Real SSRF protection for arbitrary user-supplied URLs
 * needs an egress allowlist/proxy sitting in front of outbound requests,
 * which is outside what a single Edge Function can do.
 */
async function executeWebhook(
  config: Record<string, unknown>,
  triggerData: Record<string, unknown>
): Promise<StepResult> {
  const urlStr = asString(config.url)
  if (!urlStr) return { status: "failed", output: {}, error: "webhook requires config.url" }

  let url: URL
  try {
    url = new URL(urlStr)
  } catch {
    return { status: "failed", output: {}, error: "config.url is not a valid URL" }
  }
  if (url.protocol !== "https:") {
    return { status: "failed", output: {}, error: "webhook URLs must use https://" }
  }
  if (isBlockedWebhookHost(url.hostname)) {
    return {
      status: "failed",
      output: {},
      error: "This URL points at a private/internal address and can't be called from a workflow.",
    }
  }

  const method = (asString(config.method) ?? "POST").toUpperCase()
  const extraHeaders =
    config.headers && typeof config.headers === "object" && !Array.isArray(config.headers)
      ? (config.headers as Record<string, unknown>)
      : {}
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (typeof value === "string") headers[key] = value
  }

  const bodyPayload =
    config.body && typeof config.body === "object" && !Array.isArray(config.body)
      ? config.body
      : { trigger_data: triggerData }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(bodyPayload),
      signal: controller.signal,
    })
    const text = await response.text()
    if (!response.ok) {
      return {
        status: "failed",
        output: { status_code: response.status, response_body: text.slice(0, 500) },
        error: `Webhook responded ${response.status}`,
      }
    }
    return { status: "completed", output: { status_code: response.status, response_body: text.slice(0, 500) } }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook request failed"
    return { status: "failed", output: {}, error: message }
  } finally {
    clearTimeout(timeout)
  }
}

async function executeStep(
  supabase: ServiceClient,
  orgId: string,
  triggerType: string,
  runId: string,
  step: WorkflowStep,
  triggerData: Record<string, unknown>,
  conditionContext: Record<string, unknown>
): Promise<StepResult> {
  switch (step.type) {
    case "create_task":
      return await executeCreateTask(supabase, orgId, step.config, triggerData)
    case "update_record":
      return await executeUpdateRecord(supabase, orgId, triggerType, step.config, triggerData)
    case "notification":
      return await executeNotification(supabase, orgId, step.config)
    case "send_sms":
      return await executeSendSms(supabase, orgId, step.config, triggerData)
    case "send_email":
      return await executeSendEmail(supabase, orgId, step.config, triggerData)
    case "ai_call":
      return await executeAiCall(supabase, orgId, runId, step.id, step.config, triggerData)
    case "webhook":
      return await executeWebhook(step.config, triggerData)
    case "condition": {
      const result = evaluateCondition(step.config as unknown as StepCondition, conditionContext)
      return { status: "completed", output: { result } }
    }
    default:
      return { status: "failed", output: {}, error: `Unknown step type: ${step.type}` }
  }
}

async function runStepWithRetry(
  supabase: ServiceClient,
  orgId: string,
  triggerType: string,
  runId: string,
  step: WorkflowStep,
  triggerData: Record<string, unknown>,
  conditionContext: Record<string, unknown>
): Promise<{ result: StepResult; attempts: number }> {
  let attempts = 0
  let result: StepResult
  while (true) {
    attempts += 1
    result = await executeStep(supabase, orgId, triggerType, runId, step, triggerData, conditionContext)
    const canRetry = result.status === "failed" && RETRYABLE_STEP_TYPES.has(step.type) && attempts < MAX_ATTEMPTS
    if (!canRetry) break
    const delayMs = 1000 * 2 ** (attempts - 1) + Math.random() * 250
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return { result, attempts }
}

/** Duration wait: now + value. Relative-to-trigger-field wait: the named
 *  trigger_data timestamp minus offset_minutes (negative offset = after).
 *  A resume time already in the past (e.g. an appointment that's already
 *  started) is intentionally NOT special-cased into an immediate synchronous
 *  continuation — it's simply picked up on the resumer's next ~1-minute
 *  tick, same as any other due task, keeping this one code path uniform. */
function computeResumeAt(
  config: Record<string, unknown>,
  triggerData: Record<string, unknown>
): { date: Date } | { error: string } {
  const mode = asString(config.mode) ?? "duration"

  if (mode === "relative_to_trigger_field") {
    const field = asString(config.field)
    const offsetMinutes = asNumber(config.offset_minutes) ?? 0
    if (!field) return { error: "wait (relative_to_trigger_field) requires config.field" }
    const raw = getByPath(triggerData, field)
    const ts = typeof raw === "string" ? Date.parse(raw) : NaN
    if (Number.isNaN(ts)) return { error: `trigger_data has no usable timestamp at '${field}'` }
    return { date: new Date(ts - offsetMinutes * 60_000) }
  }

  const value = asNumber(config.duration_value)
  const unit = asString(config.duration_unit) ?? "minutes"
  if (!value || value <= 0) return { error: "wait requires config.duration_value to be a positive number" }
  const ms = unit === "days" ? value * 86_400_000 : unit === "hours" ? value * 3_600_000 : value * 60_000
  return { date: new Date(Date.now() + ms) }
}

interface RunResult {
  status: "completed" | "failed" | "waiting"
  stepsCompleted: number
  error?: string
}

async function runWorkflow(
  supabase: ServiceClient,
  runId: string,
  orgId: string,
  triggerType: string,
  steps: WorkflowStep[],
  triggerData: Record<string, unknown>,
  conditionContext: Record<string, unknown>,
  startStepId: string | undefined,
  stepsAlreadyCompleted: number
): Promise<RunResult> {
  const stepsById = new Map(steps.map((step) => [step.id, step]))
  let current: WorkflowStep | undefined = startStepId ? stepsById.get(startStepId) : steps[0]
  let stepsCompleted = stepsAlreadyCompleted
  let iterations = 0

  while (current) {
    iterations += 1
    if (iterations > MAX_STEPS) {
      return { status: "failed", stepsCompleted, error: `Exceeded ${MAX_STEPS} steps — check for a next_step_id cycle.` }
    }

    const step: WorkflowStep = current
    const startedAt = new Date().toISOString()

    const { data: runStep, error: runStepError } = await supabase
      .from("workflow_run_steps")
      .insert({ workflow_run_id: runId, step_id: step.id, status: "running", input: step.config, started_at: startedAt })
      .select("id")
      .single()

    if (runStepError || !runStep) {
      return { status: "failed", stepsCompleted, error: runStepError?.message ?? "Failed to record step" }
    }

    if (step.type === "wait") {
      const resume = computeResumeAt(step.config, triggerData)
      if ("error" in resume) {
        await supabase
          .from("workflow_run_steps")
          .update({ status: "failed", error: resume.error, completed_at: new Date().toISOString() })
          .eq("id", runStep.id)
        return { status: "failed", stepsCompleted, error: resume.error }
      }

      if (!step.next_step_id) {
        // Nothing after the wait — there's nothing to actually resume to,
        // so this is the end of the workflow rather than a scheduled resume
        // with no destination.
        await supabase
          .from("workflow_run_steps")
          .update({
            status: "completed",
            output: { note: "Wait step has no next step; nothing to resume." },
            completed_at: new Date().toISOString(),
          })
          .eq("id", runStep.id)
        stepsCompleted += 1
        await supabase.from("workflow_runs").update({ current_step_id: step.id, steps_completed: stepsCompleted }).eq("id", runId)
        return { status: "completed", stepsCompleted }
      }

      const { error: scheduleError } = await supabase.from("scheduled_tasks").insert({
        workflow_run_id: runId,
        resume_step_id: step.next_step_id,
        resume_at: resume.date.toISOString(),
      })
      if (scheduleError) {
        await supabase
          .from("workflow_run_steps")
          .update({ status: "failed", error: scheduleError.message, completed_at: new Date().toISOString() })
          .eq("id", runStep.id)
        return { status: "failed", stepsCompleted, error: scheduleError.message }
      }

      await supabase
        .from("workflow_run_steps")
        .update({
          status: "completed",
          output: { resumes_at: resume.date.toISOString() },
          completed_at: new Date().toISOString(),
        })
        .eq("id", runStep.id)

      stepsCompleted += 1
      await supabase.from("workflow_runs").update({ current_step_id: step.id, steps_completed: stepsCompleted }).eq("id", runId)

      return { status: "waiting", stepsCompleted }
    }

    let result: StepResult
    let attempts = 1
    if (!evaluateCondition(step.condition, conditionContext)) {
      result = { status: "skipped", output: { reason: "Step condition evaluated false." } }
    } else {
      const retried = await runStepWithRetry(supabase, orgId, triggerType, runId, step, triggerData, conditionContext)
      result = retried.result
      attempts = retried.attempts
    }

    await supabase
      .from("workflow_run_steps")
      .update({
        status: result.status,
        output: result.output,
        error: result.error ?? null,
        attempts,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runStep.id)

    stepsCompleted += 1
    await supabase
      .from("workflow_runs")
      .update({ current_step_id: step.id, steps_completed: stepsCompleted })
      .eq("id", runId)

    if (result.status === "failed") {
      return { status: "failed", stepsCompleted, error: result.error }
    }

    if (step.type === "condition" && result.status === "completed") {
      // executeStep's "condition" case already put the boolean evaluation in
      // result.output.result — reuse it rather than evaluating twice.
      const branchTaken = Boolean((result.output as Record<string, unknown>).result)
      const nextId = branchTaken ? step.yes_next_step_id : step.no_next_step_id
      current = nextId ? stepsById.get(nextId) : undefined
    } else {
      current = step.next_step_id ? stepsById.get(step.next_step_id) : undefined
    }
  }

  return { status: "completed", stepsCompleted }
}

/** Every workflow that fails gets a notification to every org owner/admin —
 *  the closest thing this app has to "the people responsible for this
 *  org's automations." */
function notifyOrgAdminsOfFailure(
  supabase: ServiceClient,
  orgId: string,
  workflowName: string,
  runId: string,
  errorMessage: string
): Promise<void> {
  return notifyOrgAdmins(supabase, orgId, {
    type: "workflow_failed",
    title: `Workflow "${workflowName}" failed`,
    message: errorMessage,
    relatedToType: "workflow_run",
    relatedToId: runId,
  })
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
    console.error("workflow-executor: WORKFLOW_TRIGGER_SECRET is not configured")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }
  if (req.headers.get("X-Workflow-Trigger-Secret") !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  let workflowRunId: string | undefined
  let resumeStepId: string | undefined
  try {
    const body = await req.json()
    workflowRunId = body.workflow_run_id
    resumeStepId = body.resume_step_id
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }
  if (!workflowRunId) {
    return jsonResponse({ error: "workflow_run_id is required" }, 400)
  }

  const supabase = createServiceRoleClient()

  // Atomic claim — see the concurrency note at the top of this file. Only
  // an invocation that successfully flips the run from the state it expects
  // to find it in gets to process it.
  const expectedPriorStatus = resumeStepId ? "waiting" : "running"
  const { data: claimedRuns, error: claimError } = await supabase
    .from("workflow_runs")
    .update({ status: "running" })
    .eq("id", workflowRunId)
    .eq("status", expectedPriorStatus)
    .select("id, org_id, workflow_id, trigger_data, steps_completed")

  if (claimError) {
    console.error("workflow-executor: claim failed", claimError)
    return jsonResponse({ error: "Lookup failed" }, 500)
  }
  if (!claimedRuns || claimedRuns.length === 0) {
    return jsonResponse({
      success: true,
      skipped: `run not in '${expectedPriorStatus}' state (already processed, claimed, or cancelled)`,
    })
  }
  const run = claimedRuns[0]

  const { data: workflow, error: workflowError } = await supabase
    .from("workflows")
    .select("name, trigger_type, steps")
    .eq("id", run.workflow_id)
    .maybeSingle()

  if (workflowError || !workflow) {
    await supabase
      .from("workflow_runs")
      .update({ status: "failed", error: "Workflow not found", completed_at: new Date().toISOString() })
      .eq("id", run.id)
    return jsonResponse({ error: "Workflow not found" }, 404)
  }

  const steps = (Array.isArray(workflow.steps) ? workflow.steps : []) as WorkflowStep[]
  const triggerData = (run.trigger_data ?? {}) as Record<string, unknown>

  if (steps.length === 0) {
    await supabase
      .from("workflow_runs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", run.id)
    return jsonResponse({ success: true, status: "completed", steps_completed: 0 })
  }

  if (resumeStepId && !steps.some((s) => s.id === resumeStepId)) {
    await supabase
      .from("workflow_runs")
      .update({
        status: "failed",
        error: `resume_step_id '${resumeStepId}' not found in workflow`,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id)
    return jsonResponse({ error: "resume_step_id not found" }, 400)
  }

  const conditionContext = await buildConditionContext(supabase, run.org_id, triggerData)

  const result = await runWorkflow(
    supabase,
    run.id,
    run.org_id,
    workflow.trigger_type,
    steps,
    triggerData,
    conditionContext,
    resumeStepId,
    run.steps_completed ?? 0
  )

  if (result.status === "waiting") {
    await supabase.from("workflow_runs").update({ status: "waiting" }).eq("id", run.id)
  } else {
    await supabase
      .from("workflow_runs")
      .update({ status: result.status, error: result.error ?? null, completed_at: new Date().toISOString() })
      .eq("id", run.id)

    if (result.status === "failed") {
      await notifyOrgAdminsOfFailure(supabase, run.org_id, workflow.name, run.id, result.error ?? "Unknown error")
    }
  }

  return jsonResponse({ success: true, status: result.status, steps_completed: result.stepsCompleted })
})
