import { useMemo, useState } from "react"
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  Filter,
  MapPin,
  Plus,
  Search,
  User,
  XCircle,
} from "lucide-react"

import { useAdminDashboard } from "@/components/admin/dashboard/admin-dashboard-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { layout } from "@/config"
import { getDateKey, parseDateKey } from "@/lib/date-key"
import type { DashboardSubmissionRow } from "@/lib/dynamodb-adapters"
import { cn } from "@/lib/utils"

export type CalendarStatusFilter = "all" | "approved" | "under_review" | "denied"
export type CalendarDateMode = "event_date" | "submission_date"

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/**
 * Normalizes submission status into calendar category:
 * Approved (green), Under Review (yellow), Denied (red), or Returned (orange).
 */
export function getApplicationCalendarStatus(
  row: DashboardSubmissionRow
): "approved" | "under_review" | "denied" | "returned" {
  const apiStatus = row.api_status?.toLowerCase()
  if (apiStatus === "approved" || row.status === "Approved") return "approved"
  if (apiStatus === "denied" || row.status === "Denied") return "denied"
  if (apiStatus === "returned" || row.status === "Returned") return "returned"
  return "under_review"
}

function toLocalDateKey(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const keyMatch = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)
  if (keyMatch) return keyMatch[1]

  const date = new Date(trimmed)
  if (isNaN(date.getTime())) return null
  return getDateKey(date)
}

function getDatesInRange(startDateStr?: string, endDateStr?: string): string[] {
  const startKey = toLocalDateKey(startDateStr)
  if (!startKey) return []
  const endKey = endDateStr ? toLocalDateKey(endDateStr) : null
  if (!endKey || endKey === startKey) {
    return [startKey]
  }

  const startDate = parseDateKey(startKey)
  const endDate = parseDateKey(endKey)
  if (!startDate || !endDate || endDate < startDate) {
    return [startKey]
  }

  const keys: string[] = []
  const current = new Date(startDate)
  let count = 0
  // Guard against runaway multi-month intervals
  while (current <= endDate && count < 14) {
    keys.push(getDateKey(current))
    current.setDate(current.getDate() + 1)
    count++
  }
  return keys
}

