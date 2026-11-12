import { describe, expect, it } from 'vitest';
import type { HttpException } from '@nestjs/common';
import { PRIVACY_NOTICE_VERSION } from '../privacy/privacy-notice.js';
import type { SaafDto } from './dto/saaf.dto.js';
import { SubmissionWriterService } from './submission-writer.service.js';

/**
 * The consent guard runs right after `assertDates`. These mocks make the date
 * gate pass trivially (`allowAnyEventDate` removes the floor, an undefined term
 * short-circuits the calendar check) so a rejection can only come from consent.
 */
function build(opts: { existing?: Record<string, unknown> } = {}) {
  const updates: Record<string, unknown>[] = [];
  const submissions = {
    async getEvent() {
      return { GSI1PK: 'ORGANIZATION#orgA' };
    },
    async getSubmission() {
      return opts.existing ?? null;
    },
    async updateSubmission(
      _e: string,
      _s: string,
      set: Record<string, unknown>,
    ) {
      updates.push(set);
      return { ...opts.existing, ...set };
    },
    async putSubmission() {},
    async putEvent() {},
    async putCollaboration() {},
    async deleteCollaboration() {},
    async replaceEditable(_existing: unknown, item: Record<string, unknown>) {
      updates.push(item);
      return item;
    },
  };
  const routing = {
    async sequenceFor() {
      return [
        {
          key: 'osaar_1',
          role: 'osaar',
          signatory_id: 'osaar',
          organization_id: null,
        },
      ];
    },
    async hostCampusId() {
      return 'campusX';
    },
    async frozenOsaarStageIds() {
      return ['osaar_1'];
    },
  };
  const bookings = {
    async planForSubmission() {
      return [];
    },
    async commit() {},
    async releaseRefs() {},
  };
  const config = {
    allowAnyEventDate: () => true,
    osaarTermLockoutDays: () => 0,
  };
  const terms = {
    async get() {
      return undefined;
    },
  };
  const service = new SubmissionWriterService(
    submissions as never,
    routing as never,
    bookings as never,
    config as never,
    terms as never,
  );
  return { service, updates };
}

function body(consent: unknown): SaafDto {
  const payload: Record<string, unknown> = {
    submission_type: 'saaf',
    activity_classification: { activity_type: 'co-curricular' },
    proponents: [],
    activity_details: { venue: 'MAIN', date_of_event: '2026-12-01' },
    institutional_alignment: {},
    detailed_budget_proposal: { has_budget: false },
    venue_reservation: { has_reservation: false },
  };
  if (consent !== undefined) payload.privacy_consent = consent;
  return payload as unknown as SaafDto;
}

async function rejection(promise: Promise<unknown>): Promise<HttpException> {
  return promise.then(
    () => {
      throw new Error('expected the write to be rejected');
    },
    (error) => error as HttpException,
  );
}

const validConsent = { version: PRIVACY_NOTICE_VERSION, accepted: true };

describe('SubmissionWriterService privacy consent gate', () => {
  it('rejects a student create with no consent', async () => {
    const { service } = build();
    const error = await rejection(
      service.create('orgA', body(undefined) as never),
    );
    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toMatchObject({
      message: 'Please review and accept the current data privacy notice.',
    });
  });

  it('rejects a student create carrying a stale notice version', async () => {
    const { service } = build();
    const error = await rejection(
      service.create(
        'orgA',
        body({ version: '0.9-old', accepted: true }) as never,
      ),
    );
    expect(error.getStatus()).toBe(422);
  });

  it('rejects a student create carrying an unaccepted consent', async () => {
    const { service } = build();
    const error = await rejection(
      service.create(
        'orgA',
        body({ version: PRIVACY_NOTICE_VERSION, accepted: false }) as never,
      ),
    );
    expect(error.getStatus()).toBe(422);
  });

  it('rejects a student resubmit with no consent', async () => {
    const { service } = build();
    const error = await rejection(
      service.update('orgA', 'e', 's', body(undefined)),
    );
    expect(error.getStatus()).toBe(422);
  });

  it('records the consent of record on a valid student create', async () => {
    const { service } = build();
    const stored = await service.create('orgA', body(validConsent) as never);
    const consent = stored.privacy_consent as Record<string, unknown>;
    expect(consent).toMatchObject({
      version: PRIVACY_NOTICE_VERSION,
      channel: 'web',
    });
    expect(typeof consent.notice_hash).toBe('string');
    expect(typeof consent.accepted_at).toBe('string');
  });

  it('leaves the admin PUT untouched by consent and preserves the stored record', async () => {
    const existing = {
      PK: 'EVENT#e',
      SK: 'SUBMISSION#s',
      GSI1PK: 'ORGANIZATION#orgA',
      status: 'pending',
      sent_at: '2026-11-02T02:00:00.000Z',
      activity_details: { venue: 'MAIN', campus_id: 'campusX' },
      venue_reservation: { has_reservation: false },
      privacy_consent: {
        version: PRIVACY_NOTICE_VERSION,
        accepted_at: '2026-11-02T02:00:00.000Z',
      },
    };
    const { service, updates } = build({ existing });

    // The admin body carries no privacy_consent at all.
    await service.adminUpdate('e', 's', body(undefined));

    // A partial update never SETs privacy_consent, so the record survives.
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toHaveProperty('privacy_consent');
  });
});
