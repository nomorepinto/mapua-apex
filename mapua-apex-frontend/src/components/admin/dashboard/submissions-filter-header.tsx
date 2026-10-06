import { ListFilterIcon } from "lucide-react"

import type { AdminFilterColumn } from "@/components/admin/dashboard/admin-dashboard-context"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/components/ui/popover"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface SubmissionsFilterHeaderProps {
  label: string
  column: AdminFilterColumn
  /** Distinct values available for this column. */
  options: string[]
  /** Currently selected values for this column (empty = not filtered). */
  selected: string[]
  onToggle: (column: AdminFilterColumn, value: string) => void
  onClear: (column: AdminFilterColumn) => void
  /** Right-aligns the trigger and popup (used by the trailing STATUS column). */
  align?: "left" | "right"
  /** Capitalizes option labels to match the rendered cell (e.g. type). */
  capitalize?: boolean
  className?: string
}

/**
 * Table header that opens a multi-select dropdown filtering this column by its
 * distinct values. Selections combine as OR within the column; the popover stays
 * open while toggling and shows a maroon active state with a selected-count badge.
 */
export function SubmissionsFilterHeader({
  label,
  column,
  options,
  selected,
  onToggle,
  onClear,
  align = "left",
  capitalize = false,
  className,
}: SubmissionsFilterHeaderProps) {
  const isActive = selected.length > 0

  return (
    <TableHead
      className={cn(
        "text-xs font-bold uppercase",
        align === "right" && "text-right",
        className
      )}
    >
      <Popover>
        <PopoverTrigger
          className={cn(
            "group inline-flex items-center gap-1 font-bold tracking-wider uppercase transition-colors hover:text-[#D9291C]",
            align === "right" && "flex-row-reverse",
            isActive ? "text-[#D9291C]" : "text-neutral-500"
          )}
        >
          {label}
          <ListFilterIcon
            className={cn(
              "h-3 w-3 shrink-0",
              isActive
                ? "text-[#D9291C]"
                : "text-neutral-400 group-hover:text-[#D9291C]"
            )}
          />
          {isActive ? (
            <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#D9291C] px-1 text-[9px] font-bold text-white">
              {selected.length}
            </span>
          ) : null}
        </PopoverTrigger>
        <PopoverPopup
          align={align === "right" ? "end" : "start"}
          className="w-56 [&_[data-slot=popover-viewport]]:px-1.5 [&_[data-slot=popover-viewport]]:py-1.5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-2 py-1.5">
            <span className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">
              Filter
            </span>
            {isActive ? (
              <button
                type="button"
                onClick={() => onClear(column)}
                className="text-[10px] font-semibold text-[#D9291C] transition-colors hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 ? (
              <li className="px-2 py-1.5 text-xs text-neutral-400">
                No values
              </li>
            ) : (
              options.map((value) => (
                <li key={value}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-700 transition-colors hover:bg-neutral-50">
                    <Checkbox
                      checked={selected.includes(value)}
                      onCheckedChange={() => onToggle(column, value)}
                    />
                    <span className={cn("truncate", capitalize && "capitalize")}>
                      {value}
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </PopoverPopup>
      </Popover>
    </TableHead>
  )
}
