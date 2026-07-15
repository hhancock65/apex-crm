import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DealStatus } from "@/types/deal"

const STATUS_STYLES: Record<DealStatus, string> = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  won: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-red-50 text-red-700 border-red-200",
}

const STATUS_LABELS: Record<DealStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
}

export function DealStatusBadge({ status }: { status: DealStatus }) {
  return (
    <Badge variant="outline" className={cn("border font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
