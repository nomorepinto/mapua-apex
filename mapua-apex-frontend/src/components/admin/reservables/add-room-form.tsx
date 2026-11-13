import { useMemo, useState, type FormEvent } from "react"
import { CircleAlertIcon, PlusIcon } from "lucide-react"

import { ReservableCapacityFieldsForm } from "@/components/admin/reservables/reservable-capacity-fields"
import {
  participantBoundPayload,
  validateParticipantBounds,
  type ParticipantBound,
} from "@/lib/reservable-capacity-form"
import { ReservableClassroomField } from "@/components/admin/reservables/reservable-classroom-field"
import {
  campusHasClassroomFormat,
  classroomFormatHint,
  matchesClassroomName,
} from "@/lib/campus-classroom-format"
import { CampusSelect } from "@/components/admin/reservables/reservables-fields"
import { useReservablesPage } from "@/components/admin/reservables/reservables-context"
import { RoomEquipmentEditor } from "@/components/admin/reservables/room-equipment-editor"
import { ScheduleGrid } from "@/components/admin/reservables/schedule-grid"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CardFooter, CardPanel } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toastManager } from "@/components/ui/toast"
import { mutationErrorMessage } from "@/hooks/use-admin"
import {
  allAvailableSchedule,
  countAvailableSlots,
  emptySchedule,
  toggleScheduleDay,
  toggleScheduleSlot,
} from "@/lib/schedule-slots"
import type { ApiRoomEquipment } from "@/lib/types"

/**
 * S-8 "Add Room" flow. The type is fixed to room (no shared room/equipment
 * toggle). S-9 ordering: name → classroom decision → capacity/name-format →
 * room-specific equipment → weekly schedule.
 */
export function AddRoomForm() {
  const { state, actions } = useReservablesPage()
  const { campuses, campusId, reservables } = state
  const { setCampusId, createReservable } = actions

  const [name, setName] = useState("")
  const [bounds, setBounds] = useState<ParticipantBound>({ min: "", max: "" })
  const [isClassroom, setIsClassroom] = useState(false)
  const [roomEquipment, setRoomEquipment] = useState<ApiRoomEquipment[]>([])
  const [schedule, setSchedule] = useState(() => allAvailableSchedule())
  const [formError, setFormError] = useState("")

  const selectedCampus =
    campuses.find((campus) => campus.campus_id === campusId) ?? null
  const hasClassroomFormat = campusHasClassroomFormat(selectedCampus)
  const classroomHint = hasClassroomFormat
    ? classroomFormatHint(
        selectedCampus?.classroom_name_prefixes,
        selectedCampus?.classroom_name_digits
      )
    : null

  const existingNames = useMemo(
    () => new Set(reservables.map((item) => item.name.trim().toLowerCase())),
    [reservables]
  )

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!campusId) {
      setFormError("Choose a campus first.")
      return
    }
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError("Room name is required.")
      return
    }
    if (existingNames.has(trimmed.toLowerCase())) {
      setFormError("That reservable already exists on this campus.")
      return
    }
    if (countAvailableSlots(schedule) === 0) {
      setFormError("Select at least one available slot in the weekly template.")
      return
    }
    const capacityError = validateParticipantBounds(bounds)
    if (capacityError) {
      setFormError(capacityError)
      return
    }
    const classroom = isClassroom && hasClassroomFormat
    if (
      classroom &&
      !matchesClassroomName(
        selectedCampus?.classroom_name_prefixes,
        selectedCampus?.classroom_name_digits,
        trimmed
      )
    ) {
      setFormError(
        `A classroom room must be named ${classroomHint ?? "to the campus format"}.`
      )
      return
    }
    const equipment = roomEquipment
      .map((row) => ({ name: row.name.trim(), quantity: row.quantity ?? null }))
      .filter((row) => row.name.length > 0)

    try {
      await createReservable.mutateAsync({
        campusId,
        name: trimmed,
        type: "room",
        ...participantBoundPayload(bounds),
        is_classroom: classroom,
        schedule,
        room_equipment: equipment,
      })
      setName("")
      setBounds({ min: "", max: "" })
      setIsClassroom(false)
      setRoomEquipment([])
      setSchedule(allAvailableSchedule())
      setFormError("")
      toastManager.add({
        title: "Room added",
        description: `${trimmed} is now bookable.`,
        type: "success",
      })
    } catch (error) {
      setFormError(mutationErrorMessage(error, "Could not add room."))
    }
  }

  return (
    <Form className="contents" onSubmit={handleAdd}>
      <CardPanel className="flex flex-col gap-4">
        <CampusSelect
          campuses={campuses}
          id="add-room-campus"
          onChange={setCampusId}
          value={campusId}
        />
        <Field>
          <FieldLabel htmlFor="add-room-name">Name</FieldLabel>
          <Input
            aria-invalid={formError ? true : undefined}
            autoComplete="off"
            id="add-room-name"
            onChange={(event) => {
              setName(event.currentTarget.value)
              if (formError) setFormError("")
            }}
            placeholder="Cardinal Cinema"
            required
            type="text"
            value={name}
          />
        </Field>
        {/* S-9: the classroom decision comes before the capacity/name-format fields. */}
        <ReservableClassroomField
          checked={isClassroom}
          disabled={createReservable.isPending}
          formatHint={classroomHint}
          hasCampusFormat={hasClassroomFormat}
          id="add-room-classroom"
          onChange={(next) => {
            setIsClassroom(next)
            if (formError) setFormError("")
          }}
          type="room"
        />
        <ReservableCapacityFieldsForm
          bounds={bounds}
          disabled={createReservable.isPending}
          idPrefix="add-room"
          onChange={(next) => {
            setBounds(next)
            if (formError) setFormError("")
          }}
          type="room"
        />
        <RoomEquipmentEditor
          disabled={createReservable.isPending}
          idPrefix="add-room"
          onChange={setRoomEquipment}
          value={roomEquipment}
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-base/4.5 font-medium text-foreground sm:text-sm/4">
              Weekly availability
            </span>
            <div className="flex items-center gap-1">
              <Button
                onClick={() => setSchedule(allAvailableSchedule())}
                size="sm"
                type="button"
                variant="ghost"
              >
                All week
              </Button>
              <Button
                onClick={() => setSchedule(emptySchedule())}
                size="sm"
                type="button"
                variant="ghost"
              >
                Clear
              </Button>
            </div>
          </div>
          <ScheduleGrid
            onToggle={(day, slot) =>
              setSchedule((current) => toggleScheduleSlot(current, day, slot))
            }
            onToggleDay={(day) =>
              setSchedule((current) => toggleScheduleDay(current, day))
            }
            schedule={schedule}
          />
        </div>
        {formError ? (
          <Alert variant="error">
            <CircleAlertIcon />
            <AlertTitle>Missing details</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
      </CardPanel>
      <CardFooter className="justify-end">
        <Button
          disabled={!campusId || !name.trim()}
          loading={createReservable.isPending}
          type="submit"
        >
          <PlusIcon aria-hidden="true" />
          Add room
        </Button>
      </CardFooter>
    </Form>
  )
}
