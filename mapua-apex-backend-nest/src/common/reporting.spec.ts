import { describe, expect, it, vi } from 'vitest';
import { reportRequestOptions } from './report-budget.js';
import {
  filterItems,
  generateReport,
  matchesDate,
  parseFilters,
  parseReport,
  rangeBounds,
  reportRow,
  validDate,
} from './reporting.js';
import type { Item } from './records.js';

const filters = { start_date: '2024-02-29', end_date: '2024-02-29' };
const proposal = (id: string, status = 'pending', extra: Item = {}): Item => ({
  event_id: 'event',
  submission_id: id,
  organization_id: 'org',
  organization_name: 'Peña Society',
  first_submitted_at: '2024-02-28T16:00:00Z',
  first_submitted_at_source: 'recorded',
  status,
  activity_details: {
    title_and_nature: 'Forum',
    proposed_budget: 250.25,
    expected_participants: 20,
  },
  ...extra,
});

describe('report dates and request validation', () => {
  it('uses inclusive Manila days and an exclusive UTC upper bound', () => {
    expect(rangeBounds(filters)).toEqual({
      start: Date.parse('2024-02-28T16:00:00Z'),
      end: Date.parse('2024-02-29T16:00:00Z'),
    });
    expect(validDate('2023-02-29')).toBe(false);
    expect(validDate('2024-02-29')).toBe(true);
    expect(() =>
      rangeBounds({ start_date: '2024-03-01', end_date: '2024-02-29' }),
    ).toThrow();
    expect(() =>
      rangeBounds({ start_date: '2023-01-01', end_date: '2024-01-02' }),
    ).toThrow();
    expect(() =>
      parseFilters('proposals', { start_date: '2024-01-01' }),
    ).toThrow();
    expect(() =>
      parseFilters('proposals', { ...filters, date_basis: 'created_at' }),
    ).toThrow();
  });
  it('rejects unknown fields, enum values, and prototype-based columns', () => {
    for (const body of [
      { filters, columns: ['PK'] },
      { filters, columns: ['toString'] },
      { filters: { ...filters, values: { status: ['imagined'] } } },
      { filters, arbitrary: true },
      { filters: { ...filters, values: { constructor: ['x'] } } },
    ]) {
      expect(() => parseReport('proposals', body)).toThrow();
    }
  });
  it('includes overlapping event dates and excludes midnight after the range', () => {
    const row = reportRow(
      'proposals',
      proposal('1', 'approved', {
        activity_details: {
          date_of_event: '2024-02-27',
          end_date_of_event: '2024-03-01',
        },
      }),
    );
    expect(
      matchesDate('proposals', row, { ...filters, date_basis: 'event_date' }),
    ).toBe(true);
    expect(
      matchesDate(
        'proposals',
        reportRow(
          'proposals',
          proposal('2', 'pending', {
            first_submitted_at: '2024-02-29T16:00:00Z',
          }),
        ),
        filters,
      ),
    ).toBe(false);
  });
});

