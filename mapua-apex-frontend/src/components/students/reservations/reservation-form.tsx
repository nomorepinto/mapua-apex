import { useMemo } from "react"
import { AvTable } from "@/components/reservation/av-table"
import { EquipmentTable } from "@/components/reservation/equipment-table"
import { RoomTable } from "@/components/reservation/room-table"
import { useReservationFormContext } from "@/components/students/reservations/reservation-context"
import { useSaafFormContext } from "@/components/students/saaf/saaf-context"
import { EventTimeFields } from "@/components/submission/event-time-fields"
import { FieldWarning } from "@/components/forms/field-warning"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { blockNonIntegerKeys, sanitizeIntegerInput } from "@/lib/numeric-input"
import { minEventDateKey, parseDateKey } from "@/lib/date-key"
import { CAMPUSES } from "@/components/submission/constants"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
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

/**
 * Capacity limits for rooms in the Intramuros campus.
 */
const INTRAMUROS_ROOM_CAPACITIES: Record<string, { min: number; max: number }> = {
  "av room": { min: 50, max: 100 },
  "seminar room": { min: 50, max: 150 },
  "global class": { min: 30, max: 60 },
  "global classroom": { min: 30, max: 60 },
  "classroom": { min: 20, max: 50 },
  "gymnasium": { min: 300, max: 3000 },
  "gym": { min: 300, max: 3000 },
}

function getRoomCapacity(roomIdentifier: string, campus?: string) {
  const normalized = roomIdentifier.trim().toLowerCase()
  const isMakati = campus?.trim().toLowerCase().includes("makati")
  const isIntramuros = campus?.trim().toLowerCase().includes("intramuros")

  const capacities = isMakati
    ? MAKATI_ROOM_CAPACITIES
    : isIntramuros
      ? INTRAMUROS_ROOM_CAPACITIES
      : null

  if (!capacities) return null

  const sortedEntries = Object.entries(capacities).sort(
    ([a], [b]) => b.length - a.length
  )

  for (const [key, capacity] of sortedEntries) {
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
  const { draft, campus } = state
  const { state: saafState, actions: saafActions } = useSaafFormContext()
  const { draft: saafDraft } = saafState

  // Matches any variation like "Makati", "Makati Campus", "Intramuros", etc.
  const isMakati = campus?.trim().toLowerCase().includes("makati")
  const isIntramuros = campus?.trim().toLowerCase().includes("intramuros")

  // Calculate cumulative min and max participants for selected rooms based on campus
  const roomLimits = useMemo(() => {
    if ((!isMakati && !isIntramuros) || !draft.roomItems || draft.roomItems.length === 0) {
      return null
    }

    let min = 0
    let max = 0
    let matchedCount = 0

    draft.roomItems.forEach((item) => {
      const roomName = item.roomNeeded || ""
      const capacity = getRoomCapacity(roomName, campus)

      if (capacity) {
        min += capacity.min
        max += capacity.max
        matchedCount += 1
      }
    })

    return matchedCount > 0 ? { min, max } : null
  }, [isMakati, isIntramuros, campus, draft.roomItems])

  // Validation warning check
  const rawParticipantVal = saafDraft.expectedParticipants || ""
  const participantCount = parseInt(rawParticipantVal, 10)

  const participantWarning = useMemo(() => {
    if (!roomLimits || !rawParticipantVal || isNaN(participantCount)) return null

    if (participantCount < roomLimits.min) {
      return `Minimum of ${roomLimits.min} participants required for selected room(s).`
    }
    if (participantCount > roomLimits.max) {
      return `Maximum capacity is ${roomLimits.max} participants for selected room(s).`
    }
    return null
  }, [roomLimits, rawParticipantVal, participantCount])

  const minStartDate = minEventDateKey()
  const minEndDate =
    saafDraft.dateOfEvent && saafDraft.dateOfEvent > minStartDate
      ? saafDraft.dateOfEvent
      : minStartDate

  const handleStartDateChange = (startVal: string) => {
    saafActions.updateField("dateOfEvent", startVal)
    if (!saafDraft.endDateOfEvent || saafDraft.endDateOfEvent < startVal) {
      saafActions.updateField("endDateOfEvent", startVal)
    }
    const weekday = parseDateKey(startVal)?.toLocaleDateString("en-US", {
      weekday: "long",
    })
    if (weekday) saafActions.updateField("dayOfEvent", weekday)
  }

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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold tracking-wide text-neutral-900 uppercase">
              APPLICATION FORM ON USE OF FACILITIES
            </h2>
            <p className="text-xs font-semibold text-neutral-800">
              (North &amp; South Circle, Hallways, Pavilions, Ground, etc.)
            </p>
          </div>

          <div className="space-y-1.5 w-full sm:w-72">
            <label className="block text-xs font-semibold text-neutral-800">
              Venue Campus <span className="text-red-500">*</span>
            </label>
            <Select
              value={saafDraft.activityVenue || null}
              onValueChange={(value: string | null) =>
                saafActions.updateField("activityVenue", value ?? "")
              }
            >
              <SelectTrigger
                aria-label="Venue Campus"
                className={cn(
                  "h-10 w-full truncate rounded-lg border-neutral-300 bg-white text-sm !text-neutral-900",
                  !saafDraft.activityVenue && "saaf-glow-invalid"
                )}
              >
                <SelectValue placeholder="Select campus" />
              </SelectTrigger>
              <SelectPopup>
                {CAMPUSES.map((campusOption) => (
                  <SelectItem key={campusOption} value={campusOption}>
                    {campusOption}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <input
              type="hidden"
              name="activityVenue"
              value={saafDraft.activityVenue}
              required
            />
            <FieldWarning name="activityVenue" />
          </div>
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
              if (roomLimits) {
                const numeric = parseInt(sanitized, 10)
                if (numeric > roomLimits.max) {
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
          {roomLimits && (
            <p className="text-[11px] text-neutral-500 text-left">
              Allowed range:{" "}
              <span className="font-semibold text-neutral-700">
                {roomLimits.min} – {roomLimits.max}
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
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-800">
              Start Date of Event <span className="text-red-500">*</span>
            </label>
            <DatePicker
              name="dateOfEvent"
              value={saafDraft.dateOfEvent}
              minDate={minStartDate}
              onChange={handleStartDateChange}
              placeholder="Pick start date"
              aria-label="Start date of event"
              required
            />
            <span className="block text-[10px] text-neutral-500">
              At least 10 days from today
            </span>
            <FieldWarning name="dateOfEvent" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-800">
              End Date of Event <span className="text-red-500">*</span>
            </label>
            <DatePicker
              name="endDateOfEvent"
              value={saafDraft.endDateOfEvent || saafDraft.dateOfEvent || ""}
              minDate={minEndDate}
              onChange={(next) => saafActions.updateField("endDateOfEvent", next)}
              placeholder="Pick end date"
              aria-label="End date of event"
              required
            />
            <FieldWarning name="endDateOfEvent" />
          </div>
        </div>

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

        <input type="hidden" name="timeOfEventStart" value={format24(startParts)} />
        <input type="hidden" name="timeOfEventEnd" value={format24(endParts)} />
        <input type="hidden" name="timeOfEvent" value={saafDraft.timeOfEvent || ""} />
        <input type="hidden" name="dayOfEvent" value={saafDraft.dayOfEvent || ""} />

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