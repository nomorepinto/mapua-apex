import { CdmCalendarSection } from "@/components/signatories/dashboard/cdm-calendar-section"
import { SubmissionDesk } from "@/components/dashboard/submissions/submission-desk"
import { ReviewActivityDialog } from "@/components/signatories/dashboard/review-queue"
import { ReviewDashboardHeader } from "@/components/signatories/dashboard/review-dashboard-header"
import { ReviewDashboardProvider } from "@/components/signatories/dashboard/review-dashboard-context"
import { ReviewQueue } from "@/components/signatories/dashboard/review-queue"
import { SubmissionHistorySection } from "@/components/signatories/dashboard/submission-history-section"

/**
 * The CDM desk: the shared submissions tables (queue + history) or, in Calendar
 * view, the reservations calendar — its own grid because it plots the rooms and
 * AV each proposal asks for, not just the paper.
 */
function CdmReviewerDashboardContent() {
  return (
    <SubmissionDesk
      calendarView={<CdmCalendarSection />}
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

export function CdmReviewerDashboard() {
  return (
    <ReviewDashboardProvider>
      <CdmReviewerDashboardContent />
    </ReviewDashboardProvider>
  )
}
