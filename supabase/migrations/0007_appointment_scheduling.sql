-- Apex CRM 2.0 — AI-driven appointment scheduling support
-- Backs retell-function-handler's book_appointment / reschedule_appointment /
-- cancel_appointment tools.

-- ai_action_type already covers 'appointment_booked'/'appointment_rescheduled'
-- but has no value for a cancellation — added the same way migration 0004
-- added call_status's 'active' value: as its own statement, not used until a
-- later transaction (retell-function-handler), so it's safe under Postgres's
-- "can't use a new enum value in the transaction that added it" rule.
alter type public.ai_action_type add value if not exists 'appointment_cancelled';

-- Mirrors increment_ai_employee_calls (migration 0004) — keeps concurrent
-- webhook/tool-call deliveries for the same AI Employee from racing on a
-- plain `total_appointments = total_appointments + 1` read-modify-write.
create or replace function public.increment_ai_employee_appointments(p_ai_employee_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_employees
  set total_appointments = total_appointments + 1
  where id = p_ai_employee_id;
$$;
