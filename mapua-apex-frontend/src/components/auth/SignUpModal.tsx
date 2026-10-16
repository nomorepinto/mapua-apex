import React, { useState } from "react"
import { X, AlertCircle, AlertTriangle, Check, Circle, Eye, EyeOff, Info, Loader2 } from "lucide-react"
import apexBrandLogo from "@/assets/apex-brand.svg"
import { OrganizationSelect } from "@/components/auth/OrganizationSelect"
import { cognitoSignUp } from "@/lib/cognito-auth"
import { useEmailExistence } from "@/hooks/use-email-existence"
import {
  validateEmailLive,
  validateEmailDomain,
  validateFullName,
  checkPasswordRequirements,
} from "@/lib/auth-validation"

export interface SignUpModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToSignIn: () => void
  onRequireVerification: (email: string) => void
}

export function SignUpModal({
  isOpen,
  onClose,
  onSwitchToSignIn,
  onRequireVerification,
}: SignUpModalProps) {
  const [fullName, setFullName] = useState("")
  const [fullNameTouched, setFullNameTouched] = useState(false)

  const [email, setEmail] = useState("")
  const [emailTouched, setEmailTouched] = useState(false)
  const [organizationId, setOrganizationId] = useState("")

  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockActive, setCapsLockActive] = useState(false)
  const [numLockActive, setNumLockActive] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const emailExistence = useEmailExistence()

  if (!isOpen) return null

  // Live validation calculations
  const nameError = (fullNameTouched || fullName.length > 0) ? validateFullName(fullName) : null
  const liveEmailError = (emailTouched || email.length > 0)
    ? validateEmailLive(email) ?? validateEmailDomain(email)
    : null
  const pwdReqs = checkPasswordRequirements(password)

  const handlePasswordKeyEvent = (
    e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>
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
      setErrorMessage(`Full name must be at least 8 characters long (currently ${cleanName.length}).`)
      return
    }
    if (cleanName.length > 35) {
      setErrorMessage(`Full name cannot exceed 35 characters (currently ${cleanName.length}).`)
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

    // 3. Organization selection
    if (!organizationId) {
      setErrorMessage("Please select your organization.")
      return
    }

    // 4. Password requirements check
    if (!pwdReqs.allValid) {
      setErrorMessage("Please ensure your password satisfies all security requirements.")
      return
    }

    // 5. Mailbox-existence gate: block only on a conclusive "invalid" answer
    // (checker outages resolve to "unavailable" and fail open).
    const existence = await emailExistence.check(cleanEmail)
    if (existence === "invalid") {
      setErrorMessage("No mailbox exists for this address. Please double-check it.")
      return
    }

    setIsLoading(true)

    try {
      // Direct AWS Cognito Sign Up
      await cognitoSignUp(cleanName, cleanEmail, password, organizationId)

      // Move to email verification modal
      onRequireVerification(cleanEmail)
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string }
      setErrorMessage(authErr.message || "Failed to create account. Please check your details.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-up-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative z-10 w-full max-w-[440px] max-h-[92vh] overflow-y-auto rounded-[24px] bg-white p-7 sm:p-9 shadow-2xl transition-all border border-neutral-100 flex flex-col items-center">
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
        <div className="w-full text-left mb-5">
          <h2 id="sign-up-title" className="text-xl font-bold tracking-tight text-neutral-900">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Welcome! Let's get you registered.
          </p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="w-full mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
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
              <span className={`text-[11px] ${fullName.length > 35 || (fullName.length > 0 && fullName.trim().length < 8) ? "text-amber-600 font-medium" : "text-neutral-400"}`}>
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
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all ${
                nameError && fullNameTouched
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                  : "border-neutral-200 focus:border-[#b91c1c] focus:ring-[#b91c1c]/15"
              }`}
            />
            {nameError && (fullNameTouched || fullName.length > 0) && (
              <p className="flex items-start gap-1 text-[11px] text-red-600 mt-1 animate-in fade-in">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
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
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all ${
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

          <OrganizationSelect
            disabled={isLoading}
            invalid={errorMessage === "Please select your organization."}
            onValueChange={(nextOrganizationId) => {
              setOrganizationId(nextOrganizationId)
              if (errorMessage === "Please select your organization.") {
                setErrorMessage(null)
              }
            }}
            value={organizationId}
          />

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
                className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 pr-14 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#b91c1c]/15 transition-all"
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

            {/* Dynamic Interactive Password Requirements Checklist */}
            <div className="mt-2.5 rounded-xl border border-neutral-100 bg-neutral-50/80 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-neutral-700 mb-1">
                Password must include:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                {/* Rule 1: Min 8 chars */}
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    pwdReqs.minLength ? "text-emerald-700 font-medium" : "text-neutral-500"
                  }`}
                >
                  {pwdReqs.minLength ? (
                    <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
                  )}
                  <span>At least 8 characters</span>
                </div>

                {/* Rule 2: 1 Uppercase */}
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    pwdReqs.hasUppercase ? "text-emerald-700 font-medium" : "text-neutral-500"
                  }`}
                >
                  {pwdReqs.hasUppercase ? (
                    <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
                  )}
                  <span>1 uppercase letter (A-Z)</span>
                </div>

                {/* Rule 3: 1 Number */}
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    pwdReqs.hasNumber ? "text-emerald-700 font-medium" : "text-neutral-500"
                  }`}
                >
                  {pwdReqs.hasNumber ? (
                    <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
                  )}
                  <span>1 number (0-9)</span>
                </div>

                {/* Rule 4: 1 Special Character */}
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    pwdReqs.hasSpecialChar ? "text-emerald-700 font-medium" : "text-neutral-500"
                  }`}
                >
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-[#c01525] hover:bg-[#a8101f] active:bg-[#8B0000] text-white font-medium py-2.5 text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
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
          <p className="text-[11px] text-neutral-500 text-center leading-relaxed pt-1">
            By creating an account, you agree to our{" "}
            <span className="text-[#b91c1c] cursor-pointer hover:underline font-medium">Terms of Service</span>
            {" "}and{" "}
            <span className="text-[#b91c1c] cursor-pointer hover:underline font-medium">Privacy Policy</span>.
          </p>
        </form>

        {/* Footer switch */}
        <div className="w-full border-t border-neutral-100 mt-5 pt-4 text-center">
          <p className="text-xs text-neutral-600">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="font-semibold text-[#b91c1c] hover:text-[#991b1b] hover:underline transition-colors ml-1"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
