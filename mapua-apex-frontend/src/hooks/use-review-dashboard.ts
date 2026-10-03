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
  useSignatoryQueueQuery,
  useSignatorySubmissionDetailQuery,
  useUpdateEventClassificationMutation,
} from "@/hooks/use-signatory"
import { apiSubmissionToActivity } from "@/lib/dynamodb-adapters"

export function useReviewDashboard() {
  const auth = useAuth()
  const groups = (auth.user?.profile["cognito:groups"] as string[]) || []
  const meQuery = useCurrentSignatoryQuery()
  const role = meQuery.data?.role || roleFromCognitoGroups(groups)
  const roleLabel = role ? signatoryRoleLabel(role) : "Signatory"
  const isOsaar = role?.toLowerCase() === "osaar"
  const queueQuery = useSignatoryQueueQuery()
  const approveMutation = useApproveSubmissionMutation()
  const returnMutation = useReturnSubmissionMutation()
  const denyMutation = useDenySubmissionMutation()
  const updateClassificationMutation = useUpdateEventClassificationMutation()

  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
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

  const filteredActivities =
    !selectedDept && !selectedOrg
      ? activitiesList
      : activitiesList.filter((activity) => {
          const deptMatch = !selectedDept || activity.department === selectedDept
          const orgMatch = !selectedOrg || activity.org === selectedOrg
          return deptMatch && orgMatch
        })

  return {
    roleLabel,
    isOsaar,
    stats,
    departments,
    departmentOrgMap,
    selectedDept,
    selectedOrg,
    activeActivity,
    filteredActivities,
    hasActivities: activitiesList.length > 0,
    isLoading: queueQuery.isLoading,
    isActing:
      approveMutation.isPending || returnMutation.isPending || denyMutation.isPending,
    isUpdatingClassification: updateClassificationMutation.isPending,
    actionError,
    handleDeptSelect,
    handleOrgSelect,
    handleActivitySelect,
    handleModalClose,
    handleModalAction,
    handleClassificationChange,
  }
}
