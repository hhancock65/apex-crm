import { Lock } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useSubscription } from "@/hooks/useSubscription"
import { cheapestPlanFor, type PlanFeatures } from "@/lib/plans"

interface FeatureGateProps {
  feature: keyof PlanFeatures
  children: ReactNode
  /** Custom fallback for inline/compact spots (e.g. gating just a button)
   *  instead of the default full-size upgrade card. */
  fallback?: ReactNode
}

/** Wraps a feature and shows an upgrade prompt instead of `children` when
 *  the org's current plan doesn't include it. Reads access from
 *  useSubscription() (organizations.plan_features), so it updates live via
 *  useSubscriptionRealtime() the moment a checkout/portal change lands. */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { hasFeature, isLoading } = useSubscription()

  if (isLoading) return null
  if (hasFeature(feature)) return <>{children}</>
  if (fallback !== undefined) return <>{fallback}</>
  return <UpgradePrompt feature={feature} />
}

export function UpgradePrompt({ feature }: { feature: keyof PlanFeatures }) {
  const plan = cheapestPlanFor(feature)

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-apex-teal/10 text-apex-teal">
        <Lock className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">
          {plan ? `Available on ${plan.name} and up` : "Not available on your current plan"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {plan
            ? `Upgrade to ${plan.name} ($${plan.priceMonthly}/mo) to unlock this.`
            : "Upgrade your plan to unlock this."}
        </p>
      </div>
      <Button asChild>
        <Link to="/pricing">View Plans</Link>
      </Button>
    </div>
  )
}

/** Compact inline fallback for gating a single button rather than a whole
 *  page/section — links straight to the plan that unlocks `feature`. */
export function UpgradeInlineButton({ feature, label }: { feature: keyof PlanFeatures; label: string }) {
  const plan = cheapestPlanFor(feature)

  return (
    <Button asChild variant="outline">
      <Link to="/pricing" title={plan ? `Requires ${plan.name} or higher` : undefined}>
        <Lock className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  )
}
