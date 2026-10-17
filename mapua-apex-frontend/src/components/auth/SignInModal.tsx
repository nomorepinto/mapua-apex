import React, { useEffect, useState } from "react"
import { X, AlertCircle, AlertTriangle, Check, Circle, Clock, Eye, EyeOff, HelpCircle, Info, Loader2 } from "lucide-react"
import apexBrandLogo from "@/assets/apex-brand.svg"
import {
  cognitoCompleteNewPassword,
  cognitoSignIn,
  isNewPasswordChallenge,
  type NewPasswordChallenge,
} from "@/lib/cognito-auth"
import { useSignInLockout } from "@/hooks/use-sign-in-lockout"
import { useEmailExistence } from "@/hooks/use-email-existence"
import { checkPasswordRequirements, validateEmailLive, validateEmailDomain } from "@/lib/auth-validation"

const configuredInactivitySeconds = Number(
  import.meta.env.VITE_SIGNIN_INACTIVITY_TIMEOUT_SECONDS
)
const SIGNIN_INACTIVITY_TIMEOUT_MS =
  Number.isFinite(configuredInactivitySeconds) && configuredInactivitySeconds > 0
    ? configuredInactivitySeconds * 1000
    : 3000

type SignInStep = "credentials" | "newPassword"

interface PendingNewPassword {
  session: string
  username: string
  requiredAttributes: string[]
}

function attributeLabel(name: string): string {
  switch (name) {
    case "name":
      return "Full name"
    case "email":
      return "Email address"
    case "phone_number":
      return "Phone number"
    case "given_name":
      return "Given name"
    case "family_name":
      return "Family name"
    case "preferred_username":
      return "Username"
    case "custom:organization_id":
      return "Organization"
    default:
      return name.replace(/^custom:/, "").replace(/_/g, " ")
  }
}

export interface SignInModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToSignUp: () => void
  onSwitchToForgotPassword: () => void
  onRequireVerification?: (email: string) => void
  onSuccess?: () => void
  onInactivityTimeout?: () => void
}

