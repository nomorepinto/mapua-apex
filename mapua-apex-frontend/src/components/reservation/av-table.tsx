import { PlusIcon, Trash2Icon } from "lucide-react"

import { FieldWarning } from "@/components/forms/field-warning"

import {
  FIXED_AV_EQUIPMENT,
  PURPOSE_INPUT_CLASS,
  TABLE_INPUT_CLASS,
} from "@/components/reservation/constants"
import type { AVItem } from "@/components/reservation/types"
import { layout } from "@/config"
import { cn } from "@/lib/utils"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"

export function AvTable({
  purpose = "",
  items = [],
  onPurposeChange,
  onUpdate,
  onRemove,
  onAdd,
}: {
  purpose: string
  items?: AVItem[]
  onPurposeChange: (value: string) => void
  onUpdate: (id: string, field: keyof AVItem, value: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
}) {
  const safeItems = items ?? []
  const canRemove = safeItems.length > 1

  return (
    <div className="space-y-3 pt-2">
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-neutral-800">
          Audiovisual Equipment <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={purpose}
          onChange={(e) => onPurposeChange(e.target.value)}
          placeholder="Write the title of Exhibit, Event, etc."
          style={{ color: "#171717" }}
          className={PURPOSE_INPUT_CLASS}
          required
        />
        <FieldWarning name="avPurpose" />
      </div>

      <div className={layout.sectionFlush}>
        <div className={layout.tableWrap}>
          <table className={cn("border-collapse text-left text-sm", layout.tableWide)}>
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-50/80 text-xs font-semibold tracking-wider text-neutral-700 uppercase">
                <th className="w-52 border-r border-neutral-300 px-4 py-3 text-center">
                  Equipment Needed
                </th>
                <th className="w-36 border-r border-neutral-300 px-2 py-3 text-center">
                  Start Date
                </th>
                <th className="w-36 border-r border-neutral-300 px-2 py-3 text-center">
                  End Date
                </th>
                <th className="w-28 border-r border-neutral-300 px-2 py-3 text-center">
                  Start Time
                </th>
                <th className="w-28 border-r border-neutral-300 px-2 py-3 text-center">
                  End Time
                </th>
                <th className="px-4 py-3 text-center">Remarks</th>
                {canRemove ? <th className="w-10 px-2 py-3 text-center" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {safeItems.map((item) => {
                const isFixedItem = FIXED_AV_EQUIPMENT.has(item.equipmentNeeded)
                return (
                  <tr key={item.id} className="hover:bg-neutral-50/60">
                    <td className="border-r border-neutral-300 p-2 text-center text-sm font-medium !text-neutral-900">
                      {isFixedItem ? (
                        <span>{item.equipmentNeeded}</span>
                      ) : (
                        <input
                          type="text"
                          maxLength={40}
                          value={item.equipmentNeeded}
                          placeholder="Enter equipment needed"
                          onChange={(e) =>
                            onUpdate(item.id, "equipmentNeeded", e.target.value)
                          }
                          style={{ color: "#171717" }}
                          className={`${TABLE_INPUT_CLASS} font-medium`}
                        />
                      )}
                    </td>
                    <td className="border-r border-neutral-300 p-2">
                      <DatePicker
                        size="sm"
                        value={item.dateNeeded}
                        onChange={(next) =>
                          onUpdate(item.id, "dateNeeded", next)
                        }
                        placeholder="Date"
                        aria-label="Equipment start date"
                      />
                    </td>
                    <td className="border-r border-neutral-300 p-2">
                      <DatePicker
                        size="sm"
                        minDate={item.dateNeeded || undefined}
                        value={item.endDateNeeded || ""}
                        onChange={(next) =>
                          onUpdate(item.id, "endDateNeeded", next)
                        }
                        placeholder="Date"
                        aria-label="Equipment end date"
                      />
                    </td>
                    <td className="border-r border-neutral-300 p-2">
                      <TimePicker
                        size="sm"
                        value={item.timeNeeded}
                        onChange={(next) =>
                          onUpdate(item.id, "timeNeeded", next)
                        }
                        placeholder="Time"
                        aria-label="Equipment start time"
                      />
                    </td>
                    <td className="border-r border-neutral-300 p-2">
                      <TimePicker
                        size="sm"
                        value={item.endTimeNeeded || ""}
                        onChange={(next) =>
                          onUpdate(item.id, "endTimeNeeded", next)
                        }
                        placeholder="Time"
                        aria-label="Equipment end time"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        maxLength={40}
                        value={item.remarks}
                        placeholder="Enter remarks..."
                        onChange={(e) =>
                          onUpdate(item.id, "remarks", e.target.value)
                        }
                        style={{ color: "#171717" }}
                        className={`${TABLE_INPUT_CLASS} placeholder:text-neutral-400`}
                      />
                    </td>
                    {canRemove ? (
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => onRemove(item.id)}
                          className="cursor-pointer rounded p-1 text-neutral-400 transition-colors hover:text-red-600"
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/40 py-3 text-sm font-medium text-neutral-700 shadow-xs transition-all hover:border-neutral-400 hover:bg-neutral-100/50"
      >
        <PlusIcon className="h-4 w-4 text-neutral-600" />
        <span>Add more Item</span>
      </button>
    </div>
  )
}