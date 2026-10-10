import { getDateKey, parseDateKey } from "@/lib/date-key"

/**
 * Shared calendar helpers used by both the admin (OSAAR) applications calendar
 * and the CDM reservations calendar.
 *
 * These are pure, presentational utilities only. Each dashboard keeps its own
 * status-mapping and data-fetching logic, since they operate on different
 * domain types (`DashboardSubmissionRow` vs `Activity`).
 */

export type CalendarStatusFilter = "all" | "approved" | "under_review" | "denied"
export type CalendarDateMode = "event_date" | "submission_date"

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/**
 * Coerces an ISO timestamp or `YYYY-MM-DD` string into a local `YYYY-MM-DD`
 * date key, returning `null` when the value is missing or unparseable.
 */
export function toLocalDateKey(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const keyMatch = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)
  if (keyMatch) return keyMatch[1]

  const date = new Date(trimmed)
  if (isNaN(date.getTime())) return null
  return getDateKey(date)
}

/**
 * Expands an inclusive start/end date pair into the list of local date keys it
 * spans. Falls back to a single-day range when the end is missing, invalid, or
 * before the start. Capped at 14 days to guard against runaway intervals.
 */
export function getDatesInRange(startDateStr?: string, endDateStr?: string): string[] {
  const startKey = toLocalDateKey(startDateStr)
  if (!startKey) return []
  const endKey = endDateStr ? toLocalDateKey(endDateStr) : null
  if (!endKey || endKey === startKey) {
    return [startKey]
  }

  const startDate = parseDateKey(startKey)
  const endDate = parseDateKey(endKey)
  if (!startDate || !endDate || endDate < startDate) {
    return [startKey]
  }

  const keys: string[] = []
  const current = new Date(startDate)
  let count = 0
  // Guard against runaway multi-month intervals
  while (current <= endDate && count < 14) {
    keys.push(getDateKey(current))
    current.setDate(current.getDate() + 1)
    count++
  }
  return keys
}
