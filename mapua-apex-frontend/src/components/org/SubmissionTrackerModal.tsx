import { useState } from "react"
import { useNavigate } from "react-router"
import { X, Check, FileText, CheckCircle2 } from "lucide-react"

import {
  useSubmissionDetailQuery,
  useSubmissionNotificationsQuery,
  useCurrentOrganizationQuery,
} from "@/hooks/use-submissions"
import {
  apiNotificationsToStepper,
  apiSubmissionToDashboardRow,
  formatDocumentId,
} from "@/lib/dynamodb-adapters"
import { useOrgStore } from "@/stores/org-store"
import { layout, modal } from "@/config"
import { cn } from "@/lib/utils"

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

  const orgQuery = useCurrentOrganizationQuery()
  const detailQuery = useSubmissionDetailQuery(
    isOpen ? eventId || undefined : undefined,
    isOpen ? submissionId || undefined : undefined
  )
  const notificationsQuery = useSubmissionNotificationsQuery(
    isOpen ? eventId || undefined : undefined,
    isOpen ? submissionId || undefined : undefined
  )

  if (!isOpen || !eventId || !submissionId) return null

  const submission = detailQuery.data
    ? apiSubmissionToDashboardRow(detailQuery.data, orgQuery.data?.signatories)
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
    }
  )
  const canResubmit = submission?.api_status === "returned"
  const isDenied = submission?.api_status === "denied"
  const currentSignatoryName =
    submission?.status === "Approved" || submission?.api_status === "approved"
      ? "Completed"
      : stepper.assigneesList.find((a) => a.state === "current")?.name ||
        submission?.current_signatory ||
        "—"

  const handleResubmit = () => {
    useOrgStore.getState().setEditingSubmission(eventId, submissionId)
    onClose()
    navigate(
      `/students/submissions/saaf?event=${encodeURIComponent(eventId)}&submission=${encodeURIComponent(submissionId)}`
    )
  }

  return (
    <div className={modal.overlay}>
      <div className={cn(modal.shell, modal.xl, modal.tall)}>
        <div className={modal.header}>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-red-50 px-2 py-0.5 font-mono text-xs font-bold text-[#D9291C]" title={submission?.id || submissionId}>
                {formatDocumentId(submission?.id || submissionId)}
              </span>
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-extrabold tracking-wider text-[#475569] uppercase">
                {submission?.activity_classification || "saaf"}
              </span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-[#1E293B] sm:text-2xl">
              {detailQuery.isLoading
                ? "Loading submission…"
                : submission?.activity_details.title || "Submission"}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-[#64748B]">
              {submission?.activity_details.proponent
                ? `Submitted by ${submission.activity_details.proponent}`
                : "Student activity application"}
            </p>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative flex h-11 w-full items-center rounded-xl border border-slate-200/80 bg-slate-100/90 p-1 shadow-inner sm:h-10 sm:w-84">
              <div
                className="absolute top-1 bottom-1 z-0 rounded-lg border border-slate-200/60 bg-white shadow-xs transition-all duration-200 ease-in-out"
                style={{
                  left: activeTab === "details" ? "4px" : "calc(50% + 2px)",
                  width: "calc(50% - 6px)",
                }}
              ></div>

              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`relative z-10 flex h-full w-1/2 cursor-pointer items-center justify-center gap-2 rounded-lg text-center text-xs select-none transition-colors ${
                  activeTab === "details"
                    ? "font-bold text-[#D9291C]"
                    : "font-medium text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText
                  className={`h-3.5 w-3.5 shrink-0 ${activeTab === "details" ? "text-[#D9291C]" : "text-slate-400"}`}
                />
                <span className="sm:hidden">Details</span>
                <span className="hidden sm:inline">Document Details</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("progress")}
                className={`relative z-10 flex h-full w-1/2 cursor-pointer items-center justify-center gap-2 rounded-lg text-center text-xs select-none transition-colors ${
                  activeTab === "progress"
                    ? "font-bold text-[#D9291C]"
                    : "font-medium text-slate-500 hover:text-slate-800"
                }`}
              >
                <CheckCircle2
                  className={`h-3.5 w-3.5 shrink-0 ${activeTab === "progress" ? "text-[#D9291C]" : "text-slate-400"}`}
                />
                <span className="sm:hidden">Progress</span>
                <span className="hidden sm:inline">Milestone & Progress</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={cn(modal.close, "self-end sm:self-center")}
              aria-label="Close submission tracker"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className={cn(modal.body, layout.stack, "bg-neutral-50/40")}>
          {detailQuery.isError ? (
            <p className="text-sm font-semibold text-rose-600">
              Could not load this submission. Try again from the dashboard.
            </p>
          ) : null}

          {activeTab === "details" && submission && (
            <div className={cn(layout.stack, "animate-in fade-in duration-200")}>
              <div className={cn("grid grid-cols-1 items-stretch lg:grid-cols-2", layout.gap)}>
                <div className={cn(layout.section, "flex flex-col")}>
                  <h3 className="text-lg font-extrabold text-[#1E293B] mb-4">
                    Document Specification & Details
                  </h3>

                  <div className={layout.tableWrap}>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-100 text-xs font-bold text-neutral-600 tracking-wider">
                          <th className="pb-3 pr-4 w-1/3">Field</th>
                          <th className="pb-3">Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 text-xs sm:text-sm">
                        <tr>
                          <td className="py-3 pr-4 font-semibold text-[#64748B]">
                            Document / Event Name
                          </td>
                          <td className="py-3 font-bold text-[#1E293B]">
                            {submission.activity_details.title}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 pr-4 font-semibold text-[#64748B]">
                            Classification
                          </td>
                          <td className="py-3 font-bold text-[#1E293B] capitalize">
                            {submission.activity_classification}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 pr-4 font-semibold text-[#64748B]">
                            Requested Venue
                          </td>
                          <td className="py-3 font-medium text-[#1E293B]">
                            {submission.activity_details.venue}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 pr-4 font-semibold text-[#64748B]">
                            Proposed Date & Time
                          </td>
                          <td className="py-3 font-medium text-[#1E293B]">
                            {submission.activity_details.date}
                            {submission.activity_details.time
                              ? ` | ${submission.activity_details.time}`
                              : ""}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 pr-4 font-semibold text-[#64748B]">
                            Expected Attendees
                          </td>
                          <td className="py-3 font-medium text-[#1E293B]">
                            {submission.activity_details.expected_attendees ?? "—"} students
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 pr-4 font-semibold text-[#64748B]">
                            Estimated Budget
                          </td>
                          <td className="py-3 font-medium text-[#1E293B]">
                            {submission.activity_details.budget}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className={cn(layout.section, "flex-1 flex flex-col min-h-[220px]")}>
                    <h4 className="text-xs font-bold text-neutral-600 uppercase tracking-wider mb-2 shrink-0">
                      Description
                    </h4>
                    <div className="flex-1 overflow-y-auto max-h-[260px] pr-2 space-y-3 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                      <p className="text-sm text-[#1E293B] leading-relaxed">
                        {submission.activity_details.description || "No description provided."}
                      </p>
                      {submission.activity_details.objectives ? (
                        <div className="pt-3 border-t border-neutral-100">
                          <h5 className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                            Objectives
                          </h5>
                          <p className="text-sm text-[#1E293B] leading-relaxed">
                            {submission.activity_details.objectives}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className={cn(layout.section, "shrink-0")}>
                    <h4 className="text-xs font-bold text-neutral-600 uppercase tracking-wider mb-2">
                      Proponent & Routing
                    </h4>
                    <p className="text-xs text-[#64748B] mb-3">
                      Current signatory:{" "}
                      <span className="font-bold text-[#1E293B]">
                        {currentSignatoryName}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-lg border ${
                          submission.nature === "major"
                            ? "bg-emerald-100 text-[#065F46] border-emerald-300 ring-1 ring-emerald-400"
                            : submission.nature === "minor"
                            ? "bg-emerald-50 text-[#10B981] border-emerald-200"
                            : "text-[#475569] bg-neutral-100 border-neutral-200/60"
                        }`}
                      >
                        {submission.nature
                          ? `${submission.status} (${submission.nature.charAt(0).toUpperCase() + submission.nature.slice(1)})`
                          : submission.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "progress" && (
            <div className={cn(layout.stack, "animate-in fade-in duration-200")}>
              <div className={layout.section}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-extrabold text-[#1E293B]">Progress</h3>
                  <span className="text-xs text-neutral-600 font-medium">
                    {notificationsQuery.isLoading ? "Loading notifications…" : "From review notifications"}
                  </span>
                </div>

                <div className="mb-6 flex flex-col gap-2 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    {formatDocumentId(submissionId)} • Submitted {submission?.submitted_date || "—"} •{" "}
                    {stepper.isAllApproved
                      ? "All steps completed"
                      : `${stepper.remainingSteps} tasks remaining before final approval`}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-[#64748B]">Overall progress</span>
                    <span className="text-base font-extrabold text-[#1E293B]">
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
                      nodeBg = "bg-[#D1FAE5] border-[#10B981] text-[#065F46]"
                    } else if (isCurrent) {
                      nodeBg = "bg-[#FEF3C7] border-[#F59E0B] text-[#92400E] ring-4 ring-amber-100"
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
                              ? "text-[#1E293B]"
                              : isCurrent
                                ? "font-extrabold text-amber-900"
                                : "text-slate-400"
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
                      className="h-full bg-[#10B981] rounded-full transition-all duration-500 ease-out"
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
                        nodeBg = "bg-[#D1FAE5] border-[#10B981] text-[#065F46]"
                      } else if (isCurrent) {
                        nodeBg = "bg-[#FEF3C7] border-[#F59E0B] text-[#92400E] ring-4 ring-amber-100"
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
                                ? "text-[#1E293B]"
                                : isCurrent
                                ? "text-amber-900 font-extrabold"
                                : "text-slate-400"
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

              <div className={layout.section}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-extrabold text-[#1E293B]">Pending approval</h3>
                </div>
                <p className="text-xs font-bold text-[#64748B] mb-4">Assignees</p>
                <div className="space-y-4">
                  {stepper.assigneesList.map((item, idx) => {
                    let iconBg = "bg-neutral-200 text-neutral-400"
                    if (item.state === "completed") iconBg = "bg-[#10B981] text-white"
                    else if (item.state === "current") iconBg = "bg-[#FBBF24] text-white"

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
                        <div className="text-xs sm:text-sm font-medium text-[#1E293B]">
                          <span className="font-bold">{item.name}</span>
                          <span className="text-[#64748B]"> — {item.statusText}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {canResubmit ? (
            <div className={cn(layout.section, "space-y-4")}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-[#475569]">
                  Update this application and resubmit it to the current signatory.
                </p>
                <button
                  type="button"
                  onClick={handleResubmit}
                  className="min-h-11 rounded-xl bg-[#1E293B] px-4 py-2 text-xs font-bold text-white"
                >
                  Edit and resubmit
                </button>
              </div>
            </div>
          ) : null}

          {isDenied ? (
            <div className={cn(layout.section)}>
              <p className="text-sm text-[#475569]">
                This submission was denied and cannot be edited.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
