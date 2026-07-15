/** Untyped JSON args (LLM tool-call arguments, jsonb step config, etc.) —
 *  coerce defensively rather than trusting the source sent exactly the
 *  shape expected. */
export function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return undefined
}
