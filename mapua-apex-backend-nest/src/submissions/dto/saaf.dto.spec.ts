import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PRIVACY_NOTICE_VERSION } from '../../privacy/privacy-notice.js';
import { TERMS_NOTICE_VERSION } from '../../terms/terms-notice.js';
import { SaafDto } from './saaf.dto.js';

/** Minimal SAAF body; each test overrides the budget section it cares about. */
const bodyWith = (detailedBudgetProposal: unknown): Item => ({
  submission_type: 'saaf',
  activity_classification: {
    activity_type: 'co-curricular',
    total_org_members: 10,
  },
  proponents: [
    {
      first_name: 'Ana',
      last_name: 'Mendoza',
      position_of_applicant: 'President',
      department: 'CAS',
      contact_number: '09171234567',
      email_address: 'ana.mendoza@mymail.mapua.edu.ph',
    },
  ],
  activity_details: {
    title_and_nature: 'Week of Welcome',
    description: 'A campus-wide orientation week.',
    objectives: 'Students learn about student organizations.',
    venue: 'MAIN',
    date_of_event: '2026-10-01',
    time_of_event: '09:00 AM to 12:00 NN',
    expected_participants: 100,
    individual_contribution: 0,
    proposed_budget: 0,
  },
  institutional_alignment: {
    mission_statements: {
      competitive: true,
      research: false,
      solutions: false,
    },
    core_values_explanation: 'Service and excellence.',
    sdg_explanation: 'Quality education.',
  },
  detailed_budget_proposal: detailedBudgetProposal,
  venue_reservation: { has_reservation: false },
});

type Item = Record<string, unknown>;

function issues(detailedBudgetProposal: unknown): string[] {
  const instance = plainToInstance(SaafDto, bodyWith(detailedBudgetProposal), {
    exposeUnsetFields: false,
  });
  const found: string[] = [];
  const walk = (
    errors: ReturnType<typeof validateSync>,
    path: string,
  ): void => {
    for (const error of errors) {
      const key = path ? `${path}.${error.property}` : error.property;
      if (error.constraints)
        found.push(`${key}: ${JSON.stringify(error.constraints)}`);
      if (error.children?.length) walk(error.children, key);
    }
  };
  walk(validateSync(instance, { whitelist: true }), '');
  return found;
}

