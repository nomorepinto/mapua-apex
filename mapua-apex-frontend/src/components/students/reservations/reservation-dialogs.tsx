import { ConfirmClearModal } from "@/components/forms/confirm-clear-modal"
import { ConfirmSubmitModal } from "@/components/forms/confirm-submit-modal"
import { SuccessModal } from "@/components/forms/success-modal"
import { useReservationFormContext } from "@/components/students/reservations/reservation-context"

export function ReservationDialogs() {
  const { state, actions } = useReservationFormContext()

  return (
    <>
      <ConfirmClearModal
        open={state.showConfirmClearModal}
        title="Are you sure you want to clear?"
        description="This action will clear your facility reservation form with the data you have inputted."
        onClose={() => actions.setShowConfirmClearModal(false)}
        onConfirm={actions.handleClearForm}
      />

      <ConfirmSubmitModal
        open={state.showConfirmModal}
        description="This action will submit your facility reservation form with the data you have inputted."
        onClose={() => actions.setShowConfirmModal(false)}
        onConfirm={actions.handleConfirmProceed}
      />

      <SuccessModal
        open={state.showSuccessModal}
        title="Facility Reservation Submitted!"
        actionLabel="Back to Submission"
        onAction={actions.handleSuccessAction}
      />
    </>
  )
}
