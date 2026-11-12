export type CollectionReportKind =
  "sessions" | "activity" | "proposals" | "postevals" | "reservation_changes"
export type TimelineKind = "session_timeline" | "proposal_timeline"
export type ReportKind = CollectionReportKind | TimelineKind
export type ReportCell = string | number | boolean | null
export type ReportRecord = Record<string, unknown>
export interface ReportFilters {
  start_date?: string
  end_date?: string
  date_basis?: string
  search?: string
  values?: Record<string, string[]>
  sort?: "asc" | "desc"
}
export interface ReportPayload {
  report_type: ReportKind
  filters: ReportFilters
  retrieved_from: string
  retrieved_to: string
  scope: string
  total_count: number
  summary: Record<string, ReportCell>
  breakdowns: Record<string, { key: string; label: string; count: number }[]>
  comparison: {
    start_date: string
    end_date: string
    current_count: number
    previous_count: number
    difference: number
    percent_change: number | null
  } | null
  columns: { key: string; label: string }[]
  rows: Record<string, ReportCell>[]
  coverage: {
    retrieval_complete: boolean
    historical_coverage_complete: boolean
    unknown_date_candidates: number
    retention_days: number | null
  }
  warnings: string[]
}
export interface ReportDefinition {
  title: string
  dates: Record<string, string>
  facets: Record<string, string>
  columns: Record<string, string>
  defaults: string[]
}
const identity = {
  id: "Record ID",
  date: "Date (Manila)",
  organization: "Organization",
}
export const REPORTS: Record<ReportKind, ReportDefinition> = {
  session_timeline: {
    title: "Session timeline appendix",
    dates: { visit_date: "Recorded visit date" },
    facets: { path: "Page path" },
    columns: {
      id: "Entry ID",
      date: "Visit (Manila)",
      title: "Page",
      path: "Page path (sensitive)",
    },
    defaults: ["id", "date", "title"],
  },
  proposal_timeline: {
    title: "Proposal timeline appendix",
    dates: { notification_date: "Notification date" },
    facets: { type: "Notification type" },
    columns: {
      id: "Entry ID",
      date: "Notification (Manila)",
      type: "Type",
      actor: "Signatory",
      remarks: "Remarks (sensitive)",
    },
    defaults: ["id", "date", "type", "actor"],
  },
  sessions: {
    title: "Session log",
    dates: { login_date: "Login date" },
    facets: {
      actor_id: "User",
      role: "Recorded role",
      status: "Status",
      end_reason: "End reason",
      browser: "Browser",
      device: "Device",
    },
    columns: {
      id: "Session ID",
      date: "Login (Manila)",
      actor: "User",
      role: "Recorded role",
      status: "Status",
      end_reason: "End reason",
      logout_at: "Logout (Manila)",
      duration_minutes: "Duration (minutes)",
      browser: "Browser",
      device: "Device",
      email: "Email (sensitive)",
      ip_address: "IP address (sensitive)",
      page_visits: "Page timeline appendix (sensitive)",
    },
    defaults: [
      "id",
      "date",
      "actor",
      "role",
      "status",
      "end_reason",
      "duration_minutes",
    ],
  },
  activity: {
    title: "Activity log",
    dates: { action_date: "Action date" },
    facets: {
      action: "Action",
      module: "Module",
      organization_id: "Organization",
      actor_id: "Actor",
      role: "Recorded role",
    },
    columns: {
      ...identity,
      action: "Action",
      module: "Module",
      actor: "Actor",
      role: "Recorded role",
      entity_id: "Entity ID",
      title: "Title",
      email: "Email (sensitive)",
      remarks: "Remarks (sensitive)",
    },
    defaults: [
      "date",
      "id",
      "action",
      "module",
      "actor",
      "organization",
      "title",
    ],
  },
  proposals: {
    title: "Proposal statistics",
    dates: {
      first_submitted_at: "First submitted",
      latest_submitted_at: "Latest submitted",
      event_date: "Event-date overlap",
    },
    facets: {
      organization_id: "Organization",
      status: "Current status",
      type: "Activity type",
      department: "Proponent department",
      has_reservation: "Has reservation",
      collaboration_role: "Collaboration role",
      desk_history: "Desk history",
    },
    columns: {
      ...identity,
      title: "Event",
      status: "Current status",
      type: "Activity type",
      department: "Proponent department",
      first_submitted_at: "First submitted (Manila)",
      latest_submitted_at: "Latest submitted (Manila)",
      event_date: "Event date",
      has_reservation: "Has reservation",
      collaboration_role: "Collaboration role",
      proposed_budget: "Proposed budget (PHP)",
      planned_participants: "Planned participant places",
      duration_minutes: "Overall turnaround (wall-clock minutes)",
      overall_turnaround_working_minutes:
        "Overall turnaround (working minutes)",
      adviser_desk_working_minutes: "Adviser desk time (working minutes)",
      dean_desk_working_minutes: "Dean desk time (working minutes)",
      osaar_desk_working_minutes: "OSAAR desk time (working minutes)",
      cdm_desk_working_minutes: "CDM desk time (working minutes)",
      desk_history: "Desk history",
      privacy_consent_version: "Data privacy consent (version)",
      privacy_consent_at: "Data privacy consent accepted (Manila)",
    },
    defaults: ["id", "date", "title", "organization", "type", "status"],
  },
  postevals: {
    title: "Post-evaluation history",
    dates: { filed_date: "Filed date" },
    facets: { organization_id: "Organization", status: "Current status" },
    columns: {
      ...identity,
      title: "Event",
      status: "Current status",
      resolved_at: "Resolved (Manila)",
      duration_minutes: "Resolution time (minutes)",
    },
    defaults: ["id", "date", "title", "organization", "status"],
  },
  reservation_changes: {
    title: "Reservation-change history",
    dates: { requested_at: "Requested date", resolved_at: "Resolved date" },
    facets: {
      organization_id: "Organization",
      campus_id: "Campus",
      status: "Status",
      type: "Request type",
      decision: "Resolution",
    },
    columns: {
      ...identity,
      title: "Event",
      campus_id: "Campus ID",
      type: "Request type",
      status: "Status",
      decision: "Resolution",
      requested_at: "Requested (Manila)",
      resolved_at: "Resolved (Manila)",
      duration_minutes: "Resolution time (minutes)",
      remarks: "Remarks (sensitive)",
    },
    defaults: [
      "id",
      "date",
      "title",
      "organization",
      "type",
      "status",
      "decision",
    ],
  },
}
export function manilaToday(now = new Date()): string {
  return new Date(now.getTime() + 28_800_000).toISOString().slice(0, 10)
}
export function validCalendarDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  )
}
export function dateRangeError(
  filters: ReportFilters,
  required = false
): string | null {
  if (!required && !filters.start_date && !filters.end_date) return null
  if (
    !validCalendarDate(filters.start_date) ||
    !validCalendarDate(filters.end_date)
  )
    return "Select valid start and end dates."
  const days =
    (Date.parse(filters.end_date) - Date.parse(filters.start_date)) /
      86_400_000 +
    1
  if (days < 1) return "End date must be on or after start date."
  if (days > 366) return "Select at most 366 calendar days."
  return null
}
export const DATE_PRESETS = [
  "Today",
  "Yesterday",
  "Last 7 days",
  "Last 30 days",
  "This month",
  "Last month",
  "This year",
  "Custom",
] as const
export function presetRange(
  preset: string,
  now = new Date()
): Pick<ReportFilters, "start_date" | "end_date"> {
  const today = manilaToday(now)
  const time = Date.parse(`${today}T00:00:00Z`)
  const day = (offset: number) =>
    new Date(time + offset * 86_400_000).toISOString().slice(0, 10)
  if (preset === "Yesterday") return { start_date: day(-1), end_date: day(-1) }
  if (preset === "Last 7 days") return { start_date: day(-6), end_date: today }
  if (preset === "Last 30 days")
    return { start_date: day(-29), end_date: today }
  if (preset === "This month")
    return { start_date: today.slice(0, 7) + "-01", end_date: today }
  if (preset === "Last month") {
    const end = new Date(
      Date.parse(`${today.slice(0, 7)}-01T00:00:00Z`) - 86_400_000
    )
      .toISOString()
      .slice(0, 10)
    return { start_date: end.slice(0, 7) + "-01", end_date: end }
  }
  if (preset === "This year")
    return { start_date: today.slice(0, 4) + "-01-01", end_date: today }
  return { start_date: today, end_date: today }
}
export function publicFilterState(filters: ReportFilters): ReportFilters {
  return {
    start_date: filters.start_date,
    end_date: filters.end_date,
    date_basis: filters.date_basis,
    sort: filters.sort,
    values: Object.fromEntries(
      Object.entries(filters.values ?? {}).filter(
        ([key]) => key !== "actor_id" && key !== "path"
      )
    ),
  }
}
export function restoreFilters(
  kind: ReportKind,
  value: string | null,
  fallback: ReportFilters
): ReportFilters {
  try {
    if (!value) return fallback
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return fallback
    const obj = parsed as ReportFilters
    if (
      dateRangeError(obj) ||
      (obj.date_basis && !Object.hasOwn(REPORTS[kind].dates, obj.date_basis))
    )
      return fallback
    const values = Object.fromEntries(
      Object.entries(obj.values ?? {}).filter(
        ([key, list]) =>
          Object.hasOwn(REPORTS[kind].facets, key) &&
          key !== "actor_id" &&
          key !== "path" &&
          Array.isArray(list) &&
          list.length <= 100 &&
          list.every((v) => typeof v === "string" && v.length <= 200)
      )
    )
    return {
      ...publicFilterState(obj),
      sort: obj.sort === "asc" ? "asc" : "desc",
      values,
    }
  } catch {
    return fallback
  }
}
export function recordOf(value: unknown): ReportRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ReportRecord)
    : {}
}
const text = (value: unknown): string =>
  typeof value === "string" ? value : ""
