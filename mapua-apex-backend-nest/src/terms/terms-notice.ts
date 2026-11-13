import { createHash } from 'node:crypto';

/**
 * Versioned SAAF Terms & Conditions notice (S-1). Mirrors the RA 10173
 * privacy-notice pattern: bumping `TERMS_NOTICE_VERSION` forces every proponent
 * to re-accept on their next submission because the SAAF DTO only validates
 * against the current version. The text is drafted for the client's review.
 */
export const TERMS_NOTICE_VERSION = '1.0';

export interface TermsNotice {
  version: string;
  effective_date: string;
  title: string;
  intro: string;
  turnaround_time: string;
  filing_window: string;
  major_event_criteria: string[];
  minor_event_criteria: string[];
  acknowledgements: string[];
}

export const TERMS_NOTICE: TermsNotice = {
  version: TERMS_NOTICE_VERSION,
  effective_date: '2026-11-13',
  title: 'Activity Application Terms & Conditions',
  intro:
    'By submitting this Student Activity Application Form (SAAF), you agree to the following terms and conditions governing the filing, review, and conduct of student activities at Mapúa University.',
  turnaround_time:
    'The standard turnaround time for activity approval is 2-3 working days from the date of filing, depending on the completeness of the application and the approval chain.',
  filing_window:
    'Activity applications must be filed between 7:00 AM and 3:00 PM. Applications received after the 3:00 PM cutoff are processed on the next working day.',
  major_event_criteria: [
    'Activities that involve external participants, sponsors, or concessionaires, or that generate revenue (for example, selling activities and fundraising/charity events).',
    'Activities that reserve school facilities or bring outside equipment onto campus.',
    'Activities determined by the all-campus OSAAR to be major based on their scope, expected attendance, or institutional impact.',
  ],
  minor_event_criteria: [
    'Internal organization activities with limited scope and no external participation or revenue generation.',
    'Activities that do not reserve school facilities and do not bring outside equipment onto campus.',
  ],
  acknowledgements: [
    'I understand that the standard turnaround time for activity approval is 2-3 working days.',
    'I understand that applications must be filed between 7:00 AM and 3:00 PM, and that submissions after the 3:00 PM cutoff are processed the next working day.',
    'I understand the criteria for major and minor events, and that the all-campus OSAAR determines the official event classification.',
  ],
};

/** sha256 of the canonical (sorted-key) JSON of the notice text. */
export function termsNoticeHash(notice: TermsNotice = TERMS_NOTICE): string {
  return createHash('sha256')
    .update(canonicalJson(notice))
    .digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`,
      );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}