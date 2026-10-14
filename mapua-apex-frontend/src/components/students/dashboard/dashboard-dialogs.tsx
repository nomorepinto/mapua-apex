import { ReviewNoticeModal } from "@/components/org/ReviewNoticeModal"
import { SubmissionTrackerModal } from "@/components/org/SubmissionTrackerModal"
import { ReservationChangeDialog } from "@/components/students/dashboard/reservation-change-dialog"
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
      <ReservationChangeDialog
        eventId={state.reservationChangeTarget?.eventId}
        submissionId={state.reservationChangeTarget?.submissionId}
        onClose={actions.closeReservationChange}
      />
    </>
  )
}
