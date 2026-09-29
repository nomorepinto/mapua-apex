import {
  FILTER_LABEL_CLASS,
  FilterSelect,
} from "@/components/admin/dashboard/filter-select"
import {
  STATUS_FILTERS,
  TYPE_FILTERS,
  useAdminDashboard,
} from "@/components/admin/dashboard/admin-dashboard-context"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AdminSubmissionsSection() {
  const { state, actions } = useAdminDashboard()

  return (
    <section className={layout.section}>
      <div className="mb-5 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 sm:max-w-sm">
          <h2 className="text-lg font-extrabold text-neutral-900">Submissions</h2>
          <p className="text-xs text-neutral-500">
            Filter by organization, status, or activity type, then open a row
            for the full SAAF record.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className={FILTER_LABEL_CLASS}>
              <label htmlFor="status-filter">Status</label>
              <FilterSelect
                id="status-filter"
                items={STATUS_FILTERS}
                value={state.status}
                onValueChange={(next) =>
                  actions.setStatus(
                    next as "" | "pending" | "approved" | "denied" | "returned"
                  )
                }
              />
            </div>
            <div className={FILTER_LABEL_CLASS}>
              <label htmlFor="activity-type-filter">Activity type</label>
              <FilterSelect
                id="activity-type-filter"
                items={TYPE_FILTERS}
                value={state.activityType}
                onValueChange={actions.setActivityType}
              />
            </div>
          </div>
          <div className={cn(FILTER_LABEL_CLASS, "sm:w-auto sm:self-stretch")}>
            <label htmlFor="organization-filter">Organization</label>
            <FilterSelect
              id="organization-filter"
              items={[
                { value: "", label: "All organizations" },
                ...state.organizations.map((organization) => ({
                  value: organization.organization_id,
                  label: organization.name,
                })),
              ]}
              value={state.organizationId}
              onValueChange={actions.setOrganizationId}
            />
          </div>
        </div>
      </div>

      <div className={cn("min-h-0 flex-1", layout.tableWrap)}>
        <Table className={layout.table}>
          <TableHeader>
            <TableRow className="border-b border-neutral-200 text-neutral-500">
              <TableHead className="text-xs font-bold uppercase">Event</TableHead>
              <TableHead className="text-xs font-bold uppercase">
                Organization
              </TableHead>
              <TableHead className="text-xs font-bold uppercase">Type</TableHead>
              <TableHead className="text-xs font-bold uppercase">
                Submitted
              </TableHead>
              <TableHead className="text-right text-xs font-bold uppercase">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.submissionsLoading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-sm text-neutral-400"
                >
                  Loading submissions…
                </TableCell>
              </TableRow>
            ) : state.submissionsError ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-sm text-rose-600"
                >
                  Could not load submissions.
                </TableCell>
              </TableRow>
            ) : state.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-sm text-neutral-400"
                >
                  No submissions match these filters.
                </TableCell>
              </TableRow>
            ) : (
              state.rows.map((row) => (
                <TableRow
                  key={`${row.event_id}:${row.submission_id}`}
                  className="cursor-pointer hover:bg-neutral-50"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    actions.selectSubmission(row.event_id, row.submission_id)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      actions.selectSubmission(row.event_id, row.submission_id)
                    }
                  }}
                >
                  <TableCell className="text-sm font-semibold">
                    {row.activity_details.title}
                  </TableCell>
                  <TableCell className="text-sm text-neutral-700">
                    {row.organization_name}
                  </TableCell>
                  <TableCell className="text-xs text-neutral-500 capitalize">
                    {row.activity_classification}
                  </TableCell>
                  <TableCell className="text-sm text-neutral-500">
                    {row.submitted_date}
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold">
                    {row.status}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
