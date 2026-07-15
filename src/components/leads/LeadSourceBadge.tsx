import { Badge } from "@/components/ui/badge"
import type { LeadSource } from "@/types/lead"

const SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  phone: "Phone",
  referral: "Referral",
  ai_employee: "AI Employee",
  campaign: "Campaign",
  manual: "Manual",
  other: "Other",
}

export function LeadSourceBadge({ source }: { source: LeadSource }) {
  return (
    <Badge variant="outline" className="border-slate-200 bg-slate-50 font-normal text-slate-600">
      {SOURCE_LABELS[source]}
    </Badge>
  )
}
