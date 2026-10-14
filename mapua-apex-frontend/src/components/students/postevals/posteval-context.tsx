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
  type PostEvalStepIndex,
} from "@/components/posteval/constants"
import type { PostEvalDraft } from "@/components/posteval/types"
import {
  firstIncompletePostEvalStep,
  getPostEvalStepIssues,
  isPostEvalStepComplete,
  postEvalStepHasUserInput,
} from "@/components/posteval/validate"
import { usePostEvalForm } from "@/hooks/use-posteval-form"
import { useOrgStore } from "@/stores/org-store"

type PostEvalFormModel = ReturnType<typeof usePostEvalForm>

const FINAL_STEP: PostEvalStepIndex = 2

interface PostEvalFormState {
  draft: PostEvalDraft
  step: PostEvalStepIndex
  farthestStep: PostEvalStepIndex
  finalStep: PostEvalStepIndex
  showErrors: boolean
  stepIssues: string[]
  submitError: string | null
  isSubmitting: boolean
  submissionLoading: boolean
  showConfirmClearModal: boolean
  showConfirmModal: boolean
  showSuccessModal: boolean
  currentStepComplete: boolean
  formComplete: boolean
  canClear: boolean
  initialGrandTotal: number
  actualGrandTotal: number
}

interface PostEvalFormActions {
  goToStep: (next: PostEvalStepIndex) => void
  goNext: () => void
  goBack: () => void
  updateField: PostEvalFormModel["updateField"]
  handleSummaryChange: PostEvalFormModel["handleSummaryChange"]
  handleUpdateBudgetActual: PostEvalFormModel["handleUpdateBudgetActual"]
  handleAddAddedItem: PostEvalFormModel["handleAddAddedItem"]
  handleRemoveAddedItem: PostEvalFormModel["handleRemoveAddedItem"]
  handleUpdateAddedItem: PostEvalFormModel["handleUpdateAddedItem"]
  openClear: () => void
  closeClear: () => void
  confirmClear: () => void
  closeConfirm: () => void
  initiateSubmit: (event: MouseEvent) => void
  confirmProceed: () => void
  dismissSuccess: () => void
  attachForm: (node: HTMLFormElement | null) => void
}

interface PostEvalFormMeta {
  Form: PostEvalFormModel["fetcher"]["Form"]
}

export interface PostEvalFormContextValue {
  state: PostEvalFormState
  actions: PostEvalFormActions
  meta: PostEvalFormMeta
}

const PostEvalFormContext = createContext<PostEvalFormContextValue | null>(null)

/**
 * How far the submitter has earned: the first page whose predecessors are all
 * complete. Lets a restored draft jump straight to its last open section.
 */
function earnedStepFromDraft(draft: PostEvalDraft): PostEvalStepIndex {
  let earned: PostEvalStepIndex = 0
  for (const index of [0, 1, 2] as const) {
    if (!isPostEvalStepComplete(index, draft)) break
    earned = Math.min(index + 1, FINAL_STEP) as PostEvalStepIndex
  }
  return earned
}

export function usePostEvalFormContext() {
  const value = use(PostEvalFormContext)
  if (!value) {
    throw new Error(
      "usePostEvalFormContext must be used within PostEvalProvider"
    )
  }
  return value
}

export function PostEvalProvider({ children }: { children: ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  const form = usePostEvalForm()
  const { draft } = form
  const [requestedStep, setStep] = useState<PostEvalStepIndex>(0)
  const [advancedStep, setAdvancedStep] = useState<PostEvalStepIndex>(0)

  const step = requestedStep
  const farthestStep = Math.min(
    Math.max(advancedStep, earnedStepFromDraft(draft)),
    FINAL_STEP
  ) as PostEvalStepIndex

  const unresolvedStepIssues = (targetStep: PostEvalStepIndex): string[] =>
    getPostEvalStepIssues(targetStep, draft)

  const goToStep = (next: PostEvalStepIndex) => {
    if (next === step) return
    if (next > farthestStep) {
      // Never skip past a page that still has open items: land the submitter on
      // the blocker and reveal it instead of silently ignoring the click.
      const blocker = firstIncompletePostEvalStep(draft) ?? next
      if (blocker !== step) setStep(blocker)
      form.validateStep(blocker)
      return
    }
    if (next > step && !form.validateStep(step)) return
    if (next < step) form.setShowErrors(false)
    setStep(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const goNext = () => {
    if (!form.validateStep(step)) return
    if (step >= FINAL_STEP) return
    const next = (step + 1) as PostEvalStepIndex
    setAdvancedStep((current) => (next > current ? next : current))
    setStep(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const goBack = () => {
    if (step === 0) return
    goToStep((step - 1) as PostEvalStepIndex)
  }

  const currentStepComplete = isPostEvalStepComplete(step, draft)
  const canClear = postEvalStepHasUserInput(step, draft)

  const confirmClear = useCallback(() => {
    const current = useOrgStore.getState().postEvalDraft
    if (step === 0) {
      useOrgStore.getState().patchPostEvalDraft({ summary: "" })
    } else if (step === 1) {
      // Reset the actual amounts and drop any added items, keeping the read-only
      // budget lines seeded from the submission.
      const budgetItems = (current?.financialReport.budgetItems ?? []).map(
        (item) => ({ ...item, actualAmount: "" })
      )
      useOrgStore
        .getState()
        .patchPostEvalDraft({ financialReport: { budgetItems, addedItems: [] } })
    }
    form.setShowErrors(false)
    form.setShowConfirmClearModal(false)
  }, [form, step])

  const value: PostEvalFormContextValue = {
    state: {
      draft,
      step,
      farthestStep,
      finalStep: FINAL_STEP,
      showErrors: form.showErrors,
      stepIssues: form.showErrors ? unresolvedStepIssues(step) : [],
      submitError: form.submitError,
      isSubmitting: form.isSubmitting,
      submissionLoading: form.submissionLoading,
      showConfirmClearModal: form.showConfirmClearModal,
      showConfirmModal: form.showConfirmModal,
      showSuccessModal: form.showSuccessModal,
      currentStepComplete,
      formComplete: form.formComplete,
      canClear,
      initialGrandTotal: form.initialGrandTotal,
      actualGrandTotal: form.actualGrandTotal,
    },
    actions: {
      goToStep,
      goNext,
      goBack,
      updateField: form.updateField,
      handleSummaryChange: form.handleSummaryChange,
      handleUpdateBudgetActual: form.handleUpdateBudgetActual,
      handleAddAddedItem: form.handleAddAddedItem,
      handleRemoveAddedItem: form.handleRemoveAddedItem,
      handleUpdateAddedItem: form.handleUpdateAddedItem,
      openClear: () => form.setShowConfirmClearModal(true),
      closeClear: () => form.setShowConfirmClearModal(false),
      confirmClear,
      closeConfirm: () => form.setShowConfirmModal(false),
      initiateSubmit: (event) => {
        if (form.handleInitiateSubmit(event)) return
        // Submit checks every page, so a rejection is usually about another
        // page. Move there and reveal it rather than listing other pages' fields.
        const blocker = firstIncompletePostEvalStep(draft)
        if (blocker === null || blocker === step) return
        setStep(blocker)
        form.validateStep(blocker)
      },
      confirmProceed: () => form.handleConfirmProceed(formRef.current),
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

  return (
    <PostEvalFormContext value={value}>{children}</PostEvalFormContext>
  )
}
