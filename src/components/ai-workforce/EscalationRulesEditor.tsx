import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { EscalationRule } from "@/types/ai-employee"

interface EscalationRulesEditorProps {
  value: EscalationRule[]
  onChange: (value: EscalationRule[]) => void
}

export function EscalationRulesEditor({ value, onChange }: EscalationRulesEditorProps) {
  function updateRule(index: number, patch: Partial<EscalationRule>) {
    onChange(value.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)))
  }

  function removeRule(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function addRule() {
    onChange([...value, { condition: "", action: "" }])
  }

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-sm text-slate-400">
          No escalation rules yet. AI Employees will handle every conversation on their own.
        </p>
      )}

      {value.map((rule, index) => (
        <div key={index} className="flex items-start gap-2 rounded-md border border-slate-200 p-3">
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">If…</label>
              <Input
                placeholder="e.g. caller asks for a refund"
                value={rule.condition}
                onChange={(e) => updateRule(index, { condition: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Then…</label>
              <Input
                placeholder="e.g. transfer to on-call manager"
                value={rule.action}
                onChange={(e) => updateRule(index, { action: e.target.value })}
              />
            </div>
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
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addRule}>
        <Plus className="h-4 w-4" />
        Add Rule
      </Button>
    </div>
  )
}
