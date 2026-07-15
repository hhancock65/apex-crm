// Supabase Edge Function: stripe-portal
//
// Called from the signed-in app (Clerk-issued token) when a user clicks
// "Manage Billing" on the Billing page. Same auth pattern as
// stripe-checkout: the forwarded Clerk token runs RLS-scoped Supabase
// queries, which is the real authorization boundary.
//
// Request body: { origin: string } — window.location.origin, used to build
//   return_url (see stripe-checkout's header comment for why this isn't a
//   security-sensitive value).
// Response: { url: string } — the Customer Portal session's hosted URL.

import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { getStripeClient } from "../_shared/stripe-client.ts"
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

    let origin: string | undefined
    try {
      ;({ origin } = await req.json())
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400)
    }
    let originUrl: URL
    try {
      originUrl = new URL(origin ?? "")
    } catch {
      return jsonResponse({ error: "origin must be a valid URL" }, 400)
    }

    const supabase = createUserScopedClient(authHeader)

    const { data: org, error: orgError } = await supabase.from("organizations").select("id").single()
    if (orgError || !org) {
      return jsonResponse({ error: "Organization not found or not accessible" }, 404)
    }

    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("org_id", org.id)
      .maybeSingle()
    if (subError) {
      return jsonResponse({ error: "Failed to look up subscription" }, 500)
    }
    if (!subscription?.stripe_customer_id) {
      return jsonResponse({ error: "No billing account yet — subscribe to a plan first." }, 404)
    }

    const stripe = getStripeClient()
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${originUrl.origin}/admin/billing`,
    })

    return jsonResponse({ url: session.url })
  } catch (error) {
    console.error("stripe-portal failed:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500)
  }
})
