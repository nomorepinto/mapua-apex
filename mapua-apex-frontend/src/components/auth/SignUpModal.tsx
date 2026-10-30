import React, { useEffect, useState } from "react"
import {
  X,
  AlertCircle,
  AlertTriangle,
  Check,
  Circle,
  Eye,
  EyeOff,
  Info,
  Loader2,
} from "lucide-react"
import apexBrandLogo from "@/assets/apex-brand.svg"
import { cognitoSignUp } from "@/lib/cognito-auth"
import { useEmailExistence } from "@/hooks/use-email-existence"
import {
  validateEmailLive,
  validateEmailDomain,
  validateFullName,
  checkPasswordRequirements,
} from "@/lib/auth-validation"

const configuredInactivitySeconds = Number(
  import.meta.env.VITE_SIGNUP_INACTIVITY_TIMEOUT_SECONDS
)
const SIGNUP_INACTIVITY_TIMEOUT_MS =
  Number.isFinite(configuredInactivitySeconds) &&
  configuredInactivitySeconds > 0
    ? configuredInactivitySeconds * 1000
    : 3000

export interface SignUpModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToSignIn: () => void
  onRequireVerification: (email: string) => void
  onInactivityTimeout?: () => void
}

export function SignUpModal({
  isOpen,
  onClose,
  onSwitchToSignIn,
  onRequireVerification,
  onInactivityTimeout,
}: SignUpModalProps) {
  const [fullName, setFullName] = useState("")
  const [fullNameTouched, setFullNameTouched] = useState(false)

  const [email, setEmail] = useState("")
  const [emailTouched, setEmailTouched] = useState(false)

  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockActive, setCapsLockActive] = useState(false)
  const [numLockActive, setNumLockActive] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const emailExistence = useEmailExistence()
  const resetEmailExistence = emailExistence.reset

  useEffect(() => {
    if (!isOpen || isLoading) return

    let timeoutId: number
    const resetTimer = () => {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        setFullName("")
        setFullNameTouched(false)
        setEmail("")
        setEmailTouched(false)
        setPassword("")
        setShowPassword(false)
        setCapsLockActive(false)
        setNumLockActive(false)
        setErrorMessage(null)
        resetEmailExistence()
        onClose()
        onInactivityTimeout?.()
      }, SIGNUP_INACTIVITY_TIMEOUT_MS)
    }
    const activityEvents = [
      "pointerdown",
      "keydown",
      "input",
      "focusin",
    ] as const

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
  }, [isLoading, isOpen, onClose, onInactivityTimeout, resetEmailExistence])

  if (!isOpen) return null

  // Live validation calculations
  const nameError =
    fullNameTouched || fullName.length > 0 ? validateFullName(fullName) : null
  const liveEmailError =
    emailTouched || email.length > 0
      ? (validateEmailLive(email) ?? validateEmailDomain(email))
      : null
  const pwdReqs = checkPasswordRequirements(password)

  const handlePasswordKeyEvent = (
    e:
      React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>
  ) => {
    const nativeEvent = e.nativeEvent as KeyboardEvent
    if (typeof nativeEvent.getModifierState === "function") {
      setCapsLockActive(nativeEvent.getModifierState("CapsLock"))
      setNumLockActive(nativeEvent.getModifierState("NumLock"))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    setErrorMessage(null)
    setFullNameTouched(true)
    setEmailTouched(true)

    const cleanName = fullName.trim()
    const cleanEmail = email.trim()

    // 1. Full name validation: min 8, max 35 characters
    if (!cleanName) {
      setErrorMessage("Please enter your full name.")
      return
    }
    if (cleanName.length < 8) {
      setErrorMessage(
        `Full name must be at least 8 characters long (currently ${cleanName.length}).`
      )
      return
    }
    if (cleanName.length > 35) {
      setErrorMessage(
        `Full name cannot exceed 35 characters (currently ${cleanName.length}).`
      )
      return
    }

    // 2. Email validation
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

    // 3. Password requirements check
    if (!pwdReqs.allValid) {
      setErrorMessage(
        "Please ensure your password satisfies all security requirements."
      )
      return
    }

    // 4. Mailbox-existence gate: block only on a conclusive "invalid" answer
    // (checker outages resolve to "unavailable" and fail open).
    const existence = await emailExistence.check(cleanEmail)
    if (existence === "invalid") {
      setErrorMessage(
        "No mailbox exists for this address. Please double-check it."
      )
      return
    }

    setIsLoading(true)

    try {
      // Direct AWS Cognito Sign Up
      await cognitoSignUp(cleanName, cleanEmail, password)

      // Move to email verification modal
      onRequireVerification(cleanEmail)
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string }
      setErrorMessage(
        authErr.message ||
          "Failed to create account. Please check your details."
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-up-title"
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm duration-200"
    >
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-[440px] flex-col items-center overflow-y-auto rounded-[24px] border border-neutral-100 bg-white p-7 shadow-2xl transition-all sm:p-9">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Brand Illustration */}
        <div className="mb-3 flex justify-center">
          <img
            src={apexBrandLogo}
            alt="Mapua APEX"
            className="h-16 w-auto object-contain"
          />
        </div>

        {/* Heading & Subtitle */}
        <div className="mb-5 w-full text-left">
          <h2
            id="sign-up-title"
            className="text-xl font-bold tracking-tight text-neutral-900"
          >
            Create your account
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Welcome! Let's get you registered.
          </p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="animate-in fade-in mb-4 flex w-full items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Full name field */}
          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-neutral-800">
                Full name
              </label>
              <span
                className={`text-[11px] ${fullName.length > 35 || (fullName.length > 0 && fullName.trim().length < 8) ? "font-medium text-amber-600" : "text-neutral-400"}`}
              >
                {fullName.length}/35 characters (min 8)
              </span>
            </div>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                if (errorMessage) setErrorMessage(null)
              }}
              onBlur={() => setFullNameTouched(true)}
              placeholder="e.g., Juan Dela Cruz"
              minLength={8}
              maxLength={35}
              required
              disabled={isLoading}
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition-all placeholder:text-neutral-400 focus:ring-2 focus:outline-none ${
                nameError && fullNameTouched
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                  : "border-neutral-200 focus:border-[#b91c1c] focus:ring-[#b91c1c]/15"
              }`}
            />
            {nameError && (fullNameTouched || fullName.length > 0) && (
              <p className="animate-in fade-in mt-1 flex items-start gap-1 text-[11px] text-red-600">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{nameError}</span>
              </p>
            )}
          </div>

          {/* Email address field */}
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
              disabled={isLoading}
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition-all placeholder:text-neutral-400 focus:ring-2 focus:outline-none ${
                liveEmailError ||
                (emailTouched && emailExistence.state === "invalid")
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                  : "border-neutral-200 focus:border-[#b91c1c] focus:ring-[#b91c1c]/15"
              }`}
            />
            {liveEmailError && (emailTouched || email.length > 0) && (
              <p className="animate-in fade-in mt-1 flex items-start gap-1 text-[11px] text-red-600">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{liveEmailError}</span>
              </p>
            )}
            {!liveEmailError && emailExistence.state === "checking" && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-500">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span>Verifying email...</span>
              </p>
            )}
            {!liveEmailError && emailExistence.state === "invalid" && (
              <p className="animate-in fade-in mt-1 flex items-start gap-1 text-[11px] text-red-600">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  No mailbox exists for this address. Please double-check it.
                </span>
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
                  if (errorMessage) setErrorMessage(null)
                }}
                onKeyDown={handlePasswordKeyEvent}
                onKeyUp={handlePasswordKeyEvent}
                onFocus={handlePasswordKeyEvent}
                placeholder="Create a strong password"
                required
                disabled={isLoading}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 pr-14 text-sm text-neutral-900 transition-all placeholder:text-neutral-400 focus:border-[#b91c1c] focus:ring-2 focus:ring-[#b91c1c]/15 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute top-1/2 right-3.5 flex -translate-y-1/2 items-center gap-1 text-xs font-medium text-neutral-500 transition-colors select-none hover:text-neutral-800"
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
              <div className="animate-in fade-in flex flex-wrap items-center gap-2 pt-1">
                {capsLockActive && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                    Caps Lock is ON
                  </span>
                )}
                {numLockActive && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                    <Info className="h-3 w-3 shrink-0 text-blue-500" />
                    Num Lock is ON
                  </span>
                )}
              </div>
            )}

            {/* Dynamic Interactive Password Requirements Checklist */}
            <div className="mt-2.5 space-y-1.5 rounded-xl border border-neutral-100 bg-neutral-50/80 p-3">
              <p className="mb-1 text-[11px] font-semibold text-neutral-700">
                Password must include:
              </p>
              <div className="grid grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-2">
                {/* Rule 1: Min 8 chars */}
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    pwdReqs.minLength
                      ? "font-medium text-emerald-700"
                      : "text-neutral-500"
                  }`}
                >
                  {pwdReqs.minLength ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
                  )}
                  <span>At least 8 characters</span>
                </div>

                {/* Rule 2: 1 Uppercase */}
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    pwdReqs.hasUppercase
                      ? "font-medium text-emerald-700"
                      : "text-neutral-500"
                  }`}
                >
                  {pwdReqs.hasUppercase ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
                  )}
                  <span>1 uppercase letter (A-Z)</span>
                </div>

                {/* Rule 3: 1 Number */}
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    pwdReqs.hasNumber
                      ? "font-medium text-emerald-700"
                      : "text-neutral-500"
                  }`}
                >
                  {pwdReqs.hasNumber ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
                  )}
                  <span>1 number (0-9)</span>
                </div>

                {/* Rule 4: 1 Special Character */}
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    pwdReqs.hasSpecialChar
                      ? "font-medium text-emerald-700"
                      : "text-neutral-500"
                  }`}
                >
                  {pwdReqs.hasSpecialChar ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
                  )}
                  <span>1 special character (!@#$...)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#c01525] py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#a8101f] hover:shadow-md active:bg-[#8B0000] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Creating account...</span>
              </>
            ) : (
              <span>Create account</span>
            )}
          </button>

          {/* Terms & Privacy */}
          <p className="pt-1 text-center text-[11px] leading-relaxed text-neutral-500">
            By creating an account, you agree to our{" "}
            <span className="cursor-pointer font-medium text-[#b91c1c] hover:underline">
              Terms of Service
            </span>{" "}
            and{" "}
            <span className="cursor-pointer font-medium text-[#b91c1c] hover:underline">
              Privacy Policy
            </span>
            .
          </p>
        </form>

        {/* Footer switch */}
        <div className="mt-5 w-full border-t border-neutral-100 pt-4 text-center">
          <p className="text-xs text-neutral-600">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="ml-1 font-semibold text-[#b91c1c] transition-colors hover:text-[#991b1b] hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
