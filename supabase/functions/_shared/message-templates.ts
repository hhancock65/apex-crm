export type TemplateVariable =
  | "contact_name"
  | "appointment_date"
  | "appointment_time"
  | "business_name"
  | "ai_employee_name"

const TEMPLATE_VARIABLE_PATTERN =
  /\{(contact_name|appointment_date|appointment_time|business_name|ai_employee_name)\}/g

/**
 * Replaces {var} tokens with the given values. A recognized token with no
 * value supplied renders as an empty string — a real customer-facing
 * message should never ship literal "{appointment_date}" text just because
 * a call had no appointment. Unrecognized token names (typos, or a
 * template's stray "{" that isn't a real variable) are left untouched.
 */
export function renderTemplate(content: string, vars: Partial<Record<TemplateVariable, string>>): string {
  return content.replace(TEMPLATE_VARIABLE_PATTERN, (_match, key: TemplateVariable) => vars[key] ?? "")
}

export interface EmailTemplate {
  subject: string
  body: string
}

/**
 * Only `sms_templates` is a real table (migration 0009) — no `email_templates`
 * table was part of the spec. Email reuses the exact same 4 template names
 * and the same renderTemplate() engine above; these are just hardcoded
 * subject/body pairs instead of DB rows, since email additionally needs a
 * subject line sms_templates has no column for. If templates ever need to be
 * org-editable for email too, promote this to a table the same shape as
 * sms_templates plus a `subject` column.
 */
export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  appointment_confirmation: {
    subject: "Your appointment with {business_name} is confirmed",
    body:
      "Hi {contact_name},\n\nThis is {ai_employee_name} from {business_name}. Your appointment is " +
      "confirmed for {appointment_date} at {appointment_time}.\n\nSee you then!\n{ai_employee_name}",
  },
  follow_up_24h: {
    subject: "Following up from {business_name}",
    body:
      "Hi {contact_name},\n\nThis is {ai_employee_name} from {business_name}, following up on our " +
      "conversation. Let us know if you have any questions!\n\n{ai_employee_name}",
  },
  thank_you: {
    subject: "Thank you for calling {business_name}",
    body:
      "Hi {contact_name},\n\nThank you for calling {business_name} today! We're excited to help you. " +
      "Reach out anytime with questions.\n\n{ai_employee_name}",
  },
  missed_call_recovery: {
    subject: "Sorry we missed you — {business_name}",
    body:
      "Hi {contact_name},\n\nWe're sorry we missed your call to {business_name}! Reply to this email or " +
      "call us back and {ai_employee_name} will help you right away.\n\n{ai_employee_name}",
  },
}
