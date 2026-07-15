import { Badge } from "@/components/ui/badge"
import type { AppointmentType } from "@/types/appointment"

const TYPE_LABELS: Record<AppointmentType, string> = {
  call: "Call",
  meeting: "Meeting",
  demo: "Demo",
  service: "Service",
  follow_up: "Follow-up",
  other: "Other",
}

export function AppointmentTypeBadge({ type }: { type: AppointmentType }) {
  return (
    <Badge variant="outline" className="border-slate-200 bg-slate-50 font-normal text-slate-600">
      {TYPE_LABELS[type]}
    </Badge>
  )
}
