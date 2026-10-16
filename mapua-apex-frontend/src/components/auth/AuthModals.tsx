import { useState } from "react"

import { useAuthModalStore } from "@/stores/auth-modal-store"
import { AuthInactivityDialog } from "./AuthInactivityDialog"
import { SignInModal } from "./SignInModal"
import { SignUpModal } from "./SignUpModal"
import { VerifyEmailModal } from "./VerifyEmailModal"
import { ForgotPasswordModal } from "./ForgotPasswordModal"

export { useAuthModalStore as useAuthModals } from "@/stores/auth-modal-store"

/**
 * Top-level AuthModals container.
 * Mount this component once (e.g. in your Landing Page or Root Layout).
 * Then trigger any modal from any button using:
 *
 *   const { openSignIn, openSignUp } = useAuthModals()
 */
export function AuthModals() {
  const [inactivityDialogOpen, setInactivityDialogOpen] = useState(false)
  const {
    view,
    verificationEmail,
    openSignIn,
    openSignUp,
    openVerifyEmail,
    openForgotPassword,
    closeModal,
  } = useAuthModalStore()

  return (
    <>
      <SignInModal
        isOpen={view === "signIn"}
        onClose={closeModal}
        onSwitchToSignUp={openSignUp}
        onSwitchToForgotPassword={openForgotPassword}
        onRequireVerification={(email) => openVerifyEmail(email)}
        onInactivityTimeout={() => setInactivityDialogOpen(true)}
        onSuccess={() => {
          try {
            localStorage.setItem("apex_last_active_at", Date.now().toString())
            localStorage.removeItem("apex_session_id")
          } catch {
            // ignore
          }
          closeModal()
          window.location.href = "/"
        }}
      />

      <SignUpModal
        isOpen={view === "signUp"}
        onClose={closeModal}
        onSwitchToSignIn={openSignIn}
        onRequireVerification={(email) => openVerifyEmail(email)}
        onInactivityTimeout={() => setInactivityDialogOpen(true)}
      />

      <VerifyEmailModal
        isOpen={view === "verifyEmail"}
        email={verificationEmail}
        onClose={closeModal}
        onVerifiedSuccess={() => {
          openSignIn()
        }}
        onBackToSignIn={openSignIn}
      />

      <ForgotPasswordModal
        isOpen={view === "forgotPassword"}
        onClose={closeModal}
        onBackToSignIn={openSignIn}
        onSuccess={() => {
          openSignIn()
        }}
      />

      <AuthInactivityDialog
        open={inactivityDialogOpen}
        onOpenChange={setInactivityDialogOpen}
      />
    </>
  )
}
