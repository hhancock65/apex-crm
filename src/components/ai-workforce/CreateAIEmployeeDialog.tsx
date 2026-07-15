import { Check } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { AI_ROLE_DESCRIPTIONS, AI_ROLE_ICONS, AI_ROLE_LABELS } from "@/components/ai-workforce/ai-role-meta"
import { EscalationRulesEditor } from "@/components/ai-workforce/EscalationRulesEditor"
import { KnowledgePlaceholder } from "@/components/ai-workforce/KnowledgePlaceholder"
import { ResponsibilitiesChecklist } from "@/components/ai-workforce/ResponsibilitiesChecklist"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { useCreateAiEmployee, useCreateRetellAgent } from "@/hooks/useAiEmployees"
import { cn } from "@/lib/utils"
import { AI_EMPLOYEE_ROLES, type AiEmployeeRole, type EscalationRule } from "@/types/ai-employee"

// `value` is passed straight through to Retell as `voice_id` by the
// create-retell-agent edge function — these are placeholders. Fetch your
// real options from GET https://api.retellai.com/list-voices and swap the
// values in before relying on this in production.
const VOICE_OPTIONS = [
  { value: "sarah", label: "Sarah — Friendly, US English" },
  { value: "james", label: "James — Professional, US English" },
  { value: "emma", label: "Emma — Warm, UK English" },
  { value: "michael", label: "Michael — Confident, US English" },
  { value: "sofia", label: "Sofia — Warm, US Spanish" },
]

const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-US", label: "Spanish (US)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
]

const STEP_LABELS = ["Role", "Identity", "Responsibilities", "Knowledge", "Escalation", "Review"]
const TOTAL_STEPS = STEP_LABELS.length

interface WizardData {
  role: AiEmployeeRole | null
  name: string
  voice: string
  language: string
  personality: string
  responsibilities: string[]
  escalationRules: EscalationRule[]
}

const DEFAULT_WIZARD_DATA: WizardData = {
  role: null,
  name: "",
  voice: VOICE_OPTIONS[0].value,
  language: "en-US",
  personality: "",
  responsibilities: [],
  escalationRules: [],
}

interface CreateAIEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateAIEmployeeDialog({ open, onOpenChange }: CreateAIEmployeeDialogProps) {
  const createEmployee = useCreateAiEmployee()
  const createRetellAgent = useCreateRetellAgent()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>(DEFAULT_WIZARD_DATA)

  function patch(update: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...update }))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setStep(1)
      setData(DEFAULT_WIZARD_DATA)
    }
    onOpenChange(nextOpen)
  }

  function canProceed(): boolean {
    if (step === 1) return data.role !== null
    if (step === 2) return data.name.trim().length > 0
    return true
  }

  function goNext() {
    if (!canProceed()) return
    setStep((s) => Math.min(TOTAL_STEPS, s + 1))
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1))
  }

  async function handleCreate() {
    if (!data.role) return

    let employee
    try {
      employee = await createEmployee.mutateAsync({
        name: data.name.trim(),
        role: data.role,
        voice: data.voice,
        language: data.language,
        personality: data.personality.trim() || null,
        responsibilities: data.responsibilities,
        escalation_rules: data.escalationRules.filter(
          (rule) => rule.condition.trim() && rule.action.trim()
        ),
      })
    } catch (error) {
      toast.error("Failed to create AI Employee", {
        description: error instanceof Error ? error.message : undefined,
      })
      return
    }

    // The Apex record exists at this point regardless of what happens next —
    // close the wizard and report Retell provisioning as a separate outcome
    // rather than making the user re-enter everything on a Retell hiccup.
    handleOpenChange(false)

    try {
      await createRetellAgent.mutateAsync(employee.id)
      toast.success(`${employee.name} is ready to take calls`)
    } catch (error) {
      toast.warning(`${employee.name} was created, but Retell setup failed`, {
        description:
          (error instanceof Error ? error.message : undefined) ??
          "You can retry from the employee's Configuration tab.",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create AI Employee</DialogTitle>
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

        {/* Step content */}
        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {step === 1 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {AI_EMPLOYEE_ROLES.map((role) => {
                const Icon = AI_ROLE_ICONS[role]
                const selected = data.role === role
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => patch({ role })}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
                      selected
                        ? "border-apex-teal bg-apex-teal/5"
                        : "border-slate-200 hover:border-slate-300"
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
                      {AI_ROLE_LABELS[role]}
                    </span>
                    <span className="text-xs text-slate-500">{AI_ROLE_DESCRIPTIONS[role]}</span>
                  </button>
                )
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ai-name">Name</Label>
                <Input
                  id="ai-name"
                  placeholder="e.g. Riley"
                  value={data.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-voice">Voice</Label>
                  <Select value={data.voice} onValueChange={(voice) => patch({ voice })}>
                    <SelectTrigger id="ai-voice">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-language">Language</Label>
                  <Select value={data.language} onValueChange={(language) => patch({ language })}>
                    <SelectTrigger id="ai-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-personality">Personality</Label>
                <Textarea
                  id="ai-personality"
                  rows={3}
                  placeholder="Warm and upbeat, keeps calls brief, always confirms next steps before hanging up…"
                  value={data.personality}
                  onChange={(e) => patch({ personality: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <ResponsibilitiesChecklist
              value={data.responsibilities}
              onChange={(responsibilities) => patch({ responsibilities })}
            />
          )}

          {step === 4 && <KnowledgePlaceholder />}

          {step === 5 && (
            <EscalationRulesEditor
              value={data.escalationRules}
              onChange={(escalationRules) => patch({ escalationRules })}
            />
          )}

          {step === 6 && (
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Role
                </div>
                <p className="mt-0.5 text-slate-800">
                  {data.role ? AI_ROLE_LABELS[data.role] : "—"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Name
                  </div>
                  <p className="mt-0.5 text-slate-800">{data.name || "—"}</p>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Voice
                  </div>
                  <p className="mt-0.5 text-slate-800">
                    {VOICE_OPTIONS.find((v) => v.value === data.voice)?.label ?? "—"}
                  </p>
                </div>
              </div>
              {data.personality && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Personality
                  </div>
                  <p className="mt-0.5 text-slate-600">{data.personality}</p>
                </div>
              )}
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Responsibilities
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {data.responsibilities.length > 0 ? (
                    data.responsibilities.map((r) => (
                      <Badge key={r} variant="outline" className="border-slate-200 bg-slate-50 font-normal">
                        {r}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-slate-400">None selected</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Escalation Rules
                </div>
                {data.escalationRules.filter((r) => r.condition && r.action).length > 0 ? (
                  <ul className="mt-1 space-y-1 text-slate-600">
                    {data.escalationRules
                      .filter((r) => r.condition && r.action)
                      .map((rule, i) => (
                        <li key={i}>
                          If <span className="font-medium text-slate-800">{rule.condition}</span>{" "}
                          → <span className="font-medium text-slate-800">{rule.action}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="mt-0.5 text-slate-400">None configured</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step > 1 && (
            <Button type="button" variant="outline" onClick={goBack} disabled={createEmployee.isPending}>
              Back
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button type="button" onClick={goNext} disabled={!canProceed()}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={handleCreate} disabled={createEmployee.isPending}>
              {createEmployee.isPending ? "Creating…" : "Create AI Employee"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
