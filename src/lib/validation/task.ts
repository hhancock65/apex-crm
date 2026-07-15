import { z } from "zod"

import { TASK_PRIORITIES } from "@/types/task"

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  priority: z.enum(TASK_PRIORITIES),
  assigned_to: z.string().optional().or(z.literal("")),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>
