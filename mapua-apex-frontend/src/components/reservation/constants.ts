import type {
  AVItem,
  EquipmentItem,
  ReservationDraft,
  RoomItem,
} from "@/components/reservation/types"

// Ordered catalogs used by the dropdown-to-add selectors. Each table offers the
// catalog minus the rows already added, so an option can never be picked twice.
// The room catalog is campus-specific and lives in `@/lib/campus-rooms`.
export const EQUIPMENT_OPTIONS: string[] = [
  "Monoblock Chairs",
  "White Boards",
  "Tables",
  "Rostrum",
  "Flags (w/ Poles & Stand)",
  "Panel Boards",
]

export const AV_EQUIPMENT_OPTIONS: string[] = [
  "LCD",
  "CPU",
  "Laptop",
  "Computer Speaker",
  "Laser Pointer",
  "Television",
  "DVD",
  "Doc. Cam",
  "Amplifier",
  "Mixer",
  "Speakers",
  "Microphone",
]

export const TABLE_INPUT_CLASS =
  "w-full text-center bg-transparent py-1 px-2 !text-neutral-900 focus:outline-none focus:bg-white rounded border border-transparent focus:border-neutral-300 placeholder:text-neutral-400"

export const ADD_BUTTON_CLASS =
  "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/40 py-3 text-sm font-medium text-neutral-700 shadow-xs transition-all hover:border-neutral-400 hover:bg-neutral-100/50"

// AV, room, and equipment rows are added on demand, so they start empty.
export const DEFAULT_EQUIPMENT_ITEMS: EquipmentItem[] = []
export const DEFAULT_ROOM_ITEMS: RoomItem[] = []
export const DEFAULT_AV_ITEMS: AVItem[] = []

export function reservationHasUserInput(draft: ReservationDraft): boolean {
  return (
    draft.equipmentItems.length > 0 ||
    draft.roomItems.length > 0 ||
    draft.avItems.length > 0
  )
}

export const DEFAULT_RESERVATION_DRAFT: ReservationDraft = {
  equipmentItems: DEFAULT_EQUIPMENT_ITEMS,
  roomItems: DEFAULT_ROOM_ITEMS,
  avItems: DEFAULT_AV_ITEMS,
}

/**
 * Normalizes a possibly-partial stored reservation draft so every nested array
 * always falls back to its default. Shared by the reservation hook and the SAAF
 * wizard (which validates the reservation step straight from the store).
 */
export function withReservationDefaults(
  stored?: ReservationDraft | null
): ReservationDraft {
  return {
    ...DEFAULT_RESERVATION_DRAFT,
    ...(stored ?? {}),
    equipmentItems:
      stored?.equipmentItems ?? DEFAULT_RESERVATION_DRAFT.equipmentItems,
    roomItems: (stored?.roomItems ?? DEFAULT_RESERVATION_DRAFT.roomItems).map(
      // Room drafts saved before classroom codes existed have no classroomName.
      (item) => ({ ...item, classroomName: item.classroomName ?? "" })
    ),
    avItems: stored?.avItems ?? DEFAULT_RESERVATION_DRAFT.avItems,
  }
}
