import { ArrowLeft, Mail, Phone, UserPlus } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { AI_ACTION_ICONS, AI_ACTION_LABELS } from "@/components/ai-workforce/ai-action-meta"
import { CallDirectionBadge } from "@/components/ai-workforce/CallDirectionBadge"
import { CallOutcomeBadge } from "@/components/ai-workforce/CallOutcomeBadge"
import { CallSentimentIcon } from "@/components/ai-workforce/CallSentimentIcon"
import { CallStatusBadge } from "@/components/ai-workforce/CallStatusBadge"
import { TranscriptView } from "@/components/ai-workforce/TranscriptView"
import { AddLeadDialog } from "@/components/leads/AddLeadDialog"
import { ContactCombobox } from "@/components/shared/ContactCombobox"
import { Button } from "@/components/ui/button"
import { useCall, useLinkCallToContact } from "@/hooks/useCalls"
import { cn, formatDateTime } from "@/lib/utils"
import { contactFullName, type ContactSummary } from "@/types/contact"
import { formatCallDuration } from "@/types/call"

function MetaField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  )
}

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading, error } = useCall(id)
  const linkToContact = useLinkCallToContact()

  const [addLeadOpen, setAddLeadOpen] = useState(false)
  const [linkingContact, setLinkingContact] = useState<ContactSummary | null>(null)

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Loading call…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-slate-400">
        <p>Call not found.</p>
        <Button variant="outline" onClick={() => navigate("/calls")}>
          Back to Calls
        </Button>
      </div>
    )
  }

  const { call, transcript, actions } = data
  const callerLabel = call.contact ? contactFullName(call.contact) : call.caller_phone ?? "Unknown caller"

  async function handleLinkContact() {
    if (!linkingContact) return
    try {
      await linkToContact.mutateAsync({ callId: call.id, contactId: linkingContact.id })
      toast.success("Call linked to contact")
      setLinkingContact(null)
    } catch (err) {
      toast.error("Failed to link contact", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const leadDefaults = {
    first_name: call.contact?.first_name ?? "",
    last_name: call.contact?.last_name ?? "",
    email: call.contact?.email ?? "",
    phone: call.contact?.phone ?? call.caller_phone ?? "",
    source: "ai_employee" as const,
    notes: call.summary ?? "",
  }

  return (
    <div>
      <Link
        to="/calls"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Calls
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{callerLabel}</h1>
            <CallStatusBadge status={call.status} />
            <CallOutcomeBadge outcome={call.outcome} />
          </div>
          {call.summary && <p className="mt-1 max-w-2xl text-sm text-slate-600">{call.summary}</p>}
        </div>

        <Button variant="outline" onClick={() => setAddLeadOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Create Lead from Call
        </Button>
      </div>

      {/* Metadata */}
      <section className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-3 lg:grid-cols-6">
        <MetaField label="AI Employee">{call.ai_employee?.name ?? "—"}</MetaField>
        <MetaField label="Direction">
          <CallDirectionBadge direction={call.direction} />
        </MetaField>
        <MetaField label="Duration">{formatCallDuration(call.duration_seconds)}</MetaField>
        <MetaField label="Sentiment">
          <CallSentimentIcon sentiment={call.sentiment} />
        </MetaField>
        <MetaField label="Started">{formatDateTime(call.started_at)}</MetaField>
        <MetaField label="Ended">{formatDateTime(call.ended_at)}</MetaField>
      </section>

      {call.recording_url && (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Recording</div>
          <audio controls src={call.recording_url} className="mt-2 w-full" />
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Transcript */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">Transcript</h2>
            <div className="mt-4">
              <TranscriptView turns={transcript?.content ?? []} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* Contact info */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">Contact</h2>
            {call.contact ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-slate-800">{contactFullName(call.contact)}</p>
                {call.contact.email && (
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Mail className="h-3.5 w-3.5" />
                    {call.contact.email}
                  </p>
                )}
                {call.contact.phone && (
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Phone className="h-3.5 w-3.5" />
                    {call.contact.phone}
                  </p>
                )}
                <Link
                  to={`/contacts/${call.contact.id}`}
                  className="mt-2 inline-block text-sm font-medium text-apex-teal hover:underline"
                >
                  View Contact →
                </Link>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-slate-400">No contact matched to this call.</p>
                <ContactCombobox value={linkingContact} onChange={setLinkingContact} />
                <Button
                  size="sm"
                  onClick={handleLinkContact}
                  disabled={!linkingContact || linkToContact.isPending}
                >
                  {linkToContact.isPending ? "Linking…" : "Link to Contact"}
                </Button>
              </div>
            )}
          </section>

          {/* Actions taken */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">Actions Taken</h2>
            {actions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No actions logged for this call.</p>
            ) : (
              <ul className={cn("mt-3 space-y-3")}>
                {actions.map((action) => {
                  const Icon = AI_ACTION_ICONS[action.action_type]
                  return (
                    <li key={action.id} className="flex gap-2.5">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {AI_ACTION_LABELS[action.action_type]}
                        </p>
                        {action.description && (
                          <p className="text-xs text-slate-500">{action.description}</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <AddLeadDialog open={addLeadOpen} onOpenChange={setAddLeadOpen} defaultValues={leadDefaults} />
    </div>
  )
}
