-- ═══════════════════════════════════════════════════════════
-- APEX CRM — Migration v3: SaaS Multi-tenancy
-- Run in Supabase SQL Editor AFTER migration_v2.sql
-- ═══════════════════════════════════════════════════════════

-- ── 1. ORGANIZATIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,           -- used in URLs
  plan          TEXT NOT NULL DEFAULT 'trial'   -- trial | starter | pro
                CHECK (plan IN ('trial','starter','pro','cancelled')),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  stripe_customer_id    TEXT DEFAULT '',
  stripe_subscription_id TEXT DEFAULT '',
  seats_limit   INT DEFAULT 2,                  -- 2 for starter, unlimited (-1) for pro
  contacts_limit INT DEFAULT 500,               -- 500 for starter, -1 for pro
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. ADD org_id TO PROFILES ────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ── 3. ADD org_id TO ALL DATA TABLES ─────────────────────
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.deals    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tasks    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.notes    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ── 4. INDEXES ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contacts_org ON public.contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_deals_org    ON public.deals(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org    ON public.tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_notes_org    ON public.notes(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(org_id);

-- ── 5. RLS ON ORGANIZATIONS ───────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Members can read their own org
CREATE POLICY "orgs: members read" ON public.organizations
  FOR SELECT USING (
    id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

-- Admins can update their own org
CREATE POLICY "orgs: admin update" ON public.organizations
  FOR UPDATE USING (
    id IN (
      SELECT org_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- ── 6. UPDATE RLS ON DATA TABLES (org-scoped) ────────────
-- Drop old user-scoped policies
DROP POLICY IF EXISTS "contacts: own all" ON public.contacts;
DROP POLICY IF EXISTS "deals: own all"    ON public.deals;
DROP POLICY IF EXISTS "tasks: own all"    ON public.tasks;
DROP POLICY IF EXISTS "notes: own all"    ON public.notes;

-- New org-scoped policies
CREATE POLICY "contacts: org members" ON public.contacts
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "deals: org members" ON public.deals
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tasks: org members" ON public.tasks
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "notes: org members" ON public.notes
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- ── 7. SIGNUP FUNCTION ───────────────────────────────────
-- Called when someone signs up — creates org + profile atomically
CREATE OR REPLACE FUNCTION public.create_org_and_profile(
  p_user_id    UUID,
  p_username   TEXT,
  p_name       TEXT,
  p_org_name   TEXT,
  p_org_slug   TEXT
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Create the organization
  INSERT INTO public.organizations (name, slug)
  VALUES (p_org_name, p_org_slug)
  RETURNING id INTO v_org_id;

  -- Create or update the profile
  INSERT INTO public.profiles (id, username, name, role, org_id)
  VALUES (p_user_id, p_username, p_name, 'Admin', v_org_id)
  ON CONFLICT (id) DO UPDATE
    SET username = p_username,
        name     = p_name,
        role     = 'Admin',
        org_id   = v_org_id;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_org_and_profile(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ── 8. TRIAL STATUS HELPER ───────────────────────────────
CREATE OR REPLACE FUNCTION public.get_trial_days_left(p_org_id UUID)
RETURNS INT AS $$
  SELECT GREATEST(0, EXTRACT(DAY FROM (trial_ends_at - NOW()))::INT)
  FROM public.organizations WHERE id = p_org_id;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_trial_days_left(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- DONE ✓ — Multi-tenancy foundation is ready
-- ═══════════════════════════════════════════════════════════
