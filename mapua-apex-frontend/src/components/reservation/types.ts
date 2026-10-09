export interface RoomItem {
  id: string
  dateNeeded: string
  endDateNeeded: string
  timeNeeded: string
  endTimeNeeded: string
  roomNeeded: string
  /**
   * Classroom code typed by the proponent; only meaningful on a "Classroom"
   * row and validated against the venue campus format.
   */
  classroomName: string
  remarks: string
  /**
   * True when the row came from the "Others" option, so `roomNeeded` is a
   * free-text name typed by the proponent instead of a fixed campus room.
   */
  isOther?: boolean
}

export interface AVItem {
  id: string
  dateNeeded: string
  endDateNeeded: string
  timeNeeded: string
  endTimeNeeded: string
  equipmentNeeded: string
  remarks: string
  /** True when `equipmentNeeded` is a free-text "Others" entry. */
  isOther?: boolean
}

export interface EquipmentItem {
  id: string
  name: string
  purpose: string
  remark: string
  /** True when `name` is a free-text "Others" entry. */
  isOther?: boolean
}

export interface ReservationDraft {
  equipmentItems: EquipmentItem[]
  roomItems: RoomItem[]
  avItems: AVItem[]
}