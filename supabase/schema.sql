-- ═══════════════════════════════════════════════════════════
-- APEX CRM — Supabase Database Schema (with username login)
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════


-- ── 1. PROFILES ─────────────────────────────────────────────
-- Extends auth.users with username, real email, name, and role
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE NOT NULL,         -- what the user types to log in
  real_email   TEXT DEFAULT '',              -- their actual email for notifications
  name         TEXT NOT NULL DEFAULT '',     -- display name shown in the sidebar
  role         TEXT NOT NULL DEFAULT 'User', -- Admin, Manager, Sales Rep, User
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce lowercase, no spaces on username
ALTER TABLE public.profiles
  ADD CONSTRAINT username_format
  CHECK (username ~ '^[a-z0-9._-]{3,30}$');

-- Auto-create a profile row when a new Supabase auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, real_email, name, role)
  VALUES (
    NEW.id,
    -- username comes from metadata (set when creating user), fallback to email prefix
    LOWER(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))),
    COALESCE(NEW.raw_user_meta_data->>'real_email', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Public lookup function: resolves username → internal fake email
-- Used by the login flow to convert username to Supabase auth email
CREATE OR REPLACE FUNCTION public.get_email_for_username(p_username TEXT)
RETURNS TEXT AS $$
  SELECT email FROM auth.users
  WHERE email = LOWER(p_username) || '@apexcrm.internal'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Allow the anon role to call this function (needed for login)
GRANT EXECUTE ON FUNCTION public.get_email_for_username(TEXT) TO anon;


-- ── 2. CONTACTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  company    TEXT DEFAULT '',
  email      TEXT DEFAULT '',
  phone      TEXT DEFAULT '',
  status     TEXT DEFAULT 'Lead' CHECK (status IN ('Lead','Qualified','Proposal','Won','Lost')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ── 3. DEALS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  company    TEXT DEFAULT '',
  value      NUMERIC DEFAULT 0,
  stage      TEXT DEFAULT 'Lead' CHECK (stage IN ('Lead','Qualified','Proposal','Won','Lost')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ── 4. TASKS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  due        TEXT DEFAULT '',
  done       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ── 5. NOTES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  date       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes    ENABLE ROW LEVEL SECURITY;

-- Profiles: own read/update only
CREATE POLICY "profiles: own read"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: own update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Contacts
CREATE POLICY "contacts: own all" ON public.contacts
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Deals
CREATE POLICY "deals: own all" ON public.deals
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tasks
CREATE POLICY "tasks: own all" ON public.tasks
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Notes
CREATE POLICY "notes: own all" ON public.notes
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_contacts_user  ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_user     ON public.deals(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user     ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user     ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);


-- ══════════════════════════════════════════════════════════════
-- HOW TO CREATE USERS (admin does this, not users themselves)
-- ══════════════════════════════════════════════════════════════
--
-- In Supabase Dashboard → Authentication → Users → Add user:
--   Email:    sarah@apexcrm.internal   ← always this format
--   Password: their chosen password
--
-- Then in Table Editor → profiles, update their row:
--   username:   sarah                  ← what they type to log in
--   real_email: sarah@realcompany.com  ← their actual email
--   name:       Sarah Mitchell
--   role:       Sales Rep
--
-- USERNAME RULES: lowercase, 3–30 chars, letters/numbers/dots/dashes/underscores
-- ══════════════════════════════════════════════════════════════
