import {
  formatDisplayDateTime,
  formatDocumentId,
  getPostEvalStatusMeta,
  type ApiPostEval,
} from "@/lib/dynamodb-adapters"
import { formatPeso } from "@/lib/numeric-input"
import { cn } from "@/lib/utils"

function StatusPill({ status }: { status: string }) {
  const meta = getPostEvalStatusMeta(status)
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2.5 py-1 text-xs font-bold",
        meta.color
      )}
    >
      {meta.label}
    </span>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-medium text-neutral-700">{value}</p>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold text-neutral-900">{children}</h3>
  )
}

/**
 * Read-only rendering of a filed post-evaluation: the summary, the financial
 * report (approved budget vs. actual spend), and the frozen participation
 * snapshot. Shared by the student detail dialog and the OSAAR review modal so
 * both reviewers see exactly the same document.
 */
export function PostEvalDetailBody({ postEval }: { postEval: ApiPostEval }) {
  const report = postEval.financial_report
  const participation = postEval.participation ?? postEval.participation_snapshot
  const budgetItems = report?.budget_items ?? []
  const addedItems = report?.added_items ?? []

  return (
    <div className="space-y-6">
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <StatusPill status={postEval.status} />
        <MetaItem label="Document" value={formatDocumentId(postEval.posteval_id, "POST")} />
        <MetaItem label="Submitted" value={formatDisplayDateTime(postEval.submitted_at)} />
        {postEval.approved_at ? (
          <MetaItem label="Approved" value={formatDisplayDateTime(postEval.approved_at)} />
        ) : null}
        {postEval.denied_at ? (
          <MetaItem label="Denied" value={formatDisplayDateTime(postEval.denied_at)} />
        ) : null}
      </div>

      {/* Section 1 — summary */}
      <section className="space-y-2">
        <SectionHeading>Event Summary</SectionHeading>
        <p className="whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-3 text-sm leading-relaxed text-neutral-700">
          {postEval.section_summary || "—"}
        </p>
      </section>

      {/* Section 2 — financial report */}
      <section className="space-y-3">
        <SectionHeading>Financial Report</SectionHeading>
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-right">Budgeted (₱)</th>
                <th className="px-3 py-2 text-right">Actual (₱)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {budgetItems.length === 0 && addedItems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-xs text-neutral-500">
                    No financial lines recorded.
                  </td>
                </tr>
              ) : (
                <>
                  {budgetItems.map((item, index) => (
                    <tr key={`b-${index}`}>
                      <td className="px-3 py-2 text-neutral-800">
                        {item.item}
                        {item.unit ? (
                          <span className="ml-1 text-xs text-neutral-400">
                            ({item.quantity || 0} {item.unit})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                        {formatPeso(Number(item.budgeted_total) || 0)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-neutral-900">
                        {formatPeso(Number(item.actual_amount) || 0)}
                      </td>
                    </tr>
                  ))}
                  {addedItems.map((item, index) => (
                    <tr key={`a-${index}`} className="bg-amber-50/40">
                      <td className="px-3 py-2 text-neutral-800">
                        {item.item}
                        <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                          Added
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-400">
                        —
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-neutral-900">
                        {formatPeso(Number(item.actual_amount) || 0)}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50 text-sm font-bold text-neutral-900">
                <td className="px-3 py-2.5">Grand Total</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  ₱{formatPeso(Number(report?.initial_grand_total) || 0)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#8B0000]">
                  ₱{formatPeso(Number(report?.actual_grand_total) || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Section 3 — participation snapshot */}
      <section className="space-y-3">
        <SectionHeading>Attendance &amp; Evaluation</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-3">
            <p className="text-2xl font-bold leading-none text-neutral-900">
              {participation?.attendance_count ?? 0}
            </p>
            <p className="mt-1 text-xs font-medium text-neutral-500">
              Attendees scanned
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-3">
            <p className="text-2xl font-bold leading-none text-neutral-900">
              {participation?.evaluation_count ?? 0}
            </p>
            <p className="mt-1 text-xs font-medium text-neutral-500">
              Evaluations filed
            </p>
          </div>
        </div>

        {participation?.attendance?.length ? (
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                  <th className="px-3 py-2">Attendee</th>
                  <th className="px-3 py-2">Scanned In</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {participation.attendance.map((row) => (
                  <tr key={row.student_id}>
                    <td className="px-3 py-2 text-neutral-800">
                      {row.full_name || row.student_id}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">
                      {formatDisplayDateTime(row.scanned_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {participation?.evaluations?.length ? (
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                  <th className="px-3 py-2">Evaluator</th>
                  <th className="px-3 py-2">Participated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {participation.evaluations.map((row) => (
                  <tr key={row.evaluation_id}>
                    <td className="px-3 py-2 text-neutral-800">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
