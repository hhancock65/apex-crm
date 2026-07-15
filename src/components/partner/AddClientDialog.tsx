import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCreateClientOrganization } from "@/hooks/usePartner"

interface AddClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddClientDialog({ open, onOpenChange }: AddClientDialogProps) {
  const [name, setName] = useState("")
  const [monthlyRate, setMonthlyRate] = useState("")
  const createClient = useCreateClientOrganization()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Client name is required")
      return
    }

    try {
      await createClient.mutateAsync({
        name: name.trim(),
        monthly_rate: monthlyRate ? Number(monthlyRate) : undefined,
      })
      toast.success(`"${name}" created — click "View Dashboard" from the client list to set up their AI Employees.`)
      setName("")
      setMonthlyRate("")
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to create client organization", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="client-name">Client Name</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Dental"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-monthly-rate">Monthly Rate (optional)</Label>
            <Input
              id="client-monthly-rate"
              type="number"
              min="0"
              step="0.01"
              value={monthlyRate}
              onChange={(e) => setMonthlyRate(e.target.value)}
              placeholder="299.00"
            />
            <p className="text-xs text-slate-400">
              What you charge this client per month — used for your MRR totals here, separate from Apex's own plan
              pricing.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createClient.isPending}>
              {createClient.isPending ? "Creating…" : "Create Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
