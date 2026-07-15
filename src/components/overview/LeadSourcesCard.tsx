import { Skeleton } from "@/components/ui/skeleton"
import type { LeadSourceBreakdown } from "@/hooks/useDashboard"
import { cn } from "@/lib/utils"
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

const SOURCE_BAR_COLOR: Record<LeadSource, string> = {
  website: "bg-blue-500",
  phone: "bg-teal-500",
  referral: "bg-purple-500",
  ai_employee: "bg-apex-teal",
  campaign: "bg-orange-500",
  manual: "bg-slate-400",
  other: "bg-pink-500",
}

interface LeadSourcesCardProps {
  breakdown: LeadSourceBreakdown[]
  isLoading: boolean
}

export function LeadSourcesCard({ breakdown, isLoading }: LeadSourcesCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">Lead Sources</h2>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
        ) : breakdown.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No leads yet.</p>
        ) : (
          breakdown.map((entry) => (
            <div key={entry.source}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-700">{SOURCE_LABELS[entry.source]}</span>
                <span className="shrink-0 text-slate-500">
                  {entry.count} · {Math.round(entry.percentage)}%
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                <div
                  className={cn("h-2 rounded-full transition-all", SOURCE_BAR_COLOR[entry.source])}
                  style={{ width: `${entry.percentage}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
