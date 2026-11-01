import { useAuth } from "react-oidc-context"
import { createContext, useContext, useEffect, useState } from "react"

import { layout } from "@/config"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useSignOut } from "@/hooks/use-sign-out"
import { useSessionLogger, isIdleExpired } from "@/hooks/use-session-logger"
import { AccountLinkError } from "./account-link-error"
import {
  hasSignatoryOrOrganizationId,
  isPrivilegedAccount,
} from "./account-link"
import { SessionDisplacementDialogs } from "./session-displacement-dialogs"

const SessionTrackerContext = createContext<boolean>(false)

function SessionStartGate({
  failed,
  onRetry,
}: {
  failed: boolean
  onRetry: () => void
}) {
  return (
    <div className={layout.center}>
      <div className="flex flex-col items-center space-y-4 px-4 text-center">
        {failed ? (
          <>
            <h2 className="text-xl font-bold text-red-700">
              Session start failed
            </h2>
            <p className="text-sm font-medium text-neutral-600">
              Retry to open a session. The dashboard loads once that succeeds.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-xl bg-[#8B0000] px-4 py-2 text-sm font-medium text-white hover:bg-[#6b0000]"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8B0000] border-t-transparent" />
            <p className="text-sm font-medium text-neutral-600">
              Starting your session...
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function AuthenticatedSessionTracker({
  children,
}: {
  children: React.ReactNode
}) {
  const session = useSessionLogger()
  return (
    <SessionTrackerContext.Provider value={true}>
      <SessionDisplacementDialogs />
      {session.ready ? (
        children
      ) : (
        <SessionStartGate failed={session.failed} onRetry={session.retry} />
      )}
    </SessionTrackerContext.Provider>
  )
}

export type AuthGuardProps = {
  children: React.ReactNode
  allowedGroups?: string[]
}

export function AuthGuard({ children, allowedGroups }: AuthGuardProps) {
  const auth = useAuth()
  const handleSignOut = useSignOut()
  const [hasAttemptedSignin, setHasAttemptedSignin] = useState(false)
  const isNested = useContext(SessionTrackerContext)

  const expired = !isNested && auth.isAuthenticated && isIdleExpired()
  useEffect(() => {
    if (!expired) return

    let isMounted = true
    const terminateAndSignOut = async () => {
      const sessionId = localStorage.getItem("apex_session_id")
      if (sessionId) {
        try {
          const endPromise = apiClient.post(`/sessions/${sessionId}/end`, {
            reason: "timed_out",
          })
          const timeoutPromise = new Promise((resolve) =>
            setTimeout(resolve, 3000)
          )
          await Promise.race([endPromise, timeoutPromise])
        } catch {
          // Ignore failure; next login or sweeper will close if this fails
        }
      }

      if (isMounted) {
        handleSignOut({ skipSessionEnd: true })
      }
    }

    terminateAndSignOut()

    return () => {
      isMounted = false
    }
  }, [expired, handleSignOut])

  useEffect(() => {
    if (
      !hasAttemptedSignin &&
      !auth.isAuthenticated &&
      !auth.activeNavigator &&
      !auth.isLoading
    ) {
      setHasAttemptedSignin(true)
      window.location.href = "/"
    }
  }, [auth, hasAttemptedSignin])

  if (expired) {
    return null
  }

  if (
    auth.isLoading ||
    (!auth.isAuthenticated && !hasAttemptedSignin) ||
    auth.activeNavigator
  ) {
    return (
      <div className={layout.center}>
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8B0000] border-t-transparent" />
          <p className="text-sm font-medium text-neutral-600">
            Authenticating...
          </p>
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
          onClick={() => {
            window.location.href = "/"
          }}
          className="mt-4 rounded-xl bg-[#8B0000] px-4 py-2 text-sm font-medium text-white hover:bg-[#6b0000]"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (auth.isAuthenticated) {
    if (allowedGroups && allowedGroups.length > 0) {
      const userGroups =
        (auth.user?.profile["cognito:groups"] as string[]) || []
      const lowerUserGroups = userGroups.map((g) => g.toLowerCase())
      const hasAccess = allowedGroups.some((group) =>
        lowerUserGroups.includes(group.toLowerCase())
      )

      if (!hasAccess) {
        return (
          <div className={cn(layout.center, "flex-col p-4 text-center")}>
            <h2 className="text-xl font-bold text-red-700">Access Denied</h2>
            <p className="mt-2 text-neutral-600">
              You do not have permission to view this page.
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Your groups:{" "}
              {userGroups.length > 0 ? userGroups.join(", ") : "None"}
            </p>
            <div className="mt-6 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <button
                onClick={() => (window.location.href = "/")}
                className="min-h-11 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Go Home
              </button>
              <button
                onClick={() => handleSignOut()}
                className="min-h-11 rounded-xl bg-[#8B0000] px-4 py-2 text-sm font-medium text-white hover:bg-[#6b0000]"
              >
                Sign Out
              </button>
            </div>
          </div>
        )
      }
    }

    const profile = auth.user?.profile as Record<string, unknown> | undefined
    const userGroups = (profile?.["cognito:groups"] as string[]) || []
    if (
      !isPrivilegedAccount(userGroups) &&
      !hasSignatoryOrOrganizationId(profile)
    ) {
      return <AccountLinkError />
    }

    if (isNested) {
      return <>{children}</>
    }

    return <AuthenticatedSessionTracker>{children}</AuthenticatedSessionTracker>
  }

  return null
}
