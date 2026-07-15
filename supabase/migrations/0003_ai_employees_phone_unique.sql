-- Apex CRM 2.0 — Retell integration support
-- retell-inbound-webhook routes an incoming call to an AI Employee purely by
-- matching the dialed number against ai_employees.phone_number. Without a
-- uniqueness guarantee, two employees sharing a number would make that
-- lookup ambiguous — a real phone number can only ring one place.
--
-- Run after 0002_ai_workforce.sql. If you already have duplicate
-- phone_number values in ai_employees, resolve those before running this —
-- the CREATE UNIQUE INDEX will fail otherwise.

create unique index idx_ai_employees_phone_number_unique
  on public.ai_employees (phone_number)
  where phone_number is not null;
