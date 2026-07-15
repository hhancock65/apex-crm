import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CallOutcome } from "@/types/call"

const OUTCOME_STYLES: Record<CallOutcome, string> = {
  qualified: "bg-green-50 text-green-700 border-green-200",
  unqualified: "bg-slate-100 text-slate-600 border-slate-200",
  appointment_booked: "bg-teal-50 text-teal-700 border-teal-200",
  transfer: "bg-blue-50 text-blue-700 border-blue-200",
  voicemail: "bg-slate-100 text-slate-600 border-slate-200",
  info_request: "bg-purple-50 text-purple-700 border-purple-200",
  spam: "bg-red-50 text-red-700 border-red-200",
}

const OUTCOME_LABELS: Record<CallOutcome, string> = {
  qualified: "Qualified",
  unqualified: "Unqualified",
  appointment_booked: "Appointment Booked",
  transfer: "Transfer",
  voicemail: "Voicemail",
  info_request: "Info Request",
  spam: "Spam",
}

export function CallOutcomeBadge({ outcome }: { outcome: CallOutcome | null }) {
  if (!outcome) {
    return (
      <Badge variant="outline" className="border-slate-200 bg-slate-50 font-normal text-slate-400">
        —
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={cn("border font-medium", OUTCOME_STYLES[outcome])}>
      {OUTCOME_LABELS[outcome]}
    </Badge>
  )
}
