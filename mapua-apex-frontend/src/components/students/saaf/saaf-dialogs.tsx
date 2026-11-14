import { useState } from "react"
import { ConfirmClearModal } from "@/components/forms/confirm-clear-modal"
import { ConfirmSubmitModal } from "@/components/forms/confirm-submit-modal"
import { SuccessModal } from "@/components/forms/success-modal"
import { usePrivacyConsent } from "@/components/submission/privacy-consent"
import { useSaafFormContext } from "@/components/students/saaf/saaf-context"
import { useTermsNoticeQuery } from "@/hooks/use-terms-notice"
import { useOrgStore } from "@/stores/org-store"

export function SaafDialogs() {
  const { state, actions } = useSaafFormContext()
  const privacyConsent = usePrivacyConsent()
  // T&C acceptance happens once at the event-setup gate; the confirm dialog no
  // longer re-asks it. The current notice version is still recorded against the
  // submission because the backend requires a terms_consent of record.
  const termsNotice = useTermsNoticeQuery()
  const termsVersion = termsNotice.data?.version ?? null
  // Held here (not in the wizard state) so the tick gates the dialog only,
  // never step validation.
  const [consentChecked, setConsentChecked] = useState(false)

  // Re-ask on every submit and resubmit: opening the confirm dialog always
  // clears the previous tick, so a returned paper cannot ride an old acceptance.
  // Adjusted during render (the SignInModal trackedOpen pattern) rather than in
  // an effect to avoid cascading renders.
  const [trackedOpen, setTrackedOpen] = useState(state.showConfirmModal)
  if (trackedOpen !== state.showConfirmModal) {
    setTrackedOpen(state.showConfirmModal)
    if (state.showConfirmModal) setConsentChecked(false)
  }

  const handleConfirmProceed = () => {
    // Defense-in-depth: the Proceed button is already disabled until the notices
    // load and the privacy box is ticked, so a loading/error state never submits.
    if (!privacyConsent.ready || !consentChecked) return
    if (!termsVersion) return
    useOrgStore.getState().setPrivacyConsentVersion(privacyConsent.version)
    useOrgStore.getState().setTermsConsentVersion(termsVersion)
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
        description="You are about to submit your student activity form with the data you have inputted."
        isSubmitting={state.isSubmitting}
        consent={{
          label: privacyConsent.label,
          content: privacyConsent.content,
          checked: consentChecked,
          onChange: setConsentChecked,
          disabled: privacyConsent.disabled || termsVersion === null,
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
