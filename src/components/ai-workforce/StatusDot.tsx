import { cn } from "@/lib/utils"
import type { AiEmployeeStatus } from "@/types/ai-employee"

const STATUS_DOT_COLOR: Record<AiEmployeeStatus, string> = {
  online: "bg-green-500",
  offline: "bg-slate-300",
  paused: "bg-amber-400",
}

const STATUS_LABELS: Record<AiEmployeeStatus, string> = {
  online: "Online",
  offline: "Offline",
  paused: "Paused",
}

export function StatusDot({
  status,
  showLabel = true,
}: {
  status: AiEmployeeStatus
  showLabel?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
      <span className={cn("h-2 w-2 rounded-full", STATUS_DOT_COLOR[status])} />
      {showLabel && STATUS_LABELS[status]}
    </span>
  )
}
