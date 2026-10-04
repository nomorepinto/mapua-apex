import { AvTable } from "@/components/reservation/av-table"
import { EquipmentSection } from "@/components/reservation/equipment-section"
import { FacilityTable } from "@/components/reservation/facility-table"
import { ReservationActions } from "@/components/reservation/reservation-actions"
import { RoomTable } from "@/components/reservation/room-table"
import { reservationHasUserInput } from "@/components/reservation/constants"
import { useReservationFormContext } from "@/components/students/reservations/reservation-context"
import { FieldWarnings } from "@/components/forms/field-warning"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { SubmissionErrorAlert } from "@/components/forms/submission-error-alert"
import { cn } from "@/lib/utils"

export function ReservationIntro() {
  return (
    <>
      <FormPageHeader
        title="Reservation of Facilities"
        subtitle="Academic Term: 2026 - 2027 • Unified Activity Proposal Application"
      />

      <div className="space-y-0.5">
        <h2 className="text-sm font-bold tracking-wide text-neutral-900 uppercase">
          APPLICATION FORM ON USE OF FACILITIES
        </h2>
        <p className="text-xs font-semibold text-neutral-800">
          (North &amp; South Circle, Hallways, Pavilions, Ground, etc.)
        </p>
      </div>
    </>
  )
}

export function ReservationForm() {
  const { state, actions } = useReservationFormContext()
  const { draft, schedule } = state

  return (
    <form
      noValidate
      onSubmit={(event) =>
        actions.handleInitiateSubmit(event, event.currentTarget)
      }
      className={cn("space-y-8", state.showErrors && "saaf-show-errors")}
    >
      <FieldWarnings
        warnings={
          state.showErrors
            ? {
                ...(draft.purpose.trim()
                  ? {}
                  : { purpose: "This field is required." }),
                ...(draft.functionRoomPurpose.trim()
                  ? {}
                  : { functionRoomPurpose: "This field is required." }),
                ...(draft.avPurpose.trim()
                  ? {}
                  : { avPurpose: "This field is required." }),
              }
            : {}
        }
      >
        <EquipmentSection
          equipment={draft.equipment}
          otherEquipmentText={draft.otherEquipmentText}
          onToggle={actions.toggleEquipment}
          onOtherTextChange={(value) =>
            actions.updateField("otherEquipmentText", value)
          }
        />

        <FacilityTable
          purpose={draft.purpose}
          items={draft.facilityItems}
          schedule={schedule}
          onPurposeChange={(value) => actions.updateField("purpose", value)}
          onUpdate={actions.handleUpdateFacilityItem}
          onRemove={actions.handleRemoveFacilityItem}
          onAdd={actions.handleAddFacilityItem}
        />

        <RoomTable
          purpose={draft.functionRoomPurpose}
          items={draft.roomItems}
          schedule={schedule}
          onPurposeChange={(value) =>
            actions.updateField("functionRoomPurpose", value)
          }
          onUpdate={actions.handleUpdateRoomItem}
          onRemove={actions.handleRemoveRoomItem}
          onAdd={actions.handleAddRoomItem}
        />

        <AvTable
          purpose={draft.avPurpose}
          items={draft.avItems}
          schedule={schedule}
          onPurposeChange={(value) => actions.updateField("avPurpose", value)}
          onUpdate={actions.handleUpdateAvItem}
          onRemove={actions.handleRemoveAvItem}
          onAdd={actions.handleAddAvItem}
        />
      </FieldWarnings>

      <SubmissionErrorAlert message={state.submitError} />

      <ReservationActions
        isSubmitting={state.isSubmitting}
        inactive={
          !draft.purpose.trim() ||
          !draft.functionRoomPurpose.trim() ||
          !draft.avPurpose.trim()
        }
        onSavePdf={actions.handleSavePdf}
        onGoBack={actions.handleGoBack}
        clearDisabled={!reservationHasUserInput(draft)}
        onClear={() => actions.setShowConfirmClearModal(true)}
      />
    </form>
  )
}
