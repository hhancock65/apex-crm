import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getCurrentOrgId } from "@/hooks/useCurrentOrgId"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { CreateWorkflowInput, UpdateWorkflowInput, Workflow, WorkflowStatus } from "@/types/workflow"

export interface WorkflowFilters {
  status: WorkflowStatus | "all"
  page: number
  pageSize: number
}

export function getDefaultWorkflowFilters(): WorkflowFilters {
  return { status: "all", page: 1, pageSize: 25 }
}

export const workflowKeys = {
  all: ["workflows"] as const,
  lists: () => [...workflowKeys.all, "list"] as const,
  list: (filters: WorkflowFilters) => [...workflowKeys.lists(), filters] as const,
  details: () => [...workflowKeys.all, "detail"] as const,
  detail: (id: string) => [...workflowKeys.details(), id] as const,
}

export function useWorkflows(filters: WorkflowFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: workflowKeys.list(filters),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from("workflows").select("*", { count: "exact" })

      if (filters.status !== "all") query = query.eq("status", filters.status)

      query = query.order("created_at", { ascending: false })

      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      return {
        workflows: (data ?? []) as Workflow[],
        total: count ?? 0,
      }
    },
  })
}

export function useWorkflow(id: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: workflowKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("workflows").select("*").eq("id", id!).single()
      if (error) throw error
      return data as Workflow
    },
  })
}

export function useCreateWorkflow() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateWorkflowInput) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      const { data, error } = await supabase
        .from("workflows")
        .insert({
          ...input,
          org_id: orgId,
          steps: input.steps ?? [],
          trigger_config: input.trigger_config ?? {},
          status: "draft",
        })
        .select("*")
        .single()
      if (error) throw error
      return data as Workflow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() })
    },
  })
}

export function useUpdateWorkflow() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateWorkflowInput }) => {
      const { data, error } = await supabase.from("workflows").update(updates).eq("id", id).select("*").single()
      if (error) throw error
      return data as Workflow
    },
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() })
      queryClient.invalidateQueries({ queryKey: workflowKeys.detail(workflow.id) })
    },
  })
}

export function useDeleteWorkflow() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workflows").delete().eq("id", id)
      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() })
      queryClient.removeQueries({ queryKey: workflowKeys.detail(id) })
    },
  })
}
