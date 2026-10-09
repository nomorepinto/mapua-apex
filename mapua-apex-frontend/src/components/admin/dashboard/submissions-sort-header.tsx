import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import type { DateSortDirection } from "@/components/admin/dashboard/admin-dashboard-context"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface SubmissionsSortHeaderProps {
  label: string
  direction: DateSortDirection
  onSort: () => void
  className?: string
}

/**
 * Table header for a sortable column. Clicking toggles ascending/descending;
 * the icon mirrors the active direction (neutral arrows when unsorted).
 */
export function SubmissionsSortHeader({
  label,
  direction,
  onSort,
  className,
}: SubmissionsSortHeaderProps) {
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
      className={cn("text-xs font-bold uppercase", className)}
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
