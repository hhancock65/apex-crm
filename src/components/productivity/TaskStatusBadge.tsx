import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/types/task"

const STATUS_STYLES: Record<TaskStatus, string> = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className={cn("border font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
