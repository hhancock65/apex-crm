import { Mail, MessageSquare, Phone, type LucideIcon } from "lucide-react"
import { useMemo } from "react"
import { useNavigate } from "react-router-dom"

import { AI_ACTION_ICONS, AI_ACTION_LABELS } from "@/components/ai-workforce/ai-action-meta"
import { useContactAiActions, useContactConversations } from "@/hooks/useConversations"
import { formatTimeOnly } from "@/lib/utils"
import { formatConversationDuration, type ConversationChannel } from "@/types/conversation"

const CHANNEL_ICONS: Record<ConversationChannel, LucideIcon> = {
  phone: Phone,
  sms: MessageSquare,
  email: Mail,
}

const CHANNEL_LABELS: Record<ConversationChannel, string> = {
  phone: "Phone Call",
  sms: "SMS Conversation",
  email: "Email Thread",
}

interface TimelineEntry {
  key: string
  timestamp: string
  icon: LucideIcon
  label: string
  employeeName: string | null
  extra?: string
  onClick?: () => void
}

export function ContactConversationsTab({ contactId }: { contactId: string }) {
  const navigate = useNavigate()
  const { data: conversations, isLoading: conversationsLoading } = useContactConversations(contactId)
  const { data: actions, isLoading: actionsLoading } = useContactAiActions(contactId)

  const entries = useMemo<TimelineEntry[]>(() => {
    const conversationEntries: TimelineEntry[] = (conversations ?? []).map((conversation) => ({
      key: `conversation-${conversation.id}`,
      timestamp: conversation.started_at,
      icon: CHANNEL_ICONS[conversation.channel],
      label: CHANNEL_LABELS[conversation.channel],
      employeeName: conversation.ai_employee?.name ?? null,
      extra:
        formatConversationDuration(conversation.channel, conversation.started_at, conversation.ended_at) ??
        undefined,
      onClick: () => navigate(`/conversations/${conversation.id}`),
    }))

    const actionEntries: TimelineEntry[] = (actions ?? []).map((action) => ({
      key: `action-${action.id}`,
      timestamp: action.created_at,
      icon: AI_ACTION_ICONS[action.action_type],
      label: AI_ACTION_LABELS[action.action_type],
      employeeName: action.ai_employee?.name ?? null,
      onClick:
        action.related_to_type === "call" && action.related_to_id
          ? () => navigate(`/calls/${action.related_to_id}`)
          : undefined,
    }))

    // Oldest-first, matching how this tab is meant to read: a sequence of
    // events as they actually happened, not a "recent activity" feed.
    return [...conversationEntries, ...actionEntries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  }, [conversations, actions, navigate])

  const isLoading = conversationsLoading || actionsLoading

  if (isLoading) {
    return <p className="py-6 text-center text-sm text-slate-400">Loading conversations…</p>
  }

  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        No AI Workforce conversations with this contact yet.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => {
        const Icon = entry.icon
        const content = (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <span className="text-slate-400">{formatTimeOnly(entry.timestamp)}</span>
            <span className="text-slate-300">—</span>
            <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="font-medium text-slate-800">{entry.label}</span>
            {entry.employeeName && (
              <>
                <span className="text-slate-300">—</span>
                <span>Handled by {entry.employeeName}</span>
              </>
            )}
            {entry.extra && (
              <>
                <span className="text-slate-300">—</span>
                <span>{entry.extra}</span>
              </>
            )}
          </div>
        )

        return (
          <li key={entry.key}>
            {entry.onClick ? (
              <button
                type="button"
                onClick={entry.onClick}
                className="w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
              >
                {content}
              </button>
            ) : (
              <div className="px-2 py-1.5">{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
