import { useMemo, useState, type ReactNode } from "react"
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
  Search,
  User,
  XCircle,
  type LucideIcon,
} from "lucide-react"

import { LoadingBlock } from "@/components/ui/loading-block"
import type { Activity } from "@/components/ui/activity.types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { layout } from "@/config"
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  toLocalDateKey,
  type CalendarDateMode,
} from "@/lib/calendar-utils"
import {
  getSimpleCalendarStatus,
  getSubmissionCalendarStatus,
  submissionDateKeys,
  type SubmissionCalendarStatus,
} from "@/lib/submission-calendar-status"
import { getDateKey, parseDateKey } from "@/lib/date-key"
import { cn } from "@/lib/utils"

interface CalendarStatusToken {
  key: SubmissionCalendarStatus
  label: string
  /** Chips the status filter row offers; the adviser's cancelled is legend-only. */
  filterable?: boolean
  /** Plain fill for the legend dots. */
  dot: string
  /** Cell dot in the month grid, with its ring. */
  cellDot: string
  chipIdle: string
  chipActive: string
  chipDotIdle: string
  chipDotActive: string
  chipCountIdle: string
  chipCountActive: string
  badge: string
  badgeIcon: string
  icon: LucideIcon
}

/** Approved / Under Review / Denied, plus Returned dots (as OSAAR had them). */
const DETAILED_STATUS_TOKENS: CalendarStatusToken[] = [
  {
    key: "approved",
    label: "Approved",
    filterable: true,
    dot: "bg-emerald-500",
    cellDot: "bg-emerald-500 shadow-2xs ring-1 ring-emerald-300",
    chipIdle: "border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/60",
    chipActive: "border-emerald-600 bg-emerald-600 text-white shadow-2xs",
    chipDotIdle: "bg-emerald-500",
    chipDotActive: "bg-white",
    chipCountIdle: "bg-emerald-200/60 text-emerald-900",
    chipCountActive: "bg-emerald-700 text-white",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    badgeIcon: "text-emerald-600",
    icon: CheckCircle2,
  },
  {
    key: "under_review",
    label: "Under Review",
    filterable: true,
    dot: "bg-amber-400",
    cellDot: "bg-amber-400 shadow-2xs ring-1 ring-amber-300",
    chipIdle: "border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100/60",
    chipActive: "border-amber-500 bg-amber-500 text-neutral-950 shadow-2xs",
    chipDotIdle: "bg-amber-400",
    chipDotActive: "bg-neutral-950",
    chipCountIdle: "bg-amber-200/60 text-amber-900",
    chipCountActive: "bg-amber-600 text-white",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    badgeIcon: "text-amber-600",
    icon: Clock,
  },
  {
    key: "denied",
    label: "Denied",
    filterable: true,
    dot: "bg-rose-500",
    cellDot: "bg-rose-500 shadow-2xs ring-1 ring-rose-300",
    chipIdle: "border-rose-200 bg-rose-50/80 text-rose-800 hover:bg-rose-100/60",
    chipActive: "border-rose-600 bg-rose-600 text-white shadow-2xs",
    chipDotIdle: "bg-rose-500",
    chipDotActive: "bg-white",
    chipCountIdle: "bg-rose-200/60 text-rose-900",
    chipCountActive: "bg-rose-700 text-white",
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    badgeIcon: "text-rose-600",
    icon: XCircle,
  },
  {
    key: "returned",
    label: "Returned",
    dot: "bg-orange-400",
    cellDot: "bg-orange-400 shadow-2xs ring-1 ring-orange-300",
    chipIdle: "border-orange-200 bg-orange-50/80 text-orange-800 hover:bg-orange-100/60",
    chipActive: "border-orange-600 bg-orange-600 text-white shadow-2xs",
    chipDotIdle: "bg-orange-400",
    chipDotActive: "bg-white",
    chipCountIdle: "bg-orange-200/60 text-orange-900",
    chipCountActive: "bg-orange-700 text-white",
    badge: "border-orange-200 bg-orange-50 text-orange-800",
    badgeIcon: "text-orange-600",
    icon: Clock,
  },
]

