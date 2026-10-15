import { useMemo, useState } from "react"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react"

import { useStudentDashboard } from "@/components/students/dashboard/student-dashboard-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { layout } from "@/config"
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  toLocalDateKey,
} from "@/lib/calendar-utils"
import { getDateKey, parseDateKey } from "@/lib/date-key"
import {
  formatDisplayDateTime,
  formatDocumentId,
  type DashboardSubmissionRow,
} from "@/lib/dynamodb-adapters"
import { cn } from "@/lib/utils"

export type ProposalDashboardStatus = "Approved" | "Pending" | "Cancelled"

/**
 * Standardized 3-state proposal status mapping:
 * - Approved (green)
 * - Pending (orange)
 * - Cancelled (red)
 */
export function mapProposalStatus(
  status?: string | null,
  apiStatus?: string | null
): ProposalDashboardStatus {
  const s = (apiStatus || status || "").toLowerCase()
  if (s === "approved" || s === "completed") {
    return "Approved"
  }
  if (s === "denied" || s === "rejected" || s === "cancelled") {
    return "Cancelled"
  }
  return "Pending"
}

export function ProposalStatusBadge({
  status,
  className,
}: {
  status: ProposalDashboardStatus
  className?: string
}) {
  switch (status) {
    case "Approved":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800",
            className
          )}
        >
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Approved
        </span>
      )
    case "Cancelled":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-800",
            className
          )}
        >
          <span className="size-1.5 rounded-full bg-rose-500" />
          Cancelled
        </span>
      )
    case "Pending":
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800",
            className
          )}
        >
          <span className="size-1.5 rounded-full bg-amber-500" />
          Pending
        </span>
      )
  }
}

