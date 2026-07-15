import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TaskPriority } from "@/types/task"

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant="outline" className={cn("border font-medium", PRIORITY_STYLES[priority])}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}
