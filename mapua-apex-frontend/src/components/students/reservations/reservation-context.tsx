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
  showErrors: boolean
  submitError: ReservationFormModel["submitError"]
  isSubmitting: boolean
  showConfirmClearModal: boolean
  showConfirmModal: boolean
  showSuccessModal: boolean
}

interface ReservationFormActions {
  toggleEquipment: ReservationFormModel["toggleEquipment"]
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
  handleInitiateSubmit: ReservationFormModel["handleInitiateSubmit"]
  handleSavePdf: ReservationFormModel["handleSavePdf"]
  handleGoBack: ReservationFormModel["handleGoBack"]
  handleClearForm: ReservationFormModel["handleClearForm"]
  handleConfirmProceed: ReservationFormModel["handleConfirmProceed"]
  handleSuccessAction: ReservationFormModel["handleSuccessAction"]
  setShowConfirmClearModal: ReservationFormModel["setShowConfirmClearModal"]
  setShowConfirmModal: ReservationFormModel["setShowConfirmModal"]
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
      showErrors: form.showErrors,
      submitError: form.submitError,
      isSubmitting: form.isSubmitting,
      showConfirmClearModal: form.showConfirmClearModal,
      showConfirmModal: form.showConfirmModal,
      showSuccessModal: form.showSuccessModal,
    },
    actions: {
      toggleEquipment: form.toggleEquipment,
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
      handleInitiateSubmit: form.handleInitiateSubmit,
      handleSavePdf: form.handleSavePdf,
      handleGoBack: form.handleGoBack,
      handleClearForm: form.handleClearForm,
      handleConfirmProceed: form.handleConfirmProceed,
      handleSuccessAction: form.handleSuccessAction,
      setShowConfirmClearModal: form.setShowConfirmClearModal,
      setShowConfirmModal: form.setShowConfirmModal,
    },
  }

  return (
    <ReservationFormContext value={value}>{children}</ReservationFormContext>
  )
}
