import { useMemo, useState, type FormEvent } from "react"
import { CircleAlertIcon, PlusIcon } from "lucide-react"

import { useAdminDashboard } from "@/components/admin/dashboard/admin-dashboard-context"
import { FieldWarnings } from "@/components/forms/field-warning"
import { ActivityClassificationSection } from "@/components/submission/activity-classification-section"
import { ActivityDetailsSection } from "@/components/submission/activity-details-section"
import { BudgetProposalSection } from "@/components/submission/budget-proposal-section"
import { InstitutionalAlignmentSection } from "@/components/submission/institutional-alignment-section"
import { ProponentCard } from "@/components/submission/proponent-card"
import {
  createEmptyProponent,
  MAX_PROPONENTS,
  ONLINE_VENUE,
} from "@/components/submission/constants"
import { saafAllGibberishFields } from "@/components/submission/gibberish-fields"
import type { SaafStepIndex } from "@/components/submission/saaf-stepper"
import type { BudgetItem, Proponent, SaafDraft } from "@/components/submission/types"
import {
  getSaafStepIssues,
  saafFieldWarnings,
} from "@/components/submission/validate-saaf-step"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import { LoadingBlock } from "@/components/ui/loading-block"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toastManager } from "@/components/ui/toast"
import { modal } from "@/config"
import { useAdminCampusesQuery } from "@/hooks/use-campuses"
import {
  mutationErrorMessage,
  useOrganizationsQuery,
  useUpdateAdminSubmissionMutation,
} from "@/hooks/use-admin"
import { checkGibberishFields } from "@/hooks/use-gibberish-check"
import { EVENT_DATE_TOO_SOON_MESSAGE } from "@/lib/date-key"
import {
  apiSubmissionToDrafts,
  buildSaafApiPayload,
  omitEventIdFromPayload,
  submissionOrganizationId,
  type ApiSubmission,
} from "@/lib/dynamodb-adapters"
import { cn } from "@/lib/utils"

const NO_COLLABORATION = "__no_collaboration__"

function budgetTotal(items: BudgetItem[]): number {
  return items.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0),
    0
  )
}

function budgetIssues(items: BudgetItem[]): string[] {
  if (items.length === 0) {
    return ["Detailed budget: add at least one line."]
  }
  return items.flatMap((item, index) => {
    const line = `Budget line ${index + 1}`
    if (!item.item.trim() || !item.unit.trim()) {
      return [`${line}: enter an item and a unit.`]
    }
    if (!item.quantity.trim() || Number(item.quantity) <= 0) {
      return [`${line}: enter a quantity.`]
    }
    if (item.pricePerUnit.trim() === "") {
      return [`${line}: enter a price.`]
    }
    return []
  })
}

function editIssues(
  draft: SaafDraft,
  originalStart: string,
  hasReservation: boolean
): string[] {
  const steps: SaafStepIndex[] = hasReservation
    ? [0, 1, 2, 3, 4]
    : [0, 1, 2, 3]
  const fieldIssues = steps.flatMap((step) =>
    getSaafStepIssues(step, draft, hasReservation)
  )
  const kept = fieldIssues.filter((issue) => {
    if (
      draft.dateOfEvent === originalStart &&
      issue.endsWith(EVENT_DATE_TOO_SOON_MESSAGE)
    ) {
      return false
    }
    // Date, time, and venue are locked to the filed reservation, so a legacy
    // value there must not block a correction of the other fields.
    if (!hasReservation) return true
    return !/^(Venue campus|Start date of event|End date of event|Time of event):/.test(
      issue
    )
  })
  return [...kept, ...budgetIssues(draft.budgetItems)]
}

function visibleWarnings(
  draft: SaafDraft,
  originalStart: string
): Record<string, string> {
  const warnings = { ...saafFieldWarnings(draft) }
  if (
    draft.dateOfEvent === originalStart &&
    warnings.dateOfEvent === EVENT_DATE_TOO_SOON_MESSAGE
  ) {
    delete warnings.dateOfEvent
  }
  return warnings
}

export function EditSubmissionDialog() {
  const { state, actions } = useAdminDashboard()
  const submission = state.submissionEdit

  return (
    <Dialog
      open={submission !== null}
      onOpenChange={(open) => {
        if (!open) actions.closeSubmissionEdit()
      }}
    >
      <DialogPopup
        className={cn(modal.dialogXl, "flex-col")}
        closeProps={{
          className:
            "text-white/80 hover:text-white hover:bg-white/10 top-5 end-5 cursor-pointer size-9",
        }}
      >
        {submission ? (
          <EditSubmissionForm
            key={`${submission.event_id}:${submission.submission_id}`}
            submission={submission}
          />
        ) : null}
      </DialogPopup>
    </Dialog>
  )
}

