import { CHART_COLORS, metricsFor, type UsageMetric } from "@/lib/usage-metrics"
import { formatDate } from "@/lib/utils"
import type { UsageRecord } from "@/types/usage"

interface UsageMiniChartProps {
  metricKey: UsageMetric["key"]
  label: string
  unit: string
  history: UsageRecord[]
  /** Wider bars for a standalone page (UsageHistoryPage, 12 periods) vs the
   *  compact embedded version in UsageDashboard (6 periods). */
  size?: "compact" | "large"
}

export function UsageMiniChart({ metricKey, label, unit, history, size = "compact" }: UsageMiniChartProps) {
  const points = history.map((row) => {
    const m = metricsFor(row).find((metric) => metric.key === metricKey)!
    return { periodLabel: formatDate(row.period_start, { month: "short" }), used: m.used, included: m.included }
  })

  const slotWidth = size === "large" ? 56 : 44
  const barWidth = size === "large" ? 36 : 28
  const chartHeight = size === "large" ? 140 : 110

  const maxValue = Math.max(...points.map((p) => Math.max(p.used, p.included)), 1)
  const chartWidth = points.length * slotWidth
  const baselineY = chartHeight - 16
  const plotHeight = baselineY - 16

  // Simplification: the reference line uses the MOST RECENT period's
  // included allowance. A mid-range plan change would mean earlier bars'
  // own allowance differed from this line — acceptable for a trend widget;
  // each bar's own value label is still exact.
  const latestIncluded = points[points.length - 1]?.included ?? 0
  const referenceY = baselineY - (latestIncluded / maxValue) * plotHeight

  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="mt-1 w-full"
        style={{ height: chartHeight }}
        role="img"
        aria-label={`${label} usage over the last ${points.length} billing periods`}
      >
        {latestIncluded > 0 && (
          <line
            x1={0}
            x2={chartWidth}
            y1={referenceY}
            y2={referenceY}
            stroke="#c3c2b7"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}
        {points.map((point, i) => {
          const barHeight = maxValue > 0 ? (point.used / maxValue) * plotHeight : 0
          const x = i * slotWidth + (slotWidth - barWidth) / 2
          return (
            <g key={`${point.periodLabel}-${i}`}>
              <rect
                x={x}
                y={baselineY - barHeight}
                width={barWidth}
                height={Math.max(barHeight, point.used > 0 ? 2 : 0)}
                rx={3}
                fill={CHART_COLORS[metricKey]}
              />
              <text x={x + barWidth / 2} y={baselineY - barHeight - 4} textAnchor="middle" fontSize="9" fill="#52514e">
                {Math.round(point.used).toLocaleString()}
              </text>
              <text x={x + barWidth / 2} y={chartHeight - 2} textAnchor="middle" fontSize="9" fill="#898781">
                {point.periodLabel}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="text-[10px] text-slate-400">{unit} per period · dashed line = current included allowance</p>
    </div>
  )
}
