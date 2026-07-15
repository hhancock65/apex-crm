import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { ContactCombobox } from "@/components/shared/ContactCombobox"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCreateAppointment } from "@/hooks/useAppointments"
import { useOrgProfiles } from "@/hooks/useOrgProfiles"
import { appointmentFormSchema, type AppointmentFormValues } from "@/lib/validation/appointment"
import { toDateTimeInputValue } from "@/lib/utils"
import { profileDisplayName } from "@/types/profile"
import type { ContactSummary } from "@/types/contact"
import { APPOINTMENT_TYPES, type AppointmentType } from "@/types/appointment"

interface AddAppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDate?: Date
}

const TYPE_LABELS: Record<AppointmentType, string> = {
  call: "Call",
  meeting: "Meeting",
  demo: "Demo",
  service: "Service",
  follow_up: "Follow-up",
  other: "Other",
}

function defaultTimes(defaultDate?: Date) {
  const base = defaultDate ? new Date(defaultDate) : new Date()
  base.setMinutes(0, 0, 0)
  base.setHours(base.getHours() + 1)
  const end = new Date(base)
  end.setHours(end.getHours() + 1)
  return {
    start_time: toDateTimeInputValue(base),
    end_time: toDateTimeInputValue(end),
  }
}

export function AddAppointmentDialog({
  open,
  onOpenChange,
  defaultDate,
}: AddAppointmentDialogProps) {
  const createAppointment = useCreateAppointment()
  const { data: profiles } = useOrgProfiles()
  const [contact, setContact] = useState<ContactSummary | null>(null)

  const defaultValues: AppointmentFormValues = {
    title: "",
    ...defaultTimes(defaultDate),
    location: "",
    type: "meeting",
    notes: "",
    assigned_to: "",
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues,
  })

  useEffect(() => {
    if (open) {
      reset({ ...defaultValues, ...defaultTimes(defaultDate) })
      setContact(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate])

  const type = watch("type")
  const assignedTo = watch("assigned_to")

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createAppointment.mutateAsync({
        title: values.title.trim(),
        contact_id: contact?.id ?? null,
        assigned_to: values.assigned_to || null,
        start_time: new Date(values.start_time).toISOString(),
        end_time: new Date(values.end_time).toISOString(),
        location: values.location?.trim() || null,
        type: values.type,
        status: "scheduled",
        notes: values.notes?.trim() || null,
      })
      toast.success("Appointment created")
      handleOpenChange(false)
    } catch (error) {
      toast.error("Failed to create appointment", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Appointment</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Contact</Label>
            <ContactCombobox value={contact} onChange={setContact} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start_time">Start</Label>
              <Input id="start_time" type="datetime-local" {...register("start_time")} />
              {errors.start_time && (
                <p className="text-xs text-destructive">{errors.start_time.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_time">End</Label>
              <Input id="end_time" type="datetime-local" {...register("end_time")} />
              {errors.end_time && (
                <p className="text-xs text-destructive">{errors.end_time.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(v) => setValue("type", v as AppointmentType)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="Zoom, office, phone…" {...register("location")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assigned_to">Assigned To</Label>
            <Select
              value={assignedTo || "unassigned"}
              onValueChange={(v) => setValue("assigned_to", v === "unassigned" ? "" : v)}
            >
              <SelectTrigger id="assigned_to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {profiles?.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profileDisplayName(profile)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Appointment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
