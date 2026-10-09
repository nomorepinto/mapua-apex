import { useMemo } from "react"
import { AvTable } from "@/components/reservation/av-table"
import { EquipmentTable } from "@/components/reservation/equipment-table"
import { RoomTable } from "@/components/reservation/room-table"
import { ScheduleSummary } from "@/components/reservation/schedule-summary"
import { useReservationFormContext } from "@/components/students/reservations/reservation-context"
import { useSaafFormContext } from "@/components/students/saaf/saaf-context"
import { EventTimeFields } from "@/components/submission/event-time-fields"
import { FieldWarning } from "@/components/forms/field-warning"
import { Input } from "@/components/ui/input"
import { blockNonIntegerKeys, sanitizeIntegerInput } from "@/lib/numeric-input"
import {
  clockFromDraft,
  combineEventTime,
  format24,
  splitEventTime,
  withHour,
  withPeriod,
  type ClockParts,
} from "@/components/submission/event-time"

/**
 * Capacity limits for rooms in the Makati campus.
 */
const MAKATI_ROOM_CAPACITIES: Record<string, { min: number; max: number }> = {
  "cardinal cinema": { min: 50, max: 100 },
  "cervantes": { min: 30, max: 60 },
  "campus lobby": { min: 200, max: 500 },
  "global class": { min: 30, max: 60 },
  "global classroom": { min: 30, max: 60 },
  "classroom": { min: 20, max: 50 },
  "gym": { min: 100, max: 200 },
  "4th floor outdoor": { min: 30, max: 75 },
}

function getRoomCapacity(roomIdentifier: string) {
  const normalized = roomIdentifier.trim().toLowerCase()
  for (const [key, capacity] of Object.entries(MAKATI_ROOM_CAPACITIES)) {
    if (normalized.includes(key)) {
      return capacity
    }
  }
  return null
}

/**
 * The reservation fields rendered as step 5 of the SAAF wizard. This is form-less
 * (no nested `<form>`) because the wizard already wraps every step in a single
 * `fetcher.Form`; submission, dialogs, and navigation are owned by the wizard.
 */
