import { describe, expect, it } from 'vitest';
import { eventKey, signatoryKey } from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';
import { SubmissionReviewService } from './submission-review.service.js';

const desk = 'SIGNATORY#osaar';

function paper(): Item {
  return {
    PK: eventKey('e'),
    SK: 'SUBMISSION#s',
    GSI1PK: 'ORGANIZATION#orgA',
    GSI2PK: desk,
    status: 'pending',
    signatory_sequence: [desk],
    activity_details: { date_of_event: '2026-10-01' },
  };
}

function build(opts: { skipPostEval?: boolean; enabled?: boolean } = {}) {
  const watched: Item[] = [];
  const submissions = {
    async getSubmission() {
      return paper();
    },
    async updateSubmission(_e: string, _s: string, set: Item) {
      return { ...paper(), status: 'approved', ...set };
    },
    async putNotification() {},
    async putCancelWatch(item: Item) {
      watched.push(item);
    },
  };
  const service = new SubmissionReviewService(
    submissions as never,
    {
      async conflictsForRefs() {
        return [];
      },
      async approveRefs() {},
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
  return { service, watched };
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
