import { UnprocessableEntityException } from '@nestjs/common';
import { record, str, type Item } from './records.js';
import {
  reportRequestOptions,
  reportTooLarge,
  withReportBudget,
} from './report-budget.js';
import { describeWorkingHours, workingMinutes } from './turnaround.js';
import { readEntries } from '../submissions/desk-timing.js';

export type ReportKind =
  'sessions' | 'activity' | 'proposals' | 'postevals' | 'reservation_changes';
export type Cell = string | number | boolean | null;
export type ReportRow = Record<string, Cell> & { id: string; date: string };
export interface ReportFilters {
  start_date?: string;
  end_date?: string;
  date_basis?: string;
  search?: string;
  values?: Record<string, string[]>;
  sort?: 'asc' | 'desc';
}
export interface ReportRequest {
  filters: ReportFilters;
  sections: string[];
  columns: string[];
  compare_previous_period: boolean;
}
export interface ReportDefinition {
  dates: string[];
  facets: Record<string, string>;
  columns: Record<string, string>;
  defaults: string[];
}
const identity = {
  id: 'Record ID',
  date: 'Date (Manila)',
  organization: 'Organization',
};
export const REPORT_DEFINITIONS: Record<ReportKind, ReportDefinition> = {
  sessions: {
    dates: ['login_date'],
    facets: {
      actor_id: 'User',
      role: 'Recorded role',
      status: 'Status',
      end_reason: 'End reason',
      browser: 'Browser',
      device: 'Device',
    },
    columns: {
      id: 'Session ID',
      date: 'Login (Manila)',
      actor: 'User',
      role: 'Recorded role',
      status: 'Status',
      end_reason: 'End reason',
      logout_at: 'Logout (Manila)',
      duration_minutes: 'Duration (minutes)',
      browser: 'Browser',
      device: 'Device',
      email: 'Email',
      ip_address: 'IP address',
      page_visits: 'Page visits',
    },
    defaults: [
      'id',
      'date',
      'actor',
      'role',
      'status',
      'end_reason',
      'duration_minutes',
    ],
  },
  activity: {
    dates: ['action_date'],
    facets: {
      action: 'Action',
      module: 'Module',
      organization_id: 'Organization',
      actor_id: 'Actor',
      role: 'Recorded role',
    },
    columns: {
      ...identity,
      action: 'Action',
      module: 'Module',
      actor: 'Actor',
      role: 'Recorded role',
      entity_id: 'Entity ID',
      title: 'Title',
      email: 'Email',
      remarks: 'Remarks',
    },
    defaults: [
      'date',
      'id',
      'action',
      'module',
      'actor',
      'organization',
      'title',
    ],
  },
  proposals: {
    dates: ['first_submitted_at', 'latest_submitted_at', 'event_date'],
    facets: {
      organization_id: 'Organization',
      status: 'Current status',
      type: 'Activity type',
      department: 'Proponent department',
      has_reservation: 'Has reservation',
      has_budget: 'Has budget',
      collaboration_role: 'Collaboration role',
      desk_history: 'Desk history',
    },
    columns: {
      ...identity,
      title: 'Event',
      status: 'Current status',
      type: 'Activity type',
      department: 'Proponent department',
      first_submitted_at: 'First submitted (Manila)',
      latest_submitted_at: 'Latest submitted (Manila)',
      event_date: 'Event date',
      has_reservation: 'Has reservation',
      has_budget: 'Has budget',
      collaboration_role: 'Collaboration role',
      proposed_budget: 'Proposed budget (PHP)',
      planned_participants: 'Planned participant places',
      duration_minutes: 'Overall turnaround (wall-clock minutes)',
      overall_turnaround_working_minutes:
        'Overall turnaround (working minutes)',
      adviser_desk_working_minutes: 'Adviser desk time (working minutes)',
      dean_desk_working_minutes: 'Dean desk time (working minutes)',
      osaar_desk_working_minutes: 'OSAAR desk time (working minutes)',
      cdm_desk_working_minutes: 'CDM desk time (working minutes)',
      desk_history: 'Desk history',
      privacy_consent_version: 'Data privacy consent (version)',
      privacy_consent_at: 'Data privacy consent accepted (Manila)',
    },
    defaults: ['id', 'date', 'title', 'organization', 'type', 'status'],
  },
  postevals: {
    dates: ['filed_date'],
    facets: { organization_id: 'Organization', status: 'Current status' },
    columns: {
      ...identity,
      title: 'Event',
      status: 'Current status',
      resolved_at: 'Resolved (Manila)',
      duration_minutes: 'Resolution time (minutes)',
    },
    defaults: ['id', 'date', 'title', 'organization', 'status'],
  },
  reservation_changes: {
    dates: ['requested_at', 'resolved_at'],
    facets: {
      organization_id: 'Organization',
      campus_id: 'Campus',
      status: 'Status',
      type: 'Request type',
      decision: 'Resolution',
    },
    columns: {
      ...identity,
      title: 'Event',
      campus_id: 'Campus ID',
      type: 'Request type',
      status: 'Status',
      decision: 'Resolution',
      requested_at: 'Requested (Manila)',
      resolved_at: 'Resolved (Manila)',
      duration_minutes: 'Resolution time (minutes)',
      remarks: 'Remarks',
    },
    defaults: [
      'id',
      'date',
      'title',
      'organization',
      'type',
      'status',
      'decision',
    ],
  },
};

