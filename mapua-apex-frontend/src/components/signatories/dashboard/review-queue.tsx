import { SubmissionTableSection } from "@/components/dashboard/submissions/submission-table-section"
import { ActivityDetailModal } from "@/components/ui/activity-detail-modal"
import { useReviewDashboardContext } from "@/components/signatories/dashboard/review-dashboard-context"
import type { ReviewDashboardContextValue } from "@/components/signatories/dashboard/review-dashboard-context"

/** Role-aware subtitle for the review queue section */
function reviewSubtitle(
  state: ReviewDashboardContextValue["state"]
): string {
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

/**
 * The "For Review" queue — this desk's on-desk papers (pending + returned),
 * rendered with the one submissions table every review surface shares. Only the
 * data and the copy are role-aware here; the columns, search, filters and sort
 * live in `SubmissionTableSection`.
 */
export function ReviewQueue() {
  const { state, actions } = useReviewDashboardContext()

  return (
    <SubmissionTableSection
      activities={state.reviewActivities}
      description={reviewSubtitle(state)}
      emptyLabel="No submissions to review right now."
      loading={state.isLoading}
      noMatchLabel={(term) =>
        term
          ? `No pending submissions match “${term}”.`
          : "No pending submissions match the selected filters."
      }
      onSelect={actions.handleActivitySelect}
      searchLabel="Search review queue"
      statusField="decision"
      statusLabel="Decision"
      title="For Review"
    />
  )
}

/**
 * The actionable review modal every desk opens from its queue, history rows or
 * calendar cards. Kept separate from the table so each desk can place it in its
 * own shell.
 */
export function ReviewActivityDialog() {
  const { state, actions } = useReviewDashboardContext()

  return (
    <ActivityDetailModal
      actionError={state.actionError}
      activity={state.activeActivity}
      bookingConflicts={state.bookingConflicts}
      isActing={state.isActing}
      isCheckingBookingConflicts={state.isCheckingBookingConflicts}
      isOsaar={state.isOsaar}
      isUpdatingClassification={state.isUpdatingClassification}
      onAction={actions.handleModalAction}
      onClassificationChange={actions.handleClassificationChange}
      onClose={actions.handleModalClose}
      readOnly={state.isReadOnly}
    />
  )
}
