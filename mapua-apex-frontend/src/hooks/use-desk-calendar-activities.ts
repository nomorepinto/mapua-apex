import { useMemo } from "react"

import { useReviewDashboardContext } from "@/components/signatories/dashboard/review-dashboard-context"
import type { Activity } from "@/components/ui/activity.types"
import { dedupeBySubmission } from "@/lib/submission-calendar-status"

/**
 * The records a review desk plots in Calendar view, derived once for every desk.
 *
 * A submission can sit in both the queue and the history list of one desk (the
 * queue is filtered client-side, history comes from its own endpoint), so the
 * combined list is deduplicated per submission before it reaches the calendar.
 */
export function useDeskCalendarActivities(): {
  reviewActivities: Activity[]
  historyActivities: Activity[]
  calendarActivities: Activity[]
  isLoading: boolean
} {
  const { state } = useReviewDashboardContext()

  const calendarActivities = useMemo(
    () =>
      dedupeBySubmission([
        ...state.reviewActivities,
        ...state.historyActivities,
      ]),
    [state.reviewActivities, state.historyActivities]
  )

  return {
    reviewActivities: state.reviewActivities,
    historyActivities: state.historyActivities,
    calendarActivities,
    isLoading: state.isLoading || state.isHistoryLoading,
  }
}
