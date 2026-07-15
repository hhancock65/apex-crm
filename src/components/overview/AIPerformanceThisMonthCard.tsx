import { Skeleton } from "@/components/ui/skeleton"
import type { AIPerformanceThisMonth } from "@/hooks/useAICommandCenter"
import { formatCurrency } from "@/lib/utils"

interface AIPerformanceThisMonthCardProps {
  performance: AIPerformanceThisMonth | undefined
  isLoading: boolean
}

export function AIPerformanceThisMonthCard({
  performance,
  isLoading,
}: AIPerformanceThisMonthCardProps) {
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long" })

  const countRows = performance
    ? [
        { label: "Calls Answered", value: performance.callsAnswered },
        { label: "Leads Captured", value: performance.leadsCaptured },
        { label: "Appointments Booked", value: performance.appointmentsBooked },
        { label: "Follow-Ups Completed", value: performance.followUpsCompleted },
        { label: "Warm Transfers", value: performance.warmTransfers },
      ]
    : []
  const maxCount = Math.max(1, ...countRows.map((row) => row.value))

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">Performance This Month</h2>
      <p className="text-xs text-slate-400">{monthLabel}</p>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
        ) : (
          <>
            {countRows.map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="font-semibold text-slate-800">{row.value}</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-apex-teal"
                    style={{ width: `${(row.value / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
              <span className="text-slate-600">Pipeline Created</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(performance?.pipelineCreated ?? 0)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
