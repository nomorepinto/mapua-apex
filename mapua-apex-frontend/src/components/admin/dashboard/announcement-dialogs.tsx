import { useState } from "react"
import { Check, CheckCircle2, CircleAlertIcon, DownloadIcon, FileText, Loader2 } from "lucide-react"

import {
  ANNOUNCEMENT_MAX,
  formatAnnouncementPostedAt,
  useAdminDashboard,
} from "@/components/admin/dashboard/admin-dashboard-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { ActivityBudgetTable } from "@/components/ui/activity-budget-table"
import { ActivityReservationDetails } from "@/components/ui/activity-reservation-details"
import { saveActivityAsPdf } from "@/lib/save-proposal-pdf"
import { brand, modal } from "@/config"
import { formatDocumentId } from "@/lib/dynamodb-adapters"
import { cn } from "@/lib/utils"

export function SubmissionDetailDialog() {
  const { state, actions } = useAdminDashboard()
  const { selectedRow, selectedActivity, stepper } = state
  const [activeTab, setActiveTab] = useState<"details" | "progress">("details")
  const [isSavingPdf, setIsSavingPdf] = useState(false)

  const handleSavePdf = async () => {
    if (!selectedActivity) return
    try {
      setIsSavingPdf(true)
      await saveActivityAsPdf(selectedActivity)
    } catch (err) {
      console.error("Failed to save proposal PDF:", err)
    } finally {
      setIsSavingPdf(false)
    }
  }

  return (
    <Dialog
      open={state.selectedKeys !== null}
      onOpenChange={(open) => {
        if (!open) {
          actions.closeSubmission()
          setActiveTab("details")
        }
      }}
    >
      <DialogPopup
        className={cn(modal.dialogXl, "flex-col")}
        closeProps={{
          className:
            "text-white/80 hover:text-white hover:bg-white/10 top-5 end-5 cursor-pointer size-9",
        }}
      >
        <DialogHeader className="shrink-0 rounded-t-2xl bg-[#8B0000] px-4 py-6 text-white sm:px-8">
          <div className="w-full pr-10">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span
                className="rounded-md bg-white/20 px-2.5 py-0.5 font-mono text-xs font-bold text-white shadow-2xs"
                title={state.selectedKeys?.submissionId || selectedRow?.submission_id}
              >
                {formatDocumentId(state.selectedKeys?.submissionId || selectedRow?.submission_id)}
              </span>
              {selectedRow?.organization_name ? (
                <span className={brand.chipGold}>
                  {selectedRow.organization_name}
                </span>
              ) : null}
              {selectedRow?.status ? (
                <span className="rounded-sm bg-white/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-white uppercase">
                  {selectedRow.status}
                </span>
              ) : null}
            </div>
            <DialogTitle className="text-2xl font-extrabold tracking-tight leading-tight text-white sm:text-3xl">
              {selectedRow?.activity_details.title
                ? `${selectedRow.activity_details.title} Proposal`
                : "Submission Detail"}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-xs font-medium text-[#FBC02D] sm:text-sm">
              {selectedRow
                ? `Submitted: ${selectedRow.submitted_date || "—"} · Signatory: ${selectedRow.current_signatory || "—"}`
                : "Loading the full SAAF record and notifications."}
            </DialogDescription>

            <div className="mt-4 flex items-center">
              <div className="inline-flex items-center rounded-xl bg-black/20 p-1 border border-white/10 backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
                    activeTab === "details"
                      ? "bg-white text-[#8B0000] shadow-xs"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Document Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("progress")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
                    activeTab === "progress"
                      ? "bg-white text-[#8B0000] shadow-xs"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Milestone & Progress</span>
                </button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <DialogPanel className="flex-1 overflow-y-auto bg-white px-4 py-6 text-neutral-800 sm:px-8">
          {state.detailLoading ? (
            <div className="flex items-center justify-center p-12 text-sm text-neutral-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#8B0000]" />
              <span>Loading submission details…</span>
            </div>
          ) : state.detailError ? (
            <p className="text-sm font-semibold text-rose-600">
              Could not load this submission.
            </p>
          ) : selectedActivity && activeTab === "details" ? (
            <div className="space-y-6">
              {selectedActivity.proponents.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-center text-xs font-bold uppercase tracking-widest text-neutral-500">
                    Proponents
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {selectedActivity.proponents.map((prop, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-3.5 text-center shadow-2xs transition-colors hover:bg-neutral-100/50"
                      >
                        <p className="text-xs font-semibold text-neutral-500">
                          {prop.role}
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-neutral-900">
                          {prop.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <hr className="border-neutral-200" />

              <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                {[
                  [
                    "Event Date & Time",
                    `${selectedActivity.time ? selectedActivity.time + " " : ""}${selectedActivity.date}`,
                  ],
                  ["Venue", selectedActivity.venue],
                  ["Estimated Budget", selectedActivity.proposedBudget],
                  [
                    "Number of Participants",
                    selectedActivity.expectedParticipants,
                  ],
                  ["Activity Type", selectedActivity.type],
                ].map(([label, value]) => (
                  <div
                    key={label as string}
                    className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-bold text-neutral-900">{label}</span>
                    <span className="font-medium capitalize text-neutral-600 sm:text-right">
                      {value || "—"}
                    </span>
                  </div>
                ))}
                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Event Nature</span>
                  <span className="font-medium sm:text-right">
                    {selectedActivity.nature?.toLowerCase() === "major" ? (
                      <span className="inline-flex items-center rounded-md border border-red-200 bg-red-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#8B0000]">
                        Major Event
                      </span>
                    ) : selectedActivity.nature?.toLowerCase() === "minor" ? (
                      <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-neutral-700">
                        Minor Event
                      </span>
                    ) : (
                      <span className="text-xs italic text-neutral-400">
                        Pending classification
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="text-sm font-bold text-neutral-900">
                  Description of the Activity
                </h4>
                <p className="text-sm leading-relaxed text-neutral-700">
                  {selectedActivity.description}
                </p>
              </div>

              {selectedActivity.objectives.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-sm font-bold text-neutral-900">
                    Objectives of the Activity
                  </h4>
                  <ul className="space-y-2.5 text-sm text-neutral-700">
                    {selectedActivity.objectives.map((obj, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="mt-1 text-xs font-bold text-neutral-400">
                          •
                        </span>
                        <div>
                          <span className="font-bold text-neutral-900">
                            {obj.title}:{" "}
                          </span>
                          <span className="leading-relaxed">
                            {obj.description}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <ActivityBudgetTable
                items={selectedActivity.budgetItems}
                grandTotal={selectedActivity.budgetGrandTotal}
              />

              <ActivityReservationDetails
                equipmentRequested={selectedActivity.equipmentRequested}
                roomsRequested={selectedActivity.roomsRequested}
                avEquipmentRequested={selectedActivity.avEquipmentRequested}
              />
            </div>
          ) : selectedActivity && activeTab === "progress" ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 sm:p-6 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200/80 pb-4 mb-4 sm:mb-6">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">Approval Milestone</h3>
                    <p className="text-xs font-medium text-neutral-500 mt-0.5">
                      {stepper.isAllApproved
                        ? "Completed — all signatories approved this proposal."
                        : `Current Stage: Step ${Math.min(stepper.currentStepIdx + 1, stepper.fullSteps.length)} of ${stepper.fullSteps.length}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs font-medium text-neutral-500">Overall progress</span>
                    <span className="text-base font-extrabold text-[#8B0000]">
                      {stepper.progressPercent}%
                    </span>
                  </div>
                </div>

                {/* Mobile Stepper List */}
                <ol className="flex flex-col gap-3 md:hidden">
                  {stepper.fullSteps.map((stepName, idx) => {
                    const isCompleted = stepper.isAllApproved || idx < stepper.currentStepIdx
                    const isCurrent = !stepper.isAllApproved && idx === stepper.currentStepIdx
                    let nodeBg = "bg-neutral-100 border-neutral-300 text-neutral-400"
                    if (isCompleted) {
                      nodeBg = "bg-emerald-100 border-emerald-500 text-emerald-800"
                    } else if (isCurrent) {
                      nodeBg = "bg-amber-100 border-amber-500 text-amber-900 ring-4 ring-amber-100"
                    }

                    return (
                      <li key={`${stepName}-${idx}`} className="flex items-center gap-3">
                        <div
                          className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 font-bold shadow-xs ${nodeBg}`}
                        >
                          {isCompleted ? (
                            <Check className="h-5 w-5 stroke-[2.5] text-emerald-800" />
                          ) : isCurrent ? (
                            <span className="h-3.5 w-3.5 rounded-full bg-amber-500 animate-pulse"></span>
                          ) : (
                            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300"></span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "min-w-0 text-xs font-bold",
                            isCompleted
                              ? "text-neutral-900"
                              : isCurrent
                                ? "font-extrabold text-amber-900"
                                : "text-neutral-400"
                          )}
                        >
                          {stepName}
                        </span>
                      </li>
                    )
                  })}
                </ol>

                {/* Desktop Stepper Bar */}
                <div className="relative hidden select-none px-2 py-4 md:block">
                  <div className="absolute top-9 left-8 right-8 -translate-y-1/2 h-1.5 bg-neutral-200 rounded-full z-0 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${
                          stepper.fullSteps.length > 1
                            ? (Math.min(stepper.currentStepIdx, stepper.fullSteps.length - 1) /
                                (stepper.fullSteps.length - 1)) *
                              100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>

                  <div className="relative z-10 w-full min-h-[76px]">
                    {stepper.fullSteps.map((stepName, idx) => {
                      const totalSteps = stepper.fullSteps.length
                      const isCompleted = stepper.isAllApproved || idx < stepper.currentStepIdx
                      const isCurrent = !stepper.isAllApproved && idx === stepper.currentStepIdx

                      let nodeBg = "bg-neutral-100 border-neutral-300 text-neutral-400"
                      if (isCompleted) {
                        nodeBg = "bg-emerald-100 border-emerald-500 text-emerald-800"
                      } else if (isCurrent) {
                        nodeBg = "bg-amber-100 border-amber-500 text-amber-900 ring-4 ring-amber-100"
                      }

                      return (
                        <div
                          key={`${stepName}-${idx}`}
                          className="absolute top-4 -translate-x-1/2 flex flex-col items-center"
                          style={{
                            left:
                              totalSteps > 1
                                ? `calc(32px + (100% - 64px) * ${idx / (totalSteps - 1)})`
                                : "50%",
                          }}
                        >
                          <div
                            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold transition-all duration-300 shadow-xs ${nodeBg}`}
                          >
                            {isCompleted ? (
                              <Check className="w-5 h-5 stroke-[2.5] text-emerald-800" />
                            ) : isCurrent ? (
                              <span className="w-3.5 h-3.5 rounded-full bg-amber-500 animate-pulse"></span>
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full bg-neutral-300"></span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-xs font-bold mt-2 text-center whitespace-nowrap px-1 max-w-[120px] truncate",
                              isCompleted
                                ? "text-neutral-900"
                                : isCurrent
                                  ? "text-amber-900 font-extrabold"
                                  : "text-neutral-400"
                            )}
                            title={stepName}
                          >
                            {stepName}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Signatory Approvals Reviewers */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-bold text-neutral-900">Signatory Approvals</h3>
                </div>
                <p className="text-xs font-semibold text-neutral-500 mb-4">Required Reviewers</p>
                <div className="space-y-3.5">
                  {stepper.assigneesList.map((item, idx) => {
                    let iconBg = "bg-neutral-200 text-neutral-400"
                    if (item.state === "completed") iconBg = "bg-emerald-500 text-white"
                    else if (item.state === "current") iconBg = "bg-amber-500 text-white"

                    return (
                      <div key={`${item.role}-${idx}`} className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}
                        >
                          {item.state === "completed" ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-neutral-900">
                          <span className="font-bold">{item.name}</span>
                          <span className="text-neutral-500"> — {item.statusText}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </DialogPanel>

        <div className="flex shrink-0 justify-end gap-3 rounded-b-2xl border-t border-neutral-200 bg-white px-4 py-4 sm:px-8">
          <Button
            type="button"
            disabled={isSavingPdf || !selectedActivity}
            onClick={handleSavePdf}
            variant="outline"
            className="gap-2 text-neutral-800"
          >
            {isSavingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#8B0000]" />
            ) : (
              <DownloadIcon className="h-4 w-4 text-[#8B0000]" />
            )}
            Save as PDF
          </Button>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Close
          </DialogClose>
        </div>
      </DialogPopup>
    </Dialog>
  )
}

export function CreateAnnouncementDialog() {
  const { state, actions } = useAdminDashboard()

  return (
    <Dialog open={state.createOpen} onOpenChange={actions.setCreateOpen}>
      <DialogPopup className={modal.dialogMd}>
        <Form className="contents" onSubmit={actions.handleCreate}>
          <DialogHeader>
            <DialogTitle>New announcement</DialogTitle>
            <DialogDescription>
              Posted notices are visible on the institutional bulletin.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-4">
            <Field data-invalid={state.createError ? true : undefined}>
              <FieldLabel htmlFor="announcement-content">Content</FieldLabel>
              <Textarea
                aria-invalid={state.createError ? true : undefined}
                id="announcement-content"
                maxLength={ANNOUNCEMENT_MAX}
                onChange={(event) =>
                  actions.setCreateContent(event.currentTarget.value)
                }
                required
                rows={6}
                value={state.createContent}
              />
              <FieldDescription>
                {state.createContent.length}/{ANNOUNCEMENT_MAX}
              </FieldDescription>
              {state.createError ? <FieldError>{state.createError}</FieldError> : null}
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button loading={state.createPending} type="submit">
              Post announcement
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  )
}

export function EditAnnouncementDialog() {
  const { state, actions } = useAdminDashboard()

  return (
    <Dialog
      open={state.editing !== null}
      onOpenChange={(open) => {
        if (!open) actions.closeEdit()
      }}
    >
      <DialogPopup className={modal.dialogMd}>
        <Form className="contents" onSubmit={actions.handleEdit}>
          <DialogHeader>
            <DialogTitle>Edit announcement</DialogTitle>
            <DialogDescription>
              {state.editing
                ? `Posted ${formatAnnouncementPostedAt(state.editing.sent_at)}`
                : "Update this notice."}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-4">
            <Field data-invalid={state.editError ? true : undefined}>
              <FieldLabel htmlFor="edit-announcement-content">Content</FieldLabel>
              <Textarea
                aria-invalid={state.editError ? true : undefined}
                id="edit-announcement-content"
                maxLength={ANNOUNCEMENT_MAX}
                onChange={(event) =>
                  actions.setEditContent(event.currentTarget.value)
                }
                required
                rows={6}
                value={state.editContent}
              />
              <FieldDescription>
                {state.editContent.length}/{ANNOUNCEMENT_MAX}
              </FieldDescription>
              {state.editError ? <FieldError>{state.editError}</FieldError> : null}
            </Field>
            {state.deleteError ? (
              <Alert variant="error">
                <CircleAlertIcon />
                <AlertTitle>Could not delete</AlertTitle>
                <AlertDescription>{state.deleteError}</AlertDescription>
              </Alert>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <Button
              onClick={actions.openDelete}
              type="button"
              variant="destructive-outline"
            >
              Delete
            </Button>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button loading={state.editPending} type="submit">
              Save changes
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  )
}

export function DeleteAnnouncementDialog() {
  const { state, actions } = useAdminDashboard()

  return (
    <AlertDialog open={state.deleteOpen} onOpenChange={actions.setDeleteOpen}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
          <AlertDialogDescription>
            This notice will be removed from the bulletin. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="ghost" />}>
            Keep
          </AlertDialogClose>
          <Button
            loading={state.deletePending}
            onClick={actions.handleDelete}
            type="button"
            variant="destructive"
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  )
}
