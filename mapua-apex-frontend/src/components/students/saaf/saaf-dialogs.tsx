import { useEffect, useState } from "react"
import { ConfirmClearModal } from "@/components/forms/confirm-clear-modal"
import { ConfirmSubmitModal } from "@/components/forms/confirm-submit-modal"
import { SuccessModal } from "@/components/forms/success-modal"
import { usePrivacyConsent } from "@/components/submission/privacy-consent"
import { useSaafFormContext } from "@/components/students/saaf/saaf-context"
import { useOrgStore } from "@/stores/org-store"

export function SaafDialogs() {
  const { state, actions } = useSaafFormContext()
  const privacyConsent = usePrivacyConsent()
  // Held here (not in the wizard state) so the tick gates the dialog only; S-1
  // can later adopt the same consent shape without touching step validation.
  const [consentChecked, setConsentChecked] = useState(false)

  // Re-ask on every submit and resubmit: opening the confirm dialog always
  // clears the previous tick, so a returned paper cannot ride an old acceptance.
  useEffect(() => {
    if (state.showConfirmModal) setConsentChecked(false)
  }, [state.showConfirmModal])

  const handleConfirmProceed = () => {
    // Defense-in-depth: the Proceed button is already disabled until the notice
    // loads and the box is ticked, so a loading/error state never submits.
    if (!privacyConsent.ready || !consentChecked) return
    useOrgStore.getState().setPrivacyConsentVersion(privacyConsent.version)
    actions.confirmProceed()
  }

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
        description="This action will submit your student activity form with the data you have inputted."
        isSubmitting={state.isSubmitting}
        consent={{
          label: privacyConsent.label,
          content: privacyConsent.content,
          checked: consentChecked,
          onChange: setConsentChecked,
          disabled: privacyConsent.disabled,
        }}
        onClose={actions.closeConfirm}
        onConfirm={handleConfirmProceed}
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
