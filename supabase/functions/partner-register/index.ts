// Supabase Edge Function: partner-register
//
// Called from PartnerRegistrationPage after the user has signed up AND
// created/selected a Clerk Organization for their partner business (via
// Clerk's own <CreateOrganization> component) — by the time this runs,
// their session's active org_id claim IS the partner's future org.
//
// Bootstrapping problem this function exists to solve: get_user_org_id()
// resolves via an `organizations` row that doesn't exist yet for a brand
// new Clerk org (there's no Clerk-webhook sync in this codebase — every
// org in this app is provisioned by an explicit app action, not a
// background sync). So this function:
//   1. Resolves the caller's clerk_org_id via get_current_clerk_org_id() —
//      NOT by decoding the bearer token itself. Calling this RPC through
//      the user-scoped client round-trips through Supabase's own
//      third-party-auth JWT verification first, so the value that comes
//      back is a verified claim, not a client-asserted one.
//   2. Upserts the matching `organizations` row (service-role client — no
//      insert policy exists on organizations, by design, so this is the
//      only path that can create one).
//   3. Inserts a `partners` row with status='pending' — a JHDM admin
//      approves it later (JHDMAdminPage).
//
// Idempotent: re-running against an org that already has a partners row
// just returns the existing one instead of erroring.
//
// Request body: { name, contact_name?, email?, phone?, website? }
// Response:     { success: true, partner_id: string, status: "pending" }

import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { asString } from "../_shared/parse-args.ts"
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

    const name = asString(body.name)
    if (!name) {
      return jsonResponse({ error: "name is required" }, 400)
    }

    const userScoped = createUserScopedClient(authHeader)
    const { data: clerkOrgId, error: claimError } = await userScoped.rpc("get_current_clerk_org_id")
    if (claimError) {
      return jsonResponse({ error: "Failed to resolve session" }, 500)
    }
    if (!clerkOrgId) {
      return jsonResponse(
        { error: "No active organization on this session — create or select one in Clerk first." },
        400
      )
    }

    const supabase = createServiceRoleClient()

    const { data: existingOrg, error: orgLookupError } = await supabase
      .from("organizations")
      .select("id")
      .eq("clerk_org_id", clerkOrgId)
      .maybeSingle()
    if (orgLookupError) {
      return jsonResponse({ error: "Failed to look up organization" }, 500)
    }

    let orgId: string
    if (existingOrg) {
      orgId = existingOrg.id
    } else {
      const { data: createdOrg, error: orgCreateError } = await supabase
        .from("organizations")
        .insert({ clerk_org_id: clerkOrgId, name })
        .select("id")
        .single()
      if (orgCreateError || !createdOrg) {
        return jsonResponse({ error: orgCreateError?.message ?? "Failed to create organization" }, 500)
      }
      orgId = createdOrg.id
    }

    const { data: existingPartner } = await supabase
      .from("partners")
      .select("id, status")
      .eq("org_id", orgId)
      .maybeSingle()
    if (existingPartner) {
      return jsonResponse({ success: true, partner_id: existingPartner.id, status: existingPartner.status })
    }

    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .insert({
        org_id: orgId,
        name,
        contact_name: asString(body.contact_name) ?? null,
        email: asString(body.email) ?? null,
        phone: asString(body.phone) ?? null,
        website: asString(body.website) ?? null,
      })
      .select("id, status")
      .single()
    if (partnerError || !partner) {
      return jsonResponse({ error: partnerError?.message ?? "Failed to create partner record" }, 500)
    }

    return jsonResponse({ success: true, partner_id: partner.id, status: partner.status })
  } catch (error) {
    console.error("partner-register failed:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500)
  }
})
