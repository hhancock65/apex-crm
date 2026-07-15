import { Check, Megaphone, RefreshCw, Repeat, UserPlus } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { TagInput } from "@/components/contacts/TagInput"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useAiEmployees } from "@/hooks/useAiEmployees"
import { useCampaignAudienceCount, useCreateCampaign, useLaunchCampaign } from "@/hooks/useCampaigns"
import { useContactTags } from "@/hooks/useContacts"
import { cn, toDateInputValue } from "@/lib/utils"
import { CAMPAIGN_SCRIPT_PRESETS } from "@/lib/campaign-scripts"
import { LEAD_STATUSES, type LeadStatus } from "@/types/lead"
import { DEAL_STATUSES, type DealStatus } from "@/types/deal"
import {
  CAMPAIGN_TYPE_DESCRIPTIONS,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPES,
  type CampaignMessageTemplates,
  type CampaignScheduleConfig,
  type CampaignTargetFilter,
  type CampaignType,
} from "@/types/campaign"

const CAMPAIGN_TYPE_ICONS: Record<CampaignType, typeof RefreshCw> = {
  reactivation: RefreshCw,
  nurture: Repeat,
  outbound: UserPlus,
  follow_up: Megaphone,
}

const STEP_LABELS = ["Type", "Audience", "AI Employee", "Script", "Schedule", "Review"]
const TOTAL_STEPS = STEP_LABELS.length

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
}

const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

interface WizardData {
  type: CampaignType | null
  name: string
  targetFilter: CampaignTargetFilter
  aiEmployeeId: string | null
  messageTemplates: CampaignMessageTemplates
  scheduleConfig: CampaignScheduleConfig
}

function defaultWizardData(): WizardData {
  return {
    type: null,
    name: "",
    targetFilter: {},
    aiEmployeeId: null,
    messageTemplates: { mode: "template" },
    scheduleConfig: {
      start_date: toDateInputValue(new Date()),
      max_calls_per_day: 20,
      time_window_start: "09:00",
      time_window_end: "17:00",
      days_of_week: [1, 2, 3, 4, 5],
    },
  }
}

interface CreateCampaignWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateCampaignWizard({ open, onOpenChange }: CreateCampaignWizardProps) {
  const navigate = useNavigate()
  const createCampaign = useCreateCampaign()
  const launchCampaign = useLaunchCampaign()
  const { data: employees } = useAiEmployees()
  const { data: tagSuggestions } = useContactTags()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>(defaultWizardData)

  const { data: audienceCount, isFetching: audienceCountLoading } = useCampaignAudienceCount(
    data.targetFilter
  )

