import type { Activity } from "./activity.types"

export interface StatItem {
  label: string
  value: string
  badgeText: string
  badgeVariant: "amber" | "emerald" | "rose" | "neutral"
}

function padStat(value: number): string {
  return String(value).padStart(2, "0")
}

export function computeReviewStats(activities: Activity[]): StatItem[] {
  let pending = 0
  let approved = 0
  let returned = 0

  for (const activity of activities) {
    if (activity.status === "Accepted") approved += 1
    else if (activity.status === "Returned") returned += 1
    else pending += 1
  }

  const reviewed = approved + returned

  return [
    {
      label: "Pending Review",
      value: padStat(pending),
      badgeText: pending > 0 ? "Action Required" : "None queued",
      badgeVariant: pending > 0 ? "amber" : "neutral",
    },
    {
      label: "Total Approved",
      value: padStat(approved),
      badgeText: approved > 0 ? "Authorized" : "None yet",
      badgeVariant: approved > 0 ? "emerald" : "neutral",
    },
    {
      label: "Returned for Revision",
      value: padStat(returned),
      badgeText: returned > 0 ? "Needs Edits" : "None",
      badgeVariant: returned > 0 ? "rose" : "neutral",
    },
    {
      label: "Total Reviewed",
      value: padStat(reviewed),
      badgeText: "Term Cumulative",
      badgeVariant: "neutral",
    },
  ]
}

export function buildDepartmentOrgMap(
  activities: Activity[]
): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const activity of activities) {
    if (!map[activity.department]) map[activity.department] = []
    if (!map[activity.department].includes(activity.org)) {
      map[activity.department].push(activity.org)
    }
  }
  return map
}
