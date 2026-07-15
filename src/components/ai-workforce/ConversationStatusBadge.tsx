import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ConversationStatus } from "@/types/conversation"

const STATUS_STYLES: Record<ConversationStatus, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200 animate-pulse",
  completed: "bg-green-50 text-green-700 border-green-200",
  escalated: "bg-orange-50 text-orange-700 border-orange-200",
}

const STATUS_LABELS: Record<ConversationStatus, string> = {
  active: "Active",
  completed: "Completed",
  escalated: "Escalated",
}

export function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
  return (
    <Badge variant="outline" className={cn("border font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
