import React, { useState } from "react"
import {
  X,
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  EyeOff,
  Info,
} from "lucide-react"
import apexBrandLogo from "@/assets/apex-brand.svg"
import { cognitoForgotPassword, cognitoConfirmForgotPassword } from "@/lib/cognito-auth"
import { usePasswordResetLockout } from "@/hooks/use-password-reset-lockout"
import {
  validateEmailLive,
  checkPasswordRequirements,
} from "@/lib/auth-validation"

export interface ForgotPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  onBackToSignIn: () => void
  onSuccess: () => void
}

export function ForgotPasswordModal({
  isOpen,
  onClose,
  onBackToSignIn,
  onSuccess,
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<"request" | "confirm">("request")
  const [email, setEmail] = useState("")
  const [emailTouched, setEmailTouched] = useState(false)
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockActive, setCapsLockActive] = useState(false)
  const [numLockActive, setNumLockActive] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { isLocked, remainingFormatted, triggerLockout, resetLockout } = usePasswordResetLockout()

  if (!isOpen) return null

  const liveEmailError = (emailTouched || email.length > 0) ? validateEmailLive(email) : null
  const pwdReqs = checkPasswordRequirements(newPassword)

  const handlePasswordKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") {
      setCapsLockActive(e.getModifierState("CapsLock"))
      setNumLockActive(e.getModifierState("NumLock"))
    }
  }

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading || isLocked) return

    setErrorMessage(null)
    setEmailTouched(true)
    const cleanEmail = email.trim()

    if (!cleanEmail) {
      setErrorMessage("Please enter your account email address.")
      return
    }

    const emailErr = validateEmailLive(cleanEmail)
    if (emailErr) {
      setErrorMessage(emailErr)
      return
    }

    setIsLoading(true)

    try {
      await cognitoForgotPassword(cleanEmail)
      setStep("confirm")
      setSuccessMessage(`Password recovery code sent to ${cleanEmail}.`)
    } catch (err: unknown) {
      const authErr = err as { message?: string }
      setErrorMessage(authErr.message || "Failed to request reset code. Please check your email.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading || isLocked) return

    setErrorMessage(null)
    const cleanCode = code.replace(/\D/g, "").trim()

    if (!cleanCode) {
      setErrorMessage("Please enter the 6-digit recovery code.")
      return
    }

    if (cleanCode.length !== 6) {
      setErrorMessage(`Recovery code must be exactly 6 digits (currently ${cleanCode.length}/6).`)
      return
    }

    if (!pwdReqs.allValid) {
      setErrorMessage("Please ensure your new password satisfies all security requirements.")
      return
    }

    setIsLoading(true)

    try {
      await cognitoConfirmForgotPassword(email, cleanCode, newPassword)
      resetLockout()
      onSuccess()
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string }
      const errCode = authErr.code || ""
      const errMsg = authErr.message || "Failed to reset password. Please check your code."

      // If the code is wrong, mismatch, or invalid, lock password reset for 30 minutes
      const isCodeError =
        errCode === "CodeMismatchException" ||
        errCode === "ExpiredCodeException" ||
        errMsg.toLowerCase().includes("verification code") ||
        errMsg.toLowerCase().includes("code")

      if (isCodeError) {
        triggerLockout()
      }

      setErrorMessage(errMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-[440px] max-h-[92vh] overflow-y-auto rounded-[24px] bg-white p-7 sm:p-9 shadow-2xl transition-all border border-neutral-100 flex flex-col items-center">
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
          <h2 id="forgot-password-title" className="text-xl font-bold tracking-tight text-neutral-900">
            {step === "request" ? "Reset your password" : "Create new password"}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {step === "request"
              ? "Enter your email address to receive a recovery code."
              : `Enter the 6-digit code sent to ${email} and set your new password.`}
          </p>
        </div>

        {/* 30-Minute Cooldown Lock Alert */}
        {isLocked && (
          <div className="w-full mb-4 rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-amber-900 text-xs flex items-start gap-2.5 animate-in fade-in">
            <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900">Password reset temporarily locked</p>
              <p className="mt-1 text-amber-700">
                An incorrect recovery code was entered. For your security, password reset is disabled for{" "}
                <span className="font-bold text-amber-900">{remainingFormatted}</span>.
              </p>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="w-full mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Banner */}
        {!isLocked && errorMessage && (
          <div className="w-full mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {step === "request" ? (
          <form onSubmit={handleRequestCode} className="w-full space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-neutral-800">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errorMessage) setErrorMessage(null)
                }}
                onBlur={() => setEmailTouched(true)}
                placeholder="you@example.com"
                required
                disabled={isLoading || isLocked}
                className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all disabled:bg-neutral-50 disabled:text-neutral-400 ${
                  liveEmailError && emailTouched
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
            </div>

            <button
              type="submit"
              disabled={isLoading || isLocked}
              className="w-full rounded-xl bg-[#c01525] hover:bg-[#a8101f] active:bg-[#8B0000] text-white font-medium py-2.5 text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Sending code...</span>
                </>
              ) : isLocked ? (
                <span>Locked ({remainingFormatted})</span>
              ) : (
                <span>Send recovery code</span>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="w-full space-y-4">
            {/* 6-Digit Code */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-neutral-800">
                  Recovery code
                </label>
                <span className="text-[11px] text-neutral-400">
                  {code.length}/6 digits
                </span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6)
                  setCode(val)
                  if (errorMessage) setErrorMessage(null)
                }}
                placeholder="••••••"
                maxLength={6}
                required
                disabled={isLoading || isLocked}
                className="w-full text-center tracking-[0.4em] font-mono text-xl font-bold rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-neutral-900 placeholder:text-neutral-300 placeholder:tracking-normal focus:border-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#b91c1c]/15 transition-all disabled:bg-neutral-50 disabled:text-neutral-400"
              />
            </div>

            {/* New Password */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-neutral-800">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  onKeyDown={handlePasswordKeyEvent}
                  onKeyUp={handlePasswordKeyEvent}
                  onFocus={handlePasswordKeyEvent}
                  placeholder="Create new strong password"
                  required
                  disabled={isLoading || isLocked}
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

              {/* Password checklist */}
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

            <button
              type="submit"
              disabled={isLoading || isLocked || code.length !== 6 || !pwdReqs.allValid}
              className="w-full rounded-xl bg-[#c01525] hover:bg-[#a8101f] active:bg-[#8B0000] text-white font-medium py-2.5 text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Resetting password...</span>
                </>
              ) : isLocked ? (
                <span>Locked ({remainingFormatted})</span>
              ) : (
                <span>Set new password</span>
              )}
            </button>
          </form>
        )}

        <div className="w-full border-t border-neutral-100 mt-6 pt-4 text-center">
          <button
            type="button"
            onClick={onBackToSignIn}
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    </div>
  )
}
