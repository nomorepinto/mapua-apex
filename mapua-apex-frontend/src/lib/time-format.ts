/**
 * Clock display format for time labels, driven by the `VITE_TIME_FORMAT` env var
 * so the 12-/24-hour choice can be flipped without touching code.
 *
 * This affects DISPLAY only. Persisted / exported times (the event
 * `time_of_event`, SAAF PDFs) are produced elsewhere in canonical 24-hour
 * `HH:MM` and are intentionally left untouched here.
 */

export type ClockFormat = "12" | "24"

/**
 * Resolve the configured format. Defaults to 12-hour when the variable is
 * unset; set `VITE_TIME_FORMAT=24` (or `24h` / `h24`) to switch back.
 */
export function clockFormat(): ClockFormat {
  const raw = String(import.meta.env.VITE_TIME_FORMAT ?? "")
    .trim()
    .toLowerCase()
  return raw === "24" || raw === "24h" || raw === "h24" ? "24" : "12"
}

/** Minutes-from-midnight → clock string in the given format (defaults to env). */
export function formatMinutesOfDay(
  minutes: number,
  format: ClockFormat = clockFormat()
): string {
  const total = ((minutes % 1440) + 1440) % 1440
  const hour24 = Math.floor(total / 60)
  const mm = String(total % 60).padStart(2, "0")
  if (format === "24") {
    return `${String(hour24).padStart(2, "0")}:${mm}`
  }
  const period = hour24 < 12 ? "AM" : "PM"
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${mm} ${period}`
}

/** Matches 24-hour `HH:MM` clock tokens inside a larger string. */
const HHMM_TOKEN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g

/**
 * Reformat every 24-hour `HH:MM` token in a display string (a single time or a
 * range such as `07:00-08:10` / `07:00 - 08:10`) into the configured format.
 * Text without clock tokens (e.g. "All Day") is returned unchanged, and a
 * 24-hour configuration is a no-op.
 */
export function formatClockText(
  value: string | null | undefined,
  format: ClockFormat = clockFormat()
): string {
  if (!value) return ""
  if (format === "24") return value
  return value.replace(HHMM_TOKEN, (_match, hour: string, mm: string) => {
    const hour24 = Number(hour)
    const period = hour24 < 12 ? "AM" : "PM"
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
    return `${hour12}:${mm} ${period}`
  })
}
