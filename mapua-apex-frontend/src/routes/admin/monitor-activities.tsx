import { useState, useMemo } from "react";
import {
  FileCheck2Icon,
  DownloadIcon,
  SearchIcon,
  XIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  FileEditIcon,
  StampIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { FormPageHeader } from "@/components/forms/form-page-header";
import { layout } from "@/config";
import {
  useActivitiesQuery,
  useActivityAnalyticsQuery,
  formatActivityId,
  formatEventId,
  resolveUserDisplayName,
  resolveUserGroup,
} from "@/hooks/use-monitor";
import type { LogQueryParams, ActivityNotification, NotificationType } from "@/types/logs";
import { IS_MOCK_MODE } from "@/lib/mock-monitor-data";

const MANILA_TZ = "Asia/Manila";

function formatManila(dateStr?: string): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: MANILA_TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return dateStr;
  }
}

function formatDateUnambiguous(dateStr?: string): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00+08:00`);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: MANILA_TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function getTodayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getYesterdayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - 24 * 60 * 60 * 1000));
}



export function AdminMonitorActivitiesPage() {
  // Filter State (Default range = yesterday to today Manila)
  const [startDate, setStartDate] = useState<string>(getYesterdayManila());
  const [endDate, setEndDate] = useState<string>(getTodayManila());
  const [notifTypeFilter, setNotifTypeFilter] = useState<string>("");
  const [activitySearch, setActivitySearch] = useState<string>("");
  const [signatorySearch, setSignatorySearch] = useState<string>("");

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal Selection State (Centered Floating Modal)
  const [selectedNotification, setSelectedNotification] = useState<ActivityNotification | null>(null);

  const queryParams: LogQueryParams = useMemo(
    () => ({
      startDate,
      endDate,
      notifType: notifTypeFilter || undefined,
      signatoryId: signatorySearch || undefined,
    }),
    [startDate, endDate, notifTypeFilter, signatorySearch]
  );

  const analyticsParams = useMemo(
    () => ({
      startDate,
      endDate,
    }),
    [startDate, endDate]
  );

  const activitiesQuery = useActivitiesQuery(queryParams);
  const activityAnalyticsQuery = useActivityAnalyticsQuery(analyticsParams);

  const isActivitiesLoading = activitiesQuery.isLoading || activitiesQuery.isFetching;

  const rawNotifications = activitiesQuery.data?.data ?? [];
  const activityStats = activityAnalyticsQuery.data;

  const notifications = useMemo(() => {
    return rawNotifications.filter((n, idx) => {
      if (notifTypeFilter) {
        if (notifTypeFilter === "submitted") {
          if (n.notif_type !== "submitted" && n.notif_type !== "submission_create") return false;
        } else if (n.notif_type !== notifTypeFilter) {
          return false;
        }
      }
      if (activitySearch) {
        const q = activitySearch.trim().toLowerCase();
        const actId = (n.activity_id || formatActivityId(undefined, n.sent_at + idx)).toLowerCase();
        const cleanActId = actId.replace(/-/g, "");
        const cleanQ = q.replace(/-/g, "");
        if (!actId.includes(q) && !cleanActId.includes(cleanQ)) return false;
      }
      if (signatorySearch && !n.signatory.toLowerCase().includes(signatorySearch.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [rawNotifications, notifTypeFilter, activitySearch, signatorySearch]);

  // Client-side pagination slice
  const totalPages = Math.ceil(notifications.length / pageSize) || 1;

  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return notifications.slice(start, start + pageSize);
  }, [notifications, currentPage, pageSize]);

  // CSV Export handler
  const handleExportCsv = () => {
    try {
      const headers = ["Sent At (Manila)", "Activity ID", "Event ID", "User", "Type", "Remarks / Comment"];
      const rows = notifications.map((n) => [
        formatManila(n.sent_at),
        n.activity_id || formatActivityId(undefined, n.sent_at),
        formatEventId(n.submission_id),
        `"${resolveUserDisplayName(n)}"`,
        n.notif_type,
        `"${(n.comment || "").replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `apex_activity_log_${getTodayManila()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("CSV Export failed", err);
    }
  };

  return (
    <div className={layout.page}>
      <div className="w-full space-y-6 px-4 py-4 md:px-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
          <FormPageHeader
            subtitle="Audit paper approval workflow notifications, signatory remarks, and status timeline records across SAAF submissions."
            title="Activity Log"
          />

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {IS_MOCK_MODE && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Mock Preview Mode
              </span>
            )}
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 rounded-xl bg-[#8B0000] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#6b0000] transition-colors"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* STAT CARDS SECTION (Respects page date range filter) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Submissions Range */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-neutral-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Submissions</span>
              <FileCheck2Icon className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-neutral-900">{activityStats?.submissionsToday ?? 0}</div>
            <p className="text-[10px] text-neutral-400 mt-1">Submitted in range</p>
          </div>

          {/* Card 2: Adviser Reviews */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-neutral-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Adviser</span>
              <StampIcon className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-neutral-900">{activityStats?.adviserReviews ?? 0}</div>
            <p className="text-[10px] text-neutral-400 mt-1">Adviser review decisions</p>
          </div>

          {/* Card 3: Dean Reviews */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-neutral-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Dean</span>
              <StampIcon className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-neutral-900">{activityStats?.deanReviews ?? 0}</div>
            <p className="text-[10px] text-neutral-400 mt-1">Dean office decisions</p>
          </div>

          {/* Card 4: OSAAR Reviews */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-neutral-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">OSAAR</span>
              <StampIcon className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-neutral-900">{activityStats?.osaarReviews ?? 0}</div>
            <p className="text-[10px] text-neutral-400 mt-1">OSAAR desk decisions</p>
          </div>

          {/* Card 5: CDM Reviews */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-neutral-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">CDM</span>
              <StampIcon className="h-4 w-4 text-teal-600" />
            </div>
            <div className="text-2xl font-bold text-neutral-900">{activityStats?.cdmReviews ?? 0}</div>
            <p className="text-[10px] text-neutral-400 mt-1">Campus Decisions</p>
          </div>

          {/* Card 6: In-Edit (Submissions status = returned) */}
          <div className="rounded-2xl bg-amber-50/70 p-4 shadow-xs border border-amber-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-800 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">In-Edit</span>
              <FileEditIcon className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-900">{activityStats?.inEditSubmissions ?? 0}</div>
            <p className="text-[10px] text-amber-700 mt-1">Returned for student revision</p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 rounded-2xl bg-white p-4 shadow-xs border border-neutral-200">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Type</label>
            <select
              value={notifTypeFilter}
              onChange={(e) => {
                setNotifTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
            >
              <option value="">All Types</option>
              <option value="submitted">submitted</option>
              <option value="approved">approved</option>
              <option value="returned">returned</option>
              <option value="denied">denied</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Activity ID</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search activity ID (e.g. ACT-31831)..."
                value={activitySearch}
                onChange={(e) => {
                  setActivitySearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-neutral-200 pl-8 pr-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
              />
              <SearchIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Signatory / User</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search user or desk..."
                value={signatorySearch}
                onChange={(e) => {
                  setSignatorySearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-neutral-200 pl-8 pr-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
              />
              <SearchIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
            </div>
          </div>
        </div>

        {/* DATA TABLE (SENT AT, ACTIVITY ID, USER, TYPE, REMARKS / COMMENT, DETAILS) */}
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
                {activitiesQuery.isError ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center backdrop-blur-md bg-neutral-50/60">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mb-3 border border-red-200">
                        <AlertTriangleIcon className="h-6 w-6" />
                      </div>
                      <div className="text-sm font-bold text-neutral-900">Failed to load activity logs</div>
                      <div className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                        Could not fetch activity records from the backend API. Please check your network connection or permissions.
                      </div>
                      <button
                        onClick={() => activitiesQuery.refetch()}
                        className="mt-4 rounded-xl bg-[#8B0000] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#6b0000] transition-colors"
                      >
                        Retry Loading
                      </button>
                    </td>
                  </tr>
                ) : isActivitiesLoading ? (
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
                ) : paginatedNotifications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                      No notification records match the selected date range ({formatDateUnambiguous(startDate)} to {formatDateUnambiguous(endDate)}) or filters.
                    </td>
                  </tr>
                ) : (
                  paginatedNotifications.map((n, idx) => {
                    const actId = n.activity_id || formatActivityId(undefined, n.sent_at + idx);
                    const userDisplay = resolveUserDisplayName(n);
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedNotification(n)}
                        className="hover:bg-neutral-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap text-neutral-500 font-mono text-[11px]">
                          {formatManila(n.sent_at)}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-neutral-900 font-bold">
                          {actId}
                        </td>
                        <td className="px-4 py-3.5 space-y-0.5">
                          <div className="font-semibold text-neutral-900 text-xs">
                            {userDisplay}
                          </div>
                          {n.userEmail && (
                            <div className="text-[10px] text-neutral-400 font-mono">
                              {n.userEmail}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <NotificationBadge type={n.notif_type} />
                        </td>
                        <td className="px-4 py-3.5 max-w-sm text-neutral-600 line-clamp-2 leading-relaxed">
                          {n.comment || <span className="text-neutral-400 italic">No comment attached</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <span className="text-[#8B0000] font-semibold hover:underline inline-flex items-center gap-1">
                            View <ChevronRightIcon className="h-4 w-4" />
                          </span>
                        </td>
                      </tr>
                    );
                  })
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
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold bg-white text-neutral-700"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-neutral-400 ml-2">
                Showing {paginatedNotifications.length} of {notifications.length} entries
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-semibold text-neutral-700 disabled:opacity-40 hover:bg-neutral-50 flex items-center gap-1"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="font-semibold text-neutral-700 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-semibold text-neutral-700 disabled:opacity-40 hover:bg-neutral-50 flex items-center gap-1"
              >
                Next <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* NOTIFICATION DETAIL MODAL (Centered Floating Modal) */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <FileCheck2Icon className="h-5 w-5 text-[#8B0000]" />
                  <h2 className="text-base font-bold text-neutral-900">Activity Log Record Details</h2>
                </div>
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <NotificationBadge type={selectedNotification.notif_type} />
                    <span className="font-mono text-neutral-500 text-[11px]">{formatManila(selectedNotification.sent_at)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-neutral-400 block font-medium">ACTIVITY ID</span>
                      <span className="font-mono font-bold text-neutral-900 text-xs">
                        {selectedNotification.activity_id || formatActivityId(undefined, selectedNotification.sent_at)}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">EVENT ID</span>
                      <span className="font-mono font-bold text-[#8B0000] text-xs">
                        {formatEventId(selectedNotification.submission_id)}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">USER</span>
                      <span className="font-semibold text-neutral-800 text-sm block">
                        {resolveUserDisplayName(selectedNotification)}
                      </span>
                      {selectedNotification.userEmail && (
                        <span className="block font-mono text-neutral-500 text-[10px]">{selectedNotification.userEmail}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">ROLE / USER GROUP</span>
                      <span className="font-mono font-bold text-neutral-900 text-xs rounded bg-neutral-200/80 px-2 py-0.5 inline-block mt-1">
                        {resolveUserGroup(selectedNotification)}
                      </span>
                    </div>
                    {selectedNotification.organization_name &&
                      selectedNotification.organization_name !== "N/A" &&
                      selectedNotification.organization_name !== "null" &&
                      selectedNotification.organization_name !== "undefined" && (
                        <div className="col-span-2 pt-1 border-t border-neutral-100">
                          <span className="text-neutral-400 block font-medium">ORGANIZATION</span>
                          <span className="font-semibold text-neutral-800">{selectedNotification.organization_name}</span>
                        </div>
                      )}
                  </div>

                  <div className="pt-2 border-t border-neutral-200">
                    <span className="text-neutral-400 block font-medium mb-1">REMARKS / COMMENT</span>
                    <div className="rounded-xl bg-white p-3 border border-neutral-200 text-neutral-800 leading-relaxed font-sans text-xs">
                      {selectedNotification.comment || <span className="text-neutral-400 italic">No comment provided.</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 bg-neutral-50/50 text-right">
              <button
                onClick={() => setSelectedNotification(null)}
                className="rounded-xl bg-neutral-200 px-5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-300 transition-colors"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationBadge({ type }: { type: NotificationType | string }) {
  const norm = String(type || "").toLowerCase().replace(/_/g, " ");
  if (norm.includes("approve")) {
    return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">approved</span>;
  }
  if (norm.includes("return") || norm.includes("revision")) {
    return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">returned</span>;
  }
  if (norm.includes("deny") || norm.includes("denied")) {
    return <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800 border border-red-200 font-mono">denied</span>;
  }
  if (norm.includes("create") || norm.includes("submit") || norm.includes("submission")) {
    return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">submitted</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700 border border-neutral-200">{type}</span>;
}
