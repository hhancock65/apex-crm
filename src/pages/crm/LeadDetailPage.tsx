import { useUser } from "@clerk/clerk-react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { ArrowLeft, Pencil, Trash2, UserCheck } from "lucide-react"
import { type FormEvent, type ReactNode, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { ActivityTimeline } from "@/components/activities/ActivityTimeline"
import { LeadSourceBadge } from "@/components/leads/LeadSourceBadge"
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PermissionGate } from "@/components/permissions/PermissionGate"
import { getCurrentOrgId } from "@/hooks/useCurrentOrgId"
import { getCurrentProfile } from "@/hooks/useCurrentProfile"
import {
  useConvertLead,
  useDeleteLead,
  useLead,
  useUpdateLead,
} from "@/hooks/useLeads"
import { useOrgProfiles } from "@/hooks/useOrgProfiles"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import { leadFormSchema } from "@/lib/validation/lead"
import { cn, formatDate, formatDateTime } from "@/lib/utils"
import type { NoteWithAuthor } from "@/types/note"
import { profileDisplayName } from "@/types/profile"
import type { TaskWithAssignee } from "@/types/task"
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  leadFullName,
  type LeadSource,
  type LeadStatus,
} from "@/types/lead"

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  phone: "Phone",
  referral: "Referral",
  ai_employee: "AI Employee",
  campaign: "Campaign",
  manual: "Manual",
  other: "Other",
}

interface EditForm {
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
  source: LeadSource
  status: LeadStatus
  assigned_to: string | null
  score: string
  notes: string
}