/**
 * Approved / Pending / Cancelled — the view an org adviser gets: returned and
 * dean-pending papers are not distinctions it acts on, so they collapse into
 * Pending (previously `getAdviserActivityCalendarStatus`).
 */
const SIMPLE_STATUS_TOKENS: CalendarStatusToken[] = [
  {
    key: "approved",
    label: "Approved",
    filterable: true,
    dot: "bg-emerald-500",
    cellDot: "bg-emerald-500 shadow-2xs ring-1 ring-emerald-300",
    chipIdle: "border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/60",
    chipActive: "border-emerald-600 bg-emerald-600 text-white shadow-2xs",
    chipDotIdle: "bg-emerald-500",
    chipDotActive: "bg-white",
    chipCountIdle: "bg-emerald-200/60 text-emerald-900",
    chipCountActive: "bg-emerald-700 text-white",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    badgeIcon: "text-emerald-600",
    icon: CheckCircle2,
  },
  {
    key: "pending",
    label: "Pending",
    filterable: true,
    dot: "bg-amber-500",
    cellDot: "bg-amber-500 shadow-2xs ring-1 ring-amber-300",
    chipIdle: "border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100/60",
    chipActive: "border-amber-500 bg-amber-500 text-neutral-950 shadow-2xs",
    chipDotIdle: "bg-amber-500",
    chipDotActive: "bg-neutral-950",
    chipCountIdle: "bg-amber-200/60 text-amber-900",
    chipCountActive: "bg-amber-600 text-white",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    badgeIcon: "text-amber-600",
    icon: Clock,
  },
  {
    key: "cancelled",
    label: "Cancelled",
    filterable: true,
    dot: "bg-rose-500",
    cellDot: "bg-rose-500 shadow-2xs ring-1 ring-rose-300",
    chipIdle: "border-rose-200 bg-rose-50/80 text-rose-800 hover:bg-rose-100/60",
    chipActive: "border-rose-600 bg-rose-600 text-white shadow-2xs",
    chipDotIdle: "bg-rose-500",
    chipDotActive: "bg-white",
    chipCountIdle: "bg-rose-200/60 text-rose-900",
    chipCountActive: "bg-rose-700 text-white",
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    badgeIcon: "text-rose-600",
    icon: XCircle,
  },
]

const STATUS_TOKENS: Record<
  NonNullable<SubmissionCalendarSectionProps["statusTheme"]>,
  CalendarStatusToken[]
> = {
  detailed: DETAILED_STATUS_TOKENS,
  simple: SIMPLE_STATUS_TOKENS,
}

/**
 * Status key of a row under the active theme. The mapping itself lives in
 * `lib/submission-calendar-status` so the CDM reservations calendar plots the
 * same categories from the same code.
 */
function statusOf(
  activity: Activity,
  theme: NonNullable<SubmissionCalendarSectionProps["statusTheme"]>
): SubmissionCalendarStatus {
  return theme === "simple"
    ? getSimpleCalendarStatus(activity)
    : getSubmissionCalendarStatus(activity)
}

export interface SubmissionCalendarSectionProps {
  title: string
  description: string
  activities: Activity[]
  loading: boolean
  error?: boolean | string | null
  onSelect: (activity: Activity) => void
  /** Singular noun the desk calls a row ("application" / "proposal"). */
  unitLabel?: string
  selectLabel?: string
  emptyTitle?: string
  emptyDescription?: string
  hintLabel?: string
  searchPlaceholder?: string
  /** Extra header actions, e.g. OSAAR's Create Announcement shortcut. */
  toolbar?: ReactNode
  showStatusFilter?: boolean
  showDateModeToggle?: boolean
  /** How an activity maps to the status tokens; defaults to the detailed map. */
  statusTheme?: "detailed" | "simple"
  /** Date keys an activity occupies — CDM widens this to its reserved rooms. */
  dateKeysFor?: (activity: Activity) => string[]
}

