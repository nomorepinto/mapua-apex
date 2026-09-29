import { ActivityDetailModal } from "@/components/ui/activity-detail-modal"
import { ActivityRow } from "@/components/ui/activity-row"
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

  return (
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
            ) : state.filteredActivities.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-14 text-center text-sm text-neutral-400"
                >
                  {state.hasActivities
                    ? "No activities match the selected filters."
                    : "No submissions to review yet."}
                </TableCell>
              </TableRow>
            ) : (
              state.filteredActivities.map((activity) => (
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
      actionError={state.actionError}
    />
  )
}
