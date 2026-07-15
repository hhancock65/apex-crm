import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export const RESPONSIBILITY_OPTIONS = [
  "Answer inbound calls",
  "Make outbound calls",
  "Qualify leads",
  "Book appointments",
  "Reschedule appointments",
  "Send follow-up messages",
  "Send SMS",
  "Send email",
  "Transfer to a human agent",
  "Update contact records",
  "Re-engage cold leads",
]

interface ResponsibilitiesChecklistProps {
  value: string[]
  onChange: (value: string[]) => void
}

export function ResponsibilitiesChecklist({ value, onChange }: ResponsibilitiesChecklistProps) {
  function toggle(option: string, checked: boolean) {
    onChange(checked ? [...value, option] : value.filter((v) => v !== option))
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {RESPONSIBILITY_OPTIONS.map((option) => (
        <label
          key={option}
          className="flex items-center gap-2.5 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
        >
          <Checkbox
            checked={value.includes(option)}
            onCheckedChange={(checked) => toggle(option, checked === true)}
          />
          <Label className="cursor-pointer font-normal">{option}</Label>
        </label>
      ))}
    </div>
  )
}
