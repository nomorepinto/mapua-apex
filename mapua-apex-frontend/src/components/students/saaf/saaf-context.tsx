/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react"
import { use } from "react"
import { useNavigate } from "react-router"

import {
  reservationHasUserInput,
  withReservationDefaults,
} from "@/components/reservation/constants"
import {
  getClearedFieldsForSaafStep,
  saafStepHasUserInput,
} from "@/components/submission/constants"
import type {
  SaafStepIndex,
  WizardStepIndex,
} from "@/components/submission/saaf-stepper"
import type { SaafDraft } from "@/components/submission/types"
import {
  isReservationStepComplete,
  isSaafDraftComplete,
  isSaafStepComplete,
  STEP_PREFIXES_WITH_RESERVATION,
  STEP_PREFIXES_NO_RESERVATION,
} from "@/components/submission/validate-saaf-step"
import { useSaafForm } from "@/hooks/use-saaf-form"
import { useOrgStore } from "@/stores/org-store"

type SaafFormModel = ReturnType<typeof useSaafForm>

interface SaafFormState {
  draft: SaafDraft
  step: WizardStepIndex
  farthestStep: WizardStepIndex
  finalStep: WizardStepIndex
  includeReservation: boolean
  showErrors: boolean
  touched: Record<string, boolean>
  stepError: string | null
  submitError: string | null
  isSubmitting: boolean
  reserveFacilities: SaafFormModel["reserveFacilities"]
  showConfirmClearModal: boolean
  showConfirmModal: boolean
  showSuccessModal: boolean
  currentStepComplete: boolean
  formComplete: boolean
  canClear: boolean
  grandTotal: SaafFormModel["grandTotal"]
}

interface SaafFormActions {
  goToStep: (next: WizardStepIndex) => void
  goNext: () => void
  goBack: () => void
  markTouched: (key: string) => void
  updateField: SaafFormModel["updateField"]
  handleUpdateProponent: SaafFormModel["handleUpdateProponent"]
  handleRemoveProponent: SaafFormModel["handleRemoveProponent"]
  handleAddProponent: SaafFormModel["handleAddProponent"]
  handleDepartmentChange: SaafFormModel["handleDepartmentChange"]
  handleUpdateBudgetItem: SaafFormModel["handleUpdateBudgetItem"]
  handleRemoveBudgetItem: SaafFormModel["handleRemoveBudgetItem"]
  handleAddBudgetItem: SaafFormModel["handleAddBudgetItem"]
  openClear: () => void
  closeClear: () => void
  confirmClear: () => void
  closeConfirm: () => void
  initiateSubmit: (event: MouseEvent) => void
  confirmProceed: () => void
  savePdf: SaafFormModel["handleSavePdf"]
  dismissSuccess: () => void
  attachForm: (node: HTMLFormElement | null) => void
}

interface SaafFormMeta {
  Form: SaafFormModel["fetcher"]["Form"]
}

export interface SaafFormContextValue {
  state: SaafFormState
  actions: SaafFormActions
  meta: SaafFormMeta
}

const SaafFormContext = createContext<SaafFormContextValue | null>(null)

function earnedStepFromDraft(
  draft: SaafDraft,
  finalStep: WizardStepIndex,
  includeReservation: boolean,
  reservationDraft: any
): WizardStepIndex {
  let earned: WizardStepIndex = 0
  const stepsToCheck = includeReservation
    ? ([0, 1, 2, 3, 4] as const)
    : ([0, 1, 2, 3] as const)

  for (const index of stepsToCheck) {
    if (includeReservation && index === 2) {
      if (!isReservationStepComplete(reservationDraft, draft.activityVenue) ||
        !isSaafStepComplete(2, draft, true)) {
        break
      }
    } else {
      if (!isSaafStepComplete(index as SaafStepIndex, draft, includeReservation)) {
        break
      }
    }
    earned = Math.min(index + 1, finalStep) as WizardStepIndex
  }
  return earned
}

export function useSaafFormContext() {
  const value = use(SaafFormContext)
  if (!value) {
    throw new Error("useSaafFormContext must be used within SaafProvider")
  }
  return value
}

