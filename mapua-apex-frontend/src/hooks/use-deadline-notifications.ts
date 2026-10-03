import type { Submission } from "@/stores/org-store"

export interface DeadlineNotification {
  sub: Submission
  diffDays: number
}

export function useDeadlineNotifications(submissions: Submission[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const notifications: DeadlineNotification[] = []

  for (const sub of submissions) {
    if (sub.status !== "Submitted" && sub.status !== "Under Review") continue

    const target = new Date(sub.target_date)
    target.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil(
      (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (diffDays > 7) continue
    notifications.push({ sub, diffDays })
  }

  notifications.sort((a, b) => a.diffDays - b.diffDays)
  return notifications
}
