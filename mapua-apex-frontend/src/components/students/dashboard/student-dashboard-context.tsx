/* eslint-disable react-refresh/only-export-components */
import { createContext, useMemo, useState, type ReactNode } from "react"
import { use } from "react"

import {
  useCurrentOrganizationQuery,
  useOrgAnnouncementsQuery,
  useOrgDeadlinesQuery,
  useOrgReviewNoticesQuery,
  useOrgSubmissionsQuery,
} from "@/hooks/use-submissions"
import {
  apiDeadlinesToReminders,
  apiSubmissionToDashboardRow,
  formatDocumentId,
  type ApiAnnouncement,
  type DashboardSubmissionRow,
  type DeadlineReminder,
  type ReviewNotice,
} from "@/lib/dynamodb-adapters"

interface StudentDashboardState {
  organizationName: string
  submissions: DashboardSubmissionRow[]
  /** Submissions filtered by the table search box across all visible columns. */
  filteredSubmissions: DashboardSubmissionRow[]
  search: string
  /** Per-column value filters; an empty list means the column is not filtered. */
  columnFilters: ColumnFilters
  /** Distinct selectable values per filterable column (collab categories are fixed). */
  filterOptions: ColumnFilters
  /** Sort direction of the DATE APPLIED column; null keeps the default order. */
  dateSortDirection: DateSortDirection
  submissionsLoading: boolean
  submissionsError: boolean
  announcements: ApiAnnouncement[]
  announcementsLoading: boolean
  announcementsError: boolean
  reminders: DeadlineReminder[]
  importantReminders: DeadlineReminder[]
  upcomingReminders: DeadlineReminder[]
  reviewNotices: ReviewNotice[]
  deniedNotices: ReviewNotice[]
  returnedNotices: ReviewNotice[]
  approvedNotices: ReviewNotice[]
  remindersLoading: boolean
  remindersExpanded: boolean
  trackerOpen: boolean
  selectedKeys: { eventId: string; submissionId: string } | null
  selectedNotice: ReviewNotice | null
}

interface StudentDashboardActions {
  setSearch: (value: string) => void
  toggleColumnFilter: (column: FilterColumn, value: string) => void
  clearColumnFilter: (column: FilterColumn) => void
  toggleDateSort: () => void
  openTracker: (eventId: string, submissionId: string) => void
  closeTracker: () => void
  toggleReminders: () => void
  dismissReminder: (id: string) => void
  selectNotice: (notice: ReviewNotice) => void
  closeNotice: () => void
}

interface StudentDashboardContextValue {
  state: StudentDashboardState
  actions: StudentDashboardActions
}

const StudentDashboardContext =
  createContext<StudentDashboardContextValue | null>(null)

/** Columns of the submissions table that expose a value-filter dropdown. */
export type FilterColumn =
  | "collab"
  | "venue"
  | "classification"
  | "signatory"
  | "status"

/** Selected values per filterable column; an empty list means "no filter". */
export type ColumnFilters = Record<FilterColumn, string[]>

/** Sort direction of the sortable DATE APPLIED column; null = default order. */
export type DateSortDirection = "asc" | "desc" | null

/** Collaboration categories for the EVENT TITLE filter, matching CollabBadge. */
const COLLAB_PROPONENT = "Collab · Proponent"
const COLLAB_DEPENDENT = "Collab · Dependent"
const COLLAB_NONE = "Non-collab"
const COLLAB_OPTIONS = [COLLAB_PROPONENT, COLLAB_DEPENDENT, COLLAB_NONE]

const EMPTY_COLUMN_FILTERS: ColumnFilters = {
  collab: [],
  venue: [],
  classification: [],
  signatory: [],
  status: [],
}

/** The row value a given filterable column filters and lists options against. */
function columnValue(
  row: DashboardSubmissionRow,
  column: FilterColumn
): string {
  switch (column) {
    case "collab":
      if (!row.is_collaboration) return COLLAB_NONE
      return row.role === "dependent" ? COLLAB_DEPENDENT : COLLAB_PROPONENT
    case "venue":
      return row.activity_details.venue
    case "classification":
      return row.activity_classification
    case "signatory":
      return row.current_signatory
    case "status":
      return row.status
    default:
      return ""
  }
}

export function useStudentDashboard() {
  const value = use(StudentDashboardContext)
  if (!value) {
    throw new Error(
      "useStudentDashboard must be used within StudentDashboardProvider"
    )
  }
  return value
}

