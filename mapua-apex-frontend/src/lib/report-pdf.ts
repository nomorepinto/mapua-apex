import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import {
  REPORTS,
  metricLabel,
  reportCell,
  type ReportPayload,
} from "./reporting"
import { assertExportable, reportFilename } from "./report-export"

/** Helvetica supports the Latin-1 accented names used in the report fixtures. */
export function validatePdfText(text: string): void {
  if (
    /[^\t\n\r\u0020-\u00ff\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026\u20ac]/u.test(
      text
    )
  )
    throw new Error(
      "This report contains characters outside the available PDF font. Download UTF-8 CSV to preserve the original text."
    )
}
export function createReportPdf(
  report: ReportPayload,
  acknowledged: boolean
): jsPDF {
  assertExportable(report, acknowledged)
  const title = REPORTS[report.report_type].title
  const doc = new jsPDF({ format: "a4", orientation: "portrait" })
  const readable = (value: Parameters<typeof reportCell>[0]): string => {
    const text = reportCell(value)
    validatePdfText(text)
    return text
  }
  let y = 18
  const heading = (text: string): void => {
    if (y > doc.internal.pageSize.getHeight() - 35) {
      doc.addPage()
      y = 18
    }
    doc.setFontSize(12)
    doc.setTextColor(139, 0, 0)
    doc.text(readable(text), 14, y)
    y += 7
  }
  const table = (head: string[], body: string[][]): void => {
    autoTable(doc, {
      startY: y,
      head: [head.map(readable)],
      body: body.map((row) => row.map(readable)),
      margin: { top: 16, bottom: 18, left: 14, right: 14 },
      styles: {
        font: "helvetica",
        fontSize: 8,
        overflow: "linebreak",
        cellPadding: 2,
      },
      headStyles: { fillColor: [139, 0, 0] },
      showHead: "everyPage",
      rowPageBreak: "avoid",
      didDrawPage: ({ cursor }) => {
        y = (cursor?.y ?? y) + 10
      },
    })
  }
  doc.setProperties({
    title: `APEX - ${title}`,
    author: "APEX / Mapúa University",
    subject: `${report.filters.start_date} - ${report.filters.end_date}`,
  })
  heading("APEX / Mapúa University")
  heading(title)
  table(
    ["Report context", "Value"],
    [
      [
        "Period (Manila)",
        `${report.filters.start_date} to ${report.filters.end_date}`,
      ],
      [
        "Date basis",
        REPORTS[report.report_type].dates[report.filters.date_basis ?? ""] ??
          report.filters.date_basis ??
          "N/A",
      ],
      ["Scope", report.scope],
      ["Retrieval started (Manila)", readable(report.retrieved_from)],
      ["Retrieval completed (Manila)", readable(report.retrieved_to)],
      ["Applied filters", JSON.stringify(report.filters)],
      ["Matching records", String(report.total_count)],
      ["Retrieval", "Complete"],
      [
        "Historical coverage",
        report.coverage.historical_coverage_complete
          ? "No known coverage gaps"
          : "Limited coverage - acknowledged",
      ],
    ]
  )
  heading("Coverage notes")
  table(
    ["Notes"],
    report.warnings.map((note) => [note])
  )
  if (report.total_count === 0) {
    heading("No matching records")
    table(["Result"], [["No records matched the selected dates and filters."]])
  }
  if (Object.keys(report.summary).length) {
    heading("Summary")
    table(
      ["Measure", "Value"],
      Object.entries(report.summary).map(([key, value]) => [
        metricLabel(key, report.report_type),
        readable(value),
      ])
    )
  }
  if (report.comparison) {
    heading("Previous equal-length period")
    table(
      ["Measure", "Value"],
      Object.entries(report.comparison).map(([key, value]) => [
        key.replaceAll("_", " "),
        readable(value),
      ])
    )
  }
  for (const [group, rows] of Object.entries(report.breakdowns)) {
    if (!rows.length) continue
    heading(group.replaceAll("_", " "))
    if (rows.length <= 10 && rows.every((row) => row.count >= 0)) {
      const maximum = Math.max(1, ...rows.map((row) => row.count))
      for (const row of rows) {
        if (y > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage()
          y = 18
        }
        doc.setFontSize(8)
        doc.setTextColor(45, 45, 45)
        const label = readable(row.label)
        doc.text(label.length > 38 ? label.slice(0, 35) + "..." : label, 14, y)
        doc.setFillColor(139, 0, 0)
        doc.rect(82, y - 3, (85 * row.count) / maximum, 3, "F")
        doc.text(readable(row.count), 172, y)
        y += 6
      }
      y += 3
    }
    table(
      [
        "Category (ties retained)",
        group.includes("percent") ? "Percent" : "Count",
      ],
      rows.map((row) => [row.label, readable(row.count)])
    )
  }
  if (report.rows.length) {
    doc.addPage("a4", report.columns.length > 6 ? "landscape" : "portrait")
    y = 18
    heading("Detail appendix")
    table(
      report.columns.map((column) => column.label),
      report.rows.map((row) =>
        report.columns.map(({ key }) => readable(row[key]))
      )
    )
  }
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(
      `APEX | ${report.filters.start_date} to ${report.filters.end_date} | Page ${page} of ${pages}`,
      14,
      doc.internal.pageSize.getHeight() - 9
    )
  }
  return doc
}
export function exportReportPdf(
  report: ReportPayload,
  acknowledged: boolean
): void {
  createReportPdf(report, acknowledged).save(reportFilename(report, "pdf"))
}