function InfoField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  )
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()
  const { user } = useUser()

  const { data, isLoading, error } = useLead(id)
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()
  const convertLead = useConvertLead()
  const { data: orgProfiles } = useOrgProfiles()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<EditForm | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [taskTitle, setTaskTitle] = useState("")

  const notesQuery = useQuery({
    queryKey: ["lead-notes", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*, author:profiles!notes_created_by_fkey(id, first_name, last_name, email)")
        .eq("related_to_type", "lead")
        .eq("related_to_id", id!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as NoteWithAuthor[]
    },
  })

  const tasksQuery = useQuery({
    queryKey: ["lead-tasks", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, assigned_profile:profiles!tasks_assigned_to_fkey(id, first_name, last_name, email)")
        .eq("related_to_type", "lead")
        .eq("related_to_id", id!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as TaskWithAssignee[]
    },
  })

  const addNote = useMutation({
    mutationFn: async (content: string) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)
      const profile = await getCurrentProfile(supabase, queryClient, user!.id)

      const { error } = await supabase.from("notes").insert({
        org_id: orgId,
        content,
        created_by: profile.id,
        related_to_type: "lead",
        related_to_id: id!,
      })
      if (error) throw error

      await supabase.from("activities").insert({
        org_id: orgId,
        type: "note",
        description: content.slice(0, 140),
        performed_by: profile.id,
        related_to_type: "lead",
        related_to_id: id!,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-notes", id] })
      queryClient.invalidateQueries({ queryKey: ["leads", "detail", id] })
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
        related_to_type: "lead",
        related_to_id: id!,
      })
      if (error) throw error

      await supabase.from("activities").insert({
        org_id: orgId,
        type: "task_created",
        description: `Task created: ${title}`,
        performed_by: profile.id,
        related_to_type: "lead",
        related_to_id: id!,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", id] })
      queryClient.invalidateQueries({ queryKey: ["leads", "detail", id] })
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
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", id] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Loading lead…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-slate-400">
        <p>Lead not found.</p>
        <Button variant="outline" onClick={() => navigate("/leads")}>
          Back to Leads
        </Button>
      </div>
    )
  }

  const { lead, activities } = data

  function startEditing() {
    setForm({
      first_name: lead.first_name ?? "",
      last_name: lead.last_name ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      company: lead.company ?? "",
      source: lead.source,
      status: lead.status,
      assigned_to: lead.assigned_to,
      score: lead.score?.toString() ?? "",
      notes: lead.notes ?? "",
    })
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setForm(null)
  }

  async function saveEditing() {
    if (!form) return

    const parsed = leadFormSchema.safeParse({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      company: form.company,
      source: form.source,
      notes: form.notes,
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form")
      return
    }

    let score: number | null = null
    if (form.score.trim()) {
      const parsedScore = Number(form.score)
      if (Number.isNaN(parsedScore)) {
        toast.error("Score must be a number")
        return
      }
      score = parsedScore
    }

    try {
      await updateLead.mutateAsync({
        id: lead.id,
        updates: {
          first_name: parsed.data.first_name,
          last_name: parsed.data.last_name || null,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          company: parsed.data.company || null,
          source: parsed.data.source,
          notes: parsed.data.notes || null,
          status: form.status,
          assigned_to: form.assigned_to,
          score,
        },
      })
      toast.success("Lead updated")
      setIsEditing(false)
    } catch (err) {
      toast.error("Failed to update lead", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function handleDelete() {
    try {
      await deleteLead.mutateAsync(lead.id)
      toast.success("Lead deleted")
      navigate("/leads")
    } catch (err) {
      toast.error("Failed to delete lead", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function handleConvert() {
    try {
      await convertLead.mutateAsync(lead)
      toast.success("Converted to contact")
    } catch (err) {
      toast.error("Failed to convert lead", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault()
    const content = noteContent.trim()
    if (!content) return
    try {
      await addNote.mutateAsync(content)
      setNoteContent("")
    } catch (err) {
      toast.error("Failed to add note", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

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
      <Link
        to="/leads"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Leads
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {leadFullName(lead)}
          </h1>
          <LeadStatusBadge status={lead.status} />
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={cancelEditing} disabled={updateLead.isPending}>
                Cancel
              </Button>
              <Button onClick={saveEditing} disabled={updateLead.isPending}>
                {updateLead.isPending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEditing}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              {lead.status !== "converted" && (
                <Button
                  variant="outline"
                  onClick={handleConvert}
                  disabled={convertLead.isPending}
                >
                  <UserCheck className="h-4 w-4" />
                  {convertLead.isPending ? "Converting…" : "Convert to Contact"}
                </Button>
              )}
              <PermissionGate requiredPermission={{ feature: "crm", level: "edit" }} fallback={null}>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </PermissionGate>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Info card */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            {isEditing && form ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>First name</Label>
                    <Input
                      value={form.first_name}
                      onChange={(e) => setForm((f) => f && { ...f, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last name</Label>
                    <Input
                      value={form.last_name}
                      onChange={(e) => setForm((f) => f && { ...f, last_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      value={form.email}
                      onChange={(e) => setForm((f) => f && { ...f, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm((f) => f && { ...f, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company</Label>
                    <Input
                      value={form.company}
                      onChange={(e) => setForm((f) => f && { ...f, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Score</Label>
                    <Input
                      type="number"
                      value={form.score}
                      onChange={(e) => setForm((f) => f && { ...f, score: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Source</Label>
                    <Select
                      value={form.source}
                      onValueChange={(value) =>
                        setForm((f) => f && { ...f, source: value as LeadSource })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {SOURCE_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(value) =>
                        setForm((f) => f && { ...f, status: value as LeadStatus })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUSES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {STATUS_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assigned To</Label>
                    <Select
                      value={form.assigned_to ?? "unassigned"}
                      onValueChange={(value) =>
                        setForm(
                          (f) => f && { ...f, assigned_to: value === "unassigned" ? null : value }
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {orgProfiles?.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profileDisplayName(profile)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((f) => f && { ...f, notes: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <InfoField label="Email">{lead.email ?? "—"}</InfoField>
                  <InfoField label="Phone">{lead.phone ?? "—"}</InfoField>
                  <InfoField label="Company">{lead.company ?? "—"}</InfoField>
                  <InfoField label="Source">
                    <LeadSourceBadge source={lead.source} />
                  </InfoField>
                  <InfoField label="Score">{lead.score ?? "—"}</InfoField>
                  <InfoField label="Assigned To">
                    {profileDisplayName(lead.assigned_profile)}
                  </InfoField>
                  <InfoField label="Created">{formatDateTime(lead.created_at)}</InfoField>
                  <InfoField label="Last Updated">{formatDateTime(lead.updated_at)}</InfoField>
                </div>
                {lead.notes && (
                  <div className="mt-4">
                    <InfoField label="Notes">{lead.notes}</InfoField>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Notes */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">Notes</h2>
            <form onSubmit={handleAddNote} className="mt-3 flex gap-2">
              <Textarea
                rows={2}
                placeholder="Add a note…"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={addNote.isPending || !noteContent.trim()}>
                Add
              </Button>
            </form>
            <ul className="mt-4 space-y-3">
              {notesQuery.data && notesQuery.data.length > 0 ? (
                notesQuery.data.map((note) => (
                  <li key={note.id} className="rounded-md bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">{note.content}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {profileDisplayName(note.author)} · {formatDateTime(note.created_at)}
                    </p>
                  </li>
                ))
              ) : (
                <p className="text-sm text-slate-400">No notes yet.</p>
              )}
            </ul>
          </section>

          {/* Tasks */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">Tasks</h2>
            <form onSubmit={handleAddTask} className="mt-3 flex gap-2">
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
                  <li
                    key={task.id}
                    className="flex items-center gap-3 rounded-md bg-slate-50 p-3"
                  >
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
                <p className="text-sm text-slate-400">No tasks yet.</p>
              )}
            </ul>
          </section>
        </div>

        {/* Activity timeline */}
        <div>
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">Activity</h2>
            <div className="mt-4">
              <ActivityTimeline activities={activities} />
            </div>
          </section>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {leadFullName(lead)}. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