export function AdminCalendarSection() {
  const { state, actions } = useAdminDashboard()
  const { rows, submissionsLoading, submissionsError } = state

  const today = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => getDateKey(today), [today])

  const [currentMonth, setCurrentMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey)
  const [dateMode, setDateMode] = useState<CalendarDateMode>("event_date")
  const [statusFilter, setStatusFilter] = useState<CalendarStatusFilter>("all")
  const [calendarSearch, setCalendarSearch] = useState("")
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Map submissions to date keys
  const dateSubmissionsMap = useMemo(() => {
    const map = new Map<string, DashboardSubmissionRow[]>()

    rows.forEach((row) => {
      let keys: string[] = []
      if (dateMode === "event_date") {
        const start = row.date_of_event || row.target_date || row.sent_at
        const end = row.end_date_of_event || start
        keys = getDatesInRange(start, end)
      } else {
        const sentKey = toLocalDateKey(row.sent_at)
        if (sentKey) keys = [sentKey]
      }

      keys.forEach((key) => {
        const list = map.get(key) || []
        list.push(row)
        map.set(key, list)
      })
    })

    return map
  }, [rows, dateMode])

  // Filter applications by search and status filter
  const filterApplication = useMemo(
    () => (app: DashboardSubmissionRow) => {
      const status = getApplicationCalendarStatus(app)
      if (statusFilter !== "all") {
        if (statusFilter === "approved" && status !== "approved") return false
        if (statusFilter === "under_review" && status !== "under_review") return false
        if (statusFilter === "denied" && status !== "denied") return false
      }

      if (calendarSearch.trim()) {
        const q = calendarSearch.trim().toLowerCase()
        const haystack = [
          app.activity_details.title,
          app.organization_name,
          app.department,
          app.activity_classification,
          app.activity_details.venue,
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    },
    [statusFilter, calendarSearch]
  )

  // Current month stats
  const monthStats = useMemo(() => {
    let total = 0
    let approved = 0
    let underReview = 0
    let denied = 0
    let returned = 0

    const curYear = currentMonth.getFullYear()
    const curMonth = currentMonth.getMonth()

    rows.forEach((row) => {
      let keys: string[] = []
      if (dateMode === "event_date") {
        const start = row.date_of_event || row.target_date || row.sent_at
        const end = row.end_date_of_event || start
        keys = getDatesInRange(start, end)
      } else {
        const sentKey = toLocalDateKey(row.sent_at)
        if (sentKey) keys = [sentKey]
      }

      const isInCurrentMonth = keys.some((k) => {
        const d = parseDateKey(k)
        return d && d.getFullYear() === curYear && d.getMonth() === curMonth
      })

      if (isInCurrentMonth) {
        total++
        const status = getApplicationCalendarStatus(row)
        if (status === "approved") approved++
        else if (status === "denied") denied++
        else if (status === "returned") returned++
        else underReview++
      }
    })

    return { total, approved, underReview, denied, returned }
  }, [rows, dateMode, currentMonth])

  // Calendar cells generator for the month grid
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
        // Previous month days
        const dayNumber = daysInPrevMonth - startDayOfWeek + i + 1
        date = new Date(year, month - 1, dayNumber)
        isCurrentMonth = false
      } else if (i >= startDayOfWeek + daysInMonth) {
        // Next month days
        const dayNumber = i - (startDayOfWeek + daysInMonth) + 1
        date = new Date(year, month + 1, dayNumber)
        isCurrentMonth = false
      } else {
        // Current month days
        const dayNumber = i - startDayOfWeek + 1
        date = new Date(year, month, dayNumber)
      }

      const dateKey = getDateKey(date)
      const dayApps = (dateSubmissionsMap.get(dateKey) || []).filter(filterApplication)

      const hasApproved = dayApps.some(
        (a) => getApplicationCalendarStatus(a) === "approved"
      )
      const hasUnderReview = dayApps.some(
        (a) => getApplicationCalendarStatus(a) === "under_review"
      )
      const hasDenied = dayApps.some(
        (a) => getApplicationCalendarStatus(a) === "denied"
      )
      const hasReturned = dayApps.some(
        (a) => getApplicationCalendarStatus(a) === "returned"
      )

      cells.push({
        date,
        dateKey,
        dayNumber: date.getDate(),
        isCurrentMonth,
        isToday: dateKey === todayKey,
        isSelected: dateKey === selectedDateKey,
        applications: dayApps,
        hasApproved,
        hasUnderReview,
        hasDenied,
        hasReturned,
      })
    }

    return cells
  }, [
    currentMonth,
    dateSubmissionsMap,
    filterApplication,
    todayKey,
    selectedDateKey,
  ])

  // Submissions for the selected date
  const selectedDateApplications = useMemo(() => {
    const apps = dateSubmissionsMap.get(selectedDateKey) || []
    return apps.filter(filterApplication)
  }, [dateSubmissionsMap, selectedDateKey, filterApplication])

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

  // Month navigation helpers
  const goToPreviousMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    )
  }

  const goToNextMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    )
  }

  const goToToday = () => {
    const now = new Date()
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDateKey(todayKey)
  }

  return (
    <section
      id="applications-calendar-section"
      className={cn(layout.section, "scroll-mt-6")}
      aria-label="Applications Calendar"
    >
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-[#8B0000]">
                <CalendarIcon className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-lg font-extrabold text-neutral-900">
                Applications Calendar
              </h2>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Interactive schedule of student activity submissions with real-time status indicators.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Shortcut button: Create Announcement */}
            <Button
              size="sm"
              onClick={actions.openCreate}
              className="bg-[#8B0000] text-white hover:bg-[#6e0000] text-xs font-bold shadow-2xs gap-1.5 cursor-pointer transition-all active:scale-95"
              title="Create a new announcement notice"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Create Announcement</span>
            </Button>

            {/* Date Mode Toggle */}
            <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDateMode("event_date")}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 transition-all",
                  dateMode === "event_date"
                    ? "bg-white text-neutral-900 shadow-2xs font-bold"
                    : "text-neutral-500 hover:text-neutral-800"
                )}
                title="View by scheduled date of activity"
              >
                Event Schedule
              </button>
              <button
                type="button"
                onClick={() => setDateMode("submission_date")}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 transition-all",
                  dateMode === "submission_date"
                    ? "bg-white text-neutral-900 shadow-2xs font-bold"
                    : "text-neutral-500 hover:text-neutral-800"
                )}
                title="View by submission timestamp"
              >
                Submission Date
              </button>
            </div>

            {/* Collapse toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="text-xs"
              aria-label={isCollapsed ? "Expand Calendar" : "Collapse Calendar"}
            >
              {isCollapsed ? (
                <>
                  <span>Show Calendar</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  <span>Hide Calendar</span>
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Legend & Status Quick-Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-neutral-500">
              <Filter className="h-3.5 w-3.5" /> Status:
            </span>

            {/* All */}
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all",
                statusFilter === "all"
                  ? "border-neutral-900 bg-neutral-900 text-white shadow-2xs"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              )}
            >
              <span>All</span>
              <span className="rounded-full bg-neutral-200/50 px-1.5 py-0.2 text-[10px] text-inherit">
                {monthStats.total}
              </span>
            </button>

            {/* Approved - Green */}
            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === "approved" ? "all" : "approved"))
              }
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all",
                statusFilter === "approved"
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-2xs"
                  : "border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/60"
              )}
              title="Filter by Approved applications"
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  statusFilter === "approved" ? "bg-white" : "bg-emerald-500"
                )}
              />
              <span>Approved</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px]",
                  statusFilter === "approved"
                    ? "bg-emerald-700 text-white"
                    : "bg-emerald-200/60 text-emerald-900"
                )}
              >
                {monthStats.approved}
              </span>
            </button>

            {/* Under Review - Yellow */}
            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) =>
                  prev === "under_review" ? "all" : "under_review"
                )
              }
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all",
                statusFilter === "under_review"
                  ? "border-amber-500 bg-amber-500 text-neutral-950 shadow-2xs"
                  : "border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100/60"
              )}
              title="Filter by Under Review applications"
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  statusFilter === "under_review" ? "bg-neutral-950" : "bg-amber-400"
                )}
              />
              <span>Under Review</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px]",
                  statusFilter === "under_review"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-200/60 text-amber-900"
                )}
              >
                {monthStats.underReview}
              </span>
            </button>

            {/* Denied - Red */}
            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === "denied" ? "all" : "denied"))
              }
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all",
                statusFilter === "denied"
                  ? "border-rose-600 bg-rose-600 text-white shadow-2xs"
                  : "border-rose-200 bg-rose-50/80 text-rose-800 hover:bg-rose-100/60"
              )}
              title="Filter by Denied applications"
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  statusFilter === "denied" ? "bg-white" : "bg-rose-500"
                )}
              />
              <span>Denied</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px]",
                  statusFilter === "denied"
                    ? "bg-rose-700 text-white"
                    : "bg-rose-200/60 text-rose-900"
                )}
              >
                {monthStats.denied}
              </span>
            </button>
          </div>

          {/* Quick Search in Calendar */}
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <Input
              type="search"
              aria-label="Search applications in calendar"
              placeholder="Search in calendar…"
              value={calendarSearch}
              onChange={(e) => setCalendarSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {!isCollapsed && (
        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Calendar Left Column (7 cols on lg) */}
          <div className="flex flex-col lg:col-span-7">
            {/* Month & Year Navigation Toolbar */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-neutral-900 sm:text-lg">
                  {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
                <span className="text-xs text-neutral-400">
                  ({monthStats.total} {monthStats.total === 1 ? "application" : "applications"})
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={goToPreviousMonth}
                  aria-label="Previous Month"
                  title="Previous Month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="px-2 text-xs font-semibold"
                  title="Jump to current date"
                >
                  Today
                </Button>

                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={goToNextMonth}
                  aria-label="Next Month"
                  title="Next Month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Calendar Grid Container */}
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xs">
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50/80 text-center">
                {WEEKDAY_NAMES.map((name, index) => (
                  <div
                    key={name}
                    className={cn(
                      "py-2 text-[11px] font-bold tracking-wider uppercase",
                      index === 0 || index === 6
                        ? "text-neutral-500"
                        : "text-neutral-700"
                    )}
                  >
                    {name}
                  </div>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 bg-neutral-200 gap-px">
                {calendarCells.map((cell) => {
                  const hasApps = cell.applications.length > 0

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      onClick={() => {
                        setSelectedDateKey(cell.dateKey)
                        if (!cell.isCurrentMonth) {
                          setCurrentMonth(
                            new Date(
                              cell.date.getFullYear(),
                              cell.date.getMonth(),
                              1
                            )
                          )
                        }
                      }}
                      className={cn(
                        "group relative flex min-h-[68px] flex-col justify-between p-1.5 text-left transition-colors sm:min-h-[76px] sm:p-2 cursor-pointer outline-none",
                        cell.isCurrentMonth ? "bg-white" : "bg-neutral-50/60 text-neutral-400",
                        cell.isSelected
                          ? "ring-2 ring-[#8B0000] ring-inset bg-red-50/20 z-10 font-bold"
                          : "hover:bg-neutral-50/90",
                        cell.isToday && !cell.isSelected && "bg-red-50/30"
                      )}
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

                        {/* Count Pill if Multiple */}
                        {hasApps && cell.applications.length > 1 && (
                          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold text-neutral-600 sm:text-[10px]">
                            {cell.applications.length}
                          </span>
                        )}
                      </div>

                      {/* Status Indicators Row */}
                      <div className="mt-1 flex min-h-4.5 items-end gap-1">
                        {hasApps ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {/* Approved - Green Dot */}
                            {cell.hasApproved && (
                              <span
                                className="size-2 rounded-full bg-emerald-500 shadow-2xs ring-1 ring-emerald-300"
                                title="Approved application on this date"
                              />
                            )}

                            {/* Under Review - Yellow Dot */}
                            {cell.hasUnderReview && (
                              <span
                                className="size-2 rounded-full bg-amber-400 shadow-2xs ring-1 ring-amber-300"
                                title="Under Review application on this date"
                              />
                            )}

                            {/* Denied - Red Dot */}
                            {cell.hasDenied && (
                              <span
                                className="size-2 rounded-full bg-rose-500 shadow-2xs ring-1 ring-rose-300"
                                title="Denied application on this date"
                              />
                            )}

                            {/* Returned - Orange Dot */}
                            {cell.hasReturned && (
                              <span
                                className="size-2 rounded-full bg-orange-400 shadow-2xs ring-1 ring-orange-300"
                                title="Returned application on this date"
                              />
                            )}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quick Status Bar Below Calendar */}
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-neutral-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Approved</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-amber-400" />
                  <span>Under Review</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-rose-500" />
                  <span>Denied</span>
                </span>
              </div>
              <span>Click any date to see submitted applications</span>
            </div>
          </div>

          {/* Day Details Right Column (5 cols on lg) */}
          <div className="flex flex-col lg:col-span-5">
            <div className="flex h-full max-h-[460px] min-h-[380px] flex-col rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 lg:max-h-[580px]">
              {/* Selected Date Header */}
              <div className="shrink-0 border-b border-neutral-200 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-neutral-500 uppercase">
                    Selected Date
                  </span>
                  {selectedDateKey === todayKey && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-[#8B0000]">
                      Today
                    </span>
                  )}
                </div>
                <h4 className="mt-0.5 text-sm font-extrabold text-neutral-900 sm:text-base">
                  {selectedDateDisplay}
                </h4>
                <div className="mt-0.5 flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {selectedDateApplications.length}{" "}
                    {selectedDateApplications.length === 1
                      ? "application"
                      : "applications"}{" "}
                    scheduled
                  </span>
                  {selectedDateApplications.length > 2 && (
                    <span className="text-[10px] text-neutral-400 italic">
                      Scroll to view all
                    </span>
                  )}
                </div>
              </div>

              {/* Applications List for Selected Date */}
              <div className="scrollbar-thin mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1.5 [scrollbar-width:thin] [scrollbar-color:#CBD5E1_transparent]">
                {submissionsLoading ? (
                  <div className="py-12 text-center text-xs text-neutral-400">
                    Loading applications…
                  </div>
                ) : submissionsError ? (
                  <div className="py-12 text-center text-xs text-rose-600">
                    Failed to load applications.
                  </div>
                ) : selectedDateApplications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-white/70 p-8 text-center">
                    <CalendarIcon className="mb-2 h-7 w-7 text-neutral-300" />
                    <p className="text-xs font-bold text-neutral-700">
                      No applications on this date
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Select a date marked with status dots (green, yellow, or red) to review its applications.
                    </p>
                  </div>
                ) : (
                  selectedDateApplications.map((app) => {
                    const status = getApplicationCalendarStatus(app)

                    return (
                      <div
                        key={`${app.event_id}-${app.submission_id}`}
                        className="group relative flex flex-col rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xs transition-all hover:border-neutral-300 hover:shadow-xs"
                      >
                        {/* Status + Department Header */}
                        <div className="flex items-center justify-between gap-2">
                          {status === "approved" && (
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                              <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" />
                              Approved
                            </Badge>
                          )}
                          {status === "under_review" && (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-bold">
                              <Clock className="mr-1 h-3 w-3 text-amber-600" />
                              Under Review
                            </Badge>
                          )}
                          {status === "denied" && (
                            <Badge className="border-rose-200 bg-rose-50 text-rose-800 text-[11px] font-bold">
                              <XCircle className="mr-1 h-3 w-3 text-rose-600" />
                              Denied
                            </Badge>
                          )}
                          {status === "returned" && (
                            <Badge className="border-orange-200 bg-orange-50 text-orange-800 text-[11px] font-bold">
                              <Clock className="mr-1 h-3 w-3 text-orange-600" />
                              Returned
                            </Badge>
                          )}

                          <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700 uppercase">
                            {app.department || "General"}
                          </span>
                        </div>

                        {/* Title & Organization */}
                        <h5 className="mt-2 text-sm font-bold text-neutral-900 group-hover:text-[#8B0000] transition-colors leading-snug">
                          {app.activity_details.title}
                        </h5>
                        <p className="text-xs text-neutral-600">
                          {app.organization_name}
                        </p>

                        {/* Details Grid */}
                        <div className="mt-2.5 flex flex-col gap-1 border-t border-neutral-100 pt-2 text-[11px] text-neutral-500">
                          {app.activity_details.venue && app.activity_details.venue !== "—" && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 shrink-0 text-neutral-400" />
                              <span className="truncate">{app.activity_details.venue}</span>
                            </div>
                          )}

                          {app.activity_details.time && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 shrink-0 text-neutral-400" />
                              <span>{app.activity_details.time}</span>
                            </div>
                          )}

                          {app.activity_details.proponent && (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3 shrink-0 text-neutral-400" />
                              <span className="truncate">{app.activity_details.proponent}</span>
                            </div>
                          )}
                        </div>

                        {/* Open SAAF Action Button */}
                        <div className="mt-3 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs font-semibold text-neutral-800 hover:bg-neutral-100 hover:text-neutral-900"
                            onClick={() =>
                              actions.selectSubmission(app.event_id, app.submission_id)
                            }
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            View Application Details
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
