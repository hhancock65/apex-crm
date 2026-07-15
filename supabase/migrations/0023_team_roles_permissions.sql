-- Team management with roles and permissions.
--
-- Depends on 0022_team_roles_enum.sql running first (in its own transaction —
-- a freshly `add value`'d enum value can't be used, incl. as a string literal
-- cast, in the same transaction it was added in).
--
-- SCOPE DECISIONS (read before touching this file again):
--
-- 1. The task's own RLS spec ("assigned_to = auth.uid() OR created_by =
--    auth.uid()") assumes a `created_by` column that does not actually exist
--    on leads/deals/tasks/appointments (only `notes` has one — see 0001).
--    `contacts` has neither `assigned_to` nor `created_by` at all. Both gaps
--    are closed below, scoped to exactly the tables the prompt names ("their
--    own leads, contacts, deals, tasks") plus appointments (clearly implied —
--    assigned_to already exists there for the same reason it does on leads/
--    deals/tasks). companies, pipelines, pipeline_stages, activities, and
--    notes are deliberately left untouched: they have no existing ownership
--    concept, aren't named in the prompt, and inventing per-row ownership for
--    them is out of scope for this pass.
--
-- 2. created_by is populated by a BEFORE INSERT trigger (set_created_by()),
--    not by relying on every one of this app's many existing insert call
--    sites to remember to set it. It resolves the current user via
--    get_current_profile_id() (0010) — which returns null for service-role
--    inserts (AI/system-created rows, e.g. a lead created mid-call by
--    retell-function-handler). That's intentional, not a bug: an
--    AI-created, not-yet-assigned lead has no human creator, so it's
--    invisible to Sales Reps until a Manager/Admin triages and assigns it —
--    a normal lead-routing pattern, and the literal behavior the prompt's
--    own policy expression implies (neither condition matches -> no access).
--    Existing rows are NOT backfilled: leads/deals/tasks/appointments already
--    had assigned_to, so existing assignees keep seeing their own records;
--    only pre-existing `contacts` (which had no ownership column at all)
--    become invisible to Sales Reps until reassigned. That's an honest,
--    unavoidable consequence of adding ownership to a table that never had
--    it, not something to paper over with a fabricated backfill.
--
-- 3. Manager is implemented as full org-wide select/update/delete on the
--    scoped CRM tables (same as Admin), not restricted to only the
--    assigned_to column on records they don't own. The prompt's wording
--    ("view all records, manage team assignments") could be read either
--    way; a column-level restriction would need a protect-columns trigger
--    (precedent: protect_partner_admin_columns, 0021) duplicated across 5
--    tables with different column sets, for a nuance the prompt only weakly
--    implies. Full edit rights matches how "manager" works in virtually
--    every real CRM (a sales manager can edit/reassign any deal, not just
--    flip who it's assigned to).
--
-- 4. Viewer gets the same SELECT scope as Manager/Admin (full org read) but
--    zero write access anywhere. "Read-only access to dashboards and
--    reports" is satisfied by the zero-write constraint; a narrower
--    "aggregates only, no raw records" tier isn't achievable without a
--    separate reporting-view architecture this app doesn't have — the
--    analytics pages built in the previous phase query these same raw
--    tables directly from the client.
--
-- get_user_role() is the single source of truth for both RLS (this file)
-- and the frontend (usePermissions(), which reads profiles.role via a
-- Supabase query — see src/hooks/usePermissions.ts for why that's used
-- instead of literally reading Clerk organization membership metadata).

-- ============================================================================
-- 1. OWNERSHIP COLUMNS
-- ============================================================================

alter table public.contacts add column assigned_to uuid references public.profiles (id) on delete set null;
alter table public.contacts add column created_by uuid references public.profiles (id) on delete set null;
alter table public.leads add column created_by uuid references public.profiles (id) on delete set null;
alter table public.deals add column created_by uuid references public.profiles (id) on delete set null;
alter table public.tasks add column created_by uuid references public.profiles (id) on delete set null;
alter table public.appointments add column created_by uuid references public.profiles (id) on delete set null;

create index idx_contacts_assigned_to on public.contacts (assigned_to);
create index idx_contacts_created_by on public.contacts (created_by);
create index idx_leads_created_by on public.leads (created_by);
create index idx_deals_created_by on public.deals (created_by);
create index idx_tasks_created_by on public.tasks (created_by);
create index idx_appointments_created_by on public.appointments (created_by);

create or replace function public.set_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := public.get_current_profile_id();
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
  owned_tables text[] := array['leads', 'contacts', 'deals', 'tasks', 'appointments'];
begin
  foreach t in array owned_tables loop
    execute format(
      'create trigger set_created_by before insert on public.%I for each row execute function public.set_created_by();',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- 2. get_user_role()
-- ============================================================================

create or replace function public.get_user_role()
returns public.org_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where clerk_user_id = (auth.jwt() ->> 'sub')
  limit 1;
$$;

-- ============================================================================
-- 3. ROLE-AWARE RLS for leads, contacts, deals, tasks, appointments
-- ============================================================================

do $$
declare
  t text;
  scoped_tables text[] := array['leads', 'contacts', 'deals', 'tasks', 'appointments'];
begin
  foreach t in array scoped_tables loop
    execute format('drop policy if exists "%1$s_select_org" on public.%1$I;', t);
    execute format('drop policy if exists "%1$s_insert_org" on public.%1$I;', t);
    execute format('drop policy if exists "%1$s_update_org" on public.%1$I;', t);
    execute format('drop policy if exists "%1$s_delete_org" on public.%1$I;', t);

    -- owner/admin/manager/viewer see everything in the org; sales_rep only
    -- what's assigned to or created by them.
    execute format(
      'create policy "%1$s_select_scoped" on public.%1$I for select using (
         org_id = public.get_user_org_id()
         and (
           public.get_user_role() in (''owner'', ''admin'', ''manager'', ''viewer'')
           or assigned_to = public.get_current_profile_id()
           or created_by = public.get_current_profile_id()
         )
       );',
      t
    );

    -- anyone but a viewer can create records in their own org.
    execute format(
      'create policy "%1$s_insert_scoped" on public.%1$I for insert with check (
         org_id = public.get_user_org_id()
         and public.get_user_role() <> ''viewer''
       );',
      t
    );

    -- owner/admin/manager can update anything in the org; sales_rep only
    -- their own; viewer never (no policy grants it).
    execute format(
      'create policy "%1$s_update_scoped" on public.%1$I for update using (
         org_id = public.get_user_org_id()
         and (
           public.get_user_role() in (''owner'', ''admin'', ''manager'')
           or assigned_to = public.get_current_profile_id()
           or created_by = public.get_current_profile_id()
         )
       ) with check (
         org_id = public.get_user_org_id()
         and (
           public.get_user_role() in (''owner'', ''admin'', ''manager'')
           or assigned_to = public.get_current_profile_id()
           or created_by = public.get_current_profile_id()
         )
       );',
      t
    );

    execute format(
      'create policy "%1$s_delete_scoped" on public.%1$I for delete using (
         org_id = public.get_user_org_id()
         and (
           public.get_user_role() in (''owner'', ''admin'', ''manager'')
           or assigned_to = public.get_current_profile_id()
           or created_by = public.get_current_profile_id()
         )
       );',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- 4. profiles RLS additions
