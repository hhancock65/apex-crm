import type { CampaignType } from "@/types/campaign"

// Mirrors supabase/functions/_shared/campaign-scripts.ts — edge functions
// and the Vite app don't share code, so this is duplicated by necessity,
// not oversight. Keep both in sync if these presets change.
export const CAMPAIGN_SCRIPT_PRESETS: Record<CampaignType, string> = {
  reactivation:
    "This contact hasn't engaged in a while. Warmly re-introduce yourself, mention it's been some time " +
    "since you last connected, and ask if their needs have changed. Your goal is to re-open the " +
    "conversation and, if they're still interested, book a follow-up appointment.",
  nurture:
    "This is a warm lead who has shown interest before. Check in on where they are in their decision, " +
    "answer any outstanding questions, and gently move them toward booking an appointment or taking the " +
    "next step.",
  outbound:
    "This is a new prospect who hasn't spoken with us before. Introduce yourself and the business " +
    "briefly, explain how you can help, and qualify their interest. If they're a good fit, book an " +
    "appointment.",
  follow_up:
    "This contact recently received a service. Check in on how it went, ask if they have any questions " +
    "or concerns, and let them know you're available if they need anything else.",
}
