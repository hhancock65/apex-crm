import { OVERAGE_RATES } from "@/lib/plans"
import type { UsageRecord } from "@/types/usage"

export interface UsageMetric {
  key: "ai_minutes" | "sms" | "calls"
  label: string
  unit: string
  used: number
  included: number
  rate: number
}

export function metricsFor(row: UsageRecord): UsageMetric[] {
  return [
    { key: "ai_minutes", label: "AI Minutes", unit: "min", used: row.ai_minutes_used, included: row.ai_minutes_included, rate: OVERAGE_RATES.aiMinute },
    { key: "sms", label: "SMS", unit: "messages", used: row.sms_sent, included: row.sms_included, rate: OVERAGE_RATES.sms },
    { key: "calls", label: "Calls", unit: "calls", used: row.calls_made, included: row.calls_included, rate: OVERAGE_RATES.call },
  ]
}

// Status colors are the dataviz skill's fixed, never-themed status palette —
// validated for contrast against a light surface, distinct from any
// categorical series color so they never get mistaken for "just another
// series." green < 75% of included, yellow 75–90%, red > 90% (including
// anything already over 100%).
export const STATUS_GOOD = "#0ca30c"
export const STATUS_WARNING = "#fab219"
export const STATUS_CRITICAL = "#d03b3b"

export function statusColorFor(pctOfIncluded: number): string {
  if (pctOfIncluded > 90) return STATUS_CRITICAL
  if (pctOfIncluded >= 75) return STATUS_WARNING
  return STATUS_GOOD
}

// Categorical slot order (fixed, never cycled — validated via
// scripts/validate_palette.js "#2a78d6,#1baf7a,#eda100" --mode light: all
// checks pass; aqua/yellow fall under 3:1 contrast on the light surface, so
// per the dataviz skill's relief rule every bar in UsageMiniChart carries a
// visible value label rather than relying on color alone.
export const CHART_COLORS: Record<UsageMetric["key"], string> = {
  ai_minutes: "#2a78d6",
  sms: "#1baf7a",
  calls: "#eda100",
}
