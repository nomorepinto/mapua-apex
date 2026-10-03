import type {
  AVItem,
  EquipmentFlags,
  FacilityItem,
  ReservationDraft,
  RoomItem,
} from "@/components/reservation/types"

export const EQUIPMENT_OPTIONS: { key: keyof Omit<EquipmentFlags, "others">; label: string }[] =
  [
    { key: "monoblock", label: "Monoblock Chairs" },
    { key: "whiteboards", label: "White Boards" },
    { key: "tables", label: "Tables" },
    { key: "rostrum", label: "Rostrum" },
    { key: "flags", label: "Flags (w/ Poles & Stand)" },
    { key: "panelBoards", label: "Panel Boards" },
  ]

export const FIXED_AV_EQUIPMENT = new Set([
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
])

export const PRESET_ROOMS = new Set(["AV Room", "Seminar Room"])

export const TABLE_INPUT_CLASS =
  "w-full text-center bg-transparent py-1 px-2 !text-neutral-900 focus:outline-none focus:bg-white rounded border border-transparent focus:border-neutral-300 placeholder:text-neutral-400"

export const PURPOSE_INPUT_CLASS =
  "w-full bg-white border border-neutral-300 rounded-lg px-3.5 py-2 text-xs !text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-red-700"

export const DEFAULT_EQUIPMENT: EquipmentFlags = {
  monoblock: false,
  whiteboards: false,
  tables: false,
  rostrum: false,
  flags: false,
  panelBoards: false,
  others: false,
}

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

// Exactly 2 preset rooms; "Others" rows removed
export const DEFAULT_ROOM_ITEMS: RoomItem[] = [
  {
    id: "1",
    dateNeeded: "",
    endDateNeeded: "",
    timeNeeded: "",
    endTimeNeeded: "",
    roomNeeded: "AV Room",
    remarks: "",
  },
  {
    id: "2",
    dateNeeded: "",
    endDateNeeded: "",
    timeNeeded: "",
    endTimeNeeded: "",
    roomNeeded: "Seminar Room",
    remarks: "",
  },
]

// 12 standard items; static "Others" row removed
export const DEFAULT_AV_ITEMS: AVItem[] = [
  { id: "1", dateNeeded: "", endDateNeeded: "", timeNeeded: "", endTimeNeeded: "", equipmentNeeded: "LCD", remarks: "" },
  { id: "2", dateNeeded: "", endDateNeeded: "", timeNeeded: "", endTimeNeeded: "", equipmentNeeded: "CPU", remarks: "" },
  { id: "3", dateNeeded: "", endDateNeeded: "", timeNeeded: "", endTimeNeeded: "", equipmentNeeded: "Laptop", remarks: "" },
  { id: "4", dateNeeded: "", endDateNeeded: "", timeNeeded: "", endTimeNeeded: "", equipmentNeeded: "Computer Speaker", remarks: "" },
  { id: "5", dateNeeded: "", endDateNeeded: "", timeNeeded: "", endTimeNeeded: "", equipmentNeeded: "Laser Pointer", remarks: "" },
  { id: "6", dateNeeded: "", endDateNeeded: "", timeNeeded: "", endTimeNeeded: "", equipmentNeeded: "Television", remarks: "" },
  { id: "7", dateNeeded: "", endDateNeeded: "", timeNeeded: "", endTimeNeeded: "", equipmentNeeded: "DVD", remarks: "" },
  { id: "8", dateNeeded: "", endDateNeeded: "", timeNeeded: "", endTimeNeeded: "", equipmentNeeded: "Doc. Cam", remarks: "" },
  { id: "9", dateNeeded: "", endDateNeeded: "", timeNeeded: "", endTimeNeeded: "", equipmentNeeded: "Amplifier", remarks: "" },
  { id: "10", dateNeeded: "", endDateNeeded: "", timeNeeded: "", endTimeNeeded: "", equipmentNeeded: "Mixer", remarks: "" },
  { id: "11", dateNeeded: "", endDateNeeded: "", timeNeeded: "", endTimeNeeded: "", equipmentNeeded: "Speakers", remarks: "" },
  { id: "12", dateNeeded: "", endDateNeeded: "", timeNeeded: "", endTimeNeeded: "", equipmentNeeded: "Microphone", remarks: "" },
]

function filled(value: string | undefined): boolean {
  return Boolean(value && value.trim())
}

export function reservationHasUserInput(draft: ReservationDraft): boolean {
  if (Object.values(draft.equipment).some(Boolean)) return true
  if (filled(draft.otherEquipmentText) || filled(draft.purpose)) return true
  if (filled(draft.functionRoomPurpose) || filled(draft.avPurpose)) return true
  if (draft.facilityItems.length !== DEFAULT_FACILITY_ITEMS.length) return true
  if (
    draft.facilityItems.some((item) =>
      [item.item, item.dateOfUse, item.endDateOfUse, item.timeOfUse, item.endTimeOfUse, item.location].some(filled)
    )
  ) {
    return true
  }
  if (draft.roomItems.length !== DEFAULT_ROOM_ITEMS.length) return true
  if (
    draft.roomItems.some(
      (item, index) =>
        item.roomNeeded !== DEFAULT_ROOM_ITEMS[index]?.roomNeeded ||
        [item.dateNeeded, item.endDateNeeded, item.timeNeeded, item.endTimeNeeded, item.remarks].some(filled)
    )
  ) {
    return true
  }
  if (draft.avItems.length !== DEFAULT_AV_ITEMS.length) return true
  return draft.avItems.some(
    (item, index) =>
      item.equipmentNeeded !== DEFAULT_AV_ITEMS[index]?.equipmentNeeded ||
      [item.dateNeeded, item.endDateNeeded, item.timeNeeded, item.endTimeNeeded, item.remarks].some(filled)
  )
}

export const DEFAULT_RESERVATION_DRAFT: ReservationDraft = {
  equipment: DEFAULT_EQUIPMENT,
  otherEquipmentText: "",
  purpose: "",
  functionRoomPurpose: "",
  avPurpose: "",
  facilityItems: DEFAULT_FACILITY_ITEMS,
  roomItems: DEFAULT_ROOM_ITEMS,
  avItems: DEFAULT_AV_ITEMS,
}