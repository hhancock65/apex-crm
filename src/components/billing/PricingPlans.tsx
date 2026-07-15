import { Check } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCreateCheckoutSession, useCreatePortalSession, useSubscription } from "@/hooks/useSubscription"
import { cn, formatCurrency } from "@/lib/utils"
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/plans"

/**
 * 4 plan cards. Highlights the org's current plan, and — importantly —
 * does NOT re-run Stripe Checkout for an org that already has a
 * subscription: Checkout in `mode: 'subscription'` always creates a new
 * subscription, so clicking another plan while already subscribed would
 * leave the org with two conflicting subscriptions instead of switching.
 * Once subscribed, changing plans routes through the Stripe-hosted
 * Customer Portal instead (its native "change plan" flow modifies the
 * existing subscription).
 */
export function PricingPlans() {
  const { planId: currentPlanId, status, subscription } = useSubscription()
  const createCheckout = useCreateCheckoutSession()
  const createPortal = useCreatePortalSession()
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null)

  const isSubscribed = Boolean(subscription) && status !== "cancelled"

  async function handleChoose(planId: PlanId) {
    setLoadingPlan(planId)
    try {
      const { url } = isSubscribed
        ? await createPortal.mutateAsync()
        : await createCheckout.mutateAsync(planId)
      window.location.href = url
    } catch (error) {
      toast.error("Failed to start checkout", {
        description: error instanceof Error ? error.message : undefined,
      })
      setLoadingPlan(null)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PLAN_ORDER.map((id) => {
        const plan = PLANS[id]
        const isCurrent = isSubscribed && currentPlanId === id
        const isLoading = loadingPlan === id

        return (
          <div
            key={id}
            className={cn(
              "flex flex-col rounded-lg border bg-white p-5",
              isCurrent ? "border-apex-teal ring-1 ring-apex-teal" : "border-slate-200"
            )}
          >
            {isCurrent && (
              <Badge className="mb-2 w-fit border-apex-teal/20 bg-apex-teal/10 text-apex-teal" variant="outline">
                Current Plan
              </Badge>
            )}
            <p className="text-sm font-semibold text-slate-800">{plan.name}</p>
            <p className="mt-1 text-xs text-slate-500">{plan.tagline}</p>
            <p className="mt-4">
              <span className="text-3xl font-bold text-slate-900">{formatCurrency(plan.priceMonthly)}</span>
              <span className="text-sm text-slate-400">/mo</span>
            </p>

            <ul className="mt-4 flex-1 space-y-2">
              {plan.featureList.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-apex-teal" />
                  {feature}
                </li>
              ))}
            </ul>

            <Button
              className="mt-5"
              variant={isCurrent ? "outline" : "default"}
              disabled={isCurrent || isLoading}
              onClick={() => handleChoose(id)}
            >
              {isCurrent
                ? "Current Plan"
                : isLoading
                  ? "Redirecting…"
                  : isSubscribed
                    ? "Manage in Billing Portal"
                    : "Get Started"}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
