import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROOM_TYPE_OPTIONS } from "@/lib/room-types"
import type { RoomType } from "@/lib/types"

/**
 * Room-only `room_type` picker, shown above the room name input. Only the
 * classroom category carries a naming rule: when it is selected the required
 * campus name format is shown (the form validates the name against it before
 * submit); the other categories have no extra restrictions.
 */
export function ReservableRoomTypeField({
  id,
  value,
  hasCampusFormat,
  formatHint,
  disabled,
  onChange,
}: {
  id: string
  value: RoomType
  /** Whether the selected campus defines a classroom naming format. */
  hasCampusFormat: boolean
  /** e.g. "MPO / NW / N followed by exactly 3 digits" — shown for classrooms. */
  formatHint: string | null
  /** Set while the surrounding mutation is in flight. */
  disabled: boolean
  onChange: (value: RoomType) => void
}) {
  const description =
    value !== "classroom"
      ? "Only classrooms follow the campus naming format."
      : !hasCampusFormat
        ? "This campus has no classroom name format yet. Ask OSAAR to set one before adding classrooms."
        : formatHint
          ? `The name must be ${formatHint}.`
          : "The name must follow this campus's classroom format."

  return (
    <Field>
      <FieldLabel htmlFor={id}>Room type</FieldLabel>
      <Select
        disabled={disabled}
        // Value→label map keeps the trigger showing the category label even
        // before the popup has mounted.
        items={ROOM_TYPE_OPTIONS}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next as RoomType)
        }}
        value={value}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select room type" />
        </SelectTrigger>
        <SelectPopup>
          {ROOM_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      <FieldDescription>{description}</FieldDescription>
    </Field>
  )
}