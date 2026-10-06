import { cn } from "@/lib/utils"
import { getStatusVariant, type Activity } from "@/components/ui/activity.types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useReviewDashboardContext } from "@/components/signatories/dashboard/review-dashboard-context"
import { layout } from "@/config"

// ── Status badge ──────────────────────────────────────────────────────────────

function statusBadgeClass(status: Activity["status"]) {
  const variant = getStatusVariant(status)
  switch (variant) {
    case "success":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-200"
    case "error":
      return "bg-rose-500/10 text-rose-600 border-rose-200"
    case "warning":
      return "bg-amber-500/10 text-amber-600 border-amber-200"
    default:
      return "bg-neutral-100 text-neutral-600 border-neutral-200"
  }
}

function StatusBadge({ status }: { status: Activity["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        statusBadgeClass(status)
      )}
    >
      {status ?? "—"}
    </span>
  )
}

// ── History table ─────────────────────────────────────────────────────────────

interface HistoryTableProps {
  activities: Activity[]
  loading: boolean
  onSelect: (activity: Activity) => void
  emptyLabel: string
}

function HistoryTable({ activities, loading, onSelect, emptyLabel }: HistoryTableProps) {
  return (
    <div className={layout.sectionFlush}>
      <div className={layout.tableWrap}>
        <Table className={layout.table}>
          <TableHeader>
            <TableRow className="border-b border-neutral-200 text-xs font-bold tracking-wider text-neutral-500 uppercase hover:bg-transparent!">
              <TableHead className="px-6 py-4 font-bold text-neutral-500">
                ORGANIZATION
              </TableHead>
              <TableHead className="px-6 py-4 font-bold text-neutral-500">
                ACTIVITY NAME
              </TableHead>
              <TableHead className="px-6 py-4 font-bold text-neutral-500">
                DATE
              </TableHead>
              <TableHead className="px-6 py-4 font-bold text-neutral-500">
                TYPE
              </TableHead>
              <TableHead className="px-6 py-4 text-right font-bold text-neutral-500">
                OUTCOME
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-14 text-center text-sm text-neutral-400">
                  Loading history…
                </TableCell>
              </TableRow>
            ) : activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-14 text-center text-sm text-neutral-400">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity) => (
                <TableRow
                  key={activity.id}
                  className="cursor-pointer hover:bg-neutral-50"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(activity)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSelect(activity)
                    }
                  }}
                >
                  <TableCell className="px-6 py-4 text-sm text-neutral-700">
                    {activity.org}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm font-semibold text-neutral-900">
                    {activity.title}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-neutral-500">
                    {activity.submittedDate}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-xs capitalize text-neutral-500">
                    {activity.type}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <StatusBadge status={activity.status} />
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

// ── Section ───────────────────────────────────────────────────────────────────

/**
 * Submission history container shown below the "For Review" queue on the
 * signatory dashboard. The content is role-aware:
 *
 * - OSAAR / CDM   : All submissions that have reached this campus desk
 *                   (system-wide — every submission must pass through them).
 * - Adviser       : Submissions from the organisations this adviser handles
 *                   that have already been processed.
 * - Dean          : Event proposals under this department that have been
 *                   approved or denied.
 */
export function SubmissionHistorySection() {
  const { state, actions } = useReviewDashboardContext()

  function historyTitle() {
    if (state.isCampusDesk) return "Submission History"
    if (state.isDean) return "Processed Event Proposals"
    if (state.isAdviser) return "Submission History"
    return "Submission History"
  }

  function historySubtitle() {
    if (state.isOsaar) {
      return "All event proposals that have been fully approved, returned, or denied across all organisations."
    }
    if (state.isCdm) {
      return "Event proposals with venue reservations that have been approved or denied by CDM."
    }
    if (state.isDean) {
      return "All co-curricular and relevant event proposals under your department that have been actioned."
    }
    if (state.isAdviser) {
      return "Submissions from the organisations you advise that have already been processed."
    }
    return "All submissions that have been actioned and left your desk."
  }

  function emptyLabel() {
    return "No processed submissions found."
  }

  return (
    <section className={layout.section}>
      <div className="mb-5 flex shrink-0 flex-col gap-1">
        <h2 className="text-lg font-extrabold text-neutral-900">{historyTitle()}</h2>
        <p className="text-xs text-neutral-500">{historySubtitle()}</p>
      </div>

      <HistoryTable
        activities={state.historyActivities}
        loading={state.isHistoryLoading}
        onSelect={actions.handleActivitySelect}
        emptyLabel={emptyLabel()}
      />
    </section>
  )
}
