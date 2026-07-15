import { Bot, Mail, Phone } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { AppointmentStatusBadge } from "@/components/productivity/AppointmentStatusBadge"
import { AppointmentTypeBadge } from "@/components/productivity/AppointmentTypeBadge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUpdateAppointment } from "@/hooks/useAppointments"
import { formatDateTime } from "@/lib/utils"
import { APPOINTMENT_STATUSES, type AppointmentStatus, type AppointmentWithRelations } from "@/types/appointment"
import { profileDisplayName } from "@/types/profile"

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
}

interface AppointmentDetailDialogProps {
  appointment: AppointmentWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
}: AppointmentDetailDialogProps) {
  const updateAppointment = useUpdateAppointment()

  if (!appointment) return null

  async function handleStatusChange(status: AppointmentStatus) {
    try {
      await updateAppointment.mutateAsync({ id: appointment!.id, updates: { status } })
      toast.success("Appointment updated")
    } catch (err) {
      toast.error("Failed to update appointment", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {appointment.created_by_ai && <Bot className="h-4 w-4 text-apex-teal" />}
            {appointment.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <AppointmentTypeBadge type={appointment.type} />
            <AppointmentStatusBadge status={appointment.status} />
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">When</div>
            <div className="mt-0.5 text-slate-800">
              {formatDateTime(appointment.start_time)} – {formatDateTime(appointment.end_time)}
            </div>
          </div>

          {appointment.location && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Location
              </div>
              <div className="mt-0.5 text-slate-800">{appointment.location}</div>
            </div>
          )}

          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Assigned To
            </div>
            <div className="mt-0.5 text-slate-800">
              {profileDisplayName(appointment.assigned_profile)}
            </div>
          </div>

          {appointment.contact && (
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-800">
                {[appointment.contact.first_name, appointment.contact.last_name]
                  .filter(Boolean)
                  .join(" ")}
              </p>
              {appointment.contact.email && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <Mail className="h-3 w-3" />
                  {appointment.contact.email}
                </p>
              )}
              {appointment.contact.phone && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <Phone className="h-3 w-3" />
                  {appointment.contact.phone}
                </p>
              )}
              <Link
                to={`/contacts/${appointment.contact.id}`}
                className="mt-1.5 inline-block text-xs font-medium text-apex-teal hover:underline"
              >
                View Contact →
              </Link>
            </div>
          )}

          {appointment.notes && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Notes
              </div>
              <p className="mt-0.5 text-slate-600">{appointment.notes}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={appointment.status} onValueChange={(v) => handleStatusChange(v as AppointmentStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
