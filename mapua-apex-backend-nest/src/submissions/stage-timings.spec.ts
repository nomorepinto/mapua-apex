import { describe, expect, it } from 'vitest';
import {
  EXPECTED_STAGE_TAT_HOURS,
  initialStageTimings,
  publicStageTimings,
  reopenStage,
  stampStageAction,
} from './stage-timings.js';

describe('stage timings', () => {
  it('opens only the first desk when a paper is filed', () => {
    const timings = initialStageTimings(
      ['adv', 'osaar'],
      '2026-11-13T01:00:00Z',
    );
    expect(timings).toEqual([
      {
        signatory_id: 'SIGNATORY#adv',
        entered_at: '2026-11-13T01:00:00Z',
        acted_at: null,
        expected_tat_hours: EXPECTED_STAGE_TAT_HOURS,
      },
      {
        signatory_id: 'SIGNATORY#osaar',
        entered_at: null,
        acted_at: null,
        expected_tat_hours: EXPECTED_STAGE_TAT_HOURS,
      },
    ]);
  });

  it('closes the acting desk and opens the next one', () => {
    const filed = initialStageTimings(['adv', 'osaar'], '2026-11-13T01:00:00Z');
    const next = stampStageAction(
      filed,
      ['adv', 'osaar'],
      'adv',
      '2026-11-13T04:00:00Z',
      'osaar',
    );
    expect(next[0]).toMatchObject({
      acted_at: '2026-11-13T04:00:00Z',
      entered_at: '2026-11-13T01:00:00Z',
    });
    expect(next[1]).toMatchObject({
      entered_at: '2026-11-13T04:00:00Z',
      acted_at: null,
    });
    expect(publicStageTimings(next)[0]?.elapsed_hours).toBe(3);
  });

  it('starts a new wait when a returned desk is resubmitted', () => {
    const returned = stampStageAction(
      initialStageTimings(['adv'], '2026-11-13T01:00:00Z'),
      ['adv'],
      'adv',
      '2026-11-13T05:00:00Z',
      null,
    );
    const again = reopenStage(returned, ['adv'], 'adv', '2026-11-13T08:00:00Z');
    expect(again[0]).toMatchObject({
      entered_at: '2026-11-13T08:00:00Z',
      acted_at: null,
    });
  });
});
