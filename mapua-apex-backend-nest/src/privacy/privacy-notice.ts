import { createHash } from 'node:crypto';

/**
 * Versioned RA 10173 (Data Privacy Act of 2012) notice. The text is drafted
 * for the client's legal review (RD-7); bumping `PRIVACY_NOTICE_VERSION`
 * forces every proponent to re-accept on their next submission because the
 * SAAF DTO only validates against the current version.
 */
export const PRIVACY_NOTICE_VERSION = '1.0';

export interface PrivacyNotice {
  version: string;
  effective_date: string;
  title: string;
  intro: string;
  collection: string[];
  purposes: string[];
  sharing: string[];
  rights: string[];
  contact: string;
}

export const PRIVACY_NOTICE: PrivacyNotice = {
  version: PRIVACY_NOTICE_VERSION,
  effective_date: '2026-11-12',
  title: 'Data Privacy Notice (RA 10173)',
  intro:
    'Mapúa University Student Affairs processes the personal data you submit in this activity application form under the Data Privacy Act of 2012 (RA 10173) and its Implementing Rules and Regulations. By proceeding, you acknowledge that you have read this notice and that you submit your own data, and the data of every proponent and listed participant, lawfully and with their knowledge.',
  collection: [
    'Identity details of proponents and listed participants: name, student number, program and year, department, and position in the organization.',
    'Contact details: email address, contact number, and social media handle when provided.',
    'Activity details: title and nature, description, objectives, venue, schedule, expected participants, budget, and institutional alignment.',
    'Reservation and approval records: rooms and equipment requested, the offices that reviewed the application, and the decisions and comments they recorded.',
  ],
  purposes: [
    'To evaluate, approve, return, or deny the proposed student activity.',
    'To coordinate venue reservations, facilities, and safety requirements with the campus offices that support the activity.',
    'To communicate with proponents and signatories about the application, its status, and the conduct of the activity.',
    'To record attendance and post-evaluation of the activity, and to compile institutional reports and statistics on student activities.',
  ],
  sharing: [
    'The application and its attachments are disclosed to the reviewing offices and signatories in the approval chain: the organization adviser, the dean, OSAAR, and campus facilities management (CDM), as applicable.',
    'Venue, schedule, and participant information may be shared with the campus offices and facilities personnel needed to evaluate, prepare for, and run the approved activity.',
    'Personal data is not sold, and is not disclosed outside the University except where required by law or by the duly authorized offices of Mapúa University.',
  ],
  rights: [
    'You have the right to be informed, to access, to rectify, to object to processing, to erasure or blocking, and to data portability, and to lodge a complaint before the National Privacy Commission.',
    'You may withdraw consent prospectively; withdrawal does not affect the lawfulness of processing that occurred before it, and the University may retain records required by its retention policy or by law.',
  ],
  contact:
    'To exercise your rights or ask questions about this notice, contact the Mapúa University Student Affairs Office (OSAAR) through your organization adviser or the official OSAAR email address.',
};

/** sha256 of the canonical (sorted-key) JSON of the notice text. */
export function privacyNoticeHash(notice: PrivacyNotice = PRIVACY_NOTICE): string {
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
