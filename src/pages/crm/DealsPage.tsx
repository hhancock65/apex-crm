import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { DealStatusBadge } from "@/components/deals/DealStatusBadge"
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
import { DEFAULT_DEAL_FILTERS, useDeals, useDealsSummary, type DealSortColumn } from "@/hooks/useDeals"
import { useOrgProfiles } from "@/hooks/useOrgProfiles"
import { useAllPipelineStages, usePipelines } from "@/hooks/usePipelines"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { dealContactName, DEAL_STATUSES, type DealStatus } from "@/types/deal"
import { profileDisplayName } from "@/types/profile"

const STATUS_LABELS: Record<DealStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
}

interface SortableHeaderProps {
  label: string
  column: DealSortColumn
  sortBy: DealSortColumn
  sortDir: "asc" | "desc"
  onSort: (column: DealSortColumn) => void
}

function SortableHeader({ label, column, sortBy, sortDir, onSort }: SortableHeaderProps) {
  const isActive = sortBy === column
  const Icon = isActive ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground",
        isActive && "text-foreground"
      )}
    >
      {label}
      <Icon className="h-3 w-3" />
    </button>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  )
}

export default function DealsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(DEFAULT_DEAL_FILTERS)

  const { data, isLoading, isFetching, error } = useDeals(filters)
  const { data: summary } = useDealsSummary(filters)
  const { data: allStages } = useAllPipelineStages()
  const { data: pipelines } = usePipelines()
  const { data: profiles } = useOrgProfiles()

  const deals = data?.deals ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize))
  const showPipelineName = (pipelines?.length ?? 0) > 1

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  function handleSort(column: DealSortColumn) {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortDir: prev.sortBy === column && prev.sortDir === "asc" ? "desc" : "asc",
      page: 1,
    }))
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Deals</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isLoading ? "Loading…" : `${total} deal${total === 1 ? "" : "s"}`}
        </p>
      </div>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Pipeline Value" value={formatCurrency(summary?.totalValue ?? 0)} />
        <StatCard label="Average Deal Size" value={formatCurrency(summary?.averageValue ?? 0)} />
        <StatCard
          label="Win Rate"
          value={summary?.winRate === null || summary?.winRate === undefined ? "—" : `${Math.round(summary.winRate)}%`}
        />
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Select
          value={filters.stageId}
          onValueChange={(value) => updateFilter("stageId", value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {allStages?.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {showPipelineName && stage.pipeline ? `${stage.pipeline.name} — ${stage.name}` : stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => updateFilter("status", value as DealStatus | "all")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {DEAL_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.assignedTo}
          onValueChange={(value) => updateFilter("assignedTo", value)}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Assigned To" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {profiles?.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profileDisplayName(profile)}
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

        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min $"
            value={filters.valueMin}
            onChange={(e) => updateFilter("valueMin", e.target.value)}
            className="w-[100px]"
            aria-label="Minimum value"
          />
          <span className="text-sm text-slate-400">–</span>
          <Input
            type="number"
            placeholder="Max $"
            value={filters.valueMax}
            onChange={(e) => updateFilter("valueMax", e.target.value)}
            className="w-[100px]"
            aria-label="Maximum value"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortableHeader label="Title" column="title" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>
                <SortableHeader label="Stage" column="stage" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Value" column="value" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Status" column="status" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Expected Close" column="expected_close_date" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Assigned To" column="assigned_to" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-slate-400">
                  Loading deals…
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-destructive">
                  Failed to load deals: {error instanceof Error ? error.message : "Unknown error"}
                </TableCell>
              </TableRow>
            ) : deals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-slate-400">
                  No deals match your filters.
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => (
                <TableRow
                  key={deal.id}
                  className={cn("cursor-pointer", isFetching && "opacity-60")}
                  onClick={() => navigate(`/deals/${deal.id}`)}
                >
                  <TableCell className="font-medium text-slate-900">{deal.title}</TableCell>
                  <TableCell className="text-slate-600">{dealContactName(deal.contact)}</TableCell>
                  <TableCell className="text-slate-600">{deal.company?.name ?? "—"}</TableCell>
                  <TableCell className="text-slate-600">{deal.stage?.name ?? "—"}</TableCell>
                  <TableCell className="text-slate-600">{formatCurrency(deal.value)}</TableCell>
                  <TableCell>
                    <DealStatusBadge status={deal.status} />
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {formatDate(deal.expected_close_date)}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {profileDisplayName(deal.assigned_profile)}
                  </TableCell>
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
