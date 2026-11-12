import { describe, expect, it } from 'vitest';
import { assertTermDateAllowed } from './term-window.js';

const term = {
  active_academic_year_id: 'ay-2026-2027',
  event_filing_lead_days: 10,
  academic_years: [
    {
      id: 'ay-2026-2027',
      label: 'AY 2026–2027',
      terms: [
        {
          id: 'q1',
          label: 'Quarter 1',
          start: '2026-08-01',
          end: '2026-12-20',
          blackouts: [
            {
              start: '2026-10-12',
              end: '2026-10-16',
              reason: 'University week',
            },
          ],
        },
      ],
    },
  ],
};

describe('assertTermDateAllowed', () => {
  it('allows normal dates and ignores dates outside the active term', () => {
    expect(() => assertTermDateAllowed('2026-10-01', term, 14)).not.toThrow();
    expect(() => assertTermDateAllowed('2027-01-05', term, 14)).toThrow(
      'outside',
    );
  });

  it('rejects inclusive blackout and lockout boundaries', () => {
    expect(() => assertTermDateAllowed('2026-10-12', term, 14)).toThrow(
      'University week',
    );
    expect(() => assertTermDateAllowed('2026-12-07', term, 14)).toThrow(
      'lockout',
    );
    expect(() => assertTermDateAllowed('2026-12-06', term, 14)).not.toThrow();
  });
});
