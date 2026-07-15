// Supabase Edge Function: retell-call-webhook
//
// Configure this as the `webhook_url` on every Retell agent. Retell posts
// call_started, call_ended, and call_analyzed events here over the life of
// a single call. Authenticated via the `X-Retell-Signature` header (HMAC-
// SHA256 over raw_body+timestamp, keyed with RETELL_API_KEY) — see
// _shared/retell-webhook-verify.ts. No Apex user session exists at this
// point, so all DB access uses the service-role client.
//
// Idempotency: `calls.retell_call_id` and `call_transcripts.call_id` are
// unique (migration 0004), so every write here is an upsert keyed on those
// columns — a redelivered webhook lands on the same row instead of creating
// a duplicate. call_started specifically uses `ignoreDuplicates` so a
// redelivered/out-of-order call_started can never regress a call that's
// already progressed past it.
//
// Handles calls whose call_started webhook was lost or arrived out of order:
// call_ended/call_analyzed check whether the row already exists before
// upserting, and only fire the "first time we've seen this call" side
// effects (ai_employee_actions row, activity row, total_calls increment) if
// it didn't.
//
// Post-call auto-follow-ups (missed call / appointment booked / lead
// qualified) live here too, gated by their own idempotency check — separate
// from `alreadyExisted` above, since a call's outcome/status can only be
// known once call_ended/call_analyzed actually run, by which point the call
// row itself almost always already exists.

import { formatDateLabel, formatTimeLabel } from "../_shared/appointment-scheduling.ts"
import { computeDurationSeconds, deriveCallOutcome, deriveCallStatus, getExternalPhoneNumber, mapSentiment } from "../_shared/call-mapping.ts"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { sendSmsAndLog } from "../_shared/messaging.ts"
import { verifyRetellSignature } from "../_shared/retell-webhook-verify.ts"
import { createServiceRoleClient } from "../_shared/supabase-admin.ts"
import type { AiEmployeeRow, RetellCall, RetellCallWebhookPayload } from "../_shared/types.ts"

type ServiceClient = ReturnType<typeof createServiceRoleClient>

async function findOrCreatePlaceholderContact(
  supabase: ServiceClient,
  orgId: string,
  phone: string | null
): Promise<string | null> {
  if (!phone) return null

  const { data: existing, error: findError } = await supabase
    .from("contacts")
    .select("id")
    .eq("org_id", orgId)
    .eq("phone", phone)
    .maybeSingle()

  if (findError) {
    console.error("retell-call-webhook: contact lookup failed", findError)
    return null
  }
  if (existing) return existing.id

  const { data: created, error: createError } = await supabase
    .from("contacts")
    .insert({ org_id: orgId, phone })
    .select("id")
    .single()

  if (createError) {
    console.error("retell-call-webhook: failed to create placeholder contact", createError)
    return null
  }
  return created.id
}

interface BaseCallFields {
  org_id: string
  ai_employee_id: string
  retell_call_id: string
  contact_id: string | null
  caller_phone: string | null
  direction: "inbound" | "outbound"
}

async function buildBaseCallFields(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  call: RetellCall
): Promise<BaseCallFields> {
  const externalPhone = getExternalPhoneNumber(call)
  const contactId = await findOrCreatePlaceholderContact(supabase, employee.org_id, externalPhone)
  return {
    org_id: employee.org_id,
    ai_employee_id: employee.id,
    retell_call_id: call.call_id,
    contact_id: contactId,
    caller_phone: externalPhone,
    direction: call.direction === "outbound" ? "outbound" : "inbound",
  }
}

async function callRowExists(supabase: ServiceClient, retellCallId: string): Promise<boolean> {
  const { data } = await supabase.from("calls").select("id").eq("retell_call_id", retellCallId).maybeSingle()
  return Boolean(data)
}

/** ai_employee_actions + activities + total_calls bump — only for the first
 *  event we ever see for a given call, from whichever webhook happens to
 *  arrive first. */
async function recordCallAnsweredSideEffects(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  callRowId: string,
  contactId: string | null,
  callerPhone: string | null
): Promise<void> {
  const description = `Answered call from ${callerPhone ?? "an unknown number"}`

  const { error: actionError } = await supabase.from("ai_employee_actions").insert({
    org_id: employee.org_id,
    ai_employee_id: employee.id,
    action_type: "call_answered",
    description,
    related_to_type: "call",
    related_to_id: callRowId,
    // Direct contact_id (in addition to the related_to_type='call' pointer)
    // is what lets the Contact Detail "Conversations" tab query "every AI
    // action involving this contact" without joining through calls each time.
    contact_id: contactId,
  })
  if (actionError) console.error("retell-call-webhook: failed to insert ai_employee_action", actionError)

  if (contactId) {
    const { error: activityError } = await supabase.from("activities").insert({
      org_id: employee.org_id,
      type: "call",
      description,
      performed_by_ai: true,
      ai_employee_id: employee.id,
      related_to_type: "contact",
      related_to_id: contactId,
    })
    if (activityError) console.error("retell-call-webhook: failed to insert activity", activityError)
  }

  const { error: incrementError } = await supabase.rpc("increment_ai_employee_calls", {
    p_ai_employee_id: employee.id,
  })
  if (incrementError) {
    console.error("retell-call-webhook: failed to increment total_calls", incrementError)
  }
}

