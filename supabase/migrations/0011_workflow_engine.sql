-- Apex CRM 2.0 — automation engine foundation
--
-- Three tables (workflows, workflow_runs, workflow_run_steps), a generic
-- trigger function attached to leads/contacts/deals/appointments/calls that
-- matches INSERTs and relevant status-change UPDATEs against active
-- workflows, and an async invocation of the execute-workflow-run Edge
-- Function via pg_net for whichever workflows matched.
--
-- POST-DEPLOY SETUP REQUIRED — the trigger can't reach your Edge Function
-- without these two database-level settings (there's no other place for
-- Postgres itself to read them from):
--   alter database postgres set "app.settings.edge_function_base_url" = 'https://<project-ref>.supabase.co/functions/v1';
--   alter database postgres set "app.settings.workflow_trigger_secret" = '<same value as the WORKFLOW_TRIGGER_SECRET Edge Function secret>';
-- Until both are set, matching workflow_runs are still created (so nothing
-- is silently lost) but never actually get executed — check Postgres logs
-- for a `raise warning` if runs seem stuck in 'running'.

create extension if not exists pg_net;

create type public.workflow_trigger_type as enum (
  'new_lead', 'lead_status_change', 'new_contact', 'new_deal', 'deal_stage_change',
  'appointment_booked', 'appointment_cancelled', 'missed_call', 'call_completed',
  'manual', 'scheduled', 'form_submission'
);

create type public.workflow_status as enum ('active', 'paused', 'draft');
create type public.workflow_run_status as enum ('running', 'completed', 'failed', 'cancelled');
create type public.workflow_run_step_status as enum ('pending', 'running', 'completed', 'failed', 'skipped');

create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  trigger_type public.workflow_trigger_type not null,
  trigger_config jsonb not null default '{}'::jsonb,
  -- [{ id, type, config, next_step_id, condition? }, ...] — steps[0] is the
  -- entry point; the executor walks next_step_id from there. Step `type` is
  -- one of: wait, send_sms, send_email, ai_call, create_task, update_record,
  -- condition, notification, webhook (see execute-workflow-run/index.ts).
  steps jsonb not null default '[]'::jsonb,
  status public.workflow_status not null default 'draft',
  total_runs integer not null default 0,
  last_run_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_workflows_org_id on public.workflows (org_id);
-- Every workflow-trigger-event lookup filters on (org_id, status='active',
-- trigger_type) — a partial index keyed on exactly that avoids scanning
-- paused/draft workflows, which is most of them most of the time.
create index idx_workflows_active_trigger_type on public.workflows (org_id, trigger_type) where status = 'active';

create trigger set_updated_at before update on public.workflows
  for each row execute function public.set_updated_at();

create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  trigger_data jsonb not null default '{}'::jsonb,
  status public.workflow_run_status not null default 'running',
  current_step_id text,
  steps_completed integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_workflow_runs_org_id on public.workflow_runs (org_id);
create index idx_workflow_runs_workflow_id on public.workflow_runs (workflow_id, started_at desc);

-- No org_id column here by design (per spec) — RLS below joins through
-- workflow_runs instead of the usual direct org_id column.
create table public.workflow_run_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.workflow_runs (id) on delete cascade,
  step_id text not null,
  status public.workflow_run_step_status not null default 'pending',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz
);

create index idx_workflow_run_steps_workflow_run_id on public.workflow_run_steps (workflow_run_id);

alter table public.workflows enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_run_steps enable row level security;

do $$
declare
  t text;
  tenant_tables text[] := array['workflows', 'workflow_runs'];
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

create policy "workflow_run_steps_select_org" on public.workflow_run_steps
  for select using (
    exists (
      select 1 from public.workflow_runs wr
      where wr.id = workflow_run_steps.workflow_run_id and wr.org_id = public.get_user_org_id()
    )
  );

create policy "workflow_run_steps_insert_org" on public.workflow_run_steps
  for insert with check (
    exists (
      select 1 from public.workflow_runs wr
      where wr.id = workflow_run_steps.workflow_run_id and wr.org_id = public.get_user_org_id()
    )
  );

create policy "workflow_run_steps_update_org" on public.workflow_run_steps
  for update
  using (
    exists (
      select 1 from public.workflow_runs wr
      where wr.id = workflow_run_steps.workflow_run_id and wr.org_id = public.get_user_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.workflow_runs wr
      where wr.id = workflow_run_steps.workflow_run_id and wr.org_id = public.get_user_org_id()
    )
  );

create policy "workflow_run_steps_delete_org" on public.workflow_run_steps
  for delete using (
    exists (
      select 1 from public.workflow_runs wr
      where wr.id = workflow_run_steps.workflow_run_id and wr.org_id = public.get_user_org_id()
    )
  );

