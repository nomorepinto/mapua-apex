import { exportToCsv, type CsvCell } from "./export-csv"
import {
  REPORTS,
  manilaToday,
  metricLabel,
  reportCell,
  type ReportPayload,
} from "./reporting"

export function reportFilename(
  report: ReportPayload,
  extension: string
): string {
  return `apex_${report.report_type}_${report.filters.start_date}_${report.filters.end_date}_${manilaToday(new Date(report.retrieved_to))}.${extension}`
}
export function assertExportable(
  report: ReportPayload,
  acknowledged: boolean
): void {
  if (!report.coverage.retrieval_complete)
    throw new Error("Incomplete retrieval cannot be exported.")
  if (!report.coverage.historical_coverage_complete && !acknowledged)
    throw new Error(
      "Acknowledge the historical coverage limits before downloading."
    )
}
export function reportCsvData(
  report: ReportPayload,
  section: "summary" | "details"
): { headers: string[]; rows: CsvCell[][] } {
  const headers = [
    "Report type",
    "Period start (Manila)",
    "Period end (Manila)",
    "Date basis",
    "Scope",
    "Retrieved from",
    "Retrieved to",
    "Applied filters",
    "Historical coverage complete",
    "Coverage notes",
  ]
  const meta: CsvCell[] = [
    REPORTS[report.report_type].title,
    report.filters.start_date,
    report.filters.end_date,
    report.filters.date_basis,
    report.scope,
    report.retrieved_from,
    report.retrieved_to,
    JSON.stringify(report.filters),
    report.coverage.historical_coverage_complete,
    report.warnings.join(" | "),
  ]
  if (section === "details") {
    const rows: CsvCell[][] = report.rows.map((row) => [
      ...meta,
      "Matching record",
      ...report.columns.map(({ key }) =>
        typeof row[key] === "string" && /^\d{4}-\d\d-\d\dT/.test(row[key])
          ? reportCell(row[key])
          : row[key]
      ),
    ])
    if (!rows.length)
      rows.push([
        ...meta,
        report.total_count === 0
          ? "No matching records"
          : "Detail rows not requested",
        ...report.columns.map(() => ""),
      ])
    return {
      headers: [
        ...headers,
        "Result",
        ...report.columns.map((column) => column.label),
      ],
      rows,
    }
  }
  const rows: CsvCell[][] = Object.entries(report.summary).map(
    ([key, value]) => [
      ...meta,
      "Summary",
      metricLabel(key, report.report_type),
      value,
    ]
  )
  for (const [group, entries] of Object.entries(report.breakdowns))
    for (const entry of entries)
      rows.push([...meta, group, entry.label, entry.count])
  if (report.comparison)
    for (const [key, value] of Object.entries(report.comparison))
      rows.push([...meta, "Previous-period comparison", key, value])
  if (!rows.length)
    rows.push([...meta, "Summary", "Matching records", report.total_count])
  return {
    headers: [...headers, "Section", "Metric / category", "Value"],
    rows,
  }
}
export function exportReportCsv(
  report: ReportPayload,
  section: "summary" | "details",
  acknowledged: boolean
): void {
  assertExportable(report, acknowledged)
  const { headers, rows } = reportCsvData(report, section)
  exportToCsv(reportFilename(report, `${section}.csv`), headers, rows)
}