--
-- profiles_select_org_or_self / profiles_insert_self stay exactly as-is.
-- profiles_update_self stays too (everyone can still edit their own name/
-- avatar) — a second permissive UPDATE policy just adds more allowed cases,
-- it doesn't narrow the existing one. profiles_delete_org is tightened:
-- today ANY org member can delete ANY other member's profile row, which was
-- never correct; "Remove member" is an owner/admin action per the prompt.
-- ============================================================================

create policy "profiles_update_admin" on public.profiles
  for update
  using (org_id = public.get_user_org_id() and public.get_user_role() in ('owner', 'admin'))
  with check (org_id = public.get_user_org_id() and public.get_user_role() in ('owner', 'admin'));

drop policy if exists "profiles_delete_org" on public.profiles;

create policy "profiles_delete_admin" on public.profiles
  for delete using (
    org_id = public.get_user_org_id()
    and public.get_user_role() in ('owner', 'admin')
  );

-- ============================================================================
-- 5. organizations RLS addition — SettingsPage needs to update org settings
-- (name, settings jsonb: business hours/AI defaults/notification prefs) as
-- owner/admin. organizations only ever had organizations_select_own (0001);
-- there was no update policy at all yet since nothing needed one before now.
-- ============================================================================

create policy "organizations_update_admin" on public.organizations
  for update
  using (id = public.get_user_org_id() and public.get_user_role() in ('owner', 'admin'))
  with check (id = public.get_user_org_id() and public.get_user_role() in ('owner', 'admin'));

-- ============================================================================
-- 6. Storage bucket for org branding assets (SettingsPage logo upload)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('org-assets', 'org-assets', true)
on conflict (id) do nothing;

-- Objects are stored under `${org_id}/...` — every policy below checks that
-- prefix against the caller's own org, using storage.foldername(name)[1]
-- (the first path segment) as the org id. Public read (bucket is public, so
-- logos render without a signed URL); writes are owner/admin only.
create policy "org_assets_select_public" on storage.objects
  for select using (bucket_id = 'org-assets');

create policy "org_assets_insert_admin" on storage.objects
  for insert with check (
    bucket_id = 'org-assets'
    and public.get_user_role() in ('owner', 'admin')
    and (storage.foldername(name))[1] = public.get_user_org_id()::text
  );

create policy "org_assets_update_admin" on storage.objects
  for update using (
    bucket_id = 'org-assets'
    and public.get_user_role() in ('owner', 'admin')
    and (storage.foldername(name))[1] = public.get_user_org_id()::text
  );

create policy "org_assets_delete_admin" on storage.objects
  for delete using (
    bucket_id = 'org-assets'
    and public.get_user_role() in ('owner', 'admin')
    and (storage.foldername(name))[1] = public.get_user_org_id()::text
  );

