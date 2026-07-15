import { useSession } from "@clerk/clerk-react"
import { createClient } from "@supabase/supabase-js"
import { useMemo } from "react"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Returns a Supabase client that attaches the signed-in Clerk user's session
 * token to every request via the `accessToken` hook (supabase-js v2.49+).
 * This is Supabase's native third-party auth integration for Clerk — no JWT
 * template needed, just enable Clerk under Authentication > Sign In / Up >
 * Third Party Auth in the Supabase dashboard, and set your RLS policies to
 * check auth.jwt()->>'sub' against the Clerk user id.
 *
 * Call this from inside a component/hook so it's re-created if the Clerk
 * session changes; do not use the plain `supabase` client from supabase.ts
 * for requests that rely on RLS.
 */
export function useSupabaseClient() {
  const { session } = useSession()

  return useMemo(() => {
    return createClient(supabaseUrl, supabaseAnonKey, {
      accessToken: async () => {
        return (await session?.getToken()) ?? null
      },
    })
  }, [session])
}
