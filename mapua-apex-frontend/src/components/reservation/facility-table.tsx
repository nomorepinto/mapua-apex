import { PlusIcon, Trash2Icon } from "lucide-react"

import { FieldWarning } from "@/components/forms/field-warning"

import {
  PURPOSE_INPUT_CLASS,
  TABLE_INPUT_CLASS,
} from "@/components/reservation/constants"
import type { FacilityItem } from "@/components/reservation/types"
import { layout } from "@/config"
import { cn } from "@/lib/utils"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"

export function FacilityTable({
  purpose = "",
  items = [],
  onPurposeChange,
  onUpdate,
  onRemove,
  onAdd,
}: {
  purpose: string
  items?: FacilityItem[]
  onPurposeChange: (value: string) => void
  onUpdate: (id: string, field: keyof FacilityItem, value: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
}) {
  const safeItems = items ?? []
  const canRemove = safeItems.length > 1

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-neutral-800">
          Purpose <span className="text-red-500">*</span>
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
        <FieldWarning name="purpose" />
      </div>

      <div className={layout.sectionFlush}>
        <div className={layout.tableWrap}>
          <table className={cn("border-collapse text-left text-sm", layout.tableWide)}>
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-50/80 text-xs font-semibold tracking-wider text-neutral-700 uppercase">
                <th className="w-56 border-r border-neutral-300 px-4 py-3 text-center">
                  Item
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
                <th className="px-4 py-3 text-center">Location</th>
                {canRemove ? <th className="w-10 px-2 py-3 text-center" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {safeItems.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/60">
                  <td className="border-r border-neutral-300 p-2">
                    <input
                      type="text"
                      maxLength={40}
                      value={item.item}
                      placeholder="Item name"
                      onChange={(e) => onUpdate(item.id, "item", e.target.value)}
                      style={{ color: "#171717" }}
                      className={`${TABLE_INPUT_CLASS} px-3 text-center`}
                    />
                  </td>
                  <td className="border-r border-neutral-300 p-2">
                    <DatePicker
                      size="sm"
                      value={item.dateOfUse}
                      onChange={(next) =>
                        onUpdate(item.id, "dateOfUse", next)
                      }
                      placeholder="Date"
                      aria-label="Facility start date"
                    />
                  </td>
                  <td className="border-r border-neutral-300 p-2">
                    <DatePicker
                      size="sm"
                      minDate={item.dateOfUse || undefined}
                      value={item.endDateOfUse || ""}
                      onChange={(next) =>
                        onUpdate(item.id, "endDateOfUse", next)
                      }
                      placeholder="Date"
                      aria-label="Facility end date"
                    />
                  </td>
                  <td className="border-r border-neutral-300 p-2">
                    <TimePicker
                      size="sm"
                      value={item.timeOfUse}
                      onChange={(next) =>
                        onUpdate(item.id, "timeOfUse", next)
                      }
                      placeholder="Time"
                      aria-label="Facility start time"
                    />
                  </td>
                  <td className="border-r border-neutral-300 p-2">
                    <TimePicker
                      size="sm"
                      value={item.endTimeOfUse || ""}
                      onChange={(next) =>
                        onUpdate(item.id, "endTimeOfUse", next)
                      }
                      placeholder="Time"
                      aria-label="Facility end time"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      maxLength={40}
                      value={item.location}
                      placeholder="Location name"
                      onChange={(e) =>
                        onUpdate(item.id, "location", e.target.value)
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
              ))}
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