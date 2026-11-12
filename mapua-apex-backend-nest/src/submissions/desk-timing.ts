import { stripPrefix } from '../common/dynamo-keys.js';
import { record, str, type Item } from '../common/records.js';
import { wallMinutes, workingMinutes } from '../common/turnaround.js';

export type DeskTimingAction =
  | 'approved'
  | 'fully approved'
  | 'returned'
  | 'denied';

export interface DeskTimingEntry {
  stage_key: string | null;
  role: string | null;
  signatory_id: string;
  organization_id: string | null;
  action: DeskTimingAction;
  entered_at: string | null;
  acted_at: string;
  wall_minutes: number | null;
  working_minutes: number | null;
  source: 'decision' | 'backfill';
}

export interface DeskTimingDecision {
  signatory_id: string;
  stage_key?: string | null;
  role?: string | null;
  organization_id?: string | null;
  action: DeskTimingAction;
  acted_at: string;
}

const DECISION_ACTIONS: readonly string[] = [
  'approved',
  'fully approved',
  'returned',
  'denied',
];

/**
 * Append the acting desk's timing to a submission's `desk_timings`.
 *
 * `entered_at` is the later of `sent_at` and the previous entry's `acted_at`,
 * so a returned-then-resubmitted paper starts the desk clock at the resubmit.
 * Returns `null` (caller stores nothing) when the position in the chain
 * cannot be established without guessing: a first live entry with no `sent_at`
 * to anchor the clock, or a live entry whose desk does not continue a chain
 * already started by earlier decisions.
 */
export function appendDeskTiming(
  item: Item,
  decision: DeskTimingDecision,
): DeskTimingEntry[] | null {
  const entries = readEntries(item.desk_timings);
  const signatoryId =
    stripPrefix(decision.signatory_id, 'SIGNATORY#') ?? decision.signatory_id;
  if (signatoryId === '') {
    return null;
  }
  const actedAt = decision.acted_at;
  if (!Number.isFinite(Date.parse(actedAt))) {
    return null;
  }
  const sentAt = str(item, 'sent_at');
  if (entries.length === 0) {
    if (!sentAt) {
      return null;
    }
    return [entry(decision, signatoryId, sentAt, actedAt, 'decision')];
  }
  const last = entries[entries.length - 1] as DeskTimingEntry;
  if (last.signatory_id === signatoryId) {
    // Same desk acting again (e.g. a return after an earlier approval):
    // its clock restarted when the paper came back, so re-anchor on sent_at.
    return [...entries, entry(decision, signatoryId, sentAt ?? '', actedAt, 'decision')];
  }
  const previous = last.acted_at;
  if (sentAt && Date.parse(sentAt) > Date.parse(previous)) {
    return [...entries, entry(decision, signatoryId, sentAt, actedAt, 'decision')];
  }
  if (previous && Number.isFinite(Date.parse(previous))) {
    return [
      ...entries,
      entry(decision, signatoryId, previous, actedAt, 'decision'),
    ];
  }
  // The chain so far has no usable clock and this desk is not the recorded
  // successor; never guess a chain position.
  return null;
}

/**
 * Rebuild `desk_timings` from a paper's ordered decision notifications.
 * Used only by the legacy backfill script path so live read paths stay pure;
 * every entry is marked `source: "backfill"`.
 */
