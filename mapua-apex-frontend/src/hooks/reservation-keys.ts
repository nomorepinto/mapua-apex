import type { QueryClient } from "@tanstack/react-query"

/**
 * Query-key registry for the room-reservation domain (campuses, reservables,
 * availability, bookings). Mirrors the `ADMIN_KEYS` convention in `use-admin.ts`.
 *
 * Keys are tuples so React Query's default prefix matching can invalidate a
 * whole family (e.g. `["admin-availability"]` clears every campus/reservable).
 */
export const RESERVATION_KEYS = {
  adminCampuses: ["admin-campuses"] as const,
  studentCampuses: ["student-campuses"] as const,
  adminReservables: (campusId = "") => ["admin-reservables", campusId] as const,
  studentReservables: (campusId = "") => ["student-reservables", campusId] as const,
  adminAvailability: (campusId = "", reservableId = "", start = "", end = "") =>
    ["admin-availability", campusId, reservableId, start, end] as const,
  studentAvailability: (campusId = "", reservableId = "", start = "", end = "") =>
    ["student-availability", campusId, reservableId, start, end] as const,
  bookings: (campusId = "", reservableId = "", start = "", end = "") =>
    ["reservable-bookings", campusId, reservableId, start, end] as const,
}

/**
 * Invalidate every availability + booking cache. Creating or releasing a hold
 * changes what is free for both CDM (admin) and org submitters (student), and a
 * reservable schedule edit shifts the weekly template, so all three families
 * must refresh together.
 */
export function invalidateAvailabilityAndBookings(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["admin-availability"] })
  queryClient.invalidateQueries({ queryKey: ["student-availability"] })
  queryClient.invalidateQueries({ queryKey: ["reservable-bookings"] })
}
