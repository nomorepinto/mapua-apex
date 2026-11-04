import { SubmissionCalendarSection } from "@/components/dashboard/submissions/submission-calendar-section"
import { SubmissionDesk } from "@/components/dashboard/submissions/submission-desk"
import { ReviewActivityDialog } from "@/components/signatories/dashboard/review-queue"
import { ReviewDashboardHeader } from "@/components/signatories/dashboard/review-dashboard-header"
import { ReviewDashboardProvider } from "@/components/signatories/dashboard/review-dashboard-context"
import { useReviewDashboardContext } from "@/components/signatories/dashboard/review-dashboard-context"
import { ReviewQueue } from "@/components/signatories/dashboard/review-queue"
import { SubmissionHistorySection } from "@/components/signatories/dashboard/submission-history-section"
import { useDeskCalendarActivities } from "@/hooks/use-desk-calendar-activities"

/**
 * The org adviser desk: the shared submissions tables (queue + history) or the
 * same papers on the shared calendar, with the adviser's three-state colors —
 * approved / pending / cancelled — via `statusTheme="simple"`.
 */
function OrgAdviserDashboardContent() {
  const { actions } = useReviewDashboardContext()
  const { calendarActivities, isLoading } = useDeskCalendarActivities()

  return (
    <SubmissionDesk
      calendarView={
        <SubmissionCalendarSection
          activities={calendarActivities}
          description="Proposals from the organizations you advise, plotted by event date."
          emptyDescription="Select a date marked with status dots to view its proposals."
          emptyTitle="No proposals scheduled on this date"
          hintLabel="Click any date to see proposals scheduled on it"
          loading={isLoading}
          onSelect={actions.handleActivitySelect}
          selectLabel="View Proposal"
          statusTheme="simple"
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

export function OrgAdviserDashboard() {
  return (
    <ReviewDashboardProvider>
      <OrgAdviserDashboardContent />
    </ReviewDashboardProvider>
  )
}
