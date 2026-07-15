import { z } from "zod"

// Permissive on purpose — accepts spaces, dashes, parens, and an optional
// leading "+" so real-world formats like "(555) 123-4567" or "+44 20 1234 5678" pass.
const PHONE_REGEX = /^[+]?[\d\s().-]{7,20}$/

export const contactFormSchema = z.object({
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
  company_id: z.string().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  zip: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
})

export type ContactFormValues = z.infer<typeof contactFormSchema>
