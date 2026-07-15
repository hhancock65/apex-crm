import { useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { DateRangeSelector } from "@/components/analytics/DateRangeSelector"
import { defaultDateRange, type DateRange } from "@/lib/date-range"
import { MetricCard } from "@/components/overview/MetricCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAIPerformanceAnalytics } from "@/hooks/useAIPerformanceAnalytics"
import { CATEGORICAL_PALETTE, STATUS_CRITICAL, STATUS_GOOD, STATUS_NEUTRAL, categoricalColor } from "@/lib/chart-palette"
import { formatCurrency } from "@/lib/utils"
import { formatCallDuration } from "@/types/call"
import type { CallOutcome, CallSentiment } from "@/types/call"

const OUTCOME_LABELS: Record<CallOutcome, string> = {
  qualified: "Qualified",
  unqualified: "Unqualified",
  appointment_booked: "Appointment Booked",
  transfer: "Transferred",
  voicemail: "Voicemail",
  info_request: "Info Request",
  spam: "Spam",
}

const SENTIMENT_LABELS: Record<CallSentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
}

const SENTIMENT_COLORS: Record<CallSentiment, string> = {
  positive: STATUS_GOOD,
  neutral: STATUS_NEUTRAL,
  negative: STATUS_CRITICAL,
}

const CHART_AXIS_TICK = { fontSize: 11, fill: "#898781" }
const CHART_GRID_STROKE = "#e1e0d9"

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "Not enough data"
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.round(seconds % 60)
  return `${minutes}m ${remaining}s`
}

function hourLabel(hour: number): string {
  if (hour === 0) return "12a"
  if (hour === 12) return "12p"
  return hour < 12 ? `${hour}a` : `${hour - 12}p`
}

function countTooltipFormatter(value: unknown): string {
  return `${Number(value ?? 0)} calls`
}

export default function AIPerformancePage() {
  const [range, setRange] = useState<DateRange>(defaultDateRange)
  const { data, isLoading } = useAIPerformanceAnalytics(range)

  const kpis = data?.kpis
  const prev = data?.previousKpis

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Performance</h1>
          <p className="mt-1 text-sm text-slate-500">What your AI Employees are actually doing for you.</p>
        </div>
        <DateRangeSelector value={range} onChange={setRange} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Total Calls"
          isLoading={isLoading}
          value={kpis?.totalCalls ?? 0}
          delta={prev ? { value: (kpis?.totalCalls ?? 0) - prev.totalCalls, label: "vs prev period" } : undefined}
        />
        <MetricCard
          label="Leads Captured"
          isLoading={isLoading}
          value={kpis?.leadsCaptured ?? 0}
          delta={prev ? { value: (kpis?.leadsCaptured ?? 0) - prev.leadsCaptured, label: "vs prev period" } : undefined}
        />
        <MetricCard
          label="Appointments Booked"
          isLoading={isLoading}
          value={kpis?.appointmentsBooked ?? 0}
          delta={
            prev ? { value: (kpis?.appointmentsBooked ?? 0) - prev.appointmentsBooked, label: "vs prev period" } : undefined
          }
        />
        <MetricCard label="Pipeline Created" isLoading={isLoading} value={formatCurrency(kpis?.pipelineCreated ?? 0)} />
        <MetricCard
          label="Follow-ups Completed"
          isLoading={isLoading}
          value={kpis?.followUpsCompleted ?? 0}
          delta={
            prev ? { value: (kpis?.followUpsCompleted ?? 0) - prev.followUpsCompleted, label: "vs prev period" } : undefined
          }
        />
        <MetricCard
          label="Avg. Response Time"
          isLoading={isLoading}
          value={formatSeconds(kpis?.avgResponseTimeSeconds ?? null)}
          subtext="Missed call → automatic follow-up SMS"
        />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Per AI Employee</h2>
        <div className="mt-3">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !data?.perEmployee || data.perEmployee.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No AI Employee activity in this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Appointments</TableHead>
                  <TableHead>Conversion Rate</TableHead>
                  <TableHead>Avg. Call Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.perEmployee.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell className="font-medium text-slate-800">{row.name}</TableCell>
                    <TableCell>{row.calls}</TableCell>
                    <TableCell>{row.leads}</TableCell>
                    <TableCell>{row.appointments}</TableCell>
                    <TableCell>{row.conversionRate.toFixed(0)}%</TableCell>
                    <TableCell>{formatCallDuration(row.avgCallDurationSeconds !== null ? Math.round(row.avgCallDurationSeconds) : null)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Call Outcomes</h2>
          <div className="mt-4">
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : !data?.outcomeBreakdown || data.outcomeBreakdown.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No calls in this period.</p>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={200} className="sm:max-w-[200px]">
                  <PieChart>
                    <Pie
                      data={data.outcomeBreakdown}
                      dataKey="count"
                      nameKey="outcome"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={2}
                      stroke="#fcfcfb"
                    >
                      {data.outcomeBreakdown.map((entry, i) => (
                        <Cell key={entry.outcome} fill={categoricalColor(i)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={countTooltipFormatter} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="min-w-0 flex-1 space-y-1.5">
                  {data.outcomeBreakdown.map((entry, i) => (
                    <li key={entry.outcome} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoricalColor(i) }} />
                        {OUTCOME_LABELS[entry.outcome as CallOutcome] ?? entry.outcome}
                      </span>
                      <span className="font-medium text-slate-800">{entry.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Sentiment</h2>
          <div className="mt-4">
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : !data?.sentimentBreakdown || data.sentimentBreakdown.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No sentiment data in this period.</p>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={200} className="sm:max-w-[200px]">
                  <PieChart>
                    <Pie
                      data={data.sentimentBreakdown}
                      dataKey="count"
                      nameKey="sentiment"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={2}
                      stroke="#fcfcfb"
                    >
                      {data.sentimentBreakdown.map((entry) => (
                        <Cell key={entry.sentiment} fill={SENTIMENT_COLORS[entry.sentiment as CallSentiment]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={countTooltipFormatter} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="min-w-0 flex-1 space-y-1.5">
                  {data.sentimentBreakdown.map((entry) => (
                    <li key={entry.sentiment} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: SENTIMENT_COLORS[entry.sentiment as CallSentiment] }}
                        />
                        {SENTIMENT_LABELS[entry.sentiment as CallSentiment] ?? entry.sentiment}
                      </span>
                      <span className="font-medium text-slate-800">{entry.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Busiest Hours</h2>
        <p className="text-xs text-slate-400">Call volume by hour of day (UTC).</p>
        <div className="mt-4">
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.busiestHours ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                <XAxis dataKey="hour" tickFormatter={hourLabel} tick={CHART_AXIS_TICK} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} interval={1} />
                <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip formatter={countTooltipFormatter} labelFormatter={(h: unknown) => hourLabel(Number(h))} />
                <Bar dataKey="count" fill={CATEGORICAL_PALETTE[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
