import { useState, useMemo } from "react";
import {
  UsersIcon,
  DownloadIcon,
  SearchIcon,
  XIcon,
  ChevronRightIcon,
  LaptopIcon,
  ChevronLeftIcon,
  ClockIcon,
  BarChart3Icon,
  GridIcon,
  EyeIcon,
  EyeOffIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { FormPageHeader } from "@/components/forms/form-page-header";
import { layout } from "@/config";
import { useSessionsQuery, useSessionDetailQuery, useSessionAnalyticsQuery } from "@/hooks/use-monitor";
import type { LogQueryParams } from "@/types/logs";
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



const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AdminMonitorSessionsPage() {
  // Filter State (Default range = yesterday to today Manila)
  const [startDate, setStartDate] = useState<string>(getYesterdayManila());
  const [endDate, setEndDate] = useState<string>(getTodayManila());
  const [userSearch, setUserSearch] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [compareMode, setCompareMode] = useState<"month" | "year">("month");
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal Selection State (Centered Floating Modal)
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

  // Instant Client-Side Filter (Zero Reload, Accurate Role Matching for Adviser & Others)
  const filteredSessions = useMemo(() => {
    return rawSessions.filter((s) => {
      // 1. User Search filter
      if (userSearch) {
        const q = userSearch.trim().toLowerCase();
        const matchesUser =
          s.userName.toLowerCase().includes(q) ||
          s.userEmail.toLowerCase().includes(q) ||
          s.userId.toLowerCase().includes(q);
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
        if (statusFilter === "logged_out") {
          if (s.status !== "logged_out" && !s.timeOut) return false;
        } else if (statusFilter === "no_logout_recorded") {
          if (s.status === "logged_out" || Boolean(s.timeOut)) return false;
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
    try {
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
        `"${s.userName}"`,
        s.userEmail,
        s.userRole,
        formatManila(s.timeIn),
        s.timeOut ? formatManila(s.timeOut) : "N/A",
        s.endReason || "N/A",
        s.status === "logged_out" ? `Logged out (${s.endReason || "logout"})` : "No logout recorded",
        s.ipAddress,
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `apex_session_log_${getTodayManila()}.csv`);
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
              onClick={handleExportCsv}
              className="flex items-center gap-2 rounded-xl bg-[#8B0000] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#6b0000] transition-colors"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>



        {/* SESSION ANALYTICS SECTION (Charts & Heatmap) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart 1: Login Volume with Comparison Toggle */}
          <div className="lg:col-span-2 rounded-2xl bg-white p-5 shadow-xs border border-neutral-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-xs font-bold text-neutral-900 flex items-center gap-2 uppercase tracking-wider">
                  <BarChart3Icon className="h-4 w-4 text-[#8B0000]" />
                  Login Volume by Hour of Day
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Overlaid comparison of login traffic trends across time periods.
                </p>
              </div>

              {/* Toggle: Compare vs Month / Year */}
              <div className="flex items-center rounded-xl bg-neutral-100 p-1 text-xs font-semibold border border-neutral-200 self-start sm:self-auto">
                <button
                  onClick={() => setCompareMode("month")}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    compareMode === "month"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  vs Month Avg
                </button>
                <button
                  onClick={() => setCompareMode("year")}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    compareMode === "year"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  vs Year Avg
                </button>
              </div>
            </div>

            {/* Overlaid Bar / Line Visualizer */}
            {isAnalyticsLoading ? (
              <div className="h-44 flex items-end justify-between gap-2 pt-4 border-b border-neutral-100 pb-2 animate-pulse">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div className="w-full bg-neutral-200 rounded-t h-3/4 animate-pulse" />
                    <span className="h-2 w-6 bg-neutral-200 rounded font-mono" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-44 flex items-end justify-between gap-2 pt-4 border-b border-neutral-100 pb-2">
                {sessionStats?.loginVolume.hours.map((hr, idx) => {
                  const todayVal = sessionStats.loginVolume.today[idx] || 0;
                  const compVal =
                    compareMode === "month"
                      ? sessionStats.loginVolume.monthAvg[idx] || 0
                      : sessionStats.loginVolume.yearAvg[idx] || 0;

                  const maxVal = Math.max(
                    ...sessionStats.loginVolume.today,
                    ...sessionStats.loginVolume.monthAvg,
                    1
                  );
                  const todayPct = todayVal > 0 ? Math.max((todayVal / maxVal) * 100, 4) : 0;
                  const compPct = compVal > 0 ? Math.max((compVal / maxVal) * 100, 4) : 0;

                  return (
                    <div key={hr} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                      <div className="w-full flex items-end justify-center gap-0.5 h-full relative">
                        {/* Today Bar */}
                        <div
                          style={{ height: `${todayPct}%` }}
                          className="w-1/2 bg-[#8B0000] rounded-t transition-all group-hover:bg-[#6b0000] relative"
                        >
                          <span className="opacity-0 group-hover:opacity-100 absolute -top-5 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[9px] px-1 rounded z-10 whitespace-nowrap">
                            Today: {todayVal}
                          </span>
                        </div>
                        {/* Comparison Avg Bar */}
                        <div
                          style={{ height: `${compPct}%` }}
                          className="w-1/2 bg-neutral-300 rounded-t transition-all group-hover:bg-neutral-400 relative"
                        >
                          <span className="opacity-0 group-hover:opacity-100 absolute -top-9 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[9px] px-1 rounded z-10 whitespace-nowrap">
                            {compareMode === "month" ? "Month" : "Year"} Avg: {compVal}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] text-neutral-400 font-mono">{hr}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-[#8B0000]" />
                <span className="font-semibold text-neutral-700">Selected Date</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-neutral-300" />
                <span className="font-semibold text-neutral-700">
                  {compareMode === "month" ? "This Month (Daily Avg)" : "This Year (Daily Avg)"}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Column: Duration & Role Breakdown */}
          <div className="space-y-4">
            {/* Avg Session Duration Card (Computed ONLY from logged-out sessions) */}
            <div className="rounded-2xl bg-white p-5 shadow-xs border border-neutral-200 space-y-2">
              <div className="flex items-center justify-between text-neutral-500">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                  <ClockIcon className="h-4 w-4 text-[#8B0000]" />
                  Average Session Duration
                </span>
              </div>
              {isAnalyticsLoading ? (
                <div className="space-y-2 animate-pulse py-1">
                  <div className="h-8 w-28 bg-neutral-200 rounded-lg" />
                  <div className="h-6 w-full bg-neutral-100 rounded-lg" />
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-neutral-900">
                    {sessionStats?.avgSessionDurationMinutes ?? 0} <span className="text-sm font-semibold text-neutral-500">mins</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 font-medium bg-neutral-50 rounded-lg p-2 border border-neutral-200">
                    Based on logged-out sessions (n = {sessionStats?.loggedOutSessionCount ?? 0})
                  </p>
                </>
              )}
            </div>

            {/* Logins by Role Breakdown */}
            <div className="rounded-2xl bg-white p-5 shadow-xs border border-neutral-200 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                  <UsersIcon className="h-4 w-4 text-[#8B0000]" />
                  Logins by Role
                </span>
              </div>
              {isAnalyticsLoading ? (
                <div className="space-y-3 animate-pulse py-1">
                  <div className="h-4 bg-neutral-200 rounded w-full" />
                  <div className="h-4 bg-neutral-200 rounded w-full" />
                  <div className="h-4 bg-neutral-200 rounded w-full" />
                </div>
              ) : (() => {
                const totalRoleLogins =
                  (sessionStats?.loginsByRole.student ?? 0) +
                  (sessionStats?.loginsByRole.signatory ?? 0) +
                  (sessionStats?.loginsByRole.admin ?? 0);
                const studentPct =
                  totalRoleLogins > 0
                    ? Math.round(((sessionStats?.loginsByRole.student ?? 0) / totalRoleLogins) * 100)
                    : 0;
                const signatoryPct =
                  totalRoleLogins > 0
                    ? Math.round(((sessionStats?.loginsByRole.signatory ?? 0) / totalRoleLogins) * 100)
                    : 0;
                const adminPct =
                  totalRoleLogins > 0
                    ? Math.round(((sessionStats?.loginsByRole.admin ?? 0) / totalRoleLogins) * 100)
                    : 0;

                return (
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between font-medium mb-1">
                        <span className="text-neutral-700 font-semibold">Student</span>
                        <span className="text-neutral-900 font-bold">{sessionStats?.loginsByRole.student ?? 0}</span>
                      </div>
                      <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-neutral-800 h-full rounded-full transition-all duration-300"
                          style={{ width: `${studentPct}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-medium mb-1">
                        <span className="text-amber-700 font-semibold">Signatories (Dean / Adviser / CDM)</span>
                        <span className="text-neutral-900 font-bold">{sessionStats?.loginsByRole.signatory ?? 0}</span>
                      </div>
                      <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${signatoryPct}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-medium mb-1">
                        <span className="text-blue-700 font-semibold">Admin</span>
                        <span className="text-neutral-900 font-bold">{sessionStats?.loginsByRole.admin ?? 0}</span>
                      </div>
                      <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${adminPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* PEAK HOURS HEATMAP (Day of Week x Hour of Day) */}
        <div className="rounded-2xl bg-white p-5 shadow-xs border border-neutral-200 space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <div>
              <h2 className="text-xs font-bold text-neutral-900 flex items-center gap-2 uppercase tracking-wider">
                <GridIcon className="h-4 w-4 text-[#8B0000]" />
                Peak Hours Heatmap (Day of Week × Hour of Day)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowHeatmap((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              {showHeatmap ? (
                <>
                  <EyeOffIcon className="h-3.5 w-3.5 text-neutral-500" />
                  Hide Heatmap
                </>
              ) : (
                <>
                  <EyeIcon className="h-3.5 w-3.5 text-[#8B0000]" />
                  Show Heatmap
                </>
              )}
            </button>
          </div>

          {showHeatmap && (
            <div className="overflow-x-auto pt-2 animate-in fade-in duration-150">
              {isAnalyticsLoading ? (
                <div className="min-w-[700px] space-y-1 py-2 animate-pulse">
                  {Array.from({ length: 7 }).map((_, r) => (
                    <div key={r} className="h-6 bg-neutral-100 rounded-md w-full" />
                  ))}
                </div>
              ) : (
                <div className="min-w-[700px] space-y-1">
                  {/* Hours Header */}
                  <div className="flex text-[9px] font-mono text-neutral-400 pb-1">
                    <div className="w-12 shrink-0 font-bold text-neutral-600">Day</div>
                    {Array.from({ length: 24 }).map((_, hr) => (
                      <div key={hr} className="flex-1 text-center">
                        {hr.toString().padStart(2, "0")}
                      </div>
                    ))}
                  </div>

                  {/* 7 Days Rows */}
                  {DAYS_OF_WEEK.map((dayName, dayIdx) => (
                    <div key={dayName} className="flex items-center">
                      <div className="w-12 shrink-0 text-xs font-bold text-neutral-600">{dayName}</div>
                      <div className="flex-1 flex gap-1">
                        {Array.from({ length: 24 }).map((_, hrIdx) => {
                          const match = sessionStats?.heatmapData.find(
                            (cell) => cell.dayOfWeek === dayIdx && cell.hour === hrIdx
                          );
                          const count = match?.count ?? 0;

                          let colorClass = "bg-neutral-100 border-neutral-200";
                          if (count > 40) colorClass = "bg-[#8B0000] text-white";
                          else if (count > 25) colorClass = "bg-red-600 text-white";
                          else if (count > 15) colorClass = "bg-red-400 text-white";
                          else if (count > 5) colorClass = "bg-red-200 text-red-900";
                          else if (count > 0) colorClass = "bg-red-50 text-red-800 border-red-200";

                          return (
                            <div
                              key={hrIdx}
                              title={`${dayName} ${hrIdx}:00 — ${count} logins`}
                              className={`flex-1 h-6 rounded-md border text-[9px] font-mono flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${colorClass}`}
                            >
                              {count > 0 ? count : ""}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">User Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Name or email..."
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-neutral-200 pl-8 pr-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
              />
              <SearchIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
            >
              <option value="">All Roles</option>
              <option value="student">Student</option>
              <option value="org_adviser">Adviser</option>
              <option value="dean">Dean</option>
              <option value="osaar">OSAAR</option>
              <option value="cdm">CDM</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
            >
              <option value="">All Statuses</option>
              <option value="logged_out">Logged out</option>
              <option value="no_logout_recorded">No logout recorded</option>
            </select>
          </div>
        </div>

        {/* DATA TABLE (FULL WIDTH + STICKY HEADER) */}
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
                {sessionsQuery.isError ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center backdrop-blur-md bg-neutral-50/60">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mb-3 border border-red-200">
                        <AlertTriangleIcon className="h-6 w-6" />
                      </div>
                      <div className="text-sm font-bold text-neutral-900">Failed to load session logs</div>
                      <div className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                        Could not fetch session records from the backend API. Please check your network connection or permissions.
                      </div>
                      <button
                        onClick={() => sessionsQuery.refetch()}
                        className="mt-4 rounded-xl bg-[#8B0000] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#6b0000] transition-colors"
                      >
                        Retry Loading
                      </button>
                    </td>
                  </tr>
                ) : isSessionsLoading ? (
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
                ) : paginatedSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                      No session records match the selected date range ({formatDateUnambiguous(startDate)} to {formatDateUnambiguous(endDate)}) or filters.
                    </td>
                  </tr>
                ) : (
                  paginatedSessions.map((s) => (
                    <tr
                      key={s.sessionId}
                      onClick={() => setSelectedSessionId(s.sessionId)}
                      className="hover:bg-neutral-50/80 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-neutral-900">{s.userName}</div>
                        <div className="text-[11px] text-neutral-400">{s.userEmail}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <RoleBadge role={s.userRole} email={s.userEmail} userName={s.userName} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">{formatManila(s.timeIn)}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {s.timeOut ? formatManila(s.timeOut) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {s.status === "logged_out" || s.timeOut ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 border border-neutral-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                            Logged out ({s.endReason || "logout"})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 border border-neutral-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                            No logout recorded
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
                Showing {paginatedSessions.length} of {filteredSessions.length} entries
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
                Page {currentPage} of {totalSessionPages}
              </span>
              <button
                disabled={currentPage >= totalSessionPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-semibold text-neutral-700 disabled:opacity-40 hover:bg-neutral-50 flex items-center gap-1"
              >
                Next <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SESSION DETAIL MODAL (Centered Floating Modal) */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">Session Details</h2>
                  <p className="font-mono text-xs text-neutral-400">{selectedSessionId}</p>
                </div>
                <button
                  onClick={() => setSelectedSessionId(null)}
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              {sessionDetailQuery.isLoading ? (
                <div className="py-12 text-center text-neutral-400">Loading session timeline...</div>
              ) : sessionDetailQuery.data?.session ? (
                <div className="space-y-6">
                  {/* Identity Card */}
                  <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-200 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-neutral-400 block font-medium">User Name</span>
                      <span className="font-bold text-neutral-900 text-sm">{sessionDetailQuery.data.session.userName}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">Email</span>
                      <span className="font-semibold text-neutral-800">{sessionDetailQuery.data.session.userEmail}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">Role</span>
                      <RoleBadge
                        role={sessionDetailQuery.data.session.userRole}
                        email={sessionDetailQuery.data.session.userEmail}
                        userName={sessionDetailQuery.data.session.userName}
                      />
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">IP Address</span>
                      <span className="font-mono font-medium text-neutral-700">{sessionDetailQuery.data.session.ipAddress}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">Time In</span>
                      <span className="font-medium text-neutral-800">{formatManila(sessionDetailQuery.data.session.timeIn)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">Time Out</span>
                      <span className="font-medium text-neutral-800">
                        {sessionDetailQuery.data.session.timeOut
                          ? formatManila(sessionDetailQuery.data.session.timeOut)
                          : "—"}
                      </span>
                    </div>
                    <div className="col-span-2 border-t border-neutral-200/60 pt-2">
                      <span className="text-neutral-400 block font-medium">Session Status</span>
                      <span className="font-semibold text-neutral-700">
                        {sessionDetailQuery.data.session.status === "logged_out" || sessionDetailQuery.data.session.timeOut
                          ? `Logged out (${sessionDetailQuery.data.session.endReason || "logout"})`
                          : "No logout recorded"}
                      </span>
                    </div>
                  </div>

                  {/* Pages Visited Timeline */}
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                      <LaptopIcon className="h-4 w-4 text-[#8B0000]" />
                      Pages Visited Timeline ({sessionDetailQuery.data.session.pagesVisited.length})
                    </h3>
                    <div className="space-y-2 border-l-2 border-neutral-200 ml-2 pl-4">
                      {sessionDetailQuery.data.session.pagesVisited.map((page, idx) => (
                        <div key={idx} className="relative pb-2">
                          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#8B0000] ring-4 ring-white" />
                          <div className="text-xs font-semibold text-neutral-800">{page.pageName}</div>
                          <div className="font-mono text-[10px] text-neutral-400">
                            {page.path} • {formatManila(page.timestamp)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-neutral-200 bg-neutral-50/50 text-right">
              <button
                onClick={() => setSelectedSessionId(null)}
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

function RoleBadge({ role, email, userName }: { role: string; email?: string; userName?: string }) {
  const r = (role || "").toLowerCase();
  const lowerEmail = (email || "").toLowerCase();
  const lowerName = (userName || "").toLowerCase();

  if (
    r === "org_adviser" ||
    r === "adviser" ||
    r.includes("adviser") ||
    lowerEmail.includes("adviser") ||
    lowerName.includes("adviser")
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
        Adviser
      </span>
    );
  }
  if (
    r === "dean" ||
    r.includes("dean") ||
    lowerEmail.includes("dean") ||
    lowerName.includes("dean")
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
        Dean
      </span>
    );
  }
  if (
    r === "osaar" ||
    r.includes("osaar") ||
    lowerEmail.includes("osaar") ||
    lowerName.includes("osaar")
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
        OSAAR
      </span>
    );
  }
  if (
    r === "cdm" ||
    r.includes("cdm") ||
    lowerEmail.includes("cdm") ||
    lowerName.includes("cdm") ||
    lowerName.includes("director")
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 border border-teal-200">
        CDM
      </span>
    );
  }
  if (r === "admin" || lowerEmail.includes("admin") || lowerName.includes("admin")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
        Admin
      </span>
    );
  }
  if (r === "signatory") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
        Adviser
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700 border border-neutral-200">
      Student
    </span>
  );
}
