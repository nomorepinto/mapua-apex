import { ReviewActivityDialog } from "@/components/signatories/dashboard/review-queue"
import { ReviewDashboardHeader } from "@/components/signatories/dashboard/review-dashboard-header"
import { ReviewDashboardProvider } from "@/components/signatories/dashboard/review-dashboard-context"
import { ReviewQueue } from "@/components/signatories/dashboard/review-queue"
import { SubmissionHistorySection } from "@/components/signatories/dashboard/submission-history-section"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function OrgAdviserDashboard() {
  return (
    <ReviewDashboardProvider>
      <div className={layout.page}>
        <div className={cn(layout.container, layout.stack)}>
          <ReviewDashboardHeader />
          <ReviewQueue />
          <SubmissionHistorySection />
        </div>
        <ReviewActivityDialog />
      </div>
    </ReviewDashboardProvider>
  )
}
