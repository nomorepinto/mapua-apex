import { useLocalReport } from "@/hooks/use-reporting"
import { REPORTS, reportCell, type TimelineKind } from "@/lib/reporting"
import { timelineReport, type TimelineSource } from "@/lib/timeline-reporting"
import { ReportFilterControls } from "./report-filters"
import { ReportDialog } from "./report-dialog"

interface RecordTimelineProps {
  kind: TimelineKind
  source: TimelineSource
  scope: string
  loadSource: (signal: AbortSignal) => Promise<TimelineSource>
}
export function RecordTimeline({
  kind,
  source,
  scope,
  loadSource,
}: RecordTimelineProps) {
  const report = useLocalReport(kind, kind, source.rows)
  return (
    <section className="space-y-3" aria-label={REPORTS[kind].title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{REPORTS[kind].title}</h3>
        <ReportDialog
          kind={kind}
          endpoint=""
          filters={report.filters}
          options={report.options}
          onApply={report.setFilters}
          loadReport={async (request, signal) => {
            const started = new Date().toISOString()
            const fresh = await loadSource(signal)
            signal.throwIfAborted()
            return timelineReport(kind, fresh, request, scope, started)
          }}
        />
      </div>
      <p className="text-xs text-neutral-500">
        Restricted to this opened record. Timeline filters do not alter workflow
        progress. Sensitive paths and remarks are optional export columns.
      </p>
      {source.limited && (
        <p role="note" className="text-xs text-amber-800">
          This stored timeline was capped. Reports require acknowledgment of
          limited historical coverage.
        </p>
      )}
      <ReportFilterControls
        kind={kind}
        filters={report.filters}
        options={report.options}
        onChange={report.setFilters}
        onReset={report.reset}
        count={report.rows.length}
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