-- ============================================================================
-- TRIGGER LISTENER SYSTEM
-- ============================================================================
--
-- One shared function, attached to 5 tables. Each table's trigger fires on
-- INSERT for its "new_*" trigger_type and, where the enum defines a
-- corresponding status-change type, on UPDATE when the relevant column
-- actually changes (guarded with `is distinct from`, not a blanket "any
-- update"). 'manual', 'scheduled', and 'form_submission' are modeled in the
-- enum for forward-compatibility but have no firing mechanism yet — a
-- "Run now" button, pg_cron, and a public form endpoint are each their own
-- follow-up feature, not part of this foundation pass.
--
-- total_runs/last_run_at count "runs initiated" (incremented here, when the
-- run row is created), not "runs the Edge Function actually finished" — this
-- keeps the counter accurate even if the async HTTP call to
-- execute-workflow-run never lands, instead of depending on a network round
-- trip that this function doesn't wait for anyway.
create or replace function public.handle_workflow_trigger_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trigger_type public.workflow_trigger_type;
  v_org_id uuid;
  v_trigger_data jsonb;
  v_workflow record;
  v_run_id uuid;
  v_base_url text;
  v_secret text;
begin
  case tg_table_name
    when 'leads' then
      v_org_id := new.org_id;
      if tg_op = 'INSERT' then
        v_trigger_type := 'new_lead';
        v_trigger_data := jsonb_build_object('lead_id', new.id, 'status', new.status, 'source', new.source);
      elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
        v_trigger_type := 'lead_status_change';
        v_trigger_data := jsonb_build_object(
          'lead_id', new.id, 'status', new.status, 'previous_status', old.status
        );
      else
        return new;
      end if;

    when 'contacts' then
      if tg_op = 'INSERT' then
        v_org_id := new.org_id;
        v_trigger_type := 'new_contact';
        v_trigger_data := jsonb_build_object('contact_id', new.id);
      else
        return new;
      end if;

    when 'deals' then
      v_org_id := new.org_id;
      if tg_op = 'INSERT' then
        v_trigger_type := 'new_deal';
        v_trigger_data := jsonb_build_object('deal_id', new.id, 'contact_id', new.contact_id, 'stage_id', new.stage_id, 'value', new.value);
      elsif tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
        v_trigger_type := 'deal_stage_change';
        v_trigger_data := jsonb_build_object(
          'deal_id', new.id, 'contact_id', new.contact_id, 'stage_id', new.stage_id,
          'previous_stage_id', old.stage_id, 'value', new.value
        );
      else
        return new;
      end if;

    when 'appointments' then
      v_org_id := new.org_id;
      if tg_op = 'INSERT' then
        v_trigger_type := 'appointment_booked';
        v_trigger_data := jsonb_build_object('appointment_id', new.id, 'contact_id', new.contact_id, 'start_time', new.start_time);
      elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'cancelled' then
        v_trigger_type := 'appointment_cancelled';
        v_trigger_data := jsonb_build_object('appointment_id', new.id, 'contact_id', new.contact_id);
      else
        return new;
      end if;

    when 'calls' then
      -- calls has no "new_call" trigger_type — retell-call-webhook inserts
      -- calls with status='active' and updates them to a terminal status,
      -- so both call trigger types are UPDATE-driven.
      v_org_id := new.org_id;
      if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'missed' then
        v_trigger_type := 'missed_call';
        v_trigger_data := jsonb_build_object('call_id', new.id, 'contact_id', new.contact_id, 'caller_phone', new.caller_phone);
      elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'completed' then
        v_trigger_type := 'call_completed';
        v_trigger_data := jsonb_build_object('call_id', new.id, 'contact_id', new.contact_id, 'outcome', new.outcome);
      else
        return new;
      end if;

    else
      return new;
  end case;

  for v_workflow in
    select id, trigger_config
    from public.workflows
    where org_id = v_org_id and status = 'active' and trigger_type = v_trigger_type
  loop
    -- trigger_config lets a workflow narrow a status-change trigger to one
    -- specific transition instead of firing on every transition. Unset (the
    -- common case) means "match unconditionally", same as every other
    -- trigger_type.
    if v_trigger_type = 'lead_status_change'
      and v_workflow.trigger_config ? 'to_status'
      and v_workflow.trigger_config ->> 'to_status' is distinct from (v_trigger_data ->> 'status')
    then
      continue;
    end if;
    if v_trigger_type = 'deal_stage_change'
      and v_workflow.trigger_config ? 'to_stage_id'
      and v_workflow.trigger_config ->> 'to_stage_id' is distinct from (v_trigger_data ->> 'stage_id')
    then
      continue;
    end if;

    insert into public.workflow_runs (org_id, workflow_id, trigger_data, status)
    values (v_org_id, v_workflow.id, v_trigger_data, 'running')
    returning id into v_run_id;

    update public.workflows
    set total_runs = total_runs + 1, last_run_at = now()
    where id = v_workflow.id;

    v_base_url := current_setting('app.settings.edge_function_base_url', true);
    v_secret := current_setting('app.settings.workflow_trigger_secret', true);

    if v_base_url is not null and v_secret is not null then
      perform net.http_post(
        url := v_base_url || '/execute-workflow-run',
        body := jsonb_build_object('workflow_run_id', v_run_id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'X-Workflow-Trigger-Secret', v_secret),
        timeout_milliseconds := 5000
      );
    else
      raise warning
        'workflow_run % created for workflow % but not queued — app.settings.edge_function_base_url / workflow_trigger_secret are not configured (see migration 0011 header)',
        v_run_id, v_workflow.id;
    end if;
  end loop;

  return new;
end;
$$;

create trigger trg_workflow_event_leads
  after insert or update on public.leads
  for each row execute function public.handle_workflow_trigger_event();

create trigger trg_workflow_event_contacts
  after insert on public.contacts
  for each row execute function public.handle_workflow_trigger_event();

create trigger trg_workflow_event_deals
  after insert or update on public.deals
  for each row execute function public.handle_workflow_trigger_event();

create trigger trg_workflow_event_appointments
  after insert or update on public.appointments
  for each row execute function public.handle_workflow_trigger_event();

create trigger trg_workflow_event_calls
  after update on public.calls
  for each row execute function public.handle_workflow_trigger_event();
