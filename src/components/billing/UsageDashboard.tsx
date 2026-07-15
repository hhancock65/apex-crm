import { UsageMiniChart } from "@/components/billing/UsageMiniChart"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentUsage, useUsageHistory, useUsageRealtime } from "@/hooks/useUsage"
import { metricsFor, statusColorFor, STATUS_CRITICAL, type UsageMetric } from "@/lib/usage-metrics"
import { formatCurrencyPrecise, formatDate } from "@/lib/utils"

function UsageProgressBar({ metric }: { metric: UsageMetric }) {
  const { label, unit, used, included, rate } = metric
  const hasAllowance = included > 0
  const pctOfIncluded = hasAllowance ? (used / included) * 100 : used > 0 ? 100 : 0
  const barPct = Math.min(100, pctOfIncluded)
  const color = statusColorFor(pctOfIncluded)
  const overBy = Math.max(0, used - included)

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">
          {used.toLocaleString(undefined, { maximumFractionDigits: 1 })} of{" "}
          {hasAllowance ? included.toLocaleString() : "0"} {unit}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100">
        <div className="h-2 rounded-full transition-all" style={{ width: `${barPct}%`, backgroundColor: color }} />
      </div>
      {!hasAllowance && used === 0 ? (
        <p className="mt-1 text-xs text-slate-400">Not included in your current plan.</p>
      ) : (
        overBy > 0 && (
          <p className="mt-1 text-xs" style={{ color: STATUS_CRITICAL }}>
            {overBy.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit} over —{" "}
            {formatCurrencyPrecise(overBy * rate)} overage
          </p>
        )
      )}
    </div>
  )
}

export function UsageDashboard() {
  const { data: current, isLoading: currentLoading } = useCurrentUsage()
  const { data: history, isLoading: historyLoading } = useUsageHistory(6)
  useUsageRealtime()

  if (currentLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-16 w-full" />
      </div>
    )
  }

  if (!current) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Usage</h2>
        <p className="mt-2 text-sm text-slate-400">
          No usage tracked yet for this org — this fills in once your subscription's billing period is set up.
        </p>
      </div>
    )
  }

  const metrics = metricsFor(current)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Usage This Period</h2>
        <p className="text-xs text-slate-500">
          This billing period: {formatDate(current.period_start)} to {formatDate(current.period_end)}
        </p>
      </div>

      <div className="mt-4 space-y-4">
        {metrics.map((metric) => (
          <UsageProgressBar key={metric.key} metric={metric} />
        ))}
      </div>

      {current.overage_amount > 0 && (
        <div className="mt-4 rounded-md p-3 text-sm" style={{ backgroundColor: "#fdf1e4", color: "#8a4a1f" }}>
          Estimated overage this period:{" "}
          <span className="font-semibold">{formatCurrencyPrecise(current.overage_amount)}</span>
          {current.invoiced_at ? " (already added to your invoice)" : " — added to your next invoice automatically"}
        </div>
      )}

      {!historyLoading && history && history.length > 1 && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Last {history.length} billing periods</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <UsageMiniChart metricKey="ai_minutes" label="AI Minutes" unit="min" history={history} />
            <UsageMiniChart metricKey="sms" label="SMS" unit="msgs" history={history} />
            <UsageMiniChart metricKey="calls" label="Calls" unit="calls" history={history} />
          </div>
        </div>
      )}
    </div>
  )
}
