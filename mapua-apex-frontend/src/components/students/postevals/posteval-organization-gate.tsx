import type { ReactNode } from "react"
import { Link } from "react-router"

import { FormPageHeader } from "@/components/forms/form-page-header"
import { Button } from "@/components/ui/button"
import { LoadingBlock } from "@/components/ui/loading-block"
import { layout } from "@/config"
import { useCurrentOrganizationQuery } from "@/hooks/use-submissions"
import { cn } from "@/lib/utils"

/**
 * Higher councils skip the post-evaluation. The route stays reachable, but the
 * filing flow is replaced with a short explanation.
 */
export function PostEvalOrganizationGate({ children }: { children: ReactNode }) {
  const organizationQuery = useCurrentOrganizationQuery()

  if (organizationQuery.isPending) {
    return (
      <div className={cn(layout.page, layout.stack)}>
        <LoadingBlock label="Loading organization" />
      </div>
    )
  }

  if (organizationQuery.data?.is_higher_council) {
    return (
      <div className={cn(layout.page, layout.stack)}>
        <div className={cn(layout.containerNarrow, layout.stack)}>
          <FormPageHeader
            title="Post-evaluations"
            subtitle="Higher council organizations do not file a post-evaluation for their events."
          />
          <div>
            <Button render={<Link to="/students/dashboard" />}>
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return children
}
