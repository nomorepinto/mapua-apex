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

export interface EquipmentItem {
  id: string
  name: string
  purpose: string
  remark: string
}

export interface ReservationDraft {
  equipmentItems: EquipmentItem[]
  roomItems: RoomItem[]
  avItems: AVItem[]
}