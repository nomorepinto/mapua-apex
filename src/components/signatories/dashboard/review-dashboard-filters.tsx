import { ActivityFilter } from "@/components/ui/activity-filter"
import { useReviewDashboardContext } from "@/components/signatories/dashboard/review-dashboard-context"

export function ReviewDashboardFilters() {
  const { state, actions } = useReviewDashboardContext()

  return (
    <div className="flex items-center justify-end">
      <ActivityFilter
        departments={state.departments}
        departmentOrgMap={state.departmentOrgMap}
        selectedDept={state.selectedDept}
        selectedOrg={state.selectedOrg}
        onDeptSelect={actions.handleDeptSelect}
        onOrgSelect={actions.handleOrgSelect}
      />
    </div>
  )
}
