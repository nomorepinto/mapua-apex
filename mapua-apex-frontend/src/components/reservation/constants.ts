import type { ReservationDraft } from "@/components/reservation/types"

/**
 * The reservation step starts empty: no campus chosen and no reservables picked.
 * Campuses and reservables are loaded from the API (no hardcoded catalog), so
 * there is nothing to prefill here.
 */
export const DEFAULT_RESERVATION_DRAFT: ReservationDraft = {
  campusId: "",
  picks: [],
}

/** True once the proponent has picked at least one reservable. */
export function reservationHasUserInput(draft: ReservationDraft): boolean {
  return draft.picks.length > 0
}

/**
 * Normalizes a possibly-partial stored reservation draft so `picks` and every
 * pick's nested fields always exist. Shared by the reservation hook and the
 * SAAF wizard (which validates the reservation step straight from the store),
 * and tolerant of drafts persisted by an older session.
 */
export function withReservationDefaults(
  stored?: ReservationDraft | null
): ReservationDraft {
  return {
    campusId: stored?.campusId ?? "",
    picks: Array.isArray(stored?.picks)
      ? stored.picks.map((pick) => ({
          ...pick,
          selections: Array.isArray(pick.selections) ? pick.selections : [],
          remarks: pick.remarks ?? "",
        }))
      : [],
  }
}
