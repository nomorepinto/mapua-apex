import {
  REPORTS,
  dateRangeError,
  filterRecords,
  manilaToday,
  type ReportCell,
  type ReportFilters,
  type ReportPayload,
  type TimelineKind,
} from "./reporting"
import type { ApiNotification } from "./dynamodb-adapters"
import type { Session } from "../types/logs"

export interface TimelineEntry extends Record<string, ReportCell> {
  id: string
  date: string
}
export interface TimelineSource {
  rows: TimelineEntry[]
  limited: boolean
}
export interface TimelineReportRequest {
  filters: ReportFilters
  sections: string[]
  columns: string[]
  compare_previous_period: boolean
}
export function sessionTimeline(session: Session): TimelineSource {
  return {
    limited: Boolean(session.pagesVisitedTruncated),
    rows: session.pagesVisited.map((page, index) => ({
      id: `${session.sessionId}:${index}`,
      date: page.timestamp,
      title: page.pageName,
      path: page.path.split(/[?#]/)[0],
    })),
  }
}
export function proposalTimeline(
  rows: ApiNotification[],
  submissionId: string
): TimelineSource {
  if (rows.some((row) => row.submission_id !== submissionId))
    throw new Error("Timeline contains an unrelated proposal.")
  return {
    limited: false,
    rows: rows.map((row, index) => ({
      id: `${submissionId}:${row.sent_at}:${index}`,
      date: row.sent_at,
      type: row.notif_type,
      actor: row.signatory,
      remarks: row.comment ?? "",
    })),
  }
}
export function freezeReport(report: ReportPayload): ReportPayload {
  const clone = structuredClone(report)
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  freeze(clone)
  return clone
}
/** Builds only from a freshly authorized single-record endpoint, never a global collection. */
export function timelineReport(
  kind: TimelineKind,
  source: TimelineSource,
  request: TimelineReportRequest,
  scope: string,
  retrievedFrom: string
): ReportPayload {
  const invalid = dateRangeError(request.filters, true)
  if (invalid) throw new Error(invalid)
  const definition = REPORTS[kind]
  if (
    !request.columns.length ||
    request.columns.some((key) => !Object.hasOwn(definition.columns, key))
  )
    throw new Error("Unsupported timeline columns.")
  const filters = {
    ...request.filters,
    date_basis: Object.keys(definition.dates)[0],
  }
  const candidates = filterRecords(kind, source.rows, {
    ...filters,
    start_date: undefined,
    end_date: undefined,
  })
  const unknown = candidates.filter(
    (row) => !Number.isFinite(Date.parse(row.date))
  ).length
  const matches = filterRecords(kind, source.rows, filters)
  if (request.sections.includes("details") && matches.length > 10_000)
    throw new Error("REPORT_TOO_LARGE: Narrow the dates or omit detail rows.")
  const groups = new Map<string, number>()
  const group = kind === "session_timeline" ? "day" : "type"
  for (const row of matches) {
    const key =
      group === "day"
        ? manilaToday(new Date(row.date))
        : String(row.type || "Unknown")
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  const warnings = [
    "Only the opened record’s recorded timeline is included. Missing or deleted history cannot be reconstructed. Reads are not a historical transaction snapshot.",
  ]
  if (source.limited)
    warnings.push(
      "The stored page timeline was capped; earlier or additional page visits may be missing."
    )
  if (unknown)
    warnings.push(
      `${unknown} non-date-filtered entries have unknown dates and cannot be placed in the selected period.`
    )
  let comparison: ReportPayload["comparison"] = null
  if (request.compare_previous_period) {
    const end = Date.parse(filters.start_date!) - 86_400_000
    const start =
      end - (Date.parse(filters.end_date!) - Date.parse(filters.start_date!))
    const previous = {
      ...filters,
      start_date: new Date(start).toISOString().slice(0, 10),
      end_date: new Date(end).toISOString().slice(0, 10),
    }
    const previousCount = filterRecords(kind, source.rows, previous).length
    comparison = {
      start_date: previous.start_date,
      end_date: previous.end_date,
      current_count: matches.length,
      previous_count: previousCount,
      difference: matches.length - previousCount,
      percent_change: previousCount
        ? ((matches.length - previousCount) / previousCount) * 100
        : null,
    }
  }
  const report: ReportPayload = {
    report_type: kind,
    filters,
    scope,
    retrieved_from: retrievedFrom,
    retrieved_to: new Date().toISOString(),
    total_count: matches.length,
    summary: request.sections.includes("summary")
      ? { recorded_timeline_entries: matches.length }
      : {},
    breakdowns: request.sections.includes("breakdowns")
      ? {
          [group]: [...groups]
            .map(([key, count]) => ({ key, label: key, count }))
            .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
        }
      : {},
    comparison,
    columns: request.columns.map((key) => ({
      key,
      label: definition.columns[key],
    })),
    rows: request.sections.includes("details")
      ? matches.map((row) =>
          Object.fromEntries(
            request.columns.map((key) => [key, row[key] ?? null])
          )
        )
      : [],
    coverage: {
      retrieval_complete: true,
      historical_coverage_complete: !source.limited && unknown === 0,
      unknown_date_candidates: unknown,
      retention_days: null,
    },
    warnings,
  }
  if (
    new TextEncoder().encode(JSON.stringify(report)).byteLength >
    4 * 1024 * 1024
  )
    throw new Error("REPORT_TOO_LARGE: Narrow the dates or omit detail rows.")
  return report
}
