import { Download } from "lucide-react"

import { UsageMiniChart } from "@/components/billing/UsageMiniChart"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUsageHistory, useUsageRealtime } from "@/hooks/useUsage"
import { exportToCsv } from "@/lib/csv"
import { formatCurrencyPrecise, formatDate } from "@/lib/utils"

const HISTORY_MONTHS = 12

export default function UsageHistoryPage() {
  const { data: history, isLoading } = useUsageHistory(HISTORY_MONTHS)
  useUsageRealtime()

  function handleExport() {
    if (!history || history.length === 0) return
    const rows = history.map((row) => ({
      Month: formatDate(row.period_start, { month: "short", year: "numeric" }),
      "Period Start": row.period_start,
      "Period End": row.period_end,
      "AI Minutes Used": row.ai_minutes_used,
      "AI Minutes Included": row.ai_minutes_included,
      "SMS Sent": row.sms_sent,
      "SMS Included": row.sms_included,
      "Calls Made": row.calls_made,
      "Calls Included": row.calls_included,
      "Overage Amount": row.overage_amount.toFixed(2),
    }))
    exportToCsv(`apex-usage-history-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Usage History</h1>
          <p className="mt-1 text-sm text-slate-500">AI minutes, SMS, and calls over the last {HISTORY_MONTHS} billing periods.</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={!history || history.length === 0}>
          <Download className="h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !history || history.length === 0 ? (
        <p className="mt-10 py-10 text-center text-sm text-slate-400">
          No usage history yet — this fills in once your subscription's billing periods start accumulating.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-6 rounded-lg border border-slate-200 bg-white p-5 lg:grid-cols-3">
            <UsageMiniChart metricKey="ai_minutes" label="AI Minutes" unit="min" history={history} size="large" />
            <UsageMiniChart metricKey="sms" label="SMS" unit="msgs" history={history} size="large" />
            <UsageMiniChart metricKey="calls" label="Calls" unit="calls" history={history} size="large" />
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">Monthly Breakdown</h2>
            <div className="mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>AI Minutes</TableHead>
                    <TableHead>SMS</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead className="text-right">Overage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history
                    .slice()
                    .reverse()
                    .map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDate(row.period_start, { month: "short", year: "numeric" })}</TableCell>
                        <TableCell>
                          {row.ai_minutes_used.toLocaleString(undefined, { maximumFractionDigits: 1 })} /{" "}
                          {row.ai_minutes_included.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {row.sms_sent.toLocaleString()} / {row.sms_included.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {row.calls_made.toLocaleString()} / {row.calls_included.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.overage_amount > 0 ? (
                            <span className="font-medium text-red-600">{formatCurrencyPrecise(row.overage_amount)}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
