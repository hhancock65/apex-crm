export const SUBSCRIPTION_STATUSES = ["active", "past_due", "cancelled", "trialing"] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export interface Subscription {
  id: string
  org_id: string
  stripe_customer_id: string
  stripe_subscription_id: string | null
  plan_id: string
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at: string | null
  created_at: string
  updated_at: string
}
