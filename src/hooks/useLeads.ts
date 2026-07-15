import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { getCurrentOrgId } from "@/hooks/useCurrentOrgId"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { ActivityWithAuthor } from "@/types/activity"
import type {
  CreateLeadInput,
  Lead,
  LeadSource,
  LeadStatus,
  LeadWithAssignee,
  UpdateLeadInput,
} from "@/types/lead"

const LEAD_ASSIGNEE_SELECT =
  "*, assigned_profile:profiles!leads_assigned_to_fkey(id, first_name, last_name, email)"

const ACTIVITY_AUTHOR_SELECT =
  "*, author:profiles!activities_performed_by_fkey(id, first_name, last_name, email)"

export type LeadSortColumn =
  | "first_name"
  | "email"
  | "phone"
  | "company"
  | "source"
  | "status"
  | "score"
  | "created_at"
  | "assigned_to"

export interface LeadFilters {
  status: LeadStatus | "all"
  source: LeadSource | "all"
  search: string
  dateFrom: string
  dateTo: string
  page: number
  pageSize: number
  sortBy: LeadSortColumn
  sortDir: "asc" | "desc"
}

export const DEFAULT_LEAD_FILTERS: LeadFilters = {
  status: "all",
  source: "all",
  search: "",
  dateFrom: "",
  dateTo: "",
  page: 1,
  pageSize: 25,
  sortBy: "created_at",
  sortDir: "desc",
}

export const leadKeys = {
  all: ["leads"] as const,
  lists: () => [...leadKeys.all, "list"] as const,
  list: (filters: LeadFilters) => [...leadKeys.lists(), filters] as const,
  details: () => [...leadKeys.all, "detail"] as const,
  detail: (id: string) => [...leadKeys.details(), id] as const,
}

// A literal comma or parenthesis inside the search term would be parsed by
// PostgREST as an `.or()` filter separator rather than as part of the value.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%]/g, " ").trim()
}

export function useLeads(filters: LeadFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: leadKeys.list(filters),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select(LEAD_ASSIGNEE_SELECT, { count: "exact" })

      if (filters.status !== "all") {
        query = query.eq("status", filters.status)
      }
      if (filters.source !== "all") {
        query = query.eq("source", filters.source)
      }
      if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom)
      }
      if (filters.dateTo) {
        query = query.lte("created_at", `${filters.dateTo}T23:59:59.999`)
      }
      const term = sanitizeSearchTerm(filters.search)
      if (term) {
        const pattern = `%${term}%`
        query = query.or(
          `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},company.ilike.${pattern}`
        )
      }

      if (filters.sortBy === "assigned_to") {
        query = query.order("first_name", {
          ascending: filters.sortDir === "asc",
          foreignTable: "assigned_profile",
          nullsFirst: false,
        })
      } else {
        query = query.order(filters.sortBy, {
          ascending: filters.sortDir === "asc",
          nullsFirst: false,
        })
      }

      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      return {
        leads: (data ?? []) as LeadWithAssignee[],
        total: count ?? 0,
      }
    },
  })
}

export function useLead(id: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: leadKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const [leadResult, activitiesResult] = await Promise.all([
        supabase
          .from("leads")
          .select(LEAD_ASSIGNEE_SELECT)
          .eq("id", id!)
          .single(),
        supabase
          .from("activities")
          .select(ACTIVITY_AUTHOR_SELECT)
          .eq("related_to_type", "lead")
          .eq("related_to_id", id!)
          .order("created_at", { ascending: false }),
      ])

      if (leadResult.error) throw leadResult.error
      if (activitiesResult.error) throw activitiesResult.error

      return {
        lead: leadResult.data as LeadWithAssignee,
        activities: (activitiesResult.data ?? []) as ActivityWithAuthor[],
      }
    },
  })
}

export function useCreateLead() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateLeadInput) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      const { data, error } = await supabase
        .from("leads")
        .insert({ ...input, org_id: orgId })
        .select(LEAD_ASSIGNEE_SELECT)
        .single()
      if (error) throw error

      const lead = data as LeadWithAssignee

      await supabase.from("activities").insert({
        org_id: orgId,
        type: "lead_created",
        description: `Lead created${lead.company ? ` from ${lead.company}` : ""}`,
        related_to_type: "lead",
        related_to_id: lead.id,
      })

      return lead
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
    },
  })
}

export function useUpdateLead() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: UpdateLeadInput
    }) => {
      const { data, error } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", id)
        .select(LEAD_ASSIGNEE_SELECT)
        .single()
      if (error) throw error
      return data as LeadWithAssignee
    },
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(lead.id) })
    },
  })
}

export function useDeleteLead() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id)
      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      queryClient.removeQueries({ queryKey: leadKeys.detail(id) })
    },
  })
}

export function useBulkUpdateLeadStatus() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      ids,
      status,
    }: {
      ids: string[]
      status: LeadStatus
    }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status })
        .in("id", ids)
      if (error) throw error
      return ids
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      for (const id of ids) {
        queryClient.invalidateQueries({ queryKey: leadKeys.detail(id) })
      }
    },
  })
}

export function useBulkDeleteLeads() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("leads").delete().in("id", ids)
      if (error) throw error
      return ids
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      for (const id of ids) {
        queryClient.removeQueries({ queryKey: leadKeys.detail(id) })
      }
    },
  })
}

export function useConvertLead() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (lead: Lead) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      let companyId: string | null = null
      if (lead.company) {
        const { data: existingCompany, error: findError } = await supabase
          .from("companies")
          .select("id")
          .eq("name", lead.company)
          .maybeSingle()
        if (findError) throw findError

        if (existingCompany) {
          companyId = existingCompany.id
        } else {
          const { data: newCompany, error: createError } = await supabase
            .from("companies")
            .insert({ org_id: orgId, name: lead.company })
            .select("id")
            .single()
          if (createError) throw createError
          companyId = newCompany.id
        }
      }

      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          org_id: orgId,
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          phone: lead.phone,
          company_id: companyId,
          notes: lead.notes,
        })
        .select()
        .single()
      if (contactError) throw contactError

      const { data: updatedLead, error: leadError } = await supabase
        .from("leads")
        .update({ status: "converted" satisfies LeadStatus })
        .eq("id", lead.id)
        .select(LEAD_ASSIGNEE_SELECT)
        .single()
      if (leadError) throw leadError

      await supabase.from("activities").insert({
        org_id: orgId,
        type: "contact_created",
        description: `Converted from lead ${[lead.first_name, lead.last_name].filter(Boolean).join(" ")}`.trim(),
        related_to_type: "contact",
        related_to_id: contact.id,
      })

      return { contact, lead: updatedLead as LeadWithAssignee }
    },
    onSuccess: ({ lead }) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(lead.id) })
      queryClient.invalidateQueries({ queryKey: ["contacts"] })
    },
  })
}
