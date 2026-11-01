import {
  ChevronRightIcon,
  ChevronLeftIcon,
  AlertTriangleIcon,
} from "lucide-react"
import type { Session } from "@/types/logs"
import { formatManila, formatDateUnambiguous } from "@/lib/monitor-formatters"
import type { ActivitySortDirection } from "@/hooks/use-activity-table-filters"
import { ActivitySortHeader } from "@/components/signatories/dashboard/activity-sort-header"
import { SessionRoleBadge } from "./session-role-badge"
import { SessionStatusBadge } from "./session-status-badge"

interface SessionsTableProps {
  sessions: Session[]
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  onSelectSession: (sessionId: string) => void
  currentPage: number
  pageSize: number
  totalEntries: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  startDate: string
  endDate: string
  sortDirection: ActivitySortDirection
  onSort: () => void
}

export function SessionsTable({
  sessions,
  isLoading,
  isError,
  onRetry,
  onSelectSession,
  currentPage,
  pageSize,
  totalEntries,
  totalPages,
  onPageChange,
  onPageSizeChange,
  startDate,
  endDate,
  sortDirection,
  onSort,
}: SessionsTableProps) {
  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 font-semibold text-neutral-500 shadow-2xs">
            <tr>
              <th className="px-4 py-3.5">User</th>
              <th className="px-4 py-3.5">Role</th>
              <ActivitySortHeader
                className="h-auto bg-neutral-50 px-4 py-3.5"
                direction={sortDirection}
                label="Time In (Manila)"
                onSort={onSort}
              />
              <th className="px-4 py-3.5">Time Out</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">IP Address</th>
              <th className="px-4 py-3.5 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
            {isError ? (
              <tr>
                <td
                  colSpan={7}
                  className="bg-neutral-50/60 py-16 text-center backdrop-blur-md"
                >
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600">
                    <AlertTriangleIcon className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-neutral-900">
                    Failed to load session logs
                  </div>
                  <div className="mx-auto mt-1 max-w-sm text-xs text-neutral-500">
                    Could not fetch session records from the backend API. Please
                    check your network connection or permissions.
                  </div>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-4 cursor-pointer rounded-xl bg-[#8B0000] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#6b0000]"
                    >
                      Retry Loading
                    </button>
                  )}
                </td>
              </tr>
            ) : isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-36 rounded bg-neutral-200" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-16 rounded-full bg-neutral-200" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-28 rounded bg-neutral-200" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-28 rounded bg-neutral-200" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-28 rounded-full bg-neutral-200" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-20 rounded bg-neutral-200" />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="ml-auto h-4 w-12 rounded bg-neutral-200" />
                  </td>
                </tr>
              ))
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-neutral-400">
                  No session records match the selected date range (
                  {formatDateUnambiguous(startDate)} to{" "}
                  {formatDateUnambiguous(endDate)}) or filters.
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr
                  key={s.sessionId}
                  onClick={() => onSelectSession(s.sessionId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onSelectSession(s.sessionId)
                    }
                  }}
                  className="cursor-pointer transition-colors hover:bg-neutral-50/80"
                >
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-neutral-900">
                      {s.userName}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {s.userEmail}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <SessionRoleBadge
                      role={s.userRole}
                      email={s.userEmail}
                      userName={s.userName}
                    />
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {formatManila(s.timeIn)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {s.timeOut ? formatManila(s.timeOut) : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <SessionStatusBadge session={s} />
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-neutral-500">
                    {s.ipAddress}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#8B0000] hover:underline">
                      View <ChevronRightIcon className="h-4 w-4" />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* TABLE PAGINATION FOOTER */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50/50 p-4 text-xs sm:flex-row">
        <div className="flex items-center gap-2 text-neutral-600">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="ml-2 text-neutral-400">
            Showing {sessions.length} of {totalEntries} entries
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" /> Previous
          </button>
          <span className="px-2 font-semibold text-neutral-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
