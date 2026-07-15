import { useUser } from "@clerk/clerk-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getCurrentOrgId } from "@/hooks/useCurrentOrgId"
import { getCurrentProfile } from "@/hooks/useCurrentProfile"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import { formatDateTime } from "@/lib/utils"
import type { NoteWithAuthor } from "@/types/note"
import { profileDisplayName } from "@/types/profile"

export function ContactNotesTab({ contactId }: { contactId: string }) {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()
  const { user } = useUser()
  const [noteContent, setNoteContent] = useState("")

  const notesQuery = useQuery({
    queryKey: ["contact-notes", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*, author:profiles!notes_created_by_fkey(id, first_name, last_name, email)")
        .eq("related_to_type", "contact")
        .eq("related_to_id", contactId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as NoteWithAuthor[]
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
        related_to_type: "contact",
        related_to_id: contactId,
      })
      if (error) throw error

      await supabase.from("activities").insert({
        org_id: orgId,
        type: "note",
        description: content.slice(0, 140),
        performed_by: profile.id,
        related_to_type: "contact",
        related_to_id: contactId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-notes", contactId] })
      queryClient.invalidateQueries({ queryKey: ["contacts", "detail", contactId] })
    },
  })

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

  return (
    <div>
      <form onSubmit={handleAddNote} className="flex gap-2">
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
          <p className="py-6 text-center text-sm text-slate-400">No notes yet.</p>
        )}
      </ul>
    </div>
  )
}
