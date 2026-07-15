import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { getCurrentOrgId } from "@/hooks/useCurrentOrgId"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import { invokeWithRetry } from "@/lib/edge-functions"
import { toDateInputValue } from "@/lib/utils"
import type {
  AiEmployee,
  AiEmployeeTodayStats,
  CreateAiEmployeeInput,
  UpdateAiEmployeeInput,
} from "@/types/ai-employee"
import type { AiEmployeeAction } from "@/types/ai-action"
import type { CallWithContact } from "@/types/call"

const CALL_CONTACT_SELECT =
  "*, contact:contacts!calls_contact_id_fkey(id, first_name, last_name, email, phone)"

export const aiEmployeeKeys = {
  all: ["ai-employees"] as const,
  lists: () => [...aiEmployeeKeys.all, "list"] as const,
  details: () => [...aiEmployeeKeys.all, "detail"] as const,
  detail: (id: string) => [...aiEmployeeKeys.details(), id] as const,
}

function todayRange() {
  const start = toDateInputValue(new Date())
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { start, end: toDateInputValue(tomorrow) }
}

function countBy<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const value = row[key]
    if (typeof value !== "string") continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

export interface AiEmployeeWithTodayStats extends AiEmployee {
  todayStats: AiEmployeeTodayStats
}

/**
 * All employees plus today's per-employee calls/appointments/leads, computed
 * from 3 lean grouped-by-id queries (not one query per card) — leads have no
 * ai_employee_id column on the leads table itself, so "leads today" comes
 * from the ai_employee_actions log instead.
 */
export interface UseAiEmployeesOptions {
  refetchInterval?: number
}

export function useAiEmployees(options: UseAiEmployeesOptions = {}) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: aiEmployeeKeys.lists(),
    refetchInterval: options.refetchInterval,
    queryFn: async (): Promise<AiEmployeeWithTodayStats[]> => {
      const { start, end } = todayRange()

      const [employeesResult, callsResult, appointmentsResult, leadActionsResult] =
        await Promise.all([
          supabase.from("ai_employees").select("*").order("created_at", { ascending: true }),
          supabase
            .from("calls")
            .select("ai_employee_id")
            .gte("started_at", start)
            .lt("started_at", end),
          supabase
            .from("appointments")
            .select("ai_employee_id")
            .not("ai_employee_id", "is", null)
            .gte("created_at", start)
            .lt("created_at", end),
          supabase
            .from("ai_employee_actions")
            .select("ai_employee_id")
            .eq("action_type", "lead_created")
            .gte("created_at", start)
            .lt("created_at", end),
        ])

      for (const result of [employeesResult, callsResult, appointmentsResult, leadActionsResult]) {
        if (result.error) throw result.error
      }

      const callCounts = countBy(
        (callsResult.data ?? []) as { ai_employee_id: string }[],
        "ai_employee_id"
      )
      const appointmentCounts = countBy(
        (appointmentsResult.data ?? []) as { ai_employee_id: string }[],
        "ai_employee_id"
      )
      const leadCounts = countBy(
        (leadActionsResult.data ?? []) as { ai_employee_id: string }[],
        "ai_employee_id"
      )

      return ((employeesResult.data ?? []) as AiEmployee[]).map((employee) => ({
        ...employee,
        todayStats: {
          calls: callCounts.get(employee.id) ?? 0,
          appointments: appointmentCounts.get(employee.id) ?? 0,
          leads: leadCounts.get(employee.id) ?? 0,
        },
      }))
    },
    staleTime: 30_000,
  })
}

export function useAiEmployee(id: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: aiEmployeeKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_employees")
        .select("*")
        .eq("id", id!)
        .single()
      if (error) throw error
      return data as AiEmployee
    },
  })
}

