import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useCreatePortalSession, useSubscription } from "@/hooks/useSubscription"

/** Prominent, always-visible (not dismissible) banner for a past_due
 *  subscription — deliberately mounted on the Dashboard only, not every
 *  page, matching what was actually asked for rather than turning this
 *  into an app-wide interstitial. */
export function PaymentFailedBanner() {
  const { status } = useSubscription()
  const createPortal = useCreatePortalSession()

  if (status !== "past_due") return null

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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div>
          <p className="text-sm font-semibold text-red-800">Your last payment failed</p>
          <p className="text-sm text-red-700">
            Update your payment method to avoid losing access to your plan's features.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={handleUpdate}
        disabled={createPortal.isPending}
        className="bg-red-600 text-white hover:bg-red-700"
      >
        {createPortal.isPending ? "Opening…" : "Update Payment Method"}
      </Button>
    </div>
  )
}
