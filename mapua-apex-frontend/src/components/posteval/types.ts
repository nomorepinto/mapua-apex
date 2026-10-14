/**
 * Post-evaluation ("post-eval") draft types.
 *
 * The draft is persisted in the org store (sessionStorage) while the submitter
 * works through the 3-section wizard, then mapped to the API payload by
 * `buildPostEvalApiPayload` in `@/lib/dynamodb-adapters`.
 */

/**
 * A line carried over from the linked submission's approved budget.
 * `item`/`unit`/`quantity`/`budgetedTotal` are read-only; the submitter only
 * enters `actualAmount`.
 */
export interface PostEvalBudgetItem {
  id: string
  item: string
  unit: string
  quantity: string
  budgetedTotal: string
  actualAmount: string
}

/** An extra expense added during the post-eval (not in the initial budget). */
export interface PostEvalAddedItem {
  id: string
  item: string
  unit: string
  quantity: string
  pricePerUnit: string
  actualAmount: string
}

export interface PostEvalFinancialReport {
  budgetItems: PostEvalBudgetItem[]
  addedItems: PostEvalAddedItem[]
}

export interface PostEvalDraft {
  /** apex event id (PK segment of the POSTEVAL item). */
  selectedEventId: string
  /** linked submission id — supplies the initial budget for Section 2. */
  selectedSubmissionId: string
  eventTitle: string
  /** Section 1 — free-text event summary (100–500 chars). */
  summary: string
  /** Section 2 — initial budget vs. actual spend. */
  financialReport: PostEvalFinancialReport
}

export type PostEvalActionData = {
  success?: boolean
  message?: string
  errors?: Record<string, string>
}
