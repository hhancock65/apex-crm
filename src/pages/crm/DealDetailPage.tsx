import { ArrowLeft, Check, Mail, Phone, ThumbsDown, ThumbsUp } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { ActivityTimeline } from "@/components/activities/ActivityTimeline"
import { DealStatusBadge } from "@/components/deals/DealStatusBadge"
import { MarkDealLostDialog } from "@/components/deals/MarkDealLostDialog"
import { Button } from "@/components/ui/button"
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
import { useCompanies } from "@/hooks/useCompanies"
import { useDeal, useMarkDealWon, useUpdateDeal } from "@/hooks/useDeals"
import { useOrgProfiles } from "@/hooks/useOrgProfiles"
import { usePipelineStages } from "@/hooks/usePipelines"
import { dealFormSchema, parseDealProbability, parseDealValue } from "@/lib/validation/deal"
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils"
import { profileDisplayName } from "@/types/profile"
import type { PipelineStage } from "@/types/pipeline"

interface EditForm {
  title: string
  company_id: string | null
  value: string
  probability: string
  expected_close_date: string
  assigned_to: string | null
  notes: string
}

function InfoField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  )
}

function StageProgressBar({
  stages,
  currentStageId,
}: {
  stages: PipelineStage[]
  currentStageId: string
}) {
  const currentIndex = stages.findIndex((s) => s.id === currentStageId)

  return (
    <div className="flex items-start">
      {stages.map((stage, index) => {
        const isCurrent = stage.id === currentStageId
        const isPast = currentIndex >= 0 && index < currentIndex

        return (
          <div key={stage.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  isCurrent
                    ? "border-apex-teal bg-apex-teal text-white"
                    : isPast
                      ? "border-apex-teal bg-apex-teal/10 text-apex-teal"
                      : "border-slate-200 bg-white text-slate-300"
                )}
              >
                {isPast ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span
                className={cn(
                  "max-w-[90px] truncate text-center text-[11px]",
                  isCurrent ? "font-semibold text-slate-800" : "text-slate-400"
                )}
              >
                {stage.name}
              </span>
            </div>
            {index < stages.length - 1 && (
              <div className={cn("mx-1 h-0.5 flex-1", isPast ? "bg-apex-teal" : "bg-slate-200")} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading, error } = useDeal(id)
  const { data: stages } = usePipelineStages(data?.deal.pipeline_id)
  const { data: companies } = useCompanies()
  const { data: profiles } = useOrgProfiles()
  const updateDeal = useUpdateDeal()
  const markWon = useMarkDealWon()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<EditForm | null>(null)
  const [lostDialogOpen, setLostDialogOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Loading deal…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-slate-400">
        <p>Deal not found.</p>
        <Button variant="outline" onClick={() => navigate("/deals")}>
          Back to Deals
        </Button>
      </div>
    )
  }

  const { deal, activities } = data

  function startEditing() {
    setForm({
      title: deal.title,
      company_id: deal.company_id,
      value: deal.value.toString(),
      probability: deal.probability?.toString() ?? "",
      expected_close_date: deal.expected_close_date ?? "",
      assigned_to: deal.assigned_to,
      notes: deal.notes ?? "",
    })
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setForm(null)
  }

  async function saveEditing() {
    if (!form) return

    const parsed = dealFormSchema
      .omit({ stage_id: true, contact_id: true })
      .safeParse({
        title: form.title,
        company_id: form.company_id ?? "",
        expected_close_date: form.expected_close_date,
        assigned_to: form.assigned_to ?? "",
        notes: form.notes,
      })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form")
      return
    }

    const parsedValue = parseDealValue(form.value)
    if (parsedValue.error) {
      toast.error(parsedValue.error)
      return
    }
    const parsedProbability = parseDealProbability(form.probability)
    if (parsedProbability.error) {
      toast.error(parsedProbability.error)
      return
    }

    try {
      await updateDeal.mutateAsync({
        id: deal.id,
        updates: {
          title: parsed.data.title,
          company_id: parsed.data.company_id || null,
          value: parsedValue.value,
          probability: parsedProbability.value,
          expected_close_date: parsed.data.expected_close_date || null,
          assigned_to: parsed.data.assigned_to || null,
          notes: parsed.data.notes || null,
        },
      })
      toast.success("Deal updated")
      setIsEditing(false)
    } catch (err) {
      toast.error("Failed to update deal", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function handleMarkWon() {
    try {
      await markWon.mutateAsync(deal.id)
      toast.success("Deal marked won")
    } catch (err) {
      toast.error("Failed to mark deal won", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <div>
      <Link
        to="/deals"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Deals
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{deal.title}</h1>
          <DealStatusBadge status={deal.status} />
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={cancelEditing} disabled={updateDeal.isPending}>
                Cancel
              </Button>
              <Button onClick={saveEditing} disabled={updateDeal.isPending}>
                {updateDeal.isPending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEditing}>
                Edit
              </Button>
              {deal.status === "open" && (
                <>
                  <Button
                    variant="outline"
                    className="text-green-700 hover:text-green-700"
                    onClick={handleMarkWon}
                    disabled={markWon.isPending}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    Mark Won
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setLostDialogOpen(true)}
                  >
                    <ThumbsDown className="h-4 w-4" />
                    Mark Lost
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stage progress */}
      {stages && stages.length > 0 && (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <StageProgressBar stages={stages} currentStageId={deal.stage_id} />
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Info card */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            {isEditing && form ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => f && { ...f, title: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Value ($)</Label>
                    <Input
                      type="number"
                      value={form.value}
                      onChange={(e) => setForm((f) => f && { ...f, value: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Probability (%)</Label>
                    <Input
                      type="number"
                      value={form.probability}
                      onChange={(e) => setForm((f) => f && { ...f, probability: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Expected Close Date</Label>
                    <Input
                      type="date"
                      value={form.expected_close_date}
                      onChange={(e) =>
                        setForm((f) => f && { ...f, expected_close_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company</Label>
                    <Select
                      value={form.company_id ?? "none"}
                      onValueChange={(value) =>
                        setForm((f) => f && { ...f, company_id: value === "none" ? null : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No company</SelectItem>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
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
                        {profiles?.map((profile) => (
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
                  <InfoField label="Value">{formatCurrency(deal.value)}</InfoField>
                  <InfoField label="Probability">
                    {deal.probability === null ? "—" : `${deal.probability}%`}
                  </InfoField>
                  <InfoField label="Expected Close">
                    {formatDate(deal.expected_close_date)}
                  </InfoField>
                  <InfoField label="Company">{deal.company?.name ?? "—"}</InfoField>
                  <InfoField label="Assigned To">
                    {profileDisplayName(deal.assigned_profile)}
                  </InfoField>
                  <InfoField label="Created">{formatDateTime(deal.created_at)}</InfoField>
                </div>
                {deal.status === "won" && deal.won_at && (
                  <div className="mt-4">
                    <InfoField label="Won On">{formatDateTime(deal.won_at)}</InfoField>
                  </div>
                )}
                {deal.status === "lost" && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <InfoField label="Lost On">{formatDateTime(deal.lost_at)}</InfoField>
                    <InfoField label="Reason">{deal.lost_reason ?? "—"}</InfoField>
                  </div>
                )}
                {deal.notes && (
                  <div className="mt-4">
                    <InfoField label="Notes">{deal.notes}</InfoField>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Activity timeline */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">Activity</h2>
            <div className="mt-4">
              <ActivityTimeline activities={activities} />
            </div>
          </section>
        </div>

        {/* Contact info card */}
        <div>
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">Contact</h2>
            {deal.contact ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-slate-800">
                  {[deal.contact.first_name, deal.contact.last_name].filter(Boolean).join(" ")}
                </p>
                {deal.contact.email && (
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Mail className="h-3.5 w-3.5" />
                    {deal.contact.email}
                  </p>
                )}
                {deal.contact.phone && (
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Phone className="h-3.5 w-3.5" />
                    {deal.contact.phone}
                  </p>
                )}
                <Link
                  to={`/contacts/${deal.contact.id}`}
                  className="mt-2 inline-block text-sm font-medium text-apex-teal hover:underline"
                >
                  View Contact →
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No contact linked.</p>
            )}
          </section>
        </div>
      </div>

      <MarkDealLostDialog
        dealId={deal.id}
        open={lostDialogOpen}
        onOpenChange={setLostDialogOpen}
      />
    </div>
  )
}
