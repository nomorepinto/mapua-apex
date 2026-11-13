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
  opts: {
    skipPostEval?: boolean;
    enabled?: boolean;
    item?: Item;
    signatoryRows?: Record<string, Item>;
  } = {},
) {
  const watched: Item[] = [];
  const updates: Item[] = [];
  const item = opts.item ?? paper();
  const signatoryRows: Record<string, Item> = {
    osaar: { role: 'osaar', campus_id: 'intramuros' },
    'osaar-all': { role: 'osaar', all_campuses: true },
    cdm: { role: 'cdm' },
    ...opts.signatoryRows,
  };
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
    {
      async get(id: string) {
        return signatoryRows[id];
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

describe('SubmissionReviewService classification gate (R-1)', () => {
  it('rejects a campus OSAAR trying to classify', async () => {
    const { service } = build();

    await expect(
      service.classify(signatoryKey('osaar'), 'e', 's', 'major'),
    ).rejects.toMatchObject({
      response: {
        message:
          'Only the all-campus OSAAR can classify an event as major or minor.',
      },
    });
  });

  it('lets the all-campus OSAAR classify', async () => {
    const { service, updates } = build({
      item: paper({
        GSI2PK: 'SIGNATORY#osaar-all',
        signatory_sequence: ['SIGNATORY#osaar-all'],
        activity_classification: { activity_type: 'extra-curricular' },
      }),
    });

    await service.classify(signatoryKey('osaar-all'), 'e', 's', 'Major');

    expect(updates[0]).toMatchObject({
      activity_classification: {
        activity_type: 'extra-curricular',
        nature: 'major',
      },
    });
  });

  it('rejects a non-OSAAR desk trying to classify', async () => {
    const { service } = build({
      item: paper({
        GSI2PK: 'SIGNATORY#cdm',
        signatory_sequence: ['SIGNATORY#cdm'],
      }),
    });

    await expect(
      service.classify(signatoryKey('cdm'), 'e', 's', 'minor'),
    ).rejects.toMatchObject({ response: { message: expect.any(String) } });
  });
});

describe('SubmissionReviewService CDM outside-equipment gate (S-8)', () => {
  function cdmPaper(overrides: Item = {}): Item {
    return paper({
      GSI2PK: 'SIGNATORY#cdm',
      signatory_sequence: ['SIGNATORY#cdm'],
      signatory_steps: [
        { key: 'cdm', role: 'cdm', signatory_id: 'SIGNATORY#cdm', organization_id: null },
      ],
      venue_reservation: {
        has_reservation: true,
        outside_equipment: [
          { name: 'Sound system', purpose: 'Program audio' },
          { name: 'Smoke machine' },
        ],
      },
      ...overrides,
    });
  }

  it('blocks CDM approve while any outside item is undecided', async () => {
    const { service } = build({ item: cdmPaper() });

    await expect(
      service.approve(signatoryKey('cdm'), 'e', 's'),
    ).rejects.toMatchObject({
      response: {
        message: expect.stringContaining('Sound system'),
      },
    });
  });

  it('blocks CDM approve when only some items are decided', async () => {
    const { service } = build({
      item: cdmPaper({
        outside_equipment_decisions: [
          { name: 'Sound system', allowed: true },
        ],
      }),
    });

    await expect(
      service.approve(signatoryKey('cdm'), 'e', 's'),
    ).rejects.toMatchObject({
      response: {
        message: expect.stringContaining('Smoke machine'),
      },
    });
  });

  it('allows CDM approve once every item has a decision (allowed or not)', async () => {
    const { service, updates } = build({
      item: cdmPaper({
        outside_equipment_decisions: [
          { name: 'Sound system', allowed: true },
          { name: 'Smoke machine', allowed: false },
        ],
      }),
    });

    await service.approve(signatoryKey('cdm'), 'e', 's');

    expect(updates[0]).toMatchObject({ status: 'approved' });
  });

  it('does not gate a non-CDM desk on outside equipment', async () => {
    const { service, updates } = build({
      item: paper({
        venue_reservation: {
          has_reservation: true,
          outside_equipment: [{ name: 'Sound system' }],
        },
      }),
    });

    await service.approve(signatoryKey('osaar'), 'e', 's');

    expect(updates[0]).toMatchObject({ status: 'approved' });
  });

  it('records per-item decisions for the CDM desk', async () => {
    const { service, updates } = build({ item: cdmPaper() });

    await service.setOutsideEquipmentDecisions(signatoryKey('cdm'), 'e', 's', [
      { name: 'Sound system', allowed: true },
      { name: 'Smoke machine', allowed: false },
    ]);

    const decisions = updates[0]!.outside_equipment_decisions as Item[];
    expect(decisions).toHaveLength(2);
    expect(decisions[0]).toMatchObject({ name: 'Sound system', allowed: true });
    expect(decisions[1]).toMatchObject({ name: 'Smoke machine', allowed: false });
    expect(typeof decisions[0]!.decided_at).toBe('string');
  });

  it('rejects decisions from a non-CDM desk', async () => {
    // The paper sits on the OSAAR desk so requireOpen passes and the role
    // check (not the desk check) is what rejects the call.
    const { service } = build({
      item: cdmPaper({
        GSI2PK: desk,
        signatory_sequence: [desk],
      }),
    });

    await expect(
      service.setOutsideEquipmentDecisions(signatoryKey('osaar'), 'e', 's', [
        { name: 'Sound system', allowed: true },
      ]),
    ).rejects.toMatchObject({
      response: { message: 'Only the CDM desk can rule on outside equipment.' },
    });
  });

  it('rejects a decision for an item that is not listed', async () => {
    const { service } = build({ item: cdmPaper() });

    await expect(
      service.setOutsideEquipmentDecisions(signatoryKey('cdm'), 'e', 's', [
        { name: 'Fog cannon', allowed: true },
      ]),
    ).rejects.toMatchObject({
      response: {
        message: '"Fog cannon" is not listed as outside equipment.',
      },
    });
  });
});
