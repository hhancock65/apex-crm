import type { ContactSummary } from "@/types/contact"
import type { ProfileSummary } from "@/types/profile"

export const APPOINTMENT_TYPES = [
  "call",
  "meeting",
  "demo",
  "service",
  "follow_up",
  "other",
] as const
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number]

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export interface Appointment {
  id: string
  org_id: string
  title: string
  contact_id: string | null
  assigned_to: string | null
  start_time: string
  end_time: string
  location: string | null
  type: AppointmentType
  status: AppointmentStatus
  notes: string | null
  created_by_ai: boolean
  ai_employee_id: string | null
  created_at: string
  updated_at: string
}

export interface AppointmentWithRelations extends Appointment {
  contact: ContactSummary | null
  assigned_profile: ProfileSummary | null
}

export type CreateAppointmentInput = Pick<
  Appointment,
  | "title"
  | "contact_id"
  | "assigned_to"
  | "start_time"
  | "end_time"
  | "location"
  | "type"
  | "status"
  | "notes"
>

export type UpdateAppointmentInput = Partial<CreateAppointmentInput>
