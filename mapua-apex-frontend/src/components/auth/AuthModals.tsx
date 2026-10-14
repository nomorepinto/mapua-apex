import { useAuthModalStore } from "@/stores/auth-modal-store"
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
        onSuccess={() => {
          closeModal()
          window.location.href = "/"
        }}
      />

      <SignUpModal
        isOpen={view === "signUp"}
        onClose={closeModal}
        onSwitchToSignIn={openSignIn}
        onRequireVerification={(email) => openVerifyEmail(email)}
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
    </>
  )
}
