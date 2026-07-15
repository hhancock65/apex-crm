-- Apex CRM 2.0 — Stripe subscription billing
--
-- One `subscriptions` row per org (org_id is unique — an org has exactly
-- one current subscription; stripe-webhook upserts this row on every state
-- change rather than ever creating a second row for the same org over
-- time). `plan_features` on organizations is a cached snapshot of what the
-- currently-active plan actually unlocks, computed by
-- supabase/functions/_shared/plans.ts's computePlanFeatures() (mirrored at
-- src/lib/plans.ts) — not something an org edits directly, and not
-- something the frontend re-derives either: src/hooks/useSubscription.ts
-- reads this column as the literal, authoritative "what can this org do
-- right now" answer, so it stays correct even if the app's own copy of the
-- feature map ever drifts from what a webhook computed at write time.
--
-- plan_id is deliberately NOT an enum, unlike status — Stripe lookup_keys
-- and pricing tiers are the kind of thing that gets renamed/restructured as
-- a business evolves, and an enum-widening migration for that is more
-- friction than it's worth for 4 known string values. A CHECK constraint
-- still gives real data integrity without that friction.

create type public.subscription_status as enum ('active', 'past_due', 'cancelled', 'trialing');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  plan_id text not null check (plan_id in ('apex_crm', 'apex_ai_crm', 'apex_ai_workforce', 'apex_scale')),
  status public.subscription_status not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_org_id_key unique (org_id)
);

create index idx_subscriptions_stripe_customer_id on public.subscriptions (stripe_customer_id);

create trigger set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.organizations add column plan_features jsonb not null default '{}'::jsonb;

alter table public.subscriptions enable row level security;

-- SELECT only: the only writer is stripe-webhook (service role, which
-- bypasses RLS entirely). There's no user-facing path that ever
-- inserts/updates a subscriptions row directly — Checkout and the Customer
-- Portal are both Stripe-hosted redirects, not app-issued writes — so
-- unlike scheduled_tasks (0017), which genuinely needs a user-triggered
-- UPDATE for "Cancel Run", a single read policy is the complete, correct
-- set here.
create policy "subscriptions_select_org" on public.subscriptions
  for select using (org_id = public.get_user_org_id());

-- So the Billing page updates live once stripe-webhook processes a checkout
-- or portal-driven change, instead of the user having to refresh.
alter publication supabase_realtime add table public.subscriptions;
