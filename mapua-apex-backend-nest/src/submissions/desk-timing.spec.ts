import { describe, expect, it } from 'vitest';
import type { Item } from '../common/records.js';
import {
  appendDeskTiming,
  deriveDeskTimings,
  readEntries,
} from './desk-timing.js';

// Manila is UTC+8, so these UTC instants are Manila Monday 10:00 / 12:00 /
// 14:00 / 16:00 — all inside the Mon–Fri 08:00–17:00 working window, which
// makes wall minutes and working minutes equal for every span below.
const MON_10 = '2026-11-02T02:00:00.000Z';
const MON_12 = '2026-11-02T04:00:00.000Z';
const MON_14 = '2026-11-02T06:00:00.000Z';
const MON_16 = '2026-11-02T08:00:00.000Z';

function paper(overrides: Item = {}): Item {
  return { sent_at: MON_10, ...overrides };
}

describe('appendDeskTiming', () => {
  it('anchors the first entry on sent_at and computes wall + working minutes', () => {
    const result = appendDeskTiming(paper(), {
      signatory_id: 'adviser',
      stage_key: 'adviser_1',
      role: 'adviser',
      organization_id: 'orgA',
      action: 'approved',
      acted_at: MON_12,
    });

    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({
      signatory_id: 'adviser',
      stage_key: 'adviser_1',
      role: 'adviser',
      organization_id: 'orgA',
      action: 'approved',
      entered_at: MON_10,
      acted_at: MON_12,
      wall_minutes: 120,
      working_minutes: 120,
      source: 'decision',
    });
  });

  it('strips the SIGNATORY# prefix from the acting desk', () => {
    const result = appendDeskTiming(paper(), {
      signatory_id: 'SIGNATORY#osaar',
      action: 'fully approved',
      acted_at: MON_12,
    });
    expect(result![0]!.signatory_id).toBe('osaar');
  });

  it('returns null when there is no sent_at to anchor the first entry', () => {
    expect(
      appendDeskTiming(
        {},
        { signatory_id: 'adviser', action: 'approved', acted_at: MON_12 },
      ),
    ).toBeNull();
  });

  it('returns null on an empty desk or an unparsable acted_at', () => {
    expect(
      appendDeskTiming(paper(), {
        signatory_id: '',
        action: 'approved',
        acted_at: MON_12,
      }),
    ).toBeNull();
    expect(
      appendDeskTiming(paper(), {
        signatory_id: 'SIGNATORY#',
        action: 'approved',
        acted_at: MON_12,
      }),
    ).toBeNull();
    expect(
      appendDeskTiming(paper(), {
        signatory_id: 'adviser',
        action: 'approved',
        acted_at: 'not-a-date',
      }),
    ).toBeNull();
  });

  it('continues the chain from the previous desk acted_at', () => {
    const first = appendDeskTiming(paper(), {
      signatory_id: 'adviser',
      role: 'adviser',
      action: 'approved',
      acted_at: MON_12,
    })!;
    const second = appendDeskTiming(paper({ desk_timings: first }), {
      signatory_id: 'dean',
      role: 'dean',
      action: 'approved',
      acted_at: MON_14,
    })!;

    expect(second).toHaveLength(2);
    expect(second[1]).toMatchObject({
      signatory_id: 'dean',
      entered_at: MON_12,
      acted_at: MON_14,
      wall_minutes: 120,
      working_minutes: 120,
    });
  });

  it('re-anchors on sent_at when a resubmit is later than the previous desk action', () => {
    const first = appendDeskTiming(paper(), {
      signatory_id: 'adviser',
      role: 'adviser',
      action: 'returned',
      acted_at: MON_12,
    })!;
    // The paper came back and was resubmitted at MON_14, so the next desk's
    // clock starts at the resubmit, not at the old return.
    const second = appendDeskTiming(
      { sent_at: MON_14, desk_timings: first },
      { signatory_id: 'dean', role: 'dean', action: 'approved', acted_at: MON_16 },
    )!;

    expect(second[1]).toMatchObject({
      signatory_id: 'dean',
      entered_at: MON_14,
      acted_at: MON_16,
      wall_minutes: 120,
    });
  });

  it('re-anchors on sent_at when the same desk acts again', () => {
    const first = appendDeskTiming(paper(), {
      signatory_id: 'adviser',
      role: 'adviser',
      action: 'approved',
      acted_at: MON_12,
    })!;
    const second = appendDeskTiming(
      { sent_at: MON_14, desk_timings: first },
      { signatory_id: 'adviser', role: 'adviser', action: 'returned', acted_at: MON_16 },
    )!;

    expect(second).toHaveLength(2);
    expect(second[1]).toMatchObject({
      signatory_id: 'adviser',
      entered_at: MON_14,
      acted_at: MON_16,
    });
  });

  it('returns null when the previous entry has no parsable clock and the desk is not the successor', () => {
    const item = paper({
      desk_timings: [
        {
          signatory_id: 'adviser',
          acted_at: 'garbage',
          action: 'approved',
          source: 'decision',
        },
      ],
    });
    expect(
      appendDeskTiming(item, {
        signatory_id: 'dean',
        action: 'approved',
        acted_at: MON_12,
      }),
    ).toBeNull();
  });
});

