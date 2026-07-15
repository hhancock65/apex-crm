-- Apex CRM 2.0 — campaign batch processing scheduler
--
-- Campaigns pace themselves against max_calls_per_day / time_window /
-- days_of_week, which a single trigger-on-write invocation (like the
-- workflow engine's) can't express — nothing writes to campaigns/
-- campaign_contacts on the clock ticking forward. pg_cron runs a recurring
-- job instead, reusing the exact same pg_net -> Edge Function -> shared
-- secret pattern migration 0011 already established for workflows
-- (including the same WORKFLOW_TRIGGER_SECRET / X-Workflow-Trigger-Secret
-- pair — this is the same trust boundary, "Postgres calling our own Edge
-- Functions", not a new one).
--
-- If your Supabase plan doesn't have pg_cron enabled yet, enable it first
-- via Dashboard > Database > Extensions, then re-run this migration.

create extension if not exists pg_cron;

create or replace function public.trigger_campaign_batch_processing()
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
      url := v_base_url || '/process-campaign-batch',
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Workflow-Trigger-Secret', v_secret),
      timeout_milliseconds := 20000
    );
  else
    raise warning
      'trigger_campaign_batch_processing: app.settings.edge_function_base_url / workflow_trigger_secret are not configured (see migration 0011 header) — active campaigns will not advance';
  end if;
end;
$$;

-- Every 15 minutes is frequent enough that a campaign's time window (e.g.
-- 9AM-5PM) is respected with reasonable granularity, without hammering
-- Retell/Twilio/Resend or this function's own per-run overhead.
select cron.schedule(
  'process-campaign-batches',
  '*/15 * * * *',
  $$select public.trigger_campaign_batch_processing();$$
);
