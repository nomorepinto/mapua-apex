import { Trash2Icon } from "lucide-react"

import {
  EQUIPMENT_OPTIONS,
  OTHER_OPTION,
  TABLE_INPUT_CLASS,
} from "@/components/reservation/constants"
import type { EquipmentItem } from "@/components/reservation/types"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function EquipmentTable({
  items = [],
  onUpdate,
  onRemove,
  onAdd,
}: {
  items?: EquipmentItem[]
  onUpdate: (id: string, field: keyof EquipmentItem, value: string) => void
  onRemove: (id: string) => void
  onAdd: (name: string) => void
}) {
  const safeItems = items ?? []
  const canRemove = safeItems.length > 0
  const available = EQUIPMENT_OPTIONS.filter(
    (option) => !safeItems.some((item) => item.name === option)
  )
  // "Others" is always offered so an open-ended custom row can be added even
  // after every catalog item is used, and added more than once.
  const options = [...available, OTHER_OPTION]

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-neutral-900">Equipment Requested:</p>

      <div className={layout.sectionFlush}>
        <div className={layout.tableWrap}>
          <table
            className={cn(
              "border-collapse text-left text-sm",
              layout.tableWide
            )}
          >
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-50/80 text-xs font-semibold tracking-wider text-neutral-700 uppercase">
                <th className="w-56 border-r border-neutral-300 px-4 py-3 text-center">
                  Item Name
                </th>
                <th className="border-r border-neutral-300 px-4 py-3 text-center">
                  Item Purpose
                </th>
                <th className="px-4 py-3 text-center">Remark</th>
                {canRemove ? (
                  <th className="w-10 px-2 py-3 text-center" />
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {safeItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={canRemove ? 4 : 3}
                    className="px-4 py-6 text-center text-xs text-neutral-500 italic"
                  >
                    No equipment added yet. Use the selector below to add a row.
                  </td>
                </tr>
              ) : null}
              {safeItems.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/60">
                  <td className="border-r border-neutral-300 p-2 text-center text-sm font-medium !text-neutral-900">
                    {item.isOther ? (
                      <input
                        type="text"
                        maxLength={40}
                        value={item.name}
                        placeholder="Enter item name..."
                        onChange={(e) =>
                          onUpdate(item.id, "name", e.target.value)
                        }
                        style={{ color: "#171717" }}
                        className={`${TABLE_INPUT_CLASS} placeholder:text-neutral-400`}
                      />
                    ) : (
                      item.name
                    )}
                  </td>
                  <td className="border-r border-neutral-300 p-2">
                    <input
                      type="text"
                      maxLength={40}
                      value={item.purpose}
                      placeholder="Enter item purpose..."
                      onChange={(e) =>
                        onUpdate(item.id, "purpose", e.target.value)
                      }
                      style={{ color: "#171717" }}
                      className={`${TABLE_INPUT_CLASS} placeholder:text-neutral-400`}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      maxLength={40}
                      value={item.remark}
                      placeholder="Enter remark..."
                      onChange={(e) =>
                        onUpdate(item.id, "remark", e.target.value)
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

      <Select
        value={null}
        onValueChange={(item: string | null) => {
          if (item) onAdd(item)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Add equipment requested…" />
        </SelectTrigger>
        <SelectPopup>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  )
}
