import React, { useState } from "react"
import { X, AlertCircle, Eye, EyeOff } from "lucide-react"
import apexBrandLogo from "@/assets/apex-brand.svg"
import { cognitoSignUp } from "@/lib/cognito-auth"

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
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    setErrorMessage(null)

    const cleanName = fullName.trim()
    const cleanEmail = email.trim()

    if (!cleanName) {
      setErrorMessage("Please enter your full name.")
      return
    }

    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.")
      return
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.")
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
          <h2 id="sign-up-title" className="text-xl font-bold tracking-tight text-neutral-900">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Welcome! Let's get you started.
          </p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="w-full mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Full name field */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-neutral-800">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              required
              disabled={isLoading}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#b91c1c]/15 transition-all"
            />
          </div>

          {/* Email address field */}
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
                placeholder="Create a password"
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
            <p className="text-[11px] text-neutral-400 mt-1">
              Use at least 8 characters.
            </p>
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
