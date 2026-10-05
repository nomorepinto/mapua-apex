import { AvTable } from "@/components/reservation/av-table"
import { EquipmentTable } from "@/components/reservation/equipment-table"
import { RoomTable } from "@/components/reservation/room-table"
import { ScheduleSummary } from "@/components/reservation/schedule-summary"
import { useReservationFormContext } from "@/components/students/reservations/reservation-context"

/**
 * The reservation fields rendered as step 5 of the SAAF wizard. This is form-less
 * (no nested `<form>`) because the wizard already wraps every step in a single
 * `fetcher.Form`; submission, dialogs, and navigation are owned by the wizard.
 */
export function ReservationFields() {
  const { state, actions } = useReservationFormContext()
  const { draft, schedule, campus } = state

  return (
    <div className="space-y-8">
      <div className="space-y-0.5">
        <h2 className="text-sm font-bold tracking-wide text-neutral-900 uppercase">
          APPLICATION FORM ON USE OF FACILITIES
        </h2>
        <p className="text-xs font-semibold text-neutral-800">
          (North &amp; South Circle, Hallways, Pavilions, Ground, etc.)
        </p>
      </div>

      <div className="space-y-8">
        <ScheduleSummary schedule={schedule} />

        <EquipmentTable
          items={draft.equipmentItems}
          onUpdate={actions.handleUpdateEquipmentItem}
          onRemove={actions.handleRemoveEquipmentItem}
          onAdd={actions.handleAddEquipmentItem}
        />

        <RoomTable
          items={draft.roomItems}
          campus={campus}
          onUpdate={actions.handleUpdateRoomItem}
          onRemove={actions.handleRemoveRoomItem}
          onAdd={actions.handleAddRoomItem}
        />

        <AvTable
          items={draft.avItems}
          onUpdate={actions.handleUpdateAvItem}
          onRemove={actions.handleRemoveAvItem}
          onAdd={actions.handleAddAvItem}
        />
      </div>
    </div>
  )
}
