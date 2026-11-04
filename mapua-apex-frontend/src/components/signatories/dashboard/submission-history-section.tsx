import { SubmissionTableSection } from "@/components/dashboard/submissions/submission-table-section"
import { useReviewDashboardContext } from "@/components/signatories/dashboard/review-dashboard-context"
import type { ReviewDashboardContextValue } from "@/components/signatories/dashboard/review-dashboard-context"

/**
 * Role-aware title for the history list: campus desks (OSAAR / CDM) see every
 * submission that reached them, deans see their department's actioned proposals.
 */
function historyTitle(state: ReviewDashboardContextValue["state"]): string {
  if (state.isDean) return "Processed Event Proposals"
  return "Submission History"
}

function historySubtitle(state: ReviewDashboardContextValue["state"]): string {
  if (state.isOsaar) {
    return "All event proposals that have been fully approved, returned, or denied across all organisations."
  }
  if (state.isCdm) {
    return "Event proposals with venue reservations that have been approved or denied by CDM."
  }
  if (state.isDean) {
    return "All co-curricular and relevant event proposals under your department that have been actioned."
  }
  if (state.isAdviser) {
    return "Submissions from the organisations you advise that have already been processed."
  }
  return "All submissions that have been actioned and left your desk."
}

/**
 * The processed half of every review desk, rendered with the same submissions
 * table as the queue above it — only the rows and the trailing column differ:
 * `status` ("Current outcome") instead of the decision still owed. Search and
 * the column filters replace the report toolbar this section used to carry, so
 * both halves of a desk are filtered the same way.
 */
export function SubmissionHistorySection() {
  const { state, actions } = useReviewDashboardContext()

  return (
    <SubmissionTableSection
      activities={state.historyActivities}
      description={historySubtitle(state)}
      emptyLabel="No processed submissions found."
      error={
        state.isHistoryError
          ? "Could not load submission history. Refresh to retry."
          : null
      }
      loading={state.isHistoryLoading}
      noMatchLabel={(term) =>
        term
          ? `No processed submissions match “${term}”.`
          : "No processed submissions match the selected filters."
      }
      onSelect={actions.handleActivitySelect}
      searchLabel="Search history"
      statusField="status"
      statusLabel="Current outcome"
      title={historyTitle(state)}
    />
  )
}