export function ReservationFields() {
  const { state, actions } = useReservationFormContext()
  const { draft, schedule, campus } = state
  const { state: saafState, actions: saafActions } = useSaafFormContext()
  const { draft: saafDraft } = saafState

  // Matches any variation like "Makati", "Makati Campus", etc.
  const isMakati = campus?.trim().toLowerCase().includes("makati")

  // Calculate cumulative min and max participants for selected Makati rooms
  const makatiLimits = useMemo(() => {
    if (!isMakati || !draft.roomItems || draft.roomItems.length === 0) {
      return null
    }

    let min = 0
    let max = 0
    let matchedCount = 0

    draft.roomItems.forEach((item) => {
      const roomName = item.roomNeeded || ""
      const capacity = getRoomCapacity(roomName)

      if (capacity) {
        min += capacity.min
        max += capacity.max
        matchedCount += 1
      }
    })

    return matchedCount > 0 ? { min, max } : null
  }, [isMakati, draft.roomItems])

  // Validation warning check
  const rawParticipantVal = saafDraft.expectedParticipants || ""
  const participantCount = parseInt(rawParticipantVal, 10)

  const participantWarning = useMemo(() => {
    if (!makatiLimits || !rawParticipantVal || isNaN(participantCount)) return null

    if (participantCount < makatiLimits.min) {
      return `Minimum of ${makatiLimits.min} participants required for selected room(s).`
    }
    if (participantCount > makatiLimits.max) {
      return `Maximum capacity is ${makatiLimits.max} participants for selected room(s).`
    }
    return null
  }, [makatiLimits, rawParticipantVal, participantCount])

  const storedTimes = splitEventTime(saafDraft.timeOfEvent || "")
  const startParts = clockFromDraft(
    saafDraft.timeOfEventStartHour,
    saafDraft.timeOfEventStartMinute,
    saafDraft.timeOfEventStartPeriod,
    saafDraft.timeOfEventStart || storedTimes.start
  )
  const endParts = clockFromDraft(
    saafDraft.timeOfEventEndHour,
    saafDraft.timeOfEventEndMinute,
    saafDraft.timeOfEventEndPeriod,
    saafDraft.timeOfEventEnd || storedTimes.end
  )

  const commitTimes = (start: ClockParts, end: ClockParts) => {
    const start24 = format24(start)
    const end24 = format24(end)
    saafActions.updateField("timeOfEventStartHour", start.hour)
    saafActions.updateField("timeOfEventStartMinute", start.minute)
    saafActions.updateField("timeOfEventStartPeriod", start.period)
    saafActions.updateField("timeOfEventEndHour", end.hour)
    saafActions.updateField("timeOfEventEndMinute", end.minute)
    saafActions.updateField("timeOfEventEndPeriod", end.period)
    saafActions.updateField("timeOfEventStart", start24)
    saafActions.updateField("timeOfEventEnd", end24)
    saafActions.updateField("timeOfEvent", combineEventTime(start24, end24))
  }

  const updateStart = (next: ClockParts) => {
    commitTimes(next, endParts)
  }

  const updateEnd = (next: ClockParts) => {
    commitTimes(startParts, next)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-4 sm:space-y-0">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold tracking-wide text-neutral-900 uppercase">
            APPLICATION FORM ON USE OF FACILITIES
          </h2>
          <p className="text-xs font-semibold text-neutral-800">
            (North &amp; South Circle, Hallways, Pavilions, Ground, etc.)
          </p>
        </div>
        <div className="space-y-1.5 w-full sm:w-64 shrink-0">
          <label className="block text-xs font-semibold text-neutral-800">
            Number of Expected Participants{" "}
            <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            name="expectedParticipants"
            placeholder="0"
            maxLength={5}
            value={saafDraft.expectedParticipants}
            onKeyDown={blockNonIntegerKeys}
            onChange={(e) => {
              const sanitized = sanitizeIntegerInput(e.target.value).slice(0, 5)

              // Allow backspacing and clearing the input
              if (sanitized === "") {
                saafActions.updateField("expectedParticipants", "")
                return
              }

              // Reject additional digits if it would exceed max capacity
              if (makatiLimits) {
                const numeric = parseInt(sanitized, 10)
                if (numeric > makatiLimits.max) {
                  return
                }
              }

              saafActions.updateField("expectedParticipants", sanitized)
            }}
            style={{ color: "#171717" }}
            className={`no-spinner h-9.5 rounded-lg border-neutral-300 bg-white !text-neutral-900 placeholder:text-neutral-400 ${participantWarning ? "border-amber-500 focus-visible:ring-amber-500" : ""
              }`}
            required
          />

          {/* Left-aligned helper text */}
          {makatiLimits && (
            <p className="text-[11px] text-neutral-500 text-left">
              Allowed range:{" "}
              <span className="font-semibold text-neutral-700">
                {makatiLimits.min} – {makatiLimits.max}
              </span>{" "}
              participants
            </p>
          )}

          {/* Left-aligned warning */}
          {participantWarning && (
            <p className="text-xs font-medium text-amber-600 text-left">
              {participantWarning}
            </p>
          )}

          <FieldWarning name="expectedParticipants" />
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <EventTimeFields
            start={startParts}
            end={endParts}
            onStartHour={(hour) => updateStart(withHour(startParts, hour))}
            onStartMinute={(minute) => updateStart({ ...startParts, minute })}
            onStartPeriod={(period) => updateStart(withPeriod(startParts, period))}
            onEndHour={(hour) => updateEnd(withHour(endParts, hour))}
            onEndMinute={(minute) => updateEnd({ ...endParts, minute })}
            onEndPeriod={(period) => updateEnd(withPeriod(endParts, period))}
          />
          <FieldWarning name="timeOfEvent" />
        </div>

        <ScheduleSummary schedule={schedule} hideTime />

        <RoomTable
          items={draft.roomItems}
          campus={campus}
          onUpdate={actions.handleUpdateRoomItem}
          onRemove={actions.handleRemoveRoomItem}
          onAdd={actions.handleAddRoomItem}
        />

        <EquipmentTable
          items={draft.equipmentItems}
          onUpdate={actions.handleUpdateEquipmentItem}
          onRemove={actions.handleRemoveEquipmentItem}
          onAdd={actions.handleAddEquipmentItem}
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