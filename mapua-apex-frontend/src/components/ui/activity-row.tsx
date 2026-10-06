import { memo, useCallback } from "react"
import type React from "react"

import { TableCell, TableRow } from "@/components/ui/table"
import { formatDocumentId } from "@/lib/dynamodb-adapters"
import type { Activity } from "./activity.types"

// ─── ActivityRow ──────────────────────────────────────────────────────────────

export interface ActivityRowProps {
  activity: Activity
  onSelect: (activity: Activity) => void
}

const ActivityRow = memo(function ActivityRow({ activity, onSelect }: ActivityRowProps) {
  const handleClick = useCallback(() => onSelect(activity), [activity, onSelect])
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick],
  )

  return (
    <TableRow
      className="cursor-pointer group transition-colors hover:bg-neutral-100/80 border-b border-neutral-100"
      onClick={handleClick}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${activity.title}`}
      onKeyDown={handleKeyDown}
    >
      {/* 1. DOCUMENT ID */}
      <TableCell
        className="py-4.5 px-6 font-mono text-xs font-bold whitespace-nowrap text-neutral-900"
        title={activity.submissionId}
      >
        {formatDocumentId(activity.submissionId)}
      </TableCell>

      {/* 2. ORGANIZATION */}
      <TableCell className="py-4.5 px-6 font-bold text-neutral-900 text-sm whitespace-nowrap">
        {activity.org}
      </TableCell>

      {/* 3. ACTIVITY NAME */}
      <TableCell className="py-4.5 px-6 text-neutral-700 text-sm font-medium">
        <span className="line-clamp-1">{activity.title}</span>
      </TableCell>

      {/* 4. SUBMITTED */}
      <TableCell className="py-4.5 px-6 text-neutral-500 text-xs sm:text-sm whitespace-nowrap">
        {activity.submittedDate}
      </TableCell>

      {/* 5. TYPE & NATURE */}
      <TableCell className="py-4.5 px-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-700">
            {activity.type}
          </span>
          {activity.nature?.toLowerCase() === "major" ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-red-100 text-[#8B0000] border border-red-200/60">
              Major
            </span>
          ) : activity.nature?.toLowerCase() === "minor" ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-neutral-100 text-neutral-700 border border-neutral-200/60">
              Minor
            </span>
          ) : null}
        </div>
      </TableCell>

      {/* 6. DECISION (Review, Return, Reject) */}
      <TableCell className="py-4.5 px-6 text-right">
        {activity.decision === "Review" ? (
          <span className="inline-flex items-center text-xs font-semibold text-neutral-800 group-hover:text-black py-1 px-3 rounded-lg hover:bg-neutral-200/60 transition-colors">
            Review
          </span>
        ) : activity.decision === "Return" ? (
          <span className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-md">
            Return
          </span>
        ) : (
          <span className="inline-flex items-center text-xs font-semibold text-red-700 bg-red-50 border border-red-200/80 px-2.5 py-1 rounded-md">
            Reject
          </span>
        )}
      </TableCell>
    </TableRow>
  )
})

export { ActivityRow }
