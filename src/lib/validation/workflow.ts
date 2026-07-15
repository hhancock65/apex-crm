import { z } from "zod"

import { WORKFLOW_TRIGGER_TYPES } from "@/types/workflow"

export const workflowFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional().or(z.literal("")),
  trigger_type: z.enum(WORKFLOW_TRIGGER_TYPES),
})

export type WorkflowFormValues = z.infer<typeof workflowFormSchema>
