import { useQuery } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { Pipeline, PipelineStage, PipelineStageWithPipeline } from "@/types/pipeline"

export function usePipelines() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("created_at", { ascending: true })
      if (error) throw error
      return data as Pipeline[]
    },
    staleTime: 5 * 60_000,
  })
}

export function usePipelineStages(pipelineId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["pipeline-stages", pipelineId],
    enabled: Boolean(pipelineId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", pipelineId!)
        .order("position", { ascending: true })
      if (error) throw error
      return data as PipelineStage[]
    },
    staleTime: 5 * 60_000,
  })
}

/** Every stage across every pipeline in the org — powers the Deals list page's stage filter. */
export function useAllPipelineStages() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: ["pipeline-stages", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*, pipeline:pipelines!pipeline_stages_pipeline_id_fkey(id, name)")
        .order("position", { ascending: true })
      if (error) throw error
      return data as PipelineStageWithPipeline[]
    },
    staleTime: 5 * 60_000,
  })
}
