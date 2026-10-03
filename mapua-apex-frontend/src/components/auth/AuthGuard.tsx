import { useAuth } from "react-oidc-context"
import { useEffect, useState } from "react"

import { layout } from "@/config"
import { cn } from "@/lib/utils"

export type AuthGuardProps = {
  children: React.ReactNode
  allowedGroups?: string[]
}

export function AuthGuard({ children, allowedGroups }: AuthGuardProps) {
  const auth = useAuth()
  const [hasAttemptedSignin, setHasAttemptedSignin] = useState(false)

  useEffect(() => {
    if (
      !hasAttemptedSignin &&
      !auth.isAuthenticated &&
      !auth.activeNavigator &&
      !auth.isLoading
    ) {
      // Trigger sign-in
      setHasAttemptedSignin(true)
      auth.signinRedirect()
    }
  }, [auth, hasAttemptedSignin])

  if (auth.isLoading || (!auth.isAuthenticated && !hasAttemptedSignin) || auth.activeNavigator) {
    return (
      <div className={layout.center}>
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8B0000] border-t-transparent" />
          <p className="text-sm font-medium text-neutral-600">Authenticating...</p>
        </div>
      </div>
    )
  }

  if (auth.error) {
    return (
      <div className={cn(layout.center, "flex-col p-4 text-center")}>
        <h2 className="text-xl font-bold text-red-700">Authentication Error</h2>
        <p className="mt-2 text-neutral-600">{auth.error.message}</p>
        <button
          onClick={() => auth.signinRedirect()}
          className="mt-4 rounded-xl bg-[#8B0000] px-4 py-2 text-sm font-medium text-white hover:bg-[#6b0000]"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (auth.isAuthenticated) {
    if (allowedGroups && allowedGroups.length > 0) {
      const userGroups = (auth.user?.profile["cognito:groups"] as string[]) || []
      const lowerUserGroups = userGroups.map((g) => g.toLowerCase())
      const hasAccess = allowedGroups.some((group) => lowerUserGroups.includes(group.toLowerCase()))

      if (!hasAccess) {
        return (
          <div className={cn(layout.center, "flex-col p-4 text-center")}>
            <h2 className="text-xl font-bold text-red-700">Access Denied</h2>
            <p className="mt-2 text-neutral-600">
              You do not have permission to view this page.
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Your groups: {userGroups.length > 0 ? userGroups.join(", ") : "None"}
            </p>
            <div className="mt-6 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <button
                onClick={() => window.location.href = "/"}
                className="min-h-11 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Go Home
              </button>
              <button
                onClick={() => {
                  const domain = import.meta.env.VITE_COGNITO_DOMAIN
                  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
                  const authority = import.meta.env.VITE_COGNITO_AUTHORITY
                  const logoutUri = import.meta.env.VITE_COGNITO_POST_LOGOUT_REDIRECT_URI
                  sessionStorage.removeItem(`oidc.user:${authority}:${clientId}`)
                  window.location.href = `${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`
                }}
                className="min-h-11 rounded-xl bg-[#8B0000] px-4 py-2 text-sm font-medium text-white hover:bg-[#6b0000]"
              >
                Sign Out
              </button>
            </div>
          </div>
        )
      }
    }

    return <>{children}</>
  }

  return null
}
