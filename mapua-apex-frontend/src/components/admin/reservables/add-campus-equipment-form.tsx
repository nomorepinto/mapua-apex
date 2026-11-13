import { useMemo, useState, type FormEvent } from "react"
import { CircleAlertIcon, PlusIcon } from "lucide-react"

import { participantBoundPayload } from "@/lib/reservable-capacity-form"
import { CampusSelect } from "@/components/admin/reservables/reservables-fields"
import { useReservablesPage } from "@/components/admin/reservables/reservables-context"
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

/**
 * S-8 "Add Campus Equipment" flow. The type is fixed to equipment (standalone
 * campus gear, not room-specific). Carries name + max quantity + weekly schedule.
 */
export function AddCampusEquipmentForm() {
  const { state, actions } = useReservablesPage()
  const { campuses, campusId, reservables } = state
  const { setCampusId, createReservable } = actions

  const [name, setName] = useState("")
  const [maxQuantity, setMaxQuantity] = useState("")
  const [schedule, setSchedule] = useState(() => allAvailableSchedule())
  const [formError, setFormError] = useState("")

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
      setFormError("Equipment name is required.")
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

    try {
      await createReservable.mutateAsync({
        campusId,
        name: trimmed,
        type: "equipment",
        ...participantBoundPayload({ min: "", max: "" }),
        schedule,
        max_quantity: maxQuantity !== "" ? parseInt(maxQuantity, 10) : null,
      })
      setName("")
      setMaxQuantity("")
      setSchedule(allAvailableSchedule())
      setFormError("")
      toastManager.add({
        title: "Campus equipment added",
        description: `${trimmed} is now bookable.`,
        type: "success",
      })
    } catch (error) {
      setFormError(mutationErrorMessage(error, "Could not add equipment."))
    }
  }

  return (
    <Form className="contents" onSubmit={handleAdd}>
      <CardPanel className="flex flex-col gap-4">
        <CampusSelect
          campuses={campuses}
          id="add-equipment-campus"
          onChange={setCampusId}
          value={campusId}
        />
        <Field>
          <FieldLabel htmlFor="add-equipment-name">Name</FieldLabel>
          <Input
            aria-invalid={formError ? true : undefined}
            autoComplete="off"
            id="add-equipment-name"
            onChange={(event) => {
              setName(event.currentTarget.value)
              if (formError) setFormError("")
            }}
            placeholder="Portable projector"
            required
            type="text"
            value={name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="add-equipment-max-quantity">
            Max Quantity{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="add-equipment-max-quantity"
            min={1}
            onChange={(event) => {
              setMaxQuantity(event.currentTarget.value)
              if (formError) setFormError("")
            }}
            placeholder="e.g. 10"
            type="number"
            value={maxQuantity}
          />
        </Field>
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
          Add campus equipment
        </Button>
      </CardFooter>
    </Form>
  )
}
