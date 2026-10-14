import { ChevronRightIcon, ChevronLeftIcon, AlertTriangleIcon } from "lucide-react";
import type { Session } from "@/types/logs";
import { formatManila, formatDateUnambiguous } from "@/lib/monitor-formatters";
import { SessionRoleBadge } from "./session-role-badge";

interface SessionsTableProps {
  sessions: Session[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelectSession: (sessionId: string) => void;
  currentPage: number;
  pageSize: number;
  totalEntries: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  startDate: string;
  endDate: string;
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
}: SessionsTableProps) {
  return (
    <div className="rounded-2xl bg-white shadow-xs border border-neutral-200 overflow-hidden flex flex-col justify-between">
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200 shadow-2xs">
            <tr>
              <th className="px-4 py-3.5">User</th>
              <th className="px-4 py-3.5">Role</th>
              <th className="px-4 py-3.5">Time In (Manila)</th>
              <th className="px-4 py-3.5">Time Out</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">IP Address</th>
              <th className="px-4 py-3.5 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-neutral-700 font-medium">
            {isError ? (
              <tr>
                <td colSpan={7} className="py-16 text-center backdrop-blur-md bg-neutral-50/60">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mb-3 border border-red-200">
                    <AlertTriangleIcon className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-neutral-900">Failed to load session logs</div>
                  <div className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                    Could not fetch session records from the backend API. Please check your network connection or permissions.
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
                  <td className="px-4 py-3.5"><div className="h-4 w-36 bg-neutral-200 rounded" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-16 bg-neutral-200 rounded-full" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-28 bg-neutral-200 rounded" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-28 bg-neutral-200 rounded" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-28 bg-neutral-200 rounded-full" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-20 bg-neutral-200 rounded" /></td>
                  <td className="px-4 py-3.5 text-right"><div className="h-4 w-12 bg-neutral-200 rounded ml-auto" /></td>
                </tr>
              ))
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-neutral-400">
                  No session records match the selected date range ({formatDateUnambiguous(startDate)} to {formatDateUnambiguous(endDate)}) or filters.
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr
                  key={s.sessionId}
                  onClick={() => onSelectSession(s.sessionId)}
                  className="hover:bg-neutral-50/80 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-neutral-900">{s.userName}</div>
                    <div className="text-[11px] text-neutral-400">{s.userEmail}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <SessionRoleBadge role={s.userRole} email={s.userEmail} userName={s.userName} />
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">{formatManila(s.timeIn)}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {s.timeOut ? formatManila(s.timeOut) : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    {s.status === "active" || s.status === "no_logout_recorded" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </span>
                    ) : s.status === "timed_out" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Timed out ({s.endReason || "timed_out"})
                      </span>
                    ) : s.status === "revoked" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        Revoked ({s.endReason || "admin_revoked"})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 border border-neutral-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                        Logged out ({s.endReason || "logout"})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-neutral-500">{s.ipAddress}</td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <span className="text-[#8B0000] font-semibold hover:underline inline-flex items-center gap-1">
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
            Showing {sessions.length} of {totalEntries} entries
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
