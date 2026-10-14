import { splitEventTime } from "@/components/submission/event-time"
import type { SaafDraft } from "@/components/submission/types"

export interface EventSchedule {
  /** Event start date, `YYYY-MM-DD` (DatePicker compatible). */
  startDate: string
  /** Event end date, falls back to the start date for single-day events. */
  endDate: string
  /** Event start time, `HH:MM` 24h (TimePicker compatible). */
  startTime: string
  /** Event end time, falls back to the start time when unset. */
  endTime: string
}

/**
 * Derives the event schedule from the SAAF event details.
 *
 * In the reservation flow the event's date and time are themselves derived from
 * the reserved slots and written back into the draft, so this stays the single
 * place every consumer (the API payload and the generated PDF) reads them from.
 */
export function getEventSchedule(
  saafDraft: SaafDraft | null | undefined
): EventSchedule {
  const startDate = saafDraft?.dateOfEvent ?? ""
  const endDate = saafDraft?.endDateOfEvent || startDate
  const stored = splitEventTime(saafDraft?.timeOfEvent ?? "")
  const startTime = saafDraft?.timeOfEventStart || stored.start || ""
  const endTime = saafDraft?.timeOfEventEnd || stored.end || startTime
  return { startDate, endDate, startTime, endTime }
}
