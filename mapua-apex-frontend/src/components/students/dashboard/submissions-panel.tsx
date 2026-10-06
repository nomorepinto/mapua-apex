import { Link } from "react-router"

import { useStudentDashboard } from "@/components/students/dashboard/student-dashboard-context"
import { SubmissionsFilterHeader } from "@/components/students/dashboard/submissions-filter-header"
import { SubmissionsSortHeader } from "@/components/students/dashboard/submissions-sort-header"
import { CollabBadge } from "@/components/students/dashboard/collab-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { formatDocumentId } from "@/lib/dynamodb-adapters"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

function statusTextColor(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
    case "completed":
      return "text-[#10B981] bg-emerald-50"
    case "under review":
      return "text-[#3B82F6] bg-blue-50"
    case "submitted":
    case "pending":
      return "text-[#F59E0B] bg-amber-50"
    case "denied":
    case "rejected":
      return "text-[#D9291C] bg-red-50"
    case "returned":
      return "text-[#F59E0B] bg-amber-50"
    default:
      return "text-[#64748B] bg-neutral-100"
  }
}

function natureBadgeClass(nature: string | undefined, status: string) {
  if (nature === "major") {
    return "bg-emerald-100 text-[#065F46] ring-1 ring-emerald-400"
  }
  if (nature === "minor") {
    return "text-[#10B981] bg-emerald-50"
  }
  return statusTextColor(status)
}

export function SubmissionsPanel() {
  const { state, actions } = useStudentDashboard()

  return (
    <div className={cn(layout.section, "overflow-hidden")}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1E293B] sm:text-xl">
            Project Status & Submissions
          </h2>
          <p className="text-xs text-neutral-600">
            Track current signatory routing and approval statuses
          </p>
        </div>
        <Input
          aria-label="Search submissions"
          className="w-full min-w-0 sm:w-64"
          onChange={(event) => actions.setSearch(event.currentTarget.value)}
          placeholder="Search all columns"
          type="search"
          value={state.search}
        />
      </div>

      <div className={layout.tableWrap}>
        <Table className="w-full text-left">
          <TableHeader>
            <TableRow className="border-b border-neutral-200 text-xs font-bold tracking-wider text-neutral-600 uppercase">
              <TableHead className="pr-4 pb-3 font-bold">DOCUMENT ID</TableHead>
              <SubmissionsFilterHeader
                label="Event Title"
                column="collab"
                className="pr-6"
                options={state.filterOptions.collab}
                selected={state.columnFilters.collab}
                onToggle={actions.toggleColumnFilter}
                onClear={actions.clearColumnFilter}
              />
              <SubmissionsFilterHeader
                label="Venue"
                column="venue"
                options={state.filterOptions.venue}
                selected={state.columnFilters.venue}
                onToggle={actions.toggleColumnFilter}
                onClear={actions.clearColumnFilter}
                className="pr-4"
              />
              <SubmissionsFilterHeader
                label="Classification"
                column="classification"
                options={state.filterOptions.classification}
                selected={state.columnFilters.classification}
                onToggle={actions.toggleColumnFilter}
                onClear={actions.clearColumnFilter}
                capitalize
                className="pr-4"
              />
              <SubmissionsSortHeader
                label="Date Applied"
                direction={state.dateSortDirection}
                onSort={actions.toggleDateSort}
                className="pr-4"
              />
              <SubmissionsFilterHeader
                label="Current Signatory"
                column="signatory"
                options={state.filterOptions.signatory}
                selected={state.columnFilters.signatory}
                onToggle={actions.toggleColumnFilter}
                onClear={actions.clearColumnFilter}
                className="pr-4"
              />
              <SubmissionsFilterHeader
                label="Status"
                column="status"
                options={state.filterOptions.status}
                selected={state.columnFilters.status}
                onToggle={actions.toggleColumnFilter}
                onClear={actions.clearColumnFilter}
                align="right"
                className="text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-neutral-50">
            {state.submissionsLoading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-sm font-semibold text-neutral-600"
                >
                  Loading submissions…
                </TableCell>
              </TableRow>
            ) : state.submissionsError ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-sm font-semibold text-rose-600"
                >
                  Could not load submissions.
                </TableCell>
              </TableRow>
            ) : state.submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm font-bold text-[#1E293B]">
                      No submissions yet
                    </p>
                    <p className="mb-2 text-xs text-neutral-600">
                      Create your first activity proposal to start tracking
                      approvals.
                    </p>
                    <Link
                      to="/students/submissions"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B0000] px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#6B0000]"
                    >
                      <span>+ Create Project / Event</span>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ) : state.filteredSubmissions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-sm font-semibold text-neutral-600"
                >
                  {state.search.trim()
                    ? `No submissions match “${state.search.trim()}”.`
                    : "No submissions match the selected column filters."}
                </TableCell>
              </TableRow>
            ) : (
              state.filteredSubmissions.map((sub) => (
                <TableRow
                  key={`${sub.event_id}:${sub.submission_id}`}
                  className="group cursor-pointer transition-colors hover:bg-neutral-50/80"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    actions.openTracker(sub.event_id, sub.submission_id)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      actions.openTracker(sub.event_id, sub.submission_id)
                    }
                  }}
                >
                  <TableCell
                    className="py-3.5 pr-4 font-mono text-xs font-bold whitespace-nowrap text-[#1E293B] group-hover:text-[#D9291C]"
                    title={sub.submission_id}
                  >
                    {formatDocumentId(sub.submission_id)}
                  </TableCell>
                  <TableCell className="py-3.5 pr-6 text-xs font-semibold text-[#1E293B]">
                    {sub.activity_details.title}
                    {sub.is_collaboration ? (
                      <CollabBadge role={sub.role ?? "proponent"} />
                    ) : null}
                  </TableCell>
                  <TableCell className="py-3.5 pr-4 text-xs text-[#64748B]">
                    {sub.activity_details.venue || "—"}
                  </TableCell>
                  <TableCell className="py-3.5 pr-4 text-xs text-[#64748B] capitalize">
                    {sub.activity_classification}
                  </TableCell>
                  <TableCell className="py-3.5 pr-4 text-xs whitespace-nowrap text-[#64748B]">
                    {sub.submitted_date}
                  </TableCell>
                  <TableCell className="py-3.5 pr-4 text-xs font-medium text-[#475569]">
                    {sub.current_signatory}
                  </TableCell>
                  <TableCell className="py-3.5 text-right whitespace-nowrap">
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-bold ${natureBadgeClass(sub.nature, sub.status)}`}
                    >
                      {sub.nature
                        ? `${sub.status} (${sub.nature.charAt(0).toUpperCase() + sub.nature.slice(1)})`
                        : sub.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
