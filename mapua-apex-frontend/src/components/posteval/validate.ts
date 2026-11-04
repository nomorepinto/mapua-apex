import {
  POST_EVAL_SUMMARY_MAX,
  POST_EVAL_SUMMARY_MIN,
  type PostEvalStepIndex,
} from "@/components/posteval/constants"
import type { PostEvalDraft } from "@/components/posteval/types"

/** Anchor the issue summary lands on when a Continue/Submit is rejected. */
export const POST_EVAL_STEP_ISSUES_ID = "posteval-step-issues"

/**
 * Section 1 — the summary must be a substantive paragraph. Trimmed length is
 * what the backend counts (`section_summary` 100–500), so pad-only text fails.
 */
function summaryIssues(draft: PostEvalDraft): string[] {
  const length = draft.summary.trim().length
  if (length === 0) return ["Event summary is required."]
  if (length < POST_EVAL_SUMMARY_MIN) {
    return [
      `Event summary must be at least ${POST_EVAL_SUMMARY_MIN} characters (currently ${length}).`,
    ]
  }
  if (length > POST_EVAL_SUMMARY_MAX) {
    return [
      `Event summary must not exceed ${POST_EVAL_SUMMARY_MAX} characters (currently ${length}).`,
    ]
  }
  return []
}

/**
 * Section 2 — carried-over budget lines always have a name, so only added items
 * can be invalid. Each added expense needs a label; amounts may be 0.
 */
function financialIssues(draft: PostEvalDraft): string[] {
  const issues: string[] = []
  draft.financialReport.addedItems.forEach((item, index) => {
    if (!item.item.trim()) {
      issues.push(`Added item ${index + 1} is missing a name.`)
    }
  })
  return issues
}

/** Every open item on one page, each line naming the field. */
export function getPostEvalStepIssues(
  step: PostEvalStepIndex,
  draft: PostEvalDraft,
  includeFinancial = true
): string[] {
  switch (step) {
    case 0:
      return summaryIssues(draft)
    case 1:
      // A no-budget submission has no financial page, so nothing to resolve.
      return includeFinancial ? financialIssues(draft) : []
    case 2:
      // Section 3 is a read-only preview; nothing for the submitter to resolve.
      return []
    default:
      return []
  }
}

export function isPostEvalStepComplete(
  step: PostEvalStepIndex,
  draft: PostEvalDraft,
  includeFinancial = true
): boolean {
  return getPostEvalStepIssues(step, draft, includeFinancial).length === 0
}

export function isPostEvalDraftComplete(
  draft: PostEvalDraft,
  includeFinancial = true
): boolean {
  return (
    isPostEvalStepComplete(0, draft, includeFinancial) &&
    isPostEvalStepComplete(1, draft, includeFinancial)
  )
}

/**
 * The first page that still has open items, or null when the whole draft is
 * ready. Submit uses it to move the reader to the offending page.
 */
export function firstIncompletePostEvalStep(
  draft: PostEvalDraft,
  includeFinancial = true
): PostEvalStepIndex | null {
  for (const step of [0, 1, 2] as const) {
    if (!isPostEvalStepComplete(step, draft, includeFinancial)) return step
  }
  return null
}

/** True when the given step has anything worth clearing. */
export function postEvalStepHasUserInput(
  step: PostEvalStepIndex,
  draft: PostEvalDraft,
  includeFinancial = true
): boolean {
  if (step === 0) return draft.summary.trim().length > 0
  if (step === 1) {
    if (!includeFinancial) return false
    return (
      draft.financialReport.addedItems.length > 0 ||
      draft.financialReport.budgetItems.some((item) => item.actualAmount !== "")
    )
  }
  return false
}
