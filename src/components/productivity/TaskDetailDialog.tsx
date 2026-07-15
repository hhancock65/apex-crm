import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { TaskPriorityBadge } from "@/components/productivity/TaskPriorityBadge"
import { TaskStatusBadge } from "@/components/productivity/TaskStatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useMarkTaskComplete } from "@/hooks/useTasks"
import { formatDate } from "@/lib/utils"
import { profileDisplayName } from "@/types/profile"
import { isTaskOverdue, type TaskWithRelated } from "@/types/task"

const RELATED_PATHS: Record<string, string> = {
  lead: "/leads",
  contact: "/contacts",
  deal: "/deals",
}

interface TaskDetailDialogProps {
  task: TaskWithRelated | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  const markComplete = useMarkTaskComplete()
  const navigate = useNavigate()

  if (!task) return null

  const overdue = isTaskOverdue(task)

  async function handleToggleComplete() {
    try {
      await markComplete.mutateAsync({ id: task!.id, completed: task!.status !== "completed" })
      toast.success(task!.status === "completed" ? "Task reopened" : "Task marked complete")
    } catch (err) {
      toast.error("Failed to update task", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  function handleOpenRelated() {
    if (!task!.related_to_type || !task!.related_to_id) return
    const basePath = RELATED_PATHS[task!.related_to_type]
    if (!basePath) return
    onOpenChange(false)
    navigate(`${basePath}/${task!.related_to_id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <TaskPriorityBadge priority={task.priority} />
            <TaskStatusBadge status={task.status} />
            {overdue && (
              <Badge variant="outline" className="border-red-200 bg-red-50 font-medium text-red-700">
                Overdue
              </Badge>
            )}
          </div>

          {task.description && <p className="text-slate-600">{task.description}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Due</div>
              <div className="mt-0.5 text-slate-800">{formatDate(task.due_date)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Assigned To
              </div>
              <div className="mt-0.5 text-slate-800">
                {profileDisplayName(task.assigned_profile)}
              </div>
            </div>
          </div>

          {task.related_label && (
            <button
              type="button"
              onClick={handleOpenRelated}
              className="text-sm font-medium text-apex-teal hover:underline"
            >
              View related {task.related_to_type}: {task.related_label} →
            </button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleToggleComplete} disabled={markComplete.isPending}>
            {task.status === "completed" ? "Reopen" : "Mark Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