-- ============================================================================
-- 7. Notification preferences (SettingsPage) enforcement
--
-- notify-admins.ts (the Edge Function side) checks this same
-- organizations.settings.notification_preferences map. record_usage() fires
-- its 80%/100%/200% notifications directly in SQL (0020), not through that
-- TS helper, so it needs its own copy of the same check to actually honor a
-- disabled preference rather than silently ignoring it.
-- ============================================================================

create or replace function public.notification_type_enabled(p_org_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (settings -> 'notification_preferences' ->> p_type)::boolean from public.organizations where id = p_org_id),
    true
  );
$$;

create or replace function public.record_usage(
  p_org_id uuid,
  p_ai_minutes numeric default 0,
  p_sms integer default 0,
  p_calls integer default 0
) returns public.usage_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.usage_records;
  v_before public.usage_records;
  v_was_way_over boolean;
  v_is_way_over boolean;
  r record;
begin
  select * into v_row
  from public.usage_records
  where org_id = p_org_id and current_date between period_start and period_end
  order by period_start desc
  limit 1;

  if not found then
    insert into public.usage_records (org_id, period_start, period_end, ai_minutes_included, sms_included, calls_included)
    values (
      p_org_id,
      date_trunc('month', current_date)::date,
      (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date,
      0, 0, 0
    )
    on conflict (org_id, period_start) do nothing;

    select * into v_row
    from public.usage_records
    where org_id = p_org_id and current_date between period_start and period_end
    order by period_start desc
    limit 1;
  end if;

  v_before := v_row;

  v_was_way_over :=
    v_row.ai_minutes_used > (v_row.ai_minutes_included * 2)
    or v_row.sms_sent > (v_row.sms_included * 2)
    or v_row.calls_made > (v_row.calls_included * 2);

  update public.usage_records
  set
    ai_minutes_used = ai_minutes_used + p_ai_minutes,
    sms_sent = sms_sent + p_sms,
    calls_made = calls_made + p_calls,
    overage_amount =
      greatest(0, (ai_minutes_used + p_ai_minutes) - ai_minutes_included) * 0.15
      + greatest(0, (sms_sent + p_sms) - sms_included) * 0.03
      + greatest(0, (calls_made + p_calls) - calls_included) * 0.25,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  v_is_way_over :=
    v_row.ai_minutes_used > (v_row.ai_minutes_included * 2)
    or v_row.sms_sent > (v_row.sms_included * 2)
    or v_row.calls_made > (v_row.calls_included * 2);

  if v_is_way_over and not v_was_way_over and public.notification_type_enabled(p_org_id, 'usage_overage') then
    insert into public.notifications (org_id, user_id, type, title, message, related_to_type, related_to_id)
    select
      v_row.org_id,
      p.id,
      'usage_overage',
      'Usage is more than double your plan''s included allowance',
      format(
        'This billing period (%s to %s): %s / %s AI minutes, %s / %s SMS, %s / %s calls. Overage charges apply beyond the included allowance ($0.15/min, $0.03/SMS, $0.25/call).',
        v_row.period_start, v_row.period_end,
        v_row.ai_minutes_used, v_row.ai_minutes_included,
        v_row.sms_sent, v_row.sms_included,
        v_row.calls_made, v_row.calls_included
      ),
      'usage_record',
      v_row.id
    from public.profiles p
    where p.org_id = v_row.org_id and p.role in ('owner', 'admin');
  end if;

  for r in
    select *
    from (
      values
        ('AI minutes', v_before.ai_minutes_used, v_row.ai_minutes_used, v_row.ai_minutes_included::numeric),
        ('SMS', v_before.sms_sent::numeric, v_row.sms_sent::numeric, v_row.sms_included::numeric),
        ('calls', v_before.calls_made::numeric, v_row.calls_made::numeric, v_row.calls_included::numeric)
    ) as t(label, used_before, used_after, included)
  loop
    if r.included <= 0 then
      continue;
    end if;

    if r.used_after >= r.included and r.used_before < r.included and public.notification_type_enabled(p_org_id, 'usage_exceeded') then
      insert into public.notifications (org_id, user_id, type, title, message, related_to_type, related_to_id)
      select
        v_row.org_id,
        p.id,
        'usage_exceeded',
        format('You''ve exceeded your included %s', r.label),
        format('You''ve exceeded your included %s. Overage charges apply.', r.label),
        'usage_record',
        v_row.id
      from public.profiles p
      where p.org_id = v_row.org_id and p.role in ('owner', 'admin');
    elsif r.used_after >= (r.included * 0.8) and r.used_before < (r.included * 0.8) and public.notification_type_enabled(p_org_id, 'usage_warning') then
      insert into public.notifications (org_id, user_id, type, title, message, related_to_type, related_to_id)
      select
        v_row.org_id,
        p.id,
        'usage_warning',
        format('You''re at 80%% of your %s allowance', r.label),
        format('You''ve used 80%% of your %s this billing period.', r.label),
        'usage_record',
        v_row.id
      from public.profiles p
      where p.org_id = v_row.org_id and p.role in ('owner', 'admin');
    end if;
  end loop;

  return v_row;
end;
$$;
