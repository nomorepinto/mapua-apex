import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import {
  type ApiEligiblePostEvalEvent,
  type ApiPostEval,
  type ApiPostEvalParticipation,
} from "@/lib/dynamodb-adapters"

/**
 * Query keys for the post-evaluation flows. The admin list is parameterized
 * (status/org filters), so invalidation uses the bare `["admin-postevals"]`
 * prefix to catch every filtered variant.
 */
export const POSTEVAL_KEYS = {
  all: ["org-postevals"] as const,
  eligibleEvents: ["org-posteval-eligible-events"] as const,
  detail: (eventId: string, postevalId: string) =>
    ["posteval-detail", eventId, postevalId] as const,
  participants: (eventId: string) => ["posteval-participants", eventId] as const,
  adminAll: (params?: Record<string, string | undefined>) =>
    ["admin-postevals", params] as const,
  adminDetail: (eventId: string, postevalId: string) =>
    ["admin-posteval-detail", eventId, postevalId] as const,
}

/**
 * Step-1 picker: the org's passed, still-in-window events with no active
 * post-eval. Backs the dropdown on `/students/postevals`.
 */
export function useEligiblePostEvalEventsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: POSTEVAL_KEYS.eligibleEvents,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiEligiblePostEvalEvent[] }>(
        "/students/postevals/events"
      )
      return res.data || []
    },
    enabled: options?.enabled ?? true,
  })
}

/**
 * Every post-eval the logged-in submitter's organization has filed.
 * Backs the student dashboard table.
 */
export function useOrgPostEvalsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: POSTEVAL_KEYS.all,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiPostEval[] }>("/students/postevals")
      return res.data || []
    },
    enabled: options?.enabled ?? true,
  })
}

/**
 * A single filed post-eval plus a live re-aggregation of the event's
 * attendance/evaluations (student detail dialog).
 */
export function usePostEvalDetailQuery(eventId?: string, postevalId?: string) {
  return useQuery({
    queryKey: POSTEVAL_KEYS.detail(eventId || "", postevalId || ""),
    queryFn: async () => {
      if (!eventId || !postevalId) throw new Error("Event ID and Post-eval ID required")
      const res = await apiClient.get<{ data: ApiPostEval }>(
        `/students/events/${eventId}/postevals/${postevalId}`
      )
      return res.data
    },
    enabled: Boolean(eventId && postevalId),
  })
}

/**
 * Wizard Section 3 preview: live attendance + evaluation aggregation for an
 * event the org owns, before any post-eval exists.
 */
export function useEventParticipantsQuery(eventId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: POSTEVAL_KEYS.participants(eventId || ""),
    queryFn: async () => {
      if (!eventId) throw new Error("Event ID required")
      const res = await apiClient.get<{ data: ApiPostEvalParticipation }>(
        `/students/events/${eventId}/participants`
      )
      return res.data
    },
    enabled: Boolean(eventId) && (options?.enabled ?? true),
  })
}

/**
 * OSAAR cross-organization post-eval queue with optional status/org filters.
 */
export function useOsaarPostEvalsQuery(params?: {
  status?: "submitted" | "approved" | "denied"
  organization_id?: string
}) {
  return useQuery({
    queryKey: POSTEVAL_KEYS.adminAll(params),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiPostEval[] }>("/admins/postevals", {
        params,
      })
      return res.data || []
    },
  })
}

/**
 * A single post-eval for the OSAAR detail modal.
 */
export function useOsaarPostEvalDetailQuery(eventId?: string, postevalId?: string) {
  return useQuery({
    queryKey: POSTEVAL_KEYS.adminDetail(eventId || "", postevalId || ""),
    queryFn: async () => {
      if (!eventId || !postevalId) throw new Error("Event ID and Post-eval ID required")
      const res = await apiClient.get<{ data: ApiPostEval }>(
        `/admins/postevals/${eventId}/${postevalId}`
      )
      return res.data
    },
    enabled: Boolean(eventId && postevalId),
  })
}

/**
 * OSAAR approve: transitions the post-eval to `approved` and the linked
 * submission `approved → finished`, so the admin submission views refresh too.
 */
export function useApprovePostEvalMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ eventId, postevalId }: { eventId: string; postevalId: string }) => {
      const res = await apiClient.post<{ data: ApiPostEval }>(
        `/admins/postevals/${eventId}/${postevalId}/approve`
      )
      return res.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-postevals"] })
      queryClient.invalidateQueries({
        queryKey: POSTEVAL_KEYS.adminDetail(variables.eventId, variables.postevalId),
      })
      // The linked submission became `finished`.
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] })
    },
  })
}

/**
 * OSAAR deny: transitions the post-eval to `denied`; the linked submission
 * stays `approved`, so only the post-eval queue/detail refresh.
 */
export function useDenyPostEvalMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ eventId, postevalId }: { eventId: string; postevalId: string }) => {
      const res = await apiClient.post<{ data: ApiPostEval }>(
        `/admins/postevals/${eventId}/${postevalId}/deny`
      )
      return res.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-postevals"] })
      queryClient.invalidateQueries({
        queryKey: POSTEVAL_KEYS.adminDetail(variables.eventId, variables.postevalId),
      })
    },
  })
}
