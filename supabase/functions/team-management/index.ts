// Supabase Edge Function: team-management
//
// Single dispatcher (by body.action) for everything TeamPage needs — list
// members + pending invitations, invite, change a member's role, remove a
// member, revoke a pending invitation. Grouped into one function rather than
// five tiny ones because all five are the same concern (this org's Clerk
// membership) behind the same auth check, unlike stripe-checkout/portal/
// billing-details which are genuinely different flows.
//
// Auth: every action requires the caller to be owner or admin in THEIR OWN
// org (checked via get_user_role() through a user-scoped client — never
// trust a role passed in the request body). Clerk's Backend API is the
// source of truth for org membership/invitations; Supabase's profiles.role
// is the source of truth for Apex's own 5-tier role and is what update_role
// actually writes (see 0023_team_roles_permissions.sql's header for why).
//
// Request body: { action: "list" | "invite" | "update_role" | "remove" | "revoke_invitation", ... }
//   list:              {}
//   invite:            { email: string, role: OrgRole }
//   update_role:       { profileId: string, role: OrgRole }
//   remove:            { profileId: string }
//   revoke_invitation: { invitationId: string }

import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { asString } from "../_shared/parse-args.ts"
import { createServiceRoleClient, createUserScopedClient } from "../_shared/supabase-admin.ts"
import {
  createOrganizationInvitation,
  deleteOrganizationMembership,
  getClerkUser,
  listOrganizationInvitations,
  listOrganizationMemberships,
  revokeOrganizationInvitation,
  updateOrganizationMembership,
  ClerkApiError,
} from "../_shared/clerk-client.ts"

const APEX_ROLES = ["owner", "admin", "manager", "sales_rep", "viewer"] as const
type ApexRole = (typeof APEX_ROLES)[number]

function isApexRole(value: unknown): value is ApexRole {
  return typeof value === "string" && (APEX_ROLES as readonly string[]).includes(value)
}

