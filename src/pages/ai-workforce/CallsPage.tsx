import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { CallDirectionBadge } from "@/components/ai-workforce/CallDirectionBadge"
import { CallOutcomeBadge } from "@/components/ai-workforce/CallOutcomeBadge"
import { CallSentimentIcon } from "@/components/ai-workforce/CallSentimentIcon"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAiEmployees } from "@/hooks/useAiEmployees"
import { DEFAULT_CALL_FILTERS, useCalls } from "@/hooks/useCalls"
import { cn, formatDateTime } from "@/lib/utils"
import { contactFullName } from "@/types/contact"
import {
  CALL_DIRECTIONS,
  CALL_OUTCOMES,
  CALL_SENTIMENTS,
  formatCallDuration,
  type CallDirection,
  type CallOutcome,
  type CallSentiment,
} from "@/types/call"

const DIRECTION_LABELS: Record<CallDirection, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
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

const SENTIMENT_LABELS: Record<CallSentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
}

export default function CallsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(DEFAULT_CALL_FILTERS)

  const { data, isLoading, isFetching, error } = useCalls(filters)
  const { data: employees } = useAiEmployees()

  const calls = data?.calls ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize))

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Calls</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isLoading ? "Loading…" : `${total} call${total === 1 ? "" : "s"}`}
        </p>
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Select value={filters.aiEmployeeId} onValueChange={(v) => updateFilter("aiEmployeeId", v)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="AI Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees?.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.direction}
          onValueChange={(v) => updateFilter("direction", v as CallDirection | "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            {CALL_DIRECTIONS.map((direction) => (
              <SelectItem key={direction} value={direction}>
                {DIRECTION_LABELS[direction]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.outcome} onValueChange={(v) => updateFilter("outcome", v as CallOutcome | "all")}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            {CALL_OUTCOMES.map((outcome) => (
              <SelectItem key={outcome} value={outcome}>
                {OUTCOME_LABELS[outcome]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.sentiment}
          onValueChange={(v) => updateFilter("sentiment", v as CallSentiment | "all")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sentiment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sentiments</SelectItem>
            {CALL_SENTIMENTS.map((sentiment) => (
              <SelectItem key={sentiment} value={sentiment}>
                {SENTIMENT_LABELS[sentiment]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
            className="w-[150px]"
            aria-label="From date"
          />
          <span className="text-sm text-slate-400">to</span>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter("dateTo", e.target.value)}
            className="w-[150px]"
            aria-label="To date"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>AI Employee</TableHead>
              <TableHead>Caller</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Sentiment</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-slate-400">
                  Loading calls…
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-destructive">
                  Failed to load calls: {error instanceof Error ? error.message : "Unknown error"}
                </TableCell>
              </TableRow>
            ) : calls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-slate-400">
                  No calls match your filters.
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call) => (
                <TableRow
                  key={call.id}
                  className={cn("cursor-pointer", isFetching && "opacity-60")}
                  onClick={() => navigate(`/calls/${call.id}`)}
                >
                  <TableCell className="font-medium text-slate-900">
                    {call.ai_employee?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {call.contact ? contactFullName(call.contact) : call.caller_phone ?? "Unknown"}
                  </TableCell>
                  <TableCell>
                    <CallDirectionBadge direction={call.direction} />
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {formatCallDuration(call.duration_seconds)}
                  </TableCell>
                  <TableCell>
                    <CallOutcomeBadge outcome={call.outcome} />
                  </TableCell>
                  <TableCell>
                    <CallSentimentIcon sentiment={call.sentiment} />
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-slate-500">
                    {call.summary ?? "—"}
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDateTime(call.started_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination
            page={filters.page}
            pageCount={pageCount}
            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
          />
        </div>
      )}
    </div>
  )
}
