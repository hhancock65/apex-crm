export type DateRangePreset = "7d" | "30d" | "90d" | "custom"

export interface DateRange {
  start: Date
  end: Date
  preset: DateRangePreset
}

export const PRESET_DAYS: Record<Exclude<DateRangePreset, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90 }
export const PRESET_LABELS: Record<Exclude<DateRangePreset, "custom">, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
}

export function getPresetRange(preset: Exclude<DateRangePreset, "custom">): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - PRESET_DAYS[preset])
  return { start, end }
}

export function defaultDateRange(): DateRange {
  return { ...getPresetRange("30d"), preset: "30d" }
}

/** Same length as the current range, immediately before it — powers every
 *  "vs previous period" comparison in the analytics pages. */
export function previousPeriod(range: DateRange): { start: Date; end: Date } {
  const spanMs = range.end.getTime() - range.start.getTime()
  return { start: new Date(range.start.getTime() - spanMs), end: new Date(range.start.getTime()) }
}
