import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"

/**
 * Client scoped to the caller's own Clerk-issued token, forwarded as-is from
 * the incoming request's Authorization header. Every query made with this
 * client is subject to the same RLS policies as the app itself — this is
 * the real authorization boundary for create-retell-agent/update-retell-agent,
 * not the platform's verify_jwt gate (disabled for these functions in
 * supabase/config.toml since it doesn't recognize third-party tokens).
 */
export function createUserScopedClient(authHeader: string): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY")
  }

  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
}

/**
 * Bypasses RLS entirely — only for retell-inbound-webhook, which is called
 * directly by Retell with no Apex user session to scope a query to.
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })
}
