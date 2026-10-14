import type { ApiReservable } from "@/lib/types"

/**
 * Room participant bounds (`min_participants` / `max_participants`).
 *
 * Mirrors backend `ReservableSchedule::withinCapacity/capacityLabel`: bounds are
 * room-only and optional — equipment and rooms without stated bounds never fail
 * the check. Keeping the math here means the SAAF wizard blocks an out-of-range
 * headcount before submit instead of eating a 422 from the API.
 */
export interface CapacityBounds {
  min?: number | null
  max?: number | null
}

function bound(value?: number | string | null): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Whether an expected headcount fits the bounds (null headcount = unknown = allowed). */
export function withinCapacity(
  bounds: CapacityBounds | null | undefined,
  expectedParticipants?: number | null
): boolean {
  if (expectedParticipants === null || expectedParticipants === undefined) {
    return true
  }

  const min = bound(bounds?.min)
  const max = bound(bounds?.max)

  if (min !== null && expectedParticipants < min) return false
  if (max !== null && expectedParticipants > max) return false

  return true
}

/** "50–100" / "up to 100" / "at least 50" — "" when no bound is stated. */
export function capacityRangeLabel(bounds: CapacityBounds | null | undefined): string {
  const min = bound(bounds?.min)
  const max = bound(bounds?.max)

  if (min !== null && max !== null) return `${min}–${max}`
  if (max !== null) return `up to ${max}`
  if (min !== null) return `at least ${min}`

  return ""
}

/** Capacity as stored on an API reservable (equipment never carries bounds). */
export function reservableCapacity(
  reservable: Pick<ApiReservable, "type" | "min_participants" | "max_participants">
): CapacityBounds {
  if (reservable.type !== "room") return {}
  return { min: reservable.min_participants ?? null, max: reservable.max_participants ?? null }
}

/**
 * The sentence shown when a picked room cannot hold (or is oversized for) the
 * expected attendance. `range` comes from `capacityRangeLabel`.
 */
export function capacityIssue(
  name: string,
  bounds: CapacityBounds,
  expectedParticipants: number
): string {
  const min = bound(bounds.min)
  const max = bound(bounds.max)

  if (min !== null && expectedParticipants < min) {
    return `"${name}" needs at least ${min} participants — expected is ${expectedParticipants}.`
  }

  if (max !== null && expectedParticipants > max) {
    return `"${name}" holds at most ${max} participants — expected is ${expectedParticipants}.`
  }

  return `"${name}" does not fit the expected number of participants.`
}
