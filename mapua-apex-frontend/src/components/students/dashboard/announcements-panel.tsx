import { Megaphone } from "lucide-react"

import { useStudentDashboard } from "@/components/students/dashboard/student-dashboard-context"
import { formatDisplayDateTime } from "@/lib/dynamodb-adapters"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AnnouncementsPanel() {
  const { state } = useStudentDashboard()

  return (
    <div className={cn(layout.section, "overflow-hidden")}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-[#8B0000]">
          <Megaphone className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-neutral-900">Student Announcements</h2>
          <p className="text-xs text-neutral-500">Notices from administration</p>
        </div>
      </div>

      {state.announcementsLoading ? (
        <p className="rounded-xl bg-neutral-50 p-6 text-center text-xs font-medium text-neutral-500">
          Loading announcements…
        </p>
      ) : state.announcementsError ? (
        <p className="rounded-xl bg-red-50 p-6 text-center text-xs font-medium text-rose-700">
          Could not load announcements.
        </p>
      ) : state.announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 p-6 text-center">
          <Megaphone className="mb-2 h-6 w-6 text-neutral-300" />
          <p className="text-xs font-bold text-neutral-700">No announcements</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Administrative notices and bulletins will appear here.
          </p>
        </div>
      ) : (
        <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
          {state.announcements.map((announcement) => (
            <article
              key={announcement.sent_at}
              className="rounded-xl border border-neutral-100 bg-neutral-50/70 px-3.5 py-3 transition-colors hover:bg-neutral-50"
            >
              <p className="text-[11px] font-semibold text-neutral-500">
                {formatDisplayDateTime(announcement.sent_at)}
              </p>
              <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-neutral-800">
                {announcement.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
