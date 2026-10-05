import { CircleAlertIcon } from "lucide-react"

import { ActivityClassificationSection } from "@/components/submission/activity-classification-section"
import { ActivityDetailsSection } from "@/components/submission/activity-details-section"
import { BudgetProposalSection } from "@/components/submission/budget-proposal-section"
import { CollaboratorsSection } from "@/components/submission/collaborators-section"
import { InstitutionalAlignmentSection } from "@/components/submission/institutional-alignment-section"
import { ProponentsSection } from "@/components/submission/proponents-section"
import { SubmissionActions } from "@/components/submission/submission-actions"
import { SubmissionErrorAlert } from "@/components/forms/submission-error-alert"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ReservationFields } from "@/components/students/reservations/reservation-form"
import { useReservationFormContext } from "@/components/students/reservations/reservation-context"
import { SaafStepPanel } from "@/components/students/saaf/saaf-form"
import { useSaafFormContext } from "@/components/students/saaf/saaf-context"
import { brand } from "@/config"
import { cn } from "@/lib/utils"

export function SaafClassificationStep() {
  const { state, actions } = useSaafFormContext()
  const { draft } = state

  return (
    <SaafStepPanel index={0}>
      <ActivityClassificationSection
        activityType={draft.activityType}
        totalOrgMembers={draft.totalOrgMembers}
        onActivityTypeChange={(value) => actions.updateField("activityType", value)}
        onTotalOrgMembersChange={(value) =>
          actions.updateField("totalOrgMembers", value)
        }
      />
    </SaafStepPanel>
  )
}

export function SaafPeopleStep() {
  const { state, actions } = useSaafFormContext()
  const { draft } = state

  return (
    <SaafStepPanel index={1}>
      <ProponentsSection
        proponents={draft.proponents}
        departmentValues={draft.departmentValues}
        onUpdate={actions.handleUpdateProponent}
        onRemove={actions.handleRemoveProponent}
        onAdd={actions.handleAddProponent}
        onDepartmentChange={actions.handleDepartmentChange}
      />
      <CollaboratorsSection
        value={draft.dependentOrgs}
        onChange={(ids) => actions.updateField("dependentOrgs", ids)}
      />
    </SaafStepPanel>
  )
}

export function SaafActivityStep() {
  const { state, actions } = useSaafFormContext()

  return (
    <SaafStepPanel index={2}>
      <ActivityDetailsSection values={state.draft} onChange={actions.updateField} />
    </SaafStepPanel>
  )
}

export function SaafAlignmentStep() {
  const { state, actions } = useSaafFormContext()

  return (
    <SaafStepPanel index={3}>
      <InstitutionalAlignmentSection
        values={state.draft}
        onChange={actions.updateField}
      />
      <BudgetProposalSection
        items={state.draft.budgetItems}
        grandTotal={state.grandTotal}
        onUpdate={actions.handleUpdateBudgetItem}
        onRemove={actions.handleRemoveBudgetItem}
        onAdd={actions.handleAddBudgetItem}
      />
    </SaafStepPanel>
  )
}

export function SaafReservationStep() {
  const { state } = useSaafFormContext()
  if (!state.includeReservation) return null

  return (
    <SaafStepPanel index={4}>
      <ReservationFields />
    </SaafStepPanel>
  )
}

export function SaafSubmitError() {
  const { state } = useSaafFormContext()
  if (state.step !== state.finalStep) return null
  return <SubmissionErrorAlert message={state.submitError} />
}

function SaafStepError() {
  const { state } = useSaafFormContext()
  if (!state.stepError) return null

  return (
    <Alert variant="error">
      <CircleAlertIcon />
      <AlertDescription>{state.stepError}</AlertDescription>
    </Alert>
  )
}

function SaafBackButton() {
  const { state, actions } = useSaafFormContext()

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

function SaafClearButton() {
  const { state, actions } = useSaafFormContext()

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

function SaafContinueActions() {
  const { state, actions } = useSaafFormContext()
  if (state.step >= state.finalStep) return null

  return (
    <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SaafBackButton />
        <SaafClearButton />
      </div>
      <button
        type="button"
        onClick={actions.goNext}
        aria-disabled={!state.currentStepComplete}
        className={cn(
          brand.action,
          !state.currentStepComplete && "cursor-not-allowed opacity-40"
        )}
      >
        Continue
      </button>
    </div>
  )
}

function SaafReviewActions() {
  const { state, actions } = useSaafFormContext()
  const { actions: reservationActions } = useReservationFormContext()
  if (state.step !== state.finalStep) return null

  // On the reservation step the full-proposal PDF (SAAF + reservation) is the
  // meaningful export; otherwise the SAAF-only variant is used.
  const onSavePdf = state.includeReservation
    ? reservationActions.handleSavePdf
    : actions.savePdf

  return (
    <div className="space-y-3">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={actions.goBack} className={brand.actionGhost}>
          Back
        </button>
        <SaafClearButton />
      </div>
      <SubmissionActions
        isSubmitting={state.isSubmitting}
        inactive={!state.formComplete}
        onSavePdf={onSavePdf}
        onSubmit={actions.initiateSubmit}
      />
    </div>
  )
}

export function SaafStepActions() {
  return (
    <>
      <SaafStepError />
      <SaafContinueActions />
      <SaafReviewActions />
    </>
  )
}
