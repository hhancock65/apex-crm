import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"
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
import { useCreateWorkflow } from "@/hooks/useWorkflows"
import { workflowFormSchema, type WorkflowFormValues } from "@/lib/validation/workflow"
import { WORKFLOW_TRIGGER_LABELS, WORKFLOW_TRIGGER_TYPES } from "@/types/workflow"

interface CreateWorkflowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DEFAULT_VALUES: WorkflowFormValues = {
  name: "",
  description: "",
  trigger_type: "new_lead",
}

export function CreateWorkflowDialog({ open, onOpenChange }: CreateWorkflowDialogProps) {
  const navigate = useNavigate()
  const createWorkflow = useCreateWorkflow()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const triggerType = watch("trigger_type")

  useEffect(() => {
    if (open) reset(DEFAULT_VALUES)
  }, [open, reset])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset(DEFAULT_VALUES)
    onOpenChange(nextOpen)
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const workflow = await createWorkflow.mutateAsync({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        trigger_type: values.trigger_type,
      })
      toast.success("Workflow created")
      reset(DEFAULT_VALUES)
      onOpenChange(false)
      navigate(`/workflows/${workflow.id}`)
    } catch (error) {
      toast.error("Failed to create workflow", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Workflow</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="workflow-name">Name</Label>
            <Input id="workflow-name" placeholder="e.g. New Lead Welcome" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workflow-description">Description</Label>
            <Textarea id="workflow-description" rows={2} {...register("description")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workflow-trigger">Trigger</Label>
            <Select
              value={triggerType}
              onValueChange={(value) => setValue("trigger_type", value as WorkflowFormValues["trigger_type"])}
            >
              <SelectTrigger id="workflow-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW_TRIGGER_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {WORKFLOW_TRIGGER_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400">
              Starts as a draft with no steps — you'll add those next, then switch it to Active.
            </p>
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
              {isSubmitting ? "Creating…" : "Create Workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
