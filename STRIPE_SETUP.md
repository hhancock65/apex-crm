# Stripe Setup Guide — Apex CRM

## Overview
Stripe handles all billing. When a trial expires, users are redirected to Stripe Checkout to enter their card. Stripe then tells your app (via webhook) to activate their account.

---

## Step 1 — Create a Stripe account
Go to https://stripe.com and sign up. Use test mode while building.

---

## Step 2 — Create your products and prices

In Stripe Dashboard → **Products** → **Add product**:

**Product 1: Apex CRM Starter**
- Price: $29.00 / month / recurring
- Copy the Price ID (starts with `price_`) → this is `STRIPE_STARTER_PRICE_ID`

**Product 2: Apex CRM Pro**
- Price: $99.00 / month / recurring
- Copy the Price ID → this is `STRIPE_PRO_PRICE_ID`

---

## Step 3 — Get your API keys

Stripe Dashboard → **Developers** → **API keys**:
- Copy **Secret key** (starts with `sk_test_`) → `STRIPE_SECRET_KEY`
- Never put this in your frontend code — it stays in Vercel env vars only

---

## Step 4 — Set up the webhook

Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**:

**Endpoint URL:** `https://your-app.vercel.app/api/stripe-webhook`

**Events to listen for:**
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.deleted`
- `customer.subscription.updated`

Click **Add endpoint** → copy the **Signing secret** (starts with `whsec_`) → `STRIPE_WEBHOOK_SECRET`

---

## Step 5 — Enable Customer Portal

Stripe Dashboard → **Settings** → **Billing** → **Customer portal** → **Activate**

This lets customers manage their own subscription, update cards, and cancel.

---

## Step 6 — Get Supabase service role key

Supabase Dashboard → **Project Settings** → **API** → copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ This key bypasses Row Level Security — only use it in server-side functions, never in frontend code.

---

## Step 7 — Add all env vars to Vercel

In Vercel → your project → **Settings** → **Environment Variables**, add:

| Variable | Value |
|---|---|
| `REACT_APP_SUPABASE_URL` | your Supabase URL |
| `REACT_APP_SUPABASE_ANON_KEY` | your Supabase anon key |
| `STRIPE_SECRET_KEY` | sk_test_... |
| `STRIPE_WEBHOOK_SECRET` | whsec_... |
| `STRIPE_STARTER_PRICE_ID` | price_... |
| `STRIPE_PRO_PRICE_ID` | price_... |
| `NEXT_PUBLIC_APP_URL` | https://your-app.vercel.app |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |

---

## Step 8 — Run migration v3

In Supabase SQL Editor, run `supabase/migration_v3_saas.sql` if you haven't already.

---

## Step 9 — Deploy and test

```bash
git add .
git commit -m "feat: Stripe billing integration"
git push
```

Vercel auto-deploys. Then test with Stripe's test card:
- Card: `4242 4242 4242 4242`
- Expiry: any future date
- CVC: any 3 digits

---

## Going live (real payments)

1. In Stripe, switch from **Test mode** to **Live mode**
2. Replace your test API keys with live keys in Vercel env vars
3. Create live products and replace the Price IDs
4. Update the webhook endpoint to use live mode

---

## How the billing flow works

```
User trial expires
      ↓
Click "Upgrade now"
      ↓
Frontend calls /api/create-checkout
      ↓
Stripe Checkout page (hosted by Stripe)
      ↓
User enters card → payment succeeds
      ↓
Stripe sends webhook to /api/stripe-webhook
      ↓
Webhook updates organizations.plan in Supabase
      ↓
User's account is activated
```
