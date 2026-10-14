import React, { useState, useEffect } from "react"
import { X, AlertCircle, CheckCircle2, RotateCw } from "lucide-react"
import apexBrandLogo from "@/assets/apex-brand.svg"
import { cognitoConfirmSignUp, cognitoResendConfirmationCode } from "@/lib/cognito-auth"

export interface VerifyEmailModalProps {
  isOpen: boolean
  email: string
  onClose: () => void
  onVerifiedSuccess: () => void
  onBackToSignIn: () => void
}

export function VerifyEmailModal({
  isOpen,
  email,
  onClose,
  onVerifiedSuccess,
  onBackToSignIn,
}: VerifyEmailModalProps) {
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)

  useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCountdown])

  if (!isOpen) return null

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    setErrorMessage(null)
    const cleanCode = code.trim()

    if (!cleanCode) {
      setErrorMessage("Please enter the verification code sent to your email.")
      return
    }

    setIsLoading(true)

    try {
      await cognitoConfirmSignUp(email, cleanCode)
      onVerifiedSuccess()
    } catch (err: unknown) {
      const authErr = err as { message?: string }
      setErrorMessage(authErr.message || "Invalid verification code. Please check and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (resendCountdown > 0 || isLoading) return

    setErrorMessage(null)
    setResendSuccess(false)

    try {
      await cognitoResendConfirmationCode(email)
      setResendSuccess(true)
      setResendCountdown(60) // 60 seconds cooldown
    } catch (err: unknown) {
      const authErr = err as { message?: string }
      setErrorMessage(authErr.message || "Failed to resend code. Please try again.")
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-email-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-[420px] rounded-[24px] bg-white p-7 sm:p-9 shadow-2xl transition-all border border-neutral-100 flex flex-col items-center">
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
          <h2 id="verify-email-title" className="text-xl font-bold tracking-tight text-neutral-900">
            Verify your email
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            We sent a verification code to{" "}
            <span className="font-semibold text-neutral-800 break-all">{email}</span>.
          </p>
        </div>

        {/* Success Alert for Resend */}
        {resendSuccess && (
          <div className="w-full mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>A fresh verification code has been sent to your email!</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="w-full mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Verification Form */}
        <form onSubmit={handleVerify} className="w-full space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-neutral-800">
              6-digit verification code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s+/g, ""))}
              placeholder="123456"
              maxLength={8}
              required
              disabled={isLoading}
              className="w-full text-center tracking-[0.3em] font-mono text-lg rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-neutral-900 placeholder:text-neutral-300 placeholder:tracking-normal focus:border-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#b91c1c]/15 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-[#c01525] hover:bg-[#a8101f] active:bg-[#8B0000] text-white font-medium py-2.5 text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Verifying code...</span>
              </>
            ) : (
              <span>Confirm & verify</span>
            )}
          </button>
        </form>

        {/* Resend button */}
        <div className="w-full mt-4 flex items-center justify-between text-xs text-neutral-500">
          <span>Didn't receive it?</span>
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resendCountdown > 0 || isLoading}
            className="font-medium text-[#b91c1c] hover:text-[#991b1b] hover:underline disabled:text-neutral-400 disabled:no-underline flex items-center gap-1 transition-colors"
          >
            <RotateCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
          </button>
        </div>

        {/* Footer */}
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
