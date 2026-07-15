#!/usr/bin/env node
// One-off ops script: creates the 4 Apex pricing tiers as Stripe Products +
// Prices, and TWO webhook endpoints — stripe-webhook (subscription
// lifecycle) and calculate-overage (usage-based overage billing, a
// separate endpoint/secret since it's a distinct concern subscribed to a
// distinct event, invoice.upcoming — see calculate-overage/index.ts).
// Safe to re-run — everything is looked up before being created, so
// re-running after a partial failure (or just to confirm state) won't
// create duplicates.
//
// This is a standalone Node script (not part of the Vite/tsc build, hence
// plain .mjs with no build step) so PLANS is a third, deliberately minimal
// copy of the same 4 rows already in supabase/functions/_shared/plans.ts
// and src/lib/plans.ts — keep all three in sync if pricing changes.
//
// Usage:
//   npm install
//   STRIPE_SECRET_KEY=sk_test_... \
//   STRIPE_WEBHOOK_URL=https://<project-ref>.supabase.co/functions/v1/stripe-webhook \
//   STRIPE_OVERAGE_WEBHOOK_URL=https://<project-ref>.supabase.co/functions/v1/calculate-overage \
//   node scripts/setup-stripe.mjs
//
// After it finishes, `supabase secrets set` the printed STRIPE_SECRET_KEY
// (you already have it), STRIPE_WEBHOOK_SECRET, and
// STRIPE_OVERAGE_WEBHOOK_SECRET — each only ever shown once, at creation
// time. If you re-run this script against an already-created endpoint,
// Stripe won't hand the secret back; find it in the Stripe Dashboard →
// Developers → Webhooks instead.

import Stripe from "stripe"

const PLANS = [
  { id: "apex_crm", name: "Apex CRM", priceMonthly: 99, description: "CRM Core" },
  { id: "apex_ai_crm", name: "Apex AI CRM", priceMonthly: 299, description: "CRM + AI Employee Center + Conversations" },
  {
    id: "apex_ai_workforce",
    name: "Apex AI Workforce",
    priceMonthly: 599,
    description: "Full platform + AI Builder + Automation + Campaigns",
  },
  {
    id: "apex_scale",
    name: "Apex Scale",
    priceMonthly: 999,
    description: "Multi-location + advanced integrations + priority support",
  },
]

const SUBSCRIPTION_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]

const OVERAGE_WEBHOOK_EVENTS = ["invoice.upcoming"]

const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey) {
  console.error("Missing STRIPE_SECRET_KEY. Usage:\n")
  console.error(
    "  STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_URL=https://<ref>.supabase.co/functions/v1/stripe-webhook node scripts/setup-stripe.mjs\n"
  )
  process.exit(1)
}

const stripe = new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" })

async function findProductByPlanId(planId) {
  const products = await stripe.products.search({ query: `metadata['plan_id']:'${planId}' AND active:'true'` })
  return products.data[0] ?? null
}

async function ensureProduct(plan) {
  const existing = await findProductByPlanId(plan.id)
  if (existing) {
    console.log(`  Product "${plan.name}" already exists (${existing.id})`)
    return existing
  }
  const product = await stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: { plan_id: plan.id },
  })
  console.log(`  Created product "${plan.name}" (${product.id})`)
  return product
}

async function ensurePrice(plan, product) {
  const existing = await stripe.prices.list({ lookup_keys: [plan.id], active: true, limit: 1 })
  if (existing.data[0]) {
    console.log(`  Price for "${plan.name}" already exists (${existing.data[0].id})`)
    return existing.data[0]
  }
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.priceMonthly * 100,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: plan.id,
    metadata: { plan_id: plan.id },
  })
  console.log(`  Created price for "${plan.name}": $${plan.priceMonthly}/mo (${price.id})`)
  return price
}

async function ensureWebhookEndpoint(url, events, envVarName, urlEnvVarName) {
  if (!url) {
    console.log(`\n${urlEnvVarName} not set — skipping that webhook endpoint.`)
    console.log(`Re-run with ${urlEnvVarName}=https://<project-ref>.supabase.co/functions/v1/... to create it.`)
    return
  }

  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
  const existing = endpoints.data.find((e) => e.url === url)
  if (existing) {
    console.log(`\nWebhook endpoint already exists for ${url} (${existing.id})`)
    console.log(
      `Stripe doesn't return the signing secret again after creation — find it in the Stripe Dashboard → Developers → Webhooks if you don't already have it saved as ${envVarName}.`
    )
    return
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url,
    enabled_events: events,
  })
  console.log(`\nCreated webhook endpoint ${endpoint.id} for ${url}`)
  console.log(`${envVarName}=${endpoint.secret}`)
  console.log("Save that now — Stripe will not show it again. Set it with:")
  console.log(`  supabase secrets set ${envVarName}=${endpoint.secret}`)
}

async function main() {
  console.log("Setting up Apex pricing tiers in Stripe...\n")

  const priceIds = {}
  for (const plan of PLANS) {
    console.log(`${plan.name} — $${plan.priceMonthly}/mo`)
    const product = await ensureProduct(plan)
    const price = await ensurePrice(plan, product)
    priceIds[plan.id] = price.id
  }

  await ensureWebhookEndpoint(
    process.env.STRIPE_WEBHOOK_URL,
    SUBSCRIPTION_WEBHOOK_EVENTS,
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_WEBHOOK_URL"
  )
  await ensureWebhookEndpoint(
    process.env.STRIPE_OVERAGE_WEBHOOK_URL,
    OVERAGE_WEBHOOK_EVENTS,
    "STRIPE_OVERAGE_WEBHOOK_SECRET",
    "STRIPE_OVERAGE_WEBHOOK_URL"
  )

  console.log("\nDone. Price ids (for reference only — stripe-checkout resolves these by lookup_key at request time, nothing needs to be copied into Supabase secrets):")
  for (const [planId, priceId] of Object.entries(priceIds)) {
    console.log(`  ${planId}: ${priceId}`)
  }
  console.log("\nDon't forget: supabase secrets set STRIPE_SECRET_KEY=" + secretKey.slice(0, 12) + "...")
}

main().catch((error) => {
  console.error("\nsetup-stripe failed:", error.message ?? error)
  process.exit(1)
})
