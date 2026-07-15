// Supabase Edge Function: process-campaign-batch
//
// Invoked every 15 minutes by pg_cron (trigger_campaign_batch_processing(),
// migration 0014) via pg_net — no Supabase session, no Retell involved, so
// it's authorized the same way as workflow-executor: the shared
// X-Workflow-Trigger-Secret header, keyed with WORKFLOW_TRIGGER_SECRET.
//
// For every active campaign: checks whether now falls inside its
// schedule_config (days_of_week / time_window / start_date), computes how
// much of today's max_calls_per_day quota is left, and places up to that
// many outbound calls via Retell for 'pending' campaign_contacts. Each call
// is tagged with metadata.campaign_contact_id so retell-call-webhook can
// resolve the outcome once the call concludes — this function only ever
// gets a contact to 'in_progress' (or immediately 'skipped'/'failed' for
// contacts it can't call at all); everything past that point is
// retell-call-webhook's job.
//
// No request body — a single run processes every org's active campaigns in
// one pass, since this is a system-wide cron tick, not scoped to one org.

import { parseHHMM } from "../_shared/appointment-scheduling.ts"
import { getCampaignScript } from "../_shared/campaign-scripts.ts"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { createPhoneCall, RetellApiError } from "../_shared/retell-client.ts"
import { createServiceRoleClient } from "../_shared/supabase-admin.ts"
import type { CampaignRow } from "../_shared/types.ts"
import { checkUsageLimits } from "../_shared/usage.ts"

type ServiceClient = ReturnType<typeof createServiceRoleClient>

const DEFAULT_MAX_CALLS_PER_DAY = 20

function isWithinSchedule(scheduleConfig: Record<string, unknown>, now: Date): boolean {
  const startDate = typeof scheduleConfig.start_date === "string" ? scheduleConfig.start_date : undefined
  if (startDate && now.toISOString().slice(0, 10) < startDate) return false

  const daysOfWeek = Array.isArray(scheduleConfig.days_of_week)
    ? (scheduleConfig.days_of_week as unknown[]).filter((d): d is number => typeof d === "number")
    : undefined
  if (daysOfWeek && daysOfWeek.length > 0 && !daysOfWeek.includes(now.getUTCDay())) return false

  const startTime = typeof scheduleConfig.time_window_start === "string" ? scheduleConfig.time_window_start : undefined
  const endTime = typeof scheduleConfig.time_window_end === "string" ? scheduleConfig.time_window_end : undefined
  if (startTime && endTime) {
    const startMinutes = parseHHMM(startTime)
    const endMinutes = parseHHMM(endTime)
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
    if (startMinutes !== null && endMinutes !== null && (nowMinutes < startMinutes || nowMinutes >= endMinutes)) {
      return false
    }
  }

  return true
}

async function getRemainingDailyQuota(
  supabase: ServiceClient,
  campaignId: string,
  maxPerDay: number
): Promise<number> {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { count } = await supabase
    .from("campaign_contacts")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .gte("last_attempt_at", todayStart.toISOString())

  return Math.max(0, maxPerDay - (count ?? 0))
}

async function markCampaignCompletedIfExhausted(supabase: ServiceClient, campaignId: string): Promise<void> {
  const { count } = await supabase
    .from("campaign_contacts")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "in_progress"])

  if ((count ?? 0) === 0) {
    await supabase
      .from("campaigns")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", campaignId)
  }
}

interface ProcessResult {
  campaignId: string
  placed: number
  skipped?: string
}

