import { Bot } from "lucide-react"

import { AppointmentTypeBadge } from "@/components/productivity/AppointmentTypeBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateTime } from "@/lib/utils"
import type { AppointmentWithRelations } from "@/types/appointment"
import { contactFullName } from "@/types/contact"

interface UpcomingAppointmentsCardProps {
  appointments: AppointmentWithRelations[]
  isLoading: boolean
  onSelect: (appointment: AppointmentWithRelations) => void
}

export function UpcomingAppointmentsCard({
  appointments,
  isLoading,
  onSelect,
}: UpcomingAppointmentsCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">Upcoming Appointments</h2>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No upcoming appointments.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {appointments.map((appointment) => (
              <li key={appointment.id}>
                <button
                  type="button"
                  onClick={() => onSelect(appointment)}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {appointment.created_by_ai && (
                        <Bot className="h-3.5 w-3.5 shrink-0 text-apex-teal" aria-label="Booked by AI" />
                      )}
                      <p className="truncate text-sm font-medium text-slate-800">
                        {appointment.title}
                      </p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {appointment.contact ? contactFullName(appointment.contact) : "No contact"} ·{" "}
                      {formatDateTime(appointment.start_time)}
                    </p>
                  </div>
                  <AppointmentTypeBadge type={appointment.type} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
