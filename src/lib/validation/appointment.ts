import { z } from "zod"

import { APPOINTMENT_TYPES } from "@/types/appointment"

export const appointmentFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    location: z.string().trim().optional().or(z.literal("")),
    type: z.enum(APPOINTMENT_TYPES),
    notes: z.string().trim().optional().or(z.literal("")),
    assigned_to: z.string().optional().or(z.literal("")),
  })
  .refine((data) => new Date(data.end_time).getTime() > new Date(data.start_time).getTime(), {
    message: "End time must be after start time",
    path: ["end_time"],
  })

export type AppointmentFormValues = z.infer<typeof appointmentFormSchema>