// --- post-call auto follow-ups ---
// sendSmsAndLog() itself is idempotent-agnostic — it just sends and logs
// whatever it's asked to — so each trigger below guards itself against
// Retell's at-least-once redelivery by checking for an existing sms_sent
// action against this call before sending anything.

async function getOrgName(supabase: ServiceClient, orgId: string): Promise<string> {
  const { data } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle()
  return data?.name ?? "our business"
}

async function hasFollowUpAlreadyBeenSent(supabase: ServiceClient, callRowId: string): Promise<boolean> {
  const { count } = await supabase
    .from("ai_employee_actions")
    .select("id", { count: "exact", head: true })
    .eq("related_to_type", "call")
    .eq("related_to_id", callRowId)
    .eq("action_type", "sms_sent")
  return (count ?? 0) > 0
}

async function triggerMissedCallRecoverySms(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  callRowId: string,
  callerPhone: string | null,
  contactId: string | null
): Promise<void> {
  if (!callerPhone) return
  if (await hasFollowUpAlreadyBeenSent(supabase, callRowId)) return

  try {
    await sendSmsAndLog({
      supabase,
      employee,
      businessName: await getOrgName(supabase, employee.org_id),
      toPhone: callerPhone,
      templateName: "missed_call_recovery",
      contactId,
      callRowId,
      descriptionOverride: `Sent automatic missed-call follow-up SMS to ${callerPhone}`,
    })
  } catch (error) {
    console.error("retell-call-webhook: missed-call follow-up SMS failed", error)
  }
}

async function triggerAppointmentConfirmationSms(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  callRowId: string,
  contactId: string | null
): Promise<void> {
  if (!contactId) return
  if (await hasFollowUpAlreadyBeenSent(supabase, callRowId)) return

  const { data: contact } = await supabase.from("contacts").select("phone").eq("id", contactId).maybeSingle()
  if (!contact?.phone) return

  const { data: appointment } = await supabase
    .from("appointments")
    .select("start_time")
    .eq("org_id", employee.org_id)
    .eq("contact_id", contactId)
    .in("status", ["scheduled", "confirmed"])
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!appointment) return

  try {
    await sendSmsAndLog({
      supabase,
      employee,
      businessName: await getOrgName(supabase, employee.org_id),
      toPhone: contact.phone,
      templateName: "appointment_confirmation",
      contactId,
      callRowId,
      appointmentVars: {
        appointment_date: formatDateLabel(appointment.start_time),
        appointment_time: formatTimeLabel(appointment.start_time),
      },
      descriptionOverride: `Sent automatic appointment confirmation SMS to ${contact.phone}`,
    })
  } catch (error) {
    console.error("retell-call-webhook: appointment confirmation SMS failed", error)
  }
}

async function triggerQualifiedLeadThankYouSms(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  callRowId: string,
  callerPhone: string | null,
  callStartedAt: string | undefined,
  contactId: string | null
): Promise<void> {
  if (!callerPhone || !callStartedAt) return
  if (await hasFollowUpAlreadyBeenSent(supabase, callRowId)) return

  // Best-effort match, not a hard link: ai_employee_actions has no call_id
  // column, so there's no direct FK from "this call" to "the lead qualified
  // during it" (qualify_lead's action row is only linked to the lead). A
  // qualified lead at this caller's phone number, updated no earlier than
  // when this call started, is close enough to trigger a thank-you text
  // without a schema change — imprecise only if the same caller had two
  // calls in quick succession.
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("org_id", employee.org_id)
    .eq("phone", callerPhone)
    .eq("status", "qualified")
    .gte("updated_at", callStartedAt)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!lead) return

  try {
    await sendSmsAndLog({
      supabase,
      employee,
      businessName: await getOrgName(supabase, employee.org_id),
      toPhone: callerPhone,
      templateName: "thank_you",
      contactId,
      callRowId,
      descriptionOverride: `Sent automatic thank-you SMS to qualified lead at ${callerPhone}`,
    })
  } catch (error) {
    console.error("retell-call-webhook: qualified-lead thank-you SMS failed", error)
  }
}

