import { ReviewActivityDialog } from "@/components/signatories/dashboard/review-queue"
import { ReviewDashboardFilters } from "@/components/signatories/dashboard/review-dashboard-filters"
import { ReviewDashboardHeader } from "@/components/signatories/dashboard/review-dashboard-header"
import { ReviewDashboardProvider } from "@/components/signatories/dashboard/review-dashboard-context"
import { ReviewQueue } from "@/components/signatories/dashboard/review-queue"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function Dashboard() {
  return (
    <ReviewDashboardProvider>
      <div className={layout.page}>
        <div className={cn(layout.container, layout.stack)}>
          <ReviewDashboardHeader />
          <ReviewDashboardFilters />
          <ReviewQueue />
        </div>
        <ReviewActivityDialog />
      </div>

      <ActivityDetailModal
        activity={dashboard.activeActivity}
        onClose={dashboard.handleModalClose}
        onAction={dashboard.handleModalAction}
        isActing={dashboard.isActing}
        isOsaar={dashboard.isOsaar}
        isUpdatingClassification={dashboard.isUpdatingClassification}
        onClassificationChange={dashboard.handleClassificationChange}
        actionError={dashboard.actionError}
      />
    </div>
  )
}
