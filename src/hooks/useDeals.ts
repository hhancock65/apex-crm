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
  CreateDealInput,
  DealStatus,
  DealWithRelations,
  UpdateDealInput,
} from "@/types/deal"

const DEAL_RELATIONS_SELECT = `
  *,
  stage:pipeline_stages!deals_stage_id_fkey(id, name, color, position, win_probability),
  contact:contacts!deals_contact_id_fkey(id, first_name, last_name, email, phone),
  company:companies!deals_company_id_fkey(id, name),
  assigned_profile:profiles!deals_assigned_to_fkey(id, first_name, last_name, email)
`

const ACTIVITY_AUTHOR_SELECT =
  "*, author:profiles!activities_performed_by_fkey(id, first_name, last_name, email)"

export type DealSortColumn =
  | "title"
  | "value"
  | "expected_close_date"
  | "status"
  | "created_at"
  | "stage"
  | "assigned_to"

export interface DealFilters {
  stageId: string | "all"
  status: DealStatus | "all"
  assignedTo: string | "all"
  dateFrom: string
  dateTo: string
  valueMin: string
  valueMax: string
  page: number
  pageSize: number
  sortBy: DealSortColumn
  sortDir: "asc" | "desc"
}

export const DEFAULT_DEAL_FILTERS: DealFilters = {
  stageId: "all",
  status: "all",
  assignedTo: "all",
  dateFrom: "",
  dateTo: "",
  valueMin: "",
  valueMax: "",
  page: 1,
  pageSize: 25,
  sortBy: "created_at",
  sortDir: "desc",
}

export const dealKeys = {
  all: ["deals"] as const,
  lists: () => [...dealKeys.all, "list"] as const,
  list: (filters: DealFilters) => [...dealKeys.lists(), filters] as const,
  summaries: () => [...dealKeys.all, "summary"] as const,
  summary: (filters: DealFilters) => [...dealKeys.summaries(), filters] as const,
  boards: () => [...dealKeys.all, "board"] as const,
  board: (pipelineId: string) => [...dealKeys.boards(), pipelineId] as const,
  details: () => [...dealKeys.all, "detail"] as const,
  detail: (id: string) => [...dealKeys.details(), id] as const,
}

export function useDeals(filters: DealFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: dealKeys.list(filters),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from("deals").select(DEAL_RELATIONS_SELECT, { count: "exact" })

      if (filters.stageId !== "all") query = query.eq("stage_id", filters.stageId)
      if (filters.status !== "all") query = query.eq("status", filters.status)
      if (filters.assignedTo !== "all") query = query.eq("assigned_to", filters.assignedTo)
      if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom)
      if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59.999`)
      if (filters.valueMin) query = query.gte("value", Number(filters.valueMin))
      if (filters.valueMax) query = query.lte("value", Number(filters.valueMax))

      if (filters.sortBy === "stage") {
        query = query.order("position", {
          ascending: filters.sortDir === "asc",
          foreignTable: "stage",
          nullsFirst: false,
        })
      } else if (filters.sortBy === "assigned_to") {
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
        deals: (data ?? []) as DealWithRelations[],
        total: count ?? 0,
      }
    },
  })
}

/** Aggregate stats over every deal matching the current filters (not just the current page). */
export function useDealsSummary(filters: DealFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: dealKeys.summary(filters),
    queryFn: async () => {
      let query = supabase.from("deals").select("value, status")

      if (filters.stageId !== "all") query = query.eq("stage_id", filters.stageId)
      if (filters.status !== "all") query = query.eq("status", filters.status)
      if (filters.assignedTo !== "all") query = query.eq("assigned_to", filters.assignedTo)
      if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom)
      if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59.999`)
      if (filters.valueMin) query = query.gte("value", Number(filters.valueMin))
      if (filters.valueMax) query = query.lte("value", Number(filters.valueMax))

      const { data, error } = await query
      if (error) throw error

      const rows = (data ?? []) as { value: number; status: DealStatus }[]
      const totalValue = rows.reduce((sum, row) => sum + row.value, 0)
      const closedCount = rows.filter((r) => r.status === "won" || r.status === "lost").length
      const wonCount = rows.filter((r) => r.status === "won").length

      return {
        totalValue,
        averageValue: rows.length > 0 ? totalValue / rows.length : 0,
        winRate: closedCount > 0 ? (wonCount / closedCount) * 100 : null,
        totalCount: rows.length,
      }
    },
  })
}

/** All deals in one pipeline, for the Kanban board — grouped by stage client-side. */
export function useDealsBoard(pipelineId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: dealKeys.board(pipelineId ?? ""),
    enabled: Boolean(pipelineId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(DEAL_RELATIONS_SELECT)
        .eq("pipeline_id", pipelineId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as DealWithRelations[]
    },
  })
}

