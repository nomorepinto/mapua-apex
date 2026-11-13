import { memo, useRef, useState } from "react"
import { DownloadIcon, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogPanel,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { ConfirmSubmitModal } from "@/components/forms/confirm-submit-modal"
import { ReturnProposalModal } from "./return-proposal-modal"
import { ActivityBudgetTable } from "./activity-budget-table"
import { ActivityReservationDetails } from "./activity-reservation-details"
import type { Activity } from "./activity.types"
import { useActivityDetail } from "@/hooks/use-activity-detail"
import { useAdminCampusesQuery } from "@/hooks/use-campuses"
import { saveActivityAsPdf } from "@/lib/save-proposal-pdf"
import { formatDisplayDateTime } from "@/lib/dynamodb-adapters"
import { brand, modal } from "@/config"
import { fundingSourceLabels } from "@/constants/funding-sources"
import { cn } from "@/lib/utils"
import type { BookingConflict } from "@/lib/types"

const EMPTY_CONFLICTS: BookingConflict[] = []

export interface ActivityDetailModalProps {
  activity: Activity | null
  onClose: () => void
  isActing?: boolean
  actionError?: string | null
  /** R-1: major/minor classification is exclusive to the all-campus OSAAR desk. */
  isAllCampusOsaar?: boolean
  /** R-1: "Approve" for the campus OSAAR desk, "Review" for every other desk. */
  actionVerb?: "Approve" | "Review"
  /** S-8: the CDM desk rules on each outside-equipment item before approving. */
  isCdm?: boolean
  isUpdatingClassification?: boolean
  isUpdatingOutsideEquipment?: boolean
  onClassificationChange?: (nature: "major" | "minor") => void | Promise<void>
  onOutsideEquipmentChange?: (decision: {
    name: string
    allowed: boolean
  }) => void | Promise<void>
  onAction?: (
    action: "approve" | "return" | "reject" | "defer",
    activityId: string,
    details?: { comment: string }
  ) => void | Promise<void>
  readOnly?: boolean
  /** CDM desk: approved bookings the paper's pending holds collide with. */
  bookingConflicts?: BookingConflict[]
  isCheckingBookingConflicts?: boolean
}

const ActivityDetailModal = memo(function ActivityDetailModal({
  activity,
  onClose,
  isActing = false,
  actionError,
  isAllCampusOsaar = false,
  actionVerb = "Review",
  isCdm = false,
  isUpdatingClassification = false,
  isUpdatingOutsideEquipment = false,
  onClassificationChange,
  onOutsideEquipmentChange,
  onAction,
  readOnly = false,
  bookingConflicts = EMPTY_CONFLICTS,
  isCheckingBookingConflicts = false,
}: ActivityDetailModalProps) {
  // Retain last non-null activity and readOnly state so during exit animations content doesn't collapse or pop out extra buttons
  const lastActivityRef = useRef<Activity | null>(null)
  const lastReadOnlyRef = useRef<boolean>(readOnly)
  if (activity) {
    lastActivityRef.current = activity
    lastReadOnlyRef.current = readOnly
  }
  const displayActivity = activity || lastActivityRef.current
  const displayReadOnly = activity ? readOnly : lastReadOnlyRef.current

  const {
    commentAction,
    setCommentAction,
    confirmingApprove,
    setConfirmingApprove,
    handleOpenChange,
    requestApprove,
    handleApprove,
    handleCommentSubmit,
  } = useActivityDetail({ activity: displayActivity, onClose, onAction })

  // S-7: proponents carry their own campus (stored campus_id). Resolve it to
  // a name for display; desks without campus access fall back to the raw value.
  const campusesQuery = useAdminCampusesQuery()
  const campuses = campusesQuery.data ?? []
  const campusLabel = (campusId?: string): string => {
    if (!campusId) return ""
    return campuses.find((campus) => campus.campus_id === campusId)?.name ?? campusId
  }

  const hasBookingConflicts = bookingConflicts.length > 0

  // S-8: the CDM desk must rule on every outside-equipment item before approving.
  const outsideEquipment = displayActivity?.outsideEquipment ?? []
  const outsideDecisions = displayActivity?.outsideEquipmentDecisions ?? []
  const hasOutsideEquipment = outsideEquipment.length > 0
  const decisionFor = (name: string) =>
    outsideDecisions.find((decision) => decision.name === name)
  const allOutsideDecided = outsideEquipment.every((item) =>
    Boolean(decisionFor(item.name))
  )
  const cdmOutsideBlocked = isCdm && hasOutsideEquipment && !allOutsideDecided

  const isApproveDisabled =
    isActing ||
    (isAllCampusOsaar && !displayActivity?.nature) ||
    hasBookingConflicts ||
    isCheckingBookingConflicts ||
    cdmOutsideBlocked
  const approveTitle = hasBookingConflicts
    ? "Some reserved slots are already booked. Return or reject this proposal."
    : isAllCampusOsaar && !displayActivity?.nature
      ? "Select an event classification first"
      : cdmOutsideBlocked
        ? "Rule on every outside equipment item (allowed / not allowed) first"
        : undefined

  const [isSavingPdf, setIsSavingPdf] = useState(false)

  const handleSavePdf = async () => {
    if (!displayActivity) return
    try {
      setIsSavingPdf(true)
      await saveActivityAsPdf(displayActivity)
    } catch (err) {
      console.error("Failed to generate proposal PDF:", err)
    } finally {
      setIsSavingPdf(false)
    }
  }

  if (!displayActivity) return null

  return (
    <>
      <Dialog open={Boolean(activity && activity.id)} onOpenChange={handleOpenChange}>
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
                {displayActivity.org ? (
                  <span className={brand.chipGold}>{displayActivity.org}</span>
                ) : null}
                {displayActivity.submittedDate ? (
                  <span className="rounded-sm bg-white/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-white uppercase">
                    Submitted {displayActivity.submittedDate}
                  </span>
                ) : null}
              </div>
              <DialogTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-white">
                {displayActivity.title} Proposal
              </DialogTitle>
              <p className="mt-1.5 text-xs font-medium text-[#FBC02D] sm:text-sm">
                Submitted by: {displayActivity.org} • Representative: {displayActivity.representative}
              </p>
            </div>
          </DialogHeader>

          <DialogPanel className="flex-1 overflow-y-auto bg-white px-4 py-6 text-neutral-800 sm:px-8">
            <div className="space-y-6">
              {isAllCampusOsaar ? (
                displayReadOnly ? (
                  displayActivity.nature ? (
                    <div className="flex flex-col items-center justify-center text-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                      <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                        Event Classification
                      </h4>
                      <span className="inline-flex items-center rounded-full bg-[#8B0000]/10 border border-[#8B0000]/20 px-3 py-1 text-xs font-bold text-[#8B0000] capitalize">
                        {displayActivity.nature} Event
                      </span>
                    </div>
                  ) : null
                ) : (
                  <div className="flex flex-col items-center justify-center text-center gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                        Event Classification
                      </h4>
                      {isUpdatingClassification ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8B0000]" />
                      ) : null}
                    </div>
                    <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-200/70 p-1">
                      <button
                        type="button"
                        disabled={isUpdatingClassification || isActing}
                        onClick={() => {
                          if (displayActivity.nature?.toLowerCase() !== "minor") {
                            onClassificationChange?.("minor")
                          }
                        }}
                        className={cn(
                          "rounded-md px-4 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5",
                          isUpdatingClassification || isActing
                            ? "cursor-not-allowed opacity-60 pointer-events-none"
                            : "cursor-pointer",
                          displayActivity.nature?.toLowerCase() === "minor"
                            ? "bg-[#8B0000] text-white shadow-xs"
                            : "text-neutral-700 hover:text-neutral-900"
                        )}
                      >
                        Minor Event
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingClassification || isActing}
                        onClick={() => {
                          if (displayActivity.nature?.toLowerCase() !== "major") {
                            onClassificationChange?.("major")
                          }
                        }}
                        className={cn(
                          "rounded-md px-4 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5",
                          isUpdatingClassification || isActing
                            ? "cursor-not-allowed opacity-60 pointer-events-none"
                            : "cursor-pointer",
                          displayActivity.nature?.toLowerCase() === "major"
                            ? "bg-[#8B0000] text-white shadow-xs"
                            : "text-neutral-700 hover:text-neutral-900"
                        )}
                      >
                        Major Event
                      </button>
                    </div>
                    {!displayActivity.nature ? (
                      <p className="text-[11px] font-medium text-amber-700">
                        Please select a classification before approving.
                      </p>
                    ) : null}
                  </div>
                )
              ) : null}

              <div className="space-y-3">
                <h3 className="text-center text-xs font-bold text-neutral-500 uppercase tracking-widest">
                  Proponents
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {displayActivity.proponents.map((prop, idx) => (
                    <div
                      key={idx}
                      className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-3.5 text-center shadow-2xs hover:bg-neutral-100/50 transition-colors"
                    >
                      <p className="text-xs text-neutral-500 font-semibold">{prop.role}</p>
                      <p className="text-sm font-bold text-neutral-900 mt-0.5">{prop.name}</p>
                      {prop.email ? (
                        <p className="text-[11px] text-neutral-600 mt-1 break-all">{prop.email}</p>
                      ) : null}
                      {prop.campus || prop.department ? (
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {[campusLabel(prop.campus), prop.department]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-neutral-200" />

              <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Event Date & Time</span>
                  <span className="font-medium text-neutral-600 sm:text-right">
                    {displayActivity.time ? `${displayActivity.time} ` : ""}{displayActivity.date}
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Venue</span>
                  <span className="font-medium text-neutral-600 sm:text-right">{displayActivity.venue}</span>
                </div>

                {displayActivity.hasBudget !== false && (
                  <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-bold text-neutral-900">Estimated Budget</span>
                    <span className="font-medium text-neutral-600 sm:text-right">{displayActivity.proposedBudget}</span>
                  </div>
                )}

                {displayActivity.hasBudget !== false &&
                  fundingSourceLabels(displayActivity.fundingSources ?? [])
                    .length > 0 && (
                    <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-bold text-neutral-900">Funding sources</span>
                      <span className="font-medium text-neutral-600 sm:text-right">
                        {fundingSourceLabels(
                          displayActivity.fundingSources ?? []
                        ).join(", ")}
                      </span>
                    </div>
                  )}

                {displayActivity.hasBudget !== false &&
                  (displayActivity.budgetNote ?? "").trim().length > 0 && (
                    <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-bold text-neutral-900">Budget Note</span>
                      <span className="font-medium text-neutral-600 sm:text-right">
                        {displayActivity.budgetNote}
                      </span>
                    </div>
                  )}

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Number of Participants</span>
                  <span className="font-medium text-neutral-600 sm:text-right">{displayActivity.expectedParticipants}</span>
                </div>

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Activity type</span>
                  <span className="font-medium text-neutral-600 sm:text-right capitalize">
                    {displayActivity.type}
                  </span>
                </div>

                {(displayActivity.natureOfActivity ?? []).length > 0 && (
                  <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-bold text-neutral-900">Nature of Activity</span>
                    <span className="font-medium text-neutral-600 sm:text-right">
                      {(displayActivity.natureOfActivity ?? []).join(", ")}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Event Nature</span>
                  <span className="font-medium sm:text-right">
                    {displayActivity.nature?.toLowerCase() === "major" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider bg-red-100 text-[#8B0000] border border-red-200">
                        Major Event
                      </span>
                    ) : displayActivity.nature?.toLowerCase() === "minor" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider bg-neutral-100 text-neutral-700 border border-neutral-200">
                        Minor Event
                      </span>
                    ) : (
                      <span className="text-neutral-400 text-xs italic">
                        Pending classification
                      </span>
                    )}
                  </span>
                </div>

                {displayActivity.privacyConsent ? (
                  <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-bold text-neutral-900">
                      Data privacy consent
                    </span>
                    <span className="font-medium text-neutral-600 sm:text-right">
                      v{displayActivity.privacyConsent.version} accepted{" "}
                      {formatDisplayDateTime(
                        displayActivity.privacyConsent.acceptedAt
                      )}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="text-sm font-bold text-neutral-900">
                  Description of the Activity
                </h4>
                <p className="text-sm text-neutral-700 leading-relaxed">
                  {displayActivity.description}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-bold text-neutral-900">
                  Objectives of the Activity
                </h4>
                <ul className="space-y-2.5 text-sm text-neutral-700">
                  {displayActivity.objectives.map((obj, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="text-neutral-400 font-bold mt-1 text-xs">•</span>
                      <div>
                        <span className="font-bold text-neutral-900">{obj.title}: </span>
                        <span className="leading-relaxed">{obj.description}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <ActivityBudgetTable
                items={displayActivity.budgetItems}
                grandTotal={displayActivity.budgetGrandTotal}
              />

              <ActivityReservationDetails
                equipmentRequested={displayActivity.equipmentRequested}
                roomsRequested={displayActivity.roomsRequested}
                avEquipmentRequested={displayActivity.avEquipmentRequested}
                bookingConflicts={displayReadOnly ? undefined : bookingConflicts}
              />

              {hasOutsideEquipment ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-neutral-900">
                      Outside Equipment (not from Mapua)
                    </h4>
                    {isUpdatingOutsideEquipment ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8B0000]" />
                    ) : null}
                  </div>
                  {isCdm && !displayReadOnly ? (
                    <p className="text-[11px] font-medium text-amber-700">
                      Rule on each item before approving this proposal.
                    </p>
                  ) : null}
                  <ul className="space-y-2">
                    {outsideEquipment.map((item, idx) => {
                      const decision = decisionFor(item.name)
                      const editable = isCdm && !displayReadOnly
                      return (
                        <li
                          key={`${item.name}-${idx}`}
                          className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-neutral-900 break-words">
                              {item.name}
                            </p>
                            {item.purpose ? (
                              <p className="text-[11px] text-neutral-600 mt-0.5 break-words">
                                {item.purpose}
                              </p>
                            ) : null}
                          </div>
                          {editable ? (
                            <div className="inline-flex shrink-0 items-center rounded-lg border border-neutral-200 bg-neutral-200/70 p-1">
                              <button
                                type="button"
                                disabled={isUpdatingOutsideEquipment || isActing}
                                onClick={() =>
                                  onOutsideEquipmentChange?.({
                                    name: item.name,
                                    allowed: true,
                                  })
                                }
                                className={cn(
                                  "rounded-md px-3 py-1.5 text-xs font-bold transition-all",
                                  isUpdatingOutsideEquipment || isActing
                                    ? "cursor-not-allowed opacity-60 pointer-events-none"
                                    : "cursor-pointer",
                                  decision?.allowed === true
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "text-neutral-700 hover:text-neutral-900"
                                )}
                              >
                                Allowed
                              </button>
                              <button
                                type="button"
                                disabled={isUpdatingOutsideEquipment || isActing}
                                onClick={() =>
                                  onOutsideEquipmentChange?.({
                                    name: item.name,
                                    allowed: false,
                                  })
                                }
                                className={cn(
                                  "rounded-md px-3 py-1.5 text-xs font-bold transition-all",
                                  isUpdatingOutsideEquipment || isActing
                                    ? "cursor-not-allowed opacity-60 pointer-events-none"
                                    : "cursor-pointer",
                                  decision?.allowed === false
                                    ? "bg-[#8B0000] text-white shadow-xs"
                                    : "text-neutral-700 hover:text-neutral-900"
                                )}
                              >
                                Not allowed
                              </button>
                            </div>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border",
                                decision
                                  ? decision.allowed
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-red-50 text-[#8B0000] border-red-200"
                                  : "bg-neutral-100 text-neutral-500 border-neutral-200"
                              )}
                            >
                              {decision
                                ? decision.allowed
                                  ? "Allowed"
                                  : "Not allowed"
                                : "Pending ruling"}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          </DialogPanel>

          <DialogFooter className="shrink-0 rounded-b-2xl border-t border-neutral-200 bg-white px-4 py-4 sm:px-8">
            <div className="flex w-full flex-col items-stretch justify-end gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {actionError ? (
                <p className="mr-auto text-xs font-semibold text-rose-600">{actionError}</p>
              ) : null}
              <Button
                type="button"
                disabled={isSavingPdf}
                onClick={handleSavePdf}
                variant="outline"
                className="min-h-11 rounded-xl px-5 py-2.5 text-sm font-bold gap-2 text-neutral-800 cursor-pointer"
              >
                {isSavingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#8B0000]" />
                ) : (
                  <DownloadIcon className="h-4 w-4 text-[#8B0000]" />
                )}
                Save as PDF
              </Button>
              <DialogClose
                render={
                  <Button
                    type="button"
                    disabled={isActing}
                    variant="outline"
                    className="min-h-11 rounded-xl px-6 py-2.5 text-sm font-bold cursor-pointer"
                  />
                }
              >
                Close
              </DialogClose>
              {!displayReadOnly ? (
                <>
                  <Button
                    type="button"
                    disabled={isActing}
                    onClick={() => setCommentAction("return")}
                    variant="outline"
                    className="min-h-11 rounded-xl px-6 py-2.5 text-sm font-bold cursor-pointer"
                  >
                    Return Proposal
                  </Button>
                  <Button
                    type="button"
                    disabled={isActing}
                    onClick={() => setCommentAction("reject")}
                    variant="destructive"
                    className="min-h-11 rounded-xl px-6 py-2.5 text-sm font-bold cursor-pointer"
                  >
                    Reject Proposal
                  </Button>
                  <Button
                    type="button"
                    disabled={isApproveDisabled}
                    onClick={requestApprove}
                    title={approveTitle}
                    className={cn(
                      "min-h-11 rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all",
                      isApproveDisabled
                        ? "bg-neutral-300 text-neutral-500 cursor-not-allowed hover:bg-neutral-300"
                        : "bg-[#8B0000] text-white hover:bg-[#6B0000] cursor-pointer"
                    )}
                  >
                    {isActing ? "Working…" : `${actionVerb} Proposal`}
                  </Button>
                </>
              ) : null}
            </div>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {confirmingApprove && (
        <ConfirmSubmitModal
          open={confirmingApprove}
          title={
            displayActivity
              ? `${actionVerb} ${displayActivity.title}?`
              : `${actionVerb} this proposal?`
          }
          description={
            actionVerb === "Approve"
              ? "This will record your approval on the proposal."
              : "This will record your review on the proposal."
          }
          isSubmitting={isActing}
          onClose={() => setConfirmingApprove(false)}
          onConfirm={handleApprove}
        />
      )}

      {commentAction !== null && (
        <ReturnProposalModal
          activity={displayActivity}
          variant={commentAction}
          open={commentAction !== null}
          isSubmitting={isActing}
          error={actionError}
          onClose={() => setCommentAction(null)}
          onSubmit={handleCommentSubmit}
        />
      )}
    </>
  )
})

export { ActivityDetailModal }
