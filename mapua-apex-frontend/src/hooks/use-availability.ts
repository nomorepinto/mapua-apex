import { useQuery } from "@tanstack/react-query"

import { apiClient } from "@/lib/api-client"
import type { ApiAvailability } from "@/lib/types"
import { RESERVATION_KEYS } from "@/hooks/reservation-keys"

export interface AvailabilityWindow {
  /** Inclusive start date, `YYYY-MM-DD`. Omitted => backend default (today). */
  start?: string
  /** Inclusive end date, `YYYY-MM-DD`. Omitted => backend default (+60 days). */
  end?: string
}

function availabilityParams(window?: AvailabilityWindow) {
  return {
    start: window?.start || undefined,
    end: window?.end || undefined,
  }
}

/**
 * Live per-date availability for one reservable (cdm View/Reserve sections).
 * Merges the weekly template with existing bookings so a slot shows as free only
 * when the template allows it AND no booking occupies it.
 */
export function useAdminAvailabilityQuery(
  campusId?: string | null,
  reservableId?: string | null,
  window?: AvailabilityWindow
) {
  return useQuery({
    queryKey: RESERVATION_KEYS.adminAvailability(
      campusId ?? "",
      reservableId ?? "",
      window?.start ?? "",
      window?.end ?? ""
    ),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiAvailability }>(
        `/admins/campuses/${campusId}/reservables/${reservableId}/availability`,
        { params: availabilityParams(window) }
      )
      return res.data
    },
    enabled: Boolean(campusId && reservableId),
  })
}

/**
 * Live per-date availability for the SAAF reservation step (org submitters).
 */
export function useStudentAvailabilityQuery(
  campusId?: string | null,
  reservableId?: string | null,
  window?: AvailabilityWindow
) {
  return useQuery({
    queryKey: RESERVATION_KEYS.studentAvailability(
      campusId ?? "",
      reservableId ?? "",
      window?.start ?? "",
      window?.end ?? ""
    ),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiAvailability }>(
        `/students/campuses/${campusId}/reservables/${reservableId}/availability`,
        { params: availabilityParams(window) }
      )
      return res.data
    },
    enabled: Boolean(campusId && reservableId),
  })
}
