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

/** A reservable that carries the room participant bounds. */
export type CapacityReservable = Pick<
  ApiReservable,
  "type" | "name" | "min_participants" | "max_participants"
>

/** One suggested room, and how well it matches the expected headcount. */
export interface RoomSuggestion<T extends CapacityReservable> {
  reservable: T
  /** Whether the room's stated bounds accept the headcount outright. */
  fits: boolean
  /**
   * Seats short of the ceiling, or seats over the floor. Zero exactly when the
   * room fits, so the closest rooms sort first when nothing does.
   */
  shortfall: number
}

/** How far a headcount is outside a room's bounds. Zero when it is inside. */
function shortfallFor(bounds: CapacityBounds, headcount: number): number {
  const min = bound(bounds.min)
  const max = bound(bounds.max)
  const tooFew = min !== null && headcount < min ? min - headcount : 0
  const tooMany = max !== null && headcount > max ? headcount - max : 0
  return tooFew + tooMany
}

/**
 * Rooms to offer for an expected headcount, best match first.
 *
 * When at least one room fits, the fits are ranked best-fit — the smallest
 * sufficient ceiling first, so a 300-pax hall is not offered for 40 people.
 * When none fits, the closest rooms are ranked instead, which reads as the
 * largest rooms for an oversized headcount and the smallest for an undersized
 * one; the existing under-capacity warning still tells the student to add
 * another room.
 *
 * Rooms that state no bounds at all are left out: there is no capacity to match
 * on, and the room dropdown already lists every candidate.
 */
export function suggestRooms<T extends CapacityReservable>(
  candidates: readonly T[],
  headcount: number | null,
  limit = 3
): Array<RoomSuggestion<T>> {
  if (headcount === null || !Number.isFinite(headcount) || headcount <= 0) {
    return []
  }

  const scored = candidates
    .filter((reservable) => reservable.type === "room")
    .map((reservable) => {
      const bounds = reservableCapacity(reservable)
      return {
        reservable,
        bounds,
        shortfall: shortfallFor(bounds, headcount),
      }
    })
    .filter(
      (entry) =>
        bound(entry.bounds.min) !== null || bound(entry.bounds.max) !== null
    )

  if (scored.length === 0) return []

  const fits = scored.filter((entry) => entry.shortfall === 0)
  const ceilingOf = (entry: (typeof scored)[number]): number =>
    bound(entry.bounds.max) ?? Number.POSITIVE_INFINITY

  const ranked =
    fits.length > 0
      ? fits.sort(
          (left, right) =>
            ceilingOf(left) - ceilingOf(right) ||
            left.reservable.name.localeCompare(right.reservable.name)
        )
      : scored.sort(
          (left, right) =>
            left.shortfall - right.shortfall ||
            ceilingOf(right) - ceilingOf(left) ||
            left.reservable.name.localeCompare(right.reservable.name)
        )

  return ranked.slice(0, limit).map((entry) => ({
    reservable: entry.reservable,
    fits: entry.shortfall === 0,
    shortfall: entry.shortfall,
  }))
}
