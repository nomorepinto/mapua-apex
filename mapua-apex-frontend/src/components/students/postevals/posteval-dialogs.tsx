import { ConfirmClearModal } from "@/components/forms/confirm-clear-modal"
import { ConfirmSubmitModal } from "@/components/forms/confirm-submit-modal"
import { SuccessModal } from "@/components/forms/success-modal"
import { usePostEvalFormContext } from "@/components/students/postevals/posteval-context"

export function PostEvalDialogs() {
  const { state, actions } = usePostEvalFormContext()

  return (
    <>
      <ConfirmClearModal
        open={state.showConfirmClearModal}
        title="Are you sure you want to clear?"
        description="This action will clear the data you have inputted in this section."
        onClose={actions.closeClear}
        onConfirm={actions.confirmClear}
      />

      <ConfirmSubmitModal
        open={state.showConfirmModal}
        description="This action will submit your post-evaluation for OSAAR review."
        isSubmitting={state.isSubmitting}
        onClose={actions.closeConfirm}
        onConfirm={actions.confirmProceed}
      />

      <SuccessModal
        open={state.showSuccessModal}
        title="Post-Evaluation Submitted!"
        actionLabel="Back to Dashboard"
        onAction={actions.dismissSuccess}
      />
    </>
  )
}
