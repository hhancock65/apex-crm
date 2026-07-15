import type { LeadSource } from "@/types/lead"

// Best-effort deal<->lead correlation — shared by SalesAnalyticsPage ("top
// sources" revenue split, all lead sources) and RevenueAttributionPage
// (AI-specific attribution, the whole point of that page). There is no
// direct lead -> deal foreign key anywhere in this schema (deals link to
// contacts, not leads), so both features match a deal's contact to a lead
// by phone/email — approximate, not a hard link: two different people
// could in principle share a phone/email, or a contact could have both an
// AI-sourced and a human-sourced lead on file. This is the same
// "best-effort, not a hard link" reasoning already used in
// retell-call-webhook's triggerQualifiedLeadThankYouSms.
//
// RevenueAttributionPage's AI attribution additionally has a second,
// UNAMBIGUOUS signal on top of the phone/email match: an ai_employee_actions
// row with action_type='opportunity_created' pointing directly at the deal
// (see retell-function-handler's handleCreateOpportunity) — an AI
// Employee's own live-call tool created that exact deal. A deal counts as
// AI-attributed if EITHER signal fires; both are surfaced separately (not
// silently merged) so the UI can show which kind of evidence applied.

export interface ContactPhoneEmail {
  id: string
  phone: string | null
  email: string | null
}

interface LeadLike {
  id: string
  phone: string | null
  email: string | null
  source: LeadSource
}

export interface OpportunityCreatedAction {
  ai_employee_id: string
  related_to_id: string
}

export interface DealAttribution {
  dealId: string
  isAiAttributed: boolean
  /** Set only via the hard link — the AI Employee that directly created this deal. */
  aiEmployeeId: string | null
  /** Set only via the best-effort phone/email match against an ai_employee-sourced lead. */
  matchedLeadId: string | null
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "")
}

function buildLeadIndex<T extends LeadLike>(leads: T[]): { byPhone: Map<string, T>; byEmail: Map<string, T> } {
  const byPhone = new Map<string, T>()
  const byEmail = new Map<string, T>()
  for (const lead of leads) {
    if (lead.phone) byPhone.set(normalizePhone(lead.phone), lead)
    if (lead.email) byEmail.set(lead.email.toLowerCase(), lead)
  }
  return { byPhone, byEmail }
}

function matchContactToLead<T extends LeadLike>(
  contact: ContactPhoneEmail | undefined,
  index: { byPhone: Map<string, T>; byEmail: Map<string, T> }
): T | undefined {
  if (!contact) return undefined
  if (contact.phone) {
    const match = index.byPhone.get(normalizePhone(contact.phone))
    if (match) return match
  }
  if (contact.email) {
    return index.byEmail.get(contact.email.toLowerCase())
  }
  return undefined
}

export function buildDealAttributions(
  deals: { id: string; contact_id: string | null }[],
  contactsById: Map<string, ContactPhoneEmail>,
  aiSourcedLeads: LeadLike[],
  opportunityCreatedActions: OpportunityCreatedAction[]
): Map<string, DealAttribution> {
  const hardLinkByDealId = new Map(opportunityCreatedActions.map((a) => [a.related_to_id, a.ai_employee_id]))
  const leadIndex = buildLeadIndex(aiSourcedLeads)

  const result = new Map<string, DealAttribution>()
  for (const deal of deals) {
    const aiEmployeeId = hardLinkByDealId.get(deal.id) ?? null
    const matchedLead = matchContactToLead(deal.contact_id ? contactsById.get(deal.contact_id) : undefined, leadIndex)

    result.set(deal.id, {
      dealId: deal.id,
      isAiAttributed: Boolean(aiEmployeeId) || Boolean(matchedLead),
      aiEmployeeId,
      matchedLeadId: matchedLead?.id ?? null,
    })
  }
  return result
}

/** General version for "which lead source produced this revenue" — matches
 *  against ALL leads (any source), not just AI-sourced ones. Deals with no
 *  matched lead return `null` (bucketed as "Direct" by the caller). */
export function matchDealsToLeadSource(
  deals: { id: string; contact_id: string | null }[],
  contactsById: Map<string, ContactPhoneEmail>,
  allLeads: LeadLike[]
): Map<string, LeadSource | null> {
  const leadIndex = buildLeadIndex(allLeads)
  const result = new Map<string, LeadSource | null>()
  for (const deal of deals) {
    const matchedLead = matchContactToLead(deal.contact_id ? contactsById.get(deal.contact_id) : undefined, leadIndex)
    result.set(deal.id, matchedLead?.source ?? null)
  }
  return result
}
