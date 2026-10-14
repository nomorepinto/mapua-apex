/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactNode } from "react"
import { use } from "react"

import type { ReservationDraft } from "@/components/reservation/types"
import type { EventSchedule } from "@/lib/event-schedule"
import { useReservationForm } from "@/hooks/use-reservation-form"

type ReservationFormModel = ReturnType<typeof useReservationForm>

interface ReservationFormState {
  draft: ReservationDraft
  schedule: EventSchedule
  /** Campus id chosen in the reservation step; drives the reservable catalog. */
  campusId: string
  /** Earliest reservable date key (today). */
  todayKey: string
}

interface ReservationFormActions {
  handleSelectCampus: ReservationFormModel["handleSelectCampus"]
  handleTogglePick: ReservationFormModel["handleTogglePick"]
  handleRemovePick: ReservationFormModel["handleRemovePick"]
  handleToggleSlot: ReservationFormModel["handleToggleSlot"]
  handleUpdateRemarks: ReservationFormModel["handleUpdateRemarks"]
  handleSavePdf: ReservationFormModel["handleSavePdf"]
  handleClearForm: ReservationFormModel["handleClearForm"]
}

interface ReservationFormContextValue {
  state: ReservationFormState
  actions: ReservationFormActions
}

const ReservationFormContext = createContext<ReservationFormContextValue | null>(
  null
)

export function useReservationFormContext() {
  const value = use(ReservationFormContext)
  if (!value) {
    throw new Error(
      "useReservationFormContext must be used within ReservationProvider"
    )
  }
  return value
}

export function ReservationProvider({ children }: { children: ReactNode }) {
  const form = useReservationForm()

  const value: ReservationFormContextValue = {
    state: {
      draft: form.draft,
      schedule: form.schedule,
      campusId: form.campusId,
      todayKey: form.todayKey,
    },
    actions: {
      handleSelectCampus: form.handleSelectCampus,
      handleTogglePick: form.handleTogglePick,
      handleRemovePick: form.handleRemovePick,
      handleToggleSlot: form.handleToggleSlot,
      handleUpdateRemarks: form.handleUpdateRemarks,
      handleSavePdf: form.handleSavePdf,
      handleClearForm: form.handleClearForm,
    },
  }

  return (
    <ReservationFormContext value={value}>{children}</ReservationFormContext>
  )
}
