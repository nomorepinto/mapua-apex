/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactNode, useMemo } from "react"
import { use } from "react"

import { useReviewDashboard } from "@/hooks/use-review-dashboard"

type ReviewDashboardModel = ReturnType<typeof useReviewDashboard>

type ReviewDashboardActionName =
  | "handleDeptSelect"
  | "handleOrgSelect"
  | "handleActivitySelect"
  | "handleModalClose"
  | "handleModalAction"
  | "handleClassificationChange"

export interface ReviewDashboardContextValue {
  state: Omit<ReviewDashboardModel, ReviewDashboardActionName>
  actions: Pick<ReviewDashboardModel, ReviewDashboardActionName>
}

const ReviewDashboardContext =
  createContext<ReviewDashboardContextValue | null>(null)

export function useReviewDashboardContext() {
  const value = use(ReviewDashboardContext)
  if (!value) {
    throw new Error(
      "useReviewDashboardContext must be used within ReviewDashboardProvider"
    )
  }
  return value
}

export function ReviewDashboardProvider({ children }: { children: ReactNode }) {
  const dashboard = useReviewDashboard()
  const value = useMemo<ReviewDashboardContextValue>(
    () => ({
      state: {
        roleLabel: dashboard.roleLabel,
        stats: dashboard.stats,
        departments: dashboard.departments,
        departmentOrgMap: dashboard.departmentOrgMap,
        selectedDept: dashboard.selectedDept,
        selectedOrg: dashboard.selectedOrg,
        activeActivity: dashboard.activeActivity,
        filteredActivities: dashboard.filteredActivities,
        hasActivities: dashboard.hasActivities,
        isLoading: dashboard.isLoading,
        isActing: dashboard.isActing,
        isOsaar: dashboard.isOsaar,
        isUpdatingClassification: dashboard.isUpdatingClassification,
        actionError: dashboard.actionError,
      },
      actions: {
        handleDeptSelect: dashboard.handleDeptSelect,
        handleOrgSelect: dashboard.handleOrgSelect,
        handleActivitySelect: dashboard.handleActivitySelect,
        handleModalClose: dashboard.handleModalClose,
        handleModalAction: dashboard.handleModalAction,
        handleClassificationChange: dashboard.handleClassificationChange,
      },
    }),
    [dashboard]
  )

  return (
    <ReviewDashboardContext value={value}>{children}</ReviewDashboardContext>
  )
}
