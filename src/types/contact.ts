import type { CompanySummary } from "@/types/company"

/** Minimal contact shape for pickers/comboboxes shared across modules (deals, appointments, tasks). */
export interface ContactSummary {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
}

export interface Contact {
  id: string
  org_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  company_id: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  tags: string[]
  notes: string | null
  lifetime_value: number
  created_at: string
  updated_at: string
}

export interface ContactWithCompany extends Contact {
  company: CompanySummary | null
}

export type CreateContactInput = Pick<
  Contact,
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "company_id"
  | "address"
  | "city"
  | "state"
  | "zip"
  | "tags"
  | "notes"
>

export type UpdateContactInput = Partial<CreateContactInput> &
  Partial<Pick<Contact, "lifetime_value">>

export function contactFullName(
  contact: Pick<Contact, "first_name" | "last_name">
): string {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "(No name)"
}
