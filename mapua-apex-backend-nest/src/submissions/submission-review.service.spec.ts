import { describe, expect, it } from 'vitest';
import { eventKey, signatoryKey } from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';
import { SubmissionReviewService } from './submission-review.service.js';

const desk = 'SIGNATORY#osaar';
// A Monday morning in Manila (UTC+8), comfortably before "now", so every live
// decision below measures a positive wall/working span against the acted_at.
const sentAt = '2026-11-02T02:00:00.000Z';

function paper(overrides: Item = {}): Item {
  return {
    PK: eventKey('e'),
    SK: 'SUBMISSION#s',
    GSI1PK: 'ORGANIZATION#orgA',
    GSI2PK: desk,
    status: 'pending',
    signatory_sequence: [desk],
    signatory_steps: [
      { key: 'osaar_1', role: 'osaar', signatory_id: desk, organization_id: null },
    ],
    sent_at: sentAt,
    activity_details: { date_of_event: '2026-10-01' },
    ...overrides,
  };
}

function build(
  opts: { skipPostEval?: boolean; enabled?: boolean; item?: Item } = {},
) {
  const watched: Item[] = [];
  const updates: Item[] = [];
  const item = opts.item ?? paper();
  const submissions = {
    async getSubmission() {
      return item;
    },
    async updateSubmission(_e: string, _s: string, set: Item) {
      updates.push(set);
      return { ...item, status: 'approved', ...set };
    },
    async putNotification() {},
    async putCancelWatch(watch: Item) {
      watched.push(watch);
    },
  };
  const service = new SubmissionReviewService(
    submissions as never,
    {
      async conflictsForRefs() {
        return [];
      },
      async approveRefs() {},
      async releaseRefs() {},
    } as never,
    { async decision() {} } as never,
    {} as never,
    {
      postEvaluationWindowDays: () => 3,
      autoCancelEnabled: () => opts.enabled !== false,
    } as never,
    {
      async get() {
        return { skip_post_eval: opts.skipPostEval === true };
      },
    } as never,
  );
  return { service, watched, updates };
}

describe('SubmissionReviewService final approval sentinel', () => {
  it('writes a CANCELWATCH sentinel with a TTL when post-eval is required', async () => {
    const { service, watched } = build();

    await service.approve(signatoryKey('osaar'), 'e', 's');

    expect(watched).toHaveLength(1);
    const item = watched[0]!;
    expect(item).toMatchObject({
      PK: eventKey('e'),
      SK: 'CANCELWATCH#s',
      entity_type: 'cancelwatch',
      event_id: 'e',
      submission_id: 's',
      organization_id: 'orgA',
    });
    expect(typeof item.TTL).toBe('number');
  });

  it('skips the sentinel for a skip_post_eval organization', async () => {
    const { service, watched } = build({ skipPostEval: true });

    await service.approve(signatoryKey('osaar'), 'e', 's');

    expect(watched).toHaveLength(0);
  });

  it('skips the sentinel when the auto-cancel feature is disabled', async () => {
    const { service, watched } = build({ enabled: false });

    await service.approve(signatoryKey('osaar'), 'e', 's');

    expect(watched).toHaveLength(0);
  });
});

describe('SubmissionReviewService desk timings', () => {
  it('appends a "fully approved" timing for the last desk, resolving role from signatory_steps', async () => {
    const { service, updates } = build();

    await service.approve(signatoryKey('osaar'), 'e', 's');

    const timings = updates[0]!.desk_timings as Item[];
    expect(timings).toHaveLength(1);
    expect(timings[0]).toMatchObject({
      signatory_id: 'osaar',
      stage_key: 'osaar_1',
      role: 'osaar',
      action: 'fully approved',
      source: 'decision',
    });
    expect(typeof timings[0]!.working_minutes).toBe('number');
  });

  it('appends an "approved" timing when the paper moves to the next desk', async () => {
    const { service, updates } = build({
      item: paper({
        GSI2PK: 'SIGNATORY#adviser',
        current_signatory: 'SIGNATORY#adviser',
        signatory_sequence: ['SIGNATORY#adviser', desk],
        signatory_steps: [
          {
            key: 'adviser_1',
            role: 'adviser',
            signatory_id: 'SIGNATORY#adviser',
            organization_id: 'ORGANIZATION#orgA',
          },
          { key: 'osaar_1', role: 'osaar', signatory_id: desk, organization_id: null },
        ],
      }),
    });

    await service.approve(signatoryKey('adviser'), 'e', 's');

    const timings = updates[0]!.desk_timings as Item[];
    expect(timings).toHaveLength(1);
    expect(timings[0]).toMatchObject({
      signatory_id: 'adviser',
      stage_key: 'adviser_1',
      role: 'adviser',
      organization_id: 'orgA',
      action: 'approved',
    });
  });

  it('extends an existing chain rather than replacing it', async () => {
    const { service, updates } = build({
      item: paper({
        desk_timings: [
          {
            signatory_id: 'adviser',
            role: 'adviser',
            action: 'approved',
            entered_at: sentAt,
            acted_at: '2026-11-03T02:00:00.000Z',
            source: 'decision',
          },
        ],
      }),
    });

    await service.approve(signatoryKey('osaar'), 'e', 's');

    const timings = updates[0]!.desk_timings as Item[];
    expect(timings).toHaveLength(2);
    expect(timings[1]).toMatchObject({
      signatory_id: 'osaar',
      action: 'fully approved',
      entered_at: '2026-11-03T02:00:00.000Z',
    });
  });

  it('appends a "returned" timing on return for revision', async () => {
    const { service, updates } = build();

    await service.returnForRevision(signatoryKey('osaar'), 'e', 's', 'Fix it');

    const timings = updates[0]!.desk_timings as Item[];
    expect(timings).toHaveLength(1);
    expect(timings[0]).toMatchObject({
      signatory_id: 'osaar',
      role: 'osaar',
      action: 'returned',
    });
  });

  it('appends a "denied" timing on denial', async () => {
    const { service, updates } = build();

    await service.deny(signatoryKey('osaar'), 'e', 's', 'No');

    const timings = updates[0]!.desk_timings as Item[];
    expect(timings).toHaveLength(1);
    expect(timings[0]).toMatchObject({
      signatory_id: 'osaar',
      role: 'osaar',
      action: 'denied',
    });
  });

  it('omits desk_timings when there is no sent_at anchor', async () => {
    const { service, updates } = build({
      item: paper({ sent_at: undefined }),
    });

    await service.approve(signatoryKey('osaar'), 'e', 's');

    expect(updates[0]!.desk_timings).toBeUndefined();
  });
});
