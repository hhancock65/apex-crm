-- Apex CRM 2.0 — 80%/100% usage threshold notifications
--
-- create or replace of record_usage() (migration 0019) — byte-for-byte
-- identical except for the new per-type 80%/100% crossing block at the end.
-- The existing 200%-way-over notification (type 'usage_overage') is
-- unchanged; this adds two earlier, per-usage-type warnings:
--   'usage_warning'  — crossed 80% of the included allowance
--   'usage_exceeded' — crossed 100% (i.e. overage billing has started)
-- Each fires once per crossing (before/after comparison, same idiom as the
-- existing way-over check), and only for a usage type with a real
-- allowance (included > 0) — a zero-allowance plan already gets the
-- unambiguous 'usage_overage' signal the instant any usage happens, so 80%/
-- 100% of zero would be meaningless noise. If a single increment jumps
-- straight past both 80% and 100% (a large batch of calls landing at once),
-- only the more urgent 'usage_exceeded' fires, not both.

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
  v_before public.usage_records;
  v_was_way_over boolean;
  v_is_way_over boolean;
  r record;
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

  v_before := v_row;

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

  for r in
    select *
    from (
      values
        ('AI minutes', v_before.ai_minutes_used, v_row.ai_minutes_used, v_row.ai_minutes_included::numeric),
        ('SMS', v_before.sms_sent::numeric, v_row.sms_sent::numeric, v_row.sms_included::numeric),
        ('calls', v_before.calls_made::numeric, v_row.calls_made::numeric, v_row.calls_included::numeric)
    ) as t(label, used_before, used_after, included)
  loop
    if r.included <= 0 then
      continue;
    end if;

    if r.used_after >= r.included and r.used_before < r.included then
      insert into public.notifications (org_id, user_id, type, title, message, related_to_type, related_to_id)
      select
        v_row.org_id,
        p.id,
        'usage_exceeded',
        format('You''ve exceeded your included %s', r.label),
        format('You''ve exceeded your included %s. Overage charges apply.', r.label),
        'usage_record',
        v_row.id
      from public.profiles p
      where p.org_id = v_row.org_id and p.role in ('owner', 'admin');
    elsif r.used_after >= (r.included * 0.8) and r.used_before < (r.included * 0.8) then
      insert into public.notifications (org_id, user_id, type, title, message, related_to_type, related_to_id)
      select
        v_row.org_id,
        p.id,
        'usage_warning',
        format('You''re at 80%% of your %s allowance', r.label),
        format('You''ve used 80%% of your %s this billing period.', r.label),
        'usage_record',
        v_row.id
      from public.profiles p
      where p.org_id = v_row.org_id and p.role in ('owner', 'admin');
    end if;
  end loop;

  return v_row;
end;
$$;
