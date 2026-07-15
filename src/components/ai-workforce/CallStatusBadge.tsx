import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CallStatus } from "@/types/call"

const STATUS_STYLES: Record<CallStatus, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200 animate-pulse",
  completed: "bg-green-50 text-green-700 border-green-200",
  missed: "bg-red-50 text-red-700 border-red-200",
  transferred: "bg-blue-50 text-blue-700 border-blue-200",
  voicemail: "bg-slate-100 text-slate-600 border-slate-200",
  failed: "bg-red-50 text-red-700 border-red-200",
}

const STATUS_LABELS: Record<CallStatus, string> = {
  active: "Live",
  completed: "Completed",
  missed: "Missed",
  transferred: "Transferred",
  voicemail: "Voicemail",
  failed: "Failed",
}

export function CallStatusBadge({ status }: { status: CallStatus }) {
  return (
    <Badge variant="outline" className={cn("border font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