function clerkRoleFor(role: ApexRole): "org:admin" | "org:member" {
  return role === "owner" || role === "admin" ? "org:admin" : "org:member"
}

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

    const action = asString(body.action)
    if (!action) {
      return jsonResponse({ error: "action is required" }, 400)
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
    if (!orgId || !clerkOrgId) {
      return jsonResponse({ error: "No active organization on this session" }, 400)
    }
    if (role !== "owner" && role !== "admin") {
      return jsonResponse({ error: "Only owners and admins can manage the team" }, 403)
    }

    const supabase = createServiceRoleClient()

    if (action === "list") {
      const [memberships, invitations] = await Promise.all([
        listOrganizationMemberships(clerkOrgId),
        listOrganizationInvitations(clerkOrgId),
      ])

      const clerkUserIds = memberships.map((m) => m.public_user_data.user_id)
      const [{ data: profiles, error: profilesError }, clerkUsers] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, clerk_user_id, first_name, last_name, email, role, created_at")
          .eq("org_id", orgId),
        Promise.all(
          clerkUserIds.map((id) =>
            getClerkUser(id).catch(() => ({ id, last_active_at: null }))
          )
        ),
      ])
      if (profilesError) {
        return jsonResponse({ error: "Failed to load team profiles" }, 500)
      }

      const profileByClerkId = new Map((profiles ?? []).map((p) => [p.clerk_user_id as string, p]))
      const lastActiveByClerkId = new Map(clerkUsers.map((u) => [u.id, u.last_active_at]))

      const members = memberships.map((m) => {
        const profile = profileByClerkId.get(m.public_user_data.user_id)
        return {
          clerkUserId: m.public_user_data.user_id,
          profileId: profile?.id ?? null,
          firstName: profile?.first_name ?? m.public_user_data.first_name,
          lastName: profile?.last_name ?? m.public_user_data.last_name,
          email: profile?.email ?? m.public_user_data.identifier,
          role: profile?.role ?? null,
          status: profile ? "active" : "invited",
          lastActiveAt: lastActiveByClerkId.get(m.public_user_data.user_id) ?? null,
        }
      })

      const pendingInvitations = invitations
        .filter((inv) => inv.status === "pending")
        .map((inv) => ({
          id: inv.id,
          email: inv.email_address,
          role: inv.role === "org:admin" ? "admin" : "sales_rep",
          createdAt: inv.created_at,
        }))

      return jsonResponse({ members, pendingInvitations })
    }

    if (action === "invite") {
      const email = asString(body.email)
      const targetRole = body.role
      if (!email) return jsonResponse({ error: "email is required" }, 400)
      if (!isApexRole(targetRole)) return jsonResponse({ error: "Invalid role" }, 400)
      if (targetRole === "owner" && role !== "owner") {
        return jsonResponse({ error: "Only an owner can invite another owner" }, 403)
      }

      const { data: callerClerkUserId } = await userScoped.rpc("get_current_clerk_user_id")

      let invitation
      try {
        invitation = await createOrganizationInvitation(
          clerkOrgId,
          email,
          clerkRoleFor(targetRole),
          callerClerkUserId as string
        )
      } catch (error) {
        if (error instanceof ClerkApiError) {
          return jsonResponse({ error: error.message }, error.status >= 400 && error.status < 500 ? 400 : 502)
        }
        throw error
      }

      // Apex's own role for this invitee is recorded once their profile row
      // is created (first sign-in) — there's no Clerk webhook sync in this
      // codebase, so nothing provisions a profiles row before then. Stashing
      // the intended role on the invitation's public_metadata would need a
      // matching read on first-sign-in provisioning, which doesn't exist
      // yet either; noting this as a known gap rather than a silent one.
      return jsonResponse({ success: true, invitationId: invitation.id })
    }

    if (action === "update_role") {
      const profileId = asString(body.profileId)
      const targetRole = body.role
      if (!profileId) return jsonResponse({ error: "profileId is required" }, 400)
      if (!isApexRole(targetRole)) return jsonResponse({ error: "Invalid role" }, 400)
      if (targetRole === "owner" && role !== "owner") {
        return jsonResponse({ error: "Only an owner can grant the owner role" }, 403)
      }

      const { data: target, error: targetError } = await supabase
        .from("profiles")
        .select("id, clerk_user_id, role, org_id")
        .eq("id", profileId)
        .single()
      if (targetError || !target || target.org_id !== orgId) {
        return jsonResponse({ error: "Team member not found" }, 404)
      }
      if (target.role === "owner" && role !== "owner") {
        return jsonResponse({ error: "Only an owner can change another owner's role" }, 403)
      }

      const { error: updateError } = await supabase.from("profiles").update({ role: targetRole }).eq("id", profileId)
      if (updateError) {
        return jsonResponse({ error: "Failed to update role" }, 500)
      }

      try {
        await updateOrganizationMembership(clerkOrgId, target.clerk_user_id, clerkRoleFor(targetRole))
      } catch (error) {
        console.error("team-management: Clerk role sync failed (non-fatal)", error)
      }

      return jsonResponse({ success: true })
    }

    if (action === "remove") {
      const profileId = asString(body.profileId)
      if (!profileId) return jsonResponse({ error: "profileId is required" }, 400)

      const { data: target, error: targetError } = await supabase
        .from("profiles")
        .select("id, clerk_user_id, role, org_id")
        .eq("id", profileId)
        .single()
      if (targetError || !target || target.org_id !== orgId) {
        return jsonResponse({ error: "Team member not found" }, 404)
      }

      if (target.role === "owner") {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("role", "owner")
        if ((count ?? 0) <= 1) {
          return jsonResponse({ error: "Cannot remove the organization's only owner" }, 400)
        }
      }

      const { error: deleteError } = await supabase.from("profiles").delete().eq("id", profileId)
      if (deleteError) {
        return jsonResponse({ error: "Failed to remove team member" }, 500)
      }

      try {
        await deleteOrganizationMembership(clerkOrgId, target.clerk_user_id)
      } catch (error) {
        console.error("team-management: Clerk membership removal failed (non-fatal)", error)
      }

      return jsonResponse({ success: true })
    }

    if (action === "revoke_invitation") {
      const invitationId = asString(body.invitationId)
      if (!invitationId) return jsonResponse({ error: "invitationId is required" }, 400)

      const { data: callerClerkUserId } = await userScoped.rpc("get_current_clerk_user_id")

      try {
        await revokeOrganizationInvitation(clerkOrgId, invitationId, callerClerkUserId as string)
      } catch (error) {
        if (error instanceof ClerkApiError) {
          return jsonResponse({ error: error.message }, error.status >= 400 && error.status < 500 ? 400 : 502)
        }
        throw error
      }

      return jsonResponse({ success: true })
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400)
  } catch (error) {
    console.error("team-management failed:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500)
  }
})
