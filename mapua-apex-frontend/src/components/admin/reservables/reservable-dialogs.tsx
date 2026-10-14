import { useState } from "react"
import { CircleAlertIcon } from "lucide-react"

import { ReservableCapacityFieldsForm } from "@/components/admin/reservables/reservable-capacity-fields"
import { participantBoundPayload, participantBoundsFromValues, stripCapacityForType, validateParticipantBounds, type ParticipantBound } from "@/lib/reservable-capacity-form"
import { ReservableClassroomField } from "@/components/admin/reservables/reservable-classroom-field"
import { campusHasClassroomFormat, classroomFormatHint, matchesClassroomName } from "@/lib/campus-classroom-format"
import { ReservableTypeField } from "@/components/admin/reservables/reservables-fields"
import { ScheduleGrid } from "@/components/admin/reservables/schedule-grid"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { modal } from "@/config"
import {
  countAvailableSlots,
  normalizeSchedule,
  toggleScheduleDay,
  toggleScheduleSlot,
} from "@/lib/schedule-slots"
import type { ApiCampus, ApiReservable, ReservableSchedule, ReservableType } from "@/lib/types"

export interface ReservableDraft {
  name: string
  type: ReservableType
  schedule: ReservableSchedule
  min_participants: number | null
  max_participants: number | null
  is_classroom: boolean
}

/**
 * Edit a reservable's name, type, and weekly template. The campus (partition
 * key) is fixed and shown read-only. Deleting is confirmed inline; the API
 * refuses (409) to delete a reservable that still has an active booking.
 */
export function EditReservableDialog({
  reservable,
  campus,
  campusName,
  reservables,
  onClose,
  onSave,
  onDelete,
  savePending,
  deletePending,
  error,
}: {
  reservable: ApiReservable
  campus: ApiCampus | null
  campusName: string
  reservables: ApiReservable[]
  onClose: () => void
  onSave: (draft: ReservableDraft) => Promise<void>
  onDelete: () => Promise<void>
  savePending: boolean
  deletePending: boolean
  error: string
}) {
  // State is seeded once from the reservable. The parent remounts this dialog
  // with a fresh `key` when a different reservable is opened, so no prop-sync
  // effect (and its cascading render) is needed.
  const [name, setName] = useState(reservable.name)
  const [type, setType] = useState<ReservableType>(reservable.type)
  const [schedule, setSchedule] = useState<ReservableSchedule>(() =>
    normalizeSchedule(reservable.schedule)
  )
  const [bounds, setBounds] = useState<ParticipantBound>(() =>
    participantBoundsFromValues(reservable.min_participants, reservable.max_participants)
  )
  const [isClassroom, setIsClassroom] = useState(() => reservable.is_classroom === true)
  const [localError, setLocalError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const hasClassroomFormat = campusHasClassroomFormat(campus)
  const classroomHint = hasClassroomFormat
    ? classroomFormatHint(campus?.classroom_name_prefixes, campus?.classroom_name_digits)
    : null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) {
      setLocalError("Reservable name is required.")
      return
    }
    const duplicate = reservables.some(
      (item) =>
        item.reservable_id !== reservable.reservable_id &&
        item.name.trim().toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) {
      setLocalError("Another reservable on this campus already uses that name.")
      return
    }
    if (countAvailableSlots(schedule) === 0) {
      setLocalError("Select at least one available slot in the weekly template.")
      return
    }
    const capacityError = validateParticipantBounds(
      stripCapacityForType(type, bounds)
    )
    if (capacityError) {
      setLocalError(capacityError)
      return
    }
    const classroom = type === "room" && isClassroom && hasClassroomFormat
    if (classroom && !matchesClassroomName(campus?.classroom_name_prefixes, campus?.classroom_name_digits, trimmed)) {
      setLocalError(`A classroom room must be named ${classroomHint ?? "to the campus format"}.`)
      return
    }

    setLocalError("")
    await onSave({
      name: trimmed,
      type,
      schedule,
      ...participantBoundPayload(stripCapacityForType(type, bounds)),
      is_classroom: classroom,
    })
  }

  const shownError = localError || error

  return (
    <>
      <Dialog
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        open
      >
        <DialogPopup className={modal.dialogLg}>
          <DialogHeader>
            <DialogTitle>Edit reservable</DialogTitle>
            <DialogDescription>
              {campusName ? `Campus: ${campusName}. ` : ""}The reservable ID and
              campus cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <Form className="contents" onSubmit={handleSubmit}>
            <DialogPanel className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="edit-reservable-name">Name</FieldLabel>
                <Input
                  autoComplete="off"
                  id="edit-reservable-name"
                  onChange={(event) => {
                    setName(event.currentTarget.value)
                    if (localError) setLocalError("")
                  }}
                  required
                  type="text"
                  value={name}
                />
              </Field>
              <ReservableTypeField
                id="edit-reservable-type"
                onChange={(next) => {
                  setType(next)
                  setBounds((current) => stripCapacityForType(next, current))
                  if (next !== "room") setIsClassroom(false)
                  if (localError) setLocalError("")
                }}
                value={type}
              />
              <ReservableCapacityFieldsForm
                bounds={bounds}
                disabled={savePending}
                idPrefix="edit-reservable"
                onChange={(next) => {
                  setBounds(next)
                  if (localError) setLocalError("")
                }}
                type={type}
              />
              <ReservableClassroomField
                checked={isClassroom}
                disabled={savePending}
                formatHint={classroomHint}
                hasCampusFormat={hasClassroomFormat}
                id="edit-reservable-classroom"
                onChange={(next) => {
                  setIsClassroom(next)
                  if (localError) setLocalError("")
                }}
                type={type}
              />
              <div className="flex flex-col gap-2">
                <span className="inline-flex items-center gap-2 text-base/4.5 font-medium text-foreground sm:text-sm/4">Weekly availability</span>
                <ScheduleGrid
                  onToggle={(day, slot) =>
                    setSchedule((current) =>
                      toggleScheduleSlot(current, day, slot)
                    )
                  }
                  onToggleDay={(day) =>
                    setSchedule((current) => toggleScheduleDay(current, day))
                  }
                  schedule={schedule}
                />
              </div>
              {shownError ? (
                <Alert variant="error">
                  <CircleAlertIcon />
                  <AlertTitle>Could not save</AlertTitle>
                  <AlertDescription>{shownError}</AlertDescription>
                </Alert>
              ) : null}
            </DialogPanel>
            <DialogFooter>
              <Button
                onClick={() => setConfirmDelete(true)}
                type="button"
                variant="destructive-outline"
              >
                Delete
              </Button>
              <DialogClose render={<Button type="button" variant="ghost" />}>
                Cancel
              </DialogClose>
              <Button loading={savePending} type="submit">
                Save changes
              </Button>
            </DialogFooter>
          </Form>
        </DialogPopup>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this reservable?</AlertDialogTitle>
            <AlertDialogDescription>
              {`${reservable.name} will be permanently removed. A reservable with an active booking cannot be deleted. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="ghost" />}>
              Keep
            </AlertDialogClose>
            <Button
              loading={deletePending}
              onClick={async () => {
                await onDelete()
                setConfirmDelete(false)
              }}
              type="button"
              variant="destructive"
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  )
}
