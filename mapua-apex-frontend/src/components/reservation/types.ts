export interface FacilityItem {
  id: string
  item: string
  dateOfUse: string
  endDateOfUse: string
  timeOfUse: string
  endTimeOfUse: string
  location: string
}

export interface RoomItem {
  id: string
  dateNeeded: string
  endDateNeeded: string
  timeNeeded: string
  endTimeNeeded: string
  roomNeeded: string
  remarks: string
}

export interface AVItem {
  id: string
  dateNeeded: string
  endDateNeeded: string
  timeNeeded: string
  endTimeNeeded: string
  equipmentNeeded: string
  remarks: string
}

export interface EquipmentFlags {
  monoblock: boolean
  whiteboards: boolean
  tables: boolean
  rostrum: boolean
  flags: boolean
  panelBoards: boolean
  others: boolean
}

export interface ReservationDraft {
  equipment: EquipmentFlags
  otherEquipmentText: string
  purpose: string
  functionRoomPurpose: string
  avPurpose: string
  facilityItems: FacilityItem[]
  roomItems: RoomItem[]
  avItems: AVItem[]
}