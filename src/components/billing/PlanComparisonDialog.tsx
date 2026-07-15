import { Check, Minus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCreateCheckoutSession, useCreatePortalSession, useSubscription } from "@/hooks/useSubscription"
import { PLAN_ORDER, PLANS, type PlanFeatures, type PlanId } from "@/lib/plans"
import { cn, formatCurrency } from "@/lib/utils"

const FEATURE_ROWS: { key: keyof PlanFeatures; label: string }[] = [
  { key: "crm_core", label: "CRM Core (contacts, leads, deals, pipeline)" },
  { key: "ai_employee_center", label: "AI Employee Center" },
  { key: "conversations", label: "AI-powered conversations" },
  { key: "ai_builder", label: "AI Employee Builder" },
  { key: "automation", label: "Workflow automation" },
  { key: "campaigns", label: "Outbound campaigns" },
  { key: "multi_location", label: "Multi-location support" },
  { key: "advanced_integrations", label: "Advanced integrations" },
  { key: "priority_support", label: "Priority support" },
]

interface PlanComparisonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * For an org with NO subscription yet, selecting a plan goes through
 * Checkout (a brand-new subscription). For an ALREADY-subscribed org,
 * every plan change — upgrade or downgrade — goes through the Customer
 * Portal instead: Checkout in `mode: 'subscription'` always creates a
 * SECOND subscription, it can't modify the existing one (same invariant
 * PricingPlans already established). Downgrading gets an extra
 * confirmation step first, listing exactly which features would be lost,
 * since that's the one direction that's a surprising, hard-to-notice loss.
 */
export function PlanComparisonDialog({ open, onOpenChange }: PlanComparisonDialogProps) {
  const { planId: currentPlanId, subscription, status } = useSubscription()
  const createCheckout = useCreateCheckoutSession()
  const createPortal = useCreatePortalSession()
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null)
  const [downgradeTarget, setDowngradeTarget] = useState<PlanId | null>(null)

  const isSubscribed = Boolean(subscription) && status !== "cancelled"
  const currentIndex = currentPlanId ? PLAN_ORDER.indexOf(currentPlanId) : -1

  async function goToPortal(planId: PlanId) {
    setLoadingPlan(planId)
    try {
      const { url } = await createPortal.mutateAsync()
      window.location.href = url
    } catch (error) {
      toast.error("Failed to open billing portal", { description: error instanceof Error ? error.message : undefined })
      setLoadingPlan(null)
    }
  }

  async function goToCheckout(planId: PlanId) {
    setLoadingPlan(planId)
    try {
      const { url } = await createCheckout.mutateAsync(planId)
      window.location.href = url
    } catch (error) {
      toast.error("Failed to start checkout", { description: error instanceof Error ? error.message : undefined })
      setLoadingPlan(null)
    }
  }

  function handleSelect(planId: PlanId) {
    if (planId === currentPlanId) return
    if (!isSubscribed) {
      goToCheckout(planId)
      return
    }
    if (PLAN_ORDER.indexOf(planId) < currentIndex) {
      setDowngradeTarget(planId)
      return
    }
    goToPortal(planId)
  }

  const downgradePlan = downgradeTarget ? PLANS[downgradeTarget] : null
  const lostFeatures =
    downgradePlan && currentPlanId
      ? FEATURE_ROWS.filter((row) => PLANS[currentPlanId].features[row.key] && !downgradePlan.features[row.key])
      : []

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Compare Plans</DialogTitle>
          </DialogHeader>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-52 p-2 text-left" />
                  {PLAN_ORDER.map((id) => {
                    const plan = PLANS[id]
                    const isCurrent = isSubscribed && id === currentPlanId
                    return (
                      <th
                        key={id}
                        className={cn("p-2 text-left align-bottom", isCurrent && "rounded-t-md bg-apex-teal/5")}
                      >
                        {isCurrent && (
                          <Badge variant="outline" className="mb-1 border-apex-teal/20 bg-apex-teal/10 text-apex-teal">
                            Current
                          </Badge>
                        )}
                        <p className="font-semibold text-slate-800">{plan.name}</p>
                        <p className="text-xs font-normal text-slate-500">{formatCurrency(plan.priceMonthly)}/mo</p>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100">
                    <td className="p-2 text-slate-600">{row.label}</td>
                    {PLAN_ORDER.map((id) => (
                      <td key={id} className="p-2">
                        {PLANS[id].features[row.key] ? (
                          <Check className="h-4 w-4 text-apex-teal" />
                        ) : (
                          <Minus className="h-4 w-4 text-slate-300" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-slate-200 bg-slate-50/60">
                  <td className="p-2 font-medium text-slate-700">AI minutes / month</td>
                  {PLAN_ORDER.map((id) => (
                    <td key={id} className="p-2 text-slate-700">
                      {PLANS[id].usageAllowance.aiMinutes.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50/60">
                  <td className="p-2 font-medium text-slate-700">SMS / month</td>
                  {PLAN_ORDER.map((id) => (
                    <td key={id} className="p-2 text-slate-700">
                      {PLANS[id].usageAllowance.sms.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50/60">
                  <td className="p-2 font-medium text-slate-700">Calls / month</td>
                  {PLAN_ORDER.map((id) => (
                    <td key={id} className="p-2 text-slate-700">
                      {PLANS[id].usageAllowance.calls.toLocaleString()}
                    </td>
                  ))}
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td className="p-2" />
                  {PLAN_ORDER.map((id) => {
                    const isCurrent = isSubscribed && id === currentPlanId
                    const isLoading = loadingPlan === id
                    const isDowngrade = isSubscribed && currentIndex >= 0 && PLAN_ORDER.indexOf(id) < currentIndex
                    return (
                      <td key={id} className="p-2">
                        <Button
                          size="sm"
                          variant={isCurrent ? "outline" : "default"}
                          disabled={isCurrent || isLoading}
                          onClick={() => handleSelect(id)}
                        >
                          {isCurrent
                            ? "Current Plan"
                            : isLoading
                              ? "Redirecting…"
                              : !isSubscribed
                                ? "Get Started"
                                : isDowngrade
                                  ? "Downgrade"
                                  : "Upgrade"}
                        </Button>
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(downgradeTarget)} onOpenChange={(next) => !next && setDowngradeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Downgrade to {downgradePlan?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {lostFeatures.length > 0
                ? `You'll lose access to: ${lostFeatures.map((f) => f.label).join(", ")}. This is handled in the Stripe billing portal — you'll be redirected there next.`
                : "This is handled in the Stripe billing portal — you'll be redirected there next."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current plan</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = downgradeTarget
                setDowngradeTarget(null)
                if (target) goToPortal(target)
              }}
            >
              Continue to downgrade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
