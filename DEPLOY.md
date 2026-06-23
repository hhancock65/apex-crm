# Apex CRM — Go Live Guide
## Supabase + Vercel Deployment

---

## Overview

```
Your users
    ↓
Vercel (hosts the React app — free)
    ↓
Supabase (database + auth + API — free tier)
    ↓
PostgreSQL (your data lives here securely)
```

Total cost to go live: **$0/month** on free tiers.

---

## PART 1 — Supabase Setup (your backend)

### Step 1 — Create a Supabase account
Go to https://supabase.com and click "Start your project". Sign up with GitHub or email.

### Step 2 — Create a new project
- Click "New project"
- Name it: `apex-crm`
- Set a strong database password (save it somewhere safe)
- Choose the region closest to your users (e.g. US East)
- Click "Create new project" — takes about 1 minute

### Step 3 — Run the database schema
1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase/schema.sql` from this project
4. Copy the entire contents and paste it into the SQL editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see: "Success. No rows returned"

This creates all 5 tables (profiles, contacts, deals, tasks, notes) with proper security rules.

### Step 4 — Get your API keys
1. In Supabase, go to **Project Settings** → **API**
2. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### Step 5 — Create your first user
1. In Supabase, go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter the email and password for your client
4. Click **Create user**

To set their name and role, go to **Table Editor** → **profiles** and edit the row that was auto-created.

---

## PART 2 — Local Setup (test before going live)

### Step 6 — Set up your environment file
In the project root, create a file called `.env` (copy from `.env.example`):

```
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the values with what you copied in Step 4.

### Step 7 — Install and run
```bash
npm install
npm start
```

Open http://localhost:3000 and log in with the user you created in Step 5.

---

## PART 3 — Deploy to Vercel (go live)

### Step 8 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit — Apex CRM"
```

Create a new repository on https://github.com (click "New repository"), then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/apex-crm.git
git push -u origin main
```

### Step 9 — Deploy on Vercel
1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New Project**
3. Select your `apex-crm` repository
4. Click **Import**

### Step 10 — Add environment variables in Vercel
Before clicking Deploy, scroll down to **Environment Variables** and add:

| Name | Value |
|---|---|
| `REACT_APP_SUPABASE_URL` | your Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | your Supabase anon key |

Click **Deploy**. In about 60 seconds, your CRM is live at a URL like `https://apex-crm.vercel.app`.

### Step 11 — Custom domain (optional)
In Vercel → your project → **Settings** → **Domains**, add your client's domain (e.g. `crm.clientcompany.com`). Vercel gives you the DNS records to add.

---

## Adding more users

Every new team member needs a Supabase user account:

1. Supabase Dashboard → **Authentication** → **Users** → **Add user**
2. Enter their email and a temporary password
3. Tell them to log in — they can't self-register (by design)
4. Optionally update their name/role in **Table Editor** → **profiles**

---

## Security — what's already protected

| Threat | Protection |
|---|---|
| User sees another user's data | Row Level Security (RLS) — enforced at database level |
| Someone brute-forces login | Supabase rate-limits auth attempts automatically |
| API keys exposed | Anon key is safe to expose — it can only do what RLS allows |
| .env committed to Git | .gitignore blocks it; Vercel env vars are encrypted |
| Session hijacking | Supabase uses short-lived JWTs with auto-refresh |

---

## Troubleshooting

**"Missing Supabase env vars" in console**
→ Your `.env` file is missing or has wrong variable names. Check spelling exactly.

**Login says "Invalid email or password"**
→ Make sure you created the user in Supabase Auth (not just the profiles table).

**Data not showing after login**
→ Check that you ran `schema.sql` fully. Open Supabase Table Editor and confirm the tables exist.

**Vercel build fails**
→ Check that both env vars are set in Vercel project settings (not just your local .env).

**White screen on Vercel**
→ The `vercel.json` file handles routing — make sure it's in your repo root.

---

## Free tier limits (Supabase)

| Resource | Free limit |
|---|---|
| Database size | 500 MB |
| Auth users | 50,000 |
| API requests | 500,000 / month |
| File storage | 1 GB |

More than enough for a small client CRM. Paid plans start at $25/month when you need more.
