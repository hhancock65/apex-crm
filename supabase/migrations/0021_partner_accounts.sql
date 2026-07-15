-- Apex CRM 2.0 — partner/agency reseller accounts
--
-- ARCHITECTURE: a partner is NOT a parallel membership system — it's a
-- `partners` row layered on top of a completely normal `organizations` row
-- (partners.org_id references organizations, one-to-one). The partner's own
-- team signs in exactly like any other org's team (Clerk Organization,
-- profiles, roles) and gets zero new machinery for that. The only genuinely
-- new capability a partner has is: their Clerk user is added as a REAL
-- member of each client org's Clerk Organization when that client is
-- created (see create-client-organization Edge Function) — so "switch to a
-- client's dashboard" is just Clerk's own org-switcher
-- (setActive({organization})), and every existing RLS policy in this
-- app (all ~20 prior migrations) keeps working completely unchanged,
-- because get_user_org_id() genuinely does resolve to the client org while
-- the partner is "inside" it. Zero existing policies are touched by this
-- migration.
--
-- The one thing that IS new RLS/authorization surface: the aggregated,
-- cross-org views (a partner's "all my clients in one view" dashboard, and
-- JHDM's platform-wide view). Rather than adding cross-org read policies to
-- every CRM table (calls, subscriptions, ai_employees, ...) — which would
-- mean auditing and modifying a couple dozen already-shipped policies, a
-- much larger and riskier surface for a tenant-isolation bug — these are
-- served by a small number of narrow, purpose-built SECURITY DEFINER RPC
-- functions that check authorization internally and return only
-- aggregated/summary data. Same shape as resolve_campaign_audience (0013):
-- a purpose-built function for cross-cutting logic, not a blanket policy
-- change. `partners`/`partner_organizations` themselves are the only tables
-- with new row-level policies, and they hold no CRM data — just the
-- reseller relationship metadata.
--
-- JHDM super-admin identity is a small, fixed set of Clerk user ids — a GUC
-- (app.settings.jhdm_admin_clerk_user_ids), same mechanism already used for
-- app.settings.workflow_trigger_secret (0011) — rather than hardcoding real
-- user ids into a committed migration file. REQUIRED POST-DEPLOY SETUP:
--   alter database postgres set "app.settings.jhdm_admin_clerk_user_ids" = 'user_xxx,user_yyy';
-- Until set, is_jhdm_admin() fails closed (nobody is a JHDM admin) — the
-- correct default for a super-admin gate.

create type public.partner_status as enum ('pending', 'active', 'suspended');
create type public.partner_billing_type as enum ('wholesale', 'revenue_share');
create type public.partner_organization_status as enum ('active', 'suspended');

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade unique,
  name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  status public.partner_status not null default 'pending',
  commission_rate numeric not null default 0,
  billing_type public.partner_billing_type not null default 'wholesale',
  settings jsonb not null default '{}'::jsonb,
  -- White-label basics (item 4) — deliberately just 3 plain columns, not
  -- folded into `settings`, since the frontend reads them directly and
  -- often (get_org_white_label below).
  custom_logo_url text,
  primary_color text,
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_partners_org_id on public.partners (org_id);

create trigger set_updated_at before update on public.partners
  for each row execute function public.set_updated_at();

create table public.partner_organizations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  -- unique: a client org has at most one reseller managing it.
  org_id uuid not null references public.organizations (id) on delete cascade unique,
  status public.partner_organization_status not null default 'active',
  monthly_rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create index idx_partner_organizations_partner_id on public.partner_organizations (partner_id);

alter table public.partners enable row level security;
alter table public.partner_organizations enable row level security;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Mirrors get_user_org_id()'s shape exactly — resolves the CURRENT
-- Clerk-active-organization's partner row, if it is one and it's active.
-- 'pending'/'suspended' partners get no partner-scoped access at all —
-- until JHDM approves them, they're just a normal org with an inert
-- partners row.
create or replace function public.get_user_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.partners p
  where p.org_id = public.get_user_org_id() and p.status = 'active';
$$;

create or replace function public.is_jhdm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() ->> 'sub') = any (
      string_to_array(current_setting('app.settings.jhdm_admin_clerk_user_ids', true), ',')
    ),
    false
  );
$$;

-- Raw, UNRESOLVED Clerk claims — used only for the bootstrapping moment
-- before an organizations row exists yet (partner-register), where
-- get_user_org_id() would return nothing. Safe to trust: by the time this
-- executes, Supabase's third-party-auth layer has already verified the
-- Clerk JWT's signature (see src/lib/clerk-supabase.ts) — this is NOT the
-- same as an Edge Function decoding an unverified bearer token itself.
create or replace function public.get_current_clerk_org_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select auth.jwt() ->> 'org_id';
$$;

create or replace function public.get_current_clerk_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select auth.jwt() ->> 'sub';
$$;

