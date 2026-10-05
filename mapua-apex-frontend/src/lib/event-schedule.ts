import { splitEventTime } from "@/components/submission/event-time"
import type { ReservationDraft } from "@/components/reservation/types"
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
 * Derives the reservation schedule from the SAAF event details.
 *
 * Function room and audiovisual reservations are always locked to the event's
 * own date/time so an earlier SAAF input can never disagree with a later
 * reservation input. Every consumer (reservation tables, the API payload, and
 * the generated PDF) reads the schedule from this single source.
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

/**
 * Returns a copy of the reservation draft with every room and AV item's
 * date/time overwritten by the event schedule. Used on the PDF path so the
 * printed reservation always matches the locked values shown in the form.
 */
export function withEventSchedule(
  draft: ReservationDraft,
  schedule: EventSchedule
): ReservationDraft {
  return {
    ...draft,
    roomItems: draft.roomItems.map((item) => ({
      ...item,
      dateNeeded: schedule.startDate,
      endDateNeeded: schedule.endDate,
      timeNeeded: schedule.startTime,
      endTimeNeeded: schedule.endTime,
    })),
    avItems: draft.avItems.map((item) => ({
      ...item,
      dateNeeded: schedule.startDate,
      endDateNeeded: schedule.endDate,
      timeNeeded: schedule.startTime,
      endTimeNeeded: schedule.endTime,
    })),
  }
}