/**
 * The one interactive submissions calendar behind every desk's Calendar view:
 * month grid with per-day status dots, month navigation, status quick-filter
 * chips with live counts, in-calendar search, an Event Schedule / Submission
 * Date basis toggle, Hide/Show, and a day panel listing that date's records.
 *
 * Presentational — the caller supplies the records (queue + history deduped, or
 * the whole system for OSAAR's Submissions tab) and the select handler, so the
 * actionable review modal and the read-only admin dialog both plug into it.
 */
export function SubmissionCalendarSection({
  title,
  description,
  activities,
  loading,
  error = null,
  onSelect,
  unitLabel = "application",
  selectLabel = "View Application Details",
  emptyTitle = "No applications on this date",
  emptyDescription = "Select a date marked with status dots to review its applications.",
  hintLabel = "Click any date to see submitted applications",
  searchPlaceholder = "Search in calendar…",
  toolbar,
  showStatusFilter = true,
  showDateModeToggle = true,
  statusTheme = "detailed",
  dateKeysFor = submissionDateKeys,
}: SubmissionCalendarSectionProps) {
  const tokens = STATUS_TOKENS[statusTheme]
  const errorCopy =
    typeof error === "string" ? error : "Failed to load applications."

  const today = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => getDateKey(today), [today])

  const [currentMonth, setCurrentMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey)
  const [dateMode, setDateMode] = useState<CalendarDateMode>("event_date")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [calendarSearch, setCalendarSearch] = useState("")
  const [isCollapsed, setIsCollapsed] = useState(false)

  const keysFor = useMemo(
    () =>
      (activity: Activity): string[] => {
        if (dateMode === "submission_date") {
          const sentKey = toLocalDateKey(activity.submittedAt)
          return sentKey ? [sentKey] : dateKeysFor(activity)
        }
        return dateKeysFor(activity)
      },
    [dateKeysFor, dateMode]
  )

  // Map submissions onto the date keys they occupy
  const dateActivitiesMap = useMemo(() => {
    const map = new Map<string, Activity[]>()

    activities.forEach((activity) => {
      keysFor(activity).forEach((key) => {
        const list = map.get(key) || []
        list.push(activity)
        map.set(key, list)
      })
    })

    return map
  }, [activities, keysFor])

  const filterActivity = useMemo(
    () => (activity: Activity) => {
      if (statusFilter !== "all") {
        if (statusOf(activity, statusTheme) !== statusFilter) return false
      }

      if (calendarSearch.trim()) {
        const q = calendarSearch.trim().toLowerCase()
        const haystack = [
          activity.title,
          activity.org,
          activity.department,
          activity.departmentCode,
          activity.type,
          activity.venue,
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    },
    [calendarSearch, statusFilter, statusTheme]
  )

  // Current month stats, per status token of the active theme
  const monthStats = useMemo(() => {
    const curYear = currentMonth.getFullYear()
    const curMonth = currentMonth.getMonth()
    const byStatus: Record<string, number> = {}
    tokens.forEach((token) => {
      byStatus[token.key] = 0
    })

    let total = 0
    activities.forEach((activity) => {
      const isInCurrentMonth = keysFor(activity).some((key) => {
        const d = parseDateKey(key)
        return d && d.getFullYear() === curYear && d.getMonth() === curMonth
      })
      if (!isInCurrentMonth) return
      total += 1
      const status = statusOf(activity, statusTheme)
      byStatus[status] = (byStatus[status] ?? 0) + 1
    })

    return { total, byStatus }
  }, [activities, currentMonth, keysFor, statusTheme, tokens])

  // Calendar cells for the month grid
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
      const dayActivities = (dateActivitiesMap.get(dateKey) || []).filter(
        filterActivity
      )

      cells.push({
        date,
        dateKey,
        dayNumber: date.getDate(),
        isCurrentMonth,
        isToday: dateKey === todayKey,
        isSelected: dateKey === selectedDateKey,
        activities: dayActivities,
        statuses: new Set(dayActivities.map((a) => statusOf(a, statusTheme))),
      })
    }

    return cells
  }, [
    currentMonth,
    dateActivitiesMap,
    filterActivity,
    selectedDateKey,
    statusTheme,
    todayKey,
  ])

  const selectedDateActivities = useMemo(() => {
    const list = dateActivitiesMap.get(selectedDateKey) || []
    return list.filter(filterActivity)
  }, [dateActivitiesMap, filterActivity, selectedDateKey])

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

  const plural = (count: number) =>
    `${count} ${count === 1 ? unitLabel : `${unitLabel}s`}`

  return (
    <section
      className={cn(layout.section, "scroll-mt-6")}
      aria-label={title}
    >
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-[#8B0000]">
                <CalendarIcon className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-lg font-extrabold text-neutral-900">{title}</h2>
            </div>
            <p className="mt-1 text-xs text-neutral-500">{description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {toolbar}

            {/* Date basis toggle */}
            {showDateModeToggle && (
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
                  title="View by proposal submission date"
                >
                  Submission Date
                </button>
              </div>
            )}

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

        {/* Legend & status quick-filter chips */}
        {showStatusFilter && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-medium text-neutral-500">
                <Filter className="h-3.5 w-3.5" /> Status:
              </span>

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

              {tokens
                .filter((token) => token.filterable)
                .map((token) => {
                  const isActive = statusFilter === token.key
                  return (
                    <button
                      key={token.key}
                      type="button"
                      title={`Filter by ${token.label} ${unitLabel}s`}
                      onClick={() =>
                        setStatusFilter((prev) =>
                          prev === token.key ? "all" : token.key
                        )
                      }
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all",
                        isActive ? token.chipActive : token.chipIdle
                      )}
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          isActive ? token.chipDotActive : token.chipDotIdle
                        )}
                      />
                      <span>{token.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[10px]",
                          isActive ? token.chipCountActive : token.chipCountIdle
                        )}
                      >
                        {monthStats.byStatus[token.key] ?? 0}
                      </span>
                    </button>
                  )
                })}
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                type="search"
                aria-label={`Search ${unitLabel}s in calendar`}
                placeholder={searchPlaceholder}
                value={calendarSearch}
                onChange={(e) => setCalendarSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Calendar column */}
          <div className="flex flex-col lg:col-span-7">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-neutral-900 sm:text-lg">
                  {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
                <span className="text-xs text-neutral-400">
                  ({plural(monthStats.total)})
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

            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xs">
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

              <div className="grid grid-cols-7 gap-px bg-neutral-200">
                {calendarCells.map((cell) => {
                  const hasRows = cell.activities.length > 0

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
                      aria-label={`${cell.dayNumber} ${MONTH_NAMES[cell.date.getMonth()]}, ${cell.activities.length} ${unitLabel}s`}
                      className={cn(
                        "group relative flex min-h-[68px] cursor-pointer flex-col justify-between p-1.5 text-left outline-none transition-colors sm:min-h-[76px] sm:p-2",
                        cell.isCurrentMonth
                          ? "bg-white"
                          : "bg-neutral-50/60 text-neutral-400",
                        cell.isSelected
                          ? "ring-2 ring-[#8B0000] ring-inset bg-red-50/20 z-10 font-bold"
                          : "hover:bg-neutral-50/90",
                        cell.isToday && !cell.isSelected && "bg-red-50/30"
                      )}
                    >
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

                        {hasRows && cell.activities.length > 1 && (
                          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold text-neutral-600 sm:text-[10px]">
                            {cell.activities.length}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex min-h-4.5 items-end gap-1">
                        {hasRows && (
                          <div className="flex flex-wrap items-center gap-1">
                            {tokens
                              .filter((token) => cell.statuses.has(token.key))
                              .map((token) => (
                                <span
                                  key={token.key}
                                  className={cn(
                                    "size-2 rounded-full",
                                    token.cellDot
                                  )}
                                  title={`${token.label} ${unitLabel} on this date`}
                                />
                              ))}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-neutral-500">
              <div className="flex items-center gap-3">
                {tokens.map((token) => (
                  <span key={token.key} className="flex items-center gap-1">
                    <span className={cn("size-2 rounded-full", token.dot)} />
                    <span>{token.label}</span>
                  </span>
                ))}
              </div>
              <span>{hintLabel}</span>
            </div>
          </div>

          {/* Day details column */}
          <div className="flex flex-col lg:col-span-5">
            <div className="flex h-full max-h-[460px] min-h-[380px] flex-col rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 lg:max-h-[580px]">
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
                  <span>{plural(selectedDateActivities.length)} scheduled</span>
                  {selectedDateActivities.length > 2 && (
                    <span className="text-[10px] text-neutral-400 italic">
                      Scroll to view all
                    </span>
                  )}
                </div>
              </div>

              <div className="scrollbar-thin mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1.5 [scrollbar-width:thin] [scrollbar-color:#CBD5E1_transparent]">
                {loading ? (
                  <LoadingBlock
                    label={`Loading ${unitLabel}s`}
                    rowClassName="h-16 w-full rounded-lg"
                  />
                ) : error ? (
                  <div className="py-12 text-center text-xs text-rose-600">
                    {errorCopy}
                  </div>
                ) : selectedDateActivities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-white/70 p-8 text-center">
                    <CalendarIcon className="mb-2 h-7 w-7 text-neutral-300" />
                    <p className="text-xs font-bold text-neutral-700">
                      {emptyTitle}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {emptyDescription}
                    </p>
                  </div>
                ) : (
                  selectedDateActivities.map((activity) => {
                    const token =
                      tokens.find(
                        (entry) =>
                          entry.key === statusOf(activity, statusTheme)
                      ) ?? tokens[0]
                    const Icon = token.icon

                    return (
                      <div
                        key={activity.id}
                        className="group relative flex flex-col rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xs transition-all hover:border-neutral-300 hover:shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            className={cn(
                              token.badge,
                              "text-[11px] font-bold"
                            )}
                          >
                            <Icon
                              className={cn("mr-1 h-3 w-3", token.badgeIcon)}
                            />
                            {token.label}
                          </Badge>

                          <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700 uppercase">
                            {activity.departmentCode ||
                              activity.department ||
                              "General"}
                          </span>
                        </div>

                        <h5 className="mt-2 text-sm font-bold leading-snug text-neutral-900 transition-colors group-hover:text-[#8B0000]">
                          {activity.title}
                        </h5>
                        <p className="text-xs text-neutral-600">{activity.org}</p>

                        <div className="mt-2.5 flex flex-col gap-1 border-t border-neutral-100 pt-2 text-[11px] text-neutral-500">
                          {activity.venue && activity.venue !== "—" && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 shrink-0 text-neutral-400" />
                              <span className="truncate">{activity.venue}</span>
                            </div>
                          )}

                          {activity.time && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 shrink-0 text-neutral-400" />
                              <span>{activity.time}</span>
                            </div>
                          )}

                          {activity.representative &&
                            activity.representative !== "—" && (
                              <div className="flex items-center gap-1.5">
                                <User className="h-3 w-3 shrink-0 text-neutral-400" />
                                <span className="truncate">
                                  {activity.representative}
                                </span>
                              </div>
                            )}
                        </div>

                        <div className="mt-3 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs font-semibold text-neutral-800 hover:bg-neutral-100 hover:text-neutral-900"
                            onClick={() => onSelect(activity)}
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            {selectLabel}
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
