// Thin wrappers around the check_usage_limits()/record_usage() Postgres
// functions (migration 0019) — shared by every Edge Function that places an
// outbound AI action: _shared/messaging.ts (send_sms), workflow-executor
// (send_sms + ai_call steps), and process-campaign-batch (campaign calls).
// Call completion itself is tracked automatically by a trigger on `calls`,
// not from here — see the migration's header comment.

import type { createServiceRoleClient } from "./supabase-admin.ts"

type ServiceClient = ReturnType<typeof createServiceRoleClient>

export type UsageType = "ai_minutes" | "sms" | "calls"

export interface UsageLimitCheck {
  allowed: boolean
  is_over_limit: boolean
  is_way_over_limit: boolean
  used: number
  included: number
  overage_amount: number
}

/** Fails open (allowed: true) on any lookup error — a usage-tracking bug
 *  should never be what stops an AI Employee from sending a text or placing
 *  a call. */
export async function checkUsageLimits(
  supabase: ServiceClient,
  orgId: string,
  usageType: UsageType
): Promise<UsageLimitCheck> {
  const { data, error } = await supabase
    .rpc("check_usage_limits", { p_org_id: orgId, p_usage_type: usageType })
    .maybeSingle()

  if (error || !data) {
    console.error(`checkUsageLimits: lookup failed for org ${orgId}/${usageType}`, error)
    return { allowed: true, is_over_limit: false, is_way_over_limit: false, used: 0, included: 0, overage_amount: 0 }
  }
  return data as UsageLimitCheck
}

export async function recordUsage(
  supabase: ServiceClient,
  orgId: string,
  usage: { aiMinutes?: number; sms?: number; calls?: number }
): Promise<void> {
  const { error } = await supabase.rpc("record_usage", {
    p_org_id: orgId,
    p_ai_minutes: usage.aiMinutes ?? 0,
    p_sms: usage.sms ?? 0,
    p_calls: usage.calls ?? 0,
  })
  if (error) console.error(`recordUsage: failed to record usage for org ${orgId}`, error)
}
