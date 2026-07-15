import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { getCurrentOrgId } from "@/hooks/useCurrentOrgId"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import { contactFullName } from "@/types/contact"
import { leadFullName } from "@/types/lead"
import type {
  CreateTaskInput,
  TaskPriority,
  TaskStatus,
  TaskWithAssignee,
  TaskWithRelated,
  UpdateTaskInput,
} from "@/types/task"

const TASK_ASSIGNEE_SELECT =
  "*, assigned_profile:profiles!tasks_assigned_to_fkey(id, first_name, last_name, email)"

export type TaskSortColumn = "due_date" | "priority" | "created_at"

export interface TaskFilters {
  status: TaskStatus | "all"
  priority: TaskPriority | "all"
  assignedTo: string | "all"
  dueFrom: string
  dueTo: string
  page: number
  pageSize: number
  sortBy: TaskSortColumn
  sortDir: "asc" | "desc"
}

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  status: "all",
  priority: "all",
  assignedTo: "all",
  dueFrom: "",
  dueTo: "",
  page: 1,
  pageSize: 25,
  sortBy: "due_date",
  sortDir: "asc",
}

export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (filters: TaskFilters) => [...taskKeys.lists(), filters] as const,
}

/**
 * related_to_type/related_to_id is polymorphic, so there's no single join
 * that resolves a display label — instead, after fetching a page of tasks,
 * we batch the referenced ids by type (at most 3 extra queries regardless
 * of page size) and stitch labels back in.
 */
async function resolveRelatedLabels(
  supabase: ReturnType<typeof useSupabaseClient>,
  tasks: TaskWithAssignee[]
): Promise<TaskWithRelated[]> {
  const leadIds = tasks.filter((t) => t.related_to_type === "lead").map((t) => t.related_to_id!)
  const contactIds = tasks
    .filter((t) => t.related_to_type === "contact")
    .map((t) => t.related_to_id!)
  const dealIds = tasks.filter((t) => t.related_to_type === "deal").map((t) => t.related_to_id!)

  const labelMap = new Map<string, string>()

  if (leadIds.length > 0) {
    const { data } = await supabase.from("leads").select("id, first_name, last_name").in("id", leadIds)
    data?.forEach((lead) => labelMap.set(`lead:${lead.id}`, leadFullName(lead)))
  }
  if (contactIds.length > 0) {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .in("id", contactIds)
    data?.forEach((contact) => labelMap.set(`contact:${contact.id}`, contactFullName(contact)))
  }
  if (dealIds.length > 0) {
    const { data } = await supabase.from("deals").select("id, title").in("id", dealIds)
    data?.forEach((deal) => labelMap.set(`deal:${deal.id}`, deal.title))
  }

  return tasks.map((task) => ({
    ...task,
    related_label:
      task.related_to_type && task.related_to_id
        ? (labelMap.get(`${task.related_to_type}:${task.related_to_id}`) ?? null)
        : null,
  }))
}

export function useTasks(filters: TaskFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: taskKeys.list(filters),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from("tasks").select(TASK_ASSIGNEE_SELECT, { count: "exact" })

      if (filters.status !== "all") query = query.eq("status", filters.status)
      if (filters.priority !== "all") query = query.eq("priority", filters.priority)
      if (filters.assignedTo !== "all") query = query.eq("assigned_to", filters.assignedTo)
      if (filters.dueFrom) query = query.gte("due_date", filters.dueFrom)
      if (filters.dueTo) query = query.lte("due_date", `${filters.dueTo}T23:59:59.999`)

      // Native Postgres enum ordering matches severity (low < medium < high <
      // urgent) since that's the order the type was declared in — no CASE needed.
      query = query.order(filters.sortBy, {
        ascending: filters.sortDir === "asc",
        nullsFirst: false,
      })

      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      const tasks = await resolveRelatedLabels(supabase, (data ?? []) as TaskWithAssignee[])

      return { tasks, total: count ?? 0 }
    },
  })
}

export function useCreateTask() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...input, org_id: orgId })
        .select(TASK_ASSIGNEE_SELECT)
        .single()
      if (error) throw error

      const task = data as TaskWithAssignee

      if (task.related_to_type && task.related_to_id) {
        await supabase.from("activities").insert({
          org_id: orgId,
          type: "task_created",
          description: `Task created: ${task.title}`,
          related_to_type: task.related_to_type,
          related_to_id: task.related_to_id,
        })
      }

      return task
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}

export function useUpdateTask() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateTaskInput }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .select(TASK_ASSIGNEE_SELECT)
        .single()
      if (error) throw error
      return data as TaskWithAssignee
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}

export function useMarkTaskComplete() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      const { data, error } = await supabase
        .from("tasks")
        .update({
          status: (completed ? "completed" : "pending") satisfies TaskStatus,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", id)
        .select(TASK_ASSIGNEE_SELECT)
        .single()
      if (error) throw error

      const task = data as TaskWithAssignee

      if (completed && task.related_to_type && task.related_to_id) {
        await supabase.from("activities").insert({
          org_id: orgId,
          type: "task_completed",
          description: `Task completed: ${task.title}`,
          related_to_type: task.related_to_type,
          related_to_id: task.related_to_id,
        })
      }

      return task
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}

export function useDeleteTask() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}
