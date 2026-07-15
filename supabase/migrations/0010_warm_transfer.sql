-- Apex CRM 2.0 — warm transfer & escalation support
--
-- `transfer_rules` is deliberately a NEW table, not an extension of the
-- existing `ai_employees.escalation_rules` jsonb column: that column is a
-- generic free-text "if X then Y" list rendered straight into the agent
-- prompt (see _shared/prompt-builder.ts formatEscalationRules) — it isn't
-- structured enough to resolve an actual transfer target, and rewriting its
-- meaning out from under the existing EscalationRulesEditor/wizard step
-- would break a shipped feature for no reason. `transfer_rules` is narrowly
-- scoped to "what condition sends this call to which human."
--
-- `profiles.phone` is added because a `target_user_id`-based transfer rule
-- is otherwise unresolvable to an actual phone number to dial — without it,
-- team-member transfer targets could only ever produce a task/notification,
-- never a real call transfer.

alter table public.profiles add column phone text;

create type public.transfer_condition_type as enum (
  'caller_requests_human',
  'value_threshold',
  'angry_caller',
  'emergency',
  'low_confidence'
);

create table public.transfer_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  ai_employee_id uuid not null references public.ai_employees (id) on delete cascade,
  condition_type public.transfer_condition_type not null,
  -- Free text rather than numeric: only meaningful for 'value_threshold'
  -- today (parsed as a dollar amount), left null for every other condition.
  condition_value text,
  action text not null default 'transfer',
  target_user_id uuid references public.profiles (id) on delete set null,
  target_phone text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint transfer_rules_target_check check (target_user_id is not null or target_phone is not null)
);

create index idx_transfer_rules_ai_employee_id on public.transfer_rules (ai_employee_id);

create type public.transfer_status as enum ('pending', 'connected', 'failed', 'voicemail');

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  call_id uuid references public.calls (id) on delete set null,
  ai_employee_id uuid references public.ai_employees (id) on delete set null,
  -- Denormalized name snapshot: ai_employee_id is ON DELETE SET NULL (a
  -- transfer log shouldn't vanish just because the AI Employee that made it
  -- was later deleted or renamed), so the name is captured at transfer time.
  from_ai_employee text not null,
  to_user_id uuid references public.profiles (id) on delete set null,
  to_phone text,
  reason text,
  context_summary text,
  status public.transfer_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint transfers_target_check check (to_user_id is not null or to_phone is not null)
);

create index idx_transfers_org_id on public.transfers (org_id);
create index idx_transfers_call_id on public.transfers (call_id);

-- `type`/`related_to_type` are plain text, not enums/domains: 'transfer' is
-- the only producer today (warm_transfer). Constraining them now would just
-- mean an enum-widening migration the first time a second notification
-- producer shows up — same reasoning as ai_employee_actions.related_to_type.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  read boolean not null default false,
  related_to_type text,
  related_to_id uuid,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_id_unread on public.notifications (user_id, read, created_at desc);

alter table public.transfer_rules enable row level security;
alter table public.transfers enable row level security;
alter table public.notifications enable row level security;

do $$
declare
  t text;
  tenant_tables text[] := array['transfer_rules', 'transfers'];
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

-- notifications: org-scoped like everything else, but ALSO user-scoped — a
-- notification is private to its recipient, not visible to the whole org
-- the way contacts/leads/deals are. Mirrors get_user_org_id()'s own
-- security-definer pattern so RLS doesn't need to re-derive the JWT lookup
-- inline in every policy.
create or replace function public.get_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where clerk_user_id = (auth.jwt() ->> 'sub')
  limit 1;
$$;

-- No insert policy: notifications are only ever created server-side by
-- Edge Functions using the service-role key (which bypasses RLS entirely),
-- never directly by a signed-in client.
create policy "notifications_select_own" on public.notifications
  for select using (org_id = public.get_user_org_id() and user_id = public.get_current_profile_id());

create policy "notifications_update_own" on public.notifications
  for update
  using (org_id = public.get_user_org_id() and user_id = public.get_current_profile_id())
  with check (org_id = public.get_user_org_id() and user_id = public.get_current_profile_id());

create policy "notifications_delete_own" on public.notifications
  for delete using (org_id = public.get_user_org_id() and user_id = public.get_current_profile_id());

alter publication supabase_realtime add table public.notifications;
