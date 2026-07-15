-- Apex CRM 2.0 — call webhook ingestion support
-- Backs retell-call-webhook (call_started / call_ended / call_analyzed).

-- The original call_status enum only had terminal states — call_started
-- needs an in-progress state to insert with before the call ends.
alter type public.call_status add value if not exists 'active';

-- Retell delivers webhooks at-least-once, so the same event can arrive more
-- than once. These let ingestion use idempotent upserts (one row per call,
-- one transcript per call) instead of accumulating duplicates on retry.
alter table public.calls
  add constraint calls_retell_call_id_key unique (retell_call_id);

alter table public.call_transcripts
  add constraint call_transcripts_call_id_key unique (call_id);

-- Concurrent webhook deliveries for different calls on the same AI Employee
-- could race on a plain `update ... set total_calls = total_calls + 1` done
-- from application code — this makes the bump a single atomic statement.
create or replace function public.increment_ai_employee_calls(p_ai_employee_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_employees
  set total_calls = total_calls + 1
  where id = p_ai_employee_id;
$$;
