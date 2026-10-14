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
import { combineEventTime } from "@/components/submission/event-time"
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
} from "@/lib/schedule-slots"
import type { ApiReservable } from "@/lib/types"
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
  useOrgStore.getState().patchReservationDraft({ picks })
  useOrgStore.getState().patchSaafDraft(derivedSchedulePatch(picks))
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

  /** Add a reservable to the pick list, or remove it when already picked. */
  const handleTogglePick = useCallback((reservable: ApiReservable) => {
    const picks = currentPicks()
    const exists = picks.some(
      (pick) => pick.reservable_id === reservable.reservable_id
    )
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

  /** Toggle one slot on one date for a pick. */
  const handleToggleSlot = useCallback(
    (pickId: string, date: string, slot: number) => {
      const next = currentPicks().map((pick) =>
        pick.id === pickId
          ? { ...pick, selections: toggleSlot(pick.selections, date, slot) }
          : pick
      )
      commitPicks(next)
    },
    [currentPicks]
  )

  const handleUpdateRemarks = useCallback(
    (pickId: string, remarks: string) => {
      const next = currentPicks().map((pick) =>
        pick.id === pickId
          ? { ...pick, remarks: remarks.slice(0, 120) }
          : pick
      )
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
    handleTogglePick,
    handleRemovePick,
    handleToggleSlot,
    handleUpdateRemarks,
    handleClearForm,
    handleSavePdf,
  }
}
