-- Apex CRM 2.0 — Unified Conversations support
--
-- ai_employee_actions.related_to_type/related_to_id already lets an action
-- point at the specific record it affected (a call, a lead, etc.), but the
-- new Contact Detail "Conversations" tab needs "every AI action involving
-- this contact" as a single direct query — polymorphic-through-a-call isn't
-- queryable that way without joining through the calls table each time.
-- A direct contact_id column makes that a plain equality filter.

alter table public.ai_employee_actions
  add column contact_id uuid references public.contacts (id) on delete set null;

create index idx_ai_employee_actions_contact_id on public.ai_employee_actions (contact_id);

-- Backfill already-ingested call_answered actions (logged by
-- retell-call-webhook against related_to_type='call') by resolving the
-- contact through the call they're attached to.
update public.ai_employee_actions aea
set contact_id = c.contact_id
from public.calls c
where aea.related_to_type = 'call'
  and aea.related_to_id = c.id
  and aea.contact_id is null
  and c.contact_id is not null;
