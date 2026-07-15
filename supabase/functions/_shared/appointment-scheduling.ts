// Pure date/time helpers for AI-driven appointment scheduling
// (retell-function-handler's check_availability / book_appointment /
// reschedule_appointment / cancel_appointment). No timezone concept exists
// anywhere else in this schema (organizations has no timezone column), so —
// consistent with the rest of the app — every date/time here is treated as
// a plain "wall clock" value, stored and read back as UTC. That's a real
// simplification, not a fabricated guarantee: if a business operates outside
// UTC, these labels/slots will be offset from its actual local day until a
// proper org timezone is introduced.

export interface AppointmentSettings {
  startMinutes: number
  endMinutes: number
  slotMinutes: number
}

const DEFAULT_START = "08:00"
const DEFAULT_END = "17:00"
const DEFAULT_SLOT_MINUTES = 60

export function parseHHMM(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

/** Reads `appointment_hours_start` / `appointment_hours_end` (24h "HH:MM")
 *  and `appointment_slot_minutes` from organizations.settings, falling back
 *  to 8AM-5PM / 60-minute slots. These are separate keys from the
 *  free-text `business_hours` setting prompt-builder.ts reads for the
 *  agent's spoken prompt — that one's for a human/LLM to read, not to parse. */
export function getAppointmentSettings(orgSettings: Record<string, unknown>): AppointmentSettings {
  const start =
    typeof orgSettings.appointment_hours_start === "string"
      ? orgSettings.appointment_hours_start
      : DEFAULT_START
  const end =
    typeof orgSettings.appointment_hours_end === "string" ? orgSettings.appointment_hours_end : DEFAULT_END
  const slotMinutes =
    typeof orgSettings.appointment_slot_minutes === "number" && orgSettings.appointment_slot_minutes > 0
      ? orgSettings.appointment_slot_minutes
      : DEFAULT_SLOT_MINUTES

  return {
    startMinutes: parseHHMM(start) ?? parseHHMM(DEFAULT_START)!,
    endMinutes: parseHHMM(end) ?? parseHHMM(DEFAULT_END)!,
    slotMinutes,
  }
}

export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}

/** Accepts both the 24-hour "HH:MM" a tool caller might send and the
 *  12-hour "h:mm AM/PM" labels check_availability hands back — the AI
 *  Employee naturally echoes whichever one it just read out to the caller. */
export function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim()

  const time24 = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (time24) {
    const hours = Number(time24[1])
    const minutes = Number(time24[2])
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) return hours * 60 + minutes
    return null
  }

  const time12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(trimmed)
  if (time12) {
    let hours = Number(time12[1])
    const minutes = Number(time12[2])
    const period = time12[3].toUpperCase()
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null
    if (period === "AM") hours = hours === 12 ? 0 : hours
    else hours = hours === 12 ? 12 : hours + 12
    return hours * 60 + minutes
  }

  return null
}

export function minutesToTimeLabel(minutes: number): string {
  const hours24 = Math.floor(minutes / 60)
  const mins = minutes % 60
  const period = hours24 >= 12 ? "PM" : "AM"
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return `${hours12}:${String(mins).padStart(2, "0")} ${period}`
}

export function buildIsoDateTime(date: string, minutesSinceMidnight: number): string {
  const hh = String(Math.floor(minutesSinceMidnight / 60)).padStart(2, "0")
  const mm = String(minutesSinceMidnight % 60).padStart(2, "0")
  return `${date}T${hh}:${mm}:00.000Z`
}

export function minutesSinceUtcMidnight(iso: string): number {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

export function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })
}

export function formatTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  })
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart
}
