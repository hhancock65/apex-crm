import { useQuery } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import { buildDealAttributions, type ContactPhoneEmail } from "@/lib/deal-attribution"
import type { LeadSource } from "@/types/lead"

export interface AttributionChainLink {
  dealId: string
  dealTitle: string
  dealValue: number
  wonAt: string
  contactName: string
  leadId: string | null
  leadCreatedAt: string | null
  aiEmployeeId: string | null
  aiEmployeeName: string | null
  /** Which signal attributed this deal — surfaced so the UI never implies
   *  more certainty than the data actually supports (see deal-attribution.ts). */
  attributionMethod: "opportunity_created" | "lead_match"
}

export interface RevenueAttribution {
  /** All-time — the "lifetime" headline number. */
  totalClosedRevenueAllTime: number
  totalClosedDealsAllTime: number
  /** Current open AI-attributed pipeline — a snapshot, not date-windowed. */
  currentPipelineValue: number
  currentPipelineDealCount: number
  /** Won AI-attributed deals in the current calendar month — the figure
   *  the ROI calculator compares against a single month's Apex cost, so
   *  the comparison is apples-to-apples rather than lifetime-revenue vs.
   *  one month of cost. */
  closedRevenueThisMonth: number
  topAttributedDeals: AttributionChainLink[]
}

function isSameMonth(iso: string, reference: Date): boolean {
  const d = new Date(iso)
  return d.getFullYear() === reference.getFullYear() && d.getMonth() === reference.getMonth()
}

export function useRevenueAttribution() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["revenue-attribution"],
    queryFn: async (): Promise<RevenueAttribution> => {
      const [dealsResult, contactsResult, leadsResult, actionsResult, aiEmployeesResult] = await Promise.all([
        supabase.from("deals").select("id, contact_id, title, value, status, won_at, created_at").in("status", ["open", "won"]),
        supabase.from("contacts").select("id, phone, email, first_name, last_name"),
        supabase.from("leads").select("id, phone, email, source, created_at").eq("source", "ai_employee"),
        supabase.from("ai_employee_actions").select("ai_employee_id, related_to_id").eq("action_type", "opportunity_created"),
        supabase.from("ai_employees").select("id, name"),
      ])
      for (const result of [dealsResult, contactsResult, leadsResult, actionsResult, aiEmployeesResult]) {
        if (result.error) throw result.error
      }

      const deals = (dealsResult.data ?? []) as {
        id: string
        contact_id: string | null
        title: string
        value: number
        status: "open" | "won"
        won_at: string | null
        created_at: string
      }[]
      const contacts = (contactsResult.data ?? []) as (ContactPhoneEmail & { first_name: string | null; last_name: string | null })[]
      const contactsById = new Map(contacts.map((c) => [c.id, c]))
      const leads = (leadsResult.data ?? []) as { id: string; phone: string | null; email: string | null; source: LeadSource; created_at: string }[]
      const leadsById = new Map(leads.map((l) => [l.id, l]))
      const opportunityActions = (actionsResult.data ?? []) as { ai_employee_id: string; related_to_id: string }[]
      const aiEmployees = (aiEmployeesResult.data ?? []) as { id: string; name: string }[]
      const aiEmployeeById = new Map(aiEmployees.map((e) => [e.id, e]))

      const attributions = buildDealAttributions(deals, contactsById, leads, opportunityActions)

      const wonDeals = deals.filter((d) => d.status === "won")
      const openDeals = deals.filter((d) => d.status === "open")
      const aiWonDeals = wonDeals.filter((d) => attributions.get(d.id)?.isAiAttributed)
      const aiOpenDeals = openDeals.filter((d) => attributions.get(d.id)?.isAiAttributed)

      const now = new Date()
      const closedRevenueThisMonth = aiWonDeals
        .filter((d) => d.won_at && isSameMonth(d.won_at, now))
        .reduce((sum, d) => sum + d.value, 0)

      const topAttributedDeals: AttributionChainLink[] = aiWonDeals
        .slice()
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
        .map((deal) => {
          const attribution = attributions.get(deal.id)!
          const contact = deal.contact_id ? contactsById.get(deal.contact_id) : undefined
          const lead = attribution.matchedLeadId ? leadsById.get(attribution.matchedLeadId) : undefined
          const aiEmployee = attribution.aiEmployeeId ? aiEmployeeById.get(attribution.aiEmployeeId) : undefined
          return {
            dealId: deal.id,
            dealTitle: deal.title,
            dealValue: deal.value,
            wonAt: deal.won_at!,
            contactName: contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown contact" : "Unknown contact",
            leadId: lead?.id ?? null,
            leadCreatedAt: lead?.created_at ?? null,
            aiEmployeeId: attribution.aiEmployeeId,
            aiEmployeeName: aiEmployee?.name ?? null,
            attributionMethod: attribution.aiEmployeeId ? "opportunity_created" : "lead_match",
          }
        })

      return {
        totalClosedRevenueAllTime: aiWonDeals.reduce((sum, d) => sum + d.value, 0),
        totalClosedDealsAllTime: aiWonDeals.length,
        currentPipelineValue: aiOpenDeals.reduce((sum, d) => sum + d.value, 0),
        currentPipelineDealCount: aiOpenDeals.length,
        closedRevenueThisMonth,
        topAttributedDeals,
      }
    },
    staleTime: 60_000,
  })
}
