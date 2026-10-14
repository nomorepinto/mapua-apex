import { useState, useMemo } from "react";
import { DownloadIcon } from "lucide-react";
import { FormPageHeader } from "@/components/forms/form-page-header";
import { layout } from "@/config";
import {
  useSessionsQuery,
  useSessionDetailQuery,
  useSessionAnalyticsQuery,
  classifySessionRole,
  classifySignatorySubtype,
} from "@/hooks/use-monitor";
import type { LogQueryParams } from "@/types/logs";
import { IS_MOCK_MODE } from "@/lib/mock-monitor-data";
import { exportToCsv } from "@/lib/export-csv";
import { formatManila, getTodayManila, getYesterdayManila } from "@/lib/monitor-formatters";
import { SessionVolumeChart } from "@/components/admin/sessions/session-volume-chart";
import { SessionDurationCard } from "@/components/admin/sessions/session-duration-card";
import { LoginsByRoleCard } from "@/components/admin/sessions/logins-by-role-card";
import { PeakHoursHeatmapCard } from "@/components/admin/sessions/peak-hours-heatmap-card";
import { SessionsFilterBar } from "@/components/admin/sessions/sessions-filter-bar";
import { SessionsTable } from "@/components/admin/sessions/sessions-table";
import { SessionDetailModal } from "@/components/admin/sessions/session-detail-modal";

