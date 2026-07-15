import { useQuery } from "@tanstack/react-query"
import { Bot } from "lucide-react"

import { AppointmentStatusBadge } from "@/components/productivity/AppointmentStatusBadge"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import { formatDateTime } from "@/lib/utils"
import type { Appointment } from "@/types/appointment"

function AppointmentItem({ appointment }: { appointment: Appointment }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {appointment.created_by_ai && <Bot className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
          <p className="truncate text-sm font-medium text-slate-800">{appointment.title}</p>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {formatDateTime(appointment.start_time)}
          {appointment.location && ` · ${appointment.location}`}
        </p>
      </div>
      <AppointmentStatusBadge status={appointment.status} />
    </li>
  )
}

export function ContactAppointmentsTab({ contactId }: { contactId: string }) {
  const supabase = useSupabaseClient()

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["contact-appointments", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("contact_id", contactId)
        .order("start_time", { ascending: false })
      if (error) throw error
      return data as Appointment[]
    },
  })

  if (isLoading) {
    return <p className="py-6 text-center text-sm text-slate-400">Loading appointments…</p>
  }

  if (!appointments || appointments.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No appointments yet.</p>
  }

  const now = Date.now()
  const upcoming = appointments
    .filter((a) => new Date(a.start_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  const past = appointments.filter((a) => new Date(a.start_time).getTime() < now)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Upcoming</h3>
        {upcoming.length > 0 ? (
          <ul className="mt-1 divide-y divide-slate-100">
            {upcoming.map((a) => (
              <AppointmentItem key={a.id} appointment={a} />
            ))}
          </ul>
        ) : (
          <p className="py-3 text-sm text-slate-400">No upcoming appointments.</p>
        )}
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Past</h3>
        {past.length > 0 ? (
          <ul className="mt-1 divide-y divide-slate-100">
            {past.map((a) => (
              <AppointmentItem key={a.id} appointment={a} />
            ))}
          </ul>
        ) : (
          <p className="py-3 text-sm text-slate-400">No past appointments.</p>
        )}
      </div>
    </div>
  )
}
