import { useState, useMemo } from "react";
import { DownloadIcon } from "lucide-react";
import { FormPageHeader } from "@/components/forms/form-page-header";
import { layout } from "@/config";
import {
  useActivitiesQuery,
  useActivityAnalyticsQuery,
  formatActivityId,
  formatEventId,
  resolveUserDisplayName,
} from "@/hooks/use-monitor";
import type { LogQueryParams, ActivityNotification } from "@/types/logs";
import { IS_MOCK_MODE } from "@/lib/mock-monitor-data";
import { exportToCsv } from "@/lib/export-csv";
import { formatManila, getTodayManila, getYesterdayManila } from "@/lib/monitor-formatters";
import { ActivityStatCards } from "@/components/admin/activities/activity-stat-cards";
import { ActivitiesFilterBar } from "@/components/admin/activities/activities-filter-bar";
import { ActivitiesTable } from "@/components/admin/activities/activities-table";
import { ActivityDetailModal } from "@/components/admin/activities/activity-detail-modal";

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

  // Modal Detail State
  const [selectedNotification, setSelectedNotification] = useState<ActivityNotification | null>(null);

  const queryParams: LogQueryParams = useMemo(
    () => ({
      startDate,
      endDate,
      notifType: notifTypeFilter || undefined,
      activityId: activitySearch || undefined,
      signatoryId: signatorySearch || undefined,
    }),
    [startDate, endDate, notifTypeFilter, activitySearch, signatorySearch]
  );

  const activitiesQuery = useActivitiesQuery(queryParams);
  const activityAnalyticsQuery = useActivityAnalyticsQuery(queryParams);

  const isActivitiesLoading = activitiesQuery.isLoading || activitiesQuery.isFetching;
  const rawNotifications = activitiesQuery.data?.data ?? [];
  const activityStats = activityAnalyticsQuery.data;

  // Instant Client-side Filter
  const filteredNotifications = useMemo(() => {
    return rawNotifications.filter((n) => {
      if (notifTypeFilter) {
        const norm = (n.notif_type || "").toLowerCase();
        const f = notifTypeFilter.toLowerCase();
        if (f === "approved" && !norm.includes("approve")) return false;
        if (f === "returned" && !norm.includes("return") && !norm.includes("revision")) return false;
        if (f === "denied" && !norm.includes("deny")) return false;
        if (f === "submitted" && !norm.includes("submit") && !norm.includes("create")) return false;
      }

      if (activitySearch) {
        const query = activitySearch.toLowerCase();
        const actId = (n.activity_id || formatActivityId(undefined, n.sent_at)).toLowerCase();
        const subId = (n.submission_id || "").toLowerCase();
        if (!actId.includes(query) && !subId.includes(query)) return false;
      }

      if (signatorySearch) {
        const query = signatorySearch.toLowerCase();
        const userName = (resolveUserDisplayName(n) || "").toLowerCase();
        const email = (n.userEmail || "").toLowerCase();
        const signatory = (n.signatory || "").toLowerCase();
        if (!userName.includes(query) && !email.includes(query) && !signatory.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [rawNotifications, notifTypeFilter, activitySearch, signatorySearch]);

  const totalPages = Math.ceil(filteredNotifications.length / pageSize) || 1;

  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredNotifications.slice(start, start + pageSize);
  }, [filteredNotifications, currentPage, pageSize]);

  // CSV Export handler
  const handleExportCsv = () => {
    const headers = [
      "Sent At (Manila)",
      "Activity ID",
      "Event ID",
      "User",
      "Type",
      "Remarks / Comment",
    ];
    const rows = filteredNotifications.map((n) => [
      formatManila(n.sent_at),
      n.activity_id || formatActivityId(undefined, n.sent_at),
      formatEventId(n.submission_id),
      resolveUserDisplayName(n),
      n.notif_type,
      n.comment || "",
    ]);

    exportToCsv(`apex_activity_log_${getTodayManila()}.csv`, headers, rows);
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
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-2 rounded-xl bg-[#8B0000] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#6b0000] transition-colors cursor-pointer"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* STAT CARDS SECTION */}
        <ActivityStatCards stats={activityStats} />

        {/* Filters Bar */}
        <ActivitiesFilterBar
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={(val) => {
            setStartDate(val);
            setCurrentPage(1);
          }}
          onEndDateChange={(val) => {
            setEndDate(val);
            setCurrentPage(1);
          }}
          notifTypeFilter={notifTypeFilter}
          onNotifTypeFilterChange={(val) => {
            setNotifTypeFilter(val);
            setCurrentPage(1);
          }}
          activitySearch={activitySearch}
          onActivitySearchChange={(val) => {
            setActivitySearch(val);
            setCurrentPage(1);
          }}
          signatorySearch={signatorySearch}
          onSignatorySearchChange={(val) => {
            setSignatorySearch(val);
            setCurrentPage(1);
          }}
        />

        {/* DATA TABLE */}
        <ActivitiesTable
          notifications={paginatedNotifications}
          isLoading={isActivitiesLoading}
          isError={activitiesQuery.isError}
          onRetry={() => activitiesQuery.refetch()}
          onSelectNotification={setSelectedNotification}
          currentPage={currentPage}
          pageSize={pageSize}
          totalEntries={filteredNotifications.length}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      {/* NOTIFICATION DETAIL MODAL */}
      <ActivityDetailModal
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
      />
    </div>
  );
}
export default AdminMonitorActivitiesPage;
