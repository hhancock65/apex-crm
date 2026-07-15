import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import {
  RelatedRecordPicker,
  type RelatedRecordValue,
} from "@/components/productivity/RelatedRecordPicker"
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
import { useCreateTask } from "@/hooks/useTasks"
import { useOrgProfiles } from "@/hooks/useOrgProfiles"
import { taskFormSchema, type TaskFormValues } from "@/lib/validation/task"
import { TASK_PRIORITIES, type TaskPriority } from "@/types/task"
import { profileDisplayName } from "@/types/profile"

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

const DEFAULT_VALUES: TaskFormValues = {
  title: "",
  description: "",
  due_date: "",
  priority: "medium",
  assigned_to: "",
}

export function AddTaskDialog({ open, onOpenChange }: AddTaskDialogProps) {
  const createTask = useCreateTask()
  const { data: profiles } = useOrgProfiles()
  const [related, setRelated] = useState<RelatedRecordValue | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const priority = watch("priority")
  const assignedTo = watch("assigned_to")

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset(DEFAULT_VALUES)
      setRelated(null)
    }
    onOpenChange(nextOpen)
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createTask.mutateAsync({
        title: values.title.trim(),
        description: values.description?.trim() || null,
        due_date: values.due_date || null,
        priority: values.priority,
        assigned_to: values.assigned_to || null,
        related_to_type: related?.type ?? null,
        related_to_id: related?.id ?? null,
      })
      toast.success("Task created")
      handleOpenChange(false)
    } catch (error) {
      toast.error("Failed to create task", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="due_date">Due Date</Label>
              <Input id="due_date" type="date" {...register("due_date")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setValue("priority", v as TaskPriority)}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PRIORITY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assigned_to">Assigned To</Label>
            <Select
              value={assignedTo || "unassigned"}
              onValueChange={(v) => setValue("assigned_to", v === "unassigned" ? "" : v)}
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

          <div className="space-y-1.5">
            <Label>Related To</Label>
            <RelatedRecordPicker value={related} onChange={setRelated} />
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
              {isSubmitting ? "Saving…" : "Save Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
