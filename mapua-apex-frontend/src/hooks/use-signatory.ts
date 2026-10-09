import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { ApiSubmission, ApiSignatory } from "@/lib/dynamodb-adapters"
import { SUBMISSION_KEYS } from "@/hooks/use-submissions"

export const SIGNATORY_KEYS = {
  me: ["signatory-me"] as const,
  queue: ["signatory-queue"] as const,
  history: ["signatory-history"] as const,
  detail: (eventId: string, submissionId: string) =>
    ["signatory-submission-detail", eventId, submissionId] as const,
}

/**
 * Fetch the signed-in signatory (JWT custom:signatory_id).
 */
export function useCurrentSignatoryQuery() {
  return useQuery({
    queryKey: SIGNATORY_KEYS.me,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiSignatory }>("/signatories/me")
      return res.data
    },
  })
}

/**
 * Fetch submissions currently in this signatory's queue (GSI2), including returned papers.
 */
export function useSignatoryQueueQuery() {
  return useQuery({
    queryKey: SIGNATORY_KEYS.queue,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiSubmission[] }>("/signatories/submissions")
      return res.data || []
    },
  })
}

/**
 * Fetch all submissions that have passed through this signatory's desk
 * (approved, denied — no longer on the active queue).
 */
export function useSignatoryHistoryQuery() {
  return useQuery({
    queryKey: SIGNATORY_KEYS.history,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiSubmission[] }>(
        "/signatories/submissions/history"
      )
      return res.data || []
    },
  })
}

/**
 * Fetch one full SAAF on this signatory's desk
 */
export function useSignatorySubmissionDetailQuery(eventId?: string, submissionId?: string) {
  return useQuery({
    queryKey: SIGNATORY_KEYS.detail(eventId || "", submissionId || ""),
    queryFn: async () => {
      if (!eventId || !submissionId) throw new Error("Event ID and Submission ID required")
      const res = await apiClient.get<{ data: ApiSubmission }>(
        `/signatories/events/${eventId}/submissions/${submissionId}`
      )
      return res.data
    },
    enabled: Boolean(eventId && submissionId),
  })
}

/**
 * Mutation to approve a submission
 */
export function useApproveSubmissionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      eventId,
      submissionId,
    }: {
      eventId: string
      submissionId: string
    }) => {
      const res = await apiClient.post<{ data: { event_id: string; submission_id: string; status: string } }>(
        `/signatories/events/${eventId}/submissions/${submissionId}/approve`
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SIGNATORY_KEYS.queue })
      queryClient.invalidateQueries({ queryKey: SIGNATORY_KEYS.history })
      queryClient.invalidateQueries({ queryKey: SUBMISSION_KEYS.all })
      queryClient.invalidateQueries({ queryKey: ["submission-notifications"] })
    },
  })
}

function commentMutation(path: string) {
  return async ({
    eventId,
    submissionId,
    comment,
  }: {
    eventId: string
    submissionId: string
    comment: string
  }) => {
    const res = await apiClient.post<{ data?: unknown }>(
      `/signatories/events/${eventId}/submissions/${submissionId}/${path}`,
      { comment }
    )
    return res
  }
}

/**
 * Return a submission for revision. It stays on this desk.
 */
export function useReturnSubmissionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: commentMutation("return"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SIGNATORY_KEYS.queue })
      queryClient.invalidateQueries({ queryKey: SIGNATORY_KEYS.history })
      queryClient.invalidateQueries({ queryKey: SUBMISSION_KEYS.all })
      queryClient.invalidateQueries({ queryKey: ["submission-notifications"] })
    },
  })
}

/**
 * Deny a submission. It leaves the desk queue and cannot be edited.
 */
export function useDenySubmissionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: commentMutation("deny"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SIGNATORY_KEYS.queue })
      queryClient.invalidateQueries({ queryKey: SIGNATORY_KEYS.history })
      queryClient.invalidateQueries({ queryKey: SUBMISSION_KEYS.all })
      queryClient.invalidateQueries({ queryKey: ["submission-notifications"] })
    },
  })
}

/**
 * Update event classification (e.g., Major / Minor event nature) by authorized signatories (OSAAR)
 */
export function useUpdateEventClassificationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      eventId,
      submissionId,
      nature,
    }: {
      eventId: string
      submissionId: string
      nature: "major" | "minor"
    }) => {
      const res = await apiClient.patch<{ data: ApiSubmission }>(
        `/signatories/events/${eventId}/submissions/${submissionId}/classification`,
        { nature }
      )
      return res.data
    },
    onSuccess: (data, variables) => {
      if (data) {
        queryClient.setQueryData(
          SIGNATORY_KEYS.detail(variables.eventId, variables.submissionId),
          data
        )
      }
      queryClient.invalidateQueries({ queryKey: SIGNATORY_KEYS.queue })
      queryClient.invalidateQueries({
        queryKey: SIGNATORY_KEYS.detail(variables.eventId, variables.submissionId),
      })
      queryClient.invalidateQueries({ queryKey: SUBMISSION_KEYS.all })
    },
  })
}
