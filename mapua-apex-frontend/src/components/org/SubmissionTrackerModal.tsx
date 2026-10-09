import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  DownloadIcon,
  FileText,
  Loader2,
  MessageSquare,
} from "lucide-react"

import {
  useCurrentOrganizationQuery,
  useSubmissionDetailQuery,
  useSubmissionNotificationsQuery,
} from "@/hooks/use-submissions"
import {
  apiNotificationsToStepper,
  apiSubmissionToActivity,
  formatDisplayDateTime,
  formatDocumentId,
  formatSignatoryRole,
  signatoryChainLabel,
} from "@/lib/dynamodb-adapters"
import { brand, modal } from "@/config"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { ActivityBudgetTable } from "@/components/ui/activity-budget-table"
import { ActivityReservationDetails } from "@/components/ui/activity-reservation-details"
import { saveActivityAsPdf, saveSubmissionAsPdf } from "@/lib/save-proposal-pdf"

interface SubmissionTrackerModalProps {
  isOpen: boolean
  onClose: () => void
  eventId?: string | null
  submissionId?: string | null
}

export function SubmissionTrackerModal({
  isOpen,
  onClose,
  eventId,
  submissionId,
}: SubmissionTrackerModalProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<"details" | "progress">("details")
  const [isSavingPdf, setIsSavingPdf] = useState(false)

  const orgQuery = useCurrentOrganizationQuery()
  const detailQuery = useSubmissionDetailQuery(
    isOpen ? eventId || undefined : undefined,
    isOpen ? submissionId || undefined : undefined
  )
  const notificationsQuery = useSubmissionNotificationsQuery(
    isOpen ? eventId || undefined : undefined,
    isOpen ? submissionId || undefined : undefined
  )

  const activity = detailQuery.data
    ? apiSubmissionToActivity(detailQuery.data)
    : null

  const stepper = apiNotificationsToStepper(
    notificationsQuery.data || [],
    detailQuery.data?.current_signatory,
    detailQuery.data?.status,
    {
      activityType: detailQuery.data?.activity_classification?.activity_type,
      hasVenue: Boolean(detailQuery.data?.venue_reservation?.has_reservation),
      isHigherCouncil: Boolean(orgQuery.data?.is_higher_council),
      orgSignatories: orgQuery.data?.signatories,
      signatorySequence: detailQuery.data?.signatory_sequence,
      signatoryChain: detailQuery.data?.signatory_chain,
    }
  )

  const canResubmit = detailQuery.data?.status === "returned"
  const isDependent = detailQuery.data?.role === "dependent"
  const isDenied = detailQuery.data?.status === "denied"

  const returnNotifications = useMemo(() => {
    if (!notificationsQuery.data || notificationsQuery.data.length === 0) return []
    return notificationsQuery.data
      .filter((item) => item.notif_type === "returned")
      .sort((a, b) => (b.sent_at || "").localeCompare(a.sent_at || ""))
  }, [notificationsQuery.data])

  const latestReturnNotification = returnNotifications[0] || null

  const returnSignatoryLabel = useMemo(() => {
    if (!latestReturnNotification) return null
    const chain = detailQuery.data?.signatory_chain
    if (Array.isArray(chain) && chain.length > 0) {
      const stripId = (val?: string | null) => (val || "").replace(/^SIGNATORY#/i, "").trim()
      const link = chain.find(
        (c) => stripId(c.signatory_id) === stripId(latestReturnNotification.signatory)
      )
      if (link) {
        const distinctOrgs = new Set(chain.map((c) => c.organization_id).filter(Boolean))
        return signatoryChainLabel(link, distinctOrgs.size > 1)
      }
    }
    return formatSignatoryRole(
      latestReturnNotification.signatory,
      orgQuery.data?.signatories
    )
  }, [latestReturnNotification, detailQuery.data?.signatory_chain, orgQuery.data?.signatories])

  const latestDeniedNotification = useMemo(() => {
    if (!notificationsQuery.data || notificationsQuery.data.length === 0) return null
    return (
      notificationsQuery.data
        .filter((n) => n.notif_type === "denied")
        .sort((a, b) => (b.sent_at || "").localeCompare(a.sent_at || ""))[0] || null
    )
  }, [notificationsQuery.data])

  const handleSavePdf = async () => {
    try {
      setIsSavingPdf(true)
      if (detailQuery.data) {
        await saveSubmissionAsPdf(detailQuery.data)
      } else if (activity) {
        await saveActivityAsPdf(activity)
      }
    } catch (err) {
      console.error("Failed to save proposal PDF:", err)
    } finally {
      setIsSavingPdf(false)
    }
  }

  const handleResubmit = () => {
    if (!eventId || !submissionId) return
    onClose()
    navigate(
      `/students/submissions/saaf?event=${encodeURIComponent(eventId)}&submission=${encodeURIComponent(submissionId)}`
    )
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  if (!isOpen || !eventId || !submissionId) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
                title={submissionId || activity?.submissionId || undefined}
              >
                {formatDocumentId(submissionId || activity?.submissionId)}
              </span>
              {activity?.org ? (
                <span className={brand.chipGold}>{activity.org}</span>
              ) : null}
              {activity?.submittedDate ? (
                <span className="rounded-sm bg-white/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-white uppercase">
                  Submitted {activity.submittedDate}
                </span>
              ) : null}
            </div>

            <DialogTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-white">
              {detailQuery.isLoading
                ? "Loading submission…"
                : `${activity?.title || "Submission"} Proposal`}
            </DialogTitle>

            <p className="mt-1.5 text-xs font-medium text-[#FBC02D] sm:text-sm">
              Submitted by: {activity?.org || "Organization"} • Representative:{" "}
              {activity?.representative || "—"}
            </p>

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
          {detailQuery.isLoading ? (
            <div className="flex items-center justify-center p-12 text-sm text-neutral-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#8B0000]" />
              <span>Loading submission details…</span>
            </div>
          ) : detailQuery.isError ? (
            <p className="text-sm font-semibold text-rose-600">
              Could not load this submission. Try again from the dashboard.
            </p>
          ) : null}

          {canResubmit && !isDependent ? (
            <div className="mb-6 rounded-2xl border border-amber-300/80 bg-gradient-to-b from-amber-50 to-amber-50/60 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-900 border border-amber-500/30">
                    <AlertCircle className="size-5 text-amber-800" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-amber-950">Application Returned</span>
                      <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
                        Action Required
                      </span>
                    </div>
                    <p className="text-xs text-amber-800/90 mt-0.5">
                      Update this application and resubmit it to the current signatory.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResubmit}
                  className="cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#8B0000] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#700000] transition-colors shrink-0"
                >
                  Edit and resubmit
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200/90 bg-white/95 p-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-3.5 text-amber-700" />
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                      Reason for Return
                    </span>
                  </div>
                  {(returnSignatoryLabel || latestReturnNotification?.sent_at) && (
                    <span className="text-xs font-medium text-neutral-500">
                      {returnSignatoryLabel ? `Returned by ${returnSignatoryLabel}` : ""}
                      {returnSignatoryLabel && latestReturnNotification?.sent_at ? " • " : ""}
                      {latestReturnNotification?.sent_at
                        ? formatDisplayDateTime(latestReturnNotification.sent_at)
                        : ""}
                    </span>
                  )}
                </div>

                <div className="pt-2.5">
                  {notificationsQuery.isLoading ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-neutral-500">
                      <Loader2 className="size-3.5 animate-spin text-amber-700" />
                      <span>Loading reviewer feedback…</span>
                    </div>
                  ) : latestReturnNotification?.comment ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed font-medium text-neutral-800">
                      {latestReturnNotification.comment}
                    </p>
                  ) : (
                    <p className="text-xs italic text-neutral-500">
                      No specific remarks were provided by the reviewer.
                    </p>
                  )}
                </div>

                {returnNotifications.length > 1 && (
                  <details className="mt-3 border-t border-amber-100/80 pt-2.5 text-xs">
                    <summary className="cursor-pointer font-semibold text-amber-900 hover:text-amber-950 select-none">
                      Previous Return Feedback ({returnNotifications.length - 1} earlier)
                    </summary>
                    <div className="mt-2 space-y-2.5 pl-2 border-l-2 border-amber-200">
                      {returnNotifications.slice(1).map((item, idx) => (
                        <div key={`${item.sent_at}-${idx}`} className="text-xs">
                          <div className="font-semibold text-neutral-600">
                            {formatSignatoryRole(item.signatory, orgQuery.data?.signatories)} •{" "}
                            {formatDisplayDateTime(item.sent_at)}
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-neutral-700">
                            {item.comment || "No comment"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ) : null}

          {isDependent && canResubmit ? (
            <div className="mb-6 rounded-2xl border border-amber-300/80 bg-gradient-to-b from-amber-50 to-amber-50/60 p-4 sm:p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-900 border border-amber-500/30">
                  <AlertCircle className="size-5 text-amber-800" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-amber-950">Application Returned</span>
                    <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
                      Collaborator View
                    </span>
                  </div>
                  <p className="text-xs text-amber-800/90 mt-0.5">
                    This application was returned for revision. As a collaborating organization, this view is read-only — the proponent organization manages edits and resubmission.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200/90 bg-white/95 p-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-3.5 text-amber-700" />
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                      Reason for Return
                    </span>
                  </div>
                  {(returnSignatoryLabel || latestReturnNotification?.sent_at) && (
                    <span className="text-xs font-medium text-neutral-500">
                      {returnSignatoryLabel ? `Returned by ${returnSignatoryLabel}` : ""}
                      {returnSignatoryLabel && latestReturnNotification?.sent_at ? " • " : ""}
                      {latestReturnNotification?.sent_at
                        ? formatDisplayDateTime(latestReturnNotification.sent_at)
                        : ""}
                    </span>
                  )}
                </div>

                <div className="pt-2.5">
                  {notificationsQuery.isLoading ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-neutral-500">
                      <Loader2 className="size-3.5 animate-spin text-amber-700" />
                      <span>Loading reviewer feedback…</span>
                    </div>
                  ) : latestReturnNotification?.comment ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed font-medium text-neutral-800">
                      {latestReturnNotification.comment}
                    </p>
                  ) : (
                    <p className="text-xs italic text-neutral-500">
                      No specific remarks were provided by the reviewer.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : isDependent ? (
            <div className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600">
              You are a collaborating organization on this application. It is read-only — the proponent organization manages edits and resubmission.
            </div>
          ) : null}

          {isDenied ? (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5 text-rose-900 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="size-4 shrink-0 text-rose-600" />
                <p className="text-sm font-bold text-rose-900">
                  This submission was denied and cannot be edited.
                </p>
              </div>
              {latestDeniedNotification?.comment ? (
                <div className="mt-3 rounded-xl border border-rose-200/80 bg-white/90 p-3.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider block mb-1">
                    Reason for Rejection
                  </span>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                    {latestDeniedNotification.comment}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {activity && activeTab === "details" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-center text-xs font-bold text-neutral-500 uppercase tracking-widest">
                  Proponents
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {activity.proponents.map((prop, idx) => (
                    <div
                      key={idx}
                      className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-3.5 text-center shadow-2xs hover:bg-neutral-100/50 transition-colors"
                    >
                      <p className="text-xs text-neutral-500 font-semibold">{prop.role}</p>
                      <p className="text-sm font-bold text-neutral-900 mt-0.5">{prop.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-neutral-200" />

              <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Event Date & Time</span>
                  <span className="font-medium text-neutral-600 sm:text-right">
                    {activity.time ? `${activity.time} ` : ""}{activity.date}
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Venue</span>
                  <span className="font-medium text-neutral-600 sm:text-right">{activity.venue}</span>
                </div>

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Estimated Budget</span>
                  <span className="font-medium text-neutral-600 sm:text-right">{activity.proposedBudget}</span>
                </div>

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Number of Participants</span>
                  <span className="font-medium text-neutral-600 sm:text-right">{activity.expectedParticipants}</span>
                </div>

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Activity type</span>
                  <span className="font-medium text-neutral-600 sm:text-right capitalize">
                    {activity.type}
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Event Nature</span>
                  <span className="font-medium sm:text-right">
                    {activity.nature?.toLowerCase() === "major" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider bg-red-100 text-[#8B0000] border border-red-200">
                        Major Event
                      </span>
                    ) : activity.nature?.toLowerCase() === "minor" ? (
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
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="text-sm font-bold text-neutral-900">
                  Description of the Activity
                </h4>
                <p className="text-sm text-neutral-700 leading-relaxed">
                  {activity.description}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-bold text-neutral-900">
                  Objectives of the Activity
                </h4>
                <ul className="space-y-2.5 text-sm text-neutral-700">
                  {activity.objectives.map((obj, idx) => (
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
                items={activity.budgetItems}
                grandTotal={activity.budgetGrandTotal}
              />

              <ActivityReservationDetails
                equipmentRequested={activity.equipmentRequested}
                roomsRequested={activity.roomsRequested}
                avEquipmentRequested={activity.avEquipmentRequested}
              />
            </div>
          )}

          {activeTab === "progress" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-bold text-neutral-900">Progress Tracking</h3>
                  <span className="text-xs text-neutral-500 font-medium">
                    {notificationsQuery.isLoading ? "Loading notifications…" : "From review notifications"}
                  </span>
                </div>

                <div className="mb-6 flex flex-col gap-2 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    {formatDocumentId(submissionId)} • Submitted {activity?.submittedDate || "—"} •{" "}
                    {stepper.isAllApproved
                      ? "All steps completed"
                      : `${stepper.remainingSteps} tasks remaining before final approval`}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-neutral-500">Overall progress</span>
                    <span className="text-base font-extrabold text-[#8B0000]">
                      {stepper.progressPercent}%
                    </span>
                  </div>
                </div>

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
                            left: totalSteps > 1
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
          )}

        </DialogPanel>

        <div className="flex shrink-0 justify-end gap-3 rounded-b-2xl border-t border-neutral-200 bg-white px-4 py-4 sm:px-8">
          {canResubmit && !isDependent ? (
            <Button
              type="button"
              onClick={handleResubmit}
              className="bg-[#8B0000] text-white hover:bg-[#700000] font-bold shadow-xs cursor-pointer"
            >
              Edit and resubmit
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={isSavingPdf || !activity}
            onClick={handleSavePdf}
            variant="outline"
            className="gap-2 text-neutral-800 cursor-pointer"
          >
            {isSavingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#8B0000]" />
            ) : (
              <DownloadIcon className="h-4 w-4 text-[#8B0000]" />
            )}
            Save as PDF
          </Button>
          <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