/** Public collection projections only; mirrors the server's common filter fields. */
export function filterRow(
  kind: ReportKind,
  item: ReportRecord
): Record<string, string> {
  if (kind === "session_timeline" || kind === "proposal_timeline")
    return {
      id: text(item.id),
      date: text(item.date),
      type: text(item.type),
      path: text(item.path),
      title: text(item.title),
      actor: text(item.actor),
    }
  if (kind === "sessions") {
    const device = recordOf(item.device_info)
    return {
      id: text(item.session_id),
      date: text(item.login_time),
      actor_id: text(item.sub),
      actor: text(item.user_name),
      email: text(item.user_email),
      role: text(item.user_role) || "unknown",
      status: text(item.status) || "unknown",
      end_reason: text(item.end_reason),
      browser: text(device.browser),
      device: text(device.device_type),
    }
  }
  if (kind === "activity")
    return {
      id: text(item.activityId),
      date: text(item.timestamp),
      organization_id: text(item.organizationId),
      organization: text(item.organizationName),
      action: text(item.actionType),
      module: text(item.module),
      actor_id: text(item.userId),
      actor: text(item.userName),
      email: text(item.userEmail),
      role: text(item.userRole) || "unknown",
      entity_id: text(item.entityId),
      title: text(item.entityName),
    }
  if (kind === "proposals") {
    const details = recordOf(item.activity_details)
    const classification = recordOf(item.activity_classification)
    const first = recordOf(
      Array.isArray(item.proponents) ? item.proponents[0] : null
    )
    return {
      id: `${text(item.event_id)}:${text(item.submission_id)}`,
      date: text(item.first_submitted_at),
      organization_id: text(item.organization_id),
      organization:
        text(item.organization_name) ||
        text(item.organization_id) ||
        "Unknown organization",
      title: text(details.title_and_nature),
      status: text(item.status),
      type: text(classification.activity_type),
      department: text(first.department),
      first_submitted_at: text(item.first_submitted_at),
      latest_submitted_at: text(item.sent_at),
      event_date: text(details.date_of_event),
      event_end: text(details.end_date_of_event) || text(details.date_of_event),
      has_reservation: String(
        recordOf(item.venue_reservation).has_reservation === true
      ),
      collaboration_role: text(item.role) || "proponent",
      desk_history: Array.isArray(item.desk_timings)
        ? item.desk_timings.some(
              (entry) => recordOf(entry).source === "backfill"
            )
          ? "backfilled"
          : "recorded"
        : "missing",
    }
  }
  const date = text(
    kind === "postevals" ? item.submitted_at : item.requested_at
  )
  return {
    id:
      kind === "postevals"
        ? `${text(item.event_id)}:${text(item.posteval_id)}`
        : text(item.change_id),
    date,
    requested_at: date,
    resolved_at:
      text(item.resolved_at) || text(item.approved_at) || text(item.denied_at),
    organization_id: text(item.organization_id),
    organization:
      text(item.organization_name) ||
      text(item.organization_id) ||
      "Unknown organization",
    title: text(item.event_title),
    status: text(item.status),
    type: text(item.request_type),
    decision: text(item.decision),
    campus_id: text(item.campus_id),
  }
}
export function filterRecords<T extends object>(
  kind: ReportKind,
  records: T[],
  filters: ReportFilters
): T[] {
  const basis = filters.date_basis ?? Object.keys(REPORTS[kind].dates)[0]
  const dated = Boolean(filters.start_date && filters.end_date)
  const start = Date.parse(`${filters.start_date}T00:00:00+08:00`)
  const end = Date.parse(`${filters.end_date}T00:00:00+08:00`) + 86_400_000
  const query = filters.search?.trim().toLocaleLowerCase()
  const date = (row: Record<string, string>) => row[basis] ?? row.date
  const entries = records
    .map((item) => ({ item, row: filterRow(kind, item as ReportRecord) }))
    .filter(({ row }) => {
      if (
        query &&
        ![
          "id",
          "title",
          "organization",
          "actor",
          "actor_id",
          "email",
          "entity_id",
          "status",
          "action",
          "path",
          "type",
        ].some((key) => (row[key] ?? "").toLocaleLowerCase().includes(query))
      )
        return false
      if (
        !Object.entries(filters.values ?? {}).every(
          ([key, list]) => !list.length || list.includes(row[key] ?? "")
        )
      )
        return false
      if (!dated) return true
      if (kind === "proposals" && basis === "event_date")
        return (
          validCalendarDate(row.event_date) &&
          validCalendarDate(row.event_end) &&
          row.event_end >= row.event_date &&
          row.event_date <= filters.end_date! &&
          row.event_end >= filters.start_date!
        )
      const time = Date.parse(date(row))
      return time >= start && time < end
    })
  entries.sort((a, b) => {
    const order =
      (Date.parse(date(a.row)) || 0) - (Date.parse(date(b.row)) || 0) ||
      a.row.id.localeCompare(b.row.id)
    return filters.sort === "asc" ? order : -order
  })
  return entries.map(({ item }) => item)
}
export type FacetOptions = Record<string, { value: string; label: string }[]>
export function facetOptions(
  kind: ReportKind,
  records: object[]
): FacetOptions {
  const rows = records.map((item) => filterRow(kind, item as ReportRecord))
  return Object.fromEntries(
    Object.keys(REPORTS[kind].facets).map((key) => [
      key,
      [
        ...new Map(
          rows
            .filter((row) => row[key])
            .map((row) => [
              row[key],
              {
                value: row[key],
                label:
                  key === "organization_id"
                    ? row.organization || row[key]
                    : key === "actor_id"
                      ? row.actor || row[key]
                      : row[key],
              },
            ])
        ).values(),
      ].sort((a, b) => a.label.localeCompare(b.label)),
    ])
  )
}
export function reportCell(value: ReportCell | undefined): string {
  if (value === null || value === undefined || value === "") return "N/A"
  if (typeof value === "number")
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
  if (
    typeof value === "string" &&
    /^\d{4}-\d\d-\d\dT/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  return String(value)
}
export function metricLabel(key: string, kind: ReportKind): string {
  if (key === "median_duration_minutes")
    return kind === "proposals"
      ? "Median first submission to final approval (minutes)"
      : kind === "sessions"
        ? "Median completed session duration (minutes)"
        : "Median resolution time (minutes)"
  if (key === "most_reviewer")
    return "Most recorded review decisions (ties included)"
  if (key === "most_organization")
    return kind === "proposals"
      ? "Most proponent submissions (ties included)"
      : "Most records by organization (ties included)"
  if (key === "most_day") return "Busiest selected-date day (Manila)"
  if (key === "most_first_submission_day")
    return "Busiest first-submission day (Manila)"
  if (key === "median_cdm_desk_working_minutes")
    return "Median CDM desk time (working minutes)"
  if (key === "average_cdm_desk_working_minutes")
    return "Average CDM desk time (working minutes)"
  if (key === "cdm_desk_sample_count")
    return "Proposals with a recorded CDM desk time"
  if (key === "median_osaar_desk_working_minutes")
    return "Median OSAAR desk time (working minutes)"
  if (key === "median_adviser_desk_working_minutes")
    return "Median adviser desk time (working minutes)"
  if (key === "median_dean_desk_working_minutes")
    return "Median dean desk time (working minutes)"
  if (key === "median_overall_turnaround_working_minutes")
    return "Median overall turnaround (working minutes)"
  if (key === "proposals_missing_desk_history")
    return "Proposals without per-desk history"
  return key.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase())
}
