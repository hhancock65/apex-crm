import type { ProfileSummary } from "@/types/profile"
import type { RelatedEntityType } from "@/types/activity"

export interface Note {
  id: string
  org_id: string
  content: string
  created_by: string | null
  related_to_type: RelatedEntityType | null
  related_to_id: string | null
  created_at: string
  updated_at: string
}

export interface NoteWithAuthor extends Note {
  author: ProfileSummary | null
}