export function useDeal(id: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: dealKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const [dealResult, activitiesResult] = await Promise.all([
        supabase.from("deals").select(DEAL_RELATIONS_SELECT).eq("id", id!).single(),
        supabase
          .from("activities")
          .select(ACTIVITY_AUTHOR_SELECT)
          .eq("related_to_type", "deal")
          .eq("related_to_id", id!)
          .order("created_at", { ascending: false }),
      ])

      if (dealResult.error) throw dealResult.error
      if (activitiesResult.error) throw activitiesResult.error

      return {
        deal: dealResult.data as DealWithRelations,
        activities: (activitiesResult.data ?? []) as ActivityWithAuthor[],
      }
    },
  })
}

export function useCreateDeal() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateDealInput) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      const { data, error } = await supabase
        .from("deals")
        .insert({ ...input, org_id: orgId })
        .select(DEAL_RELATIONS_SELECT)
        .single()
      if (error) throw error

      const deal = data as DealWithRelations

      await supabase.from("activities").insert({
        org_id: orgId,
        type: "deal_created",
        description: `Deal created: ${deal.title}`,
        related_to_type: "deal",
        related_to_id: deal.id,
      })

      return deal
    },
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: dealKeys.lists() })
      queryClient.invalidateQueries({ queryKey: dealKeys.summaries() })
      queryClient.invalidateQueries({ queryKey: dealKeys.board(deal.pipeline_id) })
    },
  })
}

export function useUpdateDeal() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateDealInput }) => {
      const { data, error } = await supabase
        .from("deals")
        .update(updates)
        .eq("id", id)
        .select(DEAL_RELATIONS_SELECT)
        .single()
      if (error) throw error
      return data as DealWithRelations
    },
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: dealKeys.lists() })
      queryClient.invalidateQueries({ queryKey: dealKeys.summaries() })
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(deal.id) })
      queryClient.invalidateQueries({ queryKey: dealKeys.board(deal.pipeline_id) })
    },
  })
}

/**
 * Drag-and-drop stage moves — optimistically patches every cached Kanban
 * board so the card jumps instantly, persists to Supabase, and rolls back
 * if the write fails. Only stage_id changes here; deal.status is untouched
 * (won/lost are explicit actions, not implied by dropping into a "Closed"
 * column).
 */
export function useMoveDeal() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ dealId, newStageId }: { dealId: string; newStageId: string }) => {
      const { data, error } = await supabase
        .from("deals")
        .update({ stage_id: newStageId })
        .eq("id", dealId)
        .select(DEAL_RELATIONS_SELECT)
        .single()
      if (error) throw error
      return data as DealWithRelations
    },
    onMutate: async ({ dealId, newStageId }) => {
      await queryClient.cancelQueries({ queryKey: dealKeys.boards() })

      const previousBoards = queryClient.getQueriesData<DealWithRelations[]>({
        queryKey: dealKeys.boards(),
      })

      for (const [key, data] of previousBoards) {
        if (!data) continue
        queryClient.setQueryData<DealWithRelations[]>(
          key,
          data.map((deal) => (deal.id === dealId ? { ...deal, stage_id: newStageId } : deal))
        )
      }

      return { previousBoards }
    },
    onError: (_err, _vars, context) => {
      context?.previousBoards.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: (deal) => {
      queryClient.invalidateQueries({ queryKey: dealKeys.boards() })
      queryClient.invalidateQueries({ queryKey: dealKeys.lists() })
      if (deal) {
        queryClient.invalidateQueries({ queryKey: dealKeys.detail(deal.id) })
      }
    },
  })
}

export function useMarkDealWon() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      const { data, error } = await supabase
        .from("deals")
        .update({
          status: "won" satisfies DealStatus,
          won_at: new Date().toISOString(),
          lost_at: null,
          lost_reason: null,
        })
        .eq("id", id)
        .select(DEAL_RELATIONS_SELECT)
        .single()
      if (error) throw error

      const deal = data as DealWithRelations

      await supabase.from("activities").insert({
        org_id: orgId,
        type: "deal_won",
        description: `Deal won: ${deal.title}`,
        related_to_type: "deal",
        related_to_id: deal.id,
      })

      return deal
    },
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: dealKeys.lists() })
      queryClient.invalidateQueries({ queryKey: dealKeys.summaries() })
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(deal.id) })
      queryClient.invalidateQueries({ queryKey: dealKeys.board(deal.pipeline_id) })
    },
  })
}

export function useMarkDealLost() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, lostReason }: { id: string; lostReason: string }) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      const { data, error } = await supabase
        .from("deals")
        .update({
          status: "lost" satisfies DealStatus,
          lost_at: new Date().toISOString(),
          won_at: null,
          lost_reason: lostReason.trim(),
        })
        .eq("id", id)
        .select(DEAL_RELATIONS_SELECT)
        .single()
      if (error) throw error

      const deal = data as DealWithRelations

      await supabase.from("activities").insert({
        org_id: orgId,
        type: "deal_lost",
        description: `Deal lost: ${deal.title}${lostReason.trim() ? ` — ${lostReason.trim()}` : ""}`,
        related_to_type: "deal",
        related_to_id: deal.id,
      })

      return deal
    },
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: dealKeys.lists() })
      queryClient.invalidateQueries({ queryKey: dealKeys.summaries() })
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(deal.id) })
      queryClient.invalidateQueries({ queryKey: dealKeys.board(deal.pipeline_id) })
    },
  })
}
