import { ActivityDetailModal } from "@/components/ui/activity-detail-modal"
import { ActivityRow } from "@/components/ui/activity-row"
import { ActivityFilterHeader } from "@/components/signatories/dashboard/activity-filter-header"
import { ActivitySortHeader } from "@/components/signatories/dashboard/activity-sort-header"
import { ActivityTableSearch } from "@/components/signatories/dashboard/activity-table-search"
import { useActivityTableFilters } from "@/hooks/use-activity-table-filters"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useReviewDashboardContext } from "@/components/signatories/dashboard/review-dashboard-context"
import { layout } from "@/config"

export function ReviewQueue() {
  const { state, actions } = useReviewDashboardContext()
  const filters = useActivityTableFilters(state.reviewActivities, "decision")

  /** Role-aware subtitle for the review queue section */
  function reviewSubtitle() {
    if (state.isCampusDesk) {
      return "All pending event proposals currently awaiting your desk's action."
    }
    if (state.isDean) {
      return "Event proposals under your department pending your approval."
    }
    if (state.isAdviser) {
      return "Submissions from organizations you advise awaiting your review."
    }
    return "Submissions currently waiting for your review."
  }

  return (
    <section className={layout.section}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex shrink-0 flex-col gap-1">
          <h2 className="text-lg font-extrabold text-neutral-900">For Review</h2>
          <p className="text-xs text-neutral-500">{reviewSubtitle()}</p>
        </div>
        <ActivityTableSearch
          ariaLabel="Search review queue"
          onChange={filters.setSearch}
          value={filters.search}
        />
      </div>

      <div className={layout.sectionFlush}>
        <div className={layout.tableWrap}>
          <Table className={layout.table}>
            <TableHeader>
              <TableRow className="border-b border-neutral-200 text-xs font-bold tracking-wider text-neutral-500 uppercase hover:bg-transparent!">
                <TableHead className="px-6 py-4 font-bold text-neutral-500">
                  DOCUMENT ID
                </TableHead>
                <ActivityFilterHeader
                  column="organization"
                  label="Organization"
                  onClear={filters.clearColumnFilter}
                  onToggle={filters.toggleColumnFilter}
                  options={filters.filterOptions.organization}
                  selected={filters.columnFilters.organization}
                />
                <ActivityFilterHeader
                  column="department"
                  label="Department"
                  onClear={filters.clearColumnFilter}
                  onToggle={filters.toggleColumnFilter}
                  options={filters.filterOptions.department}
                  selected={filters.columnFilters.department}
                />
                <TableHead className="px-6 py-4 font-bold text-neutral-500">
                  ACTIVITY NAME
                </TableHead>
                <ActivitySortHeader
                  direction={filters.sortDirection}
                  label="Submitted"
                  onSort={filters.toggleSort}
                />
                <ActivityFilterHeader
                  capitalize
                  column="type"
                  label="Type"
                  onClear={filters.clearColumnFilter}
                  onToggle={filters.toggleColumnFilter}
                  options={filters.filterOptions.type}
                  selected={filters.columnFilters.type}
                />
                <ActivityFilterHeader
                  align="right"
                  className="text-right"
                  column="status"
                  label="Decision"
                  onClear={filters.clearColumnFilter}
                  onToggle={filters.toggleColumnFilter}
                  options={filters.filterOptions.status}
                  selected={filters.columnFilters.status}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-14 text-center text-sm text-neutral-400"
                  >
                    Loading your review queue…
                  </TableCell>
                </TableRow>
              ) : filters.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-14 text-center text-sm text-neutral-400"
                  >
                    {state.reviewActivities.length === 0
                      ? "No submissions to review right now."
                      : filters.search.trim()
                        ? `No pending submissions match "${filters.search.trim()}".`
                        : "No pending submissions match the selected filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filters.rows.map((activity) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    onSelect={actions.handleActivitySelect}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}

export function ReviewActivityDialog() {
  const { state, actions } = useReviewDashboardContext()

  return (
    <ActivityDetailModal
      activity={state.activeActivity}
      onClose={actions.handleModalClose}
      onAction={actions.handleModalAction}
      isActing={state.isActing}
      isOsaar={state.isOsaar}
      isUpdatingClassification={state.isUpdatingClassification}
      onClassificationChange={actions.handleClassificationChange}
      actionError={state.actionError}
      readOnly={state.isReadOnly}
    />
  )
}
