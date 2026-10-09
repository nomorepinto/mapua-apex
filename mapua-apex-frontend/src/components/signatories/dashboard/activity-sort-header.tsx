import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import type { ActivitySortDirection } from "@/hooks/use-activity-table-filters"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface ActivitySortHeaderProps {
  label: string
  direction: ActivitySortDirection
  onSort: () => void
  className?: string
}

/**
 * Signatory dashboard table header for the submitted/date column. Clicking
 * toggles ascending/descending; the icon mirrors the active direction (neutral
 * arrows when unsorted).
 */
export function ActivitySortHeader({
  label,
  direction,
  onSort,
  className,
}: ActivitySortHeaderProps) {
  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ArrowUpDown
  const ariaSort =
    direction === "asc"
      ? "ascending"
      : direction === "desc"
        ? "descending"
        : "none"

  return (
    <TableHead
      aria-sort={ariaSort}
      className={cn("px-6 py-4 font-bold text-neutral-500", className)}
    >
      <button
        type="button"
        onClick={onSort}
        title={`Sort by ${label}`}
        className={cn(
          "group inline-flex items-center gap-1 font-bold tracking-wider uppercase transition-colors hover:text-[#D9291C]",
          direction ? "text-[#D9291C]" : "text-neutral-500"
        )}
      >
        {label}
        <Icon
          className={cn(
            "h-3 w-3 shrink-0",
            direction
              ? "text-[#D9291C]"
              : "text-neutral-400 group-hover:text-[#D9291C]"
          )}
        />
      </button>
    </TableHead>
  )
}
