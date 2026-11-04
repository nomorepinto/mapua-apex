import { describe, expect, it } from 'vitest';
import { manilaDate } from '../common/manila.js';
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

describe('PostEvalService no-budget submissions', () => {
  // The window is measured in Manila days from the real clock, so file "today".
  const today = manilaDate();
  const putted: unknown[] = [];
  const service = new PostEvalService(
    {
      async getSubmission() {
        return null;
      },
      async listOrg() {
        return [];
      },
      async iterateOrg() {},
      async listForEvent() {
        return [];
      },
      async profiles() {
        return [];
      },
      async put(item: unknown) {
        putted.push(item);
      },
    } as never,
    {
      async getSubmission() {
        return {
          GSI1PK: 'ORGANIZATION#council',
          status: 'approved',
          activity_details: { date_of_event: today },
          detailed_budget_proposal: {
            has_budget: false,
            items: [],
            grand_total: 0,
          },
        };
      },
    } as never,
    {
      async get() {
        return { name: 'Student Council' };
      },
    } as never,
    { postEvaluationWindowDays: () => 3 } as never,
  );

  const body = (financialReport: object) => ({
    event_id: 'event-1',
    submission_id: 'submission-1',
    section_summary: 'The event ran as planned.',
    financial_report: financialReport,
  });

  it('rejects financial lines on a submission filed without a budget', async () => {
    await expect(
      service.create('council', {
        ...body({
          budget_items: [{ item: 'Tarp', actual_amount: 100 }],
          added_items: [],
        }),
      }),
    ).rejects.toMatchObject({
      response: {
        message:
          'This activity was filed without a budget, so it has no financial report.',
      },
    });
  });

  it('files an empty financial report for a no-budget submission', async () => {
    const view = await service.create(
      'council',
      body({ budget_items: [], added_items: [] }),
    );
    expect(view.status).toBe('submitted');
    expect(putted).toHaveLength(1);
  });
});