export function deriveDeskTimings(
  submission: Item,
  notifications: Item[],
): DeskTimingEntry[] {
  const submitted =
    str(submission, 'first_submitted_at') ?? str(submission, 'sent_at');
  const decisions = notifications
    .flatMap((raw) => {
      const row = record(raw);
      if (!row) {
        return [];
      }
      const action = str(row, 'notif_type');
      const actedAt =
        str(row, 'sent_at') ??
        stripPrefix(row.SK, 'NOTIFICATION#') ??
        undefined;
      if (!action || !DECISION_ACTIONS.includes(action) || !actedAt) {
        return [];
      }
      if (!Number.isFinite(Date.parse(actedAt))) {
        return [];
      }
      return [
        {
          action: action as DeskTimingAction,
          acted_at: actedAt,
          signatory_id: stripPrefix(row.signatory, 'SIGNATORY#') ?? '',
        },
      ];
    })
    .sort(
      (left, right) =>
        Date.parse(left.acted_at) - Date.parse(right.acted_at) ||
        String(left.acted_at).localeCompare(String(right.acted_at)),
    );
  if (decisions.length === 0) {
    return [];
  }
  const steps = readSteps(submission);
  const entries: DeskTimingEntry[] = [];
  let previous = submitted;
  for (const decision of decisions) {
    if (!previous || !Number.isFinite(Date.parse(previous))) {
      // No usable anchor for this desk's clock; the evidence is ambiguous.
      return [];
    }
    if (Date.parse(decision.acted_at) < Date.parse(previous)) {
      // Out-of-order evidence; skip the paper rather than record a negative.
      return [];
    }
    const step = steps.get(decision.signatory_id);
    entries.push(
      entry(
        {
          signatory_id: decision.signatory_id,
          stage_key: step?.key ?? null,
          role: step?.role ?? null,
          organization_id: step?.organization_id ?? null,
          action: decision.action,
          acted_at: decision.acted_at,
        },
        decision.signatory_id,
        previous,
        decision.acted_at,
        'backfill',
      ),
    );
    previous = decision.acted_at;
  }
  return entries;
}

export function readEntries(value: unknown): DeskTimingEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((raw) => {
    const row = record(raw);
    if (!row) {
      return [];
    }
    const actedAt = str(row, 'acted_at');
    const signatoryId = str(row, 'signatory_id');
    if (!actedAt || !signatoryId) {
      return [];
    }
    const enteredAt = str(row, 'entered_at');
    return [
      {
        stage_key: str(row, 'stage_key'),
        role: str(row, 'role'),
        signatory_id: signatoryId,
        organization_id: str(row, 'organization_id'),
        action: (str(row, 'action') ?? 'approved') as DeskTimingAction,
        entered_at: enteredAt,
        acted_at: actedAt,
        wall_minutes: minutesOf(row.wall_minutes),
        working_minutes: minutesOf(row.working_minutes),
        source: str(row, 'source') === 'backfill' ? 'backfill' : 'decision',
      },
    ];
  });
}

function entry(
  decision: DeskTimingDecision,
  signatoryId: string,
  enteredAt: string,
  actedAt: string,
  source: 'decision' | 'backfill',
): DeskTimingEntry {
  const anchored =
    enteredAt !== '' && Number.isFinite(Date.parse(enteredAt))
      ? enteredAt
      : null;
  return {
    stage_key: decision.stage_key ?? null,
    role: decision.role ?? null,
    signatory_id: signatoryId,
    organization_id: decision.organization_id ?? null,
    action: decision.action,
    entered_at: anchored,
    acted_at: actedAt,
    wall_minutes: anchored ? wallMinutes(anchored, actedAt) : null,
    working_minutes: anchored ? workingMinutes(anchored, actedAt) : null,
    source,
  };
}

function minutesOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function readSteps(
  submission: Item,
): Map<string, { key: string | null; role: string | null; organization_id: string | null }> {
  const steps = new Map<
    string,
    { key: string | null; role: string | null; organization_id: string | null }
  >();
  if (!Array.isArray(submission.signatory_steps)) {
    return steps;
  }
  for (const raw of submission.signatory_steps) {
    const step = record(raw);
    if (!step) {
      continue;
    }
    const signatoryId = stripPrefix(step.signatory_id, 'SIGNATORY#');
    if (!signatoryId) {
      continue;
    }
    steps.set(signatoryId, {
      key: str(step, 'key'),
      role: str(step, 'role'),
      organization_id: stripPrefix(step.organization_id, 'ORGANIZATION#'),
    });
  }
  return steps;
}
