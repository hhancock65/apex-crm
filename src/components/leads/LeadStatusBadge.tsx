import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { LeadStatus } from "@/types/lead"

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-yellow-50 text-yellow-700 border-yellow-200",
  qualified: "bg-green-50 text-green-700 border-green-200",
  unqualified: "bg-red-50 text-red-700 border-red-200",
  converted: "bg-purple-50 text-purple-700 border-purple-200",
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant="outline" className={cn("border font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
