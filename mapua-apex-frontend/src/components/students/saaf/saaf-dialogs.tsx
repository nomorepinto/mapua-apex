import { useEffect, useState } from "react"
import { ConfirmClearModal } from "@/components/forms/confirm-clear-modal"
import { ConfirmSubmitModal } from "@/components/forms/confirm-submit-modal"
import { SuccessModal } from "@/components/forms/success-modal"
import { usePrivacyConsent } from "@/components/submission/privacy-consent"
import { useTermsConsent } from "@/components/submission/terms-consent"
import { useSaafFormContext } from "@/components/students/saaf/saaf-context"
import { useOrgStore } from "@/stores/org-store"

export function SaafDialogs() {
  const { state, actions } = useSaafFormContext()
  const privacyConsent = usePrivacyConsent()
  const termsConsent = useTermsConsent()
  // Held here (not in the wizard state) so the ticks gate the dialog only,
  // never step validation.
  const [consentChecked, setConsentChecked] = useState(false)
  // One tick per T&C acknowledgement (S-1); ALL must be ticked to proceed.
  const [termsChecked, setTermsChecked] = useState<boolean[]>([])
  const termsCount = termsConsent.checkboxes.length

  // Re-ask on every submit and resubmit: opening the confirm dialog always
  // clears the previous ticks, so a returned paper cannot ride an old acceptance.
  useEffect(() => {
    if (state.showConfirmModal) {
      setConsentChecked(false)
      setTermsChecked(Array(termsCount).fill(false))
    }
  }, [state.showConfirmModal, termsCount])

  const handleTermsChange = (index: number, checked: boolean) => {
    setTermsChecked((current) => {
      const next = [...current]
      while (next.length < termsCount) next.push(false)
      next[index] = checked
      return next
    })
  }

  const allTermsChecked =
    termsCount > 0 &&
    termsConsent.checkboxes.every((_, index) => termsChecked[index] === true)

  const handleConfirmProceed = () => {
    // Defense-in-depth: the Proceed button is already disabled until the notices
    // load and every box is ticked, so a loading/error state never submits.
    if (!privacyConsent.ready || !consentChecked) return
    if (!termsConsent.ready || !allTermsChecked) return
    useOrgStore.getState().setPrivacyConsentVersion(privacyConsent.version)
    useOrgStore.getState().setTermsConsentVersion(termsConsent.version)
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
        description="Review the Terms & Conditions below before submitting your student activity form with the data you have inputted."
        isSubmitting={state.isSubmitting}
        consent={{
          label: privacyConsent.label,
          content: privacyConsent.content,
          checked: consentChecked,
          onChange: setConsentChecked,
          disabled: privacyConsent.disabled,
        }}
        terms={{
          content: termsConsent.content,
          items: termsConsent.checkboxes.map((checkbox, index) => ({
            label: checkbox.label,
            checked: termsChecked[index] ?? false,
            onChange: (checked: boolean) => handleTermsChange(index, checked),
          })),
          disabled: termsConsent.disabled,
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
