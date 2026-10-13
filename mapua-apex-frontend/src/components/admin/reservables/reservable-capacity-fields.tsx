import { UsersIcon } from "lucide-react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { MAX_PARTICIPANT_VALUE, type ParticipantBound } from "@/lib/reservable-capacity-form"
import { blockNonIntegerKeys, sanitizeIntegerInput } from "@/lib/numeric-input"
import type { ReservableType } from "@/lib/types"

export type { ParticipantBound } from "@/lib/reservable-capacity-form"

/**
 * Minimum / maximum expected-participants inputs for a room. Both are disabled
 * (and dropped from the payload) whenever the type selector is on equipment,
 * since capacity is a property of spaces, not of gear.
 */
export function ReservableCapacityFieldsForm({
  idPrefix,
  type,
  bounds,
  disabled,
  onChange,
}: {
  idPrefix: string
  type: ReservableType
  bounds: ParticipantBound
  /** Set while the surrounding mutation is in flight. */
  disabled: boolean
  onChange: (next: ParticipantBound) => void
}) {
  const isRoom = type === "room"
  const fieldDisabled = disabled || !isRoom

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-sm/4 font-medium text-foreground">
        <UsersIcon aria-hidden="true" className="size-4 text-neutral-500" />
        Participant capacity
        {!isRoom ? (
          <span className="text-xs font-normal text-neutral-500">
            — rooms only
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-capacity-min`}>
            Minimum participants
          </FieldLabel>
          <Input
            aria-describedby={`${idPrefix}-capacity-description`}
            autoComplete="off"
            disabled={fieldDisabled}
            id={`${idPrefix}-capacity-min`}
            inputMode="numeric"
            maxLength={4}
            onChange={(event) =>
              onChange({
                ...bounds,
                min: sanitizeIntegerInput(event.currentTarget.value).slice(0, 4),
              })
            }
            onKeyDown={blockNonIntegerKeys}
            placeholder="e.g. 50"
            type="text"
            value={isRoom ? bounds.min : ""}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-capacity-max`}>
            Maximum participants
          </FieldLabel>
          <Input
            aria-describedby={`${idPrefix}-capacity-description`}
            autoComplete="off"
            disabled={fieldDisabled}
            id={`${idPrefix}-capacity-max`}
            inputMode="numeric"
            maxLength={4}
            onChange={(event) =>
              onChange({
                ...bounds,
                max: sanitizeIntegerInput(event.currentTarget.value).slice(0, 4),
              })
            }
            onKeyDown={blockNonIntegerKeys}
            placeholder="e.g. 100"
            type="text"
            value={isRoom ? bounds.max : ""}
          />
        </Field>
      </div>
      <p
        id={`${idPrefix}-capacity-description`}
        className="text-xs text-muted-foreground"
      >
        The range of attendees this room can hold (1–
        {MAX_PARTICIPANT_VALUE.toLocaleString("en-PH")}). SAAF submissions with
        an expected headcount outside it are rejected. Leave blank for no limit.
      </p>
    </div>
  )
}
