import {
  AlertTriangle,
  Bell,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react"

import { useStudentDashboard } from "@/components/students/dashboard/student-dashboard-context"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function RemindersPanel() {
  const { state, actions } = useStudentDashboard()
  const reminderCount = state.reminders.length + state.reviewNotices.length

  return (
    <div className={layout.section}>
      <div
        onClick={actions.toggleReminders}
        className="group flex cursor-pointer items-center justify-between select-none"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-50 text-[#D9291C] transition-colors group-hover:bg-red-100">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1E293B] transition-colors group-hover:text-[#D9291C]">
              Timeline Reminders
            </h2>
            <p className="text-[11px] text-neutral-600">
              Institutional action items timeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {reminderCount > 0 ? (
            <span className="rounded-lg border border-red-200/60 bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-[#D9291C]">
              {reminderCount}
            </span>
          ) : null}
          {state.remindersExpanded ? (
            <ChevronUp className="h-5 w-5 text-neutral-600 transition-colors group-hover:text-[#1E293B]" />
          ) : (
            <ChevronDown className="h-5 w-5 text-neutral-600 transition-colors group-hover:text-[#1E293B]" />
          )}
        </div>
      </div>

      {state.remindersExpanded ? <RemindersBody /> : null}
    </div>
  )
}

function RemindersBody() {
  const { state } = useStudentDashboard()

  return (
    <div className="scrollbar-thin mt-4 max-h-[560px] overflow-y-auto border-t border-neutral-200 pt-3 pr-2">
      {state.remindersLoading ? (
        <div className="p-8 text-center text-sm text-neutral-500">
          Loading reminders…
        </div>
      ) : state.reminders.length === 0 && state.reviewNotices.length === 0 ? (
        <div className={cn(layout.empty, "gap-1.5 border border-neutral-200")}>
          <Bell className="mb-1 h-6 w-6 text-neutral-300" />
          <p className="font-bold text-[#1E293B]">No reminders at this time</p>
          <p className="text-sm text-neutral-500">
            Upcoming deadlines and review comments will appear here.
          </p>
        </div>
      ) : (
        <>
          <DeniedNoticeList />
          <ReturnedNoticeList />
          <ImportantReminderList />
          <UpcomingReminderList />
        </>
      )}
    </div>
  )
}

function DeniedNoticeList() {
  const { state, actions } = useStudentDashboard()
  if (state.deniedNotices.length === 0) return null

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-3 w-3 items-center justify-center rounded-full border-2 border-red-500 bg-white">
          <div className="h-1.5 w-1.5 rounded-full bg-red-500"></div>
        </div>
        <h3 className="font-sans text-lg font-light tracking-wide text-[#D9291C]">
          Denied
        </h3>
      </div>
      <div className="ml-1.5 space-y-4 border-l-2 border-red-300 pl-4">
        {state.deniedNotices.map((notice) => (
          <button
            key={notice.id}
            type="button"
            onClick={() => actions.selectNotice(notice)}
            className="relative flex min-h-11 w-full items-start gap-3 rounded-xl p-1 text-left transition-colors hover:bg-red-50/60"
          >
            <div className="absolute top-0.5 -left-[27px] flex h-6 w-6 items-center justify-center rounded-md border border-red-300 bg-white text-red-600 shadow-2xs">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 pl-1">
              <span className="mb-0.5 block text-sm text-neutral-500">
                {notice.dateStr}
              </span>
              <h4 className="text-sm font-bold tracking-tight text-[#1E293B] uppercase">
                {notice.title}
              </h4>
              <p className="mt-1 line-clamp-2 text-sm leading-snug font-semibold text-red-600">
                {notice.comment}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ReturnedNoticeList() {
  const { state, actions } = useStudentDashboard()
  if (state.returnedNotices.length === 0) return null

  return (
    <div className={state.deniedNotices.length > 0 ? "pt-4" : undefined}>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-3 w-3 items-center justify-center rounded-full border-2 border-amber-500 bg-white">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-500"></div>
        </div>
        <h3 className="font-sans text-lg font-light tracking-wide text-amber-800">
          Returned
        </h3>
      </div>
      <div className="ml-1.5 space-y-4 border-l-2 border-amber-300 pl-4">
        {state.returnedNotices.map((notice) => (
          <button
            key={notice.id}
            type="button"
            onClick={() => actions.selectNotice(notice)}
            className="relative flex min-h-11 w-full items-start gap-3 rounded-xl p-1 text-left transition-colors hover:bg-amber-50/60"
          >
            <div className="absolute top-0.5 -left-[27px] flex h-6 w-6 items-center justify-center rounded-md border border-amber-300 bg-white text-amber-700 shadow-2xs">
              <RotateCcw className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 pl-1">
              <span className="mb-0.5 block text-sm text-neutral-500">
                {notice.dateStr}
              </span>
              <h4 className="text-sm font-bold tracking-tight text-[#1E293B] uppercase">
                {notice.title}
              </h4>
              <p className="mt-1 line-clamp-2 text-sm leading-snug font-semibold text-amber-800">
                {notice.comment}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ImportantReminderList() {
  const { state, actions } = useStudentDashboard()
  if (state.importantReminders.length === 0) return null

  return (
    <div className={state.reviewNotices.length > 0 ? "pt-4" : undefined}>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-3 w-3 items-center justify-center rounded-full border-2 border-red-500 bg-white">
          <div className="h-1.5 w-1.5 rounded-full bg-red-500"></div>
        </div>
        <h3 className="font-sans text-lg font-light tracking-wide text-[#D9291C]">
          Important
        </h3>
      </div>
      <div className="ml-1.5 space-y-6 border-l-2 border-red-300 pl-4">
        {state.importantReminders.map((item) => (
          <div
            key={item.id}
            className="group relative flex items-start justify-between gap-3"
          >
            <div className="absolute top-0.5 -left-[27px] flex h-6 w-6 items-center justify-center rounded-md border border-red-300 bg-white text-red-600 shadow-2xs">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 pl-1">
              <span className="mb-0.5 block font-sans text-[11px] text-[#64748B] italic">
                {item.dateStr}
              </span>
              <h4 className="text-xs leading-tight font-bold tracking-tight text-[#1E293B] uppercase">
                {item.title}{" "}
                <span className="font-mono font-semibold text-neutral-500">
                  ({item.code})
                </span>
              </h4>
              <p className="mt-1 text-xs leading-snug font-semibold text-red-600">
                {item.statusText}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">
                Due Date: {item.dueDateText}
              </p>
            </div>
            <button
              onClick={() => actions.dismissReminder(item.id)}
              className="mt-1 min-h-11 shrink-0 cursor-pointer rounded bg-neutral-200/80 px-3 py-1 text-[11px] font-bold text-[#475569] transition-all hover:bg-neutral-300"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function UpcomingReminderList() {
  const { state, actions } = useStudentDashboard()
  if (state.upcomingReminders.length === 0) return null

  return (
    <div className="pt-2">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-3 w-3 items-center justify-center rounded-full border-2 border-neutral-400 bg-white">
          <div className="h-1.5 w-1.5 rounded-full bg-neutral-400"></div>
        </div>
        <h3 className="font-sans text-lg font-light tracking-wide text-[#475569]">
          Upcoming
        </h3>
      </div>
      <div className="ml-1.5 space-y-6 border-l-2 border-neutral-200 pl-4">
        {state.upcomingReminders.map((item) => (
          <div
            key={item.id}
            className="group relative flex items-start justify-between gap-3"
          >
            <div className="absolute top-0.5 -left-[27px] flex h-6 w-6 items-center justify-center rounded-md border border-neutral-300 bg-white text-[#64748B] shadow-2xs">
              <CheckSquare className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 pl-1">
              <span className="mb-0.5 block font-sans text-[11px] text-[#64748B] italic">
                {item.dateStr}
              </span>
              <h4 className="text-xs leading-tight font-bold tracking-tight text-[#1E293B] uppercase">
                {item.title}{" "}
                <span className="font-mono font-semibold text-neutral-500">
                  ({item.code})
                </span>
              </h4>
              <p className="mt-1 text-xs leading-snug font-semibold text-[#334155]">
                {item.statusText}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">
                Due Date: {item.dueDateText}
              </p>
            </div>
            <button
              onClick={() => actions.dismissReminder(item.id)}
              className="mt-1 min-h-11 shrink-0 cursor-pointer rounded bg-neutral-200/80 px-3 py-1 text-[11px] font-bold text-[#475569] transition-all hover:bg-neutral-300"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
