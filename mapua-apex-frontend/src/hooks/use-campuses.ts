import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiClient } from "@/lib/api-client"
import type { ApiCampus, CreateCampusPayload } from "@/lib/types"
import { mutationErrorMessage, type BulkCreateResult } from "@/hooks/use-admin"
import { RESERVATION_KEYS } from "@/hooks/reservation-keys"

/**
 * Fetch all campuses for the osaar /campus admin page.
 */
export function useAdminCampusesQuery() {
  return useQuery({
    queryKey: RESERVATION_KEYS.adminCampuses,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiCampus[] }>("/admins/campuses")
      return res.data || []
    },
  })
}

/**
 * Fetch all campuses for the SAAF reservation step (read-only venue list).
 */
export function useStudentCampusesQuery() {
  return useQuery({
    queryKey: RESERVATION_KEYS.studentCampuses,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiCampus[] }>("/students/campuses")
      return res.data || []
    },
  })
}

function useInvalidateCampuses() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: RESERVATION_KEYS.adminCampuses })
    queryClient.invalidateQueries({ queryKey: RESERVATION_KEYS.studentCampuses })
  }
}

export function useCreateCampusMutation() {
  const invalidate = useInvalidateCampuses()

  return useMutation({
    mutationFn: async (payload: CreateCampusPayload) => {
      const res = await apiClient.post<{ data: ApiCampus }>("/admins/campuses", payload)
      return res.data
    },
    onSuccess: invalidate,
  })
}

export function useUpdateCampusMutation() {
  const invalidate = useInvalidateCampuses()

  return useMutation({
    mutationFn: async ({
      campusId,
      ...payload
    }: CreateCampusPayload & { campusId: string }) => {
      const res = await apiClient.put<{ data: ApiCampus }>(
        `/admins/campuses/${campusId}`,
        payload
      )
      return res.data
    },
    onSuccess: invalidate,
  })
}

/**
 * Permanently remove a campus. The API rejects (409) a campus that still owns
 * reservables, so the caller surfaces the returned message.
 */
export function useDeleteCampusMutation() {
  const invalidate = useInvalidateCampuses()

  return useMutation({
    mutationFn: async (campusId: string) => {
      await apiClient.delete(`/admins/campuses/${campusId}`)
    },
    onSuccess: invalidate,
  })
}

/**
 * Create many campuses sequentially (CSV import; no bulk admin endpoint).
 */
export function useBulkCreateCampusesMutation() {
  const invalidate = useInvalidateCampuses()

  return useMutation({
    mutationFn: async (
      payloads: CreateCampusPayload[]
    ): Promise<BulkCreateResult<ApiCampus>> => {
      const created: ApiCampus[] = []
      const failed: Array<{ name: string; error: string }> = []

      for (const payload of payloads) {
        try {
          const res = await apiClient.post<{ data: ApiCampus }>("/admins/campuses", payload)
          created.push(res.data)
        } catch (error) {
          failed.push({
            name: payload.name,
            error: mutationErrorMessage(error, "Could not create campus."),
          })
        }
      }

      return { created, failed }
    },
    onSettled: invalidate,
  })
}
