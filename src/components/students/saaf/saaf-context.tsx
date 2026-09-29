/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react"
import { use } from "react"

import { saafHasUserInput } from "@/components/submission/constants"
import type { SaafStepIndex } from "@/components/submission/saaf-stepper"
import type { SaafDraft } from "@/components/submission/types"
import {
  isSaafDraftComplete,
  isSaafStepComplete,
} from "@/components/submission/validate-saaf-step"
import { useSaafForm } from "@/hooks/use-saaf-form"

type SaafFormModel = ReturnType<typeof useSaafForm>

interface SaafFormState {
  draft: SaafDraft
  step: SaafStepIndex
  farthestStep: SaafStepIndex
  showErrors: boolean
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
  goToStep: (next: SaafStepIndex) => void
  goNext: () => void
  goBack: () => void
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
  goToReservation: () => void
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

export function useSaafFormContext() {
  const value = use(SaafFormContext)
  if (!value) {
    throw new Error("useSaafFormContext must be used within SaafProvider")
  }
  return value
}

export function SaafProvider({ children }: { children: ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null)
  const form = useSaafForm()
  const { draft } = form
  const [step, setStep] = useState<SaafStepIndex>(0)
  const [farthestStep, setFarthestStep] = useState<SaafStepIndex>(0)

  const goToStep = (next: SaafStepIndex) => {
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
    if (step >= 3) return
    const next = (step + 1) as SaafStepIndex
    setFarthestStep((current) => (next > current ? next : current))
    setStep(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const goBack = () => {
    if (step === 0) return
    goToStep((step - 1) as SaafStepIndex)
  }

  const value: SaafFormContextValue = {
    state: {
      draft,
      step,
      farthestStep,
      showErrors: form.showErrors,
      submitError: form.submitError,
      isSubmitting: form.isSubmitting,
      reserveFacilities: form.reserveFacilities,
      showConfirmClearModal: form.showConfirmClearModal,
      showConfirmModal: form.showConfirmModal,
      showSuccessModal: form.showSuccessModal,
      currentStepComplete: isSaafStepComplete(step, draft),
      formComplete: isSaafDraftComplete(draft),
      canClear: saafHasUserInput(draft),
      grandTotal: form.grandTotal,
    },
    actions: {
      goToStep,
      goNext,
      goBack,
      updateField: form.updateField,
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
        form.handleClearForm()
        setStep(0)
        setFarthestStep(0)
      },
      closeConfirm: () => form.setShowConfirmModal(false),
      initiateSubmit: (event) =>
        form.handleInitiateSubmit(event, formRef.current),
      confirmProceed: () => form.handleConfirmProceed(formRef.current),
      goToReservation: () => form.handleGoToReservation(formRef.current),
      savePdf: form.handleSavePdf,
      dismissSuccess: () => {
        form.setSuccessDismissed(true)
        window.location.reload()
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
