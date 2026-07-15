import { PricingPlans } from "@/components/billing/PricingPlans"
import { useSubscriptionRealtime } from "@/hooks/useSubscription"

export default function PricingPage() {
  useSubscriptionRealtime()

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Plans & Pricing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose the plan that fits how much of Apex your team needs — upgrade anytime as you grow.
        </p>
      </div>

      <div className="mt-8">
        <PricingPlans />
      </div>
    </div>
  )
}
