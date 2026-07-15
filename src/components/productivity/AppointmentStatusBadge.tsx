import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AppointmentStatus } from "@/types/appointment"

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-teal-50 text-teal-700 border-teal-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  no_show: "bg-red-50 text-red-700 border-red-200",
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge variant="outline" className={cn("border font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
