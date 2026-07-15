import { Bot, MapPin, Plus } from "lucide-react"
import { useState } from "react"

import { AddAppointmentDialog } from "@/components/productivity/AddAppointmentDialog"
import { AppointmentDetailDialog } from "@/components/productivity/AppointmentDetailDialog"
import { AppointmentStatusBadge } from "@/components/productivity/AppointmentStatusBadge"
import { AppointmentTypeBadge } from "@/components/productivity/AppointmentTypeBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getDefaultAppointmentFilters, useAppointments } from "@/hooks/useAppointments"
import { cn, formatDateTime } from "@/lib/utils"
import { contactFullName } from "@/types/contact"
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  type AppointmentStatus,
  type AppointmentType,
  type AppointmentWithRelations,
} from "@/types/appointment"

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
}

const TYPE_LABELS: Record<AppointmentType, string> = {
  call: "Call",
  meeting: "Meeting",
  demo: "Demo",
  service: "Service",
  follow_up: "Follow-up",
  other: "Other",
}

export default function AppointmentsPage() {
  const [filters, setFilters] = useState(getDefaultAppointmentFilters)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [activeAppointment, setActiveAppointment] = useState<AppointmentWithRelations | null>(null)

  const { data, isLoading, isFetching, error } = useAppointments(filters)

  const appointments = data?.appointments ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize))

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Appointments</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLoading ? "Loading…" : `${total} appointment${total === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Appointment
        </Button>
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Select value={filters.type} onValueChange={(v) => updateFilter("type", v as AppointmentType | "all")}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {APPOINTMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={(v) => updateFilter("status", v as AppointmentStatus | "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {APPOINTMENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
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

      {/* List */}
      <div className={cn("mt-4 space-y-2", isFetching && "opacity-60")}>
        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading appointments…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">
            Failed to load appointments: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        ) : appointments.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            No appointments match your filters.
          </p>
        ) : (
          appointments.map((appointment) => (
            <div
              key={appointment.id}
              onClick={() => setActiveAppointment(appointment)}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {appointment.created_by_ai && (
                      <Bot className="h-3.5 w-3.5 shrink-0 text-apex-teal" aria-label="Created by AI" />
                    )}
                    <p className="truncate text-sm font-medium text-slate-800">
                      {appointment.title}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {appointment.contact ? contactFullName(appointment.contact) : "No contact"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <AppointmentTypeBadge type={appointment.type} />
                  <AppointmentStatusBadge status={appointment.status} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{formatDateTime(appointment.start_time)}</span>
                {appointment.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {appointment.location}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
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

      <AddAppointmentDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <AppointmentDetailDialog
        appointment={activeAppointment}
        open={Boolean(activeAppointment)}
        onOpenChange={(open) => !open && setActiveAppointment(null)}
      />
    </div>
  )
}
