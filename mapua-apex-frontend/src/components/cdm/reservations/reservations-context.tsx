/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, type ReactNode } from "react"
import { use } from "react"
import { useSearchParams } from "react-router"

import { useAdminCampusesQuery } from "@/hooks/use-campuses"
import { useAdminReservablesQuery } from "@/hooks/use-reservables"
import {
  useAdminReservationChangeQuery,
  useAdminReservationChangesQuery,
  useResolveReservationChangeMutation,
  type ReservationChangeFilter,
} from "@/hooks/use-reservation-changes"
import type {
  ApiCampus,
  ApiReservable,
  ApiReservationChange,
} from "@/lib/types"

const EMPTY_CAMPUSES: ApiCampus[] = []
const EMPTY_RESERVABLES: ApiReservable[] = []
const EMPTY_CHANGES: ApiReservationChange[] = []

/** The `?status=` filter is URL-backed so a queue view is deep-linkable. */
function parseStatus(value: string | null): ReservationChangeFilter {
  return value === "all" ? "all" : "pending"
}

interface ReservationsState {
  campuses: ApiCampus[]
  campusId: string | null
  campusesLoading: boolean
  status: ReservationChangeFilter
  changes: ApiReservationChange[]
  changesLoading: boolean
  changesError: string | null
  /** Same-campus reservables, used by the reschedule "change room" picker. */
  reservables: ApiReservable[]
  selectedChangeId: string | null
  selectedChange: ApiReservationChange | null
  selectedChangeLoading: boolean
}

interface ReservationsActions {
  setCampusId: (campusId: string) => void
  setStatus: (status: ReservationChangeFilter) => void
  selectChange: (changeId: string | null) => void
  resolve: ReturnType<typeof useResolveReservationChangeMutation>
}

interface ReservationsContextValue {
  state: ReservationsState
  actions: ReservationsActions
}

const ReservationsContext = createContext<ReservationsContextValue | null>(null)

export function useReservationsPage() {
  const value = use(ReservationsContext)
  if (!value) {
    throw new Error(
      "useReservationsPage must be used within ReservationsProvider"
    )
  }
  return value
}

/**
 * Master–detail state for the cdm /reservations desk: the campus pick, the
 * URL-backed status filter, the request queue, and the selected request's
 * detail (fetched separately so the right panel always reflects the freshest
 * submission snapshot + audit trail).
 */
export function ReservationsProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = parseStatus(searchParams.get("status"))

  const campusesQuery = useAdminCampusesQuery()
  const campuses = campusesQuery.data ?? EMPTY_CAMPUSES

  // Default to the first campus; the override is set only when CDM picks one.
  const [campusOverride, setCampusOverride] = useState<string | null>(null)
  const activeCampus =
    campuses.find((campus) => campus.campus_id === campusOverride) ??
    campuses[0] ??
    null
  const campusId = activeCampus?.campus_id ?? null

  const changesQuery = useAdminReservationChangesQuery(campusId, status)
  const changes = changesQuery.data ?? EMPTY_CHANGES
  const reservablesQuery = useAdminReservablesQuery(campusId)
  const reservables = reservablesQuery.data ?? EMPTY_RESERVABLES

  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null)
  const detailQuery = useAdminReservationChangeQuery(campusId, selectedChangeId)
  const resolve = useResolveReservationChangeMutation()

  function setStatus(next: ReservationChangeFilter) {
    const params = new URLSearchParams(searchParams)
    params.set("status", next)
    setSearchParams(params, { replace: true })
  }

  function setCampusId(next: string) {
    setCampusOverride(next)
    // A request belongs to one campus, so switching clears the pick.
    setSelectedChangeId(null)
  }

  const changesError = changesQuery.isError
    ? (changesQuery.error instanceof Error && changesQuery.error.message) ||
      "Reservation requests failed to load."
    : null

  const value: ReservationsContextValue = {
    state: {
      campuses,
      campusId,
      campusesLoading: campusesQuery.isLoading,
      status,
      changes,
      changesLoading: changesQuery.isLoading,
      changesError,
      reservables,
      selectedChangeId,
      selectedChange: detailQuery.data ?? null,
      selectedChangeLoading: detailQuery.isLoading,
    },
    actions: {
      setCampusId,
      setStatus,
      selectChange: setSelectedChangeId,
      resolve,
    },
  }

  return (
    <ReservationsContext value={value}>{children}</ReservationsContext>
  )
}
