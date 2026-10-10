import { useEffect } from "react"
import { useSearchParams } from "react-router"
import { ShieldCheck, UserCheck, KeyRound, ArrowRight } from "lucide-react"
import apexBrandLogo from "@/assets/apex-brand.svg"
import { AuthModals, useAuthModals } from "@/components/auth/AuthModals"

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const { openSignIn, openSignUp } = useAuthModals()

  useEffect(() => {
    const mode = searchParams.get("mode")
    if (mode === "signup") {
      openSignUp()
    } else if (mode === "signin") {
      openSignIn()
    }
  }, [searchParams, openSignIn, openSignUp])

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="border-b border-neutral-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={apexBrandLogo} alt="Mapúa APEX" className="h-9 w-auto" />
            <div className="hidden sm:block">
              <span className="font-bold text-neutral-900 tracking-tight text-sm">
                Mapúa APEX
              </span>
              <span className="text-[11px] text-neutral-500 block leading-tight">
                Activity Proposal &amp; Event Execution
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={openSignIn}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-all cursor-pointer"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={openSignUp}
              className="rounded-xl bg-[#c01525] hover:bg-[#a8101f] active:bg-[#8B0000] text-white px-4 py-2 text-xs font-semibold transition-all shadow-sm hover:shadow cursor-pointer"
            >
              Create account
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-12 flex flex-col items-center justify-center text-center">
        {/* Emblem Illustration */}
        <div className="mb-6 flex justify-center">
          <div className="p-4 rounded-3xl bg-white shadow-sm border border-neutral-200/60 inline-flex">
            <img src={apexBrandLogo} alt="APEX" className="h-16 sm:h-20 w-auto" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
          Welcome to Mapúa APEX
        </h1>
        <p className="mt-3 text-sm sm:text-base text-neutral-600 max-w-xl">
          The centralized platform for student organizations, signatories, and administrators to propose, review, and track campus activities.
        </p>

        {/* Primary Modal Launchers */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
          <button
            type="button"
            onClick={openSignIn}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-xl bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-800 font-semibold px-6 py-3 text-sm transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <span>Open Sign In Modal</span>
            <ArrowRight className="h-4 w-4 text-neutral-500" />
          </button>

          <button
            type="button"
            onClick={openSignUp}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#c01525] hover:bg-[#a8101f] text-white font-semibold px-6 py-3 text-sm transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <span>Open Sign Up Modal</span>
            <ArrowRight className="h-4 w-4 text-white/80" />
          </button>
        </div>

        {/* Security Feature Highlights */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left">
          <div className="rounded-2xl bg-white p-5 border border-neutral-200/80 shadow-sm">
            <div className="h-9 w-9 rounded-xl bg-red-50 text-[#c01525] flex items-center justify-center mb-3">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-xs text-neutral-900">
              AWS Cognito Authentication
            </h3>
            <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
              Direct connection to Cognito User Pool with secure password hashing and token management.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 border border-neutral-200/80 shadow-sm">
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
              <KeyRound className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-xs text-neutral-900">
              3-Attempt Lockout Guard
            </h3>
            <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
              Enforces a 30-minute cooldown timer with a friendly security notice after 3 consecutive wrong passwords.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 border border-neutral-200/80 shadow-sm">
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
              <UserCheck className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-xs text-neutral-900">
              Email Verification Codes
            </h3>
            <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
              6-digit verification code dispatch for new registrations and password recovery with resend rate limiting.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-500">
        <p>&copy; {new Date().getFullYear()} Mapúa University. All rights reserved.</p>
      </footer>

      {/* Floating Modals Component */}
      <AuthModals />
    </div>
  )
}

export default LoginPage

