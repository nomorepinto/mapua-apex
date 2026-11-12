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
  type ApiSubmission,
  type DashboardSubmissionRow,
} from "@/lib/dynamodb-adapters"

export const ANNOUNCEMENT_MAX = 5000

interface AdminDashboardState {
  submissionsLoading: boolean
  submissionsError: boolean
  announcements: ApiAnnouncement[]
  announcementsLoading: boolean
  announcementsError: boolean
  selectedKeys: { eventId: string; submissionId: string } | null
  selectedSubmission: ApiSubmission | null
  selectedRow: DashboardSubmissionRow | null
  selectedActivity: Activity | null
  /**
   * Every submission in the `Activity` shape, so the Submissions tab can render
   * the same table and calendar components the signatory desks use.
   */
  activities: Activity[]
  /** Papers still moving through the chain (Review + Returned). */
  currentActivities: Activity[]
  /** Papers that reached a final outcome (Accepted / Rejected / Finished / Cancelled). */
  historyActivities: Activity[]
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
  submissionEdit: ApiSubmission | null
}

interface AdminDashboardActions {
  selectSubmission: (eventId: string, submissionId: string) => void
  /** Opens the admin detail dialog for a shared table row or calendar card. */
  selectActivity: (activity: Activity) => void
  closeSubmission: () => void
  openSubmissionEdit: () => void
  closeSubmissionEdit: () => void
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
    throw new Error(
      "useAdminDashboard must be used within AdminDashboardProvider"
    )
  }
  return value
}

export function formatAnnouncementPostedAt(sentAt: string) {
  return formatDisplayDateTime(sentAt)
}

export function AdminDashboardProvider({ children }: { children: ReactNode }) {
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
  const [submissionEdit, setSubmissionEdit] = useState<ApiSubmission | null>(
    null
  )

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
  /** Submissions in the shared `Activity` shape the tables and calendar render. */
  const activities = useMemo(
    () => (submissionsQuery.data ?? []).map(apiSubmissionToActivity),
    [submissionsQuery.data]
  )

  /**
   * Split of `activities` mirroring the review desks: what is still on a desk
   * (pending or returned) versus what has already reached an outcome. Split
   * client-side over the list that is already loaded — no extra request.
   */
  const { currentActivities, historyActivities } = useMemo(() => {
    const current: Activity[] = []
    const history: Activity[] = []
    activities.forEach((activity) => {
      if (activity.status === "Review" || activity.status === "Returned") {
        current.push(activity)
      } else {
        history.push(activity)
      }
    })
    return { currentActivities: current, historyActivities: history }
  }, [activities])

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
      deskTimings: detailQuery.data?.desk_timings,
    }
  )

  function openSubmissionEdit() {
    const submission = detailQuery.data
    if (!submission) return
    if (submission.status !== "pending" && submission.status !== "returned") {
      return
    }
    const named = selectedRow?.organization_name
    setSubmissionEdit({
      ...submission,
      organization_name:
        submission.organization_name || (named && named !== "—" ? named : null),
    })
  }

  function closeSubmissionEdit() {
    setSubmissionEdit(null)
  }

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
        error instanceof Error
          ? error.message
          : "Could not post this announcement."
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
        error instanceof Error
          ? error.message
          : "Could not save this announcement."
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
        error instanceof Error
          ? error.message
          : "Could not delete this announcement."
      )
    }
  }

  const value: AdminDashboardContextValue = {
    state: {
      submissionsLoading: submissionsQuery.isLoading,
      submissionsError: submissionsQuery.isError,
      announcements: announcementsQuery.data || [],
      announcementsLoading: announcementsQuery.isLoading,
      announcementsError: announcementsQuery.isError,
      selectedKeys,
      selectedSubmission: detailQuery.data ?? null,
      selectedRow,
      selectedActivity,
      activities,
      currentActivities,
      historyActivities,
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
      submissionEdit,
    },
    actions: {
      selectSubmission: (eventId, submissionId) =>
        setSelectedKeys({ eventId, submissionId }),
      selectActivity: (activity) =>
        setSelectedKeys({
          eventId: activity.eventId,
          submissionId: activity.submissionId,
        }),
      closeSubmission: () => setSelectedKeys(null),
      openSubmissionEdit,
      closeSubmissionEdit,
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
