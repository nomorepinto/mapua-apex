import { layout } from "@/config"
import { useReviewDashboardContext } from "@/components/signatories/dashboard/review-dashboard-context"

export function ReviewDashboardHeader() {
  const { state } = useReviewDashboardContext()

  return (
    <div className="space-y-1">
      <h1 className={layout.pageTitle}>{state.roleLabel} Dashboard</h1>
      <p className={layout.pageSubtitle}>
        Academic Term: 2026-2027 • Institutional submissions and approvals for student
        activities.
      </p>
    </div>
  )
}
