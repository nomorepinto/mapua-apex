import { metricLabel, reportCell, type ReportPayload } from "@/lib/reporting"

export function ReportPreview({
  report,
  compact = false,
}: {
  report: ReportPayload
  compact?: boolean
}) {
  const summary = Object.entries(report.summary)
  const maxima = Object.fromEntries(
    Object.entries(report.breakdowns).map(([group, rows]) => [
      group,
      rows.reduce((max, row) => Math.max(max, row.count), 1),
    ])
  )
  return (
    <section aria-label="Report preview" className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <p className="font-semibold">
          {report.total_count.toLocaleString()} matching records
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Retrieved {reportCell(report.retrieved_to)} (Manila). {report.scope}.
        </p>
        {report.total_count === 0 && (
          <p className="mt-2 text-sm">
            No records match these dates and filters.
          </p>
        )}
      </div>
      {report.warnings.length > 0 && (
        <div
          role="note"
          className={`space-y-1 rounded-lg border p-3 text-xs ${report.coverage.historical_coverage_complete ? "border-neutral-200 text-neutral-600" : "border-amber-300 bg-amber-50 text-amber-900"}`}
        >
          <p className="font-semibold">
            {report.coverage.historical_coverage_complete
              ? "Coverage and interpretation"
              : "Limited historical coverage"}
          </p>
          {report.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(compact ? summary.slice(0, 9) : summary).map(([key, value]) => (
          <div
            key={key}
            className="rounded-xl border border-neutral-200 bg-white p-4"
          >
            <dt className="text-xs text-neutral-600">
              {metricLabel(key, report.report_type)}
            </dt>
            <dd className="mt-2 text-lg font-semibold break-words text-neutral-900">
              {reportCell(value)}
            </dd>
          </div>
        ))}
      </dl>
      {report.comparison && (
        <p className="text-sm">
          Previous period ({report.comparison.start_date} to{" "}
          {report.comparison.end_date}):{" "}
          {report.comparison.previous_count.toLocaleString()} records.
          Difference: {report.comparison.difference}; percentage change:{" "}
          {reportCell(report.comparison.percent_change)}
          {report.comparison.percent_change === null ? "" : "%"}. Identical
          non-date filters applied.
        </p>
      )}
      {!compact && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(report.breakdowns).map(([group, rows]) => (
            <div key={group} className="rounded-xl border p-4">
              <h4 className="mb-3 text-sm font-semibold capitalize">
                {group.replaceAll("_", " ")}
              </h4>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {rows.map((row) => (
                  <div key={row.key} className="text-xs">
                    <div className="flex justify-between gap-3">
                      <span>{row.label}</span>
                      <span>{reportCell(row.count)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-neutral-100">
                      <div
                        className="h-full rounded bg-[#8b0000]"
                        style={{
                          width: `${(100 * row.count) / maxima[group]}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
                {!rows.length && (
                  <p className="text-xs text-neutral-500">
                    N/A — insufficient data
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!compact && report.rows.length > 0 && (
        <div className="overflow-x-auto">
          <p className="mb-2 text-xs text-neutral-500">
            Detail preview: first {Math.min(report.rows.length, 50)} of{" "}
            {report.rows.length.toLocaleString()} rows. Downloads include every
            matching row.
          </p>
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                {report.columns.map(({ key, label }) => (
                  <th key={key} className="border-b p-2">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.slice(0, 50).map((row, index) => (
                <tr key={`${row.id}-${index}`}>
                  {report.columns.map(({ key }) => (
                    <td key={key} className="max-w-64 border-b p-2 break-words">
                      {reportCell(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
