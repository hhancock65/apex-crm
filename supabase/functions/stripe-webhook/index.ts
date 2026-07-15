// Supabase Edge Function: stripe-webhook
//
// Configure this as the endpoint URL on the Stripe webhook you create via
// scripts/setup-stripe.mjs (or by hand in the Stripe Dashboard). Stripe
// calls this directly — there is no Apex user session, so it's authorized
// via the `Stripe-Signature` header instead (HMAC, keyed with
// STRIPE_WEBHOOK_SECRET, verified with Stripe's own SDK using the fetch/
// SubtleCrypto-based async verifier — Deno doesn't have Node's `crypto`
// module available the same way stripe-node's default sync verifier
// expects). All DB access uses the service-role client.
//
// Handles exactly the 5 events scripts/setup-stripe.mjs subscribes the
// endpoint to:
//   checkout.session.completed  — first successful subscribe
//   invoice.paid                — renewal (or the invoice for the very
//                                  first payment, which Stripe also fires
//                                  checkout.session.completed for — both
//                                  paths converge on the same upsert, which
//                                  is idempotent, so handling both is safe)
//   invoice.payment_failed      — card declined; grace period + admin alert
//   customer.subscription.updated — plan changes, renewal dates,
//                                  cancel-at-period-end, portal-driven edits
//   customer.subscription.deleted — subscription actually ends; revoke
//
// Every handler resolves org_id from the Stripe Subscription's own
// metadata.org_id (set at Checkout time — see stripe-checkout's
// subscription_data.metadata), falling back to an existing subscriptions
// row keyed by stripe_subscription_id if metadata is ever missing. Every
// write is an upsert-to-current-state (onConflict: org_id), which is
// naturally idempotent against Stripe's at-least-once redelivery — there's
// no side effect here that isn't safe to apply twice, unlike e.g. sending
// an SMS, so no separate event-id dedup table is needed.
//
// Also seeds/refreshes the org's usage_records row for the current period
// (migration 0019's ensure_usage_period()) every time a subscription syncs
// — this is what gives a subscriber their plan's actual usage allowance
// (AI minutes/SMS/calls) rather than the zero-allowance fallback
// record_usage() uses when nothing has provisioned a period yet.

import { computePlanFeatures, isPlanId, USAGE_ALLOWANCES, type PlanId } from "../_shared/plans.ts"
import { asString } from "../_shared/parse-args.ts"
import { getStripeClient, Stripe } from "../_shared/stripe-client.ts"
import { createServiceRoleClient } from "../_shared/supabase-admin.ts"
import { notifyOrgAdmins } from "../_shared/notify-admins.ts"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import type { SubscriptionStatus } from "../_shared/types.ts"

type ServiceClient = ReturnType<typeof createServiceRoleClient>

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
])

/** Stripe has 8 subscription statuses; our DB enum has the 4 the spec
 *  asked for. This mapping is deliberately lossy — documented, not hidden:
 *    trialing/active/past_due pass straight through.
 *    canceled, incomplete_expired -> cancelled (subscription is over).
 *    unpaid, incomplete -> past_due (not actively cancelled, but not
 *      currently paying either — same grace-period handling as a genuine
 *      past_due).
 *    paused -> cancelled (no billing happening; closest fit without adding
 *      a 5th status the spec didn't ask for). */
function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing"
    case "active":
      return "active"
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due"
    case "canceled":
    case "incomplete_expired":
    case "paused":
    default:
      return "cancelled"
  }
}

function resolvePlanId(subscription: Stripe.Subscription): PlanId | null {
  const lookupKey = subscription.items.data[0]?.price?.lookup_key
  if (lookupKey && isPlanId(lookupKey)) return lookupKey
  const metadataPlan = asString(subscription.metadata?.plan_id)
  if (metadataPlan && isPlanId(metadataPlan)) return metadataPlan
  return null
}

function toIso(unixSeconds: number | null | undefined): string | null {
  return typeof unixSeconds === "number" ? new Date(unixSeconds * 1000).toISOString() : null
}

function toDateOnly(unixSeconds: number | null | undefined): string | null {
  return typeof unixSeconds === "number" ? new Date(unixSeconds * 1000).toISOString().slice(0, 10) : null
}

/**
 * The single write path every handler below funnels through — upserts the
 * subscriptions row (keyed on org_id, the only column that's actually
 * unique per org) and refreshes organizations.plan_features to match.
 */
