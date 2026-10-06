/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { use } from "react"

import { toastManager } from "@/components/ui/toast"
import {
  useAdminAnnouncementsQuery,
  useAdminSubmissionDetailQuery,
  useAdminSubmissionsQuery,
  useCreateAnnouncementMutation,
  useDeleteAnnouncementMutation,
  useOrganizationsQuery,
  useSignatoriesQuery,
  useUpdateAnnouncementMutation,
} from "@/hooks/use-admin"
import type { Activity } from "@/components/ui/activity.types"
import {
  apiNotificationsToStepper,
  apiSubmissionToActivity,
  apiSubmissionToDashboardRow,
  formatDisplayDateTime,
  type ApiAnnouncement,
  type DashboardSubmissionRow,
} from "@/lib/dynamodb-adapters"

export const ANNOUNCEMENT_MAX = 5000

/** Columns of the admin submissions table that expose a value-filter dropdown. */
export type AdminFilterColumn =
  | "organization"
  | "department"
  | "type"
  | "status"

/** Selected values per filterable column; an empty list means "no filter". */
export type AdminColumnFilters = Record<AdminFilterColumn, string[]>

/** Sort direction of the sortable Submitted column; null = default order. */
export type DateSortDirection = "asc" | "desc" | null

const EMPTY_COLUMN_FILTERS: AdminColumnFilters = {
  organization: [],
  department: [],
  type: [],
  status: [],
}

/** The row value a given filterable column filters and lists options against. */
function columnValue(
  row: DashboardSubmissionRow,
  column: AdminFilterColumn
): string {
  switch (column) {
    case "organization":
      return row.organization_name
    case "department":
      return row.department
    case "type":
      return row.activity_classification
    case "status":
      return row.status
    default:
      return ""
  }
}

interface AdminDashboardState {
  rows: DashboardSubmissionRow[]
  /** Rows after the search box, per-column filters, and date sort are applied. */
  filteredRows: DashboardSubmissionRow[]
  search: string
  /** Per-column value filters; an empty list means the column is not filtered. */
  columnFilters: AdminColumnFilters
  /** Distinct selectable values per filterable column, derived from all rows. */
  filterOptions: AdminColumnFilters
  /** Sort direction of the Submitted column; null keeps the default order. */
  dateSortDirection: DateSortDirection
  submissionsLoading: boolean
  submissionsError: boolean
  announcements: ApiAnnouncement[]
  announcementsLoading: boolean
  announcementsError: boolean
  selectedKeys: { eventId: string; submissionId: string } | null
  selectedRow: DashboardSubmissionRow | null
  selectedActivity: Activity | null
  stepper: ReturnType<typeof apiNotificationsToStepper>
  detailLoading: boolean
  detailError: boolean
  createOpen: boolean
  createContent: string
  createError: string
  createPending: boolean
  editing: ApiAnnouncement | null
  editContent: string
  editError: string
  editPending: boolean
  deleteOpen: boolean
  deleteError: string
  deletePending: boolean
}

interface AdminDashboardActions {
  setSearch: (value: string) => void
  toggleColumnFilter: (column: AdminFilterColumn, value: string) => void
  clearColumnFilter: (column: AdminFilterColumn) => void
  toggleDateSort: () => void
  selectSubmission: (eventId: string, submissionId: string) => void
  closeSubmission: () => void
  openCreate: () => void
  setCreateOpen: (open: boolean) => void
  setCreateContent: (value: string) => void
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>
  openEdit: (announcement: ApiAnnouncement) => void
  closeEdit: () => void
  setEditContent: (value: string) => void
  handleEdit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  setDeleteOpen: (open: boolean) => void
  openDelete: () => void
  handleDelete: () => Promise<void>
}

interface AdminDashboardContextValue {
  state: AdminDashboardState
  actions: AdminDashboardActions
}

const AdminDashboardContext = createContext<AdminDashboardContextValue | null>(
  null
)

export function useAdminDashboard() {
  const value = use(AdminDashboardContext)
  if (!value) {
    throw new Error("useAdminDashboard must be used within AdminDashboardProvider")
  }
  return value
}

export function formatAnnouncementPostedAt(sentAt: string) {
  return formatDisplayDateTime(sentAt)
}

