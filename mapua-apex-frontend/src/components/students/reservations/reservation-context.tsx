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
}

interface ReservationFormActions {
  updateField: ReservationFormModel["updateField"]
  handleUpdateFacilityItem: ReservationFormModel["handleUpdateFacilityItem"]
  handleRemoveFacilityItem: ReservationFormModel["handleRemoveFacilityItem"]
  handleAddFacilityItem: ReservationFormModel["handleAddFacilityItem"]
  handleUpdateRoomItem: ReservationFormModel["handleUpdateRoomItem"]
  handleRemoveRoomItem: ReservationFormModel["handleRemoveRoomItem"]
  handleAddRoomItem: ReservationFormModel["handleAddRoomItem"]
  handleUpdateAvItem: ReservationFormModel["handleUpdateAvItem"]
  handleRemoveAvItem: ReservationFormModel["handleRemoveAvItem"]
  handleAddAvItem: ReservationFormModel["handleAddAvItem"]
  handleUpdateEquipmentItem: ReservationFormModel["handleUpdateEquipmentItem"]
  handleRemoveEquipmentItem: ReservationFormModel["handleRemoveEquipmentItem"]
  handleAddEquipmentItem: ReservationFormModel["handleAddEquipmentItem"]
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
    },
    actions: {
      updateField: form.updateField,
      handleUpdateFacilityItem: form.handleUpdateFacilityItem,
      handleRemoveFacilityItem: form.handleRemoveFacilityItem,
      handleAddFacilityItem: form.handleAddFacilityItem,
      handleUpdateRoomItem: form.handleUpdateRoomItem,
      handleRemoveRoomItem: form.handleRemoveRoomItem,
      handleAddRoomItem: form.handleAddRoomItem,
      handleUpdateAvItem: form.handleUpdateAvItem,
      handleRemoveAvItem: form.handleRemoveAvItem,
      handleAddAvItem: form.handleAddAvItem,
      handleUpdateEquipmentItem: form.handleUpdateEquipmentItem,
      handleRemoveEquipmentItem: form.handleRemoveEquipmentItem,
      handleAddEquipmentItem: form.handleAddEquipmentItem,
      handleSavePdf: form.handleSavePdf,
      handleClearForm: form.handleClearForm,
    },
  }

  return (
    <ReservationFormContext value={value}>{children}</ReservationFormContext>
  )
}
