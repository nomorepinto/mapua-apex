export const EVENT_MINUTES = [
  "00",
  "05",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
  "55",
]

export const EVENT_HOURS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
]

export const EVENT_WINDOW_START = 7 * 60
export const EVENT_WINDOW_END = 21 * 60

export type Period = "AM" | "PM"

export type ClockParts = {
  hour: string
  minute: string
  period: Period | ""
}

export const EMPTY_CLOCK: ClockParts = { hour: "", minute: "", period: "" }

function slotMinutes(hour12: string, minute: string, period: Period): number | null {
  const hour = Number(hour12)
  const mins = Number(minute)
  if (!Number.isInteger(hour) || !Number.isInteger(mins)) return null
  if (hour < 1 || hour > 12 || mins < 0 || mins > 59) return null
  let hours24 = hour % 12
  if (period === "PM") hours24 += 12
  return hours24 * 60 + mins
}

export function clockMinutes(parts: ClockParts): number | null {
  if (parts.period !== "AM" && parts.period !== "PM") return null
  return slotMinutes(parts.hour, parts.minute, parts.period)
}

export function format24(parts: ClockParts): string {
  const total = clockMinutes(parts)
  if (total === null) return ""
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

export function parse24(value: string): ClockParts {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return { ...EMPTY_CLOCK }
  const hours = Number(match[1])
  const minute = match[2]
  if (!Number.isInteger(hours) || hours > 23 || Number(minute) > 59) {
    return { ...EMPTY_CLOCK }
  }
  const period: Period = hours >= 12 ? "PM" : "AM"
  return { hour: String(hours % 12 || 12), minute, period }
}

export function splitEventTime(value: string): { start: string; end: string } {
  if (!value.includes(" - ")) return { start: value.trim(), end: "" }
  const [start, end] = value.split(" - ")
  return { start: (start ?? "").trim(), end: (end ?? "").trim() }
}

export function combineEventTime(start: string, end: string): string {
  if (start && end) return `${start} - ${end}`
  return start
}

export function clockFromDraft(
  hour: string | undefined,
  minute: string | undefined,
  period: string | undefined,
  fallback24: string
): ClockParts {
  if (hour === undefined && minute === undefined && period === undefined) {
    return parse24(fallback24)
  }
  return {
    hour: hour ?? "",
    minute: minute ?? "",
    period: period === "AM" || period === "PM" ? period : "",
  }
}

export function withHour(parts: ClockParts, hour: string): ClockParts {
  return { ...parts, hour }
}

export function withPeriod(parts: ClockParts, period: Period): ClockParts {
  return { ...parts, period }
}

export function minuteChoices(current: string): string[] {
  if (current && !EVENT_MINUTES.includes(current)) {
    return [...EVENT_MINUTES, current].sort()
  }
  return [...EVENT_MINUTES]
}

export function hourChoices(current: string): string[] {
  if (current && !EVENT_HOURS.includes(current)) return [...EVENT_HOURS, current]
  return [...EVENT_HOURS]
}

export const SAME_EVENT_TIME_MESSAGE =
  "Start time and end time cannot be the same."
