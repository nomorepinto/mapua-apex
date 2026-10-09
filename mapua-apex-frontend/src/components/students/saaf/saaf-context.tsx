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
  STEP_PREFIXES,
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

/**
 * Highest wizard step the saved answers already unlock: the first incomplete
 * SAAF step caps progress, so a restored draft re-earns every step it satisfies
 * instead of leaving the user stranded on step 1.
 */
function earnedStepFromDraft(
  draft: SaafDraft,
  finalStep: WizardStepIndex
): WizardStepIndex {
  let earned: WizardStepIndex = 0
  for (const index of [0, 1, 2, 3] as const) {
    if (!isSaafStepComplete(index, draft)) break
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
  // Highest step reached by clicking Continue. Saved answers unlock steps on
  // their own (see `farthestStep` below), so the wizard allows whichever of the
  // two reaches further.
  const [advancedStep, setAdvancedStep] = useState<WizardStepIndex>(0)

  // Fields the user has left (blurred). A field's inline warning surfaces as
  // soon as an invalid value is in the box, instead of only after a
  // Continue/Submit press. Reset on Clear so a wiped form shows no stale errors.
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const markTouched = useCallback((key: string) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  }, [])

  // The reservation step is present only when the start page chose to reserve
  // facilities. Its draft lives in the same store so the wizard (the parent of
  // ReservationProvider) can gate advancement/submission on it.
  const includeReservation = form.reserveFacilities === "yes"
  const finalStep: WizardStepIndex = includeReservation ? 4 : 3
  const storedReservationDraft = useOrgStore((state) => state.reservationDraft)
  const reservationDraft = withReservationDefaults(storedReservationDraft)

  // Step 5 vanishes whenever `reserveFacilities` resets — notably when the store
  // is cleared right after a successful submit — so the position is clamped to
  // the steps that still exist instead of pointing past the end of the list.
  const step = Math.min(requestedStep, finalStep) as WizardStepIndex

  // The drafts persist in the org store (sessionStorage) but the wizard position
  // does not, so on a reload or an edit-hydration the steps already satisfied by
  // the saved answers stay clickable instead of collapsing back to step 1.
  const farthestStep = Math.min(
    Math.max(advancedStep, earnedStepFromDraft(draft, finalStep)),
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

  const currentStepComplete =
    step === 4
      ? isReservationStepComplete(reservationDraft, draft.activityVenue)
      : isSaafStepComplete(step as SaafStepIndex, draft)

  const formComplete =
    isSaafDraftComplete(draft) &&
    (!includeReservation ||
      isReservationStepComplete(reservationDraft, draft.activityVenue))

  const canClear =
    step === 4
      ? reservationHasUserInput(reservationDraft)
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
        // "Time of event" is a single warning (`timeOfEvent`) but is edited
        // through several nameless selects (start/end hour, minute, period), so
        // the form's blur delegation can't map them to it. Touch the composite
        // key on any of those edits so an out-of-window (7AM–9PM) or mis-ordered
        // time surfaces the moment it is picked, not only after Continue/Submit.
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
        if (step === 4) {
          // On the reservation step, Clear only wipes the reservation draft and
          // stays put; the SAAF answers captured earlier are preserved.
          useOrgStore.getState().clearReservationDraft()
        } else {
          // Clear only the fields belonging to the current step/tab;
          // answers on other tabs are preserved.
          const cleared = getClearedFieldsForSaafStep(step as SaafStepIndex)
          useOrgStore.getState().patchSaafDraft(cleared)
          setAdvancedStep((prev) => Math.min(prev, step) as WizardStepIndex)
        }
        setTouched((prev) => {
          if (step === 4) return prev
          const prefixes = STEP_PREFIXES[step as SaafStepIndex] || []
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
