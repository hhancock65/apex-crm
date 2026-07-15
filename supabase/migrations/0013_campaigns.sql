-- Apex CRM 2.0 — Campaign Manager (lead reactivation & outbound sequences)
--
-- campaign_contacts has no org_id column (matches workflow_run_steps'
-- precedent in migration 0011) — RLS joins through campaigns instead.
--
-- resolve_campaign_audience() is the single source of truth for "which
-- contacts match this campaign's target_filter" — used both by the wizard's
-- live "estimated count" preview (called directly by the signed-in client)
-- and by launch-campaign (called by the service-role Edge Function) when it
-- actually seeds campaign_contacts. Sharing one function keeps the preview
-- honest: what you see in the wizard is exactly what gets enrolled.
--
-- Deliberately NOT `security definer`: org scoping comes from RLS on
-- contacts/leads/deals, not from trusting the p_org_id argument. A definer
-- function would let any signed-in user pass a different org's id and read
-- their contacts — invoker rights mean RLS still filters to the caller's
-- own org regardless of what org_id they pass in.

create type public.campaign_type as enum ('reactivation', 'nurture', 'outbound', 'follow_up');
create type public.campaign_status as enum ('draft', 'active', 'paused', 'completed');
create type public.campaign_contact_status as enum (
  'pending', 'in_progress', 'contacted', 'responded', 'converted', 'skipped', 'failed'
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  type public.campaign_type not null,
  ai_employee_id uuid references public.ai_employees (id) on delete set null,
  -- { tags?: string[], last_activity_before?: date, last_activity_after?: date,
  --   lead_status?: string[], deal_status?: string[] }
  target_filter jsonb not null default '{}'::jsonb,
  -- { mode: 'template'|'custom', template_name?: string, instructions?: string }
  message_templates jsonb not null default '{}'::jsonb,
  -- { start_date, max_calls_per_day, time_window_start, time_window_end, days_of_week: number[] }
  schedule_config jsonb not null default '{}'::jsonb,
  status public.campaign_status not null default 'draft',
  -- Supplementary breakdown (e.g. {"calls_made":12,"no_answer":3,"voicemail":2}) —
  -- the 4 columns below are the authoritative headline numbers, queried
  -- directly rather than parsed out of this blob.
  stats jsonb not null default '{}'::jsonb,
  total_contacts integer not null default 0,
  contacts_processed integer not null default 0,
  contacts_responded integer not null default 0,
  appointments_booked integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_campaigns_org_id on public.campaigns (org_id);
create index idx_campaigns_active on public.campaigns (org_id) where status = 'active';

create trigger set_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

create table public.campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  status public.campaign_contact_status not null default 'pending',
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

create index idx_campaign_contacts_campaign_id on public.campaign_contacts (campaign_id);
-- process-campaign-batch's core query: "give me this campaign's next N
-- pending contacts" — this is exactly that shape.
create index idx_campaign_contacts_pending on public.campaign_contacts (campaign_id, status)
  where status = 'pending';

create trigger set_updated_at before update on public.campaign_contacts
  for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;
alter table public.campaign_contacts enable row level security;

do $$
declare
  t text;
  tenant_tables text[] := array['campaigns'];
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

create policy "campaign_contacts_select_org" on public.campaign_contacts
  for select using (
    exists (select 1 from public.campaigns c where c.id = campaign_contacts.campaign_id and c.org_id = public.get_user_org_id())
  );

create policy "campaign_contacts_insert_org" on public.campaign_contacts
  for insert with check (
    exists (select 1 from public.campaigns c where c.id = campaign_contacts.campaign_id and c.org_id = public.get_user_org_id())
  );

create policy "campaign_contacts_update_org" on public.campaign_contacts
  for update
  using (
    exists (select 1 from public.campaigns c where c.id = campaign_contacts.campaign_id and c.org_id = public.get_user_org_id())
  )
  with check (
    exists (select 1 from public.campaigns c where c.id = campaign_contacts.campaign_id and c.org_id = public.get_user_org_id())
  );

create policy "campaign_contacts_delete_org" on public.campaign_contacts
  for delete using (
    exists (select 1 from public.campaigns c where c.id = campaign_contacts.campaign_id and c.org_id = public.get_user_org_id())
  );

alter publication supabase_realtime add table public.campaigns;
alter publication supabase_realtime add table public.campaign_contacts;

create or replace function public.resolve_campaign_audience(p_org_id uuid, p_target_filter jsonb)
returns table (contact_id uuid)
language sql
stable
as $$
  with filter_tags as (
    select coalesce(array_agg(x), '{}'::text[]) as tags
    from jsonb_array_elements_text(coalesce(p_target_filter -> 'tags', '[]'::jsonb)) x
  ),
  filter_lead_statuses as (
    select coalesce(array_agg(x), '{}'::text[]) as statuses
    from jsonb_array_elements_text(coalesce(p_target_filter -> 'lead_status', '[]'::jsonb)) x
  ),
  filter_deal_statuses as (
    select coalesce(array_agg(x), '{}'::text[]) as statuses
    from jsonb_array_elements_text(coalesce(p_target_filter -> 'deal_status', '[]'::jsonb)) x
  )
  select c.id
  from public.contacts c, filter_tags ft, filter_lead_statuses fls, filter_deal_statuses fds
  where c.org_id = p_org_id
    and (array_length(ft.tags, 1) is null or c.tags && ft.tags)
    and (
      not (p_target_filter ? 'last_activity_before')
      or c.updated_at < (p_target_filter ->> 'last_activity_before')::timestamptz
    )
    and (
      not (p_target_filter ? 'last_activity_after')
      or c.updated_at > (p_target_filter ->> 'last_activity_after')::timestamptz
    )
    and (
      array_length(fls.statuses, 1) is null
      or exists (
        select 1 from public.leads l
        where l.org_id = c.org_id and c.phone is not null and l.phone = c.phone
          and l.status::text = any (fls.statuses)
      )
    )
    and (
      array_length(fds.statuses, 1) is null
      or exists (
        select 1 from public.deals d
        where d.org_id = c.org_id and d.contact_id = c.id
          and d.status::text = any (fds.statuses)
      )
    );
$$;
