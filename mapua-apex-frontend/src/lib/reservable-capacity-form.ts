import type { ReservableType } from "@/lib/types"

/**
 * Form-side helpers for a room's participant bounds (`min_participants` /
 * `max_participants`). Kept out of the component module so the `.tsx` only
 * exports a React component (fast-refresh rule), while the pure mapping between
 * the on-screen text inputs and the API payload lives here.
 */

/** Inclusive bounds enforced by the API (`StoreReservableRequest`). */
export const MAX_PARTICIPANT_VALUE = 3000

export type ParticipantBound = {
  min: string
  max: string
}

const EMPTY_BOUND: ParticipantBound = { min: "", max: "" }

/** Participant bounds apply to rooms only, so equipment never carries them. */
export function stripCapacityForType(
  type: ReservableType,
  bounds: ParticipantBound
): ParticipantBound {
  return type === "room" ? bounds : EMPTY_BOUND
}

/** Trimmed numeric strings for the API payload (null when a bound is blank). */
export function participantBoundPayload(bounds: ParticipantBound): {
  min_participants: number | null
  max_participants: number | null
} {
  return {
    min_participants: bounds.min.trim() === "" ? null : Number(bounds.min.trim()),
    max_participants: bounds.max.trim() === "" ? null : Number(bounds.max.trim()),
  }
}

export function participantBoundsFromValues(
  min?: number | null,
  max?: number | null
): ParticipantBound {
  return {
    min: min === null || min === undefined ? "" : String(min),
    max: max === null || max === undefined ? "" : String(max),
  }
}

/**
 * Validate the two bounds as a pair. Returns the error to show, or null when the
 * pair is usable (blank counts as "no limit", which is always allowed).
 */
export function validateParticipantBounds(bounds: ParticipantBound): string | null {
  const rawMin = bounds.min.trim()
  const rawMax = bounds.max.trim()

  if (rawMin === "" && rawMax === "") return null

  const min = Number(rawMin)
  const max = Number(rawMax)

  if (rawMin !== "" && (min < 1 || min > MAX_PARTICIPANT_VALUE)) {
    return `The minimum participants must be between 1 and ${MAX_PARTICIPANT_VALUE.toLocaleString("en-PH")}.`
  }

  if (rawMax !== "" && (max < 1 || max > MAX_PARTICIPANT_VALUE)) {
    return `The maximum participants must be between 1 and ${MAX_PARTICIPANT_VALUE.toLocaleString("en-PH")}.`
  }

  if (rawMin !== "" && rawMax !== "" && min > max) {
    return "The minimum participants cannot exceed the maximum."
  }

  return null
}
