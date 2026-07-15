import { PhoneIncoming, PhoneOutgoing } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { CallDirection } from "@/types/call"

export function CallDirectionBadge({ direction }: { direction: CallDirection }) {
  const Icon = direction === "inbound" ? PhoneIncoming : PhoneOutgoing
  return (
    <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-50 font-normal text-slate-600">
      <Icon className="h-3 w-3" />
      {direction === "inbound" ? "Inbound" : "Outbound"}
    </Badge>
  )
}
