import type {
  AVItem,
  EquipmentItem,
  FacilityItem,
  ReservationDraft,
  RoomItem,
} from "@/components/reservation/types"

// Ordered catalogs used by the dropdown-to-add selectors. Each table offers the
// catalog minus the rows already added, so an option can never be picked twice.
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

export const ROOM_OPTIONS: string[] = ["AV Room", "Seminar Room"]

export const TABLE_INPUT_CLASS =
  "w-full text-center bg-transparent py-1 px-2 !text-neutral-900 focus:outline-none focus:bg-white rounded border border-transparent focus:border-neutral-300 placeholder:text-neutral-400"

export const PURPOSE_INPUT_CLASS =
  "w-full bg-white border border-neutral-300 rounded-lg px-3.5 py-2 text-xs !text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-red-700"

export const ADD_BUTTON_CLASS =
  "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/40 py-3 text-sm font-medium text-neutral-700 shadow-xs transition-all hover:border-neutral-400 hover:bg-neutral-100/50"

// AV, room, and equipment rows are added on demand, so they start empty.
export const DEFAULT_EQUIPMENT_ITEMS: EquipmentItem[] = []
export const DEFAULT_ROOM_ITEMS: RoomItem[] = []
export const DEFAULT_AV_ITEMS: AVItem[] = []

// Exactly 1 row with item: "" so the placeholder shows
export const DEFAULT_FACILITY_ITEMS: FacilityItem[] = [
  {
    id: "1",
    item: "",
    dateOfUse: "",
    endDateOfUse: "",
    timeOfUse: "",
    endTimeOfUse: "",
    location: "",
  },
]

function filled(value: string | undefined): boolean {
  return Boolean(value && value.trim())
}

export function reservationHasUserInput(draft: ReservationDraft): boolean {
  if (draft.equipmentItems.length > 0) return true
  if (
    filled(draft.purpose) ||
    filled(draft.functionRoomPurpose) ||
    filled(draft.avPurpose)
  ) {
    return true
  }
  if (draft.facilityItems.length !== DEFAULT_FACILITY_ITEMS.length) return true
  if (
    draft.facilityItems.some((item) => [item.item, item.location].some(filled))
  ) {
    return true
  }
  if (draft.roomItems.length > 0) return true
  if (draft.avItems.length > 0) return true
  return false
}

export const DEFAULT_RESERVATION_DRAFT: ReservationDraft = {
  equipmentItems: DEFAULT_EQUIPMENT_ITEMS,
  purpose: "",
  functionRoomPurpose: "",
  avPurpose: "",
  facilityItems: DEFAULT_FACILITY_ITEMS,
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
    facilityItems:
      stored?.facilityItems ?? DEFAULT_RESERVATION_DRAFT.facilityItems,
    roomItems: stored?.roomItems ?? DEFAULT_RESERVATION_DRAFT.roomItems,
    avItems: stored?.avItems ?? DEFAULT_RESERVATION_DRAFT.avItems,
  }
}
