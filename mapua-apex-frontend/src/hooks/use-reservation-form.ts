import { useCallback } from "react"

import {
  DEFAULT_RESERVATION_DRAFT,
  withReservationDefaults,
} from "@/components/reservation/constants"
import type {
  ReservationDraft,
  ReservationPick,
} from "@/components/reservation/types"
import { DEFAULT_SAAF_DRAFT } from "@/components/submission/constants"
import { combineEventTime, parse24 } from "@/components/submission/event-time"
import type { SaafDraft } from "@/components/submission/types"
import { getDateKey, parseDateKey, startOfLocalDay } from "@/lib/date-key"
import { getEventSchedule } from "@/lib/event-schedule"
import {
  reservationDraftToPdfData,
  saveProposalPdf,
} from "@/lib/save-proposal-pdf"
import {
  selectionDateRange,
  selectionTimeRange,
  toggleSlot,
  withSelection,
} from "@/lib/schedule-slots"
import type { ApiReservable, SlotSelection } from "@/lib/types"
import { useOrgStore } from "@/stores/org-store"

/**
 * Reservation draft management for the wizard's reservation step.
 *
 * The step now books real RESERVABLE records: the proponent picks a campus
 * (which is also the event venue), adds rooms/equipment, and reserves concrete
 * dates + 70-minute slots on each. The event's date and time are *derived* from
 * those selections and written back into the SAAF draft, so the reservation is
 * the single source of truth for the event schedule in this flow.
 */

/** Recompute the SAAF event date/time from every pick's slot selections. */
function derivedSchedulePatch(picks: ReservationPick[]): Partial<SaafDraft> {
  const selections = picks.flatMap((pick) => pick.selections)
  const dates = selectionDateRange(selections)
  const times = selectionTimeRange(selections)

  const patch: Partial<SaafDraft> = {
    dateOfEvent: dates?.start ?? "",
    endDateOfEvent: dates?.end ?? "",
    timeOfEventStart: times?.start ?? "",
    timeOfEventEnd: times?.end ?? "",
    timeOfEvent: times ? combineEventTime(times.start, times.end) : "",
  }
  if (times) {
    const startParts = parse24(times.start)
    const endParts = parse24(times.end)
    patch.timeOfEventStartHour = startParts.hour
    patch.timeOfEventStartMinute = startParts.minute
    patch.timeOfEventStartPeriod = startParts.period
    patch.timeOfEventEndHour = endParts.hour
    patch.timeOfEventEndMinute = endParts.minute
    patch.timeOfEventEndPeriod = endParts.period
  } else {
    patch.timeOfEventStartHour = ""
    patch.timeOfEventStartMinute = ""
    patch.timeOfEventStartPeriod = ""
    patch.timeOfEventEndHour = ""
    patch.timeOfEventEndMinute = ""
    patch.timeOfEventEndPeriod = ""
  }
  if (dates) {
    const weekday = parseDateKey(dates.start)?.toLocaleDateString("en-US", {
      weekday: "long",
    })
    patch.dayOfEvent = weekday ?? ""
  } else {
    patch.dayOfEvent = ""
  }
  return patch
}

/** Persist a new pick list plus the event schedule it implies, in one shot. */
function commitPicks(picks: ReservationPick[]): void {
  // Room-first: equipment cannot outlive the last reserved room, so drop any
  // equipment pick when no room remains. Keeps the derived schedule in sync.
  const normalized = picks.some((pick) => pick.type === "room")
    ? picks
    : picks.filter((pick) => pick.type !== "equipment")
  useOrgStore.getState().patchReservationDraft({ picks: normalized })
  useOrgStore.getState().patchSaafDraft(derivedSchedulePatch(normalized))
}

