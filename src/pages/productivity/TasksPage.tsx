import { ArrowDown, ArrowUp, Plus } from "lucide-react"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"

import { AddTaskDialog } from "@/components/productivity/AddTaskDialog"
import { TaskDetailDialog } from "@/components/productivity/TaskDetailDialog"
import { TaskPriorityBadge } from "@/components/productivity/TaskPriorityBadge"
import { TaskStatusBadge } from "@/components/productivity/TaskStatusBadge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCurrentProfile } from "@/hooks/useCurrentProfile"
import { useOrgProfiles } from "@/hooks/useOrgProfiles"
import {
  DEFAULT_TASK_FILTERS,
  useCreateTask,
  useMarkTaskComplete,
  useTasks,
  type TaskSortColumn,
} from "@/hooks/useTasks"
import { cn, formatDate } from "@/lib/utils"
import { profileDisplayName } from "@/types/profile"
import {
  isTaskOverdue,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
  type TaskWithRelated,
} from "@/types/task"

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

const SORT_LABELS: Record<TaskSortColumn, string> = {
  due_date: "Due Date",
  priority: "Priority",
  created_at: "Created Date",
}

export default function TasksPage() {
  const [filters, setFilters] = useState(DEFAULT_TASK_FILTERS)
  const [quickTitle, setQuickTitle] = useState("")
  const [quickDueDate, setQuickDueDate] = useState("")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [activeTask, setActiveTask] = useState<TaskWithRelated | null>(null)

  const { data, isLoading, isFetching, error } = useTasks(filters)
  const { data: profiles } = useOrgProfiles()
  const { data: currentProfile } = useCurrentProfile()
  const markComplete = useMarkTaskComplete()
  const createTask = useCreateTask()

  const tasks = data?.tasks ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize))

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  function toggleSortDir() {
    setFilters((prev) => ({ ...prev, sortDir: prev.sortDir === "asc" ? "desc" : "asc" }))
  }

  async function handleQuickAdd(e: FormEvent) {
    e.preventDefault()
    const title = quickTitle.trim()
    if (!title) return
    try {
      await createTask.mutateAsync({
        title,
        description: null,
        due_date: quickDueDate || null,
        priority: "medium",
        assigned_to: currentProfile?.id ?? null,
        related_to_type: null,
        related_to_id: null,
      })
      setQuickTitle("")
      setQuickDueDate("")
      toast.success("Task added")
    } catch (err) {
      toast.error("Failed to add task", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function handleToggleComplete(task: TaskWithRelated, completed: boolean) {
    try {
      await markComplete.mutateAsync({ id: task.id, completed })
    } catch (err) {
      toast.error("Failed to update task", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tasks</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLoading ? "Loading…" : `${total} task${total === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Quick add */}
      <form onSubmit={handleQuickAdd} className="mt-6 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <Input
          placeholder="Quick add a task…"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          className="min-w-[220px] flex-1"
        />
        <Input
          type="date"
          value={quickDueDate}
          onChange={(e) => setQuickDueDate(e.target.value)}
          className="w-[160px]"
          aria-label="Due date"
        />
        <Button type="submit" disabled={createTask.isPending || !quickTitle.trim()}>
          Add
        </Button>
      </form>

      {/* Filter bar */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Select value={filters.status} onValueChange={(v) => updateFilter("status", v as TaskStatus | "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {TASK_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.priority} onValueChange={(v) => updateFilter("priority", v as TaskPriority | "all")}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {TASK_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.assignedTo} onValueChange={(v) => updateFilter("assignedTo", v)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Assigned To" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {profiles?.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profileDisplayName(profile)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={filters.dueFrom}
            onChange={(e) => updateFilter("dueFrom", e.target.value)}
            className="w-[150px]"
            aria-label="Due from"
          />
          <span className="text-sm text-slate-400">to</span>
          <Input
            type="date"
            value={filters.dueTo}
            onChange={(e) => updateFilter("dueTo", e.target.value)}
            className="w-[150px]"
            aria-label="Due to"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Select value={filters.sortBy} onValueChange={(v) => updateFilter("sortBy", v as TaskSortColumn)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as TaskSortColumn[]).map((column) => (
                <SelectItem key={column} value={column}>
                  Sort: {SORT_LABELS[column]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={toggleSortDir} aria-label="Toggle sort direction">
            {filters.sortDir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className={cn("mt-4 space-y-2", isFetching && "opacity-60")}>
        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading tasks…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">
            Failed to load tasks: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        ) : tasks.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No tasks match your filters.</p>
        ) : (
          tasks.map((task) => {
            const overdue = isTaskOverdue(task)
            return (
              <div
                key={task.id}
                onClick={() => setActiveTask(task)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 hover:border-slate-300",
                  overdue ? "border-red-200 bg-red-50/50" : "border-slate-200"
                )}
              >
                <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                  <Checkbox
                    checked={task.status === "completed"}
                    onCheckedChange={(checked) => handleToggleComplete(task, checked === true)}
                    aria-label={`Mark ${task.title} complete`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cn(
                        "text-sm font-medium text-slate-800",
                        task.status === "completed" && "text-slate-400 line-through"
                      )}
                    >
                      {task.title}
                    </p>
                    <TaskPriorityBadge priority={task.priority} />
                    <TaskStatusBadge status={task.status} />
                    {overdue && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-red-600">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className={cn(overdue && "font-medium text-red-600")}>
                      Due {formatDate(task.due_date)}
                    </span>
                    <span>{profileDisplayName(task.assigned_profile)}</span>
                    {task.related_label && (
                      <span className="text-apex-teal">
                        {task.related_to_type}: {task.related_label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination
            page={filters.page}
            pageCount={pageCount}
            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
          />
        </div>
      )}

      <AddTaskDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <TaskDetailDialog
        task={activeTask}
        open={Boolean(activeTask)}
        onOpenChange={(open) => !open && setActiveTask(null)}
      />
    </div>
  )
}