/** Single-employee scoped today's stats, for the detail page's stats row (all-time comes straight off the row's total_* counters). */
export function useAiEmployeeTodayStats(employeeId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["ai-employees", "today-stats", employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<AiEmployeeTodayStats> => {
      const { start, end } = todayRange()

      const [callsResult, appointmentsResult, leadsResult] = await Promise.all([
        supabase
          .from("calls")
          .select("id", { count: "exact", head: true })
          .eq("ai_employee_id", employeeId!)
          .gte("started_at", start)
          .lt("started_at", end),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("ai_employee_id", employeeId!)
          .gte("created_at", start)
          .lt("created_at", end),
        supabase
          .from("ai_employee_actions")
          .select("id", { count: "exact", head: true })
          .eq("ai_employee_id", employeeId!)
          .eq("action_type", "lead_created")
          .gte("created_at", start)
          .lt("created_at", end),
      ])

      for (const result of [callsResult, appointmentsResult, leadsResult]) {
        if (result.error) throw result.error
      }

      return {
        calls: callsResult.count ?? 0,
        appointments: appointmentsResult.count ?? 0,
        leads: leadsResult.count ?? 0,
      }
    },
  })
}

export function useCreateAiEmployee() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateAiEmployeeInput) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      const { data, error } = await supabase
        .from("ai_employees")
        .insert({ ...input, org_id: orgId, status: "offline" })
        .select()
        .single()
      if (error) throw error
      return data as AiEmployee
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiEmployeeKeys.lists() })
    },
  })
}

export function useUpdateAiEmployee() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateAiEmployeeInput }) => {
      const { data, error } = await supabase
        .from("ai_employees")
        .update(updates)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as AiEmployee
    },
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: aiEmployeeKeys.lists() })
      queryClient.invalidateQueries({ queryKey: aiEmployeeKeys.detail(employee.id) })
    },
  })
}

export interface RetellSyncResult {
  success: true
  agent_id: string
  llm_id: string
  created?: boolean
}

/**
 * Provisions the Retell agent for a newly-created AI Employee. Called by
 * CreateAIEmployeeDialog right after useCreateAiEmployee succeeds — kept as
 * a separate step (rather than folded into useCreateAiEmployee) so the
 * calling component can tell the user "employee saved" from "Retell sync
 * failed" as two distinct outcomes, since the Apex record is valid either way.
 */
export function useCreateRetellAgent() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (aiEmployeeId: string) =>
      invokeWithRetry<RetellSyncResult>(supabase, "create-retell-agent", {
        ai_employee_id: aiEmployeeId,
      }),
    onSuccess: (_result, aiEmployeeId) => {
      queryClient.invalidateQueries({ queryKey: aiEmployeeKeys.detail(aiEmployeeId) })
    },
  })
}

/** Pushes an AI Employee's current configuration to its Retell agent. Called by AiEmployeeConfigTab after useUpdateAiEmployee succeeds. */
export function useUpdateRetellAgent() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (aiEmployeeId: string) =>
      invokeWithRetry<RetellSyncResult>(supabase, "update-retell-agent", {
        ai_employee_id: aiEmployeeId,
      }),
    onSuccess: (_result, aiEmployeeId) => {
      queryClient.invalidateQueries({ queryKey: aiEmployeeKeys.detail(aiEmployeeId) })
    },
  })
}

export interface PagedListFilters {
  page: number
  pageSize: number
}

export function useAiEmployeeCalls(
  employeeId: string | undefined,
  filters: PagedListFilters
) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["ai-employees", "calls", employeeId, filters],
    enabled: Boolean(employeeId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1

      const { data, error, count } = await supabase
        .from("calls")
        .select(CALL_CONTACT_SELECT, { count: "exact" })
        .eq("ai_employee_id", employeeId!)
        .order("started_at", { ascending: false })
        .range(from, to)
      if (error) throw error

      return { calls: (data ?? []) as CallWithContact[], total: count ?? 0 }
    },
  })
}

export function useAiEmployeeActions(
  employeeId: string | undefined,
  filters: PagedListFilters
) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["ai-employees", "actions", employeeId, filters],
    enabled: Boolean(employeeId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1

      const { data, error, count } = await supabase
        .from("ai_employee_actions")
        .select("*", { count: "exact" })
        .eq("ai_employee_id", employeeId!)
        .order("created_at", { ascending: false })
        .range(from, to)
      if (error) throw error

      return { actions: (data ?? []) as AiEmployeeAction[], total: count ?? 0 }
    },
  })
}