describe('deriveDeskTimings', () => {
  const submission: Item = {
    first_submitted_at: MON_10,
    signatory_steps: [
      {
        key: 'adviser_1',
        role: 'adviser',
        signatory_id: 'SIGNATORY#adviser',
        organization_id: 'ORGANIZATION#orgA',
      },
      {
        key: 'osaar_1',
        role: 'osaar',
        signatory_id: 'SIGNATORY#osaar',
        organization_id: null,
      },
    ],
  };

  function notif(signatory: string, notifType: string, sentAt: string): Item {
    return {
      PK: 'SUBMISSION#s',
      SK: `NOTIFICATION#${sentAt}`,
      signatory: `SIGNATORY#${signatory}`,
      notif_type: notifType,
      sent_at: sentAt,
    };
  }

  it('builds backfill entries in decision order, resolving role from signatory_steps', () => {
    const entries = deriveDeskTimings(submission, [
      notif('osaar', 'fully approved', MON_14),
      notif('adviser', 'approved', MON_12),
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      signatory_id: 'adviser',
      role: 'adviser',
      stage_key: 'adviser_1',
      organization_id: 'orgA',
      action: 'approved',
      entered_at: MON_10,
      acted_at: MON_12,
      working_minutes: 120,
      source: 'backfill',
    });
    expect(entries[1]).toMatchObject({
      signatory_id: 'osaar',
      role: 'osaar',
      action: 'fully approved',
      entered_at: MON_12,
      acted_at: MON_14,
      source: 'backfill',
    });
  });

  it('ignores non-decision notifications', () => {
    const entries = deriveDeskTimings(submission, [
      notif('adviser', 'approved', MON_12),
      notif('adviser', 'submitted', MON_10),
    ]);
    expect(entries).toHaveLength(1);
  });

  it('returns empty when there are no decisions', () => {
    expect(deriveDeskTimings(submission, [])).toEqual([]);
  });

  it('returns empty on out-of-order evidence (a decision before submission)', () => {
    const entries = deriveDeskTimings(submission, [
      notif('adviser', 'approved', '2026-11-02T00:00:00.000Z'),
    ]);
    expect(entries).toEqual([]);
  });

  it('returns empty when there is no submission anchor', () => {
    const entries = deriveDeskTimings({ signatory_steps: [] }, [
      notif('adviser', 'approved', MON_12),
    ]);
    expect(entries).toEqual([]);
  });
});

describe('readEntries', () => {
  it('returns an empty list for non-arrays', () => {
    expect(readEntries(undefined)).toEqual([]);
    expect(readEntries('nope')).toEqual([]);
  });

  it('drops rows missing acted_at or signatory_id', () => {
    expect(readEntries([{ signatory_id: 'a' }, { acted_at: MON_12 }])).toEqual(
      [],
    );
  });

  it('coerces an unknown source to decision and normalizes minutes', () => {
    const [entry] = readEntries([
      {
        signatory_id: 'a',
        acted_at: MON_12,
        source: 'weird',
        wall_minutes: -5,
        working_minutes: 30,
      },
    ]);
    expect(entry!.source).toBe('decision');
    expect(entry!.wall_minutes).toBeNull();
    expect(entry!.working_minutes).toBe(30);
  });
});
