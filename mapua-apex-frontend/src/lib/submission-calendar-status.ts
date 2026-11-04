import type { Activity } from "@/components/ui/activity.types"
import { getDatesInRange, toLocalDateKey } from "@/lib/calendar-utils"

/**
 * Calendar row categories. The two themes in `SubmissionCalendarSection` use
 * disjoint subsets of these: the detailed desk set (OSAAR / dean / CDM) and the
 * adviser's collapsed set.
 */
export type SubmissionCalendarStatus =
  | "approved"
  | "under_review"
  | "denied"
  | "returned"
  | "pending"
  | "cancelled"

/**
 * Normalizes a submission's `Activity` status into the calendar category a desk
 * plots. Preserves the previous admin/CDM mapping: Accepted/Finished approved,
 * Rejected denied, Returned returned, everything else (Cancelled and Pending
 * Dean Approval included) under review.
 */
export function getSubmissionCalendarStatus(
  activity: Activity
): "approved" | "under_review" | "denied" | "returned" {
  const status = (activity.status ?? "").toLowerCase()
  if (status === "accepted" || status === "finished") return "approved"
  if (status === "rejected" || activity.decision === "Reject") return "denied"
  if (status === "returned" || activity.decision === "Return") return "returned"
  return "under_review"
}

/**
 * The adviser's 3-state view, used by `statusTheme="simple"`: returned and
 * dean-pending papers are not distinctions it acts on, so they collapse into
 * pending (previously `getAdviserActivityCalendarStatus`).
 */
export function getSimpleCalendarStatus(
  activity: Activity
): "approved" | "pending" | "cancelled" {
  const status = (activity.status ?? "").toLowerCase()
  if (status === "accepted" || status === "finished") return "approved"
  if (
    status === "rejected" ||
    status === "cancelled" ||
    activity.decision === "Reject"
  ) {
    return "cancelled"
  }
  return "pending"
}

/**
 * Drops repeat views of the same paper — a submission can sit in both the
 * queue and the history list of one desk.
 */
export function dedupeBySubmission(activities: Activity[]): Activity[] {
  const seen = new Set<string>()
  return activities.filter((activity) => {
    const key = `${activity.eventId}:${activity.submissionId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Default plotting dates: the event span, falling back to when it was filed. */
export function submissionDateKeys(activity: Activity): string[] {
  if (activity.dateOfEvent) {
    return getDatesInRange(
      activity.dateOfEvent,
      activity.endDateOfEvent || activity.dateOfEvent
    )
  }
  const sentKey = toLocalDateKey(activity.submittedAt)
  return sentKey ? [sentKey] : []
}
