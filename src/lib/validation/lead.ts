import { z } from "zod"

import { LEAD_SOURCES } from "@/types/lead"

// Permissive on purpose — accepts spaces, dashes, parens, and an optional
// leading "+" so real-world formats like "(555) 123-4567" or "+44 20 1234 5678" pass.
const PHONE_REGEX = /^[+]?[\d\s().-]{7,20}$/

export const leadFormSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  company: z.string().trim().optional().or(z.literal("")),
  source: z.enum(LEAD_SOURCES),
  notes: z.string().trim().optional().or(z.literal("")),
})

export type LeadFormValues = z.infer<typeof leadFormSchema>
