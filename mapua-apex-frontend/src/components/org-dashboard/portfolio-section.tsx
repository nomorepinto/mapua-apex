import { useOrgStore, type Submission, type Task } from "@/stores/org-store"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

type StageItem = {
  title: string
  healthLabel?: string
  healthColor?: string
  tasksLabel?: string
  completed?: boolean
}

function firstTask(tasks: Task[], status: Task["status"]): Task | undefined {
  return tasks.find((task) => task.status === status)
}

function firstSubmission(
  submissions: Submission[],
  statuses: Submission["status"][]
): Submission | undefined {
  return submissions.find((submission) => statuses.includes(submission.status))
}

function taskItem(task: Task | undefined): StageItem | null {
  if (!task) return null
  if (task.status === "Completed") {
    return { title: task.title, completed: true }
  }
  if (task.status === "In Progress") {
    return {
      title: task.title,
      healthLabel: "Yellow",
      healthColor: "text-[#F59E0B]",
      tasksLabel: `${task.checklist.filter((item) => item.done).length}/${task.checklist.length || 0}`,
    }
  }
  return {
    title: task.title,
    healthLabel: "Green",
    healthColor: "text-[#10B981]",
    tasksLabel: `${task.checklist.filter((item) => item.done).length}/${task.checklist.length || 0}`,
  }
}

function submissionItem(
  submission: Submission | undefined,
  completed = false
): StageItem | null {
  if (!submission) return null
  if (completed) {
    return { title: submission.activity_details.title, completed: true }
  }
  const inProgress = submission.status === "Under Review"
  return {
    title: submission.activity_details.title,
    healthLabel: inProgress ? "Yellow" : "Green",
    healthColor: inProgress ? "text-[#F59E0B]" : "text-[#10B981]",
    tasksLabel: submission.status,
  }
}

function StageCard({
  label,
  borderClass,
  backgroundClass,
  labelClass,
  item,
  emptyText,
}: {
  label: string
  borderClass: string
  backgroundClass: string
  labelClass: string
  item: StageItem | null
  emptyText: string
}) {
  return (
    <div
      className={`flex h-full flex-col justify-between gap-4 rounded-2xl border border-neutral-200 ${backgroundClass} p-5`}
    >
      <span className={`h-1 w-10 rounded-full ${borderClass.replace("border-", "bg-")}`} />
      <span
        className={`text-sm font-extrabold tracking-wider uppercase ${labelClass}`}
      >
        {label}
      </span>
      <div className="flex flex-1 flex-col justify-center gap-3 rounded-xl bg-white p-6 shadow-xs">
        {item ? (
          <>
            <h3 className="text-xl leading-snug font-extrabold text-[#1E293B] sm:text-2xl">
              {item.title}
            </h3>
            {item.completed ? (
              <p className="pt-1 text-sm font-extrabold text-[#10B981] sm:text-base">
                Completed
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 text-sm text-[#64748B] sm:text-base">
                {item.healthLabel ? (
                  <p className="font-semibold">
                    Health:{" "}
                    <span className={`font-bold ${item.healthColor}`}>
                      {item.healthLabel}
                    </span>
                  </p>
                ) : null}
                {item.tasksLabel ? (
                  <p className="font-semibold">
                    Status:{" "}
                    <span className="font-bold text-[#1E293B]">
                      {item.tasksLabel}
                    </span>
                  </p>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm font-medium text-neutral-600">{emptyText}</p>
        )}
      </div>
    </div>
  )
}

export function PortfolioSection() {
  const tasks = useOrgStore((state) => state.milestoneTasks)
  const submissions = useOrgStore((state) => state.submissions)

  const planning =
    taskItem(firstTask(tasks, "Pending")) ??
    submissionItem(firstSubmission(submissions, ["Submitted", "Returned"]))
  const inProgress =
    taskItem(firstTask(tasks, "In Progress")) ??
    submissionItem(firstSubmission(submissions, ["Under Review"]))
  const completed =
    taskItem(firstTask(tasks, "Completed")) ??
    submissionItem(
      firstSubmission(submissions, ["Approved", "Completed"]),
      true
    )

  return (
    <div className={cn(layout.section, "flex w-full flex-col justify-between xl:col-span-2")}>
      <div>
        <h2 className="mb-1 text-xl font-bold text-[#1E293B] sm:text-2xl">
          Project & Event Portfolio
        </h2>
        <p className="mb-6 text-sm text-neutral-600">
          Overall project health, upcoming events, and committee tasks.
        </p>
      </div>

      <div className="grid flex-1 grid-cols-1 items-stretch gap-5 md:grid-cols-3">
        <StageCard
          label="Planning"
          borderClass="border-[#3B82F6]"
          backgroundClass="bg-[#F8FAFC]"
          labelClass="text-[#3B82F6]"
          item={planning}
          emptyText="No projects in planning."
        />
        <StageCard
          label="In-progress"
          borderClass="border-[#F59E0B]"
          backgroundClass="bg-[#FFFBEB]"
          labelClass="text-[#F59E0B]"
          item={inProgress}
          emptyText="No projects in progress."
        />
        <StageCard
          label="Completed"
          borderClass="border-[#10B981]"
          backgroundClass="bg-[#F0FDF4]"
          labelClass="text-[#10B981]"
          item={completed}
          emptyText="No completed projects yet."
        />
      </div>
    </div>
  )
}
