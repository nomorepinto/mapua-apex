import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiClient } from "@/lib/api-client"
import type {
  ApiReservationChange,
  ResolveReservationChangePayload,
  StoreReservationChangePayload,
} from "@/lib/types"
import { SUBMISSION_KEYS } from "@/hooks/use-submissions"
import {
  invalidateAvailabilityAndBookings,
  invalidateReservationChanges,
  RESERVATION_KEYS,
} from "@/hooks/reservation-keys"

/** CDM queue filter. `all` (the default) returns every status. */
export type ReservationChangeFilter = "pending" | "all"

function studentChangesPath(eventId: string, submissionId: string): string {
  return `/students/events/${eventId}/submissions/${submissionId}/reservation-changes`
}

/** Singular POST target (create one request) vs the plural GET (history). */
function studentChangePath(eventId: string, submissionId: string): string {
  return `/students/events/${eventId}/submissions/${submissionId}/reservation-change`
}

function adminChangesPath(campusId: string): string {
  return `/admins/campuses/${campusId}/reservation-changes`
}

// ─── Student ─────────────────────────────────────────────────────────────────

/**
 * The change history for one paper (newest first). Drives the reminders-panel
 * "pending CDM" badge: when any row is `pending`, the Request-change button is
 * replaced until CDM resolves it.
 */
export function useReservationChangesQuery(eventId?: string | null, submissionId?: string | null) {
  return useQuery({
    queryKey: RESERVATION_KEYS.studentChanges(eventId ?? "", submissionId ?? ""),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiReservationChange[] }>(
        studentChangesPath(eventId!, submissionId!)
      )
      return res.data || []
    },
    enabled: Boolean(eventId && submissionId),
  })
}

/**
 * Request a cancel/reschedule change on an approved paper. The backend guards
 * the window (status = approved, before end of event day, one pending request);
 * a rejection surfaces via the caller's toast. On success the new "reservation
 * change requested" timeline row and the pending badge both refresh.
 */
export function useStoreReservationChangeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      eventId,
      submissionId,
      ...payload
    }: { eventId: string; submissionId: string } & StoreReservationChangePayload) => {
      const res = await apiClient.post<{ data: ApiReservationChange }>(
        studentChangePath(eventId, submissionId),
        payload
      )
      return res.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: RESERVATION_KEYS.studentChanges(variables.eventId, variables.submissionId),
      })
      // A system notification lands in the paper's timeline.
      queryClient.invalidateQueries({
        queryKey: SUBMISSION_KEYS.notifications(variables.eventId, variables.submissionId),
      })
      queryClient.invalidateQueries({ queryKey: SUBMISSION_KEYS.all })
    },
  })
}

// ─── CDM ─────────────────────────────────────────────────────────────────────

/**
 * The per-campus request queue for the /cdm/reservations master list. Each row
 * carries the denormalized event title + organization name so the list renders
 * without N+1 fetches.
 */
export function useAdminReservationChangesQuery(
  campusId?: string | null,
  status: ReservationChangeFilter = "pending"
) {
  return useQuery({
    queryKey: RESERVATION_KEYS.adminChanges(campusId ?? "", status),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiReservationChange[] }>(
        adminChangesPath(campusId!),
        { params: { status } }
      )
      return res.data || []
    },
    enabled: Boolean(campusId),
  })
}

/**
 * A single request + its submission snapshot for the detail panel.
 */
export function useAdminReservationChangeQuery(campusId?: string | null, changeId?: string | null) {
  return useQuery({
    queryKey: RESERVATION_KEYS.adminChange(campusId ?? "", changeId ?? ""),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiReservationChange }>(
        `${adminChangesPath(campusId!)}/${changeId}`
      )
      return res.data
    },
    enabled: Boolean(campusId && changeId),
  })
}

/**
 * Resolve a pending request (cancel / reschedule / deny). The decision edits the
 * targeted bookings + submission server-side, so on success every cache that
 * could reflect the new holds, availability, or paper status is busted:
 * availability + bookings, the change queue/detail, and the admin submission
 * lists (a cancel flips status to `cancelled`; a reschedule rewrites the venue).
 */
export function useResolveReservationChangeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      campusId,
      changeId,
      ...payload
    }: { campusId: string; changeId: string } & ResolveReservationChangePayload) => {
      const res = await apiClient.post<{ data: ApiReservationChange }>(
        `${adminChangesPath(campusId)}/${changeId}/resolve`,
        payload
      )
      return res.data
    },
    onSuccess: () => {
      invalidateAvailabilityAndBookings(queryClient)
      invalidateReservationChanges(queryClient)
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] })
      queryClient.invalidateQueries({ queryKey: ["admin-submission-detail"] })
    },
  })
}