const ENUM_FILTERS: Partial<Record<ReportKind, Record<string, string[]>>> = {
  sessions: {
    status: [
      'active',
      'completed',
      'expired',
      'revoked',
      'logged_out',
      'timed_out',
      'no_logout_recorded',
      'unknown',
    ],
  },
  proposals: {
    status: [
      'pending',
      'returned',
      'approved',
      'denied',
      'finished',
      'cancelled',
    ],
    type: ['co-curricular', 'extra-curricular'],
    has_reservation: ['true', 'false'],
    has_budget: ['true', 'false'],
    collaboration_role: ['proponent', 'dependent'],
    desk_history: ['recorded', 'backfilled', 'missing'],
  },
  postevals: { status: ['submitted', 'approved', 'denied'] },
  reservation_changes: {
    status: ['pending', 'resolved', 'denied'],
    type: ['cancel', 'reschedule'],
    decision: ['cancel', 'reschedule', 'deny'],
  },
};

export function invalidReport(message: string): never {
  throw new UnprocessableEntityException({
    message,
    code: 'INVALID_REPORT_FILTER',
  });
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function rangeBounds(filters: ReportFilters): {
  start: number;
  end: number;
} {
  if (!validDate(filters.start_date) || !validDate(filters.end_date))
    invalidReport('Select valid start and end dates.');
  const start = Date.parse(`${filters.start_date}T00:00:00+08:00`);
  const end = Date.parse(`${filters.end_date}T00:00:00+08:00`) + 86_400_000;
  if (end <= start) invalidReport('End date must be on or after start date.');
  if ((end - start) / 86_400_000 > 366)
    invalidReport('Select a range of at most 366 days.');
  return { start, end };
}
export function parseFilters(
  kind: ReportKind,
  input: unknown,
  requireDates = true,
): ReportFilters {
  const obj = record(input);
  if (!obj) invalidReport('filters must be an object.');
  const allowed = [
    'start_date',
    'end_date',
    'date_basis',
    'search',
    'values',
    'sort',
  ];
  if (Object.keys(obj).some((key) => !allowed.includes(key)))
    invalidReport('Unsupported filter field.');
  const definition = REPORT_DEFINITIONS[kind];
  const basis = obj.date_basis ?? definition.dates[0];
  if (typeof basis !== 'string' || !definition.dates.includes(basis))
    invalidReport('Unsupported date basis.');
  if (
    obj.search !== undefined &&
    (typeof obj.search !== 'string' || obj.search.length > 200)
  )
    invalidReport('Search must contain at most 200 characters.');
  if (obj.sort !== undefined && obj.sort !== 'asc' && obj.sort !== 'desc')
    invalidReport('Unsupported sort direction.');
  const values = obj.values === undefined ? {} : record(obj.values);
  if (!values) invalidReport('Filter values must be an object.');
  const selected: Record<string, string[]> = {};
  for (const [key, choices] of Object.entries(values)) {
    if (
      !Object.hasOwn(definition.facets, key) ||
      !Array.isArray(choices) ||
      choices.length > 100 ||
      choices.some((value) => typeof value !== 'string' || value.length > 200)
    )
      invalidReport('Unsupported filter values.');
    const enums = ENUM_FILTERS[kind]?.[key];
    if (enums && choices.some((value) => !enums.includes(String(value))))
      invalidReport(`Unsupported ${key} value.`);
    selected[key] = [...new Set(choices as string[])].sort();
  }
  const filters: ReportFilters = {
    start_date: obj.start_date as string | undefined,
    end_date: obj.end_date as string | undefined,
    date_basis: basis,
    search: String(obj.search ?? '').trim(),
    sort: obj.sort === 'asc' ? 'asc' : 'desc',
    values: selected,
  };
  if (
    requireDates ||
    filters.start_date !== undefined ||
    filters.end_date !== undefined
  )
    rangeBounds(filters);
  return filters;
}
export function parseReport(kind: ReportKind, input: unknown): ReportRequest {
  const obj = record(input);
  if (
    !obj ||
    Object.keys(obj).some(
      (key) =>
        !['filters', 'sections', 'columns', 'compare_previous_period'].includes(
          key,
        ),
    )
  )
    invalidReport('Unsupported report request.');
  const definition = REPORT_DEFINITIONS[kind];
  const sections = obj.sections ?? ['summary', 'breakdowns', 'details'];
  const columns = obj.columns ?? definition.defaults;
  if (
    !Array.isArray(sections) ||
    sections.length === 0 ||
    sections.some(
      (v) =>
        typeof v !== 'string' ||
        !['summary', 'breakdowns', 'details'].includes(v),
    )
  )
    invalidReport('Unsupported report sections.');
  if (
    !Array.isArray(columns) ||
    columns.length === 0 ||
    columns.some(
      (v) => typeof v !== 'string' || !Object.hasOwn(definition.columns, v),
    )
  )
    invalidReport('Unsupported report columns.');
  if (
    obj.compare_previous_period !== undefined &&
    typeof obj.compare_previous_period !== 'boolean'
  )
    invalidReport('Invalid comparison option.');
  return {
    filters: parseFilters(kind, obj.filters),
    sections: [...new Set(sections as string[])],
    columns: [...new Set(columns as string[])],
    compare_previous_period: obj.compare_previous_period === true,
  };
}

function text(item: Item, key: string): string {
  return str(item, key) ?? '';
}
function numberCell(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function duration(start: unknown, end: unknown): number | null {
  const value = Date.parse(String(end)) - Date.parse(String(start));
  return Number.isFinite(value) && value >= 0 ? value / 60_000 : null;
}
export function reportRow(kind: ReportKind, item: Item): ReportRow {
  if (kind === 'sessions') {
    const device = record(item.device_info) ?? {};
    const visits = Array.isArray(item.pages_visited) ? item.pages_visited : [];
    return {
      id: text(item, 'session_id'),
      date: text(item, 'login_time'),
      actor_id: text(item, 'sub'),
      actor: text(item, 'user_name'),
      email: text(item, 'user_email'),
      role: text(item, 'user_role') || 'unknown',
      status: text(item, 'status') || 'unknown',
      end_reason: text(item, 'end_reason'),
      logout_at: text(item, 'logout_time'),
      duration_minutes: [
        'completed',
        'logged_out',
        'timed_out',
        'expired',
        'revoked',
      ].includes(String(item.status))
        ? duration(item.login_time, item.logout_time)
        : null,
      browser: text(device, 'browser'),
      device: text(device, 'device_type'),
      ip_address: text(item, 'ip_address'),
      page_visits: visits
        .map((v) => {
          const row = record(v) ?? {};
          return `${text(row, 'timestamp')} ${text(row, 'path').split(/[?#]/)[0]}`;
        })
        .join('\n'),
      visits_truncated: item.pages_visited_truncated === true,
    };
  }
  if (kind === 'activity') {
    const module = text(item, 'module');
    return {
      id: text(item, 'activityId'),
      date: text(item, 'timestamp'),
      organization_id: text(item, 'organizationId'),
      organization: text(item, 'organizationName'),
      action: text(item, 'actionType'),
      module,
      actor_id: text(item, 'userId'),
      actor: text(item, 'userName'),
      email: text(item, 'userEmail'),
      role: text(item, 'userRole') || 'unknown',
      entity_id: text(item, 'entityId'),
      title: text(item, 'entityName'),
      remarks: text(item, 'description'),
      proposal_id:
        module.toUpperCase() === 'SUBMISSION' && item.eventId && item.entityId
          ? `${text(item, 'eventId')}:${text(item, 'entityId')}`
          : '',
    };
  }
  const org = text(item, 'organization_id');
  if (kind === 'proposals') {
    const details = record(item.activity_details) ?? {};
    const classification = record(item.activity_classification) ?? {};
    const venue = record(item.venue_reservation) ?? {};
    // Legacy papers carry no `has_budget` key, which means they had a budget.
    const budget = record(item.detailed_budget_proposal) ?? {};
    const proponents = Array.isArray(item.proponents) ? item.proponents : [];
    const first = record(proponents[0]) ?? {};
    const collaboration = record(item.collaboration) ?? {};
    const dependentIds = Array.isArray(collaboration.dependent_organization_ids)
      ? collaboration.dependent_organization_ids
      : [];
    const timings = Array.isArray(item.desk_timings)
      ? readEntries(item.desk_timings)
      : null;
    const deskHistory =
      timings === null
        ? 'missing'
        : timings.some((entry) => entry.source === 'backfill')
          ? 'backfilled'
          : 'recorded';
    const roleWorking = (role: string): number | null => {
      if (!timings) return null;
      const samples = timings
        .filter((entry) => entry.role === role)
        .map((entry) => entry.working_minutes)
        .filter((value): value is number => typeof value === 'number');
      return samples.length
        ? samples.reduce((total, value) => total + value, 0)
        : null;
    };
    const overallWorking =
      timings === null
        ? null
        : workingMinutes(item.first_submitted_at, item.fully_approved_at);
    const consent = record(item.privacy_consent) ?? {};
    return {
      id: `${text(item, 'event_id')}:${text(item, 'submission_id')}`,
      date: text(item, 'first_submitted_at'),
      event_id: text(item, 'event_id'),
      organization_id: org,
      organization:
        text(item, 'organization_name') || org || 'Unknown organization',
      title: text(details, 'title_and_nature'),
      status: text(item, 'status'),
      type: text(classification, 'activity_type'),
      department: text(first, 'department'),
      first_submitted_at: text(item, 'first_submitted_at'),
      latest_submitted_at: text(item, 'sent_at'),
      event_date: text(details, 'date_of_event'),
      event_end:
        text(details, 'end_date_of_event') || text(details, 'date_of_event'),
      has_reservation: venue.has_reservation === true,
      has_budget: budget.has_budget !== false,
      collaboration_role: text(item, 'role') || 'proponent',
      collaborative: dependentIds.length > 0,
      collaboration_ids: JSON.stringify(
        dependentIds.length
          ? [
              ...new Set([
                org,
                ...dependentIds.filter(
                  (id): id is string => typeof id === 'string',
                ),
              ]),
            ].filter(Boolean)
          : [],
      ),
      // A no-budget row stores 0 but is "no budget", not a ₱0 spend, so it is
      // excluded from the budget samples.
      proposed_budget:
        budget.has_budget === false
          ? null
          : numberCell(details.proposed_budget),
      planned_participants: numberCell(details.expected_participants),
      duration_minutes: ['recorded', 'linked_creation_evidence'].includes(
        text(item, 'first_submitted_at_source'),
      )
        ? duration(item.first_submitted_at, item.fully_approved_at)
        : null,
      overall_turnaround_working_minutes: overallWorking,
      adviser_desk_working_minutes: roleWorking('adviser'),
      dean_desk_working_minutes: roleWorking('dean'),
      osaar_desk_working_minutes: roleWorking('osaar'),
      cdm_desk_working_minutes: roleWorking('cdm'),
      desk_history: deskHistory,
      privacy_consent_version: text(consent, 'version'),
      privacy_consent_at: text(consent, 'accepted_at'),
    };
  }
  const resolved =
    kind === 'postevals'
      ? text(item, 'approved_at') || text(item, 'denied_at')
      : text(item, 'resolved_at');
  const submitted =
    kind === 'postevals'
      ? text(item, 'submitted_at')
      : text(item, 'requested_at');
  return {
    id:
      kind === 'postevals'
        ? `${text(item, 'event_id')}:${text(item, 'posteval_id')}`
        : text(item, 'change_id'),
    date: submitted,
    event_id: text(item, 'event_id'),
    organization_id: org,
    organization:
      text(item, 'organization_name') || org || 'Unknown organization',
    title: text(item, 'event_title'),
    status: text(item, 'status'),
    type: text(item, 'request_type'),
    decision: text(item, 'decision'),
    campus_id: text(item, 'campus_id'),
    requested_at: submitted,
    resolved_at: resolved,
    duration_minutes: duration(submitted, resolved),
    remarks: text(item, 'comment') || text(item, 'reason'),
  };
}
export function rowDate(
  kind: ReportKind,
  row: ReportRow,
  basis?: string,
): string {
  return kind === 'proposals' || kind === 'reservation_changes'
    ? String(row[basis ?? REPORT_DEFINITIONS[kind].dates[0] ?? 'date'] ?? '')
    : row.date;
}
export function matchesValues(row: ReportRow, filters: ReportFilters): boolean {
  const query = filters.search?.trim().toLocaleLowerCase();
  if (
    query &&
    ![
      row.id,
      row.title,
      row.organization,
      row.actor,
      row.actor_id,
      row.email,
      row.entity_id,
      row.status,
      row.action,
      row.type,
    ].some((value) =>
      String(value ?? '')
        .toLocaleLowerCase()
        .includes(query),
    )
  )
    return false;
  return Object.entries(filters.values ?? {}).every(
    ([field, values]) =>
      !values.length || values.includes(String(row[field] ?? '')),
  );
}
export function matchesDate(
  kind: ReportKind,
  row: ReportRow,
  filters: ReportFilters,
): boolean {
  if (!filters.start_date && !filters.end_date) return true;
  const { start, end } = rangeBounds(filters);
  const date = rowDate(kind, row, filters.date_basis);
  if (kind === 'proposals' && filters.date_basis === 'event_date') {
    const eventEnd = String(row.event_end || date);
    return (
      validDate(date) &&
      validDate(eventEnd) &&
      eventEnd >= date &&
      date <= String(filters.end_date) &&
      eventEnd >= String(filters.start_date)
    );
  }
  const ts = Date.parse(date);
  return Number.isFinite(ts) && ts >= start && ts < end;
}
export function filterCollection(
  kind: ReportKind,
  items: Item[],
  serialized?: string,
): Item[] {
  if (!serialized) return items;
  let input: unknown;
  try {
    input = JSON.parse(serialized) as unknown;
  } catch {
    invalidReport('Invalid filters JSON.');
  }
  return filterItems(kind, items, parseFilters(kind, input, false));
}
export function filterItems(
  kind: ReportKind,
  items: Item[],
  filters: ReportFilters,
): Item[] {
  return items
    .filter((item) => {
      const row = reportRow(kind, item);
      return matchesValues(row, filters) && matchesDate(kind, row, filters);
    })
    .sort((a, b) => {
      const left = reportRow(kind, a);
      const right = reportRow(kind, b);
      const order =
        compareReportDates(
          rowDate(kind, left, filters.date_basis),
          rowDate(kind, right, filters.date_basis),
        ) || left.id.localeCompare(right.id);
      return filters.sort === 'asc' ? order : -order;
    });
}
function compareReportDates(left: string, right: string): number {
  const a = Date.parse(left);
  const b = Date.parse(right);
  return (Number.isFinite(a) ? a : 0) - (Number.isFinite(b) ? b : 0);
}
function manilaDay(value: string): string {
  const ts = Date.parse(value);
  return Number.isFinite(ts)
    ? new Date(ts + 8 * 3_600_000).toISOString().slice(0, 10)
    : '';
}
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return (
    ((sorted[mid] ?? 0) + (sorted[Math.floor((sorted.length - 1) / 2)] ?? 0)) /
    2
  );
}
interface Ranked {
  key: string;
  label: string;
  count: number;
}
function ranked(map: Map<string, { label: string; count: number }>): Ranked[] {
  return [...map]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
class Aggregates {
  count = 0;
  organizations = new Map<string, { label: string; count: number }>();
  groups = new Map<string, Map<string, { label: string; count: number }>>();
  users = new Set<string>();
  entities = new Set<string>();
  durations: number[] = [];
  deskSamples = {
    adviser: [] as number[],
    dean: [] as number[],
    osaar: [] as number[],
    cdm: [] as number[],
  };
  overallWorking: number[] = [];
  missingDeskHistory = 0;
  reservationCount = 0;
  collaborationCount = 0;
  budgetCents = 0;
  budgetSamples = 0;
  participants = 0;
  participantSamples = 0;
  oldestPending: number | null = null;
  decisions = new Map<
    string,
    { label: string; approved: number; denied: number }
  >();
  constructor(
    private readonly kind: ReportKind,
    private readonly basis: string,
    private readonly now: number,
  ) {}
  add(row: ReportRow): void {
    this.count++;
    if (row.actor_id) this.users.add(String(row.actor_id));
    const entity = this.kind === 'activity' ? row.proposal_id : row.event_id;
    if (entity) this.entities.add(String(entity));
    if (typeof row.duration_minutes === 'number')
      this.durations.push(row.duration_minutes);
    if (row.has_reservation) this.reservationCount++;
    if (row.collaborative) this.collaborationCount++;
    if (typeof row.proposed_budget === 'number') {
      this.budgetCents += Math.round(row.proposed_budget * 100);
      this.budgetSamples++;
    }
    if (typeof row.planned_participants === 'number') {
      this.participants += row.planned_participants;
      this.participantSamples++;
    }
    if (row.status === 'pending' && row.first_submitted_at) {
      const age =
        (this.now - Date.parse(String(row.first_submitted_at))) / 86_400_000;
      if (Number.isFinite(age) && age >= 0)
        this.oldestPending = Math.max(this.oldestPending ?? 0, age);
    }
    const org = String(
      row.organization_id || row.organization || 'Unknown organization',
    );
    if (row.organization) {
      const previous = this.organizations.get(org);
      this.organizations.set(org, {
        label: String(row.organization),
        count: (previous?.count ?? 0) + 1,
      });
      const decided = this.decisions.get(org) ?? {
        label: String(row.organization),
        approved: 0,
        denied: 0,
      };
      if (row.status === 'approved' || row.status === 'finished')
        decided.approved++;
      if (row.status === 'denied') decided.denied++;
      this.decisions.set(org, decided);
    }
    for (const field of [
      'status',
      'type',
      'role',
      'action',
      'module',
      'decision',
      'desk_history',
    ]) {
      if (row[field])
        this.increment(field, String(row[field]), String(row[field]));
    }
    if (this.kind === 'proposals') {
      const firstDay = manilaDay(String(row.first_submitted_at ?? ''));
      if (firstDay) this.increment('first_submission_day', firstDay, firstDay);
      if (row.desk_history === 'missing') this.missingDeskHistory++;
      for (const role of ['adviser', 'dean', 'osaar', 'cdm'] as const) {
        const sample = row[`${role}_desk_working_minutes`];
        if (typeof sample === 'number') this.deskSamples[role].push(sample);
      }
      if (typeof row.overall_turnaround_working_minutes === 'number')
        this.overallWorking.push(row.overall_turnaround_working_minutes);
      const participants = JSON.parse(
        String(row.collaboration_ids || '[]'),
      ) as string[];
      for (const id of participants)
        this.increment(
          'collaborative_participation',
          id,
          id === org ? String(row.organization || id) : id,
        );
    }
    const day = manilaDay(rowDate(this.kind, row, this.basis));
    if (day) this.increment('day', day, day);
    if (this.kind === 'sessions' && row.date) {
      const ts = Date.parse(row.date);
      if (Number.isFinite(ts)) {
        const hour = new Date(ts + 8 * 3_600_000).getUTCHours();
        this.increment(
          'hour',
          String(hour).padStart(2, '0'),
          `${String(hour).padStart(2, '0')}:00`,
        );
      }
    }
    if (
      this.kind === 'activity' &&
      /^SUBMISSION_(APPROVE|RETURN|DENY)$/.test(String(row.action)) &&
      row.actor_id
    )
      this.increment(
        'reviewer',
        String(row.actor_id),
        String(row.actor || row.actor_id),
      );
  }
  private increment(field: string, key: string, label: string): void {
    const group =
      this.groups.get(field) ??
      new Map<string, { label: string; count: number }>();
    group.set(key, { label, count: (group.get(key)?.count ?? 0) + 1 });
    this.groups.set(field, group);
  }
  output(): {
    summary: Record<string, Cell>;
    breakdowns: Record<string, Ranked[]>;
  } {
    const status = this.groups.get('status');
    const approved =
      (status?.get('approved')?.count ?? 0) +
      (status?.get('finished')?.count ?? 0);
    const denied = status?.get('denied')?.count ?? 0;
    const summary: Record<string, Cell> = { total_records: this.count };
    const breakdowns: Record<string, Ranked[]> = {};
    for (const [key, group] of this.groups) breakdowns[key] = ranked(group);
    if (this.organizations.size) {
      breakdowns.organization = ranked(this.organizations);
      const cutoff = breakdowns.organization[4]?.count ?? 0;
      breakdowns.top_organizations = breakdowns.organization.filter(
        (row, index) => index < 5 || row.count === cutoff,
      );
    }
    const superlatives = [
      'day',
      ...(this.kind === 'sessions' ? ['hour'] : ['organization']),
      ...(this.kind === 'activity' ? ['reviewer'] : []),
      ...(this.kind === 'proposals' ? ['first_submission_day'] : []),
    ];
    for (const field of superlatives) {
      const list = breakdowns[field];
      const winner = list?.[0];
      summary[`most_${field}`] = winner
        ? list
            .filter((item) => item.count === winner.count)
            .map((item) => `${item.label} (${item.count})`)
            .join('; ')
        : null;
    }
    if (this.kind === 'proposals') {
      summary.distinct_proposals = this.count;
      summary.submitting_organizations = this.organizations.size;
      summary.approved_or_finished = approved;
      summary.denied = denied;
      summary.approval_denominator = approved + denied;
      summary.approval_rate_percent =
        approved + denied ? (100 * approved) / (approved + denied) : null;
      summary.with_reservation = this.reservationCount;
      summary.reservation_share_percent = this.count
        ? (100 * this.reservationCount) / this.count
        : null;
      summary.collaborative_proposals = this.collaborationCount;
      summary.collaboration_share_percent = this.count
        ? (100 * this.collaborationCount) / this.count
        : null;
      summary.proposed_budget_php = this.budgetSamples
        ? this.budgetCents / 100
        : null;
      summary.budget_sample_count = this.budgetSamples;
      summary.planned_participant_places = this.participantSamples
        ? this.participants
        : null;
      summary.participant_sample_count = this.participantSamples;
      summary.oldest_pending_age_days = this.oldestPending;
      const rates = [...this.decisions]
        .filter(([, v]) => v.approved + v.denied >= 5)
        .map(([key, v]) => ({
          key,
          label: `${v.label} (${v.approved}/${v.approved + v.denied})`,
          count: (v.approved / (v.approved + v.denied)) * 100,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
      breakdowns.organization_approval_rate_percent = rates;
      summary.highest_approval_rate = rates[0]
        ? rates
            .filter((v) => v.count === rates[0]?.count)
            .map((v) => `${v.label}: ${v.count.toFixed(1)}%`)
            .join('; ')
        : null;
      const deskRoles = ['adviser', 'dean', 'osaar', 'cdm'] as const;
      const deskMedians: Ranked[] = [];
      for (const role of deskRoles) {
        const value = median(this.deskSamples[role]);
        summary[`median_${role}_desk_working_minutes`] = value;
        if (value !== null)
          deskMedians.push({
            key: role,
            label: role.toLocaleUpperCase(),
            count: value,
          });
      }
      summary.average_cdm_desk_working_minutes = this.deskSamples.cdm.length
        ? this.deskSamples.cdm.reduce((a, b) => a + b, 0) /
          this.deskSamples.cdm.length
        : null;
      summary.cdm_desk_sample_count = this.deskSamples.cdm.length;
      summary.median_overall_turnaround_working_minutes = median(
        this.overallWorking,
      );
      summary.proposals_missing_desk_history = this.missingDeskHistory;
      breakdowns.desk_median_working_minutes = deskMedians.sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label),
      );
    }
    if (this.kind === 'sessions') summary.distinct_users = this.users.size;
    if (this.kind === 'activity')
      summary.distinct_affected_proposals = this.entities.size;
    if (this.kind === 'postevals') summary.distinct_events = this.entities.size;
    if (this.kind !== 'activity') {
      summary.median_duration_minutes = median(this.durations);
      summary.average_duration_minutes = this.durations.length
        ? this.durations.reduce((a, b) => a + b, 0) / this.durations.length
        : null;
      summary.duration_sample_count = this.durations.length;
    }
    return { summary, breakdowns };
  }
}

export async function generateReport(
  kind: ReportKind,
  input: unknown,
  scope: string,
  load: (filters: ReportFilters) => Promise<Item[]> | AsyncIterable<Item>,
  retentionDays?: number,
): Promise<Item> {
  const request = parseReport(kind, input);
  return withReportBudget(async () => {
    const started = new Date();
    const previous = { ...request.filters };
    const bounds = rangeBounds(request.filters);
    const days = (bounds.end - bounds.start) / 86_400_000;
    previous.start_date = new Date(
      Date.parse(`${request.filters.start_date}T00:00:00Z`) - days * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    previous.end_date = new Date(
      Date.parse(`${request.filters.start_date}T00:00:00Z`) - 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    const current = new Aggregates(
      kind,
      request.filters.date_basis ?? '',
      started.getTime(),
    );
    const comparison = new Aggregates(
      kind,
      request.filters.date_basis ?? '',
      started.getTime(),
    );
    const rows: ReportRow[] = [];
    let unknownDates = 0;
    let truncatedVisits = 0;
    let unlinkedActions = 0;
    let detailBytes = 0;
    const seen = new Set<string>();
    const sourceFilters = {
      ...request.filters,
      ...(request.compare_previous_period
        ? { start_date: previous.start_date }
        : {}),
    };
    const source = load(sourceFilters);
    const iterable =
      Symbol.asyncIterator in Object(source)
        ? (source as AsyncIterable<Item>)
        : ((await source) as Item[]);
    for await (const item of iterable) {
      reportRequestOptions();
      const row = reportRow(kind, item);
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      if (!matchesValues(row, request.filters)) continue;
      if (
        !Number.isFinite(
          Date.parse(rowDate(kind, row, request.filters.date_basis)),
        )
      ) {
        unknownDates++;
        continue;
      }
      if (request.compare_previous_period && matchesDate(kind, row, previous))
        comparison.add(row);
      if (!matchesDate(kind, row, request.filters)) continue;
      row.date = rowDate(kind, row, request.filters.date_basis);
      current.add(row);
      if (row.visits_truncated) truncatedVisits++;
      if (
        kind === 'activity' &&
        String(row.module).toUpperCase() === 'SUBMISSION' &&
        !row.proposal_id
      )
        unlinkedActions++;
      if (request.sections.includes('details')) {
        if (rows.length >= 10_000) reportTooLarge();
        const detail = Object.fromEntries(
          ['id', 'date', ...request.columns].map((key) => [
            key,
            row[key] ?? null,
          ]),
        ) as ReportRow;
        detailBytes += Buffer.byteLength(JSON.stringify(detail), 'utf8') + 1;
        if (detailBytes > 4 * 1024 * 1024) reportTooLarge();
        rows.push(detail);
      }
    }
    rows.sort((a, b) => {
      const order =
        compareReportDates(a.date, b.date) || a.id.localeCompare(b.id);
      return request.filters.sort === 'asc' ? order : -order;
    });
    const warnings: string[] = [
      'Reads reflect records at retrieval time; DynamoDB reads are not a historical transaction snapshot. Historical coverage describes known gaps, not proof that every past action was recorded.',
    ];
    if (kind === 'proposals')
      warnings.push(
        'Statuses describe current records at retrieval, not their state on the historical end date. Collaboration copies are counted once under the proponent organization.',
      );
    if (unknownDates)
      warnings.push(
        `${unknownDates} records in the authorized non-date-filtered scope have no reliable selected date. They may be inside or outside this range and are excluded.`,
      );
    const retentionGap =
      retentionDays !== undefined &&
      Date.parse(`${sourceFilters.start_date}T00:00:00+08:00`) <
        started.getTime() - retentionDays * 86_400_000;
    if (retentionGap)
      warnings.push(
        `The range reaches beyond the configured ${retentionDays}-day log retention window. Only retained records are available; deleted history cannot be reconstructed.`,
      );
    if (truncatedVisits && request.columns.includes('page_visits'))
      warnings.push(
        `${truncatedVisits} sessions have truncated page-visit timelines.`,
      );
    if (unlinkedActions)
      warnings.push(
        `${unlinkedActions} submission actions lack a complete event/proposal identity and are excluded from distinct affected proposal statistics.`,
      );
    const output = current.output();
    if (kind === 'activity')
      output.summary.unlinked_submission_actions = unlinkedActions;
    const missingDesk = Number(output.summary.proposals_missing_desk_history ?? 0);
    if (kind === 'proposals' && missingDesk > 0)
      warnings.push(
        `${missingDesk} of ${current.count} proposals (${current.count ? ((100 * missingDesk) / current.count).toFixed(1) : '0.0'}%) have no per-desk history, so their desk-time cells are empty. Desk durations count ${describeWorkingHours()}.`,
      );
    const result: Item = {
      report_type: kind,
      filters: request.filters,
      retrieved_from: started.toISOString(),
      retrieved_to: new Date().toISOString(),
      scope,
      total_count: current.count,
      summary: request.sections.includes('summary') ? output.summary : {},
      breakdowns: request.sections.includes('breakdowns')
        ? output.breakdowns
        : {},
      comparison: request.compare_previous_period
        ? {
            start_date: previous.start_date,
            end_date: previous.end_date,
            previous_count: comparison.count,
            current_count: current.count,
            difference: current.count - comparison.count,
            percent_change: comparison.count
              ? ((current.count - comparison.count) / comparison.count) * 100
              : null,
          }
        : null,
      columns: request.columns.map((key) => ({
        key,
        label: REPORT_DEFINITIONS[kind].columns[key],
      })),
      rows,
      coverage: {
        retrieval_complete: true,
        historical_coverage_complete:
          !unknownDates &&
          !unlinkedActions &&
          !retentionGap &&
          !(truncatedVisits && request.columns.includes('page_visits')),
        unknown_date_candidates: unknownDates,
        retention_days: retentionDays ?? null,
      },
      warnings,
    };
    if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 4 * 1024 * 1024)
      reportTooLarge();
    reportRequestOptions();
    return result;
  });
}
