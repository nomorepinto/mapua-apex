import { useMemo } from "react"
import { useLocalReport } from "@/hooks/use-reporting"
import { ReportToolbar } from "@/components/reports/report-toolbar"

import { useAdminDashboard } from "@/components/admin/dashboard/admin-dashboard-context"
import { SubmissionsSortHeader } from "@/components/admin/dashboard/submissions-sort-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LoadingBlock } from "@/components/ui/loading-block"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AdminSubmissionsSection() {
  const { state, actions } = useAdminDashboard()
  const report = useLocalReport(
    "proposals",
    "admin-proposals",
    state.rawSubmissions
  )
  const filteredRows = useMemo(() => {
    const mapped = new Map(
      state.rows.map((row) => [`${row.event_id}:${row.submission_id}`, row])
    )
    return report.rows.flatMap((item) => {
      const row = mapped.get(`${item.event_id}:${item.submission_id}`)
      return row ? [row] : []
    })
  }, [report.rows, state.rows])

  return (
    <section
      id="submissions-section"
      className={cn(layout.section, "scroll-mt-6")}
      aria-label="Submissions Section"
    >
      <div className="mb-5 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 sm:max-w-sm">
          <h2 className="text-lg font-extrabold text-neutral-900">
            Submissions
          </h2>
          <p className="text-xs text-neutral-500">
            Filter the proposal cohort, then open a row for the full SAAF
            record. Pending and returned papers can be edited from there.
          </p>
        </div>
      </div>

      <ReportToolbar
        kind="proposals"
        filters={report.filters}
        onChange={report.setFilters}
        onReset={report.reset}
        options={report.options}
        count={filteredRows.length}
        ready={!state.submissionsLoading && !state.submissionsError}
      />
      <div className="mt-4 min-h-0 flex-1">
        <Table
          className={layout.table}
          containerClassName="max-h-[36rem] overflow-auto rounded-xl border border-neutral-200/80 shadow-2xs"
        >
          <TableHeader className="sticky top-0 z-10 bg-white shadow-xs [&_th]:bg-white">
            <TableRow className="border-b border-neutral-200 text-neutral-500">
              <TableHead className="text-xs font-bold uppercase">
                Event
              </TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Proponent department</TableHead>
              <TableHead>Type</TableHead>
              <SubmissionsSortHeader
                label="Latest submitted"
                direction={
                  report.filters.date_basis === "latest_submitted_at"
                    ? (report.filters.sort ?? "desc")
                    : null
                }
                onSort={() =>
                  report.setFilters({
                    ...report.filters,
                    date_basis: "latest_submitted_at",
                    sort: report.filters.sort === "asc" ? "desc" : "asc",
                  })
                }
              />
              <TableHead className="text-right">Current status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.submissionsLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-4">
                  <LoadingBlock label="Loading submissions" />
                </TableCell>
              </TableRow>
            ) : state.submissionsError ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm text-rose-600"
                >
                  Could not load submissions.
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm text-neutral-400"
                >
                  {state.rows.length === 0
                    ? "No submissions to review yet."
                    : report.filters.search?.trim()
                      ? `No submissions match “${report.filters.search?.trim()}”.`
                      : "No submissions match the selected filters."}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
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
                  <TableCell className="text-sm text-neutral-700">
                    {row.department}
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