describe('SaafDto budget validation', () => {
  it('accepts a no-budget proposal with empty lines and zero totals', () => {
    expect(issues({ has_budget: false, items: [], grand_total: 0 })).toEqual(
      [],
    );
  });

  it('accepts a no-budget proposal without the legacy-required non-empty items', () => {
    expect(issues({ has_budget: false })).toEqual([]);
  });

  it('still accepts a with-budget proposal shaped like the old payload', () => {
    expect(
      issues({
        has_budget: true,
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
    ).toEqual([]);
  });

  it('keeps validating line items when a budget is present', () => {
    const found = issues({
      has_budget: true,
      items: [{ item_no: '1', unit: 'way too many units', quantity: 2 }],
      grand_total: 100,
    });
    expect(found.join('\n')).toContain('detailed_budget_proposal.items');
  });

  it('still validates a legacy proposal that carries no has_budget key', () => {
    // Missing key means an older paper, which always carried at least one line.
    expect(
      issues({
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
    ).toEqual([]);
  });

  it('keeps `has_budget: false` through the whitelist used by the global pipe', () => {
    const instance = plainToInstance(
      SaafDto,
      bodyWith({ has_budget: false, items: [], grand_total: 0 }),
      { exposeUnsetFields: false },
    );
    validateSync(instance, { whitelist: true });
    const proposal = instance.detailed_budget_proposal as unknown as Item;
    expect(proposal.has_budget).toBe(false);
  });

  it('accepts a with-budget proposal carrying funding sources', () => {
    expect(
      issues({
        has_budget: true,
        funding_sources: ['sponsors', 'organization'],
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
    ).toEqual([]);
  });

  it('rejects an unknown funding source with the nested error key', () => {
    const found = issues({
      has_budget: true,
      funding_sources: ['investors'],
      items: [
        {
          item_no: '1',
          unit: 'pc',
          quantity: 2,
          price_per_unit: 50,
          total: 100,
        },
      ],
      grand_total: 100,
    });
    expect(found.join('\n')).toContain(
      'detailed_budget_proposal.funding_sources',
    );
  });

  it('keeps `funding_sources` through the whitelist used by the global pipe', () => {
    const instance = plainToInstance(
      SaafDto,
      bodyWith({
        has_budget: true,
        funding_sources: ['sponsors', 'organization'],
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
      { exposeUnsetFields: false },
    );
    validateSync(instance, { whitelist: true });
    const proposal = instance.detailed_budget_proposal as unknown as Item;
    expect(proposal.funding_sources).toEqual(['sponsors', 'organization']);
  });

  it('accepts the newly added funding sources', () => {
    expect(
      issues({
        has_budget: true,
        funding_sources: ['member_contributions', 'others'],
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
    ).toEqual([]);
  });

  it('accepts a with-budget proposal carrying a budget note', () => {
    expect(
      issues({
        has_budget: true,
        note: 'Sponsorship covers the venue; contributions cover food.',
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
    ).toEqual([]);
  });

  it('rejects a budget note longer than 500 characters', () => {
    const found = issues({
      has_budget: true,
      note: 'a'.repeat(501),
      items: [
        {
          item_no: '1',
          unit: 'pc',
          quantity: 2,
          price_per_unit: 50,
          total: 100,
        },
      ],
      grand_total: 100,
    });
    expect(found.join('\n')).toContain('detailed_budget_proposal.note');
  });

  it('keeps `note` through the whitelist used by the global pipe', () => {
    const instance = plainToInstance(
      SaafDto,
      bodyWith({
        has_budget: true,
        note: 'Member contributions cover catering.',
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
      { exposeUnsetFields: false },
    );
    validateSync(instance, { whitelist: true });
    const proposal = instance.detailed_budget_proposal as unknown as Item;
    expect(proposal.note).toBe('Member contributions cover catering.');
  });
});

describe('SaafDto privacy consent validation', () => {
  const noBudget = { has_budget: false, items: [], grand_total: 0 };

  function consentIssues(consent: unknown): string[] {
    const body: Item = { ...bodyWith(noBudget) };
    if (consent !== undefined) body.privacy_consent = consent;
    const instance = plainToInstance(SaafDto, body, {
      exposeUnsetFields: false,
    });
    const found: string[] = [];
    const walk = (
      errors: ReturnType<typeof validateSync>,
      path: string,
    ): void => {
      for (const error of errors) {
        const key = path ? `${path}.${error.property}` : error.property;
        if (error.constraints)
          found.push(`${key}: ${JSON.stringify(error.constraints)}`);
        if (error.children?.length) walk(error.children, key);
      }
    };
    walk(validateSync(instance, { whitelist: true }), '');
    return found;
  }

  it('accepts the current notice version with accepted true', () => {
    expect(
      consentIssues({ version: PRIVACY_NOTICE_VERSION, accepted: true }),
    ).toEqual([]);
  });

  it('leaves consent optional at the DTO boundary so the admin PUT still validates', () => {
    expect(consentIssues(undefined)).toEqual([]);
  });

  it('rejects a stale notice version', () => {
    expect(
      consentIssues({ version: '0.9-old', accepted: true }).join('\n'),
    ).toContain('privacy_consent.version');
  });

  it('rejects an unaccepted consent', () => {
    expect(
      consentIssues({ version: PRIVACY_NOTICE_VERSION, accepted: false }).join(
        '\n',
      ),
    ).toContain('privacy_consent.accepted');
  });

  it('keeps the consent through the whitelist used by the global pipe', () => {
    const instance = plainToInstance(
      SaafDto,
      {
        ...bodyWith(noBudget),
        privacy_consent: { version: PRIVACY_NOTICE_VERSION, accepted: true },
      },
      { exposeUnsetFields: false },
    );
    validateSync(instance, { whitelist: true });
    const consent = instance.privacy_consent as unknown as Item;
    expect(consent.version).toBe(PRIVACY_NOTICE_VERSION);
    expect(consent.accepted).toBe(true);
  });
});

/** Validates an arbitrary body patch merged over the minimal SAAF body. */
function bodyIssues(patch: Item): string[] {
  const instance = plainToInstance(
    SaafDto,
    { ...bodyWith({ has_budget: false }), ...patch },
    { exposeUnsetFields: false },
  );
  const found: string[] = [];
  const walk = (
    errors: ReturnType<typeof validateSync>,
    path: string,
  ): void => {
    for (const error of errors) {
      const key = path ? `${path}.${error.property}` : error.property;
      if (error.constraints)
        found.push(`${key}: ${JSON.stringify(error.constraints)}`);
      if (error.children?.length) walk(error.children, key);
    }
  };
  walk(validateSync(instance, { whitelist: true }), '');
  return found;
}

describe('SaafDto new SAAF fields (S-2/S-5/S-6/S-7/S-8)', () => {
  it('accepts the nature-of-activity multi-select (S-2)', () => {
    expect(
      bodyIssues({
        activity_classification: {
          activity_type: 'co-curricular',
          total_org_members: 10,
          nature_of_activity: ['Selling activity', 'Fundraising/charity'],
        },
      }),
    ).toEqual([]);
  });

  it('rejects non-string nature-of-activity entries', () => {
    expect(
      bodyIssues({
        activity_classification: {
          activity_type: 'co-curricular',
          total_org_members: 10,
          nature_of_activity: [42],
        },
      }).join('\n'),
    ).toContain('activity_classification.nature_of_activity');
  });

  it('accepts both campus locations (S-5)', () => {
    for (const campus_location of ['on-campus', 'off-campus']) {
      expect(
        bodyIssues({
          activity_details: {
            ...bodyWith({ has_budget: false }).activity_details,
            campus_location,
          },
        }),
      ).toEqual([]);
    }
  });

  it('rejects an unknown campus location', () => {
    expect(
      bodyIssues({
        activity_details: {
          ...bodyWith({ has_budget: false }).activity_details,
          campus_location: 'hybrid',
        },
      }).join('\n'),
    ).toContain('activity_details.campus_location');
  });

  it('accepts the participant split and keeps the total (S-6)', () => {
    expect(
      bodyIssues({
        activity_details: {
          ...bodyWith({ has_budget: false }).activity_details,
          mapua_participants: 80,
          non_mapua_participants: 20,
          has_non_mapua: true,
        },
      }),
    ).toEqual([]);
  });

  it('rejects non-numeric participant counts', () => {
    expect(
      bodyIssues({
        activity_details: {
          ...bodyWith({ has_budget: false }).activity_details,
          mapua_participants: 'many',
        },
      }).join('\n'),
    ).toContain('activity_details.mapua_participants');
  });

  it('accepts a proponent campus (S-7)', () => {
    const body = bodyWith({ has_budget: false });
    const proponents = (body.proponents as Item[]).map((proponent) => ({
      ...proponent,
      campus: 'campus-intramuros',
    }));
    expect(bodyIssues({ proponents })).toEqual([]);
  });

  it('accepts outside equipment and room equipment picks (S-8)', () => {
    expect(
      bodyIssues({
        venue_reservation: {
          has_reservation: true,
          outside_equipment: [
            { name: 'Sound system', purpose: 'Program audio' },
            { name: 'Smoke machine' },
          ],
          reservations: [
            {
              reservable_id: 'room-n101',
              campus_id: 'campus-intramuros',
              type: 'room',
              selections: [{ date: '2026-10-01', slots: [0, 1] }],
              remarks: 'General assembly',
              room_equipment: [{ name: 'Projector', quantity: 1 }],
            },
          ],
        },
      }),
    ).toEqual([]);
  });

  it('rejects an outside equipment item without a name', () => {
    expect(
      bodyIssues({
        venue_reservation: {
          has_reservation: true,
          outside_equipment: [{ purpose: 'No name given' }],
        },
      }).join('\n'),
    ).toContain('venue_reservation.outside_equipment');
  });

  it('rejects a room equipment pick with a zero quantity', () => {
    expect(
      bodyIssues({
        venue_reservation: {
          has_reservation: true,
          reservations: [
            {
              reservable_id: 'room-n101',
              campus_id: 'campus-intramuros',
              type: 'room',
              selections: [{ date: '2026-10-01', slots: [0, 1] }],
              remarks: 'General assembly',
              room_equipment: [{ name: 'Projector', quantity: 0 }],
            },
          ],
        },
      }).join('\n'),
    ).toContain('room_equipment');
  });
});

describe('SaafDto terms consent validation (S-1)', () => {
  it('accepts the current terms version with accepted true', () => {
    expect(
      bodyIssues({
        terms_consent: { version: TERMS_NOTICE_VERSION, accepted: true },
      }),
    ).toEqual([]);
  });

  it('leaves terms consent optional at the DTO boundary for the admin PUT', () => {
    expect(bodyIssues({})).toEqual([]);
  });

  it('rejects a stale terms version', () => {
    expect(
      bodyIssues({
        terms_consent: { version: '0.9-old', accepted: true },
      }).join('\n'),
    ).toContain('terms_consent.version');
  });

  it('rejects an unaccepted terms consent', () => {
    expect(
      bodyIssues({
        terms_consent: { version: TERMS_NOTICE_VERSION, accepted: false },
      }).join('\n'),
    ).toContain('terms_consent.accepted');
  });

  it('keeps the terms consent through the whitelist used by the global pipe', () => {
    const instance = plainToInstance(
      SaafDto,
      {
        ...bodyWith({ has_budget: false }),
        terms_consent: { version: TERMS_NOTICE_VERSION, accepted: true },
      },
      { exposeUnsetFields: false },
    );
    validateSync(instance, { whitelist: true });
    const consent = instance.terms_consent as unknown as Item;
    expect(consent.version).toBe(TERMS_NOTICE_VERSION);
    expect(consent.accepted).toBe(true);
  });
});
