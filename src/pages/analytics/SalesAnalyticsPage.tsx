import { useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { MetricCard } from "@/components/overview/MetricCard"
import { DateRangeSelector } from "@/components/analytics/DateRangeSelector"
import { defaultDateRange, type DateRange } from "@/lib/date-range"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSalesAnalytics } from "@/hooks/useSalesAnalytics"
import { usePipelines } from "@/hooks/usePipelines"
import { SEQUENTIAL_BLUE, categoricalColor } from "@/lib/chart-palette"
import { formatCurrency } from "@/lib/utils"
import type { LeadSource } from "@/types/lead"

const SOURCE_LABELS: Record<LeadSource | "direct", string> = {
  website: "Website",
  phone: "Phone",
  referral: "Referral",
  ai_employee: "AI Employee",
  campaign: "Campaign",
  manual: "Manual entry",
  other: "Other",
  direct: "Direct / No matched lead",
}

const CHART_AXIS_TICK = { fontSize: 11, fill: "#898781" }
const CHART_GRID_STROKE = "#e1e0d9"

function currencyTooltipFormatter(value: unknown): string {
  return formatCurrency(typeof value === "number" ? value : Number(value ?? 0))
}

function sourceLabel(value: unknown): string {
  const key = value as LeadSource | "direct"
  return SOURCE_LABELS[key] ?? String(value)
}

function PipelineFunnel({ funnel, isLoading }: { funnel: { stageId: string; name: string; count: number; value: number }[] | undefined; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (!funnel || funnel.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No pipeline stages configured yet.</p>
  }
  const maxCount = Math.max(...funnel.map((s) => s.count), 1)

  return (
    <div className="space-y-2.5">
      {funnel.map((stage) => {
        const widthPct = stage.count > 0 ? Math.max(6, (stage.count / maxCount) * 100) : 0
        return (
          <div key={stage.stageId} className="flex items-center gap-3">
            <div className="w-32 shrink-0 truncate text-sm text-slate-600">{stage.name}</div>
            <div className="min-w-0 flex-1">
              <div
                className="flex h-8 items-center rounded-md bg-apex-teal px-3 text-xs font-medium text-white transition-all"
                style={{ width: `${widthPct}%` }}
              >
                {stage.count > 0 && stage.count}
              </div>
            </div>
            <div className="w-24 shrink-0 text-right text-sm text-slate-500">{formatCurrency(stage.value)}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function SalesAnalyticsPage() {
  const [range, setRange] = useState<DateRange>(defaultDateRange)
  const { data: pipelines } = usePipelines()
  const defaultPipeline = pipelines?.find((p) => p.is_default) ?? pipelines?.[0]
  const { data, isLoading } = useSalesAnalytics(range, defaultPipeline?.id)

  const kpis = data?.kpis
  const cycleLabel = kpis?.averageSalesCycleDays !== null && kpis?.averageSalesCycleDays !== undefined
    ? `${kpis.averageSalesCycleDays.toFixed(0)} days`
    : "—"

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Pipeline performance and closed revenue.</p>
        </div>
        <DateRangeSelector value={range} onChange={setRange} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Total Revenue" isLoading={isLoading} value={formatCurrency(kpis?.totalRevenue ?? 0)} />
        <MetricCard label="Deals Closed" isLoading={isLoading} value={kpis?.dealsClosed ?? 0} />
        <MetricCard label="Avg. Deal Size" isLoading={isLoading} value={formatCurrency(kpis?.averageDealSize ?? 0)} />
        <MetricCard label="Win Rate" isLoading={isLoading} value={`${(kpis?.winRate ?? 0).toFixed(0)}%`} />
        <MetricCard label="Avg. Sales Cycle" isLoading={isLoading} value={cycleLabel} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Pipeline Funnel</h2>
          <p className="text-xs text-slate-400">Current open pipeline by stage, plus deals won in the selected period.</p>
          <div className="mt-4">
            <PipelineFunnel funnel={data?.funnel} isLoading={isLoading} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Revenue Trend</h2>
          <p className="text-xs text-slate-400">Won deal value, last 12 months.</p>
          <div className="mt-4">
            {isLoading ? (
              <Skeleton className="h-60 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.revenueTrend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                  <XAxis dataKey="monthLabel" tick={CHART_AXIS_TICK} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
                  <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={70} tickFormatter={(v: number) => formatCurrency(v)} />
                  <Tooltip formatter={currencyTooltipFormatter} />
                  <Bar dataKey="revenue" fill={SEQUENTIAL_BLUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Top Sources</h2>
          <p className="text-xs text-slate-400">Won-deal revenue by the originating lead's source (best-effort match by contact phone/email).</p>
          <div className="mt-4">
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : !data?.topSources || data.topSources.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No won deals in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, data.topSources.length * 44)}>
                <BarChart data={data.topSources} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrency(v)} />
                  <YAxis
                    type="category"
                    dataKey="source"
                    width={110}
                    tick={{ ...CHART_AXIS_TICK, fill: "#52514e" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={sourceLabel}
                  />
                  <Tooltip formatter={currencyTooltipFormatter} labelFormatter={sourceLabel} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {data.topSources.map((entry, i) => (
                      <Cell key={entry.source} fill={categoricalColor(i)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Leaderboard</h2>
          <p className="text-xs text-slate-400">Deals closed this period, human reps and AI Employees together.</p>
          <div className="mt-4">
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : !data?.leaderboard || data.leaderboard.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No won deals in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Deals Closed</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.leaderboard.map((entry) => (
                    <TableRow key={entry.key}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{entry.name}</span>
                          <Badge
                            variant="outline"
                            className={
                              entry.type === "ai"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                            }
                          >
                            {entry.type === "ai" ? "AI" : "Human"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{entry.dealsClosed}</TableCell>
                      <TableCell className="text-right font-medium text-slate-800">
                        {formatCurrency(entry.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