function EditSubmissionForm({ submission }: { submission: ApiSubmission }) {
  const { actions } = useAdminDashboard()
  const updateSubmission = useUpdateAdminSubmissionMutation()
  const campusesQuery = useAdminCampusesQuery()
  const initial = useMemo(
    () => apiSubmissionToDrafts(submission).saaf,
    [submission]
  )
  const [draft, setDraft] = useState<SaafDraft>(initial)
  const [showErrors, setShowErrors] = useState(false)
  const [formError, setFormError] = useState("")

  const hasReservation = Boolean(submission.venue_reservation?.has_reservation)
  const originalStart = submission.activity_details?.date_of_event || ""
  const organizationId = submissionOrganizationId(submission)
  const organizationName =
    submission.organization_name && submission.organization_name !== "—"
      ? submission.organization_name
      : draft.proponents[0]?.orgOrCourseSection || ""
  const issues = showErrors
    ? editIssues(draft, originalStart, hasReservation)
    : []
  const warnings = showErrors ? visibleWarnings(draft, originalStart) : {}

  const venueNames = useMemo(() => {
    const names = (campusesQuery.data ?? []).map((campus) => campus.name)
    if (
      draft.activityVenue &&
      draft.activityVenue !== ONLINE_VENUE &&
      !names.includes(draft.activityVenue)
    ) {
      return [draft.activityVenue, ...names]
    }
    return names
  }, [campusesQuery.data, draft.activityVenue])

  function updateField<K extends keyof SaafDraft>(key: K, value: SaafDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setFormError("")
  }

  function updateProponent(id: string, field: keyof Proponent, value: string) {
    setDraft((current) => ({
      ...current,
      proponents: current.proponents.map((proponent) =>
        proponent.id === id ? { ...proponent, [field]: value } : proponent
      ),
    }))
    setFormError("")
  }

  function addProponent() {
    setDraft((current) => {
      if (current.proponents.length >= MAX_PROPONENTS) return current
      const template = current.proponents[0]
      const created = createEmptyProponent(String(Date.now()))
      created.department = template?.department || ""
      created.orgOrCourseSection =
        template?.orgOrCourseSection || organizationName
      return {
        ...current,
        proponents: [...current.proponents, created],
        departmentValues: {
          ...current.departmentValues,
          [created.id]:
            current.departmentValues[template?.id ?? ""] || created.department,
        },
      }
    })
  }

  function removeProponent(id: string) {
    setDraft((current) => {
      if (current.proponents.length === 1) return current
      const departmentValues = { ...current.departmentValues }
      delete departmentValues[id]
      return {
        ...current,
        proponents: current.proponents.filter((proponent) => proponent.id !== id),
        departmentValues,
      }
    })
  }

  function updateBudget(items: BudgetItem[]) {
    setDraft((current) => ({
      ...current,
      budgetItems: items,
      proposedBudget: String(budgetTotal(items)),
    }))
    setFormError("")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setShowErrors(true)
    const nextIssues = editIssues(draft, originalStart, hasReservation)
    if (nextIssues.length > 0) {
      setFormError(nextIssues[0] ?? "Fix the highlighted fields.")
      return
    }
    const flagged = await checkGibberishFields(
      saafAllGibberishFields(draft, false)
    )
    if (flagged.length > 0) {
      setFormError(
        `These fields look like gibberish: ${flagged.join(", ")}. Please revise them.`
      )
      return
    }
    try {
      await updateSubmission.mutateAsync({
        eventId: submission.event_id,
        submissionId: submission.submission_id,
        payload: omitEventIdFromPayload(buildSaafApiPayload(draft)),
      })
      toastManager.add({
        title: "Submission updated",
        description: "The SAAF was saved. Its approval desk did not change.",
        type: "success",
      })
      actions.closeSubmissionEdit()
    } catch (error) {
      setFormError(mutationErrorMessage(error, "Could not update this submission."))
    }
  }

  return (
    <Form className="contents" onSubmit={handleSubmit}>
      <DialogHeader className="shrink-0 rounded-t-2xl bg-[#8B0000] px-4 py-6 text-white sm:px-8">
        <div className="w-full pr-10">
          <DialogTitle className="text-2xl font-extrabold tracking-tight text-white">
            Edit submission
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-sm font-medium text-[#FBC02D]">
            {hasReservation
              ? "Saving keeps the current desk and status. Date, time, venue, and the room reservation stay as filed."
              : "Saving keeps the current desk and status."}
          </DialogDescription>
        </div>
      </DialogHeader>

      <DialogPanel className="flex-1 overflow-y-auto bg-white px-4 py-6 text-neutral-800 sm:px-8">
        <FieldWarnings warnings={warnings}>
          <div className="space-y-8">
            <ActivityClassificationSection
              activityType={draft.activityType}
              totalOrgMembers={draft.totalOrgMembers}
              onActivityTypeChange={(value) => updateField("activityType", value)}
              onTotalOrgMembersChange={(value) =>
                updateField("totalOrgMembers", value)
              }
            />

            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Proponents</h2>
                <p className="mt-0.5 text-sm text-neutral-500">
                  Department stays with the organization&apos;s dean.
                </p>
              </div>
              {draft.proponents.map((proponent, index) => (
                <ProponentCard
                  key={proponent.id}
                  proponent={proponent}
                  index={index}
                  canRemove={draft.proponents.length > 1}
                  departmentValue={
                    draft.departmentValues[proponent.id] || proponent.department
                  }
                  organizationName={organizationName}
                  onUpdate={updateProponent}
                  onRemove={removeProponent}
                />
              ))}
              {draft.proponents.length >= MAX_PROPONENTS ? (
                <p className="text-center text-xs text-neutral-500" role="note">
                  Maximum of {MAX_PROPONENTS} proponents reached.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={addProponent}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/40 py-3.5 text-sm font-medium text-neutral-700 shadow-xs transition-all hover:border-red-600 hover:bg-red-50/30 hover:text-red-700"
                >
                  <PlusIcon className="h-4 w-4 text-neutral-600" />
                  <span>Add Proponent</span>
                </button>
              )}
            </section>

            <CollaboratorsField
              ownerId={organizationId}
              value={draft.dependentOrgs}
              onChange={(ids) => updateField("dependentOrgs", ids)}
            />

            <ActivityDetailsSection
              values={draft}
              onChange={updateField}
              lockSchedule={hasReservation}
              titleEditable
              venueNames={venueNames}
            />

            <InstitutionalAlignmentSection
              values={draft}
              onChange={updateField}
            />

            <BudgetProposalSection
              items={draft.budgetItems}
              grandTotal={budgetTotal(draft.budgetItems)}
              onUpdate={(id, field, value) =>
                updateBudget(
                  draft.budgetItems.map((item) =>
                    item.id === id ? { ...item, [field]: value } : item
                  )
                )
              }
              onRemove={(id) =>
                updateBudget(draft.budgetItems.filter((item) => item.id !== id))
              }
              onAdd={() =>
                updateBudget([
                  ...draft.budgetItems,
                  {
                    id: String(Date.now()),
                    item: "",
                    unit: "",
                    quantity: "",
                    pricePerUnit: "",
                  },
                ])
              }
            />
          </div>
        </FieldWarnings>
      </DialogPanel>

      <div className="shrink-0 rounded-b-2xl border-t border-neutral-200 bg-white px-4 py-4 sm:px-8">
        {formError || issues.length > 0 ? (
          <Alert variant="error" className="mb-3">
            <CircleAlertIcon />
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>
              <span>{formError || issues[0]}</span>
              {issues.length > 1 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {issues.slice(1, 6).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={actions.closeSubmissionEdit}
          >
            Cancel
          </Button>
          <Button loading={updateSubmission.isPending} type="submit">
            Save changes
          </Button>
        </div>
      </div>
    </Form>
  )
}

function CollaboratorsField({
  ownerId,
  value,
  onChange,
}: {
  ownerId: string
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const organizationsQuery = useOrganizationsQuery()
  const options = useMemo(() => {
    return [...(organizationsQuery.data || [])]
      .filter((org) => org.organization_id && org.organization_id !== ownerId)
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [organizationsQuery.data, ownerId])
  const nameById = useMemo(() => {
    const names = new Map<string, string>()
    for (const org of options) names.set(org.organization_id, org.name)
    return names
  }, [options])
  const selected = value.length === 0 ? [NO_COLLABORATION] : value

  function renderValue(items: string[]) {
    const first = items[0] ?? ""
    if (items.length === 0 || first === NO_COLLABORATION) {
      return "No collaboration"
    }
    const label = nameById.get(first) ?? first
    return items.length > 1 ? `${label} (+${items.length - 1} more)` : label
  }

  function handleValueChange(next: string[]) {
    if (next.includes(NO_COLLABORATION) && value.length > 0) {
      onChange([])
      return
    }
    onChange(next.filter((id) => id !== NO_COLLABORATION && id !== ownerId))
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-neutral-900">
          Collaborating organizations
        </h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Dependent organizations keep a read-only copy. The filing organization
          stays the owner.
        </p>
      </div>
      {organizationsQuery.isLoading ? (
        <LoadingBlock label="Loading organizations" rows={2} rowClassName="h-10 w-full" />
      ) : organizationsQuery.isError ? (
        <p className="text-sm text-rose-600">Could not load organizations.</p>
      ) : (
        <Select
          multiple
          aria-label="Collaborating organizations"
          value={selected}
          onValueChange={(next) => handleValueChange(next as string[])}
        >
          <SelectTrigger>
            <SelectValue>{renderValue}</SelectValue>
          </SelectTrigger>
          <SelectPopup alignItemWithTrigger={false}>
            <SelectItem value={NO_COLLABORATION}>No collaboration</SelectItem>
            <SelectSeparator />
            {options.map((org) => (
              <SelectItem key={org.organization_id} value={org.organization_id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      )}
    </section>
  )
}
