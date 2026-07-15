-- Apex CRM 2.0 — workflow execution engine
--
-- Turns the foundation laid in 0011/0012/0016 into a real step-by-step
-- runner. Three additions:
--
-- 1. scheduled_tasks: how a 'wait' step actually pauses a run. There is no
--    reliable way to "sleep" inside a serverless Edge Function past the
--    response (Deno Deploy/Supabase edge functions don't guarantee
--    background execution after the response is sent — a setTimeout that
--    outlives the response is not something to depend on). So a wait step
--    persists a resume_at row here and the *function invocation ends* —
--    workflow_runs.status moves to 'waiting' instead of staying 'running'.
--    A once-a-minute pg_cron tick (below) wakes anything due.
--
-- 2. workflow_run_status gains 'waiting' — distinct from 'running' (this
--    invocation is actively executing steps right now) so the UI can show
--    "paused, resumes at 3:00pm" instead of a misleading spinner.
--
-- 3. workflow_run_steps.attempts — the retry-with-backoff loop in
--    workflow-executor (send_sms/send_email/ai_call/webhook only — the
--    other step types are DB writes where retrying an identical failure
--    three times just delays reporting a real config bug) records how many
--    tries a step actually took.
--
-- Also retargets handle_workflow_trigger_event() at /workflow-executor —
-- execute-workflow-run is being renamed, not just extended, since it's now
-- a materially bigger engine (resumable waits, real outbound calls,
-- webhooks, retries) than the "foundation" pass that named it.

alter type public.workflow_run_status add value if not exists 'waiting';

alter table public.workflow_run_steps add column attempts integer not null default 1;

create table public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.workflow_runs (id) on delete cascade,
  -- The step to resume AT once resume_at arrives — i.e. the wait step's own
  -- next_step_id, captured at schedule time so the resumer doesn't need to
  -- re-read the workflow definition just to know where to continue.
  resume_step_id text not null,
  resume_at timestamptz not null,
  status text not null default 'pending', -- pending | processing | completed | cancelled
  created_at timestamptz not null default now()
);

create index idx_scheduled_tasks_due on public.scheduled_tasks (resume_at) where status = 'pending';
create index idx_scheduled_tasks_workflow_run_id on public.scheduled_tasks (workflow_run_id);

alter table public.scheduled_tasks enable row level security;

-- Same EXISTS-through-workflow_runs shape as workflow_run_steps (0011) —
-- only the service-role client ever inserts here, but "Cancel Run" runs as
-- the signed-in user and needs to cancel this run's pending scheduled_tasks
-- itself, so a real update policy (not just select) is required.
create policy "scheduled_tasks_select_org" on public.scheduled_tasks
  for select using (
    exists (
      select 1 from public.workflow_runs wr
      where wr.id = scheduled_tasks.workflow_run_id and wr.org_id = public.get_user_org_id()
    )
  );

create policy "scheduled_tasks_insert_org" on public.scheduled_tasks
  for insert with check (
    exists (
      select 1 from public.workflow_runs wr
      where wr.id = scheduled_tasks.workflow_run_id and wr.org_id = public.get_user_org_id()
    )
  );

create policy "scheduled_tasks_update_org" on public.scheduled_tasks
  for update
  using (
    exists (
      select 1 from public.workflow_runs wr
      where wr.id = scheduled_tasks.workflow_run_id and wr.org_id = public.get_user_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.workflow_runs wr
      where wr.id = scheduled_tasks.workflow_run_id and wr.org_id = public.get_user_org_id()
    )
  );

create policy "scheduled_tasks_delete_org" on public.scheduled_tasks
  for delete using (
    exists (
      select 1 from public.workflow_runs wr
      where wr.id = scheduled_tasks.workflow_run_id and wr.org_id = public.get_user_org_id()
    )
  );

alter publication supabase_realtime add table public.workflow_runs;
alter publication supabase_realtime add table public.workflow_run_steps;

-- Byte-for-byte identical to 0016's version except the net.http_post target
-- (/execute-workflow-run -> /workflow-executor).
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
      elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'completed' then
        v_trigger_type := 'appointment_completed';
        v_trigger_data := jsonb_build_object('appointment_id', new.id, 'contact_id', new.contact_id, 'start_time', new.start_time);
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
        url := v_base_url || '/workflow-executor',
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

-- Thin wrapper mirroring trigger_campaign_batch_processing (0014) — the
-- actual "find due tasks and resume them" loop lives in Deno
-- (resume-scheduled-workflows), not in SQL. This just wakes it up.
create or replace function public.trigger_workflow_resume_scan()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_secret text;
begin
  v_base_url := current_setting('app.settings.edge_function_base_url', true);
  v_secret := current_setting('app.settings.workflow_trigger_secret', true);

  if v_base_url is not null and v_secret is not null then
    perform net.http_post(
      url := v_base_url || '/resume-scheduled-workflows',
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Workflow-Trigger-Secret', v_secret),
      timeout_milliseconds := 20000
    );
  else
    raise warning
      'trigger_workflow_resume_scan: app.settings.edge_function_base_url / workflow_trigger_secret are not configured (see migration 0011 header) — waiting workflow runs will never resume';
  end if;
end;
$$;

-- Every minute, matching the spec's "checks every minute for due tasks" and
-- scheduled_tasks' own resume_at granularity.
select cron.schedule(
  'resume-scheduled-workflows',
  '* * * * *',
  $$select public.trigger_workflow_resume_scan();$$
);