export function StudentDashboardProvider({ children }: { children: ReactNode }) {
  const [trackerOpen, setTrackerOpen] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<{
    eventId: string
    submissionId: string
  } | null>(null)
  const [remindersExpanded, setRemindersExpanded] = useState(true)
  const [search, setSearch] = useState("")
  const [columnFilters, setColumnFilters] =
    useState<ColumnFilters>(EMPTY_COLUMN_FILTERS)
  const [dateSortDirection, setDateSortDirection] =
    useState<DateSortDirection>(null)
  const [dismissedReminderIds, setDismissedReminderIds] = useState<string[]>([])
  const [selectedNotice, setSelectedNotice] = useState<ReviewNotice | null>(null)

  const organizationQuery = useCurrentOrganizationQuery()
  const submissionsQuery = useOrgSubmissionsQuery()
  const announcementsQuery = useOrgAnnouncementsQuery()
  const deadlinesQuery = useOrgDeadlinesQuery()

  const submissions = useMemo(() => {
    const raw = (submissionsQuery.data || []).map((sub) =>
      apiSubmissionToDashboardRow(sub, organizationQuery.data?.signatories)
    )
    const seen = new Set<string>()
    return raw.filter((row) => {
      const key = `${row.event_id}:${row.submission_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [submissionsQuery.data, organizationQuery.data?.signatories])

  const filterOptions = useMemo(() => {
    const collect = (column: FilterColumn) =>
      Array.from(new Set(submissions.map((row) => columnValue(row, column)))).sort(
        (a, b) => a.localeCompare(b)
      )
    return {
      collab: COLLAB_OPTIONS,
      venue: collect("venue"),
      classification: collect("classification"),
      signatory: collect("signatory"),
      status: collect("status"),
    }
  }, [submissions])

  const filteredSubmissions = useMemo(() => {
    const query = search.trim().toLowerCase()
    const columns = Object.keys(columnFilters) as FilterColumn[]
    const rows = submissions.filter((row) => {
      if (query) {
        const haystack = [
          formatDocumentId(row.submission_id),
          row.submission_id,
          row.activity_details.title,
          row.activity_details.venue,
          row.activity_classification,
          row.current_signatory,
          row.submitted_date,
          row.status,
          row.nature ?? "",
          row.organization_name,
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return columns.every((column) => {
        const selected = columnFilters[column]
        return (
          selected.length === 0 || selected.includes(columnValue(row, column))
        )
      })
    })
    if (!dateSortDirection) {
      return rows
    }
    const sorted = [...rows].sort(
      (a, b) => (Date.parse(a.sent_at) || 0) - (Date.parse(b.sent_at) || 0)
    )
    return dateSortDirection === "desc" ? sorted.reverse() : sorted
  }, [columnFilters, dateSortDirection, search, submissions])

  const announcements = announcementsQuery.data || []
  const reviewNoticesQuery = useOrgReviewNoticesQuery(
    submissionsQuery.data || [],
    organizationQuery.data?.signatories
  )
  const reviewNotices = reviewNoticesQuery.notices
  const deniedNotices = reviewNotices.filter(
    (notice) => notice.notifType === "denied"
  )
  const returnedNotices = reviewNotices.filter(
    (notice) => notice.notifType === "returned"
  )
  const approvedNotices = reviewNotices.filter(
    (notice) =>
      notice.notifType === "approved" || notice.notifType === "fully approved"
  )

  const reminders = useMemo(() => {
    const items = apiDeadlinesToReminders(
      deadlinesQuery.data || [],
      submissionsQuery.data || []
    )
    return items.filter((item) => !dismissedReminderIds.includes(item.id))
  }, [deadlinesQuery.data, dismissedReminderIds, submissionsQuery.data])

  const value: StudentDashboardContextValue = {
    state: {
      organizationName: organizationQuery.data?.name || "Organization",
      submissions,
      filteredSubmissions,
      search,
      columnFilters,
      filterOptions,
      dateSortDirection,
      submissionsLoading: submissionsQuery.isLoading,
      submissionsError: submissionsQuery.isError,
      announcements,
      announcementsLoading: announcementsQuery.isLoading,
      announcementsError: announcementsQuery.isError,
      reminders,
      importantReminders: reminders.filter((item) => item.section === "Important"),
      upcomingReminders: reminders.filter((item) => item.section === "Upcoming"),
      reviewNotices,
      deniedNotices,
      returnedNotices,
      approvedNotices,
      remindersLoading: deadlinesQuery.isLoading || reviewNoticesQuery.isLoading,
      remindersExpanded,
      trackerOpen,
      selectedKeys,
      selectedNotice,
    },
    actions: {
      setSearch,
      toggleColumnFilter: (column, value) =>
        setColumnFilters((prev) => {
          const current = prev[column]
          const next = current.includes(value)
            ? current.filter((item) => item !== value)
            : [...current, value]
          return { ...prev, [column]: next }
        }),
      clearColumnFilter: (column) =>
        setColumnFilters((prev) => ({ ...prev, [column]: [] })),
      toggleDateSort: () =>
        setDateSortDirection((prev) => (prev === "asc" ? "desc" : "asc")),
      openTracker: (eventId, submissionId) => {
        setSelectedKeys({ eventId, submissionId })
        setTrackerOpen(true)
      },
      closeTracker: () => {
        setTrackerOpen(false)
        setSelectedKeys(null)
      },
      toggleReminders: () => setRemindersExpanded((current) => !current),
      dismissReminder: (id) => setDismissedReminderIds((prev) => [...prev, id]),
      selectNotice: setSelectedNotice,
      closeNotice: () => setSelectedNotice(null),
    },
  }

  return (
    <StudentDashboardContext value={value}>{children}</StudentDashboardContext>
  )
}
