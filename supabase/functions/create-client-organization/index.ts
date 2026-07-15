// Supabase Edge Function: create-client-organization
//
// Called from PartnerDashboardPage's "Add Client" button. Only an ACTIVE
// partner can call this (get_user_partner_id() returns null for a
// pending/suspended partner or a non-partner org — same authorization
// check the get_partner_dashboard RPC uses).
//
// Provisions a real, independent Clerk Organization for the new client
// (not a sub-resource of the partner's own org) and adds the calling
// partner user as a genuine member of it — this is what makes "click a
// client to view their Apex dashboard" work later: it's Clerk's own
// setActive({ organization }) org-switcher, and every existing RLS policy
// in this app keeps working unchanged because the partner really is a
// member of that org while switched into it. See migration 0021's header
// comment for the full reasoning.
//
// Request body: { name: string, monthly_rate?: number }
// Response:     { success: true, org_id: string, clerk_org_id: string }

import { addClerkOrganizationMember, ClerkApiError, createClerkOrganization } from "../_shared/clerk-client.ts"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { asNumber, asString } from "../_shared/parse-args.ts"
import { createServiceRoleClient, createUserScopedClient } from "../_shared/supabase-admin.ts"

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

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400)
    }

    const clientName = asString(body.name)
    if (!clientName) {
      return jsonResponse({ error: "name is required" }, 400)
    }
    const monthlyRate = asNumber(body.monthly_rate) ?? 0

    const userScoped = createUserScopedClient(authHeader)

    const { data: partnerId, error: partnerError } = await userScoped.rpc("get_user_partner_id")
    if (partnerError) {
      return jsonResponse({ error: "Failed to verify partner status" }, 500)
    }
    if (!partnerId) {
      return jsonResponse({ error: "Only an active partner can create client organizations" }, 403)
    }

    const { data: clerkUserId, error: userClaimError } = await userScoped.rpc("get_current_clerk_user_id")
    if (userClaimError || !clerkUserId) {
      return jsonResponse({ error: "Failed to resolve session user" }, 500)
    }

    const clerkOrg = await createClerkOrganization(clientName, clerkUserId)

    try {
      await addClerkOrganizationMember(clerkOrg.id, clerkUserId, "org:admin")
    } catch (error) {
      // Non-fatal — Clerk auto-adds the creator as an admin in most
      // configurations, so this is a defensive follow-up, not something
      // this flow strictly depends on (see _shared/clerk-client.ts).
      console.warn(`create-client-organization: addClerkOrganizationMember failed for org ${clerkOrg.id}`, error)
    }

    const supabase = createServiceRoleClient()

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ clerk_org_id: clerkOrg.id, name: clientName })
      .select("id")
      .single()
    if (orgError || !org) {
      // The Clerk org now exists but Apex doesn't know about it yet —
      // return its id so this can be retried without provisioning a
      // second, orphaned Clerk organization (same pattern as
      // create-retell-agent's partial-failure response).
      return jsonResponse(
        {
          error: "Created the client's Clerk organization but failed to save it in Apex",
          clerk_org_id: clerkOrg.id,
          details: orgError?.message,
        },
        500
      )
    }

    const { error: linkError } = await supabase.from("partner_organizations").insert({
      partner_id: partnerId,
      org_id: org.id,
      monthly_rate: monthlyRate,
      status: "active",
    })
    if (linkError) {
      return jsonResponse(
        {
          error: "Created the client organization but failed to link it to your partner account",
          clerk_org_id: clerkOrg.id,
          org_id: org.id,
          details: linkError.message,
        },
        500
      )
    }

    return jsonResponse({ success: true, org_id: org.id, clerk_org_id: clerkOrg.id })
  } catch (error) {
    if (error instanceof ClerkApiError) {
      const status = error.status >= 400 && error.status < 600 ? error.status : 502
      return jsonResponse({ error: `Clerk API error: ${error.message}`, details: error.details }, status)
    }
    console.error("create-client-organization failed:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500)
  }
})
