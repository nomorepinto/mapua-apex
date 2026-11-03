import { useMemo, useState } from "react"
import { useAuth } from "react-oidc-context"

import { CampusSelect } from "@/components/admin/reservables/reservables-fields"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { ReportBuilder } from "@/components/reports/report-builder"
import { ReportSelect } from "@/components/reports/report-filters"
import { Card, CardPanel } from "@/components/ui/card"
import { layout } from "@/config"
import { SESSION_LOG_GROUPS } from "@/constants/auth"
import { useAdminCampusesQuery } from "@/hooks/use-campuses"
import { REPORTS, type CollectionReportKind } from "@/lib/reporting"
import type { ApiCampus } from "@/lib/types"
import { cn } from "@/lib/utils"

const EMPTY_CAMPUSES: ApiCampus[] = []

/**
 * List endpoints for the campus-independent report types. Reservation changes
 * are campus-scoped, so their endpoint is built from the selected campus.
 */
const COLLECTION_ENDPOINTS: Record<
  Exclude<CollectionReportKind, "reservation_changes">,
  string
> = {
  sessions: "/admins/monitor/sessions",
  activity: "/admins/monitor/activity",
  proposals: "/admins/submissions",
  postevals: "/admins/postevals",
}

/**
 * Date-scoped report builder and export surface, gated to OSAAR and super
 * administrators. In-place log/history panels only filter; every PDF/CSV export
 * and its date range live here. The Session log type is offered only to callers
 * who can already view the session log, mirroring the backend session_admin role.
 */
export function ReportsExportPage() {
  const auth = useAuth()
  const userGroups = (auth.user?.profile["cognito:groups"] as string[]) || []
  const canViewSessions = userGroups.some((group) =>
    SESSION_LOG_GROUPS.some((target) => group.toLowerCase() === target.toLowerCase())
  )
  const kinds = useMemo<CollectionReportKind[]>(
    () =>
      canViewSessions
        ? [
            "sessions",
            "activity",
            "proposals",
            "postevals",
            "reservation_changes",
          ]
        : ["activity", "proposals", "postevals", "reservation_changes"],
    [canViewSessions]
  )
  const [selected, setSelected] = useState<CollectionReportKind | null>(null)
  const kind = selected && kinds.includes(selected) ? selected : kinds[0]

  const campusesQuery = useAdminCampusesQuery()
  const campuses = campusesQuery.data ?? EMPTY_CAMPUSES
  const [campusOverride, setCampusOverride] = useState<string | null>(null)
  const campusId =
    campuses.find((campus) => campus.campus_id === campusOverride)?.campus_id ??
    campuses[0]?.campus_id ??
    null

  const endpoint =
    kind === "reservation_changes"
      ? campusId
        ? `/admins/campuses/${encodeURIComponent(campusId)}/reservation-changes`
        : null
      : COLLECTION_ENDPOINTS[kind]

  return (
    <div className={layout.page}>
      <div className={cn(layout.container, layout.stack)}>
        <FormPageHeader
          title="Reports & Export"
          subtitle="Build a date-scoped report for any collection, preview the complete result, then download a PDF or CSV. Files are generated in your browser and are never stored on the server. Available to OSAAR and super administrators."
        />

        <Card className={cn(layout.card, "min-w-0")}>
          <CardPanel>
            <div className="flex flex-wrap items-end gap-3">
              <ReportSelect
                label="Report type"
                value={kind}
                options={Object.fromEntries(
                  kinds.map((item) => [item, REPORTS[item].title])
                )}
                onChange={(value) => setSelected(value as CollectionReportKind)}
              />
              {kind === "reservation_changes" && (
                <div className="min-w-56">
                  <CampusSelect
                    campuses={campuses}
                    disabled={campusesQuery.isLoading}
                    id="reports-campus"
                    onChange={setCampusOverride}
                    value={campusId}
                  />
                </div>
              )}
            </div>
          </CardPanel>
        </Card>

        {endpoint ? (
          <ReportBuilder
            key={`${kind}:${endpoint}`}
            kind={kind}
            endpoint={endpoint}
          />
        ) : (
          <p className="text-sm text-neutral-500">
            {campusesQuery.isLoading
              ? "Loading campuses…"
              : "No campuses are available to report on."}
          </p>
        )}
      </div>
    </div>
  )
}
