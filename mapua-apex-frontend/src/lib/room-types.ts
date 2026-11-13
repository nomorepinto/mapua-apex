import type { RoomType } from "@/lib/types"

/**
 * Room categories offered on the Add Room / Edit reservable forms. Only
 * `classroom` carries the campus naming rule (see campus-classroom-format);
 * the other categories have no extra restrictions.
 */
export const ROOM_TYPE_OPTIONS: { value: RoomType; label: string }[] = [
  { value: "function_room", label: "Function Room" },
  { value: "classroom", label: "Classroom" },
  { value: "multi_purpose_hall", label: "Multi-Purpose Hall" },
  { value: "open_space", label: "Open Space" },
  { value: "laboratory", label: "Laboratory" },
]

export const DEFAULT_ROOM_TYPE: RoomType = "function_room"

/** Display label for a stored room type; falls back to "Room" when absent. */
export function roomTypeLabel(value?: RoomType | null): string {
  return ROOM_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Room"
}