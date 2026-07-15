-- Apex CRM 2.0 — initial schema
-- Multi-tenant model: every tenant-scoped table carries org_id (uuid, references organizations.id).
-- Tenant isolation is enforced by Postgres RLS, keyed off the Clerk organization id embedded
-- in the JWT that Clerk issues and Supabase verifies (see clerk-supabase.ts in the app).
--
-- Run once against a fresh Supabase project via the SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.org_role as enum ('owner', 'admin', 'manager', 'member');

create type public.lead_status as enum ('new', 'contacted', 'qualified', 'unqualified', 'converted');
create type public.lead_source as enum ('website', 'phone', 'referral', 'ai_employee', 'campaign', 'manual', 'other');

create type public.deal_status as enum ('open', 'won', 'lost');

create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_status as enum ('pending', 'in_progress', 'completed', 'cancelled');

create type public.appointment_type as enum ('call', 'meeting', 'demo', 'service', 'follow_up', 'other');
create type public.appointment_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

create type public.activity_type as enum (
  'call', 'email', 'sms', 'note',
  'task_created', 'task_completed',
  'deal_created', 'deal_won', 'deal_lost',
  'appointment_booked',
  'lead_created', 'contact_created',
  'ai_action'
);

-- Polymorphic "related_to_type" columns (tasks, activities, notes) are app-enforced,
-- not FK-enforced — a single column can't carry a real FK to five different tables.
create domain public.related_entity_type as text
  check (value in ('lead', 'contact', 'company', 'deal', 'task', 'appointment'));

