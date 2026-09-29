import { layout } from "@/config"
import { useReviewDashboardContext } from "@/components/signatories/dashboard/review-dashboard-context"

export function ReviewDashboardHeader() {
  const { state } = useReviewDashboardContext()

  return (
    <div className="space-y-1">
      <h1 className={layout.pageTitle}>{state.roleLabel} Review Dashboard</h1>
      <p className={layout.pageSubtitle}>
        Academic Term: 2026-2027 • Pending institutional approvals for student
        activities.
      </p>
    </div>
  )
}
