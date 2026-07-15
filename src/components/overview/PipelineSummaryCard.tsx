import { Skeleton } from "@/components/ui/skeleton"
import type { StageDealAggregate } from "@/hooks/useDashboard"
import { formatCurrency } from "@/lib/utils"
import type { PipelineStage } from "@/types/pipeline"

interface PipelineSummaryCardProps {
  stages: PipelineStage[]
  dealValues: Record<string, StageDealAggregate>
  isLoading: boolean
}

export function PipelineSummaryCard({ stages, dealValues, isLoading }: PipelineSummaryCardProps) {
  const maxValue = Math.max(1, ...stages.map((stage) => dealValues[stage.id]?.totalValue ?? 0))

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">Pipeline Summary</h2>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
        ) : stages.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No pipeline stages yet.</p>
        ) : (
          stages.map((stage) => {
            const aggregate = dealValues[stage.id] ?? { count: 0, totalValue: 0 }
            const widthPercent = (aggregate.totalValue / maxValue) * 100

            return (
              <div key={stage.id}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-700">{stage.name}</span>
                  <span className="shrink-0 text-slate-500">
                    {aggregate.count} deal{aggregate.count === 1 ? "" : "s"} ·{" "}
                    {formatCurrency(aggregate.totalValue)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: stage.color ?? "#2E86AB",
                    }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
