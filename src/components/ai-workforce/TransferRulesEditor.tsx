import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useOrgProfiles } from "@/hooks/useOrgProfiles"
import { profileDisplayName } from "@/types/profile"
import {
  TRANSFER_CONDITION_LABELS,
  TRANSFER_CONDITION_TYPES,
  type TransferConditionType,
} from "@/types/transfer-rule"

export interface TransferRuleFormRow {
  condition_type: TransferConditionType
  condition_value: string | null
  target_user_id: string | null
  target_phone: string | null
}

interface TransferRulesEditorProps {
  value: TransferRuleFormRow[]
  onChange: (value: TransferRuleFormRow[]) => void
}

function emptyRule(): TransferRuleFormRow {
  return {
    condition_type: "caller_requests_human",
    condition_value: null,
    target_user_id: null,
    target_phone: null,
  }
}

export function TransferRulesEditor({ value, onChange }: TransferRulesEditorProps) {
  const { data: profiles } = useOrgProfiles()

  function updateRule(index: number, patch: Partial<TransferRuleFormRow>) {
    onChange(value.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)))
  }

  function removeRule(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function addRule() {
    onChange([...value, emptyRule()])
  }

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-sm text-slate-400">
          No transfer rules yet. This AI Employee will never hand a call off to a human.
        </p>
      )}

      {value.map((rule, index) => {
        const targetMode: "user" | "phone" = rule.target_phone ? "phone" : "user"

        return (
          <div key={index} className="space-y-2 rounded-md border border-slate-200 p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-slate-500">Condition</label>
                <Select
                  value={rule.condition_type}
                  onValueChange={(condition_type) =>
                    updateRule(index, { condition_type: condition_type as TransferConditionType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFER_CONDITION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {TRANSFER_CONDITION_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-5 shrink-0 text-slate-400 hover:text-destructive"
                onClick={() => removeRule(index)}
                aria-label="Remove rule"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {rule.condition_type === "value_threshold" && (
              <div className="max-w-xs space-y-1">
                <label className="text-xs font-medium text-slate-500">Estimated value above ($)</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="5000"
                  value={rule.condition_value ?? ""}
                  onChange={(e) => updateRule(index, { condition_value: e.target.value })}
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Transfer to</label>
                <Select
                  value={targetMode}
                  onValueChange={(mode) =>
                    updateRule(
                      index,
                      mode === "phone"
                        ? { target_user_id: null, target_phone: "" }
                        : { target_phone: null, target_user_id: "" }
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Team member</SelectItem>
                    <SelectItem value="phone">Phone number</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">
                  {targetMode === "user" ? "Team member" : "Phone number"}
                </label>
                {targetMode === "user" ? (
                  <Select
                    value={rule.target_user_id ?? ""}
                    onValueChange={(target_user_id) => updateRule(index, { target_user_id })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles?.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profileDisplayName(profile)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="tel"
                    placeholder="+15551234567"
                    value={rule.target_phone ?? ""}
                    onChange={(e) => updateRule(index, { target_phone: e.target.value })}
                  />
                )}
              </div>
            </div>
          </div>
        )
      })}

      <Button type="button" variant="outline" size="sm" onClick={addRule}>
        <Plus className="h-4 w-4" />
        Add Rule
      </Button>
    </div>
  )
}