async function syncSubscriptionToDb(
  supabase: ServiceClient,
  subscription: Stripe.Subscription
): Promise<{ orgId: string; status: SubscriptionStatus } | null> {
  let orgId = asString(subscription.metadata?.org_id)

  if (!orgId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("org_id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle()
    orgId = data?.org_id
  }
  if (!orgId) {
    console.warn(`stripe-webhook: no org_id resolvable for subscription ${subscription.id} — skipping`)
    return null
  }

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("org_id", orgId)
    .maybeSingle()

  const planId = resolvePlanId(subscription) ?? (existing?.plan_id as PlanId | undefined) ?? null
  if (!planId) {
    console.error(
      `stripe-webhook: could not resolve a plan_id for subscription ${subscription.id} (org ${orgId}) — its price has no recognized lookup_key. Skipping DB write.`
    )
    return null
  }

  const status = mapStripeStatus(subscription.status)
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id

  const { error } = await supabase.from("subscriptions").upsert(
    {
      org_id: orgId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      plan_id: planId,
      status,
      current_period_start: toIso(subscription.current_period_start),
      current_period_end: toIso(subscription.current_period_end),
      cancel_at: toIso(subscription.cancel_at),
    },
    { onConflict: "org_id" }
  )
  if (error) {
    console.error(`stripe-webhook: failed to upsert subscription for org ${orgId}`, error)
    return null
  }

  const { error: orgError } = await supabase
    .from("organizations")
    .update({ plan_features: computePlanFeatures(planId, status) })
    .eq("id", orgId)
  if (orgError) {
    console.error(`stripe-webhook: failed to update plan_features for org ${orgId}`, orgError)
  }

  // Ensures this period's usage_records row exists with the right included
  // allowance BEFORE any usage happens in it — record_usage() only ever
  // increments an existing row (or falls back to a zero-allowance calendar
  // month if this never ran), so this is what makes a subscriber's real
  // allowance actually show up. Only for access-granting statuses: a
  // cancelled subscription shouldn't seed a new allowance period.
  const periodStart = toDateOnly(subscription.current_period_start)
  const periodEnd = toDateOnly(subscription.current_period_end)
  if (status !== "cancelled" && periodStart && periodEnd) {
    const allowance = USAGE_ALLOWANCES[planId]
    const { error: usageError } = await supabase.rpc("ensure_usage_period", {
      p_org_id: orgId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_ai_minutes_included: allowance.aiMinutes,
      p_sms_included: allowance.sms,
      p_calls_included: allowance.calls,
    })
    if (usageError) {
      console.error(`stripe-webhook: failed to ensure usage period for org ${orgId}`, usageError)
    }
  }

  return { orgId, status }
}

async function handleCheckoutCompleted(supabase: ServiceClient, session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "subscription" || !session.subscription) return
  const stripe = getStripeClient()
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  await syncSubscriptionToDb(supabase, subscription)
}

async function handleInvoiceEvent(
  supabase: ServiceClient,
  invoice: Stripe.Invoice,
  onFailed: (orgId: string, subscriptionRowId: string | null) => Promise<void>
): Promise<void> {
  if (!invoice.subscription) return
  const stripe = getStripeClient()
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const result = await syncSubscriptionToDb(supabase, subscription)
  if (result && result.status === "past_due") {
    const { data: row } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("org_id", result.orgId)
      .maybeSingle()
    await onFailed(result.orgId, row?.id ?? null)
  }
}

async function handleSubscriptionEvent(supabase: ServiceClient, subscription: Stripe.Subscription): Promise<void> {
  await syncSubscriptionToDb(supabase, subscription)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")
  if (!webhookSecret) {
    console.error("stripe-webhook: STRIPE_WEBHOOK_SECRET is not configured")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  const signature = req.headers.get("Stripe-Signature")
  if (!signature) {
    return jsonResponse({ error: "Missing Stripe-Signature header" }, 401)
  }

  const rawBody = await req.text()
  const stripe = getStripeClient()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    )
  } catch (error) {
    console.error("stripe-webhook: signature verification failed", error)
    return jsonResponse({ error: "Invalid signature" }, 401)
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return jsonResponse({ success: true, skipped: `unhandled event: ${event.type}` })
  }

  const supabase = createServiceRoleClient()

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session)
        break

      case "invoice.paid":
        await handleInvoiceEvent(supabase, event.data.object as Stripe.Invoice, async () => {
          // invoice.paid never fails by definition — this branch exists
          // only so handleInvoiceEvent's shared signature works for both
          // events; onFailed is never actually invoked here.
        })
        break

      case "invoice.payment_failed":
        await handleInvoiceEvent(supabase, event.data.object as Stripe.Invoice, async (orgId, subscriptionRowId) => {
          await notifyOrgAdmins(supabase, orgId, {
            type: "payment_failed",
            title: "Payment failed for your Apex subscription",
            message:
              "We couldn't charge your card on file. Please update your payment method to avoid losing access to your plan's features.",
            relatedToType: "subscription",
            relatedToId: subscriptionRowId ?? undefined,
          })
        })
        break

      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(supabase, event.data.object as Stripe.Subscription)
        break
    }
  } catch (error) {
    // Every DB write above already independently checks its own errors and
    // logs them without throwing (a plan_id we can't resolve, an upsert
    // that failed) — those are "won't fix itself on retry" situations and
    // are deliberately swallowed so Stripe doesn't hammer this endpoint
    // forever on bad data. Reaching this catch means something ELSE broke
    // (a network blip calling the Stripe API to re-fetch a subscription,
    // for instance) — genuinely worth a retry, so unlike everywhere else in
    // this file, this one returns non-2xx on purpose.
    console.error(`stripe-webhook: failed to process ${event.type}`, error)
    return jsonResponse({ error: "Failed to process event, will retry" }, 500)
  }

  return jsonResponse({ success: true })
})
