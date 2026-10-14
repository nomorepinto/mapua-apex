import { BlocksIcon } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import type { ReservableType } from "@/lib/types"

/**
 * Room-only `is_classroom` control. It is always rendered but disabled whenever
 * the type is not a room, or the selected campus has no classroom name format —
 * matching the API, which rejects `is_classroom=true` in those cases. When
 * enabled, the required name format is shown so the admin names the room
 * correctly (the CDM form validates the name against it before submit).
 */
export function ReservableClassroomField({
  id,
  type,
  checked,
  hasCampusFormat,
  formatHint,
  disabled,
  onChange,
}: {
  id: string
  type: ReservableType
  checked: boolean
  /** Whether the selected campus defines a classroom naming format. */
  hasCampusFormat: boolean
  /** e.g. "MPO / NW / N followed by exactly 3 digits" — shown when enabled. */
  formatHint: string | null
  /** Set while the surrounding mutation is in flight. */
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  const isRoom = type === "room"
  const fieldDisabled = disabled || !isRoom || !hasCampusFormat

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-sm/4 font-medium text-foreground">
        <BlocksIcon aria-hidden="true" className="size-4 text-neutral-500" />
        Classroom
        {!isRoom ? (
          <span className="text-xs font-normal text-neutral-500">— rooms only</span>
        ) : null}
      </div>
      <Field>
        <div className="flex items-start gap-2">
          <Checkbox
            checked={isRoom && hasCampusFormat ? checked : false}
            disabled={fieldDisabled}
            id={id}
            name="is_classroom"
            onCheckedChange={(value) => onChange(value === true)}
          />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={id}>This room is a classroom</FieldLabel>
            <FieldDescription>
              {!isRoom
                ? "Switch the type to a room to flag a classroom."
                : !hasCampusFormat
                  ? "This campus has no classroom name format yet. Ask OSAAR to set one before flagging classrooms."
                  : formatHint
                    ? `The name must be ${formatHint}.`
                    : "The name must follow this campus's classroom format."}
            </FieldDescription>
          </div>
        </div>
      </Field>
    </div>
  )
}