async function processCampaign(supabase: ServiceClient, campaign: CampaignRow): Promise<ProcessResult> {
  const scheduleConfig = campaign.schedule_config

  if (!isWithinSchedule(scheduleConfig, new Date())) {
    return { campaignId: campaign.id, placed: 0, skipped: "outside schedule window" }
  }

  const maxPerDay =
    typeof scheduleConfig.max_calls_per_day === "number" && scheduleConfig.max_calls_per_day > 0
      ? scheduleConfig.max_calls_per_day
      : DEFAULT_MAX_CALLS_PER_DAY
  const remaining = await getRemainingDailyQuota(supabase, campaign.id, maxPerDay)
  if (remaining <= 0) {
    return { campaignId: campaign.id, placed: 0, skipped: "daily quota reached" }
  }

  if (!campaign.ai_employee_id) {
    return { campaignId: campaign.id, placed: 0, skipped: "no AI Employee assigned" }
  }

  const { data: employee } = await supabase
    .from("ai_employees")
    .select("id, name, phone_number, retell_agent_id")
    .eq("id", campaign.ai_employee_id)
    .maybeSingle()

  if (!employee?.phone_number || !employee?.retell_agent_id) {
    return { campaignId: campaign.id, placed: 0, skipped: "AI Employee not fully configured for outbound calling" }
  }

  // Checked once per batch, not per contact — usage doesn't meaningfully
  // shift within the few seconds a batch takes to place its calls, and
  // this is a soft signal (only blocks anything if the org opted into
  // auto_pause_on_overage). Contacts stay 'pending' rather than being
  // marked 'skipped' — being blocked by usage is temporary, unlike "no
  // phone number on file", so they're picked back up next tick.
  const usageCheck = await checkUsageLimits(supabase, campaign.org_id, "calls")
  if (!usageCheck.allowed) {
    return { campaignId: campaign.id, placed: 0, skipped: "usage limit reached and auto-pause is enabled" }
  }

  const { data: pendingContacts, error: pendingError } = await supabase
    .from("campaign_contacts")
    .select("id, contact_id, attempts")
    .eq("campaign_id", campaign.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(remaining)

  if (pendingError) {
    console.error(`process-campaign-batch: pending lookup failed for campaign ${campaign.id}`, pendingError)
    return { campaignId: campaign.id, placed: 0, skipped: "lookup failed" }
  }

  if (!pendingContacts || pendingContacts.length === 0) {
    await markCampaignCompletedIfExhausted(supabase, campaign.id)
    return { campaignId: campaign.id, placed: 0, skipped: "no pending contacts" }
  }

  const script = getCampaignScript(campaign.type, campaign.message_templates)
  let placed = 0

  for (const campaignContact of pendingContacts) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, phone")
      .eq("id", campaignContact.contact_id)
      .maybeSingle()

    if (!contact?.phone) {
      await supabase
        .from("campaign_contacts")
        .update({
          status: "skipped",
          outcome: "No phone number on file",
          attempts: campaignContact.attempts + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", campaignContact.id)
      continue
    }

    const { error: markInProgressError } = await supabase
      .from("campaign_contacts")
      .update({
        status: "in_progress",
        attempts: campaignContact.attempts + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", campaignContact.id)
    if (markInProgressError) {
      console.error("process-campaign-batch: failed to mark campaign_contact in_progress", markInProgressError)
      continue
    }

    try {
      const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "there"
      await createPhoneCall({
        fromNumber: employee.phone_number,
        toNumber: contact.phone,
        overrideAgentId: employee.retell_agent_id,
        dynamicVariables: {
          campaign_instructions: script,
          campaign_name: campaign.name,
          contact_name: contactName,
        },
        metadata: { campaign_id: campaign.id, campaign_contact_id: campaignContact.id },
      })
      placed += 1
      // Stays 'in_progress' — retell-call-webhook resolves the final status
      // (contacted/responded/converted/failed) once the call concludes.
    } catch (error) {
      const message =
        error instanceof RetellApiError || error instanceof Error ? error.message : "Failed to place call"
      console.error(`process-campaign-batch: call failed for campaign_contact ${campaignContact.id}`, error)
      await supabase
        .from("campaign_contacts")
        .update({ status: "failed", outcome: message })
        .eq("id", campaignContact.id)
    }
  }

  return { campaignId: campaign.id, placed }
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
    console.error("process-campaign-batch: WORKFLOW_TRIGGER_SECRET is not configured")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }
  if (req.headers.get("X-Workflow-Trigger-Secret") !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  const supabase = createServiceRoleClient()

  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("status", "active")

  if (campaignsError) {
    console.error("process-campaign-batch: failed to load active campaigns", campaignsError)
    return jsonResponse({ error: "Failed to load campaigns" }, 500)
  }

  const results: ProcessResult[] = []
  for (const campaign of (campaigns ?? []) as CampaignRow[]) {
    try {
      results.push(await processCampaign(supabase, campaign))
    } catch (error) {
      console.error(`process-campaign-batch: unhandled error for campaign ${campaign.id}`, error)
      results.push({ campaignId: campaign.id, placed: 0, skipped: "unhandled error" })
    }
  }

  return jsonResponse({ success: true, results })
})
