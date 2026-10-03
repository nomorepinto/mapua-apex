export const EVENT_DATE_MIN_LEAD_DAYS = 10

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
  return addDays(startOfLocalDay(), EVENT_DATE_MIN_LEAD_DAYS)
}

export function minEventDateKey(): string {
  return getDateKey(minEventDate())
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
