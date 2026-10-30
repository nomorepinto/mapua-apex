import { CdmCalendarSection } from "@/components/signatories/dashboard/cdm-calendar-section"
import {
  ReviewActivityDialog,
  ReviewQueue,
} from "@/components/signatories/dashboard/review-queue"
import {
  ReviewDashboardProvider,
  useReviewDashboardContext,
} from "@/components/signatories/dashboard/review-dashboard-context"
import { SubmissionHistorySection } from "@/components/signatories/dashboard/submission-history-section"

function AdminDashboardReviewContent() {
  const { state } = useReviewDashboardContext()

  return (
    <>
      {state.isCdm ? <CdmCalendarSection /> : null}
      <ReviewQueue />
      <SubmissionHistorySection />
      <ReviewActivityDialog />
    </>
  )
}

export function AdminDashboardReviewPage() {
  return (
    <ReviewDashboardProvider>
      <AdminDashboardReviewContent />
    </ReviewDashboardProvider>
  )
}
