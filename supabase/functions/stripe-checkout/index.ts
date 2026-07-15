// Supabase Edge Function: stripe-checkout
//
// Called from the signed-in app (Clerk-issued token) when a user clicks
// "Upgrade" / "Get Started" on a plan card. Same auth pattern as
// create-retell-agent/launch-campaign: the forwarded Clerk token is used to
// run RLS-scoped Supabase queries, which is the real authorization boundary
// here (config.toml disables the platform's verify_jwt gate for this
// function since it doesn't recognize third-party tokens).
//
// Request body: { plan_id: string, origin: string }
//   origin is window.location.origin from the browser — used to build
//   success_url/cancel_url. This is not a security-sensitive value: it only
//   ends up as a link on Stripe's OWN hosted checkout page for the user's
//   browser to follow afterward, never a server-to-server callback target.
// Response: { url: string } — the Checkout Session's hosted URL; the
//   frontend does `window.location.href = url`.
//
// Price resolution is by Stripe Price lookup_key (= plan_id), not a stored
// price id — see scripts/setup-stripe.mjs and _shared/plans.ts.

import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { isPlanId, PLAN_IDS } from "../_shared/plans.ts"
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

    let planId: string | undefined
    let origin: string | undefined
    try {
      ;({ plan_id: planId, origin } = await req.json())
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400)
    }
    if (!planId || !isPlanId(planId)) {
      return jsonResponse({ error: `plan_id must be one of: ${PLAN_IDS.join(", ")}` }, 400)
    }
    let originUrl: URL
    try {
      originUrl = new URL(origin ?? "")
    } catch {
      return jsonResponse({ error: "origin must be a valid URL" }, 400)
    }

    const supabase = createUserScopedClient(authHeader)

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, clerk_org_id")
      .single()
    if (orgError || !org) {
      return jsonResponse({ error: "Organization not found or not accessible" }, 404)
    }

    const stripe = getStripeClient()

    const { data: prices } = await stripe.prices.list({ lookup_keys: [planId], active: true, limit: 1 })
    const price = prices[0]
    if (!price) {
      return jsonResponse(
        { error: `No active Stripe price found for plan '${planId}' — run scripts/setup-stripe.mjs first.` },
        500
      )
    }

    const customerId = await getOrCreateStripeCustomer(supabase, org.id, org.name)

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${originUrl.origin}/admin/billing?checkout=success`,
      cancel_url: `${originUrl.origin}/pricing?checkout=cancelled`,
      metadata: { org_id: org.id, plan_id: planId },
      // Subscription-level metadata is what lets customer.subscription.*
      // webhooks (which only ever see the Subscription object, not this
      // Checkout Session) resolve which org they belong to.
      subscription_data: { metadata: { org_id: org.id, plan_id: planId } },
    })

    if (!session.url) {
      return jsonResponse({ error: "Stripe did not return a Checkout URL" }, 502)
    }

    return jsonResponse({ url: session.url })
  } catch (error) {
    console.error("stripe-checkout failed:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500)
  }
})

/**
 * Reuses the org's existing Stripe customer if one is already known — first
 * from a prior subscriptions row (fast path, authoritative once it exists),
 * else by searching Stripe for a customer already tagged with this org's
 * id (covers "checkout was started and abandoned before any webhook ever
 * landed"). Only creates a new Customer if neither turns anything up, so
 * repeated abandoned checkouts don't pile up duplicate Stripe customers.
 * No email is set here — Stripe's own Checkout page collects/attaches it.
 */
async function getOrCreateStripeCustomer(
  supabase: ReturnType<typeof createUserScopedClient>,
  orgId: string,
  orgName: string
): Promise<string> {
  const stripe = getStripeClient()

  const { data: existingSubscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", orgId)
    .maybeSingle()
  if (existingSubscription?.stripe_customer_id) {
    return existingSubscription.stripe_customer_id
  }

  const found = await stripe.customers.search({ query: `metadata['org_id']:'${orgId}'`, limit: 1 })
  if (found.data[0]) return found.data[0].id

  const created = await stripe.customers.create({ name: orgName, metadata: { org_id: orgId } })
  return created.id
}
