// Supabase Edge Function: launch-campaign
//
// Called by the app when the wizard's "Launch Campaign" button is clicked.
// Resolves the campaign's target_filter via resolve_campaign_audience()
// (the same function the wizard's live "estimated count" preview calls —
// what you saw in the wizard is exactly who gets enrolled), seeds
// campaign_contacts, and flips the campaign to 'active'. Actual outreach
// happens later, asynchronously, via process-campaign-batch on its pg_cron
// schedule — this function only enrolls the audience and starts the clock.
//
// Only handles the initial draft -> active transition. Pausing/resuming an
// already-launched campaign is a plain status update from the client
// (useUpdateCampaign) — re-running this would re-resolve the audience and
// reset started_at, which is wrong for a resume.
//
// Request body: { campaign_id: string }
// Response:     { success: true, total_contacts: number }
//            or { error: string, ... } with a non-2xx status

import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { createUserScopedClient } from "../_shared/supabase-admin.ts"

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401)
    }

    let campaign_id: string | undefined
    try {
      ;({ campaign_id } = await req.json())
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400)
    }
    if (!campaign_id) {
      return jsonResponse({ error: "campaign_id is required" }, 400)
    }

    const supabase = createUserScopedClient(authHeader)

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, org_id, status, target_filter")
      .eq("id", campaign_id)
      .single()

    if (campaignError || !campaign) {
      return jsonResponse({ error: "Campaign not found or not accessible" }, 404)
    }

    if (campaign.status !== "draft") {
      return jsonResponse(
        { error: "Campaign has already been launched — use pause/resume instead." },
        400
      )
    }

    const { data: audience, error: audienceError } = await supabase.rpc("resolve_campaign_audience", {
      p_org_id: campaign.org_id,
      p_target_filter: campaign.target_filter,
    })

    if (audienceError) {
      return jsonResponse(
        { error: "Failed to resolve audience", details: audienceError.message },
        500
      )
    }

    const contactIds = ((audience ?? []) as { contact_id: string }[]).map((row) => row.contact_id)

    if (contactIds.length > 0) {
      const { error: seedError } = await supabase.from("campaign_contacts").upsert(
        contactIds.map((contactId) => ({ campaign_id, contact_id: contactId, status: "pending" })),
        { onConflict: "campaign_id,contact_id", ignoreDuplicates: true }
      )
      if (seedError) {
        return jsonResponse({ error: "Failed to enroll contacts", details: seedError.message }, 500)
      }
    }

    const { error: updateError } = await supabase
      .from("campaigns")
      .update({
        status: "active",
        total_contacts: contactIds.length,
        started_at: new Date().toISOString(),
      })
      .eq("id", campaign_id)

    if (updateError) {
      return jsonResponse({ error: "Failed to activate campaign", details: updateError.message }, 500)
    }

    return jsonResponse({ success: true, total_contacts: contactIds.length })
  } catch (error) {
    console.error("launch-campaign failed:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500)
  }
})
