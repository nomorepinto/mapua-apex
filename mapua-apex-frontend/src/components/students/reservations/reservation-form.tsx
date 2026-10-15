import { useEffect, useMemo, useState } from "react"
import {
  BoxesIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  CopyIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { slotStatus } from "@/components/admin/reservables/schedule-grid"
import { FieldWarning } from "@/components/forms/field-warning"
import { useReservationFormContext } from "@/components/students/reservations/reservation-context"
import { useSaafFormContext } from "@/components/students/saaf/saaf-context"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useStudentRoomsAvailabilityQuery } from "@/hooks/use-availability"
import { useStudentCampusesQuery } from "@/hooks/use-campuses"
import { useStudentReservablesQuery } from "@/hooks/use-reservables"
import { blockNonIntegerKeys, sanitizeIntegerInput } from "@/lib/numeric-input"
import {
  addDays,
  eventDateFloor,
  formatDisplayDate,
  getDateKey,
  minEventDateKey,
  parseDateKey,
  startOfLocalDay,
} from "@/lib/date-key"
import { combineEventTime, parse24 } from "@/components/submission/event-time"
import {
  INTERVAL_MINUTES,
  SLOT_COUNT,
  dayKeyForDate,
  selectionTimeRange,
  slotEnd,
  slotStart,
  slotStartMinutes,
} from "@/lib/schedule-slots"
import { formatMinutesOfDay } from "@/lib/time-format"
import { capacityRangeLabel } from "@/lib/reservable-capacity"
import type { ApiAvailability, ApiReservable, SlotSelection } from "@/lib/types"
import type { ReservationPick } from "@/components/reservation/types"
import { cn } from "@/lib/utils"

/** 12-slot start time options for dropdowns */
const START_TIME_OPTIONS = Array.from({ length: SLOT_COUNT }, (_, slot) => ({
  slot,
  time: slotStart(slot),
  label: formatMinutesOfDay(slotStartMinutes(slot)),
}))

/** 12-slot end time options for dropdowns */
const END_TIME_OPTIONS = Array.from({ length: SLOT_COUNT }, (_, slot) => ({
  slot,
  time: slotEnd(slot),
  label: formatMinutesOfDay(slotStartMinutes(slot) + INTERVAL_MINUTES),
}))

/**
 * Generate a sorted array of YYYY-MM-DD date strings between startKey and endKey.
 */
function getDateRangeKeys(startKey: string, endKey?: string): string[] {
  if (!startKey) return []
  if (!endKey || endKey === startKey) return [startKey]
  const result: string[] = []
  let curr = parseDateKey(startKey)
  const end = parseDateKey(endKey)
  if (!curr || !end) return [startKey]
  if (curr > end) return [startKey]
  let count = 0
  while (curr <= end && count < 14) {
    result.push(getDateKey(curr))
    curr = addDays(curr, 1)
    count++
  }
  return result
}

/**
 * Checks if a room has any conflicting bookings during the active schedule selections.
 */
function isRoomBookedDuring(
  availability: ApiAvailability | undefined | null,
  selections: SlotSelection[]
): boolean {
  if (!availability || selections.length === 0) return false
  return selections.some((sel) =>
    sel.slots.some((slot) => slotStatus(availability, sel.date, slot) === "booked")
  )
}

/**
 * Checks if a room is closed / not offered during any of the active schedule selections.
 */
function isRoomUnavailableDuring(
  availability: ApiAvailability | undefined | null,
  selections: SlotSelection[]
): boolean {
  if (!availability || selections.length === 0) return false
  return selections.some((sel) => {
    const entry = availability.dates?.[sel.date]
    if (!entry) return false
    return sel.slots.some(
      (slot) => slotStatus(availability, sel.date, slot) === "unavailable"
    )
  })
}

/**
 * The reservation step of the SAAF wizard:
 * Flow:
 *  1. Top component: Venue Campus, Expected Participants, and Time & Date Selector
 *  2. Bottom section:
 *      - Bottom Left: Room / Facility Selection
 *      - Bottom Right: Equipment Selection
 */
