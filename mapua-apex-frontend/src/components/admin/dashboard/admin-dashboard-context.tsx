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
import {
  apiNotificationsToStepper,
  apiSubmissionToDashboardRow,
  formatDisplayDateTime,
  submissionOrganizationId,
  type ApiAnnouncement,
  type DashboardSubmissionRow,
} from "@/lib/dynamodb-adapters"

export const ANNOUNCEMENT_MAX = 5000

export const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Under Review" },
  { value: "returned", label: "Returned" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
] as const

export const TYPE_FILTERS = [
  { value: "", label: "All types" },
  { value: "extra-curricular", label: "Extra-curricular" },
  { value: "co-curricular", label: "Co-curricular" },
  { value: "curricular", label: "Curricular" },
] as const

type SubmissionStatus = "" | "pending" | "approved" | "denied" | "returned"

interface AdminDashboardState {
  organizationId: string
  status: SubmissionStatus
  activityType: string
  organizations: { organization_id: string; name: string }[]
  rows: DashboardSubmissionRow[]
  submissionsLoading: boolean
  submissionsError: boolean
  announcements: ApiAnnouncement[]
  announcementsLoading: boolean
  announcementsError: boolean
  selectedKeys: { eventId: string; submissionId: string } | null
  selectedRow: DashboardSubmissionRow | null
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
  setOrganizationId: (value: string) => void
  setStatus: (value: SubmissionStatus) => void
  setActivityType: (value: string) => void
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
  const [organizationId, setOrganizationId] = useState("")
  const [status, setStatus] = useState<SubmissionStatus>("")
  const [activityType, setActivityType] = useState("")
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
  const submissionsQuery = useAdminSubmissionsQuery({
    status: status || undefined,
    activity_type: activityType || undefined,
    organization_id: organizationId || undefined,
  })
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
  const rows = useMemo(() => {
    const selectedOrganization = organizationId.replace(/^ORGANIZATION#/i, "")

    return (submissionsQuery.data || [])
      .filter((submission) => {
        if (!selectedOrganization) return true
        return submissionOrganizationId(submission) === selectedOrganization
      })
      .map((submission) =>
        apiSubmissionToDashboardRow(
          submission,
          signatoriesQuery.data,
          organizations
        )
      )
  }, [organizationId, organizations, signatoriesQuery.data, submissionsQuery.data])

  const selectedRow = detailQuery.data
    ? apiSubmissionToDashboardRow(
        detailQuery.data,
        signatoriesQuery.data,
        organizations
      )
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
      organizationId,
      status,
      activityType,
      organizations,
      rows,
      submissionsLoading: submissionsQuery.isLoading,
      submissionsError: submissionsQuery.isError,
      announcements: announcementsQuery.data || [],
      announcementsLoading: announcementsQuery.isLoading,
      announcementsError: announcementsQuery.isError,
      selectedKeys,
      selectedRow,
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
      setOrganizationId,
      setStatus,
      setActivityType,
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
