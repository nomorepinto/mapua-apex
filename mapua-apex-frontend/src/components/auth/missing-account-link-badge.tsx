import { AlertTriangleIcon } from "lucide-react"
import { useAuth } from "react-oidc-context"

import {
  hasSignatoryOrOrganizationId,
  isPrivilegedAccount,
} from "@/components/auth/account-link"

/** Shown beside a page title when an admin account is not linked to a desk. */
export function MissingAccountLinkBadge() {
  const auth = useAuth()
  const profile = auth.user?.profile as Record<string, unknown> | undefined
  const groups = (profile?.["cognito:groups"] as string[]) || []

  if (!isPrivilegedAccount(groups) || hasSignatoryOrOrganizationId(profile)) {
    return null
  }

  return (
    <span
      className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 align-middle text-xs font-semibold text-amber-800"
      title="This account has neither an organization id nor a signatory id."
    >
      <AlertTriangleIcon aria-hidden="true" className="h-3.5 w-3.5" />
      No org or signatory id
    </span>
  )
}
