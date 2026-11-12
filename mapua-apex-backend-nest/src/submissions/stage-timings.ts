import { stripPrefix } from '../common/dynamo-keys.js';
import { num, record, str, type Item } from '../common/records.js';

/** One calendar day per desk. Stored on the stage so later policy changes do not rewrite history. */
export const EXPECTED_STAGE_TAT_HOURS = 24;

export interface StageTiming {
  signatory_id: string;
  entered_at: string | null;
  acted_at: string | null;
  expected_tat_hours: number;
}

function bare(id: string): string {
  return stripPrefix(id, 'SIGNATORY#') ?? id;
}

function prefixed(id: string): string {
  return id.startsWith('SIGNATORY#') ? id : `SIGNATORY#${id}`;
}

function blank(id: string): StageTiming {
  return {
    signatory_id: prefixed(id),
    entered_at: null,
    acted_at: null,
    expected_tat_hours: EXPECTED_STAGE_TAT_HOURS,
  };
}

export function readStageTimings(value: unknown): StageTiming[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const row = record(entry);
    const id = row ? str(row, 'signatory_id') : null;
    if (!row || !id) {
      return [];
    }
    const hours = num(row, 'expected_tat_hours');
    return [
      {
        signatory_id: prefixed(id),
        entered_at: str(row, 'entered_at') ?? null,
        acted_at: str(row, 'acted_at') ?? null,
        expected_tat_hours:
          hours !== null && hours > 0 ? hours : EXPECTED_STAGE_TAT_HOURS,
      },
    ];
  });
}

function align(existing: unknown, sequence: string[]): StageTiming[] {
  const previous = readStageTimings(existing);
  const used = new Set<number>();
  return sequence.map((id) => {
    const index = previous.findIndex(
      (row, position) =>
        !used.has(position) && bare(row.signatory_id) === bare(id),
    );
    if (index === -1) {
      return blank(id);
    }
    used.add(index);
    const prior = previous[index] as StageTiming;
    return { ...prior, signatory_id: prefixed(id) };
  });
}

/** Open the current desk. A desk that is already waiting keeps its entered_at. */
export function reopenStage(
  existing: unknown,
  sequence: string[],
  desk: string,
  at: string,
): StageTiming[] {
  return align(existing, sequence).map((row) => {
    if (bare(row.signatory_id) !== bare(desk)) {
      return row;
    }
    if (row.entered_at && !row.acted_at) {
      return row;
    }
    return {
      ...row,
      entered_at: at,
      acted_at: null,
    };
  });
}

export function initialStageTimings(
  sequence: string[],
  at: string,
): StageTiming[] {
  const first = sequence[0];
  if (!first) {
    return [];
  }
  return reopenStage([], sequence, first, at);
}

/** Close the acting desk and open the next one. */
export function stampStageAction(
  existing: unknown,
  sequence: string[],
  actorId: string,
  at: string,
  nextId: string | null,
): StageTiming[] {
  const rows = align(existing, sequence);
  let actor = rows.find((row) => bare(row.signatory_id) === bare(actorId));
  if (!actor) {
    actor = blank(actorId);
    rows.push(actor);
  }
  actor.acted_at = at;
  if (nextId) {
    const next = rows.find((row) => bare(row.signatory_id) === bare(nextId));
    if (next) {
      next.entered_at = at;
      next.acted_at = null;
    }
  }
  return rows;
}

export function elapsedHours(
  enteredAt: string | null,
  actedAt: string | null,
): number | null {
  if (!enteredAt || !actedAt) {
    return null;
  }
  const start = Date.parse(enteredAt);
  const end = Date.parse(actedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return Math.round(((end - start) / 3_600_000) * 10) / 10;
}

export function publicStageTimings(value: unknown): Item[] {
  return readStageTimings(value).map((row) => ({
    signatory_id: bare(row.signatory_id),
    entered_at: row.entered_at,
    acted_at: row.acted_at,
    expected_tat_hours: row.expected_tat_hours,
    elapsed_hours: elapsedHours(row.entered_at, row.acted_at),
  }));
}

/** Copy per-stage clocks onto the detail chain, matched in order by signatory. */
export function withChainDurations(chain: unknown, timings: unknown): unknown {
  if (!Array.isArray(chain)) {
    return chain;
  }
  const rows = readStageTimings(timings);
  const used = new Set<number>();
  return chain.map((link) => {
    const item = record(link);
    if (!item) {
      return link;
    }
    const id = str(item, 'signatory_id') ?? '';
    const index = rows.findIndex(
      (row, position) =>
        !used.has(position) && bare(row.signatory_id) === bare(id),
    );
    if (index === -1) {
      return item;
    }
    used.add(index);
    const row = rows[index] as StageTiming;
    return {
      ...item,
      entered_at: row.entered_at,
      acted_at: row.acted_at,
      expected_tat_hours: row.expected_tat_hours,
      elapsed_hours: elapsedHours(row.entered_at, row.acted_at),
    };
  });
}
