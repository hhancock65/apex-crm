import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PRESET_DAYS, PRESET_LABELS, getPresetRange, type DateRange, type DateRangePreset } from "@/lib/date-range"
import { toDateInputValue } from "@/lib/utils"

interface DateRangeSelectorProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  function selectPreset(preset: Exclude<DateRangePreset, "custom">) {
    onChange({ ...getPresetRange(preset), preset })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(PRESET_DAYS) as Exclude<DateRangePreset, "custom">[]).map((preset) => (
        <Button
          key={preset}
          type="button"
          size="sm"
          variant={value.preset === preset ? "default" : "outline"}
          onClick={() => selectPreset(preset)}
        >
          {PRESET_LABELS[preset]}
        </Button>
      ))}
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          className="h-9 w-[9.5rem]"
          value={toDateInputValue(value.start)}
          max={toDateInputValue(value.end)}
          onChange={(e) => e.target.value && onChange({ start: new Date(`${e.target.value}T00:00:00`), end: value.end, preset: "custom" })}
        />
        <span className="text-xs text-slate-400">to</span>
        <Input
          type="date"
          className="h-9 w-[9.5rem]"
          value={toDateInputValue(value.end)}
          min={toDateInputValue(value.start)}
          onChange={(e) => e.target.value && onChange({ start: value.start, end: new Date(`${e.target.value}T23:59:59`), preset: "custom" })}
        />
      </div>
    </div>
  )
}
