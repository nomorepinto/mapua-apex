import { useLocalReport } from "@/hooks/use-reporting"
import { REPORTS, reportCell, type TimelineKind } from "@/lib/reporting"
import type { TimelineSource } from "@/lib/timeline-reporting"
import { ReportFilterControls } from "./report-filters"

interface RecordTimelineProps {
  kind: TimelineKind
  source: TimelineSource
}
/**
 * Read-only, record-scoped timeline for an opened session or proposal. Export and
 * date-range selection were removed; this only filters the entries already loaded
 * for the record and never alters workflow progress.
 */
export function RecordTimeline({ kind, source }: RecordTimelineProps) {
  const report = useLocalReport(kind, kind, source.rows)
  return (
    <section className="space-y-3" aria-label={REPORTS[kind].title}>
      <h3 className="text-sm font-semibold">{REPORTS[kind].title}</h3>
      <p className="text-xs text-neutral-500">
        Restricted to this opened record. Timeline filters do not alter workflow
        progress.
      </p>
      {source.limited && (
        <p role="note" className="text-xs text-amber-800">
          This stored timeline was capped; earlier entries may be missing.
        </p>
      )}
      <ReportFilterControls
        kind={kind}
        filters={report.filters}
        options={report.options}
        onChange={report.setFilters}
        onReset={report.reset}
        count={report.rows.length}
        hideDates
      />
      <ol className="max-h-80 space-y-3 overflow-y-auto border-l-2 border-neutral-200 pl-4">
        {report.rows.map((row) => (
          <li key={row.id} className="space-y-1 text-xs">
            <p className="font-semibold text-neutral-800">
              {reportCell(row.title ?? row.type)}
            </p>
            <p className="text-neutral-500">
              {reportCell(row.date)} (Manila)
              {row.actor ? ` · ${row.actor}` : ""}
            </p>
            {row.path && (
              <p className="font-mono break-all text-neutral-500">{row.path}</p>
            )}
            {row.remarks && (
              <p className="break-words whitespace-pre-wrap text-neutral-600">
                {row.remarks}
              </p>
            )}
          </li>
        ))}
      </ol>
      {!report.rows.length && (
        <p className="text-sm text-neutral-500">
          No timeline entries match these filters.
        </p>
      )}
    </section>
  )
}
