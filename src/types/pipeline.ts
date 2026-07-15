export interface Pipeline {
  id: string
  org_id: string
  name: string
  is_default: boolean
  created_at: string
}

export interface PipelineStage {
  id: string
  pipeline_id: string
  org_id: string
  name: string
  position: number
  color: string | null
  win_probability: number | null
  created_at: string
}

export interface PipelineStageWithPipeline extends PipelineStage {
  pipeline: { id: string; name: string } | null
}
