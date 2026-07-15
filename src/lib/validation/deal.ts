import { z } from "zod"

export const dealFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  stage_id: z.string().min(1, "Stage is required"),
  contact_id: z.string().optional().or(z.literal("")),
  company_id: z.string().optional().or(z.literal("")),
  expected_close_date: z.string().optional().or(z.literal("")),
  assigned_to: z.string().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
})

export type DealFormValues = z.infer<typeof dealFormSchema>

// value/probability are validated outside this schema (see AddDealDialog /
// DealDetailPage) since they're plain numeric text inputs, not react-hook-form
// registered fields — same pattern used for `score` on leads and
// `lifetime_value` on contacts.
export function parseDealValue(raw: string): { value: number; error?: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: 0 }
  const parsed = Number(trimmed)
  if (Number.isNaN(parsed) || parsed < 0) {
    return { value: 0, error: "Value must be a non-negative number" }
  }
  return { value: parsed }
}

export function parseDealProbability(raw: string): { value: number | null; error?: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: null }
  const parsed = Number(trimmed)
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    return { value: null, error: "Probability must be between 0 and 100" }
  }
  return { value: parsed }
}
