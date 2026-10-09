import { useCallback, useMemo, useState } from "react"

import type { Activity } from "@/components/ui/activity.types"

/**
 * Columns on the signatory dashboard tables that expose a value-filter dropdown.
 * Both the "For Review" queue and the submission history table share this set;
 * only the field feeding the trailing status column differs (see statusField).
 */
export type ActivityFilterColumn =
  | "organization"
  | "type"
  | "department"
  | "status"

export type ActivityColumnFilters = Record<ActivityFilterColumn, string[]>

export type ActivitySortDirection = "asc" | "desc" | null

/**
 * Which field backs the "status" filter/sort column. The review queue displays
 * the actionable `decision` (Review/Return/Reject); the history table displays
 * the processed `status` (Accepted/Returned/Rejected/…).
 */
export type ActivityStatusField = "decision" | "status"

const EMPTY_COLUMN_FILTERS: ActivityColumnFilters = {
  organization: [],
  type: [],
  department: [],
  status: [],
}

export interface ActivityTableFilters {
  /** Current all-columns search query. */
  search: string
  setSearch: (value: string) => void
  /** Selected values per filterable column (empty array = not filtered). */
  columnFilters: ActivityColumnFilters
  /** Distinct values per filterable column, derived from the full row set. */
  filterOptions: Record<ActivityFilterColumn, string[]>
  toggleColumnFilter: (column: ActivityFilterColumn, value: string) => void
  clearColumnFilter: (column: ActivityFilterColumn) => void
  /** Chronological direction for the submitted/date column. */
  sortDirection: ActivitySortDirection
  toggleSort: () => void
  /** Rows after search + column filters + date sort, ready to render. */
  rows: Activity[]
}

/**
 * Self-contained filter/search/sort controller for a signatory dashboard table.
 * Each table calls it with its own activity list, so the queue and history stay
 * independently searchable. Search is a case-insensitive match over every
 * visible column; column filters combine as OR within a column and AND across
 * columns; the submitted timestamp drives chronological sorting when active.
 */
export function useActivityTableFilters(
  activities: Activity[],
  statusField: ActivityStatusField = "status"
): ActivityTableFilters {
  const [search, setSearch] = useState("")
  const [columnFilters, setColumnFilters] =
    useState<ActivityColumnFilters>(EMPTY_COLUMN_FILTERS)
  const [sortDirection, setSortDirection] = useState<ActivitySortDirection>(null)

  const statusValue = useCallback(
    (activity: Activity): string =>
      statusField === "decision" ? activity.decision : (activity.status ?? ""),
    [statusField]
  )

  const columnValue = useCallback(
    (activity: Activity, column: ActivityFilterColumn): string => {
      switch (column) {
        case "organization":
          return activity.org
        case "type":
          return activity.type
        case "department":
          return activity.departmentCode
        case "status":
          return statusValue(activity)
        default:
          return ""
      }
    },
    [statusValue]
  )

  const filterOptions = useMemo(() => {
    const collect = (column: ActivityFilterColumn) =>
      Array.from(new Set(activities.map((activity) => columnValue(activity, column))))
        .filter((value) => value !== "")
        .sort((a, b) => a.localeCompare(b))
    return {
      organization: collect("organization"),
      type: collect("type"),
      department: collect("department"),
      status: collect("status"),
    }
  }, [activities, columnValue])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const columns = Object.keys(columnFilters) as ActivityFilterColumn[]
    const matched = activities.filter((activity) => {
      if (query) {
        const haystack = [
          activity.org,
          activity.departmentCode,
          activity.department,
          activity.title,
          activity.submittedDate,
          activity.type,
          statusValue(activity),
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return columns.every((column) => {
        const selected = columnFilters[column]
        return selected.length === 0 || selected.includes(columnValue(activity, column))
      })
    })
    if (!sortDirection) return matched
    const sorted = [...matched].sort(
      (a, b) => (Date.parse(a.submittedAt) || 0) - (Date.parse(b.submittedAt) || 0)
    )
    return sortDirection === "desc" ? sorted.reverse() : sorted
  }, [activities, columnFilters, columnValue, search, sortDirection, statusValue])

  const toggleColumnFilter = useCallback(
    (column: ActivityFilterColumn, value: string) => {
      setColumnFilters((prev) => {
        const current = prev[column]
        const next = current.includes(value)
          ? current.filter((entry) => entry !== value)
          : [...current, value]
        return { ...prev, [column]: next }
      })
    },
    []
  )

  const clearColumnFilter = useCallback((column: ActivityFilterColumn) => {
    setColumnFilters((prev) => ({ ...prev, [column]: [] }))
  }, [])

  const toggleSort = useCallback(() => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
  }, [])

  return {
    search,
    setSearch,
    columnFilters,
    filterOptions,
    toggleColumnFilter,
    clearColumnFilter,
    sortDirection,
    toggleSort,
    rows,
  }
}
