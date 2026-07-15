// Shared send + log orchestration for send_sms/send_email — used both by
// retell-function-handler (live-call tool invocations) and
// retell-call-webhook (automatic post-call follow-ups). Handles: rendering
// a template (or using the caller-supplied text directly), sending via
// Twilio/Resend, logging an ai_employee_actions row (success OR failure —
// failures are visible in the log, not swallowed), and appending to the
// matching ai_conversations thread on success.

import { EMAIL_TEMPLATES, renderTemplate, type TemplateVariable } from "./message-templates.ts"
import { ResendApiError, sendEmailViaResend } from "./resend-client.ts"
import type { createServiceRoleClient } from "./supabase-admin.ts"
import { sendSmsViaTwilio, TwilioApiError } from "./twilio-client.ts"
import type { AiEmployeeRow } from "./types.ts"
import { checkUsageLimits, recordUsage } from "./usage.ts"

type ServiceClient = ReturnType<typeof createServiceRoleClient>

export interface AppointmentVars {
  appointment_date?: string
  appointment_time?: string
}

export interface SendResult {
  sent: boolean
  messageId?: string
  error?: string
}

async function buildContactName(
  supabase: ServiceClient,
  contactId: string | null | undefined
): Promise<string> {
  if (!contactId) return "there"
  const { data } = await supabase
    .from("contacts")
    .select("first_name, last_name")
    .eq("id", contactId)
    .maybeSingle()
  if (!data) return "there"
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ")
  return name || "there"
}

/** Appends to the most recent active conversation thread for this
 *  org/contact/channel, or starts a new one — ai_conversations is the
 *  intended home for message content (see ConversationsPage), separate from
 *  ai_employee_actions, which is the audit-log/status side. Best-effort:
 *  failures here are logged but never fail the send itself. */
async function appendConversationMessage(
  supabase: ServiceClient,
  params: {
    orgId: string
    aiEmployeeId: string
    contactId: string | null | undefined
    channel: "sms" | "email"
    content: string
    subject?: string
  }
): Promise<void> {
  const { orgId, aiEmployeeId, contactId, channel, content, subject } = params
  const message = {
    role: "ai_employee" as const,
    content,
    timestamp: new Date().toISOString(),
    ...(subject ? { subject } : {}),
  }

  const { data: existing, error: findError } = await supabase
    .from("ai_conversations")
    .select("id, messages")
    .eq("org_id", orgId)
    .eq("contact_id", contactId ?? null)
    .eq("channel", channel)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError) {
    console.error("messaging: conversation lookup failed", findError)
    return
  }

  if (existing) {
    const messages = Array.isArray(existing.messages) ? existing.messages : []
    const { error: updateError } = await supabase
      .from("ai_conversations")
      .update({ messages: [...messages, message] })
      .eq("id", existing.id)
    if (updateError) console.error("messaging: conversation append failed", updateError)
    return
  }

  const { error: insertError } = await supabase.from("ai_conversations").insert({
    org_id: orgId,
    ai_employee_id: aiEmployeeId,
    contact_id: contactId ?? null,
    channel,
    messages: [message],
    status: "active",
  })
  if (insertError) console.error("messaging: conversation insert failed", insertError)
}

async function logMessageAction(
  supabase: ServiceClient,
  params: {
    employee: AiEmployeeRow
    actionType: "sms_sent" | "email_sent"
    sent: boolean
    description: string
    contactId: string | null | undefined
    callRowId: string | null | undefined
  }
): Promise<void> {
  const { employee, actionType, sent, description, contactId, callRowId } = params
  const { error } = await supabase.from("ai_employee_actions").insert({
    org_id: employee.org_id,
    ai_employee_id: employee.id,
    action_type: actionType,
    result: sent ? "success" : "failed",
    description,
    related_to_type: callRowId ? "call" : contactId ? "contact" : null,
    related_to_id: callRowId ?? contactId ?? null,
    contact_id: contactId ?? null,
  })
  if (error) console.error("messaging: failed to insert ai_employee_action", error)
}

export interface SendSmsParams {
  supabase: ServiceClient
  employee: AiEmployeeRow
  businessName: string
  toPhone: string
  messageText?: string
  templateName?: string
  contactId?: string | null
  callRowId?: string | null
  appointmentVars?: AppointmentVars
  descriptionOverride?: string
}

