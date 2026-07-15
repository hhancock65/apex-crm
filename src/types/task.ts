import type { RelatedEntityType } from "@/types/activity"
import type { ProfileSummary } from "@/types/profile"

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export interface Task {
  id: string
  org_id: string
  title: string
  description: string | null
  assigned_to: string | null
  related_to_type: RelatedEntityType | null
  related_to_id: string | null
  due_date: string | null
  priority: TaskPriority
  status: TaskStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskWithAssignee extends Task {
  assigned_profile: ProfileSummary | null
}

/** TaskWithAssignee plus a resolved display label for the polymorphic related_to_type/id pair. */
export interface TaskWithRelated extends TaskWithAssignee {
  related_label: string | null
}

export type CreateTaskInput = Pick<
  Task,
  | "title"
  | "description"
  | "assigned_to"
  | "related_to_type"
  | "related_to_id"
  | "due_date"
  | "priority"
>

export type UpdateTaskInput = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "assigned_to"
    | "related_to_type"
    | "related_to_id"
    | "due_date"
    | "priority"
    | "status"
    | "completed_at"
  >
>

export function isTaskOverdue(task: Pick<Task, "due_date" | "status">): boolean {
  if (!task.due_date) return false
  if (task.status === "completed" || task.status === "cancelled") return false
  return new Date(task.due_date).getTime() < Date.now()
}
