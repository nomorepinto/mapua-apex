import { Search } from "lucide-react"
import { Link } from "react-router"

import { CollabBadge } from "@/components/students/dashboard/collab-badge"
import {
  mapProposalStatus,
  ProposalStatusBadge,
} from "@/components/students/dashboard/student-calendar-card"
import { useStudentDashboard } from "@/components/students/dashboard/student-dashboard-context"
import { Input } from "@/components/ui/input"
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
} from "@/lib/dynamodb-adapters"
import { cn } from "@/lib/utils"

export function SubmissionsPanel() {
  const { state, actions } = useStudentDashboard()

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
            Only shows proposals submitted by you
          </p>
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            aria-label="Search proposals"
            className="h-9 pl-8 text-xs"
            onChange={(event) => actions.setSearch(event.currentTarget.value)}
            placeholder="Search proposals…"
            type="search"
            value={state.search}
          />
        </div>
      </div>

      {/* Submissions Table with Horizontal & Vertical Scroll */}
      <div className="w-full min-w-0 overflow-x-auto overflow-y-auto max-h-[400px] rounded-xl border border-neutral-200 scrollbar-thin [scrollbar-width:thin] [scrollbar-color:#CBD5E1_transparent] shadow-2xs">
        <Table className="w-full min-w-[44rem] text-left border-collapse">
          <TableHeader className="sticky top-0 z-10 bg-neutral-50 shadow-2xs">
            <TableRow className="border-b border-neutral-200 text-xs font-bold tracking-wider text-neutral-600 uppercase bg-neutral-50">
              <TableHead className="py-3 pr-4 font-bold bg-neutral-50">Proposal ID</TableHead>
              <TableHead className="py-3 pr-4 font-bold bg-neutral-50">Proposal Title</TableHead>
              <TableHead className="py-3 pr-4 font-bold bg-neutral-50">Type</TableHead>
              <TableHead className="py-3 pr-4 font-bold bg-neutral-50">Category</TableHead>
              <TableHead className="py-3 pr-4 font-bold bg-neutral-50">Submitted</TableHead>
              <TableHead className="py-3 pr-4 font-bold bg-neutral-50">Last Reviewer</TableHead>
              <TableHead className="py-3 pl-2 text-right font-bold bg-neutral-50">Status</TableHead>
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
                      Create your first activity proposal to start tracking approvals and reminders.
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
            ) : state.filteredSubmissions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-sm font-semibold text-neutral-500"
                >
                  {state.search.trim()
                    ? `No proposals match “${state.search.trim()}”.`
                    : "No proposals match the filter."}
                </TableCell>
              </TableRow>
            ) : (
              state.filteredSubmissions.map((sub) => {
                const mappedStatus = mapProposalStatus(sub.status, sub.api_status)
                const submissionType = "SAAF"
                const category = sub.activity_classification
                  ? sub.activity_classification.charAt(0).toUpperCase() +
                    sub.activity_classification.slice(1)
                  : "Co-curricular"
                const submittedDate = sub.submitted_date || formatDisplayDate(sub.sent_at)
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
                      className="py-3.5 pr-4 font-mono text-xs font-bold whitespace-nowrap text-neutral-900 group-hover:text-[#8B0000] transition-colors"
                      title={sub.submission_id}
                    >
                      {formatDocumentId(sub.submission_id)}
                    </TableCell>

                    {/* Proposal Title */}
                    <TableCell className="py-3.5 pr-4 text-xs font-bold text-neutral-900 group-hover:text-[#8B0000] transition-colors">
                      <div className="flex items-center gap-2">
                        <span>{sub.activity_details.title}</span>
                        {sub.is_collaboration ? (
                          <CollabBadge role={sub.role ?? "proponent"} />
                        ) : null}
                      </div>
                    </TableCell>

                    {/* Type */}
                    <TableCell className="py-3.5 pr-4 text-xs font-semibold text-neutral-700 whitespace-nowrap">
                      {submissionType}
                    </TableCell>

                    {/* Category */}
                    <TableCell className="py-3.5 pr-4 text-xs font-medium text-neutral-600 whitespace-nowrap">
                      {category}
                    </TableCell>

                    {/* Submitted Date */}
                    <TableCell className="py-3.5 pr-4 text-xs font-medium text-neutral-600 whitespace-nowrap">
                      {submittedDate}
                    </TableCell>

                    {/* Last Reviewer */}
                    <TableCell className="py-3.5 pr-4 text-xs font-semibold text-neutral-800 whitespace-nowrap">
                      {lastReviewer}
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="py-3.5 pl-2 text-right whitespace-nowrap">
                      <ProposalStatusBadge status={mappedStatus} />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Helper text if scrollable */}
      {state.filteredSubmissions.length > 5 && (
        <div className="mt-2 text-right text-[11px] text-neutral-400">
          Showing {state.filteredSubmissions.length} proposals · Scroll table to view all
        </div>
      )}
    </div>
  )
}