export function AdminDashboardProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("")
  const [columnFilters, setColumnFilters] =
    useState<AdminColumnFilters>(EMPTY_COLUMN_FILTERS)
  const [dateSortDirection, setDateSortDirection] =
    useState<DateSortDirection>(null)
  const [selectedKeys, setSelectedKeys] = useState<{
    eventId: string
    submissionId: string
  } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createContent, setCreateContent] = useState("")
  const [createError, setCreateError] = useState("")
  const [editing, setEditing] = useState<ApiAnnouncement | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editError, setEditError] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const signatoriesQuery = useSignatoriesQuery()
  const organizationsQuery = useOrganizationsQuery()
  const submissionsQuery = useAdminSubmissionsQuery()
  const announcementsQuery = useAdminAnnouncementsQuery()
  const detailQuery = useAdminSubmissionDetailQuery(
    selectedKeys?.eventId,
    selectedKeys?.submissionId
  )
  const createAnnouncement = useCreateAnnouncementMutation()
  const updateAnnouncement = useUpdateAnnouncementMutation()
  const deleteAnnouncement = useDeleteAnnouncementMutation()

  const organizations = useMemo(
    () =>
      [...(organizationsQuery.data || [])].sort((left, right) =>
        left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
      ),
    [organizationsQuery.data]
  )
  const rows = useMemo(
    () =>
      (submissionsQuery.data || []).map((submission) =>
        apiSubmissionToDashboardRow(
          submission,
          signatoriesQuery.data,
          organizations
        )
      ),
    [organizations, signatoriesQuery.data, submissionsQuery.data]
  )

  const filterOptions = useMemo(() => {
    const collect = (column: AdminFilterColumn) =>
      Array.from(new Set(rows.map((row) => columnValue(row, column)))).sort(
        (a, b) => a.localeCompare(b)
      )
    return {
      organization: collect("organization"),
      department: collect("department"),
      type: collect("type"),
      status: collect("status"),
    }
  }, [rows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const columns = Object.keys(columnFilters) as AdminFilterColumn[]
    const matched = rows.filter((row) => {
      if (query) {
        const haystack = [
          row.activity_details.title,
          row.organization_name,
          row.department,
          row.activity_classification,
          row.submitted_date,
          row.status,
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
      return matched
    }
    const sorted = [...matched].sort(
      (a, b) => (Date.parse(a.sent_at) || 0) - (Date.parse(b.sent_at) || 0)
    )
    return dateSortDirection === "desc" ? sorted.reverse() : sorted
  }, [columnFilters, dateSortDirection, rows, search])

  const selectedRow = detailQuery.data
    ? apiSubmissionToDashboardRow(
        detailQuery.data,
        signatoriesQuery.data,
        organizations
      )
    : null
  const selectedActivity = detailQuery.data
    ? apiSubmissionToActivity(detailQuery.data)
    : null
  const stepper = apiNotificationsToStepper(
    detailQuery.data?.notifications || [],
    detailQuery.data?.current_signatory,
    detailQuery.data?.status,
    {
      activityType: detailQuery.data?.activity_classification?.activity_type,
      hasVenue: Boolean(detailQuery.data?.venue_reservation?.has_reservation),
      orgSignatories: signatoriesQuery.data,
      signatorySequence: detailQuery.data?.signatory_sequence,
      signatoryChain: detailQuery.data?.signatory_chain,
    }
  )

  function openCreate() {
    setCreateContent("")
    setCreateError("")
    setCreateOpen(true)
  }

  function openEdit(announcement: ApiAnnouncement) {
    setEditing(announcement)
    setEditContent(announcement.content)
    setEditError("")
    setDeleteError("")
  }

  function closeEdit() {
    setEditing(null)
    setEditContent("")
    setEditError("")
    setDeleteOpen(false)
    setDeleteError("")
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = createContent.trim()
    if (!content) {
      setCreateError("Content is required.")
      return
    }

    try {
      await createAnnouncement.mutateAsync(content)
      toastManager.add({
        title: "Announcement posted",
        description: "The notice is now on the bulletin.",
        type: "success",
      })
      setCreateOpen(false)
      setCreateContent("")
      setCreateError("")
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Could not post this announcement."
      )
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const content = editContent.trim()
    if (!content) {
      setEditError("Content is required.")
      return
    }

    try {
      await updateAnnouncement.mutateAsync({ sentAt: editing.sent_at, content })
      toastManager.add({
        title: "Announcement updated",
        description: "The notice content was replaced.",
        type: "success",
      })
      closeEdit()
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Could not save this announcement."
      )
    }
  }

  async function handleDelete() {
    if (!editing) return

    try {
      await deleteAnnouncement.mutateAsync(editing.sent_at)
      toastManager.add({
        title: "Announcement deleted",
        description: "The notice was removed from the bulletin.",
        type: "success",
      })
      closeEdit()
    } catch (error) {
      setDeleteOpen(false)
      setDeleteError(
        error instanceof Error ? error.message : "Could not delete this announcement."
      )
    }
  }

  const value: AdminDashboardContextValue = {
    state: {
      rows,
      filteredRows,
      search,
      columnFilters,
      filterOptions,
      dateSortDirection,
      submissionsLoading: submissionsQuery.isLoading,
      submissionsError: submissionsQuery.isError,
      announcements: announcementsQuery.data || [],
      announcementsLoading: announcementsQuery.isLoading,
      announcementsError: announcementsQuery.isError,
      selectedKeys,
      selectedRow,
      selectedActivity,
      stepper,
      detailLoading: detailQuery.isLoading,
      detailError: detailQuery.isError,
      createOpen,
      createContent,
      createError,
      createPending: createAnnouncement.isPending,
      editing,
      editContent,
      editError,
      editPending: updateAnnouncement.isPending,
      deleteOpen,
      deleteError,
      deletePending: deleteAnnouncement.isPending,
    },
    actions: {
      setSearch,
      toggleColumnFilter: (column, value) =>
        setColumnFilters((prev) => {
          const current = prev[column]
          return {
            ...prev,
            [column]: current.includes(value)
              ? current.filter((item) => item !== value)
              : [...current, value],
          }
        }),
      clearColumnFilter: (column) =>
        setColumnFilters((prev) => ({ ...prev, [column]: [] })),
      toggleDateSort: () =>
        setDateSortDirection((prev) => (prev === "asc" ? "desc" : "asc")),
      selectSubmission: (eventId, submissionId) =>
        setSelectedKeys({ eventId, submissionId }),
      closeSubmission: () => setSelectedKeys(null),
      openCreate,
      setCreateOpen: (open) => {
        setCreateOpen(open)
        if (!open) {
          setCreateContent("")
          setCreateError("")
        }
      },
      setCreateContent: (next) => {
        setCreateContent(next)
        if (createError) setCreateError("")
      },
      handleCreate,
      openEdit,
      closeEdit,
      setEditContent: (next) => {
        setEditContent(next)
        if (editError) setEditError("")
      },
      handleEdit,
      setDeleteOpen: (open) => {
        setDeleteOpen(open)
        if (!open) setDeleteError("")
      },
      openDelete: () => {
        setDeleteError("")
        setDeleteOpen(true)
      },
      handleDelete,
    },
  }

  return <AdminDashboardContext value={value}>{children}</AdminDashboardContext>
}
