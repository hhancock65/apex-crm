-- Apex CRM 2.0 — AI Workforce system
-- Adds AI employees, their action/call/conversation logs, and call transcripts.
-- Same multi-tenant model as 0001: every table carries org_id and is RLS-scoped
-- via public.get_user_org_id(). Run this after 0001_init_schema.sql.

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.ai_employee_role as enum (
  'front_desk', 'sales', 'appointment', 'follow_up',
  'lead_recovery', 'customer_service', 'custom'
);

create type public.ai_employee_status as enum ('online', 'offline', 'paused');

create type public.ai_action_type as enum (
  'call_answered', 'call_transferred',
  'lead_created', 'lead_qualified', 'lead_reactivated',
  'appointment_booked', 'appointment_rescheduled',
  'sms_sent', 'email_sent', 'follow_up_sent',
  'contact_created', 'contact_updated',
  'opportunity_created'
);

create type public.call_direction as enum ('inbound', 'outbound');
create type public.call_status as enum ('completed', 'missed', 'transferred', 'voicemail', 'failed');
create type public.call_sentiment as enum ('positive', 'neutral', 'negative');
create type public.call_outcome as enum (
  'qualified', 'unqualified', 'appointment_booked', 'transfer', 'voicemail', 'info_request', 'spam'
);

create type public.conversation_channel as enum ('phone', 'sms', 'email');
create type public.conversation_status as enum ('active', 'completed', 'escalated');

-- ============================================================================
-- TABLES
-- ============================================================================

create table public.ai_employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  role public.ai_employee_role not null default 'custom',
  description text,
  voice text,
  language text not null default 'en-US',
  personality text,
  status public.ai_employee_status not null default 'offline',
  retell_agent_id text,
  phone_number text,
  responsibilities text[] not null default '{}'::text[],
  knowledge_config jsonb not null default '{}'::jsonb,
  escalation_rules jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  total_calls integer not null default 0,
  total_leads integer not null default 0,
  total_appointments integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_employee_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  ai_employee_id uuid not null references public.ai_employees (id) on delete cascade,
  action_type public.ai_action_type not null,
  description text,
  -- Plain text, not the `related_entity_type` domain used elsewhere — action
  -- log entries may point at rows (e.g. calls) outside that CRM-record set.
  related_to_type text,
  related_to_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  ai_employee_id uuid references public.ai_employees (id) on delete set null,
  retell_call_id text,
  contact_id uuid references public.contacts (id) on delete set null,
  caller_phone text,
  direction public.call_direction not null default 'inbound',
  status public.call_status not null default 'completed',
  duration_seconds integer,
  summary text,
  sentiment public.call_sentiment,
  outcome public.call_outcome,
  recording_url text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.call_transcripts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  call_id uuid not null references public.calls (id) on delete cascade,
  -- Array of {role, text, timestamp} turns — shape owned by the Retell webhook handler.
  content jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  ai_employee_id uuid references public.ai_employees (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  channel public.conversation_channel not null default 'phone',
  messages jsonb not null default '[]'::jsonb,
  status public.conversation_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- BACKFILL: link 0001's placeholder ai_employee_id columns to this table
-- ============================================================================

-- appointments.ai_employee_id and activities.ai_employee_id were added in
-- 0001 as bare uuid columns because this table didn't exist yet. Now it does.
alter table public.appointments
  add constraint appointments_ai_employee_id_fkey
  foreign key (ai_employee_id) references public.ai_employees (id) on delete set null;

alter table public.activities
  add constraint activities_ai_employee_id_fkey
  foreign key (ai_employee_id) references public.ai_employees (id) on delete set null;

create index idx_appointments_ai_employee_id on public.appointments (ai_employee_id);
create index idx_activities_ai_employee_id on public.activities (ai_employee_id);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index idx_ai_employees_org_id on public.ai_employees (org_id);
create index idx_ai_employees_status on public.ai_employees (status);

create index idx_ai_employee_actions_org_id on public.ai_employee_actions (org_id);
create index idx_ai_employee_actions_ai_employee_id on public.ai_employee_actions (ai_employee_id);
create index idx_ai_employee_actions_related_to on public.ai_employee_actions (related_to_type, related_to_id);
create index idx_ai_employee_actions_created_at on public.ai_employee_actions (created_at);

create index idx_calls_org_id on public.calls (org_id);
create index idx_calls_ai_employee_id on public.calls (ai_employee_id);
create index idx_calls_contact_id on public.calls (contact_id);
create index idx_calls_started_at on public.calls (started_at);
create index idx_calls_status on public.calls (status);

create index idx_call_transcripts_org_id on public.call_transcripts (org_id);
create index idx_call_transcripts_call_id on public.call_transcripts (call_id);

create index idx_ai_conversations_org_id on public.ai_conversations (org_id);
create index idx_ai_conversations_ai_employee_id on public.ai_conversations (ai_employee_id);
create index idx_ai_conversations_contact_id on public.ai_conversations (contact_id);

-- ============================================================================
-- updated_at TRIGGER
-- ============================================================================

-- Reuses public.set_updated_at() from 0001. Only ai_employees has an
-- updated_at column among this migration's tables.
create trigger set_updated_at before update on public.ai_employees
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.ai_employees enable row level security;
alter table public.ai_employee_actions enable row level security;
alter table public.calls enable row level security;
alter table public.call_transcripts enable row level security;
alter table public.ai_conversations enable row level security;

do $$
declare
  t text;
  tenant_tables text[] := array[
    'ai_employees', 'ai_employee_actions', 'calls', 'call_transcripts', 'ai_conversations'
  ];
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