// --- campaign outcome resolution ---
// process-campaign-batch tags every outbound campaign call with
// metadata: { campaign_id, campaign_contact_id } at creation time — Retell
// echoes metadata back in every webhook event for that call, so this is how
// a campaign_contacts row ever leaves 'in_progress'. Gated on the row still
// being 'in_progress' (not a separate table): a redelivered call_analyzed
// event for an already-resolved campaign_contact is a no-op instead of
// double-counting the campaign's stats.
async function updateCampaignContactFromCall(
  supabase: ServiceClient,
  call: RetellCall,
  status: string,
  outcome: string | null
): Promise<void> {
  const campaignContactId = call.metadata?.campaign_contact_id
  if (typeof campaignContactId !== "string") return

  const { data: campaignContact } = await supabase
    .from("campaign_contacts")
    .select("id, campaign_id, status")
    .eq("id", campaignContactId)
    .maybeSingle()

  if (!campaignContact || campaignContact.status !== "in_progress") return

  let newStatus: string
  if (outcome === "appointment_booked") newStatus = "converted"
  else if (status === "missed" || status === "voicemail" || status === "failed") newStatus = "failed"
  else if (outcome === "qualified" || outcome === "info_request") newStatus = "responded"
  else newStatus = "contacted"

  const { error: updateError } = await supabase
    .from("campaign_contacts")
    .update({ status: newStatus, outcome: call.call_analysis?.call_summary ?? null })
    .eq("id", campaignContact.id)
  if (updateError) {
    console.error("retell-call-webhook: failed to update campaign_contact", updateError)
    return
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("contacts_processed, contacts_responded, appointments_booked")
    .eq("id", campaignContact.campaign_id)
    .maybeSingle()
  if (!campaign) return

  const campaignUpdates: Record<string, number> = {
    contacts_processed: campaign.contacts_processed + 1,
  }
  if (newStatus === "responded" || newStatus === "converted") {
    campaignUpdates.contacts_responded = campaign.contacts_responded + 1
  }
  if (newStatus === "converted") {
    campaignUpdates.appointments_booked = campaign.appointments_booked + 1
  }

  const { error: campaignError } = await supabase
    .from("campaigns")
    .update(campaignUpdates)
    .eq("id", campaignContact.campaign_id)
  if (campaignError) {
    console.error("retell-call-webhook: failed to update campaign stats", campaignError)
  }

  const { count: remaining } = await supabase
    .from("campaign_contacts")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignContact.campaign_id)
    .in("status", ["pending", "in_progress"])

  if ((remaining ?? 0) === 0) {
    await supabase
      .from("campaigns")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", campaignContact.campaign_id)
  }
}

async function handleCallStarted(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  call: RetellCall
): Promise<Response> {
  const base = await buildBaseCallFields(supabase, employee, call)

  const { data: rows, error } = await supabase
    .from("calls")
    .upsert(
      {
        ...base,
        status: "active",
        started_at: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : new Date().toISOString(),
      },
      { onConflict: "retell_call_id", ignoreDuplicates: true }
    )
    .select("id")

  if (error) {
    console.error("retell-call-webhook: call_started upsert failed", error)
    return jsonResponse({ error: "Failed to record call" }, 500)
  }

  // ignoreDuplicates means `rows` is only populated when this insert actually
  // happened — empty means a redelivery of a call_started we already have.
  if (rows && rows.length > 0) {
    await recordCallAnsweredSideEffects(supabase, employee, rows[0].id, base.contact_id, base.caller_phone)
  }

  return jsonResponse({ success: true })
}

async function handleCallEnded(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  call: RetellCall
): Promise<Response> {
  const alreadyExisted = await callRowExists(supabase, call.call_id)
  const base = await buildBaseCallFields(supabase, employee, call)
  const status = deriveCallStatus(call.call_status, call.disconnection_reason)
  const startedAt = call.start_timestamp ? new Date(call.start_timestamp).toISOString() : undefined
  const endedAt = call.end_timestamp ? new Date(call.end_timestamp).toISOString() : new Date().toISOString()

  const { data: rows, error } = await supabase
    .from("calls")
    .upsert(
      {
        ...base,
        status,
        duration_seconds: computeDurationSeconds(call.start_timestamp, call.end_timestamp),
        started_at: startedAt,
        ended_at: endedAt,
      },
      { onConflict: "retell_call_id" }
    )
    .select("id")
    .single()

  if (error) {
    console.error("retell-call-webhook: call_ended upsert failed", error)
    return jsonResponse({ error: "Failed to update call" }, 500)
  }

  if (!alreadyExisted) {
    // call_started never arrived (lost, or delivered out of order) — this is
    // the first time we're recording this call at all.
    await recordCallAnsweredSideEffects(supabase, employee, rows.id, base.contact_id, base.caller_phone)
  }

  if (status === "missed") {
    await triggerMissedCallRecoverySms(supabase, employee, rows.id, base.caller_phone, base.contact_id)
  }

  return jsonResponse({ success: true })
}

