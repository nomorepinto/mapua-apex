import { getProgressColor } from "@/lib/progress-color"
import type { Task } from "@/stores/org-store"

export function getAssignedText(task: Task) {
  const owners = new Set(
    task.checklist.map((item) => item.ownerName).filter(Boolean)
  )
  if (owners.size > 1) return "Multiple"
  if (owners.size === 1) return Array.from(owners)[0]
  return task.responsible
}

export function useMilestoneStats(tasks: Task[]) {
  let completedTasks = 0
  let inProgressTasks = 0
  let pendingTasks = 0

  for (const task of tasks) {
    if (task.status === "Completed") completedTasks += 1
    else if (task.status === "In Progress") inProgressTasks += 1
    else pendingTasks += 1
  }

  const totalTasks = tasks.length
  const progressPercent =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
  const progressColor = getProgressColor(progressPercent)
  const strokeDashoffset = 251.3 - 251.3 * (progressPercent / 100)

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    pendingTasks,
    progressPercent,
    progressColor,
    strokeDashoffset,
  }
}
