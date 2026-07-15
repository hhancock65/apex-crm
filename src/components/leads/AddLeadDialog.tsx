import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCreateLead } from "@/hooks/useLeads"
import { leadFormSchema, type LeadFormValues } from "@/lib/validation/lead"
import { LEAD_SOURCES, type LeadSource } from "@/types/lead"

const SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  phone: "Phone",
  referral: "Referral",
  ai_employee: "AI Employee",
  campaign: "Campaign",
  manual: "Manual",
  other: "Other",
}

interface AddLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-fills the form — e.g. from CallDetailPage's "Create Lead from Call". Merged over the empty defaults each time the dialog opens. */
  defaultValues?: Partial<LeadFormValues>
}

const DEFAULT_VALUES: LeadFormValues = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company: "",
  source: "manual",
  notes: "",
}

export function AddLeadDialog({ open, onOpenChange, defaultValues }: AddLeadDialogProps) {
  const createLead = useCreateLead()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: { ...DEFAULT_VALUES, ...defaultValues },
  })

  const source = watch("source")

  useEffect(() => {
    if (open) reset({ ...DEFAULT_VALUES, ...defaultValues })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset(DEFAULT_VALUES)
    onOpenChange(nextOpen)
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createLead.mutateAsync({
        first_name: values.first_name.trim(),
        last_name: values.last_name?.trim() || null,
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        company: values.company?.trim() || null,
        source: values.source,
        notes: values.notes?.trim() || null,
      })
      toast.success("Lead created")
      reset(DEFAULT_VALUES)
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to create lead", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" {...register("first_name")} />
              {errors.first_name && (
                <p className="text-xs text-destructive">{errors.first_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" {...register("last_name")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" {...register("phone")} />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input id="company" {...register("company")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source">Source</Label>
              <Select
                value={source}
                onValueChange={(value) => setValue("source", value as LeadSource)}
              >
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {SOURCE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
