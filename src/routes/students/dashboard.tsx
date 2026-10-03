import { AnnouncementsPanel } from "@/components/students/dashboard/announcements-panel"
import { StudentDashboardDialogs } from "@/components/students/dashboard/dashboard-dialogs"
import { StudentDashboardHeader } from "@/components/students/dashboard/dashboard-header"
import { RemindersPanel } from "@/components/students/dashboard/reminders-panel"
import { StudentDashboardProvider } from "@/components/students/dashboard/student-dashboard-context"
import { SubmissionsPanel } from "@/components/students/dashboard/submissions-panel"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function OrgDashboard() {
  return (
    <StudentDashboardProvider>
      <div className={cn(layout.page, layout.stack)}>
        <StudentDashboardHeader />
        <div className={cn(layout.grid3, layout.gap)}>
          <div className={cn("xl:col-span-2", layout.stack)}>
            <SubmissionsPanel />
            <AnnouncementsPanel />
          </div>
          <div className={cn("xl:col-span-1", layout.stack)}>
            <RemindersPanel />
          </div>
        </div>
        <StudentDashboardDialogs />
      </div>

      <div className={cn(layout.grid3, layout.gap)}>
        <div className={cn("xl:col-span-2", layout.stack)}>
          <div className={cn(layout.section, "overflow-hidden")}>
            <div className="mb-5">
              <h2 className="text-lg sm:text-xl font-bold text-[#1E293B]">
                Project Status & Submissions
              </h2>
              <p className="text-xs text-neutral-600">
                Track current signatory routing and approval statuses
              </p>
            </div>

            <div className={layout.tableWrap}>
              <Table className="w-full text-left">
                <TableHeader>
                  <TableRow className="text-neutral-600 text-xs font-bold uppercase tracking-wider border-b border-neutral-200">
                    <TableHead className="pb-3 pr-4 font-bold">DOCUMENT ID</TableHead>
                    <TableHead className="pb-3 pr-6 font-bold">EVENT TITLE</TableHead>
                    <TableHead className="pb-3 pr-4 font-bold">CLASSIFICATION</TableHead>
                    <TableHead className="pb-3 pr-4 font-bold">CURRENT SIGNATORY</TableHead>
                    <TableHead className="pb-3 font-bold text-right">STATUS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-neutral-50">
                  {submissionsQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-sm font-semibold text-neutral-600">
                        Loading submissions…
                      </TableCell>
                    </TableRow>
                  ) : submissionsQuery.isError ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-sm font-semibold text-rose-600">
                        Could not load submissions.
                      </TableCell>
                    </TableRow>
                  ) : submissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <p className="text-sm font-bold text-[#1E293B]">No submissions yet</p>
                          <p className="text-xs text-neutral-600 mb-2">
                            Create your first activity proposal to start tracking approvals.
                          </p>
                          <Link
                            to="/students/submissions"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B0000] px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#6B0000]"
                          >
                            <span>+ Create Project / Event</span>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    submissions.map((sub) => (
                      <TableRow
                        key={`${sub.event_id}:${sub.submission_id}`}
                        className="group cursor-pointer transition-colors hover:bg-neutral-50/80"
                        role="button"
                        tabIndex={0}
                        onClick={() => openTracker(sub.event_id, sub.submission_id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            openTracker(sub.event_id, sub.submission_id)
                          }
                        }}
                      >
                        <TableCell
                          className="py-3.5 pr-4 font-mono text-xs text-[#1E293B] font-bold whitespace-nowrap group-hover:text-[#D9291C]"
                          title={sub.submission_id}
                        >
                          {formatDocumentId(sub.submission_id)}
                        </TableCell>
                        <TableCell className="py-3.5 pr-6 text-xs text-[#1E293B] font-semibold">
                          {sub.activity_details.title}
                          {sub.requires_venue && (
                            <span className="ml-2 text-[10px] text-[#3B82F6] font-normal">
                              ({sub.activity_details.venue})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 pr-4 text-xs text-[#64748B] capitalize">
                          {sub.activity_classification}
                        </TableCell>
                        <TableCell className="py-3.5 pr-4 text-xs font-medium text-[#475569]">
                          {sub.current_signatory}
                        </TableCell>
                        <TableCell className="py-3.5 text-right whitespace-nowrap">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                              sub.nature === "major"
                                ? "bg-emerald-100 text-[#065F46] ring-1 ring-emerald-400"
                                : sub.nature === "minor"
                                ? "text-[#10B981] bg-emerald-50"
                                : getStatusTextColor(sub.status)
                            }`}
                          >
                            {sub.nature
                              ? `${sub.status} (${sub.nature.charAt(0).toUpperCase() + sub.nature.slice(1)})`
                              : sub.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className={layout.section}>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-[#8B0000]">
                <Megaphone className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1E293B]">
                  Announcements
                </h2>
                <p className="text-xs text-neutral-600">
                  Notices from administration
                </p>
              </div>
            </div>
            {announcementsQuery.isLoading ? (
              <p className="rounded-xl bg-neutral-50 p-4 text-center text-sm font-medium text-neutral-600">
                Loading announcements…
              </p>
            ) : announcementsQuery.isError ? (
              <p className="rounded-xl bg-red-50 p-4 text-center text-sm font-medium text-rose-700">
                Could not load announcements.
              </p>
            ) : announcements.length === 0 ? (
              <p className="rounded-xl bg-neutral-50 p-4 text-center text-sm font-medium text-neutral-600">
                No announcements at this time.
              </p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {announcements.map((announcement) => (
                  <article
                    key={announcement.sent_at}
                    className="rounded-xl bg-neutral-50 px-3 py-3"
                  >
                    <p className="text-xs font-semibold text-neutral-600">
                      {formatDisplayDateTime(announcement.sent_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#1E293B]">
                      {announcement.content}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={cn("xl:col-span-1", layout.stack)}>
          <div className={layout.section}>
            <div
              onClick={() => setIsRemindersExpanded(!isRemindersExpanded)}
              className="flex items-center justify-between cursor-pointer group select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-red-50 text-[#D9291C] flex items-center justify-center group-hover:bg-red-100 transition-colors">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1E293B] group-hover:text-[#D9291C] transition-colors">
                    Timeline Reminders
                  </h2>
                  <p className="text-[11px] text-neutral-600">Institutional action items timeline</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {reminders.length + reviewNotices.length > 0 && (
                  <span className="bg-red-50 text-[#D9291C] text-[10px] font-extrabold px-2 py-0.5 rounded-lg border border-red-200/60">
                    {reminders.length + reviewNotices.length}
                  </span>
                )}
                {isRemindersExpanded ? (
                  <ChevronUp className="w-5 h-5 text-neutral-600 group-hover:text-[#1E293B] transition-colors" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-neutral-600 group-hover:text-[#1E293B] transition-colors" />
                )}
              </div>
            </div>

            {isRemindersExpanded && (
              <div className="mt-4 pt-3 border-t border-neutral-200 max-h-[560px] overflow-y-auto pr-2 scrollbar-thin">
                {deadlinesQuery.isLoading || reviewNoticesQuery.isLoading ? (
                  <div className="p-8 text-center text-sm text-neutral-500">Loading reminders…</div>
                ) : reminders.length === 0 && reviewNotices.length === 0 ? (
                  <div className={cn(layout.empty, "gap-1.5 border border-neutral-200")}>
                    <Bell className="w-6 h-6 text-neutral-300 mb-1" />
                    <p className="font-bold text-[#1E293B]">No reminders at this time</p>
                    <p className="text-sm text-neutral-500">
                      Upcoming deadlines and review comments will appear here.
                    </p>
                  </div>
                ) : (
                  <>
                    {deniedNotices.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-white flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                          </div>
                          <h3 className="text-lg font-light text-[#D9291C] font-sans tracking-wide">
                            Denied
                          </h3>
                        </div>
                        <div className="border-l-2 border-red-300 ml-1.5 pl-4 space-y-4">
                          {deniedNotices.map((notice) => (
                            <button
                              key={notice.id}
                              type="button"
                              onClick={() => setSelectedNotice(notice)}
                              className="relative flex min-h-11 w-full items-start gap-3 rounded-xl p-1 text-left transition-colors hover:bg-red-50/60"
                            >
                              <div className="absolute -left-[27px] top-0.5 w-6 h-6 rounded-md bg-white border border-red-300 flex items-center justify-center text-red-600 shadow-2xs">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1 pl-1">
                                <span className="mb-0.5 block text-sm text-neutral-500">
                                  {notice.dateStr}
                                </span>
                                <h4 className="text-sm font-bold uppercase tracking-tight text-[#1E293B]">
                                  {notice.title}
                                </h4>
                                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-red-600">
                                  {notice.comment}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {returnedNotices.length > 0 && (
                      <div className={deniedNotices.length > 0 ? "pt-4" : undefined}>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-3 h-3 rounded-full border-2 border-amber-500 bg-white flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                          </div>
                          <h3 className="text-lg font-light text-amber-800 font-sans tracking-wide">
                            Returned
                          </h3>
                        </div>
                        <div className="border-l-2 border-amber-300 ml-1.5 pl-4 space-y-4">
                          {returnedNotices.map((notice) => (
                            <button
                              key={notice.id}
                              type="button"
                              onClick={() => setSelectedNotice(notice)}
                              className="relative flex min-h-11 w-full items-start gap-3 rounded-xl p-1 text-left transition-colors hover:bg-amber-50/60"
                            >
                              <div className="absolute -left-[27px] top-0.5 w-6 h-6 rounded-md bg-white border border-amber-300 flex items-center justify-center text-amber-700 shadow-2xs">
                                <RotateCcw className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1 pl-1">
                                <span className="mb-0.5 block text-sm text-neutral-500">
                                  {notice.dateStr}
                                </span>
                                <h4 className="text-sm font-bold uppercase tracking-tight text-[#1E293B]">
                                  {notice.title}
                                </h4>
                                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-amber-800">
                                  {notice.comment}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {importantReminders.length > 0 && (
                      <div className={reviewNotices.length > 0 ? "pt-4" : undefined}>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-white flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                          </div>
                          <h3 className="text-lg font-light text-[#D9291C] font-sans tracking-wide">
                            Important
                          </h3>
                        </div>
                        <div className="border-l-2 border-red-300 ml-1.5 pl-4 space-y-6">
                          {importantReminders.map((item) => (
                            <div
                              key={item.id}
                              className="relative flex items-start justify-between gap-3 group"
                            >
                              <div className="absolute -left-[27px] top-0.5 w-6 h-6 rounded-md bg-white border border-red-300 flex items-center justify-center text-red-600 shadow-2xs">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1 pl-1">
                                <span className="text-[11px] text-[#64748B] italic block mb-0.5 font-sans">
                                  {item.dateStr}
                                </span>
                                <h4 className="text-xs font-bold text-[#1E293B] leading-tight tracking-tight uppercase">
                                  {item.title}{" "}
                                  <span className="text-neutral-500 font-semibold font-mono">
                                    ({item.code})
                                  </span>
                                </h4>
                                <p className="text-xs text-red-600 font-semibold mt-1 leading-snug">
                                  {item.statusText}
                                </p>
                                <p className="text-[11px] text-[#64748B] mt-0.5 font-medium">
                                  Due Date: {item.dueDateText}
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  setDismissedReminderIds((prev) => [...prev, item.id])
                                }
                                className="mt-1 min-h-11 shrink-0 cursor-pointer rounded bg-neutral-200/80 px-3 py-1 text-[11px] font-bold text-[#475569] transition-all hover:bg-neutral-300"
                              >
                                Dismiss
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {upcomingReminders.length > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-3 h-3 rounded-full border-2 border-neutral-400 bg-white flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-neutral-400"></div>
                          </div>
                          <h3 className="text-lg font-light text-[#475569] font-sans tracking-wide">
                            Upcoming
                          </h3>
                        </div>
                        <div className="border-l-2 border-neutral-200 ml-1.5 pl-4 space-y-6">
                          {upcomingReminders.map((item) => (
                            <div
                              key={item.id}
                              className="relative flex items-start justify-between gap-3 group"
                            >
                              <div className="absolute -left-[27px] top-0.5 w-6 h-6 rounded-md bg-white border border-neutral-300 flex items-center justify-center text-[#64748B] shadow-2xs">
                                <CheckSquare className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1 pl-1">
                                <span className="text-[11px] text-[#64748B] italic block mb-0.5 font-sans">
                                  {item.dateStr}
                                </span>
                                <h4 className="text-xs font-bold text-[#1E293B] leading-tight tracking-tight uppercase">
                                  {item.title}{" "}
                                  <span className="text-neutral-500 font-semibold font-mono">
                                    ({item.code})
                                  </span>
                                </h4>
                                <p className="text-xs text-[#334155] font-semibold mt-1 leading-snug">
                                  {item.statusText}
                                </p>
                                <p className="text-[11px] text-[#64748B] mt-0.5 font-medium">
                                  Due Date: {item.dueDateText}
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  setDismissedReminderIds((prev) => [...prev, item.id])
                                }
                                className="mt-1 min-h-11 shrink-0 cursor-pointer rounded bg-neutral-200/80 px-3 py-1 text-[11px] font-bold text-[#475569] transition-all hover:bg-neutral-300"
                              >
                                Dismiss
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <SubmissionTrackerModal
        isOpen={isTrackerOpen}
        onClose={() => {
          setIsTrackerOpen(false)
          setSelectedKeys(null)
        }}
        eventId={selectedKeys?.eventId}
        submissionId={selectedKeys?.submissionId}
      />
      <ReviewNoticeModal
        notice={selectedNotice}
        onClose={() => setSelectedNotice(null)}
      />
    </div>
  )
}
