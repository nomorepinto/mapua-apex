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
  Stamp,
} from "lucide-react"

import { SubmissionSignatoriesTab } from "@/components/org/submission-signatories-tab"
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
import { formatDuration, overallTurnaroundMinutes } from "@/lib/turnaround"
import { brand, modal } from "@/config"
import { LoadingBlock } from "@/components/ui/loading-block"
import { Skeleton } from "@/components/ui/skeleton"
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
import { RecordTimeline } from "@/components/reports/record-timeline"
import { proposalTimeline } from "@/lib/timeline-reporting"

interface SubmissionTrackerModalProps {
  isOpen: boolean
  onClose: () => void
  eventId?: string | null
  submissionId?: string | null
  onRequestReservationChange?: () => void
}

export function SubmissionTrackerModal({
  isOpen,
  onClose,
  eventId,
  submissionId,
  onRequestReservationChange,
}: SubmissionTrackerModalProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<
    "details" | "progress" | "signatories"
  >("details")
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
      skipDean: Boolean(orgQuery.data?.skip_dean),
      orgSignatories: orgQuery.data?.signatories,
      signatorySequence: detailQuery.data?.signatory_sequence,
      signatoryChain: detailQuery.data?.signatory_chain,
      deskTimings: detailQuery.data?.desk_timings,
    }
  )

  const documentCode = formatDocumentId(
    submissionId || activity?.submissionId,
    "SAAF",
    detailQuery.data?.document_number || activity?.documentNumber
  )

  // Wall-clock turnaround from first submit to final approval; null (and thus
  // hidden) until the paper is fully approved.
  const overallTurnaroundLabel = detailQuery.data
    ? formatDuration(overallTurnaroundMinutes(detailQuery.data))
    : null

  const canResubmit = detailQuery.data?.status === "returned"
  const isDependent = detailQuery.data?.role === "dependent"
  const isDenied = detailQuery.data?.status === "denied"
  const canRequestReservationChange = Boolean(
    onRequestReservationChange &&
    !isDependent &&
    detailQuery.data?.status === "approved" &&
    detailQuery.data?.venue_reservation?.has_reservation
  )

  const returnNotifications = useMemo(() => {
    if (!notificationsQuery.data || notificationsQuery.data.length === 0)
      return []
    return notificationsQuery.data
      .filter((item) => item.notif_type === "returned")
      .sort((a, b) => (b.sent_at || "").localeCompare(a.sent_at || ""))
  }, [notificationsQuery.data])

  const latestReturnNotification = returnNotifications[0] || null

  const returnSignatoryLabel = useMemo(() => {
    if (!latestReturnNotification) return null
    const chain = detailQuery.data?.signatory_chain
    if (Array.isArray(chain) && chain.length > 0) {
      const stripId = (val?: string | null) =>
        (val || "").replace(/^SIGNATORY#/i, "").trim()
      const link = chain.find(
        (c) =>
          stripId(c.signatory_id) ===
          stripId(latestReturnNotification.signatory)
      )
      if (link) {
        const distinctOrgs = new Set(
          chain.map((c) => c.organization_id).filter(Boolean)
        )
        return signatoryChainLabel(link, distinctOrgs.size > 1)
      }
    }
    return formatSignatoryRole(
      latestReturnNotification.signatory,
      orgQuery.data?.signatories
    )
  }, [
    latestReturnNotification,
    detailQuery.data?.signatory_chain,
    orgQuery.data?.signatories,
  ])

  const latestDeniedNotification = useMemo(() => {
    if (!notificationsQuery.data || notificationsQuery.data.length === 0)
      return null
    return (
      notificationsQuery.data
        .filter((n) => n.notif_type === "denied")
        .sort((a, b) => (b.sent_at || "").localeCompare(a.sent_at || ""))[0] ||
      null
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
                {documentCode}
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

            <DialogTitle className="text-2xl leading-tight font-extrabold tracking-tight text-white sm:text-3xl">
              {detailQuery.isLoading
                ? "Loading submission…"
                : `${activity?.title || "Submission"} Proposal`}
            </DialogTitle>

            <p className="mt-1.5 text-xs font-medium text-[#FBC02D] sm:text-sm">
              Submitted by: {activity?.org || "Organization"} • Representative:{" "}
              {activity?.representative || "—"}
            </p>

            <div className="mt-4 flex items-center">
              <div className="inline-flex items-center rounded-xl border border-white/10 bg-black/20 p-1 backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
                    activeTab === "details"
                      ? "bg-white text-[#8B0000] shadow-xs"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Document Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("progress")}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
                    activeTab === "progress"
                      ? "bg-white text-[#8B0000] shadow-xs"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Milestone & Progress</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("signatories")}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
                    activeTab === "signatories"
                      ? "bg-white text-[#8B0000] shadow-xs"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Stamp className="h-3.5 w-3.5" />
                  <span>Signatories</span>
                </button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <DialogPanel className="flex-1 overflow-y-auto bg-white px-4 py-6 text-neutral-800 sm:px-8">
          {detailQuery.isLoading ? (
            <LoadingBlock
              label="Loading submission details"
              rowClassName="h-24 w-full"
            />
          ) : detailQuery.isError ? (
            <p className="text-sm font-semibold text-rose-600">
              Could not load this submission. Try again from the dashboard.
            </p>
          ) : null}

          {canResubmit && !isDependent ? (
            <div className="mb-6 rounded-2xl border border-amber-300/80 bg-gradient-to-b from-amber-50 to-amber-50/60 p-4 shadow-xs sm:p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 text-amber-900">
                    <AlertCircle className="size-5 text-amber-800" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-amber-950">
                        Application Returned
                      </span>
                      <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-amber-900 uppercase">
                        Action Required
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-amber-800/90">
                      Update this application and resubmit it to the current
                      signatory.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResubmit}
                  className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#8B0000] px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#700000]"
                >
                  Edit and resubmit
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200/90 bg-white/95 p-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-3.5 text-amber-700" />
                    <span className="text-xs font-bold tracking-wider text-amber-950 uppercase">
                      Reason for Return
                    </span>
                  </div>
                  {(returnSignatoryLabel ||
                    latestReturnNotification?.sent_at) && (
                    <span className="text-xs font-medium text-neutral-500">
                      {returnSignatoryLabel
                        ? `Returned by ${returnSignatoryLabel}`
                        : ""}
                      {returnSignatoryLabel && latestReturnNotification?.sent_at
                        ? " • "
                        : ""}
                      {latestReturnNotification?.sent_at
                        ? formatDisplayDateTime(
                            latestReturnNotification.sent_at
                          )
                        : ""}
                    </span>
                  )}
                </div>

                <div className="pt-2.5">
                  {notificationsQuery.isLoading ? (
                    <LoadingBlock
                      label="Loading reviewer feedback"
                      rows={2}
                      rowClassName="h-4 w-full"
                    />
                  ) : latestReturnNotification?.comment ? (
                    <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap text-neutral-800">
                      {latestReturnNotification.comment}
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-500 italic">
                      No specific remarks were provided by the reviewer.
                    </p>
                  )}
                </div>

                {returnNotifications.length > 1 && (
                  <details className="mt-3 border-t border-amber-100/80 pt-2.5 text-xs">
                    <summary className="cursor-pointer font-semibold text-amber-900 select-none hover:text-amber-950">
                      Previous Return Feedback ({returnNotifications.length - 1}{" "}
                      earlier)
                    </summary>
                    <div className="mt-2 space-y-2.5 border-l-2 border-amber-200 pl-2">
                      {returnNotifications.slice(1).map((item, idx) => (
                        <div key={`${item.sent_at}-${idx}`} className="text-xs">
                          <div className="font-semibold text-neutral-600">
                            {formatSignatoryRole(
                              item.signatory,
                              orgQuery.data?.signatories
                            )}{" "}
                            • {formatDisplayDateTime(item.sent_at)}
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
            <div className="mb-6 rounded-2xl border border-amber-300/80 bg-gradient-to-b from-amber-50 to-amber-50/60 p-4 shadow-xs sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 text-amber-900">
                  <AlertCircle className="size-5 text-amber-800" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-amber-950">
                      Application Returned
                    </span>
                    <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-amber-900 uppercase">
                      Collaborator View
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-amber-800/90">
                    This application was returned for revision. As a
                    collaborating organization, this view is read-only — the
                    proponent organization manages edits and resubmission.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200/90 bg-white/95 p-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-3.5 text-amber-700" />
                    <span className="text-xs font-bold tracking-wider text-amber-950 uppercase">
                      Reason for Return
                    </span>
                  </div>
                  {(returnSignatoryLabel ||
                    latestReturnNotification?.sent_at) && (
                    <span className="text-xs font-medium text-neutral-500">
                      {returnSignatoryLabel
                        ? `Returned by ${returnSignatoryLabel}`
                        : ""}
                      {returnSignatoryLabel && latestReturnNotification?.sent_at
                        ? " • "
                        : ""}
                      {latestReturnNotification?.sent_at
                        ? formatDisplayDateTime(
                            latestReturnNotification.sent_at
                          )
                        : ""}
                    </span>
                  )}
                </div>

                <div className="pt-2.5">
                  {notificationsQuery.isLoading ? (
                    <LoadingBlock
                      label="Loading reviewer feedback"
                      rows={2}
                      rowClassName="h-4 w-full"
                    />
                  ) : latestReturnNotification?.comment ? (
                    <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap text-neutral-800">
                      {latestReturnNotification.comment}
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-500 italic">
                      No specific remarks were provided by the reviewer.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : isDependent ? (
            <div className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600">
              You are a collaborating organization on this application. It is
              read-only — the proponent organization manages edits and
              resubmission.
            </div>
          ) : null}

          {isDenied ? (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900 shadow-2xs sm:p-5">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="size-4 shrink-0 text-rose-600" />
                <p className="text-sm font-bold text-rose-900">
                  This submission was denied and cannot be edited.
                </p>
              </div>
              {latestDeniedNotification?.comment ? (
                <div className="mt-3 rounded-xl border border-rose-200/80 bg-white/90 p-3.5 shadow-2xs">
                  <span className="mb-1 block text-[11px] font-bold tracking-wider text-rose-900 uppercase">
                    Reason for Rejection
                  </span>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-800">
                    {latestDeniedNotification.comment}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {activity && activeTab === "details" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-center text-xs font-bold tracking-widest text-neutral-500 uppercase">
                  Proponents
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {activity.proponents.map((prop, idx) => (
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

              <hr className="border-neutral-200" />

              <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">
                    Event Date & Time
                  </span>
                  <span className="font-medium text-neutral-600 sm:text-right">
                    {activity.time ? `${activity.time} ` : ""}
                    {activity.date}
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">Venue</span>
                  <span className="font-medium text-neutral-600 sm:text-right">
                    {activity.venue}
                  </span>
                </div>

                {activity.hasBudget !== false && (
                  <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-bold text-neutral-900">
                      Estimated Budget
                    </span>
                    <span className="font-medium text-neutral-600 sm:text-right">
                      {activity.proposedBudget}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">
                    Number of Participants
                  </span>
                  <span className="font-medium text-neutral-600 sm:text-right">
                    {activity.expectedParticipants}
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">
                    Activity type
                  </span>
                  <span className="font-medium text-neutral-600 capitalize sm:text-right">
                    {activity.type}
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-neutral-900">
                    Event Nature
                  </span>
                  <span className="font-medium sm:text-right">
                    {activity.nature?.toLowerCase() === "major" ? (
                      <span className="inline-flex items-center rounded-md border border-red-200 bg-red-100 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wider text-[#8B0000] uppercase">
                        Major Event
                      </span>
                    ) : activity.nature?.toLowerCase() === "minor" ? (
                      <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wider text-neutral-700 uppercase">
                        Minor Event
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400 italic">
                        Pending classification
                      </span>
                    )}
                  </span>
                </div>

                {detailQuery.data?.privacy_consent ? (
                  <div className="flex flex-col gap-1 border-b border-neutral-100 py-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-bold text-neutral-900">
                      Data privacy consent
                    </span>
                    <span className="font-medium text-neutral-600 sm:text-right">
                      v{detailQuery.data.privacy_consent.version} accepted{" "}
                      {formatDisplayDateTime(
                        detailQuery.data.privacy_consent.accepted_at
                      )}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="text-sm font-bold text-neutral-900">
                  Description of the Activity
                </h4>
                <p className="text-sm leading-relaxed text-neutral-700">
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
            <div className="animate-in fade-in space-y-6 duration-200">
              {notificationsQuery.isError ? (
                <div role="alert" className="space-y-2 text-sm text-red-700">
                  Review history could not be retrieved.{" "}
                  <Button
                    variant="outline"
                    onClick={() => notificationsQuery.refetch()}
                  >
                    Retry history
                  </Button>
                </div>
              ) : (
                notificationsQuery.isSuccess && (
                  <RecordTimeline
                    key={`${eventId}:${submissionId}`}
                    kind="proposal_timeline"
                    source={proposalTimeline(
                      notificationsQuery.data,
                      submissionId
                    )}
                  />
                )
              )}
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xs sm:p-6">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-base font-bold text-neutral-900">
                    Progress Tracking
                  </h3>
                  <span className="text-xs font-medium text-neutral-500">
                    {notificationsQuery.isLoading ? (
                      <Skeleton
                        aria-label="Loading notifications"
                        className="h-3 w-36"
                        role="status"
                      />
                    ) : (
                      "From review notifications"
                    )}
                  </span>
                </div>

                {overallTurnaroundLabel ? (
                  <p className="mb-4 text-xs font-medium text-neutral-600">
                    Total time to final approval ·{" "}
                    <span className="font-bold text-neutral-900">
                      {overallTurnaroundLabel}
                    </span>
                  </p>
                ) : null}

                <div className="mb-6 flex flex-col gap-2 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    {documentCode} • Submitted {activity?.submittedDate || "—"}{" "}
                    •{" "}
                    {stepper.isAllApproved
                      ? "All steps completed"
                      : `${stepper.remainingSteps} tasks remaining before final approval`}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-neutral-500">
                      Overall progress
                    </span>
                    <span className="text-base font-extrabold text-[#8B0000]">
                      {stepper.progressPercent}%
                    </span>
                  </div>
                </div>

                <ol className="flex flex-col gap-3 md:hidden">
                  {stepper.fullSteps.map((stepName, idx) => {
                    const isCompleted =
                      stepper.isAllApproved || idx < stepper.currentStepIdx
                    const isCurrent =
                      !stepper.isAllApproved && idx === stepper.currentStepIdx
                    let nodeBg =
                      "bg-neutral-100 border-neutral-300 text-neutral-400"
                    if (isCompleted) {
                      nodeBg =
                        "bg-emerald-100 border-emerald-500 text-emerald-800"
                    } else if (isCurrent) {
                      nodeBg =
                        "bg-amber-100 border-amber-500 text-amber-900 ring-4 ring-amber-100"
                    }

                    return (
                      <li
                        key={`${stepName}-${idx}`}
                        className="flex items-center gap-3"
                      >
                        <div
                          className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 font-bold shadow-xs ${nodeBg}`}
                        >
                          {isCompleted ? (
                            <Check className="h-5 w-5 stroke-[2.5] text-emerald-800" />
                          ) : isCurrent ? (
                            <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-amber-500"></span>
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

                <div className="relative hidden px-2 py-4 select-none md:block">
                  <div className="absolute top-9 right-8 left-8 z-0 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                      style={{
                        width: `${
                          stepper.fullSteps.length > 1
                            ? (Math.min(
                                stepper.currentStepIdx,
                                stepper.fullSteps.length - 1
                              ) /
                                (stepper.fullSteps.length - 1)) *
                              100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>

                  <div className="relative z-10 min-h-[76px] w-full">
                    {stepper.fullSteps.map((stepName, idx) => {
                      const totalSteps = stepper.fullSteps.length
                      const isCompleted =
                        stepper.isAllApproved || idx < stepper.currentStepIdx
                      const isCurrent =
                        !stepper.isAllApproved && idx === stepper.currentStepIdx

                      let nodeBg =
                        "bg-neutral-100 border-neutral-300 text-neutral-400"
                      if (isCompleted) {
                        nodeBg =
                          "bg-emerald-100 border-emerald-500 text-emerald-800"
                      } else if (isCurrent) {
                        nodeBg =
                          "bg-amber-100 border-amber-500 text-amber-900 ring-4 ring-amber-100"
                      }

                      return (
                        <div
                          key={`${stepName}-${idx}`}
                          className="absolute top-4 flex -translate-x-1/2 flex-col items-center"
                          style={{
                            left:
                              totalSteps > 1
                                ? `calc(32px + (100% - 64px) * ${idx / (totalSteps - 1)})`
                                : "50%",
                          }}
                        >
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold shadow-xs transition-all duration-300 ${nodeBg}`}
                          >
                            {isCompleted ? (
                              <Check className="h-5 w-5 stroke-[2.5] text-emerald-800" />
                            ) : isCurrent ? (
                              <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-amber-500"></span>
                            ) : (
                              <span className="h-2.5 w-2.5 rounded-full bg-neutral-300"></span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "mt-2 max-w-[120px] truncate px-1 text-center text-xs font-bold whitespace-nowrap",
                              isCompleted
                                ? "text-neutral-900"
                                : isCurrent
                                  ? "font-extrabold text-amber-900"
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

              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xs sm:p-6">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-base font-bold text-neutral-900">
                    Signatory Approvals
                  </h3>
                </div>
                <p className="mb-4 text-xs font-semibold text-neutral-500">
                  Required Reviewers
                </p>
                <div className="space-y-3.5">
                  {stepper.assigneesList.map((item, idx) => {
                    let iconBg = "bg-neutral-200 text-neutral-400"
                    if (item.state === "completed")
                      iconBg = "bg-emerald-500 text-white"
                    else if (item.state === "current")
                      iconBg = "bg-amber-500 text-white"

                    return (
                      <div
                        key={`${item.role}-${idx}`}
                        className="flex items-center gap-3"
                      >
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconBg}`}
                        >
                          {item.state === "completed" ? (
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-white"></div>
                          )}
                        </div>
                        <div className="min-w-0 text-xs font-medium text-neutral-900 sm:text-sm">
                          <span className="font-bold">{item.name}</span>
                          <span className="text-neutral-500">
                            {" "}
                            — {item.statusText}
                          </span>
                          {item.turnaroundText ? (
                            <p className="text-[11px] font-medium text-neutral-500">
                              {item.turnaroundText}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "signatories" && (
            <SubmissionSignatoriesTab
              contacts={detailQuery.data?.approval_chain_contacts ?? []}
            />
          )}
        </DialogPanel>

        <div className="flex shrink-0 justify-end gap-3 rounded-b-2xl border-t border-neutral-200 bg-white px-4 py-4 sm:px-8">
          {canResubmit && !isDependent ? (
            <Button
              type="button"
              onClick={handleResubmit}
              className="cursor-pointer bg-[#8B0000] font-bold text-white shadow-xs hover:bg-[#700000]"
            >
              Edit and resubmit
            </Button>
          ) : null}
          {canRequestReservationChange ? (
            <Button
              type="button"
              onClick={onRequestReservationChange}
              className="cursor-pointer bg-[#8B0000] font-bold text-white shadow-xs hover:bg-[#700000]"
            >
              Request a reservation change
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={isSavingPdf || !activity}
            onClick={handleSavePdf}
            variant="outline"
            className="cursor-pointer gap-2 text-neutral-800"
          >
            {isSavingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#8B0000]" />
            ) : (
              <DownloadIcon className="h-4 w-4 text-[#8B0000]" />
            )}
            Save as PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
