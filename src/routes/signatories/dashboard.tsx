import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ActivityRow } from "@/components/ui/activity-row"
import { ActivityDetailModal } from "@/components/ui/activity-detail-modal"
import { ActivityFilter } from "@/components/ui/activity-filter"
import { useReviewDashboard } from "@/hooks/use-review-dashboard"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function Dashboard() {
  const dashboard = useReviewDashboard()

  return (
    <div className={layout.page}>
      <div className={cn(layout.container, layout.stack)}>
        <div className="space-y-1">
          <h1 className={layout.pageTitle}>
            {dashboard.roleLabel} Review Dashboard
          </h1>
          <p className={layout.pageSubtitle}>
            Academic Term: 2026-2027 • Pending institutional approvals for student activities.
          </p>
        </div>

        <div className="flex items-center justify-end">
          <ActivityFilter
            departments={dashboard.departments}
            departmentOrgMap={dashboard.departmentOrgMap}
            selectedDept={dashboard.selectedDept}
            selectedOrg={dashboard.selectedOrg}
            onDeptSelect={dashboard.handleDeptSelect}
            onOrgSelect={dashboard.handleOrgSelect}
          />
        </div>

        <div className={layout.sectionFlush}>
          <div className={layout.tableWrap}>
            <Table className={layout.table}>
              <TableHeader>
                <TableRow className="border-b border-neutral-200 text-xs font-bold tracking-wider text-neutral-500 uppercase hover:bg-transparent!">
                  <TableHead className="py-4 px-6 font-bold text-neutral-500">
                    ORGANIZATION
                  </TableHead>
                  <TableHead className="py-4 px-6 font-bold text-neutral-500">
                    ACTIVITY NAME
                  </TableHead>
                  <TableHead className="py-4 px-6 font-bold text-neutral-500">
                    SUBMITTED
                  </TableHead>
                  <TableHead className="py-4 px-6 font-bold text-neutral-500">
                    TYPE
                  </TableHead>
                  <TableHead className="py-4 px-6 font-bold text-neutral-500 text-right">
                    DECISION
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-14 text-center text-sm text-neutral-400"
                    >
                      Loading your review queue…
                    </TableCell>
                  </TableRow>
                ) : dashboard.filteredActivities.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-14 text-center text-sm text-neutral-400"
                    >
                      {dashboard.hasActivities
                        ? "No activities match the selected filters."
                        : "No submissions to review yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboard.filteredActivities.map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      onSelect={dashboard.handleActivitySelect}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <ActivityDetailModal
        activity={dashboard.activeActivity}
        onClose={dashboard.handleModalClose}
        onAction={dashboard.handleModalAction}
        isActing={dashboard.isActing}
        isOsaar={dashboard.isOsaar}
        isUpdatingClassification={dashboard.isUpdatingClassification}
        onClassificationChange={dashboard.handleClassificationChange}
        actionError={dashboard.actionError}
      />
    </div>
  )
}
