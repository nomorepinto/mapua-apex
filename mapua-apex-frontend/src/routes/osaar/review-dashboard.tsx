import { CdmCalendarSection } from "@/components/signatories/dashboard/cdm-calendar-section"
import { ReviewActivityDialog } from "@/components/signatories/dashboard/review-queue"
import { ReviewDashboardHeader } from "@/components/signatories/dashboard/review-dashboard-header"
import {
  ReviewDashboardProvider,
  useReviewDashboardContext,
} from "@/components/signatories/dashboard/review-dashboard-context"
import { ReviewQueue } from "@/components/signatories/dashboard/review-queue"
import { SubmissionHistorySection } from "@/components/signatories/dashboard/submission-history-section"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

function AdminReviewDashboardContent() {
  const { state } = useReviewDashboardContext()

  return (
    <div className={cn(layout.container, layout.stack)}>
      <ReviewDashboardHeader />
      {state.isCdm && <CdmCalendarSection />}
      <ReviewQueue />
      <SubmissionHistorySection />
    </div>
  )
}

export function AdminReviewDashboard() {
  return (
    <ReviewDashboardProvider>
      <div className={layout.page}>
        <AdminReviewDashboardContent />
        <ReviewActivityDialog />
      </div>
    </ReviewDashboardProvider>
  )
}
