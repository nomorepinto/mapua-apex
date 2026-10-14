import { CircleAlertIcon } from "lucide-react"

import { AttendanceEvaluationSection } from "@/components/posteval/attendance-evaluation-section"
import { FinancialReportSection } from "@/components/posteval/financial-report-section"
import { SummarySection } from "@/components/posteval/summary-section"
import { POST_EVAL_STEP_ISSUES_ID } from "@/components/posteval/validate"
import { SubmissionErrorAlert } from "@/components/forms/submission-error-alert"
import { PostEvalStepPanel } from "@/components/students/postevals/posteval-form"
import { usePostEvalFormContext } from "@/components/students/postevals/posteval-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { brand } from "@/config"
import { cn } from "@/lib/utils"

// STEP 1: Event Summary (Index 0)
export function PostEvalSummaryStep() {
  const { state, actions } = usePostEvalFormContext()

  return (
    <PostEvalStepPanel index={0}>
      <SummarySection
        value={state.draft.summary}
        onChange={actions.handleSummaryChange}
        showError={state.showErrors}
      />
    </PostEvalStepPanel>
  )
}

// STEP 2: Financial Report (Index 1)
export function PostEvalFinancialStep() {
  const { state, actions } = usePostEvalFormContext()

  return (
    <PostEvalStepPanel index={1}>
      <FinancialReportSection
        budgetItems={state.draft.financialReport.budgetItems}
        addedItems={state.draft.financialReport.addedItems}
        initialGrandTotal={state.initialGrandTotal}
        actualGrandTotal={state.actualGrandTotal}
        isLoading={state.submissionLoading}
        onUpdateBudgetActual={actions.handleUpdateBudgetActual}
        onAddItem={actions.handleAddAddedItem}
        onRemoveItem={actions.handleRemoveAddedItem}
        onUpdateAddedItem={actions.handleUpdateAddedItem}
      />
    </PostEvalStepPanel>
  )
}

// STEP 3: Attendance & Evaluation (Index 2)
export function PostEvalParticipationStep() {
  const { state } = usePostEvalFormContext()

  return (
    <PostEvalStepPanel index={2}>
      <AttendanceEvaluationSection eventId={state.draft.selectedEventId} />
    </PostEvalStepPanel>
  )
}

export function PostEvalSubmitError() {
  const { state } = usePostEvalFormContext()
  if (state.step !== state.finalStep) return null
  return <SubmissionErrorAlert message={state.submitError} />
}

/**
 * What a rejected Continue/Submit says back: every field still open on the
 * page, by name. Rendered above the panels so the click lands the reader here.
 */
export function PostEvalStepIssueSummary() {
  const { state } = usePostEvalFormContext()
  if (state.stepIssues.length === 0) return null

  const heading =
    state.step === state.finalStep
      ? "Resolve these before submitting"
      : "Resolve these before continuing"

  return (
    <Alert variant="error" id={POST_EVAL_STEP_ISSUES_ID}>
      <CircleAlertIcon />
      <AlertTitle>{heading}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {state.stepIssues.map((issue, index) => (
            <li key={`${index}-${issue}`}>{issue}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function PostEvalBackButton() {
  const { state, actions } = usePostEvalFormContext()

  return (
    <button
      type="button"
      onClick={actions.goBack}
      disabled={state.step === 0}
      className={cn(brand.actionGhost, "disabled:opacity-40")}
    >
      Back
    </button>
  )
}

function PostEvalClearButton() {
  const { state, actions } = usePostEvalFormContext()

  return (
    <button
      type="button"
      onClick={actions.openClear}
      disabled={!state.canClear}
      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300/80 bg-white px-5 text-sm font-semibold text-red-600 shadow-xs transition-colors hover:border-red-400 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-40"
    >
      Clear
    </button>
  )
}

function PostEvalContinueActions() {
  const { state, actions } = usePostEvalFormContext()
  if (state.step >= state.finalStep) return null

  return (
    <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <PostEvalBackButton />
        <PostEvalClearButton />
      </div>
      {/* Stays clickable while the page is incomplete: the click is what reveals
          the page summary and flags the offending fields. */}
      <button
        type="button"
        onClick={actions.goNext}
        className={cn(brand.action, !state.currentStepComplete && "opacity-70")}
      >
        Continue
      </button>
    </div>
  )
}

function PostEvalReviewActions() {
  const { state, actions } = usePostEvalFormContext()
  if (state.step !== state.finalStep) return null

  return (
    <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <PostEvalBackButton />
        <PostEvalClearButton />
      </div>
      <button
        type="button"
        onClick={actions.initiateSubmit}
        disabled={state.isSubmitting}
        className={cn(brand.action, !state.formComplete && "opacity-70")}
      >
        {state.isSubmitting ? "Submitting..." : "Submit Post-Evaluation"}
      </button>
    </div>
  )
}

export function PostEvalStepActions() {
  return (
    <>
      <PostEvalContinueActions />
      <PostEvalReviewActions />
    </>
  )
}
