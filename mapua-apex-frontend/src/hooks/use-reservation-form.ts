import { useCallback } from "react"

import {
  DEFAULT_RESERVATION_DRAFT,
  withReservationDefaults,
} from "@/components/reservation/constants"
import { DEFAULT_SAAF_DRAFT } from "@/components/submission/constants"
import type {
  AVItem,
  EquipmentItem,
  ReservationDraft,
  RoomItem,
} from "@/components/reservation/types"
import { sanitizeClassroomName } from "@/lib/campus-rooms"
import { getEventSchedule, withEventSchedule } from "@/lib/event-schedule"
import { saveProposalPdf } from "@/lib/save-proposal-pdf"
import { useOrgStore } from "@/stores/org-store"

/**
 * Reservation draft management for the wizard's reservation step.
 *
 * The wizard (SAAF form) owns submission, navigation, and dialogs, so this hook
 * only manages the reservation draft, its derived event schedule, clearing, and
 * the full-proposal PDF export.
 */
export function useReservationForm() {
  // Ensure every nested array always falls back to defaults.
  const storedDraft = useOrgStore((state) => state.reservationDraft)
  const draft: ReservationDraft = withReservationDefaults(storedDraft)

  // Reservation date/time is always locked to the SAAF event schedule so it can
  // never be entered inconsistently with the event details captured earlier.
  const saafDraft = useOrgStore((state) => state.saafDraft)
  const schedule = getEventSchedule(saafDraft)

  // Rooms are campus-specific, so the reservation step reads the campus from the
  // same draft that owns the venue field instead of asking for it again.
  const campus = saafDraft?.activityVenue ?? ""

  const handleAddRoomItem = useCallback((roomNeeded: string) => {
    const current =
      useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const roomItems = current.roomItems ?? DEFAULT_RESERVATION_DRAFT.roomItems
    useOrgStore.getState().patchReservationDraft({
      roomItems: [
        ...roomItems,
        {
          id: String(Date.now()),
          dateNeeded: "",
          endDateNeeded: "",
          timeNeeded: "",
          endTimeNeeded: "",
          roomNeeded,
          classroomName: "",
          remarks: "",
        },
      ],
    })
  }, [])

  const handleRemoveRoomItem = useCallback((id: string) => {
    const current =
      useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const roomItems = current.roomItems ?? DEFAULT_RESERVATION_DRAFT.roomItems
    useOrgStore.getState().patchReservationDraft({
      roomItems: roomItems.filter((i) => i.id !== id),
    })
  }, [])

  const handleUpdateRoomItem = useCallback(
    (id: string, field: keyof RoomItem, value: string) => {
      let sanitized = value
      if (field === "classroomName") {
        // Classroom codes are uppercase alphanumerics, normalized as typed so
        // the campus regex only ever sees a canonical value.
        sanitized = sanitizeClassroomName(value)
      } else if (field === "roomNeeded" || field === "remarks") {
        sanitized = value.slice(0, 40)
      }
      const current =
        useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
      const roomItems = current.roomItems ?? DEFAULT_RESERVATION_DRAFT.roomItems
      useOrgStore.getState().patchReservationDraft({
        roomItems: roomItems.map((i) =>
          i.id === id ? { ...i, [field]: sanitized } : i
        ),
      })
    },
    []
  )

  const handleAddAvItem = useCallback((equipmentNeeded: string) => {
    const current =
      useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const avItems = current.avItems ?? DEFAULT_RESERVATION_DRAFT.avItems
    useOrgStore.getState().patchReservationDraft({
      avItems: [
        ...avItems,
        {
          id: String(Date.now()),
          dateNeeded: "",
          endDateNeeded: "",
          timeNeeded: "",
          endTimeNeeded: "",
          equipmentNeeded,
          remarks: "",
        },
      ],
    })
  }, [])

  const handleRemoveAvItem = useCallback((id: string) => {
    const current =
      useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const avItems = current.avItems ?? DEFAULT_RESERVATION_DRAFT.avItems
    useOrgStore.getState().patchReservationDraft({
      avItems: avItems.filter((i) => i.id !== id),
    })
  }, [])

  const handleUpdateAvItem = useCallback(
    (id: string, field: keyof AVItem, value: string) => {
      let sanitized = value
      if (field === "equipmentNeeded" || field === "remarks") {
        sanitized = value.slice(0, 40)
      }
      const current =
        useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
      const avItems = current.avItems ?? DEFAULT_RESERVATION_DRAFT.avItems
      useOrgStore.getState().patchReservationDraft({
        avItems: avItems.map((i) =>
          i.id === id ? { ...i, [field]: sanitized } : i
        ),
      })
    },
    []
  )

  const handleAddEquipmentItem = useCallback((name: string) => {
    const current =
      useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const equipmentItems =
      current.equipmentItems ?? DEFAULT_RESERVATION_DRAFT.equipmentItems
    useOrgStore.getState().patchReservationDraft({
      equipmentItems: [
        ...equipmentItems,
        { id: String(Date.now()), name, purpose: "", remark: "" },
      ],
    })
  }, [])

  const handleRemoveEquipmentItem = useCallback((id: string) => {
    const current =
      useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const equipmentItems =
      current.equipmentItems ?? DEFAULT_RESERVATION_DRAFT.equipmentItems
    useOrgStore.getState().patchReservationDraft({
      equipmentItems: equipmentItems.filter((i) => i.id !== id),
    })
  }, [])

  const handleUpdateEquipmentItem = useCallback(
    (id: string, field: keyof EquipmentItem, value: string) => {
      let sanitized = value
      if (field === "purpose" || field === "remark") {
        sanitized = value.slice(0, 40)
      }
      const current =
        useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
      const equipmentItems =
        current.equipmentItems ?? DEFAULT_RESERVATION_DRAFT.equipmentItems
      useOrgStore.getState().patchReservationDraft({
        equipmentItems: equipmentItems.map((i) =>
          i.id === id ? { ...i, [field]: sanitized } : i
        ),
      })
    },
    []
  )

  const handleClearForm = useCallback(() => {
    useOrgStore.getState().clearReservationDraft()
  }, [])

  const handleSavePdf = useCallback(() => {
    const saafDraft = useOrgStore.getState().saafDraft ?? DEFAULT_SAAF_DRAFT
    const current =
      useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const currentDraft: ReservationDraft = withReservationDefaults(current)

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
      withEventSchedule(currentDraft, getEventSchedule(saafDraft))
    )
  }, [])

  return {
    draft,
    schedule,
    campus,
    handleAddRoomItem,
    handleRemoveRoomItem,
    handleUpdateRoomItem,
    handleAddAvItem,
    handleRemoveAvItem,
    handleUpdateAvItem,
    handleAddEquipmentItem,
    handleRemoveEquipmentItem,
    handleUpdateEquipmentItem,
    handleClearForm,
    handleSavePdf,
  }
}
