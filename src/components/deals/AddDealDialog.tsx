import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { ContactCombobox } from "@/components/shared/ContactCombobox"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCompanies } from "@/hooks/useCompanies"
import { useCreateDeal } from "@/hooks/useDeals"
import { useOrgProfiles } from "@/hooks/useOrgProfiles"
import { dealFormSchema, parseDealProbability, parseDealValue, type DealFormValues } from "@/lib/validation/deal"
import type { DealContactSummary } from "@/types/deal"
import type { PipelineStage } from "@/types/pipeline"
import { profileDisplayName } from "@/types/profile"

interface AddDealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipelineId: string
  stages: PipelineStage[]
  defaultStageId?: string
}

export function AddDealDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
  defaultStageId,
}: AddDealDialogProps) {
  const createDeal = useCreateDeal()
  const { data: companies } = useCompanies()
  const { data: profiles } = useOrgProfiles()

  const [contact, setContact] = useState<DealContactSummary | null>(null)
  const [value, setValue] = useState("")
  const [probability, setProbability] = useState("")

  const defaultValues: DealFormValues = {
    title: "",
    stage_id: defaultStageId ?? stages[0]?.id ?? "",
    contact_id: "",
    company_id: "",
    expected_close_date: "",
    assigned_to: "",
    notes: "",
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue: setFormValue,
    formState: { errors, isSubmitting },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues,
  })

  // The dialog instance is reused across columns, so when it's re-opened
  // with a different column's stage id, the form needs to pick that up.
  useEffect(() => {
    if (open) {
      reset({ ...defaultValues, stage_id: defaultStageId ?? stages[0]?.id ?? "" })
      setContact(null)
      setValue("")
      setProbability("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultStageId])

  const stageId = watch("stage_id")
  const companyId = watch("company_id")
  const assignedTo = watch("assigned_to")

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
  }

  const onSubmit = handleSubmit(async (values) => {
    const parsedValue = parseDealValue(value)
    if (parsedValue.error) {
      toast.error(parsedValue.error)
      return
    }
    const parsedProbability = parseDealProbability(probability)
    if (parsedProbability.error) {
      toast.error(parsedProbability.error)
      return
    }

    try {
      await createDeal.mutateAsync({
        pipeline_id: pipelineId,
        stage_id: values.stage_id,
        title: values.title.trim(),
        contact_id: contact?.id ?? null,
        company_id: values.company_id || null,
        value: parsedValue.value,
        probability: parsedProbability.value,
        expected_close_date: values.expected_close_date || null,
        assigned_to: values.assigned_to || null,
        notes: values.notes?.trim() || null,
      })
      toast.success("Deal created")
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to create deal", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Deal</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stage_id">Stage</Label>
            <Select value={stageId} onValueChange={(v) => setFormValue("stage_id", v)}>
              <SelectTrigger id="stage_id">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Contact</Label>
            <ContactCombobox value={contact} onChange={setContact} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company_id">Company</Label>
            <Select
              value={companyId || "none"}
              onValueChange={(v) => setFormValue("company_id", v === "none" ? "" : v)}
            >
              <SelectTrigger id="company_id">
                <SelectValue placeholder="No company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No company</SelectItem>
                {companies?.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="value">Value ($)</Label>
              <Input
                id="value"
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="probability">Probability (%)</Label>
              <Input
                id="probability"
                type="number"
                min="0"
                max="100"
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="expected_close_date">Expected close date</Label>
              <Input id="expected_close_date" type="date" {...register("expected_close_date")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select
                value={assignedTo || "unassigned"}
                onValueChange={(v) => setFormValue("assigned_to", v === "unassigned" ? "" : v)}
              >
                <SelectTrigger id="assigned_to">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {profiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profileDisplayName(profile)}
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
              {isSubmitting ? "Saving…" : "Save Deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