async function handleCallAnalyzed(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  call: RetellCall
): Promise<Response> {
  const alreadyExisted = await callRowExists(supabase, call.call_id)
  const base = await buildBaseCallFields(supabase, employee, call)
  const status = deriveCallStatus(call.call_status, call.disconnection_reason)
  const outcome = deriveCallOutcome(call.disconnection_reason, call.call_analysis)
  const startedAt = call.start_timestamp ? new Date(call.start_timestamp).toISOString() : undefined
  const endedAt = call.end_timestamp ? new Date(call.end_timestamp).toISOString() : undefined

  const { data: row, error } = await supabase
    .from("calls")
    .upsert(
      {
        ...base,
        status,
        duration_seconds: computeDurationSeconds(call.start_timestamp, call.end_timestamp),
        started_at: startedAt,
        ended_at: endedAt,
        summary: call.call_analysis?.call_summary ?? null,
        sentiment: mapSentiment(call.call_analysis?.user_sentiment),
        outcome,
        recording_url: call.recording_url ?? null,
      },
      { onConflict: "retell_call_id" }
    )
    .select("id")
    .single()

  if (error) {
    console.error("retell-call-webhook: call_analyzed upsert failed", error)
    return jsonResponse({ error: "Failed to update call analysis" }, 500)
  }

  if (!alreadyExisted) {
    await recordCallAnsweredSideEffects(supabase, employee, row.id, base.contact_id, base.caller_phone)
  }

  if (outcome === "appointment_booked") {
    await triggerAppointmentConfirmationSms(supabase, employee, row.id, base.contact_id)
  } else {
    await triggerQualifiedLeadThankYouSms(
      supabase,
      employee,
      row.id,
      base.caller_phone,
      startedAt,
      base.contact_id
    )
  }

  await updateCampaignContactFromCall(supabase, call, status, outcome)

  if (call.transcript_object && call.transcript_object.length > 0) {
    const { error: transcriptError } = await supabase.from("call_transcripts").upsert(
      {
        org_id: employee.org_id,
        call_id: row.id,
        content: call.transcript_object,
      },
      { onConflict: "call_id" }
    )
    if (transcriptError) {
      console.error("retell-call-webhook: failed to save transcript", transcriptError)
    }
  }

  return jsonResponse({ success: true })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const retellApiKey = Deno.env.get("RETELL_API_KEY")
  if (!retellApiKey) {
    console.error("retell-call-webhook: RETELL_API_KEY is not configured")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  const rawBody = await req.text()

  const signatureValid = await verifyRetellSignature(
    rawBody,
    req.headers.get("X-Retell-Signature"),
    retellApiKey
  )
  if (!signatureValid) {
    return jsonResponse({ error: "Invalid signature" }, 401)
  }

  let payload: RetellCallWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const call = payload.call
  if (!call?.call_id || !call?.agent_id) {
    return jsonResponse({ error: "Missing call_id/agent_id" }, 400)
  }

  const supabase = createServiceRoleClient()

  const { data: employee, error: employeeError } = await supabase
    .from("ai_employees")
    .select("*")
    .eq("retell_agent_id", call.agent_id)
    .maybeSingle()

  if (employeeError) {
    console.error("retell-call-webhook: employee lookup failed", employeeError)
    return jsonResponse({ error: "Lookup failed" }, 500)
  }

  if (!employee) {
    // No AI Employee maps to this Retell agent (deleted, or an agent created
    // outside Apex) — nothing to attach this call to. Acknowledge so Retell
    // doesn't keep retrying a call we can never resolve.
    console.warn(`retell-call-webhook: no AI Employee for agent_id ${call.agent_id}`)
    return jsonResponse({ success: true, skipped: "unrecognized agent_id" })
  }

  try {
    switch (payload.event) {
      case "call_started":
        return await handleCallStarted(supabase, employee as AiEmployeeRow, call)
      case "call_ended":
        return await handleCallEnded(supabase, employee as AiEmployeeRow, call)
      case "call_analyzed":
        return await handleCallAnalyzed(supabase, employee as AiEmployeeRow, call)
      default:
        return jsonResponse({ success: true, skipped: `unhandled event: ${payload.event}` })
    }
  } catch (error) {
    console.error("retell-call-webhook: unhandled error", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500)
  }
})
