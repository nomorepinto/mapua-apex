import { PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { blockNonIntegerKeys, sanitizeIntegerInput } from "@/lib/numeric-input"
import type { ApiRoomEquipment } from "@/lib/types"

/**
 * Repeatable name + quantity rows for the equipment that belongs to a room
 * (S-8). Room-specific equipment is stored as a property on the room reservable,
 * not as standalone campus equipment. Quantity is optional (null = unspecified).
 */
export function RoomEquipmentEditor({
  idPrefix,
  value,
  disabled = false,
  onChange,
}: {
  idPrefix: string
  value: ApiRoomEquipment[]
  disabled?: boolean
  onChange: (next: ApiRoomEquipment[]) => void
}) {
  function updateRow(index: number, patch: Partial<ApiRoomEquipment>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addRow() {
    onChange([...value, { name: "", quantity: null }])
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-base/4.5 font-medium text-foreground sm:text-sm/4">
          Room-specific equipment
        </span>
        <Button
          disabled={disabled}
          onClick={addRow}
          size="sm"
          type="button"
          variant="ghost"
        >
          <PlusIcon aria-hidden="true" />
          Add equipment
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Equipment that belongs to this room (e.g. projector, whiteboard). Orgs
        can request it when they reserve this room; it is not listed as campus
        equipment.
      </p>
      {value.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No room-specific equipment yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {value.map((row, index) => (
            <div
              className="flex items-end gap-2"
              key={`${idPrefix}-room-equipment-${index}`}
            >
              <Field className="min-w-0 flex-1">
                <FieldLabel
                  htmlFor={`${idPrefix}-room-equipment-name-${index}`}
                >
                  Name
                </FieldLabel>
                <Input
                  autoComplete="off"
                  disabled={disabled}
                  id={`${idPrefix}-room-equipment-name-${index}`}
                  maxLength={150}
                  onChange={(event) =>
                    updateRow(index, { name: event.currentTarget.value })
                  }
                  placeholder="e.g. Projector"
                  type="text"
                  value={row.name}
                />
              </Field>
              <Field className="w-28 shrink-0">
                <FieldLabel
                  htmlFor={`${idPrefix}-room-equipment-qty-${index}`}
                >
                  Qty{" "}
                  <span className="font-normal text-muted-foreground">
                    (opt.)
                  </span>
                </FieldLabel>
                <Input
                  autoComplete="off"
                  disabled={disabled}
                  id={`${idPrefix}-room-equipment-qty-${index}`}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(event) => {
                    const cleaned = sanitizeIntegerInput(
                      event.currentTarget.value
                    ).slice(0, 4)
                    updateRow(index, {
                      quantity: cleaned === "" ? null : parseInt(cleaned, 10),
                    })
                  }}
                  onKeyDown={blockNonIntegerKeys}
                  placeholder="—"
                  type="text"
                  value={row.quantity != null ? String(row.quantity) : ""}
                />
              </Field>
              <Button
                aria-label={`Remove ${row.name || "equipment"}`}
                className="shrink-0"
                disabled={disabled}
                onClick={() => removeRow(index)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
