// Supabase Edge Function: delete-organization
//
// SettingsPage's danger zone. The single most destructive action in this
// app — organizations cascades to every child table (companies, contacts,
// leads, deals, tasks, appointments, ai_employees, calls, campaigns,
// subscriptions, usage_records, everything). Deliberately routed through a
// dedicated Edge Function rather than a raw client-side delete so the
// confirmation check is enforced server-side, not just in the UI: the
// caller must be the org's owner AND must pass the org's exact current name
// as confirmationText (re-fetched from the DB, never trusted from the
// client alongside the org id).
//
// Request body: { confirmationText: string }
// Response:     { success: true }

import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { asString } from "../_shared/parse-args.ts"
import { createServiceRoleClient, createUserScopedClient } from "../_shared/supabase-admin.ts"
import { deleteClerkOrganization } from "../_shared/clerk-client.ts"

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

    const confirmationText = asString(body.confirmationText)
    if (!confirmationText) {
      return jsonResponse({ error: "confirmationText is required" }, 400)
    }

    const userScoped = createUserScopedClient(authHeader)
    const [{ data: role, error: roleError }, { data: orgId, error: orgIdError }, { data: clerkOrgId, error: clerkOrgIdError }] =
      await Promise.all([
        userScoped.rpc("get_user_role"),
        userScoped.rpc("get_user_org_id"),
        userScoped.rpc("get_current_clerk_org_id"),
      ])
    if (roleError || orgIdError || clerkOrgIdError) {
      return jsonResponse({ error: "Failed to resolve session" }, 500)
    }
    if (!orgId) {
      return jsonResponse({ error: "No active organization on this session" }, 400)
    }
    if (role !== "owner") {
      return jsonResponse({ error: "Only the organization's owner can delete it" }, 403)
    }

    const supabase = createServiceRoleClient()
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .single()
    if (orgError || !org) {
      return jsonResponse({ error: "Organization not found" }, 404)
    }
    if (confirmationText !== org.name) {
      return jsonResponse({ error: "Confirmation text does not match the organization name" }, 400)
    }

    const { error: deleteError } = await supabase.from("organizations").delete().eq("id", orgId)
    if (deleteError) {
      return jsonResponse({ error: deleteError.message ?? "Failed to delete organization" }, 500)
    }

    if (clerkOrgId) {
      try {
        await deleteClerkOrganization(clerkOrgId)
      } catch (error) {
        console.error("delete-organization: Clerk org deletion failed (non-fatal, DB row already gone)", error)
      }
    }

    return jsonResponse({ success: true })
  } catch (error) {
    console.error("delete-organization failed:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500)
  }
})
