// Supabase Edge Function: stripe-billing-details
//
// Called from the signed-in app (Clerk-issued token) to power BillingPage's
// Payment Method card and Invoice History table — same auth pattern as
// stripe-checkout/stripe-portal: the forwarded Clerk token runs an
// RLS-scoped Supabase query to resolve the org's stripe_customer_id, which
// is the real authorization boundary here (an org can only ever see its
// own customer's data because it can only ever resolve its own customer id).
//
// Response: { paymentMethod: PaymentMethodSummary | null, invoices: InvoiceSummary[] }
//
// NOTE: like every other Stripe call in this codebase beyond the basic
// subscription lifecycle, the exact field names used below
// (invoice_settings.default_payment_method, invoice.total,
// invoice.hosted_invoice_url, invoice.invoice_pdf) have not been verified
// against a live Stripe account from this environment — confirm against
// Stripe's current API docs before relying on this in production.

import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { getStripeClient } from "../_shared/stripe-client.ts"
import { createUserScopedClient } from "../_shared/supabase-admin.ts"

interface PaymentMethodSummary {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

interface InvoiceSummary {
  id: string
  date: string
  amount: number
  currency: string
  status: string
  pdfUrl: string | null
  hostedUrl: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401)
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
      return jsonResponse({ paymentMethod: null, invoices: [] })
    }

    const customerId = subscription.stripe_customer_id
    const stripe = getStripeClient()

    let paymentMethod: PaymentMethodSummary | null = null
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    })
    if (!customer.deleted) {
      const defaultPm = customer.invoice_settings?.default_payment_method
      if (defaultPm && typeof defaultPm !== "string" && defaultPm.card) {
        paymentMethod = {
          brand: defaultPm.card.brand,
          last4: defaultPm.card.last4,
          expMonth: defaultPm.card.exp_month,
          expYear: defaultPm.card.exp_year,
        }
      }
    }
    if (!paymentMethod) {
      const paymentMethods = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 })
      const pm = paymentMethods.data[0]
      if (pm?.card) {
        paymentMethod = {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        }
      }
    }

    const invoiceList = await stripe.invoices.list({ customer: customerId, limit: 12 })
    const invoices: InvoiceSummary[] = invoiceList.data.map((invoice) => ({
      id: invoice.id,
      date: new Date(invoice.created * 1000).toISOString(),
      amount: invoice.total / 100,
      currency: invoice.currency,
      status: invoice.status ?? "unknown",
      pdfUrl: invoice.invoice_pdf ?? null,
      hostedUrl: invoice.hosted_invoice_url ?? null,
    }))

    return jsonResponse({ paymentMethod, invoices })
  } catch (error) {
    console.error("stripe-billing-details failed:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500)
  }
})
