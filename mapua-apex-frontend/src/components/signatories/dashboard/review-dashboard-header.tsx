import { useLocation } from "react-router"
import { AlertTriangleIcon } from "lucide-react"

import { layout } from "@/config"
import { useReviewDashboardContext } from "@/components/signatories/dashboard/review-dashboard-context"

/**
 * Signatory role each dashboard page group is meant for, keyed by the first
 * path segment. Used to flag when the signed-in signatory's role does not line
 * up with the desk they are looking at (e.g. an adviser on the Dean page).
 */
const PAGE_GROUP_ROLE: Record<string, { role: string; label: string }> = {
  dean: { role: "dean", label: "Dean" },
  "org-adviser": { role: "adviser", label: "Adviser" },
  "cdm-reviewer": { role: "cdm", label: "CDM" },
}

export function ReviewDashboardHeader() {
  const { state } = useReviewDashboardContext()
  const { pathname } = useLocation()

  const segment = pathname.split("/").filter(Boolean)[0] ?? ""
  const pageGroup = PAGE_GROUP_ROLE[segment]
  const roleMismatch =
    !!pageGroup && !!state.role && state.role.toLowerCase() !== pageGroup.role

  return (
    <div className="space-y-1">
      <h1 className={layout.pageTitle}>
        {state.roleLabel} Dashboard
        {roleMismatch && pageGroup && (
          <span
            className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 align-middle text-xs font-semibold text-amber-700"
            title={`Your signatory role (${state.roleLabel}) does not match the ${pageGroup.label} page you are viewing.`}
          >
            <AlertTriangleIcon className="h-3.5 w-3.5" />
            {pageGroup.label} page
          </span>
        )}
      </h1>
      <p className={layout.pageSubtitle}>
        Academic Term: 2026-2027 • Institutional submissions and approvals for student
        activities.
      </p>
    </div>
  )
}
