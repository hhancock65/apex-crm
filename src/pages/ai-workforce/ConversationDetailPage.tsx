import { ArrowLeft, Mail, Phone } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"

import { AI_ROLE_ICONS, AI_ROLE_LABELS } from "@/components/ai-workforce/ai-role-meta"
import { ConversationChannelBadge } from "@/components/ai-workforce/ConversationChannelBadge"
import { ConversationMessageList } from "@/components/ai-workforce/ConversationMessageList"
import { ConversationStatusBadge } from "@/components/ai-workforce/ConversationStatusBadge"
import { Button } from "@/components/ui/button"
import { useConversation } from "@/hooks/useConversations"
import { formatDateTime } from "@/lib/utils"
import { contactFullName } from "@/types/contact"
import { formatConversationDuration } from "@/types/conversation"

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: conversation, isLoading, error } = useConversation(id)

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Loading conversation…
      </div>
    )
  }

  if (error || !conversation) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-slate-400">
        <p>Conversation not found.</p>
        <Button variant="outline" onClick={() => navigate("/conversations")}>
          Back to Conversations
        </Button>
      </div>
    )
  }

  const duration = formatConversationDuration(
    conversation.channel,
    conversation.started_at,
    conversation.ended_at
  )
  const RoleIcon = conversation.ai_employee ? AI_ROLE_ICONS[conversation.ai_employee.role] : null

  return (
    <div>
      <Link
        to="/conversations"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Conversations
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {conversation.contact ? contactFullName(conversation.contact) : "Unknown contact"}
        </h1>
        <ConversationChannelBadge channel={conversation.channel} />
        <ConversationStatusBadge status={conversation.status} />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Started {formatDateTime(conversation.started_at)}
        {duration && ` · ${duration}`}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chat timeline */}
        <div className="lg:col-span-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <ConversationMessageList messages={conversation.messages} />
          </section>
        </div>

        <div className="space-y-6">
          {/* Contact sidebar */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">Contact</h2>
            {conversation.contact ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-slate-800">
                  {contactFullName(conversation.contact)}
                </p>
                {conversation.contact.email && (
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Mail className="h-3.5 w-3.5" />
                    {conversation.contact.email}
                  </p>
                )}
                {conversation.contact.phone && (
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Phone className="h-3.5 w-3.5" />
                    {conversation.contact.phone}
                  </p>
                )}
                <Link
                  to={`/contacts/${conversation.contact.id}`}
                  className="mt-2 inline-block text-sm font-medium text-apex-teal hover:underline"
                >
                  View Contact →
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No contact matched.</p>
            )}
          </section>

          {/* AI Employee sidebar */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">AI Employee</h2>
            {conversation.ai_employee ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  {RoleIcon && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-apex-navy/5 text-apex-navy">
                      <RoleIcon className="h-4 w-4" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {conversation.ai_employee.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {AI_ROLE_LABELS[conversation.ai_employee.role]}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/ai-employees/${conversation.ai_employee.id}`}
                  className="mt-2 inline-block text-sm font-medium text-apex-teal hover:underline"
                >
                  View AI Employee →
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No AI Employee assigned.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
