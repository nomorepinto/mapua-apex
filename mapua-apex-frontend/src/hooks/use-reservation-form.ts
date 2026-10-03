import { useCallback, useState, type FormEvent } from "react"
import { useNavigate, useSearchParams } from "react-router"

import { DEFAULT_RESERVATION_DRAFT } from "@/components/reservation/constants"
import { DEFAULT_SAAF_DRAFT } from "@/components/submission/constants"
import { useHydrateEditingSubmission } from "@/hooks/use-hydrate-editing-submission"
import { useScrollToTop } from "@/hooks/use-scroll-to-top"
import type {
  AVItem,
  EquipmentFlags,
  FacilityItem,
  ReservationDraft,
  RoomItem,
} from "@/components/reservation/types"
import { buildSaafApiPayload, omitEventIdFromPayload } from "@/lib/dynamodb-adapters"
import { useCreateSubmissionMutation, useUpdateSubmissionMutation } from "@/hooks/use-submissions"
import { saveProposalPdf } from "@/lib/save-proposal-pdf"
import { useOrgStore } from "@/stores/org-store"

export function useReservationForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  useHydrateEditingSubmission()
  const createSubmission = useCreateSubmissionMutation()
  const updateSubmission = useUpdateSubmissionMutation()
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showConfirmClearModal, setShowConfirmClearModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  // Ensure every nested array and object always falls back to defaults
  const storedDraft = useOrgStore((state) => state.reservationDraft)
  const draft: ReservationDraft = {
    ...DEFAULT_RESERVATION_DRAFT,
    ...(storedDraft ?? {}),
    equipment: {
      ...DEFAULT_RESERVATION_DRAFT.equipment,
      ...(storedDraft?.equipment ?? {}),
    },
    facilityItems:
      storedDraft?.facilityItems ?? DEFAULT_RESERVATION_DRAFT.facilityItems,
    roomItems: storedDraft?.roomItems ?? DEFAULT_RESERVATION_DRAFT.roomItems,
    avItems: storedDraft?.avItems ?? DEFAULT_RESERVATION_DRAFT.avItems,
  }

  useScrollToTop()

  const updateField = useCallback(
    <K extends keyof ReservationDraft>(key: K, value: ReservationDraft[K]) => {
      let sanitizedValue = value
      if (
        (key === "otherEquipmentText" ||
          key === "purpose" ||
          key === "functionRoomPurpose" ||
          key === "avPurpose") &&
        typeof value === "string"
      ) {
        sanitizedValue = value.slice(0, 100) as ReservationDraft[K]
      }
      useOrgStore.getState().patchReservationDraft({ [key]: sanitizedValue })
    },
    []
  )

  const toggleEquipment = useCallback(
    (key: keyof EquipmentFlags, checked: boolean) => {
      const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
      const currentEquipment = current.equipment ?? DEFAULT_RESERVATION_DRAFT.equipment
      useOrgStore.getState().patchReservationDraft({
        equipment: { ...currentEquipment, [key]: checked },
      })
    },
    []
  )

  const handleAddFacilityItem = useCallback(() => {
    const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const facilityItems = current.facilityItems ?? DEFAULT_RESERVATION_DRAFT.facilityItems
    useOrgStore.getState().patchReservationDraft({
      facilityItems: [
        ...facilityItems,
        {
          id: String(Date.now()),
          item: "",
          dateOfUse: "",
          endDateOfUse: "",
          timeOfUse: "",
          endTimeOfUse: "",
          location: "",
        },
      ],
    })
  }, [])

  const handleRemoveFacilityItem = useCallback((id: string) => {
    const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const facilityItems = current.facilityItems ?? DEFAULT_RESERVATION_DRAFT.facilityItems
    if (facilityItems.length <= 1) return
    useOrgStore.getState().patchReservationDraft({
      facilityItems: facilityItems.filter((i) => i.id !== id),
    })
  }, [])

  const handleUpdateFacilityItem = useCallback(
    (id: string, field: keyof FacilityItem, value: string) => {
      let sanitized = value
      if (field === "item" || field === "location") {
        sanitized = value.slice(0, 40)
      }
      const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
      const facilityItems = current.facilityItems ?? DEFAULT_RESERVATION_DRAFT.facilityItems
      useOrgStore.getState().patchReservationDraft({
        facilityItems: facilityItems.map((i) =>
          i.id === id ? { ...i, [field]: sanitized } : i
        ),
      })
    },
    []
  )

  const handleAddRoomItem = useCallback(() => {
    const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
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
          roomNeeded: "",
          remarks: "",
        },
      ],
    })
  }, [])

  const handleRemoveRoomItem = useCallback((id: string) => {
    const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const roomItems = current.roomItems ?? DEFAULT_RESERVATION_DRAFT.roomItems
    if (roomItems.length <= 1) return
    useOrgStore.getState().patchReservationDraft({
      roomItems: roomItems.filter((i) => i.id !== id),
    })
  }, [])

  const handleUpdateRoomItem = useCallback(
    (id: string, field: keyof RoomItem, value: string) => {
      let sanitized = value
      if (field === "roomNeeded" || field === "remarks") {
        sanitized = value.slice(0, 40)
      }
      const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
      const roomItems = current.roomItems ?? DEFAULT_RESERVATION_DRAFT.roomItems
      useOrgStore.getState().patchReservationDraft({
        roomItems: roomItems.map((i) =>
          i.id === id ? { ...i, [field]: sanitized } : i
        ),
      })
    },
    []
  )

  const handleAddAvItem = useCallback(() => {
    const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
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
          equipmentNeeded: "",
          remarks: "",
        },
      ],
    })
  }, [])

  const handleRemoveAvItem = useCallback((id: string) => {
    const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const avItems = current.avItems ?? DEFAULT_RESERVATION_DRAFT.avItems
    if (avItems.length <= 1) return
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
      const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
      const avItems = current.avItems ?? DEFAULT_RESERVATION_DRAFT.avItems
      useOrgStore.getState().patchReservationDraft({
        avItems: avItems.map((i) =>
          i.id === id ? { ...i, [field]: sanitized } : i
        ),
      })
    },
    []
  )

  const handleGoBack = useCallback(() => {
    window.scrollTo(0, 0)
    const query = searchParams.toString()
    navigate(`/students/submissions/saaf${query ? `?${query}` : ""}`)
  }, [navigate, searchParams])

  const validateForm = useCallback((form: HTMLFormElement | null): boolean => {
    if (!form) return false

    const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const missing = [
      [current.purpose, "Purpose"],
      [current.functionRoomPurpose, "Function room"],
      [current.avPurpose, "Audiovisual equipment"],
    ]
      .filter(([value]) => !value?.trim())
      .map(([, label]) => label)

    const isHtmlValid = form.checkValidity()

    if (!isHtmlValid || missing.length > 0) {
      setSubmitError(null)
      setShowErrors(false)
      requestAnimationFrame(() => {
        setShowErrors(true)
      })
      setTimeout(() => {
        const firstInvalid = form.querySelector<HTMLElement>(
          ":invalid, .saaf-glow-invalid"
        )
        if (firstInvalid) {
          firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" })
          firstInvalid.focus?.()
        }
      }, 50)
      return false
    }

    setSubmitError(null)
    setShowErrors(false)
    return true
  }, [])

  const handleClearForm = useCallback(() => {
    useOrgStore.getState().clearReservationDraft()
    setShowErrors(false)
    setShowConfirmClearModal(false)
  }, [])

  const handleInitiateSubmit = useCallback(
    (e: FormEvent | React.MouseEvent, form: HTMLFormElement | null) => {
      e.preventDefault()
      if (validateForm(form)) {
        setShowErrors(false)
        setShowConfirmModal(true)
      }
    },
    [validateForm]
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleConfirmProceed = useCallback(async () => {
    setShowConfirmModal(false)
    const saafDraft = useOrgStore.getState().saafDraft
    const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const currentDraft: ReservationDraft = {
      ...DEFAULT_RESERVATION_DRAFT,
      ...current,
      facilityItems: current.facilityItems ?? DEFAULT_RESERVATION_DRAFT.facilityItems,
      roomItems: current.roomItems ?? DEFAULT_RESERVATION_DRAFT.roomItems,
      avItems: current.avItems ?? DEFAULT_RESERVATION_DRAFT.avItems,
    }

    if (!saafDraft) {
      setSubmitError("SAAF form draft is missing. Please review Step 1.")
      return
    }

    try {
      setIsSubmitting(true)
      setSubmitError(null)
      const editingEventId = useOrgStore.getState().editingEventId
      const editingSubmissionId = useOrgStore.getState().editingSubmissionId
      const payload = buildSaafApiPayload(
        saafDraft,
        currentDraft,
        editingEventId ?? undefined
      )

      if (editingEventId && editingSubmissionId) {
        await updateSubmission.mutateAsync({
          eventId: editingEventId,
          submissionId: editingSubmissionId,
          payload: omitEventIdFromPayload(payload),
        })
      } else {
        await createSubmission.mutateAsync(payload)
      }

      useOrgStore.getState().clearSaafDraft()
      useOrgStore.getState().clearReservationDraft()
      useOrgStore.getState().clearSubmissionStart()
      useOrgStore.getState().clearEditingSubmission()

      setShowSuccessModal(true)
    } catch (error) {
      console.error("Submission failed:", error)
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit reservation proposal"
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [createSubmission, updateSubmission])

  const handleSuccessAction = useCallback(() => {
    setShowSuccessModal(false)
    navigate("/students/dashboard")
  }, [navigate])

  const handleSavePdf = useCallback(() => {
    const saafDraft = useOrgStore.getState().saafDraft ?? DEFAULT_SAAF_DRAFT
    const current = useOrgStore.getState().reservationDraft ?? DEFAULT_RESERVATION_DRAFT
    const currentDraft: ReservationDraft = {
      ...DEFAULT_RESERVATION_DRAFT,
      ...current,
      facilityItems: current.facilityItems ?? DEFAULT_RESERVATION_DRAFT.facilityItems,
      roomItems: current.roomItems ?? DEFAULT_RESERVATION_DRAFT.roomItems,
      avItems: current.avItems ?? DEFAULT_RESERVATION_DRAFT.avItems,
    }

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
      currentDraft
    )
  }, [])

  return {
    draft,
    showConfirmModal,
    showConfirmClearModal,
    showSuccessModal,
    showErrors,
    setShowErrors,
    setShowConfirmClearModal,
    handleClearForm,
    updateField,
    toggleEquipment,
    handleAddFacilityItem,
    handleRemoveFacilityItem,
    handleUpdateFacilityItem,
    handleAddRoomItem,
    handleRemoveRoomItem,
    handleUpdateRoomItem,
    handleAddAvItem,
    handleRemoveAvItem,
    handleUpdateAvItem,
    handleGoBack,
    handleInitiateSubmit,
    handleConfirmProceed,
    handleSuccessAction,
    handleSavePdf,
    setShowConfirmModal,
    isSubmitting,
    submitError,
  }
}