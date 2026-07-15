import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Plus,
  Search,
  Tag as TagIcon,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AddContactDialog } from "@/components/contacts/AddContactDialog"
import { TagBadge } from "@/components/contacts/TagBadge"
import {
  DEFAULT_CONTACT_FILTERS,
  useBulkAddTagToContacts,
  useBulkDeleteContacts,
  useContactTags,
  useContacts,
  type ContactSortColumn,
} from "@/hooks/useContacts"
import { exportToCsv } from "@/lib/csv"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { contactFullName } from "@/types/contact"

interface SortableHeaderProps {
  label: string
  column: ContactSortColumn
  sortBy: ContactSortColumn
  sortDir: "asc" | "desc"
  onSort: (column: ContactSortColumn) => void
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

export default function ContactsPage() {
  const navigate = useNavigate()

  const [filters, setFilters] = useState(DEFAULT_CONTACT_FILTERS)
  const [searchInput, setSearchInput] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkTagInput, setBulkTagInput] = useState("")

  const { data, isLoading, isFetching, error } = useContacts(filters)
  const { data: allTags } = useContactTags()
  const bulkAddTag = useBulkAddTagToContacts()
  const bulkDelete = useBulkDeleteContacts()

  const contacts = data?.contacts ?? []
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

  function handleSort(column: ContactSortColumn) {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortDir: prev.sortBy === column && prev.sortDir === "asc" ? "desc" : "asc",
      page: 1,
    }))
  }

  function toggleTagFilter(tag: string) {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag]
    updateFilter("tags", next)
  }

  function toggleSelectAll() {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(contacts.map((contact) => contact.id)))
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

  async function handleBulkTag() {
    const tag = bulkTagInput.trim()
    if (!tag) return
    const ids = Array.from(selectedIds)
    try {
      await bulkAddTag.mutateAsync({ ids, tag })
      toast.success(`Tagged ${ids.length} contact${ids.length === 1 ? "" : "s"} with "${tag}"`)
      setBulkTagInput("")
    } catch (err) {
      toast.error("Failed to tag contacts", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    try {
      await bulkDelete.mutateAsync(ids)
      toast.success(`Deleted ${ids.length} contact${ids.length === 1 ? "" : "s"}`)
      setSelectedIds(new Set())
    } catch (err) {
      toast.error("Failed to delete contacts", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBulkDeleteOpen(false)
    }
  }

  function handleExportCsv() {
    const selected = contacts.filter((contact) => selectedIds.has(contact.id))
    const rows = selected.map((contact) => ({
      Name: contactFullName(contact),
      Email: contact.email ?? "",
      Phone: contact.phone ?? "",
      Company: contact.company?.name ?? "",
      "Lifetime Value": contact.lifetime_value,
      Tags: contact.tags.join("; "),
      Created: formatDate(contact.created_at),
    }))
    exportToCsv(`contacts-${new Date().toISOString().slice(0, 10)}.csv`, rows)
    toast.success(`Exported ${rows.length} contact${rows.length === 1 ? "" : "s"}`)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contacts</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLoading ? "Loading…" : `${total} contact${total === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, email, phone, company…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <TagIcon className="h-4 w-4" />
              Tags {filters.tags.length > 0 && `(${filters.tags.length})`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {!allTags || allTags.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-slate-400">No tags yet</div>
            ) : (
              allTags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag}
                  checked={filters.tags.includes(tag)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => toggleTagFilter(tag)}
                >
                  {tag}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

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
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-apex-teal/30 bg-apex-teal/5 px-4 py-2.5">
          <span className="text-sm font-medium text-slate-700">
            {selectedIds.size} selected
          </span>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Add tag…"
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleBulkTag()
                }
              }}
              className="h-8 w-[160px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkTag}
              disabled={!bulkTagInput.trim() || bulkAddTag.isPending}
            >
              <TagIcon className="h-4 w-4" />
              Tag
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>

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
                  checked={contacts.length > 0 && selectedIds.size === contacts.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all contacts on this page"
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
                <SortableHeader label="Lifetime Value" column="lifetime_value" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>
                <SortableHeader label="Created" column="created_at" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-slate-400">
                  Loading contacts…
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-destructive">
                  Failed to load contacts: {error instanceof Error ? error.message : "Unknown error"}
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-slate-400">
                  No contacts match your filters.
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className={cn("cursor-pointer", isFetching && "opacity-60")}
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(contact.id)}
                      onCheckedChange={() => toggleSelectOne(contact.id)}
                      aria-label={`Select ${contactFullName(contact)}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">
                    {contactFullName(contact)}
                  </TableCell>
                  <TableCell className="text-slate-600">{contact.email ?? "—"}</TableCell>
                  <TableCell className="text-slate-600">{contact.phone ?? "—"}</TableCell>
                  <TableCell className="text-slate-600">{contact.company?.name ?? "—"}</TableCell>
                  <TableCell className="text-slate-600">
                    {formatCurrency(contact.lifetime_value)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.length > 0 ? (
                        contact.tags.map((tag) => <TagBadge key={tag} tag={tag} />)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(contact.created_at)}</TableCell>
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

      <AddContactDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} contact{selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. These contacts will be permanently removed.
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
