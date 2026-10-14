export const EVENT_DATE_MIN_LEAD_DAYS = 10

/**
 * Local-only escape hatch. Set VITE_ALLOW_ANY_EVENT_DATE=true in the repo-root
 * .env to lift the 10-day minimum lead so proposals and reservations can be
 * dated today or any date (including the past) for testing time-sensitive
 * features. The root .env is gitignored and never used by deployed builds, so
 * the 10-day rule stays enforced everywhere else.
 */
export const ALLOW_ANY_EVENT_DATE =
  import.meta.env.VITE_ALLOW_ANY_EVENT_DATE === "true"

export const EVENT_DATE_TOO_SOON_MESSAGE =
  "The date of event must be at least 10 days from today."

export function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function parseDateKey(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return undefined

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }

  return date
}

export function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function minEventDate(): Date {
  return addDays(
    startOfLocalDay(),
    ALLOW_ANY_EVENT_DATE ? 0 : EVENT_DATE_MIN_LEAD_DAYS,
  )
}

export function minEventDateKey(): string {
  return getDateKey(minEventDate())
}

/**
 * Date-picker floor. Returns `undefined` when the override is on so the picker
 * imposes no minimum and any date (including the past) is selectable.
 */
export function eventDateFloor(): Date | undefined {
  return ALLOW_ANY_EVENT_DATE ? undefined : minEventDate()
}

export function eventDateFloorKey(): string | undefined {
  return ALLOW_ANY_EVENT_DATE ? undefined : minEventDateKey()
}

export function formatDisplayDate(
  date: Date,
  style: "short" | "long" = "short"
): string {
  return date.toLocaleDateString("en-US", {
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
  })
}
