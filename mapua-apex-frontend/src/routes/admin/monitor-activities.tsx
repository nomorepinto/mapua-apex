import { useState, useMemo } from "react"
import { RefreshCw } from "lucide-react"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { layout } from "@/config"
import { cn } from "@/lib/utils"
import { normalizeActivityItem } from "@/hooks/use-monitor"
import type { ActivityNotification } from "@/types/logs"
import { getTodayManila, getYesterdayManila } from "@/lib/monitor-formatters"
import { useReportTable, useReportPagination } from "@/hooks/use-reporting"
import { ReportToolbar } from "@/components/reports/report-toolbar"
import { Button } from "@/components/ui/button"
import { ActivitiesTable } from "@/components/admin/activities/activities-table"
import { ActivityDetailModal } from "@/components/admin/activities/activity-detail-modal"

export function AdminMonitorActivitiesPage() {
  const report = useReportTable(
    "activity",
    "/admins/monitor/activity",
    "activity",
    { start_date: getYesterdayManila(), end_date: getTodayManila() }
  )
  const { filters, setFilters } = report
  const startDate = filters.start_date ?? ""
  const endDate = filters.end_date ?? ""
  const sortDirection = filters.sort ?? "desc"
  const sortedNotifications = useMemo(
    () => report.rows.map(normalizeActivityItem),
    [report.rows]
  )
  const { pageSize, currentPage, totalPages, setCurrentPage, setPageSize } =
    useReportPagination(filters, sortedNotifications.length)

  // Modal Detail State
  const [selectedNotification, setSelectedNotification] =
    useState<ActivityNotification | null>(null)

  const activitiesQuery = report.query
  const isActivitiesLoading =
    activitiesQuery.isPending || activitiesQuery.isFetching
  const isRefreshing = isActivitiesLoading
  const handleRefresh = () => {
    void activitiesQuery.refetch()
  }

  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedNotifications.slice(start, start + pageSize)
  }, [sortedNotifications, currentPage, pageSize])

  const toggleSort = () =>
    setFilters({ ...filters, sort: sortDirection === "asc" ? "desc" : "asc" })

  return (
    <div className={layout.page}>
      <div className="w-full space-y-6 px-4 py-4 md:px-8">
        {/* Top Header */}
        <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <FormPageHeader
            subtitle="Recorded actions across proposals and administrative modules. Proposal statistics are available as a separate report template."
            title="Activity Log"
          />

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <Button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 shadow-xs transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              title="Refresh activity logs"
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

        {/* STAT CARDS SECTION */}
        <ReportToolbar
          kind="activity"
          filters={filters}
          onChange={setFilters}
          onReset={report.reset}
          options={report.options}
          count={report.rows.length}
          ready={activitiesQuery.isSuccess && !isRefreshing}
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
          totalEntries={sortedNotifications.length}
          sortDirection={sortDirection}
          onSort={toggleSort}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
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
  )
}
export default AdminMonitorActivitiesPage
