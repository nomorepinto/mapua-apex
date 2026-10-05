import { ConfirmClearModal } from "@/components/forms/confirm-clear-modal"
import { ConfirmSubmitModal } from "@/components/forms/confirm-submit-modal"
import { SuccessModal } from "@/components/forms/success-modal"
import { useSaafFormContext } from "@/components/students/saaf/saaf-context"

export function SaafDialogs() {
  const { state, actions } = useSaafFormContext()

  return (
    <>
      <ConfirmClearModal
        open={state.showConfirmClearModal}
        title="Are you sure you want to clear?"
        description="This action will clear your student activity form with the data you have inputted."
        onClose={actions.closeClear}
        onConfirm={actions.confirmClear}
      />

      <ConfirmSubmitModal
        open={state.showConfirmModal}
        description="This action will submit your student activity form with the data you have inputted."
        isSubmitting={state.isSubmitting}
        onClose={actions.closeConfirm}
        onConfirm={actions.confirmProceed}
      />

      <SuccessModal
        open={state.showSuccessModal}
        title="Activity Application Submitted!"
        actionLabel="Back to Dashboard"
        onAction={actions.dismissSuccess}
      />
    </>
  )
}
