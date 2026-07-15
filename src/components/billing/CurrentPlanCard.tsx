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
import { PlanComparisonDialog } from "@/components/billing/PlanComparisonDialog"
import { useCreatePortalSession, useSubscription } from "@/hooks/useSubscription"
import { PLANS } from "@/lib/plans"
import { formatDate } from "@/lib/utils"
import type { SubscriptionStatus } from "@/types/subscription"

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Payment failed",
  cancelled: "Cancelled",
}

const STATUS_CLASSES: Record<SubscriptionStatus, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  trialing: "border-blue-200 bg-blue-50 text-blue-700",
  past_due: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
}

export function CurrentPlanCard() {
  const { subscription, planId, status } = useSubscription()
  const createPortal = useCreatePortalSession()
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  async function goToPortal() {
    try {
      const { url } = await createPortal.mutateAsync()
      window.location.href = url
    } catch (error) {
      toast.error("Failed to open billing portal", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const plan = planId ? PLANS[planId] : null
  const effectiveStatus = status ?? "active"

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold text-slate-900">{plan?.name ?? subscription?.plan_id}</p>
            <Badge variant="outline" className={STATUS_CLASSES[effectiveStatus]}>
              {STATUS_LABELS[effectiveStatus]}
            </Badge>
          </div>
          {plan && (
            <p className="text-sm text-slate-500">
              ${plan.priceMonthly}/mo — {plan.tagline}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setComparisonOpen(true)}>
            Change Plan
          </Button>
          <Button variant="outline" className="text-destructive" onClick={() => setCancelConfirmOpen(true)}>
            Cancel
          </Button>
        </div>
      </div>

      {status === "past_due" && (
        <p className="mt-3 rounded-md bg-red-50 p-2.5 text-sm text-red-700">
          Your last payment failed. Update your card in the billing portal to keep your plan's features.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2">
        {subscription?.current_period_end && (
          <div>
            <p className="text-slate-400">{subscription.cancel_at ? "Access until" : "Renews"}</p>
            <p className="text-slate-700">{formatDate(subscription.cancel_at ?? subscription.current_period_end)}</p>
          </div>
        )}
        {subscription?.cancel_at && (
          <div>
            <p className="text-slate-400">Status</p>
            <p className="text-slate-700">Cancels at the end of the current period</p>
          </div>
        )}
      </div>

      <PlanComparisonDialog open={comparisonOpen} onOpenChange={setComparisonOpen} />

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll keep access to {plan?.name ?? "your plan"}'s features until the end of your current billing
              period{subscription?.current_period_end ? ` (${formatDate(subscription.current_period_end)})` : ""},
              then lose access. Cancellation is handled in the Stripe billing portal — you'll be redirected there
              next.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my plan</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={goToPortal}
            >
              Continue to cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