-- Callable by ANY authenticated user for THEIR OWN org's branding — not
-- sensitive (it's what they already see once they load the app), so no
-- partner/JHDM check needed, just get_user_org_id()'s usual scoping.
create or replace function public.get_org_white_label()
returns table (custom_logo_url text, primary_color text, company_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.custom_logo_url, p.primary_color, p.company_name
  from public.partner_organizations po
  join public.partners p on p.id = po.partner_id
  where po.org_id = public.get_user_org_id() and p.status = 'active'
  limit 1;
$$;

-- ============================================================================
-- RLS
-- ============================================================================

create policy "partners_select_own_or_jhdm" on public.partners
  for select using (org_id = public.get_user_org_id() or public.is_jhdm_admin());

-- No insert policy — only the service-role client (partner-register Edge
-- Function) creates partners rows, same as subscriptions (0018).
create policy "partners_update_own_or_jhdm" on public.partners
  for update
  using (org_id = public.get_user_org_id() or public.is_jhdm_admin())
  with check (org_id = public.get_user_org_id() or public.is_jhdm_admin());

-- Row-level RLS can't restrict individual COLUMNS, but status/
-- commission_rate/billing_type are JHDM-only decisions (approve/suspend,
-- deal terms) even though the partner's own org otherwise has UPDATE
-- rights on this row (to edit contact info and white-label settings) — a
-- trigger is what actually enforces the column-level boundary.
create or replace function public.protect_partner_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_jhdm_admin() then
    if new.status is distinct from old.status
      or new.commission_rate is distinct from old.commission_rate
      or new.billing_type is distinct from old.billing_type
    then
      raise exception 'Only JHDM admins can change a partner''s status, commission rate, or billing type';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protect_partner_admin_columns
  before update on public.partners
  for each row execute function public.protect_partner_admin_columns();

create policy "partner_organizations_select" on public.partner_organizations
  for select using (partner_id = public.get_user_partner_id() or public.is_jhdm_admin());

-- No insert policy — only the service-role client (create-client-organization
-- Edge Function) creates these links.
create policy "partner_organizations_update" on public.partner_organizations
  for update
  using (partner_id = public.get_user_partner_id() or public.is_jhdm_admin())
  with check (partner_id = public.get_user_partner_id() or public.is_jhdm_admin());

alter publication supabase_realtime add table public.partners;
alter publication supabase_realtime add table public.partner_organizations;

-- ============================================================================
-- AGGREGATION RPCs
-- ============================================================================
-- MRR is deliberately NOT computed here for platform-wide stats: plan
-- prices live only in code (src/lib/plans.ts / _shared/plans.ts), not the
-- database — the billing phase deliberately kept plan_id a plain, un-priced
-- string precisely so pricing changes never need a migration. These RPCs
-- return raw plan_id/status; the frontend sums PLANS[plan_id].priceMonthly
-- client-side. partner_organizations.monthly_rate IS a real stored column
-- (a partner's own custom rate with their client, not Apex's list price),
-- so partner-facing MRR sums that directly here — a genuinely different
-- number, both correctly computed where they actually live.

-- A partner's own client roster + per-client stats — powers both
-- PartnerDashboardPage's table AND its summary cards (the frontend reduces
-- this same result set for totals, avoiding a second round trip).
create or replace function public.get_partner_dashboard()
returns table (
  org_id uuid,
  org_name text,
  org_clerk_id text,
  plan_id text,
  subscription_status text,
  monthly_rate numeric,
  link_status text,
  ai_employee_count bigint,
  calls_this_month bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid := public.get_user_partner_id();
begin
  if v_partner_id is null then
    raise exception 'Not an active partner';
  end if;

  return query
  select
    o.id,
    o.name,
    o.clerk_org_id,
    s.plan_id,
    s.status::text,
    po.monthly_rate,
    po.status::text,
    (select count(*) from public.ai_employees ae where ae.org_id = o.id),
    (select count(*) from public.calls c where c.org_id = o.id and c.started_at >= date_trunc('month', now()))
  from public.partner_organizations po
  join public.organizations o on o.id = po.org_id
  left join public.subscriptions s on s.org_id = o.id
  where po.partner_id = v_partner_id
  order by o.name;
end;
$$;

-- JHDM: every partner + their client count + their own reseller MRR.
create or replace function public.get_platform_partners()
returns table (
  partner_id uuid,
  partner_name text,
  contact_name text,
  email text,
  status text,
  billing_type text,
  commission_rate numeric,
  client_count bigint,
  partner_mrr numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_jhdm_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    p.id,
    p.name,
    p.contact_name,
    p.email,
    p.status::text,
    p.billing_type::text,
    p.commission_rate,
    count(po.id),
    coalesce(sum(po.monthly_rate) filter (where po.status = 'active'), 0),
    p.created_at
  from public.partners p
  left join public.partner_organizations po on po.partner_id = p.id
  group by p.id
  order by p.created_at desc;
end;
$$;

-- JHDM: every organization on the platform (partner-managed or not) +
-- enough per-org data for the frontend to compute platform-wide totals
-- (orgs, AI Employees, calls, MRR) from this single result set.
create or replace function public.get_platform_organizations()
returns table (
  org_id uuid,
  org_name text,
  partner_name text,
  plan_id text,
  subscription_status text,
  ai_employee_count bigint,
  calls_count bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_jhdm_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    o.id,
    o.name,
    p.name,
    s.plan_id,
    s.status::text,
    (select count(*) from public.ai_employees ae where ae.org_id = o.id),
    (select count(*) from public.calls c where c.org_id = o.id),
    o.created_at
  from public.organizations o
  left join public.partner_organizations po on po.org_id = o.id
  left join public.partners p on p.id = po.partner_id
  left join public.subscriptions s on s.org_id = o.id
  order by o.created_at desc;
end;
$$;
