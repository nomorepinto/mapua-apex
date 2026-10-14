import type {
  ReservableCapacityFields,
  ReservableType,
  SlotSelection,
} from "@/lib/types"

/**
 * One reservable picked in the SAAF reservation step, together with the concrete
 * dates and 70-minute slots reserved on it. Replaces the old free-text room /
 * audiovisual / equipment rows: every pick maps to a RESERVABLE record owned by
 * a campus, and its `selections` become BOOKING `schedule_selected` entries.
 */
export interface ReservationPick extends ReservableCapacityFields {
  /** Client-only row key used for list rendering; never persisted. */
  id: string
  reservable_id: string
  campus_id: string
  name: string
  type: ReservableType
  /** Concrete dates + slot indices reserved on this reservable. */
  selections: SlotSelection[]
  /** Optional purpose note carried through to the booking. */
  remarks: string
}

/**
 * The reservation step's draft. The chosen campus drives which reservables can
 * be picked and doubles as the event venue; the picks carry the date/slot
 * selections from which the event's date and time are derived.
 */
export interface ReservationDraft {
  /** Campus id chosen in the reservation step ("" until one is picked). */
  campusId: string
  picks: ReservationPick[]
}
