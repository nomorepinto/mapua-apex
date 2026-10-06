import { useCallback, useMemo, useState } from "react"
import { useAuth } from "react-oidc-context"

import {
  buildDepartmentOrgMap,
  computeReviewStats,
} from "@/components/ui/activity.data"
import type { Activity } from "@/components/ui/activity.types"
import {
  roleFromCognitoGroups,
  signatoryRoleLabel,
} from "@/components/admin-osa/signatory-roles"
import {
  useApproveSubmissionMutation,
  useCurrentSignatoryQuery,
  useDenySubmissionMutation,
  useReturnSubmissionMutation,
  useSignatoryHistoryQuery,
  useSignatoryQueueQuery,
  useSignatorySubmissionDetailQuery,
  useUpdateEventClassificationMutation,
} from "@/hooks/use-signatory"
import { apiSubmissionToActivity, formatDocumentId } from "@/lib/dynamodb-adapters"

export function useReviewDashboard() {
  const auth = useAuth()
  const groups = (auth.user?.profile["cognito:groups"] as string[]) || []
  const meQuery = useCurrentSignatoryQuery()
  const role = meQuery.data?.role || roleFromCognitoGroups(groups)
  const roleLabel = role ? signatoryRoleLabel(role) : "Signatory"
  const isOsaar = role?.toLowerCase() === "osaar"
  const isCdm = role?.toLowerCase() === "cdm"
  const isAdviser = role?.toLowerCase() === "adviser"
  const isDean = role?.toLowerCase() === "dean"
  /** Roles that see the full system-wide picture on their desk */
  const isCampusDesk = isOsaar || isCdm
  const queueQuery = useSignatoryQueueQuery()
  const historyQuery = useSignatoryHistoryQuery()
  const approveMutation = useApproveSubmissionMutation()
  const returnMutation = useReturnSubmissionMutation()
  const denyMutation = useDenySubmissionMutation()
  const updateClassificationMutation = useUpdateEventClassificationMutation()

  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [activeKeys, setActiveKeys] = useState<{
    eventId: string
    submissionId: string
  } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const detailQuery = useSignatorySubmissionDetailQuery(
    activeKeys?.eventId,
    activeKeys?.submissionId
  )

  const activitiesList = useMemo(
    () => (queueQuery.data || []).map(apiSubmissionToActivity),
    [queueQuery.data]
  )

  const historyActivitiesList = useMemo(
    () => (historyQuery.data || []).map(apiSubmissionToActivity),
    [historyQuery.data]
  )

  const activeActivity = useMemo(() => {
    if (detailQuery.data) return apiSubmissionToActivity(detailQuery.data)
    if (!activeKeys) return null
    return (
      activitiesList.find(
        (activity) =>
          activity.eventId === activeKeys.eventId &&
          activity.submissionId === activeKeys.submissionId
      ) || null
    )
  }, [activeKeys, activitiesList, detailQuery.data])

  const handleDeptSelect = useCallback((dept: string | null) => {
    setSelectedDept(dept)
    setSelectedOrg(null)
  }, [])

  const handleOrgSelect = useCallback((org: string | null) => {
    setSelectedOrg(org)
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
  }, [])

  const handleActivitySelect = useCallback((activity: Activity) => {
    setActionError(null)
    setActiveKeys({
      eventId: activity.eventId,
      submissionId: activity.submissionId,
    })
  }, [])

  const handleModalClose = useCallback(() => {
    setActiveKeys(null)
    setActionError(null)
  }, [])

  const handleModalAction = useCallback(
    async (
      action: "approve" | "return" | "reject" | "defer",
      _activityId: string,
      details?: { comment: string }
    ) => {
      if (!activeKeys) return
      if (action === "defer") {
        handleModalClose()
        return
      }

      setActionError(null)
      try {
        if (action === "approve") {
          await approveMutation.mutateAsync(activeKeys)
        } else {
          const comment = details?.comment?.trim() ?? ""
          if (!comment) {
            setActionError(
              action === "reject"
                ? "A rejection comment is required."
                : "A return comment is required."
            )
            return
          }
          if (action === "reject") {
            await denyMutation.mutateAsync({ ...activeKeys, comment })
          } else {
            await returnMutation.mutateAsync({ ...activeKeys, comment })
          }
        }
        handleModalClose()
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Could not update this submission."
        )
        throw error
      }
    },
    [activeKeys, approveMutation, denyMutation, handleModalClose, returnMutation]
  )

  const handleClassificationChange = useCallback(
    async (nature: "major" | "minor") => {
      if (!activeKeys) return
      if (activeActivity?.nature?.toLowerCase() === nature.toLowerCase()) return
      setActionError(null)
      try {
        await updateClassificationMutation.mutateAsync({
          eventId: activeKeys.eventId,
          submissionId: activeKeys.submissionId,
          nature,
        })
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Could not update event classification."
        )
      }
    },
    [activeActivity?.nature, activeKeys, updateClassificationMutation]
  )

  const stats = useMemo(() => computeReviewStats(activitiesList), [activitiesList])
  const departmentOrgMap = useMemo(
    () => buildDepartmentOrgMap(activitiesList),
    [activitiesList]
  )
  const departments = useMemo(
    () => Object.keys(departmentOrgMap),
    [departmentOrgMap]
  )

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase()
    return activitiesList.filter((activity) => {
      const deptMatch = !selectedDept || activity.department === selectedDept
      const orgMatch = !selectedOrg || activity.org === selectedOrg
      if (!deptMatch || !orgMatch) return false
      if (!query) return true
      const haystack = [
        activity.org,
        activity.title,
        activity.submittedDate,
        activity.type,
        activity.nature ?? "",
        activity.decision,
        activity.department,
        activity.submissionId,
        formatDocumentId(activity.submissionId),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [activitiesList, search, selectedDept, selectedOrg])

  /**
   * "For Review" bucket — submissions still sitting on this signatory's desk.
   * pending = never touched yet; returned = sent back for revision (still here).
   */
  const reviewActivities = filteredActivities.filter(
    (a) => a.status === "Review" || a.status === "Returned"
  )

  /**
   * "History" bucket — sourced from the dedicated /submissions/history endpoint
   * which returns every submission this signatory has already processed.
   */
  const historyActivities = historyActivitiesList

  /**
   * History submissions (not in the active "For Review" queue on this desk)
   * are read-only and cannot be approved, returned, denied, or reclassified.
   */
  const isReadOnly = useMemo(() => {
    if (!activeKeys) return false
    return !reviewActivities.some(
      (a) =>
        a.eventId === activeKeys.eventId &&
        a.submissionId === activeKeys.submissionId
    )
  }, [activeKeys, reviewActivities])

  return {
    role,
    roleLabel,
    isOsaar,
    isCdm,
    isAdviser,
    isDean,
    isCampusDesk,
    stats,
    departments,
    departmentOrgMap,
    selectedDept,
    selectedOrg,
    search,
    activeActivity,
    /** All activities after dept/org filter — used to build the review + history split. */
    allActivities: filteredActivities,
    /** Currently on-desk: pending + returned submissions. */
    reviewActivities,
    /** Processed: approved or denied submissions. */
    historyActivities,
    hasActivities: activitiesList.length > 0,
    isLoading: queueQuery.isLoading,
    isHistoryLoading: historyQuery.isLoading,
    isActing:
      approveMutation.isPending || returnMutation.isPending || denyMutation.isPending,
    isUpdatingClassification: updateClassificationMutation.isPending,
    isReadOnly,
    actionError,
    handleDeptSelect,
    handleOrgSelect,
    handleSearchChange,
    handleActivitySelect,
    handleModalClose,
    handleModalAction,
    handleClassificationChange,
  }
}
