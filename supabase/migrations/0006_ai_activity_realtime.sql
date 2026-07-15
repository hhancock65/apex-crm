-- Apex CRM 2.0 — AI Activity Center support
--
-- 1) ai_employee_actions has no outcome field yet — every insert so far
--    (retell-call-webhook) only fires after something already succeeded, so
--    'success' is the correct default for existing and future rows. 'pending'
--    /'failed' exist for action types that haven't shipped yet (e.g. an
--    outbound action submitted to Retell but not yet confirmed).
-- 2) Enables Postgres logical replication for the table so the client can
--    subscribe to INSERTs via supabase-js's `.channel(...).on('postgres_changes', ...)`.
--    Realtime broadcasts are still filtered through the table's existing RLS
--    policies — a client only receives rows its own org_id would satisfy.

create type public.ai_action_result as enum ('success', 'pending', 'failed');

alter table public.ai_employee_actions
  add column result public.ai_action_result not null default 'success';

alter publication supabase_realtime add table public.ai_employee_actions;
