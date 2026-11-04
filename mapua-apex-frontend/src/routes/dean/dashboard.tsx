import { SubmissionCalendarSection } from "@/components/dashboard/submissions/submission-calendar-section"
import { SubmissionDesk } from "@/components/dashboard/submissions/submission-desk"
import { ReviewActivityDialog } from "@/components/signatories/dashboard/review-queue"
import { ReviewDashboardHeader } from "@/components/signatories/dashboard/review-dashboard-header"
import {
  ReviewDashboardProvider,
  useReviewDashboardContext,
} from "@/components/signatories/dashboard/review-dashboard-context"
import { ReviewQueue } from "@/components/signatories/dashboard/review-queue"
import { SubmissionHistorySection } from "@/components/signatories/dashboard/submission-history-section"
import { useDeskCalendarActivities } from "@/hooks/use-desk-calendar-activities"

/**
 * The dean desk: the shared submissions tables (queue + processed proposals) or
 * the same papers on the shared calendar, using the detailed four-state theme so
 * a returned paper stays distinguishable from a denied one.
 */
function DeanDashboardContent() {
  const { actions } = useReviewDashboardContext()
  const { calendarActivities, isLoading } = useDeskCalendarActivities()

  return (
    <SubmissionDesk
      calendarView={
        <SubmissionCalendarSection
          activities={calendarActivities}
          description="Event proposals under your department, plotted by event date."
          loading={isLoading}
          onSelect={actions.handleActivitySelect}
          selectLabel="View Proposal"
          title="Calendar"
          unitLabel="proposal"
        />
      }
      dialogs={<ReviewActivityDialog />}
      header={<ReviewDashboardHeader />}
      tableView={
        <>
          <ReviewQueue />
          <SubmissionHistorySection />
        </>
      }
    />
  )
}

export function DeanDashboard() {
  return (
    <ReviewDashboardProvider>
      <DeanDashboardContent />
    </ReviewDashboardProvider>
  )
}
