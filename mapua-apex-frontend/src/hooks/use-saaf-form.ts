import { useCallback, useEffect, useState, type MouseEvent } from "react"
import { useFetcher, useNavigate, useNavigation, useSearchParams } from "react-router"

import { useScrollToTop } from "@/hooks/use-scroll-to-top"
import { useHydrateEditingSubmission } from "@/hooks/use-hydrate-editing-submission"
import {
  createEmptyProponent,
  DEFAULT_SAAF_DRAFT,
} from "@/components/submission/constants"
import type { SaafStepIndex } from "@/components/submission/saaf-stepper"
import type {
  BudgetItem,
  Proponent,
  SaafDraft,
  SubmissionActionData,
} from "@/components/submission/types"
import {
  getSaafStepIssue,
  isStepHtmlValid,
  STEP_INVALID_FOCUS_SELECTOR,
} from "@/components/submission/validate-saaf-step"
import {
  calculateRowTotal,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
} from "@/lib/numeric-input"
import { saveProposalPdf } from "@/lib/save-proposal-pdf"
import { EVENT_DATE_TOO_SOON_MESSAGE, minEventDateKey } from "@/lib/date-key"
import { useOrgStore } from "@/stores/org-store"

export function useSaafForm() {
  const navigate = useNavigate()
  const navigation = useNavigation()
  const [searchParams] = useSearchParams()
  const fetcher = useFetcher<SubmissionActionData>()
  const reserveFacilities = useOrgStore((state) => state.reserveFacilities)
  useHydrateEditingSubmission()
  const isSubmitting =
    navigation.state === "submitting" || fetcher.state === "submitting"

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showConfirmClearModal, setShowConfirmClearModal] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [successDismissed, setSuccessDismissed] = useState(false)
  const showSuccessModal = Boolean(fetcher.data?.success) && !successDismissed
  const submitError =
    fetcher.data && fetcher.data.success === false
      ? fetcher.data.message ||
        Object.values(fetcher.data.errors ?? {})[0] ||
        "Failed to submit application. Please try again."
      : null

  // Directly select draft from Zustand with fallback to default
  const saafDraft = useOrgStore((state) => state.saafDraft)
  const draft: SaafDraft = {
    ...DEFAULT_SAAF_DRAFT,
    ...(saafDraft ?? {}),
    proponents: saafDraft?.proponents ?? DEFAULT_SAAF_DRAFT.proponents,
    budgetItems: saafDraft?.budgetItems ?? DEFAULT_SAAF_DRAFT.budgetItems,
    departmentValues:
      saafDraft?.departmentValues ?? DEFAULT_SAAF_DRAFT.departmentValues,
  }

  useScrollToTop()

  // Ensure submission date is always locked to today's date upon opening
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0]
    const current = {
      ...DEFAULT_SAAF_DRAFT,
      ...(useOrgStore.getState().saafDraft ?? {}),
    }
    const proponents = current.proponents ?? DEFAULT_SAAF_DRAFT.proponents
    const needsDateUpdate = proponents.some(
      (p) => p.dateOfSubmission !== today
    )

    if (needsDateUpdate) {
      useOrgStore.getState().patchSaafDraft({
        proponents: proponents.map((p) => ({
          ...p,
          dateOfSubmission: today,
        })),
      })
    }
  }, [])

  // Reset drafts on successful submission
  useEffect(() => {
    if (fetcher.data?.success) {
      useOrgStore.getState().clearSaafDraft()
      useOrgStore.getState().clearReservationDraft()
      useOrgStore.getState().clearSubmissionStart()
      useOrgStore.getState().clearEditingSubmission()
    }
  }, [fetcher.data?.success])

  const updateField = useCallback(
    <K extends keyof SaafDraft>(key: K, value: SaafDraft[K]) => {
      useOrgStore.getState().patchSaafDraft({ [key]: value })
    },
    []
  )

  const handleAddProponent = useCallback(() => {
    const current = useOrgStore.getState().saafDraft ?? DEFAULT_SAAF_DRAFT
    const today = new Date().toISOString().split("T")[0]
    const newProponent = createEmptyProponent(String(Date.now()))
    newProponent.dateOfSubmission = today

    useOrgStore.getState().patchSaafDraft({
      proponents: [...current.proponents, newProponent],
    })
  }, [])

  const handleRemoveProponent = useCallback((id: string) => {
    const current = useOrgStore.getState().saafDraft ?? DEFAULT_SAAF_DRAFT
    if (current.proponents.length === 1) return
    useOrgStore.getState().patchSaafDraft({
      proponents: current.proponents.filter((p) => p.id !== id),
    })
  }, [])

  const handleUpdateProponent = useCallback(
    (id: string, field: keyof Proponent, value: string) => {
      const current = useOrgStore.getState().saafDraft ?? DEFAULT_SAAF_DRAFT
      useOrgStore.getState().patchSaafDraft({
        proponents: current.proponents.map((p) =>
          p.id === id ? { ...p, [field]: value } : p
        ),
      })
    },
    []
  )

  const handleDepartmentChange = useCallback((id: string, value: string) => {
    const current = useOrgStore.getState().saafDraft ?? DEFAULT_SAAF_DRAFT
    useOrgStore.getState().patchSaafDraft({
      departmentValues: { ...current.departmentValues, [id]: value },
    })
  }, [])

  const handleAddBudgetItem = useCallback(() => {
    const current = useOrgStore.getState().saafDraft ?? DEFAULT_SAAF_DRAFT
    useOrgStore.getState().patchSaafDraft({
      budgetItems: [
        ...current.budgetItems,
        {
          id: String(Date.now()),
          item: "",
          unit: "1",
          quantity: "1",
          pricePerUnit: "0",
        },
      ],
    })
  }, [])

  const handleRemoveBudgetItem = useCallback((id: string) => {
    const current = useOrgStore.getState().saafDraft ?? DEFAULT_SAAF_DRAFT
    if (current.budgetItems.length === 1) return
    useOrgStore.getState().patchSaafDraft({
      budgetItems: current.budgetItems.filter((item) => item.id !== id),
    })
  }, [])

  const handleUpdateBudgetItem = useCallback(
    (id: string, field: keyof BudgetItem, value: string) => {
      let sanitized = value
      if (field === "unit" || field === "quantity") {
        sanitized = sanitizeIntegerInput(value).slice(0, 7)
      } else if (field === "pricePerUnit") {
        sanitized = sanitizeDecimalInput(value).slice(0, 8)
      } else if (field === "item") {
        sanitized = value.slice(0, 40)
      }

      const current = useOrgStore.getState().saafDraft ?? DEFAULT_SAAF_DRAFT
      useOrgStore.getState().patchSaafDraft({
        budgetItems: current.budgetItems.map((item) =>
          item.id === id ? { ...item, [field]: sanitized } : item
        ),
      })
    },
    []
  )

  const grandTotal = draft.budgetItems.reduce(
    (sum, item) => sum + calculateRowTotal(item.quantity, item.pricePerUnit),
    0
  )

  const revealInvalidFields = useCallback((root: ParentNode) => {
    setShowErrors(false)
    requestAnimationFrame(() => {
      setShowErrors(true)
    })
    window.setTimeout(() => {
      const firstInvalid = root.querySelector<HTMLElement>(
        STEP_INVALID_FOCUS_SELECTOR
      )
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" })
        firstInvalid.focus?.()
      }
    }, 50)
  }, [])

  const validateStep = useCallback(
    (step: SaafStepIndex, form: HTMLFormElement | null): boolean => {
      if (!form) return false

      const panel = form.querySelector<HTMLElement>(`[data-saaf-step="${step}"]`)
      const htmlValid = panel ? isStepHtmlValid(panel) : false
      const issue = getSaafStepIssue(step, draft)

      if (!htmlValid || issue) {
        revealInvalidFields(panel ?? form)
        setStepError(issue ?? "Fill in every required field on this step before continuing.")
        return false
      }

      setStepError(null)
      setShowErrors(false)
      return true
    },
    [draft, revealInvalidFields]
  )

  // Validates standard HTML5 constraints and specific custom form rules
  const validateForm = useCallback(
    (form: HTMLFormElement | null): boolean => {
      if (!form) return false

      // Check standard constraints
      const isHtmlValid = form.checkValidity()
      const issues = ([0, 1, 2, 3] as const)
        .map((step) => getSaafStepIssue(step, draft))
        .filter((issue): issue is string => Boolean(issue))

      if (!isHtmlValid || issues.length > 0) {
        revealInvalidFields(form)
        setStepError(issues.join(" ") || "Fill in every required field before submitting.")
        return false
      }

      // 3. Date buffer validation (at least 10 days from today)
      const eventDateStr = draft.dateOfEvent
      if (eventDateStr && eventDateStr < minEventDateKey()) {
        setShowErrors(true)
        alert(EVENT_DATE_TOO_SOON_MESSAGE)
        return false
      }

      // 4. Activity details minimum length validations
      if (draft.activityDescription && draft.activityDescription.trim().length < 100) {
        setShowErrors(true)
        alert("Activity Description must be at least 100 characters.")
        return false
      }

      if (draft.activityObjectives && draft.activityObjectives.trim().length < 50) {
        setShowErrors(true)
        alert("Activity Objectives must be at least 50 characters.")
        return false
      }

      if (draft.activityVenue && draft.activityVenue.trim().length < 5) {
        setShowErrors(true)
        alert("Activity Venue must be at least 5 characters.")
        return false
      }

      // 5. Institutional alignment minimum length validations
      if (
        draft.coreValuesExplanation &&
        draft.coreValuesExplanation.trim().length < 30
      ) {
        setShowErrors(true)
        alert("Core Values Explanation must be at least 30 characters.")
        return false
      }

      if (
        draft.peoExplanation &&
        draft.peoExplanation.trim().length > 0 &&
        draft.peoExplanation.trim().length < 30
      ) {
        setShowErrors(true)
        alert("Program Educational Objectives must be at least 30 characters if provided.")
        return false
      }

      if (draft.sdgExplanation && draft.sdgExplanation.trim().length < 30) {
        setShowErrors(true)
        alert("UN Sustainability Goals explanation must be at least 30 characters.")
        return false
      }

      // 6. Total Org Members length guard
      if (draft.totalOrgMembers && draft.totalOrgMembers.length > 5) {
        setShowErrors(true)
        alert("Total number of class/org members cannot exceed 5 digits.")
        return false
      }

      setShowErrors(false)
      setStepError(null)
      return true
    },
    [
      draft.mission1,
      draft.mission2,
      draft.mission3,
      draft.proponents,
      draft.departmentValues,
      draft.dateOfEvent,
      draft.activityDescription,
      draft.activityObjectives,
      draft.activityVenue,
      draft.coreValuesExplanation,
      draft.peoExplanation,
      draft.sdgExplanation,
      draft.totalOrgMembers,
      revealInvalidFields,
    ]
  )

  const handleClearForm = useCallback(() => {
    const today = new Date().toISOString().split("T")[0]
    useOrgStore.getState().setSaafDraft({
      ...DEFAULT_SAAF_DRAFT,
      proponents: [
        {
          ...createEmptyProponent("1"),
          dateOfSubmission: today,
        },
      ],
    })
    setShowErrors(false)
    setStepError(null)
    setShowConfirmClearModal(false)
  }, [])

  const handleGoToReservation = useCallback(
    (form: HTMLFormElement | null) => {
      if (!validateForm(form)) return
      setShowErrors(false)
      useOrgStore.getState().setSaafValidated(true)
      const query = searchParams.toString()
      navigate(`/students/submissions/saaf/reservations${query ? `?${query}` : ""}`)
    },
    [navigate, searchParams, validateForm]
  )

  const handleInitiateSubmit = useCallback(
    (e: MouseEvent, form: HTMLFormElement | null) => {
      e.preventDefault()
      if (validateForm(form)) {
        setShowErrors(false)
        setShowConfirmModal(true)
      }
    },
    [validateForm]
  )

  const handleConfirmProceed = useCallback(
    (form: HTMLFormElement | null) => {
      if (form) fetcher.submit(form)
      setShowConfirmModal(false)
    },
    [fetcher]
  )

  const handleSavePdf = useCallback(() => {
    void saveProposalPdf({
      ...draft,
      proponents: draft.proponents.map((p) => ({
        ...p,
        department: draft.departmentValues[p.id] || p.department,
      })),
    })
  }, [draft])

  return {
    draft,
    fetcher,
    isSubmitting,
    showConfirmModal,
    showConfirmClearModal,
    showSuccessModal,
    showErrors,
    stepError,
    submitError,
    grandTotal,
    reserveFacilities,
    updateField,
    handleAddProponent,
    handleRemoveProponent,
    handleUpdateProponent,
    handleDepartmentChange,
    handleAddBudgetItem,
    handleRemoveBudgetItem,
    handleUpdateBudgetItem,
    handleClearForm,
    handleGoToReservation,
    handleInitiateSubmit,
    handleConfirmProceed,
    handleSavePdf,
    validateStep,
    setShowConfirmModal,
    setShowConfirmClearModal,
    setShowErrors,
    setStepError,
    setSuccessDismissed,
  }
}