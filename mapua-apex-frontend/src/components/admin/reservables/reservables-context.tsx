/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { use } from "react"
import { useSearchParams } from "react-router"

import { useAdminCampusesQuery } from "@/hooks/use-campuses"
import {
  useAdminReservablesQuery,
  useBulkCreateReservablesMutation,
  useCreateReservableMutation,
  useDeleteReservableMutation,
  useUpdateReservableMutation,
} from "@/hooks/use-reservables"
import {
  useCreateBookingMutation,
  useDeleteBookingMutation,
} from "@/hooks/use-bookings"
import type { ApiCampus, ApiReservable } from "@/lib/types"

/** The three in-page sections of the cdm /reservables tool. */
export type ReservableSection = "add" | "view" | "reserve"

const SECTIONS: ReservableSection[] = ["add", "view", "reserve"]
const EMPTY_CAMPUSES: ApiCampus[] = []
const EMPTY_RESERVABLES: ApiReservable[] = []

function parseSection(value: string | null): ReservableSection {
  return SECTIONS.includes(value as ReservableSection)
    ? (value as ReservableSection)
    : "add"
}

interface ReservablesState {
  section: ReservableSection
  campuses: ApiCampus[]
  campusId: string | null
  reservables: ApiReservable[]
  rooms: ApiReservable[]
  equipment: ApiReservable[]
  selectedReservableId: string | null
  selectedReservable: ApiReservable | null
  campusesLoading: boolean
  reservablesLoading: boolean
  loadError: string | null
}

interface ReservablesActions {
  setSection: (section: ReservableSection) => void
  setCampusId: (campusId: string | null) => void
  setSelectedReservableId: (reservableId: string | null) => void
  /** Pick a reservable and jump to a section (in-page navigation, no reload). */
  selectReservable: (reservableId: string, section?: ReservableSection) => void
  createReservable: ReturnType<typeof useCreateReservableMutation>
  updateReservable: ReturnType<typeof useUpdateReservableMutation>
  deleteReservable: ReturnType<typeof useDeleteReservableMutation>
  bulkCreateReservables: ReturnType<typeof useBulkCreateReservablesMutation>
  createBooking: ReturnType<typeof useCreateBookingMutation>
  deleteBooking: ReturnType<typeof useDeleteBookingMutation>
}

interface ReservablesContextValue {
  state: ReservablesState
  actions: ReservablesActions
}

const ReservablesContext = createContext<ReservablesContextValue | null>(null)

export function useReservablesPage() {
  const value = use(ReservablesContext)
  if (!value) {
    throw new Error("useReservablesPage must be used within ReservablesProvider")
  }
  return value
}

export function ReservablesProvider({ children }: { children: ReactNode }) {
  // The section is URL-backed so each is deep-linkable via ?section=add|view|reserve.
  const [searchParams, setSearchParams] = useSearchParams()
  const section = parseSection(searchParams.get("section"))

  const campusesQuery = useAdminCampusesQuery()
  const campuses = campusesQuery.data ?? EMPTY_CAMPUSES

  // The campus pick defaults to the first campus; the override is only set when
  // CDM chooses one (or opens a reservable that lives on another campus).
  // Deriving the active campus avoids a state-syncing effect.
  const [campusOverride, setCampusOverride] = useState<string | null>(null)
  const [selectedReservableId, setSelectedReservableId] = useState<
    string | null
  >(null)

  const activeCampus =
    campuses.find((campus) => campus.campus_id === campusOverride) ??
    campuses[0] ??
    null
  const campusId = activeCampus?.campus_id ?? null

  const reservablesQuery = useAdminReservablesQuery(campusId)
  const reservables = reservablesQuery.data ?? EMPTY_RESERVABLES

  const createReservable = useCreateReservableMutation()
  const updateReservable = useUpdateReservableMutation()
  const deleteReservable = useDeleteReservableMutation()
  const bulkCreateReservables = useBulkCreateReservablesMutation()
  const createBooking = useCreateBookingMutation()
  const deleteBooking = useDeleteBookingMutation()

  const rooms = useMemo(
    () => reservables.filter((item) => item.type === "room"),
    [reservables]
  )
  const equipment = useMemo(
    () => reservables.filter((item) => item.type === "equipment"),
    [reservables]
  )
  const selectedReservable = useMemo(
    () =>
      reservables.find((item) => item.reservable_id === selectedReservableId) ??
      null,
    [reservables, selectedReservableId]
  )

  const loadError =
    campusesQuery.isError || reservablesQuery.isError
      ? (campusesQuery.error instanceof Error && campusesQuery.error.message) ||
        (reservablesQuery.error instanceof Error &&
          reservablesQuery.error.message) ||
        "Campuses or reservables failed to load."
      : null

  function setSection(next: ReservableSection) {
    const params = new URLSearchParams(searchParams)
    params.set("section", next)
    setSearchParams(params, { replace: true })
  }

  function setCampusId(next: string | null) {
    setCampusOverride(next)
    // A reservable belongs to one campus, so changing campus clears the pick.
    setSelectedReservableId(null)
  }

  function selectReservable(
    reservableId: string,
    nextSection: ReservableSection = "view"
  ) {
    const target = reservables.find(
      (item) => item.reservable_id === reservableId
    )
    if (target?.campus_id && target.campus_id !== campusId) {
      setCampusOverride(target.campus_id)
    }
    setSelectedReservableId(reservableId)
    setSection(nextSection)
  }

  const value: ReservablesContextValue = {
    state: {
      section,
      campuses,
      campusId,
      reservables,
      rooms,
      equipment,
      selectedReservableId,
      selectedReservable,
      campusesLoading: campusesQuery.isLoading,
      reservablesLoading: reservablesQuery.isFetching,
      loadError,
    },
    actions: {
      setSection,
      setCampusId,
      setSelectedReservableId,
      selectReservable,
      createReservable,
      updateReservable,
      deleteReservable,
      bulkCreateReservables,
      createBooking,
      deleteBooking,
    },
  }

  return <ReservablesContext value={value}>{children}</ReservablesContext>
}
