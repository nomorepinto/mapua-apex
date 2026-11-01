import { describe, expect, it } from 'vitest';
import { PostEvalService } from './posteval.service.js';

describe('PostEvalService higher council', () => {
  const organizations = {
    async get() {
      return { is_higher_council: true };
    },
  };
  const postevals = {
    async listOrg() {
      throw new Error('higher councils have no eligible events');
    },
    async put() {
      throw new Error('higher councils cannot file a post-evaluation');
    },
  };
  const submissions = {
    async getSubmission() {
      return {
        GSI1PK: 'ORGANIZATION#council',
        status: 'approved',
        activity_details: { date_of_event: '2026-10-01' },
      };
    },
  };
  const service = new PostEvalService(
    postevals as never,
    submissions as never,
    organizations as never,
    { postEvaluationWindowDays: () => 3 } as never,
  );

  it('returns no eligible events for a higher council', async () => {
    await expect(service.eligible('council')).resolves.toEqual([]);
  });

  it('refuses a post-evaluation filed by a higher council', async () => {
    await expect(
      service.create('council', {
        event_id: 'event-1',
        submission_id: 'submission-1',
        section_summary: 'The event ran as planned.',
        financial_report: {},
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'Higher council organizations do not file a post-evaluation.',
      },
    });
  });
});
