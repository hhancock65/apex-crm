// Shared Stripe client construction for stripe-checkout / stripe-webhook /
// stripe-portal. Uses the fetch-based HTTP client explicitly — Stripe's SDK
// defaults to Node's `https` module, which isn't the right transport for
// Deno's runtime.
//
// apiVersion is pinned to the literal stripe-node@17's own TypeScript types
// require (its bundled default) so a Stripe-side default-version change
// can't silently alter response shapes underneath this integration — kept
// in sync with scripts/setup-stripe.mjs's copy of the same SDK. Neither has
// been exercised against a live Stripe account from this environment (no
// Stripe API credentials available here) — confirm this is still current in
// your Stripe Dashboard → Developers → API keys before relying on it in
// production, same caveat already attached to Retell's createPhoneCall in
// _shared/retell-client.ts.

import Stripe from "npm:stripe@17"

export function getStripeClient(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY")
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY secret (set via `supabase secrets set STRIPE_SECRET_KEY=...`)")
  }
  return new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  })
}

export { Stripe }
