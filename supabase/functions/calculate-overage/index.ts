// Supabase Edge Function: calculate-overage
//
// A SEPARATE Stripe webhook endpoint from stripe-webhook — created by
// scripts/setup-stripe.mjs subscribed to exactly one event,
// `invoice.upcoming`, with its own signing secret
// (STRIPE_OVERAGE_WEBHOOK_SECRET). Two endpoints for two concerns: this one
// owns usage-based overage billing, stripe-webhook owns subscription
// lifecycle — kept apart rather than folding a 6th event into the other
// function's HANDLED_EVENTS set.
//
// WHY invoice.upcoming and not invoice.paid/customer.subscription.updated:
// Stripe fires invoice.upcoming a few days before a subscription renews,
// specifically so integrations can attach final metered/usage charges
// BEFORE the invoice is finalized — this is Stripe's own documented
// pattern for "flat subscription + metered add-on" billing. Reacting AFTER
// the fact (e.g. on invoice.paid) would mean creating a stray invoice item
// that lands on some FUTURE invoice instead of the one for the period that
// just ended, a full billing cycle late.
//
// Finding "the period that just ended": deliberately does NOT read
// subscriptions.current_period_start/end, since that row can already
// reflect Stripe's NEW period by the time this fires (ordering between
// invoice.upcoming and customer.subscription.updated isn't guaranteed).
// Instead queries usage_records directly for this org's most recent CLOSED
// period (period_end <= today) that hasn't been invoiced yet — decoupled
// from any subscriptions-row timing entirely.
//
// invoiced_at (migration 0019, the one column beyond the original usage_records
// spec) is what makes this safe against Stripe redelivering invoice.upcoming
// for the same invoice more than once — without it, a redelivery would
// create duplicate invoice items and double-charge the customer.
//
// NOTE: stripe.invoiceItems.create's exact field shape (amount in cents vs.
// price_data/unit_amount) has NOT been verified against a live Stripe
// account from this environment — same caveat as createPhoneCall
// (_shared/retell-client.ts) and the rest of this Stripe integration.
// Confirm against Stripe's current Invoice Items API docs before relying on
// this in production.

import { OVERAGE_RATES } from "../_shared/plans.ts"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { notifyOrgAdmins } from "../_shared/notify-admins.ts"
import { getStripeClient, Stripe } from "../_shared/stripe-client.ts"
import { createServiceRoleClient } from "../_shared/supabase-admin.ts"

type ServiceClient = ReturnType<typeof createServiceRoleClient>

interface UsageRecordRow {
  id: string
  org_id: string
  period_start: string
  period_end: string
  ai_minutes_used: number
  sms_sent: number
  calls_made: number
  ai_minutes_included: number
  sms_included: number
  calls_included: number
  overage_amount: number
}

interface OverageLineItem {
  usageType: "ai_minutes" | "sms" | "calls"
  description: string
  units: number
  amountCents: number
}

function computeOverageLineItems(row: UsageRecordRow): OverageLineItem[] {
  const items: OverageLineItem[] = []

  const aiMinutesOver = Math.max(0, row.ai_minutes_used - row.ai_minutes_included)
  if (aiMinutesOver > 0) {
    items.push({
      usageType: "ai_minutes",
      description: `AI minutes overage: ${aiMinutesOver.toFixed(2)} min over your ${row.ai_minutes_included}-minute allowance ($${OVERAGE_RATES.aiMinute.toFixed(2)}/min)`,
      units: aiMinutesOver,
      amountCents: Math.round(aiMinutesOver * OVERAGE_RATES.aiMinute * 100),
    })
  }

  const smsOver = Math.max(0, row.sms_sent - row.sms_included)
  if (smsOver > 0) {
    items.push({
      usageType: "sms",
      description: `SMS overage: ${smsOver} over your ${row.sms_included}-message allowance ($${OVERAGE_RATES.sms.toFixed(2)}/SMS)`,
      units: smsOver,
      amountCents: Math.round(smsOver * OVERAGE_RATES.sms * 100),
    })
  }

  const callsOver = Math.max(0, row.calls_made - row.calls_included)
  if (callsOver > 0) {
    items.push({
      usageType: "calls",
      description: `Call overage: ${callsOver} over your ${row.calls_included}-call allowance ($${OVERAGE_RATES.call.toFixed(2)}/call)`,
      units: callsOver,
      amountCents: Math.round(callsOver * OVERAGE_RATES.call * 100),
    })
  }

  return items
}

