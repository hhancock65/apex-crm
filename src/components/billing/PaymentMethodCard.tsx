import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCreatePortalSession } from "@/hooks/useSubscription"
import type { PaymentMethodSummary } from "@/types/billing"

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
}

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethodSummary | null | undefined
  isLoading: boolean
}

export function PaymentMethodCard({ paymentMethod, isLoading }: PaymentMethodCardProps) {
  const createPortal = useCreatePortalSession()

  async function handleUpdate() {
    try {
      const { url } = await createPortal.mutateAsync()
      window.location.href = url
    } catch (error) {
      toast.error("Failed to open billing portal", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Payment Method</h2>
        <Button variant="outline" size="sm" onClick={handleUpdate} disabled={createPortal.isPending}>
          {createPortal.isPending ? "Opening…" : "Update"}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="mt-3 h-6 w-48" />
      ) : paymentMethod ? (
        <p className="mt-3 text-sm text-slate-700">
          {CARD_BRAND_LABELS[paymentMethod.brand] ?? paymentMethod.brand} •••• {paymentMethod.last4}
          <span className="ml-2 text-slate-400">
            Expires {String(paymentMethod.expMonth).padStart(2, "0")}/{paymentMethod.expYear}
          </span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-400">No payment method on file.</p>
      )}
    </div>
  )
}