export async function sendSmsAndLog(params: SendSmsParams): Promise<SendResult> {
  const { supabase, employee, businessName, toPhone, contactId, callRowId, appointmentVars } = params

  const usageCheck = await checkUsageLimits(supabase, employee.org_id, "sms")
  if (!usageCheck.allowed) {
    const description = `Skipped SMS to ${toPhone} — usage is more than 2x the plan's included SMS allowance and auto-pause is enabled for this organization.`
    await logMessageAction(supabase, {
      employee,
      actionType: "sms_sent",
      sent: false,
      description,
      contactId,
      callRowId,
    })
    return { sent: false, error: description }
  }

  let content: string
  if (params.templateName) {
    const { data: template, error: templateError } = await supabase
      .from("sms_templates")
      .select("content")
      .eq("org_id", employee.org_id)
      .eq("name", params.templateName)
      .maybeSingle()
    if (templateError) {
      console.error("messaging: sms template lookup failed", templateError)
      return { sent: false, error: "Failed to look up template." }
    }
    if (!template) {
      return { sent: false, error: `Unknown SMS template: ${params.templateName}` }
    }
    const contactName = await buildContactName(supabase, contactId)
    const vars: Partial<Record<TemplateVariable, string>> = {
      contact_name: contactName,
      business_name: businessName,
      ai_employee_name: employee.name,
      ...appointmentVars,
    }
    content = renderTemplate(template.content, vars)
  } else if (params.messageText) {
    content = params.messageText
  } else {
    return { sent: false, error: "Either template_name or message_text is required." }
  }

  let messageId: string | undefined
  let sendError: string | undefined
  try {
    const result = await sendSmsViaTwilio(toPhone, content)
    messageId = result.sid
  } catch (error) {
    sendError =
      error instanceof TwilioApiError || error instanceof Error ? error.message : "Unknown error"
    console.error("messaging: Twilio send failed", error)
  }

  const sent = sendError === undefined

  await logMessageAction(supabase, {
    employee,
    actionType: "sms_sent",
    sent,
    description:
      params.descriptionOverride ?? `Sent SMS to ${toPhone}${sent ? "" : ` (failed: ${sendError})`}`,
    contactId,
    callRowId,
  })

  if (sent) {
    await recordUsage(supabase, employee.org_id, { sms: 1 })
    await appendConversationMessage(supabase, {
      orgId: employee.org_id,
      aiEmployeeId: employee.id,
      contactId,
      channel: "sms",
      content,
    })
    return { sent: true, messageId }
  }
  return { sent: false, error: sendError }
}

export interface SendEmailParams {
  supabase: ServiceClient
  employee: AiEmployeeRow
  businessName: string
  toEmail: string
  subject?: string
  bodyText?: string
  templateName?: string
  contactId?: string | null
  callRowId?: string | null
  appointmentVars?: AppointmentVars
  descriptionOverride?: string
}

export async function sendEmailAndLog(params: SendEmailParams): Promise<SendResult> {
  const { supabase, employee, businessName, toEmail, contactId, callRowId, appointmentVars } = params

  let subject: string
  let body: string
  if (params.templateName) {
    const template = EMAIL_TEMPLATES[params.templateName]
    if (!template) {
      return { sent: false, error: `Unknown email template: ${params.templateName}` }
    }
    const contactName = await buildContactName(supabase, contactId)
    const vars: Partial<Record<TemplateVariable, string>> = {
      contact_name: contactName,
      business_name: businessName,
      ai_employee_name: employee.name,
      ...appointmentVars,
    }
    subject = renderTemplate(template.subject, vars)
    body = renderTemplate(template.body, vars)
  } else if (params.subject && params.bodyText) {
    subject = params.subject
    body = params.bodyText
  } else {
    return { sent: false, error: "Either template_name or both subject and body_text are required." }
  }

  let messageId: string | undefined
  let sendError: string | undefined
  try {
    const result = await sendEmailViaResend(toEmail, subject, body)
    messageId = result.id
  } catch (error) {
    sendError =
      error instanceof ResendApiError || error instanceof Error ? error.message : "Unknown error"
    console.error("messaging: Resend send failed", error)
  }

  const sent = sendError === undefined

  await logMessageAction(supabase, {
    employee,
    actionType: "email_sent",
    sent,
    description:
      params.descriptionOverride ?? `Sent email to ${toEmail}${sent ? "" : ` (failed: ${sendError})`}`,
    contactId,
    callRowId,
  })

  if (sent) {
    await appendConversationMessage(supabase, {
      orgId: employee.org_id,
      aiEmployeeId: employee.id,
      contactId,
      channel: "email",
      content: body,
      subject,
    })
    return { sent: true, messageId }
  }
  return { sent: false, error: sendError }
}
