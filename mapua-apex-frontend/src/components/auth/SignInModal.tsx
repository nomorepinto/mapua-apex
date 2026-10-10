import React, { useState } from "react"
import { X, AlertCircle, Clock, Eye, EyeOff } from "lucide-react"
import apexBrandLogo from "@/assets/apex-brand.svg"
import { cognitoSignIn } from "@/lib/cognito-auth"
import { useSignInLockout } from "@/hooks/use-sign-in-lockout"

export interface SignInModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToSignUp: () => void
  onSwitchToForgotPassword: () => void
  onRequireVerification?: (email: string) => void
  onSuccess?: () => void
}

export function SignInModal({
  isOpen,
  onClose,
  onSwitchToSignUp,
  onSwitchToForgotPassword,
  onRequireVerification,
  onSuccess,
}: SignInModalProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    isLocked,
    remainingFormatted,
    recordFailedAttempt,
    resetLockout,
    attemptsRemaining,
  } = useSignInLockout()

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked || isLoading) return

    setErrorMessage(null)

    const cleanEmail = email.trim()
    if (!cleanEmail || !password) {
      setErrorMessage("Please fill in both your email address and password.")
      return
    }

    setIsLoading(true)

    try {
      // Direct AWS Cognito Sign In
      await cognitoSignIn(cleanEmail, password)

      // Reset lockout counter on success
      resetLockout()

      if (onSuccess) {
        onSuccess()
      } else {
        // Redirect to application root to activate RoleRedirect
        window.location.href = "/"
      }
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string }
      const errCode = authErr.code || ""
      const errMsg = authErr.message || "Sign in failed. Please try again."

      // If user's email is not confirmed, transition directly to verification step
      if (errCode === "UserNotConfirmedException") {
        if (onRequireVerification) {
          onRequireVerification(cleanEmail)
          return
        }
      }

      // If password / credentials are incorrect, record failure for the 30m cooldown
      if (errCode === "NotAuthorizedException") {
        recordFailedAttempt()
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
      aria-labelledby="sign-in-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative z-10 w-full max-w-[420px] rounded-[24px] bg-white p-7 sm:p-9 shadow-2xl transition-all border border-neutral-100 flex flex-col items-center">
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
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Sign in to pick up where you left off.
          </p>
        </div>

        {/* 30-Minute Cooldown Alert */}
        {isLocked && (
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
              {attemptsRemaining < 3 && attemptsRemaining > 0 && (
                <p className="mt-1 font-medium text-red-700">
                  {attemptsRemaining} {attemptsRemaining === 1 ? "attempt" : "attempts"} remaining before a 30-minute lockout.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Email field */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-neutral-800">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={isLocked || isLoading}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#b91c1c]/15 transition-all disabled:bg-neutral-50 disabled:text-neutral-400"
            />
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
                onChange={(e) => setPassword(e.target.value)}
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
          </div>

          {/* Forgot password link */}
          <div className="text-left pt-0.5">
            <button
              type="button"
              onClick={onSwitchToForgotPassword}
              className="text-xs font-medium text-[#b91c1c] hover:text-[#991b1b] hover:underline transition-colors"
            >
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

        {/* Footer switch */}
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
      </div>
    </div>
  )
}
