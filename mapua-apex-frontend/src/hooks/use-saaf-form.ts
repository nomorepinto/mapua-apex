import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react"
import { useFetcher, useNavigation } from "react-router"

import { useScrollToTop } from "@/hooks/use-scroll-to-top"
import { useHydrateEditingSubmission } from "@/hooks/use-hydrate-editing-submission"
import { useCurrentOrganizationQuery } from "@/hooks/use-submissions"
import {
  createEmptyProponent,
  DEFAULT_SAAF_DRAFT,
  MAX_PROPONENTS,
  ONLINE_VENUE,
} from "@/components/submission/constants"
import { withReservationDefaults } from "@/components/reservation/constants"
import type {
  SaafStepIndex,
  WizardStepIndex,
} from "@/components/submission/saaf-stepper"
import type {
  BudgetItem,
  Proponent,
  SaafDraft,
  SubmissionActionData,
} from "@/components/submission/types"
import {
  getReservationStepIssues,
  getSaafStepIssues,
  isStepHtmlValid,
  SAAF_STEP_ISSUES_ID,
  STEP_INVALID_FOCUS_SELECTOR,
} from "@/components/submission/validate-saaf-step"
import {
  calculateRowTotal,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
} from "@/lib/numeric-input"
import { saveProposalPdf } from "@/lib/save-proposal-pdf"
import { useOrgStore } from "@/stores/org-store"

