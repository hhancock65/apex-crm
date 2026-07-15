-- Apex CRM 2.0 — SMS/email messaging support
-- Backs retell-function-handler's send_sms/send_email tools and
-- retell-call-webhook's post-call auto-follow-ups. No ai_action_type or
-- activity_type changes needed — 'sms_sent'/'email_sent' (ai_employee_actions)
-- and 'sms'/'email' (activities) already exist (migration 0001/0002).

create table public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  content text not null,
  variables text[] not null default '{}'::text[],
  category text,
  created_at timestamptz not null default now()
);

create index idx_sms_templates_org_id on public.sms_templates (org_id);

alter table public.sms_templates enable row level security;

do $$
declare
  t text;
  tenant_tables text[] := array['sms_templates'];
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

-- Same reasoning as seed_default_pipeline (0001): organizations don't exist
-- until a customer signs up, so default templates are seeded the moment a
-- row lands in organizations rather than as static rows here.
create or replace function public.seed_default_sms_templates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sms_templates (org_id, name, content, variables, category)
  values
    (
      new.id,
      'appointment_confirmation',
      'Hi {contact_name}, this is {ai_employee_name} from {business_name}. Your appointment is confirmed for {appointment_date} at {appointment_time}. Reply STOP to opt out.',
      array['contact_name', 'ai_employee_name', 'business_name', 'appointment_date', 'appointment_time'],
      'appointment'
    ),
    (
      new.id,
      'follow_up_24h',
      'Hi {contact_name}, this is {ai_employee_name} from {business_name} following up on our conversation yesterday. Let us know if you have any questions!',
      array['contact_name', 'ai_employee_name', 'business_name'],
      'follow_up'
    ),
    (
      new.id,
      'thank_you',
      'Hi {contact_name}, thank you for calling {business_name} today! We''re excited to help you. Reach out anytime with questions. — {ai_employee_name}',
      array['contact_name', 'ai_employee_name', 'business_name'],
      'general'
    ),
    (
      new.id,
      'missed_call_recovery',
      'Hi, we''re sorry we missed your call to {business_name}! Call us back or reply to this text and {ai_employee_name} will help you right away.',
      array['ai_employee_name', 'business_name'],
      'missed_call'
    );

  return new;
end;
$$;

create trigger trg_seed_default_sms_templates
  after insert on public.organizations
  for each row execute function public.seed_default_sms_templates();

-- Backfill: seed the same 4 templates for every org that already existed
-- before this migration (the trigger above only fires for future inserts).
insert into public.sms_templates (org_id, name, content, variables, category)
select
  o.id,
  v.name,
  v.content,
  v.variables,
  v.category
from public.organizations o
cross join (
  values
    (
      'appointment_confirmation',
      'Hi {contact_name}, this is {ai_employee_name} from {business_name}. Your appointment is confirmed for {appointment_date} at {appointment_time}. Reply STOP to opt out.',
      array['contact_name', 'ai_employee_name', 'business_name', 'appointment_date', 'appointment_time'],
      'appointment'
    ),
    (
      'follow_up_24h',
      'Hi {contact_name}, this is {ai_employee_name} from {business_name} following up on our conversation yesterday. Let us know if you have any questions!',
      array['contact_name', 'ai_employee_name', 'business_name'],
      'follow_up'
    ),
    (
      'thank_you',
      'Hi {contact_name}, thank you for calling {business_name} today! We''re excited to help you. Reach out anytime with questions. — {ai_employee_name}',
      array['contact_name', 'ai_employee_name', 'business_name'],
      'general'
    ),
    (
      'missed_call_recovery',
      'Hi, we''re sorry we missed your call to {business_name}! Call us back or reply to this text and {ai_employee_name} will help you right away.',
      array['ai_employee_name', 'business_name'],
      'missed_call'
    )
) as v(name, content, variables, category)
where not exists (
  select 1 from public.sms_templates st where st.org_id = o.id and st.name = v.name
);
