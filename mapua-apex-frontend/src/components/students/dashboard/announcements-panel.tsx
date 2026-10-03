import { Megaphone } from "lucide-react"

import { useStudentDashboard } from "@/components/students/dashboard/student-dashboard-context"
import { formatDisplayDateTime } from "@/lib/dynamodb-adapters"
import { layout } from "@/config"

export function AnnouncementsPanel() {
  const { state } = useStudentDashboard()

  return (
    <div className={layout.section}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-[#8B0000]">
          <Megaphone className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#1E293B]">Announcements</h2>
          <p className="text-xs text-neutral-600">Notices from administration</p>
        </div>
      </div>
      {state.announcementsLoading ? (
        <p className="rounded-xl bg-neutral-50 p-4 text-center text-sm font-medium text-neutral-600">
          Loading announcements…
        </p>
      ) : state.announcementsError ? (
        <p className="rounded-xl bg-red-50 p-4 text-center text-sm font-medium text-rose-700">
          Could not load announcements.
        </p>
      ) : state.announcements.length === 0 ? (
        <p className="rounded-xl bg-neutral-50 p-4 text-center text-sm font-medium text-neutral-600">
          No announcements at this time.
        </p>
      ) : (
        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
          {state.announcements.map((announcement) => (
            <article
              key={announcement.sent_at}
              className="rounded-xl bg-neutral-50 px-3 py-3"
            >
              <p className="text-xs font-semibold text-neutral-600">
                {formatDisplayDateTime(announcement.sent_at)}
              </p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-[#1E293B]">
                {announcement.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
