import { CalendarCheckIcon, ClipboardListIcon } from "lucide-react"

import { useEventParticipantsQuery } from "@/hooks/use-postevals"
import { formatDisplayDateTime } from "@/lib/dynamodb-adapters"
import { layout } from "@/config"
import { LoadingBlock } from "@/components/ui/loading-block"
import { cn } from "@/lib/utils"

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 py-3 shadow-xs">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#8B0000]/10 text-[#8B0000]">
        {icon}
      </span>
      <div>
        <p className="text-2xl font-bold leading-none !text-neutral-900">
          {value}
        </p>
        <p className="mt-1 text-xs font-medium text-neutral-500">{label}</p>
      </div>
    </div>
  )
}

/**
 * Section 3 — a read-only preview of what the arcus microservices captured for
 * the selected event: attendance check-ins (arcus-attendance) and participant
 * evaluations (arcus-evaluation). The backend freezes this snapshot into the
 * post-eval on submit; nothing here is editable.
 */
export function AttendanceEvaluationSection({ eventId }: { eventId: string }) {
  const { data, isPending, isError } = useEventParticipantsQuery(eventId)

  const attendance = data?.attendance ?? []
  const evaluations = data?.evaluations ?? []
  const attendanceCount = data?.attendance_count ?? 0
  const evaluationCount = data?.evaluation_count ?? 0
  const hasNothing = attendanceCount === 0 && evaluationCount === 0

  return (
    <div className="space-y-4 pt-4">
      <div>
        <h2 className="text-lg font-bold text-neutral-900">
          Attendance &amp; Evaluation
        </h2>
        <p className="mt-0.5 text-sm font-medium text-neutral-600">
          Recorded live by the attendance scanner and evaluation system during
          the event. This snapshot is saved with your post-evaluation.
        </p>
      </div>

      {isPending ? (
        <LoadingBlock
          className="grid grid-cols-1 gap-3 space-y-0 sm:grid-cols-2"
          label="Loading participation data"
          rows={2}
          rowClassName="h-16 w-full rounded-xl"
        />
      ) : isError ? (
        <div className={layout.empty}>
          <p className="text-sm text-neutral-500">
            Unable to load participation data right now.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              icon={<CalendarCheckIcon className="size-5" />}
              label="Attendees scanned"
              value={attendanceCount}
            />
            <StatCard
              icon={<ClipboardListIcon className="size-5" />}
              label="Evaluations filed"
              value={evaluationCount}
            />
          </div>

          {hasNothing ? (
            <div className={layout.empty}>
              <ClipboardListIcon className="mb-2 size-8 text-neutral-300" />
              <p className="text-sm font-medium text-neutral-600">
                No attendance or evaluation data yet
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                The microservices have not recorded anything for this event.
              </p>
            </div>
          ) : (
            <>
              {/* Attendance roster */}
              <div className={layout.sectionFlush}>
                <div className="border-b border-neutral-200 px-4 py-3">
                  <h3 className="text-sm font-bold text-neutral-900">
                    Attendance ({attendanceCount})
                  </h3>
                </div>
                <div
                  className={cn(
                    layout.tableWrap,
                    "overflow-x-auto -mx-0 px-0"
                  )}
                >
                  <table
                    className={cn(
                      "min-w-[560px] w-full border-collapse text-left text-sm",
                      layout.table
                    )}
                  >
                    <thead>
                      <tr className="border-b border-neutral-300 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wider text-neutral-700">
                        <th className="px-4 py-2.5">Name</th>
                        <th className="px-3 py-2.5">Department</th>
                        <th className="px-3 py-2.5">Organization</th>
                        <th className="px-3 py-2.5">Scanned In</th>
                        <th className="px-3 py-2.5">Left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {attendance.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-5 text-center text-sm text-neutral-500"
                          >
                            No attendees scanned.
                          </td>
                        </tr>
                      ) : (
                        attendance.map((row) => (
                          <tr key={row.student_id} className="hover:bg-neutral-50/60">
                            <td className="px-4 py-2 font-medium !text-neutral-900">
                              {row.full_name || row.student_id}
                            </td>
                            <td className="px-3 py-2 text-neutral-600">
                              {row.department || "—"}
                            </td>
                            <td className="px-3 py-2 text-neutral-600">
                              {row.member_organization || "—"}
                            </td>
                            <td className="px-3 py-2 text-neutral-600">
                              {formatDisplayDateTime(row.scanned_at)}
                            </td>
                            <td className="px-3 py-2 text-neutral-600">
                              {formatDisplayDateTime(row.left_at)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Evaluation responses */}
              <div className={layout.sectionFlush}>
                <div className="border-b border-neutral-200 px-4 py-3">
                  <h3 className="text-sm font-bold text-neutral-900">
                    Evaluations ({evaluationCount})
                  </h3>
                </div>
                <div className={layout.tableWrap}>
                  <table
                    className={cn(
                      "min-w-[440px] w-full border-collapse text-left text-sm",
                      layout.table
                    )}
                  >
                    <thead>
                      <tr className="border-b border-neutral-300 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wider text-neutral-700">
                        <th className="px-4 py-2.5">Name</th>
                        <th className="px-3 py-2.5">Participated</th>
                        <th className="px-3 py-2.5">Filed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {evaluations.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-5 text-center text-sm text-neutral-500"
                          >
                            No evaluations filed.
                          </td>
                        </tr>
                      ) : (
                        evaluations.map((row) => (
                          <tr
                            key={row.evaluation_id}
                            className="hover:bg-neutral-50/60"
                          >
                            <td className="px-4 py-2 font-medium !text-neutral-900">
                              {row.full_name || row.student_id}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={cn(
                                  "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                                  row.participated
                                    ? "border-emerald-200 bg-emerald-500/10 text-emerald-600"
                                    : "border-neutral-200 bg-neutral-500/10 text-neutral-600"
                                )}
                              >
                                {row.participated ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-neutral-600">
                              {formatDisplayDateTime(row.filed_at)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
