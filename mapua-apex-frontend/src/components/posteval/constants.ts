import type { PostEvalDraft } from "@/components/posteval/types"

/** Section 1 summary bounds (mirror backend StorePostEvalRequest). */
export const POST_EVAL_SUMMARY_MIN = 100
export const POST_EVAL_SUMMARY_MAX = 500

/** Amount inputs are capped at 5 digits (backend AMOUNT_MAX = 99999). */
export const POST_EVAL_AMOUNT_MAX_DIGITS = 5

/** Wizard steps — 3 fixed sections, no conditional branches. */
export const POST_EVAL_STEPS = [
  { id: "summary", label: "Event Summary" },
  { id: "financial", label: "Financial Report" },
  { id: "participation", label: "Attendance & Evaluation" },
] as const

export type PostEvalStepIndex = 0 | 1 | 2

export const DEFAULT_POST_EVAL_DRAFT: PostEvalDraft = {
  selectedEventId: "",
  selectedSubmissionId: "",
  eventTitle: "",
  summary: "",
  financialReport: {
    budgetItems: [],
    addedItems: [],
  },
}
