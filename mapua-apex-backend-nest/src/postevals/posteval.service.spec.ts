import { describe, expect, it } from 'vitest';
import { PostEvalService } from './posteval.service.js';

describe('PostEvalService skip post-eval', () => {
  const organizations = {
    async get() {
      return { skip_post_eval: true };
    },
  };
  const postevals = {
    async listOrg() {
      throw new Error('skip-post-eval orgs have no eligible events');
    },
    async put() {
      throw new Error('skip-post-eval orgs cannot file a post-evaluation');
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

  it('returns no eligible events when post-eval is skipped', async () => {
    await expect(service.eligible('council')).resolves.toEqual([]);
  });

  it('refuses a post-evaluation when post-eval is skipped', async () => {
    await expect(
      service.create('council', {
        event_id: 'event-1',
        submission_id: 'submission-1',
        section_summary: 'The event ran as planned.',
        financial_report: {},
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'This organization does not file a post-evaluation.',
      },
    });
  });
});
