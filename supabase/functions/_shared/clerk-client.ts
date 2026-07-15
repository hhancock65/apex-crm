// Clerk Backend API client — used by partner-register (bootstraps the
// partner's own org row) and create-client-organization (provisions a new
// client's Clerk Organization and adds the partner as a real member of
// it). This is the ONLY place in this codebase that calls Clerk's Backend
// API directly; everywhere else, Clerk is only ever the frontend auth
// provider whose JWTs Supabase verifies.
//
// NOTE: like every other third-party integration added in this codebase
// (Retell's createPhoneCall, Stripe's invoice items), this has never been
// exercised against a live Clerk account from this environment — verify
// the request/response shapes and role slugs ("org:admin") against Clerk's
// current Backend API docs (https://clerk.com/docs/reference/backend-api)
// before relying on this in production.

const CLERK_API_BASE = "https://api.clerk.com/v1"

export class ClerkApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "ClerkApiError"
    this.status = status
    this.details = details
  }
}

function getClerkSecretKey(): string {
  const key = Deno.env.get("CLERK_SECRET_KEY")
  if (!key) {
    throw new Error("Missing CLERK_SECRET_KEY secret (set via `supabase secrets set CLERK_SECRET_KEY=...`)")
  }
  return key
}

async function clerkRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(`${CLERK_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getClerkSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  const json = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const message =
      typeof json?.errors?.[0]?.message === "string" ? json.errors[0].message : `Clerk API error (${response.status})`
    throw new ClerkApiError(message, response.status, json)
  }

  return json as T
}

export interface ClerkOrganization {
  id: string
  name: string
}

export function createClerkOrganization(name: string, createdByUserId: string): Promise<ClerkOrganization> {
  return clerkRequest<ClerkOrganization>("/organizations", "POST", { name, created_by: createdByUserId })
}

/**
 * Clerk auto-adds `created_by` as an admin of an organization it creates —
 * this call is a defensive, explicit follow-up rather than something this
 * flow strictly depends on, since that auto-membership behavior hasn't
 * been confirmed against a live account either. A failure here is logged
 * by the caller but doesn't roll back org creation — worst case, the
 * partner falls back to Clerk's own "accept invite"/membership UI to gain
 * access, rather than the client org failing to exist at all.
 */
export function addClerkOrganizationMember(
  organizationId: string,
  userId: string,
  role: "org:admin" | "org:member" = "org:admin"
): Promise<unknown> {
  return clerkRequest(`/organizations/${organizationId}/memberships`, "POST", { user_id: userId, role })
}

// --- Team management (TeamPage) -------------------------------------------
//
// Apex's own 5-tier role model (owner/admin/manager/sales_rep/viewer) lives
// entirely in Supabase's profiles.role — that's what RLS and
// usePermissions() both read (see 0023_team_roles_permissions.sql for why:
// RLS can't call out to Clerk, so Postgres has to be authoritative, and a
// second, possibly-drifting source of truth on the frontend would be a real
// bug risk). Clerk's own org role slugs are the coarser "org:admin" /
// "org:member" — used here only for Clerk's own membership record, mapped
// owner/admin -> org:admin and everyone else -> org:member. A failure to
// sync this coarse Clerk-side role is logged and swallowed by the caller,
// never fatal, matching addClerkOrganizationMember above.

export interface ClerkMembership {
  id: string
  role: "org:admin" | "org:member" | string
  public_user_data: {
    user_id: string
    first_name: string | null
    last_name: string | null
    identifier: string | null
    image_url: string | null
  }
  created_at: number
  updated_at: number
}

interface ClerkListResponse<T> {
  data: T[]
  total_count: number
}

export async function listOrganizationMemberships(organizationId: string): Promise<ClerkMembership[]> {
  const result = await clerkRequest<ClerkListResponse<ClerkMembership>>(
    `/organizations/${organizationId}/memberships?limit=100`,
    "GET"
  )
  return result.data
}

export interface ClerkInvitation {
  id: string
  email_address: string
  role: "org:admin" | "org:member" | string
  status: "pending" | "accepted" | "revoked"
  created_at: number
}

export async function listOrganizationInvitations(organizationId: string): Promise<ClerkInvitation[]> {
  const result = await clerkRequest<ClerkListResponse<ClerkInvitation>>(
    `/organizations/${organizationId}/invitations?limit=100&status=pending`,
    "GET"
  )
  return result.data
}

export function createOrganizationInvitation(
  organizationId: string,
  emailAddress: string,
  role: "org:admin" | "org:member",
  inviterUserId: string
): Promise<ClerkInvitation> {
  return clerkRequest<ClerkInvitation>(`/organizations/${organizationId}/invitations`, "POST", {
    email_address: emailAddress,
    role,
    inviter_user_id: inviterUserId,
  })
}

export function revokeOrganizationInvitation(
  organizationId: string,
  invitationId: string,
  requestingUserId: string
): Promise<unknown> {
  return clerkRequest(
    `/organizations/${organizationId}/invitations/${invitationId}/revoke`,
    "POST",
    { requesting_user_id: requestingUserId }
  )
}

export function updateOrganizationMembership(
  organizationId: string,
  userId: string,
  role: "org:admin" | "org:member"
): Promise<unknown> {
  return clerkRequest(`/organizations/${organizationId}/memberships/${userId}`, "PATCH", { role })
}

export function deleteOrganizationMembership(organizationId: string, userId: string): Promise<unknown> {
  return clerkRequest(`/organizations/${organizationId}/memberships/${userId}`, "DELETE")
}

export interface ClerkUser {
  id: string
  last_active_at: number | null
}

/** One call per member for a real `last_active_at` — OrganizationMembership's
 *  public_user_data doesn't carry it. Only used by team-management's "list"
 *  action (admin-only, low-frequency), so the N+1 is an acceptable tradeoff
 *  for a genuinely-requested "last active" column rather than a fabricated one. */
export function getClerkUser(userId: string): Promise<ClerkUser> {
  return clerkRequest<ClerkUser>(`/users/${userId}`, "GET")
}

export function deleteClerkOrganization(organizationId: string): Promise<unknown> {
  return clerkRequest(`/organizations/${organizationId}`, "DELETE")
}
