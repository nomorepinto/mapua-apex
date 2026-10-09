import { Trash2Icon } from "lucide-react"

import {
  OTHER_OPTION,
  TABLE_INPUT_CLASS,
} from "@/components/reservation/constants"
import type { RoomItem } from "@/components/reservation/types"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { layout } from "@/config"
import {
  CLASSROOM_ROOM,
  campusRoomTerms,
  roomOptionsForCampus,
} from "@/lib/campus-rooms"
import { cn } from "@/lib/utils"

export function RoomTable({
  items = [],
  campus,
  onUpdate,
  onRemove,
  onAdd,
}: {
  items?: RoomItem[]
  /** Venue campus chosen on SAAF step 3; it drives the room catalog. */
  campus: string
  onUpdate: (id: string, field: keyof RoomItem, value: string) => void
  onRemove: (id: string) => void
  onAdd: (value: string) => void
}) {
  const safeItems = items ?? []
  const canRemove = safeItems.length > 0
  const catalog = roomOptionsForCampus(campus)
  const campusSelected = catalog.length > 0

  // Classroom stays selectable so multiple classrooms can still be booked if needed
  const available = catalog.filter(
    (option) =>
      option === CLASSROOM_ROOM ||
      !safeItems.some((item) => item.roomNeeded === option)
  )

  const options = campusSelected
    ? [...available, ...(campus === "Makati Campus" ? [] : [OTHER_OPTION])]
    : []
  const exhausted = options.length === 0
  const terms = campusRoomTerms(campus)
  const columnCount = 2 + (canRemove ? 1 : 0)

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
                <th className="w-64 border-r border-neutral-300 px-4 py-3 text-center">
                  Room Needed
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
                    colSpan={columnCount}
                    className="px-4 py-6 text-center text-xs text-neutral-500 italic"
                  >
                    No room added yet. Use the selector below to add a row.
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
                        value={item.roomNeeded}
                        placeholder="Enter room name..."
                        onChange={(e) =>
                          onUpdate(item.id, "roomNeeded", e.target.value)
                        }
                        style={{ color: "#171717" }}
                        className={`${TABLE_INPUT_CLASS} placeholder:text-neutral-400`}
                      />
                    ) : (
                      item.roomNeeded
                    )}
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

      {terms.length > 0 ? (
        <p className="px-1 text-xs leading-relaxed text-neutral-500">
          {terms.map((term) => (
            <span key={term} className="block">
              {term}
            </span>
          ))}
        </p>
      ) : null}

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
              exhausted ? "Select the venue campus first" : "Add function room…"
            }
          />
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