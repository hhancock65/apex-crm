export type TranscriptRole = "agent" | "user" | "transfer_target"

export interface TranscriptWord {
  word: string
  start: number
  end: number
}

export interface TranscriptTurn {
  role: TranscriptRole
  content: string
  words?: TranscriptWord[]
}

export interface CallTranscript {
  id: string
  org_id: string
  call_id: string
  content: TranscriptTurn[]
  created_at: string
}