  function patch(update: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...update }))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setStep(1)
      setData(defaultWizardData())
    }
    onOpenChange(nextOpen)
  }

  function canProceed(): boolean {
    if (step === 1) return data.type !== null && data.name.trim().length > 0
    if (step === 4) return data.messageTemplates.mode === "template" || Boolean(data.messageTemplates.instructions?.trim())
    return true
  }

  function goNext() {
    if (!canProceed()) return
    setStep((s) => Math.min(TOTAL_STEPS, s + 1))
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1))
  }

  function toggleLeadStatus(status: LeadStatus) {
    const current = data.targetFilter.lead_status ?? []
    const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status]
    patch({ targetFilter: { ...data.targetFilter, lead_status: next.length ? next : undefined } })
  }

  function toggleDealStatus(status: DealStatus) {
    const current = data.targetFilter.deal_status ?? []
    const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status]
    patch({ targetFilter: { ...data.targetFilter, deal_status: next.length ? next : undefined } })
  }

  function toggleDay(day: number) {
    const current = data.scheduleConfig.days_of_week ?? []
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()
    patch({ scheduleConfig: { ...data.scheduleConfig, days_of_week: next } })
  }

  async function handleLaunch() {
    if (!data.type) return

    let campaign
    try {
      campaign = await createCampaign.mutateAsync({
        name: data.name.trim(),
        type: data.type,
        ai_employee_id: data.aiEmployeeId,
        target_filter: data.targetFilter,
        message_templates: data.messageTemplates,
        schedule_config: data.scheduleConfig,
      })
    } catch (error) {
      toast.error("Failed to create campaign", {
        description: error instanceof Error ? error.message : undefined,
      })
      return
    }

    try {
      const result = await launchCampaign.mutateAsync(campaign.id)
      toast.success(`Campaign launched — ${result.total_contacts} contacts enrolled`)
      handleOpenChange(false)
      navigate(`/campaigns/${campaign.id}`)
    } catch (error) {
      toast.warning("Campaign created, but launch failed", {
        description:
          (error instanceof Error ? error.message : undefined) ??
          "You can retry from the campaign's detail page.",
      })
      handleOpenChange(false)
      navigate(`/campaigns/${campaign.id}`)
    }
  }

  const isSubmitting = createCampaign.isPending || launchCampaign.isPending
  const selectedEmployee = employees?.find((e) => e.id === data.aiEmployeeId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {STEP_LABELS.map((label, index) => {
            const stepNumber = index + 1
            const isActive = stepNumber === step
            const isDone = stepNumber < step
            return (
              <div key={label} className="flex flex-1 items-center gap-1">
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    isActive && "bg-apex-teal text-white",
                    isDone && "bg-apex-teal/10 text-apex-teal",
                    !isActive && !isDone && "bg-slate-100 text-slate-400"
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : stepNumber}
                </div>
                {stepNumber < TOTAL_STEPS && (
                  <div className={cn("h-0.5 flex-1", isDone ? "bg-apex-teal" : "bg-slate-100")} />
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Step {step} of {TOTAL_STEPS} — {STEP_LABELS[step - 1]}
        </p>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {CAMPAIGN_TYPES.map((type) => {
                  const Icon = CAMPAIGN_TYPE_ICONS[type]
                  const selected = data.type === type
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => patch({ type })}
                      className={cn(
                        "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
                        selected ? "border-apex-teal bg-apex-teal/5" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md",
                          selected ? "bg-apex-teal text-white" : "bg-slate-100 text-slate-500"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        {CAMPAIGN_TYPE_LABELS[type]}
                      </span>
                      <span className="text-xs text-slate-500">{CAMPAIGN_TYPE_DESCRIPTIONS[type]}</span>
                    </button>
                  )
                })}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-name">Campaign name</Label>
                <Input
                  id="campaign-name"
                  placeholder="e.g. Spring Reactivation 2026"
                  value={data.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <TagInput
                  value={data.targetFilter.tags ?? []}
                  onChange={(tags) =>
                    patch({ targetFilter: { ...data.targetFilter, tags: tags.length ? tags : undefined } })
                  }
                  suggestions={tagSuggestions ?? []}
                  placeholder="Only contacts with these tags…"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="activity-before">Last activity before</Label>
                  <Input
                    id="activity-before"
                    type="date"
                    value={data.targetFilter.last_activity_before ?? ""}
                    onChange={(e) =>
                      patch({
                        targetFilter: {
                          ...data.targetFilter,
                          last_activity_before: e.target.value || undefined,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="activity-after">Last activity after</Label>
                  <Input
                    id="activity-after"
                    type="date"
                    value={data.targetFilter.last_activity_after ?? ""}
                    onChange={(e) =>
                      patch({
                        targetFilter: {
                          ...data.targetFilter,
                          last_activity_after: e.target.value || undefined,
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Lead status</Label>
                <div className="flex flex-wrap gap-3">
                  {LEAD_STATUSES.map((status) => (
                    <label key={status} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <Checkbox
                        checked={(data.targetFilter.lead_status ?? []).includes(status)}
                        onCheckedChange={() => toggleLeadStatus(status)}
                      />
                      {LEAD_STATUS_LABELS[status]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Deal status</Label>
                <div className="flex flex-wrap gap-3">
                  {DEAL_STATUSES.map((status) => (
                    <label key={status} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <Checkbox
                        checked={(data.targetFilter.deal_status ?? []).includes(status)}
                        onCheckedChange={() => toggleDealStatus(status)}
                      />
                      {DEAL_STATUS_LABELS[status]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <span className="font-semibold text-slate-800">
                  {audienceCountLoading ? "Counting…" : (audienceCount ?? 0)}
                </span>{" "}
                <span className="text-slate-600">contacts match this audience.</span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {employees && employees.length > 0 ? (
                employees.map((employee) => {
                  const selected = data.aiEmployeeId === employee.id
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => patch({ aiEmployeeId: employee.id })}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                        selected ? "border-apex-teal bg-apex-teal/5" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{employee.name}</p>
                        <p className="text-xs text-slate-500">{employee.role}</p>
                      </div>
                      {selected && <Check className="h-4 w-4 text-apex-teal" />}
                    </button>
                  )
                })
              ) : (
                <p className="text-sm text-slate-400">
                  No AI Employees yet — create one first from AI Employees.
                </p>
              )}
            </div>
          )}

          {step === 4 && data.type && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Script</Label>
                <Select
                  value={data.messageTemplates.mode}
                  onValueChange={(mode) =>
                    patch({ messageTemplates: { mode: mode as "template" | "custom" } })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template">Use the default script for this campaign type</SelectItem>
                    <SelectItem value="custom">Write custom instructions</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {data.messageTemplates.mode === "template" ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  {CAMPAIGN_SCRIPT_PRESETS[data.type]}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="campaign-instructions">What should the AI Employee say or do?</Label>
                  <Textarea
                    id="campaign-instructions"
                    rows={5}
                    placeholder="e.g. Mention our spring promotion, ask if they're still interested, and offer to book a free consultation…"
                    value={data.messageTemplates.instructions ?? ""}
                    onChange={(e) =>
                      patch({
                        messageTemplates: { mode: "custom", instructions: e.target.value },
                      })
                    }
                  />
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date">Start date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={data.scheduleConfig.start_date ?? ""}
                    onChange={(e) =>
                      patch({ scheduleConfig: { ...data.scheduleConfig, start_date: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max-calls">Max calls per day</Label>
                  <Input
                    id="max-calls"
                    type="number"
                    min="1"
                    value={data.scheduleConfig.max_calls_per_day ?? ""}
                    onChange={(e) =>
                      patch({
                        scheduleConfig: {
                          ...data.scheduleConfig,
                          max_calls_per_day: Number(e.target.value) || undefined,
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="window-start">Time window start</Label>
                  <Input
                    id="window-start"
                    type="time"
                    value={data.scheduleConfig.time_window_start ?? ""}
                    onChange={(e) =>
                      patch({
                        scheduleConfig: { ...data.scheduleConfig, time_window_start: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="window-end">Time window end</Label>
                  <Input
                    id="window-end"
                    type="time"
                    value={data.scheduleConfig.time_window_end ?? ""}
                    onChange={(e) =>
                      patch({ scheduleConfig: { ...data.scheduleConfig, time_window_end: e.target.value } })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Days of week</Label>
                <div className="flex flex-wrap gap-3">
                  {DAY_LABELS.map((label, day) => (
                    <label key={day} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <Checkbox
                        checked={(data.scheduleConfig.days_of_week ?? []).includes(day)}
                        onCheckedChange={() => toggleDay(day)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 6 && data.type && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Name</div>
                  <p className="mt-0.5 text-slate-800">{data.name || "—"}</p>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Type</div>
                  <p className="mt-0.5 text-slate-800">{CAMPAIGN_TYPE_LABELS[data.type]}</p>
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Audience</div>
                <p className="mt-0.5 text-slate-800">
                  {audienceCountLoading ? "Counting…" : `${audienceCount ?? 0} contacts`}
                </p>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">AI Employee</div>
                <p className="mt-0.5 text-slate-800">{selectedEmployee?.name ?? "Not assigned"}</p>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Schedule</div>
                <p className="mt-0.5 text-slate-800">
                  Starting {data.scheduleConfig.start_date}, up to {data.scheduleConfig.max_calls_per_day}{" "}
                  calls/day, {data.scheduleConfig.time_window_start}–{data.scheduleConfig.time_window_end}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(data.scheduleConfig.days_of_week ?? []).map((day) => (
                    <Badge key={day} variant="outline" className="border-slate-200 bg-slate-50 font-normal">
                      {DAY_LABELS[day]}
                    </Badge>
                  ))}
                </div>
              </div>
              {audienceCount !== undefined && data.scheduleConfig.max_calls_per_day && (
                <p className="text-xs text-slate-500">
                  Estimated timeline: about{" "}
                  {Math.max(1, Math.ceil(audienceCount / data.scheduleConfig.max_calls_per_day))} day(s) to
                  reach everyone, at this pace.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step > 1 && (
            <Button type="button" variant="outline" onClick={goBack} disabled={isSubmitting}>
              Back
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button type="button" onClick={goNext} disabled={!canProceed()}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={handleLaunch} disabled={isSubmitting}>
              {isSubmitting ? "Launching…" : "Launch Campaign"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
