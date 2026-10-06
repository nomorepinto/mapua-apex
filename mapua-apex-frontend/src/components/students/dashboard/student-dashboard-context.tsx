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
  remindersLoading: boolean
  remindersExpanded: boolean
  trackerOpen: boolean
  selectedKeys: { eventId: string; submissionId: string } | null
  selectedNotice: ReviewNotice | null
}

interface StudentDashboardActions {
  setSearch: (value: string) => void
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

  const filteredSubmissions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return submissions
    }
    return submissions.filter((row) => {
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
      return haystack.includes(query)
    })
  }, [search, submissions])

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
      remindersLoading: deadlinesQuery.isLoading || reviewNoticesQuery.isLoading,
      remindersExpanded,
      trackerOpen,
      selectedKeys,
      selectedNotice,
    },
    actions: {
      setSearch,
      openTracker: (eventId, submissionId) => {
        setSelectedKeys({ eventId, submissionId })
        setTrackerOpen(true)
      },
      closeTracker: () => {
        setTrackerOpen(false)
        setSelectedKeys(null)
      },
      toggleReminders: () => setRemindersExpanded((current) => !current),
      dismissReminder: (id) =>
        setDismissedReminderIds((prev) => [...prev, id]),
      selectNotice: setSelectedNotice,
      closeNotice: () => setSelectedNotice(null),
    },
  }

  return (
    <StudentDashboardContext value={value}>{children}</StudentDashboardContext>
  )
}
