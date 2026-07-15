-- Apex CRM 2.0 — adds 'appointment_completed' as a workflow trigger type.
--
-- Needed for the "Post-Service Follow-Up" workflow template, which fires
-- after a completed appointment — the existing appointment trigger types
-- only covered 'appointment_booked' (insert) and 'appointment_cancelled'
-- (status -> cancelled), never status -> completed.
--
-- Its own migration, separate from the function update that will actually
-- use it (0016): Postgres can't use a newly-added enum value inside the
-- same transaction that added it, so ALTER TYPE ... ADD VALUE always gets
-- its own migration file here (same reasoning as 0007/0015-style splits
-- earlier in this project).

alter type public.workflow_trigger_type add value if not exists 'appointment_completed';