export function useSaafForm() {
  const navigation = useNavigation()
  const fetcher = useFetcher<SubmissionActionData>()
  const reserveFacilities = useOrgStore((state) => state.reserveFacilities)
  const includeReservation = reserveFacilities === "yes"
  useHydrateEditingSubmission()
  const isSubmitting =
    navigation.state === "submitting" || fetcher.state === "submitting"

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showConfirmClearModal, setShowConfirmClearModal] = useState(false)
  const [showErrors, setShowErrorsState] = useState(false)
  // A browser-level violation — `required`, `minLength`, `pattern` — has no
  // `saafFieldWarnings` entry to name it, so a rejected click records that here
  // and the page summary (built by SaafProvider) falls back to a generic line.
  // It belongs to the reveal: hiding the reveal — accepted click, navigation,
  // clear — hides it with it, so it can never outlive the click that found it.
  const [hasHtmlIssue, setHasHtmlIssue] = useState(false)
  const setShowErrors = useCallback((next: boolean) => {
    setShowErrorsState(next)
    if (!next) setHasHtmlIssue(false)
  }, [])
  const [successDismissed, setSuccessDismissed] = useState(false)
  const showSuccessModal = Boolean(fetcher.data?.success) && !successDismissed
  const submitError =
    fetcher.data && fetcher.data.success === false
      ? fetcher.data.message ||
        Object.values(fetcher.data.errors ?? {})[0] ||
        "Failed to submit application. Please try again."
      : null

  // Directly select draft from Zustand with fallback to default. Memoized so the
  // validation callbacks below keep their identity between unrelated renders.
  const saafDraft = useOrgStore((state) => state.saafDraft)
  const eventName = useOrgStore((state) => state.eventName)
  const draft: SaafDraft = useMemo(
    () => ({
      ...DEFAULT_SAAF_DRAFT,
      ...(saafDraft ?? {}),
      activityTitle:
        saafDraft?.activityTitle || eventName || DEFAULT_SAAF_DRAFT.activityTitle,
      proponents: saafDraft?.proponents ?? DEFAULT_SAAF_DRAFT.proponents,
      budgetItems: saafDraft?.budgetItems ?? DEFAULT_SAAF_DRAFT.budgetItems,
      departmentValues:
        saafDraft?.departmentValues ?? DEFAULT_SAAF_DRAFT.departmentValues,
    }),
    [saafDraft, eventName]
  )

  useScrollToTop()

  const currentOrgQuery = useCurrentOrganizationQuery()
  const organizationName = currentOrgQuery.data?.name || ""

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

  // "Name of Organization" is derived from the applying organization rather
  // than typed, so every proponent row is stamped with it. This keeps the
  // payload and PDF correct even for drafts restored from an older session.
  useEffect(() => {
    if (!organizationName) return
    const proponents = draft.proponents
    if (proponents.every((p) => p.orgOrCourseSection === organizationName)) {
      return
    }

    useOrgStore.getState().patchSaafDraft({
      proponents: proponents.map((p) => ({
        ...p,
        orgOrCourseSection: organizationName,
      })),
    })
  }, [organizationName, draft.proponents])

  // Reset drafts on successful submission
  useEffect(() => {
    if (fetcher.data?.success) {
      useOrgStore.getState().clearSaafDraft()
      useOrgStore.getState().clearReservationDraft()
      useOrgStore.getState().clearSubmissionStart()
      useOrgStore.getState().clearEditingSubmission()
    }
  }, [fetcher.data?.success])

  // A physical room reservation cannot happen at an "Online" venue, so when the
  // proponent opted to reserve facilities the venue must be a campus. Clear a
  // stale "Online" value (e.g. chosen before switching to reserve, or restored
  // from a returned paper) so the CDM room catalog is not left empty; the venue
  // selector hides "Online" in this flow too.
  useEffect(() => {
    if (includeReservation && draft.activityVenue === ONLINE_VENUE) {
      useOrgStore.getState().patchSaafDraft({ activityVenue: "" })
    }
  }, [includeReservation, draft.activityVenue])

  const updateField = useCallback(
    <K extends keyof SaafDraft>(key: K, value: SaafDraft[K]) => {
      useOrgStore.getState().patchSaafDraft({ [key]: value })
    },
    []
  )

  const handleAddProponent = useCallback(() => {
    const current = useOrgStore.getState().saafDraft ?? DEFAULT_SAAF_DRAFT
    // Section 2 caps the application at MAX_PROPONENTS proponents; the button
    // is hidden at the limit, so this guard also covers stale callers.
    if (current.proponents.length >= MAX_PROPONENTS) return
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
          unit: "",
          quantity: "",
          pricePerUnit: "",
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
      if (field === "quantity") {
        sanitized = sanitizeIntegerInput(value).slice(0, 7)
      } else if (field === "pricePerUnit") {
        sanitized = sanitizeDecimalInput(value).slice(0, 5)
      } else if (field === "unit") {
        // Unit is a free-text label ("pc", "box", "kg", …), not a number.
        sanitized = value.slice(0, 12)
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

  // Proposed Budget is locked to the itemized Detailed Budget grand total so the
  // summary figure can never disagree with the line items entered later.
  useEffect(() => {
    const next = grandTotal.toFixed(2)
    if ((useOrgStore.getState().saafDraft?.proposedBudget ?? "") !== next) {
      useOrgStore.getState().patchSaafDraft({ proposedBudget: next })
    }
  }, [grandTotal])

  const revealInvalidFields = useCallback((root: ParentNode) => {
    setShowErrors(false)
    requestAnimationFrame(() => {
      setShowErrors(true)
    })
    window.setTimeout(() => {
      // Land the reader on the summary, which names every open field on the
      // page, and still move focus to the first offender without a second
      // viewport jump fighting the summary.
      document
        .getElementById(SAAF_STEP_ISSUES_ID)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
      const firstInvalid = root.querySelector<HTMLElement>(
        STEP_INVALID_FOCUS_SELECTOR
      )
      firstInvalid?.focus({ preventScroll: true })
    }, 50)
  }, [setShowErrors])

  const validateStep = useCallback(
    (step: WizardStepIndex, form: HTMLFormElement | null): boolean => {
      if (!form) return false

      const panel = form.querySelector<HTMLElement>(`[data-saaf-step="${step}"]`)
      const htmlValid = panel ? isStepHtmlValid(panel) : false
      const issues = getSaafStepIssues(
        step as SaafStepIndex,
        draft,
        includeReservation
      )

      // The reservation page additionally owns the catalog picks, which live in
      // the reservation draft and so are not covered by the SAAF field warnings.
      if (includeReservation && step === 2) {
        issues.push(
          ...getReservationStepIssues(
            withReservationDefaults(useOrgStore.getState().reservationDraft),
            draft.activityVenue,
            draft.expectedParticipants
          )
        )
      }

      // The issue list itself is derived by the provider from the live drafts,
      // so this only decides whether the click is accepted and what to reveal.
      if (!htmlValid || issues.length > 0) {
        revealInvalidFields(panel ?? form)
        setHasHtmlIssue(!htmlValid)
        return false
      }

      setShowErrors(false)
      return true
    },
    [draft, includeReservation, revealInvalidFields, setShowErrors]
  )

  // Validates standard HTML5 constraints and specific custom form rules
  const validateForm = useCallback(
    (form: HTMLFormElement | null): boolean => {
      if (!form) return false

      const isHtmlValid = form.checkValidity()
      const steps = includeReservation
        ? ([0, 1, 2, 3, 4] as const)
        : ([0, 1, 2, 3] as const)
      const issues = steps.flatMap((step) =>
        getSaafStepIssues(step, draft, includeReservation)
      )

      // When the wizard includes the reservation step, it must hold at least one
      // item and every room must fit the venue campus before submit is allowed.
      const reservationIssues = includeReservation
        ? getReservationStepIssues(
            withReservationDefaults(useOrgStore.getState().reservationDraft),
            draft.activityVenue,
            draft.expectedParticipants
          )
        : []
      const allIssues = [...issues, ...reservationIssues]

      // A submit is checked against the whole form; the provider then moves the
      // proponent to the first page that still has open items.
      if (!isHtmlValid || allIssues.length > 0) {
        revealInvalidFields(form)
        setHasHtmlIssue(!isHtmlValid)
        return false
      }

      // The remaining rules (date buffer, minimum lengths, digit caps) are all
      // part of `saafFieldWarnings`, so the list above already covers them.
      setShowErrors(false)
      return true
    },
    [draft, includeReservation, revealInvalidFields, setShowErrors]
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
    setShowConfirmClearModal(false)
  }, [setShowErrors])

  const handleInitiateSubmit = useCallback(
    (e: MouseEvent, form: HTMLFormElement | null): boolean => {
      e.preventDefault()
      if (validateForm(form)) {
        setShowConfirmModal(true)
        return true
      }
      return false
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
    hasHtmlIssue,
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
    handleInitiateSubmit,
    handleConfirmProceed,
    handleSavePdf,
    validateStep,
    setShowConfirmModal,
    setShowConfirmClearModal,
    setShowErrors,
    setSuccessDismissed,
  }
}