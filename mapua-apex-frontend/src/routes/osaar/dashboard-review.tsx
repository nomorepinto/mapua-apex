import { SubmissionCalendarSection } from "@/components/dashboard/submissions/submission-calendar-section"
import {
  ReviewActivityDialog,
  ReviewQueue,
} from "@/components/signatories/dashboard/review-queue"
import {
  ReviewDashboardProvider,
  useReviewDashboardContext,
} from "@/components/signatories/dashboard/review-dashboard-context"
import { SubmissionHistorySection } from "@/components/signatories/dashboard/submission-history-section"
import { useDeskCalendarActivities } from "@/hooks/use-desk-calendar-activities"
import { useSubmissionView } from "@/lib/dashboard-view"

/**
 * OSAAR's Review tab: the same two structures every other review desk shows —
 * the queue plus history tables, or both plotted on one calendar — fed by the
 * signatory queue and history endpoints, and opening the actionable review modal.
 */
function AdminDashboardReviewContent() {
  const { actions } = useReviewDashboardContext()
  const { calendarActivities, isLoading } = useDeskCalendarActivities()
  const [view] = useSubmissionView()

  return (
    <>
      {view === "calendar" ? (
        <SubmissionCalendarSection
          activities={calendarActivities}
          description="Every proposal on your desk — pending, returned, and already processed — plotted by event date."
          loading={isLoading}
          onSelect={actions.handleActivitySelect}
          title="Review Calendar"
          unitLabel="application"
        />
      ) : (
        <>
          <ReviewQueue />
          <SubmissionHistorySection />
        </>
      )}
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