async function invoiceOverageForSubscription(
  supabase: ServiceClient,
  subscriptionId: string,
  customerId: string
): Promise<void> {
  const { data: subscriptionRow } = await supabase
    .from("subscriptions")
    .select("org_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle()

  if (!subscriptionRow) {
    console.warn(`calculate-overage: no subscriptions row for Stripe subscription ${subscriptionId} — skipping`)
    return
  }

  const { data: usageRow, error: usageError } = await supabase
    .from("usage_records")
    .select("*")
    .eq("org_id", subscriptionRow.org_id)
    .is("invoiced_at", null)
    .lte("period_end", new Date().toISOString().slice(0, 10))
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (usageError) {
    console.error(`calculate-overage: usage_records lookup failed for org ${subscriptionRow.org_id}`, usageError)
    return
  }
  if (!usageRow || (usageRow as UsageRecordRow).overage_amount <= 0) {
    return
  }

  const row = usageRow as UsageRecordRow
  const lineItems = computeOverageLineItems(row)
  if (lineItems.length === 0) return

  const stripe = getStripeClient()

  for (const item of lineItems) {
    await stripe.invoiceItems.create({
      customer: customerId,
      subscription: subscriptionId,
      currency: "usd",
      amount: item.amountCents,
      description: item.description,
      metadata: { usage_record_id: row.id, usage_type: item.usageType, org_id: row.org_id },
    })
  }

  const { error: markInvoicedError } = await supabase
    .from("usage_records")
    .update({ invoiced_at: new Date().toISOString() })
    .eq("id", row.id)
  if (markInvoicedError) {
    console.error(`calculate-overage: failed to mark usage_record ${row.id} as invoiced`, markInvoicedError)
  }

  await notifyOrgAdmins(supabase, row.org_id, {
    type: "usage_overage_invoiced",
    title: "Overage charges added to your next invoice",
    message: `Your usage for ${row.period_start} to ${row.period_end} exceeded your plan's included allowance by $${row.overage_amount.toFixed(2)} — this has been added to your upcoming invoice.`,
    relatedToType: "usage_record",
    relatedToId: row.id,
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const webhookSecret = Deno.env.get("STRIPE_OVERAGE_WEBHOOK_SECRET")
  if (!webhookSecret) {
    console.error("calculate-overage: STRIPE_OVERAGE_WEBHOOK_SECRET is not configured")
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
    console.error("calculate-overage: signature verification failed", error)
    return jsonResponse({ error: "Invalid signature" }, 401)
  }

  if (event.type !== "invoice.upcoming") {
    return jsonResponse({ success: true, skipped: `unhandled event: ${event.type}` })
  }

  const invoice = event.data.object as Stripe.Invoice
  if (!invoice.subscription) {
    return jsonResponse({ success: true, skipped: "invoice has no subscription" })
  }

  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id

  if (!customerId) {
    return jsonResponse({ success: true, skipped: "invoice has no customer" })
  }

  const supabase = createServiceRoleClient()

  try {
    await invoiceOverageForSubscription(supabase, subscriptionId, customerId)
  } catch (error) {
    // Genuinely worth a retry (e.g. a network blip calling the Stripe API) —
    // same reasoning as stripe-webhook's own catch-all.
    console.error("calculate-overage: failed to process invoice.upcoming", error)
    return jsonResponse({ error: "Failed to process event, will retry" }, 500)
  }

  return jsonResponse({ success: true })
})
