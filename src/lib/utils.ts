import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-US", options).format(new Date(iso))
}

export function formatDateTime(iso: string | null | undefined): string {
  return formatDate(iso, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatTimeOnly(iso: string | null | undefined): string {
  return formatDate(iso, { hour: "numeric", minute: "2-digit" })
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

/** Whole-dollar plan prices use formatCurrency above; usage overage amounts
 *  are computed from per-unit fractional rates ($0.15/min etc.) and need
 *  cents precision to not silently round away real charges. */
export function formatCurrencyPrecise(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000)

  if (diffSec < 60) return "just now"
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`
  const diffDay = Math.round(diffHour / 24)
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`
  const diffMonth = Math.round(diffDay / 30)
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`
  const diffYear = Math.round(diffMonth / 12)
  return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`
}

/** Local YYYY-MM-DD — for <input type="date"> values and grouping timestamps by calendar day. */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Local YYYY-MM-DDTHH:mm — for <input type="datetime-local"> values. */
export function toDateTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${toDateInputValue(date)}T${hours}:${minutes}`
}
