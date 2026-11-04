import type { ReactNode } from "react"

import { SegmentedControl } from "@/components/admin/reservables/segmented-control"
import { layout } from "@/config"
import {
  SUBMISSION_VIEW_ITEMS,
  useSubmissionView,
} from "@/lib/dashboard-view"
import { cn } from "@/lib/utils"

/**
 * The Table | Calendar switch every review surface shows. One component for the
 * OSAAR dashboard and the adviser, dean and CDM desks, so the labels, icons,
 * size, a11y role and URL behavior of the switch cannot drift between them.
 *
 * It reads and writes the view itself (`?view=calendar` via `useSubmissionView`),
 * which is why callers only pass positioning props.
 */
export function SubmissionViewSwitch({
  ariaLabel = "Dashboard view",
  className,
}: {
  ariaLabel?: string
  className?: string
}) {
  const [view, setView] = useSubmissionView()

  return (
    <SegmentedControl
      ariaLabel={ariaLabel}
      className={cn("max-w-full flex-wrap", className)}
      items={SUBMISSION_VIEW_ITEMS}
      mode="tablist"
      onChange={setView}
      size="sm"
      value={view}
    />
  )
}

export interface SubmissionDeskProps {
  /** Role-aware page header (e.g. `ReviewDashboardHeader`). */
  header: ReactNode
  /** Rendered in Table view — normally the queue plus the history table. */
  tableView: ReactNode
  /** Rendered in Calendar view — normally `SubmissionCalendarSection`. */
  calendarView: ReactNode
  /**
   * Detail dialogs. Rendered outside the view branch on purpose, so a modal a
   * row opened survives the user flipping between Table and Calendar.
   */
  dialogs?: ReactNode
}

/**
 * Page shell shared by the signatory review desks (adviser, dean, CDM). Each
 * desk supplies its own header and its two view payloads, which makes the four
 * review surfaces structurally identical: header, view switch, one list or one
 * calendar, and the dialog the rows open.
 *
 * The OSAAR dashboard does not use this shell — it already owns the page and
 * tab bar, and renders `SubmissionViewSwitch` between its tabs and `<Outlet />`.
 */
export function SubmissionDesk({
  header,
  tableView,
  calendarView,
  dialogs,
}: SubmissionDeskProps) {
  const [view] = useSubmissionView()

  return (
    <div className={layout.page}>
      <div className={cn(layout.container, layout.stack)}>
        {header}
        <SubmissionViewSwitch />
        {view === "calendar" ? calendarView : tableView}
      </div>
      {dialogs}
    </div>
  )
}
