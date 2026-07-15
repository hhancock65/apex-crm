import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useMarkDealLost } from "@/hooks/useDeals"

interface MarkDealLostDialogProps {
  dealId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function MarkDealLostDialog({
  dealId,
  open,
  onOpenChange,
  onSuccess,
}: MarkDealLostDialogProps) {
  const [reason, setReason] = useState("")
  const markLost = useMarkDealLost()

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setReason("")
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    if (!reason.trim()) {
      toast.error("Please enter a reason this deal was lost")
      return
    }
    try {
      await markLost.mutateAsync({ id: dealId, lostReason: reason.trim() })
      toast.success("Deal marked lost")
      setReason("")
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error("Failed to mark deal lost", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark deal as lost</DialogTitle>
          <DialogDescription>
            Let your team know why this deal didn't close.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="lost_reason">Reason</Label>
          <Textarea
            id="lost_reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Went with a competitor, budget cut, no response…"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={markLost.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleConfirm}
            disabled={markLost.isPending}
          >
            {markLost.isPending ? "Saving…" : "Mark Lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