export function AdminMonitorSessionsPage() {
  // Filter State (Default range = yesterday to today Manila)
  const [startDate, setStartDate] = useState<string>(getYesterdayManila());
  const [endDate, setEndDate] = useState<string>(getTodayManila());
  const [userSearch, setUserSearch] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [compareMode, setCompareMode] = useState<"month" | "year">("month");

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal Selection State
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const dateQueryParams: LogQueryParams = useMemo(
    () => ({
      startDate,
      endDate,
    }),
    [startDate, endDate]
  );

  const analyticsParams = useMemo(
    () => ({
      startDate,
      endDate,
      compare: compareMode,
    }),
    [startDate, endDate, compareMode]
  );

  const sessionsQuery = useSessionsQuery(dateQueryParams);
  const sessionAnalyticsQuery = useSessionAnalyticsQuery(analyticsParams);
  const sessionDetailQuery = useSessionDetailQuery(selectedSessionId);

  const isSessionsLoading = sessionsQuery.isLoading || sessionsQuery.isFetching;
  const isAnalyticsLoading = sessionAnalyticsQuery.isLoading || sessionAnalyticsQuery.isFetching;

  const rawSessions = sessionsQuery.data?.data ?? [];
  const sessionStats = sessionAnalyticsQuery.data;

  // Unified role stats: ensure signatories are properly counted
  const roleStats = useMemo(() => {
    if (sessionStats?.loginsByRole && sessionStats.loginsByRole.signatory > 0) {
      return sessionStats.loginsByRole;
    }
    if (rawSessions.length > 0) {
      let student = 0;
      let signatory = 0;
      let admin = 0;
      const breakdown = { adviser: 0, dean: 0, osaar: 0, cdm: 0 };
      rawSessions.forEach((s) => {
        const cat = classifySessionRole(s.userRole, s.userEmail, s.userName);
        if (cat === "admin") admin++;
        else if (cat === "signatory") {
          signatory++;
          const sub = classifySignatorySubtype(s.userRole, s.userEmail, s.userName);
          breakdown[sub]++;
        } else {
          student++;
        }
      });
      return {
        student,
        signatory,
        admin,
        signatoriesBreakdown: breakdown,
      };
    }
    return sessionStats?.loginsByRole;
  }, [sessionStats, rawSessions]);

  // Instant Client-Side Filter
  const filteredSessions = useMemo(() => {
    return rawSessions.filter((s) => {
      // 1. User Search filter
      if (userSearch) {
        const q = userSearch.trim().toLowerCase();
        const matchesUser =
          (s.userName || "").toLowerCase().includes(q) ||
          (s.userEmail || "").toLowerCase().includes(q) ||
          (s.userId || "").toLowerCase().includes(q) ||
          (s.sessionId || "").toLowerCase().includes(q) ||
          (s.ipAddress || "").toLowerCase().includes(q);
        if (!matchesUser) return false;
      }

      // 2. Role filter
      if (roleFilter) {
        const r = (s.userRole || "").toLowerCase();
        const email = (s.userEmail || "").toLowerCase();
        const name = (s.userName || "").toLowerCase();

        if (roleFilter === "org_adviser" || roleFilter === "adviser") {
          const isAdviser =
            r === "org_adviser" ||
            r === "adviser" ||
            r.includes("adviser") ||
            email.includes("adviser") ||
            name.includes("adviser") ||
            r === "signatory";
          if (!isAdviser) return false;
        } else if (roleFilter === "dean") {
          const isDean = r === "dean" || r.includes("dean") || email.includes("dean") || name.includes("dean");
          if (!isDean) return false;
        } else if (roleFilter === "osaar") {
          const isOsaar = r === "osaar" || r.includes("osaar") || email.includes("osaar") || name.includes("osaar");
          if (!isOsaar) return false;
        } else if (roleFilter === "cdm") {
          const isCdm = r === "cdm" || r.includes("cdm") || email.includes("cdm") || name.includes("cdm") || name.includes("director");
          if (!isCdm) return false;
        } else if (roleFilter === "admin") {
          const isAdmin = r === "admin" || email.includes("admin") || name.includes("admin");
          if (!isAdmin) return false;
        } else if (roleFilter === "student") {
          const isStudent = r === "student" || r === "students" || r.includes("submitter");
          if (!isStudent) return false;
        }
      }

      // 3. Status filter
      if (statusFilter) {
        const status = s.status || "active";
        if (statusFilter === "active") {
          if (status !== "active" && status !== "no_logout_recorded") return false;
        } else if (status !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [rawSessions, userSearch, roleFilter, statusFilter]);

  // Client-side pagination slice
  const totalSessionPages = Math.ceil(filteredSessions.length / pageSize) || 1;

  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, currentPage, pageSize]);

  // CSV Export handler
  const handleExportCsv = () => {
    const headers = [
      "Session ID",
      "User Name",
      "Email",
      "Role",
      "Time In",
      "Time Out",
      "End Reason",
      "Status",
      "IP Address",
    ];
    const rows = filteredSessions.map((s) => [
      s.sessionId,
      s.userName,
      s.userEmail,
      s.userRole,
      formatManila(s.timeIn),
      s.timeOut ? formatManila(s.timeOut) : "N/A",
      s.endReason || (s.status === "active" ? "N/A" : "logout"),
      s.status === "active"
        ? "Active"
        : s.status === "timed_out"
        ? `Timed out (${s.endReason || "timed_out"})`
        : s.status === "revoked"
        ? `Revoked (${s.endReason || "admin_revoked"})`
        : `Logged out (${s.endReason || "logout"})`,
      s.ipAddress,
    ]);

    exportToCsv(`apex_session_log_${getTodayManila()}.csv`, headers, rows);
  };

  return (
    <div className={layout.page}>
      <div className="w-full space-y-6 px-4 py-4 md:px-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
          <FormPageHeader
            subtitle="Detailed log of authenticated user sessions, IP addresses, session duration, and page navigation timelines."
            title="Session Log"
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

        {/* SESSION ANALYTICS SECTION (Charts & Heatmap) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SessionVolumeChart
            loginVolume={sessionStats?.loginVolume}
            compareMode={compareMode}
            onToggleCompareMode={setCompareMode}
            isLoading={isAnalyticsLoading}
          />

          <div className="space-y-4">
            <SessionDurationCard
              avgMinutes={sessionStats?.avgSessionDurationMinutes}
              loggedOutCount={sessionStats?.loggedOutSessionCount}
              isLoading={isAnalyticsLoading}
            />

            <LoginsByRoleCard
              loginsByRole={roleStats}
              isLoading={isAnalyticsLoading && !roleStats}
            />
          </div>
        </div>

        {/* PEAK HOURS HEATMAP (Day of Week x Hour of Day) */}
        <PeakHoursHeatmapCard
          heatmapData={sessionStats?.heatmapData}
          isLoading={isAnalyticsLoading}
        />

        {/* Filters Bar */}
        <SessionsFilterBar
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
          userSearch={userSearch}
          onUserSearchChange={(val) => {
            setUserSearch(val);
            setCurrentPage(1);
          }}
          roleFilter={roleFilter}
          onRoleFilterChange={(val) => {
            setRoleFilter(val);
            setCurrentPage(1);
          }}
          statusFilter={statusFilter}
          onStatusFilterChange={(val) => {
            setStatusFilter(val);
            setCurrentPage(1);
          }}
        />

        {/* DATA TABLE (FULL WIDTH + STICKY HEADER) */}
        <SessionsTable
          sessions={paginatedSessions}
          isLoading={isSessionsLoading}
          isError={sessionsQuery.isError}
          onRetry={() => sessionsQuery.refetch()}
          onSelectSession={setSelectedSessionId}
          currentPage={currentPage}
          pageSize={pageSize}
          totalEntries={filteredSessions.length}
          totalPages={totalSessionPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      {/* SESSION DETAIL MODAL */}
      <SessionDetailModal
        sessionId={selectedSessionId}
        session={sessionDetailQuery.data?.session}
        isLoading={sessionDetailQuery.isLoading}
        onClose={() => setSelectedSessionId(null)}
      />
    </div>
  );
}
export default AdminMonitorSessionsPage;
