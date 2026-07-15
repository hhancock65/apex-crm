-- Apex CRM 2.0 — usage-based metering for AI Employee usage
--
-- One usage_records row per org per billing period (unique on
-- (org_id, period_start), mirroring subscriptions' one-row-per-org
-- shape) — ai_minutes_included/sms_included/calls_included are a snapshot
-- of the allowance at the time the period started, not something
-- recomputed on the fly, so a mid-period plan change or pricing update
-- never silently rewrites what an already-in-progress period promised.
--
-- Three functions carry all the logic:
--   ensure_usage_period()  — called by stripe-webhook whenever a
--                             subscription's current period becomes known
--                             (checkout, renewal, plan change). Creates the
--                             period's row with the right included
--                             allowance, or — if the row already exists
--                             (e.g. a mid-period plan change) — updates its
--                             included allowance in place without touching
--                             accumulated usage.
--   record_usage()         — the only writer of ai_minutes_used/sms_sent/
--                             calls_made. Called by the calls-table trigger
--                             below (every call) and directly via RPC from
--                             _shared/messaging.ts and workflow-executor
--                             (every SMS). Recomputes overage_amount in the
--                             same statement, and notifies every org
--                             owner/admin the moment any usage type first
--                             crosses 2x its included allowance (not on
--                             every call after that — only the crossing).
--   check_usage_limits()   — read-only pre-check called before an outbound
--                             AI action (send_sms, ai_call step, campaign
--                             call) so the app can flag/skip before
--                             spending money on something that won't be
--                             covered by the plan. `allowed` is true unless
--                             usage is >2x the included allowance AND the
--                             org has opted into organizations.settings
--                             ->> 'auto_pause_on_overage' = 'true' — off by
--                             default, and there's no Settings UI to flip
--                             it yet (wired here, not exposed in the
--                             product yet, same as workflow_trigger_type's
--                             UNWIRED_TRIGGER_TYPES pattern). Deliberately
--                             NOT wired into inbound call answering
--                             (retell-inbound-webhook) — blocking a
--                             customer's incoming call because of an
--                             internal usage counter is a much higher-risk
--                             action than skipping an outbound SMS/call,
--                             and Retell's own telephony layer has no
--                             established rejection path in this codebase.
--
-- invoiced_at is the one column beyond the spec's literal list — Stripe can
-- redeliver invoice.upcoming for the same invoice more than once, and
-- without recording "already created overage invoice items for this
-- period," calculate-overage would double-charge the customer on a
-- redelivery. Everything else matches the requested schema exactly.

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  ai_minutes_used numeric not null default 0,
  sms_sent integer not null default 0,
  calls_made integer not null default 0,
  ai_minutes_included integer not null default 0,
  sms_included integer not null default 0,
  calls_included integer not null default 0,
  overage_amount numeric not null default 0,
  invoiced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usage_records_org_period_key unique (org_id, period_start)
);

create index idx_usage_records_org_id on public.usage_records (org_id, period_start desc);

create trigger set_updated_at before update on public.usage_records
  for each row execute function public.set_updated_at();

alter table public.usage_records enable row level security;

-- SELECT only — same reasoning as subscriptions (0018): the only writers
-- are stripe-webhook, the calls-table trigger below, and the two
-- SMS-sending code paths, all via the service role or SECURITY DEFINER
-- functions. No user-facing path ever inserts/updates a usage_records row
-- directly.
create policy "usage_records_select_org" on public.usage_records
  for select using (org_id = public.get_user_org_id());

alter publication supabase_realtime add table public.usage_records;

create or replace function public.ensure_usage_period(
  p_org_id uuid,
  p_period_start date,
  p_period_end date,
  p_ai_minutes_included integer,
  p_sms_included integer,
  p_calls_included integer
) returns public.usage_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.usage_records;
begin
  insert into public.usage_records (org_id, period_start, period_end, ai_minutes_included, sms_included, calls_included)
  values (p_org_id, p_period_start, p_period_end, p_ai_minutes_included, p_sms_included, p_calls_included)
  on conflict (org_id, period_start) do update set
    period_end = excluded.period_end,
    ai_minutes_included = excluded.ai_minutes_included,
    sms_included = excluded.sms_included,
    calls_included = excluded.calls_included,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.record_usage(
  p_org_id uuid,
  p_ai_minutes numeric default 0,
  p_sms integer default 0,
  p_calls integer default 0
) returns public.usage_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.usage_records;
  v_was_way_over boolean;
  v_is_way_over boolean;
