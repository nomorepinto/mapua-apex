import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient, useQueries } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import {
  apiNotificationsToReviewNotices,
  type ApiSubmission,
  type ApiNotification,
  type ApiDeadline,
  type ApiOrganization,
  type ApiAnnouncement,
} from "@/lib/dynamodb-adapters"

export const SUBMISSION_KEYS = {
  all: ["org-submissions"] as const,
  detail: (eventId: string, submissionId: string) =>
    ["submission-detail", eventId, submissionId] as const,
  notifications: (eventId: string, submissionId: string) =>
    ["submission-notifications", eventId, submissionId] as const,
  deadlines: ["org-deadlines"] as const,
  organization: ["org-organization"] as const,
  announcements: ["org-announcements"] as const,
}

/**
 * Fetch all submissions belonging to the logged-in student's organization
 */
export function useOrgSubmissionsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: SUBMISSION_KEYS.all,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiSubmission[] }>("/students/submissions")
      return res.data || []
    },
    enabled: options?.enabled ?? true,
  })
}

/**
 * Fetch a single full SAAF submission
 */
export function useSubmissionDetailQuery(eventId?: string, submissionId?: string) {
  return useQuery({
    queryKey: SUBMISSION_KEYS.detail(eventId || "", submissionId || ""),
    queryFn: async () => {
      if (!eventId || !submissionId) throw new Error("Event ID and Submission ID required")
      const res = await apiClient.get<{ data: ApiSubmission }>(
        `/students/events/${eventId}/submissions/${submissionId}`
      )
      return res.data
    },
    enabled: Boolean(eventId && submissionId),
  })
}

/**
 * Fetch review stepper/notifications for a submission
 */
export function useSubmissionNotificationsQuery(eventId?: string, submissionId?: string) {
  return useQuery({
    queryKey: SUBMISSION_KEYS.notifications(eventId || "", submissionId || ""),
    queryFn: async () => {
      if (!eventId || !submissionId) return []
      const res = await apiClient.get<{ data: ApiNotification[] }>(
        `/students/events/${eventId}/submissions/${submissionId}/notifications`
      )
      return res.data || []
    },
    enabled: Boolean(eventId && submissionId),
  })
}

/**
 * Denied and returned review comments for papers in the org's submission list.
 */
export function useOrgReviewNoticesQuery(
  submissions: ApiSubmission[],
  orgSignatories?: Array<{ role?: string; signatory_id?: string; name?: string }>
) {
  const reviewPapers = useMemo(
    () =>
      submissions.filter(
        (submission) => submission.status === "denied" || submission.status === "returned"
      ),
    [submissions]
  )

  const queries = useQueries({
    queries: reviewPapers.map((submission) => ({
      queryKey: SUBMISSION_KEYS.notifications(submission.event_id, submission.submission_id),
      queryFn: async () => {
        const res = await apiClient.get<{ data: ApiNotification[] }>(
          `/students/events/${submission.event_id}/submissions/${submission.submission_id}/notifications`
        )
        return res.data || []
      },
    })),
  })

  const notices = useMemo(() => {
    const notificationsBySubmission = new Map<string, ApiNotification[]>()
    reviewPapers.forEach((submission, index) => {
      notificationsBySubmission.set(submission.submission_id, queries[index]?.data || [])
    })
    return apiNotificationsToReviewNotices(
      reviewPapers,
      notificationsBySubmission,
      orgSignatories
    )
  }, [orgSignatories, queries, reviewPapers])

  return {
    notices,
    isLoading: queries.some((query) => query.isPending),
  }
}

/**
 * Fetch the logged-in student's organization (JWT custom:organization_id).
 */
export function useCurrentOrganizationQuery() {
  return useQuery({
    queryKey: SUBMISSION_KEYS.organization,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiOrganization }>("/students/organization")
      return res.data
    },
  })
}

/**
 * Fetch upcoming deadlines for the organization
 */
export function useOrgDeadlinesQuery() {
  return useQuery({
    queryKey: SUBMISSION_KEYS.deadlines,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiDeadline[] }>("/students/deadlines")
      return res.data || []
    },
  })
}

/**
 * Fetch official bulletin announcements (global, newest first).
 */
export function useOrgAnnouncementsQuery() {
  return useQuery({
    queryKey: SUBMISSION_KEYS.announcements,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiAnnouncement[] }>("/students/announcements")
      return res.data || []
    },
  })
}

/**
 * Mutation to create a new SAAF submission
 */
export function useCreateSubmissionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: unknown) => {
      const res = await apiClient.post<{ data: ApiSubmission }>(
        "/students/submissions",
        payload
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBMISSION_KEYS.all })
    },
  })
}

/**
 * Mutation to update/resubmit a pending or returned submission
 */
export function useUpdateSubmissionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      eventId,
      submissionId,
      payload,
    }: {
      eventId: string
      submissionId: string
      payload: unknown
    }) => {
      const res = await apiClient.put<{ data: ApiSubmission }>(
        `/students/events/${eventId}/submissions/${submissionId}`,
        payload
      )
      return res.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: SUBMISSION_KEYS.all })
      queryClient.invalidateQueries({
        queryKey: SUBMISSION_KEYS.detail(variables.eventId, variables.submissionId),
      })
      queryClient.invalidateQueries({
        queryKey: SUBMISSION_KEYS.notifications(variables.eventId, variables.submissionId),
      })
    },
  })
}
