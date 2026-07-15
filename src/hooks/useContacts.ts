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
  Contact,
  ContactWithCompany,
  CreateContactInput,
  UpdateContactInput,
} from "@/types/contact"
import type { DealWithStage } from "@/types/deal"

const CONTACT_COMPANY_SELECT =
  "*, company:companies!contacts_company_id_fkey(id, name)"

const DEAL_STAGE_SELECT =
  "*, stage:pipeline_stages!deals_stage_id_fkey(id, name, color)"

const ACTIVITY_AUTHOR_SELECT =
  "*, author:profiles!activities_performed_by_fkey(id, first_name, last_name, email)"

export type ContactSortColumn =
  | "first_name"
  | "email"
  | "phone"
  | "company"
  | "lifetime_value"
  | "created_at"

export interface ContactFilters {
  tags: string[]
  search: string
  dateFrom: string
  dateTo: string
  page: number
  pageSize: number
  sortBy: ContactSortColumn
  sortDir: "asc" | "desc"
}

export const DEFAULT_CONTACT_FILTERS: ContactFilters = {
  tags: [],
  search: "",
  dateFrom: "",
  dateTo: "",
  page: 1,
  pageSize: 25,
  sortBy: "created_at",
  sortDir: "desc",
}

export const contactKeys = {
  all: ["contacts"] as const,
  lists: () => [...contactKeys.all, "list"] as const,
  list: (filters: ContactFilters) => [...contactKeys.lists(), filters] as const,
  details: () => [...contactKeys.all, "detail"] as const,
  detail: (id: string) => [...contactKeys.details(), id] as const,
}

// A literal comma or parenthesis inside the search term would be parsed by
// PostgREST as an `.or()` filter separator rather than as part of the value.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%]/g, " ").trim()
}

export function useContacts(filters: ContactFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: contactKeys.list(filters),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select(CONTACT_COMPANY_SELECT, { count: "exact" })

      if (filters.tags.length > 0) {
        query = query.overlaps("tags", filters.tags)
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
        let orClause = `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`

        // Company name lives on a related table, so it can't join the local
        // ilike .or() directly — resolve matching company ids first and fold
        // them in as an extra `company_id.in.(...)` clause.
        const { data: matchingCompanies } = await supabase
          .from("companies")
          .select("id")
          .ilike("name", pattern)

        if (matchingCompanies && matchingCompanies.length > 0) {
          orClause += `,company_id.in.(${matchingCompanies.map((c) => c.id).join(",")})`
        }

        query = query.or(orClause)
      }

      if (filters.sortBy === "company") {
        query = query.order("name", {
          ascending: filters.sortDir === "asc",
          foreignTable: "company",
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
        contacts: (data ?? []) as ContactWithCompany[],
        total: count ?? 0,
      }
    },
  })
}

export function useContact(id: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: contactKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const [contactResult, activitiesResult] = await Promise.all([
        supabase
          .from("contacts")
          .select(CONTACT_COMPANY_SELECT)
          .eq("id", id!)
          .single(),
        supabase
          .from("activities")
          .select(ACTIVITY_AUTHOR_SELECT)
          .eq("related_to_type", "contact")
          .eq("related_to_id", id!)
          .order("created_at", { ascending: false }),
      ])

      if (contactResult.error) throw contactResult.error
      if (activitiesResult.error) throw activitiesResult.error

      return {
        contact: contactResult.data as ContactWithCompany,
        activities: (activitiesResult.data ?? []) as ActivityWithAuthor[],
      }
    },
  })
}

export function useCreateContact() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateContactInput) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      const { data, error } = await supabase
        .from("contacts")
        .insert({ ...input, org_id: orgId })
        .select(CONTACT_COMPANY_SELECT)
        .single()
      if (error) throw error

      const contact = data as ContactWithCompany

      await supabase.from("activities").insert({
        org_id: orgId,
        type: "contact_created",
        description: `Contact created${contact.company ? ` at ${contact.company.name}` : ""}`,
        related_to_type: "contact",
        related_to_id: contact.id,
      })

      return contact
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() })
    },
  })
}

export function useUpdateContact() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: UpdateContactInput
    }) => {
      const { data, error } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", id)
        .select(CONTACT_COMPANY_SELECT)
        .single()
      if (error) throw error
      return data as ContactWithCompany
    },
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() })
      queryClient.invalidateQueries({ queryKey: contactKeys.detail(contact.id) })
    },
  })
}

export function useDeleteContact() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id)
      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() })
      queryClient.removeQueries({ queryKey: contactKeys.detail(id) })
    },
  })
}

export function useBulkDeleteContacts() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("contacts").delete().in("id", ids)
      if (error) throw error
      return ids
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() })
      for (const id of ids) {
        queryClient.removeQueries({ queryKey: contactKeys.detail(id) })
      }
    },
  })
}

export function useBulkAddTagToContacts() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ids, tag }: { ids: string[]; tag: string }) => {
      const normalizedTag = tag.trim()
      if (!normalizedTag) return ids

      const { data: existing, error: fetchError } = await supabase
        .from("contacts")
        .select("id, tags")
        .in("id", ids)
      if (fetchError) throw fetchError

      await Promise.all(
        (existing ?? []).map((row: Pick<Contact, "id" | "tags">) => {
          const tags = row.tags.includes(normalizedTag)
            ? row.tags
            : [...row.tags, normalizedTag]
          return supabase.from("contacts").update({ tags }).eq("id", row.id)
        })
      )

      return ids
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() })
      for (const id of ids) {
        queryClient.invalidateQueries({ queryKey: contactKeys.detail(id) })
      }
    },
  })
}

/** Distinct tags already in use across the org's contacts — powers tag filters and autocomplete. */
export function useContactTags() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["contacts", "tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("tags")
      if (error) throw error

      const unique = new Set<string>()
      for (const row of data ?? []) {
        for (const tag of row.tags ?? []) {
          unique.add(tag)
        }
      }
      return Array.from(unique).sort((a, b) => a.localeCompare(b))
    },
    staleTime: 60_000,
  })
}

/** Shared between the Deals tab and the detail page's stats sidebar — same queryKey, so both read one cached fetch. */
export function useContactDeals(contactId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["contact-deals", contactId],
    enabled: Boolean(contactId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(DEAL_STAGE_SELECT)
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as DealWithStage[]
    },
  })
}
