import { useAuth } from "react-oidc-context"

import { RoleRedirect } from "@/components/auth/RoleRedirect"
import { LandingAbout } from "@/components/landing/landing-about"
import { LandingAnnouncements } from "@/components/landing/landing-announcements"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingHeader } from "@/components/landing/landing-header"
import { LandingHero } from "@/components/landing/landing-hero"
import { layout } from "@/config"

export function LandingPage() {
  const auth = useAuth()

  // If the user just logged in or is already logged in, hand them off to RoleRedirect
  if (auth.isAuthenticated) {
    return <RoleRedirect />
  }

  // Show a spinner if Cognito is currently processing the login redirect
  if (auth.isLoading || auth.activeNavigator) {
    return (
      <div className={layout.center}>
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8B0000] border-t-transparent" />
          <p className="text-sm font-medium text-neutral-600">Signing in...</p>
        </div>
      </div>
    )
  }

  const signIn = () => auth.signinRedirect()

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <LandingHeader onSignIn={signIn} />
      <LandingHero onSignIn={signIn} />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <LandingAnnouncements />
          <LandingAbout />
        </div>
      </main>

      <LandingFooter />
    </div>
  )
}
