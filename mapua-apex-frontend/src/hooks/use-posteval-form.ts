import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react"
import { useFetcher, useNavigation } from "react-router"

import {
  DEFAULT_POST_EVAL_DRAFT,
  POST_EVAL_AMOUNT_MAX_DIGITS,
  POST_EVAL_SUMMARY_MAX,
  type PostEvalStepIndex,
} from "@/components/posteval/constants"
import type {
  PostEvalActionData,
  PostEvalAddedItem,
  PostEvalBudgetItem,
  PostEvalDraft,
} from "@/components/posteval/types"
import {
  getPostEvalStepIssues,
  isPostEvalDraftComplete,
} from "@/components/posteval/validate"
import { useSubmissionDetailQuery } from "@/hooks/use-submissions"
import { sanitizeDecimalInput, sanitizeIntegerInput } from "@/lib/numeric-input"
import { useOrgStore } from "@/stores/org-store"

/**
 * Form model for the 3-section post-eval wizard. Mirrors `useSaafForm` but far
 * simpler: no reservation branch, no proponents, no PDF. The draft lives in the
 * org store (sessionStorage) so a refresh keeps the submitter's work; the linked
 * submission seeds the read-only budget lines for Section 2.
 */
export function usePostEvalForm() {
  const navigation = useNavigation()
  const fetcher = useFetcher<PostEvalActionData>()
  const isSubmitting =
    navigation.state === "submitting" || fetcher.state === "submitting"

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showConfirmClearModal, setShowConfirmClearModal] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [successDismissed, setSuccessDismissed] = useState(false)
  const showSuccessModal = Boolean(fetcher.data?.success) && !successDismissed
  const submitError =
    fetcher.data && fetcher.data.success === false
      ? fetcher.data.message ||
        "Failed to submit post-evaluation. Please try again."
      : null

  const storedDraft = useOrgStore((state) => state.postEvalDraft)
  const draft: PostEvalDraft = useMemo(
    () => ({
      ...DEFAULT_POST_EVAL_DRAFT,
      ...(storedDraft ?? {}),
      financialReport: {
        ...DEFAULT_POST_EVAL_DRAFT.financialReport,
        ...(storedDraft?.financialReport ?? {}),
      },
    }),
    [storedDraft]
  )

  const eventId = draft.selectedEventId
  const submissionId = draft.selectedSubmissionId
  const submissionQuery = useSubmissionDetailQuery(eventId, submissionId)

  // Seed Section 2's read-only budget lines from the linked submission the first
  // time the wizard opens for an event. Guarded so it never overwrites amounts
  // the submitter has already entered, and never loops (the store patch does not
  // change `submissionQuery.data` or `eventId`).
  useEffect(() => {
    const submission = submissionQuery.data
    if (!submission) return
    const current = useOrgStore.getState().postEvalDraft
    if (!current || current.selectedEventId !== eventId) return
    if (current.financialReport?.budgetItems?.length) return

    const items = submission.detailed_budget_proposal?.items ?? []
    if (items.length === 0) return

    const budgetItems: PostEvalBudgetItem[] = items.map((item, index) => ({
      id: `budget-${index}`,
      item: item.item_no || String(index + 1),
      unit: String(item.unit ?? "pc"),
      quantity: String(item.quantity ?? 0),
      budgetedTotal: String(
        typeof item.total === "number"
          ? item.total
          : (Number(item.quantity) || 0) * (Number(item.price_per_unit) || 0)
      ),
      actualAmount: "",
    }))
    useOrgStore
      .getState()
      .patchPostEvalDraft({ financialReport: { budgetItems } })
  }, [submissionQuery.data, eventId])

  // Reset the draft once the action reports success, so a re-open starts clean.
  useEffect(() => {
    if (fetcher.data?.success) {
      useOrgStore.getState().clearPostEvalDraft()
    }
  }, [fetcher.data?.success])

  const updateField = useCallback(
    <K extends keyof PostEvalDraft>(key: K, value: PostEvalDraft[K]) => {
      useOrgStore.getState().patchPostEvalDraft({ [key]: value })
    },
    []
  )

  const handleSummaryChange = useCallback((value: string) => {
    useOrgStore
      .getState()
      .patchPostEvalDraft({ summary: value.slice(0, POST_EVAL_SUMMARY_MAX) })
  }, [])

  const handleUpdateBudgetActual = useCallback((id: string, value: string) => {
    const current = useOrgStore.getState().postEvalDraft ?? DEFAULT_POST_EVAL_DRAFT
    const budgetItems = current.financialReport.budgetItems.map((item) =>
      item.id === id
        ? {
            ...item,
            actualAmount: sanitizeDecimalInput(value).slice(
              0,
              POST_EVAL_AMOUNT_MAX_DIGITS
            ),
          }
        : item
    )
    useOrgStore.getState().patchPostEvalDraft({ financialReport: { budgetItems } })
  }, [])

  const handleAddAddedItem = useCallback(() => {
    const current = useOrgStore.getState().postEvalDraft ?? DEFAULT_POST_EVAL_DRAFT
    const addedItems: PostEvalAddedItem[] = [
      ...current.financialReport.addedItems,
      {
        id: String(Date.now()),
        item: "",
        unit: "",
        quantity: "",
        pricePerUnit: "",
        actualAmount: "",
      },
    ]
    useOrgStore.getState().patchPostEvalDraft({ financialReport: { addedItems } })
  }, [])

  const handleRemoveAddedItem = useCallback((id: string) => {
    const current = useOrgStore.getState().postEvalDraft ?? DEFAULT_POST_EVAL_DRAFT
    const addedItems = current.financialReport.addedItems.filter(
      (item) => item.id !== id
    )
    useOrgStore.getState().patchPostEvalDraft({ financialReport: { addedItems } })
  }, [])

  const handleUpdateAddedItem = useCallback(
    (id: string, field: keyof PostEvalAddedItem, value: string) => {
      let sanitized = value
      if (field === "quantity") {
        sanitized = sanitizeIntegerInput(value).slice(0, 7)
      } else if (field === "pricePerUnit" || field === "actualAmount") {
        sanitized = sanitizeDecimalInput(value).slice(0, POST_EVAL_AMOUNT_MAX_DIGITS)
      } else if (field === "unit") {
        sanitized = value.slice(0, 12)
      } else if (field === "item") {
        sanitized = value.slice(0, 40)
      }

      const current = useOrgStore.getState().postEvalDraft ?? DEFAULT_POST_EVAL_DRAFT
      const addedItems = current.financialReport.addedItems.map((item) =>
        item.id === id ? { ...item, [field]: sanitized } : item
      )
      useOrgStore.getState().patchPostEvalDraft({ financialReport: { addedItems } })
    },
    []
  )

  const initialGrandTotal = draft.financialReport.budgetItems.reduce(
    (sum, item) => sum + (Number(item.budgetedTotal) || 0),
    0
  )
  const actualGrandTotal =
    draft.financialReport.budgetItems.reduce(
      (sum, item) => sum + (Number(item.actualAmount) || 0),
      0
    ) +
    draft.financialReport.addedItems.reduce(
      (sum, item) => sum + (Number(item.actualAmount) || 0),
      0
    )

  const validateStep = useCallback(
    (step: PostEvalStepIndex): boolean => {
      if (getPostEvalStepIssues(step, draft).length > 0) {
        setShowErrors(true)
        return false
      }
      setShowErrors(false)
      return true
    },
    [draft]
  )

  const validateForm = useCallback((): boolean => {
    const issues = ([0, 1, 2] as const).flatMap((step) =>
      getPostEvalStepIssues(step, draft)
    )
    if (issues.length > 0) {
      setShowErrors(true)
      return false
    }
    setShowErrors(false)
    return true
  }, [draft])

  const handleInitiateSubmit = useCallback(
    (e: MouseEvent): boolean => {
      e.preventDefault()
      if (validateForm()) {
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
      else fetcher.submit({}, { method: "post" })
      setShowConfirmModal(false)
    },
    [fetcher]
  )

  return {
    draft,
    fetcher,
    isSubmitting,
    showConfirmModal,
    showConfirmClearModal,
    showSuccessModal,
    showErrors,
    submitError,
    initialGrandTotal,
    actualGrandTotal,
    formComplete: isPostEvalDraftComplete(draft),
    submissionLoading: submissionQuery.isPending,
    updateField,
    handleSummaryChange,
    handleUpdateBudgetActual,
    handleAddAddedItem,
    handleRemoveAddedItem,
    handleUpdateAddedItem,
    handleInitiateSubmit,
    handleConfirmProceed,
    validateStep,
    setShowConfirmModal,
    setShowConfirmClearModal,
    setShowErrors,
    setSuccessDismissed,
  }
}
