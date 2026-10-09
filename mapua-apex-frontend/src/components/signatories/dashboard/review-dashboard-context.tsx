/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactNode, useMemo } from "react"
import { use } from "react"

import { useReviewDashboard } from "@/hooks/use-review-dashboard"

type ReviewDashboardModel = ReturnType<typeof useReviewDashboard>

type ReviewDashboardActionName =
  | "handleDeptSelect"
  | "handleOrgSelect"
  | "handleSearchChange"
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
        role: dashboard.role,
        roleLabel: dashboard.roleLabel,
        stats: dashboard.stats,
        departments: dashboard.departments,
        departmentOrgMap: dashboard.departmentOrgMap,
        selectedDept: dashboard.selectedDept,
        selectedOrg: dashboard.selectedOrg,
        search: dashboard.search,
        activeActivity: dashboard.activeActivity,
        allActivities: dashboard.allActivities,
        reviewActivities: dashboard.reviewActivities,
        historyActivities: dashboard.historyActivities,
        hasActivities: dashboard.hasActivities,
        isLoading: dashboard.isLoading,
        isHistoryLoading: dashboard.isHistoryLoading,
        isActing: dashboard.isActing,
        isOsaar: dashboard.isOsaar,
        isCdm: dashboard.isCdm,
        isAdviser: dashboard.isAdviser,
        isDean: dashboard.isDean,
        isCampusDesk: dashboard.isCampusDesk,
        isUpdatingClassification: dashboard.isUpdatingClassification,
        isReadOnly: dashboard.isReadOnly,
        actionError: dashboard.actionError,
      },
      actions: {
        handleDeptSelect: dashboard.handleDeptSelect,
        handleOrgSelect: dashboard.handleOrgSelect,
        handleSearchChange: dashboard.handleSearchChange,
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
