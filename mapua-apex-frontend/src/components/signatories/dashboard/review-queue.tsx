import { ActivityDetailModal } from "@/components/ui/activity-detail-modal"
import { ActivityRow } from "@/components/ui/activity-row"
import { ReviewDashboardSearch } from "@/components/signatories/dashboard/review-dashboard-search"
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
      <div className="mb-5 flex shrink-0 flex-col gap-1">
        <h2 className="text-lg font-extrabold text-neutral-900">For Review</h2>
        <p className="text-xs text-neutral-500">{reviewSubtitle()}</p>
      </div>

      <div className={layout.sectionFlush}>
        <div className={layout.tableWrap}>
          <Table className={layout.table}>
            <TableHeader>
              <TableRow className="border-b border-neutral-200 text-xs font-bold tracking-wider text-neutral-500 uppercase hover:bg-transparent!">
                <TableHead className="px-6 py-4 font-bold text-neutral-500">
                  ORGANIZATION
                </TableHead>
                <TableHead className="px-6 py-4 font-bold text-neutral-500">
                  ACTIVITY NAME
                </TableHead>
                <TableHead className="px-6 py-4 font-bold text-neutral-500">
                  SUBMITTED
                </TableHead>
                <TableHead className="px-6 py-4 font-bold text-neutral-500">
                  TYPE
                </TableHead>
                <TableHead className="px-6 py-4 text-right font-bold text-neutral-500">
                  DECISION
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-14 text-center text-sm text-neutral-400"
                  >
                    Loading your review queue…
                  </TableCell>
                </TableRow>
              ) : state.reviewActivities.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-14 text-center text-sm text-neutral-400"
                  >
                    {state.hasActivities
                      ? "No pending submissions match the selected filters."
                      : "No submissions to review right now."}
                  </TableCell>
                </TableRow>
              ) : (
                state.reviewActivities.map((activity) => (
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
