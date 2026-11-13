import { describe, expect, it } from 'vitest';
import type { HttpException } from '@nestjs/common';
import { PRIVACY_NOTICE_VERSION } from '../privacy/privacy-notice.js';
import { TERMS_NOTICE_VERSION } from '../terms/terms-notice.js';
import type { SaafDto } from './dto/saaf.dto.js';
import { SubmissionWriterService } from './submission-writer.service.js';

/**
 * The consent guard runs right after `assertDates`. These mocks make the date
 * gate pass trivially (`allowAnyEventDate` removes the floor, an undefined term
 * short-circuits the calendar check) so a rejection can only come from consent.
 */
function build(
  opts: {
    existing?: Record<string, unknown>;
    osaarPeople?: Record<string, unknown>[];
  } = {},
) {
  const updates: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];
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
    async putNotification(item: Record<string, unknown>) {
      notifications.push(item);
    },
    async allocateDocumentNumber() {
      return 'SAAF-261113-001';
    },
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
  const signatories = {
    async listByRole(role: string) {
      return role === 'osaar' ? (opts.osaarPeople ?? []) : [];
    },
  };
  const service = new SubmissionWriterService(
    submissions as never,
    routing as never,
    bookings as never,
    config as never,
    terms as never,
    signatories as never,
  );
  return { service, updates, notifications };
}

function body(
  consent: unknown,
  // `null` omits the field entirely; `undefined` keeps the valid default
  // (JS default params treat an explicit undefined as "use the default").
  termsConsent: unknown = {
    version: TERMS_NOTICE_VERSION,
    accepted: true,
  },
): SaafDto {
  const payload: Record<string, unknown> = {
    submission_type: 'saaf',
    activity_classification: { activity_type: 'co-curricular' },
    proponents: [],
    activity_details: {
      title_and_nature: 'Week of Welcome',
      venue: 'MAIN',
      date_of_event: '2026-12-01',
    },
    institutional_alignment: {},
    detailed_budget_proposal: { has_budget: false },
    venue_reservation: { has_reservation: false },
  };
  if (consent !== undefined) payload.privacy_consent = consent;
  if (termsConsent !== undefined && termsConsent !== null) {
    payload.terms_consent = termsConsent;
  }
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

describe('SubmissionWriterService terms consent gate (S-1)', () => {
  it('rejects a student create with no terms consent', async () => {
    const { service } = build();
    const error = await rejection(
      service.create('orgA', body(validConsent, null) as never),
    );
    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toMatchObject({
      message: 'Please review and accept the current terms and conditions.',
    });
  });

  it('rejects a student create carrying a stale terms version', async () => {
    const { service } = build();
    const error = await rejection(
      service.create(
        'orgA',
        body(validConsent, { version: '0.9-old', accepted: true }) as never,
      ),
    );
    expect(error.getStatus()).toBe(422);
  });

  it('rejects a student create carrying an unaccepted terms consent', async () => {
    const { service } = build();
    const error = await rejection(
      service.create(
        'orgA',
        body(validConsent, {
          version: TERMS_NOTICE_VERSION,
          accepted: false,
        }) as never,
      ),
    );
    expect(error.getStatus()).toBe(422);
  });

  it('rejects a student resubmit with no terms consent', async () => {
    const { service } = build();
    const error = await rejection(
      service.update('orgA', 'e', 's', body(validConsent, null)),
    );
    expect(error.getStatus()).toBe(422);
  });

  it('records the terms consent of record on a valid student create', async () => {
    const { service } = build();
    const stored = await service.create('orgA', body(validConsent) as never);
    const consent = stored.terms_consent as Record<string, unknown>;
    expect(consent).toMatchObject({
      version: TERMS_NOTICE_VERSION,
      channel: 'web',
    });
    expect(typeof consent.notice_hash).toBe('string');
    expect(typeof consent.accepted_at).toBe('string');
  });

  it('leaves the admin PUT untouched by terms consent', async () => {
    const existing = {
      PK: 'EVENT#e',
      SK: 'SUBMISSION#s',
      GSI1PK: 'ORGANIZATION#orgA',
      status: 'pending',
      sent_at: '2026-11-02T02:00:00.000Z',
      activity_details: { venue: 'MAIN', campus_id: 'campusX' },
      venue_reservation: { has_reservation: false },
      terms_consent: {
        version: TERMS_NOTICE_VERSION,
        accepted_at: '2026-11-02T02:00:00.000Z',
      },
    };
    const { service, updates } = build({ existing });

    await service.adminUpdate('e', 's', body(validConsent, null));

    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toHaveProperty('terms_consent');
  });
});

describe('SubmissionWriterService on-submit OSAAR broadcast (S-5)', () => {
  const people = [
    { PK: 'SIGNATORY#osaar-intra', role: 'osaar', campus_id: 'intramuros' },
    { PK: 'SIGNATORY#osaar-makati', role: 'osaar', campus_id: 'makati' },
    { PK: 'SIGNATORY#osaar-all', role: 'osaar', all_campuses: true },
  ];

  it('notifies every campus-scoped OSAAR across all campuses on create', async () => {
    const { service, notifications } = build({ osaarPeople: people });

    await service.create('orgA', body(validConsent) as never);

    expect(notifications).toHaveLength(2);
    expect(notifications.map((entry) => entry.signatory)).toEqual([
      'SIGNATORY#osaar-intra',
      'SIGNATORY#osaar-makati',
    ]);
    expect(notifications[0]).toMatchObject({ notif_type: 'event submitted' });
    expect(String(notifications[0]!.comment)).toContain('Week of Welcome');
  });

  it('skips the all-campus OSAAR in the campus broadcast', async () => {
    const { service, notifications } = build({
      osaarPeople: [{ PK: 'SIGNATORY#osaar-all', role: 'osaar', all_campuses: true }],
    });

    await service.create('orgA', body(validConsent) as never);

    expect(notifications).toHaveLength(0);
  });
});
