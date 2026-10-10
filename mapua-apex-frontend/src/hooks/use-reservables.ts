import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiClient } from "@/lib/api-client"
import type { ApiReservable, CreateReservablePayload } from "@/lib/types"
import { mutationErrorMessage, type BulkCreateResult } from "@/hooks/use-admin"
import {
  invalidateAvailabilityAndBookings,
  RESERVATION_KEYS,
} from "@/hooks/reservation-keys"

function reservablesPath(campusId: string): string {
  return `/admins/campuses/${campusId}/reservables`
}

/**
 * Fetch a campus's reservables for the cdm /reservables page.
 */
export function useAdminReservablesQuery(campusId?: string | null) {
  return useQuery({
    queryKey: RESERVATION_KEYS.adminReservables(campusId ?? ""),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiReservable[] }>(reservablesPath(campusId!))
      return res.data || []
    },
    enabled: Boolean(campusId),
  })
}

/**
 * Fetch a campus's reservables for the SAAF reservation step (read-only).
 */
export function useStudentReservablesQuery(campusId?: string | null) {
  return useQuery({
    queryKey: RESERVATION_KEYS.studentReservables(campusId ?? ""),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiReservable[] }>(
        `/students/campuses/${campusId}/reservables`
      )
      return res.data || []
    },
    enabled: Boolean(campusId),
  })
}

function useInvalidateReservables() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ["admin-reservables"] })
    queryClient.invalidateQueries({ queryKey: ["student-reservables"] })
    // A reservable's weekly schedule drives availability, so refresh it too.
    invalidateAvailabilityAndBookings(queryClient)
  }
}

export function useCreateReservableMutation() {
  const invalidate = useInvalidateReservables()

  return useMutation({
    mutationFn: async ({
      campusId,
      ...payload
    }: CreateReservablePayload & { campusId: string }) => {
      const res = await apiClient.post<{ data: ApiReservable }>(
        reservablesPath(campusId),
        payload
      )
      return res.data
    },
    onSuccess: invalidate,
  })
}

export function useUpdateReservableMutation() {
  const invalidate = useInvalidateReservables()

  return useMutation({
    mutationFn: async ({
      campusId,
      reservableId,
      ...payload
    }: CreateReservablePayload & { campusId: string; reservableId: string }) => {
      const res = await apiClient.put<{ data: ApiReservable }>(
        `${reservablesPath(campusId)}/${reservableId}`,
        payload
      )
      return res.data
    },
    onSuccess: invalidate,
  })
}

/**
 * Permanently remove a reservable. The API rejects (409) one that still has an
 * active booking, so the caller surfaces the returned message.
 */
export function useDeleteReservableMutation() {
  const invalidate = useInvalidateReservables()

  return useMutation({
    mutationFn: async ({
      campusId,
      reservableId,
    }: {
      campusId: string
      reservableId: string
    }) => {
      await apiClient.delete(`${reservablesPath(campusId)}/${reservableId}`)
    },
    onSuccess: invalidate,
  })
}

/**
 * Create many reservables sequentially (CSV import; no bulk admin endpoint).
 * Imported rows carry a default all-available schedule edited later on the grid.
 */
export function useBulkCreateReservablesMutation() {
  const invalidate = useInvalidateReservables()

  return useMutation({
    mutationFn: async ({
      campusId,
      payloads,
    }: {
      campusId: string
      payloads: CreateReservablePayload[]
    }): Promise<BulkCreateResult<ApiReservable>> => {
      const created: ApiReservable[] = []
      const failed: Array<{ name: string; error: string }> = []

      for (const payload of payloads) {
        try {
          const res = await apiClient.post<{ data: ApiReservable }>(
            reservablesPath(campusId),
            payload
          )
          created.push(res.data)
        } catch (error) {
          failed.push({
            name: payload.name,
            error: mutationErrorMessage(error, "Could not create reservable."),
          })
        }
      }

      return { created, failed }
    },
    onSettled: invalidate,
  })
}
