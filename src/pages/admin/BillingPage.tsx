import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { CurrentPlanCard } from "@/components/billing/CurrentPlanCard"
import { InvoiceHistoryTable } from "@/components/billing/InvoiceHistoryTable"
import { PaymentMethodCard } from "@/components/billing/PaymentMethodCard"
import { PricingPlans } from "@/components/billing/PricingPlans"
import { UsageDashboard } from "@/components/billing/UsageDashboard"
import { PermissionGate } from "@/components/permissions/PermissionGate"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useBillingDetails } from "@/hooks/useBillingDetails"
import { useCreatePortalSession, useSubscription, useSubscriptionRealtime } from "@/hooks/useSubscription"

function BillingPageContent() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { subscription, status, isLoading } = useSubscription()
  const createPortal = useCreatePortalSession()

  useSubscriptionRealtime()

  const isSubscribed = Boolean(subscription) && status !== "cancelled"
  const { data: billingDetails, isLoading: billingDetailsLoading } = useBillingDetails(isSubscribed)

  useEffect(() => {
    const checkout = searchParams.get("checkout")
    if (!checkout) return

    if (checkout === "success") {
      toast.success("Thanks! Your subscription is being set up — this can take a few seconds to fully sync.")
    } else if (checkout === "cancelled") {
      toast.info("Checkout cancelled — no changes were made.")
    }

    setSearchParams(
      (prev) => {
        prev.delete("checkout")
        return prev
      },
      { replace: true }
    )
  }, [searchParams, setSearchParams])

  async function handleManageBilling() {
    try {
      const { url } = await createPortal.mutateAsync()
      window.location.href = url
    } catch (error) {
      toast.error("Failed to open billing portal", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-32 w-full" />
      </div>
    )
  }

  if (!isSubscribed) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Billing</h1>
        <p className="mt-1 text-sm text-slate-500">
          {subscription
            ? "Your subscription was cancelled — choose a plan to get back up and running."
            : "You don't have an active plan yet — choose one to get started."}
        </p>
        <div className="mt-6">
          <PricingPlans />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Billing</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your subscription and payment methods.</p>
        </div>
        <Button onClick={handleManageBilling} disabled={createPortal.isPending}>
          {createPortal.isPending ? "Opening…" : "Manage Billing"}
        </Button>
      </div>

      <div className="mt-6">
        <CurrentPlanCard />
      </div>

      <div className="mt-6">
        <UsageDashboard />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <PaymentMethodCard paymentMethod={billingDetails?.paymentMethod} isLoading={billingDetailsLoading} />
        <InvoiceHistoryTable invoices={billingDetails?.invoices} isLoading={billingDetailsLoading} />
      </div>
    </div>
  )
}

export default function BillingPage() {
  return (
    <PermissionGate requiredRole="owner">
      <BillingPageContent />
    </PermissionGate>
  )
}
