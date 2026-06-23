-- ═══════════════════════════════════════════════════════════
-- APEX CRM — Migration v2
-- Run this in Supabase SQL Editor if you already ran schema.sql
-- ═══════════════════════════════════════════════════════════

-- Add contact linking and close date to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS contact_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS close_date   TEXT DEFAULT '';

-- Done ✓
