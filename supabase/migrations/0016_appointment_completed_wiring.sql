-- Apex CRM 2.0 — wires 'appointment_completed' (added in 0015) into
-- handle_workflow_trigger_event(). Full create-or-replace, byte-for-byte
-- identical to 0012 except the appointments branch now also matches
-- status -> 'completed', alongside the existing status -> 'cancelled'.

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
        v_trigger_data := jsonb_build_object(
          'appointment_id', new.id, 'contact_id', new.contact_id, 'start_time', new.start_time
        );
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
      and v_workflow.trigger_config ? 'from_status'
      and v_workflow.trigger_config ->> 'from_status' is distinct from (v_trigger_data ->> 'previous_status')
    then
      continue;
    end if;
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
