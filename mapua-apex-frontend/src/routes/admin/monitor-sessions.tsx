import { useState, useMemo } from "react"
import { RefreshCw } from "lucide-react"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { layout } from "@/config"
import { cn } from "@/lib/utils"
import {
  useSessionDetailQuery,
  normalizeSessionItem,
} from "@/hooks/use-monitor"
import { getTodayManila, getYesterdayManila } from "@/lib/monitor-formatters"
import { useReportTable, useReportPagination } from "@/hooks/use-reporting"
import { ReportToolbar } from "@/components/reports/report-toolbar"
import { Button } from "@/components/ui/button"
import { SessionsTable } from "@/components/admin/sessions/sessions-table"
import { SessionDetailModal } from "@/components/admin/sessions/session-detail-modal"

export function AdminMonitorSessionsPage() {
  const report = useReportTable(
    "sessions",
    "/admins/monitor/sessions",
    "sessions",
    { start_date: getYesterdayManila(), end_date: getTodayManila() }
  )
  const { filters, setFilters } = report
  const startDate = filters.start_date ?? ""
  const endDate = filters.end_date ?? ""
  const sortDirection = filters.sort ?? "desc"
  const sortedSessions = useMemo(
    () => report.rows.map(normalizeSessionItem),
    [report.rows]
  )
  const {
    pageSize,
    currentPage,
    totalPages: totalSessionPages,
    setCurrentPage,
    setPageSize,
  } = useReportPagination(filters, sortedSessions.length)

  // Modal Selection State
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  )

  const sessionsQuery = report.query
  const sessionDetailQuery = useSessionDetailQuery(selectedSessionId)
  const isSessionsLoading = sessionsQuery.isPending || sessionsQuery.isFetching
  const isRefreshing = isSessionsLoading
  const handleRefresh = () => {
    void sessionsQuery.refetch()
  }

  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedSessions.slice(start, start + pageSize)
  }, [sortedSessions, currentPage, pageSize])

  const toggleSort = () =>
    setFilters({ ...filters, sort: sortDirection === "asc" ? "desc" : "asc" })

  return (
    <div className={layout.page}>
      <div className="w-full space-y-6 px-4 py-4 md:px-8">
        {/* Top Header */}
        <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <FormPageHeader
            subtitle="Detailed log of authenticated user sessions, IP addresses, session duration, and page navigation timelines."
            title="Session Log"
          />

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <Button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 shadow-xs transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              title="Refresh session logs"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5 text-neutral-600",
                  isRefreshing && "animate-spin text-[#8B0000]"
                )}
              />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {/* SESSION ANALYTICS SECTION (Charts & Heatmap) */}
        <ReportToolbar
          kind="sessions"
          endpoint={report.endpoint}
          filters={filters}
          onChange={setFilters}
          onReset={report.reset}
          options={report.options}
          count={report.rows.length}
          ready={sessionsQuery.isSuccess && !isRefreshing}
          showSummary
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
          totalEntries={sortedSessions.length}
          sortDirection={sortDirection}
          onSort={toggleSort}
          totalPages={totalSessionPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
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
        isError={sessionDetailQuery.isError}
        onRetry={() => {
          void sessionDetailQuery.refetch()
        }}
        onClose={() => setSelectedSessionId(null)}
      />
    </div>
  )
}
export default AdminMonitorSessionsPage