export function SignInModal({
  isOpen,
  onClose,
  onSwitchToSignUp,
  onSwitchToForgotPassword,
  onRequireVerification,
  onSuccess,
  onInactivityTimeout,
}: SignInModalProps) {
  const [email, setEmail] = useState("")
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockActive, setCapsLockActive] = useState(false)
  const [numLockActive, setNumLockActive] = useState(false)
  const [isWrongPassword, setIsWrongPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [step, setStep] = useState<SignInStep>("credentials")
  const [pendingNewPassword, setPendingNewPassword] = useState<PendingNewPassword | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({})

  const {
    isLocked,
    remainingFormatted,
    recordFailedAttempt,
    resetLockout,
    attemptsRemaining,
  } = useSignInLockout()

  const emailExistence = useEmailExistence()
  const resetEmailExistence = emailExistence.reset

  useEffect(() => {
    if (!isOpen || isLoading) return

    let timeoutId: number
    const resetTimer = () => {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        setEmail("")
        setEmailTouched(false)
        setPassword("")
        setShowPassword(false)
        setCapsLockActive(false)
        setNumLockActive(false)
        setIsWrongPassword(false)
        setErrorMessage(null)
        setStep("credentials")
        setPendingNewPassword(null)
        setNewPassword("")
        setConfirmPassword("")
        setShowNewPassword(false)
        setShowConfirmPassword(false)
        setAttributeValues({})
        resetEmailExistence()
        onClose()
        onInactivityTimeout?.()
      }, SIGNIN_INACTIVITY_TIMEOUT_MS)
    }
    const activityEvents = ["pointerdown", "keydown", "input", "focusin"] as const

    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, resetTimer)
    )
    resetTimer()

    return () => {
      window.clearTimeout(timeoutId)
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, resetTimer)
      )
    }
  }, [
    isLoading,
    isOpen,
    onClose,
    onInactivityTimeout,
    resetEmailExistence,
  ])

  const [trackedOpen, setTrackedOpen] = useState(isOpen)
  if (trackedOpen !== isOpen) {
    setTrackedOpen(isOpen)
    if (!isOpen) {
      setStep("credentials")
      setPendingNewPassword(null)
      setNewPassword("")
      setConfirmPassword("")
      setShowNewPassword(false)
      setShowConfirmPassword(false)
      setAttributeValues({})
      setErrorMessage(null)
    }
  }

  if (!isOpen) return null

  const pwdReqs = checkPasswordRequirements(newPassword)
  const missingRequiredAttribute = pendingNewPassword?.requiredAttributes.some(
    (attr) => !(attributeValues[attr] || "").trim()
  ) ?? false
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword

  // Real-time live email validation error (format first, then domain allow-list)
  const liveEmailError = (emailTouched || email.length > 0)
    ? validateEmailLive(email) ?? validateEmailDomain(email)
    : null

  const handlePasswordKeyEvent = (
    e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>
  ) => {
    const nativeEvent = e.nativeEvent as KeyboardEvent
    if (typeof nativeEvent.getModifierState === "function") {
      setCapsLockActive(nativeEvent.getModifierState("CapsLock"))
      setNumLockActive(nativeEvent.getModifierState("NumLock"))
    }
  }

  const applyNewPasswordChallenge = (
    challenge: NewPasswordChallenge,
    signedInEmail: string,
    resetPassword: boolean
  ) => {
    setPendingNewPassword({
      session: challenge.session,
      username: challenge.username,
      requiredAttributes: challenge.requiredAttributes,
    })
    setAttributeValues((current) => {
      const next: Record<string, string> = {}
      for (const attr of challenge.requiredAttributes) {
        if (current[attr]) next[attr] = current[attr]
        else if (attr === "email") next[attr] = signedInEmail
        else next[attr] = ""
      }
      return next
    })
    if (resetPassword) {
      setNewPassword("")
      setConfirmPassword("")
      setShowNewPassword(false)
      setShowConfirmPassword(false)
    }
    setIsWrongPassword(false)
    setErrorMessage(null)
    setStep("newPassword")
  }

  const finishSignIn = () => {
    resetLockout()
    setIsWrongPassword(false)
    try {
      localStorage.setItem("apex_last_active_at", Date.now().toString())
      localStorage.removeItem("apex_session_id")
    } catch {
      // ignore
    }

    if (onSuccess) {
      onSuccess()
    } else {
      window.location.href = "/"
    }
  }

  const returnToCredentials = () => {
    setStep("credentials")
    setPendingNewPassword(null)
    setNewPassword("")
    setConfirmPassword("")
    setShowNewPassword(false)
    setShowConfirmPassword(false)
    setAttributeValues({})
    setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked || isLoading) return

    setErrorMessage(null)
    setEmailTouched(true)

    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.")
      return
    }

    const emailErr = validateEmailLive(cleanEmail)
    if (emailErr) {
      setErrorMessage(emailErr)
      return
    }

    const domainErr = validateEmailDomain(cleanEmail)
    if (domainErr) {
      setErrorMessage(domainErr)
      return
    }

    if (!password) {
      setErrorMessage("Please enter your password.")
      return
    }

    // Mailbox-existence gate: block only on a conclusive "invalid" answer
    // (checker outages resolve to "unavailable" and fail open).
    const existence = await emailExistence.check(cleanEmail)
    if (existence === "invalid") {
      setErrorMessage("No mailbox exists for this address. Please double-check it.")
      return
    }

    setIsLoading(true)

    try {
      // Direct AWS Cognito Sign In
      await cognitoSignIn(cleanEmail, password)
      finishSignIn()
    } catch (err: unknown) {
      if (isNewPasswordChallenge(err)) {
        applyNewPasswordChallenge(err, cleanEmail, true)
        return
      }

      const authErr = err as { code?: string; message?: string }
      const errCode = authErr.code || ""
      const errMsg = authErr.message || "Sign in failed. Please try again."

      if (errCode === "NEW_PASSWORD_REQUIRED") {
        setErrorMessage(errMsg)
        return
      }

      // If user's email is not confirmed, transition directly to verification step
      if (errCode === "UserNotConfirmedException") {
        if (onRequireVerification) {
          onRequireVerification(cleanEmail)
          return
        }
      }

      // Check for incorrect credentials / wrong password
      const isAuthMismatch =
        errCode === "NotAuthorizedException" ||
        errMsg.toLowerCase().includes("incorrect") ||
        errMsg.toLowerCase().includes("password")

      if (isAuthMismatch) {
        recordFailedAttempt()
        setIsWrongPassword(true)
      }

      setErrorMessage(errMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading || !pendingNewPassword) return

    setErrorMessage(null)

    for (const attr of pendingNewPassword.requiredAttributes) {
      const value = (attributeValues[attr] || "").trim()
      if (!value) {
        setErrorMessage(`Please enter ${attributeLabel(attr).toLowerCase()}.`)
        return
      }
      if (attr === "email") {
        const emailErr = validateEmailLive(value) ?? validateEmailDomain(value)
        if (emailErr) {
          setErrorMessage(emailErr)
          return
        }
      }
    }

    if (!pwdReqs.allValid) {
      setErrorMessage("Please ensure your new password satisfies all security requirements.")
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("The passwords do not match.")
      return
    }

    if (password && newPassword === password) {
      setErrorMessage("Choose a password that is different from the temporary password.")
      return
    }

    const attributes: Record<string, string> = {}
    for (const attr of pendingNewPassword.requiredAttributes) {
      attributes[attr] = (attributeValues[attr] || "").trim()
    }

    setIsLoading(true)

    try {
      await cognitoCompleteNewPassword(
        pendingNewPassword.username,
        newPassword,
        pendingNewPassword.session,
        attributes
      )
      finishSignIn()
    } catch (err: unknown) {
      if (isNewPasswordChallenge(err)) {
        applyNewPasswordChallenge(err, email.trim(), false)
        setErrorMessage(err.message)
        return
      }

      const authErr = err as { message?: string }
      setErrorMessage(authErr.message || "Could not update the password. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className={`relative z-10 w-full ${step === "newPassword" ? "max-w-[440px]" : "max-w-[420px]"} max-h-[92vh] overflow-y-auto rounded-[24px] bg-white p-7 sm:p-9 shadow-2xl transition-all border border-neutral-100 flex flex-col items-center`}>
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Brand Illustration */}
        <div className="flex justify-center mb-3">
          <img
            src={apexBrandLogo}
            alt="Mapua APEX"
            className="h-16 w-auto object-contain"
          />
        </div>

        {/* Heading & Subtitle */}
        <div className="w-full text-left mb-6">
          <h2 id="sign-in-title" className="text-xl font-bold tracking-tight text-neutral-900">
            {step === "newPassword" ? "Set a new password" : "Welcome back"}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {step === "newPassword"
              ? "This account is using a temporary password. Choose a permanent password to finish signing in."
              : "Sign in to pick up where you left off."}
          </p>
        </div>

        {/* 30-Minute Cooldown Alert */}
        {step === "credentials" && isLocked && (
          <div className="w-full mb-4 rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-amber-900 text-xs flex items-start gap-2.5">
            <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900">Sign-in temporarily locked</p>
              <p className="mt-1 text-amber-700">
                Too many invalid sign-in attempts. For your security, please retry in{" "}
                <span className="font-bold text-amber-900">{remainingFormatted}</span> due to multiple invalid requests.
              </p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {!isLocked && errorMessage && (
          <div className="w-full mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <span>{errorMessage}</span>
              {step === "credentials" && attemptsRemaining < 3 && attemptsRemaining > 0 && (
                <p className="mt-1 font-medium text-red-700">
                  {attemptsRemaining} {attemptsRemaining === 1 ? "attempt" : "attempts"} remaining before a 30-minute lockout.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Wrong Password Assistance Message */}
        {step === "credentials" && !isLocked && isWrongPassword && (
          <div className="w-full mb-4 rounded-xl border border-amber-300 bg-amber-50/95 p-3 text-xs flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-start gap-2">
              <HelpCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900">Incorrect password</p>
                <p className="text-amber-800 mt-0.5">Do you need help in resetting your password?</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSwitchToForgotPassword}
              className="shrink-0 font-semibold text-white bg-[#b91c1c] hover:bg-[#991b1b] px-2.5 py-1.5 rounded-lg text-xs shadow-xs transition-colors"
            >
              Reset
            </button>
          </div>
        )}

        {step === "credentials" ? (
        <>
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Email field */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-neutral-800">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                emailExistence.reset()
                if (errorMessage) setErrorMessage(null)
              }}
              onBlur={() => {
                setEmailTouched(true)
                emailExistence.check(email)
              }}
              placeholder="you@example.com"
              required
              disabled={isLocked || isLoading}
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all disabled:bg-neutral-50 disabled:text-neutral-400 ${
                (liveEmailError || (emailTouched && emailExistence.state === "invalid"))
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                  : "border-neutral-200 focus:border-[#b91c1c] focus:ring-[#b91c1c]/15"
              }`}
            />
            {liveEmailError && (emailTouched || email.length > 0) && (
              <p className="flex items-start gap-1 text-[11px] text-red-600 mt-1 animate-in fade-in">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{liveEmailError}</span>
              </p>
            )}
            {!liveEmailError && emailExistence.state === "checking" && (
              <p className="flex items-center gap-1 text-[11px] text-neutral-500 mt-1">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span>Verifying email...</span>
              </p>
            )}
            {!liveEmailError && emailExistence.state === "invalid" && (
              <p className="flex items-start gap-1 text-[11px] text-red-600 mt-1 animate-in fade-in">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>No mailbox exists for this address. Please double-check it.</span>
              </p>
            )}
          </div>

          {/* Password field */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-neutral-800">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (isWrongPassword) setIsWrongPassword(false)
                  if (errorMessage) setErrorMessage(null)
                }}
                onKeyDown={handlePasswordKeyEvent}
                onKeyUp={handlePasswordKeyEvent}
                onFocus={handlePasswordKeyEvent}
                placeholder="Enter your password"
                required
                disabled={isLocked || isLoading}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 pr-14 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#b91c1c]/15 transition-all disabled:bg-neutral-50 disabled:text-neutral-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors flex items-center gap-1 select-none"
              >
                {showPassword ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    <span>Show</span>
                  </>
                )}
              </button>
            </div>

            {/* CapsLock & NumLock live warnings */}
            {(capsLockActive || numLockActive) && (
              <div className="flex flex-wrap items-center gap-2 pt-1 animate-in fade-in">
                {capsLockActive && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                    Caps Lock is ON
                  </span>
                )}
                {numLockActive && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                    <Info className="h-3 w-3 text-blue-500 shrink-0" />
                    Num Lock is ON
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Forgot password link */}
          <div className="text-left pt-0.5">
            <button
              type="button"
              onClick={onSwitchToForgotPassword}
              className={`text-xs transition-all ${
                isWrongPassword
                  ? "text-[#b91c1c] font-bold underline bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 shadow-xs"
                  : "font-medium text-[#b91c1c] hover:text-[#991b1b] hover:underline"
              }`}
            >
              {isWrongPassword && <AlertCircle className="h-3.5 w-3.5 text-[#b91c1c] shrink-0" />}
              Forgot password?
            </button>
          </div>

          {/* Sign In Submit Button */}
          <button
            type="submit"
            disabled={isLocked || isLoading}
            className="w-full rounded-xl bg-[#c01525] hover:bg-[#a8101f] active:bg-[#8B0000] text-white font-medium py-2.5 text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Signing in...</span>
              </>
            ) : isLocked ? (
              <span>Locked ({remainingFormatted})</span>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>

        <div className="w-full border-t border-neutral-100 mt-6 pt-4 text-center">
          <p className="text-xs text-neutral-600">
            New here?{" "}
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="font-semibold text-[#b91c1c] hover:text-[#991b1b] hover:underline transition-colors ml-1"
            >
              Create an account
            </button>
          </p>
        </div>
        </>
        ) : (
          <form onSubmit={handleNewPasswordSubmit} className="w-full space-y-4">
            {pendingNewPassword?.requiredAttributes.map((attr) => (
              <div key={attr} className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold text-neutral-800">
                  {attributeLabel(attr)}
                </label>
                <input
                  type={attr === "email" ? "email" : attr === "phone_number" ? "tel" : "text"}
                  value={attributeValues[attr] || ""}
                  onChange={(e) => {
                    const value = e.target.value
                    setAttributeValues((current) => ({ ...current, [attr]: value }))
                    if (errorMessage) setErrorMessage(null)
                  }}
                  autoComplete={attr === "email" ? "email" : attr === "name" ? "name" : "on"}
                  required
                  disabled={isLoading}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#b91c1c]/15 transition-all disabled:bg-neutral-50 disabled:text-neutral-400"
                />
              </div>
            ))}

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-neutral-800">
                New password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  onKeyDown={handlePasswordKeyEvent}
                  onKeyUp={handlePasswordKeyEvent}
                  onFocus={handlePasswordKeyEvent}
                  autoComplete="new-password"
                  placeholder="Create a permanent password"
                  required
                  disabled={isLoading}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 pr-14 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#b91c1c]/15 transition-all disabled:bg-neutral-50 disabled:text-neutral-400"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors flex items-center gap-1 select-none"
                >
                  {showNewPassword ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Show</span>
                    </>
                  )}
                </button>
              </div>

              {(capsLockActive || numLockActive) && (
                <div className="flex flex-wrap items-center gap-2 pt-1 animate-in fade-in">
                  {capsLockActive && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                      Caps Lock is ON
                    </span>
                  )}
                  {numLockActive && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      <Info className="h-3 w-3 text-blue-500 shrink-0" />
                      Num Lock is ON
                    </span>
                  )}
                </div>
              )}

              <div className="mt-2.5 rounded-xl border border-neutral-100 bg-neutral-50/80 p-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-neutral-700 mb-1">
                  New password must include:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                  <div className={`flex items-center gap-1.5 transition-colors ${pwdReqs.minLength ? "text-emerald-700 font-medium" : "text-neutral-500"}`}>
                    {pwdReqs.minLength ? (
                      <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
                    )}
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${pwdReqs.hasUppercase ? "text-emerald-700 font-medium" : "text-neutral-500"}`}>
                    {pwdReqs.hasUppercase ? (
                      <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
                    )}
                    <span>1 uppercase letter (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${pwdReqs.hasNumber ? "text-emerald-700 font-medium" : "text-neutral-500"}`}>
                    {pwdReqs.hasNumber ? (
                      <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
                    )}
                    <span>1 number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${pwdReqs.hasSpecialChar ? "text-emerald-700 font-medium" : "text-neutral-500"}`}>
                    {pwdReqs.hasSpecialChar ? (
                      <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
                    )}
                    <span>1 special character (!@#$...)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-neutral-800">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  onKeyDown={handlePasswordKeyEvent}
                  onKeyUp={handlePasswordKeyEvent}
                  onFocus={handlePasswordKeyEvent}
                  autoComplete="new-password"
                  placeholder="Re-enter the new password"
                  required
                  disabled={isLoading}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 pr-14 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#b91c1c]/15 transition-all disabled:bg-neutral-50 disabled:text-neutral-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors flex items-center gap-1 select-none"
                >
                  {showConfirmPassword ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Show</span>
                    </>
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="flex items-start gap-1 text-[11px] text-red-600 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Passwords do not match.</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !pwdReqs.allValid || !passwordsMatch || missingRequiredAttribute}
              className="w-full rounded-xl bg-[#c01525] hover:bg-[#a8101f] active:bg-[#8B0000] text-white font-medium py-2.5 text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Updating password...</span>
                </>
              ) : (
                <span>Save password and sign in</span>
              )}
            </button>

            <div className="w-full border-t border-neutral-100 mt-6 pt-4 text-center">
              <button
                type="button"
                onClick={returnToCredentials}
                className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
