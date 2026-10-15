import { useMemo } from "react"
import { Bell, ChevronDown, ChevronUp, Clock, User } from "lucide-react"

import {
  mapProposalStatus,
  ProposalStatusBadge,
  type ProposalDashboardStatus,
} from "@/components/students/dashboard/student-calendar-card"
import { useStudentDashboard } from "@/components/students/dashboard/student-dashboard-context"
import { layout } from "@/config"
import { formatDisplayDateTime } from "@/lib/dynamodb-adapters"
import { cn } from "@/lib/utils"

interface TimelineItem {
  id: string
  eventId?: string
  submissionId?: string
  date: string
  dateStr: string
  title: string
  status: ProposalDashboardStatus
  reviewer: string
  comment?: string
}

export function RemindersPanel() {
  const { state, actions } = useStudentDashboard()
  const { submissions, reviewNotices, reminders, remindersExpanded } = state

  // Build live timeline items directly from real proposals, review notices, and deadlines
  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = []

    // 1. Add review notices from real submissions
    reviewNotices.forEach((notice) => {
      let mappedStatus: ProposalDashboardStatus = "Pending"
      if (notice.notifType === "approved" || notice.notifType === "fully approved") {
        mappedStatus = "Approved"
      } else if (notice.notifType === "denied") {
        mappedStatus = "Cancelled"
      } else {
        mappedStatus = "Pending"
      }

      items.push({
        id: `notice-${notice.id}`,
        eventId: notice.eventId,
        submissionId: notice.submissionId,
        date: notice.sentAt,
        dateStr: formatDisplayDateTime(notice.sentAt),
        title: notice.title,
        status: mappedStatus,
        reviewer: notice.signatoryLabel,
        comment: notice.comment,
      })
    })

    // 2. Add submission entries for proposals that have no review notices yet
    // (ensuring a newly submitted proposal immediately shows in Timeline Reminders)
    const coveredSubmissionIds = new Set(reviewNotices.map((n) => n.submissionId))

    submissions.forEach((sub) => {
      if (!coveredSubmissionIds.has(sub.submission_id)) {
        const mappedStatus = mapProposalStatus(sub.status, sub.api_status)
        items.push({
          id: `sub-${sub.submission_id}`,
          eventId: sub.event_id,
          submissionId: sub.submission_id,
          date: sub.sent_at,
          dateStr: formatDisplayDateTime(sub.sent_at),
          title: sub.activity_details.title,
          status: mappedStatus,
          reviewer: sub.current_signatory || "Adviser",
          comment:
            mappedStatus === "Approved"
              ? "All signatory reviews completed."
              : mappedStatus === "Cancelled"
                ? "Submission cancelled."
                : `Awaiting review by ${sub.current_signatory || "assigned signatory"}.`,
        })
      }
    })

    // 3. Add administrative deadline reminders if any exist
    reminders.forEach((rem) => {
      items.push({
        id: `deadline-${rem.id}`,
        date: rem.dateStr,
        dateStr: rem.dateStr,
        title: rem.title,
        status: "Pending",
        reviewer: "Administration",
        comment: `${rem.statusText} (Due: ${rem.dueDateText})`,
      })
    })

    // Sort newest first
    items.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))

    return items
  }, [submissions, reviewNotices, reminders])

  return (
    <div className={cn(layout.section, "overflow-hidden")}>
      <div
        onClick={actions.toggleReminders}
        className="group flex cursor-pointer items-center justify-between select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-[#8B0000] transition-colors group-hover:bg-red-100">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-neutral-900 transition-colors group-hover:text-[#8B0000]">
              Timeline Reminders
            </h2>
            <p className="text-xs text-neutral-500">
              Institutional action items timeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {timelineItems.length > 0 && (
            <span className="rounded-full border border-red-200/70 bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-[#8B0000]">
              {timelineItems.length}
            </span>
          )}
          {remindersExpanded ? (
            <ChevronUp className="h-4 w-4 text-neutral-500 transition-colors group-hover:text-neutral-900" />
          ) : (
            <ChevronDown className="h-4 w-4 text-neutral-500 transition-colors group-hover:text-neutral-900" />
          )}
        </div>
      </div>

      {remindersExpanded && (
        <div className="scrollbar-thin mt-4 max-h-[460px] overflow-y-auto border-t border-neutral-100 pt-3 pr-1">
          {state.remindersLoading ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              Loading reminders…
            </div>
          ) : timelineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 p-8 text-center">
              <Bell className="mb-2 h-6 w-6 text-neutral-300" />
              <p className="text-xs font-bold text-neutral-700">No reminders yet</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Timeline updates for your submitted proposals will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {timelineItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.eventId && item.submissionId) {
                      actions.openTracker(item.eventId, item.submissionId)
                    }
                  }}
                  className={cn(
                    "w-full rounded-xl border border-neutral-200 bg-white p-3.5 text-left shadow-2xs transition-all",
                    item.eventId && item.submissionId
                      ? "hover:border-neutral-300 hover:bg-neutral-50/50 cursor-pointer"
                      : "cursor-default"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500">
                      <Clock className="h-3 w-3" />
                      {item.dateStr}
                    </span>
                    <ProposalStatusBadge status={item.status} />
                  </div>

                  <h4 className="mt-1.5 text-xs font-bold text-neutral-900 leading-snug">
                    {item.title}
                  </h4>

                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-600">
                    <User className="h-3 w-3 text-neutral-400" />
                    <span>Reviewer: <strong className="text-neutral-800">{item.reviewer}</strong></span>
                  </div>

                  {item.comment && (
                    <p className="mt-2 line-clamp-2 rounded-lg bg-neutral-50 p-2 text-[11px] text-neutral-600">
                      {item.comment}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
