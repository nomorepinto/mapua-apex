import { SearchIcon } from "lucide-react"

import { useAdminDashboard } from "@/components/admin/dashboard/admin-dashboard-context"
import { SubmissionsFilterHeader } from "@/components/admin/dashboard/submissions-filter-header"
import { SubmissionsSortHeader } from "@/components/admin/dashboard/submissions-sort-header"
import { Input } from "@/components/ui/input"
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
            Search every column or filter by a column header, then open a row
            for the full SAAF record.
          </p>
        </div>
        <div className="w-full sm:max-w-xs sm:w-auto">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <Input
              aria-label="Search submissions"
              className="pl-9"
              onChange={(event) => actions.setSearch(event.currentTarget.value)}
              placeholder="Search all columns"
              type="search"
              value={state.search}
            />
          </div>
        </div>
      </div>

      <div className={cn("min-h-0 flex-1", layout.tableWrap)}>
        <Table className={layout.table}>
          <TableHeader>
            <TableRow className="border-b border-neutral-200 text-neutral-500">
              <TableHead className="text-xs font-bold uppercase">Event</TableHead>
              <SubmissionsFilterHeader
                label="Organization"
                column="organization"
                options={state.filterOptions.organization}
                selected={state.columnFilters.organization}
                onToggle={actions.toggleColumnFilter}
                onClear={actions.clearColumnFilter}
              />
              <SubmissionsFilterHeader
                label="Department"
                column="department"
                options={state.filterOptions.department}
                selected={state.columnFilters.department}
                onToggle={actions.toggleColumnFilter}
                onClear={actions.clearColumnFilter}
              />
              <SubmissionsFilterHeader
                label="Type"
                column="type"
                capitalize
                options={state.filterOptions.type}
                selected={state.columnFilters.type}
                onToggle={actions.toggleColumnFilter}
                onClear={actions.clearColumnFilter}
              />
              <SubmissionsSortHeader
                label="Submitted"
                direction={state.dateSortDirection}
                onSort={actions.toggleDateSort}
              />
              <SubmissionsFilterHeader
                label="Status"
                column="status"
                align="right"
                className="text-right"
                options={state.filterOptions.status}
                selected={state.columnFilters.status}
                onToggle={actions.toggleColumnFilter}
                onClear={actions.clearColumnFilter}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.submissionsLoading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm text-neutral-400"
                >
                  Loading submissions…
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
            ) : state.filteredRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm text-neutral-400"
                >
                  {state.rows.length === 0
                    ? "No submissions to review yet."
                    : state.search.trim()
                      ? `No submissions match “${state.search.trim()}”.`
                      : "No submissions match the selected filters."}
                </TableCell>
              </TableRow>
            ) : (
              state.filteredRows.map((row) => (
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