describe('report aggregation and coverage', () => {
  it('deduplicates proposals, preserves ties, and excludes pending/cancelled from approval denominators', async () => {
    const rows = [
      proposal('1', 'approved'),
      proposal('1', 'approved', { role: 'dependent' }),
      proposal('2', 'finished'),
      proposal('3', 'denied'),
      proposal('4'),
      proposal('5', 'cancelled'),
    ];
    const result = await generateReport(
      'proposals',
      { filters },
      'test',
      async () => rows,
    );
    expect(result.total_count).toBe(5);
    expect(result.summary).toMatchObject({
      approved_or_finished: 2,
      approval_denominator: 3,
      approval_rate_percent: 200 / 3,
      proposed_budget_php: 1251.25,
      planned_participant_places: 100,
    });
    expect(JSON.stringify(result)).not.toContain('GSI1PK');
  });
  it('keeps unknown first dates unknown even if latest or event dates are known', async () => {
    const result = await generateReport(
      'proposals',
      { filters },
      'test',
      async () => [
        proposal('1', 'approved', {
          first_submitted_at: undefined,
          sent_at: '2024-02-29T00:00:00Z',
        }),
      ],
    );
    expect(result.total_count).toBe(0);
    expect(result.coverage).toMatchObject({
      retrieval_complete: true,
      historical_coverage_complete: false,
      unknown_date_candidates: 1,
    });
  });
  it('uses identical filters for table, summary and details', async () => {
    const applied = parseFilters('proposals', {
      ...filters,
      values: { status: ['pending', 'approved'], organization_id: ['org'] },
      search: 'Forum',
    });
    const source = [
      proposal('1'),
      proposal('2', 'denied'),
      proposal('3', 'approved'),
    ];
    const result = await generateReport(
      'proposals',
      { filters: applied },
      'test',
      async () => source,
    );
    expect(result.total_count).toBe(
      filterItems('proposals', source, applied).length,
    );
    expect(result.rows).toHaveLength(2);
  });
  it('compares the preceding equal-length period and reports N/A for zero baseline', async () => {
    const result = await generateReport(
      'proposals',
      { filters, compare_previous_period: true },
      'test',
      async () => [proposal('1')],
    );
    expect(result.comparison).toMatchObject({
      start_date: '2024-02-28',
      end_date: '2024-02-28',
      previous_count: 0,
      difference: 1,
      percent_change: null,
    });
  });
  it('uses valid timestamp pairs for approval duration and retains retention warnings', async () => {
    const result = await generateReport(
      'proposals',
      { filters },
      'test',
      async () => [
        proposal('1', 'approved', {
          fully_approved_at: '2024-02-29T16:00:00Z',
        }),
        proposal('2', 'approved', {
          fully_approved_at: '2024-02-27T00:00:00Z',
        }),
      ],
    );
    expect(result.summary).toMatchObject({
      median_duration_minutes: 1440,
      duration_sample_count: 1,
    });
    const logs = await generateReport(
      'activity',
      { filters },
      'test',
      async () => [],
      90,
    );
    expect(logs.coverage).toMatchObject({
      retrieval_complete: true,
      historical_coverage_complete: false,
    });
  });
  it('does not export sensitive fields by default and strips URL queries from opt-in paths', async () => {
    const item = {
      session_id: 's',
      login_time: '2024-02-29T00:00:00Z',
      user_email: 'private@example.org',
      pages_visited: [
        {
          timestamp: '2024-02-29T00:00:00Z',
          path: '/students?token=secret#fragment',
        },
      ],
    };
    const standard = await generateReport(
      'sessions',
      { filters },
      'test',
      async () => [item],
    );
    expect(JSON.stringify(standard.rows)).not.toContain('private@example.org');
    const explicit = await generateReport(
      'sessions',
      { filters, columns: ['page_visits'] },
      'test',
      async () => [item],
    );
    expect(JSON.stringify(explicit.rows)).toContain('/students');
    expect(JSON.stringify(explicit.rows)).not.toContain('secret');
  });
  it('keeps activity decisions separate from distinct compound proposal identities', async () => {
    const rows = [
      {
        activityId: 'a',
        eventId: 'event-a',
        entityId: 's',
        actionType: 'SUBMISSION_APPROVE',
        userId: 'reviewer',
        userName: 'Peña',
      },
      {
        activityId: 'b',
        eventId: 'event-b',
        entityId: 's',
        actionType: 'SUBMISSION_RETURN',
        userId: 'reviewer',
        userName: 'Peña',
      },
      { activityId: 'c', entityId: 's', actionType: 'SUBMISSION_CREATE' },
    ].map((row) => ({
      ...row,
      module: 'SUBMISSION',
      timestamp: '2024-02-29T00:00:00Z',
    }));
    const result = await generateReport(
      'activity',
      { filters },
      'test',
      async () => rows,
    );
    expect(result.summary).toMatchObject({
      total_records: 3,
      distinct_affected_proposals: 2,
      unlinked_submission_actions: 1,
      most_reviewer: 'Peña (2)',
    });
    expect(result.coverage).toMatchObject({
      historical_coverage_complete: false,
    });
  });
  it('counts collaborative participation separately and preserves ranking ties', async () => {
    const rows = [
      proposal('1', 'approved', {
        collaboration: { dependent_organization_ids: ['other', 'other'] },
      }),
      proposal('2', 'denied', {
        organization_id: 'other',
        organization_name: 'Other',
      }),
    ];
    const result = await generateReport(
      'proposals',
      { filters },
      'test',
      async () => rows,
    );
    expect(result.summary).toMatchObject({
      distinct_proposals: 2,
      collaborative_proposals: 1,
      most_first_submission_day: '2024-02-29 (2)',
      highest_approval_rate: null,
    });
    const breakdowns = result.breakdowns as Record<
      string,
      { key: string; count: number }[]
    >;
    expect(breakdowns.collaborative_participation).toHaveLength(2);
    expect(
      breakdowns.collaborative_participation?.every((row) => row.count === 1),
    ).toBe(true);
    expect(String((result.summary as Item).most_organization)).toContain(
      'Other (1)',
    );
    expect(String((result.summary as Item).most_organization)).toContain(
      'Peña Society (1)',
    );
  });
  it('uses only recorded completed sessions and verified proposal timestamp pairs', async () => {
    const rows = ['completed', 'active', 'unknown'].map((status) => ({
      session_id: status,
      status,
      login_time: '2024-02-29T00:00:00Z',
      logout_time: '2024-02-29T01:00:00Z',
    }));
    const sessions = await generateReport(
      'sessions',
      { filters },
      'test',
      async () => rows,
    );
    expect(sessions.summary).toMatchObject({
      duration_sample_count: 1,
      median_duration_minutes: 60,
      average_duration_minutes: 60,
      most_hour: '08:00 (3)',
    });
    const proposals = await generateReport(
      'proposals',
      { filters },
      'test',
      async () => [
        proposal('1', 'approved', {
          first_submitted_at_source: undefined,
          fully_approved_at: '2024-03-01T00:00:00Z',
        }),
      ],
    );
    expect(proposals.summary).toMatchObject({
      duration_sample_count: 0,
      median_duration_minutes: null,
    });
  });
  it('aggregates recorded post-evaluation and reservation resolution timestamps', async () => {
    const rows = [1, 2].map((id) => ({
      event_id: 'e',
      posteval_id: String(id),
      change_id: String(id),
      organization_id: 'org',
      organization_name: 'Society',
      submitted_at: '2024-02-29T00:00:00Z',
      requested_at: '2024-02-29T00:00:00Z',
      status: 'denied',
      denied_at: '2024-02-29T02:00:00Z',
      resolved_at: '2024-02-29T02:00:00Z',
      request_type: 'cancel',
      decision: 'deny',
    }));
    expect(
      (await generateReport('postevals', { filters }, 'test', async () => rows))
        .summary,
    ).toMatchObject({
      distinct_events: 1,
      median_duration_minutes: 120,
      most_organization: 'Society (2)',
    });
    expect(
      (
        await generateReport(
          'reservation_changes',
          { filters },
          'test',
          async () => rows,
        )
      ).summary,
    ).toMatchObject({ total_records: 2, median_duration_minutes: 120 });
  });
  it('rejects malformed event end dates and reports N/A for zero-result superlatives', async () => {
    const row = reportRow(
      'proposals',
      proposal('1', 'pending', {
        activity_details: {
          date_of_event: '2024-02-29',
          end_date_of_event: 'invalid',
        },
      }),
    );
    expect(
      matchesDate('proposals', row, { ...filters, date_basis: 'event_date' }),
    ).toBe(false);
    expect(
      (await generateReport('proposals', { filters }, 'test', async () => []))
        .summary,
    ).toMatchObject({
      most_organization: null,
      most_day: null,
      most_first_submission_day: null,
      approval_rate_percent: null,
    });
  });
  it('rejects a response above 4 MiB without returning detail rows', async () => {
    const row = proposal('large', 'approved', {
      activity_details: { title_and_nature: 'a'.repeat(4 * 1024 * 1024) },
    });
    await expect(
      generateReport('proposals', { filters }, 'test', async () => [row]),
    ).rejects.toMatchObject({
      status: 422,
      response: { code: 'REPORT_TOO_LARGE' },
    });
  });
  it('aborts slow traversal at the generation budget with a retryable error', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    try {
      const pending = generateReport(
        'proposals',
        { filters },
        'test',
        async () => {
          signal = reportRequestOptions().abortSignal;
          await new Promise<void>((resolve) =>
            signal?.addEventListener('abort', () => resolve(), { once: true }),
          );
          return [];
        },
      );
      const checked = expect(pending).rejects.toMatchObject({
        status: 503,
        response: { code: 'REPORT_TIMEOUT', retryable: true },
      });
      await vi.advanceTimersByTimeAsync(20_001);
      await checked;
      expect(signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('fails rather than truncating details and permits summary-only aggregation', async () => {
    const source = Array.from({ length: 10_001 }, (_, index) =>
      proposal(String(index)),
    );
    await expect(
      generateReport('proposals', { filters }, 'test', async () => source),
    ).rejects.toMatchObject({ status: 422 });
    const summary = await generateReport(
      'proposals',
      { filters, sections: ['summary'] },
      'test',
      async () => source,
    );
    expect(summary.total_count).toBe(10_001);
    expect(summary.rows).toEqual([]);
    await expect(
      generateReport('proposals', { filters }, 'test', async () => {
        throw new Error('incomplete');
      }),
    ).rejects.toThrow('incomplete');
  });
});
