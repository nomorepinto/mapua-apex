import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiClient } from "@/lib/api-client"
import type { ApiBooking, CreateBookingPayload } from "@/lib/types"
import {
  invalidateAvailabilityAndBookings,
  RESERVATION_KEYS,
} from "@/hooks/reservation-keys"
import type { AvailabilityWindow } from "@/hooks/use-availability"

function bookingsPath(campusId: string, reservableId: string): string {
  return `/admins/campuses/${campusId}/reservables/${reservableId}/bookings`
}

/**
 * List a reservable's bookings over a date window for the cdm View/Reserve
 * calendar. Includes both `source:"cdm"` manual holds (releasable here) and
 * `source:"submission"` holds (read-only, labelled with the owning org).
 */
export function useReservableBookingsQuery(
  campusId?: string | null,
  reservableId?: string | null,
  window?: AvailabilityWindow
) {
  return useQuery({
    queryKey: RESERVATION_KEYS.bookings(
      campusId ?? "",
      reservableId ?? "",
      window?.start ?? "",
      window?.end ?? ""
    ),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiBooking[] }>(
        bookingsPath(campusId!, reservableId!),
        {
          params: {
            start: window?.start || undefined,
            end: window?.end || undefined,
          },
        }
      )
      return res.data || []
    },
    enabled: Boolean(campusId && reservableId),
  })
}

/**
 * Create a manual (`source:"cdm"`) booking that invalidates slots for org
 * submitters exactly like a submission-created hold. On a 409 conflict the API
 * message ("slot just taken") surfaces via the caller's toast; the selection is
 * left intact so CDM can pick another time.
 */
export function useCreateBookingMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      campusId,
      reservableId,
      ...payload
    }: CreateBookingPayload & { campusId: string; reservableId: string }) => {
      const res = await apiClient.post<{ data: ApiBooking }>(
        bookingsPath(campusId, reservableId),
        payload
      )
      return res.data
    },
    onSuccess: () => {
      invalidateAvailabilityAndBookings(queryClient)
    },
  })
}

/**
 * Release a manual (`source:"cdm"`) booking. The API refuses (409) to delete a
 * `source:"submission"` hold, which is released only via deny/return/re-edit.
 */
export function useDeleteBookingMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      campusId,
      reservableId,
      bookingId,
    }: {
      campusId: string
      reservableId: string
      bookingId: string
    }) => {
      await apiClient.delete(`${bookingsPath(campusId, reservableId)}/${bookingId}`)
    },
    onSuccess: () => {
      invalidateAvailabilityAndBookings(queryClient)
    },
  })
}
