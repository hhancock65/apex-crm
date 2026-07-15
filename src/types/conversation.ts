import type { AiEmployeeSummary } from "@/types/ai-employee"
import type { ContactSummary } from "@/types/contact"

export const CONVERSATION_CHANNELS = ["phone", "sms", "email"] as const
export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number]

export const CONVERSATION_STATUSES = ["active", "completed", "escalated"] as const
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

export type ConversationMessageRole = "ai_employee" | "contact" | "system"

export interface ConversationMessage {
  role: ConversationMessageRole
  content: string
  timestamp: string
  /** Email-only — SMS/phone messages don't have one. */
  subject?: string
}

export interface AiConversation {
  id: string
  org_id: string
  ai_employee_id: string | null
  contact_id: string | null
  channel: ConversationChannel
  messages: ConversationMessage[]
  status: ConversationStatus
  started_at: string
  ended_at: string | null
  created_at: string
}

export interface AiConversationWithRelations extends AiConversation {
  contact: ContactSummary | null
  ai_employee: AiEmployeeSummary | null
}

export function lastMessagePreview(messages: ConversationMessage[]): string {
  const last = messages[messages.length - 1]
  return last?.content?.trim() || "No messages yet"
}

export function formatConversationDuration(
  channel: ConversationChannel,
  startedAt: string,
  endedAt: string | null
): string | null {
  if (channel !== "phone" || !endedAt) return null
  const seconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}:${String(remaining).padStart(2, "0")}`
}
