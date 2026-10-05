import { Trash2Icon } from "lucide-react"

import {
  AV_EQUIPMENT_OPTIONS,
  TABLE_INPUT_CLASS,
} from "@/components/reservation/constants"
import type { AVItem } from "@/components/reservation/types"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AvTable({
  items = [],
  onUpdate,
  onRemove,
  onAdd,
}: {
  items?: AVItem[]
  onUpdate: (id: string, field: keyof AVItem, value: string) => void
  onRemove: (id: string) => void
  onAdd: (value: string) => void
}) {
  const safeItems = items ?? []
  const canRemove = safeItems.length > 0
  const available = AV_EQUIPMENT_OPTIONS.filter(
    (option) => !safeItems.some((item) => item.equipmentNeeded === option)
  )
  const exhausted = available.length === 0

  return (
    <div className="space-y-3 pt-2">
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
                <th className="w-52 border-r border-neutral-300 px-4 py-3 text-center">
                  Equipment Needed
                </th>
                <th className="px-4 py-3 text-center">Remarks</th>
                {canRemove ? (
                  <th className="w-10 px-2 py-3 text-center" />
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {safeItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={canRemove ? 3 : 2}
                    className="px-4 py-6 text-center text-xs text-neutral-500 italic"
                  >
                    No equipment added yet. Use the selector below to add a row.
                  </td>
                </tr>
              ) : null}
              {safeItems.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/60">
                  <td className="border-r border-neutral-300 p-2 text-center text-sm font-medium !text-neutral-900">
                    {item.equipmentNeeded}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Select
        value={null}
        disabled={exhausted}
        onValueChange={(item: string | null) => {
          if (item) onAdd(item)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue
            placeholder={
              exhausted ? "All equipment added" : "Add audiovisual equipment…"
            }
          />
        </SelectTrigger>
        <SelectPopup>
          {available.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  )
}
