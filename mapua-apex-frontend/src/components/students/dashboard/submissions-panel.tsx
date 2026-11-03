import { useMemo } from "react"
import { useLocalReport } from "@/hooks/use-reporting"
import { ReportToolbar } from "@/components/reports/report-toolbar"
import { Link } from "react-router"

import { CollabBadge } from "@/components/students/dashboard/collab-badge"
import { Badge } from "@/components/ui/badge"
import { useStudentDashboard } from "@/components/students/dashboard/student-dashboard-context"
import { LoadingBlock } from "@/components/ui/loading-block"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { layout } from "@/config"
import {
  formatDisplayDate,
  formatDocumentId,
  getSubmissionStatusMeta,
} from "@/lib/dynamodb-adapters"
import { cn } from "@/lib/utils"

export function SubmissionsPanel() {
  const { state, actions } = useStudentDashboard()
  const report = useLocalReport(
    "proposals",
    "student-proposals",
    state.rawSubmissions
  )
  const filteredSubmissions = useMemo(() => {
    const mapped = new Map(
      state.submissions.map((row) => [
        `${row.event_id}:${row.submission_id}`,
        row,
      ])
    )
    return report.rows.flatMap((item) => {
      const row = mapped.get(`${item.event_id}:${item.submission_id}`)
      return row ? [row] : []
    })
  }, [report.rows, state.submissions])

  return (
    <div className={cn(layout.section, "overflow-hidden")}>
      {/* Card Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
              My Proposal Submissions
            </h2>
            {state.submissions.length > 0 && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-600">
                {state.submissions.length}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            Your organization's proposals and authorized collaborations
          </p>
        </div>

        {/* Search Box */}
      </div>

      <div className="mb-4">
        <ReportToolbar
          kind="proposals"
          filters={report.filters}
          onChange={report.setFilters}
          onReset={report.reset}
          options={report.options}
          count={filteredSubmissions.length}
          ready={!state.submissionsLoading && !state.submissionsError}
        />
      </div>
      {/* Submissions Table with Horizontal & Vertical Scroll */}
      <div className="max-h-[400px] w-full min-w-0 [scrollbar-width:thin] scrollbar-thin [scrollbar-color:#CBD5E1_transparent] overflow-x-auto overflow-y-auto rounded-xl border border-neutral-200 shadow-2xs">
        <Table className="w-full min-w-[44rem] border-collapse text-left">
          <TableHeader className="sticky top-0 z-10 bg-neutral-50 shadow-2xs">
            <TableRow className="border-b border-neutral-200 bg-neutral-50 text-xs font-bold tracking-wider text-neutral-600 uppercase">
              <TableHead className="bg-neutral-50 py-3 pr-4 font-bold">
                Proposal ID
              </TableHead>
              <TableHead className="bg-neutral-50 py-3 pr-4 font-bold">
                Proposal Title
              </TableHead>
              <TableHead className="bg-neutral-50 py-3 pr-4 font-bold">
                Type
              </TableHead>
              <TableHead className="bg-neutral-50 py-3 pr-4 font-bold">
                Category
              </TableHead>
              <TableHead className="bg-neutral-50 py-3 pr-4 font-bold">
                Latest submitted
              </TableHead>
              <TableHead className="bg-neutral-50 py-3 pr-4 font-bold">
                Last Reviewer
              </TableHead>
              <TableHead className="bg-neutral-50 py-3 pl-2 text-right font-bold">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-neutral-100 bg-white">
            {state.submissionsLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-4">
                  <LoadingBlock label="Loading proposals" />
                </TableCell>
              </TableRow>
            ) : state.submissionsError ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-sm font-semibold text-rose-600"
                >
                  Could not load proposals.
                </TableCell>
              </TableRow>
            ) : state.submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm font-bold text-neutral-900">
                      No proposals submitted yet
                    </p>
                    <p className="mb-2 text-xs text-neutral-500">
                      Create your first activity proposal to start tracking
                      approvals and reminders.
                    </p>
                    <Link
                      to="/students/submissions"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B0000] px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#6B0000]"
                    >
                      <span>Create Proposal</span>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredSubmissions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-sm font-semibold text-neutral-500"
                >
                  {report.filters.search?.trim()
                    ? `No proposals match “${report.filters.search.trim()}”.`
                    : "No proposals match the filter."}
                </TableCell>
              </TableRow>
            ) : (
              filteredSubmissions.map((sub) => {
                const mappedStatus = getSubmissionStatusMeta(sub.api_status)
                const submissionType = "SAAF"
                const category = sub.activity_classification
                  ? sub.activity_classification.charAt(0).toUpperCase() +
                    sub.activity_classification.slice(1)
                  : "Co-curricular"
                const submittedDate =
                  sub.submitted_date || formatDisplayDate(sub.sent_at)
                const lastReviewer = sub.current_signatory || "—"

                return (
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
                    {/* Proposal ID */}
                    <TableCell
                      className="py-3.5 pr-4 font-mono text-xs font-bold whitespace-nowrap text-neutral-900 transition-colors group-hover:text-[#8B0000]"
                      title={sub.submission_id}
                    >
                      {formatDocumentId(sub.submission_id)}
                    </TableCell>

                    {/* Proposal Title */}
                    <TableCell className="py-3.5 pr-4 text-xs font-bold text-neutral-900 transition-colors group-hover:text-[#8B0000]">
                      <div className="flex items-center gap-2">
                        <span>{sub.activity_details.title}</span>
                        {sub.is_collaboration ? (
                          <CollabBadge role={sub.role ?? "proponent"} />
                        ) : null}
                      </div>
                    </TableCell>

                    {/* Type */}
                    <TableCell className="py-3.5 pr-4 text-xs font-semibold whitespace-nowrap text-neutral-700">
                      {submissionType}
                    </TableCell>

                    {/* Category */}
                    <TableCell className="py-3.5 pr-4 text-xs font-medium whitespace-nowrap text-neutral-600">
                      {category}
                    </TableCell>

                    {/* Submitted Date */}
                    <TableCell className="py-3.5 pr-4 text-xs font-medium whitespace-nowrap text-neutral-600">
                      {submittedDate}
                    </TableCell>

                    {/* Last Reviewer */}
                    <TableCell className="py-3.5 pr-4 text-xs font-semibold whitespace-nowrap text-neutral-800">
                      {lastReviewer}
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="py-3.5 pl-2 text-right whitespace-nowrap">
                      <Badge className={mappedStatus.color}>
                        {mappedStatus.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Helper text if scrollable */}
      {filteredSubmissions.length > 5 && (
        <div className="mt-2 text-right text-[11px] text-neutral-400">
          Showing {filteredSubmissions.length} proposals · Scroll table to view
          all
        </div>
      )}
    </div>
  )
}