export function SaafProvider({ children }: { children: ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  const form = useSaafForm()
  const { draft } = form
  const [requestedStep, setStep] = useState<WizardStepIndex>(0)
  const [advancedStep, setAdvancedStep] = useState<WizardStepIndex>(0)

  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const markTouched = useCallback((key: string) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  }, [])

  const includeReservation = form.reserveFacilities === "yes"
  const finalStep: WizardStepIndex = includeReservation ? 4 : 3
  const storedReservationDraft = useOrgStore((state) => state.reservationDraft)
  const reservationDraft = withReservationDefaults(storedReservationDraft)

  const step = Math.min(requestedStep, finalStep) as WizardStepIndex

  const farthestStep = Math.min(
    Math.max(
      advancedStep,
      earnedStepFromDraft(draft, finalStep, includeReservation, reservationDraft)
    ),
    finalStep
  ) as WizardStepIndex

  const goToStep = (next: WizardStepIndex) => {
    if (next === step || next > farthestStep) return
    if (next > step && !form.validateStep(step, formRef.current)) return
    if (next < step) {
      form.setShowErrors(false)
      form.setStepError(null)
    }
    setStep(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const goNext = () => {
    if (!form.validateStep(step, formRef.current)) return
    if (step >= finalStep) return
    const next = (step + 1) as WizardStepIndex
    setAdvancedStep((current) => (next > current ? next : current))
    setStep(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const goBack = () => {
    if (step === 0) return
    goToStep((step - 1) as WizardStepIndex)
  }

  // Step 2 is Reservation when includeReservation is true
  const currentStepComplete =
    includeReservation && step === 2
      ? isReservationStepComplete(reservationDraft, draft.activityVenue) &&
      isSaafStepComplete(2, draft, true) &&
      !form.stepError
      : isSaafStepComplete(step as SaafStepIndex, draft, includeReservation)

  const formComplete =
    isSaafDraftComplete(draft, includeReservation) &&
    (!includeReservation ||
      (isReservationStepComplete(reservationDraft, draft.activityVenue) &&
        !form.stepError))

  const canClear =
    includeReservation && step === 2
      ? reservationHasUserInput(reservationDraft) || saafStepHasUserInput(2 as SaafStepIndex, draft)
      : saafStepHasUserInput(step as SaafStepIndex, draft)

  const value: SaafFormContextValue = {
    state: {
      draft,
      step,
      farthestStep,
      finalStep,
      includeReservation,
      showErrors: form.showErrors,
      touched,
      stepError: form.stepError,
      submitError: form.submitError,
      isSubmitting: form.isSubmitting,
      reserveFacilities: form.reserveFacilities,
      showConfirmClearModal: form.showConfirmClearModal,
      showConfirmModal: form.showConfirmModal,
      showSuccessModal: form.showSuccessModal,
      currentStepComplete,
      formComplete,
      canClear,
      grandTotal: form.grandTotal,
    },
    actions: {
      goToStep,
      goNext,
      goBack,
      markTouched,
      updateField: <K extends keyof SaafDraft>(key: K, value: SaafDraft[K]) => {
        form.updateField(key, value)
        if (typeof key === "string" && key.startsWith("timeOfEvent")) {
          markTouched("timeOfEvent")
        }
      },
      handleUpdateProponent: form.handleUpdateProponent,
      handleRemoveProponent: form.handleRemoveProponent,
      handleAddProponent: form.handleAddProponent,
      handleDepartmentChange: form.handleDepartmentChange,
      handleUpdateBudgetItem: form.handleUpdateBudgetItem,
      handleRemoveBudgetItem: form.handleRemoveBudgetItem,
      handleAddBudgetItem: form.handleAddBudgetItem,
      openClear: () => form.setShowConfirmClearModal(true),
      closeClear: () => form.setShowConfirmClearModal(false),
      confirmClear: () => {
        if (includeReservation && step === 2) {
          useOrgStore.getState().clearReservationDraft()
        }
        const cleared = getClearedFieldsForSaafStep(step as SaafStepIndex)
        useOrgStore.getState().patchSaafDraft(cleared)
        setAdvancedStep((prev) => Math.min(prev, step) as WizardStepIndex)

        setTouched((prev) => {
          const map = includeReservation
            ? STEP_PREFIXES_WITH_RESERVATION
            : STEP_PREFIXES_NO_RESERVATION
          const prefixes = map[step as SaafStepIndex] || []
          const next = { ...prev }
          for (const key of Object.keys(next)) {
            if (prefixes.some((p) => key === p || key.startsWith(p))) {
              delete next[key]
            }
          }
          return next
        })
        form.setStepError(null)
        form.setShowErrors(false)
        form.setShowConfirmClearModal(false)
      },
      closeConfirm: () => form.setShowConfirmModal(false),
      initiateSubmit: (event) =>
        form.handleInitiateSubmit(event, formRef.current),
      confirmProceed: () => form.handleConfirmProceed(formRef.current),
      savePdf: form.handleSavePdf,
      dismissSuccess: () => {
        form.setSuccessDismissed(true)
        navigate("/students/dashboard")
      },
      attachForm: (node) => {
        formRef.current = node
      },
    },
    meta: {
      Form: form.fetcher.Form,
    },
  }

  return <SaafFormContext value={value}>{children}</SaafFormContext>
}