-- ============================================================================
-- TABLES
-- ============================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  clerk_org_id text not null unique,
  name text not null,
  slug text unique,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  org_id uuid references public.organizations (id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  role public.org_role not null default 'member',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  industry text,
  website text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  employee_count integer,
  annual_revenue numeric(14, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  company_id uuid references public.companies (id) on delete set null,
  address text,
  city text,
  state text,
  zip text,
  tags text[] not null default '{}'::text[],
  notes text,
  lifetime_value numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  source public.lead_source not null default 'manual',
  status public.lead_status not null default 'new',
  assigned_to uuid references public.profiles (id) on delete set null,
  notes text,
  score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  position integer not null,
  color text,
  win_probability numeric(5, 2),
  created_at timestamptz not null default now(),
  unique (pipeline_id, position)
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages (id) on delete restrict,
  contact_id uuid references public.contacts (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  title text not null,
  value numeric(14, 2) not null default 0,
  probability numeric(5, 2),
  expected_close_date date,
  assigned_to uuid references public.profiles (id) on delete set null,
  status public.deal_status not null default 'open',
  notes text,
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.profiles (id) on delete set null,
  related_to_type public.related_entity_type,
  related_to_id uuid,
  due_date timestamptz,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  contact_id uuid references public.contacts (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  location text,
  type public.appointment_type not null default 'meeting',
  status public.appointment_status not null default 'scheduled',
  notes text,
  created_by_ai boolean not null default false,
  ai_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_end_after_start check (end_time > start_time)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  type public.activity_type not null,
  description text,
  performed_by uuid references public.profiles (id) on delete set null,
  performed_by_ai boolean not null default false,
  ai_employee_id uuid,
  related_to_type public.related_entity_type,
  related_to_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  content text not null,
  created_by uuid references public.profiles (id) on delete set null,
  related_to_type public.related_entity_type,
  related_to_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index idx_profiles_org_id on public.profiles (org_id);
create index idx_companies_org_id on public.companies (org_id);
create index idx_contacts_org_id on public.contacts (org_id);
create index idx_contacts_company_id on public.contacts (company_id);
create index idx_leads_org_id on public.leads (org_id);
create index idx_leads_status on public.leads (status);
create index idx_leads_assigned_to on public.leads (assigned_to);
create index idx_pipelines_org_id on public.pipelines (org_id);
create index idx_pipeline_stages_org_id on public.pipeline_stages (org_id);
create index idx_pipeline_stages_pipeline_id on public.pipeline_stages (pipeline_id);
create index idx_deals_org_id on public.deals (org_id);
create index idx_deals_pipeline_id on public.deals (pipeline_id);
create index idx_deals_stage_id on public.deals (stage_id);
create index idx_deals_contact_id on public.deals (contact_id);
create index idx_deals_company_id on public.deals (company_id);
create index idx_deals_assigned_to on public.deals (assigned_to);
create index idx_deals_status on public.deals (status);
create index idx_tasks_org_id on public.tasks (org_id);
create index idx_tasks_assigned_to on public.tasks (assigned_to);
create index idx_tasks_due_date on public.tasks (due_date);
create index idx_tasks_related_to on public.tasks (related_to_type, related_to_id);
create index idx_appointments_org_id on public.appointments (org_id);
create index idx_appointments_contact_id on public.appointments (contact_id);
create index idx_appointments_assigned_to on public.appointments (assigned_to);
create index idx_appointments_start_time on public.appointments (start_time);
create index idx_activities_org_id on public.activities (org_id);
create index idx_activities_performed_by on public.activities (performed_by);
create index idx_activities_related_to on public.activities (related_to_type, related_to_id);
create index idx_notes_org_id on public.notes (org_id);
create index idx_notes_created_by on public.notes (created_by);
create index idx_notes_related_to on public.notes (related_to_type, related_to_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Resolves the calling user's internal organizations.id from the Clerk-issued JWT.
-- Assumes Clerk's session token carries the standard top-level `org_id` claim
-- (present automatically once the user has an active organization — Dashboard >
-- Sessions > Customize session token, if you need to add it explicitly).
-- security definer so it can read organizations regardless of that table's own RLS.
create or replace function public.get_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.organizations
  where clerk_org_id = (auth.jwt() ->> 'org_id')
  limit 1;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
  tables_with_updated_at text[] := array[
    'organizations', 'companies', 'contacts', 'leads',
    'deals', 'tasks', 'appointments', 'notes'
  ];
begin
  foreach t in array tables_with_updated_at loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.activities enable row level security;
alter table public.notes enable row level security;

-- organizations: the tenant root has no org_id of its own, and it is created/updated
-- by the Clerk webhook (via the service_role key, which bypasses RLS) — not by clients.
-- Members only get read access to their own org row.
create policy "organizations_select_own" on public.organizations
  for select using (clerk_org_id = (auth.jwt() ->> 'org_id'));

-- profiles: visible to the whole org, but a user can also always see their own row
-- even if it's not resolvable via get_user_org_id() (e.g. no active org selected yet).
create policy "profiles_select_org_or_self" on public.profiles
  for select using (
    org_id = public.get_user_org_id()
    or clerk_user_id = (auth.jwt() ->> 'sub')
  );

create policy "profiles_insert_self" on public.profiles
  for insert with check (clerk_user_id = (auth.jwt() ->> 'sub'));

create policy "profiles_update_self" on public.profiles
  for update using (clerk_user_id = (auth.jwt() ->> 'sub'))
  with check (clerk_user_id = (auth.jwt() ->> 'sub'));

create policy "profiles_delete_org" on public.profiles
  for delete using (org_id = public.get_user_org_id());

-- All remaining tenant-scoped tables share the same four policies, generated
-- once here instead of repeated by hand for each of the 10 tables.
do $$
declare
  t text;
  tenant_tables text[] := array[
    'companies', 'contacts', 'leads', 'pipelines', 'pipeline_stages',
    'deals', 'tasks', 'appointments', 'activities', 'notes'
  ];
begin
  foreach t in array tenant_tables loop
    execute format(
      'create policy "%1$s_select_org" on public.%1$I for select using (org_id = public.get_user_org_id());',
      t
    );
    execute format(
      'create policy "%1$s_insert_org" on public.%1$I for insert with check (org_id = public.get_user_org_id());',
      t
    );
    execute format(
      'create policy "%1$s_update_org" on public.%1$I for update using (org_id = public.get_user_org_id()) with check (org_id = public.get_user_org_id());',
      t
    );
    execute format(
      'create policy "%1$s_delete_org" on public.%1$I for delete using (org_id = public.get_user_org_id());',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- SEED: default pipeline per organization
-- ============================================================================

-- Static seed rows aren't possible here — organizations don't exist until a
-- customer signs up — so the "New Lead > ... > Closed Won/Lost" pipeline is
-- seeded automatically the moment a row lands in organizations (i.e. when your
-- Clerk webhook syncs a newly created Clerk organization).
create or replace function public.seed_default_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_pipeline_id uuid;
begin
  insert into public.pipelines (org_id, name, is_default)
  values (new.id, 'Default Pipeline', true)
  returning id into new_pipeline_id;

  insert into public.pipeline_stages (pipeline_id, org_id, name, position, color, win_probability)
  values
    (new_pipeline_id, new.id, 'New Lead',     1, '#94A3B8', 10.00),
    (new_pipeline_id, new.id, 'Qualified',    2, '#2E86AB', 30.00),
    (new_pipeline_id, new.id, 'Proposal',     3, '#F59E0B', 50.00),
    (new_pipeline_id, new.id, 'Negotiation',  4, '#8B5CF6', 70.00),
    (new_pipeline_id, new.id, 'Closed Won',   5, '#22C55E', 100.00),
    (new_pipeline_id, new.id, 'Closed Lost',  6, '#EF4444', 0.00);

  return new;
end;
$$;

create trigger trg_seed_default_pipeline
  after insert on public.organizations
  for each row execute function public.seed_default_pipeline();
