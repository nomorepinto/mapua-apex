import { CheckCircle } from "lucide-react"

import { useMilestoneStats } from "@/hooks/use-milestone-stats"
import type { Task } from "@/stores/org-store"
import { layout } from "@/config"

export function MilestonePreview({
  tasks,
  onViewAll,
}: {
  tasks: Task[]
  onViewAll: () => void
}) {
  const { progressPercent, progressColor } = useMilestoneStats(tasks)

  return (
    <div className={layout.section}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-[#1E293B] sm:text-xl">
          Semestral Milestone
        </h2>
        <div className="flex items-center gap-3">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100 sm:w-36 sm:flex-none">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: progressColor,
              }}
            />
          </div>
          <span
            className="text-xs font-bold transition-colors duration-500 sm:text-sm"
            style={{ color: progressColor }}
          >
            {progressPercent}%
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {tasks.length === 0 ? (
          <p className="py-4 text-sm text-neutral-600">
            No milestone tasks yet. Open the tracker to add the first one.
          </p>
        ) : null}
        {tasks.slice(0, 3).map((task, index) => {
          const isCompleted = task.status === "Completed"
          const isInProgress = task.status === "In Progress"

          return (
            <div key={task.id} className="flex items-center gap-3.5">
              {isCompleted ? (
                <CheckCircle className="h-5.5 w-5.5 shrink-0 fill-[#10B981] stroke-white text-[#10B981]" />
              ) : (
                <div
                  className={`h-5.5 w-5.5 flex shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    isInProgress
                      ? "border-[#F59E0B] text-[#F59E0B]"
                      : "border-neutral-300 text-neutral-400"
                  }`}
                >
                  {index + 1}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h4
                    className={`text-sm font-bold ${
                      isInProgress ? "text-[#F59E0B]" : "text-[#1E293B]"
                    }`}
                  >
                    {task.title}
                  </h4>
                  {isInProgress ? (
                    <span className="rounded bg-[#FFFBEB] px-1.5 py-0.5 text-[10px] font-bold text-[#F59E0B]">
                      In Review
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-neutral-600">
                  {isCompleted
                    ? `Completed ${task.dueDate}`
                    : `Due ${task.dueDate}`}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onViewAll}
          className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#D9291C] hover:underline sm:text-sm"
        >
          View all &rarr;
        </button>
      </div>
    </div>
  )
}
