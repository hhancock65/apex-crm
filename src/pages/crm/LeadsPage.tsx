import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { AddLeadDialog } from "@/components/leads/AddLeadDialog"
import { LeadSourceBadge } from "@/components/leads/LeadSourceBadge"
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge"
import {
  DEFAULT_LEAD_FILTERS,
  useBulkDeleteLeads,
  useBulkUpdateLeadStatus,
  useLeads,
  type LeadSortColumn,
} from "@/hooks/useLeads"
import { cn, formatDate } from "@/lib/utils"
import { profileDisplayName } from "@/types/profile"
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  leadFullName,
  type LeadSource,
  type LeadStatus,
} from "@/types/lead"

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  phone: "Phone",
  referral: "Referral",
  ai_employee: "AI Employee",
  campaign: "Campaign",
  manual: "Manual",
  other: "Other",
}

interface SortableHeaderProps {
  label: string
  column: LeadSortColumn
  sortBy: LeadSortColumn
  sortDir: "asc" | "desc"
  onSort: (column: LeadSortColumn) => void
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

export default function LeadsPage() {
  const navigate = useNavigate()

  const [filters, setFilters] = useState(DEFAULT_LEAD_FILTERS)
  const [searchInput, setSearchInput] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const { data, isLoading, isFetching, error } = useLeads(filters)
  const bulkUpdateStatus = useBulkUpdateLeadStatus()
  const bulkDelete = useBulkDeleteLeads()

  const leads = data?.leads ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize))

  // Debounce free-text search so we don't re-query on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }))
    }, 300)
    return () => clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [filters])

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  function handleSort(column: LeadSortColumn) {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortDir: prev.sortBy === column && prev.sortDir === "asc" ? "desc" : "asc",
      page: 1,
    }))
  }

  function toggleSelectAll() {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(leads.map((lead) => lead.id)))
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkStatusChange(status: LeadStatus) {
    const ids = Array.from(selectedIds)
    try {
      await bulkUpdateStatus.mutateAsync({ ids, status })
      toast.success(`Updated ${ids.length} lead${ids.length === 1 ? "" : "s"} to ${STATUS_LABELS[status]}`)
      setSelectedIds(new Set())
    } catch (err) {
      toast.error("Failed to update leads", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    try {
      await bulkDelete.mutateAsync(ids)
      toast.success(`Deleted ${ids.length} lead${ids.length === 1 ? "" : "s"}`)
      setSelectedIds(new Set())
    } catch (err) {
      toast.error("Failed to delete leads", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBulkDeleteOpen(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLoading ? "Loading…" : `${total} lead${total === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, email, company…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(value) => updateFilter("status", value as LeadStatus | "all")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {LEAD_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.source}
          onValueChange={(value) => updateFilter("source", value as LeadSource | "all")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {LEAD_SOURCES.map((source) => (
              <SelectItem key={source} value={source}>
                {SOURCE_LABELS[source]}
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

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-apex-teal/30 bg-apex-teal/5 px-4 py-2.5">
          <span className="text-sm font-medium text-slate-700">
            {selectedIds.size} selected
          </span>
          <Select onValueChange={(value) => handleBulkStatusChange(value as LeadStatus)}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue placeholder="Update status…" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={leads.length > 0 && selectedIds.size === leads.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all leads on this page"
                />
              </TableHead>
              <TableHead>
                <SortableHeader label="Name" column="first_name" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Email" column="email" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Phone" column="phone" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Company" column="company" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Source" column="source" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Status" column="status" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Score" column="score" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Assigned To" column="assigned_to" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Created" column="created_at" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-sm text-slate-400">
                  Loading leads…
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-sm text-destructive">
                  Failed to load leads: {error instanceof Error ? error.message : "Unknown error"}
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-sm text-slate-400">
                  No leads match your filters.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className={cn("cursor-pointer", isFetching && "opacity-60")}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={() => toggleSelectOne(lead.id)}
                      aria-label={`Select ${leadFullName(lead)}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">
                    {leadFullName(lead)}
                  </TableCell>
                  <TableCell className="text-slate-600">{lead.email ?? "—"}</TableCell>
                  <TableCell className="text-slate-600">{lead.phone ?? "—"}</TableCell>
                  <TableCell className="text-slate-600">{lead.company ?? "—"}</TableCell>
                  <TableCell>
                    <LeadSourceBadge source={lead.source} />
                  </TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="text-slate-600">{lead.score ?? "—"}</TableCell>
                  <TableCell className="text-slate-600">
                    {profileDisplayName(lead.assigned_profile)}
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(lead.created_at)}</TableCell>
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

      <AddLeadDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} lead{selectedIds.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. These leads will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
