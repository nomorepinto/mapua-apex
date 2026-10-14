import React, { useState } from "react"
import { X, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react"
import apexBrandLogo from "@/assets/apex-brand.svg"
import { cognitoForgotPassword, cognitoConfirmForgotPassword } from "@/lib/cognito-auth"

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
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    setErrorMessage(null)
    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setErrorMessage("Please enter your account email address.")
      return
    }

    setIsLoading(true)

    try {
      await cognitoForgotPassword(cleanEmail)
      setStep("confirm")
      setSuccessMessage(`Password reset code sent to ${cleanEmail}.`)
    } catch (err: unknown) {
      const authErr = err as { message?: string }
      setErrorMessage(authErr.message || "Failed to request reset code. Please check your email.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    setErrorMessage(null)
    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.")
      return
    }

    setIsLoading(true)

    try {
      await cognitoConfirmForgotPassword(email, code, newPassword)
      onSuccess()
    } catch (err: unknown) {
      const authErr = err as { message?: string }
      setErrorMessage(authErr.message || "Failed to reset password. Please check your code.")
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
          <h2 id="forgot-password-title" className="text-xl font-bold tracking-tight text-neutral-900">
            {step === "request" ? "Reset your password" : "Create new password"}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {step === "request"
              ? "Enter your email address to receive a recovery code."
              : `Enter the code sent to ${email} and set your new password.`}
          </p>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="w-full mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="w-full mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 text-xs flex items-start gap-2">
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={isLoading}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#b91c1c]/15 transition-all"
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
                  <span>Sending code...</span>
                </>
              ) : (
                <span>Send recovery code</span>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="w-full space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-neutral-800">
                Recovery code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
                disabled={isLoading}
                className="w-full text-center tracking-widest font-mono rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 placeholder:tracking-normal focus:border-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#b91c1c]/15 transition-all"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-neutral-800">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create new password"
                  required
                  minLength={8}
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
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[#c01525] hover:bg-[#a8101f] active:bg-[#8B0000] text-white font-medium py-2.5 text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Resetting password...</span>
                </>
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
