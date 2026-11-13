import { describe, expect, it } from 'vitest';
import {
  TERMS_NOTICE,
  TERMS_NOTICE_VERSION,
  termsNoticeHash,
  type TermsNotice,
} from './terms-notice.js';

describe('terms notice (S-1)', () => {
  it('carries the current version on the notice body', () => {
    expect(TERMS_NOTICE.version).toBe(TERMS_NOTICE_VERSION);
  });

  it('states the TAT, filing window, and major/minor criteria', () => {
    expect(TERMS_NOTICE.turnaround_time).toContain('2-3 working days');
    expect(TERMS_NOTICE.filing_window).toContain('7:00 AM');
    expect(TERMS_NOTICE.filing_window).toContain('3:00 PM');
    expect(TERMS_NOTICE.major_event_criteria.length).toBeGreaterThan(0);
    expect(TERMS_NOTICE.minor_event_criteria.length).toBeGreaterThan(0);
    expect(TERMS_NOTICE.acknowledgements.length).toBeGreaterThan(0);
  });

  it('hashes to a stable sha256 hex digest', () => {
    const hash = termsNoticeHash();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(termsNoticeHash()).toBe(hash);
  });

  it('is key-order independent (canonical JSON)', () => {
    const reordered: TermsNotice = {
      acknowledgements: TERMS_NOTICE.acknowledgements,
      minor_event_criteria: TERMS_NOTICE.minor_event_criteria,
      major_event_criteria: TERMS_NOTICE.major_event_criteria,
      filing_window: TERMS_NOTICE.filing_window,
      turnaround_time: TERMS_NOTICE.turnaround_time,
      intro: TERMS_NOTICE.intro,
      title: TERMS_NOTICE.title,
      effective_date: TERMS_NOTICE.effective_date,
      version: TERMS_NOTICE.version,
    };
    expect(termsNoticeHash(reordered)).toBe(termsNoticeHash());
  });

  it('changes when the notice text changes', () => {
    const edited: TermsNotice = {
      ...TERMS_NOTICE,
      turnaround_time: 'The standard turnaround time is 5 working days.',
    };
    expect(termsNoticeHash(edited)).not.toBe(termsNoticeHash());
  });
});