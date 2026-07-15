import { useEffect, useState } from "react"
import { toast } from "sonner"

import { EscalationRulesEditor } from "@/components/ai-workforce/EscalationRulesEditor"
import { KnowledgePlaceholder } from "@/components/ai-workforce/KnowledgePlaceholder"
import { ResponsibilitiesChecklist } from "@/components/ai-workforce/ResponsibilitiesChecklist"
import { TransferRulesEditor, type TransferRuleFormRow } from "@/components/ai-workforce/TransferRulesEditor"
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
import { useUpdateAiEmployee, useUpdateRetellAgent } from "@/hooks/useAiEmployees"
import { useSetTransferRules, useTransferRules } from "@/hooks/useTransferRules"
import type { AiEmployee, EscalationRule } from "@/types/ai-employee"

// `value` is passed straight through to Retell as `voice_id` by the
// update-retell-agent edge function — these are placeholders. Fetch your
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

interface ConfigForm {
  name: string
  voice: string
  language: string
  personality: string
  responsibilities: string[]
  escalationRules: EscalationRule[]
}

function toConfigForm(employee: AiEmployee): ConfigForm {
  return {
    name: employee.name,
    voice: employee.voice ?? VOICE_OPTIONS[0].value,
    language: employee.language,
    personality: employee.personality ?? "",
    responsibilities: employee.responsibilities,
    escalationRules: employee.escalation_rules,
  }
}

/** A rule only counts as "configured" once it has both a real target and,
 *  for value_threshold rules, a real dollar amount — half-filled rows from
 *  clicking "Add Rule" and then abandoning it are silently dropped on save,
 *  same as EscalationRulesEditor's blank-row filtering. */
function isCompleteTransferRule(rule: TransferRuleFormRow): boolean {
  const hasTarget = Boolean(rule.target_user_id) || Boolean(rule.target_phone?.trim())
  if (!hasTarget) return false
  if (rule.condition_type === "value_threshold") return Boolean(rule.condition_value?.trim())
  return true
}

export function AiEmployeeConfigTab({ employee }: { employee: AiEmployee }) {
  const updateEmployee = useUpdateAiEmployee()
  const updateRetellAgent = useUpdateRetellAgent()
  const { data: transferRules } = useTransferRules(employee.id)
  const setTransferRules = useSetTransferRules()
  const [form, setForm] = useState<ConfigForm>(() => toConfigForm(employee))
  const [transferRulesForm, setTransferRulesForm] = useState<TransferRuleFormRow[]>([])
  const [transferRulesSeeded, setTransferRulesSeeded] = useState(false)

  // transfer_rules lives in its own table now (not a column on the employee
  // row), so it arrives asynchronously — seed the editable form the first
  // time it loads rather than trying to derive it synchronously like the
  // rest of ConfigForm.
  useEffect(() => {
    if (transferRules && !transferRulesSeeded) {
      setTransferRulesForm(
        transferRules.map((rule) => ({
          condition_type: rule.condition_type,
          condition_value: rule.condition_value,
          target_user_id: rule.target_user_id,
          target_phone: rule.target_phone,
        }))
      )
      setTransferRulesSeeded(true)
    }
  }, [transferRules, transferRulesSeeded])

  function patch(update: Partial<ConfigForm>) {
    setForm((prev) => ({ ...prev, ...update }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }

    try {
      await updateEmployee.mutateAsync({
        id: employee.id,
        updates: {
          name: form.name.trim(),
          voice: form.voice,
          language: form.language,
          personality: form.personality.trim() || null,
          responsibilities: form.responsibilities,
          escalation_rules: form.escalationRules.filter(
            (rule) => rule.condition.trim() && rule.action.trim()
          ),
        },
      })
      await setTransferRules.mutateAsync({
        aiEmployeeId: employee.id,
        rules: transferRulesForm.filter(isCompleteTransferRule).map((rule) => ({
          condition_type: rule.condition_type,
          condition_value: rule.condition_type === "value_threshold" ? rule.condition_value!.trim() : null,
          target_user_id: rule.target_user_id || null,
          target_phone: rule.target_phone?.trim() || null,
        })),
      })
    } catch (error) {
      toast.error("Failed to save configuration", {
        description: error instanceof Error ? error.message : undefined,
      })
      return
    }

    // The Apex rows are saved either way — Retell sync failing is a
    // separate, retryable outcome (just click Save again), not a reason to
    // lose the form's edits or make the user think nothing was saved.
    try {
      await updateRetellAgent.mutateAsync(employee.id)
      toast.success("Configuration saved and synced to Retell")
    } catch (error) {
      toast.warning("Configuration saved, but Retell sync failed", {
        description:
          (error instanceof Error ? error.message : undefined) ?? "Click Save to retry.",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="config-name">Name</Label>
          <Input id="config-name" value={form.name} onChange={(e) => patch({ name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="config-voice">Voice</Label>
            <Select value={form.voice} onValueChange={(voice) => patch({ voice })}>
              <SelectTrigger id="config-voice">
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
            <Label htmlFor="config-language">Language</Label>
            <Select value={form.language} onValueChange={(language) => patch({ language })}>
              <SelectTrigger id="config-language">
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
          <Label htmlFor="config-personality">Personality</Label>
          <Textarea
            id="config-personality"
            rows={3}
            value={form.personality}
            onChange={(e) => patch({ personality: e.target.value })}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">Responsibilities</h3>
        <div className="mt-2">
          <ResponsibilitiesChecklist
            value={form.responsibilities}
            onChange={(responsibilities) => patch({ responsibilities })}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">Knowledge</h3>
        <div className="mt-2">
          <KnowledgePlaceholder />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">Escalation Rules</h3>
        <div className="mt-2">
          <EscalationRulesEditor
            value={form.escalationRules}
            onChange={(escalationRules) => patch({ escalationRules })}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">Transfer Rules</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          When a condition below is met during a call, this AI Employee hands the caller off to whoever
          you choose here.
        </p>
        <div className="mt-2">
          <TransferRulesEditor value={transferRulesForm} onChange={setTransferRulesForm} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateEmployee.isPending || setTransferRules.isPending || updateRetellAgent.isPending}
        >
          {updateEmployee.isPending || setTransferRules.isPending
            ? "Saving…"
            : updateRetellAgent.isPending
              ? "Syncing to Retell…"
              : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
