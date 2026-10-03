import { useAuth } from "react-oidc-context"
import { Navigate } from "react-router"

import { layout } from "@/config"

/** Case-insensitive check for whether a user belongs to a Cognito group. */
function hasGroup(userGroups: string[], target: string): boolean {
  const lowerTarget = target.toLowerCase()
  return userGroups.some((g) => g.toLowerCase() === lowerTarget)
}

export function RoleRedirect() {
  const auth = useAuth()

  if (auth.isLoading || auth.activeNavigator) {
    return (
      <div className={layout.center}>
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8B0000] border-t-transparent" />
          <p className="text-sm font-medium text-neutral-600">Redirecting...</p>
        </div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    // AuthGuard at the root layout usually handles this, but just in case
    return <Navigate to="/students/dashboard" replace />
  }

  const userGroups = (auth.user?.profile["cognito:groups"] as string[]) || []

  // Admin & OSAAR → admin panel
  if (hasGroup(userGroups, "admin") || hasGroup(userGroups, "osaar")) {
    return <Navigate to="/admin/dashboard" replace />
  }

  // CDM Reviewer → signatories panel
  if (hasGroup(userGroups, "cdm_reviewer")) {
    return <Navigate to="/signatories/dashboard" replace />
  }

  // Org Adviser & Dean → signatories panel
  if (hasGroup(userGroups, "org_adviser") || hasGroup(userGroups, "dean")) {
    return <Navigate to="/signatories/dashboard" replace />
  }

  // Org Submitter (student orgs) → student panel
  if (hasGroup(userGroups, "org_submitter")) {
    return <Navigate to="/students/dashboard" replace />
  }

  // Fallback for unknown groups
  return <Navigate to="/students/dashboard" replace />
}