export function StudentCalendarCard() {
  const { state, actions } = useStudentDashboard()
  const { submissions } = state

  const today = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => getDateKey(today), [today])

  const [currentMonth, setCurrentMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Map only the logged-in student's proposals to their submission dates
  const dateSubmissionsMap = useMemo(() => {
    const map = new Map<string, DashboardSubmissionRow[]>()

    submissions.forEach((row) => {
      // Use the proposal's actual submission date/timestamp field
      const sentKey = toLocalDateKey(row.sent_at) || getDateKey(new Date(row.sent_at))
      if (sentKey) {
        const list = map.get(sentKey) || []
        list.push(row)
        map.set(sentKey, list)
      }
    })

    return map
  }, [submissions])

  // Calendar cells for the current month grid
  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    const firstDay = new Date(year, month, 1)
    const startDayOfWeek = firstDay.getDay() // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const totalCells = startDayOfWeek + daysInMonth > 35 ? 42 : 35
    const cells = []

    for (let i = 0; i < totalCells; i++) {
      let date: Date
      let isCurrentMonth = true

      if (i < startDayOfWeek) {
        const dayNumber = daysInPrevMonth - startDayOfWeek + i + 1
        date = new Date(year, month - 1, dayNumber)
        isCurrentMonth = false
      } else if (i >= startDayOfWeek + daysInMonth) {
        const dayNumber = i - (startDayOfWeek + daysInMonth) + 1
        date = new Date(year, month + 1, dayNumber)
        isCurrentMonth = false
      } else {
        const dayNumber = i - startDayOfWeek + 1
        date = new Date(year, month, dayNumber)
      }

      const dateKey = getDateKey(date)
      const proposals = dateSubmissionsMap.get(dateKey) || []

      const hasApproved = proposals.some(
        (p) => mapProposalStatus(p.status, p.api_status) === "Approved"
      )
      const hasPending = proposals.some(
        (p) => mapProposalStatus(p.status, p.api_status) === "Pending"
      )
      const hasCancelled = proposals.some(
        (p) => mapProposalStatus(p.status, p.api_status) === "Cancelled"
      )

      cells.push({
        date,
        dateKey,
        dayNumber: date.getDate(),
        isCurrentMonth,
        isToday: dateKey === todayKey,
        isSelected: dateKey === selectedDateKey,
        proposals,
        hasApproved,
        hasPending,
        hasCancelled,
      })
    }

    return cells
  }, [currentMonth, dateSubmissionsMap, selectedDateKey, todayKey])

  // Submissions for the currently selected date
  const selectedDateProposals = useMemo(() => {
    return dateSubmissionsMap.get(selectedDateKey) || []
  }, [dateSubmissionsMap, selectedDateKey])

  // Formatted date label for selected date
  const selectedDateDisplay = useMemo(() => {
    const d = parseDateKey(selectedDateKey)
    if (!d) return selectedDateKey
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }, [selectedDateKey])

  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToToday = () => {
    const now = new Date()
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDateKey(todayKey)
  }

  const handleCellClick = (cellDateKey: string, cellDate: Date, isCurrentMonth: boolean) => {
    setSelectedDateKey(cellDateKey)
    if (!isCurrentMonth) {
      setCurrentMonth(new Date(cellDate.getFullYear(), cellDate.getMonth(), 1))
    }
    setDialogOpen(true)
  }

  return (
    <div className={cn(layout.section, "overflow-hidden")}>
      {/* Calendar Card Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-neutral-900 sm:text-lg">
            Calendar · {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          <p className="text-xs text-neutral-500">
            My submissions only
          </p>

          {/* Status Legend under the title */}
          <div className="mt-2.5 flex items-center gap-3.5 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-neutral-700">
              <span className="size-2 rounded-full bg-emerald-500 shadow-2xs" />
              <span>Approved</span>
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-neutral-700">
              <span className="size-2 rounded-full bg-amber-500 shadow-2xs" />
              <span>Pending</span>
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-neutral-700">
              <span className="size-2 rounded-full bg-rose-500 shadow-2xs" />
              <span>Cancelled</span>
            </span>
          </div>
        </div>

        {/* Controls at Top Right: Today / Previous / Next */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousMonth}
            className="h-8 px-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
            aria-label="Previous Month"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="h-8 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Today
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNextMonth}
            className="h-8 px-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
            aria-label="Next Month"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid Container (OSAAR format & styling) */}
      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xs">
        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50/80 text-center">
          {WEEKDAY_NAMES.map((name, index) => (
            <div
              key={name}
              className={cn(
                "py-2 text-[11px] font-bold tracking-wider uppercase",
                index === 0 || index === 6 ? "text-neutral-500" : "text-neutral-700"
              )}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Day Cells Grid */}
        <div className="grid grid-cols-7 bg-neutral-200 gap-px">
          {calendarCells.map((cell) => {
            const hasProposals = cell.proposals.length > 0

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => handleCellClick(cell.dateKey, cell.date, cell.isCurrentMonth)}
                className={cn(
                  "group relative flex min-h-[68px] flex-col justify-between p-1.5 text-left transition-colors sm:min-h-[76px] sm:p-2 cursor-pointer outline-none",
                  cell.isCurrentMonth ? "bg-white" : "bg-neutral-50/60 text-neutral-400",
                  cell.isSelected
                    ? "ring-2 ring-[#8B0000] ring-inset bg-red-50/20 z-10 font-bold"
                    : "hover:bg-neutral-50/90",
                  cell.isToday && !cell.isSelected && "bg-red-50/30"
                )}
                aria-label={`${cell.dayNumber} ${MONTH_NAMES[cell.date.getMonth()]}, ${cell.proposals.length} proposals`}
              >
                {/* Day Number Row */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                      cell.isToday
                        ? "bg-[#8B0000] text-white font-extrabold shadow-2xs"
                        : cell.isSelected
                          ? "text-[#8B0000] font-extrabold"
                          : cell.isCurrentMonth
                            ? "text-neutral-800"
                            : "text-neutral-400"
                    )}
                  >
                    {cell.dayNumber}
                  </span>

                  {/* Multiple proposals count pill */}
                  {hasProposals && cell.proposals.length > 1 && (
                    <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold text-neutral-600 sm:text-[10px]">
                      {cell.proposals.length}
                    </span>
                  )}
                </div>

                {/* Status Indicator Dots on Submission Date */}
                <div className="mt-1 flex min-h-4.5 items-end gap-1">
                  {hasProposals && (
                    <div className="flex flex-wrap items-center gap-1">
                      {cell.hasApproved && (
                        <span
                          className="size-2 rounded-full bg-emerald-500 shadow-2xs ring-1 ring-emerald-300"
                          title="Approved proposal"
                        />
                      )}
                      {cell.hasPending && (
                        <span
                          className="size-2 rounded-full bg-amber-500 shadow-2xs ring-1 ring-amber-300"
                          title="Pending proposal"
                        />
                      )}
                      {cell.hasCancelled && (
                        <span
                          className="size-2 rounded-full bg-rose-500 shadow-2xs ring-1 ring-rose-300"
                          title="Cancelled proposal"
                        />
                      )}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick helper note under calendar */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-neutral-500">
        <span>Click any date to see submitted proposals</span>
        {selectedDateProposals.length > 0 && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="font-bold text-[#8B0000] hover:underline cursor-pointer"
          >
            View {selectedDateProposals.length} proposal{selectedDateProposals.length > 1 ? "s" : ""} on {selectedDateDisplay}
          </button>
        )}
      </div>

      {/* Date Proposals Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader className="border-b border-neutral-200 pb-3 pr-8">
            <DialogTitle className="text-base font-bold text-neutral-900">
              Proposals on {selectedDateDisplay}
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500">
              {selectedDateProposals.length === 0
                ? "No proposals submitted on this date."
                : `${selectedDateProposals.length} proposal${selectedDateProposals.length > 1 ? "s" : ""} submitted by you on this date.`}
            </DialogDescription>
          </DialogHeader>

          <DialogPanel className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
            {selectedDateProposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 p-8 text-center">
                <CalendarIcon className="mb-2 h-7 w-7 text-neutral-300" />
                <p className="text-xs font-bold text-neutral-700">
                  No proposals submitted on this date
                </p>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Select a date marked with status dots (green, orange, or red) to view its proposals.
                </p>
              </div>
            ) : (
              selectedDateProposals.map((sub) => {
                const mappedStatus = mapProposalStatus(sub.status, sub.api_status)

                return (
                  <div
                    key={`${sub.event_id}-${sub.submission_id}`}
                    className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xs hover:border-neutral-300 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-neutral-500">
                        {formatDocumentId(sub.submission_id)}
                      </span>
                      <ProposalStatusBadge status={mappedStatus} />
                    </div>

                    <h4 className="text-sm font-bold text-neutral-900 leading-snug">
                      {sub.activity_details.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                      <span>Submitted: {formatDisplayDateTime(sub.sent_at)}</span>
                      {sub.current_signatory && (
                        <span>Reviewer: {sub.current_signatory}</span>
                      )}
                    </div>

                    {sub.activity_details.description && (
                      <p className="line-clamp-2 text-xs text-neutral-600 bg-neutral-50 rounded-lg p-2 mt-1">
                        {sub.activity_details.description}
                      </p>
                    )}

                    <div className="mt-2 pt-2 border-t border-neutral-100 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDialogOpen(false)
                          actions.openTracker(sub.event_id, sub.submission_id)
                        }}
                        className="text-xs font-semibold gap-1.5 cursor-pointer text-neutral-800 hover:text-neutral-900"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Proposal Tracker</span>
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