begin
  select * into v_row
  from public.usage_records
  where org_id = p_org_id and current_date between period_start and period_end
  order by period_start desc
  limit 1;

  if not found then
    -- No row for the current period yet — stripe-webhook normally creates
    -- one (via ensure_usage_period) the moment a subscription's period is
    -- known. An org with no subscription yet (or ahead of that webhook
    -- landing) still needs somewhere to record usage, so fall back to a
    -- calendar-month period with zero included allowance — flagged as
    -- overage from unit one rather than silently guessing an allowance.
    insert into public.usage_records (org_id, period_start, period_end, ai_minutes_included, sms_included, calls_included)
    values (
      p_org_id,
      date_trunc('month', current_date)::date,
      (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date,
      0, 0, 0
    )
    on conflict (org_id, period_start) do nothing;

    select * into v_row
    from public.usage_records
    where org_id = p_org_id and current_date between period_start and period_end
    order by period_start desc
    limit 1;
  end if;

  v_was_way_over :=
    v_row.ai_minutes_used > (v_row.ai_minutes_included * 2)
    or v_row.sms_sent > (v_row.sms_included * 2)
    or v_row.calls_made > (v_row.calls_included * 2);

  -- All right-hand-side expressions in one UPDATE see the pre-update row,
  -- so `ai_minutes_used + p_ai_minutes` (not the bare column) is what makes
  -- overage_amount reflect the NEW totals in this same statement rather
  -- than lagging a call behind.
  update public.usage_records
  set
    ai_minutes_used = ai_minutes_used + p_ai_minutes,
    sms_sent = sms_sent + p_sms,
    calls_made = calls_made + p_calls,
    overage_amount =
      greatest(0, (ai_minutes_used + p_ai_minutes) - ai_minutes_included) * 0.15
      + greatest(0, (sms_sent + p_sms) - sms_included) * 0.03
      + greatest(0, (calls_made + p_calls) - calls_included) * 0.25,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  v_is_way_over :=
    v_row.ai_minutes_used > (v_row.ai_minutes_included * 2)
    or v_row.sms_sent > (v_row.sms_included * 2)
    or v_row.calls_made > (v_row.calls_included * 2);

  if v_is_way_over and not v_was_way_over then
    insert into public.notifications (org_id, user_id, type, title, message, related_to_type, related_to_id)
    select
      v_row.org_id,
      p.id,
      'usage_overage',
      'Usage is more than double your plan''s included allowance',
      format(
        'This billing period (%s to %s): %s / %s AI minutes, %s / %s SMS, %s / %s calls. Overage charges apply beyond the included allowance ($0.15/min, $0.03/SMS, $0.25/call).',
        v_row.period_start, v_row.period_end,
        v_row.ai_minutes_used, v_row.ai_minutes_included,
        v_row.sms_sent, v_row.sms_included,
        v_row.calls_made, v_row.calls_included
      ),
      'usage_record',
      v_row.id
    from public.profiles p
    where p.org_id = v_row.org_id and p.role in ('owner', 'admin');
  end if;

  return v_row;
end;
$$;

create or replace function public.check_usage_limits(p_org_id uuid, p_usage_type text)
returns table (
  allowed boolean,
  is_over_limit boolean,
  is_way_over_limit boolean,
  used numeric,
  included numeric,
  overage_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.usage_records;
  v_used numeric;
  v_included numeric;
  v_auto_pause boolean;
begin
  if p_usage_type not in ('ai_minutes', 'sms', 'calls') then
    raise exception 'check_usage_limits: invalid usage_type ''%'' — must be ai_minutes, sms, or calls', p_usage_type;
  end if;

  select * into v_row
  from public.usage_records
  where org_id = p_org_id and current_date between period_start and period_end
  order by period_start desc
  limit 1;

  if not found then
    -- Nothing recorded for this org/period yet — fails open (allowed),
    -- same "don't block on the absence of data" reasoning as record_usage's
    -- fallback path.
    return query select true, false, false, 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;

  case p_usage_type
    when 'ai_minutes' then
      v_used := v_row.ai_minutes_used;
      v_included := v_row.ai_minutes_included;
    when 'sms' then
      v_used := v_row.sms_sent;
      v_included := v_row.sms_included;
    when 'calls' then
      v_used := v_row.calls_made;
      v_included := v_row.calls_included;
  end case;

  select coalesce((settings ->> 'auto_pause_on_overage')::boolean, false) into v_auto_pause
  from public.organizations
  where id = p_org_id;

  return query select
    not (v_used > (v_included * 2) and v_auto_pause),
    v_used > v_included,
    v_used > (v_included * 2),
    v_used,
    v_included,
    v_row.overage_amount;
end;
$$;

-- Fires on every terminal call status transition (any status change away
-- from 'active') for a call an AI Employee handled — covers inbound calls,
-- workflow ai_call steps, and campaign-placed calls alike, since all three
-- ultimately land in the same `calls` table via retell-call-webhook. The
-- `is distinct from old.status` guard means a redelivered call_ended
-- followed by call_analyzed (both already terminal, same status) only
-- fires once — same idempotency idiom handle_workflow_trigger_event
-- already uses (migration 0011).
create or replace function public.handle_call_usage_tracking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status <> 'active' and new.ai_employee_id is not null then
    perform public.record_usage(new.org_id, coalesce(new.duration_seconds, 0) / 60.0, 0, 1);
  end if;
  return new;
end;
$$;

create trigger trg_call_usage_tracking
  after update on public.calls
  for each row execute function public.handle_call_usage_tracking();
