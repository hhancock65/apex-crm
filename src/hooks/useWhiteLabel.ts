import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { WhiteLabel } from "@/types/partner"

const CSS_VAR_PRIMARY = "--apex-teal"

/** The current org's partner branding, if it's partner-managed —
 *  get_org_white_label() returns an empty result set (not null fields) for
 *  a non-partner-managed org, so `data` is `undefined` there. */
export function useWhiteLabel() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["white-label"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_org_white_label").maybeSingle()
      if (error) throw error
      return (data ?? null) as WhiteLabel | null
    },
    staleTime: 5 * 60_000,
  })
}

/**
 * Applies the partner's primary color as a CSS custom property that
 * tailwind.config.ts's `apex-teal`/`apex-navy` colors read at render time
 * (`var(--apex-teal, #2E86AB)`) — every existing bg-apex-teal/text-apex-teal
 * class in the app picks this up automatically, no component changes
 * needed. Cleans up on unmount/org switch so a partner-managed client
 * doesn't leak its branding into a later-viewed non-partner org in the same
 * session.
 */
export function useApplyWhiteLabelStyles() {
  const { data: whiteLabel } = useWhiteLabel()

  useEffect(() => {
    const root = document.documentElement
    if (whiteLabel?.primary_color) {
      root.style.setProperty(CSS_VAR_PRIMARY, whiteLabel.primary_color)
    } else {
      root.style.removeProperty(CSS_VAR_PRIMARY)
    }
    return () => {
      root.style.removeProperty(CSS_VAR_PRIMARY)
    }
  }, [whiteLabel?.primary_color])
}
