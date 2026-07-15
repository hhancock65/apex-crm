import { useUser } from "@clerk/clerk-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { getCurrentOrgId } from "@/hooks/useCurrentOrgId"
import { getCurrentProfile } from "@/hooks/useCurrentProfile"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import { cn, formatDate } from "@/lib/utils"
import type { TaskWithAssignee } from "@/types/task"

export function ContactTasksTab({ contactId }: { contactId: string }) {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()
  const { user } = useUser()
  const [taskTitle, setTaskTitle] = useState("")

  const tasksQuery = useQuery({
    queryKey: ["contact-tasks", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, assigned_profile:profiles!tasks_assigned_to_fkey(id, first_name, last_name, email)")
        .eq("related_to_type", "contact")
        .eq("related_to_id", contactId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as TaskWithAssignee[]
    },
  })

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)
      const profile = await getCurrentProfile(supabase, queryClient, user!.id)

      const { error } = await supabase.from("tasks").insert({
        org_id: orgId,
        title,
        assigned_to: profile.id,
        related_to_type: "contact",
        related_to_id: contactId,
      })
      if (error) throw error

      await supabase.from("activities").insert({
        org_id: orgId,
        type: "task_created",
        description: `Task created: ${title}`,
        performed_by: profile.id,
        related_to_type: "contact",
        related_to_id: contactId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks", contactId] })
      queryClient.invalidateQueries({ queryKey: ["contacts", "detail", contactId] })
    },
  })

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: completed ? "completed" : "pending",
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks", contactId] })
    },
  })

  async function handleAddTask(e: FormEvent) {
    e.preventDefault()
    const title = taskTitle.trim()
    if (!title) return
    try {
      await addTask.mutateAsync(title)
      setTaskTitle("")
    } catch (err) {
      toast.error("Failed to add task", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <div>
      <form onSubmit={handleAddTask} className="flex gap-2">
        <Input
          placeholder="Quick add a task…"
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={addTask.isPending || !taskTitle.trim()}>
          Add
        </Button>
      </form>
      <ul className="mt-4 space-y-2">
        {tasksQuery.data && tasksQuery.data.length > 0 ? (
          tasksQuery.data.map((task) => (
            <li key={task.id} className="flex items-center gap-3 rounded-md bg-slate-50 p-3">
              <Checkbox
                checked={task.status === "completed"}
                onCheckedChange={(checked) =>
                  toggleTask.mutate({ taskId: task.id, completed: checked === true })
                }
              />
              <span
                className={cn(
                  "flex-1 text-sm text-slate-700",
                  task.status === "completed" && "text-slate-400 line-through"
                )}
              >
                {task.title}
              </span>
              {task.due_date && (
                <span className="text-xs text-slate-400">{formatDate(task.due_date)}</span>
              )}
            </li>
          ))
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">No tasks yet.</p>
        )}
      </ul>
    </div>
  )
}
