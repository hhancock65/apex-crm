-- Apex CRM 2.0 — AI-driven lead & opportunity creation support
-- Backs retell-function-handler's create_lead / qualify_lead / create_opportunity
-- tools. No new ai_action_type values needed — 'lead_created', 'lead_qualified',
-- and 'opportunity_created' already exist (migration 0002), and lead_source
-- already has 'ai_employee' (migration 0001).

-- Mirrors increment_ai_employee_calls / increment_ai_employee_appointments —
-- keeps concurrent create_lead calls for the same AI Employee from racing on
-- a plain `total_leads = total_leads + 1` read-modify-write.
create or replace function public.increment_ai_employee_leads(p_ai_employee_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_employees
  set total_leads = total_leads + 1
  where id = p_ai_employee_id;
$$;
