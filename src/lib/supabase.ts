import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file."
  )
}

/**
 * Anonymous/unauthenticated Supabase client — use for public reads only.
 * For any request that should carry the signed-in user's identity, use
 * useSupabaseClient() from clerk-supabase.ts instead, so RLS policies
 * that key off auth.jwt() actually see the Clerk user.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
