import { ArrowDown, ArrowUp } from "lucide-react"
import type { ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  label: string
  value: ReactNode
  isLoading?: boolean
  subtext?: ReactNode
  delta?: { value: number; label: string }
  valueClassName?: string
}

export function MetricCard({
  label,
  value,
  isLoading,
  subtext,
  delta,
  valueClassName,
}: MetricCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>

      {isLoading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <div className={cn("mt-1 text-2xl font-bold text-slate-900", valueClassName)}>{value}</div>
      )}

      {!isLoading && subtext && <div className="mt-1 text-xs text-slate-500">{subtext}</div>}

      {!isLoading && delta && (
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            delta.value >= 0 ? "text-green-600" : "text-red-600"
          )}
        >
          {delta.value >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {delta.value >= 0 ? "+" : ""}
          {delta.value} {delta.label}
        </div>
      )}
    </div>
  )
}
