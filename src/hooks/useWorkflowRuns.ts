import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { ScheduledTask, WorkflowRun, WorkflowRunStep } from "@/types/workflow"

export const workflowRunKeys = {
  all: ["workflow-runs"] as const,
  list: (workflowId: string) => [...workflowRunKeys.all, workflowId] as const,
  detail: (runId: string) => [...workflowRunKeys.all, "detail", runId] as const,
  steps: (runId: string) => [...workflowRunKeys.all, "steps", runId] as const,
  scheduledTask: (runId: string) => [...workflowRunKeys.all, "scheduled-task", runId] as const,
}

export function useWorkflowRuns(workflowId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: workflowRunKeys.list(workflowId ?? ""),
    enabled: Boolean(workflowId),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_runs")
        .select("*")
        .eq("workflow_id", workflowId!)
        .order("started_at", { ascending: false })
        .limit(50)
      if (error) throw error
      return data as WorkflowRun[]
    },
  })
}

export function useWorkflowRun(runId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: workflowRunKeys.detail(runId ?? ""),
    enabled: Boolean(runId),
    queryFn: async () => {
      const { data, error } = await supabase.from("workflow_runs").select("*").eq("id", runId!).single()
      if (error) throw error
      return data as WorkflowRun
    },
  })
}

export function useWorkflowRunSteps(runId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: workflowRunKeys.steps(runId ?? ""),
    enabled: Boolean(runId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_run_steps")
        .select("*")
        .eq("workflow_run_id", runId!)
        .order("started_at", { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as WorkflowRunStep[]
    },
  })
}

/** The pending scheduled_tasks row for a 'waiting' run, if any — purely for
 *  showing "resumes at HH:MM" in the UI. A run only ever has at most one
 *  pending scheduled_tasks row at a time (a new wait step's row is only
 *  ever inserted after the previous one has already been claimed/consumed
 *  by the resumer). */
export function useWorkflowRunScheduledTask(runId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: workflowRunKeys.scheduledTask(runId ?? ""),
    enabled: Boolean(runId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_tasks")
        .select("*")
        .eq("workflow_run_id", runId!)
        .eq("status", "pending")
        .maybeSingle()
      if (error) throw error
      return data as ScheduledTask | null
    },
  })
}

/** Live-updates the run detail page as workflow-executor progresses through
 *  steps — mirrors useCampaignContacts' realtime hook (0013). */
export function useWorkflowRunRealtime(runId: string | undefined) {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!runId) return

    const channel = supabase
      .channel(`workflow-run-${runId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "workflow_runs", filter: `id=eq.${runId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: workflowRunKeys.detail(runId) })
          queryClient.invalidateQueries({ queryKey: workflowRunKeys.scheduledTask(runId) })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workflow_run_steps", filter: `workflow_run_id=eq.${runId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: workflowRunKeys.steps(runId) })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, runId])
}

export function useCancelWorkflowRun() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase
        .from("workflow_runs")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", runId)
        .in("status", ["running", "waiting"])
        .select("id")
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error("This run already finished and can't be cancelled.")
      }

      // Stop any pending wait from ever resuming it.
      const { error: taskError } = await supabase
        .from("scheduled_tasks")
        .update({ status: "cancelled" })
        .eq("workflow_run_id", runId)
        .eq("status", "pending")
      if (taskError) throw taskError

      return runId
    },
    onSuccess: (runId) => {
      queryClient.invalidateQueries({ queryKey: workflowRunKeys.detail(runId) })
      queryClient.invalidateQueries({ queryKey: workflowRunKeys.scheduledTask(runId) })
      queryClient.invalidateQueries({ queryKey: workflowRunKeys.steps(runId) })
    },
  })
}