export function ReservationFields() {
  const { state, actions } = useReservationFormContext()
  const { draft, campusId } = state
  const { state: saafState, actions: saafActions } = useSaafFormContext()
  const { draft: saafDraft } = saafState

  const campusesQuery = useStudentCampusesQuery()
  const campuses = campusesQuery.data ?? []

  const reservablesQuery = useStudentReservablesQuery(campusId || null)
  const reservables = useMemo(() => reservablesQuery.data ?? [], [reservablesQuery.data])
  const rooms = useMemo(() => reservables.filter((r) => r.type === "room"), [reservables])

  const picks = draft.picks
  const roomPicks = useMemo(() => picks.filter((p) => p.type === "room"), [picks])
  const pickedRoomIds = useMemo(
    () => new Set(roomPicks.map((p) => p.reservable_id)),
    [roomPicks]
  )
  const availableRooms = useMemo(
    () => rooms.filter((r) => !pickedRoomIds.has(r.reservable_id)),
    [rooms, pickedRoomIds]
  )

  const [selectedRoomToAdd, setSelectedRoomToAdd] = useState<string>("")

  const headcount =
    saafDraft.expectedParticipants.trim() === ""
      ? null
      : Number(saafDraft.expectedParticipants)

  const isHeadcountValid = Boolean(
    headcount !== null &&
    Number.isFinite(headcount) &&
    headcount >= 20 &&
    headcount <= 3000
  )

  const totalMaxCapacity = roomPicks.reduce((acc, r) => {
    if (acc === null || r.max_participants === null) return null
    return acc + r.max_participants
  }, 0 as number | null)

  const minCapacity = roomPicks.reduce((acc, r) => {
    if (r.min_participants === null) return acc
    return acc === null ? r.min_participants : Math.min(acc, r.min_participants)
  }, null as number | null)

  const isUnderHeadcount =
    headcount !== null &&
    totalMaxCapacity !== null &&
    headcount > totalMaxCapacity

  const isBelowSingleMin =
    roomPicks.length === 1 &&
    headcount !== null &&
    minCapacity !== null &&
    headcount < minCapacity

  // Date range state for the top Time & Date Selector
  const [startDate, setStartDate] = useState<string>(() => {
    return saafDraft.dateOfEvent || roomPicks[0]?.selections[0]?.date || minEventDateKey()
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return (
      saafDraft.endDateOfEvent ||
      roomPicks[0]?.selections[roomPicks[0].selections.length - 1]?.date ||
      startDate
    )
  })

  // Date slots local map to preserve time choices before/after selecting a room
  const [dateSlots, setDateSlots] = useState<Record<string, number[]>>(() => {
    const initial: Record<string, number[]> = {}
    if (roomPicks.length > 0) {
      for (const sel of roomPicks[0].selections) {
        initial[sel.date] = sel.slots
      }
    }
    return initial
  })

  const dates = useMemo(() => getDateRangeKeys(startDate, endDate), [startDate, endDate])

  const window = useMemo(() => {
    const start = startOfLocalDay()
    return { start: getDateKey(start), end: getDateKey(addDays(start, 180)) }
  }, [])

  const roomIds = useMemo(() => rooms.map((r) => r.reservable_id), [rooms])

  // Live availability queries for all campus rooms across the window
  const roomQueries = useStudentRoomsAvailabilityQuery(
    campusId || null,
    roomIds,
    window
  )

  const roomAvailabilityMap = useMemo(() => {
    const map = new Map<string, ApiAvailability>()
    rooms.forEach((room, idx) => {
      const data = roomQueries[idx]?.data
      if (data) map.set(room.reservable_id, data)
    })
    return map
  }, [rooms, roomQueries])

  const handleStartDateChange = (nextStart: string) => {
    setStartDate(nextStart)
    const nextEnd = !endDate || endDate < nextStart ? nextStart : endDate
    if (endDate !== nextEnd) setEndDate(nextEnd)
    saafActions.updateField("dateOfEvent", nextStart)
    saafActions.updateField("endDateOfEvent", nextEnd)
    const nextDates = getDateRangeKeys(nextStart, nextEnd)
    actions.handlePruneDates(nextDates)
    if (sameTimeForAll) {
      const baseSlots =
        roomPicks[0]?.selections.find((s) => s.date === nextStart)?.slots ??
        dateSlots[nextStart] ??
        dateSlots[startDate] ??
        []
      if (baseSlots.length > 0) {
        for (const d of nextDates) {
          handleSetSlotsForDate(d, baseSlots)
        }
      }
    }
  }

  const handleEndDateChange = (nextEnd: string) => {
    const finalEnd = nextEnd < startDate ? startDate : nextEnd
    setEndDate(finalEnd)
    saafActions.updateField("endDateOfEvent", finalEnd)
    const nextDates = getDateRangeKeys(startDate, finalEnd)
    actions.handlePruneDates(nextDates)
    if (sameTimeForAll) {
      const baseSlots =
        roomPicks[0]?.selections.find((s) => s.date === startDate)?.slots ??
        dateSlots[startDate] ??
        []
      if (baseSlots.length > 0) {
        for (const d of nextDates) {
          handleSetSlotsForDate(d, baseSlots)
        }
      }
    }
  }

  const handleSetSlotsForDate = (date: string, slots: number[]) => {
    setDateSlots((prev) => ({ ...prev, [date]: slots }))
    actions.handleSetDateSlots(date, slots)
  }

  const handleToggleSlotForDate = (date: string, slot: number) => {
    if (roomPicks.length > 0) {
      for (const r of roomPicks) {
        actions.handleToggleSlot(r.id, date, slot)
      }
    } else {
      setDateSlots((prev) => {
        const cur = prev[date] ?? []
        const next = cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot].sort((a, b) => a - b)
        return { ...prev, [date]: next }
      })
    }
  }

  const handleCopyTimeToAll = (sourceDate: string) => {
    const sourceSlots =
      roomPicks[0]?.selections.find((s) => s.date === sourceDate)?.slots ??
      dateSlots[sourceDate] ??
      []
    for (const d of dates) {
      if (d !== sourceDate) {
        handleSetSlotsForDate(d, sourceSlots)
      }
    }
  }

  // Option: "Same time for all dates" vs "Different times per date"
  const [sameTimeForAll, setSameTimeForAll] = useState<boolean>(() => {
    if (roomPicks.length === 0 || roomPicks[0].selections.length <= 1) return true
    const firstStr = roomPicks[0].selections[0].slots.slice().sort().join(",")
    return roomPicks[0].selections.every(
      (sel) => sel.slots.slice().sort().join(",") === firstStr
    )
  })

  const handleToggleSameTimeForAll = (checked: boolean) => {
    setSameTimeForAll(checked)
    if (checked && dates.length > 0) {
      const baseSlots =
        roomPicks[0]?.selections.find((s) => s.date === dates[0])?.slots ??
        dateSlots[dates[0]] ??
        []
      for (const d of dates) {
        handleSetSlotsForDate(d, baseSlots)
      }
    }
  }

  const handleSetSlotsForAllDates = (slots: number[]) => {
    for (const d of dates) {
      handleSetSlotsForDate(d, slots)
    }
  }

  const handleToggleSlotForAllDates = (slot: number) => {
    const baseSlots =
      roomPicks[0]?.selections.find((s) => s.date === dates[0])?.slots ??
      dateSlots[dates[0]] ??
      []
    const next = baseSlots.includes(slot)
      ? baseSlots.filter((s) => s !== slot)
      : [...baseSlots, slot].sort((a, b) => a - b)
    handleSetSlotsForAllDates(next)
  }

  const activeScheduleSelections: SlotSelection[] = useMemo(() => {
    if (roomPicks.length > 0 && roomPicks[0].selections.length > 0) {
      return roomPicks[0].selections
    }
    return dates
      .map((d) => ({ date: d, slots: dateSlots[d] ?? [] }))
      .filter((s) => s.slots.length > 0)
  }, [roomPicks, dates, dateSlots])

  const isScheduleComplete = Boolean(
    dates.length > 0 &&
    dates.every((d) => {
      const slots =
        roomPicks[0]?.selections.find((s) => s.date === d)?.slots ??
        dateSlots[d] ??
        []
      return slots.length > 0
    })
  )


  const derivedTimes = useMemo(() => {
    return selectionTimeRange(activeScheduleSelections)
  }, [activeScheduleSelections])

  const displayTimeOfEvent =
    saafDraft.timeOfEvent ||
    (derivedTimes ? combineEventTime(derivedTimes.start, derivedTimes.end) : "")

  useEffect(() => {
    if (derivedTimes) {
      const timeStr = combineEventTime(derivedTimes.start, derivedTimes.end)
      if (saafDraft.timeOfEvent !== timeStr) {
        saafActions.updateField("timeOfEvent", timeStr)
        saafActions.updateField("timeOfEventStart", derivedTimes.start)
        saafActions.updateField("timeOfEventEnd", derivedTimes.end)
        const startParts = parse24(derivedTimes.start)
        const endParts = parse24(derivedTimes.end)
        saafActions.updateField("timeOfEventStartHour", startParts.hour)
        saafActions.updateField("timeOfEventStartMinute", startParts.minute)
        saafActions.updateField("timeOfEventStartPeriod", startParts.period)
        saafActions.updateField("timeOfEventEndHour", endParts.hour)
        saafActions.updateField("timeOfEventEndMinute", endParts.minute)
        saafActions.updateField("timeOfEventEndPeriod", endParts.period)
      }
    }
  }, [derivedTimes, saafDraft.timeOfEvent, saafActions])

  useEffect(() => {
    if (startDate && saafDraft.dateOfEvent !== startDate) {
      saafActions.updateField("dateOfEvent", startDate)
    }
    if (endDate && saafDraft.endDateOfEvent !== endDate) {
      saafActions.updateField("endDateOfEvent", endDate)
    }
  }, [startDate, endDate, saafDraft.dateOfEvent, saafDraft.endDateOfEvent, saafActions])

  const handleConfirmAddRoom = () => {
    if (!selectedRoomToAdd) return
    const targetRoom = availableRooms.find((r) => r.reservable_id === selectedRoomToAdd)
    if (!targetRoom) return
    const defaultPurpose =
      roomPicks[0]?.remarks && roomPicks[0].remarks.trim().length >= 20
        ? roomPicks[0].remarks
        : ""
    actions.handleAddRoom(targetRoom, activeScheduleSelections, defaultPurpose)
    setSelectedRoomToAdd("")
  }

  return (
    <div className="space-y-6">
      <div className="space-y-0.5">
        <h2 className="text-sm font-bold tracking-wide text-neutral-900 uppercase">
          Application form on use of facilities
        </h2>
        <p className="text-xs font-semibold text-neutral-800">
          Set your event schedule, then choose your room and equipment.
        </p>
      </div>

      {/* TOP COMPONENT: Venue Campus, Participants, AND Time & Date Selector */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs space-y-4">
        {/* Campus & Expected Participants Row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="w-full space-y-1.5 sm:w-1/2">
            <label className="block text-xs font-semibold text-neutral-800">
              Venue Campus <span className="text-red-500">*</span>
            </label>
            <Select
              value={campusId || null}
              items={campuses.map((campus) => ({
                value: campus.campus_id,
                label: campus.name,
              }))}
              onValueChange={(value: string | null) => {
                const campus = campuses.find((c) => c.campus_id === value)
                if (campus) actions.handleSelectCampus(campus.campus_id, campus.name)
              }}
            >
              <SelectTrigger
                aria-label="Venue Campus"
                className={cn(
                  "h-10 w-full truncate rounded-lg border-neutral-300 bg-white text-sm !text-neutral-900",
                  !campusId && "saaf-glow-invalid"
                )}
              >
                <SelectValue placeholder="Select campus" />
              </SelectTrigger>
              <SelectPopup>
                {campuses.map((campus) => (
                  <SelectItem key={campus.campus_id} value={campus.campus_id}>
                    {campus.name}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <FieldWarning name="activityVenue" />
          </div>

          <div className="w-full space-y-1.5 sm:w-1/2">
            <label className="block text-xs font-semibold text-neutral-800">
              Number of Expected Participants <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="expectedParticipants"
              placeholder="0"
              maxLength={4}
              value={saafDraft.expectedParticipants}
              onKeyDown={(e) => {
                const target = e.currentTarget
                if (e.key === "0" && (target.value === "" || target.selectionStart === 0)) {
                  e.preventDefault()
                  return
                }
                blockNonIntegerKeys(e)
              }}
              onChange={(e) =>
                saafActions.updateField(
                  "expectedParticipants",
                  sanitizeIntegerInput(e.target.value).replace(/^0+/, "").slice(0, 4)
                )
              }
              style={{ color: "#171717" }}
              className="no-spinner h-9.5 rounded-lg border-neutral-300 bg-white !text-neutral-900 placeholder:text-neutral-400"
              required
            />
            <span className="block text-[10px] text-neutral-500">
              Between 20 and 3,000 participants
            </span>
            <FieldWarning name="expectedParticipants" />
          </div>
        </div>

        {/* Time and Date Selector Section (at the top) */}
        <div className="pt-3 border-t border-neutral-100 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="size-4 text-neutral-700" />
            <h3 className="text-xs font-semibold text-neutral-800 uppercase tracking-wide">
              Time &amp; Date Selector
            </h3>
          </div>

          {!campusId ? (
            <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-500">
              Select a venue campus above to configure dates and time slots.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Date of Event Range */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-700">
                  Date of Event <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="block text-[10px] font-medium text-neutral-500">
                      Start Date
                    </span>
                    <DatePicker
                      aria-label="Start date of event"
                      minDate={eventDateFloor()}
                      onChange={handleStartDateChange}
                      placeholder="Pick start date"
                      value={startDate}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[10px] font-medium text-neutral-500">
                      End Date (optional)
                    </span>
                    <DatePicker
                      aria-label="End date of event"
                      minDate={startDate || eventDateFloor()}
                      onChange={handleEndDateChange}
                      placeholder="Pick end date"
                      value={endDate}
                    />
                  </div>
                </div>
              </div>

              {/* Time of Event for Each Date */}
              <div className="space-y-3 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <label className="block text-xs font-semibold text-neutral-700">
                    Time of Event <span className="text-red-500">*</span>
                  </label>
                  {dates.length > 1 && (
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 px-2.5 py-1 rounded-md transition-colors">
                      <Checkbox
                        checked={sameTimeForAll}
                        onCheckedChange={(checked) => handleToggleSameTimeForAll(Boolean(checked))}
                        className="size-4 rounded border-neutral-300 data-checked:bg-[#8B0000] data-checked:border-[#8B0000] text-white cursor-pointer"
                      />
                      <span>Same time for all dates</span>
                    </label>
                  )}
                </div>

                {dates.length === 0 ? (
                  <p className="text-xs text-neutral-400">Pick event dates to select time.</p>
                ) : sameTimeForAll && dates.length > 1 ? (
                  /* Single time selector row for all dates */
                  <TimeSlotRow
                    canCopyAll={false}
                    customLabel={`All Event Dates (${formatRangeLabel(startDate, endDate)})`}
                    date={dates[0]}
                    key="all-dates"
                    onSetSlots={handleSetSlotsForAllDates}
                    onToggleSlot={handleToggleSlotForAllDates}
                    selectedSlots={
                      roomPicks[0]?.selections.find((s) => s.date === dates[0])?.slots ??
                      dateSlots[dates[0]] ??
                      []
                    }
                  />
                ) : (
                  /* Individual time selector per date */
                  <div className="space-y-3">
                    {dates.map((date) => {
                      const selectedSlots =
                        roomPicks[0]?.selections.find((s) => s.date === date)?.slots ??
                        dateSlots[date] ??
                        []
                      return (
                        <TimeSlotRow
                          canCopyAll={dates.length > 1}
                          date={date}
                          key={date}
                          onCopyTimeToAll={() => handleCopyTimeToAll(date)}
                          onSetSlots={(slots) => handleSetSlotsForDate(date, slots)}
                          onToggleSlot={(slot) => handleToggleSlotForDate(date, slot)}
                          selectedSlots={selectedSlots}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM SECTION: Room/Facility (Bottom Left) & Equipment (Bottom Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
        {/* Bottom Left Component: Room / Facility */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4 text-neutral-700" />
              <h3 className="text-xs font-semibold text-neutral-800 uppercase tracking-wide">
                Room / Facility
              </h3>
              {roomPicks.length > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {roomPicks.length} room{roomPicks.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          {!campusId ? (
            <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-500">
              Select a venue campus above first.
            </p>
          ) : !isHeadcountValid ? (
            <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-500">
              Enter the expected number of participants above (20–3,000) before selecting rooms.
            </p>
          ) : !isScheduleComplete ? (
            <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-500">
              Select start and end time above for your event schedule before selecting rooms.
            </p>
          ) : reservablesQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : rooms.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-500">
              This campus has no rooms available for reservation.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Capacity Status Bar */}
              <div
                className={cn(
                  "p-2.5 rounded-lg border text-xs",
                  roomPicks.length === 0
                    ? "bg-neutral-50 border-neutral-200 text-neutral-600"
                    : isUnderHeadcount
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : isBelowSingleMin
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800"
                )}
              >
                {roomPicks.length === 0 ? (
                  <span>
                    No rooms selected yet. Select a room below to accommodate your{" "}
                    <strong>{headcount}</strong> expected participants.
                  </span>
                ) : isUnderHeadcount ? (
                  <span>
                    ⚠️ Combined capacity: <strong>{totalMaxCapacity} pax</strong> ({roomPicks.length} room{roomPicks.length === 1 ? "" : "s"}).{" "}
                    Need at least <strong>{headcount - (totalMaxCapacity ?? 0)}</strong> more capacity for {headcount} expected participants. Add another room to accommodate all participants.
                  </span>
                ) : isBelowSingleMin ? (
                  <span>
                    ⚠️ Expected participants ({headcount}) is below minimum capacity ({minCapacity} pax) for {roomPicks[0].name}.
                  </span>
                ) : (
                  <span>
                    ✓ Combined capacity: <strong>{totalMaxCapacity ?? "Unlimited"} pax</strong> accommodates your{" "}
                    <strong>{headcount}</strong> expected participants.
                  </span>
                )}
              </div>

              {/* List of Reserved Rooms */}
              {roomPicks.length > 0 && (
                <div className="space-y-3">
                  {roomPicks.map((room) => {
                    const roomAvail = roomAvailabilityMap.get(room.reservable_id)
                    const isBooked = isRoomBookedDuring(roomAvail, activeScheduleSelections)
                    const isUnavailable =
                      !isBooked && isRoomUnavailableDuring(roomAvail, activeScheduleSelections)
                    const bounds = { min: room.min_participants, max: room.max_participants }
                    const cap = capacityRangeLabel(bounds)
                    const purposeLen = (room.remarks || "").trim().length
                    const isPurposeShort = purposeLen > 0 && purposeLen < 20

                    return (
                      <div
                        key={room.id}
                        className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-3 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-neutral-900 truncate">
                              {room.name}
                            </span>
                            {cap && (
                              <span className="ml-1.5 text-[11px] text-neutral-500 font-normal">
                                ({cap} pax)
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => actions.handleRemovePick(room.id)}
                            className="text-neutral-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                            aria-label={`Remove ${room.name}`}
                          >
                            <Trash2Icon className="size-3.5" />
                          </button>
                        </div>

                        {/* Room conflict warnings */}
                        {isBooked ? (
                          <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded p-1.5">
                            ⚠️ Already booked during your selected event time.
                          </p>
                        ) : isUnavailable ? (
                          <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
                            ⚠️ Not available during your selected event time.
                          </p>
                        ) : null}

                        {/* Room purpose */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-medium text-neutral-600">
                              Reservation Purpose <span className="text-red-500">*</span>
                            </label>
                            <span
                              className={cn(
                                "text-[10px]",
                                isPurposeShort ? "font-medium text-amber-600" : "text-neutral-400"
                              )}
                            >
                              {purposeLen}/150
                            </span>
                          </div>
                          <textarea
                            autoComplete="off"
                            minLength={20}
                            maxLength={150}
                            rows={2}
                            value={room.remarks || ""}
                            onChange={(e) =>
                              actions.handleUpdateRemarks(room.id, e.target.value.slice(0, 150))
                            }
                            placeholder="State purpose of reservation (minimum 20 characters)..."
                            required
                            style={{ color: "#171717" }}
                            className={cn(
                              "w-full resize-y rounded-lg border border-neutral-300 bg-white p-2.5 text-xs leading-relaxed !text-neutral-900 placeholder:text-neutral-400 shadow-xs",
                              "focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900",
                              isPurposeShort && "border-amber-500 focus:border-amber-500 focus:ring-amber-500"
                            )}
                          />
                          {isPurposeShort && (
                            <p className="text-[10px] text-amber-600">
                              Must be at least 20 characters ({20 - purposeLen} more needed).
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add Room Row */}
              <div className="pt-2 border-t border-neutral-100 space-y-2">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">
                  {roomPicks.length === 0 ? "Select Room" : "Add Another Room"}
                </span>

                {availableRooms.length === 0 ? (
                  <p className="text-xs text-neutral-400">
                    All available rooms for this campus have been added.
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <div className="w-full sm:flex-1">
                      <Select
                        value={selectedRoomToAdd || null}
                        items={availableRooms.map((room) => {
                          const roomAvail = roomAvailabilityMap.get(room.reservable_id)
                          const isBooked = isRoomBookedDuring(roomAvail, activeScheduleSelections)
                          const isUnavailable =
                            !isBooked && isRoomUnavailableDuring(roomAvail, activeScheduleSelections)
                          const isDisabled = isBooked || isUnavailable
                          const statusTag = isBooked
                            ? "Booked"
                            : isUnavailable
                              ? "Unavailable"
                              : null
                          const roomBounds = {
                            min: room.min_participants,
                            max: room.max_participants,
                          }
                          const cap = capacityRangeLabel(roomBounds)
                          return {
                            value: room.reservable_id,
                            label: `${room.name}${cap ? ` (${cap} pax)` : ""}${statusTag ? ` · ${statusTag}` : ""}`,
                            disabled: isDisabled,
                          }
                        })}
                        onValueChange={(val) => setSelectedRoomToAdd(val ?? "")}
                      >
                        <SelectTrigger
                          aria-label="Select room to add"
                          className={cn(
                            "h-9.5 w-full rounded-md border-neutral-300 bg-white text-xs !text-neutral-900 truncate",
                            roomPicks.length === 0 && "saaf-glow-invalid"
                          )}
                        >
                          <SelectValue placeholder={roomPicks.length === 0 ? "Select room or facility..." : "Choose additional room..."} />
                        </SelectTrigger>
                        <SelectPopup>
                          {availableRooms.map((room) => {
                            const roomAvail = roomAvailabilityMap.get(room.reservable_id)
                            const isBooked = isRoomBookedDuring(roomAvail, activeScheduleSelections)
                            const isUnavailable =
                              !isBooked && isRoomUnavailableDuring(roomAvail, activeScheduleSelections)
                            const isDisabled = isBooked || isUnavailable
                            const statusTag = isBooked
                              ? "Booked"
                              : isUnavailable
                                ? "Unavailable"
                                : null
                            const roomBounds = {
                              min: room.min_participants,
                              max: room.max_participants,
                            }
                            const cap = capacityRangeLabel(roomBounds)
                            return (
                              <SelectItem
                                key={room.reservable_id}
                                value={room.reservable_id}
                                disabled={isDisabled}
                                className={cn(
                                  isDisabled &&
                                    "opacity-50 text-neutral-400 bg-neutral-100/60 cursor-not-allowed pointer-events-none select-none"
                                )}
                              >
                                <span className="flex items-center justify-between gap-2 w-full">
                                  <span
                                    className={cn(
                                      isDisabled
                                        ? "text-neutral-400 font-normal"
                                        : "text-neutral-900 font-medium"
                                    )}
                                  >
                                    {room.name}
                                    {cap ? (
                                      <span className="text-neutral-400 font-normal">
                                        {" "}
                                        ({cap} pax)
                                      </span>
                                    ) : null}
                                  </span>
                                  {statusTag ? (
                                    <span
                                      className={cn(
                                        "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0",
                                        isBooked
                                          ? "text-rose-700 bg-rose-50 border border-rose-200"
                                          : "text-neutral-600 bg-neutral-100 border border-neutral-300"
                                      )}
                                    >
                                      {statusTag}
                                    </span>
                                  ) : null}
                                </span>
                              </SelectItem>
                            )
                          })}
                        </SelectPopup>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      disabled={!selectedRoomToAdd}
                      onClick={handleConfirmAddRoom}
                      className="h-9.5 text-xs shrink-0 cursor-pointer"
                    >
                      <PlusIcon className="size-3.5 mr-1" />
                      Add Room
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Right Component: Equipment */}
        <EquipmentSelector
          campusId={campusId}
          onAddEquipment={actions.handleAddEquipment}
          onUpdateRemarks={actions.handleUpdateRemarks}
          onRemove={actions.handleRemovePick}
          picks={picks}
          rooms={roomPicks}
        />
      </div>

      {/* Derived Event Schedule Summary */}
      <EventScheduleSummary
        dateOfEvent={saafDraft.dateOfEvent || startDate}
        endDateOfEvent={saafDraft.endDateOfEvent || endDate}
        timeOfEvent={displayTimeOfEvent}
      />

      <input type="hidden" name="activityVenue" value={saafDraft.activityVenue} required />
      <input type="hidden" name="dateOfEvent" value={saafDraft.dateOfEvent} required />
      <input
        type="hidden"
        name="endDateOfEvent"
        value={saafDraft.endDateOfEvent || saafDraft.dateOfEvent}
        required
      />
      <input type="hidden" name="timeOfEvent" value={saafDraft.timeOfEvent} required />
      <input type="hidden" name="timeOfEventStart" value={saafDraft.timeOfEventStart || ""} />
      <input type="hidden" name="timeOfEventEnd" value={saafDraft.timeOfEventEnd || ""} />
      <input type="hidden" name="dayOfEvent" value={saafDraft.dayOfEvent || ""} />
      <FieldWarning name="dateOfEvent" />
      <FieldWarning name="endDateOfEvent" />
      <FieldWarning name="timeOfEvent" />
    </div>
  )
}

/**
 * Single date row for time slot selection via Start Time and End Time dropdowns.
 */
function TimeSlotRow({
  date,
  selectedSlots,
  canCopyAll,
  onSetSlots,
  onCopyTimeToAll,
  customLabel,
}: {
  date: string
  selectedSlots: number[]
  canCopyAll: boolean
  onSetSlots: (slots: number[]) => void
  onToggleSlot: (slot: number) => void
  onCopyTimeToAll?: () => void
  customLabel?: string
}) {
  const isSunday = dayKeyForDate(date) === null
  const hasSelections = selectedSlots.length > 0
  const startSlot = hasSelections ? Math.min(...selectedSlots) : null
  const endSlot = hasSelections ? Math.max(...selectedSlots) : null

  const handleStartChange = (val: string | null) => {
    if (!val) return
    const newStart = Number(val)
    const currentEnd = endSlot !== null ? endSlot : newStart
    const finalEnd = currentEnd < newStart ? newStart : currentEnd
    const newSlots = Array.from(
      { length: finalEnd - newStart + 1 },
      (_, i) => newStart + i
    )
    onSetSlots(newSlots)
  }

  const handleEndChange = (val: string | null) => {
    if (!val) return
    const newEnd = Number(val)
    const currentStart = startSlot !== null ? startSlot : 0
    const finalStart = currentStart > newEnd ? newEnd : currentStart
    const newSlots = Array.from(
      { length: newEnd - finalStart + 1 },
      (_, i) => finalStart + i
    )
    onSetSlots(newSlots)
  }

  const handleClear = () => {
    onSetSlots([])
  }

  const formattedDate = formatDateLabel(date)

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-800">
          {customLabel ?? formattedDate} {isSunday ? "· Sunday (Closed)" : ""}
        </span>
        <div className="flex items-center gap-2">
          {canCopyAll && onCopyTimeToAll ? (
            <button
              type="button"
              onClick={onCopyTimeToAll}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
              title="Apply this date's time to all dates"
            >
              <CopyIcon className="size-3" />
              Copy to all
            </button>
          ) : null}
          {hasSelections ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-medium text-red-500 hover:text-red-700 transition-colors cursor-pointer"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {isSunday ? (
        <p className="text-xs text-neutral-400 italic">
          Sundays are not reservable. Please select Monday to Saturday dates.
        </p>
      ) : (
        <>
          {/* Time Dropdowns: Start Time & End Time */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="block text-[10px] font-medium text-neutral-500">
                Start Time
              </span>
              <Select
                value={startSlot !== null ? String(startSlot) : null}
                items={START_TIME_OPTIONS.map((opt) => ({
                  value: String(opt.slot),
                  label: opt.label,
                }))}
                onValueChange={handleStartChange}
              >
                <SelectTrigger
                  aria-label={`Start time for ${formattedDate}`}
                  className="h-9 w-full rounded-md border-neutral-300 bg-white text-xs !text-neutral-900"
                >
                  <SelectValue placeholder="Start Time" />
                </SelectTrigger>
                <SelectPopup>
                  {START_TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.slot} value={String(opt.slot)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>

            <div className="space-y-1">
              <span className="block text-[10px] font-medium text-neutral-500">
                End Time
              </span>
              <Select
                value={endSlot !== null ? String(endSlot) : null}
                items={END_TIME_OPTIONS.map((opt) => ({
                  value: String(opt.slot),
                  label: opt.label,
                }))}
                onValueChange={handleEndChange}
              >
                <SelectTrigger
                  aria-label={`End time for ${formattedDate}`}
                  className="h-9 w-full rounded-md border-neutral-300 bg-white text-xs !text-neutral-900"
                >
                  <SelectValue placeholder="End Time" />
                </SelectTrigger>
                <SelectPopup>
                  {END_TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.slot} value={String(opt.slot)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </div>

          {/* Time summary */}
          <div className="text-xs pt-0.5">
            {hasSelections && startSlot !== null && endSlot !== null ? (
              <span className="font-medium text-emerald-700">
                ✓ {selectedSlots.length} slot{selectedSlots.length === 1 ? "" : "s"}{" "}
                ({formatMinutesOfDay(slotStartMinutes(startSlot))} –{" "}
                {formatMinutesOfDay(slotStartMinutes(endSlot) + INTERVAL_MINUTES)})
              </span>
            ) : (
              <span className="text-[11px] text-neutral-400">
                No time slots selected for this day
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Equipment selector corresponding to the right box of the user sketch.
 * Shows requested equipment with remove button, and an "Equip" add row with dropdown + remark.
 */
function EquipmentSelector({
  picks,
  campusId,
  rooms,
  onAddEquipment,
  onUpdateRemarks,
  onRemove,
}: {
  picks: ReservationPick[]
  campusId: string
  rooms: ReservationPick[]
  onAddEquipment: (reservable: ApiReservable, remarks: string) => void
  onUpdateRemarks: (pickId: string, remarks: string) => void
  onRemove: (pickId: string) => void
}) {
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("")
  const [equipmentRemark, setEquipmentRemark] = useState<string>("")
  const [isCollapsed, setIsCollapsed] = useState(false)

  const reservablesQuery = useStudentReservablesQuery(campusId || null)
  const equipment = (reservablesQuery.data ?? []).filter((r) => r.type === "equipment")

  const equipmentPicks = picks.filter((p) => p.type === "equipment")
  const pickedEquipmentIds = new Set(equipmentPicks.map((p) => p.reservable_id))
  const availableEquipment = equipment.filter(
    (eq) => !pickedEquipmentIds.has(eq.reservable_id)
  )

  const isRemarkValid =
    equipmentRemark.trim().length >= 5 && equipmentRemark.length <= 50
  const isAddDisabled = !selectedEquipmentId || !isRemarkValid

  const handleConfirmAddEquipment = () => {
    if (isAddDisabled) return
    const reservable = availableEquipment.find(
      (eq) => eq.reservable_id === selectedEquipmentId
    )
    if (!reservable) return

    onAddEquipment(reservable, equipmentRemark.trim().slice(0, 50))
    setSelectedEquipmentId("")
    setEquipmentRemark("")
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs space-y-4">
      {/* Header with collapsible toggle */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
        <div className="flex items-center gap-2">
          <BoxesIcon className="size-4 text-neutral-700" />
          <h3 className="text-xs font-semibold text-neutral-800 uppercase tracking-wide">
            Equipment
          </h3>
          {equipmentPicks.length > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {equipmentPicks.length} item{equipmentPicks.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-neutral-400 hover:text-neutral-700 p-1 rounded transition-colors cursor-pointer"
          aria-label={isCollapsed ? "Expand equipment section" : "Collapse equipment section"}
        >
          <ChevronDownIcon
            className={cn(
              "size-4 transition-transform duration-200",
              !isCollapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {rooms.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-500">
          Reserve at least one room on the left first. Equipment can only be requested alongside a room reservation.
        </p>
      ) : isCollapsed ? null : (
        <div className="space-y-4">
          {/* List of requested equipment */}
          {equipmentPicks.length === 0 ? (
            <p className="text-xs text-neutral-400 italic py-1">
              No equipment requested yet. Use the dropdown below to add equipment.
            </p>
          ) : (
            <div className="space-y-2.5">
              {equipmentPicks.map((item) => {
                const currentRemark = item.remarks || ""
                const remarkLen = currentRemark.length
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/70 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-neutral-900 truncate">
                        {item.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className="text-neutral-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer shrink-0"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <label className="text-[10px] font-medium text-neutral-600">
                          Remark / Purpose <span className="text-red-500">*</span>
                        </label>
                        <span
                          className={cn(
                            "font-mono text-[10px]",
                            remarkLen > 50
                              ? "text-red-600 font-bold"
                              : currentRemark.trim().length < 5
                                ? "text-amber-600"
                                : "text-emerald-600"
                          )}
                        >
                          {remarkLen}/50 (min 5, max 50)
                        </span>
                      </div>
                      <Input
                        type="text"
                        maxLength={50}
                        value={currentRemark}
                        onChange={(e) => onUpdateRemarks(item.id, e.target.value.slice(0, 50))}
                        placeholder="Remark / Purpose (min 5, max 50 chars)..."
                        className={cn(
                          "h-8 text-xs bg-white rounded-md border-neutral-300",
                          currentRemark.trim().length < 5 &&
                            "border-amber-400 focus-visible:ring-amber-400"
                        )}
                      />
                      {currentRemark.trim().length < 5 && (
                        <p className="text-[10px] text-amber-600">
                          Must be at least 5 characters ({5 - currentRemark.trim().length} more needed).
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add Equipment Section */}
          <div className="pt-3 border-t border-neutral-100 space-y-3">
            <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">
              Add Equipment
            </span>

            {availableEquipment.length === 0 ? (
              <p className="text-xs text-neutral-400">
                {equipment.length === 0
                  ? "This campus has no equipment available."
                  : "All available equipment items have been added."}
              </p>
            ) : (
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <Select
                    value={selectedEquipmentId || null}
                    items={availableEquipment.map((eq) => ({
                      value: eq.reservable_id,
                      label: eq.name,
                    }))}
                    onValueChange={(val) => setSelectedEquipmentId(val ?? "")}
                  >
                    <SelectTrigger
                      aria-label="Select equipment"
                      className="h-9 w-full rounded-md border-neutral-300 bg-white text-xs !text-neutral-900 truncate"
                    >
                      <SelectValue placeholder="Select equipment item..." />
                    </SelectTrigger>
                    <SelectPopup>
                      {availableEquipment.map((eq) => (
                        <SelectItem key={eq.reservable_id} value={eq.reservable_id}>
                          {eq.name}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <label className="text-[10px] font-medium text-neutral-600">
                      Equipment Remark / Purpose <span className="text-red-500">*</span>
                    </label>
                    <span
                      className={cn(
                        "font-mono text-[10px]",
                        equipmentRemark.length > 50
                          ? "text-red-600 font-bold"
                          : equipmentRemark.trim().length < 5
                            ? "text-amber-600"
                            : "text-emerald-600 font-semibold"
                      )}
                    >
                      {equipmentRemark.length}/50 (min 5, max 50)
                    </span>
                  </div>

                  <div className="flex gap-2 items-center">
                    <Input
                      type="text"
                      maxLength={50}
                      placeholder="Remark / Purpose (min 5, max 50 chars)..."
                      value={equipmentRemark}
                      onChange={(e) => setEquipmentRemark(e.target.value.slice(0, 50))}
                      className={cn(
                        "h-9 text-xs bg-white placeholder:text-neutral-400 rounded-md border-neutral-300 flex-1",
                        equipmentRemark.length > 0 &&
                          equipmentRemark.trim().length < 5 &&
                          "border-amber-400 focus-visible:ring-amber-400"
                      )}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={isAddDisabled}
                      onClick={handleConfirmAddEquipment}
                      className="h-9 px-3 text-xs shrink-0 cursor-pointer"
                    >
                      <PlusIcon className="size-3.5 mr-1" />
                      Add
                    </Button>
                  </div>

                  {equipmentRemark.length > 0 && equipmentRemark.trim().length < 5 && (
                    <p className="text-[10px] text-amber-600">
                      Must be at least 5 characters ({5 - equipmentRemark.trim().length} more needed).
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function EventScheduleSummary({
  dateOfEvent,
  endDateOfEvent,
  timeOfEvent,
}: {
  dateOfEvent: string
  endDateOfEvent?: string
  timeOfEvent: string
}) {
  const hasSchedule = Boolean(dateOfEvent && timeOfEvent)
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">
        Derived event schedule
      </p>
      {hasSchedule ? (
        <p className="mt-1 text-sm text-neutral-900">
          <span className="font-semibold">
            {formatRangeLabel(dateOfEvent, endDateOfEvent)}
          </span>
          {timeOfEvent ? <span> · {timeOfEvent}</span> : null}
        </p>
      ) : (
        <p className="mt-1 text-sm text-neutral-500">
          Select date, time, and room to derive the event schedule.
        </p>
      )}
    </div>
  )
}

function formatDateLabel(dateKey: string): string {
  const date = parseDateKey(dateKey)
  return date ? formatDisplayDate(date, "long") : dateKey
}

function formatRangeLabel(start: string, end?: string): string {
  if (!end || end === start) return formatDateLabel(start)
  return `${formatDateLabel(start)} – ${formatDateLabel(end)}`
}