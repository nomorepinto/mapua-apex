import { ReviewNoticeModal } from "@/components/org/ReviewNoticeModal"
import { SubmissionTrackerModal } from "@/components/org/SubmissionTrackerModal"
import { useStudentDashboard } from "@/components/students/dashboard/student-dashboard-context"

export function StudentDashboardDialogs() {
  const { state, actions } = useStudentDashboard()

  return (
    <>
      <SubmissionTrackerModal
        isOpen={state.trackerOpen}
        onClose={actions.closeTracker}
        eventId={state.selectedKeys?.eventId}
        submissionId={state.selectedKeys?.submissionId}
      />
      <ReviewNoticeModal
        notice={state.selectedNotice}
        onClose={actions.closeNotice}
      />
    </>
  )
}