export function useReservationForm() {
  const storedDraft = useOrgStore((state) => state.reservationDraft)
  const draft: ReservationDraft = withReservationDefaults(storedDraft)

  const saafDraft = useOrgStore((state) => state.saafDraft)
  // The reservation schedule is derived from the picks and stored on the SAAF
  // draft, so the read-only summary and the PDF path both read it from there.
  const schedule = getEventSchedule(saafDraft)

  // The campus chosen in the reservation step is the event venue's id.
  const campusId = draft.campusId

  const currentPicks = useCallback(
    (): ReservationPick[] =>
      withReservationDefaults(useOrgStore.getState().reservationDraft).picks,
    []
  )

  /** Choose the venue campus. Reservables are campus-scoped, so picks reset. */
  const handleSelectCampus = useCallback(
    (nextCampusId: string, campusName: string) => {
      useOrgStore.getState().patchReservationDraft({
        campusId: nextCampusId,
        picks: [],
      })
      // Venue name plus a cleared schedule: the event date/time are owned by the
      // slot selections, which are empty again after a campus change.
      useOrgStore.getState().patchSaafDraft({
        activityVenue: campusName,
        ...derivedSchedulePatch([]),
      })
    },
    []
  )

  /** Select or replace primary room reservable */
  /** Add a room to the picks list */
  const handleAddRoom = useCallback(
    (reservable: ApiReservable, initialSelections?: SlotSelection[], remarks: string = "") => {
      const picks = currentPicks()
      if (picks.some((p) => p.reservable_id === reservable.reservable_id)) {
        return
      }
      const existingRooms = picks.filter((p) => p.type === "room")
      const selectionsToUse =
        existingRooms[0]?.selections && existingRooms[0].selections.length > 0
          ? existingRooms[0].selections
          : (initialSelections ?? [])
      const fallbackRemarks =
        remarks.trim() ||
        (existingRooms[0]?.remarks && existingRooms[0].remarks.trim().length >= 20
          ? existingRooms[0].remarks
          : "")

      const newRoomPick: ReservationPick = {
        id: reservable.reservable_id,
        reservable_id: reservable.reservable_id,
        campus_id: reservable.campus_id,
        name: reservable.name,
        type: reservable.type,
        min_participants: reservable.min_participants ?? null,
        max_participants: reservable.max_participants ?? null,
        selections: selectionsToUse,
        remarks: fallbackRemarks,
      }

      const nonRooms = picks.filter((p) => p.type !== "room")
      const updatedEquipment = nonRooms.map((eq) => ({
        ...eq,
        selections: selectionsToUse,
      }))

      commitPicks([...existingRooms, newRoomPick, ...updatedEquipment])
    },
    [currentPicks]
  )

  /** Select or replace primary room reservable */
  const handleSelectRoom = useCallback(
    (reservable: ApiReservable, initialSelections?: SlotSelection[]) => {
      const picks = currentPicks()
      const existingRooms = picks.filter((p) => p.type === "room")
      if (existingRooms.length === 1 && existingRooms[0].reservable_id === reservable.reservable_id) {
        return
      }
      if (existingRooms.length === 0) {
        handleAddRoom(reservable, initialSelections)
        return
      }
      // If single room replacement:
      const existingSelections =
        existingRooms[0]?.selections && existingRooms[0].selections.length > 0
          ? existingRooms[0].selections
          : (initialSelections ?? [])
      const existingRemarks = existingRooms[0]?.remarks ?? ""
      const newRoomPick: ReservationPick = {
        id: reservable.reservable_id,
        reservable_id: reservable.reservable_id,
        campus_id: reservable.campus_id,
        name: reservable.name,
        type: reservable.type,
        min_participants: reservable.min_participants ?? null,
        max_participants: reservable.max_participants ?? null,
        selections: existingSelections,
        remarks: existingRemarks,
      }
      const nonRooms = picks.filter((p) => p.type !== "room")
      const updatedEquipment = nonRooms.map((eq) => ({
        ...eq,
        selections: existingSelections,
      }))
      commitPicks([newRoomPick, ...updatedEquipment])
    },
    [currentPicks, handleAddRoom]
  )

  /** Add a reservable to the pick list, or remove it when already picked. */
  const handleTogglePick = useCallback((reservable: ApiReservable) => {
    const picks = currentPicks()
    const exists = picks.some(
      (pick) => pick.reservable_id === reservable.reservable_id
    )
    // Room-first backstop: refuse to add equipment while no room is picked.
    if (
      !exists &&
      reservable.type === "equipment" &&
      !picks.some((pick) => pick.type === "room")
    ) {
      return
    }
    const next = exists
      ? picks.filter(
        (pick) => pick.reservable_id !== reservable.reservable_id
      )
      : [
        ...picks,
        {
          id: reservable.reservable_id,
          reservable_id: reservable.reservable_id,
          campus_id: reservable.campus_id,
          name: reservable.name,
          type: reservable.type,
          // Room participant bounds travel with the pick so the step can
          // validate the expected headcount without another API read.
          min_participants: reservable.min_participants ?? null,
          max_participants: reservable.max_participants ?? null,
          selections: [],
          remarks: "",
        },
      ]
    commitPicks(next)
  }, [currentPicks])

  const handleRemovePick = useCallback(
    (pickId: string) => {
      commitPicks(currentPicks().filter((pick) => pick.id !== pickId))
    },
    [currentPicks]
  )

  /** Set slots for a specific date across all room picks and keep equipment in sync */
  const handleSetDateSlots = useCallback(
    (date: string, slots: number[]) => {
      const picks = currentPicks()
      const next = picks.map((pick) => ({
        ...pick,
        selections: withSelection(pick.selections, date, slots),
      }))
      commitPicks(next)
    },
    [currentPicks]
  )

  /** Toggle one slot on one date for a pick. */
  const handleToggleSlot = useCallback(
    (pickId: string, date: string, slot: number) => {
      const picks = currentPicks()
      const target = picks.find((p) => p.id === pickId)
      if (!target) return
      const updatedSelections = toggleSlot(target.selections, date, slot)
      const next = picks.map((pick) => {
        if (pick.id === pickId) {
          return { ...pick, selections: updatedSelections }
        }
        if (target.type === "room" && pick.type === "equipment") {
          return { ...pick, selections: updatedSelections }
        }
        return pick
      })
      commitPicks(next)
    },
    [currentPicks]
  )

  /** Add an equipment reservable with remarks and a unit quantity, synced to current room selections */
  const handleAddEquipment = useCallback(
    (reservable: ApiReservable, remarks: string, quantity: number = 1) => {
      const picks = currentPicks()
      if (picks.some((p) => p.reservable_id === reservable.reservable_id)) {
        return
      }
      const roomPicks = picks.filter((p) => p.type === "room")
      const primaryRoom = roomPicks[0]
      const finalRemarks = remarks.trim().slice(0, 50)
      const maxQ = reservable.max_quantity ?? null
      const clampedQuantity = maxQ !== null ? Math.min(Math.max(1, quantity), maxQ) : Math.max(1, quantity)

      const newEquipment: ReservationPick = {
        id: reservable.reservable_id,
        reservable_id: reservable.reservable_id,
        campus_id: reservable.campus_id,
        name: reservable.name,
        type: reservable.type,
        min_participants: reservable.min_participants ?? null,
        max_participants: reservable.max_participants ?? null,
        selections: primaryRoom ? [...primaryRoom.selections] : [],
        remarks: finalRemarks,
        quantity: clampedQuantity,
        max_quantity: maxQ,
      }
      commitPicks([...picks, newEquipment])
    },
    [currentPicks]
  )

  /** Adjust the quantity for an existing equipment pick */
  const handleUpdateEquipmentQuantity = useCallback(
    (pickId: string, quantity: number) => {
      const next = currentPicks().map((pick) => {
        if (pick.id !== pickId || pick.type !== "equipment") return pick
        const maxQ = pick.max_quantity ?? null
        const clamped = maxQ !== null ? Math.min(Math.max(1, quantity), maxQ) : Math.max(1, quantity)
        return { ...pick, quantity: clamped }
      })
      useOrgStore.getState().patchReservationDraft({ picks: next })
    },
    [currentPicks]
  )

  /** Drop selections on dates no longer in the chosen range */
  const handlePruneDates = useCallback(
    (validDates: string[]) => {
      const dateSet = new Set(validDates)
      const picks = currentPicks()
      const next = picks.map((p) => ({
        ...p,
        selections: p.selections.filter((s) => dateSet.has(s.date)),
      }))
      commitPicks(next)
    },
    [currentPicks]
  )

  const handleUpdateRemarks = useCallback(
    (pickId: string, remarks: string) => {
      const next = currentPicks().map((pick) => {
        if (pick.id === pickId) {
          const maxLen = pick.type === "equipment" ? 50 : 150
          return { ...pick, remarks: remarks.slice(0, maxLen) }
        }
        return pick
      })
      // Remarks never affect the event schedule, so skip the derived patch.
      useOrgStore.getState().patchReservationDraft({ picks: next })
    },
    [currentPicks]
  )

  const handleClearForm = useCallback(() => {
    useOrgStore.getState().clearReservationDraft()
    useOrgStore.getState().patchSaafDraft(derivedSchedulePatch([]))
  }, [])

  const handleSavePdf = useCallback(() => {
    const saafDraft = useOrgStore.getState().saafDraft ?? DEFAULT_SAAF_DRAFT
    const current = withReservationDefaults(
      useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    )

    void saveProposalPdf(
      {
        activityType: saafDraft.activityType,
        totalOrgMembers: saafDraft.totalOrgMembers,
        activityTitle: saafDraft.activityTitle,
        activityDescription: saafDraft.activityDescription,
        activityObjectives: saafDraft.activityObjectives,
        activityVenue: saafDraft.activityVenue,
        dateOfEvent: saafDraft.dateOfEvent,
        dayOfEvent: saafDraft.dayOfEvent,
        timeOfEvent: saafDraft.timeOfEvent,
        expectedParticipants: saafDraft.expectedParticipants,
        individualContribution: saafDraft.individualContribution,
        proposedBudget: saafDraft.proposedBudget,
        mission1: saafDraft.mission1,
        mission2: saafDraft.mission2,
        mission3: saafDraft.mission3,
        coreValuesExplanation: saafDraft.coreValuesExplanation,
        peoExplanation: saafDraft.peoExplanation,
        sdgExplanation: saafDraft.sdgExplanation,
        proponents: saafDraft.proponents || [],
        budgetItems: saafDraft.budgetItems || [],
      },
      reservationDraftToPdfData(current)
    )
  }, [])

  return {
    draft,
    schedule,
    campusId,
    /** Today's date key — the earliest a slot can be reserved. */
    todayKey: getDateKey(startOfLocalDay()),
    handleSelectCampus,
    handleSelectRoom,
    handleAddRoom,
    handleTogglePick,
    handleRemovePick,
    handleSetDateSlots,
    handleToggleSlot,
    handleAddEquipment,
    handleUpdateEquipmentQuantity,
    handlePruneDates,
    handleUpdateRemarks,
    handleClearForm,
    handleSavePdf,
  }
}
