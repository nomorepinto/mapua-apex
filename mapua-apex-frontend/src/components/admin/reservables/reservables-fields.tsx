import { ArmchairIcon, BoxesIcon } from "lucide-react"

import { SegmentedControl } from "@/components/admin/reservables/segmented-control"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ApiCampus, ApiReservable, ReservableType } from "@/lib/types"

const TYPE_ITEMS: { value: ReservableType; label: string }[] = [
  { value: "room", label: "Room" },
  { value: "equipment", label: "Equipment" },
]

/** Campus picker shared by the Add form and the View/Reserve selectors. */
export function CampusSelect({
  campuses,
  value,
  onChange,
  id,
  label = "Campus",
  description,
  disabled = false,
}: {
  campuses: ApiCampus[]
  value: string | null
  onChange: (campusId: string) => void
  id: string
  label?: string
  description?: string
  disabled?: boolean
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        disabled={disabled}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next)
        }}
        value={value ?? null}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select campus" />
        </SelectTrigger>
        <SelectPopup>
          {campuses.map((campus) => (
            <SelectItem key={campus.campus_id} value={campus.campus_id}>
              {campus.name}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  )
}

/** Reservable picker for the selected campus, grouped into Rooms / Equipment. */
export function ReservableSelect({
  reservables,
  value,
  onChange,
  id,
  label = "Reservable",
  placeholder = "Select a room or equipment",
  disabled = false,
}: {
  reservables: ApiReservable[]
  value: string | null
  onChange: (reservableId: string) => void
  id: string
  label?: string
  placeholder?: string
  disabled?: boolean
}) {
  const rooms = reservables.filter((item) => item.type === "room")
  const equipment = reservables.filter((item) => item.type === "equipment")

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        disabled={disabled || reservables.length === 0}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next)
        }}
        value={value ?? null}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectPopup>
          {rooms.length > 0 ? (
            <SelectGroup>
              <SelectGroupLabel>Rooms</SelectGroupLabel>
              {rooms.map((item) => (
                <SelectItem key={item.reservable_id} value={item.reservable_id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
          {equipment.length > 0 ? (
            <SelectGroup>
              <SelectGroupLabel>Equipment</SelectGroupLabel>
              {equipment.map((item) => (
                <SelectItem key={item.reservable_id} value={item.reservable_id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
        </SelectPopup>
      </Select>
    </Field>
  )
}

/** Room / Equipment segmented toggle used by the Add and Edit forms. */
export function ReservableTypeField({
  value,
  onChange,
  id,
}: {
  value: ReservableType
  onChange: (type: ReservableType) => void
  id: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>Type</FieldLabel>
      <SegmentedControl
        ariaLabel="Reservable type"
        items={TYPE_ITEMS.map((item) => ({
          value: item.value,
          label: item.label,
          icon: item.value === "room" ? ArmchairIcon : BoxesIcon,
        }))}
        onChange={onChange}
        value={value}
      />
      <FieldDescription>
        Rooms are bookable spaces; equipment is AV or other reservable gear.
      </FieldDescription>
    </Field>
  )
}
