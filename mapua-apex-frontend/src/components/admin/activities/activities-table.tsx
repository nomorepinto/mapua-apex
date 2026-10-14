import { ChevronRightIcon, ChevronLeftIcon, AlertTriangleIcon } from "lucide-react";
import type { ActivityNotification } from "@/types/logs";
import { formatManila, formatDateUnambiguous } from "@/lib/monitor-formatters";
import { formatActivityId, resolveUserDisplayName } from "@/hooks/use-monitor";
import { ActivityBadge } from "./activity-badge";

interface ActivitiesTableProps {
  notifications: ActivityNotification[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelectNotification: (n: ActivityNotification) => void;
  currentPage: number;
  pageSize: number;
  totalEntries: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  startDate: string;
  endDate: string;
}

export function ActivitiesTable({
  notifications,
  isLoading,
  isError,
  onRetry,
  onSelectNotification,
  currentPage,
  pageSize,
  totalEntries,
  totalPages,
  onPageChange,
  onPageSizeChange,
  startDate,
  endDate,
}: ActivitiesTableProps) {
  return (
    <div className="rounded-2xl bg-white shadow-xs border border-neutral-200 overflow-hidden flex flex-col justify-between">
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200 shadow-2xs">
            <tr>
              <th className="px-4 py-3.5">Sent At (Manila)</th>
              <th className="px-4 py-3.5">ACTIVITY ID</th>
              <th className="px-4 py-3.5">USER</th>
              <th className="px-4 py-3.5">TYPE</th>
              <th className="px-4 py-3.5">REMARKS / COMMENT</th>
              <th className="px-4 py-3.5 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-neutral-700 font-medium">
            {isError ? (
              <tr>
                <td colSpan={6} className="py-16 text-center backdrop-blur-md bg-neutral-50/60">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mb-3 border border-red-200">
                    <AlertTriangleIcon className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-neutral-900">Failed to load activity logs</div>
                  <div className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                    Could not fetch activity records from the backend API. Please check your network connection or permissions.
                  </div>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-4 rounded-xl bg-[#8B0000] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#6b0000] transition-colors cursor-pointer"
                    >
                      Retry Loading
                    </button>
                  )}
                </td>
              </tr>
            ) : isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="px-4 py-3.5"><div className="h-4 w-28 bg-neutral-200 rounded" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-20 bg-neutral-200 rounded font-mono" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-32 bg-neutral-200 rounded" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-20 bg-neutral-200 rounded-full" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-48 bg-neutral-200 rounded" /></td>
                  <td className="px-4 py-3.5 text-right"><div className="h-4 w-12 bg-neutral-200 rounded ml-auto" /></td>
                </tr>
              ))
            ) : notifications.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-neutral-400">
                  No notification records match the selected date range ({formatDateUnambiguous(startDate)} to {formatDateUnambiguous(endDate)}) or filters.
                </td>
              </tr>
            ) : (
              notifications.map((n, idx) => (
                <tr
                  key={n.activity_id || `${n.submission_id}_${idx}`}
                  onClick={() => onSelectNotification(n)}
                  className="hover:bg-neutral-50/80 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3.5 whitespace-nowrap text-neutral-500 font-mono text-[11px]">
                    {formatManila(n.sent_at)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-neutral-900">
                    {n.activity_id || formatActivityId(undefined, n.sent_at)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-neutral-900">{resolveUserDisplayName(n)}</div>
                    {n.userEmail && <div className="text-[11px] text-neutral-400 font-mono">{n.userEmail}</div>}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <ActivityBadge type={n.notif_type} />
                  </td>
                  <td className="px-4 py-3.5 max-w-md truncate text-neutral-600">
                    {n.comment || <span className="text-neutral-400 italic">No comment</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <span className="text-[#8B0000] font-semibold hover:underline inline-flex items-center gap-1">
                      Details <ChevronRightIcon className="h-4 w-4" />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* TABLE PAGINATION FOOTER */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-neutral-200 bg-neutral-50/50 gap-3 text-xs">
        <div className="flex items-center gap-2 text-neutral-600">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold bg-white text-neutral-700"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-neutral-400 ml-2">
            Showing {notifications.length} of {totalEntries} entries
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-semibold text-neutral-700 disabled:opacity-40 hover:bg-neutral-50 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" /> Previous
          </button>
          <span className="font-semibold text-neutral-700 px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-semibold text-neutral-700 disabled:opacity-40 hover:bg-neutral-50 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
          >
            Next <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
